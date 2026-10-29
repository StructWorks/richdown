import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { formatMarkdown } = require("../src/host/markdownFormatter.js");
const { lintMarkdown } = require("../src/host/markdownLinter.js");
const {
  resolveFormatConfig,
  resolveLintConfig,
} = require("../src/host/markdownQualityConfig.js");
const { maskNonProse } = require("../src/host/japaneseRules.js");

const lines = (...items) => items.join("\n");
const lintOnly = (text, name, options = {}) =>
  lintMarkdown(text, resolveLintConfig({ lint: { default: false, rules: { [name]: options } } }).rules);
const formatOnly = (text, name, options = {}) =>
  formatMarkdown(text, resolveFormatConfig({ format: { default: false, rules: { [name]: options } } }).rules);
const messagesOf = (diagnostics) => diagnostics.map((item) => [item.line, item.from, item.to]);

const fixableRules = [
  ["ja-no-zenkaku-alnum", {}],
  ["ja-space-between-half-and-full-width", { space: "never" }],
  ["ja-space-between-half-and-full-width", { space: "always" }],
  ["ja-punctuation", { style: "、。" }],
  ["ja-punctuation", { style: "，．" }],
  ["ja-no-halfwidth-kana", {}],
  ["ja-symbol-width", { style: "fullwidth" }],
  ["ja-symbol-width", { style: "halfwidth" }],
];

// Every rule's trigger in prose, then the same text where no rule applies.
const sample = lines(
  "---",
  "title: ＡＢＣ ﾃｽﾄ、テスト，です。",
  "---",
  "",
  "# 見出しＡＢＣ ｶﾅ",
  "",
  "これはＡＢＣとＶＳ Code で使う(日本語)すごい!です，ﾃｽﾄ．",
  "",
  "- 項目 ２つ目、です。",
  "",
  "| 列 | 値 |",
  "| --- | --- |",
  "| ﾃｽﾄ | ３．５ |",
  "",
  "```js",
  "const ａ = \"ﾃｽﾄ、。(日本語)!\";",
  "```",
  "",
  "インライン `ＡＢＣ ﾃｽﾄ(日本語)` と <https://example.com/ＡＢＣ?q=1> と https://example.com/a?b=c!",
  "",
  "[リンク](https://example.com/(日本語)?x=1) と ![画像](./ＡＢＣ.png) と [[ノートＡ|別名]]",
  "",
);

describe("Japanese lint rules", () => {
  it("are off by default, except half-width katakana and full-width alphanumerics", () => {
    const { rules } = resolveLintConfig({});
    expect(rules["ja-no-halfwidth-kana"]).toEqual({ severity: "warning", options: {} });
    expect(rules["ja-no-zenkaku-alnum"]).toEqual({ severity: "info", options: {} });
    for (const name of [
      "ja-space-between-half-and-full-width",
      "ja-punctuation",
      "ja-no-mixed-style",
      "ja-no-zenkaku-space",
      "ja-symbol-width",
    ]) {
      expect(rules[name]).toBeNull();
    }
  });

  it("are off in the formatter by default", () => {
    const { rules } = resolveFormatConfig({});
    expect(Object.keys(rules).filter((name) => name.startsWith("ja-") && rules[name])).toEqual([]);
  });

  it("finds full-width alphanumerics", () => {
    const result = lintOnly("ＡＢＣ１２３を使う。\n", "ja-no-zenkaku-alnum");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ line: 0, from: 0, to: 6, rule: "ja-no-zenkaku-alnum" });
    expect(result[0].message).toContain('"ABC123"');
  });

  it("finds spaces between Japanese and alphanumerics, or their absence", () => {
    expect(messagesOf(lintOnly("VS Code で Markdown を書く\n", "ja-space-between-half-and-full-width"))).toEqual([
      [0, 7, 8],
      [0, 9, 10],
      [0, 18, 19],
    ]);
    expect(
      messagesOf(lintOnly("VS CodeでMarkdownを書く\n", "ja-space-between-half-and-full-width", { space: "always" })),
    ).toEqual([
      [0, 6, 8],
      [0, 7, 9],
      [0, 15, 17],
    ]);
    // English text and punctuation between the two are not spacing.
    expect(lintOnly("Use VS Code. 「Markdown」と（ABC）\n", "ja-space-between-half-and-full-width")).toEqual([]);
  });

  it("finds the other punctuation pair, but not decimal points", () => {
    expect(messagesOf(lintOnly("これは，テストです．３．５と1，000\n", "ja-punctuation"))).toEqual([
      [0, 3, 4],
      [0, 9, 10],
    ]);
    expect(messagesOf(lintOnly("これは、テストです。\n", "ja-punctuation", { style: "，．" }))).toEqual([
      [0, 3, 4],
      [0, 9, 10],
    ]);
  });

  it("finds half-width katakana and full-width spaces", () => {
    expect(lintOnly("ｶﾞｲﾄﾞを読む\n", "ja-no-halfwidth-kana")[0].message).toContain('"ガイド"');
    expect(messagesOf(lintOnly("全角　スペース\n", "ja-no-zenkaku-space"))).toEqual([[0, 2, 3]]);
  });

  it("finds half-width symbols in Japanese text only", () => {
    expect(messagesOf(lintOnly("本当?!すごい(例)だ\n", "ja-symbol-width"))).toEqual([
      [0, 2, 4],
      [0, 7, 10],
    ]);
    // English, images, links, and callouts are left alone.
    expect(
      lintOnly("Really?! (see below) 画像![図](a.png) [日本](b) > [!NOTE]\n", "ja-symbol-width"),
    ).toEqual([]);
    expect(messagesOf(lintOnly("本当！（例）\n", "ja-symbol-width", { style: "halfwidth" }))).toEqual([
      [0, 2, 3],
      [0, 3, 4],
      [0, 5, 6],
    ]);
  });

  it("finds mixed です・ます and である styles in paragraphs", () => {
    const text = lines(
      "これはペンです。あれは本です。",
      "それは机である。",
      "",
      "- 箇条書きである。",
      "",
      "# 見出しである",
      "",
      "> 引用である。",
      "",
      "彼は「行くのだ。」と言いました（注：これは例である）。",
      "",
    );
    const result = lintOnly(text, "ja-no-mixed-style");
    expect(messagesOf(result)).toEqual([[1, 4, 7]]);
    expect(result[0].message).toContain("です・ます");
    expect(messagesOf(lintOnly(text, "ja-no-mixed-style", { style: "dearu" }))).toEqual([
      [0, 5, 7],
      [0, 12, 14],
      [9, 12, 15],
    ]);
    expect(lintOnly("これはペンです。\n", "ja-no-mixed-style")).toEqual([]);
  });

  it("does not report inside code, URLs, link destinations, wikilink targets, or front matter", () => {
    const names = [
      "ja-no-zenkaku-alnum",
      "ja-punctuation",
      "ja-no-halfwidth-kana",
      "ja-symbol-width",
      "ja-space-between-half-and-full-width",
    ];
    const reported = new Set();
    for (const name of names) {
      for (const item of lintOnly(sample, name)) {
        reported.add(item.line);
      }
    }
    // Only the heading, paragraph, list item, and table row lines.
    expect([...reported].sort((a, b) => a - b)).toEqual([4, 6, 8, 12]);
  });

  it("honors the suppression comments", () => {
    const text = lines(
      "<!-- richdown-lint-disable-next-line ja-no-zenkaku-alnum -->",
      "ＡＢＣ",
      "ＡＢＣ",
      "",
    );
    expect(lintOnly(text, "ja-no-zenkaku-alnum").map((item) => item.line)).toEqual([2]);
    expect(formatOnly(text, "ja-no-zenkaku-alnum")).toBe(
      lines("<!-- richdown-lint-disable-next-line ja-no-zenkaku-alnum -->", "ＡＢＣ", "ABC", ""),
    );
  });
});

describe("Japanese format rules", () => {
  it("fix what the lint rules report", () => {
    expect(formatOnly("ＡＢＣ１２３を使う\n", "ja-no-zenkaku-alnum")).toBe("ABC123を使う\n");
    expect(formatOnly("VS Code で Markdown を書く\n", "ja-space-between-half-and-full-width")).toBe(
      "VS CodeでMarkdownを書く\n",
    );
    expect(
      formatOnly("VS CodeでMarkdownを書く\n", "ja-space-between-half-and-full-width", { space: "always" }),
    ).toBe("VS Code で Markdown を書く\n");
    expect(formatOnly("これは，テストです．３．５\n", "ja-punctuation")).toBe("これは、テストです。３．５\n");
    expect(formatOnly("ｶﾞｲﾄﾞ｢ﾊﾟﾝ｣\n", "ja-no-halfwidth-kana")).toBe("ガイド「パン」\n");
    expect(formatOnly("本当?!すごい(例)だ ![図](a.png)\n", "ja-symbol-width")).toBe(
      "本当？！すごい（例）だ ![図](a.png)\n",
    );
    expect(formatOnly("本当！（例）\n", "ja-symbol-width", { style: "halfwidth" })).toBe("本当!(例)\n");
  });

  it("realign a table whose cells they shortened", () => {
    const table = lines("| 名前 | 値 |", "| ---- | -- |", "| ＡＢ | 1 |", "");
    const rules = resolveFormatConfig({ format: { rules: { "ja-no-zenkaku-alnum": true } } }).rules;
    expect(formatMarkdown(table, rules)).toBe(lines("| 名前 | 値  |", "| ---- | --- |", "| AB   | 1   |", ""));
  });

  it.each(fixableRules)("leave no %s warning after formatting (%o)", (name, options) => {
    const formatted = formatOnly(sample, name, options);
    expect(lintOnly(formatted, name, options)).toEqual([]);
    expect(formatOnly(formatted, name, options)).toBe(formatted);
  });

  it("never rewrite code, URLs, link destinations, or front matter", () => {
    const rules = resolveFormatConfig({ format: { default: true } }).rules;
    const formatted = formatMarkdown(sample, rules).split("\n");
    for (const kept of [
      "title: ＡＢＣ ﾃｽﾄ、テスト，です。",
      "const ａ = \"ﾃｽﾄ、。(日本語)!\";",
    ]) {
      expect(formatted).toContain(kept);
    }
    const inline = formatted.find((line) => line.startsWith("インライン"));
    expect(inline).toContain("`ＡＢＣ ﾃｽﾄ(日本語)`");
    expect(inline).toContain("<https://example.com/ＡＢＣ?q=1>");
    expect(inline).toContain("https://example.com/a?b=c!");
    const links = formatted.find((line) => line.startsWith("[リンク]"));
    expect(links).toContain("(https://example.com/(日本語)?x=1)");
    expect(links).toContain("(./ＡＢＣ.png)");
    expect(links).toContain("[[ノートＡ|別名]]");
  });
});

describe("maskNonProse", () => {
  it("keeps columns and hides code, URLs, tags, and link destinations", () => {
    const text = "a `b` <i>c</i> [d](e) https://f.g/h [[i|j]]";
    const masked = maskNonProse(text);
    expect(masked).toHaveLength(text.length);
    expect(masked.replace(/\uFFFF/g, "_")).toBe("a ___ ___c____ [d](_) _____________ [[_|j]]");
  });
});
