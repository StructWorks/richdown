// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completionStatus,
  currentCompletions,
  startCompletion,
} from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { createMarkdownCompletion } from "../src/rich-editor/presentation/codemirror/completions.js";
import { createGitDiffGutter } from "../src/rich-editor/presentation/codemirror/gitDiffGutter.js";
import { createSlashCommandController } from "../src/rich-editor/presentation/codemirror/slashCommands.js";
import {
  createPreviewHarness,
  stubViewLayout,
} from "./helpers/previewHarness.js";

let harness;
const views = [];

function mountView(state, { attach = false } = {}) {
  const view = new EditorView(
    attach ? { state, parent: document.body } : { state },
  );
  stubViewLayout(view);
  views.push(view);
  return view;
}

afterEach(() => {
  for (const view of views.splice(0)) {
    view.destroy();
  }
  harness?.destroy();
  harness = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("slash command menu", () => {
  function binding(controller, key) {
    return controller.keymap.find((entry) => entry.key === key).run;
  }

  function open(doc = "text\n\n") {
    // The menu positions itself from real caret coordinates, so it needs a view
    // that is part of the document.
    harness = createPreviewHarness({
      doc,
      selection: { anchor: doc.length },
      attach: true,
    });
    stubViewLayout(harness.view);
    const controller = createSlashCommandController();
    const opened = binding(controller, "/")(harness.view);
    return { controller, opened, view: harness.view };
  }

  function items() {
    return [...document.querySelectorAll(".cm-slash-menu-item")];
  }

  function activeLabel() {
    return document
      .querySelector(".cm-slash-menu-item.is-active .cm-slash-menu-label")
      ?.textContent;
  }

  it("opens on an empty line and inserts the slash", () => {
    const { opened, view } = open();

    expect(opened).toBe(true);
    expect(view.state.doc.toString()).toBe("text\n\n/");
    expect(document.querySelector(".cm-slash-menu").getAttribute("role")).toBe(
      "listbox",
    );
    expect(items().length).toBeGreaterThan(10);
  });

  it("does not open on a line that already has text", () => {
    harness = createPreviewHarness({
      doc: "text",
      selection: { anchor: 4 },
      attach: true,
    });
    const controller = createSlashCommandController();

    expect(binding(controller, "/")(harness.view)).toBe(false);
    expect(document.querySelector(".cm-slash-menu")).toBeNull();
  });

  it("does not open when text is selected", () => {
    harness = createPreviewHarness({
      doc: "some text",
      selection: { anchor: 0, head: 4 },
      attach: true,
    });
    const controller = createSlashCommandController();

    expect(binding(controller, "/")(harness.view)).toBe(false);
  });

  it("marks the first command as selected", () => {
    open();
    expect(activeLabel()).toBe("Heading 1");
    expect(items()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("moves the selection with the arrow keys and wraps around", () => {
    const { controller, view } = open();

    expect(binding(controller, "ArrowDown")(view)).toBe(true);
    expect(activeLabel()).toBe("Heading 2");

    expect(binding(controller, "ArrowUp")(view)).toBe(true);
    expect(activeLabel()).toBe("Heading 1");

    binding(controller, "ArrowUp")(view);
    expect(activeLabel()).toBe("Details");
  });

  it("follows the pointer", () => {
    open();
    items()[3].dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(activeLabel()).toBe("Bullet list");
  });

  it("inserts the chosen snippet and closes", () => {
    const { controller, view } = open();
    binding(controller, "ArrowDown")(view);
    binding(controller, "Enter")(view);

    expect(view.state.doc.toString()).toBe("text\n\n## ");
    expect(view.state.selection.main.anchor).toBe(view.state.doc.length);
    expect(document.querySelector(".cm-slash-menu")).toBeNull();
  });

  it("accepts with Tab as well", () => {
    const { controller, view } = open();
    binding(controller, "Tab")(view);

    expect(view.state.doc.toString()).toBe("text\n\n# ");
  });

  // A click accepts whichever item the pointer last entered, which is how the
  // menu behaves in a browser where mouseenter always precedes click.
  function choose(label) {
    const item = items().find((entry) => entry.textContent.startsWith(label));
    item.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    items()
      .find((entry) => entry.textContent.startsWith(label))
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  it("inserts a multi-line snippet and places the caret inside it", () => {
    const { view } = open();
    choose("Code block");

    expect(view.state.doc.toString()).toBe("text\n\n```\n\n```");
    expect(view.state.doc.lineAt(view.state.selection.main.anchor).number).toBe(4);
  });

  it("inserts a table skeleton", () => {
    const { view } = open();
    choose("Table");

    expect(view.state.doc.toString()).toContain("| --- | --- | --- |");
  });

  it("offers both mermaid fence styles", () => {
    open();
    expect(items().map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Mermaid"),
        expect.stringContaining("Azure Mermaid"),
      ]),
    );
  });

  it("closes on Escape without inserting anything", () => {
    const { controller, view } = open();

    expect(binding(controller, "Escape")(view)).toBe(true);
    expect(document.querySelector(".cm-slash-menu")).toBeNull();
    expect(view.state.doc.toString()).toBe("text\n\n/");
  });

  it("reports the keys as unhandled when no menu is open", () => {
    harness = createPreviewHarness({ doc: "text", attach: true });
    const controller = createSlashCommandController();

    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"]) {
      expect(binding(controller, key)(harness.view)).toBe(false);
    }
  });

  it("closes itself when the slash is deleted", () => {
    const { controller, view } = open();
    const from = view.state.doc.length - 1;
    view.dispatch({ changes: { from, to: from + 1, insert: "" } });
    controller.sync({
      docChanged: true,
      changes: { mapPos: (position) => position },
      state: view.state,
    });

    expect(document.querySelector(".cm-slash-menu")).toBeNull();
  });

  it("closes itself when the caret moves away", () => {
    const { controller, view } = open();
    controller.sync({
      docChanged: false,
      state: EditorState.create({
        doc: view.state.doc.toString(),
        selection: { anchor: 0 },
      }),
    });

    expect(document.querySelector(".cm-slash-menu")).toBeNull();
  });

  it("only keeps one menu open", () => {
    const { controller, view } = open();
    binding(controller, "/")(view);

    expect(document.querySelectorAll(".cm-slash-menu")).toHaveLength(1);
  });
});

describe("markdown completion", () => {
  function mount(doc, { postMessage = vi.fn() } = {}) {
    const completion = createMarkdownCompletion({ postMessage });
    const view = mountView(
      EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [completion.extension],
      }),
      { attach: true },
    );
    return { completion, postMessage, view };
  }

  function labels(view) {
    return currentCompletions(view.state).map((option) => option.label);
  }

  it("suggests fence languages while typing an info string", async () => {
    const { view, postMessage } = mount("```ja");
    startCompletion(view);

    await vi.waitFor(() => expect(labels(view)).toContain("java"));
    expect(labels(view)).toContain("javascript");
    // A fence info string is answered locally, never by the extension host.
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("offers mermaid as a fence language", async () => {
    const { view } = mount("```mer");
    startCompletion(view);

    await vi.waitFor(() => expect(labels(view)).toContain("mermaid"));
  });

  it("bridges the extension host's items into the editor", async () => {
    const { completion, postMessage, view } = mount("Wo");
    startCompletion(view);

    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    const request = postMessage.mock.calls.at(-1)[0];
    expect(request).toMatchObject({
      type: "requestHostCompletions",
      line: 0,
      character: 2,
      lineText: "Wo",
    });

    completion.handleHostCompletions({
      requestId: request.requestId,
      items: [
        { label: "Workspace", detail: "from host", kind: 1 },
        { label: "Worker", insertText: "Worker()", kind: 2 },
      ],
    });

    await vi.waitFor(() =>
      expect(labels(view).sort()).toEqual(["Worker", "Workspace"]),
    );
    expect(
      currentCompletions(view.state).find((option) => option.label === "Worker")
        .apply,
    ).toBe("Worker()");
  });

  it("shows nothing when the host answers with no items", async () => {
    const { completion, postMessage, view } = mount("Wo");
    startCompletion(view);

    await vi.waitFor(() => expect(postMessage).toHaveBeenCalled());
    completion.handleHostCompletions({
      requestId: postMessage.mock.calls.at(-1)[0].requestId,
      items: [],
    });

    await vi.waitFor(() => expect(completionStatus(view.state)).not.toBe("pending"));
    expect(labels(view)).toEqual([]);
  });

  it("ignores an answer for an unknown request", () => {
    const { completion } = mount("text");

    expect(() =>
      completion.handleHostCompletions({ requestId: "nope", items: [] }),
    ).not.toThrow();
    expect(() =>
      completion.handleLinkCompletions({ requestId: "nope", paths: [] }),
    ).not.toThrow();
  });

  it("does not invoke the host for ordinary typing", async () => {
    const { postMessage, view } = mount("plain prose");
    // An implicit completion (no Ctrl+Space, no link target) must stay quiet, the
    // way VS Code keeps quick suggestions off for Markdown.
    view.dispatch({ changes: { from: view.state.doc.length, insert: "x" } });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("falls back to local link paths once the host proves absent", async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    const completion = createMarkdownCompletion({ postMessage });
    const doc = "see [docs](";
    const view = mountView(
      EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [completion.extension],
      }),
      { attach: true },
    );

    // The host request times out, which marks the host absent and makes the
    // source fall through to local link paths in the same round.
    startCompletion(view);
    await vi.advanceTimersByTimeAsync(3100);

    const linkRequest = postMessage.mock.calls
      .map(([message]) => message)
      .findLast((message) => message.type === "requestLinkCompletions");
    expect(linkRequest).toBeTruthy();

    completion.handleLinkCompletions({
      requestId: linkRequest.requestId,
      paths: ["docs/guide.md", "notes/my file.md"],
    });
    await vi.advanceTimersByTimeAsync(10);

    expect(labels(view).sort()).toEqual(["docs/guide.md", "notes/my file.md"]);
    expect(
      currentCompletions(view.state).find(
        (option) => option.label === "notes/my file.md",
      ).apply,
    ).toBe("notes/my%20file.md");
  });

  it("suggests heading anchors for an in-document link", async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn();
    const completion = createMarkdownCompletion({ postMessage });
    const doc = "## First section\n\n## Second section\n\nsee [jump](#";
    const view = mountView(
      EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [completion.extension],
      }),
      { attach: true },
    );

    startCompletion(view);
    await vi.advanceTimersByTimeAsync(3100);

    expect(labels(view).sort()).toEqual(["#first-section", "#second-section"]);
  });
});

describe("git diff gutter", () => {
  function mount(changes) {
    const gitDiffGutter = createGitDiffGutter(changes);
    const view = mountView(
      EditorState.create({
        doc: "one\ntwo\nthree\nfour\n",
        extensions: [gitDiffGutter.extension],
      }),
      { attach: true },
    );
    return { gitDiffGutter, view };
  }

  function markerClasses(view) {
    return [
      ...view.dom.querySelectorAll(".cm-git-diff-gutter .cm-gutterElement"),
    ].map((element) => element.className);
  }

  it("marks the lines given at construction time", () => {
    const { view } = mount([
      { line: 1, type: "added" },
      { line: 3, type: "modified" },
    ]);
    const classes = markerClasses(view).join(" ");

    expect(classes).toContain("cm-git-diff-line-added");
    expect(classes).toContain("cm-git-diff-line-modified");
  });

  it("replaces the markers on update", () => {
    const { gitDiffGutter, view } = mount([{ line: 1, type: "added" }]);
    gitDiffGutter.update(view, [{ line: 2, type: "deleted" }]);

    const classes = markerClasses(view).join(" ");
    expect(classes).toContain("cm-git-diff-line-deleted");
    expect(classes).not.toContain("cm-git-diff-line-added");
  });

  it("combines several change types on one line", () => {
    const { view } = mount([
      { line: 2, type: "added" },
      { line: 2, type: "deleted" },
    ]);

    expect(
      markerClasses(view).some(
        (className) =>
          className.includes("cm-git-diff-line-deleted") &&
          className.includes("cm-git-diff-line-added"),
      ),
    ).toBe(true);
  });

  it("drops a line number below the first line", () => {
    const { view } = mount([{ line: 0, type: "added" }]);
    expect(markerClasses(view).join(" ")).not.toContain("cm-git-diff-line");
  });

  it("clamps a line number past the end of the document", () => {
    const { view } = mount([{ line: 999, type: "modified" }]);
    expect(markerClasses(view).join(" ")).toContain("cm-git-diff-line-modified");
  });

  it("ignores malformed entries and non-array input", () => {
    const { gitDiffGutter, view } = mount("not an array");
    expect(markerClasses(view).join(" ")).not.toContain("cm-git-diff-line");

    gitDiffGutter.update(view, [
      { type: "added" },
      { line: 2, type: "bogus" },
      null,
    ]);
    expect(markerClasses(view).join(" ")).not.toContain("cm-git-diff-line");
  });

  it("ignores an update without a view", () => {
    const { gitDiffGutter } = mount([]);
    expect(() => gitDiffGutter.update(null, [])).not.toThrow();
  });
});

// A preview widget hides the lines it replaces, and CodeMirror then renders one
// gutter element for the whole block instead of one per hidden line. The change
// marks for those lines have to travel with the block or they disappear.
describe("git diff gutter inside previewed blocks", () => {
  const TABLE_DOC = [
    "intro",
    "",
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
    "| 3 | 4 |",
    "",
    "tail",
  ].join("\n");

  const MERMAID_DOC = [
    "intro",
    "",
    "```mermaid",
    "graph TD;",
    "  A-->B;",
    "```",
    "",
    "tail",
  ].join("\n");

  function mount(doc, changes, settings) {
    const gitDiffGutter = createGitDiffGutter(changes);
    harness = createPreviewHarness({
      doc,
      settings,
      attach: true,
      extraExtensions: gitDiffGutter.extension,
    });
    return { gitDiffGutter, view: harness.view };
  }

  function markerClasses(view) {
    return [
      ...view.dom.querySelectorAll(".cm-git-diff-gutter .cm-gutterElement"),
    ].map((element) => element.className);
  }

  it("marks a rich table whose body row changed", () => {
    const { view } = mount(TABLE_DOC, [{ line: 5, type: "modified" }]);

    expect(view.dom.querySelector(".cm-rich-table-preview")).toBeTruthy();
    expect(markerClasses(view).join(" ")).toContain("cm-git-diff-line-modified");
  });

  it("marks a rich table whose header row changed", () => {
    const { view } = mount(TABLE_DOC, [{ line: 3, type: "added" }]);
    expect(markerClasses(view).join(" ")).toContain("cm-git-diff-line-added");
  });

  it("merges every change inside one table into a single mark", () => {
    const { view } = mount(TABLE_DOC, [
      { line: 3, type: "added" },
      { line: 5, type: "modified" },
      { line: 6, type: "modified" },
    ]);
    const marked = markerClasses(view).filter((className) =>
      className.includes("cm-git-diff-line-"),
    );

    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain("cm-git-diff-line-added");
    expect(marked[0]).toContain("cm-git-diff-line-modified");
  });

  it("leaves an unchanged table unmarked", () => {
    const { view } = mount(TABLE_DOC, [{ line: 8, type: "added" }]);
    const marked = markerClasses(view).filter((className) =>
      className.includes("cm-git-diff-line-"),
    );

    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain("cm-git-diff-line-added");
  });

  it("marks a Mermaid diagram whose source changed", () => {
    const { view } = mount(MERMAID_DOC, [{ line: 4, type: "modified" }]);
    expect(markerClasses(view).join(" ")).toContain("cm-git-diff-line-modified");
  });

  it("keeps marking the table when a new change set arrives", () => {
    const { gitDiffGutter, view } = mount(TABLE_DOC, []);
    expect(markerClasses(view).join(" ")).not.toContain("cm-git-diff-line");

    gitDiffGutter.update(view, [{ line: 5, type: "deleted" }]);
    expect(markerClasses(view).join(" ")).toContain("cm-git-diff-line-deleted");

    gitDiffGutter.update(view, []);
    expect(markerClasses(view).join(" ")).not.toContain("cm-git-diff-line");
  });

  it("still marks the individual lines once the preview is off", () => {
    const { view } = mount(TABLE_DOC, [{ line: 5, type: "modified" }], {
      richTablePreview: false,
    });

    expect(view.dom.querySelector(".cm-rich-table-preview")).toBeNull();
    expect(markerClasses(view).join(" ")).toContain("cm-git-diff-line-modified");
  });
});
