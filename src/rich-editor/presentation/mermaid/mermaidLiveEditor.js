// Inline live Mermaid editor.
//
// While a diagram is in edit mode its source lines stay in the main editor
// (so typing, undo, search, and VS Code sync work as everywhere else) and this
// block widget sits right under the closing fence with a live, interactive
// drawing of the text above it. The widget DOM survives keystrokes: CodeMirror
// calls `updateDOM`, which feeds the new text to the existing surface instead
// of rebuilding it, so zoom, selection, and the rendered SVG do not flicker.
import { EditorView, WidgetType } from "@codemirror/view";
import { findMermaidBlocks } from "../../domain/markdownBlocks.js";
import {
  getMermaidBlockContentChange,
  readMermaidBlockContent,
} from "../../domain/mermaidSource.js";
import { createMermaidEditorSurface } from "./mermaidEditorSurface.js";

export function createMermaidLiveEditorWidgetClass({
  renderer,
  setMermaidDiagnostic,
  exitMermaidEdit,
  openMermaidEditor,
  requestEditorMeasure,
}) {
  class MermaidLiveEditorWidget extends WidgetType {
    constructor(mermaidBlock, code, caretLine, colorized, revision) {
      super();
      this.mermaidBlock = mermaidBlock;
      this.code = code;
      this.caretLine = caretLine;
      this.colorized = colorized !== false;
      this.revision = revision;
    }

    eq(other) {
      return (
        other.mermaidBlock.from === this.mermaidBlock.from &&
        other.code === this.code &&
        other.caretLine === this.caretLine &&
        other.colorized === this.colorized &&
        other.revision === this.revision
      );
    }

    get estimatedHeight() {
      return 380;
    }

    toDOM(view) {
      const wrapper = document.createElement("div");
      wrapper.className = "cm-mermaid-live";
      wrapper.__richdownMermaidWidget = this;

      const currentBlock = () => {
        const from = wrapper.__richdownMermaidWidget.mermaidBlock.from;
        return findMermaidBlocks(view.state.doc).find((block) => block.from === from) || null;
      };

      const surface = createMermaidEditorSurface({
        renderer,
        colorized: this.colorized,
        variant: "inline",
        readOnly: view.state.readOnly,
        code: this.code,
        applyCode: (nextCode) => {
          const block = currentBlock();
          if (!block) {
            return;
          }
          const change = getMermaidBlockContentChange(
            block,
            readMermaidBlockContent(view.state.doc, block),
            nextCode,
          );
          if (change) {
            view.dispatch({ changes: change, userEvent: "input.mermaid" });
          }
        },
        revealLine: (lineIndex) => {
          const block = currentBlock();
          if (!block?.hasContentLines) {
            return;
          }
          const lineNumber = Math.min(
            block.firstContentLineNumber + lineIndex,
            view.state.doc.lineAt(block.contentTo).number,
          );
          const line = view.state.doc.line(lineNumber);
          // A caret, not a selection: typing right after a click on the
          // diagram must not replace the revealed line.
          view.dispatch({
            selection: { anchor: line.to },
            effects: EditorView.scrollIntoView(line.from, { y: "nearest" }),
          });
        },
        onDiagnostics: (diagnostic) => {
          const block = currentBlock();
          if (!block) {
            return;
          }
          // Dispatching from inside a CodeMirror update is not allowed; the
          // render callback can resolve synchronously in tests.
          window.setTimeout(() => {
            // The widget may have been destroyed (edit mode left) by now.
            if (wrapper.__richdownDestroyed) return;
            view.dispatch({
              effects: setMermaidDiagnostic.of(
                diagnostic && diagnostic.lineIndex >= 0
                  ? { from: block.from, lineIndex: diagnostic.lineIndex }
                  : null,
              ),
            });
          }, 0);
        },
        onResize: () => requestEditorMeasure(view),
        onFocusReturn: () => view.focus(),
        actions: [
          {
            label: "⤢",
            title: "Open in Mermaid editor",
            run: () => openMermaidEditor(view, currentBlock()?.from ?? this.mermaidBlock.from),
          },
          {
            label: "Done",
            title: "Finish editing the diagram",
            className: "is-primary",
            run: () =>
              exitMermaidEdit(view, currentBlock()?.from ?? this.mermaidBlock.from),
          },
        ],
      });
      wrapper.__richdownMermaidSurface = surface;
      surface.highlightLine(this.caretLine);
      wrapper.appendChild(surface.element);
      return wrapper;
    }

    updateDOM(dom) {
      const surface = dom.__richdownMermaidSurface;
      const previous = dom.__richdownMermaidWidget;
      if (!surface || !previous || previous.colorized !== this.colorized) {
        return false;
      }
      dom.__richdownMermaidWidget = this;
      surface.update(this.code);
      surface.highlightLine(this.caretLine);
      return true;
    }

    destroy(dom) {
      if (dom) dom.__richdownDestroyed = true;
      dom?.__richdownMermaidSurface?.destroy();
    }

    ignoreEvent() {
      return true;
    }
  }

  return MermaidLiveEditorWidget;
}
