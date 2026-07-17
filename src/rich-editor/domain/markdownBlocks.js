// Pure Markdown block analysis for the rich editor.
//
// This module deliberately has no DOM or CodeMirror decoration dependency. It
// turns a CodeMirror document into semantic ranges that presentation modules can
// replace with richer UI while preserving source positions for editing.

// The block scans below are pure functions of the document, but each one runs
// several times per keystroke — once per preview StateField plus once per
// viewport syntax plugin (and `getPreviewedDetailsRanges` re-scans details for
// the table and mermaid builders). Memoizing by the immutable CodeMirror `Text`
// instance collapses those repeated O(n) full-document scans for a given
// document version into a single pass. Each edit produces a new `Text`, so the
// WeakMap holds at most the live document(s); older entries are GC'd.
import {
  scanMarkdownTableRow,
  splitMarkdownTableCells,
} from "../../markdown/tableCells.js";

const detailsBlocksCache = new WeakMap();
const tableBlocksCache = new WeakMap();
const mermaidBlocksCache = new WeakMap();
const gherkinBlocksCache = new WeakMap();
const frontmatterBlockCache = new WeakMap();

function memoizeBlocks(cache, doc, compute) {
  let result = cache.get(doc);
  if (result === undefined) {
    result = compute(doc);
    cache.set(doc, result);
  }
  return result;
}

export function findDetailsBlocks(doc) {
  return memoizeBlocks(detailsBlocksCache, doc, computeDetailsBlocks);
}

export function findTableBlocks(doc) {
  return memoizeBlocks(tableBlocksCache, doc, computeTableBlocks);
}

export function findMermaidBlocks(doc) {
  return memoizeBlocks(mermaidBlocksCache, doc, computeMermaidBlocks);
}

export function findMermaidFenceBlocks(doc, options = {}) {
  return computeMermaidBlocks(doc, options);
}

export function findGherkinBlocks(doc) {
  return memoizeBlocks(gherkinBlocksCache, doc, computeGherkinBlocks);
}

export function findFrontmatterBlock(doc) {
  return memoizeBlocks(frontmatterBlockCache, doc, computeFrontmatterBlock);
}

function computeFrontmatterBlock(doc) {
  // YAML front matter only exists when the very first line is exactly "---"
  // (matching GitHub and the lezer yaml-frontmatter grammar). Anything else,
  // including an unclosed opening fence, stays regular Markdown.
  const openingLine = doc.line(1);
  if (!/^---\s*$/.test(openingLine.text)) {
    return null;
  }

  for (let lineNumber = 2; lineNumber <= doc.lines; lineNumber += 1) {
    const closingLine = doc.line(lineNumber);
    if (!/^---\s*$/.test(closingLine.text)) {
      continue;
    }

    const bodyLines = [];
    for (
      let bodyLineNumber = 2;
      bodyLineNumber < lineNumber;
      bodyLineNumber += 1
    ) {
      const line = doc.line(bodyLineNumber);
      bodyLines.push({ text: line.text, from: line.from });
    }

    const signature = [
      openingLine.text,
      ...bodyLines.map((line) => line.text),
      closingLine.text,
    ].join("\n");
    return {
      from: openingLine.from,
      to: closingLine.to,
      sourceTo: closingLine.to,
      sourceLineCount: lineNumber,
      signature,
      entries: parseFrontmatterEntries(bodyLines),
    };
  }

  return null;
}

export function parseFrontmatterEntries(bodyLines) {
  // Display-oriented YAML mapping scan: top-level "key: value" pairs become
  // entries, list items and nested lines attach to the entry above them. This
  // intentionally stays far simpler than a YAML parser — unrecognized lines
  // remain readable as raw values instead of failing the preview.
  const entries = [];
  for (const line of bodyLines) {
    const text = line.text;
    if (!text.trim() || /^\s*#/.test(text)) {
      continue;
    }

    const keyValue = /^[\s#-]/.test(text)
      ? null
      : text.match(/^([^:]+?)\s*:(?:\s+(.*?))?\s*$/);
    if (keyValue) {
      entries.push({
        key: keyValue[1],
        values: keyValue[2] ? [normalizeFrontmatterScalar(keyValue[2])] : [],
        sourceFrom: line.from,
      });
      continue;
    }

    const continuation = text.trim();
    const listItem = continuation.match(/^-\s+(.*)$/);
    const value = normalizeFrontmatterScalar(
      listItem ? listItem[1].trim() : continuation,
    );
    if (!value) {
      continue;
    }
    if (entries.length > 0) {
      entries[entries.length - 1].values.push(value);
    } else {
      entries.push({ key: null, values: [value], sourceFrom: line.from });
    }
  }
  return entries;
}

function normalizeFrontmatterScalar(value) {
  const quoted = value.match(/^"([^"]*)"$/) || value.match(/^'([^']*)'$/);
  return quoted ? quoted[1] : value;
}

export function isThematicBreakLine(text) {
  return /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(text);
}

export function parseListMarker(text) {
  const match = text.match(/^(\s*)((?:[-+*])|(?:\d+[.)]))(\s+)/);
  if (!match) {
    return null;
  }
  const indentColumns = countIndentColumns(match[1]);
  return {
    indent: match[1],
    marker: match[2],
    spacing: match[3],
    ordered: /^\d/.test(match[2]),
    level: Math.max(0, Math.floor(indentColumns / 2)),
    markerFrom: match[1].length,
    markerTo: match[1].length + match[2].length + match[3].length,
  };
}

export function countIndentColumns(text) {
  let columns = 0;
  for (const character of text) {
    columns += character === "\t" ? 4 - (columns % 4) : 1;
  }
  return columns;
}

export function isDetailsOpeningLine(text) {
  return /^\s{0,3}<details(?:\s|>|$)/i.test(text);
}

export function isDetailsClosingLine(text) {
  return /<\/details\s*>/i.test(text);
}

export function isEditingDetailsBlock(detailsBlock, activeEdit, selection) {
  if (!activeEdit || activeEdit.from !== detailsBlock.from) {
    return false;
  }

  return selection.ranges.some(
    (range) =>
      range.from >= detailsBlock.from && range.to <= detailsBlock.sourceTo,
  );
}

function computeDetailsBlocks(doc) {
  const blocks = [];
  const stack = [];

  // Track only top-level <details> blocks. Nested details are allowed in source,
  // but replacing only the outer block avoids overlapping CodeMirror widgets.
  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    if (isDetailsOpeningLine(line.text)) {
      if (isDetailsClosingLine(line.text)) {
        blocks.push(createDetailsBlock(doc, line, line));
        continue;
      }
      stack.push(line);
      continue;
    }

    if (!isDetailsClosingLine(line.text) || stack.length === 0) {
      continue;
    }

    const openingLine = stack.pop();
    if (stack.length === 0) {
      blocks.push(createDetailsBlock(doc, openingLine, line));
    }
  }

  return blocks;
}

export function createDetailsBlock(doc, openingLine, closingLine) {
  const lines = [];
  for (
    let lineNumber = openingLine.number;
    lineNumber <= closingLine.number;
    lineNumber += 1
  ) {
    lines.push(doc.line(lineNumber));
  }

  const parsed = parseDetailsContent(lines);
  const signature = lines.map((line) => line.text).join("\n");
  return {
    from: openingLine.from,
    to: closingLine.to,
    sourceTo: closingLine.to,
    sourceLineCount: closingLine.number - openingLine.number + 1,
    key: `${openingLine.from}:${signature}`,
    openByDefault: /\sopen(?:\s|>|$)/i.test(openingLine.text),
    summary: parsed.summary,
    bodyLines: parsed.bodyLines,
    signature,
  };
}

export function parseDetailsContent(lines) {
  const source = lines.map((line) => line.text).join("\n");
  const inner = source
    .replace(/^\s*<details\b[^>]*>/i, "")
    .replace(/<\/details\s*>\s*$/i, "")
    .trim();
  let summary = "Details";
  let body = inner;
  const summaryMatch = inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);

  if (summaryMatch) {
    summary = stripHtmlTags(summaryMatch[1]).trim() || summary;
    body = `${inner.slice(0, summaryMatch.index)}${inner.slice(
      summaryMatch.index + summaryMatch[0].length,
    )}`;
  }

  return {
    summary,
    bodyLines: normalizeDetailsBodyLines(body),
  };
}

export function normalizeDetailsBodyLines(body) {
  const lines = body
    .replace(/<\/?div\b[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\r?\n/)
    .map((line) => stripHtmlTags(line))
    .map((line) => ({ text: line, sourceFrom: null }));

  while (lines.length > 0 && !lines[0].text.trim()) {
    lines.shift();
  }
  while (lines.length > 0 && !lines[lines.length - 1].text.trim()) {
    lines.pop();
  }
  return lines;
}

export function getDetailsBodyLineText(line) {
  return typeof line === "string" ? line : line.text || "";
}

export function stripHtmlTags(text) {
  return text.replace(/<[^>]+>/g, "");
}

export function rangeIntersectsRanges(from, to, ranges) {
  return ranges.some((range) => from < range.to && to > range.from);
}

export function getTableLineRole(doc, line) {
  if (
    !isTableContentLine(line.text) &&
    !isTableDelimiterLine(line.text) &&
    !isTableRowLine(line.text)
  ) {
    return null;
  }

  if (isTableDelimiterLine(line.text)) {
    const previousLine = line.number > 1 ? doc.line(line.number - 1) : null;
    return previousLine && isTableContentLine(previousLine.text)
      ? "delimiter"
      : null;
  }

  const nextLine = line.number < doc.lines ? doc.line(line.number + 1) : null;
  if (nextLine && isTableDelimiterLine(nextLine.text)) {
    return "header";
  }

  return isTableBodyLine(doc, line.number) ? "body" : null;
}

export function isTableBodyLine(doc, lineNumber) {
  let currentLineNumber = lineNumber - 1;
  while (currentLineNumber >= 1) {
    const line = doc.line(currentLineNumber);
    if (isTableDelimiterLine(line.text)) {
      const headerLine =
        currentLineNumber > 1 ? doc.line(currentLineNumber - 1) : null;
      return Boolean(headerLine && isTableContentLine(headerLine.text));
    }

    if (!isTableRowLine(line.text)) {
      return false;
    }

    if (lineNumber - currentLineNumber > 200) {
      return false;
    }

    currentLineNumber -= 1;
  }
  return false;
}

export function isTableContentLine(text) {
  if (!isTableRowLine(text)) {
    return false;
  }

  const cells = splitTableCells(text);
  return cells.some((cell) => cell.trim());
}

export function isTableRowLine(text) {
  if (!text.includes("|") || isTableDelimiterLine(text)) {
    return false;
  }

  const cells = splitTableCells(text);
  return cells.length >= 1;
}

export function isTableDelimiterLine(text) {
  if (!text.includes("|")) {
    return false;
  }
  // GFM delimiter cells need only one dash, so alignment forms such as
  // ":-", "-:" and ":-:" must be recognized alongside ":---:".
  return /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/.test(text);
}

export function splitTableCells(text) {
  return splitMarkdownTableCells(text);
}

function computeMermaidBlocks(doc, options = {}) {
  const includeUnclosed = options.includeUnclosed === true;
  const blocks = [];
  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const openingLine = doc.line(lineNumber);
    const opening = parseMermaidOpeningFence(openingLine.text);
    if (!opening) {
      continue;
    }

    const codeLines = [];
    let closingLine = null;

    // Respect the opening fence character and length so diagrams inside longer
    // fences do not close too early. Azure DevOps also accepts ::: mermaid
    // blocks, so treat colon fences as first-class Mermaid containers here.
    for (
      let nextLineNumber = lineNumber + 1;
      nextLineNumber <= doc.lines;
      nextLineNumber += 1
    ) {
      const nextLine = doc.line(nextLineNumber);
      if (isMatchingClosingFence(nextLine.text, opening)) {
        closingLine = nextLine;
        break;
      }
      codeLines.push(nextLine.text);
    }

    if (!closingLine && !includeUnclosed) {
      continue;
    }

    const endLine = closingLine || doc.line(doc.lines);
    const signatureLines = [openingLine.text, ...codeLines];
    if (closingLine) {
      signatureLines.push(closingLine.text);
    }

    blocks.push({
      from: openingLine.from,
      to: endLine.to,
      sourceTo: endLine.to,
      sourceLineCount: endLine.number - openingLine.number + 1,
      code: codeLines.join("\n").trim(),
      signature: signatureLines.join("\n"),
      fenceChar: opening.char,
      fenceLength: opening.length,
      closed: Boolean(closingLine),
    });
    lineNumber = endLine.number;
  }
  return blocks;
}

function parseMermaidOpeningFence(text) {
  const opening = text.match(
    /^\s{0,3}((?:`{3,})|(?:~{3,})|(?::{3,}))\s*mermaid\b.*$/i,
  );
  if (!opening) {
    return null;
  }
  return {
    marker: opening[1],
    char: opening[1][0],
    length: opening[1].length,
  };
}

function isMatchingClosingFence(text, opening) {
  const closing = text.match(/^\s{0,3}((?:`{3,})|(?:~{3,})|(?::{3,}))\s*$/);
  return Boolean(
    closing &&
      closing[1][0] === opening.char &&
      closing[1].length >= opening.length,
  );
}

export function parseMarkdownCodeFenceOpening(text) {
  const standardFence = text.match(/^\s{0,3}((?:`{3,})|(?:~{3,}))/);
  if (standardFence) {
    return {
      marker: standardFence[1],
      char: standardFence[1][0],
      length: standardFence[1].length,
    };
  }

  return parseMermaidOpeningFence(text);
}

export function isMatchingMarkdownCodeFenceClosing(text, opening) {
  return isMatchingClosingFence(text, opening);
}

export function isEditingMermaidBlock(mermaidBlock, activeEdit, selection) {
  if (!activeEdit || activeEdit.from !== mermaidBlock.from) {
    return false;
  }

  return selection.ranges.some(
    (range) => range.from >= mermaidBlock.from && range.to <= mermaidBlock.sourceTo,
  );
}

function computeGherkinBlocks(doc) {
  const blocks = [];
  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const openingLine = doc.line(lineNumber);
    const opening = openingLine.text.match(
      /^\s{0,3}(`{3,}|~{3,})\s*(?:gherkin|feature|cucumber)\b.*$/i,
    );
    if (!opening) {
      continue;
    }

    const fenceMarker = opening[1];
    const fenceChar = fenceMarker[0];
    const fenceLength = fenceMarker.length;
    const codeLines = [];
    let closingLine = null;

    for (
      let nextLineNumber = lineNumber + 1;
      nextLineNumber <= doc.lines;
      nextLineNumber += 1
    ) {
      const nextLine = doc.line(nextLineNumber);
      const closing = nextLine.text.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
      if (
        closing &&
        closing[1][0] === fenceChar &&
        closing[1].length >= fenceLength
      ) {
        closingLine = nextLine;
        break;
      }
      codeLines.push(nextLine.text);
    }

    if (!closingLine) {
      continue;
    }

    const signature = [openingLine.text, ...codeLines, closingLine.text].join(
      "\n",
    );
    blocks.push({
      from: openingLine.from,
      to: closingLine.to,
      sourceTo: closingLine.to,
      sourceLineCount: closingLine.number - openingLine.number + 1,
      code: codeLines.join("\n").trim(),
      signature,
      key: `${openingLine.from}:${signature}`,
    });
    lineNumber = closingLine.number;
  }
  return blocks;
}

export function isEditingGherkinBlock(gherkinBlock, activeEdit, selection) {
  if (!activeEdit || activeEdit.from !== gherkinBlock.from) {
    return false;
  }

  return selection.ranges.some(
    (range) =>
      range.from >= gherkinBlock.from && range.to <= gherkinBlock.sourceTo,
  );
}

function computeTableBlocks(doc) {
  const blocks = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const fence = parseMarkdownCodeFenceOpening(line.text);
    if (!inFence && fence) {
      inFence = true;
      fenceChar = fence.char;
      fenceLength = fence.length;
      continue;
    }

    if (inFence) {
      const closing = isMatchingMarkdownCodeFenceClosing(line.text, {
        char: fenceChar,
        length: fenceLength,
      });
      if (closing) {
        inFence = false;
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }

    // Tables inside code fences should remain plain code, not rich table UI.
    if (inFence || lineNumber >= doc.lines || !isTableContentLine(line.text)) {
      continue;
    }

    const delimiterLine = doc.line(lineNumber + 1);
    if (!isTableDelimiterLine(delimiterLine.text)) {
      continue;
    }

    const bodyLines = [];
    let lastLine = delimiterLine;
    let nextLineNumber = lineNumber + 2;
    while (nextLineNumber <= doc.lines) {
      const nextLine = doc.line(nextLineNumber);
      if (!isTableRowLine(nextLine.text)) {
        break;
      }
      bodyLines.push(nextLine);
      lastLine = nextLine;
      nextLineNumber += 1;
    }

    blocks.push(
      createTableBlock(doc, line, delimiterLine, bodyLines, lastLine),
    );
    lineNumber = nextLineNumber - 1;
  }

  return blocks;
}

export function createTableBlock(doc, headerLine, delimiterLine, bodyLines, lastLine) {
  const headerRow = scanMarkdownTableRow(headerLine.text);
  const headerCells = parseTableCells(headerLine);
  const delimiterCells = parseTableCells(delimiterLine);
  const bodyRows = bodyLines.map((line) => ({
    role: "body",
    line,
    cells: parseTableCells(line),
  }));
  const columnCount = Math.max(
    headerCells.length,
    delimiterCells.length,
    ...bodyRows.map((row) => row.cells.length),
  );
  const alignments = Array.from({ length: columnCount }, (_, index) =>
    parseTableAlignment(delimiterCells[index]?.text || ""),
  );
  const rows = [
    {
      role: "header",
      line: headerLine,
      cells: normalizeTableCells(headerCells, columnCount),
    },
    ...bodyRows.map((row) => ({
      ...row,
      cells: normalizeTableCells(row.cells, columnCount),
    })),
  ];

  return {
    from: headerLine.from,
    to: lastLine.to,
    sourceTo: lastLine.to,
    signature: [
      headerLine.text,
      delimiterLine.text,
      ...bodyLines.map((line) => line.text),
    ].join("\n"),
    columnCount,
    alignments,
    indent: headerRow.indent,
    usesLeadingPipe: headerRow.usesLeadingPipe,
    usesTrailingPipe: headerRow.usesTrailingPipe,
    rows,
    sourceRows: [
      { role: "header", line: headerLine },
      { role: "delimiter", line: delimiterLine },
      ...bodyLines.map((line) => ({ role: "body", line })),
    ],
  };
}

export function parseTableCells(line) {
  return scanMarkdownTableRow(line.text).cells.map((cell) => {
    const raw = line.text.slice(cell.from, cell.to);
    const leadingLength = raw.match(/^\s*/)[0].length;
    const trailingLength = raw.match(/\s*$/)[0].length;
    // Keep both trimmed text and source offsets so rich cell editors can focus
    // back to the exact Markdown cell they represent.
    const contentFrom = line.from + cell.from + leadingLength;
    const contentTo = line.from + cell.to - trailingLength;
    return {
      text: cell.text,
      from: Math.min(contentFrom, contentTo),
      to: Math.max(contentFrom, contentTo),
    };
  });
}

export function normalizeTableCells(cells, columnCount) {
  return Array.from(
    { length: columnCount },
    (_, index) => cells[index] || { text: "", from: null, to: null },
  );
}

export function parseTableAlignment(delimiterCell) {
  const value = delimiterCell.trim();
  const starts = value.startsWith(":");
  const ends = value.endsWith(":");
  if (starts && ends) return "center";
  if (ends) return "right";
  return "left";
}

export function isEditingTableBlock(tableBlock, activeEdit, selection) {
  if (!activeEdit || activeEdit.from !== tableBlock.from) {
    return false;
  }

  const inside = selection.ranges.some(
    (range) => range.from >= tableBlock.from && range.to <= tableBlock.sourceTo,
  );
  if (!inside) {
    return false;
  }

  return true;
}

export function selectionInsideRange(selection, from, to) {
  return selection.ranges.some((range) => range.from >= from && range.to <= to);
}
