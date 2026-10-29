// GitHub alert and Obsidian callout preview widget.
//
// A callout block that the caret is not in is replaced by this widget: the
// icon and title, then the body rendered like a <details> body, with nested
// callouts drawn inside it. Folding a foldable callout ("+" or "-") only
// changes the view; the Markdown stays as written. Clicking the body puts the
// caret on that source line, which shows the Markdown for editing.
import { WidgetType } from "@codemirror/view";
import { calloutIconSvg, findCallouts } from "../../../markdown/callouts.js";
import { appendDetailsBody } from "../details/detailsPreview.js";

export function createCalloutPreviewWidgetClass({
  appendInlineMarkdown,
  requestEditorMeasure,
  foldStates,
}) {
  class CalloutPreviewWidget extends WidgetType {
    constructor(calloutBlock) {
      super();
      this.calloutBlock = calloutBlock;
    }

    eq(other) {
      return (
        other.calloutBlock.from === this.calloutBlock.from &&
        other.calloutBlock.signature === this.calloutBlock.signature
      );
    }

    get estimatedHeight() {
      const title = 40;
      if (isCollapsed(foldStates, this.calloutBlock.key, this.calloutBlock.callout.marker)) {
        return title;
      }
      return title + this.calloutBlock.callout.body.length * 24 + 12;
    }

    toDOM(view) {
      const element = renderCallout(this.calloutBlock.callout, {
        key: this.calloutBlock.key,
        lineFrom: (index) => this.calloutBlock.lineStarts[index],
        appendInlineMarkdown,
        foldStates,
        onImageReady: () => requestEditorMeasure(view),
        onToggle: () => requestEditorMeasure(view),
        onFocusSource: (position) => this.focusSource(view, position),
      });
      element.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      return element;
    }

    focusSource(view, position) {
      if (view.state.readOnly) {
        return;
      }
      view.dispatch({
        selection: {
          anchor: Math.max(0, Math.min(position, view.state.doc.length)),
        },
        scrollIntoView: true,
      });
      view.focus();
    }

    ignoreEvent() {
      return false;
    }
  }

  return CalloutPreviewWidget;
}

function isCollapsed(foldStates, key, marker) {
  return marker.foldable && (foldStates.has(key) ? foldStates.get(key) : marker.collapsed);
}

// `callout` comes from findCallouts, with line indexes counted from the first
// line of the top-level callout. `lineFrom(index)` is the document position
// where that line starts; body lines add their quote prefix to it.
export function renderCallout(callout, options) {
  const { marker } = callout;
  const { key, lineFrom, appendInlineMarkdown, foldStates } = options;
  const element = document.createElement("div");
  element.className = [
    "cm-callout",
    `cm-callout-${marker.color}`,
    marker.github ? "cm-callout-github" : "cm-callout-obsidian",
    marker.foldable ? "is-foldable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  element.dataset.callout = marker.type;

  const title = document.createElement("div");
  title.className = "cm-callout-title";
  title.innerHTML = calloutIconSvg(marker.icon, "cm-callout-icon");
  const titleText = document.createElement("span");
  titleText.className = "cm-callout-title-text";
  appendInlineMarkdown(titleText, marker.title);
  title.appendChild(titleText);
  element.appendChild(title);

  const body = document.createElement("div");
  body.className = "cm-callout-body";
  appendCalloutBody(body, callout.body, {
    ...options,
    keyPrefix: key,
  });
  element.appendChild(body);

  if (marker.foldable) {
    const fold = document.createElement("span");
    fold.className = "cm-callout-fold";
    fold.setAttribute("aria-hidden", "true");
    fold.textContent = "›";
    title.appendChild(fold);
    title.setAttribute("role", "button");
    title.tabIndex = 0;
    const apply = () => {
      const collapsed = isCollapsed(foldStates, key, marker);
      element.classList.toggle("is-collapsed", collapsed);
      title.setAttribute("aria-expanded", String(!collapsed));
    };
    const toggle = (event) => {
      event.preventDefault();
      event.stopPropagation();
      foldStates.set(key, !isCollapsed(foldStates, key, marker));
      apply();
      options.onToggle?.();
    };
    title.addEventListener("click", toggle);
    title.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        toggle(event);
      }
    });
    apply();
  } else {
    title.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.onFocusSource?.(lineFrom(callout.start) + (callout.startOffset || 0));
    });
  }

  body.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a, .cm-callout-title")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const line =
      event.target instanceof Element ? event.target.closest("[data-source-from]") : null;
    options.onFocusSource?.(
      line?.dataset.sourceFrom
        ? Number(line.dataset.sourceFrom)
        : lineFrom(callout.start) + (callout.startOffset || 0),
    );
  });

  return element;
}

// Renders body lines, drawing nested callouts as callouts and handing the
// Markdown between them to the <details> body renderer.
function appendCalloutBody(parent, bodyLines, options) {
  const sourceLine = (line) => ({
    text: line.text,
    sourceFrom: options.lineFrom(line.index) + line.offset,
  });
  const nested = findCallouts(bodyLines.map((line) => line.text));
  let next = 0;
  const appendPlain = (until) => {
    const lines = bodyLines.slice(next, until).map(sourceLine);
    if (lines.length > 0) {
      appendDetailsBody(parent, lines, {
        appendInlineMarkdown: options.appendInlineMarkdown,
        getSourcePosition: (line) => line.sourceFrom,
        onImageReady: options.onImageReady,
        onCodeHighlighted: options.onImageReady,
      });
    }
  };
  for (const callout of nested) {
    appendPlain(callout.start);
    // The nested callout's lines are lines of this body: map them back to
    // lines of the document block and columns on those lines.
    const titleLine = bodyLines[callout.start];
    const child = {
      ...callout,
      start: titleLine.index,
      startOffset: titleLine.offset,
      body: callout.body.map((line) => ({
        index: bodyLines[line.index].index,
        text: line.text,
        offset: bodyLines[line.index].offset + line.offset,
      })),
    };
    parent.appendChild(
      renderCallout(child, { ...options, key: `${options.keyPrefix}/${callout.start}` }),
    );
    next = callout.end + 1;
  }
  appendPlain(bodyLines.length);
}
