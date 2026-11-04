import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getMinimalTextEdit } = require("../src/host/minimalTextEdit.js");

function apply(text, edit) {
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}

describe("getMinimalTextEdit", () => {
  it("replaces only the typed character, not the whole document", () => {
    const current = "# Title\n\nSome body text.\n";
    const next = "# Title\n\nSome bodyy text.\n";

    const edit = getMinimalTextEdit(current, next);

    expect(edit).toEqual({ from: 18, to: 18, insert: "y" });
    expect(apply(current, edit)).toBe(next);
  });

  it("returns an empty edit for identical texts", () => {
    expect(getMinimalTextEdit("abc", "abc")).toEqual({ from: 3, to: 3, insert: "" });
  });

  it("handles deletions and replacing everything", () => {
    expect(apply("abcdef", getMinimalTextEdit("abcdef", "abef"))).toBe("abef");
    expect(apply("abc", getMinimalTextEdit("abc", "xyz"))).toBe("xyz");
    expect(apply("", getMinimalTextEdit("", "new"))).toBe("new");
    expect(apply("old", getMinimalTextEdit("old", ""))).toBe("");
  });

  it("never starts or ends an edit between \\r and \\n", () => {
    // Joining two CRLF lines: the shared prefix ends after "\r".
    const joined = getMinimalTextEdit("a\r\nb", "a\rb");
    expect(joined.from).toBe(1);
    expect(apply("a\r\nb", joined)).toBe("a\rb");

    // Inserting a line before a CRLF: the shared suffix starts at "\n".
    const inserted = getMinimalTextEdit("a\r\nb", "a\r\nx\r\nb");
    expect(isInsidePair("a\r\nb", inserted.from)).toBe(false);
    expect(isInsidePair("a\r\nb", inserted.to)).toBe(false);
    expect(apply("a\r\nb", inserted)).toBe("a\r\nx\r\nb");
  });

  it("keeps surrogate pairs whole", () => {
    const current = "x\u{1F600}y";
    const next = "x\u{1F601}y";

    const edit = getMinimalTextEdit(current, next);

    expect(edit).toEqual({ from: 1, to: 3, insert: "\u{1F601}" });
    expect(apply(current, edit)).toBe(next);
  });
});

function isInsidePair(text, offset) {
  return offset > 0 && offset < text.length && text[offset - 1] === "\r" && text[offset] === "\n";
}
