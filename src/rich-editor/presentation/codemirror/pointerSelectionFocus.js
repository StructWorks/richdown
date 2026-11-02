// Keeps lines looking the way they did when a mouse press began.
//
// A line the caret is on shows its Markdown markers ("**", "[](...)", list
// markers, ...); other lines hide them. If a press revealed them at once, the
// text would slide sideways under the pointer and a drag would be measured
// against the new layout, selecting something other than what the user aimed
// at. So while the button is down, focus is decided by the selection from
// before the press; the line is revealed as soon as the button is released.
// The selection itself always follows the pointer; only the reveal waits.
//
// The second click of a double click comes after that reveal, at the same
// screen point the user aimed at in the old layout, so it brings the old
// layout back while it is measured.
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, ViewPlugin } from "@codemirror/view";

// How soon a further click must follow to count as part of a double or
// triple click.
const multiClickMs = 500;

const setPointerFocusSelection = StateEffect.define();

const pointerFocusSelectionField = StateField.define({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setPointerFocusSelection)) {
        value = effect.value;
      }
    }
    return value && transaction.docChanged ? value.map(transaction.changes) : value;
  },
});

// The selection that decides which lines show their Markdown markers.
export function getFocusSelection(state) {
  return state.field(pointerFocusSelectionField, false) ?? state.selection;
}

// Whether an update may have changed which lines count as focused.
export function focusSelectionChanged(update) {
  return (
    update.selectionSet ||
    update.transactions.some((transaction) =>
      transaction.effects.some((effect) => effect.is(setPointerFocusSelection)),
    )
  );
}

export function transactionChangesFocus(transaction) {
  return (
    Boolean(transaction.selection) ||
    transaction.effects.some((effect) => effect.is(setPointerFocusSelection))
  );
}

// highlightActiveLine(), but following the focus selection, because the
// active line class is what reveals the hidden markers.
const focusActiveLine = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildActiveLineDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || focusSelectionChanged(update)) {
        this.decorations = buildActiveLineDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const activeLineDecoration = Decoration.line({ class: "cm-activeLine" });

function buildActiveLineDecorations(view) {
  let lastLineStart = -1;
  const decorations = [];
  for (const range of getFocusSelection(view.state).ranges) {
    const line = view.lineBlockAt(range.head);
    if (line.from > lastLineStart) {
      decorations.push(activeLineDecoration.range(line.from));
      lastLineStart = line.from;
    }
  }
  return Decoration.set(decorations, true);
}

const pointerTracking = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view;
      this.releaseTimer = null;
      // The selection the last single click froze, for the clicks after it.
      this.lastPress = null;
      this.onMouseUp = () => {
        // CodeMirror reads the final pointer position on this same mouseup,
        // so the layout has to stay as it is until that has happened.
        window.clearTimeout(this.releaseTimer);
        this.releaseTimer = window.setTimeout(() => this.release(), 0);
      };
    }

    press(event) {
      const view = this.view;
      window.clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
      const { lastPress } = this;
      const followUp =
        event.detail > 1 &&
        lastPress &&
        lastPress.doc === view.state.doc &&
        event.timeStamp - lastPress.time < multiClickMs;
      const base = followUp
        ? lastPress.base
        : view.state.field(pointerFocusSelectionField, false) ?? view.state.selection;
      if (!followUp) {
        this.lastPress = { base, doc: view.state.doc, time: event.timeStamp };
      }
      if (view.state.field(pointerFocusSelectionField, false) !== base) {
        view.dispatch({ effects: setPointerFocusSelection.of(base) });
      }
      view.dom.ownerDocument.addEventListener("mouseup", this.onMouseUp, {
        once: true,
      });
    }

    release() {
      window.clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
      if (this.view.state.field(pointerFocusSelectionField, false)) {
        this.view.dispatch({ effects: setPointerFocusSelection.of(null) });
      }
    }

    destroy() {
      window.clearTimeout(this.releaseTimer);
      this.view.dom.ownerDocument.removeEventListener("mouseup", this.onMouseUp);
    }
  },
  {
    eventHandlers: {
      mousedown(event) {
        // Widgets that handle their own presses (callouts, tables, ...)
        // move the caret on purpose and should open their source at once.
        if (
          event.button === 0 &&
          !event.defaultPrevented &&
          !this.view.state.readOnly &&
          (event.target === this.view.contentDOM ||
            event.target?.closest?.(".cm-line"))
        ) {
          this.press(event);
        } else {
          this.release();
        }
        return false;
      },
      keydown() {
        // A key pressed during a drag reveals the caret's line at once.
        this.release();
        return false;
      },
    },
  },
);

export const pointerSelectionFocus = [
  pointerFocusSelectionField,
  focusActiveLine,
  pointerTracking,
];
