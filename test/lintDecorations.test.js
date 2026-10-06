// @vitest-environment jsdom
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import {
  buildLintDecorations,
  findDiagnosticsAt,
} from "../src/rich-editor/presentation/codemirror/lintDecorations.js";

const doc = "# Title\n\n\ntext   \n";

function collect(decorations) {
  const ranges = [];
  decorations.between(0, Number.MAX_SAFE_INTEGER, (from, to, decoration) => {
    ranges.push({ from, to, className: decoration.spec.class });
  });
  return ranges;
}

describe("buildLintDecorations", () => {
  const state = EditorState.create({ doc });

  it("underlines a range and tints the line of an empty range", () => {
    const decorations = buildLintDecorations(state, [
      { line: 3, from: 4, to: 7, severity: "warning", message: "Trailing", rule: "no-trailing-spaces" },
      { line: 2, from: 0, to: 0, severity: "info", message: "Blank", rule: "no-multiple-blanks" },
    ]);
    expect(collect(decorations)).toEqual([
      { from: 9, to: 9, className: "cm-richdown-lint-line cm-richdown-lint-line-info" },
      { from: 14, to: 17, className: "cm-richdown-lint cm-richdown-lint-warning" },
    ]);
  });

  it("clamps results computed for a longer document", () => {
    const decorations = buildLintDecorations(state, [
      { line: 40, from: 3, to: 99, severity: "error", message: "Late", rule: "x" },
      { line: 0, from: 2, to: 99, severity: "bogus", message: "Wide", rule: "y" },
      { line: -1, from: 0, to: 1, severity: "error", message: "Invalid", rule: "z" },
    ]);
    expect(collect(decorations)).toEqual([
      { from: 2, to: 7, className: "cm-richdown-lint cm-richdown-lint-warning" },
      { from: 18, to: 18, className: "cm-richdown-lint-line cm-richdown-lint-line-error" },
    ]);
  });

  it("ignores a payload that is not a list", () => {
    expect(collect(buildLintDecorations(state, null))).toEqual([]);
  });
});

describe("findDiagnosticsAt", () => {
  const state = EditorState.create({ doc });
  const decorations = buildLintDecorations(state, [
    { line: 3, from: 4, to: 7, severity: "warning", message: "Trailing", rule: "a" },
    { line: 3, from: 0, to: 0, severity: "info", message: "Line", rule: "b" },
  ]);

  it("returns marks under the position and line marks on its line", () => {
    const found = findDiagnosticsAt(state, decorations, 15);
    expect(found.diagnostics.map((diagnostic) => diagnostic.message).sort()).toEqual([
      "Line",
      "Trailing",
    ]);
    expect(found).toMatchObject({ from: 10, to: 17 });
  });

  it("returns only line marks away from the underlined text", () => {
    const found = findDiagnosticsAt(state, decorations, 11);
    expect(found.diagnostics.map((diagnostic) => diagnostic.message)).toEqual(["Line"]);
  });

  it("returns nothing on a clean line", () => {
    expect(findDiagnosticsAt(state, decorations, 2).diagnostics).toEqual([]);
  });
});
