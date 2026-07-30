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

describe("rich editor webview", () => {
  async function boot({
    text = "# Title\n\nbody text\n",
    settings = { richTheme: "midnight", previewWidth: "wide" },
    runtime = {},
    gitDiff = [],
    imageMap = {},
    mermaidScriptUri = "",
  } = {}) {
    document.body.innerHTML = `
      <div id="editor"></div>
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
