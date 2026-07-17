// YAML front matter preview widget.
//
// Documents that open with a "---" fenced YAML header get a compact metadata
// card instead of raw delimiter lines. Clicking the card places the caret back
// into the YAML source so the block can be edited as plain text; the preview
// returns automatically once the selection leaves the block.
import { WidgetType } from "@codemirror/view";

export function createFrontmatterPreviewWidgetClass({
  requestEditorMeasure,
  setActiveFrontmatterEdit,
}) {
  class FrontmatterPreviewWidget extends WidgetType {
    constructor(frontmatterBlock) {
      super();
      this.frontmatterBlock = frontmatterBlock;
    }

    eq(other) {
      return (
        other.frontmatterBlock.from === this.frontmatterBlock.from &&
        other.frontmatterBlock.to === this.frontmatterBlock.to &&
        other.frontmatterBlock.signature === this.frontmatterBlock.signature
      );
    }

    // Advisory height (one row per entry plus the card padding) so CodeMirror
    // reserves space before the first measure.
    get estimatedHeight() {
      const rows = Math.max(1, this.frontmatterBlock.entries.length);
      return rows * 28 + 30;
    }

    toDOM(view) {
      const wrapper = document.createElement("div");
      wrapper.className = "cm-frontmatter-preview";
      wrapper.setAttribute("role", "region");
      wrapper.setAttribute("aria-label", "Document front matter");
      const readOnly = view.state.readOnly;
      wrapper.classList.toggle("is-read-only", readOnly);
      if (!readOnly) {
        wrapper.title = "Click to edit front matter";
      }

      if (!readOnly) {
        const editHint = document.createElement("span");
        editHint.className = "cm-frontmatter-edit-hint";
        editHint.textContent = "✎";
        editHint.setAttribute("aria-hidden", "true");
        wrapper.appendChild(editHint);
      }

      const entries = this.frontmatterBlock.entries;
      if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "cm-frontmatter-empty";
        empty.textContent = "No metadata";
        wrapper.appendChild(empty);
      } else {
        const grid = document.createElement("dl");
        grid.className = "cm-frontmatter-grid";
        for (const entry of entries) {
          const key = document.createElement("dt");
          key.className = "cm-frontmatter-key";
          key.textContent = entry.key ?? "";
          if (entry.sourceFrom !== null && entry.sourceFrom !== undefined) {
            key.dataset.sourceFrom = String(entry.sourceFrom);
          }

          const value = document.createElement("dd");
          value.className = "cm-frontmatter-value";
          if (entry.values.length === 0) {
            value.classList.add("is-empty");
            value.textContent = "—";
          } else if (entry.values.length === 1) {
            value.textContent = entry.values[0];
          } else {
            for (const item of entry.values) {
              const chip = document.createElement("span");
              chip.className = "cm-frontmatter-chip";
              chip.textContent = item;
              value.appendChild(chip);
            }
          }
          if (entry.sourceFrom !== null && entry.sourceFrom !== undefined) {
            value.dataset.sourceFrom = String(entry.sourceFrom);
          }

          grid.appendChild(key);
          grid.appendChild(value);
        }
        wrapper.appendChild(grid);
      }

      if (!readOnly) {
        wrapper.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        wrapper.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const row =
            event.target instanceof Element
              ? event.target.closest("[data-source-from]")
              : null;
          this.focusSource(
            view,
            row ? Number(row.dataset.sourceFrom) : undefined,
          );
        });
      }

      queueMicrotask(() => requestEditorMeasure(view));
      return wrapper;
    }

    focusSource(view, sourceFrom) {
      if (view.state.readOnly) {
        return;
      }
      const fallback =
        this.frontmatterBlock.entries[0]?.sourceFrom ??
        // Land at the end of the opening "---" when the block has no entries.
        this.frontmatterBlock.from + 3;
      const anchor = Math.max(
        0,
        Math.min(sourceFrom ?? fallback, view.state.doc.length),
      );
      view.dispatch({
        effects: setActiveFrontmatterEdit.of({
          from: this.frontmatterBlock.from,
          to: this.frontmatterBlock.sourceTo,
        }),
        selection: { anchor },
        scrollIntoView: true,
      });
      view.focus();
    }

    ignoreEvent() {
      return false;
    }
  }

  return FrontmatterPreviewWidget;
}
