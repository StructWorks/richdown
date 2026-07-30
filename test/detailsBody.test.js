// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { appendDetailsBody } from "../src/rich-editor/presentation/details/detailsPreview.js";

// appendDetailsBody renders the body of a <details> block. Inline rendering is
// injected, so a text-only stub keeps these tests on the block-level structure.
function renderBody(lines, overrides = {}) {
  const appendInlineMarkdown = vi.fn((element, text) => {
    element.textContent = text;
  });
  const parent = document.createElement("div");
  appendDetailsBody(
    parent,
    lines.map((text) => ({ text, sourceFrom: null })),
    {
      appendInlineMarkdown,
      getSourcePosition: (line, index) => index,
      ...overrides,
    },
  );
  return { parent, appendInlineMarkdown };
}

describe("appendDetailsBody paragraphs and headings", () => {
  it("renders a paragraph per line and skips blank lines", () => {
    const { parent } = renderBody(["first", "", "   ", "second"]);
    const paragraphs = [...parent.querySelectorAll("p.cm-details-body-line")];

    expect(paragraphs.map((node) => node.textContent)).toEqual([
      "first",
      "second",
    ]);
  });

  it("records the source offset of every rendered line", () => {
    const { parent } = renderBody(["first", "second"]);
    expect(
      [...parent.children].map((node) => node.dataset.sourceFrom),
    ).toEqual(["0", "1"]);
  });

  it("renders headings at their own level", () => {
    const { parent } = renderBody(["# One", "### Three", "###### Six"]);
    expect([...parent.children].map((node) => node.tagName)).toEqual([
      "H1",
      "H3",
      "H6",
    ]);
    expect(parent.querySelector("h3").className).toBe("cm-details-heading");
    expect(parent.querySelector("h3").textContent).toBe("Three");
  });

  it("renders block quotes", () => {
    const { parent } = renderBody(["> quoted"]);
    const quote = parent.querySelector("blockquote.cm-details-quote");
    expect(quote.textContent).toBe("quoted");
  });

  it("renders thematic breaks as a rule", () => {
    const { parent } = renderBody(["---"]);
    expect(parent.querySelector("hr")).toBeTruthy();
  });

  it("passes inline options through so images render inside the body", () => {
    const { appendInlineMarkdown } = renderBody(["text"]);
    expect(appendInlineMarkdown).toHaveBeenCalledWith(
      expect.anything(),
      "text",
      expect.objectContaining({ renderImages: true }),
    );
  });
});

describe("appendDetailsBody lists", () => {
  it("renders a bullet marker for unordered items", () => {
    const { parent } = renderBody(["- item"]);
    const item = parent.querySelector(".cm-details-list-item");
    expect(item.querySelector(".cm-details-list-marker").textContent).toBe("•");
    expect(item.textContent).toContain("item");
  });

  it("keeps the number for ordered items", () => {
    const { parent } = renderBody(["2. second"]);
    expect(
      parent.querySelector(".cm-details-list-marker").textContent,
    ).toBe("2.");
  });

  it("renders task checkboxes for both states", () => {
    const { parent } = renderBody(["- [ ] todo", "- [x] done"]);
    expect(
      [...parent.querySelectorAll(".cm-details-list-marker")].map(
        (node) => node.textContent,
      ),
    ).toEqual(["☐", "☑"]);
  });

  it("indents nested items and caps the depth", () => {
    const { parent } = renderBody([
      "- top",
      "  - nested",
      "                - very deep",
    ]);
    const items = [...parent.querySelectorAll(".cm-details-list-item")];
    expect(items.map((node) => node.style.paddingInlineStart)).toEqual([
      "",
      "18px",
      "72px",
    ]);
  });
});

describe("appendDetailsBody tables", () => {
  it("renders a header row and body rows", () => {
    const { parent } = renderBody([
      "| Name | Value |",
      "| --- | --- |",
      "| a | 1 |",
      "| b | 2 |",
      "after",
    ]);
    const table = parent.querySelector("table.cm-details-table");

    expect(
      [...table.querySelectorAll("thead th")].map((cell) => cell.textContent),
    ).toEqual(["Name", "Value"]);
    expect(
      [...table.querySelectorAll("tbody tr")].map((row) =>
        [...row.children].map((cell) => cell.textContent),
      ),
    ).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });

  it("resumes normal rendering after the table ends", () => {
    const { parent } = renderBody([
      "| A |",
      "| --- |",
      "| 1 |",
      "after the table",
    ]);
    expect(parent.lastElementChild.tagName).toBe("P");
    expect(parent.lastElementChild.textContent).toBe("after the table");
  });

  it("hands cells their literal pipes", () => {
    const { parent } = renderBody([
      "| Case | Value |",
      "| --- | --- |",
      "| a | left \\| right |",
    ]);
    expect(
      [...parent.querySelectorAll("tbody td")].map((cell) => cell.textContent),
    ).toEqual(["a", "left | right"]);
  });

  it("needs a delimiter row to become a table", () => {
    const { parent } = renderBody(["| A | B |", "| a | b |"]);
    expect(parent.querySelector("table")).toBeNull();
    expect(parent.querySelectorAll("p.cm-details-body-line")).toHaveLength(2);
  });
});

describe("appendDetailsBody code blocks", () => {
  it("renders a fenced block as pre/code with the language label", () => {
    const { parent } = renderBody([
      "```javascript",
      "const a = 1;",
      "const b = 2;",
      "```",
      "after",
    ]);
    const block = parent.querySelector(".cm-details-code");

    expect(block.querySelector(".cm-details-code-language").textContent).toBe(
      "javascript",
    );
    const code = block.querySelector("pre.cm-details-code-block > code");
    expect(code.className).toBe("language-javascript");
    expect(code.textContent).toBe("const a = 1;\nconst b = 2;");
    expect(parent.lastElementChild.textContent).toBe("after");
  });

  it("omits the header for a fence without a language", () => {
    const { parent } = renderBody(["```", "plain code", "```"]);
    const block = parent.querySelector(".cm-details-code");

    expect(block.querySelector(".cm-details-code-header")).toBeNull();
    expect(block.querySelector("code").className).toBe("");
    expect(block.querySelector("code").textContent).toBe("plain code");
  });

  it("does not render fenced content as Markdown", () => {
    const { parent } = renderBody([
      "```markdown",
      "# not a heading",
      "| A | B |",
      "| --- | --- |",
      "```",
    ]);
    expect(parent.querySelector("h1")).toBeNull();
    expect(parent.querySelector("table")).toBeNull();
    expect(parent.querySelector("code").textContent).toBe(
      "# not a heading\n| A | B |\n| --- | --- |",
    );
  });

  it("treats the rest of the body as code when the fence is unclosed", () => {
    const { parent } = renderBody(["```", "line one", "line two"]);
    expect(parent.querySelector("code").textContent).toBe(
      "line one\nline two",
    );
    expect(parent.querySelectorAll("p.cm-details-body-line")).toHaveLength(0);
  });

  it("does not let a shorter fence close a longer one", () => {
    const { parent } = renderBody(["````", "```", "still code", "````"]);
    expect(parent.querySelector("code").textContent).toBe("```\nstill code");
  });

  it("reports the resolved language once highlighting finishes", async () => {
    const onCodeHighlighted = vi.fn();
    const { parent } = renderBody(["```js", "const a = 1;", "```"], {
      onCodeHighlighted,
    });

    await vi.waitFor(() => expect(onCodeHighlighted).toHaveBeenCalled());
    expect(
      parent.querySelector(".cm-details-code-language").textContent,
    ).toBeTruthy();
  });
});
