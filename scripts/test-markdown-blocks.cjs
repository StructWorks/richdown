const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");

const workspaceRoot = path.resolve(__dirname, "..");
const entryPath = path.join(
  workspaceRoot,
  "src/rich-editor/domain/markdownBlocks.js",
);
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
  findFrontmatterBlock,
  findTableBlocks,
  isTableDelimiterLine,
  parseFrontmatterEntries,
} = compiled.exports;

// Minimal CodeMirror Text stand-in: 1-based line access over a plain string.
function createDoc(text) {
  const lineTexts = text.split("\n");
  const lines = [];
  let from = 0;
  for (let index = 0; index < lineTexts.length; index += 1) {
    const lineText = lineTexts[index];
    lines.push({
      text: lineText,
      from,
      to: from + lineText.length,
      number: index + 1,
    });
    from += lineText.length + 1;
  }
  return {
    lines: lines.length,
    length: text.length,
    line(number) {
      return lines[number - 1];
    },
  };
}

for (const delimiter of [
  "| --- | --- |",
  "| :--- | ---: |",
  "|:--|--:|",
  "| :-: | :- |",
  "|:-|-:|",
  ":- | -:",
]) {
  assert.equal(
    isTableDelimiterLine(delimiter),
    true,
    `GFM delimiter row must be recognized: ${delimiter}`,
  );
}
for (const nonDelimiter of ["| a | b |", "---", "| -x- |", "plain text"]) {
  assert.equal(
    isTableDelimiterLine(nonDelimiter),
    false,
    `non-delimiter row must be rejected: ${nonDelimiter}`,
  );
}

const alignedTable = findTableBlocks(
  createDoc("| A | B | C |\n|:--|:-:|--:|\n| 1 | 2 | 3 |"),
);
assert.equal(alignedTable.length, 1, "aligned table must form a table block");
assert.deepEqual(
  alignedTable[0].alignments,
  ["left", "center", "right"],
  "short alignment delimiters must map to column alignments",
);

const frontmatter = findFrontmatterBlock(
  createDoc(
    [
      "---",
      'title: "Hello World"',
      "tags:",
      "  - alpha",
      "  - beta",
      "draft: false",
      "# comment",
      "empty:",
      "---",
      "",
      "# Heading",
    ].join("\n"),
  ),
);
assert.ok(frontmatter, "leading --- fences must form a front matter block");
assert.equal(frontmatter.from, 0);
assert.equal(frontmatter.sourceLineCount, 9);
assert.deepEqual(
  frontmatter.entries.map((entry) => ({
    key: entry.key,
    values: entry.values,
  })),
  [
    { key: "title", values: ["Hello World"] },
    { key: "tags", values: ["alpha", "beta"] },
    { key: "draft", values: ["false"] },
    { key: "empty", values: [] },
  ],
  "front matter entries must collect scalars and list items",
);

assert.equal(
  findFrontmatterBlock(createDoc("# Title\n---\nbody")),
  null,
  "front matter must start on the first line",
);
assert.equal(
  findFrontmatterBlock(createDoc("---\ntitle: unclosed")),
  null,
  "an unclosed opening fence is not front matter",
);
assert.equal(
  findFrontmatterBlock(createDoc("----\ntitle: x\n---")),
  null,
  "longer dash runs are thematic breaks, not front matter fences",
);

const emptyFrontmatter = findFrontmatterBlock(createDoc("---\n---\nbody"));
assert.ok(emptyFrontmatter, "an empty front matter block is still a block");
assert.deepEqual(emptyFrontmatter.entries, []);

assert.deepEqual(
  parseFrontmatterEntries([
    { text: "layout: post", from: 0 },
    { text: "nested:", from: 13 },
    { text: "  key: value", from: 21 },
  ]).map((entry) => ({ key: entry.key, values: entry.values })),
  [
    { key: "layout", values: ["post"] },
    { key: "nested", values: ["key: value"] },
  ],
  "nested mapping lines stay readable as raw values",
);

console.log("Markdown block tests passed.");
