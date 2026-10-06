import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// The linter runs in the extension host as CommonJS, so it is loaded the same
// way here.
const require = createRequire(import.meta.url);
const { lintMarkdown, lintRules } = require("../src/host/markdownLinter.js");
const { resolveLintConfig } = require("../src/host/markdownQualityConfig.js");

const defaultRules = resolveLintConfig({}).rules;
const lint = (text, rules = defaultRules) => lintMarkdown(text, rules);
const lintWith = (name, text, value = true) =>
  lintMarkdown(text, resolveLintConfig({ lint: { default: false, rules: { [name]: value } } }).rules);
const summarize = (diagnostics) =>
  diagnostics.map((diagnostic) => `${diagnostic.line + 1}:${diagnostic.rule}`);

describe("lintMarkdown", () => {
  it("reports nothing for a clean document", () => {
    const text = [
      "---",
      "title: Clean",
      "---",
      "",
      "# Title",
      "",
      "Intro with a [link](#section) and `code`.",
      "",
      "## Section",
      "",
      "- one",
      "- two",
      "",
      "1. first",
      "2. second",
      "",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "```js",
      "const x = 1;   ",
      "```",
      "",
    ].join("\n");
    expect(lint(text)).toEqual([]);
  });

  it("reports rule, severity, and a range on one line", () => {
    expect(lintWith("no-trailing-spaces", "text   \n")).toEqual([
      {
        rule: "no-trailing-spaces",
        severity: "warning",
        line: 0,
        from: 4,
        to: 7,
        message: "Trailing whitespace.",
      },
    ]);
  });

  it("uses the configured severity", () => {
    expect(lintWith("no-trailing-spaces", "text   \n", "error")[0].severity).toBe("error");
  });
});

describe("heading rules", () => {
  it("reports skipped heading levels", () => {
    expect(summarize(lintWith("heading-increment", "# A\n\n### B\n\n## C\n\n#### D\n"))).toEqual([
      "3:heading-increment",
      "7:heading-increment",
    ]);
  });

  it("reports a second top-level heading", () => {
    expect(summarize(lintWith("single-h1", "# A\n\n# B\n\nC\n=\n"))).toEqual([
      "3:single-h1",
      "5:single-h1",
    ]);
  });

  it("reports duplicate headings only among siblings", () => {
    const text = "# A\n\n## Setup\n\n## Setup\n\n# B\n\n## Setup\n";
    expect(summarize(lintWith("no-duplicate-heading", text))).toEqual(["5:no-duplicate-heading"]);
  });

  it("reports empty headings", () => {
    expect(summarize(lintWith("no-empty-heading", "#\n\n## \n\n# Text\n"))).toEqual([
      "1:no-empty-heading",
      "3:no-empty-heading",
    ]);
  });

  it("reports heading spacing but not hashtags", () => {
    expect(summarize(lintWith("heading-space", "##  Two\n\n##Missing\n\n#tag\n"))).toEqual([
      "1:heading-space",
      "3:heading-space",
    ]);
  });

  it("does not treat headings in code or front matter as headings", () => {
    const text = "---\n# not: heading\n---\n\n```\n# Code\n# Code\n```\n";
    const headingRules = ["heading-increment", "single-h1", "no-duplicate-heading", "heading-space"];
    expect(lint(text).filter((diagnostic) => headingRules.includes(diagnostic.rule))).toEqual([]);
  });
});

describe("blank line rules", () => {
  it("reports headings without surrounding blank lines", () => {
    expect(summarize(lintWith("blanks-around-headings", "Text\n# A\nText\n"))).toEqual([
      "2:blanks-around-headings",
      "2:blanks-around-headings",
    ]);
  });

  it("reports fences, lists, and tables without surrounding blank lines", () => {
    expect(summarize(lintWith("blanks-around-fences", "A\n```js\nx\n```\nB\n"))).toEqual([
      "2:blanks-around-fences",
      "4:blanks-around-fences",
    ]);
    expect(summarize(lintWith("blanks-around-lists", "A\n- x\n- y\n# B\n"))).toEqual([
      "2:blanks-around-lists",
      "3:blanks-around-lists",
    ]);
    expect(summarize(lintWith("blanks-around-tables", "A\n| a |\n|---|\nB\n"))).toEqual([
      "2:blanks-around-tables",
      "3:blanks-around-tables",
    ]);
  });

  it("reports multiple blank lines", () => {
    expect(summarize(lintWith("no-multiple-blanks", "A\n\n\n\nB\n"))).toEqual([
      "3:no-multiple-blanks",
      "4:no-multiple-blanks",
    ]);
  });

  it("reports a missing or doubled final newline", () => {
    expect(summarize(lintWith("final-newline", "A"))).toEqual(["1:final-newline"]);
    expect(summarize(lintWith("final-newline", "A\n\n\n"))).toEqual(["2:final-newline"]);
    expect(lintWith("final-newline", "A\n")).toEqual([]);
  });
});

describe("code fence rules", () => {
  it("reports fences without a language", () => {
    expect(summarize(lintWith("fenced-code-language", "```\nx\n```\n\n```mermaid\ny\n```\n"))).toEqual([
      "1:fenced-code-language",
    ]);
  });

  it("reports an unclosed fence as an error", () => {
    const [diagnostic] = lintWith("unclosed-code-fence", "Text\n\n~~~js\ncode\n");
    expect(diagnostic).toMatchObject({ line: 2, severity: "error" });
  });
});

describe("list and table rules", () => {
  it("reports bullet markers that differ from the first one", () => {
    expect(summarize(lintWith("list-marker-style", "- a\n* b\n\n+ c\n"))).toEqual([
      "2:list-marker-style",
      "4:list-marker-style",
    ]);
    expect(summarize(lintWith("list-marker-style", "- a\n", { style: "*" }))).toEqual([
      "1:list-marker-style",
    ]);
  });

  it("reports out-of-sequence ordered list numbers", () => {
    expect(summarize(lintWith("ordered-list-numbering", "1. a\n3. b\n\nText\n\n1. x\n1. y\n"))).toEqual([
      "2:ordered-list-numbering",
    ]);
  });

  it("reports table rows with a different cell count", () => {
    expect(
      summarize(lintWith("table-column-count", "| a | b |\n|---|---|\n| 1 |\n| 1 | 2 |\n")),
    ).toEqual(["3:table-column-count"]);
  });
});

describe("link rules", () => {
  it("reports empty links, reversed links, and images without alt text", () => {
    expect(summarize(lintWith("no-empty-links", "[a]() [b](#) [c](x) ![d]()\n"))).toEqual([
      "1:no-empty-links",
      "1:no-empty-links",
    ]);
    expect(summarize(lintWith("no-reversed-links", "(text)[url] (note)[^1]\n"))).toEqual([
      "1:no-reversed-links",
    ]);
    expect(summarize(lintWith("no-missing-image-alt", "![](a.png) ![ok](b.png) <img src=c>\n"))).toEqual([
      "1:no-missing-image-alt",
      "1:no-missing-image-alt",
    ]);
  });

  it("ignores links inside inline code", () => {
    expect(lintWith("no-empty-links", "`[a]()`\n")).toEqual([]);
  });

  it("reports anchors that match no heading", () => {
    const text = [
      "# Getting Started",
      "",
      "## Setup",
      "",
      "## Setup",
      "",
      '<a id="custom"></a>',
      "",
      "[ok](#getting-started) [dup](#setup-1) [id](#custom) [line](#L12) [text](#Getting%20Started) [bad](#missing)",
      "",
    ].join("\n");
    const diagnostics = lintWith("no-broken-anchors", text);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("#missing");
  });

  it("reports bare URLs when turned on", () => {
    const text = "See https://a.example and <https://b.example> and [x](https://c.example).\n\n[ref]: https://d.example\n";
    expect(summarize(lintWith("no-bare-urls", text))).toEqual(["1:no-bare-urls"]);
    expect(lint(text)).toEqual([]);
  });
});

describe("whitespace and length rules", () => {
  it("allows a two-space hard break but not other trailing whitespace", () => {
    expect(summarize(lintWith("no-trailing-spaces", "one  \ntwo   \nthree  \n\n  \n"))).toEqual([
      "2:no-trailing-spaces",
      "3:no-trailing-spaces",
      "5:no-trailing-spaces",
    ]);
  });

  it("reports hard tabs outside code", () => {
    expect(summarize(lintWith("no-hard-tabs", "a\tb\n\n```\n\tcode\n```\n"))).toEqual(["1:no-hard-tabs"]);
  });

  it("reports long lines with East Asian characters counted as two columns", () => {
    const rules = { severity: "warning", max: 10 };
    expect(summarize(lintWith("line-length", "あいうえお か\nshort\n", rules))).toEqual([
      "1:line-length",
    ]);
    expect(lintWith("line-length", "x https://example.com/a/very/long/url\n", rules)).toEqual([]);
  });
});

describe("suppression comments", () => {
  it("silences rules for the next line", () => {
    const text = "<!-- richdown-lint-disable-next-line no-trailing-spaces -->\ntext   \nmore   \n";
    expect(summarize(lintWith("no-trailing-spaces", text))).toEqual(["3:no-trailing-spaces"]);
  });

  it("silences rules between disable and enable", () => {
    const text = [
      "<!-- richdown-lint-disable -->",
      "a   ",
      "<!-- richdown-lint-enable -->",
      "b   ",
      "<!-- richdown-lint-disable no-hard-tabs -->",
      "c   ",
      "",
    ].join("\n");
    expect(summarize(lintWith("no-trailing-spaces", text))).toEqual([
      "4:no-trailing-spaces",
      "6:no-trailing-spaces",
    ]);
  });
});

describe("lintRules", () => {
  it("has unique rule names", () => {
    const names = lintRules.map((rule) => rule.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
