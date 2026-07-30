import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// markdownExport.js runs in the extension host as CommonJS (it uses node
// builtins and is required by extension.js), so it is loaded the same way here.
const require = createRequire(import.meta.url);
const { containsMermaidBlocks, createHtmlExport } = require(
  "../src/export/markdownExport.js",
);

// The payloads are JSON with <, > and & escaped as unicode sequences, so the
// unicode form has to be restored before parsing.
function readJsonPayload(document, id) {
  const match = document.match(
    new RegExp(
      `<script type="application/json" id="${id}">([\\s\\S]*?)</script>`,
    ),
  );
  expect(match, `payload ${id} must be present`).toBeTruthy();
  return JSON.parse(
    match[1]
      .replace(/\\u003c/g, "<")
      .replace(/\\u003e/g, ">")
      .replace(/\\u0026/g, "&"),
  );
}

describe("containsMermaidBlocks", () => {
  // This decides whether the export ships the Mermaid bundle at all, so it must
  // match every fence form the editor renders.
  it.each([
    "```mermaid\ngraph TD;\n```",
    "~~~mermaid\ngraph TD;\n~~~",
    ":::mermaid\ngraph TD;\n:::",
    "# Title\n\n````MERMAID\ngraph TD;\n````",
    "text\r\n```mermaid darkMode=true\r\ngraph TD;\r\n```",
    "  ```mermaid\ngraph TD;\n```",
  ])("detects a Mermaid fence in %j", (markdown) => {
    expect(containsMermaidBlocks(markdown)).toBe(true);
  });

  it.each([
    "",
    undefined,
    null,
    "no diagrams here",
    "```mermaidish\ngraph TD;\n```",
    "text ```mermaid inline```",
    "``mermaid\ngraph TD;\n``",
  ])("rejects %j", (markdown) => {
    expect(containsMermaidBlocks(markdown)).toBe(false);
  });
});

describe("createHtmlExport", () => {
  const html = createHtmlExport({
    markdown: "# Title\n\n<script>alert(1)</script>",
    title: 'Report <"one">',
    settings: {
      richTheme: "paper",
      richTablePreview: false,
      mermaidPreview: false,
      gherkinPreview: false,
      previewWidth: "wide",
    },
    richEditorScriptHref: 'richEditor.js?v="1"',
    mermaidScriptHref: "mermaid.js",
    imageMap: { "img.png": "data:image/png;base64,AAA" },
    colorThemeKind: "light",
  });

  it("builds a full page that boots the webview bundle in export mode", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="en" data-richdown-export="true">');
    expect(readJsonPayload(html, "initial-runtime")).toEqual({
      exportMode: true,
    });
  });

  it("escapes the title and the script href", () => {
    expect(html).toContain("<title>Report &lt;&quot;one&quot;&gt;</title>");
    expect(html).toContain(
      '<script src="richEditor.js?v=&quot;1&quot;"></script>',
    );
  });

  it("prevents Markdown content from injecting a script tag", () => {
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain(
      "\\u003cscript\\u003ealert(1)\\u003c/script\\u003e",
    );
  });

  it("round-trips the Markdown, images and Mermaid href", () => {
    expect(readJsonPayload(html, "initial-document")).toBe(
      "# Title\n\n<script>alert(1)</script>",
    );
    expect(readJsonPayload(html, "initial-image-map")).toEqual({
      "img.png": "data:image/png;base64,AAA",
    });
    expect(readJsonPayload(html, "mermaid-script-uri")).toBe("mermaid.js");
  });

  it("never carries diff decorations", () => {
    expect(readJsonPayload(html, "initial-git-diff")).toEqual([]);
  });

  it("forces preview toggles on while preserving other settings", () => {
    // Preview toggles are editing preferences; an export must always show the
    // rendered surface.
    expect(readJsonPayload(html, "initial-settings")).toEqual({
      richTheme: "paper",
      richTablePreview: true,
      mermaidPreview: true,
      gherkinPreview: true,
      previewWidth: "wide",
    });
  });
});

describe("createHtmlExport defaults", () => {
  const minimal = createHtmlExport({
    markdown: "",
    title: "",
    settings: {},
    richEditorScriptHref: "richEditor.js",
  });

  it("falls back to a generic title", () => {
    expect(minimal).toContain("<title>Richdown export</title>");
  });

  it("serializes a missing Mermaid href as an empty string", () => {
    expect(readJsonPayload(minimal, "mermaid-script-uri")).toBe("");
  });

  it("defaults the image map and document to empty values", () => {
    expect(readJsonPayload(minimal, "initial-image-map")).toEqual({});
    expect(readJsonPayload(minimal, "initial-document")).toBe("");
  });
});

describe("createHtmlExport theme kind", () => {
  const forKind = (colorThemeKind) =>
    createHtmlExport({
      markdown: "text",
      title: "t",
      settings: {},
      richEditorScriptHref: "richEditor.js",
      ...(colorThemeKind ? { colorThemeKind } : {}),
    });

  it("styles dark and light exports differently", () => {
    expect(forKind("dark")).not.toBe(forKind("light"));
  });

  it("defaults to dark so a dark editor does not export a light page", () => {
    expect(forKind()).toBe(forKind("dark"));
  });
});
