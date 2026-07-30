import { describe, expect, it } from "vitest";

import {
  findDetailsBlocks,
  findGherkinBlocks,
  findMermaidBlocks,
  findMermaidFenceBlocks,
  findTableBlocks,
  isMatchingMarkdownCodeFenceClosing,
  parseMarkdownCodeFenceOpening,
} from "../src/rich-editor/domain/markdownBlocks.js";
import { createDoc, createDocOf } from "./helpers/testKit.js";

describe("findDetailsBlocks", () => {
  it("reads the summary, open state and span of a closed element", () => {
    const blocks = findDetailsBlocks(
      createDocOf([
        "intro",
        "<details open>",
        "<summary>Release notes</summary>",
        "",
        "- first",
        "</details>",
        "outro",
      ]),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].summary).toBe("Release notes");
    expect(blocks[0].openByDefault).toBe(true);
    expect(blocks[0].sourceLineCount).toBe(5);
    expect(blocks[0].bodyLines.map((line) => line.text)).toEqual(["- first"]);
  });

  it("keeps details without the open attribute collapsed", () => {
    const blocks = findDetailsBlocks(
      createDocOf(["<details>", "<summary>Hidden</summary>", "body", "</details>"]),
    );
    expect(blocks[0].openByDefault).toBe(false);
  });

  it("does not treat open inside an attribute value as the open attribute", () => {
    const blocks = findDetailsBlocks(
      createDocOf([
        '<details class="open-note">',
        "<summary>Note</summary>",
        "body",
        "</details>",
      ]),
    );
    expect(blocks[0].openByDefault).toBe(false);
  });

  it("handles a single-line details element", () => {
    const blocks = findDetailsBlocks(
      createDoc("<details><summary>Inline</summary>body</details>"),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].summary).toBe("Inline");
    expect(blocks[0].sourceLineCount).toBe(1);
  });

  it("labels a details element without a summary", () => {
    const blocks = findDetailsBlocks(
      createDocOf(["<details>", "plain body", "</details>"]),
    );
    expect(blocks[0].summary).toBe("Details");
  });

  it("reports only the outermost block for nested details", () => {
    // Nested details are legal Markdown, but overlapping CodeMirror widgets are
    // not, so only the outer block is replaced.
    const blocks = findDetailsBlocks(
      createDocOf([
        "<details>",
        "<summary>Outer</summary>",
        "<details>",
        "<summary>Inner</summary>",
        "inner body",
        "</details>",
        "</details>",
      ]),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].summary).toBe("Outer");
    expect(blocks[0].sourceLineCount).toBe(7);
  });

  it("ignores an unclosed element and a stray closing tag", () => {
    expect(
      findDetailsBlocks(
        createDocOf(["<details>", "<summary>Unclosed</summary>", "body"]),
      ),
    ).toEqual([]);
    expect(
      findDetailsBlocks(createDocOf(["</details>", "stray closing tag"])),
    ).toEqual([]);
  });

  it("gives sibling elements their own block and a unique key", () => {
    const blocks = findDetailsBlocks(
      createDocOf([
        "<details><summary>One</summary>a</details>",
        "<details><summary>Two</summary>b</details>",
      ]),
    );
    expect(blocks.map((block) => block.summary)).toEqual(["One", "Two"]);
    expect(blocks[0].key).not.toBe(blocks[1].key);
  });
});

describe("findMermaidBlocks", () => {
  it("accepts backtick, tilde and colon fences", () => {
    const blocks = findMermaidBlocks(
      createDocOf([
        "# Title",
        "```mermaid",
        "graph TD;",
        "  A-->B;",
        "```",
        "text",
        "~~~mermaid",
        "pie title Pets",
        "~~~",
        ":::mermaid",
        "flowchart LR",
        ":::",
      ]),
    );

    expect(blocks.map((block) => block.fenceChar)).toEqual(["`", "~", ":"]);
    expect(blocks.map((block) => block.closed)).toEqual([true, true, true]);
    expect(blocks[0].code).toBe("graph TD;\n  A-->B;");
    expect(blocks[0].sourceLineCount).toBe(4);
  });

  it("does not let a shorter fence close a longer one", () => {
    const blocks = findMermaidBlocks(
      createDocOf(["````mermaid", "graph TD;", "```", "A-->B;", "````"]),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe("graph TD;\n```\nA-->B;");
  });

  it("ignores an unclosed fence", () => {
    expect(findMermaidBlocks(createDocOf(["```mermaid", "graph TD;"]))).toEqual(
      [],
    );
  });

  it("requires the language to be exactly mermaid", () => {
    expect(
      findMermaidBlocks(createDocOf(["```mermaidish", "graph TD;", "```"])),
    ).toEqual([]);
  });

  it("matches the language case-insensitively and allows extra attributes", () => {
    expect(
      findMermaidBlocks(createDocOf(["```MERMAID", "graph TD;", "```"])),
    ).toHaveLength(1);
    expect(
      findMermaidBlocks(
        createDocOf(["```mermaid darkMode=true", "graph TD;", "```"]),
      ),
    ).toHaveLength(1);
  });
});

describe("findMermaidFenceBlocks", () => {
  it("can include an unclosed block for the typing path", () => {
    const blocks = findMermaidFenceBlocks(
      createDocOf(["```mermaid", "graph TD;", "  A-->B;"]),
      { includeUnclosed: true },
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].closed).toBe(false);
    expect(blocks[0].code).toBe("graph TD;\n  A-->B;");
  });

  it("defaults to closed blocks only", () => {
    expect(
      findMermaidFenceBlocks(createDocOf(["```mermaid", "graph TD;"])),
    ).toEqual([]);
  });
});

describe("findGherkinBlocks", () => {
  it("accepts the gherkin, feature and cucumber language tags", () => {
    const blocks = findGherkinBlocks(
      createDocOf([
        "```gherkin",
        "Feature: Login",
        "  Scenario: Success",
        "```",
        "~~~feature",
        "Feature: Second",
        "~~~",
        "```cucumber",
        "Feature: Third",
        "```",
      ]),
    );
    expect(blocks).toHaveLength(3);
    expect(blocks[0].code).toBe("Feature: Login\n  Scenario: Success");
  });

  it("does not treat colon fences as Gherkin containers", () => {
    expect(
      findGherkinBlocks(createDocOf([":::gherkin", "Feature: Colon", ":::"])),
    ).toEqual([]);
  });

  it("ignores an unclosed fence", () => {
    expect(
      findGherkinBlocks(createDocOf(["```gherkin", "Feature: Unclosed"])),
    ).toEqual([]);
  });
});

describe("findTableBlocks", () => {
  it("keeps a table inside a code fence as plain code", () => {
    const blocks = findTableBlocks(
      createDocOf([
        "| Name | Value |",
        "| --- | ---: |",
        "| a | 1 |",
        "",
        "```text",
        "| Fenced | Table |",
        "| --- | --- |",
        "```",
      ]),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0].columnCount).toBe(2);
    expect(blocks[0].alignments).toEqual(["left", "right"]);
    expect(blocks[0].rows.map((row) => row.role)).toEqual(["header", "body"]);
    expect(blocks[0].sourceRows.map((row) => row.role)).toEqual([
      "header",
      "delimiter",
      "body",
    ]);
    expect(blocks[0].rows[1].cells.map((cell) => cell.text)).toEqual(["a", "1"]);
  });

  it("pads ragged rows to the widest row", () => {
    const blocks = findTableBlocks(
      createDocOf(["| A | B |", "| --- | --- |", "| 1 | 2 | 3 |", "| 4 |"]),
    );
    expect(blocks[0].columnCount).toBe(3);
    expect(blocks[0].rows.map((row) => row.cells.length)).toEqual([3, 3, 3]);
    expect(blocks[0].rows[0].cells[2]).toEqual({
      text: "",
      from: null,
      to: null,
    });
    expect(blocks[0].alignments).toEqual(["left", "left", "left"]);
  });

  it("supports borderless indented tables", () => {
    const blocks = findTableBlocks(
      createDocOf(["  Name | Value", "  --- | ---", "  a | 1"]),
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].indent).toBe("  ");
    expect(blocks[0].usesLeadingPipe).toBe(false);
    expect(blocks[0].usesTrailingPipe).toBe(false);
  });

  it("requires a delimiter row directly under the header", () => {
    expect(findTableBlocks(createDocOf(["| A | B |", "| a | b |"]))).toEqual([]);
    expect(findTableBlocks(createDoc("| A | B |"))).toEqual([]);
  });

  it("keeps blank-line separated tables apart", () => {
    const blocks = findTableBlocks(
      createDocOf(["| A |", "| --- |", "| 1 |", "", "| B |", "| --- |", "| 2 |"]),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0].to).toBeLessThan(blocks[1].from);
  });

  it("points every cell offset back at its Markdown source", () => {
    const source = "| Name | Value |\n| --- | --- |\n| a | 1 |";
    const block = findTableBlocks(createDoc(source))[0];
    for (const row of block.rows) {
      for (const cell of row.cells) {
        expect(source.slice(cell.from, cell.to)).toBe(cell.text);
      }
    }
  });
});

describe("block scan memoization", () => {
  const lines = ["| A |", "| --- |", "| 1 |", "<details>x</details>"];

  it("reuses the cached result for one document version", () => {
    const doc = createDocOf(lines);
    expect(findTableBlocks(doc)).toBe(findTableBlocks(doc));
    expect(findDetailsBlocks(doc)).toBe(findDetailsBlocks(doc));
  });

  it("rescans a new document version", () => {
    expect(findTableBlocks(createDocOf(lines))).not.toBe(
      findTableBlocks(createDocOf(lines)),
    );
  });
});

describe("code fence helpers", () => {
  it("parses backtick and tilde fences", () => {
    expect(parseMarkdownCodeFenceOpening("```js")).toEqual({
      marker: "```",
      char: "`",
      length: 3,
    });
    expect(parseMarkdownCodeFenceOpening("~~~~")).toEqual({
      marker: "~~~~",
      char: "~",
      length: 4,
    });
  });

  it("treats colon fences as fences only for Mermaid", () => {
    expect(parseMarkdownCodeFenceOpening(":::mermaid")).toEqual({
      marker: ":::",
      char: ":",
      length: 3,
    });
    expect(parseMarkdownCodeFenceOpening(":::note")).toBeNull();
  });

  it("rejects inline code and indented code", () => {
    expect(parseMarkdownCodeFenceOpening("``inline``")).toBeNull();
    expect(parseMarkdownCodeFenceOpening("    ```js")).toBeNull();
  });

  it("closes only on a matching bare fence of at least the same length", () => {
    const opening = parseMarkdownCodeFenceOpening("```js");
    expect(isMatchingMarkdownCodeFenceClosing("```", opening)).toBe(true);
    expect(isMatchingMarkdownCodeFenceClosing("````", opening)).toBe(true);
    expect(isMatchingMarkdownCodeFenceClosing("``", opening)).toBe(false);
    expect(isMatchingMarkdownCodeFenceClosing("~~~", opening)).toBe(false);
    expect(isMatchingMarkdownCodeFenceClosing("``` js", opening)).toBe(false);
  });
});
