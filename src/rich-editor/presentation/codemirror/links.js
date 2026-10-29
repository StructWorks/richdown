import { findWikilinks, isImageTarget, wikilinkHref } from "../../../markdown/wikilinks.js";

export function isMarkdownMarker(nodeName) {
  return [
    "HeaderMark",
    "QuoteMark",
    "EmphasisMark",
    "CodeMark",
    "LinkMark",
    "TaskMarker",
    "StrikethroughMark",
    "CodeInfo",
    "TableDelimiter",
  ].includes(nodeName);
}

export function findLinkAtClick(view, event) {
  if (event.target.closest(".cm-image-preview")) {
    return null;
  }

  const position =
    view.posAtCoords(
      {
        x: event.clientX,
        y: event.clientY,
      },
      true,
    ) ??
    view.posAtCoords({
      x: event.clientX,
      y: event.clientY,
    });
  if (position === null) {
    return null;
  }

  const line = view.state.doc.lineAt(position);
  const lineFocused = isLineFocused(view.state, line);
  const offset = position - line.from;

  for (const link of collectLineLinks(line.text)) {
    const hitFrom = lineFocused ? link.sourceFrom : link.visibleFrom;
    const hitTo = lineFocused ? link.sourceTo : link.visibleTo;
    if (offset < hitFrom || offset > hitTo) {
      continue;
    }
    if (
      !isClickInsideTextRange(view, line.from + hitFrom, line.from + hitTo, event)
    ) {
      continue;
    }
    return {
      href: link.href,
      position,
      ...(link.wikilink ? { wikilink: true } : {}),
    };
  }

  return null;
}

function collectLineLinks(text) {
  const links = [];

  // The target may be wrapped in <...> and followed by a "title", like the
  // inline Markdown renderer accepts.
  for (const match of text.matchAll(
    /(!?)\[([^\]]+)\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g,
  )) {
    if (match[1]) {
      continue;
    }
    const sourceFrom = match.index;
    const labelFrom = sourceFrom + 1;
    const labelTo = labelFrom + match[2].length;
    links.push({
      href: match[3] ?? match[4],
      sourceFrom,
      sourceTo: sourceFrom + match[0].length,
      visibleFrom: labelFrom,
      visibleTo: labelTo,
    });
  }

  // Wikilinks carry the name for the host to resolve rather than a path.
  // Image embeds are drawn as images and open from the image itself.
  for (const link of findWikilinks(text)) {
    if (link.embed && isImageTarget(link.target)) {
      continue;
    }
    links.push({
      href: wikilinkHref(link),
      wikilink: true,
      sourceFrom: link.from,
      sourceTo: link.to,
      visibleFrom: link.labelFrom,
      visibleTo: link.labelTo,
    });
  }

  for (const match of text.matchAll(/https?:\/\/[^\s)]+/g)) {
    links.push({
      href: match[0],
      sourceFrom: match.index,
      sourceTo: match.index + match[0].length,
      visibleFrom: match.index,
      visibleTo: match.index + match[0].length,
    });
  }

  return links;
}

function isLineFocused(state, line) {
  const selection = state.selection.main;
  return selection.from >= line.from && selection.to <= line.to;
}

function isClickInsideTextRange(view, from, to, event) {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  if (!start || !end) {
    return false;
  }

  const left = Math.min(start.left, end.left) - 2;
  const right = Math.max(start.left, end.left) + 2;
  const top = Math.min(start.top, end.top) - 3;
  const bottom = Math.max(start.bottom, end.bottom) + 3;

  return (
    event.clientX >= left &&
    event.clientX <= right &&
    event.clientY >= top &&
    event.clientY <= bottom
  );
}
