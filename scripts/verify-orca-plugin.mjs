// Checks that the Orca plugin manifest is ready to ship with this release.
//
// Orca installs the plugin straight from this repository (orca-plugin.json at
// its root) and lists a release by its `v<version>` tag, so the manifest has to
// carry the same version as package.json, and every file it and the editor
// page point to has to be committed. `orca plugin validate .` checks the rest
// of the manifest when the Orca CLI is installed.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const problems = [];

const readJson = async (file) =>
  JSON.parse(await readFile(path.join(workspaceRoot, file), "utf8"));

const pkg = await readJson("package.json");
const manifest = await readJson("orca-plugin.json");

if (manifest.version !== pkg.version) {
  problems.push(
    `orca-plugin.json version ${manifest.version} does not match package.json ${pkg.version}`,
  );
}

const referenced = [manifest.icon];
for (const editor of manifest.contributes?.customEditors ?? []) {
  referenced.push(editor.entry);
  const html = await readFile(path.join(workspaceRoot, editor.entry), "utf8");
  for (const [, src] of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
    referenced.push(path.join(path.dirname(editor.entry), src));
  }
}
// The editor bundle loads Mermaid itself, relative to the editor page.
referenced.push("media/mermaid.js");

for (const file of referenced.filter(Boolean)) {
  if (!existsSync(path.join(workspaceRoot, file))) {
    problems.push(`${file} is referenced by the Orca plugin but missing`);
  }
}

if (problems.length > 0) {
  console.error("Orca plugin is not ready:");
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(`Orca plugin ${manifest.id} ${manifest.version} matches package.json.`);
