// Rich table preview widget.
//
// The widget renders a Markdown table as editable cells while serializing every
// edit back to normal Markdown. Keeping this in one presenter keeps the table UI
// independent from CodeMirror state-field wiring.
import { WidgetType } from "@codemirror/view";

let tableContextMenu = null;

function stopInteractiveEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

function showTableContextMenu({
  x,
  y,
  rowIndex,
  columnIndex,
  columnCount,
  onAction,
}) {
  closeTableContextMenu();

  const menu = document.createElement("div");
  menu.className = "cm-table-context-menu";
  menu.setAttribute("role", "menu");

  const addItem = (label, action, disabled = false) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "cm-table-context-menu-item";
    item.textContent = label;
    item.disabled = disabled;
    item.setAttribute("role", "menuitem");
    item.addEventListener("mousedown", stopInteractiveEvent);
    item.addEventListener("click", (event) => {
      stopInteractiveEvent(event);
      if (item.disabled) {
        return;
      }
      closeTableContextMenu();
      onAction(action);
    });
    menu.appendChild(item);
  };

  addItem("Add column left", "add-column-left");
  addItem("Add column right", "add-column-right");
  addItem("Delete column", "delete-column", columnCount <= 1);

  if (rowIndex > 0) {
    const divider = document.createElement("div");
    divider.className = "cm-table-context-menu-divider";
    menu.appendChild(divider);
    addItem("Add row above", "add-row-above");
    addItem("Add row below", "add-row-below");
    addItem("Delete row", "delete-row");
  }

  document.body.appendChild(menu);
  tableContextMenu = menu;
  positionFixedMenu(menu, x, y);
}

function positionFixedMenu(menu, x, y) {
  const margin = 8;
  const menuWidth = menu.offsetWidth || 184;
  const menuHeight = menu.offsetHeight || 120;
  const left = Math.max(
    margin,
    Math.min(x, window.innerWidth - menuWidth - margin),
  );
  const top = Math.max(
    margin,
    Math.min(y, window.innerHeight - menuHeight - margin),
  );
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

export function closeTableContextMenu() {
  if (!tableContextMenu) {
    return false;
  }
  tableContextMenu.remove();
  tableContextMenu = null;
  return true;
}

export function createTablePreviewWidgetClass({
  setActiveTableEdit,
  requestEditorMeasure,
  appendInlineMarkdown,
}) {
  class TablePreviewWidget extends WidgetType {
    constructor(tableBlock) {
      super();
      this.tableBlock = tableBlock;
    }
  
    eq(other) {
      return (
        other.tableBlock.from === this.tableBlock.from &&
        other.tableBlock.to === this.tableBlock.to &&
        other.tableBlock.signature === this.tableBlock.signature
      );
    }

    // Advisory height (header + body rows) so CodeMirror reserves space before
    // first measure, avoiding scroll-momentum loss when a table is measured
    // mid-scroll. CodeMirror corrects this on the real measure.
    get estimatedHeight() {
      const rows = this.tableBlock.rows?.length || 1;
      return rows * 40 + 24;
    }
  
    toDOM(view) {
      const wrapper = document.createElement("div");
      wrapper.className = "cm-rich-table-preview";
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("tabindex", "0");
      wrapper.title = "Edit table cells";
      wrapper.dataset.dirty = "false";
  
      const scroll = document.createElement("div");
      scroll.className = "cm-rich-table-scroll";
  
      const table = document.createElement("table");
      table.className = "cm-rich-table";
  
      const headerRow = this.tableBlock.rows[0];
      const thead = document.createElement("thead");
      thead.appendChild(this.renderRow(headerRow, "th", 0, view));
      table.appendChild(thead);
  
      const tbody = document.createElement("tbody");
      for (
        let rowIndex = 1;
        rowIndex < this.tableBlock.rows.length;
        rowIndex += 1
      ) {
        tbody.appendChild(
          this.renderRow(this.tableBlock.rows[rowIndex], "td", rowIndex, view),
        );
      }
      table.appendChild(tbody);
  
      scroll.appendChild(table);
      wrapper.appendChild(scroll);
  
      const toolbar = document.createElement("div");
      toolbar.className = "cm-rich-table-toolbar";
  
      const addRowButton = document.createElement("button");
      addRowButton.type = "button";
      addRowButton.className = "cm-rich-table-action";
      addRowButton.title = "Add row";
      addRowButton.innerHTML =
        '<span class="cm-rich-table-action-icon">+</span><span>Row</span>';
      addRowButton.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      addRowButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.addRowFromPreview(view, wrapper);
      });
  
      toolbar.appendChild(addRowButton);
      wrapper.appendChild(toolbar);
  
      wrapper.addEventListener("input", (event) => {
        if (event.target.closest(".cm-rich-table-cell-editor")) {
          wrapper.dataset.dirty = "true";
        }
      });
      wrapper.addEventListener("contextmenu", (event) => {
        const cell = event.target.closest(".cm-rich-table-cell");
        if (!cell || !wrapper.contains(cell)) {
          return;
        }
  
        event.preventDefault();
        event.stopPropagation();
        const rowIndex = Number.parseInt(cell.dataset.rowIndex || "0", 10);
        const columnIndex = Number.parseInt(cell.dataset.columnIndex || "0", 10);
        showTableContextMenu({
          x: event.clientX,
          y: event.clientY,
          rowIndex,
          columnIndex,
          columnCount: this.tableBlock.columnCount,
          onAction: (action) => {
            this.applyTableContextAction(
              view,
              wrapper,
              rowIndex,
              columnIndex,
              action,
            );
          },
        });
      });
      wrapper.addEventListener("focusout", () => {
        window.setTimeout(() => {
          if (!wrapper.contains(document.activeElement)) {
            this.commitTableEdits(view, wrapper);
          }
        }, 0);
      });
  
      queueMicrotask(() => requestEditorMeasure(view));
      return wrapper;
    }
  
    renderRow(row, cellTag, rowIndex, view) {
      const tr = document.createElement("tr");
      tr.dataset.rowIndex = String(rowIndex);
  
      for (
        let columnIndex = 0;
        columnIndex < this.tableBlock.columnCount;
        columnIndex += 1
      ) {
        const sourceCell = row.cells[columnIndex];
        const cell = document.createElement(cellTag);
        cell.classList.add("cm-rich-table-cell");
        cell.dataset.rowIndex = String(rowIndex);
        cell.dataset.columnIndex = String(columnIndex);
        const alignment = this.tableBlock.alignments[columnIndex];
        if (alignment === "center") cell.classList.add("align-center");
        if (alignment === "right") cell.classList.add("align-right");
        if (sourceCell.from !== null) {
          cell.dataset.sourceFrom = String(sourceCell.from);
        }
        const preview = document.createElement("div");
        preview.className = "cm-rich-table-cell-preview";
        preview.dataset.rowIndex = String(rowIndex);
        preview.dataset.columnIndex = String(columnIndex);
        renderRichTableCellPreview(preview, sourceCell.text, view);
  
        const editor = document.createElement("div");
        editor.className = "cm-rich-table-cell-editor";
        editor.contentEditable = "plaintext-only";
        editor.spellcheck = true;
        editor.dataset.rowIndex = String(rowIndex);
        editor.dataset.columnIndex = String(columnIndex);
        editor.textContent = sourceCell.text;
        preview.addEventListener("mousedown", (event) => {
          if (isRichTablePreviewInteractiveTarget(event.target)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          activateRichTableCellEditor(editor);
        });
        editor.addEventListener("focus", () => {
          activateRichTableCellEditor(editor, { focus: false });
        });
        editor.addEventListener("blur", () => {
          window.setTimeout(() => {
            deactivateRichTableCellEditor(editor);
          }, 0);
        });
        editor.addEventListener("input", () => {
          renderRichTableCellPreview(
            editor.previousElementSibling,
            editor.textContent,
            view,
          );
        });
        editor.addEventListener("keydown", (event) => {
          this.handleCellKeydown(event);
        });
        cell.appendChild(preview);
        cell.appendChild(editor);
        tr.appendChild(cell);
      }
  
      return tr;
    }
  
    handleCellKeydown(event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.currentTarget.blur();
        return;
      }
  
      if (event.key !== "Tab") {
        return;
      }
  
      const wrapper = event.currentTarget.closest(".cm-rich-table-preview");
      if (!wrapper) {
        return;
      }
      const editors = [
        ...wrapper.querySelectorAll(".cm-rich-table-cell-editor"),
      ];
      const currentIndex = editors.indexOf(event.currentTarget);
      if (currentIndex === -1) {
        return;
      }
  
      event.preventDefault();
      const delta = event.shiftKey ? -1 : 1;
      const nextEditor =
        editors[(currentIndex + delta + editors.length) % editors.length];
      activateRichTableCellEditor(nextEditor, { select: true });
    }
  
    focusSource(view, sourceFrom) {
      const fallbackCell = this.tableBlock.rows
        .flatMap((row) => row.cells)
        .find((cell) => cell.from !== null);
      const target =
        sourceFrom === this.tableBlock.from && fallbackCell
          ? fallbackCell.from
          : sourceFrom;
      const anchor = Math.max(0, Math.min(target, view.state.doc.length));
      view.dispatch({
        effects: setActiveTableEdit.of({
          from: this.tableBlock.from,
          to: this.tableBlock.sourceTo,
        }),
        selection: { anchor },
        scrollIntoView: true,
      });
      view.focus();
    }
  
    addRow(view) {
      const rowText = buildEmptyTableRow(this.tableBlock);
      const insertText = `\n${rowText}`;
      const anchor = this.tableBlock.to + insertText.length;
      view.dispatch({
        changes: {
          from: this.tableBlock.sourceTo,
          insert: insertText,
        },
        effects: setActiveTableEdit.of(null),
        selection: { anchor },
        scrollIntoView: true,
      });
      view.focus();
    }
  
    addRowFromPreview(view, wrapper) {
      const rows = collectEditableTableRows(wrapper, this.tableBlock);
      rows.push(Array.from({ length: this.tableBlock.columnCount }, () => ""));
      this.replaceTable(view, rows);
    }
  
    applyTableContextAction(view, wrapper, rowIndex, columnIndex, action) {
      const rows = collectEditableTableRows(wrapper, this.tableBlock);
      const alignments = [...this.tableBlock.alignments];
      const columnCount = Math.max(1, this.tableBlock.columnCount);

      // Mutate the in-memory grid first, then serialize once. This keeps every
      // context-menu action consistent with edits already made in contenteditable
      // cells but not yet committed to the document.
      if (action === "add-column-left" || action === "add-column-right") {
        const insertAt =
          action === "add-column-left"
            ? Math.max(0, Math.min(columnIndex, columnCount))
            : Math.min(columnIndex + 1, columnCount);
        rows.forEach((row) => row.splice(insertAt, 0, ""));
        alignments.splice(insertAt, 0, "left");
      } else if (action === "delete-column") {
        if (columnCount <= 1) {
          return;
        }
        const deleteAt = Math.max(0, Math.min(columnIndex, columnCount - 1));
        rows.forEach((row) => row.splice(deleteAt, 1));
        alignments.splice(deleteAt, 1);
      } else if (action === "add-row-above" || action === "add-row-below") {
        if (rowIndex <= 0) {
          return;
        }
        const insertAt =
          action === "add-row-above"
            ? Math.max(1, Math.min(rowIndex, rows.length))
            : Math.min(rowIndex + 1, rows.length);
        rows.splice(
          insertAt,
          0,
          Array.from({ length: alignments.length }, () => ""),
        );
      } else if (action === "delete-row") {
        if (rowIndex <= 0 || rowIndex >= rows.length) {
          return;
        }
        rows.splice(rowIndex, 1);
      } else {
        return;
      }
  
      this.replaceTable(view, rows, alignments);
    }
  
    commitTableEdits(view, wrapper) {
      if (wrapper.dataset.dirty !== "true") {
        return;
      }
      const rows = collectEditableTableRows(wrapper, this.tableBlock);
      this.replaceTable(view, rows);
    }
  
    replaceTable(view, rows, alignments = this.tableBlock.alignments) {
      const nextText = serializeMarkdownTable(this.tableBlock, rows, alignments);
      const currentText = view.state.doc.sliceString(
        this.tableBlock.from,
        this.tableBlock.sourceTo,
      );
      if (nextText === currentText) {
        return;
      }
      view.dispatch({
        changes: {
          from: this.tableBlock.from,
          to: this.tableBlock.sourceTo,
          insert: nextText,
        },
        effects: setActiveTableEdit.of(null),
        selection: {
          anchor: Math.min(
            this.tableBlock.from + nextText.length,
            view.state.doc.length,
          ),
        },
      });
      requestEditorMeasure(view);
    }
  
    ignoreEvent() {
      return true;
    }
  }

  function renderRichTableCellPreview(preview, text, view) {
    if (!preview) {
      return;
    }
    preview.replaceChildren();
    appendInlineMarkdown(preview, text, {
      renderImages: true,
      onImageReady: () => requestEditorMeasure(view),
    });
  }
  
  function isRichTablePreviewInteractiveTarget(target) {
    return Boolean(target.closest("a, img"));
  }
  
  function activateRichTableCellEditor(editor, options = {}) {
    const cell = editor.closest(".cm-rich-table-cell");
    if (!cell) {
      return;
    }
    const table = cell.closest(".cm-rich-table-preview");
    if (table) {
      for (const activeCell of table.querySelectorAll(
        ".cm-rich-table-cell.is-editing",
      )) {
        if (activeCell !== cell) {
          activeCell.classList.remove("is-editing");
        }
      }
    }
  
    cell.classList.add("is-editing");
    if (options.focus !== false && document.activeElement !== editor) {
      editor.focus({ preventScroll: true });
    }
    if (options.select) {
      selectEditableText(editor);
    } else if (options.focus !== false) {
      placeCaretAtEnd(editor);
    }
  }
  
  function deactivateRichTableCellEditor(editor) {
    if (document.activeElement === editor) {
      return;
    }
    const cell = editor.closest(".cm-rich-table-cell");
    if (cell) {
      cell.classList.remove("is-editing");
    }
  }
  
  function buildEmptyTableRow(tableBlock) {
    const cells = Array.from({ length: tableBlock.columnCount }, () => "");
    if (tableBlock.usesLeadingPipe || tableBlock.usesTrailingPipe) {
      return `| ${cells.join(" | ")} |`;
    }
    return cells.map(() => " ").join(" | ");
  }
  
  function collectEditableTableRows(wrapper, tableBlock) {
    return tableBlock.rows.map((row, rowIndex) =>
      Array.from({ length: tableBlock.columnCount }, (_, columnIndex) => {
        const editor = wrapper.querySelector(
          `.cm-rich-table-cell-editor[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
        );
        return normalizeEditedTableCellText(editor?.textContent || "");
      }),
    );
  }
  
  function serializeMarkdownTable(
    tableBlock,
    rows,
    alignments = tableBlock.alignments,
  ) {
    const columnCount = Math.max(
      1,
      alignments.length,
      ...rows.map((row) => row.length),
    );
    const normalizedAlignments = Array.from(
      { length: columnCount },
      (_, index) => alignments[index] || "left",
    );
    const normalizedRows = rows.map((row) =>
      Array.from({ length: columnCount }, (_, index) => row[index] || ""),
    );
    const header =
      normalizedRows[0] || Array.from({ length: columnCount }, () => "");
    const bodyRows = normalizedRows.slice(1);
    return [
      formatMarkdownTableRow(tableBlock, header),
      formatMarkdownTableRow(
        tableBlock,
        buildTableDelimiterCells(normalizedAlignments),
      ),
      ...bodyRows.map((row) => formatMarkdownTableRow(tableBlock, row)),
    ].join("\n");
  }
  
  function buildTableDelimiterCells(alignments) {
    return alignments.map((alignment) => {
      if (alignment === "center") return ":---:";
      if (alignment === "right") return "---:";
      return "---";
    });
  }
  
  function formatMarkdownTableRow(tableBlock, cells) {
    const segments = cells.map((cell) => ` ${normalizeEditedTableCellText(cell)} `);
    const row = segments.join("|");
    if (tableBlock.usesLeadingPipe || tableBlock.usesTrailingPipe) {
      return `|${row}|`;
    }
    return row;
  }
  
  function normalizeEditedTableCellText(text) {
    return text
      .replace(/\r?\n/g, " ")
      .replace(/\|/g, "\\|")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  function selectEditableText(element) {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  
  function placeCaretAtEnd(element) {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  return TablePreviewWidget;
}
