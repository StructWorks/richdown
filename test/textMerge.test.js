import { describe, expect, it } from "vitest";
import { CONFLICT_MARKERS, mergeText } from "../src/rich-editor/domain/textMerge.js";

const BASE = "# Title\n\nfirst\nsecond\nthird\n";

describe("mergeText", () => {
  it("takes the outside text when only it changed", () => {
    const outside = BASE.replace("first", "FIRST");
    expect(mergeText(BASE, outside, BASE)).toBe(outside);
  });

  it("keeps the editor's text when only it changed", () => {
    const mine = BASE.replace("third", "THIRD");
    expect(mergeText(BASE, BASE, mine)).toBe(mine);
  });

  it("returns the text once when both made the same change", () => {
    const both = BASE.replace("second", "2nd");
    expect(mergeText(BASE, both, both)).toBe(both);
  });

  it("combines changes to different lines", () => {
    const outside = BASE.replace("first", "agent wrote this");
    const mine = BASE.replace("third", "I typed this");

    expect(mergeText(BASE, outside, mine)).toBe(
      "# Title\n\nagent wrote this\nsecond\nI typed this\n",
    );
  });

  it("combines an insertion with a change elsewhere", () => {
    const outside = BASE.replace("# Title\n", "# Title\n\nIntro added outside.\n");
    const mine = `${BASE}appended\n`;

    expect(mergeText(BASE, outside, mine)).toBe(
      "# Title\n\nIntro added outside.\n\nfirst\nsecond\nthird\nappended\n",
    );
  });

  it("combines changes on neighbouring lines", () => {
    const outside = BASE.replace("first", "FIRST");
    const mine = BASE.replace("second", "SECOND");

    expect(mergeText(BASE, outside, mine)).toBe(
      "# Title\n\nFIRST\nSECOND\nthird\n",
    );
  });

  it("keeps both versions between conflict markers when the same line changed", () => {
    const outside = BASE.replace("second", "outside version");
    const mine = BASE.replace("second", "my version");

    expect(mergeText(BASE, outside, mine)).toBe(
      [
        "# Title",
        "",
        "first",
        CONFLICT_MARKERS.mine,
        "my version",
        CONFLICT_MARKERS.separator,
        "outside version",
        CONFLICT_MARKERS.outside,
        "third",
        "",
      ].join("\n"),
    );
  });

  it("treats two insertions at the same point as a conflict", () => {
    const outside = BASE.replace("first\n", "first\nfrom outside\n");
    const mine = BASE.replace("first\n", "first\nfrom me\n");

    const merged = mergeText(BASE, outside, mine);
    expect(merged).toContain(`${CONFLICT_MARKERS.mine}\nfrom me\n`);
    expect(merged).toContain(`${CONFLICT_MARKERS.separator}\nfrom outside\n`);
  });

  it("keeps CRLF line endings, conflict markers included", () => {
    const base = BASE.replace(/\n/g, "\r\n");
    const outside = base.replace("second", "outside");
    const mine = base.replace("second", "mine");

    const merged = mergeText(base, outside, mine);
    expect(merged.replace(/\r\n/g, "")).not.toContain("\n");
    expect(merged).toContain(`${CONFLICT_MARKERS.mine}\r\nmine\r\n`);
  });

  it("keeps a missing final newline", () => {
    const base = "one\ntwo";
    expect(mergeText(base, "ONE\ntwo", "one\nTWO")).toBe("ONE\nTWO");
  });
});
