// Rich table preview widget.
//
// The widget renders a Markdown table as editable cells while serializing every
// edit back to normal Markdown. Keeping this in one presenter keeps the table UI
// independent from CodeMirror state-field wiring.
import { WidgetType } from "@codemirror/view";
import {
  escapeMarkdownTableCellPipes,
  unescapeMarkdownTableCellPipes,
} from "../../../markdown/tableCells.js";

let tableContextMenu = null;
let tableContextMenuAnchor = null;

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
  anchor = null,
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
  tableContextMenuAnchor = anchor
    ? {
        element: anchor,
        sourceFrom: anchor.closest(".cm-rich-table-preview")?.dataset.sourceFrom,
        rowIndex,
        columnIndex,
      }
    : null;
  positionFixedMenu(menu, x, y);

  menu.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll(".cm-table-context-menu-item:not(:disabled)")];
    const currentIndex = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeTableContextMenu({ restoreFocus: true });
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1 + items.length) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  });
  queueMicrotask(() => {
    menu.querySelector(".cm-table-context-menu-item:not(:disabled)")?.focus();
  });
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

function setRovingTableCell(wrapper, target) {
  if (!wrapper || !target) {
    return;
  }
  for (const preview of wrapper.querySelectorAll(
    ".cm-rich-table-cell-preview[tabindex]",
  )) {
    preview.tabIndex = preview === target ? 0 : -1;
  }
}

function scheduleTableCellFocus(focusTarget) {
  const restore = () => {
    const selector =
      `.cm-rich-table-preview[data-source-from="${focusTarget.sourceFrom}"] ` +
      `.cm-rich-table-cell-preview[data-row-index="${focusTarget.rowIndex}"]` +
      `[data-column-index="${focusTarget.columnIndex}"]`;
    const currentTarget =
      document.querySelector(selector) ||
      (focusTarget.element?.isConnected ? focusTarget.element : null);
    if (!currentTarget) {
      return;
    }
    setRovingTableCell(
      currentTarget.closest(".cm-rich-table-preview"),
      currentTarget,
    );
    currentTarget.focus({ preventScroll: true });
  };
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      restore();
    });
  });
  window.setTimeout(restore, 100);
}

function focusOutsideTable(wrapper, reverse = false) {
  const candidates = [
    ...document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), ' +
        '[contenteditable="true"], [contenteditable="plaintext-only"], ' +
        '[tabindex]:not([tabindex="-1"])',
    ),
  ].filter(
    (element) =>
      !wrapper.contains(element) &&
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
  const ordered = reverse ? candidates.reverse() : candidates;
  const position = reverse
    ? Node.DOCUMENT_POSITION_PRECEDING
    : Node.DOCUMENT_POSITION_FOLLOWING;
  const target = ordered.find(
    (element) => wrapper.compareDocumentPosition(element) & position,
  );
  target?.focus({ preventScroll: true });
  return Boolean(target);
}

export function closeTableContextMenu({ restoreFocus = false } = {}) {
  if (!tableContextMenu) {
    return false;
  }
  const focusTarget = restoreFocus ? tableContextMenuAnchor : null;
  tableContextMenu.remove();
  tableContextMenu = null;
  tableContextMenuAnchor = null;
  if (focusTarget) {
    scheduleTableCellFocus(focusTarget);
  }
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
      wrapper.dataset.sourceFrom = String(this.tableBlock.from);
      wrapper.dataset.dirty = "false";
      const readOnly = view.state.readOnly;
      wrapper.classList.toggle("is-read-only", readOnly);
      wrapper.setAttribute(
        "aria-label",
        readOnly ? "Markdown table" : "Editable Markdown table",
      );
      if (!readOnly) {
        wrapper.title = "Edit table cells";
      }
  
      const scroll = document.createElement("div");
      scroll.className = "cm-rich-table-scroll";
  
      const table = document.createElement("table");
      table.className = "cm-rich-table";
  
      const headerRow = this.tableBlock.rows[0];
      const thead = document.createElement("thead");
      thead.appendChild(this.renderRow(headerRow, "th", 0, view, wrapper));
      table.appendChild(thead);
  
      const tbody = document.createElement("tbody");
      for (
        let rowIndex = 1;
        rowIndex < this.tableBlock.rows.length;
        rowIndex += 1
      ) {
        tbody.appendChild(
          this.renderRow(
            this.tableBlock.rows[rowIndex],
            "td",
            rowIndex,
            view,
            wrapper,
          ),
        );
      }
      table.appendChild(tbody);
  
      if (!readOnly) {
        const toolbar = document.createElement("div");
        toolbar.className = "cm-rich-table-toolbar";

        const toolbarHint = document.createElement("span");
        toolbarHint.className = "cm-rich-table-toolbar-hint";
        toolbarHint.textContent = "Enter: edit · Arrow keys: move · Shift+F10: actions";
        toolbar.appendChild(toolbarHint);

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

        const addColumnButton = document.createElement("button");
        addColumnButton.type = "button";
        addColumnButton.className = "cm-rich-table-action";
        addColumnButton.title = "Add column";
        addColumnButton.innerHTML =
          '<span class="cm-rich-table-action-icon">+</span><span>Column</span>';
        addColumnButton.addEventListener("mousedown", stopInteractiveEvent);
        addColumnButton.addEventListener("click", (event) => {
          stopInteractiveEvent(event);
          this.addColumnFromPreview(view, wrapper);
        });
        toolbar.appendChild(addColumnButton);
        wrapper.appendChild(toolbar);
      }

      scroll.appendChild(table);
      wrapper.appendChild(scroll);
  
      wrapper.addEventListener("input", (event) => {
        if (readOnly) {
          return;
        }
        if (event.target.closest(".cm-rich-table-cell-editor")) {
          wrapper.dataset.dirty = "true";
        }
      });
      wrapper.addEventListener("contextmenu", (event) => {
        if (readOnly) {
          return;
        }
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
          anchor: cell.querySelector(".cm-rich-table-cell-preview"),
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
        if (readOnly) {
          return;
        }
        window.setTimeout(() => {
          if (!wrapper.contains(document.activeElement)) {
            this.commitTableEdits(view, wrapper);
          }
        }, 0);
      });
  
      queueMicrotask(() => requestEditorMeasure(view));
      return wrapper;
    }
  
    renderRow(row, cellTag, rowIndex, view, wrapper) {
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
        if (!view.state.readOnly) {
          preview.tabIndex = rowIndex === 0 && columnIndex === 0 ? 0 : -1;
          preview.setAttribute("role", "button");
        }
        preview.dataset.rowIndex = String(rowIndex);
        preview.dataset.columnIndex = String(columnIndex);
        const headerText =
          this.tableBlock.rows[0]?.cells[columnIndex]?.text || `Column ${columnIndex + 1}`;
        const cellLabel = `${rowIndex === 0 ? "Header" : `Row ${rowIndex}`}, ${headerText}: ${sourceCell.text || "Empty cell"}`;
        preview.setAttribute(
          "aria-label",
          view.state.readOnly ? cellLabel : `Edit ${cellLabel}`,
        );
        renderRichTableCellPreview(preview, sourceCell.text, view);
  
        const editor = document.createElement("div");
        editor.className = "cm-rich-table-cell-editor";
        editor.contentEditable = view.state.readOnly ? "false" : "plaintext-only";
        editor.spellcheck = true;
        editor.dataset.rowIndex = String(rowIndex);
        editor.dataset.columnIndex = String(columnIndex);
        editor.textContent = sourceCell.text;
        editor.setAttribute("aria-label", cellLabel);
        preview.addEventListener("mousedown", (event) => {
          if (isRichTablePreviewInteractiveTarget(event.target)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          activateRichTableCellEditor(editor);
        });
        preview.addEventListener("keydown", (event) => {
          this.handleCellPreviewKeydown(event, editor, view, wrapper);
        });
        editor.addEventListener("focus", () => {
          setRovingTableCell(wrapper, preview);
          editor.dataset.editStartValue = editor.textContent || "";
          editor.dataset.editStartDirty = wrapper.dataset.dirty || "false";
          activateRichTableCellEditor(editor, { focus: false });
        });
        editor.addEventListener("blur", () => {
          window.setTimeout(() => {
            deactivateRichTableCellEditor(editor);
          }, 0);
        });
        editor.addEventListener("input", () => {
          const cellPreview = editor
            .closest(".cm-rich-table-cell")
            ?.querySelector(".cm-rich-table-cell-preview");
          renderRichTableCellPreview(
            cellPreview,
            editor.textContent,
            view,
          );
        });
        editor.addEventListener("keydown", (event) => {
          this.handleCellKeydown(event, view, wrapper);
        });
        editor.addEventListener("paste", (event) => {
          this.handleCellPaste(event, view, wrapper);
        });
        cell.appendChild(preview);

        if (!view.state.readOnly) {
          const actionsButton = document.createElement("button");
          actionsButton.type = "button";
          actionsButton.className = "cm-rich-table-cell-actions";
          actionsButton.textContent = "Actions";
          actionsButton.tabIndex = -1;
          actionsButton.setAttribute("aria-label", `Row and column actions for ${cellLabel}`);
          actionsButton.addEventListener("mousedown", stopInteractiveEvent);
          actionsButton.addEventListener("click", (event) => {
            stopInteractiveEvent(event);
            this.openCellActions(view, wrapper, cell, preview);
          });
          cell.appendChild(actionsButton);
        }
        cell.appendChild(editor);
        tr.appendChild(cell);
      }
  
      return tr;
    }
  
    handleCellPreviewKeydown(event, editor, view, wrapper) {
      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        event.stopPropagation();
        activateRichTableCellEditor(editor, { select: event.key === "Enter" });
        return;
      }
      if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") {
        event.preventDefault();
        event.stopPropagation();
        const cell = event.currentTarget.closest(".cm-rich-table-cell");
        this.openCellActions(view, wrapper, cell, event.currentTarget);
        return;
      }
      const directions = {
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
      };
      const direction = directions[event.key];
      if (!direction) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.focusRelativeCell(wrapper, event.currentTarget, ...direction);
    }

    handleCellKeydown(event, view, wrapper) {
      if (event.key === "Escape") {
        event.preventDefault();
        const editor = event.currentTarget;
        editor.textContent = editor.dataset.editStartValue || "";
        const preview = editor
          .closest(".cm-rich-table-cell")
          ?.querySelector(".cm-rich-table-cell-preview");
        renderRichTableCellPreview(preview, editor.textContent, view);
        wrapper.dataset.dirty = editor.dataset.editStartDirty || "false";
        const focusTarget = {
          element: preview,
          sourceFrom: wrapper.dataset.sourceFrom,
          rowIndex: editor.dataset.rowIndex,
          columnIndex: editor.dataset.columnIndex,
        };
        editor.blur();
        scheduleTableCellFocus(focusTarget);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const moved = this.focusRelativeCell(wrapper, event.currentTarget, 1, 0, {
          activate: true,
        });
        if (!moved) {
          event.currentTarget.blur();
        }
        return;
      }

      // Arrow keys move the text caret inside the cell, but once the caret
      // reaches the cell edge they continue into the neighboring cell so the
      // arrows navigate the whole table like Tab does.
      if (
        (event.key === "ArrowRight" || event.key === "ArrowLeft") &&
        !event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        const forward = event.key === "ArrowRight";
        if (
          !isCaretAtEditableEdge(event.currentTarget, forward ? "end" : "start")
        ) {
          return;
        }
        const editors = [
          ...wrapper.querySelectorAll(".cm-rich-table-cell-editor"),
        ];
        const currentIndex = editors.indexOf(event.currentTarget);
        const nextIndex = currentIndex + (forward ? 1 : -1);
        if (currentIndex === -1 || nextIndex < 0 || nextIndex >= editors.length) {
          return;
        }
        event.preventDefault();
        activateRichTableCellEditor(editors[nextIndex], {
          caret: forward ? "start" : "end",
        });
        return;
      }

      if (event.key !== "Tab") {
        return;
      }
  
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
  
      const delta = event.shiftKey ? -1 : 1;
      const nextIndex = currentIndex + delta;
      if (nextIndex < 0 || nextIndex >= editors.length) {
        event.preventDefault();
        focusOutsideTable(wrapper, event.shiftKey);
        return;
      }
      event.preventDefault();
      const nextEditor = editors[nextIndex];
      activateRichTableCellEditor(nextEditor, { select: true });
    }

    focusRelativeCell(wrapper, current, rowDelta, columnDelta, options = {}) {
      const rowIndex = Number.parseInt(current.dataset.rowIndex || "0", 10);
      const columnIndex = Number.parseInt(current.dataset.columnIndex || "0", 10);
      const nextRow = rowIndex + rowDelta;
      const nextColumn = columnIndex + columnDelta;
      const selector = options.activate
        ? ".cm-rich-table-cell-editor"
        : ".cm-rich-table-cell-preview";
      const next = wrapper.querySelector(
        `${selector}[data-row-index="${nextRow}"][data-column-index="${nextColumn}"]`,
      );
      if (!next) {
        return false;
      }
      if (options.activate) {
        activateRichTableCellEditor(next, { select: true });
      } else {
        setRovingTableCell(wrapper, next);
        next.focus({ preventScroll: true });
      }
      return true;
    }

    openCellActions(view, wrapper, cell, anchor) {
      if (!cell) {
        return;
      }
      const rowIndex = Number.parseInt(cell.dataset.rowIndex || "0", 10);
      const columnIndex = Number.parseInt(cell.dataset.columnIndex || "0", 10);
      const rect = anchor.getBoundingClientRect();
      showTableContextMenu({
        x: rect.left + Math.min(rect.width, 28),
        y: rect.bottom,
        rowIndex,
        columnIndex,
        columnCount: this.tableBlock.columnCount,
        anchor,
        onAction: (action) => {
          this.applyTableContextAction(view, wrapper, rowIndex, columnIndex, action);
        },
      });
    }

    handleCellPaste(event, view, wrapper) {
      const pastedText = event.clipboardData?.getData("text/plain") || "";
      if (!pastedText.includes("\t") && !/\r?\n/.test(pastedText.trimEnd())) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const startRow = Number.parseInt(event.currentTarget.dataset.rowIndex || "0", 10);
      const startColumn = Number.parseInt(event.currentTarget.dataset.columnIndex || "0", 10);
      const pastedRows = pastedText
        .replace(/\r/g, "")
        .replace(/\n$/, "")
        .split("\n")
        .map((row) => row.split("\t"));
      const rows = collectEditableTableRows(wrapper, this.tableBlock);
      const requiredColumns = Math.max(
        this.tableBlock.columnCount,
        ...pastedRows.map((row) => startColumn + row.length),
      );
      while (rows.length < startRow + pastedRows.length) {
        rows.push(Array.from({ length: requiredColumns }, () => ""));
      }
      rows.forEach((row) => {
        while (row.length < requiredColumns) row.push("");
      });
      pastedRows.forEach((pastedRow, rowOffset) => {
        pastedRow.forEach((value, columnOffset) => {
          rows[startRow + rowOffset][startColumn + columnOffset] = value;
        });
      });
      const alignments = [...this.tableBlock.alignments];
      while (alignments.length < requiredColumns) alignments.push("left");
      this.replaceTable(view, rows, alignments);
    }
  
    focusSource(view, sourceFrom) {
      if (view.state.readOnly) {
        return;
      }
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
      if (view.state.readOnly) {
        return;
      }
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
      if (view.state.readOnly) {
        return;
      }
      const rows = collectEditableTableRows(wrapper, this.tableBlock);
      rows.push(Array.from({ length: this.tableBlock.columnCount }, () => ""));
      this.replaceTable(view, rows);
    }

    addColumnFromPreview(view, wrapper) {
      if (view.state.readOnly) {
        return;
      }
      const rows = collectEditableTableRows(wrapper, this.tableBlock);
      rows.forEach((row) => row.push(""));
      this.replaceTable(view, rows, [...this.tableBlock.alignments, "left"]);
    }
  
    applyTableContextAction(view, wrapper, rowIndex, columnIndex, action) {
      if (view.state.readOnly) {
        return;
      }
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
      if (view.state.readOnly) {
        return;
      }
      if (wrapper.dataset.dirty !== "true") {
        return;
      }
      const rows = collectEditableTableRows(wrapper, this.tableBlock);
      this.replaceTable(view, rows);
    }
  
    replaceTable(view, rows, alignments = this.tableBlock.alignments) {
      if (view.state.readOnly) {
        return;
      }
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
    appendInlineMarkdown(preview, unescapeMarkdownTableCellPipes(text), {
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
    } else if (options.caret === "start") {
      placeCaretAtEdge(editor, "start");
    } else if (options.focus !== false) {
      placeCaretAtEnd(editor);
    }
  }

  function isCaretAtEditableEdge(editor, edge) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      return false;
    }
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) {
      return false;
    }
    const measure = range.cloneRange();
    measure.selectNodeContents(editor);
    measure.setEnd(range.startContainer, range.startOffset);
    const caretOffset = measure.toString().length;
    return edge === "start"
      ? caretOffset === 0
      : caretOffset === (editor.textContent || "").length;
  }

  function placeCaretAtEdge(element, edge) {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(edge === "start");
    selection.removeAllRanges();
    selection.addRange(range);
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
    return formatMarkdownTableRow(tableBlock, cells);
  }
  
  function collectEditableTableRows(wrapper, tableBlock) {
    return tableBlock.rows.map((row, rowIndex) =>
      Array.from({ length: tableBlock.columnCount }, (_, columnIndex) => {
        const editor = wrapper.querySelector(
          `.cm-rich-table-cell-editor[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
        );
        return sanitizeEditedTableCellText(editor?.textContent || "");
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
    const segments = cells.map(
      (cell) =>
        ` ${escapeMarkdownTableCellPipes(sanitizeEditedTableCellText(cell))} `,
    );
    const row = segments.join("|");
    const prefix =
      `${tableBlock.indent || ""}` +
      `${tableBlock.usesLeadingPipe ? "|" : ""}`;
    const suffix = tableBlock.usesTrailingPipe ? "|" : "";
    return `${prefix}${row}${suffix}`;
  }
  
  function sanitizeEditedTableCellText(text) {
    return text
      .replace(/\r?\n/g, " ")
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
    placeCaretAtEdge(element, "end");
  }

  return TablePreviewWidget;
}
