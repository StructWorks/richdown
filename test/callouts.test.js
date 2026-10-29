// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findCallouts, parseCalloutMarker } from "../src/markdown/callouts.js";
import { createMarkdownRenderer } from "../src/rich-diff/presentation/markdownRenderer.js";
import { createPreviewHarness } from "./helpers/previewHarness.js";

const lines = (...items) => items.join("\n");

describe("parseCalloutMarker", () => {
  it.each([
    ["[!NOTE]", "note", "blue", "Note"],
    ["[!TIP]", "tip", "green", "Tip"],
    ["[!IMPORTANT]", "important", "purple", "Important"],
    ["[!WARNING]", "warning", "yellow", "Warning"],
    ["[!CAUTION]", "caution", "red", "Caution"],
  ])("reads the GitHub alert %s", (marker, kind, color, title) => {
    expect(parseCalloutMarker(marker)).toMatchObject({
      kind,
      color,
      title,
      github: true,
      foldable: false,
    });
  });

  it("reads Obsidian types case-insensitively, with aliases and titles", () => {
    expect(parseCalloutMarker("[!Warning] 気をつけて")).toMatchObject({
      kind: "warning",
      title: "気をつけて",
      github: false,
    });
    expect(parseCalloutMarker("[!faq]- 折りたたみ")).toMatchObject({
      type: "faq",
      kind: "question",
      foldable: true,
      collapsed: true,
    });
    expect(parseCalloutMarker("[!tldr]+")).toMatchObject({
      kind: "abstract",
      title: "Tldr",
      foldable: true,
      collapsed: false,
    });
  });

  it("draws unknown types like note", () => {
    expect(parseCalloutMarker("[!custom]")).toMatchObject({
      type: "custom",
      kind: "note",
      color: "blue",
      title: "Custom",
      github: false,
    });
  });

  it("ignores text that is not a marker", () => {
    expect(parseCalloutMarker("[NOTE]")).toBeNull();
    expect(parseCalloutMarker("Note: [!NOTE]")).toBeNull();
    expect(parseCalloutMarker("[! NOTE]")).toBeNull();
  });
});

describe("findCallouts", () => {
  it("finds a callout and its body, skipping plain quotes and code", () => {
    const source = [
      "> plain quote",
      "> [!NOTE] not a marker here",
      "",
      "> [!TIP]",
      "> Body",
      "> > [!bug] Nested",
      "> > inner",
      "after",
      "```",
      "> [!NOTE]",
      "```",
    ];
    const callouts = findCallouts(source);
    expect(callouts).toHaveLength(1);
    expect(callouts[0]).toMatchObject({ start: 3, end: 6 });
    expect(callouts[0].body.map((line) => line.text)).toEqual([
      "Body",
      "> [!bug] Nested",
      "> inner",
    ]);
    const nested = findCallouts(callouts[0].body.map((line) => line.text));
    expect(nested[0]).toMatchObject({ start: 1, end: 2 });
    expect(nested[0].marker).toMatchObject({ kind: "bug", title: "Nested" });
  });
});

describe("callout preview in the rich editor", () => {
  let harness;

  afterEach(() => {
    harness?.destroy();
    harness = null;
  });

  const DOC = lines(
    "intro",
    "",
    "> [!WARNING]",
    "> Mind the **gap**.",
    "",
    "> [!faq]- 質問",
    "> 答え",
    "> > [!tip] Nested",
    "> > more",
    "",
  );

  function mountAll(options = {}) {
    harness = createPreviewHarness({ doc: DOC, ...options });
    return harness
      .entries()
      .filter((entry) => entry.name === "CalloutPreviewWidget")
      .map((entry) => {
        const dom = entry.widget.toDOM(harness.view);
        document.body.appendChild(dom);
        return { ...entry, dom };
      });
  }

  it("draws a GitHub alert with GitHub's icon, color class, and title", () => {
    const [warning] = mountAll();
    expect(warning.from).toBe(DOC.indexOf("> [!WARNING]"));
    expect(warning.dom.classList).toContain("cm-callout-github");
    expect(warning.dom.classList).toContain("cm-callout-yellow");
    expect(warning.dom.querySelector(".cm-callout-title").textContent).toBe("Warning");
    expect(warning.dom.querySelector(".cm-callout-icon")).toBeTruthy();
    expect(warning.dom.querySelector(".cm-callout-body strong").textContent).toBe("gap");
  });

  it("draws an Obsidian callout folded, and folds without editing the document", () => {
    const [, faq] = mountAll();
    expect(faq.dom.classList).toContain("cm-callout-obsidian");
    expect(faq.dom.classList).toContain("is-collapsed");
    const title = faq.dom.querySelector(".cm-callout-title");
    expect(title.getAttribute("aria-expanded")).toBe("false");

    title.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(faq.dom.classList).not.toContain("is-collapsed");
    expect(harness.text()).toBe(DOC);

    // The fold state survives a redraw of the widget.
    const redrawn = faq.widget.toDOM(harness.view);
    expect(redrawn.classList).not.toContain("is-collapsed");
  });

  it("draws nested callouts inside the body", () => {
    const [, faq] = mountAll();
    const nested = faq.dom.querySelector(".cm-callout-body .cm-callout");
    expect(nested.classList).toContain("cm-callout-green");
    expect(nested.querySelector(".cm-callout-title").textContent).toBe("Nested");
    expect(nested.querySelector(".cm-callout-body").textContent).toContain("more");
  });

  it("shows the Markdown of the callout the caret is in, in the callout's color", () => {
    harness = createPreviewHarness({ doc: DOC, selection: { anchor: DOC.indexOf("Mind") } });
    const callouts = harness.entries().filter((entry) => entry.name === "CalloutPreviewWidget");
    expect(callouts).toHaveLength(1);
    expect(harness.lineClasses().some((name) => name.includes("cm-callout-title-line"))).toBe(true);
    expect(harness.lineClasses().some((name) => name.includes("cm-callout-yellow"))).toBe(true);
  });

  it("puts the caret on the clicked body line", () => {
    const [warning] = mountAll();
    warning.dom
      .querySelector(".cm-callout-body [data-source-from]")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(harness.view.state.selection.main.head).toBe(DOC.indexOf("Mind"));
  });

  it("always draws callouts in read-only views", () => {
    harness = createPreviewHarness({ doc: DOC, readOnly: true, selection: { anchor: DOC.indexOf("Mind") } });
    expect(harness.widgetNames().filter((name) => name === "CalloutPreviewWidget")).toHaveLength(2);
  });
});

describe("callouts in the Richdown diff", () => {
  let renderAll;

  beforeEach(() => {
    const { analyzeMarkdownLines, renderMarkdownLine } = createMarkdownRenderer({
      hljs: { getLanguage: () => undefined, highlight: () => ({ value: "" }) },
      registerCopyPayload: () => "copy-1",
    });
    renderAll = (source) => {
      const meta = analyzeMarkdownLines(source);
      return source.map((line, index) => renderMarkdownLine(line, meta.get(index + 1)));
    };
  });

  it("draws the title row and body rows of a callout", () => {
    const [title, body] = renderAll(["> [!NOTE]", "> Useful **information**."]);
    expect(title).toContain('class="rdiff-callout rdiff-callout-blue rdiff-callout-github"');
    expect(title).toContain("rdiff-callout-icon");
    expect(title).toContain("<span>Note</span>");
    expect(body).toContain("rdiff-callout-blue");
    expect(body).toContain("<strong>information</strong>");
  });

  it("nests the boxes of nested callouts", () => {
    const rows = renderAll(["> [!faq]- Q", "> > [!bug] B", "> > inner"]);
    expect(rows[0]).toContain("rdiff-callout-obsidian");
    expect(rows[0]).toContain("rdiff-callout-fold");
    expect(rows[1].match(/class="rdiff-callout /g)).toHaveLength(2);
    expect(rows[1]).toContain("rdiff-callout-red");
    expect(rows[2]).toContain("inner");
    expect(rows[2]).not.toContain("&gt;");
  });

  it("leaves plain quotes as quotes", () => {
    expect(renderAll(["> just a quote"])[0]).toContain("rdiff-quote");
  });
});
