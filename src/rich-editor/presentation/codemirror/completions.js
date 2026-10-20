// Markdown completions for the rich editor.
//
// The primary source bridges to the extension host, which runs VS Code's own
// completion providers (vscode.executeCompletionItemProvider) against the real
// TextDocument. That surfaces the same suggestions the standard text editor
// shows, including ones contributed by other extensions (for example model
// names in agent files) — and nothing more, so ordinary prose typing stays
// quiet. Local link-path and heading-anchor suggestions only step in when no
// extension host ever answers (standalone/HTML-export previews), and fence
// language ids are offered locally because no provider covers them.
import { autocompletion } from "@codemirror/autocomplete";
import { findFrontmatterBlock } from "../../domain/markdownBlocks.js";
import { codeLanguages } from "./language.js";

const LINK_TARGET_PATTERN = /!?\[[^\]]*\]\([^)\s]*$/;
const FENCE_PATTERN = /^\s{0,3}(`{3,}|~{3,}|:{3,})([\w+#-]*)$/;
const WORDISH_PATTERN = /[\w#/.-]+$/;

// vscode.CompletionItemKind → CodeMirror completion type (CSS class only).
const HOST_KIND_TYPES = {
  0: "text",
  1: "method",
  2: "function",
  3: "function",
  4: "property",
  5: "variable",
  6: "class",
  7: "interface",
  8: "namespace",
  9: "property",
  11: "constant",
  12: "enum",
  13: "keyword",
  14: "text",
  15: "constant",
  16: "variable",
  17: "text",
  18: "variable",
  19: "enum",
  20: "constant",
  21: "type",
};

export function createMarkdownCompletion({ postMessage }) {
  let requestSequence = 0;
  const pendingHostRequests = new Map();
  const pendingLinkRequests = new Map();
  // null = unknown, false = a request timed out (standalone/export preview),
  // true = the extension host answered at least once.
  let hostAvailable = null;

  function handleHostCompletions(message) {
    const pending = pendingHostRequests.get(message.requestId);
    if (!pending) {
      return;
    }
    pendingHostRequests.delete(message.requestId);
    hostAvailable = true;
    pending(Array.isArray(message.items) ? message.items : []);
  }

  function handleLinkCompletions(message) {
    const pending = pendingLinkRequests.get(message.requestId);
    if (!pending) {
      return;
    }
    pendingLinkRequests.delete(message.requestId);
    pending(Array.isArray(message.paths) ? message.paths : []);
  }

  function requestWithTimeout(pendingMap, message, timeoutMs) {
    return new Promise((resolve) => {
      const requestId = String((requestSequence += 1));
      // An unanswered request (no extension host: exports, tests) must degrade
      // to "no suggestions", not a hang.
      const timeout = window.setTimeout(() => {
        pendingMap.delete(requestId);
        if (hostAvailable === null) {
          hostAvailable = false;
        }
        resolve([]);
      }, timeoutMs);
      pendingMap.set(requestId, (payload) => {
        window.clearTimeout(timeout);
        resolve(payload);
      });
      postMessage({ ...message, requestId });
    });
  }

  function requestHostCompletionItems(state, pos) {
    const line = state.doc.lineAt(pos);
    // Line coordinates plus the line text let the host wait until the queued
    // webview edit has landed in the TextDocument before running providers.
    return requestWithTimeout(
      pendingHostRequests,
      {
        type: "requestHostCompletions",
        line: line.number - 1,
        character: pos - line.from,
        lineText: line.text,
        docLength: state.doc.length,
      },
      3000,
    );
  }

  function requestLinkPaths() {
    return requestWithTimeout(
      pendingLinkRequests,
      { type: "requestLinkCompletions" },
      2000,
    );
  }

  function fenceLanguageSource(context) {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    const fence = before.match(FENCE_PATTERN);
    if (!fence) {
      return null;
    }
    return {
      from: context.pos - fence[2].length,
      options: getFenceLanguageOptions(),
      validFor: /^[\w+#-]*$/,
    };
  }

  // Bridges VS Code's completion providers into CodeMirror. Falls back to
  // local link-path and heading-anchor suggestions when no host answers.
  async function hostCompletionSource(context) {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    if (FENCE_PATTERN.test(before)) {
      return null;
    }

    const linkTarget = context.matchBefore(LINK_TARGET_PATTERN);
    const wordish = context.matchBefore(WORDISH_PATTERN);
    // "key:" or a list dash inside front matter should open value suggestions
    // (for example model names in agent files) just like the normal editor.
    const frontmatterTrigger =
      isInsideFrontmatter(context) && (/[:-] ?$/.test(before) || wordish);
    // VS Code keeps quick suggestions off for Markdown prose: the standard
    // editor only opens completions on trigger characters or Ctrl+Space, so
    // ordinary word typing must not invoke providers here either.
    if (!context.explicit && !linkTarget && !frontmatterTrigger) {
      return null;
    }

    const anchorFrom = linkTarget
      ? linkTarget.from + linkTarget.text.lastIndexOf("(") + 1
      : (wordish?.from ?? context.pos);

    if (hostAvailable !== false) {
      const items = await requestHostCompletionItems(context.state, context.pos);
      if (items.length > 0) {
        return buildHostCompletionResult(context, items, anchorFrom);
      }
    }

    // The host answering with no items means the standard editor would show
    // nothing here either. Local link suggestions only cover the case where no
    // extension host exists at all.
    if (hostAvailable !== false || context.aborted || !linkTarget) {
      return null;
    }
    return buildLocalLinkCompletionResult(context, anchorFrom);
  }

  function buildHostCompletionResult(context, items, anchorFrom) {
    const lineFrom = context.state.doc.lineAt(context.pos).from;
    let from = anchorFrom;
    for (const item of items) {
      if (
        typeof item.fromOffset === "number" &&
        item.fromOffset >= lineFrom &&
        item.fromOffset < from
      ) {
        from = item.fromOffset;
      }
    }
    const options = items.map((item) => {
      let apply = item.insertText || item.label;
      // All options share one replace start; items whose own range starts
      // later must re-insert the text between the two starts.
      if (
        typeof item.fromOffset === "number" &&
        item.fromOffset > from &&
        item.fromOffset <= context.pos
      ) {
        apply = context.state.doc.sliceString(from, item.fromOffset) + apply;
      }
      return {
        label: item.label,
        detail: item.detail,
        type: HOST_KIND_TYPES[item.kind] || "text",
        apply,
      };
    });
    return {
      from,
      options,
      validFor: /^[\w#/.-]*$/,
    };
  }

  async function buildLocalLinkCompletionResult(context, from) {
    const prefix = context.state.doc.sliceString(from, context.pos);
    if (/^[a-z][\w+.-]*:/i.test(prefix)) {
      return null;
    }
    if (prefix.startsWith("#")) {
      return {
        from,
        options: collectHeadingAnchors(context.state.doc).map((anchor) => ({
          label: `#${anchor.slug}`,
          detail: anchor.title,
          type: "text",
        })),
        validFor: /^#[^)\s]*$/,
      };
    }
    const paths = await requestLinkPaths();
    if (paths.length === 0) {
      return null;
    }
    return {
      from,
      options: paths.map((path) => ({
        label: path,
        // Spaces break Markdown link targets; encode them like VS Code does.
        apply: path.replace(/ /g, "%20"),
        type: "text",
      })),
      validFor: /^[^)\s#]*$/,
    };
  }

  return {
    extension: autocompletion({
      override: [fenceLanguageSource, hostCompletionSource],
      icons: false,
    }),
    handleHostCompletions,
    handleLinkCompletions,
  };
}

function isInsideFrontmatter(context) {
  const frontmatterBlock = findFrontmatterBlock(context.state.doc);
  return Boolean(
    frontmatterBlock &&
      context.pos >= frontmatterBlock.from &&
      context.pos <= frontmatterBlock.sourceTo,
  );
}

let fenceLanguageOptions = null;

function getFenceLanguageOptions() {
  if (fenceLanguageOptions) {
    return fenceLanguageOptions;
  }
  const aliases = new Set(["mermaid"]);
  for (const description of codeLanguages) {
    for (const alias of description.alias || []) {
      aliases.add(alias);
    }
  }
  fenceLanguageOptions = [...aliases].sort().map((alias) => ({
    label: alias,
    type: "keyword",
  }));
  return fenceLanguageOptions;
}

export function collectHeadingAnchors(doc) {
  return scanHeadingAnchors(doc).map(({ slug, title }) => ({ slug, title }));
}

// Finds the heading or HTML anchor a `#anchor` link points to. Exact GitHub
// slugs win; an anchor written as heading text ("#Getting Started") is
// slugified as a fallback.
export function findHeadingAnchor(doc, anchor) {
  const anchors = scanHeadingAnchors(doc);
  const wanted = String(anchor || "").toLowerCase();
  return (
    anchors.find((candidate) => candidate.slug === wanted) ||
    anchors.find((candidate) => candidate.slug === slugifyHeading(wanted)) ||
    null
  );
}

const ATX_HEADING_PATTERN = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const SETEXT_UNDERLINE_PATTERN = /^ {0,3}(?:=+|-+)[ \t]*$/;
const ANCHOR_FENCE_OPENING_PATTERN = /^[ \t]*(`{3,}|~{3,})/;
const ANCHOR_FENCE_CLOSING_PATTERN = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;
const LIST_ITEM_PATTERN = /^[ \t]*(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
const BLOCK_QUOTE_PATTERN = /^ {0,3}>/;
const HTML_BLOCK_PATTERN = /^ {0,3}<\/?[A-Za-z][\w-]*(?:[\s/>]|$)/;
const HTML_ID_PATTERN = /<[A-Za-z][^>]*\b(?:id|name)\s*=\s*["']([^"']+)["'][^>]*>/g;

// Walks the document the way the host's Markdown structure scanner does, so a
// link the linter accepts is one the editor can jump to: front matter, fenced
// code and HTML comments hold no anchors, setext headings do, and so do
// `<a id="...">` / `name="..."` attributes in HTML.
function scanHeadingAnchors(doc) {
  const anchors = [];
  const seen = new Map();
  const addHeading = (title, from) => {
    let slug = slugifyHeading(title);
    if (!slug) {
      return;
    }
    // GitHub dedupes repeated heading slugs with -1, -2, ... suffixes.
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    if (count > 0) {
      slug = `${slug}-${count}`;
    }
    anchors.push({ slug, title, from });
  };

  const frontmatter = findFrontmatterBlock(doc);
  let lineNumber = frontmatter ? frontmatter.sourceLineCount + 1 : 1;
  let fence = null;
  let commentOpen = false;
  // The paragraph a setext underline would turn into a heading. Text that
  // continues a list item, quote or HTML block cannot become one.
  let paragraph = null;

  for (; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    const text = line.text;

    if (fence) {
      const closing = text.match(ANCHOR_FENCE_CLOSING_PATTERN);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (commentOpen) {
      commentOpen = !text.includes("-->");
      continue;
    }
    if (/^\s*$/.test(text)) {
      paragraph = null;
      continue;
    }

    const fenceOpening = text.match(ANCHOR_FENCE_OPENING_PATTERN);
    if (fenceOpening) {
      fence = fenceOpening[1];
      paragraph = null;
      continue;
    }
    if (/^\s*<!--/.test(text)) {
      commentOpen = !text.slice(text.indexOf("<!--") + 4).includes("-->");
      paragraph = null;
      continue;
    }

    for (const match of text.matchAll(HTML_ID_PATTERN)) {
      anchors.push({ slug: normalizeAnchor(match[1]), title: match[0], from: line.from });
    }

    if (SETEXT_UNDERLINE_PATTERN.test(text)) {
      if (paragraph?.eligible) {
        addHeading(paragraph.lines.join(" "), paragraph.from);
      }
      paragraph = null;
      continue;
    }

    const heading = text.match(ATX_HEADING_PATTERN);
    if (heading) {
      if (heading[1]) {
        addHeading(heading[1], line.from);
      }
      paragraph = null;
      continue;
    }

    if (
      LIST_ITEM_PATTERN.test(text) ||
      BLOCK_QUOTE_PATTERN.test(text) ||
      HTML_BLOCK_PATTERN.test(text)
    ) {
      paragraph = { eligible: false };
      continue;
    }
    if (paragraph) {
      paragraph.lines?.push(text.trim());
    } else {
      paragraph = { eligible: true, from: line.from, lines: [text.trim()] };
    }
  }
  return anchors;
}

function normalizeAnchor(anchor) {
  try {
    return decodeURIComponent(anchor).toLowerCase();
  } catch (error) {
    return anchor.toLowerCase();
  }
}

// GitHub's heading anchor rules (github-slugger): lowercase, drop everything
// but letters, marks, numbers, connector punctuation (`_`), spaces and dashes,
// then turn each space into a dash without collapsing runs, so
// "C++ / C#" becomes "c--c".
export function slugifyHeading(title) {
  return String(title)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, "")
    .replace(/\s/g, "-");
}
