import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// lineEndings.js runs in the extension host as CommonJS (it is required by
// extension.js), so it is loaded the same way here.
const require = createRequire(import.meta.url);
const { CRLF, LF, applyLineEnding, normalizeToLf } = require(
  "../src/host/lineEndings.js",
);

describe("normalizeToLf", () => {
  it("drops carriage returns from a CRLF document", () => {
    expect(normalizeToLf("a\r\nb\r\n")).toBe("a\nb\n");
  });

  it("also normalizes lone carriage returns and mixed endings", () => {
    expect(normalizeToLf("a\rb\r\nc\nd")).toBe("a\nb\nc\nd");
  });

  it("leaves an LF document untouched", () => {
    expect(normalizeToLf("a\nb\n")).toBe("a\nb\n");
  });

  it("treats missing text as empty", () => {
    expect(normalizeToLf(undefined)).toBe("");
    expect(normalizeToLf(null)).toBe("");
  });
});

describe("applyLineEnding", () => {
  it("restores the CRLF endings a Windows document uses", () => {
    expect(applyLineEnding("a\nb\n", CRLF)).toBe("a\r\nb\r\n");
  });

  it("does not double the carriage returns of already-CRLF text", () => {
    expect(applyLineEnding("a\r\nb\r\n", CRLF)).toBe("a\r\nb\r\n");
  });

  it("keeps LF documents on LF", () => {
    expect(applyLineEnding("a\r\nb\n", LF)).toBe("a\nb\n");
  });

  it("round-trips webview text back to the document byte for byte", () => {
    // What the extension host applies to a CRLF document has to equal what the
    // document reports afterwards, otherwise the change is echoed back to the
    // webview as an external update and the caret jumps.
    const documentText = "# Title\r\n\r\nbody\r\n";
    const webviewText = normalizeToLf(documentText);

    expect(applyLineEnding(webviewText, CRLF)).toBe(documentText);
    expect(applyLineEnding(`${webviewText}typed\n`, CRLF)).toBe(
      "# Title\r\n\r\nbody\r\ntyped\r\n",
    );
  });
});
