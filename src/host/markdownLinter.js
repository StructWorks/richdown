// Markdown linter for the extension host.
//
// Each rule reports problems as { line, from, to, message } with a zero-based
// line and character columns on that line; lintMarkdown adds the rule name and
// severity. Rules can be switched off or given a severity in .richdownrc.json
// (see src/host/markdownQualityConfig.js), and a document can silence them
// with HTML comments:
//
//   <!-- richdown-lint-disable-next-line rule-a rule-b -->
//   <!-- richdown-lint-disable rule-a -->  ...  <!-- richdown-lint-enable rule-a -->
//
// A directive without rule names applies to every rule.

const {
  displayWidth,
  isBlank,
  maskInlineCode,
  scanMarkdown,
  scanTableRow,
  slugifyHeading,
} = require("./markdownStructure");

const lintRules = [
  {
    name: "heading-increment",
    description: "Heading levels should only increase by one level at a time.",
    run: checkHeadingIncrement,
  },
  {
    name: "single-h1",
    description: "A document should have only one top-level (#) heading.",
    run: checkSingleH1,
  },
  {
    name: "no-duplicate-heading",
    description: "Sibling headings under the same parent should not share the same text.",
    run: checkDuplicateHeadings,
  },
  {
    name: "no-empty-heading",
    description: "Headings should have text.",
    run: checkEmptyHeadings,
  },
  {
    name: "heading-space",
    description: "ATX headings need exactly one space after the # marks.",
    run: checkHeadingSpace,
  },
  {
    name: "blanks-around-headings",
    description: "Headings should be surrounded by blank lines.",
    run: (context) => checkBlankLinesAround(context, findHeadingBlocks(context), "Heading"),
  },
  {
    name: "blanks-around-fences",
    description: "Fenced code blocks should be surrounded by blank lines.",
    run: (context) => checkBlankLinesAround(context, findFenceBlocks(context), "Code block"),
  },
  {
    name: "blanks-around-lists",
    description: "Lists should be surrounded by blank lines.",
    run: (context) => checkBlankLinesAround(context, findListBlocks(context), "List"),
  },
  {
    name: "blanks-around-tables",
    description: "Tables should be surrounded by blank lines.",
    run: (context) => checkBlankLinesAround(context, findTableBlocks(context), "Table"),
  },
  {
    name: "fenced-code-language",
    description: "Fenced code blocks should name a language, which Richdown uses for highlighting and Mermaid/Gherkin previews.",
    run: checkFenceLanguage,
  },
  {
    name: "unclosed-code-fence",
    description: "Fenced code blocks should be closed; an unclosed fence turns the rest of the document into code.",
    defaultSeverity: "error",
    run: checkUnclosedFences,
  },
  {
    name: "list-marker-style",
    description: "Bullet lists should use one marker.",
    options: { style: { enum: ["consistent", "-", "*", "+"], default: "consistent" } },
    run: checkListMarkerStyle,
  },
  {
    name: "ordered-list-numbering",
    description: "Ordered list items should be numbered sequentially, or all use the same number.",
    run: checkOrderedListNumbering,
  },
  {
    name: "table-column-count",
    description: "Table rows should have as many cells as the header row.",
    run: checkTableColumnCount,
  },
  {
    name: "no-empty-links",
    description: "Links should have a destination.",
    run: checkEmptyLinks,
  },
  {
    name: "no-reversed-links",
    description: "Links should be written [text](url), not (text)[url].",
    run: checkReversedLinks,
  },
  {
    name: "no-missing-image-alt",
    description: "Images should have alternate text.",
    defaultSeverity: "info",
    run: checkImageAlt,
  },
  {
    name: "no-broken-anchors",
    description: "Links to #anchors in the same document should match a heading.",
    run: checkAnchorLinks,
  },
  {
    name: "no-trailing-spaces",
    description: "Lines should not end with spaces or tabs, except two spaces for a hard line break.",
    run: checkTrailingSpaces,
  },
  {
    name: "no-hard-tabs",
    description: "Use spaces instead of tab characters outside code blocks.",
    run: checkHardTabs,
  },
  {
    name: "no-multiple-blanks",
    description: "Do not use more than one consecutive blank line.",
    run: checkMultipleBlankLines,
  },
  {
    name: "final-newline",
    description: "Documents should end with a single newline.",
    run: checkFinalNewline,
  },
  {
    name: "no-bare-urls",
    description: "URLs should be written as links or wrapped in <angle brackets>.",
    defaultEnabled: false,
    run: checkBareUrls,
  },
  {
    name: "line-length",
    description: "Lines outside code blocks and tables should not be longer than the limit. East Asian wide characters count as two columns.",
    defaultEnabled: false,
    options: { max: { type: "integer", minimum: 1, default: 120 } },
    run: checkLineLength,
  },
];

const severities = ["error", "warning", "info", "hint"];

// `rules` maps a rule name to { severity, options }, or to null/undefined when
// the rule is off.
function lintMarkdown(text, rules) {
  const source = String(text ?? "");
  const structure = scanMarkdown(source);
  const suppressions = collectSuppressions(structure);
  const diagnostics = [];

  for (const rule of lintRules) {
    const setting = rules?.[rule.name];
    if (!setting) {
      continue;
    }
    const context = {
      source,
      structure,
      lines: structure.lines,
      options: setting.options || {},
    };
    for (const problem of rule.run(context)) {
      if (suppressions.isSuppressed(rule.name, problem.line)) {
        continue;
      }
      diagnostics.push({
        rule: rule.name,
        severity: setting.severity,
        line: problem.line,
        from: Math.max(0, problem.from ?? 0),
        to: Math.max(problem.from ?? 0, problem.to ?? structure.lines[problem.line].text.length),
        message: problem.message,
      });
    }
  }

  return diagnostics.sort(
    (left, right) => left.line - right.line || left.from - right.from,
  );
}

function collectSuppressions(structure) {
  const directive = /<!--\s*richdown-lint-(disable-next-line|disable|enable)\b([^>]*?)-->/g;
  const disabledByLine = [];
  const active = new Set();
  let allDisabled = false;
  const nextLine = new Map();

  structure.lines.forEach((info, index) => {
    if (info.kind !== "code" && info.kind !== "front-matter") {
      for (const match of info.text.matchAll(directive)) {
        const names = match[2].trim().split(/[\s,]+/).filter(Boolean);
        if (match[1] === "disable-next-line") {
          nextLine.set(index + 1, names.length > 0 ? new Set(names) : "all");
        } else if (match[1] === "disable") {
          if (names.length === 0) allDisabled = true;
          names.forEach((name) => active.add(name));
        } else if (names.length === 0) {
          allDisabled = false;
          active.clear();
        } else {
          names.forEach((name) => active.delete(name));
        }
      }
    }
    disabledByLine[index] = allDisabled ? "all" : new Set(active);
  });

  return {
    isSuppressed(ruleName, line) {
      const byRange = disabledByLine[line];
      const byNextLine = nextLine.get(line);
      return (
        byRange === "all" ||
        byRange?.has(ruleName) ||
        byNextLine === "all" ||
        Boolean(byNextLine?.has(ruleName))
      );
    },
  };
}

function checkHeadingIncrement({ structure }) {
  const problems = [];
  let previousLevel = 0;
  for (const heading of structure.headings) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) {
      problems.push(
        headingProblem(
          heading,
          `Heading level jumps from h${previousLevel} to h${heading.level}; expected h${previousLevel + 1}.`,
        ),
      );
    }
    previousLevel = heading.level;
  }
  return problems;
}

function checkSingleH1({ structure }) {
  return structure.headings
    .filter((heading) => heading.level === 1)
    .slice(1)
    .map((heading) =>
      headingProblem(heading, "Multiple top-level headings; use only one # heading per document."),
    );
}

function checkDuplicateHeadings({ structure }) {
  const problems = [];
  // One set of seen titles per open heading level: a heading's siblings are
  // the headings of its level under the same parent.
  const seenByLevel = [];
  for (const heading of structure.headings) {
    seenByLevel.length = heading.level + 1;
    const seen = (seenByLevel[heading.level] ||= new Set());
    const key = heading.text.trim().toLowerCase();
    if (key && seen.has(key)) {
      problems.push(headingProblem(heading, `Duplicate heading "${heading.text}" under the same parent.`));
    }
    seen.add(key);
  }
  return problems;
}

function checkEmptyHeadings({ structure }) {
  return structure.headings
    .filter((heading) => heading.style === "atx" && !heading.text)
    .map((heading) => ({
      line: heading.line,
      message: "Heading has no text.",
    }));
}

function checkHeadingSpace({ structure, lines }) {
  const problems = [];
  for (const heading of structure.headings) {
    if (heading.style === "atx" && heading.text && heading.spaceAfterHashes !== " ") {
      problems.push({
        line: heading.line,
        from: heading.indent,
        to: heading.textFrom,
        message: "Use exactly one space after the # marks of a heading.",
      });
    }
  }
  lines.forEach((info, index) => {
    if (info.atxMissingSpace && !info.inList && isStandAlone(lines, index)) {
      const hashes = /^ {0,3}#{2,6}/.exec(info.text)[0];
      problems.push({
        line: index,
        from: 0,
        to: info.text.trimEnd().length,
        message: `Missing space after "${hashes.trim()}"; this line is not a heading.`,
      });
    }
  });
  return problems;
}

function isStandAlone(lines, index) {
  const before = lines[index - 1];
  const after = lines[index + 1];
  return (!before || before.kind === "blank") && (!after || after.kind === "blank");
}

// Blocks are { first, last, reportLine } line ranges; `last` is null for a
// block with no end, such as an unclosed fence. Blocks nested in a list are
// part of the list and are left to the list rule.
function findHeadingBlocks({ structure, lines }) {
  return structure.headings
    .filter((heading) => !lines[heading.line].inList)
    .map((heading) => ({
    first: heading.line,
    last: heading.endLine,
    reportLine: heading.line,
  }));
}

function findFenceBlocks({ structure }) {
  return structure.fences
    .filter((fence) => !fence.inList)
    .map((fence) => ({
      first: fence.start,
      last: fence.closed ? fence.end : null,
      reportLine: fence.start,
    }));
}

function findListBlocks({ lines }) {
  const blocks = [];
  let current = null;
  lines.forEach((info, index) => {
    if (!info.inList) {
      current = null;
      return;
    }
    if (!current) {
      if (info.kind !== "list-item" || info.listItem.depth !== 0) {
        return;
      }
      current = { first: index, last: index, reportLine: index };
      blocks.push(current);
    }
    if (info.kind !== "blank") {
      current.last = index;
    }
  });
  return blocks;
}

function findTableBlocks({ structure }) {
  return structure.tables
    .filter((table) => !table.inList)
    .map((table) => ({ first: table.start, last: table.end, reportLine: table.start }));
}

function checkBlankLinesAround({ lines }, blocks, label) {
  const problems = [];
  for (const block of blocks) {
    const before = lines[block.first - 1];
    if (needsSeparation(before, lines[block.first])) {
      problems.push({
        line: block.reportLine,
        message: `${label} should be preceded by a blank line.`,
      });
    }
    if (block.last === null) {
      continue;
    }
    const after = lines[block.last + 1];
    if (needsSeparation(after, lines[block.last])) {
      problems.push({
        line: block.last,
        message: `${label} should be followed by a blank line.`,
      });
    }
  }
  return problems;
}

function needsSeparation(neighbor, edge) {
  return Boolean(
    neighbor &&
      neighbor.kind !== "blank" &&
      neighbor.kind !== "front-matter" &&
      !neighbor.inQuote &&
      !edge.inQuote,
  );
}

function checkFenceLanguage({ structure }) {
  return structure.fences
    .filter((fence) => !fence.info)
    .map((fence) => ({
      line: fence.start,
      message: "Fenced code block has no language; add one such as ```js or ```text.",
    }));
}

function checkUnclosedFences({ structure }) {
  return structure.fences
    .filter((fence) => !fence.closed)
    .map((fence) => ({
      line: fence.start,
      message: `Code fence is never closed; add a closing ${fence.char.repeat(fence.length)} line.`,
    }));
}

function checkListMarkerStyle({ structure, options }) {
  const bullets = structure.listItems.filter((item) => !item.ordered);
  const style = options.style && options.style !== "consistent" ? options.style : bullets[0]?.bullet;
  return bullets
    .filter((item) => item.bullet !== style)
    .map((item) => ({
      line: item.line,
      from: item.markerFrom,
      to: item.markerTo,
      message: `Use "${style}" for bullet list items instead of "${item.bullet}".`,
    }));
}

function checkOrderedListNumbering({ structure }) {
  const problems = [];
  const lists = new Map();
  for (const item of structure.listItems) {
    if (item.ordered) {
      if (!lists.has(item.listId)) lists.set(item.listId, []);
      lists.get(item.listId).push(item);
    }
  }
  for (const items of lists.values()) {
    const start = items[0].number;
    if (items.every((item) => item.number === start)) {
      continue;
    }
    items.forEach((item, position) => {
      const expected = start + position;
      if (item.number !== expected) {
        problems.push({
          line: item.line,
          from: item.markerFrom,
          to: item.markerTo,
          message: `List item number ${item.number} should be ${expected}.`,
        });
      }
    });
  }
  return problems;
}

function checkTableColumnCount({ structure, lines }) {
  const problems = [];
  for (const table of structure.tables) {
    const headerCount = scanTableRow(lines[table.start].text).cells.length;
    for (let index = table.start + 1; index <= table.end; index += 1) {
      const count = scanTableRow(lines[index].text).cells.length;
      if (count !== headerCount) {
        problems.push({
          line: index,
          message: `Row has ${count} ${count === 1 ? "cell" : "cells"}; the header has ${headerCount}.`,
        });
      }
    }
  }
  return problems;
}

function* inlineLines(lines) {
  for (const info of lines) {
    if (["code", "fence-open", "fence-close", "front-matter", "comment", "blank"].includes(info.kind)) {
      continue;
    }
    yield { info, text: maskInlineCode(info.text) };
  }
}

function checkEmptyLinks({ lines }) {
  const problems = [];
  for (const { info, text } of inlineLines(lines)) {
    for (const match of text.matchAll(/(?<!!)\[([^\]]*)\]\(\s*(#?)\s*\)/g)) {
      problems.push({
        line: info.index,
        from: match.index,
        to: match.index + match[0].length,
        message: "Link has no destination.",
      });
    }
  }
  return problems;
}

function checkReversedLinks({ lines }) {
  const problems = [];
  for (const { info, text } of inlineLines(lines)) {
    for (const match of text.matchAll(/(?<![\\\]])\(([^()\n]+)\)\[([^\]\n]+)\](?!\()/g)) {
      // "(note)[^1]" is a parenthetical followed by a footnote reference.
      if (match[2].startsWith("^")) {
        continue;
      }
      problems.push({
        line: info.index,
        from: match.index,
        to: match.index + match[0].length,
        message: `Reversed link syntax; write [${match[1]}](${match[2]}).`,
      });
    }
  }
  return problems;
}

function checkImageAlt({ lines }) {
  const problems = [];
  for (const { info, text } of inlineLines(lines)) {
    for (const match of text.matchAll(/!\[\s*\]\([^)]*\)/g)) {
      problems.push({
        line: info.index,
        from: match.index,
        to: match.index + match[0].length,
        message: "Image has no alternate text.",
      });
    }
    for (const match of text.matchAll(/<img\b(?![^>]*\balt\s*=)[^>]*>/gi)) {
      problems.push({
        line: info.index,
        from: match.index,
        to: match.index + match[0].length,
        message: "Image has no alt attribute.",
      });
    }
  }
  return problems;
}

function checkAnchorLinks({ structure, lines }) {
  const anchors = collectAnchors(structure);
  const problems = [];
  for (const { info, text } of inlineLines(lines)) {
    for (const match of text.matchAll(/\]\(\s*<?#([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const fragment = match[1];
      const wanted = normalizeAnchor(fragment);
      // Like the rich editor, accept an anchor written as heading text.
      if (isLineFragment(fragment) || anchors.has(wanted) || anchors.has(slugifyHeading(wanted))) {
        continue;
      }
      const from = match.index + match[0].indexOf("#");
      problems.push({
        line: info.index,
        from,
        to: from + fragment.length + 1,
        message: `No heading or anchor matches "#${fragment}".`,
      });
    }
  }
  return problems;
}

function collectAnchors(structure) {
  const anchors = new Set();
  const seen = new Map();
  for (const heading of structure.headings) {
    const base = slugifyHeading(heading.text);
    if (!base) {
      continue;
    }
    // GitHub dedupes repeated heading slugs with -1, -2, ... suffixes.
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    anchors.add(count > 0 ? `${base}-${count}` : base);
  }
  for (const info of structure.lines) {
    if (info.kind === "code") {
      continue;
    }
    for (const match of info.text.matchAll(/<[A-Za-z][^>]*\b(?:id|name)\s*=\s*["']([^"']+)["']/g)) {
      anchors.add(normalizeAnchor(match[1]));
    }
  }
  return anchors;
}

function normalizeAnchor(fragment) {
  let decoded = fragment;
  try {
    decoded = decodeURIComponent(fragment);
  } catch (error) {
    // Keep the fragment as written when it is not valid percent-encoding.
  }
  return decoded.toLowerCase();
}

// GitHub-style line links (#L12, #L12-L20) and VS Code-style #12 or #12,5,
// which Richdown resolves to lines rather than headings.
function isLineFragment(fragment) {
  return (
    /^L\d+(?:C\d+)?(?:-L?\d+(?:C\d+)?)?$/i.test(fragment) ||
    /^\d+(?:[,:]\d+)?$/.test(fragment)
  );
}

function checkTrailingSpaces({ lines }) {
  const problems = [];
  lines.forEach((info, index) => {
    if (info.kind === "code") {
      return;
    }
    const trailing = /[ \t]+$/.exec(info.text);
    if (!trailing || isHardBreak(lines, index, trailing[0])) {
      return;
    }
    problems.push({
      line: index,
      from: trailing.index,
      to: info.text.length,
      message: isBlank(info.text) ? "Blank line contains whitespace." : "Trailing whitespace.",
    });
  });
  return problems;
}

function isHardBreak(lines, index, trailing) {
  const info = lines[index];
  const after = lines[index + 1];
  return (
    trailing === "  " &&
    ["text", "list-item", "quote"].includes(info.kind) &&
    after !== undefined &&
    ["text", "quote"].includes(after.kind)
  );
}

function checkHardTabs({ lines }) {
  const problems = [];
  lines.forEach((info, index) => {
    if (["code", "fence-open", "fence-close"].includes(info.kind)) {
      return;
    }
    for (const match of info.text.matchAll(/\t+/g)) {
      problems.push({
        line: index,
        from: match.index,
        to: match.index + match[0].length,
        message: "Hard tab; use spaces.",
      });
    }
  });
  return problems;
}

function checkMultipleBlankLines({ lines }) {
  const problems = [];
  lines.forEach((info, index) => {
    if (info.kind === "blank" && lines[index - 1]?.kind === "blank") {
      // The empty last line of a document that ends with "\n" is not a
      // second blank line; final-newline reports extra trailing lines.
      if (index === lines.length - 1) {
        return;
      }
      problems.push({ line: index, message: "Multiple consecutive blank lines." });
    }
  });
  return problems;
}

function checkFinalNewline({ source, lines }) {
  if (source.length === 0) {
    return [];
  }
  if (!source.endsWith("\n")) {
    const last = lines.length - 1;
    return [{ line: last, from: lines[last].text.length, message: "Document should end with a newline." }];
  }
  if (/\n[ \t]*\n$/.test(source)) {
    let line = lines.length - 2;
    while (line > 0 && isBlank(lines[line - 1].text)) {
      line -= 1;
    }
    return [{ line, message: "Document should end with a single newline, not blank lines." }];
  }
  return [];
}

function checkBareUrls({ lines }) {
  const problems = [];
  for (const { info, text } of inlineLines(lines)) {
    if (info.kind === "html") {
      continue;
    }
    for (const match of text.matchAll(/https?:\/\/[^\s<>()[\]]+/g)) {
      const before = text.slice(0, match.index);
      // Inside a link destination, an autolink, an HTML attribute, or a
      // link reference definition.
      if (
        /\]\(\s*$/.test(before) ||
        /<$/.test(before) ||
        /=\s*["']?$/.test(before) ||
        /^\s*\[[^\]]+\]:\s*$/.test(before)
      ) {
        continue;
      }
      // The visible text of a link such as [https://example.com](...).
      if (/\[[^\]]*$/.test(before) && text.slice(match.index + match[0].length).startsWith("]")) {
        continue;
      }
      problems.push({
        line: info.index,
        from: match.index,
        to: match.index + match[0].length,
        message: "Bare URL; write it as <url> or [text](url).",
      });
    }
  }
  return problems;
}

function checkLineLength({ lines, options }) {
  const max = Number.isInteger(options.max) && options.max > 0 ? options.max : 120;
  const problems = [];
  lines.forEach((info, index) => {
    if (
      ["code", "fence-open", "fence-close", "front-matter", "html", "comment"].includes(info.kind) ||
      info.table
    ) {
      return;
    }
    const width = displayWidth(info.text);
    if (width <= max) {
      return;
    }
    const overflowFrom = findColumnOffset(info.text, max);
    // A long URL or other unbreakable word past the limit cannot be wrapped.
    if (!/\s/.test(info.text.slice(overflowFrom))) {
      return;
    }
    problems.push({
      line: index,
      from: overflowFrom,
      to: info.text.length,
      message: `Line is ${width} columns long; the limit is ${max}.`,
    });
  });
  return problems;
}

function findColumnOffset(text, column) {
  let width = 0;
  let offset = 0;
  for (const character of text) {
    width += displayWidth(character);
    if (width > column) {
      return offset;
    }
    offset += character.length;
  }
  return text.length;
}

function headingProblem(heading, message) {
  return {
    line: heading.line,
    from: heading.textFrom,
    to: Math.max(heading.textTo, heading.textFrom),
    message,
  };
}

module.exports = {
  lintMarkdown,
  lintRules,
  severities,
};
