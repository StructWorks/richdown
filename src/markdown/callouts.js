// GitHub alerts and Obsidian callouts.
//
// Both are block quotes whose first line is a "[!type]" marker:
//
//   > [!NOTE]                 GitHub: NOTE, TIP, IMPORTANT, WARNING, CAUTION
//   > Useful information.
//
//   > [!faq]- Title           Obsidian: any type, an optional title, and "+" or
//   > Body                    "-" to make it foldable (open or closed at first)
//
// One parser serves both: a GitHub alert is a callout of one of GitHub's five
// types with no title and no fold sign, and it is drawn exactly like GitHub
// draws it. Everything else is drawn as an Obsidian callout. Types are
// case-insensitive, and unknown types look like "note". DOM-free, so the rich
// editor and the Richdown diff share it.

const QUOTE_LINE = /^( {0,3}> ?)/;
const MARKER = /^\[!([^\]\s]+)\]([+-]?)(?:[ \t]+(.*?))?[ \t]*$/;

// GitHub's alert types take precedence over Obsidian's aliases of the same name
// (Obsidian treats "important" as tip and "caution" as warning), so a GitHub
// alert always looks the way GitHub draws it.
const githubTitles = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
};

const calloutKinds = {
  note: { color: "blue", icon: "info" },
  tip: { color: "green", icon: "lightBulb" },
  important: { color: "purple", icon: "report" },
  warning: { color: "yellow", icon: "alert" },
  caution: { color: "red", icon: "stop" },
  abstract: { color: "cyan", icon: "list" },
  info: { color: "blue", icon: "info" },
  todo: { color: "blue", icon: "checkCircle" },
  success: { color: "green", icon: "check" },
  question: { color: "yellow", icon: "question" },
  failure: { color: "red", icon: "x" },
  danger: { color: "red", icon: "zap" },
  bug: { color: "red", icon: "bug" },
  example: { color: "purple", icon: "list" },
  quote: { color: "gray", icon: "quote" },
};

const calloutAliases = {
  summary: "abstract",
  tldr: "abstract",
  hint: "tip",
  check: "success",
  done: "success",
  help: "question",
  faq: "question",
  attention: "warning",
  fail: "failure",
  missing: "failure",
  error: "danger",
  cite: "quote",
};

// 16px icons. GitHub's five are its Octicons; the rest follow the same grid.
const calloutIcons = {
  info: {
    fill: "M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
  },
  lightBulb: {
    fill: "M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z",
  },
  report: {
    fill: "M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  },
  alert: {
    fill: "M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  },
  stop: {
    fill: "M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
  },
  list: { stroke: "M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" },
  check: { stroke: "M2.75 8.5l3.5 3.5 7-7.5" },
  checkCircle: { stroke: "M8 1.25a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM5 8.25l2 2 4-4.25" },
  question: {
    stroke: "M8 1.25a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM6 6.25a2 2 0 1 1 2.9 1.8c-.55.27-.9.7-.9 1.3v.4M8 11.75h.01",
  },
  x: { stroke: "M3.75 3.75l8.5 8.5M12.25 3.75l-8.5 8.5" },
  zap: { stroke: "M9.25 1.25 3 9h4.5l-.75 5.75L13 7H8.5l.75-5.75Z" },
  bug: {
    stroke: "M5.5 5.5a2.5 2.5 0 0 1 5 0M4.75 6.5h6.5v3.25a3.25 3.25 0 0 1-6.5 0ZM8 6.5v6.5M1.75 8.5h3M11.25 8.5h3M2.5 4.5l2.25 2M13.5 4.5l-2.25 2M2.5 13l2.5-1.75M13.5 13 11 11.25",
  },
  quote: {
    stroke: "M2.75 7.25h3.5v4h-3.5v-4c0-2 1-3.25 3-3.75M9.75 7.25h3.5v4h-3.5v-4c0-2 1-3.25 3-3.75",
  },
};

// Splits one quote level off a line: { prefix, content } or null when the
// line is not a quote line.
export function stripQuoteMarker(text) {
  const match = QUOTE_LINE.exec(text);
  if (!match) {
    return null;
  }
  return { prefix: match[1], content: text.slice(match[1].length) };
}

// The callout a quote's first line starts, from the text after its ">":
// { type, kind, color, icon, title, foldable, collapsed, github } or null.
export function parseCalloutMarker(content) {
  const match = MARKER.exec(String(content ?? "").trim());
  if (!match) {
    return null;
  }
  const type = match[1].toLowerCase();
  const sign = match[2];
  const customTitle = match[3]?.trim() || "";
  const kindName = calloutKinds[type] ? type : calloutAliases[type] || "note";
  const kind = calloutKinds[kindName];
  const github = Boolean(githubTitles[type]) && !sign && !customTitle;
  return {
    type,
    kind: kindName,
    color: kind.color,
    icon: kind.icon,
    title:
      customTitle ||
      (github ? githubTitles[type] : `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}`),
    foldable: Boolean(sign),
    collapsed: sign === "-",
    github,
  };
}

// The callouts among `lines` (strings), top level only: each is
// { start, end, marker, body } with inclusive line indexes and `body` holding
// the lines after the marker with one quote level removed, as
// { index, text, offset } where offset is the column the text starts at.
// Fenced code is skipped, so a quote inside a code block is not a callout.
// The body can contain more callouts; call findCallouts on the body texts.
export function findCallouts(lines) {
  const callouts = [];
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(text);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }
    // The marker must open the quote, so a quote line right after another
    // quote line continues that quote instead.
    const quote = stripQuoteMarker(text);
    if (!quote || (index > 0 && stripQuoteMarker(lines[index - 1]))) {
      continue;
    }
    const marker = parseCalloutMarker(quote.content);
    if (!marker) {
      continue;
    }
    let end = index;
    const body = [];
    while (end + 1 < lines.length) {
      const next = stripQuoteMarker(lines[end + 1]);
      if (!next) {
        break;
      }
      end += 1;
      body.push({ index: end, text: next.content, offset: next.prefix.length });
    }
    callouts.push({ start: index, end, marker, body });
    index = end;
  }
  return callouts;
}

export function calloutIconSvg(iconName, className = "") {
  const icon = calloutIcons[iconName] || calloutIcons.info;
  const classAttribute = className ? ` class="${className}"` : "";
  const shape = icon.fill
    ? `<path fill="currentColor" d="${icon.fill}"></path>`
    : `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="${icon.stroke}"></path>`;
  return `<svg${classAttribute} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${shape}</svg>`;
}

// GitHub's alert colors for light and dark themes, plus matching cyan and gray
// for Obsidian's extra types. `darkSelectors` lists the selectors under which
// the page is dark.
const calloutPalette = {
  blue: ["#0969da", "#4493f8"],
  green: ["#1a7f37", "#3fb950"],
  purple: ["#8250df", "#ab7df8"],
  yellow: ["#9a6700", "#d29922"],
  red: ["#d1242f", "#f85149"],
  cyan: ["#0a7f8c", "#39c5cf"],
  gray: ["#59636e", "#9198a1"],
};

export const calloutColors = Object.keys(calloutPalette);

export function calloutThemeCss(darkSelectors) {
  const variables = (variant) =>
    calloutColors
      .map((color) => `--rip-callout-${color}: ${calloutPalette[color][variant]};`)
      .join(" ");
  return `
    :root { ${variables(0)} }
    ${darkSelectors.join(",\n    ")} { ${variables(1)} }
  `;
}

// Selectors for a dark page in the editor and the diff: the dark Richdown
// themes, and the default theme under a dark VS Code theme.
export const darkThemeSelectors = [
  ':root[data-rich-theme="midnight"]',
  ':root[data-rich-theme="graphite"]',
  ':root[data-rich-theme="forest"]',
  ':root[data-rich-theme="default"] body.vscode-dark',
  ':root[data-rich-theme="default"] body.vscode-high-contrast:not(.vscode-high-contrast-light)',
];
