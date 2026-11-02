// Maps a click in rendered Markdown (a callout or <details> body) back to the
// source position under it, so the caret lands where the user clicked rather
// than at the start of the line.
import { syntaxTree } from "@codemirror/language";
import { findWikilinks } from "../../../markdown/wikilinks.js";
import { isMarkdownMarker } from "./links.js";

// Elements whose text the renderer made up rather than took from the source.
const generatedTextSelector = ".cm-details-list-marker";
// Rendered blocks whose text does not follow their source line.
const unmappedBlockSelector = ".cm-details-code, .cm-details-table";

// Where a click in a rendered body line falls in the source. `sourceFrom` is
// where the line's source text starts; the click lands there when it cannot
// be placed more precisely.
export function sourcePositionAtClick(state, element, sourceFrom, event) {
  if (element.matches(unmappedBlockSelector)) {
    return sourceFrom;
  }
  const prefix = renderedPrefixAtPoint(element, event.clientX, event.clientY);
  return prefix === null
    ? sourceFrom
    : sourcePositionForRenderedPrefix(state, sourceFrom, prefix);
}

// The text of `element` before the point, or null when the point is not over
// its text.
export function renderedPrefixAtPoint(element, x, y) {
  const document = element.ownerDocument;
  let node = null;
  let offset = 0;
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(x, y);
    node = position?.offsetNode ?? null;
    offset = position?.offset ?? 0;
  } else if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(x, y);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  }
  if (!node || !element.contains(node)) {
    return null;
  }
  const caret = document.createRange();
  caret.setStart(node, offset);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let prefix = "";
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (text === node) {
      if (!text.parentElement?.closest(generatedTextSelector)) {
        prefix += text.data.slice(0, offset);
      }
      break;
    }
    if (caret.comparePoint(text, text.length) > 0) {
      break;
    }
    if (!text.parentElement?.closest(generatedTextSelector)) {
      prefix += text.data;
    }
  }
  return prefix;
}

// The source position on the line starting at `from` after which the
// rendered text reads `renderedPrefix`. Markup the renderer drops (emphasis
// marks, link targets, list markers, wikilink brackets, ...) is skipped;
// anything else the two disagree on is treated as dropped markup too.
export function sourcePositionForRenderedPrefix(state, from, renderedPrefix) {
  const line = state.doc.lineAt(from);
  const hidden = collectHiddenRanges(state, from, line);
  let position = from;
  let matched = 0;
  while (matched < renderedPrefix.length && position < line.to) {
    const range = hidden.find((candidate) => candidate.from <= position && position < candidate.to);
    if (range) {
      position = range.to;
      continue;
    }
    if (state.doc.sliceString(position, position + 1) === renderedPrefix[matched]) {
      matched += 1;
    }
    position += 1;
  }
  return position;
}

function collectHiddenRanges(state, from, line) {
  const ranges = [];
  syntaxTree(state).iterate({
    from,
    to: line.to,
    enter(node) {
      if (
        isMarkdownMarker(node.name) ||
        node.name === "ListMark" ||
        node.name === "LinkTitle" ||
        (node.name === "URL" && /^(Link|Image)$/.test(node.node.parent?.name ?? ""))
      ) {
        ranges.push({ from: node.from, to: node.to });
      }
    },
  });
  for (const link of findWikilinks(line.text)) {
    ranges.push(
      { from: line.from + link.from, to: line.from + link.labelFrom },
      { from: line.from + link.labelTo, to: line.from + link.to },
    );
  }
  return ranges;
}
