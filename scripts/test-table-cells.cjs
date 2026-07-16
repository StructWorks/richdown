const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");

const workspaceRoot = path.resolve(__dirname, "..");
const entryPath = path.join(workspaceRoot, "src/markdown/tableCells.js");
const build = esbuild.buildSync({
  entryPoints: [entryPath],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
});
const compiled = new Module(entryPath, module);
compiled.filename = entryPath;
compiled.paths = Module._nodeModulePaths(path.dirname(entryPath));
compiled._compile(build.outputFiles[0].text, entryPath);

const {
  escapeMarkdownTableCellPipes,
  scanMarkdownTableRow,
  splitMarkdownTableCells,
  unescapeMarkdownTableCellPipes,
} = compiled.exports;

assert.deepEqual(
  splitMarkdownTableCells("| Case | left \\| right | Tail |"),
  ["Case", "left \\| right", "Tail"],
  "escaped pipes must stay inside their cell",
);
assert.deepEqual(
  splitMarkdownTableCells("| Case | left \\| right | Tail |", {
    unescapePipes: true,
  }),
  ["Case", "left | right", "Tail"],
  "renderers can request literal escaped pipes",
);
assert.deepEqual(
  splitMarkdownTableCells("| Case | `alpha|beta` | Tail |"),
  ["Case", "`alpha|beta`", "Tail"],
  "pipes inside inline code must stay inside their cell",
);
assert.deepEqual(
  splitMarkdownTableCells("| Case | unmatched ` marker | Tail |"),
  ["Case", "unmatched ` marker", "Tail"],
  "an unmatched backtick must not hide later column boundaries",
);

const indented = scanMarkdownTableRow("  | First | Second |");
assert.equal(indented.indent, "  ");
assert.equal(indented.usesLeadingPipe, true);
assert.equal(indented.usesTrailingPipe, true);
assert.deepEqual(
  indented.cells.map((cell) => cell.text),
  ["First", "Second"],
  "indentation must not create an empty leading column",
);

const escapedTrailing = scanMarkdownTableRow("| Name | value \\|");
assert.equal(escapedTrailing.usesTrailingPipe, false);
assert.deepEqual(
  escapedTrailing.cells.map((cell) => cell.text),
  ["Name", "value \\|"],
  "an escaped final pipe is cell content, not an outer border",
);

assert.equal(escapeMarkdownTableCellPipes("left | right"), "left \\| right");
assert.equal(escapeMarkdownTableCellPipes("left \\| right"), "left \\| right");
assert.equal(escapeMarkdownTableCellPipes("`alpha|beta`"), "`alpha|beta`");
assert.equal(unescapeMarkdownTableCellPipes("left \\| right"), "left | right");
assert.equal(
  unescapeMarkdownTableCellPipes("`alpha\\|beta`"),
  "`alpha\\|beta`",
  "backslashes inside inline code must remain literal",
);

console.log("Table cell parser tests passed.");
