// Rich editor webview entrypoint.
//
// Keep this file focused on bootstrapping VS Code/CodeMirror integration. Rich
// Markdown parsing, preview widgets, settings UI, and decorations live in
// feature modules under src/rich-editor so contributors can change one area
// without learning the whole editor surface.
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { createVsCodeWebviewPort } from "./rich-editor/adapters/vscodeWebviewPort.js";
import { applySettingsPatch } from "./rich-editor/application/settingsUseCases.js";
import { normalizeRichEditorSettings } from "./rich-editor/domain/settingsModel.js";
import {
  getMinimalTextChange,
  mapPositionThroughTextChange,
} from "./rich-editor/domain/textChange.js";
import {
  codeLanguages,
  markdownHighlightStyle,
} from "./rich-editor/presentation/codemirror/language.js";
import { createGitDiffGutter } from "./rich-editor/presentation/codemirror/gitDiffGutter.js";
import { findLinkAtClick } from "./rich-editor/presentation/codemirror/links.js";
import { createSlashCommandController } from "./rich-editor/presentation/codemirror/slashCommands.js";
import { createPreviewExtensions } from "./rich-editor/presentation/codemirror/previewExtensions.js";
import { createFallbackEditor } from "./rich-editor/presentation/fallback/fallbackEditor.js";
import { createInlineMarkdownSupport } from "./rich-editor/presentation/markdown/inlineMarkdown.js";
import { createOutlineNavigation } from "./rich-editor/presentation/outline/outlineNavigation.js";
import {
  createSearchExtensions,
  getSearchKeymap,
  installSearchShortcut,
} from "./rich-editor/presentation/search/searchExtensions.js";
import { createSettingsMenuController } from "./rich-editor/presentation/settings/settingsMenu.js";
import {
  applyPreviewWidth,
  applyTheme,
} from "./rich-editor/presentation/settings/themeController.js";
import { createEditorThemeExtension } from "./rich-editor/presentation/styles/editorTheme.js";
import { injectStyles } from "./rich-editor/presentation/styles/globalStyles.js";
import { closeTableContextMenu } from "./rich-editor/presentation/table/tablePreview.js";

const vscode = acquireVsCodeApi();
const vscodePort = createVsCodeWebviewPort(vscode);
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
const initialGitDiffChanges = JSON.parse(
  document.querySelector("#initial-git-diff")?.textContent || "[]",
);

let applyingExternalUpdate = false;
let settings = normalizeRichEditorSettings(initialSettings);
let latestGitDiffChanges = initialGitDiffChanges;
const outlineNavigation = createOutlineNavigation();
const fallbackEditor = createFallbackEditor({
  root,
  postMessage: (message) => vscodePort.postMessage(message),
});
const slashCommands = createSlashCommandController();
const gitDiffGutter = createGitDiffGutter(initialGitDiffChanges);
const settingsMenu = createSettingsMenuController({
  getSettings: () => settings,
  postMessage: (message) => vscodePort.postMessage(message),
  refreshDecorations: () => previewExtensions.refresh(view),
});
const inlineMarkdown = createInlineMarkdownSupport({
  postMessage: (message) => vscodePort.postMessage(message),
  requestEditorMeasure,
});
const {
  appendInlineMarkdown,
  findMarkdownImages,
  handleResolvedImage,
  ImagePreviewWidget,
  isRangeInsideRanges,
} = inlineMarkdown;
const previewExtensions = createPreviewExtensions({
  appendInlineMarkdown,
  findMarkdownImages,
  ImagePreviewWidget,
  isRangeInsideRanges,
  mermaidScriptUri,
  postMessage: (message) => vscodePort.postMessage(message),
  reportError: reportRichdownError,
  requestEditorMeasure,
  getSettings: () => settings,
});


applyTheme(settings.richTheme);
applyPreviewWidth(settings.previewWidth);
injectStyles();

function reportRichdownError(context, error) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : "";
  console.error(`[Richdown] ${context}`, error);
  vscodePort.postMessage({
    type: "webviewError",
    context,
    message,
    stack,
  });
}

function requestEditorMeasure(view) {
  if (view && typeof view.requestMeasure === "function") {
    view.requestMeasure();
  }
}

let view;

installSearchShortcut({
  getView: () => view,
  closeSlashCommandMenu: slashCommands.close,
  closeTableContextMenu,
});

queueMicrotask(() => {
  try {
    view = new EditorView({
      parent: root,
      state: EditorState.create({
        doc: initialDocument,
        extensions: [
          gitDiffGutter.extension,
          lineNumbers(),
          history(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          ...createSearchExtensions(),
          syntaxHighlighting(markdownHighlightStyle),
          markdown({
            extensions: GFM,
            codeLanguages,
          }),
          ...previewExtensions.extensions,
          EditorView.domEventHandlers({
            blur(event, view) {
              slashCommands.close();
              previewExtensions.exitDetailsEditMode(view, true);
              previewExtensions.exitTableEditMode(view, true);
              previewExtensions.exitMermaidEditMode(view, true);
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
              if (previewExtensions.isLineFocused(view.state, line)) {
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
              const linkNeedsModifier = previewExtensions.isLineFocused(view.state, line);
              if (linkNeedsModifier && !event.metaKey && !event.ctrlKey) {
                return false;
              }

              event.preventDefault();
              vscodePort.postMessage({
                type: "openLink",
                href: linkTarget.href,
              });
              return true;
            },
          }),
          keymap.of([
            indentWithTab,
            ...slashCommands.keymap,
            ...getSearchKeymap(),
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            slashCommands.sync(update);
            outlineNavigation.sync(update);
            if (!update.docChanged || applyingExternalUpdate) {
              return;
            }
            vscodePort.postMessage({
              type: "edit",
              text: update.state.doc.toString(),
            });
          }),
          createEditorThemeExtension(),
        ],
      }),
    });
    settingsMenu.render();
    outlineNavigation.render(view);
    gitDiffGutter.update(view, latestGitDiffChanges);
    vscodePort.postMessage({ type: "ready" });
  } catch (error) {
    reportRichdownError("editor-startup", error);
    view = null;
    fallbackEditor.render(initialDocument);
    vscodePort.postMessage({ type: "ready" });
  }
});

window.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "resolvedImage") {
    handleResolvedImage(event.data);
    return;
  }

  if (event.data.type === "gitDiff") {
    latestGitDiffChanges = event.data.changes || [];
    gitDiffGutter.update(view, latestGitDiffChanges);
    return;
  }

  if (event.data.type === "theme") {
    settings.richTheme = event.data.theme || "default";
    applyTheme(settings.richTheme);
    settingsMenu.update();
    return;
  }

  if (event.data.type === "settings") {
    const result = applySettingsPatch(settings, event.data.settings);
    settings = result.settings;
    applyTheme(settings.richTheme);
    applyPreviewWidth(settings.previewWidth);
    settingsMenu.update();
    if (result.previewChanged) {
      previewExtensions.refresh(view);
    }
    return;
  }

  if (event.data.type !== "update") return;

  const nextText = event.data.text;
  if (!view) {
    fallbackEditor.applyUpdate(nextText);
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

  // VS Code sends full-document updates after saves and external file changes.
  // Apply only the minimal text change so CodeMirror can keep undo history,
  // IME state, and the visible scroll position stable.
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

window.addEventListener("click", (event) => {
  if (!event.target.closest(".cm-table-context-menu")) {
    closeTableContextMenu();
  }
  if (!event.target.closest(".richdown-outline-root")) {
    outlineNavigation.close();
  }
  if (event.target.closest(".cm-settings-root")) return;
  const menu = document.querySelector(".cm-settings-menu");
  if (menu) menu.hidden = true;
});

window.addEventListener("blur", () => {
  slashCommands.close();
  closeTableContextMenu();
  previewExtensions.exitDetailsEditMode(view, true);
  previewExtensions.exitTableEditMode(view, true);
  previewExtensions.exitMermaidEditMode(view, true);
});

window.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape" && closeTableContextMenu()) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true,
);
