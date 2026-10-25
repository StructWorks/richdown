// Keyboard table authoring in Markdown source.
//
// The rich table preview edits tables that already exist, but a new table
// starts life as source text with the caret inside it. These commands make
// typing one from scratch feel like a table instead of raw pipes: Enter after a
// header row writes the delimiter row, Tab and Shift+Tab hop between cells, and
// Enter adds rows (or leaves the table from an empty last row).
//
// Tables shown as rich previews get arrow-key entry instead: CodeMirror treats
// the preview as one atomic block, so Up and Down would jump straight over it.
import { syntaxTree } from "@codemirror/language";
import { EditorSelection } from "@codemirror/state";

import { scanMarkdownTableRow } from "../../../markdown/tableCells.js";
import {
  findFrontmatterBlock,
  findTableBlocks,
  isTableContentLine,
  isTableDelimiterLine,
  isTableRowLine,
} from "../../domain/markdownBlocks.js";
import { focusRichTableCell } from "../table/tablePreview.js";

// Blocks whose pipes are literal text, never the start of a table.
const NON_TABLE_CONTAINERS = new Set([
  "FencedCode",
  "CodeBlock",
  "HTMLBlock",
  "CommentBlock",
]);

export const tableKeymap = [
  { key: "Tab", run: nextTableCell },
  { key: "Shift-Tab", run: previousTableCell },
  { key: "Enter", run: insertTableRow },
];

export const tablePreviewEntryKeymap = [
  { key: "ArrowDown", run: (view) => enterTablePreview(view, "down") },
  { key: "ArrowUp", run: (view) => enterTablePreview(view, "up") },
  { key: "ArrowRight", run: (view) => enterTablePreview(view, "right") },
  { key: "ArrowLeft", run: (view) => enterTablePreview(view, "left") },
];

// Moves the caret into the cells of a rendered table it is about to cross:
// Up/Down from the adjacent line keep the column under the caret, Right from
// the end of the line above lands in the first cell and Left from the start of
// the line below in the last one.
export function enterTablePreview(view, direction) {
  const { state } = view;
  const range = state.selection.main;
  if (state.readOnly || state.selection.ranges.length > 1 || !range.empty) {
    return false;
  }
  const line = state.doc.lineAt(range.head);
  const forward = direction === "down" || direction === "right";
  const vertical = direction === "down" || direction === "up";
  if (direction === "right" && range.head !== line.to) {
    return false;
  }
  if (direction === "left" && range.head !== line.from) {
    return false;
  }
  const neighborNumber = line.number + (forward ? 1 : -1);
  if (neighborNumber < 1 || neighborNumber > state.doc.lines) {
    return false;
  }
  const neighbor = state.doc.line(neighborNumber);
  const table = findTableBlocks(state.doc).find((block) =>
    forward ? block.from === neighbor.from : block.sourceTo === neighbor.to,
  );
  if (!table) {
    return false;
  }
  // No preview element means the table is shown as source (or rich tables
  // are turned off), where the default caret movement already works.
  const wrapper = view.contentDOM.querySelector(
    `.cm-rich-table-preview[data-source-from="${table.from}"]`,
  );
  if (!wrapper) {
    return false;
  }
  if (vertical && !isOnEdgeVisualLine(view, range, line, forward)) {
    return false;
  }

  if (vertical) {
    return focusRichTableCell(wrapper, {
      row: forward ? "first" : "last",
      x: getCaretX(view, range.head),
      caret: "end",
    });
  }
  return focusRichTableCell(
    wrapper,
    forward
      ? { row: "first", column: "first", caret: "start" }
      : { row: "last", column: "last", caret: "end" },
  );
}

// A wrapped line only hands the caret to the table from its last (Down) or
// first (Up) visual line.
function isOnEdgeVisualLine(view, range, line, forward) {
  try {
    const moved = view.moveVertically(range, forward);
    return forward ? moved.head > line.to : moved.head < line.from;
  } catch {
    return true;
  }
}

function getCaretX(view, pos) {
  try {
    return view.coordsAtPos(pos)?.left;
  } catch {
    return undefined;
  }
}

export function nextTableCell({ state, dispatch }) {
  return moveTableCell(state, dispatch, 1);
}

export function previousTableCell({ state, dispatch }) {
  return moveTableCell(state, dispatch, -1);
}

export function insertTableRow({ state, dispatch }) {
  if (state.readOnly || state.selection.ranges.length > 1) {
    return false;
  }
  const range = state.selection.main;
  if (!range.empty) {
    return false;
  }
  const line = state.doc.lineAt(range.head);
  const table = findTableAt(state, range.head);

  if (table) {
    const row = table.sourceRows.find((entry) => entry.line.number === line.number);
    if (!row) {
      return false;
    }
    if (
      row.role === "body" &&
      row === table.sourceRows.at(-1) &&
      isBlankTableRow(line.text)
    ) {
      // An empty last row is the conventional "I'm done" signal: drop it and
      // leave the caret on the now-blank line below the table.
      dispatch(
        state.update({
          changes: { from: line.from, to: line.to, insert: "" },
          selection: { anchor: line.from },
          scrollIntoView: true,
          userEvent: "delete",
        }),
      );
      return true;
    }
    // From the header (or delimiter) the new row becomes the first body row.
    const afterLine = row.role === "body" ? line : table.sourceRows[1].line;
    dispatch(insertRowAfter(state, afterLine, table, table.columnCount));
    return true;
  }

  if (!isTableHeaderCandidate(state, line, range.head)) {
    return false;
  }
  // The header is led by a pipe, so a missing closing pipe means it is simply
  // unfinished: close it, and write the new rows in the same full-pipe style.
  const header = { ...scanMarkdownTableRow(line.text), usesTrailingPipe: true };
  const headerText = line.text.trimEnd();
  const closedHeader = headerText.endsWith("|") ? headerText : `${headerText} |`;
  const columnCount = header.cells.length;
  const delimiter = formatTableRow(
    header,
    Array.from({ length: columnCount }, () => "---"),
  );
  const body = formatTableRow(
    header,
    Array.from({ length: columnCount }, () => ""),
  );
  const bodyFrom = line.from + closedHeader.length + 1 + delimiter.length + 1;
  dispatch(
    state.update({
      changes: {
        from: line.from,
        to: line.to,
        insert: `${closedHeader}\n${delimiter}\n${body}`,
      },
      selection: { anchor: bodyFrom + firstCellCaretOffset(header) },
      scrollIntoView: true,
      userEvent: "input",
    }),
  );
  return true;
}

function moveTableCell(state, dispatch, direction) {
  if (state.readOnly || state.selection.ranges.length > 1) {
    return false;
  }
  const range = state.selection.main;
  const table = findTableAt(state, range.from);
  // A selection spanning several lines is an indent request, not navigation.
  if (
    !table ||
    range.to > table.sourceTo ||
    state.doc.lineAt(range.from).number !== state.doc.lineAt(range.to).number
  ) {
    return false;
  }

  const rows = table.sourceRows.filter((row) => row.role !== "delimiter");
  const lineNumber = state.doc.lineAt(range.head).number;
  let rowIndex = rows.findIndex((row) => row.line.number === lineNumber);
  let cellIndex;
  if (rowIndex === -1) {
    // On the delimiter row: behave as if the caret sat between the header's
    // last cell and the first body row.
    rowIndex = 0;
    const headerCells = getRowCells(rows[0].line);
    cellIndex = direction > 0 ? headerCells.length - 1 : headerCells.length;
  } else {
    cellIndex = findCellIndex(getRowCells(rows[rowIndex].line), range.head);
  }

  let targetRow = rowIndex;
  let targetCell = cellIndex + direction;
  const cellCount = getRowCells(rows[rowIndex].line).length;
  if (targetCell >= cellCount) {
    targetRow += 1;
    targetCell = 0;
  } else if (targetCell < 0) {
    targetRow -= 1;
    targetCell = Number.POSITIVE_INFINITY;
  }

  if (targetRow < 0) {
    // Swallow Shift+Tab on the first cell so it cannot outdent the header row
    // away from the rest of the table.
    return true;
  }
  if (targetRow >= rows.length) {
    dispatch(insertRowAfter(state, rows.at(-1).line, table, table.columnCount));
    return true;
  }

  const targetCells = getRowCells(rows[targetRow].line);
  const target = targetCells[Math.min(targetCell, targetCells.length - 1)];
  dispatch(
    state.update({
      selection: EditorSelection.create([cellContentSelection(state, target)]),
      scrollIntoView: true,
      userEvent: "select",
    }),
  );
  return true;
}

function findTableAt(state, pos) {
  return (
    findTableBlocks(state.doc).find(
      (table) => pos >= table.from && pos <= table.sourceTo,
    ) || null
  );
}

function getRowCells(line) {
  return scanMarkdownTableRow(line.text).cells.map((cell) => ({
    from: line.from + cell.from,
    to: line.from + cell.to,
  }));
}

function findCellIndex(cells, pos) {
  const index = cells.findIndex((cell) => pos <= cell.to);
  return index === -1 ? cells.length - 1 : index;
}

// Select the cell's text so typing replaces it; an empty cell gets a caret just
// after its leading space instead.
function cellContentSelection(state, cell) {
  const raw = state.doc.sliceString(cell.from, cell.to);
  const leading = raw.length - raw.trimStart().length;
  if (leading === raw.length) {
    return EditorSelection.cursor(cell.from + Math.min(1, raw.length));
  }
  const trailing = raw.length - raw.trimEnd().length;
  return EditorSelection.range(cell.from + leading, cell.to - trailing);
}

function insertRowAfter(state, afterLine, style, columnCount) {
  const rowText = formatTableRow(
    style,
    Array.from({ length: columnCount }, () => ""),
  );
  return state.update({
    changes: { from: afterLine.to, insert: `\n${rowText}` },
    selection: { anchor: afterLine.to + 1 + firstCellCaretOffset(style) },
    scrollIntoView: true,
    userEvent: "input",
  });
}

function formatTableRow(style, cells) {
  // A single unpiped column would not read back as a table row.
  const usesTrailingPipe =
    style.usesTrailingPipe || (!style.usesLeadingPipe && cells.length === 1);
  return (
    `${style.indent || ""}${style.usesLeadingPipe ? "|" : ""}` +
    cells.map((cell) => ` ${cell} `).join("|") +
    `${usesTrailingPipe ? "|" : ""}`
  );
}

function firstCellCaretOffset(style) {
  return (style.indent || "").length + (style.usesLeadingPipe ? 1 : 0) + 1;
}

function isBlankTableRow(text) {
  return scanMarkdownTableRow(text).cells.every((cell) => !cell.text);
}

// A pipe-led row typed on its own ("| Name | Age |") that Enter should turn into
// a table. The checks stay strict so ordinary prose containing a pipe keeps its
// plain Enter behavior.
function isTableHeaderCandidate(state, line, head) {
  const text = line.text;
  if (head < line.from + text.trimEnd().length) {
    return false;
  }
  if (!text.trimStart().startsWith("|")) {
    return false;
  }
  if (!isTableContentLine(text) || isTableDelimiterLine(text)) {
    return false;
  }
  const row = scanMarkdownTableRow(text);
  if (row.cells.length < 2 && !row.usesTrailingPipe) {
    return false;
  }
  if (line.number > 1 && isTableRowLine(state.doc.line(line.number - 1).text)) {
    return false;
  }
  if (
    line.number < state.doc.lines &&
    isTableDelimiterLine(state.doc.line(line.number + 1).text)
  ) {
    return false;
  }
  const frontmatter = findFrontmatterBlock(state.doc);
  if (frontmatter && line.from >= frontmatter.from && line.from <= frontmatter.to) {
    return false;
  }
  for (
    let node = syntaxTree(state).resolveInner(line.from, 1);
    node;
    node = node.parent
  ) {
    if (NON_TABLE_CONTAINERS.has(node.name)) {
      return false;
    }
  }
  return true;
}
