import {
  calloutColors,
  calloutThemeCss,
  darkThemeSelectors,
} from "../../markdown/callouts.js";

export function injectStyles() {
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
    ${calloutThemeCss(darkThemeSelectors)}
    ${calloutColors
      .map((color) => `.rdiff-callout-${color} { --callout-color: var(--rip-callout-${color}); }`)
      .join("\n    ")}
    .rdiff-wikilink {
      color: var(--rip-link);
    }
    .rdiff-callout {
      border-left: 0.25em solid var(--callout-color);
      padding-left: 0.9em;
    }
    .rdiff-callout-obsidian {
      background: color-mix(in srgb, var(--callout-color) 10%, transparent);
    }
    .rdiff-callout-title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--callout-color);
      font-weight: 500;
    }
    .rdiff-callout-icon {
      flex: none;
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
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      vertical-align: top;
    }
    .rdiff-image img {
      width: auto;
      height: auto;
      max-width: min(100%, 520px);
      max-height: 320px;
      display: block;
      border: 1px solid var(--rip-border);
      border-radius: 7px;
      background: var(--rip-panel);
      aspect-ratio: auto;
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
    .rdiff-row.is-single {
      min-width: 380px;
      grid-template-columns: minmax(360px, 1fr);
    }
    .rdiff-column-header.is-single {
      grid-template-columns: minmax(360px, 1fr);
    }
    .rdiff-single.is-added-file .rdiff-marker {
      color: var(--rip-syntax-green);
      box-shadow: inset 3px 0 var(--rdiff-add-border);
    }
    .rdiff-single.is-deleted-file .rdiff-marker {
      color: var(--rip-danger);
      box-shadow: inset 3px 0 var(--rdiff-delete-border);
    }
    .rdiff-single.is-deleted-file .rdiff-content {
      opacity: 0.86;
    }
    .rdiff-button {
      flex: 0 0 auto;
      border: 1px solid var(--rip-border);
      border-radius: 5px;
      padding: 3px 10px;
      color: var(--rip-fg);
      background: var(--rip-bg);
      font: 12px var(--vscode-font-family);
      cursor: pointer;
    }
    .rdiff-button:hover {
      color: var(--rip-heading);
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .rdiff-button:focus-visible,
    .rdiff-file-item:focus-visible {
      outline: 1px solid var(--rip-focus);
      outline-offset: -1px;
    }
    .rdiff-commit {
      height: 100%;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      color: var(--rip-fg);
      background: var(--rip-bg);
      font-family: var(--vscode-font-family);
      font-size: 14px;
    }
    .rdiff-commit-header {
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid var(--rip-border);
      padding: 10px 14px;
      background: color-mix(in srgb, var(--rip-panel) 82%, var(--rip-bg));
    }
    .rdiff-commit-info {
      min-width: 0;
      display: grid;
      gap: 3px;
    }
    .rdiff-commit-title {
      color: var(--rip-heading);
      font-size: 15px;
      font-weight: 760;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rdiff-commit-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      color: var(--rip-muted);
      font-size: 12px;
    }
    .rdiff-commit-meta > span:first-child {
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
    }
    .rdiff-commit-note {
      color: var(--rip-syntax-orange);
      font-size: 12px;
    }
    .rdiff-commit-body {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(200px, 280px) minmax(0, 1fr);
    }
    .rdiff-commit-main {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    /* Column labels here are commit hashes, which must keep their case. */
    .rdiff-commit .rdiff-column-header {
      text-transform: none;
    }
    .rdiff-files {
      min-height: 0;
      overflow: auto;
      border-right: 1px solid var(--rip-border);
      background: color-mix(in srgb, var(--rip-panel) 56%, var(--rip-bg));
    }
    .rdiff-files-heading {
      position: sticky;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--rip-border);
      padding: 7px 12px;
      color: var(--rip-muted);
      background: color-mix(in srgb, var(--rip-panel) 82%, var(--rip-bg));
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .rdiff-files-count {
      border-radius: 999px;
      padding: 0 7px;
      background: var(--rip-bg);
      font-variant-numeric: tabular-nums;
    }
    .rdiff-file-list {
      margin: 0;
      padding: 4px 0;
      list-style: none;
    }
    .rdiff-file-item {
      width: 100%;
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      border: 0;
      border-left: 2px solid transparent;
      padding: 5px 12px 5px 10px;
      color: var(--rip-fg);
      background: transparent;
      font: 13px var(--vscode-font-family);
      text-align: left;
      cursor: pointer;
    }
    .rdiff-file-item:hover {
      background: var(--rip-hover);
    }
    .rdiff-file-item.is-selected {
      border-left-color: var(--rip-focus);
      background: color-mix(in srgb, var(--rip-focus) 18%, transparent);
    }
    .rdiff-file-status {
      font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      font-size: 12px;
      font-weight: 760;
      text-align: center;
    }
    .rdiff-file-item.is-added .rdiff-file-status { color: var(--rip-syntax-green); }
    .rdiff-file-item.is-deleted .rdiff-file-status { color: var(--rip-danger); }
    .rdiff-file-item.is-modified .rdiff-file-status { color: var(--rip-syntax-orange); }
    .rdiff-file-item.is-renamed .rdiff-file-status { color: var(--rip-syntax-blue); }
    .rdiff-file-item.is-deleted .rdiff-file-name {
      text-decoration: line-through;
    }
    .rdiff-file-text {
      min-width: 0;
      display: grid;
    }
    .rdiff-file-name,
    .rdiff-file-dir {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rdiff-file-dir {
      color: var(--rip-muted);
      font-size: 11px;
    }
    .rdiff-file-counts {
      display: inline-flex;
      gap: 5px;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .rdiff-file-add { color: var(--rip-syntax-green); }
    .rdiff-file-delete { color: var(--rip-danger); }
    .rdiff-status-badge {
      margin-left: 8px;
      border: 1px solid var(--rip-border);
      border-radius: 999px;
      padding: 1px 7px;
      color: var(--rip-muted);
      font-size: 11px;
      font-weight: 600;
      vertical-align: 2px;
    }
    .rdiff-status-badge.is-added {
      color: var(--rip-syntax-green);
      border-color: var(--rdiff-add-border);
      background: var(--rdiff-add-bg);
    }
    .rdiff-status-badge.is-deleted {
      color: var(--rip-danger);
      border-color: var(--rdiff-delete-border);
      background: var(--rdiff-delete-bg);
    }
    .rdiff-loading {
      height: 100%;
      display: grid;
      place-content: center;
      color: var(--rip-muted);
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
      .rdiff-commit-header {
        align-items: flex-start;
        flex-direction: column;
      }
      .rdiff-commit-body {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto minmax(0, 1fr);
      }
      .rdiff-files {
        max-height: 30vh;
        border-right: 0;
        border-bottom: 1px solid var(--rip-border);
      }
    }
  `;
  document.head.appendChild(style);
}
