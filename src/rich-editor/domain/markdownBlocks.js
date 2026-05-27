// Pure Markdown block analysis for the rich editor.
//
// This module deliberately has no DOM or CodeMirror decoration dependency. It
// turns a CodeMirror document into semantic ranges that presentation modules can
// replace with richer UI while preserving source positions for editing.

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

export function findDetailsBlocks(doc) {
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
  return body
    .replace(/<\/?div\b[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\r?\n/)
    .map((line) => stripHtmlTags(line).trim())
    .filter(Boolean)
    .map((line) => ({ text: line, sourceFrom: null }));
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
  return cells.length >= 2;
}

export function isTableDelimiterLine(text) {
  if (!text.includes("|")) {
    return false;
  }
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(text);
}

export function splitTableCells(text) {
  return text.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
}

export function findMermaidBlocks(doc) {
  const blocks = [];
  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const openingLine = doc.line(lineNumber);
    const opening = openingLine.text.match(/^\s{0,3}(`{3,}|~{3,})\s*mermaid\b.*$/i);
    if (!opening) {
      continue;
    }

    const fenceMarker = opening[1];
    const fenceChar = fenceMarker[0];
    const fenceLength = fenceMarker.length;
    const codeLines = [];
    let closingLine = null;

    // Respect the opening fence character and length so diagrams inside longer
    // fences do not close too early.
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

    blocks.push({
      from: openingLine.from,
      to: closingLine.number < doc.lines
        ? doc.line(closingLine.number + 1).from
        : closingLine.to,
      sourceTo: closingLine.to,
      sourceLineCount: closingLine.number - openingLine.number + 1,
      code: codeLines.join("\n").trim(),
      signature: [
        openingLine.text,
        ...codeLines,
        closingLine.text,
      ].join("\n"),
    });
    lineNumber = closingLine.number;
  }
  return blocks;
}

export function isEditingMermaidBlock(mermaidBlock, activeEdit, selection) {
  if (!activeEdit || activeEdit.from !== mermaidBlock.from) {
    return false;
  }

  return selection.ranges.some(
    (range) => range.from >= mermaidBlock.from && range.to <= mermaidBlock.sourceTo,
  );
}

export function findTableBlocks(doc) {
  const blocks = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const fence = line.text.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        fenceLength = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLength) {
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
    usesLeadingPipe: headerLine.text.trimStart().startsWith("|"),
    usesTrailingPipe: headerLine.text.trimEnd().endsWith("|"),
    rows,
    sourceRows: [
      { role: "header", line: headerLine },
      { role: "delimiter", line: delimiterLine },
      ...bodyLines.map((line) => ({ role: "body", line })),
    ],
  };
}

export function parseTableCells(line) {
  const text = line.text;
  let start = 0;
  let end = text.length;
  if (text[start] === "|") start += 1;
  if (text[end - 1] === "|") end -= 1;

  const cells = [];
  let cellStart = start;
  for (let index = start; index <= end; index += 1) {
    if (index !== end && text[index] !== "|") {
      continue;
    }

    const raw = text.slice(cellStart, index);
    const leadingLength = raw.match(/^\s*/)[0].length;
    const trailingLength = raw.match(/\s*$/)[0].length;
    // Keep both trimmed text and source offsets so rich cell editors can focus
    // back to the exact Markdown cell they represent.
    const contentFrom = line.from + cellStart + leadingLength;
    const contentTo = line.from + index - trailingLength;
    cells.push({
      text: raw.trim(),
      from: Math.min(contentFrom, contentTo),
      to: Math.max(contentFrom, contentTo),
    });
    cellStart = index + 1;
  }

  return cells;
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
