import { describe, expect, it } from "vitest";

import {
  findFrontmatterBlock,
  findTableBlocks,
  isTableDelimiterLine,
  parseFrontmatterEntries,
} from "../src/rich-editor/domain/markdownBlocks.js";
import { createDoc, createDocOf } from "./helpers/testKit.js";

describe("isTableDelimiterLine", () => {
  it.each([
    "| --- | --- |",
    "| :--- | ---: |",
    "|:--|--:|",
    "| :-: | :- |",
    "|:-|-:|",
    ":- | -:",
  ])("recognizes the GFM delimiter row %s", (delimiter) => {
    expect(isTableDelimiterLine(delimiter)).toBe(true);
  });

  it.each(["| a | b |", "---", "| -x- |", "plain text"])(
    "rejects the non-delimiter row %s",
    (line) => {
      expect(isTableDelimiterLine(line)).toBe(false);
    },
  );
});

describe("table alignment from short delimiters", () => {
  it("maps :--, :-: and --: to column alignments", () => {
    const blocks = findTableBlocks(
      createDoc("| A | B | C |\n|:--|:-:|--:|\n| 1 | 2 | 3 |"),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].alignments).toEqual(["left", "center", "right"]);
  });
});

describe("findFrontmatterBlock", () => {
  it("collects scalars and list items from a leading YAML block", () => {
    const block = findFrontmatterBlock(
      createDocOf([
        "---",
        'title: "Hello World"',
        "tags:",
        "  - alpha",
        "  - beta",
        "draft: false",
        "# comment",
        "empty:",
        "---",
        "",
        "# Heading",
      ]),
    );

    expect(block).toBeTruthy();
    expect(block.from).toBe(0);
    expect(block.sourceLineCount).toBe(9);
    expect(
      block.entries.map((entry) => ({ key: entry.key, values: entry.values })),
    ).toEqual([
      { key: "title", values: ["Hello World"] },
      { key: "tags", values: ["alpha", "beta"] },
      { key: "draft", values: ["false"] },
      { key: "empty", values: [] },
    ]);
  });

  it("requires the opening fence on the first line", () => {
    expect(findFrontmatterBlock(createDoc("# Title\n---\nbody"))).toBeNull();
  });

  it("rejects an unclosed opening fence", () => {
    expect(findFrontmatterBlock(createDoc("---\ntitle: unclosed"))).toBeNull();
  });

  it("treats longer dash runs as thematic breaks", () => {
    expect(findFrontmatterBlock(createDoc("----\ntitle: x\n---"))).toBeNull();
  });

  it("still reports an empty front matter block", () => {
    const block = findFrontmatterBlock(createDoc("---\n---\nbody"));
    expect(block).toBeTruthy();
    expect(block.entries).toEqual([]);
  });
});

describe("parseFrontmatterEntries", () => {
  it("keeps nested mapping lines readable as raw values", () => {
    expect(
      parseFrontmatterEntries([
        { text: "layout: post", from: 0 },
        { text: "nested:", from: 13 },
        { text: "  key: value", from: 21 },
      ]).map((entry) => ({ key: entry.key, values: entry.values })),
    ).toEqual([
      { key: "layout", values: ["post"] },
      { key: "nested", values: ["key: value"] },
    ]);
  });
});
