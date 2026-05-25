import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import {
  HighlightStyle,
  LanguageDescription,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import {
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
} from "@codemirror/search";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { GFM } from "@lezer/markdown";

const vscode = acquireVsCodeApi();
const root = document.querySelector("#editor");
const initialDocument = JSON.parse(
  document.querySelector("#initial-document").textContent,
);
const initialSettings = JSON.parse(
  document.querySelector("#initial-settings").textContent,
);
const mermaidScriptUri = JSON.parse(
  document.querySelector("#mermaid-script-uri").textContent,
);

let applyingExternalUpdate = false;
let mermaidLoadPromise = null;
let imageRequestId = 0;
const pendingImageRequests = new Map();
let slashCommandMenu = null;
let tableContextMenu = null;
let previewDecorationRevision = 0;
let lastSettingsMenuActionKey = "";
let lastSettingsMenuActionTime = 0;
const mermaidPreviewSizes = ["source", "readable", "large"];
const previewWidths = ["default", "wide"];
let settings = normalizeRichEditorSettings(initialSettings);

applyTheme(settings.richTheme);
applyPreviewWidth(settings.previewWidth);
injectStyles();

const codeLanguages = [
  LanguageDescription.of({
    name: "JSON",
    alias: ["json", "jsonc"],
    extensions: ["json", "jsonc"],
    support: json(),
  }),
  LanguageDescription.of({
    name: "JavaScript",
    alias: ["js", "javascript", "mjs", "cjs", "jsx"],
    extensions: ["js", "mjs", "cjs", "jsx"],
    support: javascript({ jsx: true }),
  }),
  LanguageDescription.of({
    name: "TypeScript",
    alias: ["ts", "typescript", "tsx"],
    extensions: ["ts", "tsx"],
    support: javascript({ typescript: true, jsx: true }),
  }),
  LanguageDescription.of({
    name: "CSS",
    alias: ["css"],
    extensions: ["css"],
    support: css(),
  }),
  LanguageDescription.of({
    name: "HTML",
    alias: ["html", "xml", "svg"],
    extensions: ["html", "htm", "xml", "svg"],
    support: html(),
  }),
];

function normalizeRichEditorSettings(nextSettings = {}) {
  return {
    richTheme: nextSettings.richTheme || "default",
    showEmptyLineHint: nextSettings.showEmptyLineHint !== false,
    richTablePreview: nextSettings.richTablePreview !== false,
    mermaidPreview: nextSettings.mermaidPreview !== false,
    mermaidPreviewSize: normalizeMermaidPreviewSize(
      nextSettings.mermaidPreviewSize,
    ),
    previewWidth: normalizePreviewWidth(nextSettings.previewWidth),
  };
}

function normalizeMermaidPreviewSize(value) {
  return mermaidPreviewSizes.includes(value) ? value : "readable";
}

function normalizePreviewWidth(value) {
  return previewWidths.includes(value) ? value : "default";
}

function hasPreviewSettingChanged(previousSettings, nextSettings) {
  return (
    previousSettings.richTablePreview !== nextSettings.richTablePreview ||
    previousSettings.mermaidPreview !== nextSettings.mermaidPreview ||
    previousSettings.mermaidPreviewSize !== nextSettings.mermaidPreviewSize
  );
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--rip-heading)", fontWeight: "780" },
  {
    tag: [tags.link, tags.url],
    color: "var(--rip-link)",
    textDecoration: "underline",
  },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  {
    tag: [
      tags.keyword,
      tags.operatorKeyword,
      tags.controlKeyword,
      tags.definitionKeyword,
    ],
    color: "var(--rip-syntax-purple)",
  },
  {
    tag: [tags.atom, tags.bool, tags.null, tags.labelName],
    color: "var(--rip-syntax-orange)",
  },
  {
    tag: [tags.number, tags.integer, tags.float, tags.literal],
    color: "var(--rip-syntax-green)",
  },
  {
    tag: [tags.string, tags.character, tags.attributeValue],
    color: "var(--rip-syntax-orange)",
  },
  {
    tag: [tags.variableName, tags.propertyName, tags.attributeName],
    color: "var(--rip-syntax-blue)",
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.tagName],
    color: "var(--rip-syntax-purple)",
  },
  {
    tag: [tags.comment, tags.docComment],
    color: "var(--rip-muted)",
    fontStyle: "italic",
  },
  {
    tag: [tags.punctuation, tags.bracket, tags.separator],
    color: "var(--rip-muted)",
  },
  { tag: tags.invalid, color: "var(--rip-danger)" },
]);

function reportRichdownError(context, error) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : "";
  console.error(`[Richdown] ${context}`, error);
  vscode.postMessage({
    type: "webviewError",
    context,
    message,
    stack,
  });
}

function safeBuildDecorations(context, build) {
  try {
    return build();
  } catch (error) {
    reportRichdownError(context, error);
    return Decoration.none;
  }
}

function safeBuildDetailsDecorationState(state, openStates, activeEdit) {
  try {
    return buildDetailsDecorationState(state, openStates, activeEdit);
  } catch (error) {
    reportRichdownError("details-preview", error);
    return {
      activeEdit: null,
      openStates,
      decorations: Decoration.none,
    };
  }
}

function safeBuildTableDecorationState(state, activeEdit) {
  try {
    return buildTableDecorationState(state, activeEdit);
  } catch (error) {
    reportRichdownError("table-preview", error);
    return {
      activeEdit: null,
      decorations: Decoration.none,
    };
  }
}

function safeBuildMermaidDecorationState(state, activeEdit) {
  try {
    return buildMermaidDecorationState(state, activeEdit);
  } catch (error) {
    reportRichdownError("mermaid-preview", error);
    return {
      activeEdit: null,
      decorations: Decoration.none,
    };
  }
}

const blockLineDecorations = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = safeBuildDecorations("block-line-decorations", () =>
        buildBlockLineDecorations(view),
      );
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = safeBuildDecorations("block-line-decorations", () =>
          buildBlockLineDecorations(update.view),
        );
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

const inlineDecorations = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = safeBuildDecorations("inline-decorations", () =>
        buildInlineDecorations(view),
      );
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = safeBuildDecorations("inline-decorations", () =>
          buildInlineDecorations(update.view),
        );
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

const toggleDetailsPreview = StateEffect.define();
const refreshPreviewDecorations = StateEffect.define();

const setActiveDetailsEdit = StateEffect.define({
  map(value, changes) {
    if (!value) {
      return null;
    }
    return {
      from: changes.mapPos(value.from),
      to: changes.mapPos(value.to),
    };
  },
});

const detailsDecorationField = StateField.define({
  create(state) {
    return safeBuildDetailsDecorationState(state, new Map(), null);
  },

  update(value, transaction) {
    let openStates = value.openStates;
    let activeEdit = value.activeEdit;
    let shouldRebuild = transaction.docChanged || transaction.selection;

    if (activeEdit && transaction.docChanged) {
      activeEdit = {
        from: transaction.changes.mapPos(activeEdit.from),
        to: transaction.changes.mapPos(activeEdit.to),
      };
      shouldRebuild = true;
    }

    for (const effect of transaction.effects) {
      if (effect.is(toggleDetailsPreview)) {
        openStates = new Map(openStates);
        openStates.set(effect.value.key, effect.value.open);
        shouldRebuild = true;
      }
      if (effect.is(setActiveDetailsEdit)) {
        activeEdit = effect.value;
        shouldRebuild = true;
      }
    }

    if (
      activeEdit &&
      !selectionInsideRange(
        transaction.state.selection,
        activeEdit.from,
        activeEdit.to,
      )
    ) {
      activeEdit = null;
      shouldRebuild = true;
    }

    if (!shouldRebuild) {
      return value;
    }

    return safeBuildDetailsDecorationState(
      transaction.state,
      openStates,
      activeEdit,
    );
  },

  provide: (field) =>
    EditorView.decorations.from(field, (value) => value.decorations),
});

const setActiveTableEdit = StateEffect.define({
  map(value, changes) {
    if (!value) {
      return null;
    }
    return {
      from: changes.mapPos(value.from),
      to: changes.mapPos(value.to),
    };
  },
});

const tableDecorationField = StateField.define({
  create(state) {
    return safeBuildTableDecorationState(state, null);
  },

  update(value, transaction) {
    let activeEdit = value.activeEdit;
    let editChanged = false;

    if (activeEdit && transaction.docChanged) {
      activeEdit = {
        from: transaction.changes.mapPos(activeEdit.from),
        to: transaction.changes.mapPos(activeEdit.to),
      };
      editChanged = true;
    }

    for (const effect of transaction.effects) {
      if (effect.is(setActiveTableEdit)) {
        activeEdit = effect.value;
        editChanged = true;
      }
      if (effect.is(refreshPreviewDecorations)) {
        editChanged = true;
      }
    }

    if (
      activeEdit &&
      !selectionInsideRange(
        transaction.state.selection,
        activeEdit.from,
        activeEdit.to,
      )
    ) {
      activeEdit = null;
      editChanged = true;
    }

    if (!transaction.docChanged && !transaction.selection && !editChanged) {
      return value;
    }

    return safeBuildTableDecorationState(transaction.state, activeEdit);
  },

  provide: (field) =>
    EditorView.decorations.from(field, (value) => value.decorations),
});

const setActiveMermaidEdit = StateEffect.define({
  map(value, changes) {
    if (!value) {
      return null;
    }
    return {
      from: changes.mapPos(value.from),
      to: changes.mapPos(value.to),
    };
  },
});

const mermaidDecorationField = StateField.define({
  create(state) {
    return safeBuildMermaidDecorationState(state, null);
  },

  update(value, transaction) {
    let activeEdit = value.activeEdit;
    let editChanged = false;

    if (activeEdit && transaction.docChanged) {
      activeEdit = {
        from: transaction.changes.mapPos(activeEdit.from),
        to: transaction.changes.mapPos(activeEdit.to),
      };
      editChanged = true;
    }

    for (const effect of transaction.effects) {
      if (effect.is(setActiveMermaidEdit)) {
        activeEdit = effect.value;
        editChanged = true;
      }
      if (effect.is(refreshPreviewDecorations)) {
        editChanged = true;
      }
    }

    if (
      activeEdit &&
      !selectionInsideRange(
        transaction.state.selection,
        activeEdit.from,
        activeEdit.to,
      )
    ) {
      activeEdit = null;
      editChanged = true;
    }

    if (!transaction.docChanged && !transaction.selection && !editChanged) {
      return value;
    }

    return safeBuildMermaidDecorationState(transaction.state, activeEdit);
  },

  provide: (field) =>
    EditorView.decorations.from(field, (value) => value.decorations),
});

const taskCheckboxes = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = safeBuildDecorations("task-checkboxes", () =>
        buildTaskCheckboxes(view),
      );
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = safeBuildDecorations("task-checkboxes", () =>
          buildTaskCheckboxes(update.view),
        );
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

const codeBlockCopyButtons = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = safeBuildDecorations("code-copy-buttons", () =>
        buildCodeBlockCopyButtons(view),
      );
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = safeBuildDecorations("code-copy-buttons", () =>
          buildCodeBlockCopyButtons(update.view),
        );
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

const slashCommands = [
  {
    label: "Heading 1",
    description: "Large section heading",
    insert: "# ",
    cursor: 2,
  },
  {
    label: "Heading 2",
    description: "Medium section heading",
    insert: "## ",
    cursor: 3,
  },
  {
    label: "Heading 3",
    description: "Small section heading",
    insert: "### ",
    cursor: 4,
  },
  {
    label: "Bullet list",
    description: "Unordered list item",
    insert: "- ",
    cursor: 2,
  },
  {
    label: "Numbered list",
    description: "Ordered list item",
    insert: "1. ",
    cursor: 3,
  },
  {
    label: "Task list",
    description: "Unchecked task item",
    insert: "- [ ] ",
    cursor: 6,
  },
  {
    label: "Quote",
    description: "Block quote",
    insert: "> ",
    cursor: 2,
  },
  {
    label: "Code block",
    description: "Fenced code block",
    insert: "```\n\n```",
    cursor: 4,
  },
  {
    label: "Mermaid",
    description: "Diagram block",
    insert: "```mermaid\n\n```",
    cursor: 11,
  },
  {
    label: "Table",
    description: "Three-column table",
    insert: "| Column | Column | Column |\n| --- | --- | --- |\n|  |  |  |",
    cursor: 2,
  },
  {
    label: "Details",
    description: "Collapsible section",
    insert: "<details>\n<summary>Details</summary>\n\n</details>",
    cursor: 37,
  },
];

const slashCommandKeymap = [
  {
    key: "/",
    run(view) {
      return triggerSlashCommandMenu(view);
    },
  },
  {
    key: "ArrowDown",
    run() {
      return moveSlashCommandMenu(1);
    },
    preventDefault: true,
  },
  {
    key: "ArrowUp",
    run() {
      return moveSlashCommandMenu(-1);
    },
    preventDefault: true,
  },
  {
    key: "Enter",
    run() {
      return acceptSlashCommandMenu();
    },
    preventDefault: true,
  },
  {
    key: "Tab",
    run() {
      return acceptSlashCommandMenu();
    },
    preventDefault: true,
  },
  {
    key: "Escape",
    run() {
      return closeSlashCommandMenu();
    },
    preventDefault: true,
  },
];

let view;
let fallbackTextarea = null;
let outlineRoot = null;
let outlineButton = null;
let outlinePanel = null;
let outlineList = null;
let outlineHeadings = [];

window.addEventListener(
  "keydown",
  (event) => {
    if (!view || !isSearchShortcut(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    closeSlashCommandMenu();
    closeTableContextMenu();
    openSearchPanel(view);
  },
  true,
);

queueMicrotask(() => {
  try {
    view = new EditorView({
      parent: root,
      state: EditorState.create({
        doc: initialDocument,
        extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        search({ top: true }),
        highlightSelectionMatches({
          highlightWordAroundCursor: true,
          minSelectionLength: 2,
        }),
        syntaxHighlighting(markdownHighlightStyle),
        markdown({
          extensions: GFM,
          codeLanguages,
        }),
        detailsDecorationField,
        tableDecorationField,
        mermaidDecorationField,
        blockLineDecorations,
        codeBlockCopyButtons,
        inlineDecorations,
        taskCheckboxes,
        EditorView.domEventHandlers({
          blur(event, view) {
            closeSlashCommandMenu();
            exitDetailsEditMode(view, true);
            exitTableEditMode(view, true);
            exitMermaidEditMode(view, true);
            return false;
          },
          mousedown(event, view) {
            if (event.button !== 0 || event.metaKey || event.ctrlKey) {
              return false;
            }
            const linkTarget = findLinkAtClick(view, event);
            if (!linkTarget) {
              return false;
            }
            const line = view.state.doc.lineAt(linkTarget.position);
            if (isLineFocused(view.state, line)) {
              return false;
            }
            event.preventDefault();
            return true;
          },
          click(event, view) {
            const linkTarget = findLinkAtClick(view, event);
            if (!linkTarget) {
              return false;
            }

            const line = view.state.doc.lineAt(linkTarget.position);
            const linkNeedsModifier = isLineFocused(view.state, line);
            if (linkNeedsModifier && !event.metaKey && !event.ctrlKey) {
              return false;
            }

            event.preventDefault();
            vscode.postMessage({ type: "openLink", href: linkTarget.href });
            return true;
          },
        }),
        keymap.of([
          indentWithTab,
          ...slashCommandKeymap,
          ...searchKeymap,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          syncSlashCommandMenu(update);
          syncOutlineNavigation(update);
          if (!update.docChanged || applyingExternalUpdate) {
            return;
          }
          vscode.postMessage({
            type: "edit",
            text: update.state.doc.toString(),
          });
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            color: "var(--rip-fg)",
            backgroundColor: "var(--rip-bg)",
            fontSize: "15px",
          },
          ".cm-scroller": {
            fontFamily:
              "var(--vscode-editor-font-family, var(--vscode-font-family))",
            lineHeight: "1.72",
            overflow: "auto",
          },
          ".cm-content": {
            maxWidth: "var(--rip-content-max-width, 960px)",
            minHeight: "100%",
            margin: "0 auto",
            padding: "28px clamp(18px, 5vw, 64px) 72px",
            caretColor: "var(--rip-caret)",
          },
          "&.cm-focused": { outline: "none" },
          "&.cm-focused .cm-cursor": {
            borderLeftColor: "var(--rip-caret)",
            borderLeftWidth: "2px",
          },
          ".cm-gutters": {
            color: "var(--rip-muted)",
            backgroundColor: "var(--rip-bg)",
            borderRight: "1px solid var(--rip-border)",
          },
          ".cm-activeLineGutter": {
            color: "var(--rip-heading)",
            backgroundColor: "var(--rip-hover)",
          },
          ".cm-activeLine": {
            backgroundColor: "var(--rip-hover)",
          },
          ".cm-panels": {
            color: "var(--rip-fg)",
            backgroundColor: "var(--rip-panel)",
            borderColor: "var(--rip-border)",
            fontFamily: "var(--vscode-font-family)",
          },
          ".cm-panel.cm-search": {
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "6px",
            padding: "8px 34px 8px 10px",
            borderBottom: "1px solid var(--rip-border)",
          },
          ".cm-panel.cm-search input.cm-textfield": {
            minWidth: "180px",
            height: "28px",
            boxSizing: "border-box",
            border: "1px solid var(--rip-border)",
            borderRadius: "5px",
            padding: "3px 7px",
            color: "var(--rip-fg)",
            backgroundColor: "var(--rip-input-bg)",
            font: "13px var(--vscode-font-family)",
            outline: "none",
          },
          ".cm-panel.cm-search input.cm-textfield:focus": {
            borderColor: "var(--rip-focus)",
          },
          ".cm-panel.cm-search button": {
            minHeight: "26px",
            appearance: "none",
            border: "1px solid var(--rip-border)",
            borderRadius: "5px",
            padding: "2px 8px",
            color: "var(--rip-fg)",
            backgroundColor: "var(--rip-input-bg)",
            backgroundImage: "none",
            boxShadow: "none",
            font: "12px var(--vscode-font-family)",
            cursor: "pointer",
          },
          ".cm-panel.cm-search button[name=next], .cm-panel.cm-search button[name=prev]":
            {
              color: "var(--rip-button-fg)",
              borderColor: "var(--rip-accent)",
              backgroundColor: "var(--rip-accent)",
            },
          ".cm-panel.cm-search button:hover": {
            borderColor: "var(--rip-focus)",
            backgroundColor: "var(--rip-hover)",
            color: "var(--rip-fg)",
          },
          ".cm-panel.cm-search button[name=next]:hover, .cm-panel.cm-search button[name=prev]:hover":
            {
              color: "var(--rip-button-fg)",
              borderColor: "var(--rip-focus)",
              backgroundColor:
                "color-mix(in srgb, var(--rip-accent) 86%, var(--rip-bg))",
            },
          ".cm-panel.cm-search input[type=checkbox]": {
            accentColor: "var(--rip-accent)",
          },
          ".cm-panel.cm-search [name=close]": {
            top: "8px",
            right: "9px",
            width: "24px",
            height: "24px",
            border: "0",
            color: "var(--rip-muted)",
            backgroundColor: "transparent",
            backgroundImage: "none",
            fontSize: "17px",
          },
          ".cm-panel.cm-search [name=close]:hover": {
            color: "var(--rip-heading)",
            backgroundColor: "var(--rip-hover)",
          },
          ".cm-panel.cm-search label": {
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            color: "var(--rip-muted)",
            fontSize: "12px",
          },
          ".cm-searchMatch": {
            backgroundColor:
              "color-mix(in srgb, var(--rip-syntax-orange) 38%, transparent)",
            outline: "1px solid color-mix(in srgb, var(--rip-syntax-orange) 45%, transparent)",
          },
          ".cm-searchMatch-selected": {
            backgroundColor:
              "color-mix(in srgb, var(--rip-heading) 46%, transparent)",
            outline: "1px solid var(--rip-heading)",
          },
          ".cm-selectionMatch": {
            backgroundColor:
              "color-mix(in srgb, var(--rip-link) 24%, transparent)",
          },
          ".cm-content ::selection": {
            backgroundColor:
              "color-mix(in srgb, var(--rip-link) 42%, transparent)",
          },
          ".cm-heading-line": {
            fontWeight: "780",
            lineHeight: "1.38",
          },
          ".cm-heading-1": {
            color: "var(--rip-heading)",
            fontSize: "2.12rem",
            borderBottom: "1px solid var(--rip-border)",
            paddingBottom: "0.12em",
          },
          ".cm-heading-2": {
            fontSize: "1.62rem",
            borderBottom: "1px solid var(--rip-border)",
            paddingBottom: "0.08em",
          },
          ".cm-heading-3": { fontSize: "1.32rem" },
          ".cm-heading-4": { fontSize: "1.15rem" },
          ".cm-heading-5": {
            color: "var(--rip-muted)",
            fontSize: "1rem",
            textTransform: "uppercase",
          },
          ".cm-heading-6": {
            color: "var(--rip-muted)",
            fontSize: "0.96rem",
            fontStyle: "italic",
          },
          ".cm-markdown-marker": {
            color: "var(--rip-muted)",
            fontSize: "0",
            opacity: "0",
          },
          ".cm-line.cm-activeLine .cm-markdown-marker": {
            fontSize: "inherit",
            opacity: "0.9",
          },
          ".cm-quote-line": {
            color: "var(--rip-muted)",
            borderLeft: "4px solid var(--rip-quote-border)",
            paddingLeft: "0.8em",
          },
          ".cm-line.cm-activeLine.cm-quote-line": { color: "var(--rip-fg)" },
          ".cm-link": {
            color: "var(--rip-link)",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          },
          ".cm-line:not(.cm-activeLine) .cm-link": {
            cursor: "pointer",
          },
          ".cm-inline-code": {
            border: "1px solid var(--rip-border)",
            borderRadius: "4px",
            padding: "0 0.26em",
            backgroundColor:
              "color-mix(in srgb, var(--rip-code-bg) 74%, transparent)",
          },
          ".cm-list-line": {
            position: "relative",
          },
          ".cm-list-marker": {
            minWidth: "1.7em",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginRight: "0.15em",
            color: "var(--rip-muted)",
            fontFamily: "var(--vscode-font-family)",
            fontWeight: "700",
            fontVariantNumeric: "tabular-nums",
          },
          ".cm-list-marker.is-unordered": {
            color: "var(--rip-heading)",
          },
          ".cm-list-marker.is-ordered": {
            minWidth: "2.2em",
            justifyContent: "flex-end",
            paddingRight: "0.25em",
            color: "var(--rip-muted)",
            fontSize: "0.92em",
          },
          ".cm-list-depth-1 .cm-list-marker.is-unordered": {
            color: "var(--rip-link)",
          },
          ".cm-list-depth-2 .cm-list-marker.is-unordered": {
            color: "var(--rip-syntax-green)",
          },
          ".cm-image-preview": {
            maxWidth: "100%",
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "6px",
            margin: "0",
            verticalAlign: "top",
            cursor: "text",
          },
          ".cm-image-preview img": {
            width: "auto",
            height: "auto",
            maxWidth: "min(100%, 720px)",
            maxHeight: "460px",
            display: "block",
            border: "1px solid var(--rip-border)",
            borderRadius: "8px",
            backgroundColor: "var(--rip-panel)",
            aspectRatio: "auto",
            objectFit: "contain",
          },
          ".cm-image-preview-caption": {
            color: "var(--rip-muted)",
            font: "12px var(--vscode-font-family)",
          },
          ".cm-image-preview-error": {
            maxWidth: "100%",
            border: "1px solid var(--rip-border)",
            borderRadius: "6px",
            padding: "6px 8px",
            color: "var(--rip-muted)",
            backgroundColor: "var(--rip-panel)",
            font: "12px var(--vscode-font-family)",
          },
          ".cm-details-preview": {
            display: "block",
            boxSizing: "border-box",
            maxWidth: "100%",
            margin: "0",
            border: "1px solid var(--rip-border)",
            borderRadius: "8px",
            overflow: "hidden",
            color: "var(--rip-fg)",
            backgroundColor: "var(--rip-panel)",
          },
          ".cm-details-preview.cm-widgetBuffer": {
            display: "none",
          },
          ".cm-details-summary": {
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            border: "0",
            padding: "8px 10px",
            color: "var(--rip-heading)",
            backgroundColor:
              "color-mix(in srgb, var(--rip-panel) 86%, var(--rip-bg))",
            font: "700 14px var(--vscode-font-family)",
            textAlign: "left",
            cursor: "pointer",
          },
          ".cm-details-disclosure": {
            width: "1.2em",
            display: "inline-grid",
            placeItems: "center",
            color: "var(--rip-muted)",
            fontSize: "13px",
          },
          ".cm-details-body": {
            display: "grid",
            gap: "6px",
            borderTop: "1px solid var(--rip-border)",
            padding: "8px 10px 10px",
          },
          ".cm-details-body-line": {
            margin: "0",
            lineHeight: "1.55",
          },
          ".cm-codeblock-line": {
            position: "relative",
            fontFamily:
              "var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
            paddingLeft: "12px",
            paddingRight: "72px",
            backgroundColor:
              "color-mix(in srgb, var(--rip-panel) 92%, var(--rip-code-bg))",
            boxShadow:
              "inset 1px 0 0 var(--rip-border), inset -1px 0 0 var(--rip-border)",
          },
          ".cm-codeblock-first": {
            borderTopLeftRadius: "8px",
            borderTopRightRadius: "8px",
            boxShadow:
              "inset 1px 0 0 var(--rip-border), inset -1px 0 0 var(--rip-border), inset 0 1px 0 var(--rip-border)",
          },
          ".cm-codeblock-last": {
            borderBottomLeftRadius: "8px",
            borderBottomRightRadius: "8px",
            boxShadow:
              "inset 1px 0 0 var(--rip-border), inset -1px 0 0 var(--rip-border), inset 0 -1px 0 var(--rip-border)",
          },
          ".cm-codeblock-first.cm-codeblock-last": {
            boxShadow:
              "inset 1px 0 0 var(--rip-border), inset -1px 0 0 var(--rip-border), inset 0 1px 0 var(--rip-border), inset 0 -1px 0 var(--rip-border)",
          },
          ".cm-codeblock-line.cm-activeLine": {
            backgroundColor:
              "color-mix(in srgb, var(--rip-panel) 78%, var(--rip-hover))",
          },
          ".cm-codeblock-line .cm-markdown-marker": {
            opacity: "0",
          },
          ".cm-line.cm-activeLine.cm-codeblock-line .cm-markdown-marker": {
            opacity: "0.9",
          },
          ".cm-code-copy-widget": {
            position: "absolute",
            top: "3px",
            right: "7px",
            zIndex: "2",
            display: "inline-flex",
          },
          ".cm-code-copy-button": {
            height: "22px",
            border: "1px solid var(--rip-border)",
            borderRadius: "5px",
            padding: "0 7px",
            color: "var(--rip-muted)",
            backgroundColor:
              "color-mix(in srgb, var(--rip-panel) 88%, transparent)",
            font: "11px var(--vscode-font-family)",
            cursor: "pointer",
          },
          ".cm-code-copy-button:hover": {
            color: "var(--rip-heading)",
            borderColor: "var(--rip-focus)",
            backgroundColor: "var(--rip-hover)",
          },
          ".cm-thematic-break-line": {
            color: "transparent",
            position: "relative",
          },
          ".cm-thematic-break-line::after": {
            content: '""',
            position: "absolute",
            left: "0",
            right: "0",
            top: "50%",
            borderTop: "1px solid var(--rip-border)",
            transform: "translateY(-50%)",
          },
          ".cm-line.cm-activeLine.cm-thematic-break-line": {
            color: "var(--rip-fg)",
          },
          ".cm-line.cm-activeLine.cm-thematic-break-line::after": {
            display: "none",
          },
          ".cm-table-line": {
            backgroundColor: "var(--rip-row-alt)",
            fontFamily:
              "var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
            fontFeatureSettings: '"tnum" 1, "liga" 0, "calt" 0',
            fontVariantLigatures: "none",
            lineHeight: "1.62",
            boxShadow:
              "inset 0 1px 0 color-mix(in srgb, var(--rip-border) 42%, transparent), inset 1px 0 0 color-mix(in srgb, var(--rip-border) 58%, transparent), inset -1px 0 0 color-mix(in srgb, var(--rip-border) 58%, transparent)",
          },
          ".cm-table-header-line": {
            color: "var(--rip-heading)",
            backgroundColor:
              "color-mix(in srgb, var(--rip-panel) 72%, var(--rip-bg))",
            fontWeight: "760",
            boxShadow:
              "inset 0 1px 0 var(--rip-border), inset 0 -1px 0 var(--rip-border), inset 1px 0 0 color-mix(in srgb, var(--rip-border) 70%, transparent), inset -1px 0 0 color-mix(in srgb, var(--rip-border) 70%, transparent)",
          },
          ".cm-table-delimiter-line": {
            color: "var(--rip-muted)",
            backgroundColor:
              "color-mix(in srgb, var(--rip-panel) 38%, var(--rip-bg))",
            fontSize: "0.92em",
            boxShadow:
              "inset 0 -1px 0 color-mix(in srgb, var(--rip-border) 70%, transparent), inset 1px 0 0 color-mix(in srgb, var(--rip-border) 58%, transparent), inset -1px 0 0 color-mix(in srgb, var(--rip-border) 58%, transparent)",
          },
          ".cm-table-body-line": {
            backgroundColor:
              "color-mix(in srgb, var(--rip-row-alt) 78%, transparent)",
          },
          ".cm-table-line .cm-markdown-marker": {
            opacity: "0",
          },
          ".cm-line.cm-activeLine.cm-table-line .cm-markdown-marker": {
            opacity: "0.9",
          },
          ".cm-table-pipe": {
            color: "transparent",
            display: "inline-block",
            width: "1ch",
            position: "relative",
            textAlign: "center",
            fontWeight: "400",
            textShadow: "none",
          },
          ".cm-table-pipe::after": {
            content: '""',
            position: "absolute",
            left: "50%",
            top: "-0.22em",
            bottom: "-0.22em",
            width: "1px",
            transform: "translateX(-50%)",
            backgroundColor:
              "color-mix(in srgb, var(--rip-border) 76%, transparent)",
          },
          ".cm-table-header-cell": {
            color: "var(--rip-heading)",
            fontWeight: "760",
            backgroundColor:
              "color-mix(in srgb, var(--rip-heading) 7%, transparent)",
            borderRadius: "3px",
            boxDecorationBreak: "clone",
          },
          ".cm-table-cell": {
            color: "var(--rip-fg)",
            backgroundColor:
              "color-mix(in srgb, var(--rip-bg) 18%, transparent)",
            borderRadius: "3px",
            boxDecorationBreak: "clone",
          },
          ".cm-table-delimiter-text": {
            color: "var(--rip-muted)",
            opacity: "0.32",
          },
          ".cm-rich-table-preview": {
            display: "block",
            boxSizing: "border-box",
            maxWidth: "100%",
            margin: "0",
            border: "1px solid var(--rip-border)",
            borderRadius: "8px",
            overflow: "hidden",
            backgroundColor: "var(--rip-panel)",
            boxShadow: "0 10px 28px rgba(0, 0, 0, 0.12)",
            cursor: "text",
          },
          ".cm-rich-table-preview.cm-widgetBuffer": {
            display: "none",
          },
          ".cm-rich-table-scroll": {
            width: "100%",
            overflowX: "auto",
          },
          ".cm-rich-table": {
            width: "100%",
            minWidth: "max-content",
            borderCollapse: "separate",
            borderSpacing: "0",
            color: "var(--rip-fg)",
            fontFamily: "var(--vscode-font-family)",
            fontSize: "0.95rem",
            lineHeight: "1.45",
          },
          ".cm-rich-table th, .cm-rich-table td": {
            maxWidth: "34ch",
            borderRight: "1px solid var(--rip-border)",
            borderBottom: "1px solid var(--rip-border)",
            padding: "0",
            textAlign: "left",
            verticalAlign: "top",
            whiteSpace: "normal",
          },
          ".cm-rich-table th:last-child, .cm-rich-table td:last-child": {
            borderRight: "0",
          },
          ".cm-rich-table tbody tr:last-child td": {
            borderBottom: "0",
          },
          ".cm-rich-table th": {
            color: "var(--rip-heading)",
            backgroundColor:
              "color-mix(in srgb, var(--rip-heading) 10%, var(--rip-panel))",
            fontWeight: "760",
          },
          ".cm-rich-table tbody tr:nth-child(even) td": {
            backgroundColor: "var(--rip-row-alt)",
          },
          ".cm-rich-table tbody tr:hover td": {
            backgroundColor: "var(--rip-hover)",
          },
          ".cm-rich-table .align-center": {
            textAlign: "center",
          },
          ".cm-rich-table .align-right": {
            textAlign: "right",
          },
          ".cm-rich-table code": {
            padding: "0.08em 0.32em",
            border: "1px solid var(--rip-border)",
            borderRadius: "4px",
            backgroundColor: "var(--rip-code-bg)",
            fontFamily:
              "var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
          },
          ".cm-rich-table strong": {
            fontWeight: "760",
          },
          ".cm-rich-table em": {
            fontStyle: "italic",
          },
          ".cm-rich-table a": {
            color: "var(--rip-link)",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          },
          ".cm-rich-table-cell": {
            position: "relative",
            cursor: "text",
          },
          ".cm-rich-table-cell-preview, .cm-rich-table-cell-editor": {
            minWidth: "7ch",
            minHeight: "2.45em",
            display: "block",
            boxSizing: "border-box",
            padding: "8px 12px",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          },
          ".cm-rich-table-cell-preview": {
            outline: "none",
          },
          ".cm-rich-table-cell-editor": {
            display: "none",
            outline: "none",
          },
          ".cm-rich-table-cell.is-editing .cm-rich-table-cell-preview": {
            display: "none",
          },
          ".cm-rich-table-cell.is-editing .cm-rich-table-cell-editor": {
            display: "block",
          },
          ".cm-rich-table-cell-editor:focus": {
            backgroundColor:
              "color-mix(in srgb, var(--rip-focus) 13%, transparent)",
            boxShadow: "inset 0 0 0 1px var(--rip-focus)",
          },
          ".cm-rich-table-cell-preview:empty::before, .cm-rich-table-cell-editor:empty::before": {
            content: '"Cell"',
            color: "var(--rip-muted)",
            opacity: "0.55",
          },
          ".cm-inline-markdown-image": {
            maxWidth: "100%",
            display: "inline-flex",
            alignItems: "center",
            verticalAlign: "middle",
          },
          ".cm-inline-markdown-image img": {
            width: "auto",
            height: "auto",
            maxWidth: "min(180px, 100%)",
            maxHeight: "140px",
            display: "block",
            border: "1px solid var(--rip-border)",
            borderRadius: "6px",
            aspectRatio: "auto",
            objectFit: "contain",
            backgroundColor: "var(--rip-bg)",
            cursor: "pointer",
          },
          ".cm-inline-markdown-image-error": {
            color: "var(--rip-muted)",
            fontSize: "0.92em",
          },
          ".cm-rich-table-toolbar": {
            display: "flex",
            justifyContent: "flex-end",
            gap: "6px",
            borderTop: "1px solid var(--rip-border)",
            padding: "6px 8px",
            backgroundColor:
              "color-mix(in srgb, var(--rip-panel) 88%, var(--rip-bg))",
          },
          ".cm-rich-table-action": {
            height: "26px",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            border: "1px solid var(--rip-border)",
            borderRadius: "6px",
            padding: "0 9px",
            color: "var(--rip-fg)",
            backgroundColor: "var(--rip-input-bg)",
            font: "12px var(--vscode-font-family)",
            cursor: "pointer",
          },
          ".cm-rich-table-action:hover": {
            borderColor: "var(--rip-focus)",
            backgroundColor: "var(--rip-hover)",
          },
          ".cm-rich-table-action-icon": {
            color: "var(--rip-heading)",
            fontWeight: "760",
          },
          ".cm-mermaid-preview": {
            display: "block",
            boxSizing: "border-box",
            maxWidth: "100%",
            height: "var(--mermaid-source-height, auto)",
            margin: "0",
            border: "1px solid var(--rip-border)",
            borderRadius: "8px",
            overflow: "hidden",
            backgroundColor: "var(--rip-panel)",
            boxShadow: "none",
            cursor: "text",
            position: "relative",
          },
          ".cm-mermaid-preview.cm-widgetBuffer": {
            display: "none",
          },
          ".cm-mermaid-output": {
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px",
            overflow: "hidden",
            position: "relative",
          },
          ".cm-mermaid-canvas": {
            width: "100%",
            height: "100%",
            position: "relative",
            overflow: "auto",
          },
          ".cm-mermaid-stage": {
            position: "absolute",
            left: "0",
            top: "0",
            transformOrigin: "0 0",
            willChange: "transform",
          },
          ".cm-mermaid-stage svg": {
            display: "block",
            maxWidth: "none",
            maxHeight: "none",
            width: "100%",
            height: "100%",
          },
          ".cm-mermaid-toolbar": {
            position: "absolute",
            top: "7px",
            right: "7px",
            zIndex: "2",
            display: "inline-flex",
            gap: "4px",
            padding: "3px",
            border: "1px solid var(--rip-border)",
            borderRadius: "7px",
            backgroundColor:
              "color-mix(in srgb, var(--rip-panel) 92%, transparent)",
            boxShadow: "0 8px 18px rgba(0, 0, 0, 0.18)",
          },
          ".cm-mermaid-tool-button": {
            minWidth: "25px",
            height: "24px",
            display: "inline-grid",
            placeItems: "center",
            border: "0",
            borderRadius: "5px",
            padding: "0 7px",
            color: "var(--rip-fg)",
            backgroundColor: "transparent",
            font: "12px var(--vscode-font-family)",
            cursor: "pointer",
          },
          ".cm-mermaid-tool-button:hover": {
            color: "var(--rip-heading)",
            backgroundColor: "var(--rip-hover)",
          },
          ".cm-mermaid-status": {
            color: "var(--rip-muted)",
            font: "13px var(--vscode-font-family)",
          },
          ".cm-mermaid-error": {
            width: "100%",
            margin: "0",
            color: "var(--rip-danger)",
            whiteSpace: "pre-wrap",
            font:
              "12px var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
          },
          ".cm-task-checkbox": {
            width: "1.05em",
            height: "1.05em",
            display: "inline-grid",
            placeItems: "center",
            margin: "0 0.36em 0 0.08em",
            border: "1.5px solid var(--rip-border)",
            borderRadius: "4px",
            color: "var(--rip-button-fg)",
            backgroundColor: "var(--rip-input-bg)",
            verticalAlign: "-0.16em",
            cursor: "pointer",
          },
          ".cm-task-checkbox.is-checked": {
            borderColor: "var(--rip-accent)",
            backgroundColor: "var(--rip-accent)",
          },
          ".cm-task-checkbox.is-checked::after": {
            content: '"✓"',
            color: "var(--rip-button-fg)",
            fontSize: "0.82em",
            lineHeight: "1",
          },
          ".cm-settings-root": {
            position: "fixed",
            right: "18px",
            bottom: "18px",
            zIndex: "10",
            display: "grid",
            justifyItems: "end",
            gap: "8px",
            fontFamily: "var(--vscode-font-family)",
          },
          ".cm-settings-button": {
            width: "36px",
            height: "36px",
            display: "grid",
            placeItems: "center",
            border: "1px solid var(--rip-border)",
            borderRadius: "999px",
            color: "var(--rip-fg)",
            background: "var(--rip-panel)",
            boxShadow: "0 8px 22px rgba(0, 0, 0, 0.22)",
            cursor: "pointer",
            fontSize: "16px",
          },
          ".cm-settings-button:hover": {
            borderColor: "var(--rip-focus)",
            background: "var(--rip-hover)",
          },
          ".cm-settings-menu": {
            width: "238px",
            maxHeight: "min(520px, calc(100vh - 64px))",
            overflowY: "auto",
            border: "1px solid var(--rip-border)",
            borderRadius: "8px",
            padding: "10px",
            color: "var(--rip-fg)",
            background: "var(--rip-panel)",
            boxShadow: "0 14px 36px rgba(0, 0, 0, 0.3)",
          },
          ".cm-settings-menu[hidden]": { display: "none" },
          ".cm-settings-section": {
            display: "grid",
            gap: "4px",
            paddingTop: "10px",
            borderTop:
              "1px solid color-mix(in srgb, var(--rip-border) 72%, transparent)",
          },
          ".cm-settings-section:first-child": {
            paddingTop: "0",
            borderTop: "0",
          },
          ".cm-settings-menu-title": {
            padding: "0 2px 3px",
            color: "var(--rip-heading)",
            fontSize: "11px",
            fontWeight: "700",
            textTransform: "uppercase",
          },
          ".cm-settings-subtitle": {
            marginTop: "5px",
            padding: "0 2px 1px",
            color: "var(--rip-muted)",
            fontSize: "11px",
            fontWeight: "650",
          },
          ".cm-settings-menu-item": {
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: "0",
            borderRadius: "6px",
            padding: "7px 8px",
            color: "var(--rip-fg)",
            background: "transparent",
            cursor: "pointer",
            font: "13px var(--vscode-font-family)",
            textAlign: "left",
          },
          ".cm-settings-menu-item:hover, .cm-settings-menu-item.is-active": {
            background: "var(--rip-hover)",
          },
          ".cm-settings-menu-item.is-active": {
            color: "var(--rip-heading)",
            fontWeight: "700",
          },
        }),
        ],
      }),
    });
    renderSettingsButton();
    renderOutlineNavigation(view);
  } catch (error) {
    reportRichdownError("editor-startup", error);
    renderPlainTextFallback(initialDocument);
  }
});

function isSearchShortcut(event) {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "f"
  );
}

function renderPlainTextFallback(text) {
  view = null;
  root.replaceChildren();

  const container = document.createElement("div");
  container.className = "richdown-fallback";

  const banner = document.createElement("div");
  banner.className = "richdown-fallback-banner";
  banner.textContent =
    "Rich preview could not start, so this file is open in plain Markdown mode.";

  const textarea = document.createElement("textarea");
  textarea.className = "richdown-fallback-editor";
  textarea.value = text;
  textarea.spellcheck = true;
  textarea.addEventListener("input", () => {
    if (applyingExternalUpdate) {
      return;
    }
    vscode.postMessage({
      type: "edit",
      text: textarea.value,
    });
  });

  container.appendChild(banner);
  container.appendChild(textarea);
  root.appendChild(container);
  fallbackTextarea = textarea;
  textarea.focus({ preventScroll: true });
}

function applyFallbackDocumentUpdate(nextText) {
  if (typeof nextText !== "string" || !fallbackTextarea) {
    return;
  }
  if (nextText === fallbackTextarea.value) {
    return;
  }

  const selectionStart = fallbackTextarea.selectionStart;
  const selectionEnd = fallbackTextarea.selectionEnd;
  const scrollTop = fallbackTextarea.scrollTop;
  const scrollLeft = fallbackTextarea.scrollLeft;
  applyingExternalUpdate = true;
  try {
    fallbackTextarea.value = nextText;
    fallbackTextarea.selectionStart = Math.min(selectionStart, nextText.length);
    fallbackTextarea.selectionEnd = Math.min(selectionEnd, nextText.length);
    fallbackTextarea.scrollTop = scrollTop;
    fallbackTextarea.scrollLeft = scrollLeft;
  } finally {
    applyingExternalUpdate = false;
  }
}

window.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "resolvedImage") {
    const pending = pendingImageRequests.get(event.data.requestId);
    if (!pending) {
      return;
    }
    window.clearTimeout(pending.timeout);
    pendingImageRequests.delete(event.data.requestId);
    if (event.data.uri) {
      pending.resolve(event.data.uri);
    } else {
      pending.reject(new Error("Image could not be resolved."));
    }
    return;
  }

  if (event.data.type === "theme") {
    settings.richTheme = event.data.theme || "default";
    applyTheme(settings.richTheme);
    updateSettingsMenu();
    return;
  }

  if (event.data.type === "settings") {
    const previousSettings = settings;
    settings = normalizeRichEditorSettings({
      ...settings,
      ...event.data.settings,
    });
    applyTheme(settings.richTheme);
    applyPreviewWidth(settings.previewWidth);
    updateSettingsMenu();
    if (hasPreviewSettingChanged(previousSettings, settings)) {
      refreshRichDecorations();
    }
    return;
  }

  if (event.data.type !== "update") return;

  const nextText = event.data.text;
  if (!view) {
    applyFallbackDocumentUpdate(nextText);
    return;
  }
  applyExternalDocumentUpdate(view, nextText);
});

function applyExternalDocumentUpdate(editorView, nextText) {
  if (typeof nextText !== "string") {
    return;
  }

  const currentText = editorView.state.doc.toString();
  if (nextText === currentText) {
    return;
  }

  const change = getMinimalTextChange(currentText, nextText);
  const selection = editorView.state.selection.main;
  const scrollTop = editorView.scrollDOM.scrollTop;
  const scrollLeft = editorView.scrollDOM.scrollLeft;

  applyingExternalUpdate = true;
  try {
    editorView.dispatch({
      changes: change,
      selection: {
        anchor: mapPositionThroughTextChange(
          selection.anchor,
          change,
          currentText.length,
          nextText.length,
        ),
        head: mapPositionThroughTextChange(
          selection.head,
          change,
          currentText.length,
          nextText.length,
        ),
      },
    });
  } finally {
    applyingExternalUpdate = false;
  }

  requestAnimationFrame(() => {
    editorView.scrollDOM.scrollTop = scrollTop;
    editorView.scrollDOM.scrollLeft = scrollLeft;
  });
}

function getMinimalTextChange(currentText, nextText) {
  let prefixLength = 0;
  const maxPrefixLength = Math.min(currentText.length, nextText.length);
  while (
    prefixLength < maxPrefixLength &&
    currentText.charCodeAt(prefixLength) === nextText.charCodeAt(prefixLength)
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const maxSuffixLength = Math.min(
    currentText.length - prefixLength,
    nextText.length - prefixLength,
  );
  while (
    suffixLength < maxSuffixLength &&
    currentText.charCodeAt(currentText.length - suffixLength - 1) ===
      nextText.charCodeAt(nextText.length - suffixLength - 1)
  ) {
    suffixLength += 1;
  }

  return {
    from: prefixLength,
    to: currentText.length - suffixLength,
    insert: nextText.slice(prefixLength, nextText.length - suffixLength),
  };
}

function mapPositionThroughTextChange(position, change, oldLength, newLength) {
  const clampedPosition = Math.max(0, Math.min(position, oldLength));
  if (change.from === 0 && change.to === oldLength) {
    return Math.min(clampedPosition, newLength);
  }
  if (clampedPosition <= change.from) {
    return clampedPosition;
  }
  if (clampedPosition >= change.to) {
    return Math.max(
      0,
      Math.min(
        clampedPosition + change.insert.length - (change.to - change.from),
        newLength,
      ),
    );
  }
  return Math.min(change.from + change.insert.length, newLength);
}

window.addEventListener("click", (event) => {
  if (!event.target.closest(".cm-table-context-menu")) {
    closeTableContextMenu();
  }
  if (!event.target.closest(".richdown-outline-root")) {
    closeOutlineNavigation();
  }
  if (event.target.closest(".cm-settings-root")) return;
  const menu = document.querySelector(".cm-settings-menu");
  if (menu) menu.hidden = true;
});

window.addEventListener("blur", () => {
  closeSlashCommandMenu();
  closeTableContextMenu();
  exitDetailsEditMode(view, true);
  exitTableEditMode(view, true);
  exitMermaidEditMode(view, true);
});

window.addEventListener(
  "keydown",
  (event) => {
    if (!slashCommandMenu) {
      if (event.key === "Escape" && closeTableContextMenu()) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    let handled = false;
    if (event.key === "ArrowDown") {
      handled = moveSlashCommandMenu(1);
    } else if (event.key === "ArrowUp") {
      handled = moveSlashCommandMenu(-1);
    } else if (event.key === "Enter" || event.key === "Tab") {
      handled = acceptSlashCommandMenu();
    } else if (event.key === "Escape") {
      handled = closeSlashCommandMenu();
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true,
);

function refreshRichDecorations() {
  if (!view) return;
  previewDecorationRevision += 1;
  view.dispatch({
    effects: [
      refreshPreviewDecorations.of(null),
      setActiveTableEdit.of(null),
      setActiveMermaidEdit.of(null),
    ],
  });
  requestEditorMeasure(view);
}

function triggerSlashCommandMenu(view) {
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return false;
  }

  const line = view.state.doc.lineAt(selection.from);
  if (line.text.trim()) {
    return false;
  }

  closeSlashCommandMenu();
  const from = selection.from;
  view.dispatch({
    changes: { from, insert: "/" },
    selection: { anchor: from + 1 },
  });
  slashCommandMenu = new SlashCommandMenu(view, from, from + 1);
  view.focus();
  return true;
}

function syncSlashCommandMenu(update) {
  if (!slashCommandMenu) {
    return;
  }
  slashCommandMenu.sync(update);
}

function moveSlashCommandMenu(delta) {
  if (!slashCommandMenu) {
    return false;
  }
  slashCommandMenu.move(delta);
  return true;
}

function acceptSlashCommandMenu() {
  if (!slashCommandMenu) {
    return false;
  }
  slashCommandMenu.accept();
  return true;
}

function closeSlashCommandMenu() {
  if (!slashCommandMenu) {
    return false;
  }
  slashCommandMenu.destroy();
  slashCommandMenu = null;
  return true;
}

function renderOutlineNavigation(editorView) {
  if (outlineRoot) {
    updateOutlineNavigation(editorView, { rebuild: true });
    return;
  }

  outlineRoot = document.createElement("div");
  outlineRoot.className = "richdown-outline-root";

  outlineButton = document.createElement("button");
  outlineButton.type = "button";
  outlineButton.className = "richdown-outline-button";
  outlineButton.title = "Document sections";
  outlineButton.setAttribute("aria-label", "Document sections");
  outlineButton.textContent = "☰";
  outlineButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleOutlineNavigation();
  });
  outlineButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  outlinePanel = document.createElement("nav");
  outlinePanel.className = "richdown-outline-panel";
  outlinePanel.hidden = true;
  outlinePanel.setAttribute("aria-label", "Document sections");
  outlinePanel.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  outlinePanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const title = document.createElement("div");
  title.className = "richdown-outline-title";
  title.textContent = "Sections";
  outlineList = document.createElement("div");
  outlineList.className = "richdown-outline-list";

  outlinePanel.appendChild(title);
  outlinePanel.appendChild(outlineList);
  outlineRoot.appendChild(outlinePanel);
  outlineRoot.appendChild(outlineButton);
  document.body.appendChild(outlineRoot);

  updateOutlineNavigation(editorView, { rebuild: true });
}

function syncOutlineNavigation(update) {
  if (!outlineRoot) {
    return;
  }
  if (update.docChanged) {
    updateOutlineNavigation(update.view, { rebuild: true });
    return;
  }
  if (update.selectionSet || update.viewportChanged) {
    updateOutlineNavigation(update.view);
  }
}

function toggleOutlineNavigation() {
  if (!outlineRoot || !outlinePanel) {
    return;
  }
  const nextOpen = outlinePanel.hidden;
  outlinePanel.hidden = !nextOpen;
  outlineRoot.classList.toggle("is-open", nextOpen);
}

function closeOutlineNavigation() {
  if (!outlineRoot || !outlinePanel || outlinePanel.hidden) {
    return false;
  }
  outlinePanel.hidden = true;
  outlineRoot.classList.remove("is-open");
  return true;
}

function updateOutlineNavigation(editorView, options = {}) {
  if (!outlineList) {
    return;
  }
  if (options.rebuild) {
    outlineHeadings = collectDocumentHeadings(editorView.state.doc);
    outlineList.replaceChildren(
      ...(outlineHeadings.length
        ? outlineHeadings.map((heading, index) =>
            createOutlineItem(editorView, heading, index),
          )
        : [createOutlineEmptyState()]),
    );
  }
  updateActiveOutlineItem(editorView);
}

function createOutlineItem(editorView, heading, index) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "richdown-outline-item";
  item.dataset.headingIndex = String(index);
  item.title = heading.text;
  item.style.paddingLeft = `${7 + Math.max(0, heading.level - 2) * 12}px`;

  const level = document.createElement("span");
  level.className = "richdown-outline-level";
  level.textContent = `H${heading.level}`;

  const text = document.createElement("span");
  text.className = "richdown-outline-text";
  text.textContent = heading.text;

  item.appendChild(level);
  item.appendChild(text);
  item.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    jumpToHeading(editorView, heading);
  });
  return item;
}

function createOutlineEmptyState() {
  const empty = document.createElement("div");
  empty.className = "richdown-outline-empty";
  empty.textContent = "No sections";
  return empty;
}

function jumpToHeading(editorView, heading) {
  editorView.dispatch({
    selection: { anchor: Math.min(heading.from, editorView.state.doc.length) },
    scrollIntoView: true,
  });
  editorView.focus();
  closeOutlineNavigation();
}

function updateActiveOutlineItem(editorView) {
  if (!outlineList || outlineHeadings.length === 0) {
    return;
  }
  const position = editorView.state.selection.main.from;
  let activeIndex = -1;
  for (let index = 0; index < outlineHeadings.length; index += 1) {
    if (outlineHeadings[index].from <= position) {
      activeIndex = index;
    } else {
      break;
    }
  }

  for (const item of outlineList.querySelectorAll(".richdown-outline-item")) {
    const isActive =
      Number.parseInt(item.dataset.headingIndex || "-1", 10) === activeIndex;
    item.classList.toggle("is-active", isActive);
    if (isActive) {
      item.scrollIntoView({ block: "nearest" });
    }
  }
}

function collectDocumentHeadings(doc) {
  const headings = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const fence = line.text.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLength = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLength) {
        inFence = false;
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }

    if (inFence) {
      continue;
    }

    const heading = line.text.match(/^\s{0,3}(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!heading) {
      continue;
    }
    headings.push({
      from: line.from,
      level: heading[1].length,
      text: cleanOutlineHeadingText(heading[2]),
    });
  }

  return headings;
}

function cleanOutlineHeadingText(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

function exitDetailsEditMode(view, force = false) {
  if (!view) return;
  const activeEdit = view.state.field(detailsDecorationField).activeEdit;
  if (!force && !activeEdit) return;
  view.dispatch({
    effects: setActiveDetailsEdit.of(null),
  });
}

function exitTableEditMode(view, force = false) {
  if (!view) return;
  const activeEdit = view.state.field(tableDecorationField).activeEdit;
  if (!force && !activeEdit) return;
  view.dispatch({
    effects: setActiveTableEdit.of(null),
  });
}

function exitMermaidEditMode(view, force = false) {
  if (!view) return;
  const activeEdit = view.state.field(mermaidDecorationField).activeEdit;
  if (!force && !activeEdit) return;
  view.dispatch({
    effects: setActiveMermaidEdit.of(null),
  });
}

function buildBlockLineDecorations(view) {
  const builder = new RangeSetBuilder();
  const classesByLine = new Map();
  const codeBlockLineClasses = collectCodeBlockLineClasses(view);
  const codeBlockLineStarts = new Set(codeBlockLineClasses.keys());
  const previewedDetailsRanges = getPreviewedDetailsRanges(view.state);

  for (const range of view.visibleRanges) {
    let position = range.from;
    while (position <= range.to) {
      const line = view.state.doc.lineAt(position);
      if (rangeIntersectsRanges(line.from, line.to, previewedDetailsRanges)) {
        position = line.to + 1;
        if (position > view.state.doc.length) break;
        continue;
      }
      if (!codeBlockLineStarts.has(line.from)) {
        const heading = line.text.match(/^(\s{0,3})(#{1,6})\s+/);
        if (isThematicBreakLine(line.text)) {
          addLineClass(classesByLine, line.from, "cm-thematic-break-line");
        } else if (heading) {
          const level = heading[2].length;
          addLineClass(
            classesByLine,
            line.from,
            `cm-heading-line cm-heading-${level}`,
          );
        } else if (/^\s*>\s?/.test(line.text)) {
          addLineClass(classesByLine, line.from, "cm-quote-line");
        }
        const listMarker = parseListMarker(line.text);
        if (listMarker) {
          addLineClass(
            classesByLine,
            line.from,
            `cm-list-line cm-list-depth-${Math.min(listMarker.level, 3)} ${
              listMarker.ordered ? "cm-list-ordered" : "cm-list-unordered"
            }`,
          );
        }
      }
      position = line.to + 1;
      if (position > view.state.doc.length) break;
    }
  }

  for (const [lineStart, className] of codeBlockLineClasses) {
    if (rangeIntersectsRanges(lineStart, lineStart + 1, previewedDetailsRanges)) {
      continue;
    }
    addLineClass(classesByLine, lineStart, className);
  }

  for (const [lineStart, className] of [...classesByLine.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    builder.add(lineStart, lineStart, Decoration.line({ class: className }));
  }

  return builder.finish();
}

function collectCodeBlockLineClasses(view) {
  const lineClasses = new Map();
  const doc = view.state.doc;
  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        if (node.name !== "FencedCode" && node.name !== "CodeBlock") {
          return;
        }

        const firstLineNumber = doc.lineAt(node.from).number;
        const lastLineNumber = doc.lineAt(Math.max(node.from, node.to - 1))
          .number;
        let position = Math.max(node.from, range.from);
        while (position <= node.to && position <= range.to) {
          const line = doc.lineAt(position);
          const classes = ["cm-codeblock-line"];
          if (line.number === firstLineNumber) {
            classes.push("cm-codeblock-first");
          }
          if (line.number === lastLineNumber) {
            classes.push("cm-codeblock-last");
          }
          lineClasses.set(line.from, classes.join(" "));
          position = line.to + 1;
          if (position > doc.length) break;
        }
      },
    });
  }
  return lineClasses;
}

function buildCodeBlockCopyButtons(view) {
  const ranges = [];
  const seenBlocks = new Set();
  const previewedDetailsRanges = getPreviewedDetailsRanges(view.state);
  const doc = view.state.doc;

  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        if (node.name !== "FencedCode" && node.name !== "CodeBlock") {
          return;
        }
        const blockKey = `${node.from}:${node.to}`;
        if (
          seenBlocks.has(blockKey) ||
          rangeIntersectsRanges(node.from, node.to, previewedDetailsRanges)
        ) {
          return;
        }
        seenBlocks.add(blockKey);
        const codeBlock = getCodeBlockCopyInfo(doc, node);
        if (!codeBlock || !codeBlock.code) {
          return;
        }
        ranges.push({
          from: codeBlock.buttonPosition,
          decoration: Decoration.widget({
            side: 1,
            widget: new CodeCopyButtonWidget(codeBlock.code),
          }),
        });
      },
    });
  }

  return Decoration.set(
    ranges.map((range) => range.decoration.range(range.from)),
    true,
  );
}

function getCodeBlockCopyInfo(doc, node) {
  const openingLine = doc.lineAt(node.from);
  if (node.name === "FencedCode") {
    const closingLine =
      node.to > node.from ? doc.lineAt(Math.max(node.from, node.to - 1)) : null;
    const hasClosingFence =
      closingLine &&
      closingLine.number > openingLine.number &&
      /^\s{0,3}(`{3,}|~{3,})\s*$/.test(closingLine.text);
    const firstCodeLineNumber = openingLine.number + 1;
    const lastCodeLineNumber = hasClosingFence
      ? closingLine.number - 1
      : doc.lineAt(node.to).number;
    return {
      buttonPosition: openingLine.to,
      code: getLinesText(doc, firstCodeLineNumber, lastCodeLineNumber),
    };
  }

  return {
    buttonPosition: openingLine.to,
    code: getLinesText(doc, openingLine.number, doc.lineAt(node.to).number),
  };
}

function getLinesText(doc, fromLineNumber, toLineNumber) {
  if (toLineNumber < fromLineNumber) {
    return "";
  }
  const lines = [];
  for (
    let lineNumber = fromLineNumber;
    lineNumber <= toLineNumber && lineNumber <= doc.lines;
    lineNumber += 1
  ) {
    lines.push(doc.line(lineNumber).text);
  }
  return lines.join("\n");
}

function addLineClass(classesByLine, lineStart, className) {
  const current = classesByLine.get(lineStart);
  classesByLine.set(lineStart, current ? `${current} ${className}` : className);
}

function isThematicBreakLine(text) {
  return /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(text);
}

function parseListMarker(text) {
  const match = text.match(/^(\s*)((?:[-+*])|(?:\d+[.)]))(\s+)/);
  if (!match) {
    return null;
  }
  const indentColumns = countIndentColumns(match[1]);
  return {
    indent: match[1],
    marker: match[2],
    spacing: match[3],
    ordered: /^\d/.test(match[2]),
    level: Math.max(0, Math.floor(indentColumns / 2)),
    markerFrom: match[1].length,
    markerTo: match[1].length + match[2].length + match[3].length,
  };
}

function countIndentColumns(text) {
  let columns = 0;
  for (const character of text) {
    columns += character === "\t" ? 4 - (columns % 4) : 1;
  }
  return columns;
}

function isDetailsOpeningLine(text) {
  return /^\s{0,3}<details(?:\s|>|$)/i.test(text);
}

function isDetailsClosingLine(text) {
  return /<\/details\s*>/i.test(text);
}

function isEditingDetailsBlock(detailsBlock, activeEdit, selection) {
  if (!activeEdit || activeEdit.from !== detailsBlock.from) {
    return false;
  }

  return selection.ranges.some(
    (range) =>
      range.from >= detailsBlock.from && range.to <= detailsBlock.sourceTo,
  );
}

function findDetailsBlocks(doc) {
  const blocks = [];
  const stack = [];

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    if (isDetailsOpeningLine(line.text)) {
      if (isDetailsClosingLine(line.text)) {
        blocks.push(createDetailsBlock(doc, line, line));
        continue;
      }
      stack.push(line);
      continue;
    }

    if (!isDetailsClosingLine(line.text) || stack.length === 0) {
      continue;
    }

    const openingLine = stack.pop();
    if (stack.length === 0) {
      blocks.push(createDetailsBlock(doc, openingLine, line));
    }
  }

  return blocks;
}

function createDetailsBlock(doc, openingLine, closingLine) {
  const lines = [];
  for (
    let lineNumber = openingLine.number;
    lineNumber <= closingLine.number;
    lineNumber += 1
  ) {
    lines.push(doc.line(lineNumber));
  }

  const parsed = parseDetailsContent(lines);
  const signature = lines.map((line) => line.text).join("\n");
  return {
    from: openingLine.from,
    to: closingLine.to,
    sourceTo: closingLine.to,
    sourceLineCount: closingLine.number - openingLine.number + 1,
    key: `${openingLine.from}:${signature}`,
    openByDefault: /\sopen(?:\s|>|$)/i.test(openingLine.text),
    summary: parsed.summary,
    bodyLines: parsed.bodyLines,
    signature,
  };
}

function parseDetailsContent(lines) {
  const source = lines.map((line) => line.text).join("\n");
  const inner = source
    .replace(/^\s*<details\b[^>]*>/i, "")
    .replace(/<\/details\s*>\s*$/i, "")
    .trim();
  let summary = "Details";
  let body = inner;
  const summaryMatch = inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);

  if (summaryMatch) {
    summary = stripHtmlTags(summaryMatch[1]).trim() || summary;
    body = `${inner.slice(0, summaryMatch.index)}${inner.slice(
      summaryMatch.index + summaryMatch[0].length,
    )}`;
  }

  return {
    summary,
    bodyLines: normalizeDetailsBodyLines(body),
  };
}

function normalizeDetailsBodyLines(body) {
  return body
    .replace(/<\/?div\b[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\r?\n/)
    .map((line) => stripHtmlTags(line).trim())
    .filter(Boolean)
    .map((line) => ({ text: line, sourceFrom: null }));
}

function getDetailsBodyLineText(line) {
  return typeof line === "string" ? line : line.text || "";
}

function stripHtmlTags(text) {
  return text.replace(/<[^>]+>/g, "");
}

function getPreviewedDetailsRanges(state) {
  const activeEdit = getActiveDetailsEdit(state);
  return findDetailsBlocks(state.doc)
    .filter((block) => !activeEdit || activeEdit.from !== block.from)
    .map((block) => ({ from: block.from, to: block.to }));
}

function getActiveDetailsEdit(state) {
  try {
    return state.field(detailsDecorationField).activeEdit;
  } catch (error) {
    return null;
  }
}

function rangeIntersectsRanges(from, to, ranges) {
  return ranges.some((range) => from < range.to && to > range.from);
}

function injectStyles() {
  if (document.querySelector("#richdown-global-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "richdown-global-styles";
  style.textContent = `
    .cm-settings-root {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 10000;
      display: grid;
      justify-items: end;
      gap: 8px;
      font-family: var(--vscode-font-family);
      pointer-events: none;
    }
    .richdown-fallback {
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
      color: var(--rip-fg);
      background: var(--rip-bg);
      font-family: var(--vscode-font-family);
    }
    .richdown-fallback-banner {
      border-bottom: 1px solid var(--rip-border);
      padding: 8px 12px;
      color: var(--rip-muted);
      background: var(--rip-panel);
      font-size: 12px;
    }
    .richdown-fallback-editor {
      width: 100%;
      height: 100%;
      min-height: 0;
      resize: none;
      border: 0;
      outline: 0;
      padding: 24px clamp(18px, 5vw, 64px) 72px;
      color: var(--rip-fg);
      background: var(--rip-bg);
      caret-color: var(--rip-caret);
      font: 15px/1.72 var(--vscode-editor-font-family, var(--vscode-font-family));
      white-space: pre-wrap;
    }
    .cm-settings-root * {
      box-sizing: border-box;
    }
    .richdown-outline-root {
      position: fixed;
      right: 18px;
      bottom: 64px;
      z-index: 9999;
      display: grid;
      justify-items: end;
      gap: 8px;
      font-family: var(--vscode-font-family);
      pointer-events: none;
    }
    .richdown-outline-root * {
      box-sizing: border-box;
    }
    .richdown-outline-button {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 1px solid var(--rip-border);
      border-radius: 999px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      pointer-events: auto;
    }
    .richdown-outline-button:hover,
    .richdown-outline-root.is-open .richdown-outline-button {
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .richdown-outline-panel {
      width: 238px;
      max-height: min(520px, calc(100vh - 112px));
      overflow-y: auto;
      border: 1px solid var(--rip-border);
      border-radius: 8px;
      padding: 10px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    .richdown-outline-panel[hidden] {
      display: none;
    }
    .richdown-outline-title {
      margin: 0 0 6px;
      padding: 0 2px 4px;
      color: var(--rip-heading);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      border-bottom: 1px solid color-mix(in srgb, var(--rip-border) 72%, transparent);
    }
    .richdown-outline-list {
      display: grid;
      gap: 2px;
    }
    .richdown-outline-item {
      width: 100%;
      min-width: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 6px;
      border: 0;
      border-radius: 6px;
      padding: 6px 7px;
      color: var(--rip-fg);
      background: transparent;
      cursor: pointer;
      font: 12px var(--vscode-font-family);
      text-align: left;
    }
    .richdown-outline-item:hover,
    .richdown-outline-item.is-active {
      background: var(--rip-hover);
    }
    .richdown-outline-item.is-active {
      color: var(--rip-heading);
      font-weight: 700;
    }
    .richdown-outline-level {
      width: 1.4em;
      color: var(--rip-muted);
      font-size: 10px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .richdown-outline-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .richdown-outline-empty {
      padding: 8px 7px 2px;
      color: var(--rip-muted);
      font-size: 12px;
    }
    @media (min-width: 1440px) {
      html[data-preview-width="default"] body .cm-editor .cm-content {
        max-width: 900px;
        margin-left: max(32px, calc((100vw - 1220px) / 2));
        margin-right: 320px;
      }
      html[data-preview-width="wide"] body .cm-editor .cm-content {
        max-width: none;
        margin-left: 32px;
        margin-right: 320px;
      }
      .richdown-outline-root {
        top: 32px;
        right: 24px;
        bottom: auto;
        width: 260px;
        max-height: calc(100vh - 64px);
        justify-items: stretch;
        pointer-events: auto;
      }
      .richdown-outline-button {
        display: none;
      }
      .richdown-outline-panel {
        width: 100%;
        max-height: calc(100vh - 64px);
        border: 0;
        border-left: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.28));
        border-radius: 0;
        padding: 2px 0 2px 14px;
        background: transparent;
        box-shadow: none;
      }
      .richdown-outline-panel[hidden] {
        display: block;
      }
      .richdown-outline-title {
        margin-bottom: 8px;
        border-bottom: 0;
      }
      .richdown-outline-item {
        padding-top: 5px;
        padding-bottom: 5px;
      }
    }
    .cm-settings-button {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 1px solid var(--rip-border);
      border-radius: 999px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      pointer-events: auto;
    }
    .cm-settings-button:hover {
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .cm-settings-menu {
      width: 238px;
      max-height: min(520px, calc(100vh - 72px));
      overflow-y: auto;
      border: 1px solid var(--rip-border);
      border-radius: 8px;
      padding: 10px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    .cm-settings-menu[hidden] {
      display: none;
    }
    .cm-settings-section {
      display: grid;
      gap: 4px;
      padding-top: 10px;
      border-top: 1px solid color-mix(in srgb, var(--rip-border) 72%, transparent);
    }
    .cm-settings-section:first-child {
      padding-top: 0;
      border-top: 0;
    }
    .cm-settings-menu-title {
      margin: 0;
      padding: 0 2px 3px;
      color: var(--rip-heading);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .cm-settings-subtitle {
      margin: 5px 0 0;
      padding: 0 2px 1px;
      color: var(--rip-muted);
      font-size: 11px;
      font-weight: 650;
    }
    .cm-settings-menu-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: 0;
      border-radius: 6px;
      padding: 7px 8px;
      color: var(--rip-fg);
      background: transparent;
      cursor: pointer;
      font: 13px var(--vscode-font-family);
      text-align: left;
    }
    .cm-settings-menu-title + .cm-settings-menu-item {
      margin-top: 2px;
    }
    .cm-settings-menu-item:hover,
    .cm-settings-menu-item.is-active {
      background: var(--rip-hover);
    }
    .cm-settings-menu-item.is-active {
      color: var(--rip-heading);
      font-weight: 700;
    }
    .cm-slash-menu {
      position: fixed;
      z-index: 10001;
      width: 260px;
      max-height: min(320px, calc(100vh - 24px));
      overflow-y: auto;
      display: grid;
      gap: 2px;
      border: 1px solid var(--rip-border);
      border-radius: 8px;
      padding: 6px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.3);
      font-family: var(--vscode-font-family);
    }
    .cm-slash-menu-item {
      width: 100%;
      display: grid;
      gap: 2px;
      border: 0;
      border-radius: 6px;
      padding: 8px 9px;
      color: var(--rip-fg);
      background: transparent;
      text-align: left;
      cursor: pointer;
      font: 13px var(--vscode-font-family);
    }
    .cm-slash-menu-item:hover,
    .cm-slash-menu-item.is-active {
      background: var(--rip-hover);
    }
    .cm-slash-menu-label {
      color: var(--rip-heading);
      font-weight: 700;
    }
    .cm-slash-menu-description {
      color: var(--rip-muted);
      font-size: 12px;
    }
    .cm-table-context-menu {
      position: fixed;
      z-index: 10003;
      min-width: 184px;
      display: grid;
      gap: 2px;
      border: 1px solid var(--rip-border);
      border-radius: 8px;
      padding: 6px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.3);
      font-family: var(--vscode-font-family);
    }
    .cm-table-context-menu-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 0;
      border-radius: 6px;
      padding: 7px 9px;
      color: var(--rip-fg);
      background: transparent;
      text-align: left;
      cursor: pointer;
      font: 13px var(--vscode-font-family);
    }
    .cm-table-context-menu-item:hover {
      background: var(--rip-hover);
    }
    .cm-table-context-menu-item:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .cm-table-context-menu-item:disabled:hover {
      background: transparent;
    }
    .cm-table-context-menu-divider {
      height: 1px;
      margin: 4px 2px;
      background: color-mix(in srgb, var(--rip-border) 72%, transparent);
    }
    .cm-mermaid-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10002;
      display: grid;
      padding: 24px;
      background: rgba(0, 0, 0, 0.56);
      pointer-events: auto;
    }
    .cm-mermaid-modal {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      border: 1px solid var(--rip-border);
      border-radius: 10px;
      overflow: hidden;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
    }
    .cm-mermaid-modal-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid var(--rip-border);
      padding: 8px 10px;
      background: color-mix(in srgb, var(--rip-panel) 88%, var(--rip-bg));
      font-family: var(--vscode-font-family);
    }
    .cm-mermaid-modal-title {
      min-width: 0;
      color: var(--rip-heading);
      font-size: 13px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cm-mermaid-modal-controls {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
    }
    .cm-mermaid-modal-button {
      min-width: 28px;
      height: 28px;
      display: inline-grid;
      place-items: center;
      border: 1px solid var(--rip-border);
      border-radius: 6px;
      padding: 0 8px;
      color: var(--rip-fg);
      background: var(--rip-input-bg);
      font: 12px var(--vscode-font-family);
      cursor: pointer;
    }
    .cm-mermaid-modal-button:hover {
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .cm-mermaid-modal-canvas {
      min-width: 0;
      min-height: 0;
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(color-mix(in srgb, var(--rip-border) 24%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--rip-border) 24%, transparent) 1px, transparent 1px),
        var(--rip-bg);
      background-size: 24px 24px;
      cursor: grab;
      touch-action: none;
    }
    .cm-mermaid-modal-canvas.is-dragging {
      cursor: grabbing;
    }
    .cm-mermaid-modal-stage {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
      will-change: transform;
    }
    .cm-mermaid-modal-stage svg {
      display: block;
      max-width: none;
      max-height: none;
      width: 100%;
      height: 100%;
    }
  `;
  document.head.appendChild(style);
}

function getTableLineRole(doc, line) {
  if (
    !isTableContentLine(line.text) &&
    !isTableDelimiterLine(line.text) &&
    !isTableRowLine(line.text)
  ) {
    return null;
  }

  if (isTableDelimiterLine(line.text)) {
    const previousLine = line.number > 1 ? doc.line(line.number - 1) : null;
    return previousLine && isTableContentLine(previousLine.text)
      ? "delimiter"
      : null;
  }

  const nextLine = line.number < doc.lines ? doc.line(line.number + 1) : null;
  if (nextLine && isTableDelimiterLine(nextLine.text)) {
    return "header";
  }

  return isTableBodyLine(doc, line.number) ? "body" : null;
}

function isTableBodyLine(doc, lineNumber) {
  let currentLineNumber = lineNumber - 1;
  while (currentLineNumber >= 1) {
    const line = doc.line(currentLineNumber);
    if (isTableDelimiterLine(line.text)) {
      const headerLine =
        currentLineNumber > 1 ? doc.line(currentLineNumber - 1) : null;
      return Boolean(headerLine && isTableContentLine(headerLine.text));
    }

    if (!isTableRowLine(line.text)) {
      return false;
    }

    if (lineNumber - currentLineNumber > 200) {
      return false;
    }

    currentLineNumber -= 1;
  }
  return false;
}

function isTableContentLine(text) {
  if (!isTableRowLine(text)) {
    return false;
  }

  const cells = splitTableCells(text);
  return cells.some((cell) => cell.trim());
}

function isTableRowLine(text) {
  if (!text.includes("|") || isTableDelimiterLine(text)) {
    return false;
  }

  const cells = splitTableCells(text);
  return cells.length >= 2;
}

function isTableDelimiterLine(text) {
  if (!text.includes("|")) {
    return false;
  }
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(text);
}

function splitTableCells(text) {
  return text.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
}

function buildInlineDecorations(view) {
  const ranges = [];
  const imageRanges = [];
  const previewedDetailsRanges = getPreviewedDetailsRanges(view.state);

  for (const range of view.visibleRanges) {
    let position = range.from;
    while (position <= range.to) {
      const line = view.state.doc.lineAt(position);
      if (rangeIntersectsRanges(line.from, line.to, previewedDetailsRanges)) {
        position = line.to + 1;
        if (position > view.state.doc.length) break;
        continue;
      }
      const lineFocused = isLineFocused(view.state, line);
      const heading = line.text.match(/^(\s{0,3})(#{1,6})(\s+)/);
      if (heading) {
        ranges.push({
          from: line.from + heading[1].length + heading[2].length,
          to:
            line.from +
            heading[1].length +
            heading[2].length +
            heading[3].length,
          decoration: Decoration.mark({ class: "cm-markdown-marker" }),
        });
      }

      const listMarker = parseListMarker(line.text);
      if (listMarker && !lineFocused) {
        ranges.push({
          from: line.from + listMarker.markerFrom,
          to: line.from + listMarker.markerTo,
          decoration: Decoration.replace({
            widget: new ListMarkerWidget(listMarker),
          }),
        });
      }

      if (!lineFocused) {
        for (const image of findMarkdownImages(line.text)) {
          const imageRange = {
            from: line.from + image.from,
            to: line.from + image.to,
          };
          imageRanges.push(imageRange);
          ranges.push({
            ...imageRange,
            decoration: Decoration.replace({
              widget: new ImagePreviewWidget(
                image.src,
                image.alt,
                line.from + image.from,
              ),
            }),
          });
        }
      }

      position = line.to + 1;
      if (position > view.state.doc.length) break;
    }

    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        if (
          isRangeInsideRanges(node.from, node.to, imageRanges) ||
          rangeIntersectsRanges(node.from, node.to, previewedDetailsRanges)
        ) {
          return;
        }

        const nodeName = node.name;
        if (isMarkdownMarker(nodeName)) {
          ranges.push({
            from: node.from,
            to: node.to,
            decoration: Decoration.mark({ class: "cm-markdown-marker" }),
          });
        }
        if (nodeName === "Link") {
          ranges.push({
            from: node.from,
            to: node.to,
            decoration: Decoration.mark({ class: "cm-link" }),
          });
        }
        if (nodeName === "InlineCode") {
          ranges.push({
            from: node.from,
            to: node.to,
            decoration: Decoration.mark({ class: "cm-inline-code" }),
          });
        }
      },
    });
  }

  return Decoration.set(
    ranges.map((range) => range.decoration.range(range.from, range.to)),
    true,
  );
}

function buildDetailsDecorationState(state, openStates, activeEdit) {
  const builder = new RangeSetBuilder();
  const detailsBlocks = findDetailsBlocks(state.doc);

  for (const detailsBlock of detailsBlocks) {
    if (isEditingDetailsBlock(detailsBlock, activeEdit, state.selection)) {
      continue;
    }

    const open = openStates.has(detailsBlock.key)
      ? openStates.get(detailsBlock.key)
      : detailsBlock.openByDefault;
    builder.add(
      detailsBlock.from,
      detailsBlock.to,
      Decoration.replace({
        block: true,
        widget: new DetailsPreviewWidget(detailsBlock, open),
      }),
    );
  }

  return {
    activeEdit,
    openStates,
    decorations: builder.finish(),
  };
}

function buildTableDecorationState(state, activeEdit) {
  const builder = new RangeSetBuilder();
  const tableBlocks = findTableBlocks(state.doc);
  const previewedDetailsRanges = getPreviewedDetailsRanges(state);
  let nextActiveEdit = settings.richTablePreview ? activeEdit : null;

  for (const tableBlock of tableBlocks) {
    if (
      rangeIntersectsRanges(
        tableBlock.from,
        tableBlock.sourceTo,
        previewedDetailsRanges,
      )
    ) {
      continue;
    }

    if (!settings.richTablePreview) {
      for (const row of tableBlock.sourceRows) {
        builder.add(
          row.line.from,
          row.line.from,
          Decoration.line({ class: `cm-table-line cm-table-${row.role}-line` }),
        );
        addTableLineMarks(builder, row.line, row.role);
      }
    } else if (isEditingTableBlock(tableBlock, nextActiveEdit, state.selection)) {
      nextActiveEdit = {
        from: tableBlock.from,
        to: tableBlock.sourceTo,
      };
      for (const row of tableBlock.sourceRows) {
        builder.add(
          row.line.from,
          row.line.from,
          Decoration.line({ class: `cm-table-line cm-table-${row.role}-line` }),
        );
        addTableLineMarks(builder, row.line, row.role);
      }
    } else {
      builder.add(
        tableBlock.from,
        tableBlock.to,
        Decoration.replace({
          block: true,
          widget: new TablePreviewWidget(tableBlock),
        }),
      );
    }
  }

  if (
    nextActiveEdit &&
    !tableBlocks.some((tableBlock) => tableBlock.from === nextActiveEdit.from)
  ) {
    nextActiveEdit = null;
  }

  return {
    activeEdit: nextActiveEdit,
    decorations: builder.finish(),
  };
}

function buildMermaidDecorationState(state, activeEdit) {
  const builder = new RangeSetBuilder();
  if (!settings.mermaidPreview) {
    return {
      activeEdit: null,
      decorations: builder.finish(),
    };
  }

  const mermaidBlocks = findMermaidBlocks(state.doc);
  const previewedDetailsRanges = getPreviewedDetailsRanges(state);
  let nextActiveEdit = activeEdit;

  for (const mermaidBlock of mermaidBlocks) {
    if (
      rangeIntersectsRanges(
        mermaidBlock.from,
        mermaidBlock.sourceTo,
        previewedDetailsRanges,
      )
    ) {
      continue;
    }

    if (isEditingMermaidBlock(mermaidBlock, nextActiveEdit, state.selection)) {
      nextActiveEdit = {
        from: mermaidBlock.from,
        to: mermaidBlock.sourceTo,
      };
      continue;
    }

    builder.add(
      mermaidBlock.from,
      mermaidBlock.to,
      Decoration.replace({
        block: true,
        widget: new MermaidPreviewWidget(
          mermaidBlock,
          settings.mermaidPreviewSize,
          previewDecorationRevision,
        ),
      }),
    );
  }

  if (
    nextActiveEdit &&
    !mermaidBlocks.some(
      (mermaidBlock) => mermaidBlock.from === nextActiveEdit.from,
    )
  ) {
    nextActiveEdit = null;
  }

  return {
    activeEdit: nextActiveEdit,
    decorations: builder.finish(),
  };
}

function findMermaidBlocks(doc) {
  const blocks = [];
  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const openingLine = doc.line(lineNumber);
    const opening = openingLine.text.match(/^\s{0,3}(`{3,}|~{3,})\s*mermaid\b.*$/i);
    if (!opening) {
      continue;
    }

    const fenceMarker = opening[1];
    const fenceChar = fenceMarker[0];
    const fenceLength = fenceMarker.length;
    const codeLines = [];
    let closingLine = null;

    for (let nextLineNumber = lineNumber + 1; nextLineNumber <= doc.lines; nextLineNumber += 1) {
      const nextLine = doc.line(nextLineNumber);
      const closing = nextLine.text.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
      if (closing && closing[1][0] === fenceChar && closing[1].length >= fenceLength) {
        closingLine = nextLine;
        break;
      }
      codeLines.push(nextLine.text);
    }

    if (!closingLine) {
      continue;
    }

    blocks.push({
      from: openingLine.from,
      to: closingLine.number < doc.lines
        ? doc.line(closingLine.number + 1).from
        : closingLine.to,
      sourceTo: closingLine.to,
      sourceLineCount: closingLine.number - openingLine.number + 1,
      code: codeLines.join("\n").trim(),
      signature: [
        openingLine.text,
        ...codeLines,
        closingLine.text,
      ].join("\n"),
    });
    lineNumber = closingLine.number;
  }
  return blocks;
}

function isEditingMermaidBlock(mermaidBlock, activeEdit, selection) {
  if (!activeEdit || activeEdit.from !== mermaidBlock.from) {
    return false;
  }

  return selection.ranges.some(
    (range) => range.from >= mermaidBlock.from && range.to <= mermaidBlock.sourceTo,
  );
}

function findTableBlocks(doc) {
  const blocks = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const fence = line.text.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLength = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLength) {
        inFence = false;
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }

    if (inFence || lineNumber >= doc.lines || !isTableContentLine(line.text)) {
      continue;
    }

    const delimiterLine = doc.line(lineNumber + 1);
    if (!isTableDelimiterLine(delimiterLine.text)) {
      continue;
    }

    const bodyLines = [];
    let lastLine = delimiterLine;
    let nextLineNumber = lineNumber + 2;
    while (nextLineNumber <= doc.lines) {
      const nextLine = doc.line(nextLineNumber);
      if (!isTableRowLine(nextLine.text)) {
        break;
      }
      bodyLines.push(nextLine);
      lastLine = nextLine;
      nextLineNumber += 1;
    }

    blocks.push(
      createTableBlock(doc, line, delimiterLine, bodyLines, lastLine),
    );
    lineNumber = nextLineNumber - 1;
  }

  return blocks;
}

function createTableBlock(doc, headerLine, delimiterLine, bodyLines, lastLine) {
  const headerCells = parseTableCells(headerLine);
  const delimiterCells = parseTableCells(delimiterLine);
  const bodyRows = bodyLines.map((line) => ({
    role: "body",
    line,
    cells: parseTableCells(line),
  }));
  const columnCount = Math.max(
    headerCells.length,
    delimiterCells.length,
    ...bodyRows.map((row) => row.cells.length),
  );
  const alignments = Array.from({ length: columnCount }, (_, index) =>
    parseTableAlignment(delimiterCells[index]?.text || ""),
  );
  const rows = [
    {
      role: "header",
      line: headerLine,
      cells: normalizeTableCells(headerCells, columnCount),
    },
    ...bodyRows.map((row) => ({
      ...row,
      cells: normalizeTableCells(row.cells, columnCount),
    })),
  ];

  return {
    from: headerLine.from,
    to: lastLine.to,
    sourceTo: lastLine.to,
    signature: [
      headerLine.text,
      delimiterLine.text,
      ...bodyLines.map((line) => line.text),
    ].join("\n"),
    columnCount,
    alignments,
    usesLeadingPipe: headerLine.text.trimStart().startsWith("|"),
    usesTrailingPipe: headerLine.text.trimEnd().endsWith("|"),
    rows,
    sourceRows: [
      { role: "header", line: headerLine },
      { role: "delimiter", line: delimiterLine },
      ...bodyLines.map((line) => ({ role: "body", line })),
    ],
  };
}

function parseTableCells(line) {
  const text = line.text;
  let start = 0;
  let end = text.length;
  if (text[start] === "|") start += 1;
  if (text[end - 1] === "|") end -= 1;

  const cells = [];
  let cellStart = start;
  for (let index = start; index <= end; index += 1) {
    if (index !== end && text[index] !== "|") {
      continue;
    }

    const raw = text.slice(cellStart, index);
    const leadingLength = raw.match(/^\s*/)[0].length;
    const trailingLength = raw.match(/\s*$/)[0].length;
    const contentFrom = line.from + cellStart + leadingLength;
    const contentTo = line.from + index - trailingLength;
    cells.push({
      text: raw.trim(),
      from: Math.min(contentFrom, contentTo),
      to: Math.max(contentFrom, contentTo),
    });
    cellStart = index + 1;
  }

  return cells;
}

function normalizeTableCells(cells, columnCount) {
  return Array.from(
    { length: columnCount },
    (_, index) => cells[index] || { text: "", from: null, to: null },
  );
}

function parseTableAlignment(delimiterCell) {
  const value = delimiterCell.trim();
  const starts = value.startsWith(":");
  const ends = value.endsWith(":");
  if (starts && ends) return "center";
  if (ends) return "right";
  return "left";
}

function isEditingTableBlock(tableBlock, activeEdit, selection) {
  if (!activeEdit || activeEdit.from !== tableBlock.from) {
    return false;
  }

  const inside = selection.ranges.some(
    (range) => range.from >= tableBlock.from && range.to <= tableBlock.sourceTo,
  );
  if (!inside) {
    return false;
  }

  return true;
}

function selectionInsideRange(selection, from, to) {
  return selection.ranges.some((range) => range.from >= from && range.to <= to);
}

function addTableLineMarks(builder, line, tableRole) {
  const cellClass =
    tableRole === "header"
      ? "cm-table-header-cell"
      : tableRole === "delimiter"
        ? "cm-table-delimiter-text"
        : "cm-table-cell";

  let segmentStart = 0;
  for (let index = 0; index < line.text.length; index += 1) {
    if (line.text[index] !== "|") {
      continue;
    }

    if (segmentStart < index) {
      builder.add(
        line.from + segmentStart,
        line.from + index,
        Decoration.mark({ class: cellClass }),
      );
    }
    builder.add(
      line.from + index,
      line.from + index + 1,
      Decoration.mark({ class: "cm-table-pipe" }),
    );
    segmentStart = index + 1;
  }

  if (segmentStart < line.text.length) {
    builder.add(
      line.from + segmentStart,
      line.to,
      Decoration.mark({ class: cellClass }),
    );
  }
}

class DetailsPreviewWidget extends WidgetType {
  constructor(detailsBlock, open) {
    super();
    this.detailsBlock = detailsBlock;
    this.open = open;
  }

  eq(other) {
    return (
      other.detailsBlock.from === this.detailsBlock.from &&
      other.detailsBlock.to === this.detailsBlock.to &&
      other.detailsBlock.signature === this.detailsBlock.signature &&
      other.open === this.open
    );
  }

  toDOM(view) {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-details-preview";

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "cm-details-summary";
    summary.setAttribute("aria-expanded", String(this.open));

    const disclosure = document.createElement("span");
    disclosure.className = "cm-details-disclosure";
    disclosure.textContent = this.open ? "⌄" : "›";

    const label = document.createElement("span");
    label.textContent = this.detailsBlock.summary;

    summary.appendChild(disclosure);
    summary.appendChild(label);
    wrapper.appendChild(summary);

    if (this.open) {
      const body = document.createElement("div");
      body.className = "cm-details-body";
      const bodyLines = this.detailsBlock.bodyLines.filter((line) =>
        getDetailsBodyLineText(line).trim(),
      );
      if (bodyLines.length === 0) {
        const emptyLine = document.createElement("p");
        emptyLine.className = "cm-details-body-line";
        emptyLine.textContent = "No content";
        emptyLine.dataset.sourceFrom = String(this.detailsBlock.from);
        body.appendChild(emptyLine);
      } else {
        for (const [index, line] of bodyLines.entries()) {
          const paragraph = document.createElement("p");
          paragraph.className = "cm-details-body-line";
          paragraph.dataset.sourceFrom = String(
            this.getBodyLinePosition(line, index),
          );
          appendInlineMarkdown(paragraph, getDetailsBodyLineText(line));
          body.appendChild(paragraph);
        }
      }
      body.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      body.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const line =
          event.target instanceof Element
            ? event.target.closest("[data-source-from]")
            : null;
        const sourceFrom = line?.dataset.sourceFrom
          ? Number(line.dataset.sourceFrom)
          : this.detailsBlock.from;
        this.focusSource(view, sourceFrom);
      });
      wrapper.appendChild(body);
    }

    summary.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggle(view);
    });
    wrapper.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.focusSource(view, this.detailsBlock.from);
    });

    return wrapper;
  }

  toggle(view) {
    view.dispatch({
      effects: toggleDetailsPreview.of({
        key: this.detailsBlock.key,
        open: !this.open,
      }),
    });
    requestEditorMeasure(view);
  }

  getBodyLinePosition(line, lineIndex) {
    if (line.sourceFrom !== null && line.sourceFrom !== undefined) {
      return line.sourceFrom;
    }
    return this.detailsBlock.from + lineIndex;
  }

  focusSource(view, sourceFrom = this.detailsBlock.from) {
    view.dispatch({
      effects: setActiveDetailsEdit.of({
        from: this.detailsBlock.from,
        to: this.detailsBlock.sourceTo,
      }),
      selection: {
        anchor: Math.max(0, Math.min(sourceFrom, view.state.doc.length)),
      },
      scrollIntoView: true,
    });
    view.focus();
  }

  ignoreEvent() {
    return false;
  }
}

class TablePreviewWidget extends WidgetType {
  constructor(tableBlock) {
    super();
    this.tableBlock = tableBlock;
  }

  eq(other) {
    return (
      other.tableBlock.from === this.tableBlock.from &&
      other.tableBlock.to === this.tableBlock.to &&
      other.tableBlock.signature === this.tableBlock.signature
    );
  }

  toDOM(view) {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-rich-table-preview";
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("tabindex", "0");
    wrapper.title = "Edit table cells";
    wrapper.dataset.dirty = "false";

    const scroll = document.createElement("div");
    scroll.className = "cm-rich-table-scroll";

    const table = document.createElement("table");
    table.className = "cm-rich-table";

    const headerRow = this.tableBlock.rows[0];
    const thead = document.createElement("thead");
    thead.appendChild(this.renderRow(headerRow, "th", 0, view));
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (
      let rowIndex = 1;
      rowIndex < this.tableBlock.rows.length;
      rowIndex += 1
    ) {
      tbody.appendChild(
        this.renderRow(this.tableBlock.rows[rowIndex], "td", rowIndex, view),
      );
    }
    table.appendChild(tbody);

    scroll.appendChild(table);
    wrapper.appendChild(scroll);

    const toolbar = document.createElement("div");
    toolbar.className = "cm-rich-table-toolbar";

    const addRowButton = document.createElement("button");
    addRowButton.type = "button";
    addRowButton.className = "cm-rich-table-action";
    addRowButton.title = "Add row";
    addRowButton.innerHTML =
      '<span class="cm-rich-table-action-icon">+</span><span>Row</span>';
    addRowButton.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    addRowButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.addRowFromPreview(view, wrapper);
    });

    toolbar.appendChild(addRowButton);
    wrapper.appendChild(toolbar);

    wrapper.addEventListener("input", (event) => {
      if (event.target.closest(".cm-rich-table-cell-editor")) {
        wrapper.dataset.dirty = "true";
      }
    });
    wrapper.addEventListener("contextmenu", (event) => {
      const cell = event.target.closest(".cm-rich-table-cell");
      if (!cell || !wrapper.contains(cell)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const rowIndex = Number.parseInt(cell.dataset.rowIndex || "0", 10);
      const columnIndex = Number.parseInt(cell.dataset.columnIndex || "0", 10);
      showTableContextMenu({
        x: event.clientX,
        y: event.clientY,
        rowIndex,
        columnIndex,
        columnCount: this.tableBlock.columnCount,
        onAction: (action) => {
          this.applyTableContextAction(
            view,
            wrapper,
            rowIndex,
            columnIndex,
            action,
          );
        },
      });
    });
    wrapper.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (!wrapper.contains(document.activeElement)) {
          this.commitTableEdits(view, wrapper);
        }
      }, 0);
    });

    queueMicrotask(() => requestEditorMeasure(view));
    return wrapper;
  }

  renderRow(row, cellTag, rowIndex, view) {
    const tr = document.createElement("tr");
    tr.dataset.rowIndex = String(rowIndex);

    for (
      let columnIndex = 0;
      columnIndex < this.tableBlock.columnCount;
      columnIndex += 1
    ) {
      const sourceCell = row.cells[columnIndex];
      const cell = document.createElement(cellTag);
      cell.classList.add("cm-rich-table-cell");
      cell.dataset.rowIndex = String(rowIndex);
      cell.dataset.columnIndex = String(columnIndex);
      const alignment = this.tableBlock.alignments[columnIndex];
      if (alignment === "center") cell.classList.add("align-center");
      if (alignment === "right") cell.classList.add("align-right");
      if (sourceCell.from !== null) {
        cell.dataset.sourceFrom = String(sourceCell.from);
      }
      const preview = document.createElement("div");
      preview.className = "cm-rich-table-cell-preview";
      preview.dataset.rowIndex = String(rowIndex);
      preview.dataset.columnIndex = String(columnIndex);
      renderRichTableCellPreview(preview, sourceCell.text, view);

      const editor = document.createElement("div");
      editor.className = "cm-rich-table-cell-editor";
      editor.contentEditable = "plaintext-only";
      editor.spellcheck = true;
      editor.dataset.rowIndex = String(rowIndex);
      editor.dataset.columnIndex = String(columnIndex);
      editor.textContent = sourceCell.text;
      preview.addEventListener("mousedown", (event) => {
        if (isRichTablePreviewInteractiveTarget(event.target)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        activateRichTableCellEditor(editor);
      });
      editor.addEventListener("focus", () => {
        activateRichTableCellEditor(editor, { focus: false });
      });
      editor.addEventListener("blur", () => {
        window.setTimeout(() => {
          deactivateRichTableCellEditor(editor);
        }, 0);
      });
      editor.addEventListener("input", () => {
        renderRichTableCellPreview(
          editor.previousElementSibling,
          editor.textContent,
          view,
        );
      });
      editor.addEventListener("keydown", (event) => {
        this.handleCellKeydown(event);
      });
      cell.appendChild(preview);
      cell.appendChild(editor);
      tr.appendChild(cell);
    }

    return tr;
  }

  handleCellKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const wrapper = event.currentTarget.closest(".cm-rich-table-preview");
    if (!wrapper) {
      return;
    }
    const editors = [
      ...wrapper.querySelectorAll(".cm-rich-table-cell-editor"),
    ];
    const currentIndex = editors.indexOf(event.currentTarget);
    if (currentIndex === -1) {
      return;
    }

    event.preventDefault();
    const delta = event.shiftKey ? -1 : 1;
    const nextEditor =
      editors[(currentIndex + delta + editors.length) % editors.length];
    activateRichTableCellEditor(nextEditor, { select: true });
  }

  focusSource(view, sourceFrom) {
    const fallbackCell = this.tableBlock.rows
      .flatMap((row) => row.cells)
      .find((cell) => cell.from !== null);
    const target =
      sourceFrom === this.tableBlock.from && fallbackCell
        ? fallbackCell.from
        : sourceFrom;
    const anchor = Math.max(0, Math.min(target, view.state.doc.length));
    view.dispatch({
      effects: setActiveTableEdit.of({
        from: this.tableBlock.from,
        to: this.tableBlock.sourceTo,
      }),
      selection: { anchor },
      scrollIntoView: true,
    });
    view.focus();
  }

  addRow(view) {
    const rowText = buildEmptyTableRow(this.tableBlock);
    const insertText = `\n${rowText}`;
    const anchor = this.tableBlock.to + insertText.length;
    view.dispatch({
      changes: {
        from: this.tableBlock.sourceTo,
        insert: insertText,
      },
      effects: setActiveTableEdit.of(null),
      selection: { anchor },
      scrollIntoView: true,
    });
    view.focus();
  }

  addRowFromPreview(view, wrapper) {
    const rows = collectEditableTableRows(wrapper, this.tableBlock);
    rows.push(Array.from({ length: this.tableBlock.columnCount }, () => ""));
    this.replaceTable(view, rows);
  }

  applyTableContextAction(view, wrapper, rowIndex, columnIndex, action) {
    const rows = collectEditableTableRows(wrapper, this.tableBlock);
    const alignments = [...this.tableBlock.alignments];
    const columnCount = Math.max(1, this.tableBlock.columnCount);

    if (action === "add-column-left" || action === "add-column-right") {
      const insertAt =
        action === "add-column-left"
          ? Math.max(0, Math.min(columnIndex, columnCount))
          : Math.min(columnIndex + 1, columnCount);
      rows.forEach((row) => row.splice(insertAt, 0, ""));
      alignments.splice(insertAt, 0, "left");
    } else if (action === "delete-column") {
      if (columnCount <= 1) {
        return;
      }
      const deleteAt = Math.max(0, Math.min(columnIndex, columnCount - 1));
      rows.forEach((row) => row.splice(deleteAt, 1));
      alignments.splice(deleteAt, 1);
    } else if (action === "add-row-above" || action === "add-row-below") {
      if (rowIndex <= 0) {
        return;
      }
      const insertAt =
        action === "add-row-above"
          ? Math.max(1, Math.min(rowIndex, rows.length))
          : Math.min(rowIndex + 1, rows.length);
      rows.splice(
        insertAt,
        0,
        Array.from({ length: alignments.length }, () => ""),
      );
    } else if (action === "delete-row") {
      if (rowIndex <= 0 || rowIndex >= rows.length) {
        return;
      }
      rows.splice(rowIndex, 1);
    } else {
      return;
    }

    this.replaceTable(view, rows, alignments);
  }

  commitTableEdits(view, wrapper) {
    if (wrapper.dataset.dirty !== "true") {
      return;
    }
    const rows = collectEditableTableRows(wrapper, this.tableBlock);
    this.replaceTable(view, rows);
  }

  replaceTable(view, rows, alignments = this.tableBlock.alignments) {
    const nextText = serializeMarkdownTable(this.tableBlock, rows, alignments);
    const currentText = view.state.doc.sliceString(
      this.tableBlock.from,
      this.tableBlock.sourceTo,
    );
    if (nextText === currentText) {
      return;
    }
    view.dispatch({
      changes: {
        from: this.tableBlock.from,
        to: this.tableBlock.sourceTo,
        insert: nextText,
      },
      effects: setActiveTableEdit.of(null),
      selection: {
        anchor: Math.min(
          this.tableBlock.from + nextText.length,
          view.state.doc.length,
        ),
      },
    });
    requestEditorMeasure(view);
  }

  ignoreEvent() {
    return true;
  }
}

function showTableContextMenu({
  x,
  y,
  rowIndex,
  columnIndex,
  columnCount,
  onAction,
}) {
  closeTableContextMenu();

  const menu = document.createElement("div");
  menu.className = "cm-table-context-menu";
  menu.setAttribute("role", "menu");

  const addItem = (label, action, disabled = false) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "cm-table-context-menu-item";
    item.textContent = label;
    item.disabled = disabled;
    item.setAttribute("role", "menuitem");
    item.addEventListener("mousedown", stopInteractiveEvent);
    item.addEventListener("click", (event) => {
      stopInteractiveEvent(event);
      if (item.disabled) {
        return;
      }
      closeTableContextMenu();
      onAction(action);
    });
    menu.appendChild(item);
  };

  addItem("Add column left", "add-column-left");
  addItem("Add column right", "add-column-right");
  addItem("Delete column", "delete-column", columnCount <= 1);

  if (rowIndex > 0) {
    const divider = document.createElement("div");
    divider.className = "cm-table-context-menu-divider";
    menu.appendChild(divider);
    addItem("Add row above", "add-row-above");
    addItem("Add row below", "add-row-below");
    addItem("Delete row", "delete-row");
  }

  document.body.appendChild(menu);
  tableContextMenu = menu;
  positionFixedMenu(menu, x, y);
}

function positionFixedMenu(menu, x, y) {
  const margin = 8;
  const menuWidth = menu.offsetWidth || 184;
  const menuHeight = menu.offsetHeight || 120;
  const left = Math.max(
    margin,
    Math.min(x, window.innerWidth - menuWidth - margin),
  );
  const top = Math.max(
    margin,
    Math.min(y, window.innerHeight - menuHeight - margin),
  );
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function closeTableContextMenu() {
  if (!tableContextMenu) {
    return false;
  }
  tableContextMenu.remove();
  tableContextMenu = null;
  return true;
}

function renderRichTableCellPreview(preview, text, view) {
  if (!preview) {
    return;
  }
  preview.replaceChildren();
  appendInlineMarkdown(preview, text, {
    renderImages: true,
    onImageReady: () => requestEditorMeasure(view),
  });
}

function isRichTablePreviewInteractiveTarget(target) {
  return Boolean(target.closest("a, img"));
}

function activateRichTableCellEditor(editor, options = {}) {
  const cell = editor.closest(".cm-rich-table-cell");
  if (!cell) {
    return;
  }
  const table = cell.closest(".cm-rich-table-preview");
  if (table) {
    for (const activeCell of table.querySelectorAll(
      ".cm-rich-table-cell.is-editing",
    )) {
      if (activeCell !== cell) {
        activeCell.classList.remove("is-editing");
      }
    }
  }

  cell.classList.add("is-editing");
  if (options.focus !== false && document.activeElement !== editor) {
    editor.focus({ preventScroll: true });
  }
  if (options.select) {
    selectEditableText(editor);
  } else if (options.focus !== false) {
    placeCaretAtEnd(editor);
  }
}

function deactivateRichTableCellEditor(editor) {
  if (document.activeElement === editor) {
    return;
  }
  const cell = editor.closest(".cm-rich-table-cell");
  if (cell) {
    cell.classList.remove("is-editing");
  }
}

function buildEmptyTableRow(tableBlock) {
  const cells = Array.from({ length: tableBlock.columnCount }, () => "");
  if (tableBlock.usesLeadingPipe || tableBlock.usesTrailingPipe) {
    return `| ${cells.join(" | ")} |`;
  }
  return cells.map(() => " ").join(" | ");
}

function collectEditableTableRows(wrapper, tableBlock) {
  return tableBlock.rows.map((row, rowIndex) =>
    Array.from({ length: tableBlock.columnCount }, (_, columnIndex) => {
      const editor = wrapper.querySelector(
        `.cm-rich-table-cell-editor[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
      );
      return normalizeEditedTableCellText(editor?.textContent || "");
    }),
  );
}

function serializeMarkdownTable(
  tableBlock,
  rows,
  alignments = tableBlock.alignments,
) {
  const columnCount = Math.max(
    1,
    alignments.length,
    ...rows.map((row) => row.length),
  );
  const normalizedAlignments = Array.from(
    { length: columnCount },
    (_, index) => alignments[index] || "left",
  );
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] || ""),
  );
  const header =
    normalizedRows[0] || Array.from({ length: columnCount }, () => "");
  const bodyRows = normalizedRows.slice(1);
  return [
    formatMarkdownTableRow(tableBlock, header),
    formatMarkdownTableRow(
      tableBlock,
      buildTableDelimiterCells(normalizedAlignments),
    ),
    ...bodyRows.map((row) => formatMarkdownTableRow(tableBlock, row)),
  ].join("\n");
}

function buildTableDelimiterCells(alignments) {
  return alignments.map((alignment) => {
    if (alignment === "center") return ":---:";
    if (alignment === "right") return "---:";
    return "---";
  });
}

function formatMarkdownTableRow(tableBlock, cells) {
  const segments = cells.map((cell) => ` ${normalizeEditedTableCellText(cell)} `);
  const row = segments.join("|");
  if (tableBlock.usesLeadingPipe || tableBlock.usesTrailingPipe) {
    return `|${row}|`;
  }
  return row;
}

function normalizeEditedTableCellText(text) {
  return text
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function selectEditableText(element) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtEnd(element) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

class MermaidPreviewWidget extends WidgetType {
  constructor(mermaidBlock, previewSize, revision) {
    super();
    this.mermaidBlock = mermaidBlock;
    this.previewSize = normalizeMermaidPreviewSize(previewSize);
    this.revision = revision;
  }

  eq(other) {
    return (
      other.mermaidBlock.from === this.mermaidBlock.from &&
      other.mermaidBlock.to === this.mermaidBlock.to &&
      other.mermaidBlock.signature === this.mermaidBlock.signature &&
      other.previewSize === this.previewSize &&
      other.revision === this.revision
    );
  }

  toDOM(view) {
    const wrapper = document.createElement("div");
    wrapper.className = `cm-mermaid-preview is-${this.previewSize}`;
    wrapper.setAttribute("role", "button");
    wrapper.setAttribute("tabindex", "0");
    wrapper.title = "Click to edit Mermaid diagram";
    let viewportController = null;
    const lineHeight = getEditorLineHeight(view);
    const sourceHeight = this.mermaidBlock.sourceLineCount * lineHeight;
    wrapper.style.setProperty(
      "--mermaid-source-height",
      `${getMermaidPreviewHeight(
        sourceHeight,
        this.previewSize,
        this.mermaidBlock.code,
      )}px`,
    );

    const toolbar = createMermaidPreviewToolbar({
      onZoomOut: () => viewportController?.zoomBy(0.82),
      onZoomIn: () => viewportController?.zoomBy(1.22),
      onFit: () => viewportController?.fit(),
      onOpen: () => {
        if (this.svgMarkup) {
          openMermaidModal(this.svgMarkup);
        }
      },
    });

    const output = document.createElement("div");
    output.className = "cm-mermaid-output";

    const status = document.createElement("div");
    status.className = "cm-mermaid-status";
    status.textContent = this.mermaidBlock.code
      ? "Rendering Mermaid..."
      : "Empty Mermaid diagram";
    output.appendChild(status);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(output);

    wrapper.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    wrapper.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      this.focusSource(view);
    });
    wrapper.addEventListener("click", (event) => {
      if (event.defaultPrevented) {
        return;
      }
      this.focusSource(view);
    });

    if (this.mermaidBlock.code) {
      this.render(output, view, (controller) => {
        viewportController = controller;
      });
    }

    return wrapper;
  }

  async render(output, view, setController) {
    try {
      const mermaid = await loadMermaid();
      const id = `richdown-mermaid-${this.mermaidBlock.from}-${Math.random()
        .toString(36)
        .slice(2)}`;
      const result = await mermaid.render(id, this.mermaidBlock.code);
      this.svgMarkup = result.svg;
      const { canvas, stage } = createMermaidCanvas(result.svg, "cm-mermaid");
      output.replaceChildren(canvas);
      if (typeof result.bindFunctions === "function") {
        result.bindFunctions(stage);
      }
      const controller = new MermaidViewportController(canvas, stage, {
        maxScale: 6,
        fitMaxScale: 1,
        scrollable: true,
      });
      setController(controller);
      controller.fit();
      requestEditorMeasure(view);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      const pre = document.createElement("pre");
      pre.className = "cm-mermaid-error";
      pre.textContent = message;
      output.replaceChildren(pre);
      requestEditorMeasure(view);
    }
  }

  focusSource(view) {
    const anchor = Math.min(
      view.state.doc.length,
      this.mermaidBlock.from + "```mermaid\n".length,
    );
    view.dispatch({
      effects: setActiveMermaidEdit.of({
        from: this.mermaidBlock.from,
        to: this.mermaidBlock.sourceTo,
      }),
      selection: { anchor },
      scrollIntoView: true,
    });
    view.focus();
  }

  ignoreEvent() {
    return false;
  }
}

function createMermaidPreviewToolbar(actions) {
  const toolbar = document.createElement("div");
  toolbar.className = "cm-mermaid-toolbar";
  toolbar.addEventListener("mousedown", stopInteractiveEvent);
  toolbar.addEventListener("click", stopInteractiveEvent);

  toolbar.appendChild(
    createMermaidToolButton("-", "Zoom out", actions.onZoomOut),
  );
  toolbar.appendChild(
    createMermaidToolButton("+", "Zoom in", actions.onZoomIn),
  );
  toolbar.appendChild(createMermaidToolButton("Fit", "Fit diagram", actions.onFit));
  toolbar.appendChild(
    createMermaidToolButton("□", "Open diagram", actions.onOpen),
  );
  return toolbar;
}

function createMermaidToolButton(label, title, action, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `cm-mermaid-tool-button${className ? ` ${className}` : ""}`;
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("mousedown", stopInteractiveEvent);
  button.addEventListener("click", (event) => {
    stopInteractiveEvent(event);
    action();
  });
  return button;
}

function stopInteractiveEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

function createMermaidCanvas(svgMarkup, classPrefix) {
  const canvas = document.createElement("div");
  canvas.className = `${classPrefix}-canvas`;

  const stage = document.createElement("div");
  stage.className = `${classPrefix}-stage`;
  stage.innerHTML = svgMarkup;

  const svg = stage.querySelector("svg");
  const size = getSvgNaturalSize(svg);
  stage.style.width = `${size.width}px`;
  stage.style.height = `${size.height}px`;
  if (svg) {
    svg.style.maxWidth = "none";
    svg.style.maxHeight = "none";
    svg.style.width = "100%";
    svg.style.height = "100%";
  }

  canvas.appendChild(stage);
  return { canvas, stage };
}

function getSvgNaturalSize(svg) {
  if (!svg) {
    return { width: 800, height: 480 };
  }

  const viewBox = svg.viewBox && svg.viewBox.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const width = parseSvgLength(svg.getAttribute("width"));
  const height = parseSvgLength(svg.getAttribute("height"));
  if (width > 0 && height > 0) {
    return { width, height };
  }

  return { width: 800, height: 480 };
}

function parseSvgLength(value) {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(String(value).replace("px", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

class MermaidViewportController {
  constructor(container, stage, options = {}) {
    this.container = container;
    this.stage = stage;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.minScale = options.minScale ?? 0.08;
    this.maxScale = options.maxScale ?? 8;
    this.fitMaxScale = options.fitMaxScale ?? 2;
    this.scrollable = options.scrollable === true;
    this.dragging = false;

    const width = parseSvgLength(stage.style.width);
    const height = parseSvgLength(stage.style.height);
    this.naturalWidth = width || 800;
    this.naturalHeight = height || 480;

    if (options.enableMouse) {
      this.bindMouse();
    }

    window.setTimeout(() => this.fit(), 0);
  }

  fit() {
    const bounds = this.container.getBoundingClientRect();
    const scale = Math.min(
      bounds.width / this.naturalWidth,
      bounds.height / this.naturalHeight,
      this.fitMaxScale,
    );
    this.scale = clamp(scale || 1, this.minScale, this.maxScale);
    if (this.scrollable) {
      this.apply();
      this.container.scrollLeft = 0;
      this.container.scrollTop = 0;
      return;
    }
    this.panX = (bounds.width - this.naturalWidth * this.scale) / 2;
    this.panY = (bounds.height - this.naturalHeight * this.scale) / 2;
    this.apply();
  }

  zoomBy(factor, center) {
    const bounds = this.container.getBoundingClientRect();
    if (this.scrollable) {
      const anchor = center || {
        x: bounds.width / 2,
        y: bounds.height / 2,
      };
      const centerX = this.container.scrollLeft + anchor.x;
      const centerY = this.container.scrollTop + anchor.y;
      const nextScale = clamp(
        this.scale * factor,
        this.minScale,
        this.maxScale,
      );
      const ratio = nextScale / this.scale;
      this.scale = nextScale;
      this.apply();
      this.container.scrollLeft = centerX * ratio - anchor.x;
      this.container.scrollTop = centerY * ratio - anchor.y;
      return;
    }
    const anchor = center || {
      x: bounds.width / 2,
      y: bounds.height / 2,
    };
    const nextScale = clamp(
      this.scale * factor,
      this.minScale,
      this.maxScale,
    );
    const ratio = nextScale / this.scale;
    this.panX = anchor.x - (anchor.x - this.panX) * ratio;
    this.panY = anchor.y - (anchor.y - this.panY) * ratio;
    this.scale = nextScale;
    this.apply();
  }

  panBy(dx, dy) {
    if (this.scrollable) {
      this.container.scrollLeft -= dx;
      this.container.scrollTop -= dy;
      return;
    }
    this.panX += dx;
    this.panY += dy;
    this.apply();
  }

  apply() {
    if (this.scrollable) {
      const width = this.naturalWidth * this.scale;
      const height = this.naturalHeight * this.scale;
      this.stage.style.width = `${width}px`;
      this.stage.style.height = `${height}px`;
      this.stage.style.left = `${Math.max(
        0,
        (this.container.clientWidth - width) / 2,
      )}px`;
      this.stage.style.top = `${Math.max(
        0,
        (this.container.clientHeight - height) / 2,
      )}px`;
      this.stage.style.transform = "none";
      return;
    }
    this.stage.style.width = `${this.naturalWidth}px`;
    this.stage.style.height = `${this.naturalHeight}px`;
    this.stage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }

  bindMouse() {
    this.container.addEventListener("wheel", (event) => {
      event.preventDefault();
      const bounds = this.container.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      this.zoomBy(factor, {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    });

    this.container.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.container.classList.add("is-dragging");
      this.container.setPointerCapture(event.pointerId);
    });

    this.container.addEventListener("pointermove", (event) => {
      if (!this.dragging) {
        return;
      }
      event.preventDefault();
      this.panBy(event.clientX - this.lastX, event.clientY - this.lastY);
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });

    const stopDrag = (event) => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      this.container.classList.remove("is-dragging");
      if (event.pointerId !== undefined) {
        this.container.releasePointerCapture(event.pointerId);
      }
    };
    this.container.addEventListener("pointerup", stopDrag);
    this.container.addEventListener("pointercancel", stopDrag);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function openMermaidModal(svgMarkup) {
  document.querySelector(".cm-mermaid-modal-backdrop")?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "cm-mermaid-modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "cm-mermaid-modal";

  const toolbar = document.createElement("div");
  toolbar.className = "cm-mermaid-modal-toolbar";

  const title = document.createElement("div");
  title.className = "cm-mermaid-modal-title";
  title.textContent = "Mermaid diagram";

  const controls = document.createElement("div");
  controls.className = "cm-mermaid-modal-controls";

  const { canvas, stage } = createMermaidCanvas(svgMarkup, "cm-mermaid-modal");
  const controller = new MermaidViewportController(canvas, stage, {
    maxScale: 10,
    fitMaxScale: 2,
    enableMouse: true,
  });

  const close = () => backdrop.remove();
  const buttons = [
    ["-", "Zoom out", () => controller.zoomBy(0.82)],
    ["+", "Zoom in", () => controller.zoomBy(1.22)],
    ["Fit", "Fit diagram", () => controller.fit()],
    ["←", "Move left", () => controller.panBy(-80, 0)],
    ["↑", "Move up", () => controller.panBy(0, -80)],
    ["↓", "Move down", () => controller.panBy(0, 80)],
    ["→", "Move right", () => controller.panBy(80, 0)],
    ["×", "Close", close],
  ];
  for (const [label, buttonTitle, action] of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-mermaid-modal-button";
    button.textContent = label;
    button.title = buttonTitle;
    button.setAttribute("aria-label", buttonTitle);
    button.addEventListener("click", (event) => {
      stopInteractiveEvent(event);
      action();
    });
    controls.appendChild(button);
  }

  toolbar.appendChild(title);
  toolbar.appendChild(controls);
  modal.appendChild(toolbar);
  modal.appendChild(canvas);
  backdrop.appendChild(modal);

  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) {
      close();
    }
  });
  window.addEventListener(
    "keydown",
    function closeOnEscape(event) {
      if (event.key !== "Escape") {
        return;
      }
      close();
      window.removeEventListener("keydown", closeOnEscape, true);
    },
    true,
  );

  document.body.appendChild(backdrop);
  window.setTimeout(() => controller.fit(), 0);
}

function getEditorLineHeight(view) {
  const style = getComputedStyle(view.contentDOM);
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }

  const fontSize = Number.parseFloat(style.fontSize);
  return Number.isFinite(fontSize) ? fontSize * 1.72 : 25.8;
}

function requestEditorMeasure(view) {
  if (view && typeof view.requestMeasure === "function") {
    view.requestMeasure();
  }
}

function getMermaidPreviewHeight(sourceHeight, previewSize, code = "") {
  if (previewSize === "source") {
    return sourceHeight;
  }
  if (previewSize === "large") {
    return Math.max(sourceHeight, estimateLargeMermaidPreviewHeight(code));
  }
  return Math.max(sourceHeight, 260);
}

function estimateLargeMermaidPreviewHeight(code) {
  const lines = code.split(/\r?\n/).filter((line) => line.trim());
  const nodeLikeLines = lines.filter((line) =>
    /(?:-->|---|==>|-.->|::|subgraph\b|\w+\s*(?:\[|\(|\{|\>))/i.test(line),
  ).length;
  const complexity = Math.max(lines.length, nodeLikeLines);
  return Math.max(320, Math.min(620, 260 + complexity * 18));
}

function loadMermaid() {
  if (window.__richdownMermaid) {
    return Promise.resolve(window.__richdownMermaid);
  }

  if (!mermaidLoadPromise) {
    mermaidLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = mermaidScriptUri;
      script.onload = () => {
        const mermaid = window.__richdownMermaid;
        if (!mermaid) {
          reject(new Error("Mermaid loader did not expose Mermaid."));
          return;
        }
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: document.documentElement.dataset.richTheme === "default"
            ? "default"
            : "dark",
        });
        resolve(mermaid);
      };
      script.onerror = () => {
        reject(new Error("Failed to load Mermaid renderer."));
      };
      document.head.appendChild(script);
    });
  }

  return mermaidLoadPromise;
}

function appendInlineMarkdown(parent, text, options = {}) {
  const pattern =
    /!\[(?<imageAlt>[^\]]*)\]\(\s*(?:<(?<imageSrcAngle>[^>]+)>|(?<imageSrc>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|`(?<code>[^`]+)`|\*\*(?<boldStar>[^*]+)\*\*|__(?<boldUnderscore>[^_]+)__|\*(?<italicStar>[^*\s][^*]*?)\*|_(?<italicUnderscore>[^_\s][^_]*?)_|~~(?<strike>[^~]+)~~|\[(?<linkText>[^\]]+)\]\(\s*(?:<(?<linkHrefAngle>[^>]+)>|(?<linkHref>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|(?<bareUrl>https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const groups = match.groups || {};
    if (match.index > lastIndex) {
      parent.appendChild(
        document.createTextNode(text.slice(lastIndex, match.index)),
      );
    }

    if (groups.imageAlt !== undefined) {
      const src = groups.imageSrcAngle || groups.imageSrc || "";
      if (options.renderImages) {
        parent.appendChild(
          createInlineMarkdownImage(src, groups.imageAlt, options.onImageReady),
        );
      } else {
        parent.appendChild(document.createTextNode(match[0]));
      }
    } else if (groups.code !== undefined) {
      const code = document.createElement("code");
      code.textContent = groups.code;
      parent.appendChild(code);
    } else if (
      groups.boldStar !== undefined ||
      groups.boldUnderscore !== undefined
    ) {
      const strong = document.createElement("strong");
      strong.textContent = groups.boldStar ?? groups.boldUnderscore;
      parent.appendChild(strong);
    } else if (
      groups.italicStar !== undefined ||
      groups.italicUnderscore !== undefined
    ) {
      const emphasis = document.createElement("em");
      emphasis.textContent = groups.italicStar ?? groups.italicUnderscore;
      parent.appendChild(emphasis);
    } else if (groups.strike !== undefined) {
      const strike = document.createElement("s");
      strike.textContent = groups.strike;
      parent.appendChild(strike);
    } else if (groups.linkText !== undefined || groups.bareUrl !== undefined) {
      const href =
        groups.bareUrl || groups.linkHrefAngle || groups.linkHref || "";
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = groups.linkText || href;
      link.title = href;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        vscode.postMessage({ type: "openLink", href });
      });
      parent.appendChild(link);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function createInlineMarkdownImage(src, alt, onImageReady) {
  const wrapper = document.createElement("span");
  wrapper.className = "cm-inline-markdown-image";
  wrapper.title = src;

  const image = document.createElement("img");
  image.alt = alt || src;

  const error = document.createElement("span");
  error.className = "cm-inline-markdown-image-error";
  error.hidden = true;
  error.textContent = alt || src;

  resolveImageSource(src)
    .then((uri) => {
      image.src = uri;
      onImageReady?.();
    })
    .catch(() => {
      image.remove();
      error.hidden = false;
      onImageReady?.();
    });

  image.addEventListener("load", () => {
    onImageReady?.();
  });
  image.addEventListener("error", () => {
    image.remove();
    error.hidden = false;
    onImageReady?.();
  });
  image.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    vscode.postMessage({ type: "openLink", href: src });
  });

  wrapper.appendChild(image);
  wrapper.appendChild(error);
  return wrapper;
}

function findMarkdownImages(text) {
  const images = [];
  const pattern =
    /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

  for (const match of text.matchAll(pattern)) {
    images.push({
      from: match.index,
      to: match.index + match[0].length,
      alt: match[1] || "",
      src: match[2] || match[3] || "",
    });
  }

  return images;
}

function isRangeInsideRanges(from, to, ranges) {
  return ranges.some((range) => from >= range.from && to <= range.to);
}

class ListMarkerWidget extends WidgetType {
  constructor(listMarker) {
    super();
    this.marker = listMarker.marker;
    this.ordered = listMarker.ordered;
    this.level = listMarker.level;
  }

  eq(other) {
    return (
      other.marker === this.marker &&
      other.ordered === this.ordered &&
      other.level === this.level
    );
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = `cm-list-marker ${
      this.ordered ? "is-ordered" : "is-unordered"
    }`;
    marker.textContent = this.ordered
      ? this.marker
      : getUnorderedListSymbol(this.level);
    return marker;
  }

  ignoreEvent() {
    return false;
  }
}

function getUnorderedListSymbol(level) {
  return ["•", "◦", "▪", "‣"][level % 4];
}

class SlashCommandMenu {
  constructor(view, from, to) {
    this.view = view;
    this.from = from;
    this.to = to;
    this.activeIndex = 0;
    this.dom = document.createElement("div");
    this.dom.className = "cm-slash-menu";
    this.dom.setAttribute("role", "listbox");
    this.render();
    document.body.appendChild(this.dom);
    this.position();
  }

  render() {
    this.dom.textContent = "";
    slashCommands.forEach((command, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `cm-slash-menu-item${
        index === this.activeIndex ? " is-active" : ""
      }`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(index === this.activeIndex));

      const label = document.createElement("span");
      label.className = "cm-slash-menu-label";
      label.textContent = command.label;

      const description = document.createElement("span");
      description.className = "cm-slash-menu-description";
      description.textContent = command.description;

      item.appendChild(label);
      item.appendChild(description);
      item.addEventListener("mousedown", (event) => event.preventDefault());
      item.addEventListener("mouseenter", () => {
        this.activeIndex = index;
        this.render();
        this.scrollActiveItemIntoView();
      });
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.accept();
      });
      this.dom.appendChild(item);
    });
  }

  sync(update) {
    if (update.docChanged) {
      this.from = update.changes.mapPos(this.from);
      this.to = update.changes.mapPos(this.to);
    }

    const selection = update.state.selection.main;
    const slashStillPresent =
      this.from >= 0 &&
      this.to <= update.state.doc.length &&
      update.state.doc.sliceString(this.from, this.to) === "/";
    if (!selection.empty || selection.from !== this.to || !slashStillPresent) {
      closeSlashCommandMenu();
      return;
    }
    this.position();
  }

  move(delta) {
    this.activeIndex =
      (this.activeIndex + delta + slashCommands.length) % slashCommands.length;
    this.render();
    this.scrollActiveItemIntoView();
    this.position();
  }

  accept() {
    const command = slashCommands[this.activeIndex];
    const anchor = this.from + command.cursor;
    const view = this.view;
    const from = this.from;
    const to = this.to;
    closeSlashCommandMenu();
    view.dispatch({
      changes: { from, to, insert: command.insert },
      selection: { anchor },
      scrollIntoView: true,
    });
    view.focus();
  }

  position() {
    const coords =
      this.view.coordsAtPos(this.to) || this.view.coordsAtPos(this.from);
    if (!coords) {
      return;
    }
    const menuWidth = 260;
    const menuHeight = Math.min(
      this.dom.offsetHeight || 320,
      window.innerHeight - 24,
    );
    const left = Math.min(
      Math.max(8, coords.left),
      window.innerWidth - menuWidth - 8,
    );
    const spaceBelow = window.innerHeight - coords.bottom - 8;
    const top =
      spaceBelow >= menuHeight
        ? coords.bottom + 6
        : coords.top - menuHeight - 6;
    this.dom.style.left = `${left}px`;
    this.dom.style.top = `${Math.max(
      8,
      Math.min(top, window.innerHeight - menuHeight - 8),
    )}px`;
  }

  scrollActiveItemIntoView() {
    const activeItem = this.dom.querySelector(".cm-slash-menu-item.is-active");
    if (!activeItem) {
      return;
    }
    activeItem.scrollIntoView({ block: "nearest" });
  }

  destroy() {
    this.dom.remove();
  }
}

class CodeCopyButtonWidget extends WidgetType {
  constructor(code) {
    super();
    this.code = code;
  }

  eq(other) {
    return other.code === this.code;
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-code-copy-widget";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-code-copy-button";
    button.textContent = "Copy";
    button.title = "Copy code";
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await copyTextToClipboard(this.code);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = "Copy";
      }, 900);
    });

    wrapper.appendChild(button);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    vscode.postMessage({ type: "copyText", text });
  }
}

class ImagePreviewWidget extends WidgetType {
  constructor(src, alt, from) {
    super();
    this.src = src;
    this.alt = alt;
    this.from = from;
  }

  eq(other) {
    return (
      other.src === this.src &&
      other.alt === this.alt &&
      other.from === this.from
    );
  }

  toDOM(view) {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-image-preview";
    wrapper.title = this.src;

    const image = document.createElement("img");
    image.alt = this.alt || this.src;

    const error = document.createElement("span");
    error.className = "cm-image-preview-error";
    error.hidden = true;
    error.textContent = `Image not found: ${this.src}`;

    resolveImageSource(this.src)
      .then((uri) => {
        image.src = uri;
        requestEditorMeasure(view);
      })
      .catch(() => {
        image.remove();
        error.hidden = false;
        requestEditorMeasure(view);
      });

    image.addEventListener("error", () => {
      image.remove();
      error.hidden = false;
      requestEditorMeasure(view);
    });
    image.addEventListener("load", () => {
      requestEditorMeasure(view);
    });
    image.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      vscode.postMessage({ type: "openLink", href: this.src });
    });

    wrapper.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    wrapper.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.focusSource(view);
    });

    wrapper.appendChild(image);
    wrapper.appendChild(error);
    if (this.alt) {
      const caption = document.createElement("span");
      caption.className = "cm-image-preview-caption";
      caption.textContent = this.alt;
      wrapper.appendChild(caption);
    }
    return wrapper;
  }

  focusSource(view) {
    view.dispatch({
      selection: { anchor: Math.min(this.from, view.state.doc.length) },
      scrollIntoView: true,
    });
    view.focus();
  }

  ignoreEvent() {
    return false;
  }
}

function resolveImageSource(src) {
  if (/^(https?:|data:|blob:)/i.test(src)) {
    return Promise.resolve(src);
  }

  const requestId = String((imageRequestId += 1));
  vscode.postMessage({ type: "resolveImage", requestId, src });

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingImageRequests.delete(requestId);
      reject(new Error("Timed out resolving image."));
    }, 5000);
    pendingImageRequests.set(requestId, {
      resolve,
      reject,
      timeout,
    });
  });
}

function buildTaskCheckboxes(view) {
  const builder = new RangeSetBuilder();
  const previewedDetailsRanges = getPreviewedDetailsRanges(view.state);

  for (const range of view.visibleRanges) {
    let position = range.from;
    while (position <= range.to) {
      const line = view.state.doc.lineAt(position);
      if (rangeIntersectsRanges(line.from, line.to, previewedDetailsRanges)) {
        position = line.to + 1;
        if (position > view.state.doc.length) break;
        continue;
      }
      const match = line.text.match(/^(\s*[-*+]\s+)\[( |x)\]/i);
      if (match && !isLineFocused(view.state, line)) {
        const from = line.from + match[1].length;
        builder.add(
          from,
          from + 3,
          Decoration.replace({
            widget: new CheckboxWidget(match[2].toLowerCase() === "x", from),
          }),
        );
      }
      position = line.to + 1;
      if (position > view.state.doc.length) break;
    }
  }

  return builder.finish();
}

function isLineFocused(state, line) {
  return state.selection.ranges.some(
    (range) => range.from <= line.to && range.to >= line.from,
  );
}

class CheckboxWidget extends WidgetType {
  constructor(checked, from) {
    super();
    this.checked = checked;
    this.from = from;
  }

  eq(other) {
    return other.checked === this.checked && other.from === this.from;
  }

  toDOM(view) {
    const checkbox = document.createElement("button");
    checkbox.type = "button";
    checkbox.className = `cm-task-checkbox${this.checked ? " is-checked" : ""}`;
    checkbox.setAttribute(
      "aria-label",
      this.checked ? "Mark task incomplete" : "Mark task complete",
    );
    checkbox.addEventListener("mousedown", (event) => event.preventDefault());
    checkbox.addEventListener("click", (event) => {
      event.preventDefault();
      view.dispatch({
        changes: {
          from: this.from + 1,
          to: this.from + 2,
          insert: this.checked ? " " : "x",
        },
      });
    });
    return checkbox;
  }
}

function renderSettingsButton() {
  if (document.querySelector(".cm-settings-root")) {
    return;
  }

  const container = document.createElement("div");
  container.className = "cm-settings-root";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cm-settings-button";
  button.title = "Rich Editor settings";
  button.setAttribute("aria-label", "Rich Editor settings");
  button.textContent = "⚙";

  const menu = document.createElement("div");
  menu.className = "cm-settings-menu";
  menu.hidden = true;

  container.addEventListener("click", (event) => event.stopPropagation());
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  menu.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  menu.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  menu.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  container.appendChild(menu);
  container.appendChild(button);
  document.body.appendChild(container);
  updateSettingsMenu();
}

function bindSettingsMenuActions(menu) {
  for (const item of menu.querySelectorAll(".cm-settings-menu-item")) {
    const handle = (event) => {
      event.preventDefault();
      event.stopPropagation();
      runSettingsMenuAction(item, menu);
    };
    item.addEventListener("pointerdown", handle, true);
    item.addEventListener("mousedown", handle, true);
    item.addEventListener("click", handle, true);
  }
}

function runSettingsMenuAction(item, menu) {
  const actionKey = getSettingsMenuActionKey(item);
  const now = Date.now();
  if (
    actionKey &&
    actionKey === lastSettingsMenuActionKey &&
    now - lastSettingsMenuActionTime < 350
  ) {
    return;
  }
  lastSettingsMenuActionKey = actionKey;
  lastSettingsMenuActionTime = now;

  if (item.dataset.theme !== undefined) {
    const theme = item.dataset.theme;
    settings.richTheme = theme;
    applyTheme(theme);
    updateSettingsMenu();
    vscode.postMessage({ type: "setTheme", theme });
    menu.hidden = true;
    return;
  }

  if (item.dataset.toggleEmptyHint !== undefined) {
    settings.showEmptyLineHint = !settings.showEmptyLineHint;
    updateSettingsMenu();
    vscode.postMessage({
      type: "setShowEmptyLineHint",
      value: settings.showEmptyLineHint,
    });
    return;
  }

  if (item.dataset.toggleTablePreview !== undefined) {
    settings.richTablePreview = !settings.richTablePreview;
    updateSettingsMenu();
    refreshRichDecorations();
    vscode.postMessage({
      type: "setRichTablePreview",
      value: settings.richTablePreview,
    });
    return;
  }

  if (item.dataset.previewWidth !== undefined) {
    const previewWidth = normalizePreviewWidth(item.dataset.previewWidth);
    settings.previewWidth = previewWidth;
    applyPreviewWidth(previewWidth);
    updateSettingsMenu();
    vscode.postMessage({
      type: "setPreviewWidth",
      value: previewWidth,
    });
    return;
  }

  if (item.dataset.toggleMermaidPreview !== undefined) {
    settings.mermaidPreview = !settings.mermaidPreview;
    updateSettingsMenu();
    refreshRichDecorations();
    vscode.postMessage({
      type: "setMermaidPreview",
      value: settings.mermaidPreview,
    });
    return;
  }

  if (item.dataset.mermaidSize !== undefined) {
    const previewSize = normalizeMermaidPreviewSize(item.dataset.mermaidSize);
    settings.mermaidPreviewSize = previewSize;
    updateSettingsMenu();
    refreshRichDecorations();
    vscode.postMessage({
      type: "setMermaidPreviewSize",
      value: previewSize,
    });
  }
}

function getSettingsMenuActionKey(item) {
  if (item.dataset.theme !== undefined) return `theme:${item.dataset.theme}`;
  if (item.dataset.toggleEmptyHint !== undefined) return "empty-hint";
  if (item.dataset.toggleTablePreview !== undefined) return "table-preview";
  if (item.dataset.previewWidth !== undefined) {
    return `preview-width:${item.dataset.previewWidth}`;
  }
  if (item.dataset.toggleMermaidPreview !== undefined) {
    return "mermaid-preview";
  }
  if (item.dataset.mermaidSize !== undefined) {
    return `mermaid-size:${item.dataset.mermaidSize}`;
  }
  return "";
}

function updateSettingsMenu() {
  const menu = document.querySelector(".cm-settings-menu");
  if (!menu) return;
  const currentTheme = document.documentElement.dataset.richTheme || "default";
  const currentMermaidSize = normalizeMermaidPreviewSize(
    settings.mermaidPreviewSize,
  );
  const currentPreviewWidth = normalizePreviewWidth(settings.previewWidth);
  menu.innerHTML = `
    <div class="cm-settings-section">
      <div class="cm-settings-menu-title">Appearance</div>
      <div class="cm-settings-subtitle">Theme</div>
      ${getThemeOptions()
        .map(
          (option) =>
            `<button type="button" class="cm-settings-menu-item${option.value === currentTheme ? " is-active" : ""}" data-theme="${option.value}"><span>${option.label}</span><span>${option.value === currentTheme ? "✓" : ""}</span></button>`,
        )
        .join("")}
      <div class="cm-settings-subtitle">Width</div>
      ${getPreviewWidthOptions()
        .map(
          (option) =>
            `<button type="button" class="cm-settings-menu-item${option.value === currentPreviewWidth ? " is-active" : ""}" data-preview-width="${option.value}"><span>${option.label}</span><span>${option.value === currentPreviewWidth ? "✓" : ""}</span></button>`,
        )
        .join("")}
    </div>
    <div class="cm-settings-section">
      <div class="cm-settings-menu-title">Editor</div>
      <button type="button" class="cm-settings-menu-item" data-toggle-empty-hint="true"><span>Empty line hint</span><span>${settings.showEmptyLineHint ? "On" : "Off"}</span></button>
    </div>
    <div class="cm-settings-section">
      <div class="cm-settings-menu-title">Preview</div>
      <button type="button" class="cm-settings-menu-item" data-toggle-table-preview="true"><span>Rich tables</span><span>${settings.richTablePreview ? "On" : "Off"}</span></button>
    </div>
    <div class="cm-settings-section">
      <div class="cm-settings-menu-title">Mermaid</div>
      <button type="button" class="cm-settings-menu-item" data-toggle-mermaid-preview="true"><span>Diagrams</span><span>${settings.mermaidPreview ? "On" : "Off"}</span></button>
      <div class="cm-settings-subtitle">Size</div>
      ${getMermaidSizeOptions()
        .map(
          (option) =>
            `<button type="button" class="cm-settings-menu-item${option.value === currentMermaidSize ? " is-active" : ""}" data-mermaid-size="${option.value}"><span>${option.label}</span><span>${option.value === currentMermaidSize ? "✓" : ""}</span></button>`,
        )
        .join("")}
    </div>
  `;
  bindSettingsMenuActions(menu);
}

function getMermaidSizeOptions() {
  return [
    { label: "Source height", value: "source" },
    { label: "Readable", value: "readable" },
    { label: "Large", value: "large" },
  ];
}

function getPreviewWidthOptions() {
  return [
    { label: "Default", value: "default" },
    { label: "Wide", value: "wide" },
  ];
}

function isMarkdownMarker(nodeName) {
  return [
    "HeaderMark",
    "QuoteMark",
    "EmphasisMark",
    "CodeMark",
    "LinkMark",
    "URL",
    "TaskMarker",
    "StrikethroughMark",
    "CodeInfo",
    "TableDelimiter",
  ].includes(nodeName);
}

function findLinkAtClick(view, event) {
  if (event.target.closest(".cm-image-preview")) {
    return null;
  }

  const position =
    view.posAtCoords(
      {
        x: event.clientX,
        y: event.clientY,
      },
      true,
    ) ??
    view.posAtCoords({
      x: event.clientX,
      y: event.clientY,
    });
  if (position === null) {
    return null;
  }

  const line = view.state.doc.lineAt(position);
  const lineFocused = isLineFocused(view.state, line);
  const offset = position - line.from;

  for (const link of collectLineLinks(line.text)) {
    const hitFrom = lineFocused ? link.sourceFrom : link.visibleFrom;
    const hitTo = lineFocused ? link.sourceTo : link.visibleTo;
    if (offset < hitFrom || offset > hitTo) {
      continue;
    }
    if (!isClickInsideTextRange(view, line.from + hitFrom, line.from + hitTo, event)) {
      continue;
    }
    return {
      href: link.href,
      position,
    };
  }

  return null;
}

function collectLineLinks(text) {
  const links = [];

  for (const match of text.matchAll(/(!?)\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (match[1]) {
      continue;
    }
    const sourceFrom = match.index;
    const labelFrom = sourceFrom + 1;
    const labelTo = labelFrom + match[2].length;
    links.push({
      href: match[3],
      sourceFrom,
      sourceTo: sourceFrom + match[0].length,
      visibleFrom: labelFrom,
      visibleTo: labelTo,
    });
  }

  for (const match of text.matchAll(/https?:\/\/[^\s)]+/g)) {
    links.push({
      href: match[0],
      sourceFrom: match.index,
      sourceTo: match.index + match[0].length,
      visibleFrom: match.index,
      visibleTo: match.index + match[0].length,
    });
  }

  return links;
}

function isClickInsideTextRange(view, from, to, event) {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  if (!start || !end) {
    return false;
  }

  const left = Math.min(start.left, end.left) - 2;
  const right = Math.max(start.left, end.left) + 2;
  const top = Math.min(start.top, end.top) - 3;
  const bottom = Math.max(start.bottom, end.bottom) + 3;

  return (
    event.clientX >= left &&
    event.clientX <= right &&
    event.clientY >= top &&
    event.clientY <= bottom
  );
}

function applyTheme(themeName) {
  const theme = getTheme(themeName);
  const rootStyle = document.documentElement.style;
  document.documentElement.dataset.richTheme = themeName || "default";

  for (const [key, value] of Object.entries(theme)) {
    rootStyle.setProperty(
      `--rip-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      value,
    );
  }
}

function applyPreviewWidth(previewWidth) {
  const width = normalizePreviewWidth(previewWidth);
  document.documentElement.dataset.previewWidth = width;
  document.documentElement.style.setProperty(
    "--rip-content-max-width",
    width === "wide" ? "none" : "960px",
  );
}

function getThemeOptions() {
  return [
    { value: "default", label: "Default" },
    { value: "midnight", label: "Midnight" },
    { value: "graphite", label: "Graphite" },
    { value: "forest", label: "Forest" },
    { value: "ivory", label: "Ivory" },
    { value: "paper", label: "Paper" },
    { value: "solar", label: "Solar" },
  ];
}

function getTheme(themeName) {
  const themes = {
    default: {
      bg: "var(--vscode-editor-background)",
      fg: "var(--vscode-editor-foreground)",
      muted: "var(--vscode-descriptionForeground)",
      border: "var(--vscode-panel-border)",
      panel: "var(--vscode-editorWidget-background)",
      inputBg: "var(--vscode-input-background)",
      codeBg: "var(--vscode-textCodeBlock-background)",
      hover:
        "color-mix(in srgb, var(--vscode-editor-selectionBackground) 16%, transparent)",
      focus: "var(--vscode-focusBorder)",
      caret: "var(--vscode-editorCursor-foreground)",
      accent: "var(--vscode-button-background)",
      buttonFg: "var(--vscode-button-foreground)",
      heading: "var(--vscode-textLink-foreground)",
      link: "var(--vscode-textLink-foreground)",
      quoteBorder: "var(--vscode-textBlockQuote-border)",
      rowAlt:
        "color-mix(in srgb, var(--vscode-editorWidget-background) 45%, transparent)",
      syntaxPurple: "var(--vscode-charts-purple, #c586c0)",
      syntaxOrange: "var(--vscode-charts-orange, #ce9178)",
      syntaxGreen: "var(--vscode-charts-green, #b5cea8)",
      syntaxBlue: "var(--vscode-charts-blue, #9cdcfe)",
      danger: "var(--vscode-errorForeground, #f14c4c)",
    },
    midnight: {
      bg: "#0b1020",
      fg: "#d9e4ff",
      muted: "#8796b8",
      border: "#26314f",
      panel: "#111936",
      inputBg: "#0f1730",
      codeBg: "#070b16",
      hover: "rgba(93, 144, 255, 0.14)",
      focus: "#7aa2ff",
      caret: "#ffffff",
      accent: "#6f9cff",
      buttonFg: "#081120",
      heading: "#8fb4ff",
      link: "#8fb4ff",
      quoteBorder: "#5e7fd6",
      rowAlt: "rgba(143, 180, 255, 0.08)",
      syntaxPurple: "#d7a7ff",
      syntaxOrange: "#ffc08a",
      syntaxGreen: "#9ce6b3",
      syntaxBlue: "#8bd7ff",
      danger: "#ff8a8a",
    },
    graphite: {
      bg: "#151617",
      fg: "#e5e1d8",
      muted: "#9b9891",
      border: "#343536",
      panel: "#202224",
      inputBg: "#1b1d1f",
      codeBg: "#101112",
      hover: "rgba(229, 225, 216, 0.08)",
      focus: "#d0a85c",
      caret: "#f5f0e6",
      accent: "#d0a85c",
      buttonFg: "#171717",
      heading: "#e2bd72",
      link: "#e2bd72",
      quoteBorder: "#8e7a55",
      rowAlt: "rgba(255, 255, 255, 0.045)",
      syntaxPurple: "#cfa8ff",
      syntaxOrange: "#e6b17e",
      syntaxGreen: "#9bcf9d",
      syntaxBlue: "#8ebbdc",
      danger: "#ff8f8f",
    },
    forest: {
      bg: "#0f1712",
      fg: "#dce8dc",
      muted: "#8ea08f",
      border: "#263529",
      panel: "#17231a",
      inputBg: "#121d15",
      codeBg: "#0a100c",
      hover: "rgba(121, 184, 136, 0.12)",
      focus: "#79b888",
      caret: "#effff0",
      accent: "#79b888",
      buttonFg: "#071008",
      heading: "#a4d8a9",
      link: "#9fd6b3",
      quoteBorder: "#5b936a",
      rowAlt: "rgba(164, 216, 169, 0.07)",
      syntaxPurple: "#d0a8ff",
      syntaxOrange: "#e9bd8c",
      syntaxGreen: "#93d79b",
      syntaxBlue: "#8fcbd4",
      danger: "#ff8a8a",
    },
    ivory: {
      bg: "#fbf5e8",
      fg: "#2f2b25",
      muted: "#776f62",
      border: "#ded3bf",
      panel: "#f1e7d5",
      inputBg: "#fffaf0",
      codeBg: "#f2eadc",
      hover: "rgba(107, 78, 42, 0.09)",
      focus: "#a46c28",
      caret: "#2f2b25",
      accent: "#a46c28",
      buttonFg: "#fff8ee",
      heading: "#7a4f1e",
      link: "#8a5a24",
      quoteBorder: "#bc8f55",
      rowAlt: "rgba(122, 79, 30, 0.06)",
      syntaxPurple: "#8a4fb0",
      syntaxOrange: "#a75d17",
      syntaxGreen: "#3f7a3f",
      syntaxBlue: "#2e6f9f",
      danger: "#b42318",
    },
    paper: {
      bg: "#ffffff",
      fg: "#202124",
      muted: "#6b7280",
      border: "#d7dbe2",
      panel: "#f3f5f8",
      inputBg: "#ffffff",
      codeBg: "#f5f7fa",
      hover: "rgba(31, 111, 235, 0.08)",
      focus: "#1f6feb",
      caret: "#202124",
      accent: "#1f6feb",
      buttonFg: "#ffffff",
      heading: "#0b5cad",
      link: "#0b5cad",
      quoteBorder: "#8aa6c8",
      rowAlt: "#f8fafc",
      syntaxPurple: "#7c3aed",
      syntaxOrange: "#b45309",
      syntaxGreen: "#15803d",
      syntaxBlue: "#0369a1",
      danger: "#b42318",
    },
    solar: {
      bg: "#fdf6e3",
      fg: "#3b3a32",
      muted: "#7b7662",
      border: "#d8ceb0",
      panel: "#eee5c8",
      inputBg: "#fff9e8",
      codeBg: "#f4edcf",
      hover: "rgba(181, 137, 0, 0.1)",
      focus: "#b58900",
      caret: "#3b3a32",
      accent: "#b58900",
      buttonFg: "#fff8df",
      heading: "#9b6d00",
      link: "#0f6c8c",
      quoteBorder: "#b58900",
      rowAlt: "rgba(181, 137, 0, 0.07)",
      syntaxPurple: "#6c54a3",
      syntaxOrange: "#b85c00",
      syntaxGreen: "#5f7f00",
      syntaxBlue: "#227894",
      danger: "#b42318",
    },
  };
  return themes[themeName] || themes.default;
}
