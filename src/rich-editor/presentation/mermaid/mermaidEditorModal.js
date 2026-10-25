// Mermaid editor modal: a roomy split view for one diagram.
//
// The left pane is a small CodeMirror editor holding the diagram text; the
// right pane is the interactive surface. The modal's editor is the working
// copy while it is open. Its changes flow back into the Markdown document
// (debounced, and flushed on close), so the document always ends up with
// exactly what the modal shows and a closed modal never loses an edit. The
// modal also follows the document: the block's position is mapped through
// every outside change, and outside edits to the diagram itself are pulled
// into the modal when it has nothing unsaved.
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";
import {
  Compartment,
  EditorState,
  MapMode,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { findMermaidBlocks } from "../../domain/markdownBlocks.js";
import {
  detectMermaidDiagramType,
  getMermaidBlockContentChange,
  readMermaidBlockContent,
} from "../../domain/mermaidSource.js";
import { getMinimalTextChange } from "../../domain/textChange.js";
import { markdownHighlightStyle, mermaidLanguage } from "../codemirror/language.js";
import { createMermaidEditorSurface } from "./mermaidEditorSurface.js";
import { stopInteractiveEvent } from "./mermaidRenderer.js";

const SYNC_DELAY = 160;

const TYPE_LABELS = {
  flowchart: "Flowchart",
  sequence: "Sequence",
  class: "Class",
  state: "State",
  er: "ER",
  gantt: "Gantt",
  pie: "Pie",
  mindmap: "Mindmap",
  journey: "Journey",
  git: "Git graph",
  timeline: "Timeline",
  quadrant: "Quadrant",
  other: "Diagram",
};

const setErrorLine = StateEffect.define();

const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLine)) continue;
      const builder = new RangeSetBuilder();
      const lineIndex = effect.value;
      if (lineIndex >= 0 && lineIndex < transaction.state.doc.lines) {
        const line = transaction.state.doc.line(lineIndex + 1);
        builder.add(line.from, line.from, Decoration.line({ class: "cm-mermaid-error-line" }));
      }
      next = builder.finish();
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function openMermaidEditorModal({
  view: hostView,
  blockFrom,
  renderer,
  colorized = true,
  onClose = () => {},
}) {
  document.querySelector(".cm-mermaid-editor-backdrop")?.__richdownClose?.();
  document.querySelector(".cm-mermaid-modal-backdrop")?.remove();

  const blocks = findMermaidBlocks(hostView.state.doc);
  const blockIndex = blocks.findIndex((block) => block.from === blockFrom);
  if (blockIndex < 0) {
    return null;
  }
  const tracked = { from: blockFrom, lost: false };
  let lastSyncedCode = readMermaidBlockContent(hostView.state.doc, blocks[blockIndex]);
  let syncTimer = 0;
  let closed = false;
  let syncing = false;
  let pullingOutsideChange = false;

  const backdrop = document.createElement("div");
  backdrop.className = "cm-mermaid-editor-backdrop";

  const modal = document.createElement("div");
  modal.className = "cm-mermaid-editor-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Mermaid editor");

  const header = document.createElement("div");
  header.className = "cm-mermaid-editor-header";
  const title = document.createElement("div");
  title.className = "cm-mermaid-editor-title";
  title.textContent = "Mermaid editor";
  const badge = document.createElement("span");
  badge.className = "cm-mermaid-editor-badge";
  const notice = document.createElement("span");
  notice.className = "cm-mermaid-editor-notice";
  const doneButton = document.createElement("button");
  doneButton.type = "button";
  doneButton.className = "cm-mermaid-editor-done";
  doneButton.textContent = "Done";
  doneButton.title = "Close the Mermaid editor";
  doneButton.addEventListener("click", (event) => {
    stopInteractiveEvent(event);
    close();
  });
  header.append(title, badge, notice, doneButton);

  const body = document.createElement("div");
  body.className = "cm-mermaid-editor-body";
  const sourcePane = document.createElement("div");
  sourcePane.className = "cm-mermaid-editor-source";
  const splitter = document.createElement("div");
  splitter.className = "cm-mermaid-editor-splitter";
  splitter.setAttribute("role", "separator");
  splitter.setAttribute("aria-orientation", "vertical");
  splitter.setAttribute("aria-label", "Resize source and diagram panes");
  const diagramPane = document.createElement("div");
  diagramPane.className = "cm-mermaid-editor-diagram";
  body.append(sourcePane, splitter, diagramPane);

  modal.append(header, body);
  backdrop.appendChild(modal);

  const surface = createMermaidEditorSurface({
    renderer,
    colorized,
    variant: "modal",
    code: lastSyncedCode,
    applyCode: (nextCode) => {
      const current = sourceView.state.doc.toString();
      if (current === nextCode) return;
      sourceView.dispatch({
        changes: getMinimalTextChange(current, nextCode),
        userEvent: "input.mermaid",
      });
    },
    revealLine: (lineIndex) => {
      const lineNumber = Math.min(lineIndex + 1, sourceView.state.doc.lines);
      const line = sourceView.state.doc.line(lineNumber);
      sourceView.dispatch({
        selection: { anchor: line.to },
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
    },
    onDiagnostics: (diagnostic) => {
      window.setTimeout(() => {
        if (closed) return;
        sourceView.dispatch({
          effects: setErrorLine.of(diagnostic ? diagnostic.lineIndex : -1),
        });
      }, 0);
    },
  });
  diagramPane.appendChild(surface.element);

  const sourceView = new EditorView({
    parent: sourcePane,
    state: EditorState.create({
      doc: lastSyncedCode,
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        mermaidLanguage(),
        syntaxHighlighting(markdownHighlightStyle),
        errorLineField,
        EditorView.lineWrapping,
        keymap.of([
          {
            key: "Escape",
            run: () => {
              close();
              return true;
            },
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const code = update.state.doc.toString();
            surface.update(code);
            badge.textContent = TYPE_LABELS[detectMermaidDiagramType(code)] || "";
            if (!pullingOutsideChange) scheduleSync();
          }
          if (update.docChanged || update.selectionSet) {
            const head = update.state.selection.main.head;
            surface.highlightLine(update.state.doc.lineAt(head).number - 1);
          }
        }),
      ],
    }),
  });
  badge.textContent = TYPE_LABELS[detectMermaidDiagramType(lastSyncedCode)] || "";

  function locateBlock() {
    return (
      findMermaidBlocks(hostView.state.doc).find((candidate) => candidate.from === tracked.from) ||
      null
    );
  }

  function markLost() {
    tracked.lost = true;
    notice.textContent = "This diagram is no longer in the document; changes are not saved.";
  }

  // Changes made to the document from elsewhere (VS Code undo, an AI edit, a
  // revert) while the modal is open.
  function onHostUpdate(update) {
    if (!update.docChanged || syncing || closed || tracked.lost) return;
    const mapped = update.changes.mapPos(tracked.from, 1, MapMode.TrackDel);
    tracked.from = mapped ?? -1;
    const block = mapped === null ? null : locateBlock();
    if (!block) {
      markLost();
      return;
    }
    const outside = readMermaidBlockContent(hostView.state.doc, block);
    if (outside === lastSyncedCode) return;
    const local = sourceView.state.doc.toString();
    if (local !== lastSyncedCode) {
      notice.textContent = "The diagram also changed outside this editor; this version will be kept.";
      return;
    }
    pullingOutsideChange = true;
    try {
      sourceView.dispatch({ changes: getMinimalTextChange(local, outside) });
    } finally {
      pullingOutsideChange = false;
    }
    lastSyncedCode = outside;
  }

  const hostWatcher = new Compartment();
  hostView.dispatch({
    effects: StateEffect.appendConfig.of(
      hostWatcher.of(EditorView.updateListener.of(onHostUpdate)),
    ),
  });

  function scheduleSync() {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(sync, SYNC_DELAY);
  }

  function sync() {
    window.clearTimeout(syncTimer);
    if (tracked.lost || closed) return;
    const code = sourceView.state.doc.toString();
    if (code === lastSyncedCode) return;
    const block = locateBlock();
    if (!block) {
      markLost();
      return;
    }
    const change = getMermaidBlockContentChange(
      block,
      readMermaidBlockContent(hostView.state.doc, block),
      code,
    );
    if (change) {
      syncing = true;
      try {
        hostView.dispatch({ changes: change, userEvent: "input.mermaid" });
      } finally {
        syncing = false;
      }
    }
    lastSyncedCode = code;
    notice.textContent = "";
  }

  // Do not lose the last keystrokes if the webview is hidden or closed
  // before the debounced sync runs.
  const flushOnHide = () => {
    if (document.visibilityState === "hidden") sync();
  };
  document.addEventListener("visibilitychange", flushOnHide);
  window.addEventListener("pagehide", sync);

  // Pane splitter
  splitter.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    splitter.setPointerCapture?.(event.pointerId);
    const bounds = body.getBoundingClientRect();
    const move = (moveEvent) => {
      const ratio = (moveEvent.clientX - bounds.left) / Math.max(1, bounds.width);
      body.style.setProperty(
        "--mermaid-editor-split",
        `${Math.round(Math.min(0.75, Math.max(0.2, ratio)) * 100)}%`,
      );
    };
    const stop = () => {
      splitter.removeEventListener("pointermove", move);
      splitter.removeEventListener("pointerup", stop);
      splitter.removeEventListener("pointercancel", stop);
      surface.fit();
    };
    splitter.addEventListener("pointermove", move);
    splitter.addEventListener("pointerup", stop);
    splitter.addEventListener("pointercancel", stop);
  });

  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) {
      close();
    }
  });
  // Keys keep bubbling so VS Code's own shortcuts (save, command palette)
  // still work while the modal has focus.
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      close();
    }
  });

  function close() {
    if (closed) return;
    sync();
    closed = true;
    document.removeEventListener("visibilitychange", flushOnHide);
    window.removeEventListener("pagehide", sync);
    hostView.dispatch({ effects: hostWatcher.reconfigure([]) });
    surface.destroy();
    sourceView.destroy();
    backdrop.remove();
    onClose();
    hostView.focus();
  }
  backdrop.__richdownClose = close;

  document.body.appendChild(backdrop);
  sourceView.focus();

  return {
    close,
    sourceView,
    surface,
    element: backdrop,
    sync,
  };
}
