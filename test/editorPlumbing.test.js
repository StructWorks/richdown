// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSearchQuery, SearchQuery } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import hljs from "highlight.js";

import { applySettingsPatch } from "../src/rich-editor/application/settingsUseCases.js";
import { createVsCodeWebviewPort } from "../src/rich-editor/adapters/vscodeWebviewPort.js";
import { findLinkAtClick } from "../src/rich-editor/presentation/codemirror/links.js";
import {
  createSearchExtensions,
  getSearchKeymap,
  installSearchShortcut,
} from "../src/rich-editor/presentation/search/searchExtensions.js";
import {
  applyTheme as applyDiffTheme,
  normalizeSettings as normalizeDiffSettings,
} from "../src/rich-diff/presentation/theme.js";
import { tomlLanguage } from "../src/rich-diff/presentation/highlight/tomlLanguage.js";
import { defaultPreviewSettings } from "./helpers/previewHarness.js";

const views = [];

function mountView(doc, extensions = [], { attach = true } = {}) {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions }),
    ...(attach ? { parent: document.body } : {}),
  });
  views.push(view);
  return view;
}

afterEach(() => {
  for (const view of views.splice(0)) {
    view.destroy();
  }
  document.body.replaceChildren();
  document.documentElement.removeAttribute("style");
  delete document.documentElement.dataset.richTheme;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("vscode webview port", () => {
  it("forwards messages to the host when one is available", () => {
    const postMessage = vi.fn();
    createVsCodeWebviewPort({ postMessage }).postMessage({ type: "edit" });

    expect(postMessage).toHaveBeenCalledWith({ type: "edit" });
  });

  it("opens links in a new tab when there is no host (HTML export)", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);

    createVsCodeWebviewPort(null).postMessage({
      type: "openLink",
      href: "https://example.com",
    });

    expect(open).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("drops other messages when there is no host", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);

    const port = createVsCodeWebviewPort(undefined);
    port.postMessage({ type: "edit", text: "x" });
    port.postMessage({ type: "openLink" });

    expect(open).not.toHaveBeenCalled();
  });

  it("ignores a host object without postMessage", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);

    createVsCodeWebviewPort({}).postMessage({
      type: "openLink",
      href: "https://example.com",
    });

    expect(open).toHaveBeenCalled();
  });
});

describe("applySettingsPatch", () => {
  it("merges a patch over the current settings", () => {
    const { settings } = applySettingsPatch(defaultPreviewSettings, {
      richTheme: "forest",
    });

    expect(settings.richTheme).toBe("forest");
    expect(settings.richTablePreview).toBe(true);
  });

  it("reports that previews must be rebuilt for a preview toggle", () => {
    const { previewChanged } = applySettingsPatch(defaultPreviewSettings, {
      mermaidPreview: false,
    });
    expect(previewChanged).toBe(true);
  });

  it("reports no rebuild for a styling-only change", () => {
    expect(
      applySettingsPatch(defaultPreviewSettings, { richTheme: "paper" })
        .previewChanged,
    ).toBe(false);
    expect(
      applySettingsPatch(defaultPreviewSettings, { previewWidth: "wide" })
        .previewChanged,
    ).toBe(false);
  });

  it("normalizes unknown values in the patch", () => {
    const { settings } = applySettingsPatch(defaultPreviewSettings, {
      mermaidPreviewSize: "gigantic",
      previewWidth: "full",
    });

    expect(settings.mermaidPreviewSize).toBe("readable");
    expect(settings.previewWidth).toBe("default");
  });

  it("returns the current settings for an empty patch", () => {
    const { settings, previewChanged } = applySettingsPatch(
      defaultPreviewSettings,
    );

    expect(settings).toEqual(defaultPreviewSettings);
    expect(previewChanged).toBe(false);
  });
});

describe("rich diff theme", () => {
  it("keeps a known theme and rejects anything else", () => {
    expect(normalizeDiffSettings({ richTheme: "midnight" })).toEqual({
      richTheme: "midnight",
    });
    expect(normalizeDiffSettings({ richTheme: "neon" })).toEqual({
      richTheme: "default",
    });
    expect(normalizeDiffSettings()).toEqual({ richTheme: "default" });
  });

  it("writes the palette as CSS variables", () => {
    applyDiffTheme("forest");

    expect(document.documentElement.dataset.richTheme).toBe("forest");
    expect(
      document.documentElement.style.getPropertyValue("--rip-bg"),
    ).not.toBe("");
    expect(
      document.documentElement.style.getPropertyValue("--rip-input-bg"),
    ).not.toBe("");
  });

  it("falls back to the VS Code palette for the default theme", () => {
    applyDiffTheme(undefined);

    expect(document.documentElement.dataset.richTheme).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--rip-bg")).toBe(
      "var(--vscode-editor-background)",
    );
  });
});

describe("toml highlight definition", () => {
  // The rich diff registers this grammar with the real highlight.js, so the
  // definition is exercised through highlight.js itself.
  const language = hljs.getLanguage("richdown-toml")
    ? undefined
    : hljs.registerLanguage("richdown-toml", tomlLanguage);

  function highlight(code) {
    return hljs.highlight(code, {
      language: "richdown-toml",
      ignoreIllegals: true,
    }).value;
  }

  it("names itself TOML and answers to the toml alias", () => {
    const definition = tomlLanguage(hljs);
    expect(definition.name).toBe("TOML");
    expect(definition.aliases).toContain("toml");
  });

  it("highlights a table header", () => {
    expect(highlight("[server.http]")).toContain("hljs-section");
  });

  it("highlights keys and string values", () => {
    const html = highlight('name = "richdown"');
    expect(html).toContain("hljs-attr");
    expect(html).toContain("hljs-string");
  });

  it("highlights numbers, booleans and comments", () => {
    expect(highlight("port = 8080")).toContain("hljs-number");
    expect(highlight("debug = true")).toContain("hljs-literal");
    expect(highlight("# a comment")).toContain("hljs-comment");
  });

  it("highlights a quoted and dotted key", () => {
    expect(highlight('"quoted key" = 1')).toContain("hljs-attr");
    expect(highlight("a.b.c = 1")).toContain("hljs-attr");
  });

  it("leaves plain text unhighlighted", () => {
    expect(highlight("just words")).not.toContain("hljs-");
    expect(language).toBeUndefined();
  });
});

describe("search extensions", () => {
  it("provides the CodeMirror search keymap", () => {
    expect(Array.isArray(getSearchKeymap())).toBe(true);
    expect(getSearchKeymap().length).toBeGreaterThan(0);
  });

  it("highlights every match of the active query", () => {
    const view = mountView("alpha beta alpha\nalpha\n", createSearchExtensions());
    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: "alpha" })),
    });

    expect(
      view.dom.querySelectorAll(".cm-richdown-search-match").length,
    ).toBeGreaterThan(0);
  });

  it("highlights nothing without a query", () => {
    const view = mountView("alpha beta\n", createSearchExtensions());
    expect(view.dom.querySelectorAll(".cm-richdown-search-match")).toHaveLength(0);
  });

  it("opens the search panel on the platform shortcut", () => {
    const view = mountView("text", createSearchExtensions());
    const closeSlashCommandMenu = vi.fn();
    const closeTableContextMenu = vi.fn();
    installSearchShortcut({
      getView: () => view,
      closeSlashCommandMenu,
      closeTableContextMenu,
    });

    const event = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(closeSlashCommandMenu).toHaveBeenCalled();
    expect(closeTableContextMenu).toHaveBeenCalled();
    expect(view.dom.querySelector(".cm-search")).toBeTruthy();
  });

  it("ignores the shortcut with extra modifiers or without a view", () => {
    const view = mountView("text", createSearchExtensions());
    const closeSlashCommandMenu = vi.fn();
    installSearchShortcut({
      getView: () => null,
      closeSlashCommandMenu,
      closeTableContextMenu: vi.fn(),
    });
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true }),
    );
    expect(closeSlashCommandMenu).not.toHaveBeenCalled();

    const withShift = vi.fn();
    installSearchShortcut({
      getView: () => view,
      closeSlashCommandMenu: withShift,
      closeTableContextMenu: vi.fn(),
    });
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "f",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(withShift).not.toHaveBeenCalled();
  });
});

describe("findLinkAtClick", () => {
  // jsdom has no layout, so the view is given deterministic coordinates: the
  // click always lands inside the range the test targets.
  // One document character is modelled as one horizontal pixel, so a click at
  // x = offset lands on that character.
  function viewFor(doc, position) {
    const view = mountView(doc, [], { attach: false });
    view.posAtCoords = () => position;
    view.coordsAtPos = (pos) => ({
      left: pos,
      right: pos + 1,
      top: 0,
      bottom: 10,
    });
    return view;
  }

  function clickAt(view, position, target = document.createElement("span")) {
    return findLinkAtClick(view, {
      clientX: position,
      clientY: 5,
      target,
    });
  }

  it("finds an inline link by its visible label", () => {
    const doc = "see [docs](https://example.com/a) here";
    const position = doc.indexOf("docs");
    const view = viewFor(doc, position);

    expect(clickAt(view, position)).toEqual({
      href: "https://example.com/a",
      position,
    });
  });

  it("finds a bare URL", () => {
    const doc = "read https://example.com/x now";
    const position = doc.indexOf("https");
    const view = viewFor(doc, position);

    expect(clickAt(view, position).href).toBe("https://example.com/x");
  });

  it("ignores an image", () => {
    const doc = "![alt](img.png)";
    const position = doc.indexOf("alt");

    expect(clickAt(viewFor(doc, position), position)).toBeNull();
  });

  it("ignores a click outside any link", () => {
    const doc = "plain text with no links";

    expect(clickAt(viewFor(doc, 3), 3)).toBeNull();
  });

  it("ignores a click on an image preview widget", () => {
    const doc = "see [docs](https://example.com/a)";
    const position = doc.indexOf("docs");
    const view = viewFor(doc, position);
    const wrapper = document.createElement("span");
    wrapper.className = "cm-image-preview";
    const target = document.createElement("img");
    wrapper.appendChild(target);
    document.body.appendChild(wrapper);

    expect(clickAt(view, position, target)).toBeNull();
  });

  it("returns nothing when the position cannot be resolved", () => {
    const view = mountView("see [docs](https://example.com/a)", [], {
      attach: false,
    });
    view.posAtCoords = () => null;

    expect(clickAt(view, 5)).toBeNull();
  });

  it("uses the source range when the caret is on the link's line", () => {
    // With the line focused the whole "[docs](url)" text is clickable, including
    // the target, because the markers stay visible while editing.
    const doc = "see [docs](https://example.com/a)";
    const position = doc.indexOf("https");
    const view = viewFor(doc, position);
    view.dispatch({ selection: { anchor: 1 } });

    expect(clickAt(view, position).href).toBe("https://example.com/a");
  });

  it("does not hit the hidden link target while the line is unfocused", () => {
    // An unfocused line hides the "(target)" part, so only the label is clickable.
    const doc = ["see [docs](notes.md)", "", "second line"].join("\n");
    const position = doc.indexOf("notes.md");
    const view = viewFor(doc, position);
    view.dispatch({ selection: { anchor: doc.length } });

    expect(clickAt(view, position)).toBeNull();
  });

  it("hits the link target once the line is focused", () => {
    const doc = ["see [docs](notes.md)", "", "second line"].join("\n");
    const position = doc.indexOf("notes.md");
    const view = viewFor(doc, position);
    view.dispatch({ selection: { anchor: 1 } });

    expect(clickAt(view, position).href).toBe("notes.md");
  });
});
