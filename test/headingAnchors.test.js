import { describe, expect, it } from "vitest";

import {
  collectHeadingAnchors,
  slugifyHeading,
} from "../src/rich-editor/presentation/codemirror/completions.js";
import { createDoc, createDocOf } from "./helpers/testKit.js";

describe("slugifyHeading", () => {
  // GitHub's anchor rules: lowercase, drop punctuation, keep letters, numbers,
  // underscores and dashes, join words with dashes.
  it.each([
    ["Hello, World!", "hello-world"],
    ["Getting Started", "getting-started"],
    ["  Spaced  Out  ", "spaced-out"],
    ["snake_case and kebab-case", "snake_case-and-kebab-case"],
    ["API v2.1", "api-v21"],
    ["`code` heading", "code-heading"],
    ["C++ / C#", "c-c"],
    ["日本語 見出し", "日本語-見出し"],
  ])("slugifies %j to %j", (title, slug) => {
    expect(slugifyHeading(title)).toBe(slug);
  });

  it("has no anchor for a punctuation-only title", () => {
    expect(slugifyHeading("!!!")).toBe("");
  });
});

describe("collectHeadingAnchors", () => {
  it("collects headings at every level", () => {
    expect(
      collectHeadingAnchors(
        createDocOf([
          "# Title",
          "text",
          "## Getting Started",
          "###### Deep Heading",
          "  ### Indented Heading",
        ]),
      ),
    ).toEqual([
      { slug: "title", title: "Title" },
      { slug: "getting-started", title: "Getting Started" },
      { slug: "deep-heading", title: "Deep Heading" },
      { slug: "indented-heading", title: "Indented Heading" },
    ]);
  });

  it("excludes closing hashes from the title", () => {
    expect(collectHeadingAnchors(createDoc("## Closed Heading ##"))).toEqual([
      { slug: "closed-heading", title: "Closed Heading" },
    ]);
  });

  it("numbers repeated slugs the way GitHub does", () => {
    expect(
      collectHeadingAnchors(createDocOf(["## Notes", "## Notes", "## Notes"])),
    ).toEqual([
      { slug: "notes", title: "Notes" },
      { slug: "notes-1", title: "Notes" },
      { slug: "notes-2", title: "Notes" },
    ]);
  });

  it("skips malformed and anchorless headings", () => {
    expect(
      collectHeadingAnchors(
        createDocOf([
          "#nospace",
          "####### too deep",
          "plain text",
          "## !!!",
          "## ",
        ]),
      ),
    ).toEqual([]);
  });

  it("has no anchors in an empty document", () => {
    expect(collectHeadingAnchors(createDoc(""))).toEqual([]);
  });
});
