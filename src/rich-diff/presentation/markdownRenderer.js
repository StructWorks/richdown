// Markdown renderer used by the rich diff webview.
//
// The renderer works line-by-line because diff rows are line-based. A first
// analysis pass records multi-line context such as fenced code blocks and
// tables, then renderMarkdownLine can output richer HTML for each row.
import { escapeAttribute, escapeHtml } from "./htmlEscape.js";

const LANGUAGE_ALIASES = new Map([
  ["bf", "brainfuck"],
  ["c++", "cpp"],
  ["c#", "csharp"],
  ["cc", "cpp"],
  ["cl", "lisp"],
  ["clj", "clojure"],
  ["cljc", "clojure"],
  ["cljs", "clojure"],
  ["commonlisp", "lisp"],
  ["cr", "crystal"],
  ["cs", "csharp"],
  ["cxx", "cpp"],
  ["dartlang", "dart"],
  ["ex", "elixir"],
  ["exs", "elixir"],
  ["erl", "erlang"],
  ["f#", "fsharp"],
  ["f90", "fortran"],
  ["f95", "fortran"],
  ["fish", "bash"],
  ["flutter", "dart"],
  ["fs", "fsharp"],
  ["fsi", "fsharp"],
  ["fsx", "fsharp"],
  ["gql", "graphql"],
  ["golang", "go"],
  ["h", "cpp"],
  ["hh", "cpp"],
  ["hs", "haskell"],
  ["hpp", "cpp"],
  ["hxx", "cpp"],
  ["jl", "julia"],
  ["kt", "kotlin"],
  ["kts", "kotlin"],
  ["make", "makefile"],
  ["md", "markdown"],
  ["ml", "ocaml"],
  ["mli", "ocaml"],
  ["mysql", "sql"],
  ["objc", "objectivec"],
  ["objective-c", "objectivec"],
  ["octave", "matlab"],
  ["postgres", "sql"],
  ["postgresql", "sql"],
  ["proto", "protobuf"],
  ["ps1", "powershell"],
  ["pwsh", "powershell"],
  ["py", "python"],
  ["rb", "ruby"],
  ["rs", "rust"],
  ["rscript", "r"],
  ["sass", "scss"],
  ["scm", "scheme"],
  ["sh", "bash"],
  ["shell", "bash"],
  ["sqlite", "sql"],
  ["sv", "verilog"],
  ["systemverilog", "verilog"],
  ["terminal", "bash"],
  ["tex", "latex"],
  ["ttl", "turtle"],
  ["vb", "vbnet"],
  ["vhd", "vhdl"],
  ["visualbasic", "vbnet"],
  ["wat", "wasm"],
  ["wast", "wasm"],
  ["yml", "yaml"],
  ["zsh", "bash"],
]);

export function createMarkdownRenderer({ hljs, registerCopyPayload }) {
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
  
      // Mark the delimiter separately. The renderer turns it into a subtle rule
      // so Markdown table syntax does not dominate the diff.
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
    const lower = language.toLowerCase().replace(/^language-/, "");
    if (lower === "jsx" || lower === "mjs" || lower === "cjs") return "javascript";
    if (lower === "json5") return "json";
    if (lower === "tsx") return "typescript";
    return LANGUAGE_ALIASES.get(lower) || lower;
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
      // Keep the diff readable even if highlight.js rejects a language grammar.
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
    const pattern =
      /!\[(?<imageAlt>[^\]]*)\]\(\s*(?:<(?<imageSrcAngle>[^>]+)>|(?<imageSrc>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|`(?<code>[^`]+)`|\*\*(?<boldStar>[^*]+)\*\*|__(?<boldUnderscore>[^_]+)__|\*(?<italicStar>[^*\s][^*]*?)\*|_(?<italicUnderscore>[^_\s][^_]*?)_|~~(?<strike>[^~]+)~~|\[(?<linkText>[^\]]+)\]\(\s*(?:<(?<linkHrefAngle>[^>]+)>|(?<linkHref>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|(?<bareUrl>https?:\/\/[^\s<>"')\]]+)/g;
    let html = "";
    let lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
      const groups = match.groups || {};
      html += escapeHtml(text.slice(lastIndex, match.index));

      if (groups.imageAlt !== undefined) {
        const src = groups.imageSrcAngle || groups.imageSrc || "";
        html += `<span class="rdiff-image" data-image-src="${escapeAttribute(src)}" data-image-alt="${escapeAttribute(groups.imageAlt)}"><span class="rdiff-image-loading">${escapeHtml(groups.imageAlt || "Loading image")}</span></span>`;
      } else if (groups.code !== undefined) {
        html += `<code>${escapeHtml(groups.code)}</code>`;
      } else if (
        groups.boldStar !== undefined ||
        groups.boldUnderscore !== undefined
      ) {
        html += `<strong>${escapeHtml(groups.boldStar ?? groups.boldUnderscore)}</strong>`;
      } else if (
        groups.italicStar !== undefined ||
        groups.italicUnderscore !== undefined
      ) {
        html += `<em>${escapeHtml(groups.italicStar ?? groups.italicUnderscore)}</em>`;
      } else if (groups.strike !== undefined) {
        html += `<del>${escapeHtml(groups.strike)}</del>`;
      } else if (groups.linkText !== undefined || groups.bareUrl !== undefined) {
        const href =
          groups.bareUrl || groups.linkHrefAngle || groups.linkHref || "";
        const label = groups.bareUrl || groups.linkText || href;
        html += `<a href="#" data-href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
      }

      lastIndex = match.index + match[0].length;
    }

    html += escapeHtml(text.slice(lastIndex));
    return html;
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

  return {
    analyzeMarkdownLines,
    renderMarkdownLine,
  };
}
