// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { createOrcaEditorHost } from "../src/rich-editor/adapters/orcaEditorHost.js";
import { mergeText } from "../src/rich-editor/domain/textMerge.js";
import { fingerprintText } from "../src/rich-editor/domain/textFingerprint.js";
import { parseLinkFragment } from "../src/host/revealTarget.js";

// A stand-in for the `orca` global Orca defines in a custom editor frame:
// the document session, the plugin's settings, the shell and theme events.
function createFakeOrca({ text = "# Title\n", settings = {}, readOnly = false } = {}) {
  const replaceHandlers = [];
  const settingsHandlers = [];
  const themeHandlers = [];
  const stored = { ...settings };
  const session = {
    value: text,
    readOnly,
    change: vi.fn((next) => {
      session.value = next;
    }),
    onReplace(handler) {
      replaceHandlers.push(handler);
      return { dispose() {} };
    },
  };
  const orca = {
    document: {
      session: vi.fn(async () => session),
    },
    settings: {
      get: vi.fn(async () => ({ ...stored })),
      set: vi.fn(async (key, value) => {
        stored[key] = value;
      }),
      onDidChange(handler) {
        settingsHandlers.push(handler);
        return { dispose() {} };
      },
    },
    shell: {
      openExternal: vi.fn(async () => ({ opened: true })),
    },
    on(event, handler) {
      if (event === "theme") {
        themeHandlers.push(handler);
      }
      return { dispose() {} };
    },
  };
  return {
    orca,
    session,
    replace(value) {
      session.value = value;
      replaceHandlers.forEach((handler) => handler(value));
    },
    changeSetting(key, value) {
      stored[key] = value;
      settingsHandlers.forEach((handler) => handler({ key }));
    },
    switchTheme(scheme) {
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(scheme);
      themeHandlers.forEach((handler) => handler({ colorScheme: scheme }));
    },
  };
}

async function createHost(fake, overrides = {}) {
  const host = await createOrcaEditorHost({
    orca: fake.orca,
    lint: (text) =>
      text.includes("#bad")
        ? [{ line: 0, from: 0, to: 4, severity: "warning", message: "bad", rule: "x" }]
        : [],
    format: (text) => text.replace(/\n{3,}/g, "\n\n"),
    parseLinkFragment,
    mermaidScriptUri: "media/mermaid.js",
    copyText: vi.fn(async () => {}),
    ...overrides,
  });
  const received = [];
  host.onMessage((message) => received.push(message));
  return { host, received };
}

const flushMessages = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add("dark");
  document.body.className = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Orca editor host", () => {
  it("refuses to start outside an Orca editor frame", async () => {
    await expect(
      createOrcaEditorHost({ orca: {}, lint: () => [], format: (text) => text }),
    ).rejects.toThrow(/Orca custom editor/);
  });

  it("opens the session with the line merge and serves its document", async () => {
    const fake = createFakeOrca({ text: "# Title\r\n\r\nbody\r\n" });
    const { host } = await createHost(fake);

    expect(fake.orca.document.session).toHaveBeenCalledWith(
      expect.objectContaining({ merge: mergeText }),
    );
    expect(host.exportMode).toBe(false);
    expect(host.readOnly).toBe(false);
    expect(host.initial.document).toBe("# Title\n\nbody\n");
    expect(host.initial.mermaidScriptUri).toBe("media/mermaid.js");
    expect(host.initial.gitDiffChanges).toEqual([]);
  });

  it("passes a read-only document on to the editor", async () => {
    const { host } = await createHost(createFakeOrca({ readOnly: true }));
    expect(host.readOnly).toBe(true);
  });

  it("reads the editor settings from the plugin's Orca settings", async () => {
    const { host } = await createHost(
      createFakeOrca({ settings: { richTheme: "forest", mermaidPreview: false } }),
    );

    expect(host.initial.settings).toMatchObject({
      richTheme: "forest",
      mermaidPreview: false,
      richTablePreview: true,
    });
  });

  it("starts on default settings when they cannot be read", async () => {
    const fake = createFakeOrca();
    fake.orca.settings.get.mockRejectedValue(new Error("consent_required"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { host } = await createHost(fake);
    expect(host.initial.settings.richTheme).toBe("default");
  });

  it("sends edits to the session in the file's own line endings", async () => {
    const fake = createFakeOrca({ text: "a\r\nb\r\n" });
    const { host } = await createHost(fake);

    host.postMessage({ type: "edit", text: "a\nb\nc\n", version: 1 });

    expect(fake.session.change).toHaveBeenCalledWith("a\r\nb\r\nc\r\n");
  });

  it("keeps LF files in LF", async () => {
    const fake = createFakeOrca({ text: "a\nb\n" });
    const { host } = await createHost(fake);

    host.postMessage({ type: "edit", text: "a\nb\nc\n", version: 1 });

    expect(fake.session.change).toHaveBeenCalledWith("a\nb\nc\n");
  });

  it("forwards outside changes to the editor as LF updates", async () => {
    const fake = createFakeOrca({ text: "a\r\n" });
    const { received } = await createHost(fake);

    fake.replace("changed\r\noutside\r\n");
    await flushMessages();

    expect(received).toContainEqual({ type: "update", text: "changed\noutside\n" });
  });

  it("holds outside changes that arrive before the editor listens", async () => {
    const fake = createFakeOrca({ text: "a\n" });
    const host = await createOrcaEditorHost({
      orca: fake.orca,
      lint: () => [],
      format: (text) => text,
      parseLinkFragment,
      mermaidScriptUri: "",
    });

    fake.replace("early\n");
    await flushMessages();
    const received = [];
    host.onMessage((message) => received.push(message));
    await flushMessages();

    expect(received.filter((message) => message.type === "update")).toEqual([
      { type: "update", text: "early\n" },
    ]);
  });

  it("saves settings the editor's menu changes and ignores invalid values", async () => {
    const fake = createFakeOrca();
    const { host } = await createHost(fake);

    host.postMessage({ type: "setTheme", theme: "forest" });
    host.postMessage({ type: "setMermaidPreview", value: false });
    host.postMessage({ type: "setPreviewWidth", value: "wide" });
    host.postMessage({ type: "setTheme", theme: "neon" });
    host.postMessage({ type: "setRichTablePreview", value: "yes" });

    expect(fake.orca.settings.set.mock.calls).toEqual([
      ["richTheme", "forest"],
      ["mermaidPreview", false],
      ["previewWidth", "wide"],
    ]);
  });

  it("sends the editor new settings when they change in Orca", async () => {
    const fake = createFakeOrca();
    const { received } = await createHost(fake);

    fake.changeSetting("richTheme", "paper");
    await flushMessages();
    await flushMessages();

    expect(received).toContainEqual({
      type: "settings",
      settings: expect.objectContaining({ richTheme: "paper" }),
    });
  });

  it("lints the document when the editor is ready and after edits", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fake = createFakeOrca({ text: "#bad heading\n" });
    const { host, received } = await createHost(fake);

    host.postMessage({ type: "ready" });
    vi.advanceTimersByTime(0);
    await Promise.resolve();
    expect(received).toContainEqual({
      type: "lintDiagnostics",
      diagnostics: [
        { line: 0, from: 0, to: 4, severity: "warning", message: "bad", rule: "x" },
      ],
    });

    received.length = 0;
    host.postMessage({ type: "edit", text: "# good heading\n", version: 1 });
    vi.advanceTimersByTime(299);
    await Promise.resolve();
    expect(received).toEqual([]);
    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(received).toEqual([{ type: "lintDiagnostics", diagnostics: [] }]);
  });

  it("clears lint marks when linting is turned off", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fake = createFakeOrca({ text: "#bad\n", settings: { lintEnabled: false } });
    const { host, received } = await createHost(fake);

    host.postMessage({ type: "ready" });
    vi.advanceTimersByTime(0);
    await Promise.resolve();

    expect(received).toEqual([{ type: "lintDiagnostics", diagnostics: [] }]);
  });

  it("formats the document and sends the result to both sides", async () => {
    const fake = createFakeOrca({ text: "a\n\n\n\nb\n" });
    const { host, received } = await createHost(fake);

    host.postMessage({ type: "formatDocument" });
    await flushMessages();

    expect(received).toContainEqual({ type: "update", text: "a\n\nb\n" });
    expect(fake.session.change).toHaveBeenCalledWith("a\n\nb\n");
  });

  it("leaves the document alone when formatting is off or read-only", async () => {
    const off = createFakeOrca({ text: "a\n\n\n\nb\n", settings: { formatEnabled: false } });
    const offHost = await createHost(off);
    offHost.host.postMessage({ type: "formatDocument" });

    const readOnly = createFakeOrca({ text: "a\n\n\n\nb\n", readOnly: true });
    const readOnlyHost = await createHost(readOnly);
    readOnlyHost.host.postMessage({ type: "formatDocument" });

    expect(off.session.change).not.toHaveBeenCalled();
    expect(readOnly.session.change).not.toHaveBeenCalled();
  });

  it("opens web links through Orca's shell", async () => {
    const fake = createFakeOrca();
    const { host } = await createHost(fake);

    host.postMessage({ type: "openLink", href: "https://example.com/a" });
    host.postMessage({ type: "openLink", href: "mailto:someone@example.com" });

    expect(fake.orca.shell.openExternal.mock.calls).toEqual([
      ["https://example.com/a"],
      ["mailto:someone@example.com"],
    ]);
  });

  it("scrolls to a link's target inside the document", async () => {
    const fake = createFakeOrca();
    const { host, received } = await createHost(fake);

    host.postMessage({ type: "openLink", href: "#getting-started" });
    host.postMessage({ type: "openLink", href: "#L3" });
    host.postMessage({ type: "openLink", href: "other.md" });
    await flushMessages();

    expect(received).toEqual([
      { type: "reveal", target: { anchor: "getting-started" } },
      {
        type: "reveal",
        target: {
          selection: {
            start: { line: 2, character: 0 },
            end: { line: 2, character: 0 },
          },
        },
      },
    ]);
    expect(fake.orca.shell.openExternal).not.toHaveBeenCalled();
  });

  it("answers file-system requests empty, after the request returns", async () => {
    const { host, received } = await createHost(createFakeOrca());

    host.postMessage({ type: "resolveWikilinks", requestId: "2", targets: ["Note"] });
    host.postMessage({ type: "requestWikilinkCompletions", requestId: "3", target: "N" });
    host.postMessage({ type: "requestHostCompletions", requestId: "4" });
    host.postMessage({ type: "requestLinkCompletions", requestId: "5" });
    expect(received).toEqual([]);
    await flushMessages();

    expect(received).toEqual([
      { type: "wikilinksResolved", requestId: "2", results: {} },
      { type: "wikilinkCompletions", requestId: "3", items: [] },
      { type: "hostCompletions", requestId: "4", items: [] },
      { type: "linkCompletions", requestId: "5", paths: [] },
    ]);
  });

  it("loads images through the worker, finding the open file once", async () => {
    const fake = createFakeOrca({ text: "# Notes\r\n" });
    fake.orca.plugin = {
      request: vi.fn(async (name, input) => {
        if (name === "richdown.locateDocument") {
          return { documentPaths: ["/ws/notes.md"], workspaceRoot: "/ws" };
        }
        return input.src === "a.png"
          ? { found: true, mime: "image/png", size: 1, etag: "e", offset: 0, data: "AA==", done: true }
          : { found: false };
      }),
    };
    // jsdom has no object URLs.
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => "blob:orca/1";
    onTestFinished(() => {
      URL.createObjectURL = createObjectURL;
    });
    const { host } = await createHost(fake);

    await expect(host.resolveImageSource("a.png")).resolves.toBe("blob:orca/1");
    await expect(host.resolveImageSource("b.png")).rejects.toThrow();

    const calls = fake.orca.plugin.request.mock.calls;
    expect(calls.filter(([name]) => name === "richdown.locateDocument")).toEqual([
      [
        "richdown.locateDocument",
        { fingerprint: fingerprintText("# Notes\n"), byteLength: 9 },
        { timeoutMs: 30_000 },
      ],
    ]);
    expect(calls[1][1]).toMatchObject({
      src: "a.png",
      documentPaths: ["/ws/notes.md"],
      workspaceRoot: "/ws",
    });
  });

  it("does not ask for remote images when they are turned off", async () => {
    const fake = createFakeOrca({ settings: { remoteImages: false } });
    fake.orca.plugin = { request: vi.fn() };
    const { host } = await createHost(fake);

    await expect(host.resolveImageSource("https://example.com/a.png")).rejects.toThrow(/turned off/);
    expect(fake.orca.plugin.request).not.toHaveBeenCalled();
  });

  it("shows no image when the worker is not available", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { host } = await createHost(createFakeOrca());
    await expect(host.resolveImageSource("a.png")).rejects.toThrow();
  });

  it("copies text for the editor", async () => {
    const copyText = vi.fn(async () => {});
    const { host } = await createHost(createFakeOrca(), { copyText });

    host.postMessage({ type: "copyText", text: "flowchart LR" });

    expect(copyText).toHaveBeenCalledWith("flowchart LR");
  });

  it("marks the body for dark and light rules and follows theme changes", async () => {
    const fake = createFakeOrca();
    await createHost(fake);
    expect(document.body.classList.contains("vscode-dark")).toBe(true);

    fake.switchTheme("light");

    expect(document.body.classList.contains("vscode-light")).toBe(true);
    expect(document.body.classList.contains("vscode-dark")).toBe(false);
  });
});

describe("rich editor on the Orca host", () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.replaceChildren();
    document.body.innerHTML = '<div id="editor"></div>';
  });

  async function boot(fake) {
    const { installEditorHost } = await import("../src/rich-editor/adapters/editorHost.js");
    const { host } = await createHost(fake);
    installEditorHost(host);
    await import("../src/richEditor.js");
    await flushMessages();
    const { EditorView } = await import("@codemirror/view");
    return EditorView.findFromDOM(document.querySelector(".cm-editor"));
  }

  it("edits the Orca document and takes outside changes", async () => {
    const fake = createFakeOrca({ text: "# Title\r\n\r\nbody\r\n" });
    const view = await boot(fake);
    expect(view.state.doc.toString()).toBe("# Title\n\nbody\n");

    view.dispatch({ changes: { from: view.state.doc.length, insert: "more\n" } });
    expect(fake.session.change).toHaveBeenLastCalledWith("# Title\r\n\r\nbody\r\nmore\r\n");

    fake.replace("# Changed\r\n\r\nbody\r\nmore\r\n");
    await flushMessages();
    expect(view.state.doc.toString()).toBe("# Changed\n\nbody\nmore\n");
    // The outside change came from Orca; echoing it back would be a no-op edit.
    expect(fake.session.change).toHaveBeenCalledTimes(1);
  });

  it("opens a read-only Orca document read-only", async () => {
    const view = await boot(createFakeOrca({ readOnly: true }));
    expect(view.state.readOnly).toBe(true);
  });
});
