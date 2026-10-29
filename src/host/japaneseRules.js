// Japanese writing rules shared by the linter and the formatter.
//
// A line rule's `find(text, options)` returns problems { from, to, message,
// fixes? } on one line of prose, where `fixes` is a list of { from, to, text }
// replacements. The formatter applies exactly those replacements, so a line it
// has fixed raises no warning from the same rule. `text` is the line after
// maskNonProse: code spans, URLs, link destinations, HTML tags, and wikilink
// targets are hidden, so rules only see prose, and columns are unchanged.
//
// The rules follow the ideas of textlint's Japanese presets (JTF style,
// ja-technical-writing) without depending on them.

const { maskInlineCode } = require("./markdownStructure");

// Masked characters are replaced with this, which no rule treats as Japanese,
// alphanumeric, whitespace, or punctuation.
const MASK = "\uFFFF";

// Kana, kanji, and the iteration marks. The long vowel mark (ー) counts;
// punctuation such as 、。「」・ does not.
const JA = "\\u3005-\\u3007\\u3041-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\u{20000}-\\u{3FFFD}";
const JA_CHAR = new RegExp(`[${JA}]`, "u");

// Lines whose text is prose: everything but code, front matter, HTML, comments,
// and table delimiter rows.
const proseKinds = new Set(["text", "heading", "list-item", "quote", "table-header", "table-row"]);

function isProseLine(info) {
  return proseKinds.has(info.kind);
}

function maskNonProse(lineText) {
  let text = maskInlineCode(lineText, MASK);
  const mask = (pattern, group) => {
    text = text.replace(pattern, (...match) => {
      const whole = match[0];
      if (group === undefined) {
        return MASK.repeat(whole.length);
      }
      const part = match[group];
      const at = whole.indexOf(part);
      return `${whole.slice(0, at)}${MASK.repeat(part.length)}${whole.slice(at + part.length)}`;
    });
  };
  // Link reference definitions: "[id]: url "title"".
  mask(/^(\s*\[[^\]]+\]:)(.*)$/, 2);
  // Autolinks and HTML tags, including comments such as lint directives.
  mask(/<!--.*?-->|<\/?[A-Za-z][^<>]*>|<[A-Za-z][A-Za-z0-9+.-]*:[^<>\s]*>/g);
  // Link and image destinations with their titles.
  mask(/\]\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, 1);
  // Wikilink targets; the alias after "|" is prose.
  mask(/\[\[([^\]|]*)/g, 1);
  // Bare URLs and email addresses. Only ASCII characters belong to them, so
  // Japanese text right after a URL stays prose.
  mask(/[A-Za-z][A-Za-z0-9+.-]*:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&*+,;=%]+/g);
  mask(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g);
  return text;
}

const toHalfWidth = (text) =>
  text.replace(/[！-～]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0),
  );
const toFullWidth = (text) =>
  text.replace(/[!-~]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 0xfee0));

function findMatches(text, pattern, build) {
  const problems = [];
  for (const match of text.matchAll(pattern)) {
    const problem = build(match);
    if (problem) {
      problems.push(problem);
    }
  }
  return problems;
}

function replacing(match, text, message) {
  const from = match.index;
  const to = from + match[0].length;
  return { from, to, message, fixes: [{ from, to, text }] };
}

const lineRules = {
  "ja-no-zenkaku-alnum": {
    find: (text) =>
      findMatches(text, /[Ａ-Ｚａ-ｚ０-９]+/g, (match) => {
        const half = toHalfWidth(match[0]);
        return replacing(match, half, `Use half-width "${half}" instead of full-width "${match[0]}".`);
      }),
  },

  "ja-space-between-half-and-full-width": {
    options: { space: { enum: ["never", "always"], default: "never" } },
    find(text, options) {
      if (options.space === "always") {
        return findMatches(
          text,
          new RegExp(`(?<=[${JA}])(?=[A-Za-z0-9])|(?<=[A-Za-z0-9])(?=[${JA}])`, "gu"),
          (match) => ({
            from: match.index - 1,
            to: match.index + 1,
            message: "Put a space between Japanese text and half-width alphanumerics.",
            fixes: [{ from: match.index, to: match.index, text: " " }],
          }),
        );
      }
      return findMatches(
        text,
        new RegExp(`(?<=[${JA}]) +(?=[A-Za-z0-9])|(?<=[A-Za-z0-9]) +(?=[${JA}])`, "gu"),
        (match) =>
          replacing(match, "", "Do not put a space between Japanese text and half-width alphanumerics."),
      );
    },
  },

  "ja-punctuation": {
    options: { style: { enum: ["、。", "，．"], default: "、。" } },
    find(text, options) {
      const [comma, period] = options.style === "，．" ? ["，", "．"] : ["、", "。"];
      const other = { "、": "，", "。": "．", "，": "、", "．": "。" };
      const wrong = new RegExp(`[${other[comma]}${other[period]}]`, "g");
      return findMatches(text, wrong, (match) => {
        // "３．５" and "1，000" are numbers, not punctuation.
        if (isDigit(text[match.index - 1]) && isDigit(text[match.index + 1])) {
          return null;
        }
        const wanted = other[match[0]];
        return replacing(match, wanted, `Use "${wanted}" instead of "${match[0]}".`);
      });
    },
  },

  "ja-no-halfwidth-kana": {
    find: (text) =>
      findMatches(text, /[｡-ﾟ]+/g, (match) => {
        const full = match[0].normalize("NFKC").replace(/゙/g, "゛").replace(/゚/g, "゜");
        return replacing(match, full, `Half-width katakana "${match[0]}"; use "${full}".`);
      }),
  },

  "ja-no-zenkaku-space": {
    find: (text) =>
      findMatches(text, /\u3000+/g, (match) => ({
        from: match.index,
        to: match.index + match[0].length,
        message: "Full-width space (U+3000).",
      })),
  },

  "ja-symbol-width": {
    options: { style: { enum: ["fullwidth", "halfwidth"], default: "fullwidth" } },
    find(text, options) {
      if (options.style === "halfwidth") {
        return findMatches(text, /[！？（）]/g, (match) => {
          const half = toHalfWidth(match[0]);
          return replacing(match, half, `Use half-width "${half}" instead of "${match[0]}".`);
        });
      }
      // Only symbols in Japanese text are converted: "!" or "?" right after
      // Japanese, and parentheses around Japanese. "![" starts an image and
      // "](" a link destination, which are Markdown, not punctuation.
      const marks = findMatches(text, new RegExp(`(?<=[${JA}])[!?]+(?!\\[)`, "gu"), (match) => {
        const full = toFullWidth(match[0]);
        return replacing(match, full, `Use full-width "${full}" after Japanese text.`);
      });
      const parentheses = findMatches(text, /(?<!\])\(([^()]*)\)/g, (match) => {
        if (!JA_CHAR.test(match[1])) {
          return null;
        }
        const from = match.index;
        const to = from + match[0].length;
        return {
          from,
          to,
          message: "Use full-width parentheses （） around Japanese text.",
          fixes: [
            { from, to: from + 1, text: "（" },
            { from: to - 1, to, text: "）" },
          ],
        };
      });
      return [...marks, ...parentheses];
    },
  },
};

function isDigit(character) {
  return Boolean(character) && /[0-9０-９]/.test(character);
}

// Replaces each { from, to, text } in `lineText`. Overlapping fixes after the
// first are skipped.
function applyFixes(lineText, fixes) {
  const sorted = [...fixes].sort((left, right) => left.from - right.from || left.to - right.to);
  let result = "";
  let cursor = 0;
  for (const fix of sorted) {
    if (fix.from < cursor) {
      continue;
    }
    result += lineText.slice(cursor, fix.from) + fix.text;
    cursor = fix.to;
  }
  return result + lineText.slice(cursor);
}

// 文体の混在: sentences ending in the です・ます style and the である style in
// one document. Only paragraph text is read. Headings, list items, table
// cells, and block quotes are often terse or quoted from elsewhere, so they
// are skipped, and so is text inside brackets (「」『』（）() and the like),
// which quotes or annotates rather than ends a sentence.
const mixedStyleOptions = {
  style: { enum: ["consistent", "desumasu", "dearu"], default: "consistent" },
};

const styleEndings = {
  desumasu:
    /(?:です|ます|でした|ました|ません|ませんでした|でしょう|ましょう|ください|下さい)(?:か|ね|よ|よね)?$/,
  dearu: /(?:である|であった|であろう|ではない|ではなかった|だった|だろう|だ)$/,
};
const styleNames = { desumasu: "です・ます", dearu: "である" };

const openingBrackets = "「『（(【［[〔“‘";
const closingBrackets = "」』）)】］]〕”’";

// `paragraphs` are lists of { line, text } with masked text.
function findMixedStyle(paragraphs, options) {
  const sentences = paragraphs.flatMap(findSentenceEnds);
  const counts = { desumasu: 0, dearu: 0 };
  sentences.forEach((sentence) => {
    counts[sentence.style] += 1;
  });
  let expected = options.style;
  if (expected !== "desumasu" && expected !== "dearu") {
    if (counts.desumasu === 0 || counts.dearu === 0) {
      return [];
    }
    expected =
      counts.desumasu === counts.dearu
        ? sentences[0].style
        : counts.desumasu > counts.dearu
          ? "desumasu"
          : "dearu";
  }
  const reason =
    options.style === expected
      ? `the configured style is "${styleNames[expected]}"`
      : `most of the document uses "${styleNames[expected]}"`;
  return sentences
    .filter((sentence) => sentence.style !== expected)
    .map((sentence) => ({
      line: sentence.line,
      from: sentence.from,
      to: sentence.to,
      message: `This sentence ends in the "${styleNames[sentence.style]}" style, but ${reason}.`,
    }));
}

function findSentenceEnds(paragraph) {
  // One string for the paragraph, with the line and column of each character.
  let text = "";
  const positions = [];
  paragraph.forEach(({ line, text: lineText }, index) => {
    if (index > 0) {
      text += "\n";
      positions.push(null);
    }
    for (let column = 0; column < lineText.length; column += 1) {
      text += lineText[column];
      positions.push({ line, column });
    }
  });
  const unbracketed = maskBrackets(text);
  const ends = [];
  const pattern = /[^。！？!?．]+/g;
  for (const match of unbracketed.matchAll(pattern)) {
    const body = match[0].replace(/[\s*_~\uFFFF]+$/u, "");
    for (const style of ["desumasu", "dearu"]) {
      const ending = styleEndings[style].exec(body);
      if (!ending) {
        continue;
      }
      const start = positions[match.index + ending.index];
      const last = positions[match.index + ending.index + ending[0].length - 1];
      if (start && last && start.line === last.line) {
        ends.push({ style, line: start.line, from: start.column, to: last.column + 1 });
      }
      break;
    }
  }
  return ends;
}

function maskBrackets(text) {
  let depth = 0;
  let result = "";
  for (const character of text) {
    if (openingBrackets.includes(character)) {
      depth += 1;
    }
    result += depth > 0 ? MASK.repeat(character.length) : character;
    if (closingBrackets.includes(character) && depth > 0) {
      depth -= 1;
    }
  }
  return result;
}

module.exports = {
  applyFixes,
  findMixedStyle,
  isProseLine,
  lineRules,
  maskNonProse,
  mixedStyleOptions,
};
