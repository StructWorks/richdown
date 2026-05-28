import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown as markdownLanguage } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import {
  HighlightStyle,
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from "@codemirror/language";
import { brainfuck } from "@codemirror/legacy-modes/mode/brainfuck";
import {
  csharp,
  dart,
  kotlin,
  objectiveC,
  scala,
} from "@codemirror/legacy-modes/mode/clike";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";
import { commonLisp } from "@codemirror/legacy-modes/mode/commonlisp";
import { less, sCSS } from "@codemirror/legacy-modes/mode/css";
import { crystal } from "@codemirror/legacy-modes/mode/crystal";
import { d as dLanguage } from "@codemirror/legacy-modes/mode/d";
import { diff as diffMode } from "@codemirror/legacy-modes/mode/diff";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { elm } from "@codemirror/legacy-modes/mode/elm";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { fortran } from "@codemirror/legacy-modes/mode/fortran";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { http } from "@codemirror/legacy-modes/mode/http";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { fSharp, oCaml, sml } from "@codemirror/legacy-modes/mode/mllike";
import { nginx } from "@codemirror/legacy-modes/mode/nginx";
import { octave } from "@codemirror/legacy-modes/mode/octave";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { pug } from "@codemirror/legacy-modes/mode/pug";
import { puppet } from "@codemirror/legacy-modes/mode/puppet";
import { r as rLanguage } from "@codemirror/legacy-modes/mode/r";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { sas } from "@codemirror/legacy-modes/mode/sas";
import { scheme } from "@codemirror/legacy-modes/mode/scheme";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { smalltalk } from "@codemirror/legacy-modes/mode/smalltalk";
import { sparql } from "@codemirror/legacy-modes/mode/sparql";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { stylus } from "@codemirror/legacy-modes/mode/stylus";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { turtle } from "@codemirror/legacy-modes/mode/turtle";
import { vb as visualBasic } from "@codemirror/legacy-modes/mode/vb";
import { verilog } from "@codemirror/legacy-modes/mode/verilog";
import { vhdl } from "@codemirror/legacy-modes/mode/vhdl";
import { wast } from "@codemirror/legacy-modes/mode/wast";
import { tags } from "@lezer/highlight";

function legacyMode(parser) {
  return new LanguageSupport(StreamLanguage.define(parser));
}

function codeLanguage(spec) {
  return LanguageDescription.of(spec);
}

function legacyCodeLanguage(spec, parser) {
  return codeLanguage({
    ...spec,
    support: legacyMode(parser),
  });
}

// Keep this list focused on common Markdown documentation and engineering
// snippets. Diff highlighting registers the same names and aliases separately.
export const codeLanguages = [
  codeLanguage({
    name: "JSON",
    alias: ["json", "jsonc", "json5"],
    extensions: ["json", "jsonc"],
    support: json(),
  }),
  codeLanguage({
    name: "JavaScript",
    alias: ["js", "javascript", "mjs", "cjs", "jsx"],
    extensions: ["js", "mjs", "cjs", "jsx"],
    support: javascript({ jsx: true }),
  }),
  codeLanguage({
    name: "TypeScript",
    alias: ["ts", "typescript", "tsx"],
    extensions: ["ts", "tsx"],
    support: javascript({ typescript: true, jsx: true }),
  }),
  codeLanguage({
    name: "CSS",
    alias: ["css"],
    extensions: ["css"],
    support: css(),
  }),
  codeLanguage({
    name: "HTML",
    alias: ["html", "xml", "svg"],
    extensions: ["html", "htm", "xml", "svg"],
    support: html(),
  }),
  codeLanguage({
    name: "Markdown",
    alias: ["md", "markdown"],
    extensions: ["md", "markdown"],
    support: markdownLanguage(),
  }),
  codeLanguage({
    name: "Python",
    alias: ["py", "python"],
    extensions: ["py", "pyw"],
    support: python(),
  }),
  codeLanguage({
    name: "Shell",
    alias: ["bash", "sh", "shell", "zsh", "fish", "console", "terminal"],
    extensions: ["bash", "sh", "zsh", "fish"],
    support: legacyMode(shell),
  }),
  codeLanguage({
    name: "YAML",
    alias: ["yaml", "yml"],
    extensions: ["yaml", "yml"],
    support: yaml(),
  }),
  codeLanguage({
    name: "SQL",
    alias: ["sql", "mysql", "postgres", "postgresql", "sqlite"],
    extensions: ["sql"],
    support: sql(),
  }),
  codeLanguage({
    name: "Java",
    alias: ["java"],
    extensions: ["java"],
    support: java(),
  }),
  codeLanguage({
    name: "Go",
    alias: ["go", "golang"],
    extensions: ["go"],
    support: go(),
  }),
  codeLanguage({
    name: "Rust",
    alias: ["rs", "rust"],
    extensions: ["rs"],
    support: rust(),
  }),
  codeLanguage({
    name: "PHP",
    alias: ["php"],
    extensions: ["php"],
    support: php(),
  }),
  codeLanguage({
    name: "C/C++",
    alias: ["c", "h", "cpp", "c++", "cc", "cxx", "hpp", "hh", "hxx"],
    extensions: ["c", "h", "cpp", "cc", "cxx", "hpp", "hh", "hxx"],
    support: cpp(),
  }),
  codeLanguage({
    name: "Dockerfile",
    alias: ["docker", "dockerfile"],
    extensions: ["dockerfile"],
    filename: /^Dockerfile(?:\..*)?$/,
    support: legacyMode(dockerFile),
  }),
  codeLanguage({
    name: "Ruby",
    alias: ["rb", "ruby"],
    extensions: ["rb"],
    support: legacyMode(ruby),
  }),
  codeLanguage({
    name: "TOML",
    alias: ["toml"],
    extensions: ["toml"],
    support: legacyMode(toml),
  }),
  codeLanguage({
    name: "Diff",
    alias: ["diff", "patch"],
    extensions: ["diff", "patch"],
    support: legacyMode(diffMode),
  }),
  legacyCodeLanguage(
    { name: "Dart", alias: ["dart", "dartlang", "flutter"], extensions: ["dart"] },
    dart,
  ),
  legacyCodeLanguage(
    { name: "Swift", alias: ["swift"], extensions: ["swift"] },
    swift,
  ),
  legacyCodeLanguage(
    { name: "Kotlin", alias: ["kotlin", "kt", "kts"], extensions: ["kt", "kts"] },
    kotlin,
  ),
  legacyCodeLanguage(
    { name: "C#", alias: ["c#", "csharp", "cs"], extensions: ["cs"] },
    csharp,
  ),
  legacyCodeLanguage(
    { name: "Scala", alias: ["scala"], extensions: ["scala", "sc"] },
    scala,
  ),
  legacyCodeLanguage(
    { name: "Objective-C", alias: ["objc", "objective-c", "objectivec"], extensions: ["m", "mm"] },
    objectiveC,
  ),
  legacyCodeLanguage(
    { name: "F#", alias: ["f#", "fsharp", "fs", "fsi", "fsx"], extensions: ["fs", "fsi", "fsx"] },
    fSharp,
  ),
  legacyCodeLanguage(
    { name: "OCaml", alias: ["ocaml", "ml", "mli"], extensions: ["ml", "mli"] },
    oCaml,
  ),
  legacyCodeLanguage(
    { name: "Standard ML", alias: ["sml"], extensions: ["sml", "sig"] },
    sml,
  ),
  legacyCodeLanguage(
    { name: "D", alias: ["d"], extensions: ["d"] },
    dLanguage,
  ),
  legacyCodeLanguage(
    { name: "Erlang", alias: ["erl", "erlang"], extensions: ["erl", "hrl"] },
    erlang,
  ),
  legacyCodeLanguage(
    { name: "Haskell", alias: ["haskell", "hs"], extensions: ["hs", "lhs"] },
    haskell,
  ),
  legacyCodeLanguage(
    { name: "Julia", alias: ["jl", "julia"], extensions: ["jl"] },
    julia,
  ),
  legacyCodeLanguage(
    { name: "Lua", alias: ["lua"], extensions: ["lua"] },
    lua,
  ),
  legacyCodeLanguage(
    { name: "Perl", alias: ["perl", "pl"], extensions: ["pl", "pm"] },
    perl,
  ),
  legacyCodeLanguage(
    { name: "PowerShell", alias: ["powershell", "ps1", "pwsh"], extensions: ["ps1", "psm1", "psd1"] },
    powerShell,
  ),
  legacyCodeLanguage(
    { name: "R", alias: ["r", "rscript"], extensions: ["r", "R"] },
    rLanguage,
  ),
  legacyCodeLanguage(
    { name: "Clojure", alias: ["clj", "cljs", "cljc", "clojure"], extensions: ["clj", "cljs", "cljc"] },
    clojure,
  ),
  legacyCodeLanguage(
    { name: "Common Lisp", alias: ["cl", "commonlisp", "lisp"], extensions: ["cl", "lisp", "lsp"] },
    commonLisp,
  ),
  legacyCodeLanguage(
    { name: "Scheme", alias: ["scheme", "scm"], extensions: ["scm", "ss"] },
    scheme,
  ),
  legacyCodeLanguage(
    { name: "Groovy", alias: ["gradle", "groovy"], extensions: ["gradle", "groovy"] },
    groovy,
  ),
  legacyCodeLanguage(
    { name: "CMake", alias: ["cmake"], extensions: ["cmake"], filename: /^CMakeLists\.txt$/ },
    cmake,
  ),
  legacyCodeLanguage(
    { name: "Protocol Buffers", alias: ["proto", "protobuf"], extensions: ["proto"] },
    protobuf,
  ),
  legacyCodeLanguage(
    { name: "Crystal", alias: ["cr", "crystal"], extensions: ["cr"] },
    crystal,
  ),
  legacyCodeLanguage(
    { name: "Elm", alias: ["elm"], extensions: ["elm"] },
    elm,
  ),
  legacyCodeLanguage(
    { name: "Fortran", alias: ["fortran", "f90", "f95"], extensions: ["f", "f90", "f95"] },
    fortran,
  ),
  legacyCodeLanguage(
    { name: "MATLAB/Octave", alias: ["matlab", "octave"], extensions: ["m"] },
    octave,
  ),
  legacyCodeLanguage(
    { name: "SCSS", alias: ["scss", "sass"], extensions: ["scss", "sass"] },
    sCSS,
  ),
  legacyCodeLanguage(
    { name: "Less", alias: ["less"], extensions: ["less"] },
    less,
  ),
  legacyCodeLanguage(
    { name: "Stylus", alias: ["styl", "stylus"], extensions: ["styl"] },
    stylus,
  ),
  legacyCodeLanguage(
    { name: "Pug", alias: ["jade", "pug"], extensions: ["jade", "pug"] },
    pug,
  ),
  legacyCodeLanguage(
    { name: "LaTeX", alias: ["latex", "tex"], extensions: ["tex"] },
    stex,
  ),
  legacyCodeLanguage(
    { name: "Nginx", alias: ["nginx"], extensions: ["conf"] },
    nginx,
  ),
  legacyCodeLanguage(
    { name: "Properties", alias: ["conf", "ini", "properties"], extensions: ["conf", "ini", "properties"] },
    properties,
  ),
  legacyCodeLanguage(
    { name: "Turtle", alias: ["ttl", "turtle"], extensions: ["ttl"] },
    turtle,
  ),
  legacyCodeLanguage(
    { name: "SPARQL", alias: ["sparql"], extensions: ["rq", "sparql"] },
    sparql,
  ),
  legacyCodeLanguage(
    { name: "SAS", alias: ["sas"], extensions: ["sas"] },
    sas,
  ),
  legacyCodeLanguage(
    { name: "Puppet", alias: ["puppet", "pp"], extensions: ["pp"] },
    puppet,
  ),
  legacyCodeLanguage(
    { name: "HTTP", alias: ["http"], extensions: ["http"] },
    http,
  ),
  legacyCodeLanguage(
    { name: "Smalltalk", alias: ["smalltalk", "st"], extensions: ["st"] },
    smalltalk,
  ),
  legacyCodeLanguage(
    { name: "Verilog", alias: ["sv", "systemverilog", "verilog"], extensions: ["sv", "v"] },
    verilog,
  ),
  legacyCodeLanguage(
    { name: "VHDL", alias: ["vhdl", "vhd"], extensions: ["vhd", "vhdl"] },
    vhdl,
  ),
  legacyCodeLanguage(
    { name: "Visual Basic", alias: ["vb", "vbnet", "visualbasic"], extensions: ["vb"] },
    visualBasic,
  ),
  legacyCodeLanguage(
    { name: "WebAssembly", alias: ["wasm", "wat", "wast"], extensions: ["wat", "wast"] },
    wast,
  ),
  legacyCodeLanguage(
    { name: "Brainfuck", alias: ["bf", "brainfuck"], extensions: ["bf"] },
    brainfuck,
  ),
];

export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "var(--rip-heading)", fontWeight: "780" },
  {
    tag: [tags.link, tags.url],
    color: "var(--rip-link)",
    textDecoration: "underline",
  },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  {
    tag: [
      tags.keyword,
      tags.operatorKeyword,
      tags.controlKeyword,
      tags.definitionKeyword,
    ],
    color: "var(--rip-syntax-purple)",
  },
  {
    tag: [tags.atom, tags.bool, tags.null, tags.labelName],
    color: "var(--rip-syntax-orange)",
  },
  {
    tag: [tags.number, tags.integer, tags.float, tags.literal],
    color: "var(--rip-syntax-green)",
  },
  {
    tag: [tags.string, tags.character, tags.attributeValue],
    color: "var(--rip-syntax-orange)",
  },
  {
    tag: [tags.variableName, tags.propertyName, tags.attributeName],
    color: "var(--rip-syntax-blue)",
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.tagName],
    color: "var(--rip-syntax-purple)",
  },
  {
    tag: [tags.comment, tags.docComment],
    color: "var(--rip-muted)",
    fontStyle: "italic",
  },
  {
    tag: [tags.punctuation, tags.bracket, tags.separator],
    color: "var(--rip-muted)",
  },
  { tag: tags.invalid, color: "var(--rip-danger)" },
]);
