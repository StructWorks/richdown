// VS Code wiring for the Markdown formatter and linter.
//
// Lint results go to the Problems panel through a DiagnosticCollection and,
// through `onDiagnostics`, to any Richdown editor showing the document. The
// formatter runs from "Richdown: Format Document", VS Code's own Format
// Document (as a formatting provider), and on save when
// `richdown.formatOnSave` is on. Both read the nearest .richdownrc.json above
// the document; `vscode` is passed in so the rule modules stay free of it.

const { formatMarkdown } = require("./markdownFormatter");
const { lintMarkdown } = require("./markdownLinter");
const {
  configFileName,
  createDefaultConfigText,
  parseConfigText,
  resolveFormatConfig,
  resolveLintConfig,
} = require("./markdownQualityConfig");
const { applyLineEnding, normalizeToLf } = require("./lineEndings");

const lintedSchemes = new Set(["file", "untitled", "vscode-remote", "vscode-vfs"]);
const lintDelayMs = 300;

function createMarkdownQuality(vscode, { onDiagnostics = () => {}, resolveMarkdownUri } = {}) {
  const diagnostics = vscode.languages.createDiagnosticCollection("richdown");
  const configDiagnostics = vscode.languages.createDiagnosticCollection("richdown-config");
  // Directory uri -> Promise<{ config, uri }> for the .richdownrc.json that
  // applies there (uri is null when none does).
  const configCache = new Map();
  const lintTimers = new Map();
  const lintSequences = new Map();
  // Document uri -> diagnostics in the shape the webview draws.
  const webviewDiagnostics = new Map();
  const disposables = [diagnostics, configDiagnostics];

  function isQualityDocument(document) {
    return document?.languageId === "markdown" && lintedSchemes.has(document.uri.scheme);
  }

  function isLintEnabled() {
    return vscode.workspace.getConfiguration("richdown").get("lint.enabled", true);
  }

  async function loadConfigForDocument(document) {
    if (document.uri.scheme === "untitled") {
      return { config: {}, uri: null };
    }
    const directory = vscode.Uri.joinPath(document.uri, "..");
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    return loadConfigForDirectory(directory, folder?.uri);
  }

  function loadConfigForDirectory(directory, stopAt) {
    const key = directory.toString();
    if (!configCache.has(key)) {
      configCache.set(key, findConfig(directory, stopAt));
    }
    return configCache.get(key);
  }

  async function findConfig(directory, stopAt) {
    const candidate = vscode.Uri.joinPath(directory, configFileName);
    const text = await readTextIfExists(candidate);
    if (text !== undefined) {
      const { config, error } = parseConfigText(text);
      reportConfigError(candidate, text, error);
      return { config, uri: candidate };
    }
    const parent = vscode.Uri.joinPath(directory, "..");
    const reachedStop = stopAt && directory.toString() === stopAt.toString();
    if (reachedStop || parent.path === directory.path) {
      return { config: {}, uri: null };
    }
    return loadConfigForDirectory(parent, stopAt);
  }

  async function readTextIfExists(uri) {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString("utf8");
    } catch (error) {
      return undefined;
    }
  }

  function reportConfigError(uri, text, error) {
    if (!error) {
      configDiagnostics.delete(uri);
      return;
    }
    const before = text.slice(0, error.offset);
    const line = before.split("\n").length - 1;
    const character = before.length - before.lastIndexOf("\n") - 1;
    const position = new vscode.Position(line, character);
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(position, position),
      error.message,
      vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = "Richdown";
    configDiagnostics.set(uri, [diagnostic]);
  }

  function scheduleLint(document, delay = lintDelayMs) {
    if (!isQualityDocument(document)) {
      return;
    }
    const key = document.uri.toString();
    clearTimeout(lintTimers.get(key));
    lintTimers.set(
      key,
      setTimeout(() => {
        lintTimers.delete(key);
        void lintDocument(document);
      }, delay),
    );
  }

  async function lintDocument(document) {
    const key = document.uri.toString();
    const sequence = (lintSequences.get(key) || 0) + 1;
    lintSequences.set(key, sequence);

    const { config } = await loadConfigForDocument(document);
    if (sequence !== lintSequences.get(key) || document.isClosed) {
      return;
    }
    const lintConfig = resolveLintConfig(config);
    const results =
      isLintEnabled() && lintConfig.enabled
        ? lintMarkdown(normalizeToLf(document.getText()), lintConfig.rules)
        : [];
    publish(document.uri, results);
  }

  function publish(uri, results) {
    const key = uri.toString();
    diagnostics.set(uri, results.map(toVsCodeDiagnostic));
    const items = results.map((result) => ({
      line: result.line,
      from: result.from,
      to: result.to,
      severity: result.severity,
      message: result.message,
      rule: result.rule,
    }));
    webviewDiagnostics.set(key, items);
    onDiagnostics(key, items);
  }

  function clear(uri) {
    const key = uri.toString();
    clearTimeout(lintTimers.get(key));
    lintTimers.delete(key);
    lintSequences.set(key, (lintSequences.get(key) || 0) + 1);
    diagnostics.delete(uri);
    webviewDiagnostics.delete(key);
  }

  function toVsCodeDiagnostic(result) {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(result.line, result.from, result.line, result.to),
      result.message,
      {
        error: vscode.DiagnosticSeverity.Error,
        warning: vscode.DiagnosticSeverity.Warning,
        info: vscode.DiagnosticSeverity.Information,
        hint: vscode.DiagnosticSeverity.Hint,
      }[result.severity] ?? vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = "Richdown";
    diagnostic.code = result.rule;
    return diagnostic;
  }

  function relintOpenDocuments() {
    for (const document of vscode.workspace.textDocuments) {
      scheduleLint(document, 0);
    }
  }

  // The edits that format `document`, or [] when it is already formatted or
  // formatting is turned off in .richdownrc.json.
  async function computeFormatEdits(document) {
    const { config } = await loadConfigForDocument(document);
    const formatConfig = resolveFormatConfig(config);
    if (!formatConfig.enabled) {
      return [];
    }
    const original = normalizeToLf(document.getText());
    const formatted = formatMarkdown(original, formatConfig.rules);
    if (formatted === original) {
      return [];
    }
    const change = findChangedSpan(original, formatted);
    const start = positionAtLfOffset(original, change.from);
    const end = positionAtLfOffset(original, change.to);
    const range = new vscode.Range(start.line, start.character, end.line, end.character);
    const eol = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
    return [vscode.TextEdit.replace(range, applyLineEnding(change.text, eol))];
  }

  async function formatDocumentCommand(resource) {
    const uri = resolveMarkdownUri?.(resource);
    if (!uri) {
      void vscode.window.showInformationMessage("Open a Markdown file to format it with Richdown.");
      return;
    }
    const document = await vscode.workspace.openTextDocument(uri);
    const { config } = await loadConfigForDocument(document);
    if (!resolveFormatConfig(config).enabled) {
      void vscode.window.showInformationMessage(
        `Richdown formatting is turned off in ${configFileName}.`,
      );
      return;
    }
    const edits = await computeFormatEdits(document);
    if (edits.length === 0) {
      vscode.window.setStatusBarMessage("Richdown: the document is already formatted.", 3000);
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    edit.set(document.uri, edits);
    await vscode.workspace.applyEdit(edit);
  }

  async function createConfigCommand(resource) {
    const uri = resolveMarkdownUri?.(resource);
    const folder =
      (uri && vscode.workspace.getWorkspaceFolder(uri)) || vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      void vscode.window.showErrorMessage(
        `Open a folder to create a ${configFileName} for Richdown's formatter and linter.`,
      );
      return;
    }
    const target = vscode.Uri.joinPath(folder.uri, configFileName);
    if ((await readTextIfExists(target)) === undefined) {
      await vscode.workspace.fs.writeFile(target, Buffer.from(createDefaultConfigText(), "utf8"));
    }
    await vscode.window.showTextDocument(target);
  }

  function register(context) {
    const watcher = vscode.workspace.createFileSystemWatcher(`**/${configFileName}`);
    const onConfigFileChange = (uri) => {
      configCache.clear();
      configDiagnostics.delete(uri);
      relintOpenDocuments();
    };
    watcher.onDidCreate(onConfigFileChange);
    watcher.onDidChange(onConfigFileChange);
    watcher.onDidDelete(onConfigFileChange);

    disposables.push(
      watcher,
      vscode.workspace.onDidOpenTextDocument((document) => scheduleLint(document, 0)),
      vscode.workspace.onDidChangeTextDocument((event) => scheduleLint(event.document)),
      vscode.workspace.onDidCloseTextDocument((document) => clear(document.uri)),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        configCache.clear();
        relintOpenDocuments();
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("richdown.lint")) {
          relintOpenDocuments();
        }
      }),
      vscode.workspace.onWillSaveTextDocument((event) => {
        if (
          isQualityDocument(event.document) &&
          event.reason !== vscode.TextDocumentSaveReason.AfterDelay &&
          vscode.workspace
            .getConfiguration("richdown", event.document.uri)
            .get("formatOnSave", false)
        ) {
          event.waitUntil(computeFormatEdits(event.document));
        }
      }),
      vscode.languages.registerDocumentFormattingEditProvider(
        [...lintedSchemes].map((scheme) => ({ language: "markdown", scheme })),
        { provideDocumentFormattingEdits: (document) => computeFormatEdits(document) },
      ),
      vscode.commands.registerCommand("richdown.formatDocument", formatDocumentCommand),
      vscode.commands.registerCommand("richdown.createConfig", createConfigCommand),
    );
    context.subscriptions.push(...disposables);
    relintOpenDocuments();
  }

  return {
    register,
    getWebviewDiagnostics: (uriKey) => webviewDiagnostics.get(uriKey) || [],
  };
}

// The smallest span of `original` that differs from `formatted`, so a format
// edit leaves the caret and folding in untouched regions alone.
function findChangedSpan(original, formatted) {
  let start = 0;
  const maxStart = Math.min(original.length, formatted.length);
  while (start < maxStart && original[start] === formatted[start]) {
    start += 1;
  }
  let originalEnd = original.length;
  let formattedEnd = formatted.length;
  while (
    originalEnd > start &&
    formattedEnd > start &&
    original[originalEnd - 1] === formatted[formattedEnd - 1]
  ) {
    originalEnd -= 1;
    formattedEnd -= 1;
  }
  return { from: start, to: originalEnd, text: formatted.slice(start, formattedEnd) };
}

// Line and character for an offset into the LF form of the document. A CRLF
// document has the same lines and characters, since VS Code positions never
// point between "\r" and "\n".
function positionAtLfOffset(text, offset) {
  const before = text.slice(0, offset);
  const line = before.split("\n").length - 1;
  return { line, character: before.length - before.lastIndexOf("\n") - 1 };
}

module.exports = {
  createMarkdownQuality,
  findChangedSpan,
  positionAtLfOffset,
};
