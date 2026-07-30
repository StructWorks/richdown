// Harness for the rich editor preview layer.
//
// The previews are CodeMirror decorations, so the tests build a real
// EditorState/EditorView (jsdom) with the real extension set. jsdom has no
// layout, so CodeMirror does not paint block widgets itself — the harness hands
// back the widget instances from the decoration sets and each test calls
// `widget.toDOM(view)` to inspect the DOM the editor would show.
import { markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GFM } from "@lezer/markdown";

import { codeLanguages } from "../../src/rich-editor/presentation/codemirror/language.js";
import { createPreviewExtensions } from "../../src/rich-editor/presentation/codemirror/previewExtensions.js";
import { createInlineMarkdownSupport } from "../../src/rich-editor/presentation/markdown/inlineMarkdown.js";

// Same language stack as richEditor.js: several decorations read the syntax tree,
// so they only behave realistically with Markdown (plus GFM and front matter)
// actually parsed.
const markdownLanguage = yamlFrontmatter({
  content: markdown({ extensions: GFM, codeLanguages }),
});

// jsdom performs no layout, so CodeMirror's coordinate lookups throw ("No tile
// at position"). Menus that position themselves next to the caret need them, so
// tests hand the view fixed coordinates instead.
export function stubViewLayout(view, rect = {}) {
  const coords = {
    left: 20,
    right: 24,
    top: 40,
    bottom: 56,
    ...rect,
  };
  view.coordsAtPos = () => coords;
  view.posAtCoords = () => 0;
  return view;
}

export const defaultPreviewSettings = {
  richTheme: "default",
  richTablePreview: true,
  mermaidPreview: true,
  mermaidColorized: true,
  mermaidPreviewSize: "readable",
  gherkinPreview: true,
  previewWidth: "default",
};

export function createPreviewHarness({
  doc = "",
  selection,
  settings = {},
  readOnly = false,
  mermaidScriptUri = "",
  attach = false,
  extraExtensions = [],
} = {}) {
  const calls = { postMessage: [], errors: [], measures: [] };
  const activeSettings = { ...defaultPreviewSettings, ...settings };

  const inline = createInlineMarkdownSupport({
    postMessage: (message) => calls.postMessage.push(message),
    requestEditorMeasure: (view) => calls.measures.push(view),
    resolveImageSource: (src) => Promise.resolve(src),
  });

  const preview = createPreviewExtensions({
    appendInlineMarkdown: inline.appendInlineMarkdown,
    findMarkdownImages: inline.findMarkdownImages,
    ImagePreviewWidget: inline.ImagePreviewWidget,
    isRangeInsideRanges: inline.isRangeInsideRanges,
    mermaidScriptUri,
    postMessage: (message) => calls.postMessage.push(message),
    reportError: (context, error) => calls.errors.push({ context, error }),
    requestEditorMeasure: (view) => calls.measures.push(view),
    getSettings: () => activeSettings,
  });

  // The view is deliberately left detached from the document by default:
  // CodeMirror would otherwise paint its own copy of each block widget, and a
  // test that inspects `document` (focus, context menus) could not tell the two
  // copies apart. Tests render the widget they care about with
  // `widget.toDOM(view)`. Pass `attach: true` when the code under test needs
  // real coordinates (`coordsAtPos`), which a detached view cannot provide.
  const view = new EditorView({
    ...(attach ? { parent: document.body } : {}),
    state: EditorState.create({
      doc,
      selection,
      extensions: [
        markdownLanguage,
        preview.extensions,
        extraExtensions,
        ...(readOnly ? [EditorState.readOnly.of(true)] : []),
      ],
    }),
  });

  function decorationSets() {
    return view.state
      .facet(EditorView.decorations)
      .map((entry) => (typeof entry === "function" ? entry(view) : entry))
      .filter(Boolean);
  }

  function entries() {
    const found = [];
    for (const set of decorationSets()) {
      set.between(0, view.state.doc.length, (from, to, value) => {
        found.push({
          from,
          to,
          spec: value.spec,
          widget: value.spec.widget ?? null,
          name: value.spec.widget?.constructor?.name ?? null,
          className: value.spec.class ?? null,
        });
      });
    }
    return found;
  }

  return {
    view,
    preview,
    calls,
    settings: activeSettings,
    setSettings(next) {
      Object.assign(activeSettings, next);
    },
    entries,
    widgetNames() {
      return entries()
        .map((entry) => entry.name)
        .filter(Boolean);
    },
    widget(name) {
      return entries().find((entry) => entry.name === name)?.widget ?? null;
    },
    widgetEntry(name) {
      return entries().find((entry) => entry.name === name) ?? null;
    },
    lineClasses() {
      return entries()
        .filter((entry) => entry.className)
        .map((entry) => entry.className);
    },
    text() {
      return view.state.doc.toString();
    },
    destroy() {
      view.destroy();
      view.dom.remove();
    },
  };
}
