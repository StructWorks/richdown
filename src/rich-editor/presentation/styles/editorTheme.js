import { EditorView } from "@codemirror/view";

export function createEditorThemeExtension() {
  return EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--rip-fg)",
    backgroundColor: "var(--rip-bg)",
    fontSize: "15px",
  },
  ".cm-scroller": {
    fontFamily:
      "var(--vscode-editor-font-family, var(--vscode-font-family))",
    lineHeight: "1.72",
    overflow: "auto",
  },
  ".cm-content": {
    maxWidth: "var(--rip-content-max-width, 960px)",
    minHeight: "100%",
    margin: "0 auto",
    padding: "28px clamp(18px, 5vw, 64px) 72px",
    caretColor: "var(--rip-caret)",
  },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--rip-caret)",
    borderLeftWidth: "2px",
  },
  ".cm-gutters": {
    color: "var(--rip-muted)",
    backgroundColor: "var(--rip-bg)",
    borderRight: "1px solid var(--rip-border)",
  },
  ".cm-gutter.cm-git-diff-gutter": {
    width: "14px",
    minWidth: "14px",
    padding: "0 2px",
    borderRight: "0",
  },
  ".cm-git-diff-gutter .cm-gutterElement": {
    position: "relative",
    padding: "0",
    minWidth: "10px",
  },
  ".cm-git-diff-gutter .cm-gutterElement[class*='cm-git-diff-line-']::before":
    {
      content: '""',
      position: "absolute",
      left: "4px",
      top: "3px",
      bottom: "3px",
      width: "6px",
      minHeight: "12px",
      borderRadius: "3px",
      backgroundColor:
        "color-mix(in srgb, var(--vscode-gitDecoration-modifiedResourceForeground, #d29922) 72%, transparent)",
    },
  ".cm-git-diff-gutter .cm-gutterElement.cm-git-diff-line-added::before": {
    backgroundColor:
      "color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #2ea043) 72%, transparent)",
  },
  ".cm-git-diff-gutter .cm-gutterElement.cm-git-diff-line-modified::before":
    {
      backgroundColor:
        "color-mix(in srgb, var(--vscode-gitDecoration-modifiedResourceForeground, #d29922) 72%, transparent)",
    },
  ".cm-git-diff-gutter .cm-gutterElement.cm-git-diff-line-deleted::before": {
    backgroundColor:
      "color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground, #f85149) 72%, transparent)",
  },
  ".cm-git-diff-gutter .cm-gutterElement.cm-git-diff-line-added.cm-git-diff-line-modified::before, .cm-git-diff-gutter .cm-gutterElement.cm-git-diff-line-added.cm-git-diff-line-deleted::before, .cm-git-diff-gutter .cm-gutterElement.cm-git-diff-line-modified.cm-git-diff-line-deleted::before":
    {
      width: "8px",
      background:
        "linear-gradient(to bottom, color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground, #f85149) 72%, transparent) 0 33%, color-mix(in srgb, var(--vscode-gitDecoration-modifiedResourceForeground, #d29922) 72%, transparent) 33% 66%, color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #2ea043) 72%, transparent) 66% 100%)",
    },
  ".cm-activeLineGutter": {
    color: "var(--rip-heading)",
    backgroundColor: "var(--rip-hover)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--rip-hover)",
  },
  ".cm-panels": {
    color: "var(--rip-fg)",
    backgroundColor: "var(--rip-panel)",
    borderColor: "var(--rip-border)",
    fontFamily: "var(--vscode-font-family)",
  },
  ".cm-panel.cm-search": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px",
    padding: "8px 34px 8px 10px",
    borderBottom: "1px solid var(--rip-border)",
  },
  ".cm-panel.cm-search input.cm-textfield": {
    minWidth: "180px",
    height: "28px",
    boxSizing: "border-box",
    border: "1px solid var(--rip-border)",
    borderRadius: "5px",
    padding: "3px 7px",
    color: "var(--rip-fg)",
    backgroundColor: "var(--rip-input-bg)",
    font: "13px var(--vscode-font-family)",
    outline: "none",
  },
  ".cm-panel.cm-search input.cm-textfield:focus": {
    borderColor: "var(--rip-focus)",
  },
  ".cm-panel.cm-search button": {
    minHeight: "26px",
    appearance: "none",
    border: "1px solid var(--rip-border)",
    borderRadius: "5px",
    padding: "2px 8px",
    color: "var(--rip-fg)",
    backgroundColor: "var(--rip-input-bg)",
    backgroundImage: "none",
    boxShadow: "none",
    font: "12px var(--vscode-font-family)",
    cursor: "pointer",
  },
  ".cm-panel.cm-search button[name=next], .cm-panel.cm-search button[name=prev]":
    {
      color: "var(--rip-button-fg)",
      borderColor: "var(--rip-accent)",
      backgroundColor: "var(--rip-accent)",
    },
  ".cm-panel.cm-search button:hover": {
    borderColor: "var(--rip-focus)",
    backgroundColor: "var(--rip-hover)",
    color: "var(--rip-fg)",
  },
  ".cm-panel.cm-search button[name=next]:hover, .cm-panel.cm-search button[name=prev]:hover":
    {
      color: "var(--rip-button-fg)",
      borderColor: "var(--rip-focus)",
      backgroundColor:
        "color-mix(in srgb, var(--rip-accent) 86%, var(--rip-bg))",
    },
  ".cm-panel.cm-search input[type=checkbox]": {
    accentColor: "var(--rip-accent)",
  },
  ".cm-panel.cm-search [name=close]": {
    top: "8px",
    right: "9px",
    width: "24px",
    height: "24px",
    border: "0",
    color: "var(--rip-muted)",
    backgroundColor: "transparent",
    backgroundImage: "none",
    fontSize: "17px",
  },
  ".cm-panel.cm-search [name=close]:hover": {
    color: "var(--rip-heading)",
    backgroundColor: "var(--rip-hover)",
  },
  ".cm-panel.cm-search label": {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    color: "var(--rip-muted)",
    fontSize: "12px",
  },
  ".cm-searchMatch": {
    backgroundColor:
      "color-mix(in srgb, var(--rip-syntax-orange) 38%, transparent)",
    outline: "1px solid color-mix(in srgb, var(--rip-syntax-orange) 45%, transparent)",
  },
  ".cm-searchMatch-selected": {
    backgroundColor:
      "color-mix(in srgb, var(--rip-heading) 46%, transparent)",
    outline: "1px solid var(--rip-heading)",
  },
  ".cm-richdown-search-match": {
    backgroundColor:
      "color-mix(in srgb, var(--vscode-editor-findMatchHighlightBackground, #ea5c0055) 82%, transparent)",
    boxShadow:
      "inset 0 -2px 0 var(--vscode-editor-findMatchHighlightBorder, color-mix(in srgb, var(--rip-syntax-orange) 70%, transparent))",
  },
  ".cm-selectionMatch": {
    backgroundColor:
      "color-mix(in srgb, var(--rip-link) 24%, transparent)",
  },
  ".cm-content ::selection": {
    backgroundColor:
      "color-mix(in srgb, var(--rip-link) 42%, transparent)",
  },
  ".cm-heading-line": {
    fontWeight: "780",
    lineHeight: "1.38",
  },
  ".cm-heading-1": {
    color: "var(--rip-heading)",
    fontSize: "2.12rem",
    borderBottom: "1px solid var(--rip-border)",
    paddingBottom: "0.12em",
  },
  ".cm-heading-2": {
    fontSize: "1.62rem",
    borderBottom: "1px solid var(--rip-border)",
    paddingBottom: "0.08em",
  },
  ".cm-heading-3": { fontSize: "1.32rem" },
  ".cm-heading-4": { fontSize: "1.15rem" },
  ".cm-heading-5": {
    color: "var(--rip-muted)",
    fontSize: "1rem",
    textTransform: "uppercase",
  },
  ".cm-heading-6": {
    color: "var(--rip-muted)",
    fontSize: "0.96rem",
    fontStyle: "italic",
  },
  ".cm-markdown-marker": {
    color: "var(--rip-muted)",
    fontSize: "0",
    opacity: "0",
  },
  ".cm-line.cm-activeLine .cm-markdown-marker": {
    fontSize: "inherit",
    opacity: "0.9",
  },
  ".cm-quote-line": {
    color: "var(--rip-muted)",
    borderLeft: "4px solid var(--rip-quote-border)",
    paddingLeft: "0.8em",
  },
  ".cm-line.cm-activeLine.cm-quote-line": { color: "var(--rip-fg)" },
  ".cm-link": {
    color: "var(--rip-link)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  ".cm-line:not(.cm-activeLine) .cm-link": {
    cursor: "pointer",
  },
  ".cm-inline-code": {
    border: "1px solid var(--rip-border)",
    borderRadius: "4px",
    padding: "0 0.26em",
    backgroundColor:
      "color-mix(in srgb, var(--rip-code-bg) 74%, transparent)",
  },
  ".cm-inline-color-preview": {
    width: "0.9em",
    height: "0.9em",
    display: "inline-block",
    marginRight: "0.34em",
    border: "1px solid color-mix(in srgb, var(--rip-border) 86%, var(--rip-fg))",
    borderRadius: "2px",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--rip-bg) 78%, transparent)",
    verticalAlign: "-0.08em",
  },
  ".cm-list-line": {
    position: "relative",
  },
  ".cm-list-marker": {
    minWidth: "1.7em",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "0.15em",
    color: "var(--rip-muted)",
    fontFamily: "var(--vscode-font-family)",
    fontWeight: "700",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-list-marker.is-unordered": {
    color: "var(--rip-heading)",
  },
  ".cm-list-marker.is-ordered": {
    minWidth: "2.2em",
    justifyContent: "flex-end",
    paddingRight: "0.25em",
    color: "var(--rip-muted)",
    fontSize: "0.92em",
  },
  ".cm-list-depth-1 .cm-list-marker.is-unordered": {
    color: "var(--rip-link)",
  },
  ".cm-list-depth-2 .cm-list-marker.is-unordered": {
    color: "var(--rip-syntax-green)",
  },
  ".cm-image-preview": {
    maxWidth: "100%",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "6px",
    margin: "0",
    verticalAlign: "top",
    cursor: "text",
  },
  ".cm-image-preview img": {
    width: "auto",
    height: "auto",
    maxWidth: "min(100%, 720px)",
    maxHeight: "460px",
    display: "block",
    border: "1px solid var(--rip-border)",
    borderRadius: "8px",
    backgroundColor: "var(--rip-panel)",
    aspectRatio: "auto",
    objectFit: "contain",
  },
  ".cm-image-preview-caption": {
    color: "var(--rip-muted)",
    font: "12px var(--vscode-font-family)",
  },
  ".cm-image-preview-error": {
    maxWidth: "100%",
    border: "1px solid var(--rip-border)",
    borderRadius: "6px",
    padding: "6px 8px",
    color: "var(--rip-muted)",
    backgroundColor: "var(--rip-panel)",
    font: "12px var(--vscode-font-family)",
  },
  ".cm-details-preview": {
    display: "block",
    boxSizing: "border-box",
    maxWidth: "100%",
    margin: "0",
    border: "1px solid var(--rip-border)",
    borderRadius: "8px",
    overflow: "hidden",
    color: "var(--rip-fg)",
    backgroundColor: "var(--rip-panel)",
  },
  ".cm-details-preview.cm-widgetBuffer": {
    display: "none",
  },
  ".cm-details-summary": {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    border: "0",
    padding: "8px 10px",
    color: "var(--rip-heading)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 86%, var(--rip-bg))",
    font: "700 14px var(--vscode-font-family)",
    textAlign: "left",
    cursor: "pointer",
  },
  ".cm-details-disclosure": {
    width: "1.2em",
    display: "inline-grid",
    placeItems: "center",
    color: "var(--rip-muted)",
    fontSize: "13px",
  },
  ".cm-details-body": {
    display: "grid",
    gap: "6px",
    borderTop: "1px solid var(--rip-border)",
    padding: "8px 10px 10px",
  },
  ".cm-details-body-line": {
    margin: "0",
    lineHeight: "1.55",
  },
  ".cm-codeblock-line": {
    position: "relative",
    fontFamily:
      "var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
    paddingLeft: "12px",
    paddingRight: "72px",
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 92%, var(--rip-code-bg))",
    boxShadow:
      "inset 1px 0 0 var(--rip-border), inset -1px 0 0 var(--rip-border)",
  },
  ".cm-codeblock-first": {
    borderTopLeftRadius: "8px",
    borderTopRightRadius: "8px",
    boxShadow:
      "inset 1px 0 0 var(--rip-border), inset -1px 0 0 var(--rip-border), inset 0 1px 0 var(--rip-border)",
  },
  ".cm-codeblock-last": {
    borderBottomLeftRadius: "8px",
    borderBottomRightRadius: "8px",
    boxShadow:
      "inset 1px 0 0 var(--rip-border), inset -1px 0 0 var(--rip-border), inset 0 -1px 0 var(--rip-border)",
  },
  ".cm-codeblock-first.cm-codeblock-last": {
    boxShadow:
      "inset 1px 0 0 var(--rip-border), inset -1px 0 0 var(--rip-border), inset 0 1px 0 var(--rip-border), inset 0 -1px 0 var(--rip-border)",
  },
  ".cm-codeblock-line.cm-activeLine": {
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 78%, var(--rip-hover))",
  },
  ".cm-code-indent-guides-line::before": {
    content: '""',
    position: "absolute",
    left: "12px",
    top: "0",
    bottom: "0",
    width: "var(--cm-code-indent-width, 0)",
    zIndex: "1",
    backgroundImage: "var(--cm-code-indent-guides, none)",
    opacity: "0.9",
    pointerEvents: "none",
  },
  ".cm-code-indent-guides-line": {
    // Match VS Code's own indent guides; fall back to a muted line when the
    // webview does not expose the editor theme variables.
    "--cm-code-indent-guide":
      "var(--vscode-editorIndentGuide-background1, var(--vscode-editorIndentGuide-background, color-mix(in srgb, var(--rip-muted) 35%, transparent)))",
  },
  ".cm-code-indent-guides-line.cm-activeLine": {
    "--cm-code-indent-guide":
      "var(--vscode-editorIndentGuide-activeBackground1, var(--vscode-editorIndentGuide-activeBackground, color-mix(in srgb, var(--rip-muted) 60%, transparent)))",
  },
  ".cm-codeblock-line .cm-markdown-marker": {
    opacity: "0",
  },
  ".cm-line.cm-activeLine.cm-codeblock-line .cm-markdown-marker": {
    opacity: "0.9",
  },
  ".cm-code-copy-widget": {
    position: "absolute",
    top: "3px",
    right: "7px",
    zIndex: "2",
    display: "inline-flex",
  },
  ".cm-code-copy-button": {
    height: "22px",
    border: "1px solid var(--rip-border)",
    borderRadius: "5px",
    padding: "0 7px",
    color: "var(--rip-muted)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 88%, transparent)",
    font: "11px var(--vscode-font-family)",
    cursor: "pointer",
  },
  ".cm-code-copy-button:hover": {
    color: "var(--rip-heading)",
    borderColor: "var(--rip-focus)",
    backgroundColor: "var(--rip-hover)",
  },
  ".cm-thematic-break-line": {
    color: "transparent",
    position: "relative",
  },
  ".cm-thematic-break-line::after": {
    content: '""',
    position: "absolute",
    left: "0",
    right: "0",
    top: "50%",
    borderTop: "1px solid var(--rip-border)",
    transform: "translateY(-50%)",
  },
  ".cm-line.cm-activeLine.cm-thematic-break-line": {
    color: "var(--rip-fg)",
  },
  ".cm-line.cm-activeLine.cm-thematic-break-line::after": {
    display: "none",
  },
  ".cm-table-line": {
    backgroundColor: "var(--rip-row-alt)",
    fontFamily:
      "var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
    fontFeatureSettings: '"tnum" 1, "liga" 0, "calt" 0',
    fontVariantLigatures: "none",
    lineHeight: "1.62",
    boxShadow:
      "inset 0 1px 0 color-mix(in srgb, var(--rip-border) 42%, transparent), inset 1px 0 0 color-mix(in srgb, var(--rip-border) 58%, transparent), inset -1px 0 0 color-mix(in srgb, var(--rip-border) 58%, transparent)",
  },
  ".cm-table-header-line": {
    color: "var(--rip-heading)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 72%, var(--rip-bg))",
    fontWeight: "760",
    boxShadow:
      "inset 0 1px 0 var(--rip-border), inset 0 -1px 0 var(--rip-border), inset 1px 0 0 color-mix(in srgb, var(--rip-border) 70%, transparent), inset -1px 0 0 color-mix(in srgb, var(--rip-border) 70%, transparent)",
  },
  ".cm-table-delimiter-line": {
    color: "var(--rip-muted)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 38%, var(--rip-bg))",
    fontSize: "0.92em",
    boxShadow:
      "inset 0 -1px 0 color-mix(in srgb, var(--rip-border) 70%, transparent), inset 1px 0 0 color-mix(in srgb, var(--rip-border) 58%, transparent), inset -1px 0 0 color-mix(in srgb, var(--rip-border) 58%, transparent)",
  },
  ".cm-table-body-line": {
    backgroundColor:
      "color-mix(in srgb, var(--rip-row-alt) 78%, transparent)",
  },
  ".cm-table-line .cm-markdown-marker": {
    opacity: "0",
  },
  ".cm-line.cm-activeLine.cm-table-line .cm-markdown-marker": {
    opacity: "0.9",
  },
  ".cm-table-pipe": {
    color: "transparent",
    display: "inline-block",
    width: "1ch",
    position: "relative",
    textAlign: "center",
    fontWeight: "400",
    textShadow: "none",
  },
  ".cm-table-pipe::after": {
    content: '""',
    position: "absolute",
    left: "50%",
    top: "-0.22em",
    bottom: "-0.22em",
    width: "1px",
    transform: "translateX(-50%)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-border) 76%, transparent)",
  },
  ".cm-table-header-cell": {
    color: "var(--rip-heading)",
    fontWeight: "760",
    backgroundColor:
      "color-mix(in srgb, var(--rip-heading) 7%, transparent)",
    borderRadius: "3px",
    boxDecorationBreak: "clone",
  },
  ".cm-table-cell": {
    color: "var(--rip-fg)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-bg) 18%, transparent)",
    borderRadius: "3px",
    boxDecorationBreak: "clone",
  },
  ".cm-table-delimiter-text": {
    color: "var(--rip-muted)",
    opacity: "0.32",
  },
  ".cm-rich-table-preview": {
    display: "block",
    boxSizing: "border-box",
    maxWidth: "100%",
    margin: "0",
    border: "1px solid var(--rip-border)",
    borderRadius: "8px",
    overflow: "hidden",
    backgroundColor: "var(--rip-panel)",
    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.12)",
    cursor: "text",
  },
  ".cm-rich-table-preview.cm-widgetBuffer": {
    display: "none",
  },
  ".cm-rich-table-scroll": {
    width: "100%",
    overflowX: "auto",
  },
  ".cm-rich-table": {
    width: "100%",
    minWidth: "max-content",
    borderCollapse: "separate",
    borderSpacing: "0",
    color: "var(--rip-fg)",
    fontFamily: "var(--vscode-font-family)",
    fontSize: "0.95rem",
    lineHeight: "1.45",
  },
  ".cm-rich-table th, .cm-rich-table td": {
    maxWidth: "34ch",
    borderRight: "1px solid var(--rip-border)",
    borderBottom: "1px solid var(--rip-border)",
    padding: "0",
    textAlign: "left",
    verticalAlign: "top",
    whiteSpace: "normal",
  },
  ".cm-rich-table th:last-child, .cm-rich-table td:last-child": {
    borderRight: "0",
  },
  ".cm-rich-table tbody tr:last-child td": {
    borderBottom: "0",
  },
  ".cm-rich-table th": {
    color: "var(--rip-heading)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-heading) 10%, var(--rip-panel))",
    fontWeight: "760",
  },
  ".cm-rich-table tbody tr:nth-child(even) td": {
    backgroundColor: "var(--rip-row-alt)",
  },
  ".cm-rich-table tbody tr:hover td": {
    backgroundColor: "var(--rip-hover)",
  },
  ".cm-rich-table .align-center": {
    textAlign: "center",
  },
  ".cm-rich-table .align-right": {
    textAlign: "right",
  },
  ".cm-rich-table code": {
    padding: "0.08em 0.32em",
    border: "1px solid var(--rip-border)",
    borderRadius: "4px",
    backgroundColor: "var(--rip-code-bg)",
    fontFamily:
      "var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
  },
  ".cm-rich-table strong": {
    fontWeight: "760",
  },
  ".cm-rich-table em": {
    fontStyle: "italic",
  },
  ".cm-rich-table a": {
    color: "var(--rip-link)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  ".cm-rich-table-cell": {
    position: "relative",
    cursor: "text",
  },
  ".cm-rich-table-cell-preview, .cm-rich-table-cell-editor": {
    minWidth: "7ch",
    minHeight: "2.45em",
    display: "block",
    boxSizing: "border-box",
    padding: "8px 12px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  ".cm-rich-table-cell-preview": {
    outline: "none",
  },
  ".cm-rich-table-cell-editor": {
    display: "none",
    outline: "none",
  },
  ".cm-rich-table-cell.is-editing .cm-rich-table-cell-preview": {
    display: "none",
  },
  ".cm-rich-table-cell.is-editing .cm-rich-table-cell-editor": {
    display: "block",
  },
  ".cm-rich-table-cell-editor:focus": {
    backgroundColor:
      "color-mix(in srgb, var(--rip-focus) 13%, transparent)",
    boxShadow: "inset 0 0 0 1px var(--rip-focus)",
  },
  ".cm-rich-table-cell-preview:empty::before, .cm-rich-table-cell-editor:empty::before": {
    content: '"Cell"',
    color: "var(--rip-muted)",
    opacity: "0.55",
  },
  ".cm-inline-markdown-image": {
    maxWidth: "100%",
    display: "inline-flex",
    alignItems: "center",
    verticalAlign: "middle",
  },
  ".cm-inline-markdown-image img": {
    width: "auto",
    height: "auto",
    maxWidth: "min(180px, 100%)",
    maxHeight: "140px",
    display: "block",
    border: "1px solid var(--rip-border)",
    borderRadius: "6px",
    aspectRatio: "auto",
    objectFit: "contain",
    backgroundColor: "var(--rip-bg)",
    cursor: "pointer",
  },
  ".cm-inline-markdown-image-error": {
    color: "var(--rip-muted)",
    fontSize: "0.92em",
  },
  ".cm-rich-table-toolbar": {
    display: "flex",
    justifyContent: "flex-end",
    gap: "6px",
    borderTop: "1px solid var(--rip-border)",
    padding: "6px 8px",
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 88%, var(--rip-bg))",
  },
  ".cm-rich-table-action": {
    height: "26px",
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    border: "1px solid var(--rip-border)",
    borderRadius: "6px",
    padding: "0 9px",
    color: "var(--rip-fg)",
    backgroundColor: "var(--rip-input-bg)",
    font: "12px var(--vscode-font-family)",
    cursor: "pointer",
  },
  ".cm-rich-table-action:hover": {
    borderColor: "var(--rip-focus)",
    backgroundColor: "var(--rip-hover)",
  },
  ".cm-rich-table-action-icon": {
    color: "var(--rip-heading)",
    fontWeight: "760",
  },
  ".cm-gherkin-preview": {
    display: "block",
    boxSizing: "border-box",
    maxWidth: "100%",
    margin: "0",
    border: "1px solid var(--rip-border)",
    borderRadius: "8px",
    overflow: "hidden",
    backgroundColor: "var(--rip-panel)",
    boxShadow: "0 10px 26px rgba(0, 0, 0, 0.10)",
    color: "var(--rip-fg)",
    fontFamily: "var(--vscode-font-family)",
    userSelect: "text",
  },
  ".cm-gherkin-preview.cm-widgetBuffer": {
    display: "none",
  },
  ".cm-gherkin-toolbar": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    borderBottom: "1px solid var(--rip-border)",
    padding: "7px 8px",
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 86%, var(--rip-bg))",
  },
  ".cm-gherkin-toolbar-title": {
    minWidth: "0",
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },
  ".cm-gherkin-toolbar-label": {
    flex: "0 0 auto",
    border: "1px solid color-mix(in srgb, var(--rip-syntax-blue) 55%, var(--rip-border))",
    borderRadius: "999px",
    padding: "2px 7px",
    color: "var(--rip-syntax-blue)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-syntax-blue) 12%, transparent)",
    fontSize: "11px",
    fontWeight: "760",
  },
  ".cm-gherkin-toolbar-name": {
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--rip-heading)",
    fontSize: "13px",
    fontWeight: "760",
  },
  ".cm-gherkin-stats": {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "4px",
  },
  ".cm-gherkin-stat": {
    border: "1px solid var(--rip-border)",
    borderRadius: "999px",
    padding: "2px 7px",
    color: "var(--rip-muted)",
    backgroundColor: "var(--rip-input-bg)",
    fontSize: "11px",
  },
  ".cm-gherkin-actions": {
    display: "inline-flex",
    flex: "0 0 auto",
    gap: "4px",
  },
  ".cm-gherkin-button": {
    height: "24px",
    border: "1px solid var(--rip-border)",
    borderRadius: "5px",
    padding: "0 8px",
    color: "var(--rip-fg)",
    backgroundColor: "var(--rip-input-bg)",
    font: "12px var(--vscode-font-family)",
    cursor: "pointer",
  },
  ".cm-gherkin-button:hover, .cm-gherkin-button.is-active": {
    borderColor: "var(--rip-focus)",
    color: "var(--rip-heading)",
    backgroundColor: "var(--rip-hover)",
  },
  ".cm-gherkin-body": {
    maxHeight: "none",
    overflow: "visible",
  },
  ".cm-gherkin-board": {
    display: "grid",
    gap: "14px",
    padding: "14px",
  },
  ".cm-gherkin-feature-section": {
    display: "grid",
    gap: "12px",
  },
  ".cm-gherkin-feature-section + .cm-gherkin-feature-section": {
    borderTop: "1px solid var(--rip-border)",
    paddingTop: "14px",
  },
  ".cm-gherkin-feature": {
    display: "grid",
    gap: "9px",
    border: "1px solid color-mix(in srgb, var(--rip-syntax-blue) 32%, var(--rip-border))",
    borderRadius: "8px",
    padding: "14px",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--rip-syntax-blue) 16%, var(--rip-panel)), color-mix(in srgb, var(--rip-syntax-green) 9%, var(--rip-panel)))",
  },
  ".cm-gherkin-feature-heading": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: "0",
  },
  ".cm-gherkin-feature-title": {
    minWidth: "0",
    overflowWrap: "anywhere",
    color: "var(--rip-heading)",
    fontSize: "16px",
    fontWeight: "780",
  },
  ".cm-gherkin-keyword-pill": {
    flex: "0 0 auto",
    borderRadius: "999px",
    padding: "2px 7px",
    color: "var(--rip-button-fg)",
    backgroundColor: "var(--rip-syntax-blue)",
    fontSize: "11px",
    fontWeight: "760",
    lineHeight: "1.35",
  },
  ".cm-gherkin-keyword-pill.is-background": {
    backgroundColor: "var(--rip-syntax-purple)",
  },
  ".cm-gherkin-keyword-pill.is-outline": {
    backgroundColor: "var(--rip-syntax-orange)",
  },
  ".cm-gherkin-keyword-pill.is-scenario": {
    backgroundColor: "var(--rip-syntax-green)",
  },
  ".cm-gherkin-tags": {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  ".cm-gherkin-tag": {
    border: "1px solid color-mix(in srgb, var(--rip-syntax-purple) 40%, var(--rip-border))",
    borderRadius: "999px",
    padding: "1px 6px",
    color: "var(--rip-syntax-purple)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-syntax-purple) 10%, transparent)",
    fontSize: "11px",
  },
  ".cm-gherkin-description": {
    display: "grid",
    gap: "5px",
    color: "var(--rip-muted)",
    fontSize: "12px",
    lineHeight: "1.55",
  },
  ".cm-gherkin-description p": {
    margin: "0",
  },
  ".cm-gherkin-group": {
    display: "grid",
    gap: "10px",
  },
  ".cm-gherkin-group-header": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  ".cm-gherkin-group-title": {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: "0",
    color: "var(--rip-heading)",
    fontWeight: "760",
  },
  ".cm-gherkin-group-eyebrow": {
    color: "var(--rip-muted)",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0",
  },
  ".cm-gherkin-scenario-grid": {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: "12px",
  },
  ".cm-gherkin-scenario": {
    display: "grid",
    alignContent: "start",
    gap: "10px",
    border: "1px solid var(--rip-border)",
    borderRadius: "8px",
    padding: "12px",
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 88%, var(--rip-bg))",
  },
  ".cm-gherkin-scenario.is-background": {
    borderColor:
      "color-mix(in srgb, var(--rip-syntax-purple) 38%, var(--rip-border))",
  },
  ".cm-gherkin-scenario-header": {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    minWidth: "0",
  },
  ".cm-gherkin-scenario-title": {
    minWidth: "0",
    overflowWrap: "anywhere",
    color: "var(--rip-heading)",
    fontWeight: "760",
    lineHeight: "1.3",
  },
  ".cm-gherkin-flow": {
    display: "grid",
    gap: "8px",
  },
  ".cm-gherkin-step": {
    display: "grid",
    gridTemplateColumns: "8px minmax(58px, auto) minmax(0, 1fr)",
    alignItems: "start",
    columnGap: "9px",
    border: "1px solid color-mix(in srgb, var(--rip-border) 68%, transparent)",
    borderRadius: "7px",
    padding: "8px 10px 8px 8px",
    backgroundColor:
      "color-mix(in srgb, var(--rip-bg) 26%, transparent)",
  },
  ".cm-gherkin-step-rail": {
    width: "4px",
    height: "100%",
    minHeight: "22px",
    borderRadius: "3px",
    backgroundColor: "var(--rip-syntax-blue)",
  },
  ".cm-gherkin-step.is-when .cm-gherkin-step-rail": {
    backgroundColor: "var(--rip-syntax-orange)",
  },
  ".cm-gherkin-step.is-then .cm-gherkin-step-rail": {
    backgroundColor: "var(--rip-syntax-green)",
  },
  ".cm-gherkin-step.is-and .cm-gherkin-step-rail, .cm-gherkin-step.is-but .cm-gherkin-step-rail": {
    backgroundColor: "var(--rip-syntax-purple)",
  },
  ".cm-gherkin-step-keyword": {
    color: "var(--rip-muted)",
    fontSize: "12px",
    fontWeight: "760",
    lineHeight: "1.5",
  },
  ".cm-gherkin-step-text": {
    minWidth: "0",
    overflowWrap: "anywhere",
    lineHeight: "1.5",
  },
  ".cm-gherkin-step-table, .cm-gherkin-example-table": {
    gridColumn: "2 / 4",
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "8px",
    fontSize: "12px",
  },
  ".cm-gherkin-step-table td, .cm-gherkin-example-table td": {
    border: "1px solid var(--rip-border)",
    padding: "6px 8px",
    overflowWrap: "anywhere",
  },
  ".cm-gherkin-example-table tr:first-child td": {
    color: "var(--rip-heading)",
    backgroundColor:
      "color-mix(in srgb, var(--rip-heading) 8%, transparent)",
    fontWeight: "760",
  },
  ".cm-gherkin-examples": {
    display: "grid",
    gap: "7px",
  },
  ".cm-gherkin-examples-title": {
    color: "var(--rip-muted)",
    fontSize: "12px",
    fontWeight: "760",
  },
  ".cm-gherkin-empty": {
    color: "var(--rip-muted)",
    fontSize: "12px",
  },
  ".cm-gherkin-source": {
    margin: "0",
    padding: "10px 12px",
    overflow: "visible",
    color: "var(--rip-fg)",
    backgroundColor: "var(--rip-code-bg)",
    font:
      "12.5px var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
    lineHeight: "1.62",
  },
  ".cm-gherkin-source-line": {
    minHeight: "1.62em",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  ".cm-gherkin-token.is-feature, .cm-gherkin-token.is-rule, .cm-gherkin-token.is-background, .cm-gherkin-token.is-scenario, .cm-gherkin-token.is-outline, .cm-gherkin-token.is-examples, .cm-gherkin-token.is-given, .cm-gherkin-token.is-when, .cm-gherkin-token.is-then, .cm-gherkin-token.is-and, .cm-gherkin-token.is-but": {
    color: "var(--rip-syntax-purple)",
    fontWeight: "760",
  },
  ".cm-gherkin-token.is-given": {
    color: "var(--rip-syntax-blue)",
  },
  ".cm-gherkin-token.is-when": {
    color: "var(--rip-syntax-orange)",
  },
  ".cm-gherkin-token.is-then": {
    color: "var(--rip-syntax-green)",
  },
  ".cm-gherkin-token.is-tag": {
    color: "var(--rip-syntax-purple)",
  },
  ".cm-gherkin-token.is-title": {
    color: "var(--rip-heading)",
  },
  ".cm-gherkin-token.is-comment": {
    color: "var(--rip-muted)",
    fontStyle: "italic",
  },
  ".cm-gherkin-token.is-table": {
    color: "var(--rip-syntax-orange)",
  },
  ".cm-gherkin-token.is-punctuation": {
    color: "var(--rip-muted)",
  },
  ".cm-mermaid-preview": {
    display: "block",
    boxSizing: "border-box",
    maxWidth: "100%",
    height: "var(--mermaid-source-height, auto)",
    margin: "0",
    border: "1px solid var(--rip-border)",
    borderRadius: "8px",
    overflow: "hidden",
    backgroundColor: "var(--rip-panel)",
    boxShadow: "none",
    cursor: "text",
    position: "relative",
  },
  ".cm-mermaid-preview.cm-widgetBuffer": {
    display: "none",
  },
  ".cm-mermaid-output": {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px",
    overflow: "hidden",
    position: "relative",
  },
  ".cm-mermaid-canvas": {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "auto",
  },
  ".cm-mermaid-stage": {
    position: "absolute",
    left: "0",
    top: "0",
    transformOrigin: "0 0",
    willChange: "transform",
  },
  ".cm-mermaid-stage svg": {
    display: "block",
    maxWidth: "none",
    maxHeight: "none",
    width: "100%",
    height: "100%",
  },
  ".cm-mermaid-toolbar": {
    position: "absolute",
    top: "7px",
    right: "7px",
    zIndex: "2",
    display: "inline-flex",
    gap: "4px",
    padding: "3px",
    border: "1px solid var(--rip-border)",
    borderRadius: "7px",
    backgroundColor:
      "color-mix(in srgb, var(--rip-panel) 92%, transparent)",
    boxShadow: "0 8px 18px rgba(0, 0, 0, 0.18)",
  },
  ".cm-mermaid-tool-button": {
    minWidth: "25px",
    height: "24px",
    display: "inline-grid",
    placeItems: "center",
    border: "0",
    borderRadius: "5px",
    padding: "0 7px",
    color: "var(--rip-fg)",
    backgroundColor: "transparent",
    font: "12px var(--vscode-font-family)",
    cursor: "pointer",
  },
  ".cm-mermaid-tool-button:hover": {
    color: "var(--rip-heading)",
    backgroundColor: "var(--rip-hover)",
  },
  ".cm-mermaid-status": {
    color: "var(--rip-muted)",
    font: "13px var(--vscode-font-family)",
  },
  ".cm-mermaid-error": {
    width: "100%",
    margin: "0",
    color: "var(--rip-danger)",
    whiteSpace: "pre-wrap",
    font:
      "12px var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)",
  },
  ".cm-task-checkbox": {
    width: "1.05em",
    height: "1.05em",
    display: "inline-grid",
    placeItems: "center",
    margin: "0 0.36em 0 0.08em",
    padding: "0",
    border: "1.5px solid var(--rip-border)",
    borderRadius: "4px",
    color: "var(--rip-button-fg)",
    backgroundColor: "var(--rip-input-bg)",
    verticalAlign: "-0.16em",
    lineHeight: "1",
    appearance: "none",
    cursor: "pointer",
    position: "relative",
  },
  ".cm-task-checkbox.is-checked": {
    borderColor: "var(--rip-accent)",
    backgroundColor: "var(--rip-accent)",
  },
  ".cm-task-checkbox.is-checked::after": {
    content: '""',
    position: "absolute",
    left: "50%",
    top: "47%",
    width: "0.32em",
    height: "0.58em",
    border: "solid currentColor",
    borderWidth: "0 0.14em 0.14em 0",
    transform: "translate(-50%, -55%) rotate(45deg)",
    transformOrigin: "center",
  },
  ".cm-settings-root": {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: "10",
    display: "grid",
    justifyItems: "end",
    gap: "8px",
    fontFamily: "var(--vscode-font-family)",
  },
  ".cm-settings-button": {
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center",
    border: "1px solid var(--rip-border)",
    borderRadius: "999px",
    color: "var(--rip-fg)",
    background: "var(--rip-panel)",
    boxShadow: "0 8px 22px rgba(0, 0, 0, 0.22)",
    cursor: "pointer",
    fontSize: "16px",
  },
  ".cm-settings-button:hover": {
    borderColor: "var(--rip-focus)",
    background: "var(--rip-hover)",
  },
  ".cm-settings-menu": {
    width: "238px",
    maxHeight: "min(520px, calc(100vh - 64px))",
    overflowY: "auto",
    border: "1px solid var(--rip-border)",
    borderRadius: "8px",
    padding: "10px",
    color: "var(--rip-fg)",
    background: "var(--rip-panel)",
    boxShadow: "0 14px 36px rgba(0, 0, 0, 0.3)",
  },
  ".cm-settings-menu[hidden]": { display: "none" },
  ".cm-settings-section": {
    display: "grid",
    gap: "4px",
    paddingTop: "10px",
    borderTop:
      "1px solid color-mix(in srgb, var(--rip-border) 72%, transparent)",
  },
  ".cm-settings-section:first-child": {
    paddingTop: "0",
    borderTop: "0",
  },
  ".cm-settings-menu-title": {
    padding: "0 2px 3px",
    color: "var(--rip-heading)",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  ".cm-settings-subtitle": {
    marginTop: "5px",
    padding: "0 2px 1px",
    color: "var(--rip-muted)",
    fontSize: "11px",
    fontWeight: "650",
  },
  ".cm-settings-menu-item": {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: "0",
    borderRadius: "6px",
    padding: "7px 8px",
    color: "var(--rip-fg)",
    background: "transparent",
    cursor: "pointer",
    font: "13px var(--vscode-font-family)",
    textAlign: "left",
  },
  ".cm-settings-menu-item:hover, .cm-settings-menu-item.is-active": {
    background: "var(--rip-hover)",
  },
  ".cm-settings-menu-item.is-active": {
    color: "var(--rip-heading)",
    fontWeight: "700",
  },
});
}
