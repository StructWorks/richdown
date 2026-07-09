import { WidgetType } from "@codemirror/view";

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
    marker.textContent = this.ordered
      ? this.marker
      : getUnorderedListSymbol(this.level);
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
