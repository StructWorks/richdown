// Overview ruler for lint results: a thin strip at the right edge of the rich
// editor with a mark for every problem at its relative position in the whole
// document, like the marks VS Code draws beside its scrollbar. In a long
// document this shows where the problems are without scrolling to them;
// clicking a mark scrolls there.
import { EditorSelection } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

const severityRank = { hint: 0, info: 1, warning: 2, error: 3 };
const minimumMarkHeight = 3;

// `getDecorations(state)` returns the lint DecorationSet, whose ranges carry
// their diagnostic in `spec.diagnostic`.
export function createLintOverviewRuler(getDecorations) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.dom = document.createElement("div");
        this.dom.className = "cm-richdown-lint-ruler";
        this.dom.setAttribute("aria-hidden", "true");
        this.dom.addEventListener("mousedown", (event) => this.onMouseDown(event));
        view.dom.appendChild(this.dom);
        this.markers = [];
        this.scheduleMeasure();
      }

      update(update) {
        if (
          update.docChanged ||
          update.geometryChanged ||
          update.heightChanged ||
          getDecorations(update.startState) !== getDecorations(update.state)
        ) {
          this.scheduleMeasure();
        }
      }

      scheduleMeasure() {
        this.view.requestMeasure({
          key: this,
          read: (view) => measureRuler(view, getDecorations(view.state)),
          write: (measured) => this.render(measured),
        });
      }

      render({ markers, right }) {
        this.markers = markers;
        this.dom.style.right = `${right}px`;
        this.dom.hidden = markers.length === 0;
        // The settings and outline buttons float at the right edge too.
        this.view.dom.ownerDocument.body?.classList.toggle(
          "richdown-has-lint-ruler",
          markers.length > 0,
        );
        this.dom.replaceChildren(
          ...markers.map((marker, index) => {
            const element = document.createElement("div");
            element.className = `cm-richdown-lint-ruler-mark cm-richdown-lint-ruler-mark-${marker.severity}`;
            element.style.top = `${marker.top}px`;
            element.style.height = `${marker.height}px`;
            element.dataset.index = String(index);
            element.title = marker.messages.join("\n");
            return element;
          }),
        );
      }

      onMouseDown(event) {
        const marker = this.markers[Number(event.target?.dataset?.index)];
        if (!marker) {
          return;
        }
        // Keep the caret and focus where they are, as VS Code's ruler does.
        event.preventDefault();
        this.view.dispatch({
          effects: EditorView.scrollIntoView(marker.pos, { y: "center" }),
        });
      }

      destroy() {
        this.dom.remove();
        this.view.dom.ownerDocument.body?.classList.remove("richdown-has-lint-ruler");
      }
    },
  );
}

function measureRuler(view, decorations) {
  const scroller = view.scrollDOM;
  const entries = [];
  decorations.between(0, view.state.doc.length, (from, _to, decoration) => {
    const diagnostic = decoration.spec.diagnostic;
    if (!diagnostic) {
      return;
    }
    // A line inside a rich table or diagram preview resolves to that block.
    const block = view.lineBlockAt(from);
    entries.push({
      pos: from,
      top: block.top,
      height: block.height,
      severity: diagnostic.severity,
      message: diagnostic.message,
    });
  });
  return {
    markers: layoutRulerMarkers(entries, {
      contentHeight: view.contentHeight,
      rulerHeight: scroller.clientHeight,
    }),
    // Sit just left of a classic scrollbar; overlay scrollbars take no width.
    right: Math.max(0, scroller.offsetWidth - scroller.clientWidth),
  };
}

// Scales document positions to the ruler and merges marks that would overlap,
// keeping the most severe color and every message. `entries` hold the
// problem's document offset and its line block's top and height in pixels.
export function layoutRulerMarkers(entries, { contentHeight, rulerHeight }) {
  if (entries.length === 0 || !(rulerHeight > 0)) {
    return [];
  }
  const scale = rulerHeight / Math.max(contentHeight, rulerHeight, 1);
  const sorted = [...entries].sort((left, right) => left.top - right.top || left.pos - right.pos);
  const markers = [];
  for (const entry of sorted) {
    const height = Math.max(minimumMarkHeight, entry.height * scale);
    const top = Math.min(entry.top * scale, rulerHeight - height);
    const previous = markers[markers.length - 1];
    if (previous && top <= previous.top + previous.height) {
      previous.height = Math.max(previous.height, top + height - previous.top);
      if (severityRank[entry.severity] > severityRank[previous.severity]) {
        previous.severity = entry.severity;
      }
      previous.messages.push(entry.message);
      continue;
    }
    markers.push({
      pos: entry.pos,
      top,
      height,
      severity: entry.severity,
      messages: [entry.message],
    });
  }
  return markers;
}

// The start of the next (direction 1) or previous (direction -1) problem
// after `pos`, wrapping around the document; null when there is none.
export function findAdjacentProblem(decorations, docLength, pos, direction) {
  const starts = [];
  decorations.between(0, docLength, (from, _to, decoration) => {
    if (decoration.spec.diagnostic && starts[starts.length - 1] !== from) {
      starts.push(from);
    }
  });
  if (starts.length === 0) {
    return null;
  }
  if (direction > 0) {
    return starts.find((start) => start > pos) ?? starts[0];
  }
  return [...starts].reverse().find((start) => start < pos) ?? starts[starts.length - 1];
}

// Keymap commands for F8 / Shift+F8, VS Code's Go to Next/Previous Problem.
export function createProblemNavigation(getDecorations) {
  const go = (direction) => (view) => {
    const target = findAdjacentProblem(
      getDecorations(view.state),
      view.state.doc.length,
      view.state.selection.main.head,
      direction,
    );
    if (target === null) {
      return false;
    }
    view.dispatch({
      selection: EditorSelection.cursor(target),
      effects: EditorView.scrollIntoView(target, { y: "center" }),
      userEvent: "select",
    });
    return true;
  };
  return [
    { key: "F8", run: go(1), preventDefault: true },
    { key: "Shift-F8", run: go(-1), preventDefault: true },
  ];
}
