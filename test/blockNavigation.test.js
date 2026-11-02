// @vitest-environment jsdom
import { EditorState } from "@codemirror/state";
import { afterEach, describe, expect, it } from "vitest";

import { findDetailsBlocks } from "../src/rich-editor/domain/markdownBlocks.js";
import { sourcePositionForRenderedPrefix } from "../src/rich-editor/presentation/codemirror/renderedTextPosition.js";
import { createPreviewHarness } from "./helpers/previewHarness.js";

let harness;

afterEach(() => {
  harness?.destroy();
  harness = null;
  document.body.replaceChildren();
});

function lines(...text) {
  return text.join("\n");
}

describe("placing a click in rendered Markdown", () => {
  function positionAfter(doc, renderedPrefix, from = 0) {
    harness = createPreviewHarness({ doc });
    return sourcePositionForRenderedPrefix(harness.view.state, from, renderedPrefix);
  }

  it("skips emphasis, code and link markup the renderer drops", () => {
    const doc = "Some **bold** `code` and [link](https://a.b/c) end";
    expect(positionAfter(doc, "Some bo")).toBe(doc.indexOf("bold") + 2);
    expect(positionAfter(doc, "Some bold co")).toBe(doc.indexOf("code") + 2);
    expect(positionAfter(doc, "Some bold code and link e")).toBe(doc.indexOf("end") + 1);
  });

  it("skips list markers and wikilink brackets", () => {
    const doc = "- item with [[Page|alias]] here";
    expect(positionAfter(doc, "item with ali")).toBe(doc.indexOf("alias") + 3);
    expect(positionAfter(doc, "item with alias he")).toBe(doc.indexOf("here") + 2);
  });

  it("starts from the given line position, past a quote prefix", () => {
    const doc = "> [!NOTE]\n> Note **body** text";
    const from = doc.indexOf("Note **");
    expect(positionAfter(doc, "Note bo", from)).toBe(doc.indexOf("body") + 2);
  });
});

describe("details body source positions", () => {
  it("points body lines at the document lines they came from", () => {
    const doc = lines(
      "<details>",
      "<summary>More</summary>",
      "",
      "First **line**.",
      "- second",
      "",
      "</details>",
    );
    const [block] = findDetailsBlocks(EditorState.create({ doc }).doc);
    const sources = block.bodyLines
      .filter((line) => line.text.trim())
      .map((line) => line.sourceFrom);
    expect(sources).toEqual([doc.indexOf("First"), doc.indexOf("- second")]);
  });
});

describe("arrow keys into block previews", () => {
  const DOC = lines(
    "above",
    "> [!NOTE]",
    "> note body",
    "middle",
    "```mermaid",
    "flowchart LR",
    "  A --> B",
    "```",
    "below",
  );

  function press(key) {
    const binding = harness.preview.blockPreviewEntryKeymap.find((entry) => entry.key === key);
    return binding.run(harness.view);
  }

  function caretLine() {
    const { state } = harness.view;
    return state.doc.lineAt(state.selection.main.head).number;
  }

  it("steps down into a callout's source", () => {
    harness = createPreviewHarness({ doc: DOC, selection: { anchor: 0 }, attach: true });
    expect(press("ArrowDown")).toBe(true);
    expect(caretLine()).toBe(2);
    expect(harness.widgetNames()).not.toContain("CalloutPreviewWidget");
  });

  it("steps up into the last line of a diagram and opens its editor", () => {
    harness = createPreviewHarness({
      doc: DOC,
      selection: { anchor: DOC.indexOf("below") },
      attach: true,
    });
    expect(press("ArrowUp")).toBe(true);
    expect(caretLine()).toBe(7);
    expect(harness.widgetNames()).toContain("MermaidLiveEditorWidget");
  });

  it("enters a diagram from the line above, but not with a selection", () => {
    harness = createPreviewHarness({
      doc: DOC,
      selection: { anchor: DOC.indexOf("middle") },
      attach: true,
    });
    expect(press("ArrowDown")).toBe(true);
    // The first line inside the fence, not the fence itself.
    expect(caretLine()).toBe(6);

    harness.view.dispatch({ selection: { anchor: 0, head: 3 } });
    expect(press("ArrowDown")).toBe(false);
  });
});
