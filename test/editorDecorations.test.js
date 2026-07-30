// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CheckboxWidget,
  CodeCopyButtonWidget,
  ColorPreviewWidget,
  ListMarkerWidget,
} from "../src/rich-editor/presentation/codemirror/widgets.js";
import { createPreviewHarness } from "./helpers/previewHarness.js";

let harness;

afterEach(() => {
  harness?.destroy();
  harness = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("list marker widget", () => {
  it.each([
    [0, "•"],
    [1, "◦"],
    [2, "▪"],
    [3, "‣"],
    [4, "•"],
  ])("uses a distinct bullet for nesting level %i", (level, symbol) => {
    const dom = new ListMarkerWidget({
      marker: "-",
      ordered: false,
      level,
    }).toDOM();

    expect(dom.className).toContain("is-unordered");
    expect(dom.textContent).toBe(symbol);
  });

  it("keeps the source number for ordered lists", () => {
    const dom = new ListMarkerWidget({
      marker: "3.",
      ordered: true,
      level: 0,
    }).toDOM();

    expect(dom.className).toContain("is-ordered");
    expect(dom.textContent).toBe("3.");
  });

  it("compares by marker, kind and level", () => {
    const marker = { marker: "-", ordered: false, level: 1 };
    const widget = new ListMarkerWidget(marker);

    expect(widget.eq(new ListMarkerWidget(marker))).toBe(true);
    expect(
      widget.eq(new ListMarkerWidget({ ...marker, level: 2 })),
    ).toBe(false);
    expect(widget.ignoreEvent()).toBe(false);
  });
});

describe("code copy button widget", () => {
  it("copies through the clipboard API and confirms briefly", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const postMessage = vi.fn();

    const dom = new CodeCopyButtonWidget("const a = 1;", postMessage).toDOM();
    const button = dom.querySelector(".cm-code-copy-button");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.waitFor(() => expect(button.textContent).toBe("Copied"));

    expect(writeText).toHaveBeenCalledWith("const a = 1;");
    expect(postMessage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(900);
    expect(button.textContent).toBe("Copy");
    vi.unstubAllGlobals();
  });

  it("asks the extension host to copy when the clipboard is blocked", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    const postMessage = vi.fn();

    new CodeCopyButtonWidget("payload", postMessage)
      .toDOM()
      .querySelector(".cm-code-copy-button")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith({
        type: "copyText",
        text: "payload",
      }),
    );
    vi.unstubAllGlobals();
  });

  it("compares by the code it would copy", () => {
    const widget = new CodeCopyButtonWidget("a", vi.fn());
    expect(widget.eq(new CodeCopyButtonWidget("a", vi.fn()))).toBe(true);
    expect(widget.eq(new CodeCopyButtonWidget("b", vi.fn()))).toBe(false);
  });
});

describe("color preview widget", () => {
  it("shows the color as a labelled swatch", () => {
    const dom = new ColorPreviewWidget("#ff0000").toDOM();

    expect(dom.className).toBe("cm-inline-color-preview");
    expect(dom.style.backgroundColor).toBe("rgb(255, 0, 0)");
    expect(dom.title).toBe("#ff0000");
    expect(dom.getAttribute("aria-label")).toBe("Color sample #ff0000");
  });

  it("compares by color", () => {
    expect(new ColorPreviewWidget("#fff").eq(new ColorPreviewWidget("#fff"))).toBe(
      true,
    );
    expect(new ColorPreviewWidget("#fff").eq(new ColorPreviewWidget("#000"))).toBe(
      false,
    );
  });
});

describe("task checkbox widget", () => {
  function mountCheckbox({ checked, readOnly = false }) {
    harness = createPreviewHarness({
      doc: "- [ ] first\n- [x] second\n",
      readOnly,
    });
    const from = checked ? "- [x] second".length : 0;
    const dom = new CheckboxWidget(checked, checked ? 12 + 2 : 2).toDOM(
      harness.view,
    );
    return { dom, view: harness.view, from };
  }

  it("labels the next action rather than the state", () => {
    const { dom } = mountCheckbox({ checked: false });
    expect(dom.getAttribute("aria-label")).toBe("Mark task complete");
    expect(dom.className).not.toContain("is-checked");

    const checked = new CheckboxWidget(true, 2).toDOM(harness.view);
    expect(checked.getAttribute("aria-label")).toBe("Mark task incomplete");
    expect(checked.className).toContain("is-checked");
  });

  it("writes an x into the source when checked", () => {
    const { dom, view } = mountCheckbox({ checked: false });
    dom.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.toString().startsWith("- [x] first")).toBe(true);
  });

  it("clears the box again when unchecked", () => {
    harness = createPreviewHarness({ doc: "- [x] done\n" });
    new CheckboxWidget(true, 2)
      .toDOM(harness.view)
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(harness.view.state.doc.toString().startsWith("- [ ] done")).toBe(true);
  });

  it("does nothing in a read-only editor", () => {
    const { dom, view } = mountCheckbox({ checked: false, readOnly: true });
    dom.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.toString().startsWith("- [ ] first")).toBe(true);
  });

  it("compares by state and position", () => {
    const widget = new CheckboxWidget(true, 4);
    expect(widget.eq(new CheckboxWidget(true, 4))).toBe(true);
    expect(widget.eq(new CheckboxWidget(false, 4))).toBe(false);
    expect(widget.eq(new CheckboxWidget(true, 5))).toBe(false);
  });
});

describe("front matter preview", () => {
  const DOC = [
    "---",
    "title: Release notes",
    "tags:",
    "  - alpha",
    "  - beta",
    "draft:",
    "---",
    "",
    "# Body",
  ].join("\n");

  function mount(options = {}) {
    harness = createPreviewHarness({
      doc: DOC,
      selection: { anchor: DOC.indexOf("# Body") },
      ...options,
    });
    const widget = harness.widget("FrontmatterPreviewWidget");
    expect(widget, "front matter must be previewed").toBeTruthy();
    const dom = widget.toDOM(harness.view);
    document.body.appendChild(dom);
    return { widget, dom, view: harness.view };
  }

  it("renders the metadata as a definition list", () => {
    const { dom } = mount();

    expect(dom.getAttribute("role")).toBe("region");
    expect(dom.getAttribute("aria-label")).toBe("Document front matter");
    expect(
      [...dom.querySelectorAll(".cm-frontmatter-key")].map(
        (key) => key.textContent,
      ),
    ).toEqual(["title", "tags", "draft"]);
    expect(dom.querySelector(".cm-frontmatter-value").textContent).toBe(
      "Release notes",
    );
  });

  it("renders a list value as chips", () => {
    const { dom } = mount();
    const values = [...dom.querySelectorAll(".cm-frontmatter-value")];

    expect(
      [...values[1].querySelectorAll(".cm-frontmatter-chip")].map(
        (chip) => chip.textContent,
      ),
    ).toEqual(["alpha", "beta"]);
  });

  it("marks an empty value with a dash", () => {
    const { dom } = mount();
    const empty = [...dom.querySelectorAll(".cm-frontmatter-value")].at(-1);

    expect(empty.classList.contains("is-empty")).toBe(true);
    expect(empty.textContent).toBe("—");
  });

  it("says so when the block has no metadata", () => {
    harness = createPreviewHarness({
      doc: "---\n---\n\n# Body",
      selection: { anchor: 10 },
    });
    const dom = harness.widget("FrontmatterPreviewWidget").toDOM(harness.view);

    expect(dom.querySelector(".cm-frontmatter-empty").textContent).toBe(
      "No metadata",
    );
  });

  it("jumps to the clicked entry in the source", () => {
    const { dom, view } = mount();
    dom
      .querySelectorAll(".cm-frontmatter-key")[1]
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.lineAt(view.state.selection.main.anchor).text).toBe(
      "tags:",
    );
  });

  it("falls back to the first entry when the card itself is clicked", () => {
    const { dom, view } = mount();
    dom.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.lineAt(view.state.selection.main.anchor).text).toBe(
      "title: Release notes",
    );
  });

  it("drops the edit affordances in a read-only editor", () => {
    const { dom, view } = mount({ readOnly: true });
    dom.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(dom.classList.contains("is-read-only")).toBe(true);
    expect(dom.querySelector(".cm-frontmatter-edit-hint")).toBeNull();
    expect(view.state.selection.main.anchor).toBe(DOC.indexOf("# Body"));
  });

  it("estimates a height from the entry count", () => {
    const { widget } = mount();
    expect(widget.estimatedHeight).toBe(3 * 28 + 30);
  });

  it("stays rendered when the caret is merely inside the block", () => {
    // Front matter, like Mermaid, only opens its source on an explicit click.
    harness = createPreviewHarness({
      doc: DOC,
      selection: { anchor: DOC.indexOf("title:") },
    });
    expect(harness.widget("FrontmatterPreviewWidget")).toBeTruthy();
  });
});

describe("details preview", () => {
  const DOC = [
    "intro",
    "",
    "<details open>",
    "<summary>Release notes</summary>",
    "",
    "- shipped **tables**",
    "",
    "</details>",
    "",
  ].join("\n");

  function mount(doc = DOC, options = {}) {
    harness = createPreviewHarness({ doc, ...options });
    const widget = harness.widget("DetailsPreviewWidget");
    expect(widget, "details must be previewed").toBeTruthy();
    const dom = widget.toDOM(harness.view);
    document.body.appendChild(dom);
    return { widget, dom, view: harness.view };
  }

  it("renders an expanded disclosure with its body", () => {
    const { dom } = mount();

    expect(dom.querySelector(".cm-details-summary").getAttribute("aria-expanded"))
      .toBe("true");
    expect(dom.querySelector(".cm-details-disclosure").textContent).toBe("⌄");
    expect(dom.querySelector(".cm-details-summary").textContent).toContain(
      "Release notes",
    );
    expect(
      dom.querySelector(".cm-details-body strong").textContent,
    ).toBe("tables");
  });

  it("renders a collapsed disclosure without a body", () => {
    const { dom } = mount(DOC.replace("<details open>", "<details>"));

    expect(dom.querySelector(".cm-details-summary").getAttribute("aria-expanded"))
      .toBe("false");
    expect(dom.querySelector(".cm-details-disclosure").textContent).toBe("›");
    expect(dom.querySelector(".cm-details-body")).toBeNull();
  });

  it("toggles open state through the editor state", () => {
    const { dom } = mount(DOC.replace("<details open>", "<details>"));
    dom
      .querySelector(".cm-details-summary")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(harness.widget("DetailsPreviewWidget").open).toBe(true);
  });

  it("says so when an open block has no content", () => {
    const { dom } = mount(
      ["intro", "", "<details open>", "<summary>Empty</summary>", "</details>", ""].join(
        "\n",
      ),
    );
    expect(dom.querySelector(".cm-details-body-line").textContent).toBe(
      "No content",
    );
  });

  it("jumps to the clicked body line in the source", () => {
    const { dom, view } = mount();
    dom
      .querySelector(".cm-details-body [data-source-from]")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(harness.widget("DetailsPreviewWidget")).toBeNull();
    expect(view.state.selection.main.anchor).toBeGreaterThan(0);
  });

  it("opens the source on a double click", () => {
    const { dom, widget, view } = mount();
    dom.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(view.state.selection.main.anchor).toBe(widget.detailsBlock.from);
  });

  it("does not open the source in a read-only editor", () => {
    const { dom, view } = mount(DOC, { readOnly: true });
    dom.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(view.state.selection.main.anchor).toBe(0);
  });

  it("estimates a taller box when open", () => {
    const { widget } = mount();
    const collapsed = mount(DOC.replace("<details open>", "<details>")).widget;

    expect(collapsed.estimatedHeight).toBe(44);
    expect(widget.estimatedHeight).toBeGreaterThan(collapsed.estimatedHeight);
  });

  it("compares by range, signature and open state", () => {
    const { widget } = mount();
    expect(widget.eq(widget)).toBe(true);
    expect(
      widget.eq({ detailsBlock: widget.detailsBlock, open: !widget.open }),
    ).toBe(false);
  });
});

describe("inline and line decorations", () => {
  // These come from ViewPlugins, so they are read through the harness with the
  // real plugin instances attached to the view.
  function classesFor(doc, options = {}) {
    harness = createPreviewHarness({ doc, ...options });
    return harness.lineClasses();
  }

  it("marks the syntax markers of a heading so they can be dimmed", () => {
    const classes = classesFor("# Heading\n\ntext\n");
    expect(classes).toContain("cm-markdown-marker");
    expect(classes).toContain("cm-heading-line cm-heading-1");
  });

  it("adds a heading class per level", () => {
    expect(classesFor("## Second level\n\nbody")).toContain(
      "cm-heading-line cm-heading-2",
    );
  });

  it("marks blockquotes, thematic breaks and inline code", () => {
    expect(classesFor("> quoted\n\nbody")).toContain("cm-quote-line");
    expect(classesFor("---\n\nbody")).toContain("cm-thematic-break-line");
    expect(classesFor("text with `code` here\n")).toContain("cm-inline-code");
  });

  it("marks the first, middle and last line of a fenced block", () => {
    const classes = classesFor("text\n\n```js\nconst a = 1;\n```\n");
    expect(classes).toContain("cm-codeblock-line cm-codeblock-first");
    expect(classes).toContain("cm-codeblock-line");
    expect(classes).toContain("cm-codeblock-line cm-codeblock-last");
  });

  it("marks list lines with their depth and kind", () => {
    expect(classesFor("- first\n  - nested\n\nbody")).toContain(
      "cm-list-line cm-list-depth-1 cm-list-unordered",
    );
    expect(classesFor("1. first\n\nbody")).toContain(
      "cm-list-line cm-list-depth-0 cm-list-ordered",
    );
  });

  it("replaces list markers with a bullet widget", () => {
    harness = createPreviewHarness({
      doc: "- first\n- second\n\nbody",
      selection: { anchor: 20 },
    });
    expect(harness.widgetNames()).toContain("ListMarkerWidget");
  });

  it("replaces task markers with a checkbox widget", () => {
    harness = createPreviewHarness({
      doc: "- [ ] todo\n- [x] done\n\nbody",
      selection: { anchor: 24 },
    });
    expect(harness.widgetNames()).toContain("CheckboxWidget");
  });

  it("adds a copy button to a fenced code block", () => {
    harness = createPreviewHarness({
      doc: "text\n\n```js\nconst a = 1;\n```\n",
    });
    expect(harness.widgetNames()).toContain("CodeCopyButtonWidget");
  });

  it("previews a color written in inline code", () => {
    harness = createPreviewHarness({
      doc: "brand color is `#ff8800` here\n",
      selection: { anchor: 0 },
    });
    expect(harness.widgetNames()).toContain("ColorPreviewWidget");
  });

  it("does not preview a plain word in inline code as a color", () => {
    harness = createPreviewHarness({ doc: "call `render()` first\n" });
    expect(harness.widgetNames()).not.toContain("ColorPreviewWidget");
  });

  it("previews images outside the focused line", () => {
    harness = createPreviewHarness({
      doc: "![alt](img.png)\n\nbody",
      selection: { anchor: 18 },
    });
    expect(harness.widgetNames()).toContain("ImagePreviewWidget");
  });

  it("never reports a decoration error for ordinary Markdown", () => {
    harness = createPreviewHarness({
      doc: [
        "---",
        "title: t",
        "---",
        "",
        "# Heading",
        "",
        "- [ ] task",
        "- item",
        "",
        "> quote",
        "",
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "",
        "```js",
        "const a = 1;",
        "```",
        "",
        "<details><summary>S</summary>body</details>",
        "",
        "```mermaid",
        "graph TD;",
        "```",
        "",
        "```gherkin",
        "Feature: F",
        "```",
        "",
      ].join("\n"),
    });

    expect(harness.calls.errors).toEqual([]);
  });
});
