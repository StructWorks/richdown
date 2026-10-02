// Positions the extension host asks the Richdown webview to reveal.
//
// A target is either { selection: { start, end } } with zero-based
// { line, character } positions, as VS Code reports them, or { anchor } for a
// heading slug. The webview clamps positions to its own document.

// Character offset that the webview clamps to the end of the line.
const LINE_END = Number.MAX_SAFE_INTEGER;

function createSelectionRevealTarget(selection) {
  if (!selection) {
    return undefined;
  }
  const start = toPosition(selection.start);
  const end = toPosition(selection.end);
  // A caret at the very top is what a plain open produces; there is nothing
  // to reveal.
  if (
    start.line === 0 &&
    start.character === 0 &&
    end.line === 0 &&
    end.character === 0
  ) {
    return undefined;
  }
  return { selection: { start, end } };
}

// Parses the fragment of a Markdown link target: GitHub-style line links
// (#L12, #L12C5, #L12-L20), VS Code-style #12 or #12,5, or a heading anchor.
function parseLinkFragment(fragment) {
  if (typeof fragment !== "string" || fragment.length === 0) {
    return undefined;
  }

  const lineRange = fragment.match(/^L(\d+)(?:C(\d+))?(?:-L?(\d+)(?:C(\d+))?)?$/i);
  const linePosition = fragment.match(/^(\d+)(?:[,:](\d+))?$/);
  if (lineRange || linePosition) {
    const [, startLine, startColumn, endLine, endColumn] = lineRange || [
      ...linePosition,
      undefined,
      undefined,
    ];
    const start = {
      line: toZeroBased(startLine),
      character: toZeroBased(startColumn),
    };
    const end = endLine
      ? {
          line: toZeroBased(endLine),
          character: endColumn ? toZeroBased(endColumn) : LINE_END,
        }
      : { ...start };
    return { selection: { start, end } };
  }

  try {
    return { anchor: decodeURIComponent(fragment) };
  } catch (error) {
    return { anchor: fragment };
  }
}

function toPosition(position) {
  return {
    line: Math.max(0, Number(position?.line) || 0),
    character: Math.max(0, Number(position?.character) || 0),
  };
}

function toZeroBased(value) {
  return value ? Math.max(0, Number.parseInt(value, 10) - 1) : 0;
}

module.exports = {
  LINE_END,
  createSelectionRevealTarget,
  parseLinkFragment,
};
