import { WidgetType } from "@codemirror/view";

import { countIndentColumns, parseListMarker } from "../../domain/markdownBlocks.js";

// Rendered list markers and task checkboxes get fixed widths (in the line's
// em) so the hanging indent of a wrapped list item can be computed from the
// same numbers: continuation lines then start where the item's text starts.
const UNORDERED_MARKER_WIDTH_EM = 1.7;
const LIST_MARKER_GAP_EM = 0.15;
// .cm-task-checkbox: 1.05em wide (a button, so border-box) plus 0.08em and
// 0.36em margins.
const TASK_CHECKBOX_WIDTH_EM = 1.49;
const TASK_PATTERN = /^\[( |x)\]([ \t]*)/i;

export function getListMarkerWidthEm(listMarker) {
  if (!listMarker.ordered) {
    return UNORDERED_MARKER_WIDTH_EM;
  }
  // Room for "1." up to "10."; longer numbers grow with their digits.
  return Math.max(2.25, 0.58 * listMarker.marker.length + 0.5);
}

// Inline style giving a list line its hanging indent, or null for other
// lines. `rendered` is true when the marker (and a task box) are drawn as
// widgets, false when the line shows its raw Markdown.
export function getListHangingIndentStyle(text, { rendered }) {
  const listMarker = parseListMarker(text);
  if (!listMarker) {
    return null;
  }
  const rest = text.slice(listMarker.markerTo);
  const task = listMarker.ordered ? null : rest.match(TASK_PATTERN);
  const indentColumns = countIndentColumns(listMarker.indent);
  let columns;
  let em = 0;
  if (rendered) {
    columns = indentColumns + (task ? task[2].length : 0);
    em =
      getListMarkerWidthEm(listMarker) +
      LIST_MARKER_GAP_EM +
      (task ? TASK_CHECKBOX_WIDTH_EM : 0);
  } else {
    columns =
      indentColumns +
      listMarker.marker.length +
      listMarker.spacing.length +
      (task ? task[0].length : 0);
  }
  return `--cm-list-hang: calc(${columns}ch + ${Number(em.toFixed(3))}em)`;
}

export class ListMarkerWidget extends WidgetType {
  constructor(listMarker) {
    super();
    this.marker = listMarker.marker;
    this.ordered = listMarker.ordered;
    this.level = listMarker.level;
  }

  eq(other) {
    return (
      other.marker === this.marker &&
      other.ordered === this.ordered &&
      other.level === this.level
    );
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = `cm-list-marker ${
      this.ordered ? "is-ordered" : "is-unordered"
    }`;
    marker.style.width = `${getListMarkerWidthEm(this)}em`;
    // The number is drawn smaller inside a box sized in the line's em.
    const symbol = document.createElement("span");
    symbol.className = "cm-list-marker-symbol";
    symbol.textContent = this.ordered
      ? this.marker
      : getUnorderedListSymbol(this.level);
    marker.appendChild(symbol);
    return marker;
  }

  ignoreEvent() {
    return false;
  }
}

export class CodeCopyButtonWidget extends WidgetType {
  constructor(code, postMessage) {
    super();
    this.code = code;
    this.postMessage = postMessage;
  }

  eq(other) {
    return other.code === this.code;
  }

  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-code-copy-widget";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-code-copy-button";
    button.textContent = "Copy";
    button.title = "Copy code";
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await copyTextToClipboard(this.code, this.postMessage);
      button.textContent = "Copied";
      window.setTimeout(() => {
        button.textContent = "Copy";
      }, 900);
    });

    wrapper.appendChild(button);
    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

export class CheckboxWidget extends WidgetType {
  constructor(checked, from) {
    super();
    this.checked = checked;
    this.from = from;
  }

  eq(other) {
    return other.checked === this.checked && other.from === this.from;
  }

  toDOM(view) {
    const checkbox = document.createElement("button");
    checkbox.type = "button";
    checkbox.className = `cm-task-checkbox${this.checked ? " is-checked" : ""}`;
    checkbox.setAttribute(
      "aria-label",
      this.checked ? "Mark task incomplete" : "Mark task complete",
    );
    checkbox.addEventListener("mousedown", (event) => event.preventDefault());
    checkbox.addEventListener("click", (event) => {
      event.preventDefault();
      if (view.state.readOnly) {
        return;
      }
      view.dispatch({
        changes: {
          from: this.from + 1,
          to: this.from + 2,
          insert: this.checked ? " " : "x",
        },
      });
    });
    return checkbox;
  }
}

export class ColorPreviewWidget extends WidgetType {
  constructor(color) {
    super();
    this.color = color;
  }

  eq(other) {
    return other.color === this.color;
  }

  toDOM() {
    const swatch = document.createElement("span");
    swatch.className = "cm-inline-color-preview";
    swatch.style.backgroundColor = this.color;
    swatch.title = this.color;
    swatch.setAttribute("aria-label", `Color sample ${this.color}`);
    return swatch;
  }
}

function getUnorderedListSymbol(level) {
  return ["•", "◦", "▪", "‣"][level % 4];
}

async function copyTextToClipboard(text, postMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    postMessage({ type: "copyText", text });
  }
}
