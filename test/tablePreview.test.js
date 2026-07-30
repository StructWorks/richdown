// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { closeTableContextMenu } from "../src/rich-editor/presentation/table/tablePreview.js";
import { createPreviewHarness } from "./helpers/previewHarness.js";

// The caret starts outside the table so the rich preview is shown instead of the
// source rows (a caret inside a table opens its Markdown for editing).
const TABLE_DOC = [
  "intro",
  "",
  "| Name | Value |",
  "| --- | ---: |",
  "| a | 1 |",
  "| b | 2 |",
  "",
].join("\n");

let harness;

function mount(options = {}) {
  harness = createPreviewHarness({ doc: TABLE_DOC, ...options });
  const widget = harness.widget("TablePreviewWidget");
  expect(widget, "the document must produce a table preview").toBeTruthy();
  const dom = widget.toDOM(harness.view);
  document.body.appendChild(dom);
  return { widget, dom, view: harness.view };
}

function cellEditor(dom, rowIndex, columnIndex) {
  return dom.querySelector(
    `.cm-rich-table-cell-editor[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
  );
}

function cellPreview(dom, rowIndex, columnIndex) {
  return dom.querySelector(
    `.cm-rich-table-cell-preview[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
  );
}

function type(editor, text) {
  editor.dispatchEvent(new FocusEvent("focus"));
  editor.textContent = text;
  editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function keydown(target, key, options = {}) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...options }),
  );
}

afterEach(() => {
  closeTableContextMenu();
  harness?.destroy();
  harness = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("table preview decoration", () => {
  it("replaces the Markdown table with a block widget", () => {
    harness = createPreviewHarness({ doc: TABLE_DOC });
    const entry = harness.widgetEntry("TablePreviewWidget");

    expect(entry.spec.block).toBe(true);
    expect(harness.view.state.doc.sliceString(entry.from, entry.to)).toContain(
      "| Name | Value |",
    );
  });

  it("shows the Markdown source while the caret is inside the table", () => {
    harness = createPreviewHarness({
      doc: TABLE_DOC,
      selection: { anchor: TABLE_DOC.indexOf("| a | 1 |") + 3 },
    });

    expect(harness.widget("TablePreviewWidget")).toBeNull();
    expect(harness.lineClasses().join(" ")).toContain("cm-table-header-line");
  });

  it("keeps the source styling when rich tables are disabled", () => {
    harness = createPreviewHarness({
      doc: TABLE_DOC,
      settings: { richTablePreview: false },
    });

    expect(harness.widget("TablePreviewWidget")).toBeNull();
    expect(harness.lineClasses().join(" ")).toContain("cm-table-line");
  });

  it("keeps the preview in a read-only editor with the caret inside", () => {
    // A read-only diff view must never fall back to source just because the
    // caret happens to sit in the table.
    harness = createPreviewHarness({
      doc: TABLE_DOC,
      readOnly: true,
      selection: { anchor: TABLE_DOC.indexOf("| a | 1 |") + 3 },
    });

    expect(harness.widget("TablePreviewWidget")).toBeTruthy();
  });

  it("compares widgets by range and source signature", () => {
    harness = createPreviewHarness({ doc: TABLE_DOC });
    const widget = harness.widget("TablePreviewWidget");

    expect(widget.eq(widget)).toBe(true);
    expect(
      widget.eq({
        tableBlock: { ...widget.tableBlock, signature: "different" },
      }),
    ).toBe(false);
  });

  it("estimates a height from the row count", () => {
    harness = createPreviewHarness({ doc: TABLE_DOC });
    // Header plus two body rows.
    expect(harness.widget("TablePreviewWidget").estimatedHeight).toBe(3 * 40 + 24);
  });

  it("handles its own events so CodeMirror does not steal cell clicks", () => {
    harness = createPreviewHarness({ doc: TABLE_DOC });
    expect(harness.widget("TablePreviewWidget").ignoreEvent()).toBe(true);
  });
});

describe("table preview DOM", () => {
  it("builds an accessible editable table", () => {
    const { dom } = mount();

    expect(dom.getAttribute("role")).toBe("region");
    expect(dom.getAttribute("aria-label")).toBe("Editable Markdown table");
    expect(dom.dataset.dirty).toBe("false");
    expect(dom.querySelectorAll("thead th")).toHaveLength(2);
    expect(dom.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(
      [...dom.querySelectorAll("thead th .cm-rich-table-cell-preview")].map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["Name", "Value"]);
  });

  it("marks the source offset of the block and of every cell", () => {
    const { dom } = mount();
    expect(dom.dataset.sourceFrom).toBe(String(TABLE_DOC.indexOf("| Name")));
    expect(cellEditor(dom, 1, 0).closest(".cm-rich-table-cell").dataset.sourceFrom)
      .toBe(String(TABLE_DOC.indexOf("| a | 1 |") + 2));
  });

  it("applies column alignment classes from the delimiter row", () => {
    const { dom } = mount();
    const [name, value] = dom.querySelectorAll("thead th");

    expect(name.classList.contains("align-right")).toBe(false);
    expect(value.classList.contains("align-right")).toBe(true);
  });

  it("labels each cell with its row and column for screen readers", () => {
    const { dom } = mount();
    expect(cellPreview(dom, 1, 1).getAttribute("aria-label")).toBe(
      "Edit Row 1, Value: 1",
    );
    expect(cellPreview(dom, 0, 0).getAttribute("aria-label")).toBe(
      "Edit Header, Name: Name",
    );
  });

  it("uses a roving tabindex so the table is one tab stop", () => {
    const { dom } = mount();
    expect(cellPreview(dom, 0, 0).tabIndex).toBe(0);
    expect(cellPreview(dom, 1, 1).tabIndex).toBe(-1);
  });

  it("renders inline Markdown and literal pipes inside cells", () => {
    harness = createPreviewHarness({
      doc: [
        "intro",
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| **bold** | a \\| b |",
        "",
      ].join("\n"),
    });
    const dom = harness.widget("TablePreviewWidget").toDOM(harness.view);

    expect(cellPreview(dom, 1, 0).querySelector("strong").textContent).toBe(
      "bold",
    );
    expect(cellPreview(dom, 1, 1).textContent).toBe("a | b");
  });

  it("offers row and column actions plus a keyboard hint", () => {
    const { dom } = mount();
    expect(
      [...dom.querySelectorAll(".cm-rich-table-action")].map(
        (button) => button.title,
      ),
    ).toEqual(["Add row", "Add column"]);
    expect(dom.querySelector(".cm-rich-table-toolbar-hint").textContent).toContain(
      "Shift+F10",
    );
  });

  it("drops every editing affordance in a read-only editor", () => {
    const { dom } = mount({ readOnly: true });

    expect(dom.getAttribute("aria-label")).toBe("Markdown table");
    expect(dom.classList.contains("is-read-only")).toBe(true);
    expect(dom.querySelector(".cm-rich-table-toolbar")).toBeNull();
    expect(dom.querySelector(".cm-rich-table-cell-actions")).toBeNull();
    expect(cellEditor(dom, 1, 0).contentEditable).toBe("false");
    expect(cellPreview(dom, 0, 0).tabIndex).toBe(-1);
  });
});

describe("editing cells", () => {
  it("commits an edited cell back to the Markdown source", () => {
    vi.useFakeTimers();
    const { dom, view } = mount();

    type(cellEditor(dom, 1, 0), "updated");
    expect(dom.dataset.dirty).toBe("true");

    dom.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    vi.advanceTimersByTime(0);

    expect(view.state.doc.toString()).toContain("| updated | 1 |");
    expect(view.state.doc.toString()).toContain("| b | 2 |");
  });

  it("escapes a typed pipe so the table structure survives", () => {
    vi.useFakeTimers();
    const { dom, view } = mount();

    type(cellEditor(dom, 1, 0), "a | b");
    dom.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    vi.advanceTimersByTime(0);

    expect(view.state.doc.toString()).toContain("| a \\| b | 1 |");
  });

  it("collapses a pasted newline instead of breaking the row", () => {
    vi.useFakeTimers();
    const { dom, view } = mount();

    type(cellEditor(dom, 1, 0), "two\nlines");
    dom.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    vi.advanceTimersByTime(0);

    expect(view.state.doc.toString()).toContain("| two lines | 1 |");
  });

  it("does not touch the document when nothing changed", () => {
    vi.useFakeTimers();
    const { dom, view } = mount();
    const before = view.state.doc.toString();

    dom.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    vi.advanceTimersByTime(0);

    expect(view.state.doc.toString()).toBe(before);
  });

  it("restores the original text on Escape", () => {
    const { dom, view } = mount();
    const editor = cellEditor(dom, 1, 0);

    type(editor, "half typed");
    keydown(editor, "Escape");

    expect(editor.textContent).toBe("a");
    expect(dom.dataset.dirty).toBe("false");
    expect(view.state.doc.toString()).toContain("| a | 1 |");
  });

  it("preserves the preview while typing", () => {
    const { dom } = mount();
    type(cellEditor(dom, 1, 0), "**strong**");
    expect(cellPreview(dom, 1, 0).querySelector("strong").textContent).toBe(
      "strong",
    );
  });

  // jsdom cannot focus a contenteditable element, so cell activation is observed
  // through the is-editing class the widget puts on the active cell.
  function editingCell(dom) {
    const cell = dom.querySelector(".cm-rich-table-cell.is-editing");
    return cell && [cell.dataset.rowIndex, cell.dataset.columnIndex];
  }

  it("moves to the next cell with Tab and back with Shift+Tab", () => {
    const { dom } = mount();
    keydown(cellEditor(dom, 0, 0), "Tab");
    expect(editingCell(dom)).toEqual(["0", "1"]);

    keydown(cellEditor(dom, 0, 1), "Tab", { shiftKey: true });
    expect(editingCell(dom)).toEqual(["0", "0"]);
  });

  it("activates only one cell at a time", () => {
    const { dom } = mount();
    keydown(cellEditor(dom, 0, 0), "Tab");
    keydown(cellEditor(dom, 0, 1), "Tab");

    expect(dom.querySelectorAll(".cm-rich-table-cell.is-editing")).toHaveLength(
      1,
    );
  });

  it("moves down a row on Enter", () => {
    const { dom } = mount();
    keydown(cellEditor(dom, 0, 0), "Enter");
    expect(editingCell(dom)).toEqual(["1", "0"]);
  });

  it("navigates cells with the arrow keys from the preview", () => {
    const { dom } = mount();
    const start = cellPreview(dom, 0, 0);
    start.focus();

    keydown(start, "ArrowRight");
    expect(document.activeElement).toBe(cellPreview(dom, 0, 1));

    keydown(cellPreview(dom, 0, 1), "ArrowDown");
    expect(document.activeElement).toBe(cellPreview(dom, 1, 1));

    keydown(cellPreview(dom, 1, 1), "ArrowLeft");
    expect(document.activeElement).toBe(cellPreview(dom, 1, 0));
  });

  it("opens the cell editor with Enter from the preview", () => {
    const { dom } = mount();
    const preview = cellPreview(dom, 1, 0);
    preview.focus();

    keydown(preview, "Enter");
    expect(
      cellEditor(dom, 1, 0).closest(".cm-rich-table-cell").classList.contains(
        "is-editing",
      ),
    ).toBe(true);
  });

  it("moves the caret into the Markdown source when a cell is focused there", () => {
    const { widget, view } = mount();
    const cell = widget.tableBlock.rows[1].cells[0];

    widget.focusSource(view, cell.from);
    expect(view.state.selection.main.anchor).toBe(cell.from);
    // The caret is inside the table now, so the source rows take over.
    expect(harness.widget("TablePreviewWidget")).toBeNull();
  });
});

describe("row and column actions", () => {
  it("appends an empty row from the toolbar", () => {
    const { dom, view } = mount();
    dom
      .querySelector('.cm-rich-table-action[title="Add row"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.toString().split("\n")).toContain("|  |  |");
  });

  it("appends a left-aligned column from the toolbar", () => {
    const { dom, view } = mount();
    dom
      .querySelector('.cm-rich-table-action[title="Add column"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.toString()).toContain("| Name | Value |  |");
    expect(view.state.doc.toString()).toContain("| --- | ---: | --- |");
  });

  it("keeps uncommitted cell edits when a column is added", () => {
    const { dom, view } = mount();
    type(cellEditor(dom, 1, 0), "kept");
    dom
      .querySelector('.cm-rich-table-action[title="Add column"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.toString()).toContain("| kept | 1 |  |");
  });

  it("writes alignment delimiters back for every column", () => {
    harness = createPreviewHarness({
      doc: [
        "intro",
        "",
        "| A | B | C |",
        "| :--- | :---: | ---: |",
        "| 1 | 2 | 3 |",
        "",
      ].join("\n"),
    });
    const dom = harness.widget("TablePreviewWidget").toDOM(harness.view);
    document.body.appendChild(dom);

    dom
      .querySelector('.cm-rich-table-action[title="Add row"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(harness.view.state.doc.toString()).toContain("| --- | :---: | ---: |");
  });

  it("preserves a borderless table's indent and missing outer pipes", () => {
    harness = createPreviewHarness({
      doc: ["intro", "", "  A | B", "  --- | ---", "  1 | 2", ""].join("\n"),
    });
    const dom = harness.widget("TablePreviewWidget").toDOM(harness.view);
    document.body.appendChild(dom);

    dom
      .querySelector('.cm-rich-table-action[title="Add row"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(harness.view.state.doc.toString().split("\n").slice(2, 6)).toEqual([
      "   A | B ",
      "   --- | --- ",
      "   1 | 2 ",
      "    |  ",
    ]);
  });
});

describe("cell context menu", () => {
  function openMenu(dom, rowIndex = 1, columnIndex = 0) {
    cellEditor(dom, rowIndex, columnIndex)
      .closest(".cm-rich-table-cell")
      .dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    return document.querySelector(".cm-table-context-menu");
  }

  it("offers row actions for a body cell", () => {
    const { dom } = mount();
    const menu = openMenu(dom);

    expect(menu.getAttribute("role")).toBe("menu");
    expect(
      [...menu.querySelectorAll(".cm-table-context-menu-item")].map(
        (item) => item.textContent,
      ),
    ).toEqual([
      "Add column left",
      "Add column right",
      "Delete column",
      "Add row above",
      "Add row below",
      "Delete row",
    ]);
  });

  it("hides row actions for the header row", () => {
    const { dom } = mount();
    const labels = [
      ...openMenu(dom, 0, 0).querySelectorAll(".cm-table-context-menu-item"),
    ].map((item) => item.textContent);

    expect(labels).toEqual([
      "Add column left",
      "Add column right",
      "Delete column",
    ]);
  });

  it("disables deleting the only column", () => {
    harness = createPreviewHarness({
      doc: ["intro", "", "| A |", "| --- |", "| 1 |", ""].join("\n"),
    });
    const dom = harness.widget("TablePreviewWidget").toDOM(harness.view);
    document.body.appendChild(dom);

    const menu = openMenu(dom);
    expect(
      [...menu.querySelectorAll(".cm-table-context-menu-item")].find(
        (item) => item.textContent === "Delete column",
      ).disabled,
    ).toBe(true);
  });

  function clickAction(menu, label) {
    [...menu.querySelectorAll(".cm-table-context-menu-item")]
      .find((item) => item.textContent === label)
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  // The menu opens on the first column of a body row, so the actions apply there.
  it.each([
    ["Add column left", "|  | Name | Value |"],
    ["Add column right", "| Name |  | Value |"],
    ["Delete column", "| Value |"],
  ])("applies %s", (label, expected) => {
    const { dom, view } = mount();
    clickAction(openMenu(dom), label);

    expect(view.state.doc.toString()).toContain(expected);
    expect(document.querySelector(".cm-table-context-menu")).toBeNull();
  });

  it("removes the alignment of a deleted column", () => {
    const { dom, view } = mount();
    clickAction(openMenu(dom), "Delete column");

    expect(view.state.doc.toString()).toContain("| ---: |");
    expect(view.state.doc.toString()).not.toContain("| --- | ---: |");
  });

  it("adds a row above the clicked body row", () => {
    const { dom, view } = mount();
    clickAction(openMenu(dom, 2, 0), "Add row above");

    const lines = view.state.doc.toString().split("\n");
    expect(lines[lines.indexOf("| b | 2 |") - 1]).toBe("|  |  |");
  });

  it("deletes the clicked body row", () => {
    const { dom, view } = mount();
    clickAction(openMenu(dom, 1, 0), "Delete row");

    expect(view.state.doc.toString()).not.toContain("| a | 1 |");
    expect(view.state.doc.toString()).toContain("| b | 2 |");
  });

  it("closes on Escape and returns focus to the cell", () => {
    vi.useFakeTimers();
    const { dom } = mount();
    const menu = openMenu(dom);

    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(".cm-table-context-menu")).toBeNull();

    // Focus restore runs on the next animation frames with a 100ms fallback.
    vi.advanceTimersByTime(100);
    expect(document.activeElement).toBe(cellPreview(dom, 1, 0));
    expect(cellPreview(dom, 1, 0).tabIndex).toBe(0);
  });

  it("moves through items with the arrow keys", () => {
    const { dom } = mount();
    const menu = openMenu(dom);
    const items = [...menu.querySelectorAll(".cm-table-context-menu-item")];

    items[0].focus();
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(document.activeElement).toBe(items[1]);

    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "End" }));
    expect(document.activeElement).toBe(items[items.length - 1]);

    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Home" }));
    expect(document.activeElement).toBe(items[0]);
  });

  it("opens from the cell actions button and from Shift+F10", () => {
    const { dom } = mount();

    dom
      .querySelector(".cm-rich-table-cell-actions")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector(".cm-table-context-menu")).toBeTruthy();

    closeTableContextMenu();
    const preview = cellPreview(dom, 1, 0);
    preview.focus();
    keydown(preview, "F10", { shiftKey: true });
    expect(document.querySelector(".cm-table-context-menu")).toBeTruthy();
  });

  it("reports whether closing did anything", () => {
    const { dom } = mount();
    openMenu(dom);

    expect(closeTableContextMenu()).toBe(true);
    expect(closeTableContextMenu()).toBe(false);
  });

  it("replaces an already open menu instead of stacking menus", () => {
    const { dom } = mount();
    openMenu(dom, 1, 0);
    openMenu(dom, 2, 1);

    expect(document.querySelectorAll(".cm-table-context-menu")).toHaveLength(1);
  });
});

describe("pasting a grid into a cell", () => {
  function paste(editor, text) {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    event.clipboardData = { getData: () => text };
    editor.dispatchEvent(event);
    return event;
  }

  it("expands tab separated values across cells and rows", () => {
    const { dom, view } = mount();
    paste(cellEditor(dom, 1, 0), "x\ty\nz\tw");

    const text = view.state.doc.toString();
    expect(text).toContain("| x | y |");
    expect(text).toContain("| z | w |");
  });

  it("adds the rows a paste needs", () => {
    const { dom, view } = mount();
    paste(cellEditor(dom, 2, 0), "p\tq\nr\ts");

    const lines = view.state.doc.toString().split("\n");
    expect(lines).toContain("| p | q |");
    expect(lines).toContain("| r | s |");
  });

  it("adds the columns a wide paste needs", () => {
    const { dom, view } = mount();
    paste(cellEditor(dom, 1, 1), "one\ttwo\tthree");

    expect(view.state.doc.toString()).toContain("| a | one | two | three |");
    expect(view.state.doc.toString()).toContain("| --- | ---: | --- | --- |");
  });

  it("leaves a plain single-cell paste to the browser", () => {
    const { dom } = mount();
    const event = paste(cellEditor(dom, 1, 0), "just text");
    expect(event.defaultPrevented).toBe(false);
  });
});
