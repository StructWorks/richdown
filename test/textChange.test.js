import { describe, expect, it } from "vitest";

import {
  getMinimalTextChange,
  mapPositionThroughTextChange,
  normalizeLineEndings,
} from "../src/rich-editor/domain/textChange.js";

describe("getMinimalTextChange", () => {
  it("keeps the shared prefix and suffix out of an insertion", () => {
    expect(getMinimalTextChange("hello world", "hello brave world")).toEqual({
      from: 6,
      to: 6,
      insert: "brave ",
    });
  });

  it("reports an empty insert over a removed range", () => {
    expect(getMinimalTextChange("abcdef", "abef")).toEqual({
      from: 2,
      to: 4,
      insert: "",
    });
  });

  it("replaces the whole range for a fully different document", () => {
    expect(getMinimalTextChange("abc", "xyz")).toEqual({
      from: 0,
      to: 3,
      insert: "xyz",
    });
  });

  it("produces a no-op change for identical documents", () => {
    expect(getMinimalTextChange("abc", "abc")).toEqual({
      from: 3,
      to: 3,
      insert: "",
    });
  });

  it("handles empty documents on either side", () => {
    expect(getMinimalTextChange("", "new")).toEqual({
      from: 0,
      to: 0,
      insert: "new",
    });
    expect(getMinimalTextChange("gone", "")).toEqual({
      from: 0,
      to: 4,
      insert: "",
    });
  });

  it("never inverts the range when prefix and suffix scans overlap", () => {
    expect(getMinimalTextChange("aaa", "aa")).toEqual({
      from: 2,
      to: 3,
      insert: "",
    });
    expect(getMinimalTextChange("aa", "aaa")).toEqual({
      from: 2,
      to: 2,
      insert: "a",
    });
  });

  it.each([
    ["hello world", "hello brave world"],
    ["abcdef", "abef"],
    ["# Title\nbody", "# Title\n\nbody text"],
    ["aaa", "aa"],
    ["", "new"],
    ["gone", ""],
  ])("applying the change to %j reproduces %j", (current, next) => {
    const change = getMinimalTextChange(current, next);
    expect(change.from).toBeLessThanOrEqual(change.to);
    expect(
      current.slice(0, change.from) + change.insert + current.slice(change.to),
    ).toBe(next);
  });
});

describe("mapPositionThroughTextChange", () => {
  const insertion = getMinimalTextChange("hello world", "hello brave world");
  const deletion = getMinimalTextChange("abcdef", "abef");
  const wholeDocument = getMinimalTextChange("abc", "xyz");

  it("leaves a caret before the change untouched", () => {
    expect(mapPositionThroughTextChange(3, insertion, 11, 17)).toBe(3);
    expect(mapPositionThroughTextChange(6, insertion, 11, 17)).toBe(6);
  });

  it("shifts a caret after an insertion by the inserted length", () => {
    expect(mapPositionThroughTextChange(11, insertion, 11, 17)).toBe(17);
  });

  it("collapses a caret inside removed text to the change start", () => {
    expect(mapPositionThroughTextChange(3, deletion, 6, 4)).toBe(2);
  });

  it("shifts a caret after removed text back by the removed length", () => {
    expect(mapPositionThroughTextChange(5, deletion, 6, 4)).toBe(3);
  });

  it("keeps the offset through a full replacement when it still fits", () => {
    expect(mapPositionThroughTextChange(2, wholeDocument, 3, 3)).toBe(2);
  });

  it("clamps a full replacement to a shorter new document", () => {
    expect(mapPositionThroughTextChange(3, wholeDocument, 3, 1)).toBe(1);
  });

  it("clamps positions outside the old document", () => {
    expect(mapPositionThroughTextChange(-5, insertion, 11, 17)).toBe(0);
    expect(mapPositionThroughTextChange(999, deletion, 6, 4)).toBe(4);
  });

  it("maps a caret at the change end through a shrunken range", () => {
    expect(
      mapPositionThroughTextChange(4, { from: 1, to: 4, insert: "" }, 6, 3),
    ).toBe(1);
  });
});

describe("normalizeLineEndings", () => {
  it("strips the carriage returns of a Windows document", () => {
    expect(normalizeLineEndings("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("treats missing text as empty", () => {
    expect(normalizeLineEndings(undefined)).toBe("");
  });

  it("reports no change for a CRLF copy of the editor document", () => {
    // Before normalization the minimal change against a CRLF update was a lone
    // "\r", which CodeMirror applies as an extra line break while the caret is
    // remapped against the longer CRLF offsets.
    const editorText = "a\nbc";
    const hostText = "a\r\nbc";

    expect(getMinimalTextChange(editorText, hostText)).toEqual({
      from: 1,
      to: 1,
      insert: "\r",
    });
    expect(normalizeLineEndings(hostText)).toBe(editorText);
  });
});
