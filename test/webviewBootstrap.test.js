// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The two webview entry points run their whole setup at import time, the way the
// bundled media/*.js files do inside VS Code. These tests build the host page the
// extension would serve, then import the module and drive it through messages.

let postMessage;

function serialize(value) {
  return JSON.stringify(value);
}

function jsonScript(id, value) {
  return `<script type="application/json" id="${id}">${serialize(value)}</script>`;
}

function installHost() {
  postMessage = vi.fn();
  vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
}

function sendMessage(data) {
  window.dispatchEvent(new MessageEvent("message", { data }));
}

beforeEach(() => {
  vi.resetModules();
  installHost();
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute("style");
  delete document.documentElement.dataset.richTheme;
  delete document.documentElement.dataset.richdownExport;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("rich diff webview", () => {
  const DIFF = {
    leftText: "# Title\n\nold line\nshared\n",
    rightText: "# Title\n\nnew line\nshared\nextra\n",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    fileName: "notes.md",
    filePath: "docs/notes.md",
  };

  async function boot(diff = DIFF, settings = { richTheme: "midnight" }) {
    document.body.innerHTML = `
      <div id="diff"></div>
      ${jsonScript("initial-diff", diff)}
      ${jsonScript("initial-settings", settings)}
    `;
    await import("../src/richDiff.js");
    return document.querySelector("#diff");
  }

  it("renders the file header, labels and change summary", async () => {
    const root = await boot();

    expect(root.querySelector(".rdiff-file").textContent).toBe("notes.md");
    expect(root.querySelector(".rdiff-path").textContent).toBe("docs/notes.md");
    expect(
      [...root.querySelectorAll(".rdiff-column-header div")].map(
        (label) => label.textContent,
      ),
    ).toEqual(["HEAD", "Working Tree"]);
    expect(root.querySelector(".rdiff-stat-add").textContent).toBe("+2");
    expect(root.querySelector(".rdiff-stat-delete").textContent).toBe("-1");
  });

  it("renders one row per diff line with side markers", async () => {
    const root = await boot();
    const rows = [...root.querySelectorAll(".rdiff-row")];

    expect(rows.length).toBeGreaterThan(3);
    expect(rows.some((row) => row.className.includes("is-replace"))).toBe(true);
    expect(rows.some((row) => row.className.includes("is-insert"))).toBe(true);
    expect(
      [...root.querySelectorAll(".rdiff-marker")].map((cell) => cell.textContent),
    ).toEqual(expect.arrayContaining(["-", "+"]));
  });

  it("renders Markdown inside the rows", async () => {
    const root = await boot();
    expect(root.querySelector(".rdiff-heading")).toBeTruthy();
  });

  it("applies the theme from the host settings", async () => {
    await boot();
    expect(document.documentElement.dataset.richTheme).toBe("midnight");
  });

  it("shows equal rows and a zero summary when both sides match", async () => {
    const root = await boot({
      ...DIFF,
      leftText: "same\n",
      rightText: "same\n",
    });

    expect(root.querySelector(".rdiff-stat-add").textContent).toBe("+0");
    expect(root.querySelector(".rdiff-stat-delete").textContent).toBe("-0");
    expect(
      [...root.querySelectorAll(".rdiff-row")].every((row) =>
        row.className.includes("is-equal"),
      ),
    ).toBe(true);
  });

  it("shows the empty state when there is nothing on either side", async () => {
    const root = await boot({ ...DIFF, leftText: "", rightText: "" });

    expect(root.querySelector(".rdiff-empty-title").textContent).toBe(
      "No changes",
    );
  });

  it("falls back to default labels when the host omits them", async () => {
    const root = await boot({ leftText: "a\n", rightText: "b\n" });

    expect(
      [...root.querySelectorAll(".rdiff-column-header div")].map(
        (label) => label.textContent,
      ),
    ).toEqual(["Base", "Working Tree"]);
    expect(root.querySelector(".rdiff-file").textContent).toBe("Markdown");
  });

  it("re-renders when the working tree changes", async () => {
    const root = await boot();
    expect(root.querySelector(".rdiff-stat-add").textContent).toBe("+2");

    sendMessage({ type: "updateRight", text: DIFF.leftText });

    expect(root.querySelector(".rdiff-stat-add").textContent).toBe("+0");
    expect(root.querySelector(".rdiff-stat-delete").textContent).toBe("-0");
  });

  it("ignores an updateRight without text", async () => {
    const root = await boot();
    const before = root.innerHTML;
    sendMessage({ type: "updateRight" });

    expect(root.innerHTML).toBe(before);
  });

  it("re-applies the theme when settings arrive", async () => {
    await boot();
    sendMessage({ type: "settings", settings: { richTheme: "paper" } });

    expect(document.documentElement.dataset.richTheme).toBe("paper");
  });

  it("ignores an empty message", async () => {
    const root = await boot();
    const before = root.innerHTML;
    sendMessage(null);

    expect(root.innerHTML).toBe(before);
  });

  it("asks the host to open a clicked link", async () => {
    const root = await boot({
      ...DIFF,
      leftText: "see [docs](https://example.com/a)\n",
      rightText: "see [docs](https://example.com/b)\n",
    });

    root
      .querySelector("a[data-href]")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "openLink",
      href: expect.stringContaining("https://example.com/"),
    });
  });

  it("copies a code block through the host", async () => {
    vi.useFakeTimers();
    const root = await boot({
      ...DIFF,
      leftText: "```js\nconst a = 1;\n```\n",
      rightText: "```js\nconst a = 2;\n```\n",
    });

    const button = root.querySelector("[data-copy-id]");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "copyText",
      text: expect.stringContaining("const a ="),
    });
    expect(button.textContent).toBe("Copied");

    vi.advanceTimersByTime(900);
    expect(button.textContent).toBe("Copy");
  });

  it("asks the host to resolve images and shows the answer", async () => {
    const root = await boot({
      ...DIFF,
      leftText: "![logo](a.png)\n",
      rightText: "![logo](b.png)\n",
    });

    const request = postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === "resolveImage");
    expect(request).toMatchObject({ type: "resolveImage" });

    sendMessage({
      type: "resolvedImage",
      requestId: request.requestId,
      uri: "data:image/png;base64,AAA",
    });

    expect(root.querySelector("[data-image-src] img").getAttribute("src")).toBe(
      "data:image/png;base64,AAA",
    );
  });

  it("shows an error when an image cannot be resolved", async () => {
    const root = await boot({
      ...DIFF,
      leftText: "![logo](a.png)\n",
      rightText: "![logo](gone.png)\n",
    });
    const request = postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === "resolveImage");

    sendMessage({ type: "resolvedImage", requestId: request.requestId, uri: "" });

    expect(root.querySelector(".rdiff-image-error").textContent).toBe("logo");
  });

  it("gives up on an image the host never resolves", async () => {
    vi.useFakeTimers();
    const root = await boot({
      ...DIFF,
      leftText: "![logo](a.png)\n",
      rightText: "![logo](b.png)\n",
    });

    vi.advanceTimersByTime(4000);
    expect(root.querySelector(".rdiff-image-error").textContent).toBe(
      "Image could not be loaded",
    );
  });

  it("ignores a resolved image for an unknown request", async () => {
    const root = await boot();
    expect(() =>
      sendMessage({ type: "resolvedImage", requestId: 999, uri: "x" }),
    ).not.toThrow();
    expect(root.querySelector(".rdiff-shell")).toBeTruthy();
  });
});

describe("commit diff webview", () => {
  const VIEW = {
    key: "base..target",
    title: "Rework docs",
    meta: ["c200000", "Ada", "2026/11/15 12:00", "notes"],
    note: "",
    files: [
      { id: "0", path: "docs/guide.md", status: "modified", additions: 2, deletions: 1 },
      { id: "1", path: "new.md", status: "added", additions: 3, deletions: 0 },
      { id: "2", path: "docs/old.md", status: "deleted", additions: 0, deletions: 1 },
    ],
  };
  const MODIFIED = {
    layout: "split",
    status: "modified",
    fileName: "guide.md",
    filePath: "docs/guide.md",
    leftText: "# Guide\n\nold\n",
    rightText: "# Guide\n\nnew\nmore\n",
    leftLabel: "p100000",
    rightLabel: "c200000",
  };
  const ADDED = {
    layout: "single",
    singleSide: "right",
    status: "added",
    fileName: "new.md",
    filePath: "new.md",
    leftText: "",
    rightText: "# New\n\n- one\n",
    singleLabel: "Added in c200000",
  };

  async function boot(data = { commitView: VIEW, selectedFileId: "0", file: MODIFIED }) {
    document.body.innerHTML = `
      <div id="diff"></div>
      ${jsonScript("initial-diff", data)}
      ${jsonScript("initial-settings", { richTheme: "midnight" })}
    `;
    await import("../src/richDiff.js");
    return document.querySelector("#diff");
  }

  const fileItems = (root) => [...root.querySelectorAll("[data-file-id]")];
  const messagesOfType = (type) =>
    postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);

  it("shows the commit, its Markdown files, and the selected file's diff", async () => {
    const root = await boot();

    expect(root.querySelector(".rdiff-commit-title").textContent).toBe("Rework docs");
    expect(root.querySelector(".rdiff-commit-meta").textContent).toContain("c200000");
    expect(fileItems(root).map((item) => item.querySelector(".rdiff-file-status").textContent)).toEqual([
      "M",
      "A",
      "D",
    ]);
    expect(fileItems(root)[0].classList.contains("is-selected")).toBe(true);
    expect(fileItems(root)[0].getAttribute("aria-current")).toBe("true");
    expect(
      [...root.querySelectorAll(".rdiff-column-header div")].map((label) => label.textContent),
    ).toEqual(["p100000", "c200000"]);
    expect(root.querySelector(".rdiff-commit-main .rdiff-row.is-replace")).toBeTruthy();
  });

  it("asks the host for a file when it is selected and shows it when it arrives", async () => {
    const root = await boot();

    fileItems(root)[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(messagesOfType("selectFile")).toEqual([
      { type: "selectFile", fileId: "1", key: "base..target" },
    ]);
    expect(fileItems(root)[1].classList.contains("is-selected")).toBe(true);
    expect(root.querySelector(".rdiff-loading")).toBeTruthy();

    sendMessage({ type: "showFile", key: "base..target", fileId: "1", file: ADDED });

    expect(root.querySelector(".rdiff-loading")).toBeNull();
    expect(root.querySelector(".rdiff-file").textContent).toContain("new.md");
  });

  it("selects a file the host picked, without asking for it again", async () => {
    const root = await boot();
    const scrolled = vi.fn();
    fileItems(root)[1].scrollIntoView = scrolled;

    sendMessage({ type: "showFile", key: "base..target", fileId: "1", file: ADDED, select: true });

    expect(fileItems(root)[1].classList.contains("is-selected")).toBe(true);
    expect(fileItems(root)[0].classList.contains("is-selected")).toBe(false);
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
    expect(root.querySelector(".rdiff-file").textContent).toContain("new.md");
    expect(messagesOfType("selectFile")).toEqual([]);
  });

  it("ignores a host selection for another commit or an unknown file", async () => {
    const root = await boot();

    sendMessage({ type: "showFile", key: "other..commit", fileId: "1", file: ADDED, select: true });
    sendMessage({ type: "showFile", key: "base..target", fileId: "9", file: ADDED, select: true });

    expect(fileItems(root)[0].classList.contains("is-selected")).toBe(true);
    expect(root.querySelector(".rdiff-file").textContent).toContain("guide.md");
  });

  it("renders an added file as one pane", async () => {
    const root = await boot({ commitView: VIEW, selectedFileId: "1", file: ADDED });

    const header = [...root.querySelectorAll(".rdiff-column-header div")];
    expect(header.map((label) => label.textContent)).toEqual(["Added in c200000"]);
    expect(root.querySelectorAll(".rdiff-row.is-single")).toHaveLength(3);
    expect(root.querySelectorAll(".rdiff-left, .rdiff-right")).toHaveLength(0);
    expect(root.querySelector(".rdiff-heading")).toBeTruthy();
    expect(root.querySelector(".rdiff-stat-add").textContent).toBe("+3");
    expect(root.querySelector(".rdiff-status-badge").textContent).toBe("Added");
  });

  it("renders a deleted file as one pane without an Open File button", async () => {
    const root = await boot({
      commitView: VIEW,
      selectedFileId: "2",
      file: {
        layout: "single",
        singleSide: "left",
        status: "deleted",
        fileName: "old.md",
        filePath: "docs/old.md",
        leftText: "gone\n",
        singleLabel: "Deleted in c200000",
      },
    });

    expect(root.querySelector(".rdiff-single.is-deleted-file .rdiff-marker").textContent).toBe("-");
    expect(root.querySelector(".rdiff-stat-delete").textContent).toBe("-1");
    expect(root.querySelector('[data-action="open-file"]')).toBeNull();
  });

  it("ignores file replies for another selection or commit", async () => {
    const root = await boot();
    fileItems(root)[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    sendMessage({ type: "showFile", key: "base..target", fileId: "0", file: MODIFIED });
    sendMessage({ type: "showFile", key: "other", fileId: "1", file: ADDED });

    expect(root.querySelector(".rdiff-loading")).toBeTruthy();
  });

  it("shows a file the host could not read", async () => {
    const root = await boot();
    fileItems(root)[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    sendMessage({ type: "fileError", key: "base..target", fileId: "2", message: "fatal: bad object" });

    expect(root.querySelector(".rdiff-empty-copy").textContent).toBe("fatal: bad object");
  });

  it("shows an error the host sent with the first file", async () => {
    const root = await boot({
      commitView: VIEW,
      selectedFileId: "0",
      file: null,
      fileError: "fatal: bad object",
    });

    expect(root.querySelector(".rdiff-empty-copy").textContent).toBe("fatal: bad object");
  });

  it("says so when the commit changed no Markdown", async () => {
    const root = await boot({ commitView: { ...VIEW, files: [] }, selectedFileId: null, file: null });

    expect(root.querySelector(".rdiff-empty-title").textContent).toBe("No Markdown changes");
  });

  it("forwards the commit picker and Open File buttons", async () => {
    const root = await boot();

    root.querySelector('[data-action="pick-commit"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    root.querySelector('[data-action="open-file"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(messagesOfType("pickCommit")).toHaveLength(1);
    expect(messagesOfType("openFile")).toEqual([{ type: "openFile", fileId: "0" }]);
  });

  it("moves through the file list with the arrow keys", async () => {
    const root = await boot();
    const [first] = fileItems(root);

    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(messagesOfType("selectFile").at(-1)).toMatchObject({ fileId: "1" });

    fileItems(root)[1].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(messagesOfType("selectFile").at(-1)).toMatchObject({ fileId: "2" });

    fileItems(root)[2].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(messagesOfType("selectFile")).toHaveLength(2);
  });

  it("replaces the view when the host shows another commit", async () => {
    const root = await boot();

    sendMessage({
      type: "showCommit",
      commitView: {
        ...VIEW,
        key: "next",
        title: "Later work",
        note: "Includes 2 later commits up to HEAD (h300000)",
        files: [VIEW.files[1]],
      },
      selectedFileId: "1",
      file: ADDED,
    });

    expect(root.querySelector(".rdiff-commit-title").textContent).toBe("Later work");
    expect(root.querySelector(".rdiff-commit-note").textContent).toContain("2 later commits");
    expect(fileItems(root)).toHaveLength(1);
    expect(root.querySelectorAll(".rdiff-row.is-single")).toHaveLength(3);
  });

  it("does not take working tree updates meant for the file diff", async () => {
    const root = await boot();
    const before = root.querySelector(".rdiff-commit-main").innerHTML;

    sendMessage({ type: "updateRight", text: "replaced\n" });

    expect(root.querySelector(".rdiff-commit-main").innerHTML).toBe(before);
  });
});

describe("rich editor webview", () => {
  async function boot({
    text = "# Title\n\nbody text\n",
    settings = { richTheme: "midnight", previewWidth: "wide" },
    runtime = {},
    gitDiff = [],
    imageMap = {},
    mermaidScriptUri = "",
    reveal = null,
  } = {}) {
    document.body.innerHTML = `
      <div id="editor"></div>
      ${jsonScript("initial-reveal", reveal)}
      ${jsonScript("initial-document", text)}
      ${jsonScript("initial-settings", settings)}
      ${jsonScript("mermaid-script-uri", mermaidScriptUri)}
      ${jsonScript("initial-git-diff", gitDiff)}
      ${jsonScript("initial-image-map", imageMap)}
      ${jsonScript("initial-runtime", runtime)}
    `;
    await import("../src/richEditor.js");
    return document.querySelector("#editor");
  }

  it("mounts a CodeMirror editor with the host's document", async () => {
    const root = await boot();

    expect(root.querySelector(".cm-editor")).toBeTruthy();
    expect(root.textContent).toContain("Title");
  });

  it("applies the theme and content width from the host settings", async () => {
    await boot();

    expect(document.documentElement.dataset.richTheme).toBe("midnight");
    expect(document.documentElement.dataset.previewWidth).toBe("wide");
  });

  it("renders the settings menu and the outline", async () => {
    await boot();

    expect(document.querySelector(".cm-settings-root")).toBeTruthy();
    expect(document.querySelector(".richdown-outline-root")).toBeTruthy();
  });

  it("reports edits to the extension host", async () => {
    const root = await boot();
    const view = root.querySelector(".cm-content");
    view.dispatchEvent(
      new InputEvent("beforeinput", { bubbles: true, data: "x" }),
    );

    // Typing goes through CodeMirror, so drive the document from the host side
    // instead and assert the editor stays in sync.
    sendMessage({ type: "update", text: "# Changed\n" });
    expect(root.textContent).toContain("Changed");
  });

  async function editorView(root) {
    // Imported after boot so it is the same module instance the editor uses.
    const { EditorView } = await import("@codemirror/view");
    return EditorView.findFromDOM(root.querySelector(".cm-editor"));
  }

  function sentEdits() {
    return postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === "edit");
  }

  it("numbers each edit it sends to the host", async () => {
    const root = await boot({ text: "" });
    const view = await editorView(root);

    view.dispatch({ changes: { from: 0, insert: "#" } });
    view.dispatch({ changes: { from: 1, insert: " " } });

    expect(sentEdits()).toEqual([
      { type: "edit", text: "#", version: 1 },
      { type: "edit", text: "# ", version: 2 },
    ]);
  });

  it("ignores a host update taken before its latest edits", async () => {
    // A new file turns dirty on the first keystroke, and VS Code echoes that
    // state change with the document as it was then. Applying that copy used
    // to undo the characters typed since, or double them mid-IME composition.
    const root = await boot({ text: "" });
    const view = await editorView(root);
    view.dispatch({ changes: { from: 0, insert: "#" } });
    view.dispatch({ changes: { from: 1, insert: " T" }, selection: { anchor: 3 } });

    sendMessage({ type: "update", text: "#", version: 1 });

    expect(view.state.doc.toString()).toBe("# T");
    expect(view.state.selection.main.head).toBe(3);
  });

  it("applies a host update that includes its latest edit", async () => {
    const root = await boot({ text: "" });
    const view = await editorView(root);
    view.dispatch({ changes: { from: 0, insert: "draft" } });

    sendMessage({ type: "update", text: "# draft\n", version: 1 });

    expect(view.state.doc.toString()).toBe("# draft\n");
    // An external update must not be reported back as a webview edit.
    expect(sentEdits()).toHaveLength(1);
  });

  const lintMessage = (version) => ({
    type: "lintDiagnostics",
    version,
    diagnostics: [
      { line: 0, from: 0, to: 2, severity: "warning", message: "m", rule: "r" },
    ],
  });

  it("drops lint results taken before its latest edit", async () => {
    const root = await boot({ text: "" });
    const view = await editorView(root);
    view.dispatch({ changes: { from: 0, insert: "##" } });
    view.dispatch({ changes: { from: 2, insert: " a" } });

    sendMessage(lintMessage(1));
    expect(root.querySelector(".cm-richdown-lint")).toBeNull();

    sendMessage(lintMessage(2));
    expect(root.querySelector(".cm-richdown-lint")).toBeTruthy();
  });

  it("holds lint results back until an IME composition ends", async () => {
    // Redrawing the marks on the composing line made CodeMirror lose the
    // composition, which dropped the "## " or doubled the composed text.
    const root = await boot({ text: "## a" });
    const view = await editorView(root);
    Object.defineProperty(view, "composing", { configurable: true, value: true });

    sendMessage(lintMessage(0));
    expect(root.querySelector(".cm-richdown-lint")).toBeNull();

    Object.defineProperty(view, "composing", { configurable: true, value: false });
    view.contentDOM.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root.querySelector(".cm-richdown-lint")).toBeTruthy();
  });

  it("applies a CRLF host update without inserting extra line breaks", async () => {
    // New files on Windows use CRLF. CodeMirror stores the document in LF, so an
    // un-normalized update used to arrive as a lone "\r" insert, which the editor
    // applies as an extra blank line while the caret is remapped.
    const root = await boot({ text: "alpha\nbravo\n" });

    sendMessage({ type: "update", text: "alpha\r\nbravo\r\ncharlie\r\n" });

    const lines = [...root.querySelectorAll(".cm-line")].map(
      (line) => line.textContent,
    );
    expect(lines).toEqual(["alpha", "bravo", "charlie", ""]);
    expect(root.textContent).not.toContain("\r");
  });

  it("switches theme on a theme message", async () => {
    await boot();
    sendMessage({ type: "theme", theme: "forest" });

    expect(document.documentElement.dataset.richTheme).toBe("forest");
  });

  it("applies a settings patch from the host", async () => {
    await boot();
    sendMessage({ type: "settings", settings: { previewWidth: "default" } });

    expect(document.documentElement.dataset.previewWidth).toBe("default");
  });

  it("accepts git diff decorations", async () => {
    const root = await boot();
    sendMessage({ type: "gitDiff", changes: [{ line: 1, type: "added" }] });

    expect(root.querySelector(".cm-git-diff-gutter")).toBeTruthy();
  });

  it("ignores an empty message", async () => {
    const root = await boot();
    expect(() => sendMessage(null)).not.toThrow();
    expect(root.querySelector(".cm-editor")).toBeTruthy();
  });

  it("opens at the position the host passed in the initial page", async () => {
    const root = await boot({
      text: "# Title\n\nfind the needle here\n",
      reveal: {
        selection: {
          start: { line: 2, character: 9 },
          end: { line: 2, character: 15 },
        },
      },
    });

    expect(root.querySelector(".cm-richdown-reveal-match")?.textContent).toBe(
      "needle",
    );
  });

  it("reveals a heading when the host asks for one", async () => {
    const root = await boot({ text: "# Title\n\n## Usage\n\ntext\n" });
    sendMessage({ type: "reveal", target: { anchor: "usage" } });

    const activeLine = root.querySelector(".cm-activeLine");
    expect(activeLine?.textContent).toContain("Usage");
  });

  it("shows the Copilot banner while the host reports pending edits", async () => {
    await boot();
    sendMessage({ type: "chatEdits", pending: true });
    expect(document.querySelector(".richdown-chat-edits-banner")).toBeTruthy();

    sendMessage({ type: "chatEdits", pending: false });
    expect(document.querySelector(".richdown-chat-edits-banner")).toBeNull();
  });

  it("runs without an extension host in export mode", async () => {
    vi.stubGlobal("acquireVsCodeApi", undefined);
    const root = await boot({
      runtime: { exportMode: true },
      imageMap: { "img.png": "data:image/png;base64,AAA" },
      text: "![logo](img.png)\n\nbody\n",
    });

    expect(document.documentElement.dataset.richdownExport).toBe("true");
    expect(root.querySelector(".cm-editor")).toBeTruthy();
  });
});
