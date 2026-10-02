import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// revealTarget.js and chatEditing.js run in the extension host as CommonJS.
const require = createRequire(import.meta.url);
const {
  LINE_END,
  createSelectionRevealTarget,
  parseLinkFragment,
} = require("../src/host/revealTarget.js");
const {
  CHAT_EDITING_ORIGINAL_SCHEME,
  hasPendingChatEdits,
} = require("../src/host/chatEditing.js");

const at = (line, character) => ({ line, character });

describe("createSelectionRevealTarget", () => {
  it("keeps the selection VS Code applied to the text editor", () => {
    expect(
      createSelectionRevealTarget({ start: at(4, 2), end: at(4, 9) }),
    ).toEqual({ selection: { start: at(4, 2), end: at(4, 9) } });
  });

  it("has nothing to reveal for a plain open at the top", () => {
    expect(createSelectionRevealTarget({ start: at(0, 0), end: at(0, 0) })).toBeUndefined();
    expect(createSelectionRevealTarget(undefined)).toBeUndefined();
  });
});

describe("parseLinkFragment", () => {
  it.each([
    ["L12", at(11, 0), at(11, 0)],
    ["l3", at(2, 0), at(2, 0)],
    ["L12C5", at(11, 4), at(11, 4)],
    ["L12-L20", at(11, 0), at(19, LINE_END)],
    ["L2C3-L4C1", at(1, 2), at(3, 0)],
    ["7", at(6, 0), at(6, 0)],
    ["7,3", at(6, 2), at(6, 2)],
    ["7:3", at(6, 2), at(6, 2)],
  ])("reads %j as a line position", (fragment, start, end) => {
    expect(parseLinkFragment(fragment)).toEqual({ selection: { start, end } });
  });

  it("treats anything else as a heading anchor", () => {
    expect(parseLinkFragment("getting-started")).toEqual({ anchor: "getting-started" });
    expect(parseLinkFragment("%E6%97%A5%E6%9C%AC")).toEqual({ anchor: "日本" });
    expect(parseLinkFragment("100%")).toEqual({ anchor: "100%" });
  });

  it("has no target without a fragment", () => {
    expect(parseLinkFragment("")).toBeUndefined();
    expect(parseLinkFragment(undefined)).toBeUndefined();
  });
});

describe("hasPendingChatEdits", () => {
  const doc = (scheme, path, text) => ({ uri: { scheme, path }, getText: () => text });
  const file = doc("file", "/notes/a.md", "new\ntext\n");

  it("is pending while Copilot's original differs from the document", () => {
    const original = doc(CHAT_EDITING_ORIGINAL_SCHEME, "/notes/a.md", "old\n");
    expect(hasPendingChatEdits([file, original], file)).toBe(true);
  });

  it("is settled once the original matches, ignoring line endings", () => {
    const kept = doc(CHAT_EDITING_ORIGINAL_SCHEME, "/notes/a.md", "new\r\ntext\r\n");
    expect(hasPendingChatEdits([file, kept], file)).toBe(false);
  });

  it("ignores originals of other files and unrelated schemes", () => {
    expect(
      hasPendingChatEdits(
        [
          file,
          doc(CHAT_EDITING_ORIGINAL_SCHEME, "/notes/b.md", "old\n"),
          doc("git", "/notes/a.md", "old\n"),
        ],
        file,
      ),
    ).toBe(false);
  });
});
