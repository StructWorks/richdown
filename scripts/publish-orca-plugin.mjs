// Publishes the Orca plugin to StructWorks/richdown-orca from this machine,
// with your own Git credentials. It does what the Publish Orca Plugin workflow
// does on a v* tag, for when the workflow has no credential to push with.
//
// Usage: npm run publish:orca [-- --dry-run]
//
// Builds the plugin from HEAD (the working tree must be clean, so the plugin
// names the commit it was built from), commits it to a fresh clone of the
// plugin repository as "Richdown <version>", tags it v<version> and pushes
// both. Does nothing when the plugin repository already has that tag.
// --dry-run stops before pushing and prints where the clone is.
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { buildOrcaPlugin } from "./build-orca-plugin.mjs";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const pluginRepository =
  process.env.ORCA_PLUGIN_REPOSITORY ?? "git@github.com:StructWorks/richdown-orca.git";
const dryRun = process.argv.includes("--dry-run");

function git(args, { cwd = workspaceRoot, quiet = false } = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: quiet ? ["ignore", "pipe", "ignore"] : ["ignore", "pipe", "inherit"],
  }).trim();
}

function succeeds(args, cwd) {
  try {
    git(args, { cwd, quiet: true });
    return true;
  } catch (error) {
    return false;
  }
}

if (git(["status", "--porcelain"]) !== "") {
  console.error("Commit or stash your changes first: the plugin names the commit it is built from.");
  process.exit(1);
}
const sourceCommit = git(["rev-parse", "HEAD"]);

const clone = await mkdtemp(path.join(os.tmpdir(), "richdown-orca-publish-"));
git(["clone", "--quiet", pluginRepository, clone]);

const { version, files, bytes } = await buildOrcaPlugin({ outDir: clone, sourceCommit });
const tag = `v${version}`;
if (succeeds(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], clone)) {
  console.log(`${tag} is already published to ${pluginRepository}.`);
  process.exit(0);
}

if (!succeeds(["rev-parse", "--verify", "HEAD"], clone)) {
  // The plugin repository has no commits yet.
  git(["switch", "--quiet", "-c", "main"], { cwd: clone });
}
git(["add", "-A"], { cwd: clone });
if (!succeeds(["diff", "--cached", "--quiet"], clone)) {
  git(
    [
      "commit",
      "--quiet",
      "-m",
      `Richdown ${version}`,
      "-m",
      `Built from StructWorks/richdown@${sourceCommit}.`,
    ],
    { cwd: clone },
  );
}
git(["tag", "-a", tag, "-m", tag], { cwd: clone });

if (dryRun) {
  console.log(
    `Built ${tag} (${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB) and committed it in ${clone}; not pushed.`,
  );
  process.exit(0);
}
git(["push", "--quiet", "origin", "HEAD:main", `refs/tags/${tag}`], { cwd: clone });
console.log(`Published ${tag} to ${pluginRepository} (${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB).`);
