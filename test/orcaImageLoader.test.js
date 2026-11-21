import { describe, expect, it, vi } from "vitest";
import { createOrcaImageLoader } from "../src/rich-editor/adapters/orcaImageLoader.js";
import { fingerprintText } from "../src/rich-editor/domain/textFingerprint.js";

const LOCATION = { documentPaths: ["/ws/docs/notes.md"], workspaceRoot: "/ws" };

// Answers richdown.readImage like the worker, from `files` (name -> bytes),
// in chunks of `chunkSize`.
function createWorkerStub(files, { chunkSize = 4 } = {}) {
  const etags = new Map(Object.keys(files).map((name) => [name, "v1"]));
  const request = vi.fn(async (name, input) => {
    expect(name).toBe("richdown.readImage");
    const bytes = files[input.src];
    if (!bytes) {
      return { found: false };
    }
    const etag = etags.get(input.src);
    if (input.offset === 0 && input.etag === etag) {
      return { found: true, notModified: true, etag };
    }
    const chunk = bytes.subarray(input.offset, input.offset + chunkSize);
    return {
      found: true,
      mime: "image/png",
      size: bytes.length,
      etag,
      offset: input.offset,
      data: Buffer.from(chunk).toString("base64"),
      done: input.offset + chunk.length >= bytes.length,
    };
  });
  return { request, etags };
}

function createLoader(files, options = {}) {
  const worker = createWorkerStub(files, options);
  let clock = 0;
  const blobs = [];
  const loader = createOrcaImageLoader({
    request: worker.request,
    locateDocument: vi.fn(async () => LOCATION),
    now: () => clock,
    createObjectUrl: (blob) => {
      blobs.push(blob);
      return `blob:test/${blobs.length}`;
    },
    revokeObjectUrl: vi.fn(),
  });
  return {
    loader,
    worker,
    blobs,
    advance: (ms) => {
      clock += ms;
    },
  };
}

describe("Orca image loader", () => {
  it("joins the worker's chunks into one blob", async () => {
    const bytes = Buffer.from("0123456789abc");
    const { loader, worker, blobs } = createLoader({ "img/a.png": bytes });

    await expect(loader.resolve("img/a.png")).resolves.toBe("blob:test/1");

    expect(worker.request).toHaveBeenCalledTimes(4);
    expect(worker.request.mock.calls[0][1]).toMatchObject({
      src: "img/a.png",
      wikilink: false,
      offset: 0,
      ...LOCATION,
    });
    expect(blobs[0].type).toBe("image/png");
    expect(Buffer.from(await blobs[0].arrayBuffer()).equals(bytes)).toBe(true);
  });

  it("asks for an embed by name", async () => {
    const { loader, worker } = createLoader({ "pic.png": Buffer.from("x") });

    await loader.resolve("[[pic.png]]");

    expect(worker.request.mock.calls[0][1]).toMatchObject({ src: "pic.png", wikilink: true });
  });

  it("passes data: and blob: sources through", async () => {
    const { loader, worker } = createLoader({});

    await expect(loader.resolve("data:image/png;base64,AAA")).resolves.toBe("data:image/png;base64,AAA");
    await expect(loader.resolve("blob:x/1")).resolves.toBe("blob:x/1");
    expect(worker.request).not.toHaveBeenCalled();
  });

  it("rejects an image the worker cannot find", async () => {
    const { loader } = createLoader({});
    await expect(loader.resolve("missing.png")).rejects.toThrow(/not found/);
  });

  it("shares one load between widgets and reuses it for a few seconds", async () => {
    const { loader, worker } = createLoader({ "a.png": Buffer.from("ab") });

    const [first, second] = await Promise.all([loader.resolve("a.png"), loader.resolve("a.png")]);
    await loader.resolve("a.png");

    expect(first).toBe(second);
    expect(worker.request).toHaveBeenCalledTimes(1);
  });

  it("keeps the image when the worker says it has not changed", async () => {
    const { loader, worker, advance } = createLoader({ "a.png": Buffer.from("ab") });
    const url = await loader.resolve("a.png");
    advance(5000);

    await expect(loader.resolve("a.png")).resolves.toBe(url);
    expect(worker.request).toHaveBeenCalledTimes(2);
    expect(worker.request.mock.calls[1][1]).toMatchObject({ offset: 0, etag: "v1" });
  });

  it("loads the new image after the file changed", async () => {
    const files = { "a.png": Buffer.from("ab") };
    const { loader, worker, advance, blobs } = createLoader(files);
    await loader.resolve("a.png");
    advance(5000);

    files["a.png"] = Buffer.from("changed");
    worker.etags.set("a.png", "v2");

    await expect(loader.resolve("a.png")).resolves.toBe("blob:test/2");
    expect(Buffer.from(await blobs[1].arrayBuffer()).toString()).toBe("changed");
  });

  it("gives up when the file changes between chunks", async () => {
    const files = { "a.png": Buffer.from("0123456789") };
    const { loader, worker } = createLoader(files);
    const realRequest = worker.request.getMockImplementation();
    worker.request.mockImplementation(async (name, input) => {
      if (input.offset > 0) {
        worker.etags.set("a.png", "v2");
      }
      return realRequest(name, input);
    });

    await expect(loader.resolve("a.png")).rejects.toThrow(/changed/);
  });
});

describe("text fingerprint", () => {
  it("ignores line endings and a byte order mark", () => {
    expect(fingerprintText("\uFEFFa\r\nb\r\n")).toEqual(fingerprintText("a\nb\n"));
  });

  it("tells different texts apart", () => {
    expect(fingerprintText("# One\n").hash).not.toBe(fingerprintText("# Two\n").hash);
    expect(fingerprintText("abc")).toMatchObject({ length: 3 });
  });
});
