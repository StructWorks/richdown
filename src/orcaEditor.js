// Orca custom editor entrypoint (bundled to media/orcaEditor.js, loaded by
// orca/editor.html).
//
// Waits for Orca's document session, installs the Orca editor host, and only
// then loads the same rich editor VS Code runs. Lint and format are the
// extension's own rule modules with their default configuration, since an
// editor frame cannot read .richdownrc.json from the file system.
import { formatMarkdown } from "./host/markdownFormatter.js";
import { lintMarkdown } from "./host/markdownLinter.js";
import {
  resolveFormatConfig,
  resolveLintConfig,
} from "./host/markdownQualityConfig.js";
import { parseLinkFragment } from "./host/revealTarget.js";
import { installEditorHost } from "./rich-editor/adapters/editorHost.js";
import { createOrcaEditorHost } from "./rich-editor/adapters/orcaEditorHost.js";

const lintRules = resolveLintConfig({}).rules;
const formatRules = resolveFormatConfig({}).rules;

async function start() {
  const host = await createOrcaEditorHost({
    orca: window.orca,
    lint: (text) =>
      lintMarkdown(text, lintRules).map((result) => ({
        line: result.line,
        from: result.from,
        to: result.to,
        severity: result.severity,
        message: result.message,
        rule: result.rule,
      })),
    format: (text) => formatMarkdown(text, formatRules),
    parseLinkFragment,
    mermaidScriptUri: new URL("../media/mermaid.js", document.baseURI).href,
  });
  installEditorHost(host);
  await import("./richEditor.js");
}

start().catch((error) => {
  console.error("[Richdown] The editor could not start", error);
  const root = document.querySelector("#editor");
  if (root) {
    const message = document.createElement("p");
    message.className = "richdown-startup-error";
    message.textContent = `Richdown could not open this file: ${
      error instanceof Error ? error.message : String(error)
    }`;
    root.replaceChildren(message);
  }
});
