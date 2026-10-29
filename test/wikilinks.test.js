// @vitest-environment jsdom
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findWikilinks, isImageTarget } from "../src/markdown/wikilinks.js";
import { createMarkdownRenderer } from "../src/rich-diff/presentation/markdownRenderer.js";
import { createMarkdownCompletion } from "../src/rich-editor/presentation/codemirror/completions.js";
import { findLinkAtClick } from "../src/rich-editor/presentation/codemirror/links.js";
import { createInlineMarkdownSupport } from "../src/rich-editor/presentation/markdown/inlineMarkdown.js";
import { createWikilinkResolver } from "../src/rich-editor/presentation/markdown/wikilinkResolver.js";
import { createPreviewHarness } from "./helpers/previewHarness.js";

const require = createRequire(import.meta.url);
const {
  resolveWikilinkTarget,
  splitWikilinkHref,
  wikilinkCompletionItems,
} = require("../src/host/wikilinks.js");
const { createExportImageMap } = require("../src/export/markdownExport.js");

const views = [];
afterEach(() => {
  for (const view of views.splice(0)) {
    view.destroy();
  }
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("findWikilinks", () => {
  it("reads names, aliases, headings, and same-note headings", () => {
    const text = "[[ノート]] [[ノート|別名]] [[ノート#見出し]] [[#見出し]]";
    expect(
      findWikilinks(text).map(({ target, heading, alias, label, embed }) => ({
        target,
        heading,
        alias,
        label,
        embed,
      })),
    ).toEqual([
      { target: "ノート", heading: "", alias: "", label: "ノート", embed: false },
      { target: "ノート", heading: "", alias: "別名", label: "別名", embed: false },
      { target: "ノート", heading: "見出し", alias: "", label: "ノート#見出し", embed: false },
      { target: "", heading: "見出し", alias: "", label: "見出し", embed: false },
    ]);
  });

  it("gives the columns of the label, so the syntax around it can be hidden", () => {
    const text = "see [[note|alias]] now";
    const [link] = findWikilinks(text);
    expect(text.slice(link.from, link.to)).toBe("[[note|alias]]");
    expect(text.slice(link.labelFrom, link.labelTo)).toBe("alias");
  });

  it("reads embeds with a width", () => {
    const [plain, sized] = findWikilinks("![[画像.png]] ![[画像.png|300]]");
    expect(plain).toMatchObject({ embed: true, target: "画像.png", width: null });
    expect(sized).toMatchObject({ embed: true, target: "画像.png", width: 300, alias: "" });
    expect(isImageTarget("画像.png")).toBe(true);
    expect(isImageTarget("ノート")).toBe(false);
  });

  it("reads the escaped alias pipe of a table cell", () => {
    expect(findWikilinks("| [[ノート\\|別名]] |")[0]).toMatchObject({ target: "ノート", label: "別名" });
  });

  it("skips empty links", () => {
    expect(findWikilinks("[[]] [[ | x]]")).toEqual([]);
  });
});

describe("resolving wikilink names in the host", () => {
  const files = [
    "/vault/ノート.md",
    "/vault/daily/2026-10-29.md",
    "/vault/projects/a/README.md",
    "/vault/projects/b/README.md",
    "/vault/attachments/画像.png",
  ];

  it("finds a note by name without .md, ignoring letter case", () => {
    expect(resolveWikilinkTarget("ノート", "/vault/daily/2026-10-29.md", files)).toBe("/vault/ノート.md");
    expect(resolveWikilinkTarget("readme", "/vault/projects/b/x.md", files)).toBe(
      "/vault/projects/b/README.md",
    );
    expect(resolveWikilinkTarget("画像.png", "/vault/ノート.md", files)).toBe("/vault/attachments/画像.png");
  });

  it("prefers the nearest file when several share the name, or follows a path", () => {
    expect(resolveWikilinkTarget("README", "/vault/projects/a/notes/x.md", files)).toBe(
      "/vault/projects/a/README.md",
    );
    expect(resolveWikilinkTarget("b/README", "/vault/projects/a/x.md", files)).toBe(
      "/vault/projects/b/README.md",
    );
  });

  it("returns null for unknown names", () => {
    expect(resolveWikilinkTarget("missing", "/vault/ノート.md", files)).toBeNull();
    expect(resolveWikilinkTarget("", "/vault/ノート.md", files)).toBeNull();
  });

  it("splits a heading off the name", () => {
    expect(splitWikilinkHref("ノート#見出し")).toEqual({ target: "ノート", heading: "見出し" });
    expect(splitWikilinkHref("#見出し")).toEqual({ target: "", heading: "見出し" });
  });

  it("offers the shortest unique names for completion, notes first", () => {
    const items = wikilinkCompletionItems(files, "/vault/ノート.md", "/vault");
    expect(items.map((item) => item.label)).toEqual([
      "2026-10-29",
      "projects/a/README",
      "projects/b/README",
      "画像.png",
    ]);
    expect(items[0].detail).toBe("daily/2026-10-29.md");
  });
});

describe("wikilinks in the rich editor", () => {
  let harness;
  afterEach(() => {
    harness?.destroy();
    harness = null;
  });

  const DOC = ["intro", "", "See [[ノート|別名]] and ![[画像.png|300]].", "", "`[[code]]`", ""].join("\n");

  it("shows the label as a link and hides the brackets", () => {
    harness = createPreviewHarness({ doc: DOC, selection: { anchor: 0 } });
    const marks = harness.entries().filter((entry) => entry.className);
    const textOf = (entry) => harness.text().slice(entry.from, entry.to);
    expect(marks.some((entry) => entry.className.includes("cm-wikilink") && textOf(entry) === "別名")).toBe(true);
    const hidden = marks.filter((entry) => entry.className === "cm-markdown-marker").map(textOf);
    expect(hidden).toContain("[[ノート|");
    expect(hidden).toContain("]]");
    // Inline code keeps its text.
    expect(marks.some((entry) => entry.className.includes("cm-wikilink") && textOf(entry) === "code")).toBe(false);
  });

  it("draws image embeds at their width, resolved by name", () => {
    harness = createPreviewHarness({ doc: DOC, selection: { anchor: 0 } });
    const image = harness.widget("ImagePreviewWidget");
    expect(image).toMatchObject({ src: "画像.png", wikilink: true, width: 300 });
    const dom = image.toDOM(harness.view);
    expect(dom.querySelector("img").style.width).toBe("300px");
  });

  it("opens a wikilink by name from a click on its label", () => {
    const doc = "see [[ノート#見出し]] here";
    const position = doc.indexOf("ノート");
    const view = new EditorView({ state: EditorState.create({ doc }) });
    views.push(view);
    view.posAtCoords = () => position;
    view.coordsAtPos = (pos) => ({ left: pos, right: pos + 1, top: 0, bottom: 10 });
    expect(
      findLinkAtClick(view, { clientX: position, clientY: 5, target: document.createElement("span") }),
    ).toEqual({ href: "ノート#見出し", position, wikilink: true });
  });
});

describe("wikilink resolver", () => {
  it("batches names into one request and reports answers", async () => {
    const postMessage = vi.fn();
    const onChange = vi.fn();
    const resolver = createWikilinkResolver({ postMessage, onChange });
    expect(resolver.status("a")).toBeUndefined();
    expect(resolver.status("b")).toBeUndefined();
    expect(resolver.status("")).toBe(true);
    await Promise.resolve();
    expect(postMessage).toHaveBeenCalledTimes(1);
    const request = postMessage.mock.calls[0][0];
    expect(request).toMatchObject({ type: "resolveWikilinks", targets: ["a", "b"] });

    resolver.handleResolved({ requestId: request.requestId, results: { a: true, b: false } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(resolver.status("a")).toBe(true);
    expect(resolver.status("b")).toBe(false);

    resolver.invalidate();
    expect(resolver.status("a")).toBeUndefined();
  });

  it("marks unresolved links in inline previews", () => {
    const statuses = { ある: true, ない: false };
    const inline = createInlineMarkdownSupport({
      postMessage: vi.fn(),
      requestEditorMeasure: vi.fn(),
      getWikilinkStatus: (target) => statuses[target],
    });
    const parent = document.createElement("div");
    inline.appendInlineMarkdown(parent, "[[ある]] [[ない|別名]] [[不明]]");
    const links = [...parent.querySelectorAll("a")];
    expect(links.map((link) => link.textContent)).toEqual(["ある", "別名", "不明"]);
    expect(links.map((link) => link.classList.contains("cm-wikilink-unresolved"))).toEqual([
      false,
      true,
      false,
    ]);
  });
});

describe("wikilink completion", () => {
  function mount(doc) {
    const postMessage = vi.fn();
    const completion = createMarkdownCompletion({ postMessage });
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [completion.extension],
      }),
    });
    views.push(view);
    return { completion, postMessage, view };
  }

  const labels = (view) => currentCompletions(view.state).map((option) => option.label);
  const lastRequest = (postMessage) =>
    postMessage.mock.calls
      .map(([message]) => message)
      .findLast((message) => message.type === "requestWikilinkCompletions");

  it("asks the host for file names after [[", async () => {
    const { completion, postMessage, view } = mount("see [[ノ");
    startCompletion(view);
    await vi.waitFor(() => expect(lastRequest(postMessage)).toBeTruthy());
    const request = lastRequest(postMessage);
    expect(request.target).toBeUndefined();
    completion.handleWikilinkCompletions({
      requestId: request.requestId,
      items: [{ label: "ノート", detail: "ノート.md" }],
    });
    await vi.waitFor(() => expect(labels(view)).toEqual(["ノート"]));
    expect(currentCompletions(view.state)[0].apply).toBe("ノート]]");
  });

  it("asks the host for the headings of the named note after [[note#", async () => {
    const { completion, postMessage, view } = mount("[[ノート#");
    startCompletion(view);
    await vi.waitFor(() => expect(lastRequest(postMessage)).toBeTruthy());
    expect(lastRequest(postMessage).target).toBe("ノート");
    completion.handleWikilinkCompletions({
      requestId: lastRequest(postMessage).requestId,
      items: [{ label: "見出し", detail: "h2" }],
    });
    await vi.waitFor(() => expect(labels(view)).toEqual(["見出し"]));
  });

  it("lists this document's headings after [[#", async () => {
    const { postMessage, view } = mount("# 最初\n\n## 次\n\n[[#");
    startCompletion(view);
    await vi.waitFor(() => expect(labels(view)).toEqual(["最初", "次"]));
    expect(lastRequest(postMessage)).toBeUndefined();
  });
});

describe("wikilinks in the Richdown diff", () => {
  const { analyzeMarkdownLines, renderMarkdownLine } = createMarkdownRenderer({
    hljs: { getLanguage: () => undefined, highlight: () => ({ value: "" }) },
    registerCopyPayload: () => "copy-1",
  });
  const render = (line) => renderMarkdownLine(line, analyzeMarkdownLines([line]).get(1));

  it("draws links with their label and embeds as images", () => {
    expect(render("[[ノート|別名]]")).toBe(
      '<a href="#" class="rdiff-wikilink" data-wikilink="ノート">別名</a>',
    );
    const embed = render("![[画像.png|300]]");
    expect(embed).toContain('data-image-src="画像.png"');
    expect(embed).toContain('data-wikilink="true"');
    expect(embed).toContain('data-image-width="300"');
  });
});

describe("wikilink embeds in exports", () => {
  it("embeds images the host resolves by name, keyed as [[name]]", async () => {
    const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "richdown-wikilink-")));
    try {
      const image = path.join(workspace, "attachments", "画像.png");
      fs.mkdirSync(path.dirname(image), { recursive: true });
      fs.writeFileSync(image, Buffer.from("89504e470d0a1a0a", "hex"));
      const sourcePath = path.join(workspace, "note.md");
      const imageMap = await createExportImageMap({
        markdown: "![[画像.png|300]] ![[missing.png]]",
        sourcePath,
        allowedRoots: [workspace],
        resolveWikilinkPath: async (name) => (name === "画像.png" ? image : null),
      });
      expect(Object.keys(imageMap)).toEqual(["[[画像.png]]"]);
      expect(imageMap["[[画像.png]]"]).toMatch(/^data:image\/png;base64,/);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
