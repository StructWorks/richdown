// @vitest-environment jsdom
import { markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { afterEach, describe, expect, it } from "vitest";

import {
  enterTablePreview,
  insertTableRow,
  nextTableCell,
  previousTableCell,
} from "../src/rich-editor/presentation/codemirror/tableKeymap.js";
import { createPreviewHarness } from "./helpers/previewHarness.js";

const markdownLanguage = yamlFrontmatter({
  content: markdown({ extensions: GFM }),
});

// "^" marks the caret; "[" and "]" mark a selection.
function create(source) {
  const selectionStart = source.indexOf("[");
  let doc;
  let selection;
  if (selectionStart !== -1) {
    const selectionEnd = source.indexOf("]") - 1;
    doc = source.replace("[", "").replace("]", "");
    selection = EditorSelection.single(selectionStart, selectionEnd);
  } else {
    const caret = source.indexOf("^");
    doc = source.replace("^", "");
    selection = EditorSelection.single(caret);
  }
  const state = EditorState.create({
    doc,
    selection,
    extensions: [markdownLanguage],
  });
  ensureSyntaxTree(state, state.doc.length);
  return state;
}

function run(command, state) {
  let next = state;
  const handled = command({
    state,
    dispatch: (transaction) => {
      next = transaction.state;
    },
  });
  return { handled, state: next };
}

// Renders the state back in the same notation create() accepts.
function show(state) {
  const { from, to } = state.selection.main;
  const doc = state.doc.toString();
  if (from === to) {
    return `${doc.slice(0, from)}^${doc.slice(from)}`;
  }
  return `${doc.slice(0, from)}[${doc.slice(from, to)}]${doc.slice(to)}`;
}

describe("Enter on a typed header row", () => {
  it("writes the delimiter and an empty row, then puts the caret in it", () => {
    const { handled, state } = run(insertTableRow, create("| Name | Age |^"));
    expect(handled).toBe(true);
    expect(show(state)).toBe(
      "| Name | Age |\n| --- | --- |\n| ^ |  |",
    );
  });

  it("closes a header typed without its trailing pipe", () => {
    const { state } = run(insertTableRow, create("| Name | Age ^"));
    expect(show(state)).toBe("| Name | Age |\n| --- | --- |\n| ^ |  |");
  });

  it("keeps the header's indentation", () => {
    const { state } = run(insertTableRow, create("  | A | B |^"));
    expect(show(state)).toBe("  | A | B |\n  | --- | --- |\n  | ^ |  |");
  });

  it("accepts a single-column header", () => {
    const { state } = run(insertTableRow, create("| Only |^"));
    expect(show(state)).toBe("| Only |\n| --- |\n| ^ |");
  });

  it("ignores prose, code fences and lines that are not at their end", () => {
    for (const source of [
      "a | b^",
      "| a^",
      "| Name ^| Age |",
      "```\n| a | b |^\n```",
      "|  |  |^",
    ]) {
      expect(run(insertTableRow, create(source)).handled, source).toBe(false);
    }
  });

  it("leaves a row under another pipe row alone", () => {
    expect(run(insertTableRow, create("| a | b |\n| c | d |^")).handled).toBe(
      false,
    );
  });
});

describe("Enter inside a table", () => {
  const table = "| A | B |\n| --- | --- |\n| 1 | 2 |";

  it("adds an empty row below the current body row", () => {
    const { state } = run(
      insertTableRow,
      create("| A | B |\n| --- | --- |\n| 1^ | 2 |"),
    );
    expect(show(state)).toBe(`${table}\n| ^ |  |`);
  });

  it("adds the first body row from the header", () => {
    const { state } = run(
      insertTableRow,
      create("| A^ | B |\n| --- | --- |\n| 1 | 2 |"),
    );
    expect(show(state)).toBe(
      "| A | B |\n| --- | --- |\n| ^ |  |\n| 1 | 2 |",
    );
  });

  it("leaves the table from an empty last row", () => {
    const { state } = run(insertTableRow, create(`${table}\n| ^ |  |\nnext`));
    expect(show(state)).toBe(`${table}\n^\nnext`);
  });

  it("does not handle a selection", () => {
    expect(
      run(insertTableRow, create("| [A] | B |\n| --- | --- |\n| 1 | 2 |"))
        .handled,
    ).toBe(false);
  });
});

describe("Tab between cells", () => {
  it("selects the next cell's text", () => {
    const { state } = run(
      nextTableCell,
      create("| Name^ | Age |\n| --- | --- |\n| a | 1 |"),
    );
    expect(show(state)).toBe("| Name | [Age] |\n| --- | --- |\n| a | 1 |");
  });

  it("wraps to the next row and skips the delimiter", () => {
    const { state } = run(
      nextTableCell,
      create("| Name | Age^ |\n| --- | --- |\n| a | 1 |"),
    );
    expect(show(state)).toBe("| Name | Age |\n| --- | --- |\n| [a] | 1 |");
  });

  it("puts the caret inside an empty cell", () => {
    const { state } = run(
      nextTableCell,
      create("| A | B |\n| --- | --- |\n| x^ |  |"),
    );
    expect(show(state)).toBe("| A | B |\n| --- | --- |\n| x | ^ |");
  });

  it("appends a row from the last cell", () => {
    const { state } = run(
      nextTableCell,
      create("| A | B |\n| --- | --- |\n| 1 | 2^ |"),
    );
    expect(show(state)).toBe(
      "| A | B |\n| --- | --- |\n| 1 | 2 |\n| ^ |  |",
    );
  });

  it("walks the slash-command skeleton header by header", () => {
    let state = create(
      "| [Column] | Column |\n| --- | --- |\n|  |  |",
    );
    state = run(nextTableCell, state).state;
    expect(show(state)).toBe("| Column | [Column] |\n| --- | --- |\n|  |  |");
    state = run(nextTableCell, state).state;
    expect(show(state)).toBe("| Column | Column |\n| --- | --- |\n| ^ |  |");
  });

  it("goes back with Shift+Tab, across rows", () => {
    const { state } = run(
      previousTableCell,
      create("| A | B |\n| --- | --- |\n| ^1 | 2 |"),
    );
    expect(show(state)).toBe("| A | [B] |\n| --- | --- |\n| 1 | 2 |");
  });

  it("swallows Shift+Tab on the first cell instead of outdenting", () => {
    const start = create("| ^A | B |\n| --- | --- |");
    const { handled, state } = run(previousTableCell, start);
    expect(handled).toBe(true);
    expect(show(state)).toBe(show(start));
  });

  it("falls through outside tables and for multi-line selections", () => {
    expect(run(nextTableCell, create("plain^ text")).handled).toBe(false);
    expect(
      run(nextTableCell, create("| [A | B |\n| ---] | --- |\n| 1 | 2 |"))
        .handled,
    ).toBe(false);
  });
});

describe("arrow keys into a rendered table", () => {
  const doc = ["intro", "", "| A | B |", "| --- | --- |", "| 1 | 2 |", "", "end"].join(
    "\n",
  );
  let harness;

  afterEach(() => {
    harness?.destroy();
    harness = null;
    document.body.replaceChildren();
  });

  function mountAt(anchor, settings) {
    harness = createPreviewHarness({ doc, selection: { anchor }, settings });
    const dom = harness.view.contentDOM.querySelector(".cm-rich-table-preview");
    return { view: harness.view, dom };
  }

  function editingCell(dom) {
    const cell = dom.querySelector(".cm-rich-table-cell.is-editing");
    return cell && [cell.dataset.rowIndex, cell.dataset.columnIndex];
  }

  it("enters the first row with Down from the line above", () => {
    const { view, dom } = mountAt(doc.indexOf("\n\n") + 1);
    expect(enterTablePreview(view, "down")).toBe(true);
    expect(editingCell(dom)).toEqual(["0", "0"]);
  });

  it("enters the last row with Up from the line below", () => {
    const { view, dom } = mountAt(doc.indexOf("\n\nend") + 1);
    expect(enterTablePreview(view, "up")).toBe(true);
    expect(editingCell(dom)?.[0]).toBe("1");
  });

  it("enters the first cell with Right only from the end of the line above", () => {
    const { view, dom } = mountAt(doc.indexOf("\n\n") + 1);
    expect(enterTablePreview(view, "right")).toBe(true);
    expect(editingCell(dom)).toEqual(["0", "0"]);
  });

  it("enters the last cell with Left from the start of the line below", () => {
    const { view, dom } = mountAt(doc.indexOf("\n\nend") + 1);
    expect(enterTablePreview(view, "left")).toBe(true);
    expect(editingCell(dom)).toEqual(["1", "1"]);
  });

  it("leaves the caret alone away from a table", () => {
    const { view } = mountAt(2);
    expect(enterTablePreview(view, "down")).toBe(false);
    expect(enterTablePreview(view, "right")).toBe(false);
  });

  it("keeps the default movement when tables are not rendered", () => {
    const { view } = mountAt(doc.indexOf("\n\n") + 1, {
      richTablePreview: false,
    });
    expect(enterTablePreview(view, "down")).toBe(false);
  });
});
