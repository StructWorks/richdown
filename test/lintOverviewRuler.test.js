// @vitest-environment jsdom
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildLintDecorations,
  createLintDecorations,
} from "../src/rich-editor/presentation/codemirror/lintDecorations.js";
import {
  createProblemNavigation,
  findAdjacentProblem,
  layoutRulerMarkers,
} from "../src/rich-editor/presentation/codemirror/lintOverviewRuler.js";

const entry = (pos, top, severity = "warning", message = `at ${pos}`) => ({
  pos,
  top,
  height: 20,
  severity,
  message,
});

describe("layoutRulerMarkers", () => {
  it("places marks at their relative position in the document", () => {
    const markers = layoutRulerMarkers([entry(0, 0), entry(50, 1000), entry(90, 1980)], {
      contentHeight: 2000,
      rulerHeight: 400,
    });
    expect(markers.map((marker) => [marker.pos, marker.top, marker.height])).toEqual([
      [0, 0, 4],
      [50, 200, 4],
      [90, 396, 4],
    ]);
  });

  it("keeps a minimum mark height and stays inside the ruler", () => {
    const [marker] = layoutRulerMarkers([entry(5, 99_990)], {
      contentHeight: 100_000,
      rulerHeight: 300,
    });
    expect(marker.height).toBe(3);
    expect(marker.top + marker.height).toBeLessThanOrEqual(300);
  });

  it("merges overlapping marks, keeping the most severe color and every message", () => {
    const markers = layoutRulerMarkers(
      [entry(10, 100, "info", "a"), entry(12, 104, "error", "b"), entry(14, 108, "warning", "c")],
      { contentHeight: 10_000, rulerHeight: 500 },
    );
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ pos: 10, severity: "error", messages: ["a", "b", "c"] });
  });

  it("does not stretch a short document over the whole ruler", () => {
    const [marker] = layoutRulerMarkers([entry(0, 100)], { contentHeight: 200, rulerHeight: 800 });
    expect(marker.top).toBe(100);
  });

  it("returns nothing without problems or without a measured ruler", () => {
    expect(layoutRulerMarkers([], { contentHeight: 100, rulerHeight: 100 })).toEqual([]);
    expect(layoutRulerMarkers([entry(0, 0)], { contentHeight: 100, rulerHeight: 0 })).toEqual([]);
  });
});

describe("findAdjacentProblem", () => {
  const state = EditorState.create({ doc: "one\ntwo\nthree\nfour\n" });
  const decorations = buildLintDecorations(state, [
    { line: 1, from: 0, to: 3, severity: "warning", message: "two" },
    { line: 1, from: 0, to: 0, severity: "info", message: "two, line" },
    { line: 3, from: 1, to: 4, severity: "error", message: "four" },
  ]);
  const length = state.doc.length;

  it("moves forward and wraps to the first problem", () => {
    expect(findAdjacentProblem(decorations, length, 0, 1)).toBe(4);
    expect(findAdjacentProblem(decorations, length, 4, 1)).toBe(15);
    expect(findAdjacentProblem(decorations, length, 15, 1)).toBe(4);
  });

  it("moves backward and wraps to the last problem", () => {
    expect(findAdjacentProblem(decorations, length, 15, -1)).toBe(4);
    expect(findAdjacentProblem(decorations, length, 4, -1)).toBe(15);
  });

  it("returns null when there are no problems", () => {
    expect(findAdjacentProblem(buildLintDecorations(state, []), length, 0, 1)).toBeNull();
  });
});

describe("in the editor", () => {
  let view;

  afterEach(() => {
    view?.destroy();
    view = null;
    document.body.replaceChildren();
  });

  function createView(doc) {
    const lint = createLintDecorations();
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc, extensions: lint.extension }),
    });
    return lint;
  }

  it("adds a ruler that stays hidden until there is something to show", () => {
    createView("text   \n");
    const ruler = view.dom.querySelector(".cm-richdown-lint-ruler");
    expect(ruler).not.toBeNull();
    view.measure();
    expect(ruler.hidden).toBe(true);
  });

  it("removes the ruler with the editor", () => {
    createView("text\n");
    const editor = view.dom;
    view.destroy();
    view = null;
    expect(editor.querySelector(".cm-richdown-lint-ruler")).toBeNull();
  });

  it("moves the caret to the next and previous problem with F8 and Shift+F8", () => {
    const lint = createView("a\nb\nc\n");
    lint.update(view, [
      { line: 1, from: 0, to: 1, severity: "warning", message: "b" },
      { line: 2, from: 0, to: 1, severity: "error", message: "c" },
    ]);
    const [next, previous] = createProblemNavigation((state) =>
      state.field(lint.extension[0]),
    );
    expect(next.key).toBe("F8");
    expect(next.run(view)).toBe(true);
    expect(view.state.selection.main.head).toBe(2);
    next.run(view);
    expect(view.state.selection.main.head).toBe(4);
    previous.run(view);
    expect(view.state.selection.main.head).toBe(2);
  });
});
