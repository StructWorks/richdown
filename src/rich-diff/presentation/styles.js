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
    }
  `;
  document.head.appendChild(style);
}
