// Shared Markdown table-row scanning.
//
// A plain String#split("|") is not sufficient here: escaped pipes and pipes
// inside inline-code spans are cell content, not column boundaries. Keeping the
// scanner DOM-free lets the editor, details preview, and rich diff agree.

export function scanMarkdownTableRow(text) {
  const indent = text.match(/^[\t ]*/)?.[0] || "";
  let contentEnd = text.length;
  while (contentEnd > indent.length && /\s/.test(text[contentEnd - 1])) {
    contentEnd -= 1;
  }

  const usesLeadingPipe = text[indent.length] === "|";
  const contentStart = usesLeadingPipe ? indent.length + 1 : indent.length;
  const delimiterIndexes = findTableDelimiterPipes(text, contentStart, contentEnd);
  const usesTrailingPipe = delimiterIndexes.at(-1) === contentEnd - 1;
  const cells = [];
  let cellStart = contentStart;

  for (const delimiterIndex of delimiterIndexes) {
    cells.push({
      from: cellStart,
      to: delimiterIndex,
      text: text.slice(cellStart, delimiterIndex).trim(),
    });
    cellStart = delimiterIndex + 1;
  }

  if (!usesTrailingPipe) {
    cells.push({
      from: cellStart,
      to: contentEnd,
      text: text.slice(cellStart, contentEnd).trim(),
    });
  }

  return {
    indent,
    usesLeadingPipe,
    usesTrailingPipe,
    cells,
  };
}

export function splitMarkdownTableCells(text, options = {}) {
  return scanMarkdownTableRow(text).cells.map((cell) =>
    options.unescapePipes ? unescapeMarkdownTableCellPipes(cell.text) : cell.text,
  );
}

export function unescapeMarkdownTableCellPipes(text) {
  let result = "";
  let codeFenceLength = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "`" && !isEscapedCharacter(text, index)) {
      const runLength = countCharacterRun(text, index, "`");
      if (
        codeFenceLength === 0 &&
        hasClosingBacktickRun(text, index + runLength, runLength)
      ) {
        codeFenceLength = runLength;
      } else if (runLength === codeFenceLength) {
        codeFenceLength = 0;
      }
      result += text.slice(index, index + runLength);
      index += runLength - 1;
      continue;
    }

    if (
      character === "|" &&
      codeFenceLength === 0 &&
      isEscapedCharacter(text, index)
    ) {
      result = result.slice(0, -1);
    }
    result += character;
  }
  return result;
}

export function escapeMarkdownTableCellPipes(text) {
  let result = "";
  let codeFenceLength = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "`" && !isEscapedCharacter(text, index)) {
      const runLength = countCharacterRun(text, index, "`");
      if (
        codeFenceLength === 0 &&
        hasClosingBacktickRun(text, index + runLength, runLength)
      ) {
        codeFenceLength = runLength;
      } else if (runLength === codeFenceLength) {
        codeFenceLength = 0;
      }
      result += text.slice(index, index + runLength);
      index += runLength - 1;
      continue;
    }

    if (
      character === "|" &&
      codeFenceLength === 0 &&
      !isEscapedCharacter(text, index)
    ) {
      result += "\\|";
      continue;
    }
    result += character;
  }

  return result;
}

function findTableDelimiterPipes(text, start, end) {
  const indexes = [];
  let codeFenceLength = 0;

  for (let index = start; index < end; index += 1) {
    const character = text[index];
    if (character === "`" && !isEscapedCharacter(text, index)) {
      const runLength = countCharacterRun(text, index, "`");
      if (
        codeFenceLength === 0 &&
        hasClosingBacktickRun(text, index + runLength, runLength, end)
      ) {
        codeFenceLength = runLength;
      } else if (runLength === codeFenceLength) {
        codeFenceLength = 0;
      }
      index += runLength - 1;
      continue;
    }
    if (
      character === "|" &&
      codeFenceLength === 0 &&
      !isEscapedCharacter(text, index)
    ) {
      indexes.push(index);
    }
  }

  return indexes;
}

function isEscapedCharacter(text, index) {
  let backslashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function countCharacterRun(text, start, character) {
  let end = start + 1;
  while (end < text.length && text[end] === character) {
    end += 1;
  }
  return end - start;
}

function hasClosingBacktickRun(text, start, runLength, end = text.length) {
  for (let index = start; index < end; index += 1) {
    if (text[index] !== "`" || isEscapedCharacter(text, index)) {
      continue;
    }
    const candidateLength = countCharacterRun(text, index, "`");
    if (candidateLength === runLength) {
      return true;
    }
    index += candidateLength - 1;
  }
  return false;
}
