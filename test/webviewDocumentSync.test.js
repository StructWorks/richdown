import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createWebviewDocumentSync } = require("../src/host/webviewDocumentSync.js");

// A TextDocument stand-in that behaves like VS Code: applyEdit fires the
// content change event before its promise resolves, and the document's dirty
// state flips later through a second event without content changes.
function createHarness({ text = "", eol = "\n", rejectEdits = false } = {}) {
  const messages = [];
  const doc = { text };
  const fireChange = (contentChanges) => sync.handleDocumentChange(contentChanges);
  const sync = createWebviewDocumentSync({
    getText: () => doc.text,
    getLineEnding: () => eol,
    replaceText: async (nextText) => {
      await Promise.resolve();
      if (rejectEdits) {
        return false;
      }
      doc.text = nextText;
      fireChange([{ text: nextText }]);
      return true;
    },
    postMessage: (message) => messages.push(message),
  });
  return {
    doc,
    messages,
    sync,
    updates: () => messages.filter((message) => message.type === "update"),
    externalChange(nextText) {
      doc.text = nextText;
      return fireChange([{ text: nextText }]);
    },
    dirtyStateChange: () => fireChange([]),
  };
}

describe("webview document sync", () => {
  it("applies a webview edit without echoing it back", async () => {
    const harness = createHarness();

    await harness.sync.receiveEdit("# Title", 1);

    expect(harness.doc.text).toBe("# Title");
    expect(harness.updates()).toEqual([]);
    expect(harness.sync.appliedVersion).toBe(1);
  });

  it("does not echo a dirty-state change", async () => {
    // The first keystroke in a new file turns it dirty. Echoing that event
    // used to send the webview text older than what had been typed since.
    const harness = createHarness();
    await harness.sync.receiveEdit("#", 1);

    expect(harness.dirtyStateChange()).toBe("none");
    expect(harness.updates()).toEqual([]);
  });

  it("sends an external change with the version the document reflects", async () => {
    const harness = createHarness();
    await harness.sync.receiveEdit("draft", 3);

    expect(harness.externalChange("# draft\n")).toBe("external");
    expect(harness.updates()).toEqual([
      { type: "update", text: "# draft\n", version: 3 },
    ]);
  });

  it("only applies the newest of several queued edits", async () => {
    const harness = createHarness();
    const first = harness.sync.receiveEdit("a", 1);
    void harness.sync.receiveEdit("ab", 2);
    void harness.sync.receiveEdit("abc", 3);
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(harness.doc.text).toBe("abc");
    expect(harness.sync.appliedVersion).toBe(3);
    expect(harness.updates()).toEqual([]);
  });

  it("tags an external change during an in-flight edit with the older version", async () => {
    // The webview drops this update because its newer edit is still on the
    // way; that edit then replaces the document.
    const harness = createHarness({ text: "a" });
    await harness.sync.receiveEdit("ab", 1);
    const pending = harness.sync.receiveEdit("abc", 2);
    harness.externalChange("ab!");
    await pending;

    expect(harness.updates()).toEqual([{ type: "update", text: "ab!", version: 1 }]);
    expect(harness.doc.text).toBe("abc");
    expect(harness.sync.appliedVersion).toBe(2);
  });

  it("marks an edit whose text the document already has", async () => {
    const harness = createHarness({ text: "same" });

    await harness.sync.receiveEdit("same", 4);

    expect(harness.sync.appliedVersion).toBe(4);
  });

  it("marks a rejected edit so later updates still reach the webview", async () => {
    const harness = createHarness({ text: "kept", rejectEdits: true });
    await harness.sync.receiveEdit("lost", 2);

    expect(harness.doc.text).toBe("kept");
    expect(harness.sync.appliedVersion).toBe(2);
    harness.externalChange("kept!");
    expect(harness.updates().at(-1)).toEqual({ type: "update", text: "kept!", version: 2 });
  });

  it("converts webview text to the document's line endings", async () => {
    const harness = createHarness({ text: "a\r\n", eol: "\r\n" });

    await harness.sync.receiveEdit("a\nb\n", 1);

    expect(harness.doc.text).toBe("a\r\nb\r\n");
    expect(harness.updates()).toEqual([]);
  });

  it("sends updates in LF", () => {
    const harness = createHarness({ text: "a\r\nb", eol: "\r\n" });

    harness.sync.postUpdate();

    expect(harness.updates()).toEqual([{ type: "update", text: "a\nb", version: 0 }]);
  });

  it("tags lint results with the applied version", async () => {
    const harness = createHarness();
    await harness.sync.receiveEdit("x", 5);

    harness.sync.postLintDiagnostics([{ line: 0 }]);

    expect(harness.messages.at(-1)).toEqual({
      type: "lintDiagnostics",
      diagnostics: [{ line: 0 }],
      version: 5,
    });
  });

  it("starts counting again after the webview reloads", async () => {
    const harness = createHarness();
    await harness.sync.receiveEdit("x", 9);

    harness.sync.reset();

    expect(harness.sync.appliedVersion).toBe(0);
    await harness.sync.receiveEdit("xy", 1);
    expect(harness.sync.appliedVersion).toBe(1);
  });

  it("ignores an edit without text", async () => {
    const harness = createHarness({ text: "keep" });

    await harness.sync.receiveEdit(undefined, 1);

    expect(harness.doc.text).toBe("keep");
    expect(harness.sync.appliedVersion).toBe(0);
  });
});
