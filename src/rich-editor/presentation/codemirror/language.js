import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { HighlightStyle, LanguageDescription } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const codeLanguages = [
  LanguageDescription.of({
    name: "JSON",
    alias: ["json", "jsonc"],
    extensions: ["json", "jsonc"],
    support: json(),
  }),
  LanguageDescription.of({
    name: "JavaScript",
    alias: ["js", "javascript", "mjs", "cjs", "jsx"],
    extensions: ["js", "mjs", "cjs", "jsx"],
    support: javascript({ jsx: true }),
  }),
  LanguageDescription.of({
    name: "TypeScript",
    alias: ["ts", "typescript", "tsx"],
    extensions: ["ts", "tsx"],
    support: javascript({ typescript: true, jsx: true }),
  }),
  LanguageDescription.of({
    name: "CSS",
    alias: ["css"],
    extensions: ["css"],
    support: css(),
  }),
  LanguageDescription.of({
    name: "HTML",
    alias: ["html", "xml", "svg"],
    extensions: ["html", "htm", "xml", "svg"],
    support: html(),
  }),
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
