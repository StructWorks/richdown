import { beforeEach, describe, expect, it } from "vitest";

import { createMarkdownRenderer } from "../src/rich-diff/presentation/markdownRenderer.js";
import {
  escapeAttribute,
  escapeHtml,
} from "../src/rich-diff/presentation/htmlEscape.js";

describe("htmlEscape", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml('<script>alert("x" & \'y\')</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;",
    );
  });

  it("stringifies non-string values", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(null)).toBe("null");
  });

  it("also escapes backticks in attributes", () => {
    expect(escapeAttribute("`cmd` <x>")).toBe("&#96;cmd&#96; &lt;x&gt;");
  });
});

// The renderer takes highlight.js and a copy-payload registry from the webview.
// Stubbing both keeps these tests on the Markdown-to-HTML mapping. highlight.js
// resolves its own aliases (js, ts, ...), so the renderer only normalizes tags
// highlight.js does not know.
const knownLanguages = new Set(["javascript", "js", "typescript"]);

let copyPayloads;
let analyzeMarkdownLines;
let renderMarkdownLine;

beforeEach(() => {
  copyPayloads = [];
  ({ analyzeMarkdownLines, renderMarkdownLine } = createMarkdownRenderer({
    hljs: {
      getLanguage(language) {
        return knownLanguages.has(language) ? { name: language } : undefined;
      },
      highlight(code, options) {
        return { value: `<span class="hl-${options.language}">${code}</span>` };
      },
    },
    registerCopyPayload(payload) {
      copyPayloads.push(payload);
      return `copy-${copyPayloads.length}`;
    },
  }));
});

function renderAll(lines) {
  const meta = analyzeMarkdownLines(lines);
  return lines.map((line, index) =>
    renderMarkdownLine(line, meta.get(index + 1)),
  );
}

describe("renderMarkdownLine inline constructs", () => {
  it("keeps blank rows at full height without content", () => {
    expect(renderMarkdownLine("   ", undefined)).toBe(
      '<span class="rdiff-blank-line" aria-hidden="true">&nbsp;</span>',
    );
  });

  it("shows raw HTML escaped instead of executing it", () => {
    expect(renderMarkdownLine("plain <b>text</b>", undefined)).toBe(
      "plain &lt;b&gt;text&lt;/b&gt;",
    );
    expect(
      renderMarkdownLine('<a href="x" onclick="steal()">hi</a>', undefined),
    ).toBe("&lt;a href=&quot;x&quot; onclick=&quot;steal()&quot;&gt;hi&lt;/a&gt;");
  });

  it("renders emphasis and strikethrough", () => {
    expect(
      renderMarkdownLine("**bold** and *italic* and ~~gone~~", undefined),
    ).toBe("<strong>bold</strong> and <em>italic</em> and <del>gone</del>");
  });

  it("escapes inline code content", () => {
    expect(renderMarkdownLine("use `a < b` here", undefined)).toBe(
      "use <code>a &lt; b</code> here",
    );
  });

  it("makes links inert and carries the target in a data attribute", () => {
    expect(renderMarkdownLine("[docs](https://example.com/a)", undefined)).toBe(
      '<a href="#" data-href="https://example.com/a">docs</a>',
    );
  });

  it("labels a bare URL with the URL itself", () => {
    expect(renderMarkdownLine("see https://example.com/x", undefined)).toBe(
      'see <a href="#" data-href="https://example.com/x">https://example.com/x</a>',
    );
  });

  it("renders an image as a placeholder the webview resolves later", () => {
    expect(renderMarkdownLine('![alt "text"](img.png)', undefined)).toBe(
      '<span class="rdiff-image" data-image-src="img.png" data-image-alt="alt &quot;text&quot;"><span class="rdiff-image-loading">alt &quot;text&quot;</span></span>',
    );
  });
});

describe("renderMarkdownLine block constructs", () => {
  it("renders headings with a level class", () => {
    expect(renderMarkdownLine("### Heading text", undefined)).toBe(
      '<div class="rdiff-heading rdiff-heading-3">Heading text</div>',
    );
  });

  it("renders thematic breaks and quotes", () => {
    expect(renderMarkdownLine("---", undefined)).toBe('<hr class="rdiff-hr">');
    expect(renderMarkdownLine("> quoted **line**", undefined)).toBe(
      '<blockquote class="rdiff-quote">quoted <strong>line</strong></blockquote>',
    );
  });

  it("renders task list state and indentation depth", () => {
    expect(renderMarkdownLine("- [ ] todo", undefined)).toContain(
      'class="rdiff-task "',
    );
    const checked = renderMarkdownLine("    - [x] done", undefined);
    expect(checked).toContain("is-checked");
    expect(checked).toContain("rdiff-list-depth-2");
  });

  it("distinguishes ordered and unordered list markers", () => {
    const ordered = renderMarkdownLine("1. first", undefined);
    expect(ordered).toContain("is-ordered");
    expect(ordered).toContain(">1.<");
    expect(renderMarkdownLine("- item", undefined)).toContain("is-unordered");
  });
});

describe("analyzeMarkdownLines with code fences", () => {
  const codeLines = [
    "```js",
    "const a = 1 < 2;",
    "```",
    "text",
    "```",
    "no language",
    "```",
  ];

  it("marks the fence roles and collects the block source", () => {
    const meta = analyzeMarkdownLines(codeLines);
    expect(meta.get(1)).toEqual({
      kind: "codeFence",
      role: "open",
      language: "js",
      code: "const a = 1 < 2;",
    });
    expect(meta.get(2)).toEqual({ kind: "code", language: "js" });
    expect(meta.get(3)).toEqual({
      kind: "codeFence",
      role: "close",
      language: "js",
      code: "const a = 1 < 2;",
    });
    expect(meta.get(4)).toBeUndefined();
    expect(meta.get(6).language).toBe("");
  });

  it("puts the copy button on the opening fence only", () => {
    const rendered = renderAll(codeLines);
    expect(rendered[0]).toContain('<span class="rdiff-code-lang">js</span>');
    expect(rendered[0]).toContain('data-copy-id="copy-1"');
    expect(rendered[2]).not.toContain("rdiff-copy");
  });

  it("highlights known languages and escapes the rest", () => {
    const rendered = renderAll(codeLines);
    expect(rendered[1]).toBe(
      '<pre class="rdiff-code-line"><code><span class="hl-js">const a = 1 < 2;</span></code></pre>',
    );
    expect(rendered[5]).toBe(
      '<pre class="rdiff-code-line"><code>no language</code></pre>',
    );
    expect(
      renderMarkdownLine("x = 1", { kind: "code", language: "python" }),
    ).toBe('<pre class="rdiff-code-line"><code>x = 1</code></pre>');
  });

  it("registers the block payload for each fence line", () => {
    renderAll(codeLines);
    expect(copyPayloads).toEqual([
      "const a = 1 < 2;",
      "const a = 1 < 2;",
      "no language",
      "no language",
    ]);
  });

  it.each([
    ["```py", "python"],
    ["```tsx", "typescript"],
    ["~~~Shell", "bash"],
  ])("normalizes the language tag %s to %s", (fence, language) => {
    expect(analyzeMarkdownLines([fence, "code", "```"]).get(1).language).toBe(
      language,
    );
  });

  it("does not close a tilde fence with a backtick fence", () => {
    const meta = analyzeMarkdownLines(["~~~text", "```", "still code", "~~~"]);
    expect(meta.get(2).kind).toBe("code");
    expect(meta.get(4).role).toBe("close");
  });

  it("keeps the collected code of an unclosed fence", () => {
    const meta = analyzeMarkdownLines(["```js", "const a = 1;"]);
    expect(meta.get(1).code).toBe("const a = 1;");
    expect(meta.get(2).kind).toBe("code");
  });
});

describe("analyzeMarkdownLines with tables", () => {
  const tableLines = [
    "| Name | Value |",
    "| --- | ---: |",
    "| a | `x|y` |",
    "plain",
  ];

  it("marks header, delimiter and body rows", () => {
    const meta = analyzeMarkdownLines(tableLines);
    expect(meta.get(1)).toEqual({ kind: "table", role: "header" });
    expect(meta.get(2)).toEqual({ kind: "table", role: "delimiter" });
    expect(meta.get(3)).toEqual({ kind: "table", role: "body" });
    expect(meta.get(4)).toBeUndefined();
  });

  it("renders the delimiter as a rule and keeps piped code in one cell", () => {
    const rendered = renderAll(tableLines);
    expect(rendered[0]).toContain("<th>Name</th>");
    expect(rendered[1]).toBe('<div class="rdiff-table-rule"></div>');
    expect(rendered[2]).toContain("<td><code>x|y</code></td>");
  });

  it("renders a fenced table as a table, unlike the rich editor", () => {
    // Known gap: collectTableMeta runs after collectCodeBlockMeta and overwrites
    // it, so a table inside a fence becomes a rich table here while the rich
    // editor keeps it as code (computeTableBlocks skips fences). Pinned so
    // closing the gap is a deliberate change.
    const meta = analyzeMarkdownLines([
      "```markdown",
      "| A | B |",
      "| --- | --- |",
      "```",
    ]);
    expect(meta.get(1).kind).toBe("codeFence");
    expect(meta.get(2)).toEqual({ kind: "table", role: "header" });
    expect(meta.get(3)).toEqual({ kind: "table", role: "delimiter" });
  });
});
