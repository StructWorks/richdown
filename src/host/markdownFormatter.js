// Markdown formatter for the extension host.
//
// Every rule is a pass over the document's lines that can be switched off in
// .richdownrc.json (see src/host/markdownQualityConfig.js). Passes re-scan the
// structure before they run, because an earlier pass may add or remove lines.
// Code blocks, front matter, HTML blocks, and block quotes are never rewritten,
// and a rule that cannot change a construct without changing how it renders
// leaves it alone.

const {
  displayWidth,
  isBlank,
  scanMarkdown,
  scanTableRow,
} = require("./markdownStructure");

const formatRules = [
  {
    name: "heading-style",
    description: "Convert single-line setext headings (underlined with === or ---) to ATX headings (# Heading).",
  },
  {
    name: "atx-heading",
    description: "Put exactly one space after the # marks of a heading, remove its indentation and closing # marks, and add the missing space in a stand-alone line such as \"##Heading\".",
  },
  {
    name: "list-marker",
    description: "Use one marker for bullet list items.",
    options: { style: { enum: ["-", "*", "+", "consistent"], default: "-" } },
  },
  {
    name: "ordered-list-numbering",
    description: "Number ordered list items sequentially from the first item's number. Lists that use the same number for every item are kept.",
    options: { style: { enum: ["ordered", "one"], default: "ordered" } },
  },
  {
    name: "thematic-break",
    description: "Write thematic breaks (horizontal rules) as ---.",
  },
  {
    name: "table-format",
    description: "Align table columns, counting East Asian wide characters as two columns, and pad short rows with empty cells. Extra cells beyond the header are kept as they are.",
  },
  {
    name: "blank-lines-around-headings",
    description: "Surround headings with blank lines.",
  },
  {
    name: "blank-lines-around-fences",
    description: "Surround fenced code blocks with blank lines.",
  },
  {
    name: "blank-lines-around-lists",
    description: "Surround lists with blank lines.",
  },
  {
    name: "blank-lines-around-tables",
    description: "Surround tables with blank lines.",
  },
  {
    name: "trailing-whitespace",
    description: "Remove trailing spaces and tabs. Two trailing spaces that make a hard line break are kept.",
  },
  {
    name: "consecutive-blank-lines",
    description: "Collapse consecutive blank lines into one and remove blank lines at the start of the document.",
  },
  {
    name: "final-newline",
    description: "End the document with exactly one newline.",
  },
];

// Runs the enabled rules in a fixed order. `rules` maps a rule name to its
// options object, or to null/undefined when the rule is off.
function formatMarkdown(text, rules) {
  const source = String(text ?? "");
  if (source.trim() === "") {
    return source;
  }
  let lines = source.split("\n");
  for (const rule of formatPasses) {
    const options = rules?.[rule.name];
    if (options) {
      lines = rule.run(lines, options);
    }
  }
  return lines.join("\n");
}

const formatPasses = [
  { name: "heading-style", run: convertSetextHeadings },
  { name: "atx-heading", run: normalizeAtxHeadings },
  { name: "list-marker", run: normalizeListMarkers },
  { name: "ordered-list-numbering", run: renumberOrderedLists },
  { name: "thematic-break", run: normalizeThematicBreaks },
  { name: "table-format", run: formatTables },
  { name: "blank-lines-around-headings", run: (lines) => insertBlankLines(lines, findHeadingBoundaries) },
  { name: "blank-lines-around-fences", run: (lines) => insertBlankLines(lines, findFenceBoundaries) },
  { name: "blank-lines-around-lists", run: (lines) => insertBlankLines(lines, findListBoundaries) },
  { name: "blank-lines-around-tables", run: (lines) => insertBlankLines(lines, findTableBoundaries) },
  { name: "trailing-whitespace", run: trimTrailingWhitespace },
  { name: "consecutive-blank-lines", run: collapseBlankLines },
  { name: "final-newline", run: ensureFinalNewline },
];

function convertSetextHeadings(lines) {
  const { headings } = scanMarkdown(lines.join("\n"));
  const replacements = new Map();
  for (const heading of headings) {
    if (heading.style !== "setext" || heading.multiline || !heading.text) {
      continue;
    }
    replacements.set(heading.line, `${"#".repeat(heading.level)} ${heading.text}`);
    replacements.set(heading.endLine, null);
  }
  return applyLineReplacements(lines, replacements);
}

function normalizeAtxHeadings(lines) {
  const structure = scanMarkdown(lines.join("\n"));
  return lines.map((line, index) => {
    const info = structure.lines[index];
    if (info.kind === "heading" && info.heading.style === "atx" && !info.inList) {
      const { level, text } = info.heading;
      return text ? `${"#".repeat(level)} ${text}` : "#".repeat(level);
    }
    if (info.atxMissingSpace && !info.inList && isStandAloneLine(structure.lines, index)) {
      const match = /^ {0,3}(#{1,6})(.*)$/.exec(line);
      return `${match[1]} ${match[2].trim()}`;
    }
    return line;
  });
}

// "##Heading" is only a heading when the author forgot the space, so only a
// line with blank lines (or the document edge) on both sides is rewritten.
function isStandAloneLine(infos, index) {
  const before = infos[index - 1];
  const after = infos[index + 1];
  return (!before || before.kind === "blank") && (!after || after.kind === "blank");
}

function normalizeListMarkers(lines, options) {
  const { listItems } = scanMarkdown(lines.join("\n"));
  const bullets = listItems.filter((item) => !item.ordered);
  const style = options.style === "consistent" ? bullets[0]?.bullet : options.style;
  if (!["-", "*", "+"].includes(style)) {
    return lines;
  }
  const next = [...lines];
  for (const item of bullets) {
    if (item.bullet === style) {
      continue;
    }
    const line = next[item.line];
    next[item.line] = `${line.slice(0, item.markerFrom)}${style}${line.slice(item.markerTo)}`;
  }
  return next;
}

function renumberOrderedLists(lines, options) {
  const { listItems } = scanMarkdown(lines.join("\n"));
  const lists = groupBy(
    listItems.filter((item) => item.ordered),
    (item) => item.listId,
  );
  const next = [...lines];
  for (const items of lists.values()) {
    const numbers = expectedListNumbers(items, options.style);
    if (!numbers) {
      continue;
    }
    // Changing the number's width (9. -> 10.) would shift the content column
    // and could move nested blocks out of the item, so such lists are kept.
    const changesWidth = items.some(
      (item, position) => String(numbers[position]).length !== item.numberText.length,
    );
    if (changesWidth) {
      continue;
    }
    items.forEach((item, position) => {
      const line = next[item.line];
      next[item.line] =
        `${line.slice(0, item.markerFrom)}${numbers[position]}${item.delimiter}${line.slice(item.markerTo)}`;
    });
  }
  return next;
}

// The numbers an ordered list should use, or null when it already uses them.
// A list that repeats one number for every item ("1. 1. 1.") is a deliberate
// style and is kept unless the rule asks for "one".
function expectedListNumbers(items, style) {
  const start = items[0].number;
  const numbers =
    style === "one"
      ? items.map(() => 1)
      : items.every((item) => item.number === start)
        ? null
        : items.map((_, position) => start + position);
  if (!numbers || numbers.every((number, position) => number === items[position].number)) {
    return null;
  }
  return numbers;
}

function normalizeThematicBreaks(lines) {
  const structure = scanMarkdown(lines.join("\n"));
  return lines.map((line, index) => {
    const info = structure.lines[index];
    if (info.kind !== "thematic-break" || info.inList || line.trim() === "---") {
      return line;
    }
    // "---" right under paragraph text would turn the paragraph into a setext
    // heading, so a break that follows paragraph text keeps its characters.
    return structure.lines[index - 1]?.kind === "text" ? line : "---";
  });
}

function formatTables(lines) {
  const { tables } = scanMarkdown(lines.join("\n"));
  const next = [...lines];
  for (const table of tables) {
    const formatted = formatTableLines(lines.slice(table.start, table.end + 1));
    formatted.forEach((line, offset) => {
      next[table.start + offset] = line;
    });
  }
  return next;
}

// Columns are defined by the header row, as in GFM. Cells past the header's
// count are not rendered, but they are kept (unaligned) so no text is lost.
function formatTableLines(tableLines) {
  const rows = tableLines.map((line) => scanTableRow(line));
  const indent = rows[0].indent;
  const columnCount = rows[0].cells.length;
  const alignments = Array.from({ length: columnCount }, (_, column) =>
    parseAlignment(rows[1].cells[column]?.text),
  );
  const bodyRows = rows.filter((_, rowIndex) => rowIndex !== 1);
  const widths = alignments.map((_, column) =>
    Math.max(3, ...bodyRows.map((row) => displayWidth(row.cells[column]?.text ?? ""))),
  );
  return rows.map((row, rowIndex) => {
    const cells =
      rowIndex === 1
        ? widths.map((width, column) => buildDelimiterCell(alignments[column], width))
        : [
            ...widths.map((width, column) =>
              padCell(row.cells[column]?.text ?? "", width, alignments[column]),
            ),
            ...row.cells.slice(columnCount).map((cell) => cell.text),
          ];
    return `${indent}| ${cells.join(" | ")} |`;
  });
}

function parseAlignment(delimiterCell) {
  const value = String(delimiterCell || "").trim();
  if (value.startsWith(":") && value.endsWith(":") && value.length > 1) return "center";
  if (value.endsWith(":")) return "right";
  if (value.startsWith(":")) return "left-explicit";
  return "none";
}

function buildDelimiterCell(alignment, width) {
  if (alignment === "center") return `:${"-".repeat(width - 2)}:`;
  if (alignment === "right") return `${"-".repeat(width - 1)}:`;
  if (alignment === "left-explicit") return `:${"-".repeat(width - 1)}`;
  return "-".repeat(width);
}

function padCell(text, width, alignment) {
  const padding = width - displayWidth(text);
  if (alignment === "right") {
    return `${" ".repeat(padding)}${text}`;
  }
  if (alignment === "center") {
    const left = Math.floor(padding / 2);
    return `${" ".repeat(left)}${text}${" ".repeat(padding - left)}`;
  }
  return `${text}${" ".repeat(padding)}`;
}

// Boundary finders return the indexes of lines that need a blank line inserted
// before them.
function findHeadingBoundaries(structure) {
  const positions = [];
  for (const heading of structure.headings) {
    const first = structure.lines[heading.line];
    if (first.inList) {
      continue;
    }
    positions.push(heading.line, heading.endLine + 1);
  }
  return positions;
}

function findFenceBoundaries(structure) {
  const positions = [];
  for (const fence of structure.fences) {
    if (fence.inList) {
      continue;
    }
    positions.push(fence.start);
    if (fence.closed) {
      positions.push(fence.end + 1);
    }
  }
  return positions;
}

function findListBoundaries(structure) {
  const positions = [];
  const { lines } = structure;
  for (let index = 0; index < lines.length; index += 1) {
    const info = lines[index];
    const before = lines[index - 1];
    if (info.kind === "list-item" && info.listItem.depth === 0 && before && !before.inList) {
      positions.push(index);
    }
    if (info.inList && info.kind !== "blank" && lines[index + 1] && !lines[index + 1].inList) {
      positions.push(index + 1);
    }
  }
  return positions;
}

function findTableBoundaries(structure) {
  const positions = [];
  for (const table of structure.tables) {
    if (table.inList) {
      continue;
    }
    positions.push(table.start, table.end + 1);
  }
  return positions;
}

function insertBlankLines(lines, findBoundaries) {
  const structure = scanMarkdown(lines.join("\n"));
  const positions = new Set(
    findBoundaries(structure).filter((position) => {
      const before = structure.lines[position - 1];
      const at = structure.lines[position];
      return (
        before &&
        at &&
        before.kind !== "blank" &&
        at.kind !== "blank" &&
        // Front matter is YAML, not a Markdown block that needs separating.
        before.kind !== "front-matter" &&
        !before.inQuote &&
        !at.inQuote
      );
    }),
  );
  if (positions.size === 0) {
    return lines;
  }
  const next = [];
  lines.forEach((line, index) => {
    if (positions.has(index)) {
      next.push("");
    }
    next.push(line);
  });
  return next;
}

function trimTrailingWhitespace(lines) {
  const structure = scanMarkdown(lines.join("\n"));
  return lines.map((line, index) => {
    const info = structure.lines[index];
    if (info.kind === "code") {
      return line;
    }
    const trailing = /[ \t]+$/.exec(line);
    if (!trailing) {
      return line;
    }
    if (isHardBreak(structure.lines, index, trailing[0])) {
      return `${line.slice(0, trailing.index)}  `;
    }
    return line.slice(0, trailing.index);
  });
}

// Two or more trailing spaces before another line of the same paragraph are a
// hard line break, which only takes effect on paragraph-like lines.
function isHardBreak(infos, index, trailing) {
  const info = infos[index];
  const after = infos[index + 1];
  return (
    /^ {2,}$/.test(trailing) &&
    ["text", "list-item", "quote"].includes(info.kind) &&
    !isBlank(info.text) &&
    after !== undefined &&
    ["text", "quote"].includes(after.kind)
  );
}

function collapseBlankLines(lines) {
  const structure = scanMarkdown(lines.join("\n"));
  const next = [];
  let previousWasBlank = true;
  lines.forEach((line, index) => {
    // Blank lines inside fenced code are content and are scanned as "code".
    const isBlankLine = structure.lines[index].kind === "blank";
    if (isBlankLine && previousWasBlank) {
      return;
    }
    previousWasBlank = isBlankLine;
    next.push(isBlankLine ? "" : line);
  });
  return next.length > 0 ? next : [""];
}

function ensureFinalNewline(lines) {
  let end = lines.length;
  while (end > 0 && lines[end - 1] === "") {
    end -= 1;
  }
  return end === 0 ? [""] : [...lines.slice(0, end), ""];
}

function applyLineReplacements(lines, replacements) {
  if (replacements.size === 0) {
    return lines;
  }
  const next = [];
  lines.forEach((line, index) => {
    if (!replacements.has(index)) {
      next.push(line);
      return;
    }
    const replacement = replacements.get(index);
    if (replacement !== null) {
      next.push(replacement);
    }
  });
  return next;
}

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  return groups;
}

module.exports = {
  formatMarkdown,
  formatRules,
};
