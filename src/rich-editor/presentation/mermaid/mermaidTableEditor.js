// Table panel for data-style Mermaid diagrams (pie, gantt, journey, ...).
//
// Rows mirror the diagram's record lines (see domain/mermaidTables.js). A
// cell commits when it loses focus or on Enter, as one small source edit.
// While a cell is focused the table is not rebuilt underneath the caret;
// changes that arrive meanwhile are applied once focus leaves the table.
import {
  insertMermaidTableRow,
  moveMermaidTableRow,
  readMermaidTable,
  removeMermaidTableRow,
  updateMermaidTableRow,
} from "../../domain/mermaidTables.js";
import { stopInteractiveEvent } from "./mermaidRenderer.js";

export function createMermaidTableEditor({ spec, getCode, apply, revealLine }) {
  const root = document.createElement("div");
  root.className = "cm-mermaid-table";

  const table = document.createElement("table");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  table.append(head, body);

  const footer = document.createElement("div");
  footer.className = "cm-mermaid-table-footer";
  root.append(table, footer);

  let currentSpec = spec;
  let stale = false;
  let renderedCode = null;
  let focusAfterRender = null;

  footer.append(
    button("+ Row", "Add a row at the end", () => insert({ kind: "row" })),
    ...(spec.groups ? [button("+ Section", "Add a section at the end", () => insert({ kind: "group" }))] : []),
  );

  function button(label, title, run) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "cm-mermaid-surface-button";
    element.textContent = label;
    element.title = title;
    element.setAttribute("aria-label", title);
    element.addEventListener("mousedown", (event) => event.preventDefault());
    element.addEventListener("click", (event) => {
      stopInteractiveEvent(event);
      // Commit a cell that is still being typed in before the rows move.
      flushActiveCell();
      run();
    });
    return element;
  }

  function flushActiveCell() {
    const active = document.activeElement;
    if (active && root.contains(active) && active.matches(".cm-mermaid-table-input")) {
      active.dispatchEvent(new Event("change"));
    }
  }

  function insert(options) {
    const result = insertMermaidTableRow(getCode(), currentSpec, options);
    if (result.lineIndex < 0) return;
    focusAfterRender = { lineIndex: result.lineIndex, column: 0, select: true };
    commit(result.code);
  }

  // The host usually refreshes the table as part of applying the edit; only
  // render here when it did not, so a freshly focused cell is not replaced.
  function commit(code) {
    if (code === getCode()) return;
    apply(code);
    if (renderedCode !== getCode()) render();
  }

  function renderHead() {
    const row = document.createElement("tr");
    for (const column of currentSpec.columns) {
      const cell = document.createElement("th");
      cell.textContent = column.label;
      row.appendChild(cell);
    }
    row.appendChild(document.createElement("th"));
    head.replaceChildren(row);
  }

  function createInput(column, value, row, columnIndex) {
    let input;
    if (column.type === "select") {
      input = document.createElement("select");
      const options = column.options.includes(value) ? column.options : [...column.options, value];
      for (const option of options) {
        const element = document.createElement("option");
        element.value = option;
        element.textContent = option || "—";
        input.appendChild(element);
      }
      input.value = value;
      input.addEventListener("change", () => commitCell(row, columnIndex, input.value));
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.inputMode = column.type === "number" ? "decimal" : "text";
      input.value = value;
      input.addEventListener("change", () => commitCell(row, columnIndex, input.value));
    }
    input.className = "cm-mermaid-table-input";
    input.setAttribute("aria-label", column.label);
    input.dataset.line = String(row.lineIndex);
    input.dataset.column = String(columnIndex);
    input.addEventListener("focus", () => revealLine(row.lineIndex));
    input.addEventListener("keydown", (event) => handleKey(event, input, row, columnIndex));
    return input;
  }

  // The document may have changed since this row was drawn (records added or
  // removed from the diagram or toolbar while the cell had focus), so the row
  // is found again by its line and original cells before writing.
  function locateRow(row) {
    const rows = readMermaidTable(getCode(), currentSpec);
    const same = (candidate) =>
      candidate.kind === row.kind &&
      candidate.cells.length === row.cells.length &&
      candidate.cells.every((cell, index) => cell === row.cells[index]);
    const atLine = rows.find((candidate) => candidate.lineIndex === row.lineIndex);
    if (atLine && same(atLine)) return atLine.lineIndex;
    return rows.find(same)?.lineIndex ?? -1;
  }

  function commitCell(row, columnIndex, value) {
    if ((row.cells[columnIndex] ?? "") === value) return;
    const lineIndex = locateRow(row);
    if (lineIndex < 0) {
      stale = true;
      return;
    }
    const cells = [...row.cells];
    cells[columnIndex] = value;
    const next = updateMermaidTableRow(getCode(), currentSpec, lineIndex, cells);
    if (next !== getCode()) {
      row.cells = cells;
      row.lineIndex = lineIndex;
      apply(next);
    }
  }

  function handleKey(event, input, row, columnIndex) {
    event.stopPropagation();
    // Enter and Escape confirm or cancel an IME conversion while composing.
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      input.blur();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    input.dispatchEvent(new Event("change"));
    // Enter moves down the column, adding a row past the last one.
    const inputs = [...body.querySelectorAll(`[data-column="${columnIndex}"]`)];
    const next = inputs[inputs.indexOf(input) + 1];
    if (next) {
      next.focus();
      next.select?.();
    } else if (row.kind === "row") {
      const result = insertMermaidTableRow(getCode(), currentSpec, { afterLine: row.lineIndex });
      focusAfterRender = { lineIndex: result.lineIndex, column: 0, select: true };
      commit(result.code);
    }
  }

  function rowActions(row) {
    const actions = document.createElement("td");
    actions.className = "cm-mermaid-table-actions";
    actions.append(
      button("↑", "Move up", () => move(row, -1)),
      button("↓", "Move down", () => move(row, 1)),
      button("×", "Delete", () => {
        const lineIndex = locateRow(row);
        if (lineIndex < 0) return render();
        commit(removeMermaidTableRow(getCode(), lineIndex));
      }),
    );
    return actions;
  }

  function move(row, delta) {
    const lineIndex = locateRow(row);
    if (lineIndex < 0) return render();
    commit(moveMermaidTableRow(getCode(), currentSpec, lineIndex, delta).code);
  }

  function render() {
    stale = false;
    renderedCode = getCode();
    const rows = readMermaidTable(renderedCode, currentSpec);
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const element = document.createElement("tr");
      element.className = row.kind === "group" ? "is-group" : "is-row";
      if (row.kind === "group") {
        const cell = document.createElement("td");
        cell.colSpan = currentSpec.columns.length;
        cell.appendChild(createInput({ label: "Section" }, row.cells[0], row, 0));
        element.appendChild(cell);
      } else {
        currentSpec.columns.forEach((column, columnIndex) => {
          const cell = document.createElement("td");
          cell.appendChild(createInput(column, row.cells[columnIndex] ?? "", row, columnIndex));
          element.appendChild(cell);
        });
      }
      element.appendChild(rowActions(row));
      fragment.appendChild(element);
    }
    if (!rows.length) {
      const empty = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = currentSpec.columns.length + 1;
      cell.className = "cm-mermaid-table-empty";
      cell.textContent = "No rows yet.";
      empty.appendChild(cell);
      fragment.appendChild(empty);
    }
    body.replaceChildren(fragment);
    if (focusAfterRender) {
      const target = body.querySelector(
        `[data-line="${focusAfterRender.lineIndex}"][data-column="${focusAfterRender.column}"]`,
      );
      const select = focusAfterRender.select;
      focusAfterRender = null;
      target?.focus();
      if (select) target?.select?.();
    }
  }

  root.addEventListener("focusout", (event) => {
    if (stale && !root.contains(event.relatedTarget)) {
      render();
    }
  });

  renderHead();
  render();

  return {
    element: root,
    refresh(nextSpec) {
      if (nextSpec && nextSpec !== currentSpec) {
        currentSpec = nextSpec;
        renderHead();
      }
      if (root.contains(document.activeElement)) {
        stale = true;
        return;
      }
      render();
    },
  };
}
