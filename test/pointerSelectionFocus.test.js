// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getFocusSelection,
  pointerSelectionFocus,
} from "../src/rich-editor/presentation/codemirror/pointerSelectionFocus.js";
import { createPreviewHarness } from "./helpers/previewHarness.js";

let harness;

afterEach(() => {
  harness?.destroy();
  harness = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

// "**bold** one\nplain two": line 1 is 0-12, line 2 starts at 13.
const doc = "**bold** one\nplain two";

function setup() {
  vi.useFakeTimers();
  harness = createPreviewHarness({
    doc,
    selection: { anchor: 15 },
    extraExtensions: [pointerSelectionFocus],
  });
  return harness;
}

function press(view, lineNumber, { detail = 1 } = {}) {
  const line = view.contentDOM.querySelectorAll(".cm-line")[lineNumber - 1];
  line.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, detail }));
}

function release() {
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

function focusedLines({ view, preview }) {
  return [1, 2].filter((number) =>
    preview.isLineFocused(view.state, view.state.doc.line(number)),
  );
}

function activeLineStarts(harness) {
  return harness
    .entries()
    .filter((entry) => entry.className === "cm-activeLine")
    .map((entry) => entry.from);
}

describe("pointer selection focus", () => {
  it("follows the selection when no mouse button is down", () => {
    const { view } = setup();
    view.dispatch({ selection: { anchor: 2 } });
    expect(focusedLines(harness)).toEqual([1]);
    expect(activeLineStarts(harness)).toEqual([0]);
    expect(getFocusSelection(view.state)).toBe(view.state.selection);
  });

  it("keeps the focus from before a press until the button is released", () => {
    const { view } = setup();
    press(view, 1);
    // What CodeMirror's own mouse handling does while the pointer moves.
    view.dispatch({ selection: { anchor: 2, head: 6 }, userEvent: "select.pointer" });

    expect(focusedLines(harness)).toEqual([2]);
    expect(activeLineStarts(harness)).toEqual([13]);

    release();
    // CodeMirror still reads the pointer on this mouseup; the reveal follows.
    expect(focusedLines(harness)).toEqual([2]);
    vi.advanceTimersByTime(0);

    expect(focusedLines(harness)).toEqual([1]);
    expect(activeLineStarts(harness)).toEqual([0]);
  });

  it("brings back the layout the first click saw for the second click", () => {
    const { view } = setup();
    press(view, 1);
    view.dispatch({ selection: { anchor: 2 }, userEvent: "select.pointer" });
    release();
    vi.advanceTimersByTime(0);
    expect(focusedLines(harness)).toEqual([1]);

    press(view, 1, { detail: 2 });
    expect(focusedLines(harness)).toEqual([2]);
    release();
    vi.advanceTimersByTime(0);
    expect(focusedLines(harness)).toEqual([1]);
  });

  it("reveals at once when a key is pressed during a press", () => {
    const { view } = setup();
    press(view, 1);
    view.dispatch({ selection: { anchor: 2 }, userEvent: "select.pointer" });

    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));

    expect(focusedLines(harness)).toEqual([1]);
  });

  it("does not hold back a press a widget handled itself", () => {
    const { view } = setup();
    const line = view.contentDOM.querySelector(".cm-line");
    const event = new MouseEvent("mousedown", { bubbles: true, button: 0, cancelable: true });
    event.preventDefault();
    line.dispatchEvent(event);
    view.dispatch({ selection: { anchor: 2 } });

    expect(focusedLines(harness)).toEqual([1]);
  });

  it("maps the held selection through edits", () => {
    const { view } = setup();
    press(view, 1);
    view.dispatch({ changes: { from: 0, insert: "xx" } });
    expect(getFocusSelection(view.state).main.head).toBe(17);
  });
});
