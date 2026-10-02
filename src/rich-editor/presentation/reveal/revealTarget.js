// Reveals a position the extension host asks for: the match of a VS Code
// Search result, the line of a `file.md#L12` link, or a `#heading` anchor.
//
// The revealed range is selected and also marked, because the editor is often
// not focused at that point (Search keeps focus in its own view) and an
// unfocused editor does not paint its selection.
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { findHeadingAnchor } from "../codemirror/completions.js";

const setRevealHighlight = StateEffect.define();
const revealMark = Decoration.mark({ class: "cm-richdown-reveal-match" });

export const revealHighlightField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(highlight, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setRevealHighlight)) {
        return effect.value
          ? Decoration.set([revealMark.range(effect.value.from, effect.value.to)])
          : Decoration.none;
      }
    }
    // The mark shows where an open landed; once the reader edits or moves
    // the caret it has served its purpose.
    if (transaction.docChanged || transaction.isUserEvent("select")) {
      return Decoration.none;
    }
    return highlight;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function resolveRevealRange(doc, target) {
  if (target?.selection) {
    const anchor = toOffset(doc, target.selection.start);
    const head = toOffset(doc, target.selection.end);
    return {
      anchor,
      head,
      from: Math.min(anchor, head),
      to: Math.max(anchor, head),
      heading: false,
    };
  }
  if (typeof target?.anchor === "string") {
    const heading = findHeadingAnchor(doc, target.anchor);
    return heading
      ? {
          anchor: heading.from,
          head: heading.from,
          from: heading.from,
          to: heading.from,
          heading: true,
        }
      : null;
  }
  return null;
}

export function revealInEditor(view, target) {
  const range = resolveRevealRange(view.state.doc, target);
  if (!range) {
    return false;
  }
  view.dispatch({
    selection: { anchor: range.anchor, head: range.head },
    effects: [
      EditorView.scrollIntoView(range.from, {
        y: range.heading ? "start" : "center",
      }),
      setRevealHighlight.of(
        range.from < range.to ? { from: range.from, to: range.to } : null,
      ),
    ],
  });
  // Search previews keep focus in the Search view; only take focus when the
  // webview already has it.
  if (document.hasFocus()) {
    view.focus();
  }
  return true;
}

function toOffset(doc, position) {
  const lineNumber = clamp(Math.trunc(Number(position?.line) || 0) + 1, 1, doc.lines);
  const line = doc.line(lineNumber);
  return line.from + clamp(Math.trunc(Number(position?.character) || 0), 0, line.to - line.from);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
