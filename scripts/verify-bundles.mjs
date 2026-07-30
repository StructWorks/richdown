// Checks that the committed webview bundles match the current sources.
//
// media/*.js is what VS Code actually loads and it is committed to the
// repository, so a change under src/ that never got rebuilt would ship stale
// behaviour. This rebuilds each bundle in memory and compares it byte for byte
// with the committed file; nothing on disk is modified.
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const workspaceRoot = path.resolve(import.meta.dirname, "..");

// Keep in step with the build scripts in package.json.
const bundles = [
  { entry: "src/richEditor.js", outfile: "media/richEditor.js" },
  { entry: "src/mermaidLoader.js", outfile: "media/mermaid.js" },
  { entry: "src/richDiff.js", outfile: "media/richDiff.js" },
];

const stale = [];

for (const bundle of bundles) {
  const result = await build({
    absWorkingDir: workspaceRoot,
    entryPoints: [bundle.entry],
    outfile: bundle.outfile,
    bundle: true,
    format: "iife",
    write: false,
  });

  const built = result.outputFiles[0].text;
  let committed;
  try {
    committed = await readFile(path.join(workspaceRoot, bundle.outfile), "utf8");
  } catch {
    stale.push(`${bundle.outfile} is missing`);
    continue;
  }

  if (built !== committed) {
    stale.push(
      `${bundle.outfile} does not match ${bundle.entry} ` +
        `(committed ${committed.length} bytes, rebuilt ${built.length} bytes)`,
    );
  }
}

if (stale.length > 0) {
  console.error("Stale webview bundles:");
  for (const message of stale) {
    console.error(`  - ${message}`);
  }
  console.error("\nRun `npm run build:all` and commit the updated media/ files.");
  process.exit(1);
}

console.log(`All ${bundles.length} webview bundles match their sources.`);
