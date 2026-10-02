// @vitest-environment jsdom
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import {
  revealHighlightField,
  revealInEditor,
  resolveRevealRange,
} from "../src/rich-editor/presentation/reveal/revealTarget.js";
import { createDocOf } from "./helpers/testKit.js";

const LINES = ["# Title", "", "## Getting Started", "find the needle here", "end"];
const at = (line, character) => ({ line, character });

let view;

function mount() {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc: LINES.join("\n"),
      extensions: [revealHighlightField],
    }),
  });
  return view;
}

function highlights() {
  const ranges = [];
  view.state.field(revealHighlightField).between(0, view.state.doc.length, (from, to) => {
    ranges.push(view.state.sliceDoc(from, to));
  });
  return ranges;
}

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});

describe("resolveRevealRange", () => {
  const doc = createDocOf(LINES);

  it("maps zero-based line positions to document offsets", () => {
    expect(
      resolveRevealRange(doc, { selection: { start: at(3, 9), end: at(3, 15) } }),
    ).toMatchObject({ from: 37, to: 43, heading: false });
  });

  it("clamps positions past the end of a line or the document", () => {
    expect(
      resolveRevealRange(doc, {
        selection: { start: at(4, 99), end: at(40, Number.MAX_SAFE_INTEGER) },
      }),
    ).toMatchObject({ from: 52, to: 52 });
  });

  it("finds a heading by its GitHub slug or by its text", () => {
    expect(resolveRevealRange(doc, { anchor: "getting-started" })).toMatchObject({
      from: 9,
      heading: true,
    });
    expect(resolveRevealRange(doc, { anchor: "Getting Started" })).toMatchObject({
      from: 9,
    });
    expect(resolveRevealRange(doc, { anchor: "missing" })).toBeNull();
  });
});

describe("revealInEditor", () => {
  it("selects and marks a Search match", () => {
    mount();
    expect(
      revealInEditor(view, { selection: { start: at(3, 9), end: at(3, 15) } }),
    ).toBe(true);
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      "needle",
    );
    expect(highlights()).toEqual(["needle"]);
  });

  it("clears the mark once the reader edits or moves the caret", () => {
    mount();
    revealInEditor(view, { selection: { start: at(3, 9), end: at(3, 15) } });
    view.dispatch({ selection: { anchor: 0 }, userEvent: "select.pointer" });
    expect(highlights()).toEqual([]);

    revealInEditor(view, { selection: { start: at(3, 9), end: at(3, 15) } });
    view.dispatch({ changes: { from: 0, insert: "x" } });
    expect(highlights()).toEqual([]);
  });

  it("moves the caret to a heading without marking anything", () => {
    mount();
    revealInEditor(view, { anchor: "getting-started" });
    expect(view.state.selection.main.head).toBe(9);
    expect(highlights()).toEqual([]);
  });

  it("ignores a target it cannot resolve", () => {
    mount();
    expect(revealInEditor(view, { anchor: "missing" })).toBe(false);
    expect(revealInEditor(view, null)).toBe(false);
    expect(view.state.selection.main.head).toBe(0);
  });
});
