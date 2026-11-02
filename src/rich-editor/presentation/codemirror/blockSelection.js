// Shows when a selection covers a block preview (table, diagram, callout, ...).
//
// The browser paints a selection inside a widget only behind the bits of text
// it happens to contain (toolbar hints, button labels, cell text), which reads
// as noise rather than "this block is selected". A widget the selection runs
// over is marked instead, and the stylesheet tints it as a whole.
import { ViewPlugin } from "@codemirror/view";

const selectedClass = "cm-richdown-block-selected";

export const blockSelectionHighlight = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.marked = new Set();
      this.schedule(view);
    }

    update(update) {
      if (update.selectionSet || update.docChanged || update.viewportChanged) {
        this.schedule(update.view);
      }
    }

    // The widget DOM is only up to date once the view has redrawn.
    schedule(view) {
      view.requestMeasure({
        key: this,
        read: () => findSelectedWidgets(view),
        write: (selected) => this.apply(selected),
      });
    }

    apply(selected) {
      for (const element of this.marked) {
        if (!selected.has(element)) {
          element.classList.remove(selectedClass);
        }
      }
      for (const element of selected) {
        element.classList.add(selectedClass);
      }
      this.marked = selected;
    }

    destroy() {
      this.apply(new Set());
    }
  },
);

function findSelectedWidgets(view) {
  const selected = new Set();
  const ranges = view.state.selection.ranges.filter((range) => !range.empty);
  if (!ranges.length) {
    return selected;
  }
  for (const element of view.contentDOM.children) {
    if (element.classList.contains("cm-line") || element.contentEditable !== "false") {
      continue;
    }
    let block;
    try {
      block = view.lineBlockAt(view.posAtDOM(element));
    } catch {
      continue;
    }
    if (ranges.some((range) => range.from < block.to && range.to > block.from)) {
      selected.add(element);
    }
  }
  return selected;
}
