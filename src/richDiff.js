import hljs from "highlight.js/lib/core";
import cssLanguage from "highlight.js/lib/languages/css";
import javascriptLanguage from "highlight.js/lib/languages/javascript";
import jsonLanguage from "highlight.js/lib/languages/json";
import typescriptLanguage from "highlight.js/lib/languages/typescript";
import xmlLanguage from "highlight.js/lib/languages/xml";

hljs.registerLanguage("css", cssLanguage);
hljs.registerLanguage("html", xmlLanguage);
hljs.registerLanguage("javascript", javascriptLanguage);
hljs.registerLanguage("js", javascriptLanguage);
hljs.registerLanguage("json", jsonLanguage);
hljs.registerLanguage("jsonc", jsonLanguage);
hljs.registerLanguage("ts", typescriptLanguage);
hljs.registerLanguage("tsx", typescriptLanguage);
hljs.registerLanguage("typescript", typescriptLanguage);
hljs.registerLanguage("xml", xmlLanguage);

const vscode = acquireVsCodeApi();
const root = document.querySelector("#diff");
const initialDiff = JSON.parse(
  document.querySelector("#initial-diff").textContent,
);
const initialSettings = JSON.parse(
  document.querySelector("#initial-settings").textContent,
);

const richThemeValues = [
  "default",
  "midnight",
  "graphite",
  "forest",
  "ivory",
  "paper",
  "solar",
];

let diffData = {
  leftText: initialDiff.leftText || "",
  rightText: initialDiff.rightText || "",
  leftLabel: initialDiff.leftLabel || "Base",
  rightLabel: initialDiff.rightLabel || "Working Tree",
  fileName: initialDiff.fileName || "Markdown",
  filePath: initialDiff.filePath || "",
};
let settings = normalizeSettings(initialSettings);
let imageRequestId = 0;
let copyPayloadId = 0;
let copyPayloads = new Map();
const pendingImageRequests = new Map();

injectStyles();
applyTheme(settings.richTheme);
renderDiff();

window.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "resolvedImage") {
    const pending = pendingImageRequests.get(event.data.requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeout);
    pendingImageRequests.delete(event.data.requestId);
    if (event.data.uri) {
      pending.element.innerHTML = `<img alt="${escapeAttribute(pending.alt)}" src="${escapeAttribute(event.data.uri)}">`;
    } else {
      pending.element.innerHTML = `<span class="rdiff-image-error">${escapeHtml(pending.alt || "Image could not be loaded")}</span>`;
    }
    return;
  }

  if (event.data.type === "settings") {
    settings = normalizeSettings({
      ...settings,
      ...event.data.settings,
    });
    applyTheme(settings.richTheme);
    renderDiff();
    return;
  }

  if (event.data.type === "updateRight" && typeof event.data.text === "string") {
    diffData = {
      ...diffData,
      rightText: event.data.text,
    };
    renderDiff();
  }
});

root.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-id]");
  if (copyButton) {
    const text = copyPayloads.get(copyButton.dataset.copyId);
    if (typeof text === "string") {
      vscode.postMessage({ type: "copyText", text });
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 900);
    }
    return;
  }

  const link = event.target.closest("a[data-href]");
  if (link) {
    event.preventDefault();
    vscode.postMessage({ type: "openLink", href: link.dataset.href });
  }
});

function normalizeSettings(nextSettings = {}) {
  return {
    richTheme: richThemeValues.includes(nextSettings.richTheme)
      ? nextSettings.richTheme
      : "default",
  };
}

function renderDiff() {
  copyPayloadId = 0;
  copyPayloads = new Map();
  pendingImageRequests.forEach((pending) => window.clearTimeout(pending.timeout));
  pendingImageRequests.clear();

  const leftLines = splitLines(diffData.leftText);
  const rightLines = splitLines(diffData.rightText);
  const rows = buildDiffRows(leftLines, rightLines);
  const stats = summarizeRows(rows);
  const leftMeta = analyzeMarkdownLines(leftLines);
  const rightMeta = analyzeMarkdownLines(rightLines);

  root.innerHTML = `
    <div class="rdiff-shell">
      <header class="rdiff-header">
        <div class="rdiff-title">
          <div class="rdiff-file">${escapeHtml(diffData.fileName)}</div>
          <div class="rdiff-path">${escapeHtml(diffData.filePath)}</div>
        </div>
        <div class="rdiff-stats" aria-label="Diff summary">
          <span class="rdiff-stat rdiff-stat-add">+${stats.added}</span>
          <span class="rdiff-stat rdiff-stat-delete">-${stats.deleted}</span>
          <span class="rdiff-stat">${stats.changed} changed lines</span>
        </div>
      </header>
      <div class="rdiff-column-header" aria-hidden="true">
        <div>${escapeHtml(diffData.leftLabel)}</div>
        <div>${escapeHtml(diffData.rightLabel)}</div>
      </div>
      <main class="rdiff-body">
        ${rows.length ? rows.map((row) => renderDiffRow(row, leftMeta, rightMeta)).join("") : renderEmptyDiff()}
      </main>
    </div>
  `;

  resolveImages();
}

function renderEmptyDiff() {
  return `
    <div class="rdiff-empty">
      <div class="rdiff-empty-title">No changes</div>
      <div class="rdiff-empty-copy">The Markdown content matches the selected base.</div>
    </div>
  `;
}

function renderDiffRow(row, leftMeta, rightMeta) {
  const rowClass = `rdiff-row is-${row.type}`;
  return `
    <div class="${rowClass}">
      ${renderSide(row.left, leftMeta, "left", row.type)}
      ${renderSide(row.right, rightMeta, "right", row.type)}
    </div>
  `;
}

function renderSide(line, metaByLine, side, rowType) {
  const sideType = getSideType(side, rowType);
  const lineNumber = line ? String(line.number) : "";
  const marker = getSideMarker(side, rowType);
  const meta = line ? metaByLine.get(line.number) : null;
  const content = line ? renderMarkdownLine(line.text, meta) : "";
  return `
    <section class="rdiff-side rdiff-${side} is-${sideType}">
      <div class="rdiff-line-number">${lineNumber}</div>
      <div class="rdiff-marker">${marker}</div>
      <div class="rdiff-content">${content}</div>
    </section>
  `;
}

function getSideType(side, rowType) {
  if (rowType === "equal") return "equal";
  if (rowType === "delete") return side === "left" ? "delete" : "empty";
  if (rowType === "insert") return side === "right" ? "insert" : "empty";
  return side === "left" ? "delete" : "insert";
}

function getSideMarker(side, rowType) {
  if (rowType === "delete" && side === "left") return "-";
  if (rowType === "insert" && side === "right") return "+";
  if (rowType === "replace" && side === "left") return "-";
  if (rowType === "replace" && side === "right") return "+";
  return "";
}

function splitLines(text) {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) {
    lines.pop();
  }
  return lines;
}

function buildDiffRows(leftLines, rightLines) {
  const operations = diffLineOperations(leftLines, rightLines);
  const rows = [];
  let index = 0;

  while (index < operations.length) {
    const operation = operations[index];
    if (operation.type === "equal") {
      rows.push({
        type: "equal",
        left: operation.left,
        right: operation.right,
      });
      index += 1;
      continue;
    }

    const deleted = [];
    const inserted = [];
    while (index < operations.length && operations[index].type !== "equal") {
      if (operations[index].type === "delete") {
        deleted.push(operations[index].left);
      } else {
        inserted.push(operations[index].right);
      }
      index += 1;
    }

    const length = Math.max(deleted.length, inserted.length);
    for (let offset = 0; offset < length; offset += 1) {
      rows.push({
        type:
          deleted[offset] && inserted[offset]
            ? "replace"
            : deleted[offset]
              ? "delete"
              : "insert",
        left: deleted[offset] || null,
        right: inserted[offset] || null,
      });
    }
  }

  return rows;
}

function diffLineOperations(leftLines, rightLines) {
  const operations = [];
  let prefix = 0;
  while (
    prefix < leftLines.length &&
    prefix < rightLines.length &&
    leftLines[prefix] === rightLines[prefix]
  ) {
    operations.push({
      type: "equal",
      left: createLine(leftLines[prefix], prefix + 1),
      right: createLine(rightLines[prefix], prefix + 1),
    });
    prefix += 1;
  }

  let leftEnd = leftLines.length - 1;
  let rightEnd = rightLines.length - 1;
  const suffix = [];
  while (
    leftEnd >= prefix &&
    rightEnd >= prefix &&
    leftLines[leftEnd] === rightLines[rightEnd]
  ) {
    suffix.push({
      type: "equal",
      left: createLine(leftLines[leftEnd], leftEnd + 1),
      right: createLine(rightLines[rightEnd], rightEnd + 1),
    });
    leftEnd -= 1;
    rightEnd -= 1;
  }

  const leftMiddle = leftLines.slice(prefix, leftEnd + 1);
  const rightMiddle = rightLines.slice(prefix, rightEnd + 1);
  operations.push(
    ...diffMiddleLines(leftMiddle, rightMiddle, prefix, prefix),
    ...suffix.reverse(),
  );
  return operations;
}

function diffMiddleLines(leftLines, rightLines, leftOffset, rightOffset) {
  if (leftLines.length === 0) {
    return rightLines.map((text, index) => ({
      type: "insert",
      right: createLine(text, rightOffset + index + 1),
    }));
  }
  if (rightLines.length === 0) {
    return leftLines.map((text, index) => ({
      type: "delete",
      left: createLine(text, leftOffset + index + 1),
    }));
  }

  const cellCount = (leftLines.length + 1) * (rightLines.length + 1);
  if (cellCount > 4_000_000) {
    return [
      ...leftLines.map((text, index) => ({
        type: "delete",
        left: createLine(text, leftOffset + index + 1),
      })),
      ...rightLines.map((text, index) => ({
        type: "insert",
        right: createLine(text, rightOffset + index + 1),
      })),
    ];
  }

  const width = rightLines.length + 1;
  const dp = new Uint32Array((leftLines.length + 1) * width);
  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (
      let rightIndex = rightLines.length - 1;
      rightIndex >= 0;
      rightIndex -= 1
    ) {
      const current = leftIndex * width + rightIndex;
      dp[current] =
        leftLines[leftIndex] === rightLines[rightIndex]
          ? dp[(leftIndex + 1) * width + rightIndex + 1] + 1
          : Math.max(
              dp[(leftIndex + 1) * width + rightIndex],
              dp[leftIndex * width + rightIndex + 1],
            );
    }
  }

  const operations = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
    if (leftLines[leftIndex] === rightLines[rightIndex]) {
      operations.push({
        type: "equal",
        left: createLine(leftLines[leftIndex], leftOffset + leftIndex + 1),
        right: createLine(rightLines[rightIndex], rightOffset + rightIndex + 1),
      });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (
      dp[(leftIndex + 1) * width + rightIndex] >=
      dp[leftIndex * width + rightIndex + 1]
    ) {
      operations.push({
        type: "delete",
        left: createLine(leftLines[leftIndex], leftOffset + leftIndex + 1),
      });
      leftIndex += 1;
    } else {
      operations.push({
        type: "insert",
        right: createLine(rightLines[rightIndex], rightOffset + rightIndex + 1),
      });
      rightIndex += 1;
    }
  }

  while (leftIndex < leftLines.length) {
    operations.push({
      type: "delete",
      left: createLine(leftLines[leftIndex], leftOffset + leftIndex + 1),
    });
    leftIndex += 1;
  }

  while (rightIndex < rightLines.length) {
    operations.push({
      type: "insert",
      right: createLine(rightLines[rightIndex], rightOffset + rightIndex + 1),
    });
    rightIndex += 1;
  }

  return operations;
}

function createLine(text, number) {
  return { text, number };
}

function summarizeRows(rows) {
  return rows.reduce(
    (summary, row) => {
      if (row.type === "insert") summary.added += 1;
      if (row.type === "delete") summary.deleted += 1;
      if (row.type === "replace") {
        summary.added += row.right ? 1 : 0;
        summary.deleted += row.left ? 1 : 0;
      }
      if (row.type !== "equal") summary.changed += 1;
      return summary;
    },
    { added: 0, deleted: 0, changed: 0 },
  );
}

function analyzeMarkdownLines(lines) {
  const meta = new Map();
  collectCodeBlockMeta(lines, meta);
  collectTableMeta(lines, meta);
  return meta;
}

function collectCodeBlockMeta(lines, meta) {
  let block = null;

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    const fence = text.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);

    if (!block && fence) {
      const language = normalizeLanguage(
        fence[2].trim().split(/\s+/)[0] || "",
      );
      block = {
        marker: fence[1][0],
        length: fence[1].length,
        start: index + 1,
        language,
        code: [],
      };
      meta.set(index + 1, {
        kind: "codeFence",
        role: "open",
        language,
        code: "",
      });
      continue;
    }

    if (block) {
      const closing =
        fence &&
        fence[1][0] === block.marker &&
        fence[1].length >= block.length &&
        !fence[2].trim();

      if (closing) {
        const code = block.code.join("\n");
        meta.set(block.start, {
          ...meta.get(block.start),
          code,
        });
        meta.set(index + 1, {
          kind: "codeFence",
          role: "close",
          language: block.language,
          code,
        });
        block = null;
        continue;
      }

      block.code.push(text);
      meta.set(index + 1, {
        kind: "code",
        language: block.language,
      });
    }
  }

  if (block) {
    const code = block.code.join("\n");
    meta.set(block.start, {
      ...meta.get(block.start),
      code,
    });
  }
}

function collectTableMeta(lines, meta) {
  let index = 0;
  while (index < lines.length - 1) {
    if (!isTableContentLine(lines[index]) || !isTableDelimiterLine(lines[index + 1])) {
      index += 1;
      continue;
    }

    meta.set(index + 1, { kind: "table", role: "header" });
    meta.set(index + 2, { kind: "table", role: "delimiter" });
    index += 2;
    while (index < lines.length && isTableContentLine(lines[index])) {
      meta.set(index + 1, { kind: "table", role: "body" });
      index += 1;
    }
  }
}

function normalizeLanguage(language) {
  const lower = language.toLowerCase();
  if (lower === "jsx" || lower === "mjs" || lower === "cjs") return "javascript";
  if (lower === "json5") return "json";
  if (lower === "svg") return "xml";
  return lower;
}

function renderMarkdownLine(text, meta) {
  if (!text.trim()) {
    return '<span class="rdiff-blank-line" aria-hidden="true">&nbsp;</span>';
  }

  if (meta?.kind === "codeFence") {
    return renderCodeFence(text, meta);
  }

  if (meta?.kind === "code") {
    return renderCodeLine(text, meta.language);
  }

  if (meta?.kind === "table") {
    return renderTableLine(text, meta.role);
  }

  if (isThematicBreakLine(text)) {
    return '<hr class="rdiff-hr">';
  }

  const heading = text.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
  if (heading) {
    return `<div class="rdiff-heading rdiff-heading-${heading[1].length}">${renderInlineMarkdown(heading[2].trim())}</div>`;
  }

  const quote = text.match(/^\s{0,3}>\s?(.*)$/);
  if (quote) {
    return `<blockquote class="rdiff-quote">${renderInlineMarkdown(quote[1])}</blockquote>`;
  }

  const task = text.match(/^(\s*)[-+*]\s+\[([ xX])\]\s+(.*)$/);
  if (task) {
    const depth = Math.min(Math.floor(countIndentColumns(task[1]) / 2), 4);
    const checked = task[2].toLowerCase() === "x";
    return `<div class="rdiff-list rdiff-list-depth-${depth}"><span class="rdiff-task ${checked ? "is-checked" : ""}"></span><span>${renderInlineMarkdown(task[3])}</span></div>`;
  }

  const listMarker = parseListMarker(text);
  if (listMarker) {
    const content = text.slice(listMarker.markerTo);
    const markerClass = listMarker.ordered ? "is-ordered" : "is-unordered";
    return `<div class="rdiff-list rdiff-list-depth-${Math.min(listMarker.level, 4)}"><span class="rdiff-list-marker ${markerClass}">${escapeHtml(listMarker.marker)}</span><span>${renderInlineMarkdown(content)}</span></div>`;
  }

  return renderInlineMarkdown(text);
}

function renderCodeFence(text, meta) {
  const copyId = registerCopyPayload(meta.code || "");
  const label = meta.role === "open" && meta.language ? meta.language : "";
  return `
    <div class="rdiff-code-fence">
      <span>${escapeHtml(text.trim())}</span>
      ${label ? `<span class="rdiff-code-lang">${escapeHtml(label)}</span>` : ""}
      ${meta.role === "open" && meta.code ? `<button type="button" class="rdiff-copy" data-copy-id="${copyId}">Copy</button>` : ""}
    </div>
  `;
}

function renderCodeLine(text, language) {
  return `<pre class="rdiff-code-line"><code>${highlightCode(text, language)}</code></pre>`;
}

function highlightCode(text, language) {
  if (!language) {
    return escapeHtml(text);
  }
  try {
    if (hljs.getLanguage(language)) {
      return hljs.highlight(text, { language, ignoreIllegals: true }).value;
    }
  } catch (error) {
    // Fall back to escaped source.
  }
  return escapeHtml(text);
}

function renderTableLine(text, role) {
  if (role === "delimiter") {
    return '<div class="rdiff-table-rule"></div>';
  }

  const cells = splitTableCells(text);
  const tag = role === "header" ? "th" : "td";
  return `
    <table class="rdiff-table rdiff-table-${role}">
      <tbody>
        <tr>${cells.map((cell) => `<${tag}>${renderInlineMarkdown(cell.trim())}</${tag}>`).join("")}</tr>
      </tbody>
    </table>
  `;
}

function renderInlineMarkdown(text) {
  let value = escapeHtml(text);

  value = value.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, src) =>
      `<span class="rdiff-image" data-image-src="${escapeAttribute(src)}" data-image-alt="${escapeAttribute(alt)}"><span class="rdiff-image-loading">${escapeHtml(alt || "Loading image")}</span></span>`,
  );
  value = value.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, href) =>
      `<a href="#" data-href="${escapeAttribute(href)}">${label}</a>`,
  );
  value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  value = value.replace(/_([^_]+)_/g, "<em>$1</em>");
  value = value.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return value;
}

function registerCopyPayload(text) {
  copyPayloadId += 1;
  const id = String(copyPayloadId);
  copyPayloads.set(id, text);
  return id;
}

function resolveImages() {
  root.querySelectorAll("[data-image-src]").forEach((element) => {
    const src = element.dataset.imageSrc;
    if (!src) return;
    const requestId = imageRequestId += 1;
    const timeout = window.setTimeout(() => {
      pendingImageRequests.delete(requestId);
      element.innerHTML = '<span class="rdiff-image-error">Image could not be loaded</span>';
    }, 4000);
    pendingImageRequests.set(requestId, {
      element,
      alt: element.dataset.imageAlt || "",
      timeout,
    });
    vscode.postMessage({ type: "resolveImage", requestId, src });
  });
}

function isThematicBreakLine(text) {
  return /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(text);
}

function parseListMarker(text) {
  const match = text.match(/^(\s*)((?:[-+*])|(?:\d+[.)]))(\s+)/);
  if (!match) return null;
  const indentColumns = countIndentColumns(match[1]);
  return {
    marker: match[2],
    ordered: /^\d/.test(match[2]),
    level: Math.max(0, Math.floor(indentColumns / 2)),
    markerTo: match[1].length + match[2].length + match[3].length,
  };
}

function countIndentColumns(text) {
  let columns = 0;
  for (const character of text) {
    columns += character === "\t" ? 4 - (columns % 4) : 1;
  }
  return columns;
}

function isTableContentLine(text) {
  if (!text.includes("|") || isTableDelimiterLine(text)) {
    return false;
  }
  return splitTableCells(text).length >= 2;
}

function isTableDelimiterLine(text) {
  if (!text.includes("|")) {
    return false;
  }
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(text);
}

function splitTableCells(text) {
  return text.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --rdiff-add-bg: color-mix(in srgb, var(--rip-syntax-green) 16%, transparent);
      --rdiff-add-border: color-mix(in srgb, var(--rip-syntax-green) 52%, transparent);
      --rdiff-delete-bg: color-mix(in srgb, var(--rip-danger) 15%, transparent);
      --rdiff-delete-border: color-mix(in srgb, var(--rip-danger) 46%, transparent);
      --rdiff-empty-bg: color-mix(in srgb, var(--rip-panel) 48%, transparent);
    }
    .rdiff-shell {
      height: 100%;
      display: grid;
      grid-template-rows: auto auto 1fr;
      color: var(--rip-fg);
      background: var(--rip-bg);
      font-family: var(--vscode-font-family);
      font-size: 14px;
    }
    .rdiff-header {
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid var(--rip-border);
      padding: 10px 14px;
      background: var(--rip-panel);
    }
    .rdiff-title {
      min-width: 0;
      display: grid;
      gap: 2px;
    }
    .rdiff-file {
      color: var(--rip-heading);
      font-weight: 760;
    }
    .rdiff-path {
      color: var(--rip-muted);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rdiff-stats {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
      flex: 0 0 auto;
    }
    .rdiff-stat {
      border: 1px solid var(--rip-border);
      border-radius: 999px;
      padding: 3px 8px;
      color: var(--rip-muted);
      background: var(--rip-bg);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .rdiff-stat-add {
      color: var(--rip-syntax-green);
      border-color: var(--rdiff-add-border);
      background: var(--rdiff-add-bg);
    }
    .rdiff-stat-delete {
      color: var(--rip-danger);
      border-color: var(--rdiff-delete-border);
      background: var(--rdiff-delete-bg);
    }
    .rdiff-column-header {
      display: grid;
      grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
      border-bottom: 1px solid var(--rip-border);
      color: var(--rip-muted);
      background: color-mix(in srgb, var(--rip-panel) 82%, var(--rip-bg));
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .rdiff-column-header > div {
      min-width: 0;
      border-right: 1px solid var(--rip-border);
      padding: 7px 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rdiff-column-header > div:last-child {
      border-right: 0;
    }
    .rdiff-body {
      min-height: 0;
      overflow: auto;
      background: var(--rip-bg);
    }
    .rdiff-row {
      min-width: 760px;
      display: grid;
      grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
      border-bottom: 1px solid color-mix(in srgb, var(--rip-border) 48%, transparent);
    }
    .rdiff-side {
      min-width: 0;
      display: grid;
      grid-template-columns: 52px 26px minmax(0, 1fr);
      border-right: 1px solid var(--rip-border);
      background: var(--rip-bg);
    }
    .rdiff-side:last-child {
      border-right: 0;
    }
    .rdiff-side.is-insert {
      background: var(--rdiff-add-bg);
    }
    .rdiff-side.is-delete {
      background: var(--rdiff-delete-bg);
    }
    .rdiff-side.is-empty {
      background:
        repeating-linear-gradient(
          -45deg,
          var(--rdiff-empty-bg) 0,
          var(--rdiff-empty-bg) 8px,
          transparent 8px,
          transparent 16px
        );
    }
    .rdiff-line-number,
    .rdiff-marker {
      min-height: 28px;
      padding: 4px 6px;
      color: var(--rip-muted);
      background: color-mix(in srgb, var(--rip-panel) 58%, transparent);
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      font-size: 12px;
      line-height: 1.55;
      user-select: none;
    }
    .rdiff-line-number {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .rdiff-marker {
      text-align: center;
      font-weight: 760;
    }
    .rdiff-side.is-insert .rdiff-marker {
      color: var(--rip-syntax-green);
    }
    .rdiff-side.is-delete .rdiff-marker {
      color: var(--rip-danger);
    }
    .rdiff-content {
      min-width: 0;
      min-height: 28px;
      padding: 4px 10px;
      line-height: 1.55;
      overflow-wrap: anywhere;
      white-space: normal;
    }
    .rdiff-heading {
      color: var(--rip-heading);
      font-weight: 780;
      line-height: 1.28;
    }
    .rdiff-heading-1 {
      border-bottom: 1px solid var(--rip-border);
      padding-bottom: 0.08em;
      font-size: 1.64rem;
    }
    .rdiff-heading-2 { font-size: 1.36rem; }
    .rdiff-heading-3 { font-size: 1.16rem; }
    .rdiff-heading-4,
    .rdiff-heading-5,
    .rdiff-heading-6 { font-size: 1rem; }
    .rdiff-quote {
      margin: 0;
      border-left: 4px solid var(--rip-quote-border);
      padding-left: 0.8em;
      color: var(--rip-muted);
    }
    .rdiff-list {
      display: flex;
      align-items: baseline;
      gap: 0.45em;
      padding-left: calc(var(--depth, 0) * 1.25em);
    }
    .rdiff-list-depth-1 { --depth: 1; }
    .rdiff-list-depth-2 { --depth: 2; }
    .rdiff-list-depth-3 { --depth: 3; }
    .rdiff-list-depth-4 { --depth: 4; }
    .rdiff-list-marker {
      min-width: 1.35em;
      color: var(--rip-heading);
      font-weight: 760;
      text-align: center;
    }
    .rdiff-list-marker.is-ordered {
      min-width: 2em;
      color: var(--rip-muted);
      text-align: right;
    }
    .rdiff-task {
      width: 1em;
      height: 1em;
      flex: 0 0 auto;
      display: inline-grid;
      place-items: center;
      border: 1.5px solid var(--rip-border);
      border-radius: 4px;
      background: var(--rip-input-bg);
      transform: translateY(0.14em);
    }
    .rdiff-task.is-checked {
      border-color: var(--rip-accent);
      background: var(--rip-accent);
    }
    .rdiff-task.is-checked::after {
      content: "\\2713";
      color: var(--rip-button-fg);
      font-size: 0.78em;
    }
    .rdiff-hr {
      height: 1px;
      margin: 0.7em 0;
      border: 0;
      background: var(--rip-border);
    }
    .rdiff-content code {
      border: 1px solid var(--rip-border);
      border-radius: 4px;
      padding: 0.08em 0.3em;
      background: var(--rip-code-bg);
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      font-size: 0.92em;
    }
    .rdiff-code-line,
    .rdiff-code-fence {
      margin: 0;
      border-left: 1px solid var(--rip-border);
      border-right: 1px solid var(--rip-border);
      padding: 3px 10px;
      background: color-mix(in srgb, var(--rip-panel) 92%, var(--rip-code-bg));
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      font-size: 0.92em;
      white-space: pre-wrap;
    }
    .rdiff-code-fence {
      min-height: 28px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-top: 1px solid var(--rip-border);
      border-top-left-radius: 7px;
      border-top-right-radius: 7px;
      color: var(--rip-muted);
      background: color-mix(in srgb, var(--rip-panel) 86%, var(--rip-bg));
    }
    .rdiff-code-lang {
      color: var(--rip-heading);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .rdiff-copy {
      margin-left: auto;
      border: 1px solid var(--rip-border);
      border-radius: 5px;
      padding: 2px 7px;
      color: var(--rip-muted);
      background: var(--rip-panel);
      font: 11px var(--vscode-font-family);
      cursor: pointer;
    }
    .rdiff-copy:hover {
      color: var(--rip-heading);
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .rdiff-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid var(--rip-border);
      border-radius: 7px;
      overflow: hidden;
      background: var(--rip-panel);
      font-size: 0.95em;
    }
    .rdiff-table th,
    .rdiff-table td {
      border-right: 1px solid var(--rip-border);
      padding: 6px 9px;
      text-align: left;
      vertical-align: top;
    }
    .rdiff-table th:last-child,
    .rdiff-table td:last-child {
      border-right: 0;
    }
    .rdiff-table th {
      color: var(--rip-heading);
      background: color-mix(in srgb, var(--rip-heading) 10%, var(--rip-panel));
      font-weight: 760;
    }
    .rdiff-table-rule {
      height: 1px;
      margin: 4px 0;
      background: color-mix(in srgb, var(--rip-border) 72%, transparent);
    }
    .rdiff-image {
      max-width: 100%;
      display: inline-grid;
      gap: 4px;
      vertical-align: top;
    }
    .rdiff-image img {
      max-width: min(100%, 520px);
      max-height: 320px;
      display: block;
      border: 1px solid var(--rip-border);
      border-radius: 7px;
      background: var(--rip-panel);
      object-fit: contain;
    }
    .rdiff-image-loading,
    .rdiff-image-error {
      color: var(--rip-muted);
      font-size: 12px;
    }
    .rdiff-content a {
      color: var(--rip-link);
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .rdiff-content strong { font-weight: 760; }
    .rdiff-content em { font-style: italic; }
    .rdiff-content del { color: var(--rip-muted); }
    .rdiff-blank-line {
      display: inline-block;
      min-height: 1.55em;
    }
    .rdiff-empty {
      height: 100%;
      display: grid;
      place-content: center;
      gap: 6px;
      color: var(--rip-muted);
      text-align: center;
    }
    .rdiff-empty-title {
      color: var(--rip-heading);
      font-weight: 760;
    }
    .hljs-keyword,
    .hljs-built_in,
    .hljs-selector-tag {
      color: var(--rip-syntax-purple);
    }
    .hljs-string,
    .hljs-attr,
    .hljs-attribute {
      color: var(--rip-syntax-orange);
    }
    .hljs-number,
    .hljs-literal {
      color: var(--rip-syntax-green);
    }
    .hljs-title,
    .hljs-name,
    .hljs-property {
      color: var(--rip-syntax-blue);
    }
    .hljs-comment {
      color: var(--rip-muted);
      font-style: italic;
    }
    @media (max-width: 860px) {
      .rdiff-header {
        align-items: flex-start;
        flex-direction: column;
      }
      .rdiff-column-header,
      .rdiff-row {
        grid-template-columns: minmax(360px, 1fr);
      }
      .rdiff-side {
        border-right: 0;
      }
      .rdiff-left {
        border-bottom: 1px solid var(--rip-border);
      }
    }
  `;
  document.head.appendChild(style);
}

function applyTheme(themeName) {
  const theme = getTheme(themeName);
  const rootStyle = document.documentElement.style;
  document.documentElement.dataset.richTheme = themeName || "default";

  for (const [key, value] of Object.entries(theme)) {
    rootStyle.setProperty(
      `--rip-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      value,
    );
  }
}

function getTheme(themeName) {
  const themes = {
    default: {
      bg: "var(--vscode-editor-background)",
      fg: "var(--vscode-editor-foreground)",
      muted: "var(--vscode-descriptionForeground)",
      border: "var(--vscode-panel-border)",
      panel: "var(--vscode-editorWidget-background)",
      inputBg: "var(--vscode-input-background)",
      codeBg: "var(--vscode-textCodeBlock-background)",
      hover:
        "color-mix(in srgb, var(--vscode-editor-selectionBackground) 16%, transparent)",
      focus: "var(--vscode-focusBorder)",
      accent: "var(--vscode-button-background)",
      buttonFg: "var(--vscode-button-foreground)",
      heading: "var(--vscode-textLink-foreground)",
      link: "var(--vscode-textLink-foreground)",
      quoteBorder: "var(--vscode-textBlockQuote-border)",
      syntaxPurple: "var(--vscode-charts-purple, #c586c0)",
      syntaxOrange: "var(--vscode-charts-orange, #ce9178)",
      syntaxGreen: "var(--vscode-charts-green, #b5cea8)",
      syntaxBlue: "var(--vscode-charts-blue, #9cdcfe)",
      danger: "var(--vscode-errorForeground, #f14c4c)",
    },
    midnight: {
      bg: "#0b1020",
      fg: "#d9e4ff",
      muted: "#8796b8",
      border: "#26314f",
      panel: "#111936",
      inputBg: "#0f1730",
      codeBg: "#070b16",
      hover: "rgba(93, 144, 255, 0.14)",
      focus: "#7aa2ff",
      accent: "#6f9cff",
      buttonFg: "#081120",
      heading: "#8fb4ff",
      link: "#8fb4ff",
      quoteBorder: "#5e7fd6",
      syntaxPurple: "#d7a7ff",
      syntaxOrange: "#ffc08a",
      syntaxGreen: "#9ce6b3",
      syntaxBlue: "#8bd7ff",
      danger: "#ff8a8a",
    },
    graphite: {
      bg: "#151617",
      fg: "#e5e1d8",
      muted: "#9b9891",
      border: "#343536",
      panel: "#202224",
      inputBg: "#1b1d1f",
      codeBg: "#101112",
      hover: "rgba(229, 225, 216, 0.08)",
      focus: "#d0a85c",
      accent: "#d0a85c",
      buttonFg: "#171717",
      heading: "#e2bd72",
      link: "#e2bd72",
      quoteBorder: "#8e7a55",
      syntaxPurple: "#cfa8ff",
      syntaxOrange: "#e6b17e",
      syntaxGreen: "#9bcf9d",
      syntaxBlue: "#8ebbdc",
      danger: "#ff8f8f",
    },
    forest: {
      bg: "#0f1712",
      fg: "#dce8dc",
      muted: "#8ea08f",
      border: "#263529",
      panel: "#17231a",
      inputBg: "#121d15",
      codeBg: "#0a100c",
      hover: "rgba(121, 184, 136, 0.12)",
      focus: "#79b888",
      accent: "#79b888",
      buttonFg: "#071008",
      heading: "#a4d8a9",
      link: "#9fd6b3",
      quoteBorder: "#5b936a",
      syntaxPurple: "#d0a8ff",
      syntaxOrange: "#e9bd8c",
      syntaxGreen: "#93d79b",
      syntaxBlue: "#8fcbd4",
      danger: "#ff8a8a",
    },
    ivory: {
      bg: "#fbf5e8",
      fg: "#2f2b25",
      muted: "#776f62",
      border: "#ded3bf",
      panel: "#f1e7d5",
      inputBg: "#fffaf0",
      codeBg: "#f2eadc",
      hover: "rgba(107, 78, 42, 0.09)",
      focus: "#a46c28",
      accent: "#a46c28",
      buttonFg: "#fff8ee",
      heading: "#7a4f1e",
      link: "#8a5a24",
      quoteBorder: "#bc8f55",
      syntaxPurple: "#8a4fb0",
      syntaxOrange: "#a75d17",
      syntaxGreen: "#3f7a3f",
      syntaxBlue: "#2e6f9f",
      danger: "#b42318",
    },
    paper: {
      bg: "#ffffff",
      fg: "#202124",
      muted: "#6b7280",
      border: "#d7dbe2",
      panel: "#f3f5f8",
      inputBg: "#ffffff",
      codeBg: "#f5f7fa",
      hover: "rgba(31, 111, 235, 0.08)",
      focus: "#1f6feb",
      accent: "#1f6feb",
      buttonFg: "#ffffff",
      heading: "#0b5cad",
      link: "#0b5cad",
      quoteBorder: "#8aa6c8",
      syntaxPurple: "#7c3aed",
      syntaxOrange: "#b45309",
      syntaxGreen: "#15803d",
      syntaxBlue: "#0369a1",
      danger: "#b42318",
    },
    solar: {
      bg: "#fdf6e3",
      fg: "#3b3a32",
      muted: "#7b7662",
      border: "#d8ceb0",
      panel: "#eee5c8",
      inputBg: "#fff9e8",
      codeBg: "#f4edcf",
      hover: "rgba(181, 137, 0, 0.1)",
      focus: "#b58900",
      accent: "#b58900",
      buttonFg: "#fff8df",
      heading: "#9b6d00",
      link: "#0f6c8c",
      quoteBorder: "#b58900",
      syntaxPurple: "#6c54a3",
      syntaxOrange: "#b85c00",
      syntaxGreen: "#5f7f00",
      syntaxBlue: "#227894",
      danger: "#b42318",
    },
  };
  return themes[themeName] || themes.default;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
