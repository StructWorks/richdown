// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFallbackEditor } from "../src/rich-editor/presentation/fallback/fallbackEditor.js";
import { isMarkdownMarker } from "../src/rich-editor/presentation/codemirror/links.js";
import { createOutlineNavigation } from "../src/rich-editor/presentation/outline/outlineNavigation.js";
import { createSettingsMenuController } from "../src/rich-editor/presentation/settings/settingsMenu.js";
import { defaultPreviewSettings } from "./helpers/previewHarness.js";
import { createPreviewHarness } from "./helpers/previewHarness.js";

let harness;

afterEach(() => {
  harness?.destroy();
  harness = null;
  document.body.replaceChildren();
  document.documentElement.removeAttribute("style");
  delete document.documentElement.dataset.richTheme;
  delete document.documentElement.dataset.previewWidth;
  vi.useRealTimers();
});

describe("isMarkdownMarker", () => {
  it.each([
    "HeaderMark",
    "QuoteMark",
    "EmphasisMark",
    "CodeMark",
    "LinkMark",
    "TaskMarker",
    "StrikethroughMark",
    "CodeInfo",
    "TableDelimiter",
  ])("treats %s as a hideable marker", (nodeName) => {
    expect(isMarkdownMarker(nodeName)).toBe(true);
  });

  it.each(["Paragraph", "ATXHeading1", "Table", "", "Document"])(
    "leaves %s alone",
    (nodeName) => {
      expect(isMarkdownMarker(nodeName)).toBe(false);
    },
  );
});

describe("outline navigation", () => {
  const DOC = [
    "# Title",
    "",
    "## First section",
    "",
    "body",
    "",
    "### Nested **bold** heading",
    "",
    "```md",
    "## Fenced heading",
    "```",
    "",
    "## Second section",
    "",
    "tail",
  ].join("\n");

  function render(doc = DOC) {
    harness = createPreviewHarness({ doc });
    const outline = createOutlineNavigation();
    outline.render(harness.view);
    return { outline, view: harness.view };
  }

  function items() {
    return [...document.querySelectorAll(".richdown-outline-item")];
  }

  it("lists H2 and H3 headings only", () => {
    render();
    expect(
      items().map((item) => item.querySelector(".richdown-outline-text").textContent),
    ).toEqual(["First section", "Nested bold heading", "Second section"]);
    expect(
      items().map((item) => item.querySelector(".richdown-outline-level").textContent),
    ).toEqual(["H2", "H3", "H2"]);
  });

  it("strips inline Markdown from heading labels", () => {
    render(
      [
        "## `code` and [link](a.md) and ![img](b.png) and ~~old~~",
        "",
        "body",
      ].join("\n"),
    );
    expect(
      items()[0].querySelector(".richdown-outline-text").textContent,
    ).toBe("code and link and img and old");
  });

  it("ignores headings inside a code fence", () => {
    render();
    expect(
      items().map((item) => item.title),
    ).not.toContain("Fenced heading");
  });

  it("indents deeper headings", () => {
    render();
    expect(items()[0].style.paddingLeft).toBe("7px");
    expect(items()[1].style.paddingLeft).toBe("19px");
  });

  it("says so when a document has no sections", () => {
    render("# Only a title\n\nbody");
    expect(document.querySelector(".richdown-outline-empty").textContent).toBe(
      "No sections",
    );
  });

  it("starts collapsed and toggles from the button", () => {
    render();
    const panel = document.querySelector(".richdown-outline-panel");
    const button = document.querySelector(".richdown-outline-button");

    expect(panel.hidden).toBe(true);
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(panel.hidden).toBe(false);
    expect(
      document.querySelector(".richdown-outline-root").classList.contains("is-open"),
    ).toBe(true);

    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(panel.hidden).toBe(true);
  });

  it("reports whether closing did anything", () => {
    const { outline } = render();
    expect(outline.close()).toBe(false);

    document
      .querySelector(".richdown-outline-button")
      .dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(outline.close()).toBe(true);
    expect(document.querySelector(".richdown-outline-panel").hidden).toBe(true);
  });

  it("moves the caret to a clicked heading and closes the panel", () => {
    const { view } = render();
    document
      .querySelector(".richdown-outline-button")
      .dispatchEvent(new Event("pointerdown", { bubbles: true }));

    items()[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.lineAt(view.state.selection.main.anchor).text).toBe(
      "## Second section",
    );
    expect(document.querySelector(".richdown-outline-panel").hidden).toBe(true);
  });

  it("highlights the section the caret is in", () => {
    const { outline, view } = render();
    view.dispatch({ selection: { anchor: DOC.indexOf("tail") } });
    outline.sync({ view, selectionSet: true });

    expect(
      items().findIndex((item) => item.classList.contains("is-active")),
    ).toBe(2);
  });

  it("rebuilds the list when the document changes", () => {
    const { outline, view } = render();
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "\n\n## Added later\n" },
    });
    outline.sync({ view, docChanged: true });

    expect(items().map((item) => item.title)).toContain("Added later");
  });

  it("only renders one outline root", () => {
    const { outline, view } = render();
    outline.render(view);
    expect(document.querySelectorAll(".richdown-outline-root")).toHaveLength(1);
  });

  it("ignores sync calls before it is rendered", () => {
    harness = createPreviewHarness({ doc: DOC });
    const outline = createOutlineNavigation();

    expect(() => outline.sync({ view: harness.view, docChanged: true })).not.toThrow();
    expect(outline.close()).toBe(false);
  });
});

describe("settings menu", () => {
  let settings;
  let postMessage;
  let refreshDecorations;
  let controller;

  beforeEach(() => {
    settings = { ...defaultPreviewSettings };
    postMessage = vi.fn();
    refreshDecorations = vi.fn();
    controller = createSettingsMenuController({
      getSettings: () => settings,
      postMessage,
      refreshDecorations,
    });
    controller.render();
  });

  function item(selector) {
    return document.querySelector(`.cm-settings-menu-item${selector}`);
  }

  function click(element) {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  it("renders a collapsed gear menu", () => {
    const menu = document.querySelector(".cm-settings-menu");
    expect(menu.hidden).toBe(true);
    expect(document.querySelector(".cm-settings-button").title).toBe(
      "Rich Editor settings",
    );
  });

  it("only renders one menu root", () => {
    controller.render();
    expect(document.querySelectorAll(".cm-settings-root")).toHaveLength(1);
  });

  it("opens and closes from the gear button", () => {
    const menu = document.querySelector(".cm-settings-menu");
    const button = document.querySelector(".cm-settings-button");

    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(menu.hidden).toBe(false);
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(menu.hidden).toBe(true);
  });

  it("lists every contributed option", () => {
    expect(document.querySelectorAll("[data-theme]")).toHaveLength(7);
    expect(document.querySelectorAll("[data-preview-width]")).toHaveLength(2);
    expect(document.querySelectorAll("[data-mermaid-size]")).toHaveLength(3);
  });

  it("shows the current preview toggles as On or Off", () => {
    expect(item("[data-toggle-table-preview]").textContent).toContain("On");
    settings.richTablePreview = false;
    controller.update();
    expect(item("[data-toggle-table-preview]").textContent).toContain("Off");
  });

  it("applies a theme and tells the extension host", () => {
    click(item('[data-theme="midnight"]'));

    expect(settings.richTheme).toBe("midnight");
    expect(document.documentElement.dataset.richTheme).toBe("midnight");
    expect(postMessage).toHaveBeenCalledWith({
      type: "setTheme",
      theme: "midnight",
    });
    expect(document.querySelector(".cm-settings-menu").hidden).toBe(true);
  });

  it("marks the active theme with a check", () => {
    click(item('[data-theme="paper"]'));
    expect(item('[data-theme="paper"]').textContent).toContain("✓");
    expect(item('[data-theme="paper"]').className).toContain("is-active");
  });

  it("applies the content width", () => {
    click(item('[data-preview-width="wide"]'));

    expect(settings.previewWidth).toBe("wide");
    expect(document.documentElement.dataset.previewWidth).toBe("wide");
    expect(postMessage).toHaveBeenCalledWith({
      type: "setPreviewWidth",
      value: "wide",
    });
  });

  it.each([
    ["[data-toggle-table-preview]", "richTablePreview", "setRichTablePreview"],
    ["[data-toggle-gherkin-preview]", "gherkinPreview", "setGherkinPreview"],
    ["[data-toggle-mermaid-preview]", "mermaidPreview", "setMermaidPreview"],
    [
      "[data-toggle-mermaid-colorized]",
      "mermaidColorized",
      "setMermaidColorized",
    ],
  ])("toggles %s and rebuilds the previews", (selector, key, messageType) => {
    click(item(selector));

    expect(settings[key]).toBe(false);
    expect(refreshDecorations).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ type: messageType, value: false });
  });

  it("changes the mermaid preview size", () => {
    click(item('[data-mermaid-size="large"]'));

    expect(settings.mermaidPreviewSize).toBe("large");
    expect(refreshDecorations).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      type: "setMermaidPreviewSize",
      value: "large",
    });
  });

  it("ignores a repeated action from the same click", () => {
    // pointerdown, mousedown and click all fire for one real click, so the
    // controller debounces identical actions.
    const toggle = item("[data-toggle-table-preview]");
    toggle.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    toggle.dispatchEvent(new Event("mousedown", { bubbles: true }));
    click(toggle);

    expect(settings.richTablePreview).toBe(false);
    expect(
      postMessage.mock.calls.filter(
        ([message]) => message.type === "setRichTablePreview",
      ),
    ).toHaveLength(1);
  });

  it("still allows a different action right after one", () => {
    click(item("[data-toggle-table-preview]"));
    click(item("[data-toggle-gherkin-preview]"));

    expect(settings.richTablePreview).toBe(false);
    expect(settings.gherkinPreview).toBe(false);
  });
});

describe("fallback editor", () => {
  function render(text = "# Title\n") {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const postMessage = vi.fn();
    const editor = createFallbackEditor({ root, postMessage });
    editor.render(text);
    return {
      editor,
      postMessage,
      textarea: root.querySelector("textarea"),
      root,
    };
  }

  it("explains why the rich preview is missing", () => {
    const { root } = render();
    expect(root.querySelector(".richdown-fallback-banner").textContent).toContain(
      "plain Markdown mode",
    );
  });

  it("shows the document text in a textarea", () => {
    const { textarea } = render("# Title\n\nbody");
    expect(textarea.value).toBe("# Title\n\nbody");
    expect(textarea.className).toBe("richdown-fallback-editor");
  });

  it("reports typing to the extension host", () => {
    const { textarea, postMessage } = render();
    textarea.value = "# Changed";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "edit",
      text: "# Changed",
    });
  });

  it("applies a host update without echoing it back", () => {
    const { editor, textarea, postMessage } = render("one");
    editor.applyUpdate("two");

    expect(textarea.value).toBe("two");
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("keeps the caret and scroll position across a host update", () => {
    const { editor, textarea } = render("hello world");
    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;
    textarea.scrollTop = 12;

    editor.applyUpdate("hello brave world");

    expect(textarea.selectionStart).toBe(5);
    expect(textarea.scrollTop).toBe(12);
  });

  it("clamps the caret when the document shrinks", () => {
    const { editor, textarea } = render("hello world");
    textarea.selectionStart = 11;
    textarea.selectionEnd = 11;

    editor.applyUpdate("hi");

    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(2);
  });

  it("ignores an identical or invalid update", () => {
    const { editor, textarea } = render("same");
    editor.applyUpdate("same");
    editor.applyUpdate(undefined);
    editor.applyUpdate(42);

    expect(textarea.value).toBe("same");
  });

  it("ignores an update before the editor is rendered", () => {
    const root = document.createElement("div");
    const editor = createFallbackEditor({ root, postMessage: vi.fn() });

    expect(() => editor.applyUpdate("text")).not.toThrow();
  });

  it("replaces previous content when rendered again", () => {
    const { editor, root } = render("first");
    editor.render("second");

    expect(root.querySelectorAll("textarea")).toHaveLength(1);
    expect(root.querySelector("textarea").value).toBe("second");
  });
});
