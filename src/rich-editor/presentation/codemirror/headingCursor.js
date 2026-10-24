// Keeps the caret out of a heading's hidden "## " marker.
//
// On a line without the caret the heading marker is drawn at zero width, so
// "##", the space after it and the start of the heading text all sit at the
// same x. A vertical move or a click that lands there is measured against that
// layout and can come out between "##" and the space; typing then turns
// "## Title" into "##xTitle", which is no longer a heading. Such a landing is
// moved to the start of the heading text, where the caret appeared to be.
import { syntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";

const headingPrefixPattern = /^(\s{0,3})(#{1,6})(\s*)/;

export function createHeadingCursorFilter({ isLineFocused }) {
  return EditorState.transactionFilter.of((transaction) => {
    if (
      !transaction.selection ||
      transaction.docChanged ||
      !transaction.isUserEvent("select")
    ) {
      return transaction;
    }
    const selection = transaction.selection;
    if (selection.ranges.length !== 1 || !selection.main.empty) {
      return transaction;
    }

    const state = transaction.startState;
    const head = selection.main.head;
    const line = state.doc.lineAt(head);
    // The move was measured while this line showed its markers, so wherever
    // it landed is where the user aimed.
    if (isLineFocused(state, line)) {
      return transaction;
    }
    const prefix = findHiddenHeadingPrefix(state, line);
    if (!prefix || head < prefix.from || head >= prefix.to) {
      return transaction;
    }
    return [
      transaction,
      {
        selection: EditorSelection.cursor(prefix.to),
        sequential: true,
      },
    ];
  });
}

// The "##" plus the whitespace after it on an ATX heading line, which the
// inline decorations hide while the line is not focused.
export function findHiddenHeadingPrefix(state, line) {
  const match = headingPrefixPattern.exec(line.text);
  if (!match) {
    return null;
  }
  const from = line.from + match[1].length;
  const node = syntaxTree(state).resolveInner(from, 1);
  if (node.name !== "HeaderMark" || !/^ATXHeading/.test(node.parent?.name ?? "")) {
    return null;
  }
  return { from, to: line.from + match[0].length };
}
