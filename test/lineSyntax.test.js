import { describe, expect, it } from "vitest";

import {
  countIndentColumns,
  findDetailsBlocks,
  findGherkinBlocks,
  findMermaidBlocks,
  findTableBlocks,
  getDetailsBodyLineText,
  getTableLineRole,
  isDetailsClosingLine,
  isDetailsOpeningLine,
  isEditingDetailsBlock,
  isEditingGherkinBlock,
  isEditingMermaidBlock,
  isEditingTableBlock,
  isTableBodyLine,
  isTableContentLine,
  isTableRowLine,
  isThematicBreakLine,
  normalizeDetailsBodyLines,
  normalizeTableCells,
  parseDetailsContent,
  parseListMarker,
  parseTableAlignment,
  rangeIntersectsRanges,
  selectionInsideRange,
  splitTableCells,
  stripHtmlTags,
} from "../src/rich-editor/domain/markdownBlocks.js";
import { createDoc, createDocOf, createSelection } from "./helpers/testKit.js";

describe("isThematicBreakLine", () => {
  it.each(["---", "***", "___", "- - -", "-- -", "  ***", "--------"])(
    "recognizes the thematic break %j",
    (line) => {
      expect(isThematicBreakLine(line)).toBe(true);
    },
  );

  it.each(["--", "-*-", "text ---", "    ---", "- item"])(
    "rejects %j",
    (line) => {
      expect(isThematicBreakLine(line)).toBe(false);
    },
  );
});

describe("parseListMarker", () => {
  it("describes a bullet marker and its source span", () => {
    expect(parseListMarker("- item")).toEqual({
      indent: "",
      marker: "-",
      spacing: " ",
      ordered: false,
      level: 0,
      markerFrom: 0,
      markerTo: 2,
    });
  });

  it("describes an ordered marker", () => {
    expect(parseListMarker("1. item")).toEqual({
      indent: "",
      marker: "1.",
      spacing: " ",
      ordered: true,
      level: 0,
      markerFrom: 0,
      markerTo: 3,
    });
    expect(parseListMarker("12) item").ordered).toBe(true);
  });

  it.each(["+", "*"])("accepts the %s bullet", (marker) => {
    expect(parseListMarker(`${marker} item`).marker).toBe(marker);
  });

  it("derives the nesting level from indent columns", () => {
    expect(parseListMarker("    - deep").level).toBe(2);
    expect(parseListMarker("\t- tabbed").level).toBe(2);
  });

  it("requires whitespace after the marker", () => {
    expect(parseListMarker("-item")).toBeNull();
    expect(parseListMarker("plain text")).toBeNull();
    expect(parseListMarker("1.5 releases")).toBeNull();
  });
});

describe("countIndentColumns", () => {
  it.each([
    ["", 0],
    ["  ", 2],
    ["\t", 4],
    ["  \t", 4],
    ["\t\t", 8],
  ])("counts %j as %i columns", (text, columns) => {
    expect(countIndentColumns(text)).toBe(columns);
  });
});

describe("details line predicates", () => {
  it.each(["<details>", "<DETAILS>", "  <details open>", "<details"])(
    "recognizes the opening line %j",
    (line) => {
      expect(isDetailsOpeningLine(line)).toBe(true);
    },
  );

  it.each(["<detailsx>", "text <details>", "    <details>"])(
    "rejects the opening line %j",
    (line) => {
      expect(isDetailsOpeningLine(line)).toBe(false);
    },
  );

  it("recognizes closing tags anywhere on the line", () => {
    expect(isDetailsClosingLine("</details>")).toBe(true);
    expect(isDetailsClosingLine("body</details >")).toBe(true);
    expect(isDetailsClosingLine("</detail>")).toBe(false);
  });
});

describe("parseDetailsContent", () => {
  it("strips summary markup and trims the body", () => {
    const parsed = parseDetailsContent([
      { text: "<details open>" },
      { text: "<summary><b>Bold</b> summary</summary>" },
      { text: "" },
      { text: "first line" },
      { text: "second line" },
      { text: "" },
      { text: "</details>" },
    ]);

    expect(parsed.summary).toBe("Bold summary");
    expect(parsed.bodyLines.map((line) => line.text)).toEqual([
      "first line",
      "second line",
    ]);
  });
});

describe("normalizeDetailsBodyLines", () => {
  it("turns br markup into line breaks", () => {
    expect(
      normalizeDetailsBodyLines("one<br>two<br/>three").map((line) => line.text),
    ).toEqual(["one", "two", "three"]);
  });

  it("does not pad a div wrapper with blank lines", () => {
    expect(
      normalizeDetailsBodyLines("<div>one</div>").map((line) => line.text),
    ).toEqual(["one"]);
  });

  it("keeps interior blank lines so paragraph spacing survives", () => {
    expect(
      normalizeDetailsBodyLines("<div>one</div><br>two").map((line) => line.text),
    ).toEqual(["one", "", "two"]);
  });

  it("reports no lines for a whitespace-only body", () => {
    expect(normalizeDetailsBodyLines("\n\n")).toEqual([]);
  });
});

describe("stripHtmlTags", () => {
  it("removes tags and leaves plain text alone", () => {
    expect(stripHtmlTags("<b>bold</b> text")).toBe("bold text");
    expect(stripHtmlTags("no tags")).toBe("no tags");
  });

  it("also strips a bare < ... > pair in prose", () => {
    // Known simplification: the tag scan is a regex, so prose comparison
    // operators look like a tag. Pinned so a future parser change is deliberate.
    expect(stripHtmlTags("a < b and c > d")).toBe("a  d");
  });
});

describe("getDetailsBodyLineText", () => {
  it("accepts both raw strings and line objects", () => {
    expect(getDetailsBodyLineText("raw string")).toBe("raw string");
    expect(getDetailsBodyLineText({ text: "object line" })).toBe("object line");
    expect(getDetailsBodyLineText({})).toBe("");
  });
});

describe("table line predicates", () => {
  it("recognizes rows with and without outer pipes", () => {
    expect(isTableRowLine("| a | b |")).toBe(true);
    expect(isTableRowLine("a | b")).toBe(true);
    expect(isTableRowLine("no pipes here")).toBe(false);
  });

  it("does not treat the delimiter row as a content row", () => {
    expect(isTableRowLine("| --- | --- |")).toBe(false);
  });

  it("requires at least one non-empty cell to start a table", () => {
    expect(isTableContentLine("| a | b |")).toBe(true);
    expect(isTableContentLine("|  |  |")).toBe(false);
  });

  it("splits cells while respecting escaped pipes", () => {
    expect(splitTableCells("| a | b |")).toEqual(["a", "b"]);
    expect(splitTableCells("| a | b\\|c |")).toEqual(["a", "b\\|c"]);
  });
});

describe("getTableLineRole", () => {
  const doc = createDocOf([
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
    "plain text",
  ]);

  it.each([
    [1, "header"],
    [2, "delimiter"],
    [3, "body"],
    [4, null],
  ])("classifies line %i as %s", (lineNumber, role) => {
    expect(getTableLineRole(doc, doc.line(lineNumber))).toBe(role);
  });

  it("gives a delimiter without a header row above it no role", () => {
    const orphan = createDocOf(["intro", "| --- | --- |"]);
    expect(getTableLineRole(orphan, orphan.line(2))).toBeNull();
  });

  it("recognizes body rows only under a real header/delimiter pair", () => {
    expect(isTableBodyLine(doc, 3)).toBe(true);
    expect(isTableBodyLine(doc, 1)).toBe(false);
    expect(isTableBodyLine(createDoc("| 1 | 2 |"), 1)).toBe(false);
  });
});

describe("table cell helpers", () => {
  it.each([
    [" :---: ", "center"],
    ["---:", "right"],
    [":---", "left"],
    ["---", "left"],
    ["", "left"],
  ])("maps the delimiter cell %j to %s", (delimiter, alignment) => {
    expect(parseTableAlignment(delimiter)).toBe(alignment);
  });

  it("pads missing cells with placeholders that carry no source range", () => {
    expect(normalizeTableCells([{ text: "a", from: 1, to: 2 }], 3)).toEqual([
      { text: "a", from: 1, to: 2 },
      { text: "", from: null, to: null },
      { text: "", from: null, to: null },
    ]);
  });

  it("drops cells beyond the column count", () => {
    expect(normalizeTableCells([{ text: "a" }, { text: "b" }], 1)).toEqual([
      { text: "a" },
    ]);
  });
});

describe("range and selection helpers", () => {
  it("detects overlap but not a shared edge", () => {
    expect(rangeIntersectsRanges(5, 10, [{ from: 9, to: 20 }])).toBe(true);
    expect(rangeIntersectsRanges(5, 10, [{ from: 10, to: 20 }])).toBe(false);
    expect(rangeIntersectsRanges(5, 10, [])).toBe(false);
  });

  it("requires a selection to be fully inside the range", () => {
    expect(selectionInsideRange(createSelection([5, 8]), 0, 10)).toBe(true);
    expect(selectionInsideRange(createSelection([0, 10]), 0, 10)).toBe(true);
    expect(selectionInsideRange(createSelection([5, 11]), 0, 10)).toBe(false);
  });

  it("accepts any one cursor inside the range", () => {
    expect(
      selectionInsideRange(createSelection([20, 20], [5, 6]), 0, 10),
    ).toBe(true);
  });
});

// A preview only falls back to source when the caret is inside the block that is
// currently being edited.
describe("editing state", () => {
  const table = findTableBlocks(
    createDocOf(["| A | B |", "| --- | --- |", "| 1 | 2 |"]),
  )[0];

  it("opens the source view for a caret inside the edited table", () => {
    expect(
      isEditingTableBlock(table, { from: table.from }, createSelection([2, 2])),
    ).toBe(true);
  });

  it("keeps the rich table without an active edit", () => {
    expect(isEditingTableBlock(table, null, createSelection([2, 2]))).toBe(
      false,
    );
  });

  it("ignores an active edit anchored at another block", () => {
    expect(
      isEditingTableBlock(
        table,
        { from: table.from + 1 },
        createSelection([2, 2]),
      ),
    ).toBe(false);
  });

  it("closes the source view for a caret outside the block", () => {
    const outside = table.sourceTo + 5;
    expect(
      isEditingTableBlock(
        table,
        { from: table.from },
        createSelection([outside, outside]),
      ),
    ).toBe(false);
  });

  it("applies the same rule to mermaid blocks", () => {
    const mermaid = findMermaidBlocks(
      createDocOf(["```mermaid", "graph TD;", "```"]),
    )[0];
    expect(
      isEditingMermaidBlock(
        mermaid,
        { from: mermaid.from },
        createSelection([12, 12]),
      ),
    ).toBe(true);
    expect(
      isEditingMermaidBlock(mermaid, undefined, createSelection([12, 12])),
    ).toBe(false);
  });

  it("applies the same rule to gherkin blocks", () => {
    const gherkin = findGherkinBlocks(
      createDocOf(["```gherkin", "Feature: X", "```"]),
    )[0];
    const outside = gherkin.sourceTo + 1;
    expect(
      isEditingGherkinBlock(
        gherkin,
        { from: gherkin.from },
        createSelection([12, 12]),
      ),
    ).toBe(true);
    expect(
      isEditingGherkinBlock(
        gherkin,
        { from: gherkin.from },
        createSelection([outside, outside]),
      ),
    ).toBe(false);
  });

  it("applies the same rule to details blocks", () => {
    const details = findDetailsBlocks(
      createDocOf(["<details>", "<summary>S</summary>", "body", "</details>"]),
    )[0];
    expect(
      isEditingDetailsBlock(
        details,
        { from: details.from },
        createSelection([12, 12]),
      ),
    ).toBe(true);
    expect(
      isEditingDetailsBlock(details, { from: 99 }, createSelection([12, 12])),
    ).toBe(false);
  });
});
