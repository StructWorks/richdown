import { describe, expect, it } from "vitest";

import {
  escapeMarkdownTableCellPipes,
  scanMarkdownTableRow,
  splitMarkdownTableCells,
  unescapeMarkdownTableCellPipes,
} from "../src/markdown/tableCells.js";

describe("splitMarkdownTableCells", () => {
  it("keeps escaped pipes inside their cell", () => {
    expect(splitMarkdownTableCells("| Case | left \\| right | Tail |")).toEqual([
      "Case",
      "left \\| right",
      "Tail",
    ]);
  });

  it("can hand renderers the literal pipe instead of the escape", () => {
    expect(
      splitMarkdownTableCells("| Case | left \\| right | Tail |", {
        unescapePipes: true,
      }),
    ).toEqual(["Case", "left | right", "Tail"]);
  });

  it("keeps pipes inside inline code in their cell", () => {
    expect(splitMarkdownTableCells("| Case | `alpha|beta` | Tail |")).toEqual([
      "Case",
      "`alpha|beta`",
      "Tail",
    ]);
  });

  it("does not let an unmatched backtick hide later column boundaries", () => {
    expect(
      splitMarkdownTableCells("| Case | unmatched ` marker | Tail |"),
    ).toEqual(["Case", "unmatched ` marker", "Tail"]);
  });
});

describe("scanMarkdownTableRow", () => {
  it("records indentation without creating an empty leading column", () => {
    const row = scanMarkdownTableRow("  | First | Second |");
    expect(row.indent).toBe("  ");
    expect(row.usesLeadingPipe).toBe(true);
    expect(row.usesTrailingPipe).toBe(true);
    expect(row.cells.map((cell) => cell.text)).toEqual(["First", "Second"]);
  });

  it("treats an escaped final pipe as cell content, not an outer border", () => {
    const row = scanMarkdownTableRow("| Name | value \\|");
    expect(row.usesTrailingPipe).toBe(false);
    expect(row.cells.map((cell) => cell.text)).toEqual([
      "Name",
      "value \\|",
    ]);
  });
});

describe("pipe escaping", () => {
  it("escapes a bare pipe and leaves an already escaped one alone", () => {
    expect(escapeMarkdownTableCellPipes("left | right")).toBe("left \\| right");
    expect(escapeMarkdownTableCellPipes("left \\| right")).toBe(
      "left \\| right",
    );
  });

  it("leaves pipes inside inline code untouched", () => {
    expect(escapeMarkdownTableCellPipes("`alpha|beta`")).toBe("`alpha|beta`");
  });

  it("unescapes pipes outside inline code only", () => {
    expect(unescapeMarkdownTableCellPipes("left \\| right")).toBe(
      "left | right",
    );
    expect(unescapeMarkdownTableCellPipes("`alpha\\|beta`")).toBe(
      "`alpha\\|beta`",
    );
  });
});
