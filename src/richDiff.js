// Rich diff webview entrypoint.
//
// This file owns VS Code message handling and the side-by-side shell. Diff
// calculation, Markdown rendering, styling, and theme values are split into
// focused modules under src/rich-diff.
import hljs from "highlight.js/lib/core";
import cssLanguage from "highlight.js/lib/languages/css";
import javascriptLanguage from "highlight.js/lib/languages/javascript";
import jsonLanguage from "highlight.js/lib/languages/json";
import typescriptLanguage from "highlight.js/lib/languages/typescript";
import xmlLanguage from "highlight.js/lib/languages/xml";
import {
  buildDiffRows,
  splitLines,
  summarizeRows,
} from "./rich-diff/domain/diffRows.js";
import { escapeAttribute, escapeHtml } from "./rich-diff/presentation/htmlEscape.js";
import { createMarkdownRenderer } from "./rich-diff/presentation/markdownRenderer.js";
import { injectStyles } from "./rich-diff/presentation/styles.js";
import { applyTheme, normalizeSettings } from "./rich-diff/presentation/theme.js";

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
const { analyzeMarkdownLines, renderMarkdownLine } = createMarkdownRenderer({
  hljs,
  registerCopyPayload,
});

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

function renderDiff() {
  copyPayloadId = 0;
  copyPayloads = new Map();
  pendingImageRequests.forEach((pending) => window.clearTimeout(pending.timeout));
  pendingImageRequests.clear();

  const leftLines = splitLines(diffData.leftText);
  const rightLines = splitLines(diffData.rightText);
  const rows = buildDiffRows(leftLines, rightLines);
  const stats = summarizeRows(rows);
  // Markdown metadata is collected per side so unchanged, inserted, and deleted
  // rows can share the same renderer without losing code/table context.
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
