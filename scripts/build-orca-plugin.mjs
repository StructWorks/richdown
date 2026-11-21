// Builds the Orca plugin into one folder: what StructWorks/richdown-orca
// holds, and what `orca plugin dev watch` loads during development.
//
// Orca installs a plugin as every file of its repository, so the plugin is not
// this repository (VS Code bundles, tests, screenshots) but a folder with only:
//
//   orca-plugin.json, editor.html, icon.png, LICENSE, README.md
//   orcaEditor.js   the editor frame (CodeMirror and Richdown), minified
//   mermaid.js      Mermaid, which the editor loads on demand, minified
//   orcaWorker.mjs  the Node worker, bundled but not minified, so the code that
//                   runs with the user's access reads as written
//   source/         the files of this repository the bundles are built from,
//                   with package.json, package-lock.json and this script, so
//                   anyone can rebuild the bundles and compare them
//
// Usage: node scripts/build-orca-plugin.mjs [--out <dir>] [--no-minify]
//
// The output folder is emptied first, except for a .git inside it, so it can
// be a checkout of the plugin repository.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const workspaceRoot = path.resolve(import.meta.dirname, "..");

// Files copied as they are, besides the bundles' own inputs. Kept in step
// with what a rebuild from source/ needs.
const TEMPLATE_FILES = {
  "orca/orca-plugin.json": "orca-plugin.json",
  "orca/editor.html": "editor.html",
  "resources/icon.png": "icon.png",
  LICENSE: "LICENSE",
};
const SOURCE_EXTRAS = [
  "package.json",
  "package-lock.json",
  "scripts/build-orca-plugin.mjs",
  "orca/orca-plugin.json",
  "orca/editor.html",
  "orca/README.md",
  "resources/icon.png",
  "LICENSE",
];
const WORKER_BANNER =
  "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);";

export function orcaBundles({ minify = true } = {}) {
  return [
    {
      entry: "src/orcaEditor.js",
      outfile: "orcaEditor.js",
      options: { format: "iife", minify },
    },
    {
      entry: "src/mermaidLoader.js",
      outfile: "mermaid.js",
      options: { format: "iife", minify },
    },
    {
      entry: "src/orcaWorker.js",
      outfile: "orcaWorker.mjs",
      // The worker bundles CommonJS modules that require Node built-ins.
      options: { format: "esm", platform: "node", banner: { js: WORKER_BANNER } },
    },
  ];
}

export async function buildOrcaPlugin({
  root = workspaceRoot,
  outDir = path.join(root, "build", "orca-plugin"),
  minify = true,
  sourceCommit = readSourceCommit(root),
} = {}) {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const manifest = JSON.parse(
    await readFile(path.join(root, "orca/orca-plugin.json"), "utf8"),
  );
  if (manifest.version !== pkg.version) {
    throw new Error(
      `orca/orca-plugin.json version ${manifest.version} does not match package.json ${pkg.version}`,
    );
  }

  await emptyFolder(outDir);

  const sourceFiles = new Set(SOURCE_EXTRAS);
  for (const bundle of orcaBundles({ minify })) {
    const result = await build({
      absWorkingDir: root,
      entryPoints: [bundle.entry],
      outfile: path.join(outDir, bundle.outfile),
      bundle: true,
      metafile: true,
      logLevel: "error",
      ...bundle.options,
    });
    for (const input of Object.keys(result.metafile.inputs)) {
      if (!input.startsWith("node_modules/")) {
        sourceFiles.add(input);
      }
    }
  }

  for (const [from, to] of Object.entries(TEMPLATE_FILES)) {
    await cp(path.join(root, from), path.join(outDir, to));
  }
  const readme = (await readFile(path.join(root, "orca/README.md"), "utf8"))
    .replaceAll("{{version}}", manifest.version)
    .replaceAll("{{commit}}", sourceCommit);
  await writeFile(path.join(outDir, "README.md"), readme);

  for (const file of [...sourceFiles].sort()) {
    const target = path.join(outDir, "source", file);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, file), target);
  }

  return { outDir, version: manifest.version, ...(await measure(outDir)) };
}

async function emptyFolder(folder) {
  await mkdir(folder, { recursive: true });
  for (const entry of await readdir(folder)) {
    if (entry !== ".git") {
      await rm(path.join(folder, entry), { recursive: true, force: true });
    }
  }
}

async function measure(folder) {
  let files = 0;
  let bytes = 0;
  const queue = [folder];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name === ".git") {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else {
        files += 1;
        bytes += (await stat(fullPath)).size;
      }
    }
  }
  return { files, bytes };
}

function readSourceCommit(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch (error) {
    // A rebuild from source/ has no Git history.
    return "unknown";
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const result = await buildOrcaPlugin({
    outDir: outIndex >= 0 ? path.resolve(args[outIndex + 1]) : undefined,
    minify: !args.includes("--no-minify"),
  });
  console.log(
    `Built Richdown ${result.version} for Orca in ${path.relative(process.cwd(), result.outDir) || "."}: ` +
      `${result.files} files, ${(result.bytes / 1024 / 1024).toFixed(1)} MB.`,
  );
}
