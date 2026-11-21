// Checks that the Orca plugin builds and is ready to ship with this release.
//
// The plugin is published as StructWorks/richdown-orca, built by
// scripts/build-orca-plugin.mjs from orca/ and src/. This builds it into a
// temporary folder and checks that the manifest carries package.json's version,
// that every file the manifest and the editor page point to is there, and that
// the folder fits Orca's limits for a plugin. `orca plugin validate <folder>`
// checks the rest of the manifest when the Orca CLI is installed.
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { buildOrcaPlugin } from "./build-orca-plugin.mjs";

const MAX_FILES = 2000;
const MAX_BYTES = 50 * 1024 * 1024;

const outDir = await mkdtemp(path.join(os.tmpdir(), "richdown-orca-"));
const problems = [];
try {
  const result = await buildOrcaPlugin({ outDir });
  const manifest = JSON.parse(await readFile(path.join(outDir, "orca-plugin.json"), "utf8"));

  const referenced = [manifest.icon, manifest.main];
  for (const editor of manifest.contributes?.customEditors ?? []) {
    referenced.push(editor.entry);
    const html = await readFile(path.join(outDir, editor.entry), "utf8");
    for (const [, src] of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
      referenced.push(path.join(path.dirname(editor.entry), src));
    }
  }
  // The editor bundle loads Mermaid itself, beside the editor page.
  referenced.push("mermaid.js");
  for (const file of referenced.filter(Boolean)) {
    if (!existsSync(path.join(outDir, file))) {
      problems.push(`${file} is referenced by the Orca plugin but was not built`);
    }
  }
  if (result.files > MAX_FILES || result.bytes > MAX_BYTES) {
    problems.push(
      `the plugin has ${result.files} files and ${result.bytes} bytes; Orca allows ${MAX_FILES} and ${MAX_BYTES}`,
    );
  }

  if (problems.length === 0) {
    console.log(
      `Orca plugin richdown ${result.version} matches package.json and builds: ` +
        `${result.files} files, ${(result.bytes / 1024 / 1024).toFixed(1)} MB.`,
    );
  }
} catch (error) {
  problems.push(error instanceof Error ? error.message : String(error));
} finally {
  await rm(outDir, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error("Orca plugin is not ready:");
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}
