// Rich diff webview entrypoint.
//
// This file owns VS Code message handling and the side-by-side shell. Diff
// calculation, Markdown rendering, styling, and theme values are split into
// focused modules under src/rich-diff.
//
// The same page serves two views. The file diff compares one Markdown file
// with HEAD. The commit diff (initial data with a `commitView`) lists the
// Markdown files a commit changed beside the diff of the selected one; the
// host sends each file's text when it is selected. Added and deleted files
// have only one side and render as a single pane.
import hljs from "highlight.js/lib/core";
import bashLanguage from "highlight.js/lib/languages/bash";
import brainfuckLanguage from "highlight.js/lib/languages/brainfuck";
import cLanguage from "highlight.js/lib/languages/c";
import clojureLanguage from "highlight.js/lib/languages/clojure";
import cmakeLanguage from "highlight.js/lib/languages/cmake";
import cppLanguage from "highlight.js/lib/languages/cpp";
import crystalLanguage from "highlight.js/lib/languages/crystal";
import cssLanguage from "highlight.js/lib/languages/css";
import csharpLanguage from "highlight.js/lib/languages/csharp";
import dLanguage from "highlight.js/lib/languages/d";
import dartLanguage from "highlight.js/lib/languages/dart";
import diffLanguage from "highlight.js/lib/languages/diff";
import dockerfileLanguage from "highlight.js/lib/languages/dockerfile";
import elixirLanguage from "highlight.js/lib/languages/elixir";
import elmLanguage from "highlight.js/lib/languages/elm";
import erlangLanguage from "highlight.js/lib/languages/erlang";
import fortranLanguage from "highlight.js/lib/languages/fortran";
import fsharpLanguage from "highlight.js/lib/languages/fsharp";
import gherkinLanguage from "highlight.js/lib/languages/gherkin";
import goLanguage from "highlight.js/lib/languages/go";
import gradleLanguage from "highlight.js/lib/languages/gradle";
import graphqlLanguage from "highlight.js/lib/languages/graphql";
import groovyLanguage from "highlight.js/lib/languages/groovy";
import haskellLanguage from "highlight.js/lib/languages/haskell";
import httpLanguage from "highlight.js/lib/languages/http";
import iniLanguage from "highlight.js/lib/languages/ini";
import javaLanguage from "highlight.js/lib/languages/java";
import javascriptLanguage from "highlight.js/lib/languages/javascript";
import jsonLanguage from "highlight.js/lib/languages/json";
import juliaLanguage from "highlight.js/lib/languages/julia";
import kotlinLanguage from "highlight.js/lib/languages/kotlin";
import latexLanguage from "highlight.js/lib/languages/latex";
import lessLanguage from "highlight.js/lib/languages/less";
import lispLanguage from "highlight.js/lib/languages/lisp";
import luaLanguage from "highlight.js/lib/languages/lua";
import makefileLanguage from "highlight.js/lib/languages/makefile";
import markdownLanguage from "highlight.js/lib/languages/markdown";
import matlabLanguage from "highlight.js/lib/languages/matlab";
import nginxLanguage from "highlight.js/lib/languages/nginx";
import objectivecLanguage from "highlight.js/lib/languages/objectivec";
import ocamlLanguage from "highlight.js/lib/languages/ocaml";
import phpLanguage from "highlight.js/lib/languages/php";
import powershellLanguage from "highlight.js/lib/languages/powershell";
import propertiesLanguage from "highlight.js/lib/languages/properties";
import protobufLanguage from "highlight.js/lib/languages/protobuf";
import puppetLanguage from "highlight.js/lib/languages/puppet";
import pythonLanguage from "highlight.js/lib/languages/python";
import rLanguage from "highlight.js/lib/languages/r";
import rubyLanguage from "highlight.js/lib/languages/ruby";
import rustLanguage from "highlight.js/lib/languages/rust";
import sasLanguage from "highlight.js/lib/languages/sas";
import scalaLanguage from "highlight.js/lib/languages/scala";
import schemeLanguage from "highlight.js/lib/languages/scheme";
import scssLanguage from "highlight.js/lib/languages/scss";
import smalltalkLanguage from "highlight.js/lib/languages/smalltalk";
import sqlLanguage from "highlight.js/lib/languages/sql";
import stylusLanguage from "highlight.js/lib/languages/stylus";
import swiftLanguage from "highlight.js/lib/languages/swift";
import thriftLanguage from "highlight.js/lib/languages/thrift";
import typescriptLanguage from "highlight.js/lib/languages/typescript";
import vbnetLanguage from "highlight.js/lib/languages/vbnet";
import verilogLanguage from "highlight.js/lib/languages/verilog";
import vhdlLanguage from "highlight.js/lib/languages/vhdl";
import wasmLanguage from "highlight.js/lib/languages/wasm";
import xmlLanguage from "highlight.js/lib/languages/xml";
import yamlLanguage from "highlight.js/lib/languages/yaml";
import {
  buildDiffRows,
  createLine,
  splitLines,
  summarizeRows,
} from "./rich-diff/domain/diffRows.js";
import {
  normalizeCommitView,
  renderCommitFrame,
  renderMessage,
  renderStatusBadge,
  updateFileSelection,
} from "./rich-diff/presentation/commitView.js";
import { escapeAttribute, escapeHtml } from "./rich-diff/presentation/htmlEscape.js";
import { tomlLanguage } from "./rich-diff/presentation/highlight/tomlLanguage.js";
import { createMarkdownRenderer } from "./rich-diff/presentation/markdownRenderer.js";
import { injectStyles } from "./rich-diff/presentation/styles.js";
import { applyTheme, normalizeSettings } from "./rich-diff/presentation/theme.js";

function registerCodeLanguage(name, language, aliases = []) {
  hljs.registerLanguage(name, language);
  if (aliases.length) {
    hljs.registerAliases(aliases, { languageName: name });
  }
}

registerCodeLanguage("bash", bashLanguage, [
  "console",
  "fish",
  "sh",
  "shell",
  "terminal",
  "zsh",
]);
registerCodeLanguage("brainfuck", brainfuckLanguage, ["bf"]);
registerCodeLanguage("c", cLanguage);
registerCodeLanguage("clojure", clojureLanguage, ["clj", "cljs", "cljc"]);
registerCodeLanguage("cmake", cmakeLanguage);
registerCodeLanguage("cpp", cppLanguage, ["c++", "cc", "cxx", "h", "hh", "hpp", "hxx"]);
registerCodeLanguage("crystal", crystalLanguage, ["cr"]);
registerCodeLanguage("css", cssLanguage);
registerCodeLanguage("csharp", csharpLanguage, ["c#", "cs"]);
registerCodeLanguage("d", dLanguage);
registerCodeLanguage("dart", dartLanguage);
registerCodeLanguage("diff", diffLanguage, ["patch"]);
registerCodeLanguage("dockerfile", dockerfileLanguage, ["docker"]);
registerCodeLanguage("elixir", elixirLanguage, ["ex", "exs"]);
registerCodeLanguage("elm", elmLanguage);
registerCodeLanguage("erlang", erlangLanguage, ["erl"]);
registerCodeLanguage("fortran", fortranLanguage, ["f90", "f95"]);
registerCodeLanguage("fsharp", fsharpLanguage, ["f#", "fs", "fsi", "fsx"]);
registerCodeLanguage("gherkin", gherkinLanguage, ["cucumber", "feature"]);
registerCodeLanguage("go", goLanguage, ["golang"]);
registerCodeLanguage("gradle", gradleLanguage);
registerCodeLanguage("graphql", graphqlLanguage, ["gql"]);
registerCodeLanguage("groovy", groovyLanguage);
registerCodeLanguage("haskell", haskellLanguage, ["hs"]);
registerCodeLanguage("http", httpLanguage);
registerCodeLanguage("ini", iniLanguage);
registerCodeLanguage("java", javaLanguage);
registerCodeLanguage("javascript", javascriptLanguage, ["cjs", "js", "jsx", "mjs"]);
registerCodeLanguage("json", jsonLanguage, ["json5", "jsonc"]);
registerCodeLanguage("julia", juliaLanguage, ["jl"]);
registerCodeLanguage("kotlin", kotlinLanguage, ["kt", "kts"]);
registerCodeLanguage("latex", latexLanguage, ["tex"]);
registerCodeLanguage("less", lessLanguage);
registerCodeLanguage("lisp", lispLanguage, ["cl", "commonlisp"]);
registerCodeLanguage("lua", luaLanguage);
registerCodeLanguage("makefile", makefileLanguage, ["make"]);
registerCodeLanguage("markdown", markdownLanguage, ["md"]);
registerCodeLanguage("matlab", matlabLanguage, ["octave"]);
registerCodeLanguage("nginx", nginxLanguage);
registerCodeLanguage("objectivec", objectivecLanguage, ["objc", "objective-c"]);
registerCodeLanguage("ocaml", ocamlLanguage, ["ml", "mli"]);
registerCodeLanguage("php", phpLanguage);
registerCodeLanguage("powershell", powershellLanguage, ["ps1", "pwsh"]);
registerCodeLanguage("properties", propertiesLanguage, ["conf"]);
registerCodeLanguage("protobuf", protobufLanguage, ["proto"]);
registerCodeLanguage("puppet", puppetLanguage, ["pp"]);
registerCodeLanguage("python", pythonLanguage, ["py"]);
registerCodeLanguage("r", rLanguage, ["rscript"]);
registerCodeLanguage("ruby", rubyLanguage, ["rb"]);
registerCodeLanguage("rust", rustLanguage, ["rs"]);
registerCodeLanguage("sas", sasLanguage);
registerCodeLanguage("scala", scalaLanguage);
registerCodeLanguage("scheme", schemeLanguage, ["scm"]);
registerCodeLanguage("scss", scssLanguage, ["sass"]);
registerCodeLanguage("smalltalk", smalltalkLanguage, ["st"]);
registerCodeLanguage("sql", sqlLanguage, ["mysql", "postgres", "postgresql", "sqlite"]);
registerCodeLanguage("stylus", stylusLanguage, ["styl"]);
registerCodeLanguage("swift", swiftLanguage);
registerCodeLanguage("thrift", thriftLanguage);
registerCodeLanguage("toml", tomlLanguage);
registerCodeLanguage("typescript", typescriptLanguage, ["ts", "tsx"]);
registerCodeLanguage("vbnet", vbnetLanguage, ["vb", "visualbasic"]);
registerCodeLanguage("verilog", verilogLanguage, ["sv", "systemverilog"]);
registerCodeLanguage("vhdl", vhdlLanguage, ["vhd"]);
registerCodeLanguage("wasm", wasmLanguage, ["wat", "wast"]);
registerCodeLanguage("xml", xmlLanguage, ["html", "svg"]);
registerCodeLanguage("yaml", yamlLanguage, ["yml"]);

const vscode = acquireVsCodeApi();
const root = document.querySelector("#diff");
const initialDiff = JSON.parse(
  document.querySelector("#initial-diff").textContent,
);
const initialSettings = JSON.parse(
  document.querySelector("#initial-settings").textContent,
);

let commitView = normalizeCommitView(initialDiff.commitView);
let selectedFileId = commitView ? getInitialFileId(initialDiff) : null;
// In the commit diff this stays null until the selected file's text arrives.
let diffData = commitView
  ? initialDiff.file ? normalizeDiffData(initialDiff.file) : null
  : normalizeDiffData(initialDiff);
let fileError = commitView ? String(initialDiff.fileError || "") : "";
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
if (commitView) {
  renderCommitView();
} else {
  renderDiff();
}

window.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "resolvedImage") {
    const pending = pendingImageRequests.get(event.data.requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeout);
    pendingImageRequests.delete(event.data.requestId);
    if (event.data.uri) {
      const width = pending.width ? ` style="width: ${Number(pending.width)}px"` : "";
      pending.element.innerHTML = `<img alt="${escapeAttribute(pending.alt)}" src="${escapeAttribute(event.data.uri)}"${width}>`;
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
    if (commitView || !diffData) return;
    diffData = {
      ...diffData,
      rightText: event.data.text,
    };
    renderDiff();
    return;
  }

  if (event.data.type === "showCommit") {
    const nextView = normalizeCommitView(event.data.commitView);
    if (!nextView) return;
    commitView = nextView;
    selectedFileId = getInitialFileId(event.data);
    diffData = event.data.file ? normalizeDiffData(event.data.file) : null;
    fileError = String(event.data.fileError || "");
    renderCommitView();
    return;
  }

  // A file picked in the Markdown Commits view arrives with `select`: it
  // becomes the selection (if this commit changed it) before the reply below.
  if (
    (event.data.type === "showFile" || event.data.type === "fileError") &&
    event.data.select &&
    commitView &&
    event.data.key === commitView.key &&
    commitView.files.some((file) => file.id === String(event.data.fileId))
  ) {
    selectedFileId = String(event.data.fileId);
    [...root.querySelectorAll("[data-file-id]")]
      .find((item) => item.dataset.fileId === selectedFileId)
      ?.scrollIntoView?.({ block: "nearest" });
  }

  // File replies for an earlier commit or selection are stale; drop them.
  if (
    (event.data.type === "showFile" || event.data.type === "fileError") &&
    commitView &&
    event.data.key === commitView.key &&
    String(event.data.fileId) === selectedFileId
  ) {
    if (event.data.type === "showFile" && event.data.file) {
      diffData = normalizeDiffData(event.data.file);
      fileError = "";
    } else {
      diffData = null;
      fileError = String(event.data.message || "The file could not be read from Git.");
    }
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

  const fileItem = event.target.closest("[data-file-id]");
  if (fileItem) {
    selectFile(fileItem.dataset.fileId);
    return;
  }

  const action = event.target.closest("[data-action]");
  if (action) {
    if (action.dataset.action === "pick-commit") {
      vscode.postMessage({ type: "pickCommit" });
    } else if (action.dataset.action === "open-file" && selectedFileId !== null) {
      vscode.postMessage({ type: "openFile", fileId: selectedFileId });
    }
    return;
  }

  const link = event.target.closest("a[data-href]");
  if (link) {
    event.preventDefault();
    vscode.postMessage({ type: "openLink", href: link.dataset.href });
    return;
  }

  const wikilink = event.target.closest("a[data-wikilink]");
  if (wikilink) {
    event.preventDefault();
    vscode.postMessage({ type: "openWikilink", href: wikilink.dataset.wikilink });
  }
});

// Up and Down walk the file list the way they walk a tree view.
root.addEventListener("keydown", (event) => {
  const item = event.target.closest?.("[data-file-id]");
  if (!item || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = [...root.querySelectorAll("[data-file-id]")];
  const index = items.indexOf(item);
  const nextIndex = {
    ArrowDown: Math.min(items.length - 1, index + 1),
    ArrowUp: Math.max(0, index - 1),
    Home: 0,
    End: items.length - 1,
  }[event.key];
  const next = items[nextIndex];
  if (!next || next === item) return;
  event.preventDefault();
  next.focus();
  selectFile(next.dataset.fileId);
});

function getInitialFileId(data) {
  if (data.selectedFileId !== undefined && data.selectedFileId !== null) {
    return String(data.selectedFileId);
  }
  return commitView?.files[0]?.id ?? null;
}

function normalizeDiffData(data = {}) {
  return {
    leftText: data.leftText || "",
    rightText: data.rightText || "",
    leftLabel: data.leftLabel || "Base",
    rightLabel: data.rightLabel || "Working Tree",
    fileName: data.fileName || "Markdown",
    filePath: data.filePath || "",
    layout: data.layout === "single" ? "single" : "split",
    singleSide: data.singleSide === "left" ? "left" : "right",
    singleLabel: data.singleLabel || "",
    status: data.status || "",
  };
}

function selectFile(fileId) {
  if (!commitView || fileId === selectedFileId) return;
  selectedFileId = fileId;
  diffData = null;
  fileError = "";
  renderDiff();
  vscode.postMessage({ type: "selectFile", fileId, key: commitView.key });
}

function renderCommitView() {
  root.innerHTML = renderCommitFrame(commitView);
  renderDiff();
}

function renderDiff() {
  copyPayloadId = 0;
  copyPayloads = new Map();
  pendingImageRequests.forEach((pending) => window.clearTimeout(pending.timeout));
  pendingImageRequests.clear();

  if (!commitView) {
    root.innerHTML = renderDiffShell();
    resolveImages();
    return;
  }

  // The commit header and file list stay in place (with their scroll
  // position); only the diff beside them is replaced.
  updateFileSelection(root, selectedFileId);
  const main = root.querySelector(".rdiff-commit-main");
  if (!commitView.files.length) {
    main.innerHTML = renderMessage(
      "No Markdown changes",
      "This commit did not change any Markdown files.",
    );
  } else if (fileError) {
    main.innerHTML = renderMessage("This file could not be shown", fileError);
  } else if (!diffData) {
    main.innerHTML = `<div class="rdiff-loading">Loading…</div>`;
  } else {
    main.innerHTML = renderDiffShell();
    resolveImages();
  }
}

function renderDiffShell() {
  const single = diffData.layout === "single";
  const body = single ? renderSinglePane() : renderSplitPane();
  const columnLabels = single
    ? [diffData.singleLabel || (diffData.singleSide === "left" ? diffData.leftLabel : diffData.rightLabel)]
    : [diffData.leftLabel, diffData.rightLabel];

  return `
    <div class="rdiff-shell">
      <header class="rdiff-header">
        <div class="rdiff-title">
          <div class="rdiff-file">${escapeHtml(diffData.fileName)}${commitView ? renderStatusBadge(diffData.status) : ""}</div>
          <div class="rdiff-path">${escapeHtml(diffData.filePath)}</div>
        </div>
        <div class="rdiff-stats" aria-label="Diff summary">
          <span class="rdiff-stat rdiff-stat-add">+${body.stats.added}</span>
          <span class="rdiff-stat rdiff-stat-delete">-${body.stats.deleted}</span>
          ${single ? "" : `<span class="rdiff-stat">${body.stats.changed} changed lines</span>`}
          ${commitView && diffData.status !== "deleted" ? `<button type="button" class="rdiff-button" data-action="open-file" title="Open the working tree version of this file">Open File</button>` : ""}
        </div>
      </header>
      <div class="rdiff-column-header${single ? " is-single" : ""}" aria-hidden="true">
        ${columnLabels.map((label) => `<div>${escapeHtml(label)}</div>`).join("")}
      </div>
      <main class="rdiff-body">
        ${body.html}
      </main>
    </div>
  `;
}

function renderSplitPane() {
  const leftLines = splitLines(diffData.leftText);
  const rightLines = splitLines(diffData.rightText);
  const rows = buildDiffRows(leftLines, rightLines);
  // Markdown metadata is collected per side so unchanged, inserted, and deleted
  // rows can share the same renderer without losing code/table context.
  const leftMeta = analyzeMarkdownLines(leftLines);
  const rightMeta = analyzeMarkdownLines(rightLines);
  return {
    stats: summarizeRows(rows),
    html: rows.length
      ? rows.map((row) => renderDiffRow(row, leftMeta, rightMeta)).join("")
      : renderEmptyDiff(),
  };
}

// An added or deleted file: the one existing side, rendered as a document.
function renderSinglePane() {
  const side = diffData.singleSide;
  const lines = splitLines(side === "left" ? diffData.leftText : diffData.rightText);
  const meta = analyzeMarkdownLines(lines);
  const kind = side === "left" ? "deleted" : "added";
  const marker = side === "left" ? "-" : "+";
  const html = lines
    .map((text, index) => {
      const line = createLine(text, index + 1);
      return `
        <div class="rdiff-row is-single">
          <section class="rdiff-side rdiff-single is-${kind}-file">
            <div class="rdiff-line-number">${line.number}</div>
            <div class="rdiff-marker">${marker}</div>
            <div class="rdiff-content">${renderMarkdownLine(line.text, meta.get(line.number))}</div>
          </section>
        </div>
      `;
    })
    .join("");
  return {
    stats: {
      added: side === "right" ? lines.length : 0,
      deleted: side === "left" ? lines.length : 0,
    },
    html: html || renderMessage("Empty file", "This file has no content."),
  };
}

function renderEmptyDiff() {
  return renderMessage(
    "No changes",
    "The Markdown content matches the selected base.",
  );
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
      width: element.dataset.imageWidth || "",
      timeout,
    });
    // Obsidian embeds (![[name]]) name a file for the host to find.
    vscode.postMessage(
      element.dataset.wikilink
        ? { type: "resolveImage", requestId, src, wikilink: true }
        : { type: "resolveImage", requestId, src },
    );
  });
}
