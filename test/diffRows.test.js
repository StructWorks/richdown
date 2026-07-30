import { describe, expect, it } from "vitest";

import {
  buildDiffRows,
  diffLineOperations,
  diffMiddleLines,
  splitLines,
  summarizeRows,
} from "../src/rich-diff/domain/diffRows.js";

describe("splitLines", () => {
  it("treats missing or empty text as no lines", () => {
    expect(splitLines("")).toEqual([]);
    expect(splitLines(undefined)).toEqual([]);
  });

  it("normalizes CRLF and lone CR line endings", () => {
    expect(splitLines("a\r\nb\rc\n")).toEqual(["a", "b", "c"]);
  });

  it("keeps blank lines as rows", () => {
    expect(splitLines("a\n\nb")).toEqual(["a", "", "b"]);
  });

  it("treats only the final newline as a terminator", () => {
    expect(splitLines("a\n\n")).toEqual(["a", ""]);
  });
});

describe("diffLineOperations", () => {
  it("reports only equal operations for identical documents", () => {
    expect(diffLineOperations(["same"], ["same"]).map((op) => op.type)).toEqual([
      "equal",
    ]);
  });

  it("produces no operations for two empty documents", () => {
    expect(diffLineOperations([], [])).toEqual([]);
  });

  it("trims the common prefix and suffix around a change", () => {
    const operations = diffLineOperations(
      ["head", "old", "tail"],
      ["head", "new", "tail"],
    );
    expect(operations.map((op) => op.type)).toEqual([
      "equal",
      "delete",
      "insert",
      "equal",
    ]);
    expect(operations.map((op) => (op.left || op.right).number)).toEqual([
      1, 2, 2, 3,
    ]);
  });

  it("reports an appended line as a pure insert", () => {
    const operations = diffLineOperations(["a"], ["a", "b"]);
    expect(operations.map((op) => op.type)).toEqual(["equal", "insert"]);
    expect(operations[1].left).toBeUndefined();
    expect(operations[1].right).toEqual({ text: "b", number: 2 });
  });

  it("reports a removed trailing line as a pure delete", () => {
    expect(diffLineOperations(["a", "b"], ["a"]).map((op) => op.type)).toEqual([
      "equal",
      "delete",
    ]);
  });

  it("matches interleaved shared lines instead of rewriting them", () => {
    const operations = diffLineOperations(
      ["one", "two", "three", "four"],
      ["one", "three", "four", "five"],
    );
    const byType = (type) =>
      operations
        .filter((op) => op.type === type)
        .map((op) => (op.left || op.right).text);

    expect(byType("equal")).toEqual(["one", "three", "four"]);
    expect(byType("delete")).toEqual(["two"]);
    expect(byType("insert")).toEqual(["five"]);
  });
});

describe("diffMiddleLines", () => {
  it("shifts delete line numbers by the left offset", () => {
    expect(diffMiddleLines(["x"], [], 4, 9).map((op) => op.left)).toEqual([
      { text: "x", number: 5 },
    ]);
  });

  it("shifts insert line numbers by the right offset", () => {
    expect(diffMiddleLines([], ["y"], 4, 9).map((op) => op.right)).toEqual([
      { text: "y", number: 10 },
    ]);
  });
});

describe("buildDiffRows", () => {
  it("collapses a paired delete and insert into one replace row", () => {
    expect(
      buildDiffRows(["head", "old", "tail"], ["head", "new", "tail"]),
    ).toEqual([
      {
        type: "equal",
        left: { text: "head", number: 1 },
        right: { text: "head", number: 1 },
      },
      {
        type: "replace",
        left: { text: "old", number: 2 },
        right: { text: "new", number: 2 },
      },
      {
        type: "equal",
        left: { text: "tail", number: 3 },
        right: { text: "tail", number: 3 },
      },
    ]);
  });

  it("keeps unpaired deletions standalone with a null counterpart", () => {
    const rows = buildDiffRows(["a", "b", "c"], ["x"]);
    expect(rows.map((row) => row.type)).toEqual([
      "replace",
      "delete",
      "delete",
    ]);
    expect(rows.map((row) => row.right?.text ?? null)).toEqual([
      "x",
      null,
      null,
    ]);
  });

  it("renders trailing additions as insert rows", () => {
    expect(buildDiffRows(["a"], ["a", "b", "c"]).map((row) => row.type)).toEqual(
      ["equal", "insert", "insert"],
    );
  });

  it("pairs a line replaced by an empty line", () => {
    // An empty replacement is falsy as a string, so the row type has to be
    // decided from the line objects rather than their text.
    const rows = buildDiffRows(["value"], [""]);
    expect(rows.map((row) => row.type)).toEqual(["replace"]);
    expect(rows[0].right.text).toBe("");
  });
});

describe("summarizeRows", () => {
  it("counts a replace on both sides and once as a change", () => {
    expect(
      summarizeRows(buildDiffRows(["a", "b", "c"], ["a", "B", "c", "d"])),
    ).toEqual({ added: 2, deleted: 1, changed: 2 });
  });

  it("summarizes an empty diff to zeroes", () => {
    expect(summarizeRows([])).toEqual({ added: 0, deleted: 0, changed: 0 });
  });

  it("never counts equal rows as changes", () => {
    expect(summarizeRows(buildDiffRows(["a"], ["a"]))).toEqual({
      added: 0,
      deleted: 0,
      changed: 0,
    });
  });
});
