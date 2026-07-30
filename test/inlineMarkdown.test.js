// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInlineMarkdownSupport } from "../src/rich-editor/presentation/markdown/inlineMarkdown.js";

function createSupport({ resolveImageSource } = {}) {
  const postMessage = vi.fn();
  const requestEditorMeasure = vi.fn();
  const support = createInlineMarkdownSupport({
    postMessage,
    requestEditorMeasure,
    resolveImageSource,
  });
  return { ...support, postMessage, requestEditorMeasure };
}

function render(text, options) {
  const { appendInlineMarkdown, postMessage } = createSupport({
    resolveImageSource: (src) => Promise.resolve(`resolved:${src}`),
  });
  const parent = document.createElement("div");
  appendInlineMarkdown(parent, text, options);
  return { parent, postMessage };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("appendInlineMarkdown", () => {
  it("renders emphasis, code and strikethrough as elements", () => {
    const { parent } = render("**bold** `code` *italic* ~~gone~~");
    expect(parent.innerHTML).toBe(
      "<strong>bold</strong> <code>code</code> <em>italic</em> <s>gone</s>",
    );
  });

  it("keeps plain text between constructs", () => {
    const { parent } = render("before **bold** after");
    expect(parent.textContent).toBe("before bold after");
    expect(parent.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
  });

  it("renders underscore emphasis at word boundaries", () => {
    expect(render("say _italic_ here").parent.innerHTML).toBe(
      "say <em>italic</em> here",
    );
    expect(render("say __bold__ here").parent.innerHTML).toBe(
      "say <strong>bold</strong> here",
    );
  });

  // Underscores inside identifiers must survive: table and details previews
  // would otherwise silently rewrite snake_case and CONFIG__VALUE.
  it.each([
    "snake_case stays intact",
    "CONFIG__VALUE stays intact",
    "a_b_c stays intact",
    "run__test__now stays intact",
  ])("leaves intra-word underscores literal in %j", (text) => {
    const { parent } = render(text);
    expect(parent.querySelector("em")).toBeNull();
    expect(parent.querySelector("strong")).toBeNull();
    expect(parent.textContent).toBe(text);
  });

  it("does not treat HTML in the source as markup", () => {
    const { parent } = render("<b>not bold</b>");
    expect(parent.querySelector("b")).toBeNull();
    expect(parent.textContent).toBe("<b>not bold</b>");
  });

  it("renders links inert and opens them through the host", () => {
    const { parent, postMessage } = render("[docs](https://example.com/a)");
    const link = parent.querySelector("a");

    expect(link.textContent).toBe("docs");
    expect(link.getAttribute("href")).toBe("#");
    expect(link.title).toBe("https://example.com/a");

    link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(postMessage).toHaveBeenCalledWith({
      type: "openLink",
      href: "https://example.com/a",
    });
  });

  it("labels a bare URL with the URL itself", () => {
    const link = render("see https://example.com/x").parent.querySelector("a");
    expect(link.textContent).toBe("https://example.com/x");
    expect(link.title).toBe("https://example.com/x");
  });

  it("supports angle-bracketed and titled link targets", () => {
    expect(
      render('[a](<my page.md> "Title")').parent.querySelector("a").title,
    ).toBe("my page.md");
  });

  it("keeps image syntax as text unless images are requested", () => {
    const { parent } = render("![alt](img.png)");
    expect(parent.querySelector("img")).toBeNull();
    expect(parent.textContent).toBe("![alt](img.png)");
  });

  it("renders an image when requested", async () => {
    const { parent } = render("![alt](img.png)", { renderImages: true });
    const wrapper = parent.querySelector(".cm-inline-markdown-image");
    const image = wrapper.querySelector("img");

    expect(wrapper.title).toBe("img.png");
    expect(image.alt).toBe("alt");
    await vi.waitFor(() =>
      expect(image.getAttribute("src")).toBe("resolved:img.png"),
    );
  });

  it("uses the source as the alt text when the image has none", async () => {
    const { parent } = render("![](img.png)", { renderImages: true });
    expect(parent.querySelector("img").alt).toBe("img.png");
  });

  it("reports image readiness so the editor can re-measure", async () => {
    const onImageReady = vi.fn();
    const { appendInlineMarkdown } = createSupport({
      resolveImageSource: (src) => Promise.resolve(`resolved:${src}`),
    });
    const parent = document.createElement("div");
    appendInlineMarkdown(parent, "![alt](img.png)", {
      renderImages: true,
      onImageReady,
    });

    await vi.waitFor(() => expect(onImageReady).toHaveBeenCalled());
  });

  it("shows a fallback label when the image cannot be resolved", async () => {
    const { appendInlineMarkdown } = createSupport({
      resolveImageSource: () => Promise.reject(new Error("missing")),
    });
    const parent = document.createElement("div");
    appendInlineMarkdown(parent, "![alt](missing.png)", { renderImages: true });

    await vi.waitFor(() => {
      const error = parent.querySelector(".cm-inline-markdown-image-error");
      expect(error.hidden).toBe(false);
      expect(error.textContent).toBe("alt");
    });
    expect(parent.querySelector("img")).toBeNull();
  });

  it("opens the image source when the image is clicked", async () => {
    const { appendInlineMarkdown, postMessage } = createSupport({
      resolveImageSource: (src) => Promise.resolve(`resolved:${src}`),
    });
    const parent = document.createElement("div");
    appendInlineMarkdown(parent, "![alt](img.png)", { renderImages: true });

    parent
      .querySelector("img")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(postMessage).toHaveBeenCalledWith({
      type: "openLink",
      href: "img.png",
    });
  });
});

describe("image resolution through the host", () => {
  it("resolves absolute sources without asking the host", async () => {
    const { appendInlineMarkdown, postMessage } = createSupport();
    const parent = document.createElement("div");
    appendInlineMarkdown(parent, "![alt](https://example.com/a.png)", {
      renderImages: true,
    });

    await vi.waitFor(() =>
      expect(parent.querySelector("img").getAttribute("src")).toBe(
        "https://example.com/a.png",
      ),
    );
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("asks the host for a workspace-relative source and applies the answer", async () => {
    const { appendInlineMarkdown, handleResolvedImage, postMessage } =
      createSupport();
    const parent = document.createElement("div");
    appendInlineMarkdown(parent, "![alt](docs/img.png)", {
      renderImages: true,
    });

    const request = postMessage.mock.calls[0][0];
    expect(request).toMatchObject({
      type: "resolveImage",
      src: "docs/img.png",
    });

    expect(
      handleResolvedImage({
        requestId: request.requestId,
        uri: "vscode-resource://docs/img.png",
      }),
    ).toBe(true);
    await vi.waitFor(() =>
      expect(parent.querySelector("img").getAttribute("src")).toBe(
        "vscode-resource://docs/img.png",
      ),
    );
  });

  it("falls back to the error label when the host cannot resolve the image", async () => {
    const { appendInlineMarkdown, handleResolvedImage, postMessage } =
      createSupport();
    const parent = document.createElement("div");
    appendInlineMarkdown(parent, "![alt](gone.png)", { renderImages: true });

    handleResolvedImage({
      requestId: postMessage.mock.calls[0][0].requestId,
      uri: "",
    });
    await vi.waitFor(() =>
      expect(
        parent.querySelector(".cm-inline-markdown-image-error").hidden,
      ).toBe(false),
    );
  });

  it("ignores a response for an unknown or already handled request", () => {
    const { appendInlineMarkdown, handleResolvedImage, postMessage } =
      createSupport();
    const parent = document.createElement("div");
    appendInlineMarkdown(parent, "![alt](img.png)", { renderImages: true });
    const { requestId } = postMessage.mock.calls[0][0];

    expect(handleResolvedImage({ requestId: "unknown", uri: "x" })).toBe(false);
    expect(handleResolvedImage({ requestId, uri: "x" })).toBe(true);
    expect(handleResolvedImage({ requestId, uri: "x" })).toBe(false);
  });

  it("gives up on a host that never answers", async () => {
    vi.useFakeTimers();
    const { appendInlineMarkdown } = createSupport();
    const parent = document.createElement("div");
    appendInlineMarkdown(parent, "![alt](slow.png)", { renderImages: true });

    await vi.advanceTimersByTimeAsync(5000);
    expect(parent.querySelector(".cm-inline-markdown-image-error").hidden).toBe(
      false,
    );
  });
});

describe("findMarkdownImages", () => {
  const { findMarkdownImages } = createSupport();

  it("reports the span, alt text and source of every image", () => {
    const text = 'a ![one](a.png) b ![two](<b c.png> "T") d';
    expect(findMarkdownImages(text)).toEqual([
      { from: 2, to: 15, alt: "one", src: "a.png" },
      { from: 18, to: 39, alt: "two", src: "b c.png" },
    ]);
    expect(text.slice(2, 15)).toBe("![one](a.png)");
  });

  it("ignores plain links but still scans inside inline code", () => {
    // The scan is a flat regex, so an image inside inline code is reported too.
    expect(findMarkdownImages("[link](a.md) and `![x](y)`")).toEqual([
      { from: 18, to: 25, alt: "x", src: "y" },
    ]);
  });

  it("returns nothing for text without images", () => {
    expect(findMarkdownImages("plain text")).toEqual([]);
    expect(findMarkdownImages("")).toEqual([]);
  });

  it("reports an empty alt text as an empty string", () => {
    expect(findMarkdownImages("![](a.png)")[0].alt).toBe("");
  });
});

describe("isRangeInsideRanges", () => {
  const { isRangeInsideRanges } = createSupport();

  it("requires the range to be fully contained", () => {
    const ranges = [{ from: 10, to: 20 }];
    expect(isRangeInsideRanges(12, 18, ranges)).toBe(true);
    expect(isRangeInsideRanges(10, 20, ranges)).toBe(true);
    expect(isRangeInsideRanges(9, 20, ranges)).toBe(false);
    expect(isRangeInsideRanges(10, 21, ranges)).toBe(false);
    expect(isRangeInsideRanges(12, 18, [])).toBe(false);
  });
});

describe("ImagePreviewWidget", () => {
  function createView({ readOnly = false } = {}) {
    return {
      state: { readOnly, doc: { length: 100 } },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };
  }

  it("compares equal only for the same image at the same position", () => {
    const { ImagePreviewWidget } = createSupport();
    const widget = new ImagePreviewWidget("a.png", "Alt", 12);

    expect(widget.eq(new ImagePreviewWidget("a.png", "Alt", 12))).toBe(true);
    expect(widget.eq(new ImagePreviewWidget("b.png", "Alt", 12))).toBe(false);
    expect(widget.eq(new ImagePreviewWidget("a.png", "Other", 12))).toBe(false);
    expect(widget.eq(new ImagePreviewWidget("a.png", "Alt", 13))).toBe(false);
  });

  it("reserves a nominal height before the image loads", () => {
    const { ImagePreviewWidget } = createSupport();
    expect(new ImagePreviewWidget("a.png", "", 0).estimatedHeight).toBe(240);
  });

  it("handles its own events instead of letting CodeMirror do it", () => {
    const { ImagePreviewWidget } = createSupport();
    expect(new ImagePreviewWidget("a.png", "", 0).ignoreEvent()).toBe(false);
  });

  it("builds the preview DOM with a caption and re-measures on load", async () => {
    const { ImagePreviewWidget, requestEditorMeasure } = createSupport({
      resolveImageSource: (src) => Promise.resolve(`resolved:${src}`),
    });
    const view = createView();
    const dom = new ImagePreviewWidget("a.png", "Caption text", 12).toDOM(view);

    expect(dom.className).toBe("cm-image-preview");
    expect(dom.title).toBe("a.png");
    expect(dom.querySelector("img").alt).toBe("Caption text");
    expect(dom.querySelector(".cm-image-preview-caption").textContent).toBe(
      "Caption text",
    );
    await vi.waitFor(() => expect(requestEditorMeasure).toHaveBeenCalledWith(view));
  });

  it("omits the caption when the image has no alt text", () => {
    const { ImagePreviewWidget } = createSupport({
      resolveImageSource: (src) => Promise.resolve(src),
    });
    const dom = new ImagePreviewWidget("a.png", "", 12).toDOM(createView());
    expect(dom.querySelector(".cm-image-preview-caption")).toBeNull();
  });

  it("shows an error label naming the missing file", async () => {
    const { ImagePreviewWidget } = createSupport({
      resolveImageSource: () => Promise.reject(new Error("missing")),
    });
    const dom = new ImagePreviewWidget("gone.png", "Alt", 12).toDOM(
      createView(),
    );

    await vi.waitFor(() => {
      const error = dom.querySelector(".cm-image-preview-error");
      expect(error.hidden).toBe(false);
      expect(error.textContent).toBe("Image not found: gone.png");
    });
  });

  it("moves the caret to the image source when clicked", () => {
    const { ImagePreviewWidget } = createSupport({
      resolveImageSource: (src) => Promise.resolve(src),
    });
    const view = createView();
    const dom = new ImagePreviewWidget("a.png", "Alt", 12).toDOM(view);

    dom.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(view.dispatch).toHaveBeenCalledWith({
      selection: { anchor: 12 },
      scrollIntoView: true,
    });
    expect(view.focus).toHaveBeenCalled();
  });

  it("clamps the caret to the end of a shorter document", () => {
    const { ImagePreviewWidget } = createSupport({
      resolveImageSource: (src) => Promise.resolve(src),
    });
    const view = createView();
    view.state.doc.length = 5;
    new ImagePreviewWidget("a.png", "Alt", 12)
      .toDOM(view)
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.dispatch).toHaveBeenCalledWith({
      selection: { anchor: 5 },
      scrollIntoView: true,
    });
  });

  it("does not move the caret in a read-only editor", () => {
    const { ImagePreviewWidget } = createSupport({
      resolveImageSource: (src) => Promise.resolve(src),
    });
    const view = createView({ readOnly: true });
    new ImagePreviewWidget("a.png", "Alt", 12)
      .toDOM(view)
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.dispatch).not.toHaveBeenCalled();
    expect(view.focus).not.toHaveBeenCalled();
  });
});
