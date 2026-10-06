// Line-level Markdown structure shared by the formatter and the linter.
//
// The extension host has no Markdown parser (the webview's Lezer parser lives in
// a separate bundle), and the formatting and lint rules only need block
// structure: which lines are front matter, fenced code, HTML, headings, list
// items, tables, and block quotes. Classifying each line keeps every finding
// and every edit tied to a line number, which is what both callers report.
//
// The scanner follows CommonMark/GFM where it matters for those rules and
// deliberately stays simple elsewhere: indented code blocks are not detected
// (headings, lists, and tables indented four spaces are rare and are left
// alone because their regular expressions require at most three spaces), and
// table rows must contain a pipe, matching the rich editor's table preview.

const ATX_HEADING = /^( {0,3})(#{1,6})(?=[ \t]|$)(.*)$/;
// "##Heading". A single "#" is left alone: "#tag" and "#123" are hashtags and
// issue references far more often than headings missing their space.
const ATX_HEADING_MISSING_SPACE = /^ {0,3}#{2,6}[^#\s]/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST_ITEM = /^([ \t]*)([-*+]|(\d{1,9})([.)]))([ \t]+|$)/;
const FENCE_OPENING = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSING = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;
const BLOCK_QUOTE = /^ {0,3}>/;
const HTML_BLOCK_START = /^ {0,3}<\/?[A-Za-z][\w-]*(?:[\s/>]|$)/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
// CommonMark HTML blocks that may interrupt a paragraph (types 1-6). Any other
// tag at the start of a line (type 7) continues the paragraph instead.
const INTERRUPTING_HTML = new RegExp(
  "^ {0,3}(?:<(?:script|pre|style|textarea)(?:\\s|>|$)|<!--|<\\?|<![A-Za-z]|<!\\[CDATA\\[|</?(?:" +
    "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|" +
    "details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|" +
    "h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|" +
    "optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|" +
    "track|ul)(?:\\s|/?>|$))",
  "i",
);

function scanMarkdown(text) {
  const lines = String(text ?? "").split("\n");
  const infos = lines.map((lineText, index) => ({
    index,
    text: lineText,
    kind: "text",
    inList: false,
    inQuote: false,
  }));
  const headings = [];
  const fences = [];
  const tables = [];
  const listItems = [];

  let index = scanFrontMatter(lines, infos);
  let fence = null;
  let commentOpen = false;
  let listStack = [];
  let nextListId = 0;
  let pendingBlankLines = [];

  const previousInfo = (lineIndex) => (lineIndex > 0 ? infos[lineIndex - 1] : null);

  for (; index < lines.length; index += 1) {
    const info = infos[index];
    const lineText = lines[index];

    if (fence) {
      info.inList = fence.inList;
      if (isFenceClosing(lineText, fence)) {
        info.kind = "fence-close";
        fence.end = index;
        fence.closed = true;
        fence = null;
      } else {
        info.kind = "code";
      }
      continue;
    }

    if (commentOpen) {
      info.kind = "comment";
      info.inList = listStack.length > 0;
      if (lineText.includes("-->")) {
        commentOpen = false;
      }
      continue;
    }

    if (isBlank(lineText)) {
      info.kind = "blank";
      pendingBlankLines.push(info);
      continue;
    }

    const indent = measureIndent(lineText);
    const previous = previousInfo(index);
    const afterBlank = !previous || previous.kind === "blank";

    // Decide whether this line still belongs to the open lists before
    // classifying it, so an indented fence or list item can be recognized as
    // list content. Outside a list, a marker indented four or more columns is
    // paragraph continuation or indented code, not a list item.
    const listItemCandidate = matchListItem(lineText, previous);
    const listItemMatch =
      listItemCandidate && (listStack.length > 0 || listItemCandidate.indent <= 3)
        ? listItemCandidate
        : null;
    const listWasOpen = listStack.length > 0;
    if (listWasOpen && !listItemMatch && (afterBlank || startsInterruptingBlock(lineText))) {
      listStack = listStack.filter((list) => indent >= list.contentIndent);
    }
    // Blank lines belong to a list only when the list goes on after them.
    for (const blankInfo of pendingBlankLines) {
      blankInfo.inList = listItemMatch ? listWasOpen : listStack.length > 0;
    }
    pendingBlankLines = [];

    const fenceOpening = parseFenceOpening(lineText);
    if (fenceOpening && (fenceOpening.indent <= 3 || listStack.length > 0)) {
      info.kind = "fence-open";
      info.inList = listStack.length > 0;
      fence = {
        start: index,
        end: index,
        closed: false,
        inList: info.inList,
        ...fenceOpening,
      };
      info.fence = fence;
      fences.push(fence);
      continue;
    }

    if (/^\s*<!--/.test(lineText)) {
      info.kind = "comment";
      info.inList = listStack.length > 0;
      const afterOpening = lineText.slice(lineText.indexOf("<!--") + 4);
      commentOpen = !afterOpening.includes("-->");
      continue;
    }

    if (BLOCK_QUOTE.test(lineText)) {
      info.kind = "quote";
      info.inQuote = true;
      info.inList = listStack.length > 0;
      continue;
    }

    // Lazy continuation: paragraph text right after a quote line stays in the
    // quote.
    if (
      previous?.inQuote &&
      !startsInterruptingBlock(lineText) &&
      !LIST_ITEM.test(lineText)
    ) {
      info.kind = "quote";
      info.inQuote = true;
      continue;
    }

    // HTML blocks run until the next blank line. Inside a paragraph, only the
    // block-level tags start one.
    const paragraphOpen = previous?.kind === "text" || previous?.kind === "list-item";
    if (
      previous?.kind === "html" ||
      (HTML_BLOCK_START.test(lineText) && (!paragraphOpen || INTERRUPTING_HTML.test(lineText)))
    ) {
      info.kind = "html";
      info.inList = listStack.length > 0;
      continue;
    }

    const setext = SETEXT_UNDERLINE.exec(lineText);
    if (setext && previous?.kind === "text" && !previous.inList && !afterBlank) {
      markSetextHeading(infos, index, setext[1][0] === "=" ? 1 : 2, headings);
      continue;
    }

    if (THEMATIC_BREAK.test(lineText)) {
      info.kind = "thematic-break";
      info.inList = listStack.length > 0;
      continue;
    }

    if (listItemMatch) {
      const item = { line: index, ...listItemMatch };
      const sibling = placeListItem(listStack, item);
      if (sibling) {
        sibling.contentIndent = item.contentIndent;
        item.listId = sibling.id;
      } else {
        item.listId = nextListId;
        nextListId += 1;
        listStack.push({
          id: item.listId,
          indent: item.indent,
          contentIndent: item.contentIndent,
          ordered: item.ordered,
          delimiter: item.delimiter,
          bullet: item.bullet,
        });
      }
      item.depth = listStack.length - 1;
      info.kind = "list-item";
      info.inList = true;
      info.listItem = item;
      listItems.push(item);
      continue;
    }

    const atx = parseAtxHeading(lineText);
    if (atx) {
      info.kind = "heading";
      info.inList = listStack.length > 0;
      const heading = { line: index, endLine: index, style: "atx", ...atx };
      info.heading = heading;
      headings.push(heading);
      continue;
    }

    // Renderers disagree on a table that interrupts a paragraph inside a list
    // item, so such rows are left as paragraph text.
    const table = paragraphOpen && listStack.length > 0 ? null : matchTable(lines, index);
    if (table) {
      const inList = listStack.length > 0;
      for (let row = table.start; row <= table.end; row += 1) {
        infos[row].kind =
          row === table.start
            ? "table-header"
            : row === table.start + 1
              ? "table-delimiter"
              : "table-row";
        infos[row].inList = inList;
        infos[row].table = table;
      }
      table.inList = inList;
      tables.push(table);
      index = table.end;
      continue;
    }

    info.kind = "text";
    info.inList = listStack.length > 0;
    info.atxMissingSpace = ATX_HEADING_MISSING_SPACE.test(lineText);
  }

  return {
    lines: infos,
    headings: headings.sort((left, right) => left.line - right.line),
    fences,
    tables,
    listItems,
  };
}

// Front matter is a leading "---" block closed by "---" or "...". Its lines are
// YAML, so no Markdown rule applies to them.
function scanFrontMatter(lines, infos) {
  if (lines.length < 2 || lines[0].trimEnd() !== "---") {
    return 0;
  }
  for (let index = 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trimEnd();
    if (trimmed === "---" || trimmed === "...") {
      for (let row = 0; row <= index; row += 1) {
        infos[row].kind = "front-matter";
      }
      return index + 1;
    }
  }
  return 0;
}

function markSetextHeading(infos, underlineIndex, level, headings) {
  let start = underlineIndex - 1;
  while (
    start > 0 &&
    infos[start - 1].kind === "text" &&
    !infos[start - 1].inList
  ) {
    start -= 1;
  }
  const textLine = infos[start].text;
  const content = textLine.trim();
  const textFrom = textLine.indexOf(content);
  const heading = {
    line: start,
    endLine: underlineIndex,
    style: "setext",
    level,
    text: infos
      .slice(start, underlineIndex)
      .map((info) => info.text.trim())
      .join(" "),
    textFrom,
    textTo: textFrom + content.length,
    multiline: underlineIndex - start > 1,
  };
  for (let row = start; row < underlineIndex; row += 1) {
    infos[row].kind = "heading";
    infos[row].heading = heading;
  }
  infos[underlineIndex].kind = "setext-underline";
  infos[underlineIndex].heading = heading;
  headings.push(heading);
}

function parseAtxHeading(lineText) {
  const match = ATX_HEADING.exec(lineText);
  if (!match) {
    return null;
  }
  const [, indent, hashes, rest] = match;
  const contentStart = indent.length + hashes.length;
  let content = rest;
  const closing = /(?:^|[ \t]+)#+[ \t]*$/.exec(content);
  const hasClosingSequence = Boolean(closing);
  if (closing) {
    content = content.slice(0, closing.index);
  }
  const leadingSpace = content.match(/^[ \t]*/)[0];
  const textValue = content.trim();
  const textFrom = contentStart + leadingSpace.length;
  return {
    level: hashes.length,
    indent: indent.length,
    text: textValue,
    textFrom,
    textTo: textFrom + textValue.length,
    spaceAfterHashes: leadingSpace,
    hasClosingSequence,
  };
}

function parseFenceOpening(lineText) {
  const match = FENCE_OPENING.exec(lineText);
  if (!match) {
    return null;
  }
  const [, indentText, marker, info] = match;
  if (marker[0] === "`" && info.includes("`")) {
    return null;
  }
  return {
    indent: measureIndent(indentText),
    char: marker[0],
    length: marker.length,
    info: info.trim(),
  };
}

function isFenceClosing(lineText, fence) {
  const match = FENCE_CLOSING.exec(lineText);
  return Boolean(
    match && match[1][0] === fence.char && match[1].length >= fence.length,
  );
}

function matchListItem(lineText, previous) {
  if (THEMATIC_BREAK.test(lineText)) {
    return null;
  }
  const match = LIST_ITEM.exec(lineText);
  if (!match) {
    return null;
  }
  const [whole, indentText, marker, digits, delimiter, spacing] = match;
  const indent = measureIndent(indentText);
  const interruptsParagraph = previous?.kind === "text" && !previous.inList;
  const isEmpty = whole.length === lineText.length;
  // CommonMark only lets a list interrupt a paragraph when it starts with a
  // non-empty item, and an ordered one only when it starts at 1.
  if (interruptsParagraph && (isEmpty || (digits && Number(digits) !== 1))) {
    return null;
  }
  const spacingWidth = spacing.length === 0 || spacing.length > 4 ? 1 : spacing.length;
  return {
    indent,
    marker,
    ordered: Boolean(digits),
    number: digits ? Number(digits) : null,
    numberText: digits || "",
    delimiter: delimiter || "",
    bullet: digits ? "" : marker,
    markerFrom: indentText.length,
    markerTo: indentText.length + marker.length,
    contentIndent: indent + marker.length + spacingWidth,
  };
}

// Finds where a new list item sits in the open lists. Returns the list it
// continues as a sibling, or null when it opens a new (possibly nested) list;
// lists it closes are popped from the stack.
function placeListItem(listStack, item) {
  while (listStack.length > 0) {
    const top = listStack[listStack.length - 1];
    if (item.indent >= top.contentIndent) {
      return null;
    }
    if (item.indent >= top.indent) {
      const sameType =
        top.ordered === item.ordered &&
        (item.ordered ? top.delimiter === item.delimiter : top.bullet === item.bullet);
      if (sameType) {
        return top;
      }
      listStack.pop();
      return null;
    }
    listStack.pop();
  }
  return null;
}

function startsInterruptingBlock(lineText) {
  return (
    ATX_HEADING.test(lineText) ||
    THEMATIC_BREAK.test(lineText) ||
    BLOCK_QUOTE.test(lineText) ||
    Boolean(parseFenceOpening(lineText) && measureIndent(lineText) <= 3) ||
    INTERRUPTING_HTML.test(lineText)
  );
}

function matchTable(lines, index) {
  if (index + 1 >= lines.length) {
    return null;
  }
  const header = lines[index];
  const delimiter = lines[index + 1];
  if (!isTableRowText(header) || !isTableDelimiter(delimiter)) {
    return null;
  }
  if (!scanTableRow(header).cells.some((cell) => cell.text)) {
    return null;
  }
  // Body rows run until a blank line, a line without a pipe, or another
  // block. A delimiter-like row in the body is an ordinary row.
  let end = index + 1;
  while (
    end + 1 < lines.length &&
    lines[end + 1].includes("|") &&
    !isBlank(lines[end + 1]) &&
    !startsInterruptingBlock(lines[end + 1])
  ) {
    end += 1;
  }
  return { start: index, end };
}

function isTableRowText(lineText) {
  return lineText.includes("|") && !isTableDelimiter(lineText) && !isBlank(lineText);
}

function isTableDelimiter(lineText) {
  return lineText.includes("|") && TABLE_DELIMITER.test(lineText);
}

// A copy of the webview's scanMarkdownTableRow (src/markdown/tableCells.js):
// escaped pipes and pipes inside inline code are cell content. This module is
// CommonJS for the extension host, and the two bundles do not share modules.
function scanTableRow(lineText) {
  const indent = lineText.match(/^[\t ]*/)[0];
  let contentEnd = lineText.length;
  while (contentEnd > indent.length && /\s/.test(lineText[contentEnd - 1])) {
    contentEnd -= 1;
  }
  const usesLeadingPipe = lineText[indent.length] === "|";
  const contentStart = usesLeadingPipe ? indent.length + 1 : indent.length;
  const pipes = findCellPipes(lineText, contentStart, contentEnd);
  const usesTrailingPipe = pipes.length > 0 && pipes[pipes.length - 1] === contentEnd - 1;
  const cells = [];
  let cellStart = contentStart;
  for (const pipe of pipes) {
    cells.push({ from: cellStart, to: pipe, text: lineText.slice(cellStart, pipe).trim() });
    cellStart = pipe + 1;
  }
  if (!usesTrailingPipe) {
    cells.push({
      from: cellStart,
      to: contentEnd,
      text: lineText.slice(cellStart, contentEnd).trim(),
    });
  }
  return { indent, usesLeadingPipe, usesTrailingPipe, cells };
}

function findCellPipes(text, start, end) {
  const pipes = [];
  let codeRunLength = 0;
  for (let index = start; index < end; index += 1) {
    const character = text[index];
    if (character === "`" && !isEscaped(text, index)) {
      const runLength = countRun(text, index, "`");
      if (codeRunLength === 0 && hasClosingRun(text, index + runLength, runLength, end)) {
        codeRunLength = runLength;
      } else if (runLength === codeRunLength) {
        codeRunLength = 0;
      }
      index += runLength - 1;
      continue;
    }
    if (character === "|" && codeRunLength === 0 && !isEscaped(text, index)) {
      pipes.push(index);
    }
  }
  return pipes;
}

function isEscaped(text, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function countRun(text, start, character) {
  let end = start + 1;
  while (end < text.length && text[end] === character) {
    end += 1;
  }
  return end - start;
}

function hasClosingRun(text, start, runLength, end) {
  for (let index = start; index < end; index += 1) {
    if (text[index] !== "`" || isEscaped(text, index)) {
      continue;
    }
    const length = countRun(text, index, "`");
    if (length === runLength) {
      return true;
    }
    index += length - 1;
  }
  return false;
}

// Replaces the content of inline code spans with spaces, so inline rules
// (links, images, URLs) do not match inside code while columns stay intact.
function maskInlineCode(lineText) {
  let result = "";
  let index = 0;
  while (index < lineText.length) {
    const character = lineText[index];
    if (character === "`" && !isEscaped(lineText, index)) {
      const runLength = countRun(lineText, index, "`");
      const closeAt = findClosingRun(lineText, index + runLength, runLength);
      if (closeAt >= 0) {
        result += " ".repeat(closeAt + runLength - index);
        index = closeAt + runLength;
        continue;
      }
      result += lineText.slice(index, index + runLength);
      index += runLength;
      continue;
    }
    result += character;
    index += 1;
  }
  return result;
}

function findClosingRun(text, start, runLength) {
  for (let index = start; index < text.length; index += 1) {
    if (text[index] !== "`") {
      continue;
    }
    const length = countRun(text, index, "`");
    if (length === runLength) {
      return index;
    }
    index += length - 1;
  }
  return -1;
}

// Visible width of text in a monospace editor: East Asian wide and fullwidth
// characters, and most emoji, take two columns. Table alignment and the line
// length rule both measure with this so Japanese and Chinese text line up.
function displayWidth(text) {
  let width = 0;
  for (const character of String(text)) {
    const codePoint = character.codePointAt(0);
    if (codePoint === 0x200d || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)) {
      continue;
    }
    if (codePoint >= 0x300 && codePoint <= 0x36f) {
      continue;
    }
    width += isWideCodePoint(codePoint) ? 2 : 1;
  }
  return width;
}

function isWideCodePoint(codePoint) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
    (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

function measureIndent(text) {
  let width = 0;
  for (const character of text) {
    if (character === " ") {
      width += 1;
    } else if (character === "\t") {
      width += 4 - (width % 4);
    } else {
      break;
    }
  }
  return width;
}

function isBlank(text) {
  return /^\s*$/.test(text);
}

// GitHub's heading anchor rules, matching slugifyHeading in the webview's
// completions module: lowercase, drop punctuation, join words with dashes.
function slugifyHeading(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

module.exports = {
  displayWidth,
  isBlank,
  isTableDelimiter,
  maskInlineCode,
  measureIndent,
  parseAtxHeading,
  scanMarkdown,
  scanTableRow,
  slugifyHeading,
};
