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
    border: "1.5px solid var(--rip-border)",
    borderRadius: "4px",
    color: "var(--rip-button-fg)",
    backgroundColor: "var(--rip-input-bg)",
    verticalAlign: "-0.16em",
    cursor: "pointer",
  },
  ".cm-task-checkbox.is-checked": {
    borderColor: "var(--rip-accent)",
    backgroundColor: "var(--rip-accent)",
  },
  ".cm-task-checkbox.is-checked::after": {
    content: '"✓"',
    color: "var(--rip-button-fg)",
    fontSize: "0.82em",
    lineHeight: "1",
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
