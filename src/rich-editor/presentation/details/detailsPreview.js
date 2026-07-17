// <details> preview widget.
//
// The preview gives details blocks an interactive disclosure UI while preserving
// a direct path back to the original Markdown source for editing.
import { WidgetType } from "@codemirror/view";
import { splitMarkdownTableCells } from "../../../markdown/tableCells.js";
import { getDetailsBodyLineText } from "../../domain/markdownBlocks.js";
import { highlightCodeElement } from "../codemirror/language.js";

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
        const bodyLines = this.detailsBlock.bodyLines;
        if (bodyLines.length === 0) {
          const emptyLine = document.createElement("p");
          emptyLine.className = "cm-details-body-line";
          emptyLine.textContent = "No content";
          emptyLine.dataset.sourceFrom = String(this.detailsBlock.from);
          body.appendChild(emptyLine);
        } else {
          appendDetailsBody(body, bodyLines, {
            appendInlineMarkdown,
            getSourcePosition: (line, index) =>
              this.getBodyLinePosition(line, index),
            onImageReady: () => requestEditorMeasure(view),
            onCodeHighlighted: () => requestEditorMeasure(view),
          });
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
      if (view.state.readOnly) {
        return;
      }
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

export function appendDetailsBody(
  parent,
  bodyLines,
  {
    appendInlineMarkdown,
    getSourcePosition,
    onImageReady,
    onCodeHighlighted,
  },
) {
  const appendInline = (element, text) => {
    appendInlineMarkdown(element, text, {
      renderImages: true,
      onImageReady,
    });
  };
  const setSourcePosition = (element, line, index) => {
    element.dataset.sourceFrom = String(getSourcePosition(line, index));
  };

  for (let index = 0; index < bodyLines.length; index += 1) {
    const line = bodyLines[index];
    const text = getDetailsBodyLineText(line);
    if (!text.trim()) {
      continue;
    }

    const fence = text.match(/^\s{0,3}(`{3,}|~{3,})\s*([^\s`]*)?.*$/);
    if (fence) {
      const marker = fence[1][0];
      const minimumLength = fence[1].length;
      const codeLines = [];
      let closingIndex = index + 1;
      while (closingIndex < bodyLines.length) {
        const candidate = getDetailsBodyLineText(bodyLines[closingIndex]);
        const closingFence = candidate.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
        if (
          closingFence &&
          closingFence[1][0] === marker &&
          closingFence[1].length >= minimumLength
        ) {
          break;
        }
        codeLines.push(candidate);
        closingIndex += 1;
      }

      const source = codeLines.join("\n");
      const language = (fence[2] || "").toLowerCase();
      const block = document.createElement("div");
      block.className = "cm-details-code";
      setSourcePosition(block, line, index);
      if (language) {
        const header = document.createElement("div");
        header.className = "cm-details-code-header";
        const label = document.createElement("span");
        label.className = "cm-details-code-language";
        label.textContent = language;
        header.appendChild(label);
        block.appendChild(header);
      }
      const pre = document.createElement("pre");
      pre.className = "cm-details-code-block";
      const code = document.createElement("code");
      if (language) {
        code.className = `language-${language}`;
      }
      code.textContent = source;
      pre.appendChild(code);
      block.appendChild(pre);
      parent.appendChild(block);
      if (language) {
        void highlightCodeElement(code, source, language)
          .then((resolvedLanguage) => {
            const label = block.querySelector(".cm-details-code-language");
            if (label && resolvedLanguage) {
              label.textContent = resolvedLanguage;
            }
            onCodeHighlighted?.();
          })
          .catch(() => {
            // Unknown or invalid language input remains readable as plain text.
          });
      }
      index = closingIndex < bodyLines.length ? closingIndex : bodyLines.length;
      continue;
    }

    if (
      index + 1 < bodyLines.length &&
      isTableContentLine(text) &&
      isTableDelimiterLine(getDetailsBodyLineText(bodyLines[index + 1]))
    ) {
      const table = document.createElement("table");
      table.className = "cm-details-table";
      setSourcePosition(table, line, index);
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      for (const cellText of splitTableCells(text)) {
        const cell = document.createElement("th");
        appendInline(cell, cellText);
        headRow.appendChild(cell);
      }
      head.appendChild(headRow);
      table.appendChild(head);

      const tableBody = document.createElement("tbody");
      index += 2;
      while (
        index < bodyLines.length &&
        isTableContentLine(getDetailsBodyLineText(bodyLines[index]))
      ) {
        const row = document.createElement("tr");
        for (const cellText of splitTableCells(
          getDetailsBodyLineText(bodyLines[index]),
        )) {
          const cell = document.createElement("td");
          appendInline(cell, cellText);
          row.appendChild(cell);
        }
        tableBody.appendChild(row);
        index += 1;
      }
      table.appendChild(tableBody);
      parent.appendChild(table);
      index -= 1;
      continue;
    }

    const heading = text.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (heading) {
      const element = document.createElement(`h${heading[1].length}`);
      element.className = "cm-details-heading";
      setSourcePosition(element, line, index);
      appendInline(element, heading[2]);
      parent.appendChild(element);
      continue;
    }

    const quote = text.match(/^\s{0,3}>\s?(.*)$/);
    if (quote) {
      const element = document.createElement("blockquote");
      element.className = "cm-details-quote";
      setSourcePosition(element, line, index);
      appendInline(element, quote[1]);
      parent.appendChild(element);
      continue;
    }

    const list = text.match(
      /^(\s*)([-+*]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/,
    );
    if (list) {
      const element = document.createElement("div");
      element.className = "cm-details-list-item";
      setSourcePosition(element, line, index);
      const indentColumns = list[1].replace(/\t/g, "  ").length;
      const depth = Math.min(Math.floor(indentColumns / 2), 4);
      if (depth > 0) {
        element.style.paddingInlineStart = `${depth * 18}px`;
      }
      const marker = document.createElement("span");
      marker.className = "cm-details-list-marker";
      marker.textContent =
        list[3] === undefined
          ? /^\d/.test(list[2])
            ? list[2]
            : "•"
          : list[3].trim()
            ? "☑"
            : "☐";
      element.appendChild(marker);
      const content = document.createElement("span");
      appendInline(content, list[4]);
      element.appendChild(content);
      parent.appendChild(element);
      continue;
    }

    if (/^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(text)) {
      const element = document.createElement("hr");
      setSourcePosition(element, line, index);
      parent.appendChild(element);
      continue;
    }

    const paragraph = document.createElement("p");
    paragraph.className = "cm-details-body-line";
    setSourcePosition(paragraph, line, index);
    appendInline(paragraph, text);
    parent.appendChild(paragraph);
  }
}

function isTableContentLine(text) {
  return /^\s*\|?.*\|.*\|?\s*$/.test(text);
}

function isTableDelimiterLine(text) {
  // GFM delimiter cells need only one dash (":-", "-:", ":-:").
  return /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/.test(text);
}

function splitTableCells(text) {
  return splitMarkdownTableCells(text, { unescapePipes: true });
}
