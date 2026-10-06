import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// The formatter runs in the extension host as CommonJS, so it is loaded the
// same way here.
const require = createRequire(import.meta.url);
const { formatMarkdown, formatRules } = require("../src/host/markdownFormatter.js");
const { resolveFormatConfig } = require("../src/host/markdownQualityConfig.js");

const defaultRules = resolveFormatConfig({}).rules;
const format = (text, rules = defaultRules) => formatMarkdown(text, rules);
const only = (name, options = {}) => ({ [name]: { ...resolveFormatConfig({}).rules[name], ...options } });
const lines = (...items) => items.join("\n");

describe("formatMarkdown", () => {
  it("leaves an already formatted document unchanged", () => {
    const text = lines("# Title", "", "Text.", "", "- a", "- b", "");
    expect(format(text)).toBe(text);
  });

  it("is idempotent on a messy document", () => {
    const messy = lines(
      "Title",
      "=====",
      "Intro   ",
      "##  Section ##",
      "* one",
      "+ two",
      "Paragraph.",
      "",
      "1. a",
      "3. b",
      "",
      "",
      "",
      "| a | b |",
      "|-|-:|",
      "| 長い | 1 |",
      "```",
      "code   ",
      "```",
      "***",
      "",
    );
    const once = format(messy);
    expect(format(once)).toBe(once);
  });

  it("runs no rule that is turned off", () => {
    expect(format("Title\n=====\n* a   ", {})).toBe("Title\n=====\n* a   ");
  });

  it("does not touch fenced code, front matter, or HTML blocks", () => {
    const text = lines(
      "---",
      "title:  x",
      "---",
      "",
      "```md",
      "#Heading   ",
      "* item",
      "",
      "",
      "```",
      "",
      "<div>",
      "* raw",
      "</div>",
      "",
    );
    expect(format(text)).toBe(text);
  });

  it("returns blank documents unchanged", () => {
    expect(format("")).toBe("");
    expect(format("\n\n")).toBe("\n\n");
  });
});

describe("heading rules", () => {
  it("converts single-line setext headings to ATX", () => {
    expect(format("Title\n=====\n\nSub\n---\n", only("heading-style"))).toBe(
      "# Title\n\n## Sub\n",
    );
  });

  it("keeps multi-line setext headings", () => {
    const text = "Two\nlines\n===\n";
    expect(format(text, only("heading-style"))).toBe(text);
  });

  it("normalizes spacing, indentation and closing marks of ATX headings", () => {
    expect(format("  ##   Title ##\n", only("atx-heading"))).toBe("## Title\n");
    expect(format("# C#\n", only("atx-heading"))).toBe("# C#\n");
  });

  it("adds the missing space only to a stand-alone ##Heading line", () => {
    expect(format("Text\n\n##Heading\n\nMore\n", only("atx-heading"))).toBe(
      "Text\n\n## Heading\n\nMore\n",
    );
    expect(format("##Heading\nstill a paragraph\n", only("atx-heading"))).toBe(
      "##Heading\nstill a paragraph\n",
    );
  });

  it("leaves hashtags and issue references alone", () => {
    const text = "#tag\n\n#264 / #265 are blocked\n";
    expect(format(text)).toBe(text);
  });

  it("surrounds headings with blank lines", () => {
    expect(format("Text\n## Heading\nMore\n", only("blank-lines-around-headings"))).toBe(
      "Text\n\n## Heading\n\nMore\n",
    );
  });

  it("does not add a blank line between front matter and a heading", () => {
    const text = "---\ntitle: x\n---\n# Heading\n";
    expect(format(text, only("blank-lines-around-headings"))).toBe(text);
  });
});

describe("list rules", () => {
  it("unifies bullet markers to the configured style", () => {
    expect(format("* a\n+ b\n  * c\n", only("list-marker"))).toBe("- a\n- b\n  - c\n");
    expect(format("- a\n- b\n", only("list-marker", { style: "*" }))).toBe("* a\n* b\n");
  });

  it("uses the first marker with the consistent style", () => {
    expect(format("+ a\n\n- b\n", only("list-marker", { style: "consistent" }))).toBe(
      "+ a\n\n+ b\n",
    );
  });

  it("does not mistake a thematic break for a list item", () => {
    const text = "Text\n\n* * *\n";
    expect(format(text, only("list-marker"))).toBe(text);
  });

  it("renumbers ordered lists from their first number", () => {
    expect(format("1. a\n3. b\n7. c\n", only("ordered-list-numbering"))).toBe(
      "1. a\n2. b\n3. c\n",
    );
    expect(format("4) a\n4) b\n9) c\n", only("ordered-list-numbering"))).toBe(
      "4) a\n5) b\n6) c\n",
    );
  });

  it("keeps lists that repeat one number, unless asked for 'one'", () => {
    const text = "1. a\n1. b\n1. c\n";
    expect(format(text, only("ordered-list-numbering"))).toBe(text);
    expect(format("1. a\n2. b\n", only("ordered-list-numbering", { style: "one" }))).toBe(
      "1. a\n1. b\n",
    );
  });

  it("numbers nested lists separately", () => {
    expect(
      format("1. a\n   1. x\n   5. y\n2. b\n", only("ordered-list-numbering")),
    ).toBe("1. a\n   1. x\n   2. y\n2. b\n");
  });

  it("keeps a list whose numbers would change width", () => {
    const text = lines(...Array.from({ length: 10 }, (_, index) => `${index === 9 ? 5 : index + 1}. item`), "");
    expect(format(text, only("ordered-list-numbering"))).toBe(text);
  });

  it("surrounds lists with blank lines", () => {
    expect(format("Intro\n- a\n- b\n## Next\n", only("blank-lines-around-lists"))).toBe(
      "Intro\n\n- a\n- b\n\n## Next\n",
    );
  });

  it("keeps lazy continuation lines inside the list", () => {
    const text = "- a\nlazy text\n";
    expect(format(text, only("blank-lines-around-lists"))).toBe(text);
  });

  it("does not turn an indented paragraph line into a list", () => {
    const text = "Text\n    - not a list item\n";
    expect(format(text)).toBe(text);
  });

  it("does not make an ordered line that cannot interrupt a paragraph into a list", () => {
    const text = "The year was\n2. Not a list\n";
    expect(format(text)).toBe(text);
  });
});

describe("fence and thematic break rules", () => {
  it("surrounds fenced code with blank lines", () => {
    expect(format("Text\n```js\nx\n```\nMore\n", only("blank-lines-around-fences"))).toBe(
      "Text\n\n```js\nx\n```\n\nMore\n",
    );
  });

  it("leaves fences inside list items alone", () => {
    const text = "- item\n  ```js\n  x\n  ```\n- next\n";
    expect(format(text)).toBe(text);
  });

  it("writes thematic breaks as ---, except right under paragraph text", () => {
    expect(format("Text\n\n***\n\n_ _ _\n", only("thematic-break"))).toBe(
      "Text\n\n---\n\n---\n",
    );
    expect(format("Text\n***\n", only("thematic-break"))).toBe("Text\n***\n");
  });
});

describe("table-format", () => {
  it("aligns columns and keeps alignment markers", () => {
    expect(
      format("|a|b|c|\n|:-|:-:|-:|\n|long text|x|1|\n", only("table-format")),
    ).toBe(
      lines(
        "| a         |  b  |   c |",
        "| :-------- | :-: | --: |",
        "| long text |  x  |   1 |",
        "",
      ),
    );
  });

  it("counts East Asian wide characters as two columns", () => {
    expect(format("| 名前 | x |\n|---|---|\n| 日本語 | y |\n", only("table-format"))).toBe(
      lines("| 名前   | x   |", "| ------ | --- |", "| 日本語 | y   |", ""),
    );
  });

  it("pads short rows and keeps cells past the header", () => {
    expect(format("| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |\n", only("table-format"))).toBe(
      lines("| a   | b   |", "| --- | --- |", "| 1   |     |", "| 1   | 2   | 3 |", ""),
    );
  });

  it("keeps escaped pipes and pipes in inline code inside their cell", () => {
    expect(format("| a | b |\n|---|---|\n| x \\| y | `p|q` |\n", only("table-format"))).toBe(
      lines("| a      | b     |", "| ------ | ----- |", "| x \\| y | `p|q` |", ""),
    );
  });

  it("surrounds tables with blank lines", () => {
    expect(format("Text\n| a |\n|---|\n| 1 |\nAfter\n", only("blank-lines-around-tables"))).toBe(
      "Text\n\n| a |\n|---|\n| 1 |\n\nAfter\n",
    );
  });
});

describe("whitespace rules", () => {
  it("removes trailing whitespace but keeps a two-space hard break", () => {
    expect(format("one   \ntwo  \nthree\t\n", only("trailing-whitespace"))).toBe(
      "one  \ntwo  \nthree\n",
    );
    expect(format("last line  \n\nnext\n", only("trailing-whitespace"))).toBe(
      "last line\n\nnext\n",
    );
  });

  it("collapses blank lines outside code and drops leading ones", () => {
    expect(format("\n\nA\n\n\n\nB\n```\n\n\n```\n", only("consecutive-blank-lines"))).toBe(
      "A\n\nB\n```\n\n\n```\n",
    );
  });

  it("ends the document with exactly one newline", () => {
    expect(format("A", only("final-newline"))).toBe("A\n");
    expect(format("A\n\n\n", only("final-newline"))).toBe("A\n");
  });
});

describe("formatRules", () => {
  it("lists every rule the formatter runs, once", () => {
    const names = formatRules.map((rule) => rule.name);
    expect(new Set(names).size).toBe(names.length);
    expect(Object.keys(defaultRules)).toEqual(names);
  });
});
