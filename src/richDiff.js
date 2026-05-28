// Rich diff webview entrypoint.
//
// This file owns VS Code message handling and the side-by-side shell. Diff
// calculation, Markdown rendering, styling, and theme values are split into
// focused modules under src/rich-diff.
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
  splitLines,
  summarizeRows,
} from "./rich-diff/domain/diffRows.js";
import { escapeAttribute, escapeHtml } from "./rich-diff/presentation/htmlEscape.js";
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
registerCodeLanguage("toml", iniLanguage);
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
