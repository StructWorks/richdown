// <details> preview widget.
//
// The preview gives details blocks an interactive disclosure UI while preserving
// a direct path back to the original Markdown source for editing.
import { WidgetType } from "@codemirror/view";
import { getDetailsBodyLineText } from "../../domain/markdownBlocks.js";

export function createDetailsPreviewWidgetClass({
  appendInlineMarkdown,
  requestEditorMeasure,
  setActiveDetailsEdit,
  toggleDetailsPreview,
}) {
  class DetailsPreviewWidget extends WidgetType {
    constructor(detailsBlock, open) {
      super();
      this.detailsBlock = detailsBlock;
      this.open = open;
    }
  
    eq(other) {
      return (
        other.detailsBlock.from === this.detailsBlock.from &&
        other.detailsBlock.to === this.detailsBlock.to &&
        other.detailsBlock.signature === this.detailsBlock.signature &&
        other.open === this.open
      );
    }

    // Advisory height (summary row, plus body lines when open) so CodeMirror
    // reserves space before first measure. CodeMirror corrects it on measure.
    get estimatedHeight() {
      const summary = 44;
      if (!this.open) return summary;
      const bodyLines = this.detailsBlock.bodyLines?.length || 1;
      return summary + bodyLines * 24 + 16;
    }
  
    toDOM(view) {
      const wrapper = document.createElement("div");
      wrapper.className = "cm-details-preview";
  
      const summary = document.createElement("button");
      summary.type = "button";
      summary.className = "cm-details-summary";
      summary.setAttribute("aria-expanded", String(this.open));
  
      const disclosure = document.createElement("span");
      disclosure.className = "cm-details-disclosure";
      disclosure.textContent = this.open ? "⌄" : "›";
  
      const label = document.createElement("span");
      label.textContent = this.detailsBlock.summary;
  
      summary.appendChild(disclosure);
      summary.appendChild(label);
      wrapper.appendChild(summary);
  
      if (this.open) {
        const body = document.createElement("div");
        body.className = "cm-details-body";
        const bodyLines = this.detailsBlock.bodyLines.filter((line) =>
          getDetailsBodyLineText(line).trim(),
        );
        if (bodyLines.length === 0) {
          const emptyLine = document.createElement("p");
          emptyLine.className = "cm-details-body-line";
          emptyLine.textContent = "No content";
          emptyLine.dataset.sourceFrom = String(this.detailsBlock.from);
          body.appendChild(emptyLine);
        } else {
          for (const [index, line] of bodyLines.entries()) {
            const paragraph = document.createElement("p");
            paragraph.className = "cm-details-body-line";
            paragraph.dataset.sourceFrom = String(
              this.getBodyLinePosition(line, index),
            );
            appendInlineMarkdown(paragraph, getDetailsBodyLineText(line));
            body.appendChild(paragraph);
          }
        }
        body.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        body.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const line =
            event.target instanceof Element
              ? event.target.closest("[data-source-from]")
              : null;
          const sourceFrom = line?.dataset.sourceFrom
            ? Number(line.dataset.sourceFrom)
            : this.detailsBlock.from;
          this.focusSource(view, sourceFrom);
        });
        wrapper.appendChild(body);
      }
  
      summary.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      summary.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.toggle(view);
      });
      wrapper.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.focusSource(view, this.detailsBlock.from);
      });
  
      return wrapper;
    }
  
    toggle(view) {
      view.dispatch({
        effects: toggleDetailsPreview.of({
          key: this.detailsBlock.key,
          open: !this.open,
        }),
      });
      requestEditorMeasure(view);
    }
  
    getBodyLinePosition(line, lineIndex) {
      if (line.sourceFrom !== null && line.sourceFrom !== undefined) {
        return line.sourceFrom;
      }
      return this.detailsBlock.from + lineIndex;
    }
  
    focusSource(view, sourceFrom = this.detailsBlock.from) {
      view.dispatch({
        effects: setActiveDetailsEdit.of({
          from: this.detailsBlock.from,
          to: this.detailsBlock.sourceTo,
        }),
        selection: {
          anchor: Math.max(0, Math.min(sourceFrom, view.state.doc.length)),
        },
        scrollIntoView: true,
      });
      view.focus();
    }
  
    ignoreEvent() {
      return false;
    }
  }

  return DetailsPreviewWidget;
}
