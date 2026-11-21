import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRichdownWorker } from "../src/orca-worker/richdownWorker.js";
import {
  createRemoteImageCache,
  IMAGE_CHUNK_BYTES,
  parseImagePath,
} from "../src/orca-worker/imageSources.js";
import { createWorkspaceFileIndex } from "../src/orca-worker/workspaceFiles.js";
import { fingerprintText } from "../src/rich-editor/domain/textFingerprint.js";

const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000",
  "hex",
);

let base;
let workspace;
let other;

function write(root, relativePath, contents = PNG_BYTES) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  return filePath;
}

// A stand-in for the worker's `orca.host`: two local workspaces (the first
// focused) and one on an SSH host, which is never searched.
function createHost({ focused = "ws-1" } = {}) {
  return {
    call: vi.fn(async (method) => {
      if (method === "workspace.readContext") {
        return { workspaceId: focused, branch: "main", displayName: "docs", terminals: [] };
      }
      if (method === "workspace.list") {
        return {
          workspaces: [
            { id: "ws-1", kind: "folder", name: "docs", path: workspace, branch: "main", hostId: "local" },
            { id: "ws-2", kind: "folder", name: "other", path: other, branch: "main", hostId: null },
            { id: "ws-3", kind: "worktree", name: "remote", path: "/srv/repo", branch: "main", hostId: "ssh:box" },
          ],
          truncated: false,
        };
      }
      throw new Error(`unexpected ${method}`);
    }),
  };
}

function createWorker(options = {}) {
  return createRichdownWorker({
    host: createHost(options),
    listFiles: createWorkspaceFileIndex({ ttlMs: 0 }).list,
    remoteImages: options.remoteImages,
  });
}

function locateInput(text) {
  return {
    fingerprint: fingerprintText(text),
    byteLength: Buffer.byteLength(text, "utf8"),
  };
}

async function readWhole(worker, input) {
  const first = await worker.readImage({ ...input, offset: 0 });
  if (!first.found) {
    return first;
  }
  const chunks = [Buffer.from(first.data, "base64")];
  let next = first;
  while (!next.done) {
    next = await worker.readImage({ ...input, offset: chunks.reduce((sum, c) => sum + c.length, 0) });
    chunks.push(Buffer.from(next.data, "base64"));
  }
  return { ...first, bytes: Buffer.concat(chunks), chunkCount: chunks.length };
}

beforeEach(() => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "richdown-orca-")));
  workspace = path.join(base, "workspace");
  other = path.join(base, "other");
  fs.mkdirSync(workspace);
  fs.mkdirSync(other);
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe("locating the open document", () => {
  it("finds the file whose text the editor opened, CRLF and BOM included", async () => {
    const text = "# Notes\r\n\r\nSee the diagram.\r\n";
    write(workspace, "docs/notes.md", `\uFEFF${text}`);
    write(workspace, "docs/other.md", "# Other\n");
    const worker = createWorker();

    await expect(worker.locate(locateInput(text))).resolves.toEqual({
      documentPaths: [path.join(workspace, "docs/notes.md")],
      workspaceRoot: workspace,
    });
  });

  it("returns every copy of the text, in the focused workspace first", async () => {
    write(workspace, "a/README.md", "# Same\n");
    write(workspace, "b/README.md", "# Same\n");
    write(other, "README.md", "# Same\n");
    const worker = createWorker();

    const location = await worker.locate(locateInput("# Same\n"));

    expect(location.workspaceRoot).toBe(workspace);
    expect(location.documentPaths.sort()).toEqual([
      path.join(workspace, "a/README.md"),
      path.join(workspace, "b/README.md"),
    ]);
  });

  it("looks in other local workspaces when the focused one has no match", async () => {
    write(other, "guide.md", "# Guide\n");
    const worker = createWorker();

    await expect(worker.locate(locateInput("# Guide\n"))).resolves.toEqual({
      documentPaths: [path.join(other, "guide.md")],
      workspaceRoot: other,
    });
  });

  it("answers with the focused workspace and no file when nothing matches", async () => {
    write(workspace, "notes.md", "# Saved\n");
    const worker = createWorker();

    await expect(worker.locate(locateInput("# Unsaved draft\n"))).resolves.toEqual({
      documentPaths: [],
      workspaceRoot: workspace,
    });
  });

  it("skips hidden folders and node_modules", async () => {
    write(workspace, ".git/notes.md", "# Hidden\n");
    write(workspace, "node_modules/pkg/notes.md", "# Hidden\n");
    const worker = createWorker();

    const location = await worker.locate(locateInput("# Hidden\n"));
    expect(location.documentPaths).toEqual([]);
  });
});

describe("reading images", () => {
  let documentPath;

  beforeEach(() => {
    documentPath = write(workspace, "docs/guide/notes.md", "# Notes\n");
  });

  function input(src, extra = {}) {
    return { src, documentPaths: [documentPath], workspaceRoot: workspace, ...extra };
  }

  it("reads an image relative to the document", async () => {
    write(workspace, "docs/guide/img/a.png");
    const result = await readWhole(createWorker(), input("./img/a.png"));

    expect(result).toMatchObject({ found: true, mime: "image/png", size: PNG_BYTES.length });
    expect(result.bytes.equals(PNG_BYTES)).toBe(true);
  });

  it("decodes the path and drops a title, query and fragment", async () => {
    write(workspace, "docs/guide/my image.png");
    await expect(
      createWorker().readImage(input("<my%20image.png?raw=1#frag>")),
    ).resolves.toMatchObject({ found: true });
  });

  it("reads parent-relative, file: URL and root-absolute paths", async () => {
    const shared = write(workspace, "assets/shared.png");
    const worker = createWorker();

    await expect(worker.readImage(input("../../assets/shared.png"))).resolves.toMatchObject({ found: true });
    await expect(worker.readImage(input(`file://${shared}`))).resolves.toMatchObject({ found: true });
    await expect(worker.readImage(input("/assets/shared.png"))).resolves.toMatchObject({ found: true });
  });

  it("finds an embed by name, nearest the document first", async () => {
    write(workspace, "far/away/pic.png", Buffer.from("far"));
    write(workspace, "docs/guide/pic.png", Buffer.from("near"));
    const result = await readWhole(createWorker(), input("pic.png", { wikilink: true }));

    expect(result.bytes.toString()).toBe("near");
  });

  it("tries each copy of the document until the image exists", async () => {
    const copy = write(workspace, "copy/notes.md", "# Notes\n");
    write(workspace, "copy/only-here.png");

    await expect(
      createWorker().readImage({
        src: "only-here.png",
        documentPaths: [documentPath, copy],
        workspaceRoot: workspace,
      }),
    ).resolves.toMatchObject({ found: true });
  });

  it("matches the end of the path when the document's file is unknown", async () => {
    write(workspace, "deep/nested/img/b.png");
    await expect(
      createWorker().readImage({ src: "./img/b.png", documentPaths: [], workspaceRoot: workspace }),
    ).resolves.toMatchObject({ found: true });
  });

  it("refuses files outside the workspace, in hidden folders, or not images", async () => {
    const outside = write(base, "outside/secret.png");
    write(workspace, ".secret/key.png");
    write(workspace, "docs/guide/notes.txt", "text");
    const worker = createWorker();

    await expect(worker.readImage(input(outside))).resolves.toEqual({ found: false });
    await expect(worker.readImage(input("../../../outside/secret.png"))).resolves.toEqual({ found: false });
    await expect(worker.readImage(input("/.secret/key.png"))).resolves.toEqual({ found: false });
    await expect(worker.readImage(input("notes.txt"))).resolves.toEqual({ found: false });
    await expect(worker.readImage(input("./missing.png"))).resolves.toEqual({ found: false });
  });

  it("ignores document paths outside the local workspaces", async () => {
    write(base, "elsewhere/img.png");
    const result = await createWorker().readImage({
      src: "img.png",
      documentPaths: [path.join(base, "elsewhere/doc.md")],
      workspaceRoot: path.join(base, "elsewhere"),
    });

    expect(result).toEqual({ found: false });
  });

  it("sends a large image in chunks that join back exactly", async () => {
    const large = Buffer.alloc(IMAGE_CHUNK_BYTES * 2 + 1234, 7);
    large.set(PNG_BYTES);
    write(workspace, "docs/guide/large.png", large);
    const result = await readWhole(createWorker(), input("large.png"));

    expect(result.chunkCount).toBe(3);
    expect(result.bytes.equals(large)).toBe(true);
  });

  it("answers notModified while the file keeps its etag", async () => {
    const file = write(workspace, "docs/guide/a.png");
    const worker = createWorker();
    const first = await worker.readImage(input("a.png"));

    await expect(worker.readImage(input("a.png", { etag: first.etag }))).resolves.toEqual({
      found: true,
      notModified: true,
      etag: first.etag,
    });

    fs.writeFileSync(file, Buffer.concat([PNG_BYTES, PNG_BYTES]));
    const changed = await worker.readImage(input("a.png", { etag: first.etag }));
    expect(changed.notModified).toBeUndefined();
    expect(changed.size).toBe(PNG_BYTES.length * 2);
  });

  it("downloads remote images for the frame", async () => {
    const fetchImpl = vi.fn(async () => new Response(PNG_BYTES, {
      headers: { "content-type": "image/png", etag: '"v1"' },
    }));
    const worker = createWorker({ remoteImages: createRemoteImageCache({ fetchImpl }) });

    const result = await readWhole(worker, input("https://example.com/badge.png"));

    expect(result).toMatchObject({ found: true, mime: "image/png", etag: 'remote:"v1"' });
    expect(result.bytes.equals(PNG_BYTES)).toBe(true);
    // Chunks and repeats come from one download.
    await worker.readImage(input("https://example.com/badge.png"));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses remote responses that are not images or failed", async () => {
    const responses = {
      "https://example.com/page": new Response("<html>", { headers: { "content-type": "text/html" } }),
      "https://example.com/gone.png": new Response("", { status: 404 }),
    };
    const worker = createWorker({
      remoteImages: createRemoteImageCache({ fetchImpl: async (url) => responses[url] }),
    });

    await expect(worker.readImage(input("https://example.com/page"))).resolves.toEqual({ found: false });
    await expect(worker.readImage(input("https://example.com/gone.png"))).resolves.toEqual({ found: false });
  });
});

describe("parseImagePath", () => {
  it("leaves URL schemes other than file: alone", () => {
    expect(parseImagePath("mailto:someone@example.com")).toBeNull();
    expect(parseImagePath("data:image/png;base64,AAA")).toBeNull();
    expect(parseImagePath("img/a.png")).toBe("img/a.png");
  });
});
