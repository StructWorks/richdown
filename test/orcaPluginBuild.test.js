import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOrcaPlugin } from "../scripts/build-orca-plugin.mjs";

// Builds the Orca plugin once, into a folder that already holds a Git checkout
// and a stale file, the way the publishing workflow uses it.
let outDir;
let result;

beforeAll(async () => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "richdown-orca-build-"));
  fs.mkdirSync(path.join(outDir, ".git"));
  fs.writeFileSync(path.join(outDir, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(path.join(outDir, "stale.js"), "old");
  result = await buildOrcaPlugin({ outDir, sourceCommit: "abc1234" });
}, 60_000);

afterAll(() => {
  fs.rmSync(outDir, { recursive: true, force: true });
});

const read = (file) => fs.readFileSync(path.join(outDir, file), "utf8");
const exists = (file) => fs.existsSync(path.join(outDir, file));

describe("Orca plugin build", () => {
  it("writes a plugin whose manifest points at files it contains", () => {
    const manifest = JSON.parse(read("orca-plugin.json"));
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

    expect(manifest.version).toBe(pkg.version);
    expect(exists(manifest.icon)).toBe(true);
    expect(exists(manifest.main)).toBe(true);
    for (const editor of manifest.contributes.customEditors) {
      expect(exists(editor.entry)).toBe(true);
    }
    expect(read("editor.html")).toContain('<script src="./orcaEditor.js"></script>');
    expect(exists("mermaid.js")).toBe(true);
  });

  it("keeps the folder's Git checkout and clears everything else", () => {
    expect(exists(".git/HEAD")).toBe(true);
    expect(exists("stale.js")).toBe(false);
  });

  it("names the version and the source commit in the README", () => {
    const readme = read("README.md");
    expect(readme).toContain(`Version ${result.version}, built from`);
    expect(readme).toContain("StructWorks/richdown/commit/abc1234");
    expect(readme).not.toContain("{{");
  });

  it("leaves the worker readable and minifies the editor", () => {
    const worker = read("orcaWorker.mjs");
    expect(worker).toContain("function createRichdownWorker(");
    expect(worker.startsWith("import { createRequire }")).toBe(true);
    // Minified output has few, very long lines.
    const editorLines = read("orcaEditor.js").split("\n");
    expect(editorLines.length).toBeLessThan(2000);
  });

  it("includes the source the bundles are built from, without dependencies", () => {
    for (const file of [
      "source/src/orcaEditor.js",
      "source/src/orcaWorker.js",
      "source/src/mermaidLoader.js",
      "source/src/orca-worker/remoteImages.js",
      "source/src/richEditor.js",
      "source/package.json",
      "source/package-lock.json",
      "source/scripts/build-orca-plugin.mjs",
      "source/orca/orca-plugin.json",
      "source/orca/README.md",
    ]) {
      expect(exists(file), file).toBe(true);
    }
    expect(exists("source/node_modules")).toBe(false);
    // The VS Code extension's own files are not part of the plugin.
    expect(exists("source/extension.js")).toBe(false);
    expect(exists("source/src/richDiff.js")).toBe(false);
  });

  it("stays well inside Orca's limits for a plugin", () => {
    expect(result.files).toBeLessThan(200);
    expect(result.bytes).toBeLessThan(10 * 1024 * 1024);
  });
});
