import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { createExportImageMap, findChromiumExecutable } = require(
  "../src/export/markdownExport.js",
);

// A one pixel PNG, so the tests can assert real base64 payloads.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

let workspace;
let sourcePath;

function write(relativePath, contents = PNG_BYTES) {
  const target = path.join(workspace, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  return target;
}

beforeEach(() => {
  workspace = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "richdown-export-test-")),
  );
  sourcePath = path.join(workspace, "docs", "note.md");
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, "# Note\n");
});

afterEach(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
});

function buildMap(markdown, options = {}) {
  return createExportImageMap({
    markdown,
    sourcePath,
    allowedRoots: [workspace],
    ...options,
  });
}

describe("createExportImageMap", () => {
  it("embeds a relative image as a data URI", async () => {
    write("docs/img/logo.png");
    const map = await buildMap("![logo](img/logo.png)");

    expect(map["img/logo.png"]).toBe(
      `data:image/png;base64,${PNG_BYTES.toString("base64")}`,
    );
  });

  it("embeds an image referenced with angle brackets", async () => {
    write("docs/my image.png");
    const map = await buildMap("![alt](<my image.png>)");

    expect(map["my image.png"]).toContain("data:image/png;base64,");
  });

  it("also keys the map by the percent-decoded source", async () => {
    write("docs/my image.png");
    const map = await buildMap("![alt](my%20image.png)");

    expect(map["my%20image.png"]).toContain("data:image/png;base64,");
    expect(map["my image.png"]).toBe(map["my%20image.png"]);
  });

  it("ignores the query string and fragment when resolving", async () => {
    write("docs/logo.png");
    const map = await buildMap("![alt](logo.png?v=2#top)");

    expect(map["logo.png?v=2#top"]).toContain("data:image/png;base64,");
  });

  it("resolves a path that walks up out of the document folder", async () => {
    write("assets/shared.png");
    const map = await buildMap("![alt](../assets/shared.png)");

    expect(map["../assets/shared.png"]).toContain("data:image/png;base64,");
  });

  it("resolves an absolute path inside an allowed root", async () => {
    const absolute = write("docs/abs.png");
    const map = await buildMap(`![alt](${absolute})`);

    expect(map[absolute]).toContain("data:image/png;base64,");
  });

  it("skips remote and data sources", async () => {
    const map = await buildMap(
      [
        "![a](https://example.com/a.png)",
        "![b](http://example.com/b.png)",
        "![c](data:image/png;base64,AAA)",
      ].join("\n\n"),
    );

    expect(map).toEqual({});
  });

  it("skips a file outside every allowed root", async () => {
    const outside = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "richdown-outside-")),
    );
    fs.writeFileSync(path.join(outside, "secret.png"), PNG_BYTES);

    const map = await buildMap(`![alt](${path.join(outside, "secret.png")})`);

    expect(map).toEqual({});
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it("skips a missing file", async () => {
    expect(await buildMap("![alt](gone.png)")).toEqual({});
  });

  it("skips a directory that matches the source", async () => {
    fs.mkdirSync(path.join(workspace, "docs", "folder.png"));
    expect(await buildMap("![alt](folder.png)")).toEqual({});
  });

  it("skips a file type that is not an image", async () => {
    write("docs/notes.txt", Buffer.from("text"));
    expect(await buildMap("![alt](notes.txt)")).toEqual({});
  });

  it.each([
    ["logo.apng", "image/apng"],
    ["logo.gif", "image/gif"],
    ["logo.jpg", "image/jpeg"],
    ["logo.jpeg", "image/jpeg"],
    ["logo.png", "image/png"],
    ["logo.svg", "image/svg+xml"],
    ["logo.webp", "image/webp"],
    ["LOGO.PNG", "image/png"],
  ])("maps %s to %s", async (name, mimeType) => {
    write(`docs/${name}`);
    const map = await buildMap(`![alt](${name})`);

    expect(map[name].startsWith(`data:${mimeType};base64,`)).toBe(true);
  });

  it("links instead of embedding a file above the size limit", async () => {
    const target = write("docs/big.png", Buffer.alloc(2048, 1));
    const map = await buildMap("![alt](big.png)", { embedLimitBytes: 1024 });

    expect(map["big.png"]).toBe(pathToFileURL(target).href);
  });

  it("embeds a file exactly at the size limit", async () => {
    write("docs/edge.png", Buffer.alloc(1024, 1));
    const map = await buildMap("![alt](edge.png)", { embedLimitBytes: 1024 });

    expect(map["edge.png"]).toContain("data:image/png;base64,");
  });

  it("collects every distinct image once", async () => {
    write("docs/one.png");
    write("docs/two.png");
    const map = await buildMap(
      ["![a](one.png)", "![b](one.png)", "![c](two.png)"].join("\n\n"),
    );

    expect(Object.keys(map).sort()).toEqual(["one.png", "two.png"]);
  });

  it("ignores links that are not images", async () => {
    write("docs/logo.png");
    expect(await buildMap("[logo.png](logo.png)")).toEqual({});
  });

  it("handles an empty or missing document", async () => {
    expect(await buildMap("")).toEqual({});
    expect(await buildMap(undefined)).toEqual({});
  });

  it("resolves a symlinked root to its real path", async () => {
    write("assets/real.png");
    const link = path.join(workspace, "linked-assets");
    fs.symlinkSync(path.join(workspace, "assets"), link);

    const map = await createExportImageMap({
      markdown: "![alt](../linked-assets/real.png)",
      sourcePath,
      allowedRoots: [link],
    });

    expect(map["../linked-assets/real.png"]).toContain("data:image/png;base64,");
  });

  it("treats a non-existent allowed root as a plain path", async () => {
    write("docs/logo.png");
    const map = await createExportImageMap({
      markdown: "![alt](logo.png)",
      sourcePath,
      allowedRoots: [path.join(workspace, "does-not-exist"), workspace],
    });

    expect(map["logo.png"]).toContain("data:image/png;base64,");
  });

  it("maps nothing when no roots are allowed", async () => {
    write("docs/logo.png");
    expect(
      await createExportImageMap({ markdown: "![alt](logo.png)", sourcePath }),
    ).toEqual({});
  });
});

describe("findChromiumExecutable", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("prefers the Richdown override when it is executable", () => {
    const browser = path.join(workspace, "my-chrome");
    fs.writeFileSync(browser, "#!/bin/sh\n");
    fs.chmodSync(browser, 0o755);
    process.env.RICHDOWN_CHROME_PATH = browser;

    expect(findChromiumExecutable()).toBe(browser);
  });

  it("falls back to CHROME_PATH", () => {
    const browser = path.join(workspace, "chrome-env");
    fs.writeFileSync(browser, "#!/bin/sh\n");
    fs.chmodSync(browser, 0o755);
    delete process.env.RICHDOWN_CHROME_PATH;
    process.env.CHROME_PATH = browser;

    expect(findChromiumExecutable()).toBe(browser);
  });

  it("ignores an override that is not executable", () => {
    const notExecutable = path.join(workspace, "not-a-browser");
    fs.writeFileSync(notExecutable, "text");
    fs.chmodSync(notExecutable, 0o644);
    process.env.RICHDOWN_CHROME_PATH = notExecutable;
    process.env.PATH = "";
    delete process.env.CHROME_PATH;

    expect(findChromiumExecutable()).not.toBe(notExecutable);
  });

  it("returns an executable that exists, or an empty string", () => {
    // Without an override the search walks the platform's application folders
    // and PATH, so the result depends on what this machine has installed. The
    // invariant is that it never reports a path that cannot be launched.
    delete process.env.RICHDOWN_CHROME_PATH;
    delete process.env.CHROME_PATH;
    process.env.PATH = path.join(workspace, "empty");

    const found = findChromiumExecutable();
    expect(typeof found).toBe("string");
    if (found) {
      expect(() => fs.accessSync(found, fs.constants.X_OK)).not.toThrow();
    }
  });

  it("finds a browser on PATH when no override is set", () => {
    const binDir = path.join(workspace, "bin");
    fs.mkdirSync(binDir, { recursive: true });
    const browser = path.join(
      binDir,
      process.platform === "win32" ? "chrome.exe" : "chromium",
    );
    fs.writeFileSync(browser, "#!/bin/sh\n");
    fs.chmodSync(browser, 0o755);

    delete process.env.RICHDOWN_CHROME_PATH;
    delete process.env.CHROME_PATH;
    process.env.PATH = binDir;

    const found = findChromiumExecutable();
    // A browser installed in a standard application folder still wins over PATH,
    // so accept either — both are launchable.
    expect(found === browser || fs.existsSync(found)).toBe(true);
    expect(found).toBeTruthy();
  });
});
