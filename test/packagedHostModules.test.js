import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// extension.js runs from the packaged VSIX, where .vscodeignore excludes all of
// src/** so the webview sources are not shipped. Every module the extension
// host requires at load time therefore needs an explicit un-ignore rule, or the
// extension throws on activation and no file can be opened (Richdown 0.8.3
// shipped src/host/lineEndings.js without one).
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readRepoFile = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

const requiredSrcPaths = [
  ...readRepoFile("extension.js").matchAll(
    /require\(["'](\.\/src\/[^"']+)["']\)/g,
  ),
].map((match) => match[1].replace(/^\.\//, ""));

describe("extension host modules shipped in the VSIX", () => {
  const ignoreRules = readRepoFile(".vscodeignore")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  it("requires at least one module from src/", () => {
    expect(requiredSrcPaths.length).toBeGreaterThan(0);
  });

  it.each(requiredSrcPaths)(".vscodeignore keeps %s", (requiredPath) => {
    const directory = path.posix.dirname(requiredPath);
    expect(ignoreRules).toContain(`!${directory}/**`);
  });
});
