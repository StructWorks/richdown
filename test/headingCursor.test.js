import { markdown } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  createHeadingCursorFilter,
  findHiddenHeadingPrefix,
} from "../src/rich-editor/presentation/codemirror/headingCursor.js";

function isLineFocused(state, line) {
  return state.selection.ranges.some(
    (range) => range.from <= line.to && range.to >= line.from,
  );
}

function createState(doc, cursor) {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
    extensions: [markdown(), createHeadingCursorFilter({ isLineFocused })],
  });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state;
}

function moveTo(state, anchor, { userEvent = "select", head = anchor } = {}) {
  return state.update({ selection: { anchor, head }, userEvent: userEvent ?? undefined })
    .state.selection.main;
}

describe("heading cursor filter", () => {
  // "## Title\nbody": the heading text starts at 3, the body line at 9.
  const doc = "## Title\nbody";

  it("moves a landing between the hidden marker and its space to the text", () => {
    const state = createState(doc, 9);
    expect(moveTo(state, 2).head).toBe(3);
  });

  it("moves a landing before the hidden marker to the text", () => {
    const state = createState(doc, 9);
    expect(moveTo(state, 0).head).toBe(3);
  });

  it("keeps a landing in the heading text", () => {
    const state = createState(doc, 9);
    expect(moveTo(state, 5).head).toBe(5);
  });

  it("lets the caret into the marker once the line shows it", () => {
    const state = createState(doc, 4);
    expect(moveTo(state, 1).head).toBe(1);
  });

  it("leaves selections and non-selection changes alone", () => {
    const state = createState(doc, 9);
    expect(moveTo(state, 0, { head: 5 })).toMatchObject({ anchor: 0, head: 5 });
    expect(moveTo(state, 1, { userEvent: null }).head).toBe(1);
  });

  it("keeps the indentation of an indented heading reachable", () => {
    const state = createState("   ### Title\nbody", 13);
    expect(moveTo(state, 0).head).toBe(0);
    expect(moveTo(state, 4).head).toBe(7);
  });

  it("ignores lines that only look like headings", () => {
    const state = createState("```sh\n# comment\n```\nbody", 20);
    expect(findHiddenHeadingPrefix(state, state.doc.line(2))).toBeNull();
    expect(moveTo(state, 7).head).toBe(7);
  });

  it("covers an empty heading", () => {
    const state = createState("##\nbody", 3);
    expect(findHiddenHeadingPrefix(state, state.doc.line(1))).toEqual({ from: 0, to: 2 });
    expect(moveTo(state, 1).head).toBe(2);
  });
});
