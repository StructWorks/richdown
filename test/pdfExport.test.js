import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { writePdfExport } = require("../src/export/markdownExport.js");

// PDF export drives a headless Chromium over the DevTools protocol. A real
// browser belongs in an integration test, so these cover the launch and failure
// handling with a stand-in executable.
let workspace;
let htmlPath;
let outputPath;

function writeFakeBrowser(name, script) {
  const target = path.join(workspace, name);
  fs.writeFileSync(target, `#!/bin/sh\n${script}\n`);
  fs.chmodSync(target, 0o755);
  return target;
}

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), "richdown-pdf-test-"));
  htmlPath = path.join(workspace, "export.html");
  outputPath = path.join(workspace, "export.pdf");
  fs.writeFileSync(htmlPath, "<!doctype html><title>t</title>");
});

afterEach(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
});

describe("writePdfExport", () => {
  it("reports the exit code when the browser dies at startup", async () => {
    const browser = writeFakeBrowser("dying-browser", "exit 3");

    await expect(
      writePdfExport({ htmlPath, outputPath, browserPath: browser, timeoutMs: 2000 }),
    ).rejects.toThrow(/exited before PDF export could start\. Exit code: 3/);
  });

  it("includes the browser's own output in the failure", async () => {
    const browser = writeFakeBrowser(
      "noisy-browser",
      'echo "profile is locked" 1>&2\nexit 1',
    );

    await expect(
      writePdfExport({ htmlPath, outputPath, browserPath: browser, timeoutMs: 2000 }),
    ).rejects.toThrow(/Chrome output:[\s\S]*profile is locked/);
  });

  it("times out when the browser never opens a debugging port", async () => {
    const browser = writeFakeBrowser("silent-browser", "sleep 5");

    await expect(
      writePdfExport({ htmlPath, outputPath, browserPath: browser, timeoutMs: 300 }),
    ).rejects.toThrow(/Timed out waiting for Chrome PDF export to start/);
  });

  it("fails when the debugging port cannot be reached", async () => {
    // The stand-in writes a DevToolsActivePort file for a port nothing listens
    // on, so the DevTools request itself must fail rather than hang.
    const browser = writeFakeBrowser(
      "portless-browser",
      [
        'for arg in "$@"; do',
        '  case "$arg" in',
        '    --user-data-dir=*) dir="${arg#--user-data-dir=}" ;;',
        "  esac",
        "done",
        'printf "1\\n/devtools/browser/fake\\n" > "$dir/DevToolsActivePort"',
        "sleep 5",
      ].join("\n"),
    );

    await expect(
      writePdfExport({ htmlPath, outputPath, browserPath: browser, timeoutMs: 1500 }),
    ).rejects.toThrow();
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("removes its temporary profile directory afterwards", async () => {
    const before = fs
      .readdirSync(os.tmpdir())
      .filter((entry) => entry.startsWith("richdown-export-browser-"));
    const browser = writeFakeBrowser("dying-browser-2", "exit 1");

    await expect(
      writePdfExport({ htmlPath, outputPath, browserPath: browser, timeoutMs: 1000 }),
    ).rejects.toThrow();

    const after = fs
      .readdirSync(os.tmpdir())
      .filter((entry) => entry.startsWith("richdown-export-browser-"));
    expect(after.length).toBeLessThanOrEqual(before.length);
  });
});
