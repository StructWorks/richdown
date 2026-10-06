import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createMarkdownQuality } = require("../src/host/markdownQuality.js");

// A small stand-in for the parts of the VS Code API markdownQuality.js uses:
// an in-memory file system, a workspace folder at /work, and recorders for
// diagnostics, providers, commands, and event handlers.
function createFakeVsCode({ files = {}, settings = {} } = {}) {
  class Uri {
    constructor(scheme, uriPath) {
      this.scheme = scheme;
      this.path = uriPath;
      this.fsPath = uriPath;
    }
    static file(filePath) {
      return new Uri("file", filePath);
    }
    static joinPath(uri, ...segments) {
      return new Uri(uri.scheme, path.posix.join(uri.path, ...segments));
    }
    toString() {
      return `${this.scheme}://${this.path}`;
    }
  }
  class Position {
    constructor(line, character) {
      Object.assign(this, { line, character });
    }
  }
  class Range {
    constructor(startLine, startCharacter, endLine, endCharacter) {
      if (startLine instanceof Position) {
        this.start = startLine;
        this.end = startCharacter;
      } else {
        this.start = new Position(startLine, startCharacter);
        this.end = new Position(endLine, endCharacter);
      }
    }
  }
  class Diagnostic {
    constructor(range, message, severity) {
      Object.assign(this, { range, message, severity });
    }
  }
  class WorkspaceEdit {
    constructor() {
      this.entries = [];
    }
    set(uri, edits) {
      this.entries.push({ uri, edits });
    }
  }
  const createCollection = () => {
    const map = new Map();
    return {
      map,
      set: (uri, items) => map.set(uri.toString(), items),
      delete: (uri) => map.delete(uri.toString()),
      dispose() {},
    };
  };
  const handlers = {};
  const on = (name) => (handler) => {
    handlers[name] = handler;
    return { dispose() {} };
  };
  const collections = [];
  const folder = { uri: Uri.file("/work") };
  const fakeFiles = new Map(Object.entries(files));
  const vscode = {
    Uri,
    Position,
    Range,
    Diagnostic,
    WorkspaceEdit,
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    EndOfLine: { LF: 1, CRLF: 2 },
    TextDocumentSaveReason: { Manual: 1, AfterDelay: 2, FocusOut: 3 },
    TextEdit: { replace: (range, newText) => ({ range, newText }) },
    languages: {
      createDiagnosticCollection: () => {
        const collection = createCollection();
        collections.push(collection);
        return collection;
      },
      registerDocumentFormattingEditProvider: (selector, provider) => {
        vscode.formattingProvider = provider;
        return { dispose() {} };
      },
    },
    commands: {
      registered: {},
      registerCommand: (name, handler) => {
        vscode.commands.registered[name] = handler;
        return { dispose() {} };
      },
    },
    window: {
      showInformationMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      setStatusBarMessage: vi.fn(),
      showTextDocument: vi.fn(),
    },
    workspace: {
      textDocuments: [],
      workspaceFolders: [folder],
      getWorkspaceFolder: (uri) => (uri.path.startsWith("/work/") ? folder : undefined),
      getConfiguration: () => ({ get: (key, fallback) => settings[key] ?? fallback }),
      fs: {
        readFile: async (uri) => {
          if (!fakeFiles.has(uri.path)) throw new Error("ENOENT");
          return Buffer.from(fakeFiles.get(uri.path));
        },
        writeFile: async (uri, bytes) => fakeFiles.set(uri.path, Buffer.from(bytes).toString("utf8")),
      },
      applyEdit: vi.fn(async () => true),
      openTextDocument: async (uri) =>
        vscode.workspace.textDocuments.find((document) => document.uri.path === uri.path),
      createFileSystemWatcher: () => ({
        onDidCreate: on("configCreate"),
        onDidChange: on("configChange"),
        onDidDelete: on("configDelete"),
        dispose() {},
      }),
      onDidOpenTextDocument: on("open"),
      onDidChangeTextDocument: on("change"),
      onDidCloseTextDocument: on("close"),
      onDidChangeWorkspaceFolders: on("folders"),
      onDidChangeConfiguration: on("configuration"),
      onWillSaveTextDocument: on("willSave"),
    },
    handlers,
    files: fakeFiles,
    diagnostics: () => collections[0].map,
    configDiagnostics: () => collections[1].map,
  };
  return vscode;
}

function createDocument(vscode, filePath, text, { eol = "\n" } = {}) {
  return {
    uri: vscode.Uri.file(filePath),
    languageId: "markdown",
    isClosed: false,
    eol: eol === "\r\n" ? vscode.EndOfLine.CRLF : vscode.EndOfLine.LF,
    getText: () => text.replace(/\n/g, eol),
  };
}

function setup(options) {
  const vscode = createFakeVsCode(options);
  const published = [];
  const quality = createMarkdownQuality(vscode, {
    onDiagnostics: (uriKey, items) => published.push({ uriKey, items }),
    resolveMarkdownUri: (resource) => resource,
  });
  quality.register({ subscriptions: [] });
  return { vscode, quality, published };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("linting", () => {
  it("publishes problems to the Problems panel and the Richdown editor", async () => {
    const { vscode, quality, published } = setup();
    const document = createDocument(vscode, "/work/doc.md", "text   \n");
    vscode.handlers.open(document);
    await vi.runAllTimersAsync();

    const [diagnostic] = vscode.diagnostics().get("file:///work/doc.md");
    expect(diagnostic).toMatchObject({
      message: "Trailing whitespace.",
      severity: vscode.DiagnosticSeverity.Warning,
      code: "no-trailing-spaces",
      source: "Richdown",
    });
    expect(diagnostic.range.start).toEqual({ line: 0, character: 4 });
    expect(published.at(-1).items).toEqual([
      expect.objectContaining({ line: 0, from: 4, to: 7, rule: "no-trailing-spaces" }),
    ]);
    expect(quality.getWebviewDiagnostics("file:///work/doc.md")).toHaveLength(1);
  });

  it("uses the nearest .richdownrc.json above the document", async () => {
    const { vscode } = setup({
      files: {
        "/work/.richdownrc.json": '{ "lint": { "rules": { "no-trailing-spaces": "error" } } }',
        "/work/docs/.richdownrc.json": '{ "lint": { "rules": { "no-trailing-spaces": false } } }',
      },
    });
    vscode.handlers.open(createDocument(vscode, "/work/docs/a.md", "text   \n"));
    vscode.handlers.open(createDocument(vscode, "/work/other/b.md", "text   \n"));
    await vi.runAllTimersAsync();

    expect(vscode.diagnostics().get("file:///work/docs/a.md")).toEqual([]);
    expect(vscode.diagnostics().get("file:///work/other/b.md")[0].severity).toBe(
      vscode.DiagnosticSeverity.Error,
    );
  });

  it("does not look above the workspace folder", async () => {
    const { vscode } = setup({
      files: { "/.richdownrc.json": '{ "lint": false }' },
    });
    vscode.handlers.open(createDocument(vscode, "/work/a.md", "text   \n"));
    await vi.runAllTimersAsync();
    expect(vscode.diagnostics().get("file:///work/a.md")).toHaveLength(1);
  });

  it("reports nothing when linting is turned off", async () => {
    const { vscode } = setup({ settings: { "lint.enabled": false } });
    vscode.handlers.open(createDocument(vscode, "/work/a.md", "text   \n"));
    await vi.runAllTimersAsync();
    expect(vscode.diagnostics().get("file:///work/a.md")).toEqual([]);
  });

  it("reports an invalid configuration file on that file", async () => {
    const { vscode } = setup({ files: { "/work/.richdownrc.json": "{ nope" } });
    vscode.handlers.open(createDocument(vscode, "/work/a.md", "# A\n"));
    await vi.runAllTimersAsync();
    expect(vscode.configDiagnostics().get("file:///work/.richdownrc.json")[0].message).toContain(
      "not valid JSON",
    );
  });

  it("re-reads the configuration when it changes", async () => {
    const { vscode } = setup();
    const document = createDocument(vscode, "/work/a.md", "text   \n");
    vscode.workspace.textDocuments.push(document);
    vscode.handlers.open(document);
    await vi.runAllTimersAsync();
    expect(vscode.diagnostics().get("file:///work/a.md")).toHaveLength(1);

    vscode.files.set("/work/.richdownrc.json", '{ "lint": { "enabled": false } }');
    vscode.handlers.configCreate(vscode.Uri.file("/work/.richdownrc.json"));
    await vi.runAllTimersAsync();
    expect(vscode.diagnostics().get("file:///work/a.md")).toEqual([]);
  });

  it("ignores documents that are not Markdown files", async () => {
    const { vscode } = setup();
    const document = { ...createDocument(vscode, "/work/a.md", "text   \n"), languageId: "plaintext" };
    vscode.handlers.open(document);
    await vi.runAllTimersAsync();
    expect(vscode.diagnostics().size).toBe(0);
  });

  it("clears problems when the document closes", async () => {
    const { vscode, quality } = setup();
    const document = createDocument(vscode, "/work/a.md", "text   \n");
    vscode.handlers.open(document);
    await vi.runAllTimersAsync();
    vscode.handlers.close(document);
    expect(vscode.diagnostics().has("file:///work/a.md")).toBe(false);
    expect(quality.getWebviewDiagnostics("file:///work/a.md")).toEqual([]);
  });
});

describe("formatting", () => {
  it("returns one minimal edit in the document's own line endings", async () => {
    const { vscode } = setup();
    const document = createDocument(vscode, "/work/a.md", "# A\ntext\n* item\n", { eol: "\r\n" });
    const edits = await vscode.formattingProvider.provideDocumentFormattingEdits(document);
    expect(edits).toEqual([
      {
        range: { start: { line: 1, character: 0 }, end: { line: 2, character: 1 } },
        newText: "\r\ntext\r\n\r\n-",
      },
    ]);
  });

  it("returns no edits when formatting is turned off for the project", async () => {
    const { vscode } = setup({ files: { "/work/.richdownrc.json": '{ "format": false }' } });
    const document = createDocument(vscode, "/work/a.md", "* item");
    expect(await vscode.formattingProvider.provideDocumentFormattingEdits(document)).toEqual([]);
  });

  it("formats on save only when the setting is on and the save is not an auto save", () => {
    const save = (settings, reason) => {
      const { vscode } = setup({ settings });
      const event = {
        document: createDocument(vscode, "/work/a.md", "* item"),
        reason,
        waitUntil: vi.fn(),
      };
      vscode.handlers.willSave(event);
      return event.waitUntil.mock.calls.length;
    };
    expect(save({ formatOnSave: true }, 1)).toBe(1);
    expect(save({ formatOnSave: true }, 2)).toBe(0);
    expect(save({}, 1)).toBe(0);
  });

  it("applies the edits from the Format Document command", async () => {
    const { vscode } = setup();
    const document = createDocument(vscode, "/work/a.md", "* item");
    vscode.workspace.textDocuments.push(document);
    await vscode.commands.registered["richdown.formatDocument"](document.uri);
    const [[edit]] = vscode.workspace.applyEdit.mock.calls;
    expect(edit.entries[0].edits[0].newText).toBe("- item\n");
  });
});

describe("Create Formatter and Lint Configuration", () => {
  it("writes the default configuration once and opens it", async () => {
    const { vscode } = setup();
    await vscode.commands.registered["richdown.createConfig"](vscode.Uri.file("/work/a.md"));
    const written = vscode.files.get("/work/.richdownrc.json");
    expect(written).toContain('"lint"');
    expect(vscode.window.showTextDocument).toHaveBeenCalled();

    vscode.files.set("/work/.richdownrc.json", "{}");
    await vscode.commands.registered["richdown.createConfig"](vscode.Uri.file("/work/a.md"));
    expect(vscode.files.get("/work/.richdownrc.json")).toBe("{}");
  });
});
