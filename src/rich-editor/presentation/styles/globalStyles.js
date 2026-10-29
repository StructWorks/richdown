import {
  calloutColors,
  calloutThemeCss,
  darkThemeSelectors,
} from "../../../markdown/callouts.js";

export function injectStyles() {
  if (document.querySelector("#richdown-global-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "richdown-global-styles";
  style.textContent = `
    .cm-settings-root {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 10000;
      display: grid;
      justify-items: end;
      gap: 8px;
      font-family: var(--vscode-font-family);
      pointer-events: none;
    }
    .richdown-fallback {
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr;
      color: var(--rip-fg);
      background: var(--rip-bg);
      font-family: var(--vscode-font-family);
    }
    .richdown-fallback-banner {
      border-bottom: 1px solid var(--rip-border);
      padding: 8px 12px;
      color: var(--rip-muted);
      background: var(--rip-panel);
      font-size: 12px;
    }
    .richdown-fallback-editor {
      width: 100%;
      height: 100%;
      min-height: 0;
      resize: none;
      border: 0;
      outline: 0;
      padding: 24px clamp(18px, 5vw, 64px) 72px;
      color: var(--rip-fg);
      background: var(--rip-bg);
      caret-color: var(--rip-caret);
      font: 15px/1.72 var(--vscode-editor-font-family, var(--vscode-font-family));
      white-space: pre-wrap;
    }
    .cm-settings-root * {
      box-sizing: border-box;
    }
    .richdown-outline-root {
      position: fixed;
      right: 18px;
      bottom: 64px;
      z-index: 9999;
      display: grid;
      justify-items: end;
      gap: 8px;
      font-family: var(--vscode-font-family);
      pointer-events: none;
    }
    .richdown-outline-root * {
      box-sizing: border-box;
    }
    /* Keep the floating buttons clear of the lint overview ruler. */
    body.richdown-has-lint-ruler .cm-settings-root,
    body.richdown-has-lint-ruler .richdown-outline-root {
      right: 30px;
    }
    .richdown-outline-button {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 1px solid var(--rip-border);
      border-radius: 999px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      pointer-events: auto;
    }
    .richdown-outline-button:hover,
    .richdown-outline-root.is-open .richdown-outline-button {
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .richdown-outline-panel {
      width: 238px;
      max-height: min(520px, calc(100vh - 112px));
      overflow-y: auto;
      border: 1px solid var(--rip-border);
      border-radius: 8px;
      padding: 10px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    .richdown-outline-panel[hidden] {
      display: none;
    }
    .richdown-outline-title {
      margin: 0 0 6px;
      padding: 0 2px 4px;
      color: var(--rip-heading);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      border-bottom: 1px solid color-mix(in srgb, var(--rip-border) 72%, transparent);
    }
    .richdown-outline-list {
      display: grid;
      gap: 2px;
    }
    .richdown-outline-item {
      width: 100%;
      min-width: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 6px;
      border: 0;
      border-radius: 6px;
      padding: 6px 7px;
      color: var(--rip-fg);
      background: transparent;
      cursor: pointer;
      font: 12px var(--vscode-font-family);
      text-align: left;
    }
    .richdown-outline-item:hover,
    .richdown-outline-item.is-active {
      background: var(--rip-hover);
    }
    .richdown-outline-item.is-active {
      color: var(--rip-heading);
      font-weight: 700;
    }
    .richdown-outline-level {
      width: 1.4em;
      color: var(--rip-muted);
      font-size: 10px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .richdown-outline-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .richdown-outline-empty {
      padding: 8px 7px 2px;
      color: var(--rip-muted);
      font-size: 12px;
    }
    @media (min-width: 1440px) {
      html[data-preview-width="default"] body .cm-editor .cm-content {
        max-width: 900px;
        margin-left: max(32px, calc((100vw - 1220px) / 2));
        margin-right: 320px;
      }
      html[data-preview-width="wide"] body .cm-editor .cm-content {
        max-width: none;
        margin-left: 32px;
        margin-right: 320px;
      }
      .richdown-outline-root {
        top: 32px;
        right: 24px;
        bottom: auto;
        width: 260px;
        max-height: calc(100vh - 64px);
        justify-items: stretch;
        pointer-events: auto;
      }
      .richdown-outline-button {
        display: none;
      }
      .richdown-outline-panel {
        width: 100%;
        max-height: calc(100vh - 64px);
        border: 0;
        border-left: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.28));
        border-radius: 0;
        padding: 2px 0 2px 14px;
        background: transparent;
        box-shadow: none;
      }
      .richdown-outline-panel[hidden] {
        display: block;
      }
      .richdown-outline-title {
        margin-bottom: 8px;
        border-bottom: 0;
      }
      .richdown-outline-item {
        padding-top: 5px;
        padding-bottom: 5px;
      }
    }
    .cm-settings-button {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 1px solid var(--rip-border);
      border-radius: 999px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      pointer-events: auto;
    }
    .cm-settings-button:hover {
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .cm-settings-menu {
      width: 238px;
      max-height: min(520px, calc(100vh - 72px));
      overflow-y: auto;
      border: 1px solid var(--rip-border);
      border-radius: 8px;
      padding: 10px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    .cm-settings-menu[hidden] {
      display: none;
    }
    .cm-settings-section {
      display: grid;
      gap: 4px;
      padding-top: 10px;
      border-top: 1px solid color-mix(in srgb, var(--rip-border) 72%, transparent);
    }
    .cm-settings-section:first-child {
      padding-top: 0;
      border-top: 0;
    }
    .cm-settings-menu-title {
      margin: 0;
      padding: 0 2px 3px;
      color: var(--rip-heading);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .cm-settings-subtitle {
      margin: 5px 0 0;
      padding: 0 2px 1px;
      color: var(--rip-muted);
      font-size: 11px;
      font-weight: 650;
    }
    .cm-settings-menu-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: 0;
      border-radius: 6px;
      padding: 7px 8px;
      color: var(--rip-fg);
      background: transparent;
      cursor: pointer;
      font: 13px var(--vscode-font-family);
      text-align: left;
    }
    .cm-settings-menu-title + .cm-settings-menu-item {
      margin-top: 2px;
    }
    .cm-settings-menu-item:hover,
    .cm-settings-menu-item.is-active {
      background: var(--rip-hover);
    }
    .cm-settings-menu-item.is-active {
      color: var(--rip-heading);
      font-weight: 700;
    }
    .cm-slash-menu {
      position: fixed;
      z-index: 10001;
      width: 260px;
      max-height: min(320px, calc(100vh - 24px));
      overflow-y: auto;
      display: grid;
      gap: 2px;
      border: 1px solid var(--rip-border);
      border-radius: 8px;
      padding: 6px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.3);
      font-family: var(--vscode-font-family);
    }
    .cm-slash-menu-item {
      width: 100%;
      display: grid;
      gap: 2px;
      border: 0;
      border-radius: 6px;
      padding: 8px 9px;
      color: var(--rip-fg);
      background: transparent;
      text-align: left;
      cursor: pointer;
      font: 13px var(--vscode-font-family);
    }
    .cm-slash-menu-item:hover,
    .cm-slash-menu-item.is-active {
      background: var(--rip-hover);
    }
    .cm-slash-menu-label {
      color: var(--rip-heading);
      font-weight: 700;
    }
    .cm-slash-menu-description {
      color: var(--rip-muted);
      font-size: 12px;
    }
    .cm-table-context-menu {
      position: fixed;
      z-index: 10003;
      min-width: 184px;
      display: grid;
      gap: 2px;
      border: 1px solid var(--rip-border);
      border-radius: 8px;
      padding: 6px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.3);
      font-family: var(--vscode-font-family);
    }
    .cm-table-context-menu-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 0;
      border-radius: 6px;
      padding: 7px 9px;
      color: var(--rip-fg);
      background: transparent;
      text-align: left;
      cursor: pointer;
      font: 13px var(--vscode-font-family);
    }
    .cm-table-context-menu-item:hover,
    .cm-table-context-menu-item:focus-visible {
      background: var(--rip-hover);
      outline: 2px solid var(--rip-focus);
      outline-offset: -2px;
    }
    .cm-table-context-menu-item:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .cm-table-context-menu-item:disabled:hover {
      background: transparent;
    }
    .cm-table-context-menu-divider {
      height: 1px;
      margin: 4px 2px;
      background: color-mix(in srgb, var(--rip-border) 72%, transparent);
    }
    .cm-mermaid-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10002;
      display: grid;
      padding: 24px;
      background: rgba(0, 0, 0, 0.56);
      pointer-events: auto;
    }
    .cm-mermaid-modal {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      border: 1px solid var(--rip-border);
      border-radius: 10px;
      overflow: hidden;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
    }
    .cm-mermaid-modal-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid var(--rip-border);
      padding: 8px 10px;
      background: color-mix(in srgb, var(--rip-panel) 88%, var(--rip-bg));
      font-family: var(--vscode-font-family);
    }
    .cm-mermaid-modal-title {
      min-width: 0;
      color: var(--rip-heading);
      font-size: 13px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cm-mermaid-modal-controls {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
    }
    .cm-mermaid-modal-button {
      min-width: 28px;
      height: 28px;
      display: inline-grid;
      place-items: center;
      border: 1px solid var(--rip-border);
      border-radius: 6px;
      padding: 0 8px;
      color: var(--rip-fg);
      background: var(--rip-input-bg);
      font: 12px var(--vscode-font-family);
      cursor: pointer;
    }
    .cm-mermaid-modal-button:hover {
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .richdown-chat-edits-banner {
      position: fixed;
      left: 18px;
      bottom: 18px;
      z-index: 10001;
      max-width: calc(100vw - 92px);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 8px;
      border: 1px solid var(--rip-focus);
      border-radius: 8px;
      padding: 8px 10px;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.3);
      font: 12px var(--vscode-font-family);
    }
    .richdown-chat-edits-message {
      margin-right: 4px;
    }
    .richdown-chat-edits-button {
      height: 26px;
      border: 1px solid var(--rip-border);
      border-radius: 6px;
      padding: 0 10px;
      color: var(--rip-fg);
      background: var(--rip-input-bg);
      font: 12px var(--vscode-font-family);
      cursor: pointer;
    }
    .richdown-chat-edits-button:hover {
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .richdown-chat-edits-button.is-primary {
      border-color: var(--rip-accent);
      color: var(--rip-button-fg);
      background: var(--rip-accent);
    }
    .richdown-chat-edits-button:focus-visible {
      outline: 2px solid var(--rip-focus);
      outline-offset: 1px;
    }
    .cm-mermaid-modal-canvas {
      min-width: 0;
      min-height: 0;
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(color-mix(in srgb, var(--rip-border) 24%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--rip-border) 24%, transparent) 1px, transparent 1px),
        var(--rip-bg);
      background-size: 24px 24px;
      cursor: grab;
      touch-action: none;
    }
    .cm-mermaid-modal-canvas.is-dragging {
      cursor: grabbing;
    }
    .cm-mermaid-modal-stage {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
      will-change: transform;
    }
    .cm-mermaid-modal-stage svg {
      display: block;
      max-width: none;
      max-height: none;
      width: 100%;
      height: 100%;
    }
    .cm-mermaid-live {
      box-sizing: border-box;
      height: var(--mermaid-live-height, 380px);
      min-height: 220px;
      margin: 6px 0 4px;
      border: 1px solid var(--rip-focus);
      border-radius: 8px;
      overflow: hidden;
      resize: vertical;
      background: var(--rip-panel);
      cursor: default;
    }
    .cm-mermaid-live:has(.cm-mermaid-surface.has-panel) {
      height: var(--mermaid-live-height, 540px);
    }
    .cm-line.cm-mermaid-source-line {
      box-shadow: inset 3px 0 0 color-mix(in srgb, var(--rip-focus) 70%, transparent);
    }
    .cm-line.cm-mermaid-error-line,
    .cm-mermaid-editor-source .cm-line.cm-mermaid-error-line {
      background: color-mix(in srgb, var(--rip-danger) 16%, transparent);
      text-decoration: wavy underline color-mix(in srgb, var(--rip-danger) 80%, transparent);
      text-underline-offset: 3px;
    }
    .cm-mermaid-surface {
      height: 100%;
      min-height: 0;
      display: grid;
      grid-template-rows: auto minmax(120px, 1fr) auto auto;
      color: var(--rip-fg);
      font: 12px var(--vscode-font-family);
    }
    .cm-mermaid-surface-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 6px 8px;
      border-bottom: 1px solid var(--rip-border);
      background: color-mix(in srgb, var(--rip-panel) 88%, var(--rip-bg));
    }
    .cm-mermaid-surface-group {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
    }
    .cm-mermaid-surface-group[hidden] {
      display: none;
    }
    .cm-mermaid-surface-group.is-view {
      margin-left: auto;
    }
    .cm-mermaid-surface-tools {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      padding-right: 4px;
      margin-right: 2px;
      border-right: 1px solid var(--rip-border);
    }
    .cm-mermaid-surface-button[hidden] {
      display: none;
    }
    /* Fixed units: a percentage of an auto-sized grid row resolves cyclically
       and squeezes the table. */
    .cm-mermaid-surface-panel {
      max-height: 210px;
      min-height: 0;
      overflow: auto;
      border-top: 1px solid var(--rip-border);
      background: var(--rip-panel);
    }
    .cm-mermaid-surface-panel[hidden] {
      display: none;
    }
    .cm-mermaid-surface.is-modal .cm-mermaid-surface-panel {
      max-height: 38vh;
    }
    .cm-mermaid-table {
      padding: 6px 8px 8px;
    }
    .cm-mermaid-table table {
      width: 100%;
      border-collapse: collapse;
      font: 12px var(--vscode-font-family);
    }
    .cm-mermaid-table th {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 4px 6px;
      border-bottom: 1px solid var(--rip-border);
      color: var(--rip-muted);
      background: var(--rip-panel);
      font-weight: 600;
      text-align: left;
      white-space: nowrap;
    }
    .cm-mermaid-table td {
      padding: 2px 3px;
      border-bottom: 1px solid color-mix(in srgb, var(--rip-border) 55%, transparent);
    }
    .cm-mermaid-table tr.is-group td {
      padding-top: 6px;
    }
    .cm-mermaid-table tr.is-group .cm-mermaid-table-input {
      color: var(--rip-heading);
      font-weight: 700;
    }
    .cm-mermaid-table-input {
      box-sizing: border-box;
      width: 100%;
      min-width: 60px;
      height: 24px;
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 0 6px;
      color: var(--rip-fg);
      background: transparent;
      font: 12px var(--vscode-font-family);
    }
    .cm-mermaid-table-input:hover {
      border-color: var(--rip-border);
    }
    .cm-mermaid-table-input:focus {
      outline: none;
      border-color: var(--rip-focus);
      background: var(--rip-input-bg);
    }
    .cm-mermaid-table-actions {
      width: 1%;
      white-space: nowrap;
    }
    .cm-mermaid-table-actions .cm-mermaid-surface-button {
      height: 22px;
      min-width: 22px;
      padding: 0 5px;
      border-color: transparent;
      background: transparent;
      color: var(--rip-muted);
    }
    .cm-mermaid-table-actions .cm-mermaid-surface-button:hover {
      color: var(--rip-fg);
    }
    .cm-mermaid-table-empty {
      padding: 8px;
      color: var(--rip-muted);
      text-align: center;
    }
    .cm-mermaid-table-footer {
      display: flex;
      gap: 6px;
      padding-top: 6px;
    }
    .cm-mermaid-surface-button,
    .cm-mermaid-surface-select {
      height: 26px;
      border: 1px solid var(--rip-border);
      border-radius: 6px;
      padding: 0 8px;
      color: var(--rip-fg);
      background: var(--rip-input-bg);
      font: 12px var(--vscode-font-family);
      cursor: pointer;
    }
    .cm-mermaid-surface-select {
      padding: 0 4px;
    }
    .cm-mermaid-surface-select[hidden] {
      display: none;
    }
    /* The open dropdown list is drawn by the browser, which paints it for
       the page's color scheme (light unless told otherwise) while the options
       inherit the theme's text color: light text on white in dark themes. */
    .cm-mermaid-surface-select,
    select.cm-mermaid-table-input {
      color-scheme: light;
    }
    :root[data-rich-theme="midnight"] .cm-mermaid-surface-select,
    :root[data-rich-theme="graphite"] .cm-mermaid-surface-select,
    :root[data-rich-theme="forest"] .cm-mermaid-surface-select,
    :root[data-rich-theme="midnight"] select.cm-mermaid-table-input,
    :root[data-rich-theme="graphite"] select.cm-mermaid-table-input,
    :root[data-rich-theme="forest"] select.cm-mermaid-table-input,
    :root[data-rich-theme="default"] body.vscode-dark .cm-mermaid-surface-select,
    :root[data-rich-theme="default"] body.vscode-dark select.cm-mermaid-table-input,
    :root[data-rich-theme="default"] body.vscode-high-contrast:not(.vscode-high-contrast-light) .cm-mermaid-surface-select,
    :root[data-rich-theme="default"] body.vscode-high-contrast:not(.vscode-high-contrast-light) select.cm-mermaid-table-input {
      color-scheme: dark;
    }
    .cm-mermaid-surface-select option,
    select.cm-mermaid-table-input option {
      color: var(--rip-fg);
      background-color: var(--rip-panel);
    }
    .cm-mermaid-surface-button:hover:not(:disabled),
    .cm-mermaid-surface-select:hover:not(:disabled) {
      border-color: var(--rip-focus);
      background: var(--rip-hover);
    }
    .cm-mermaid-surface-button:focus-visible,
    .cm-mermaid-surface-select:focus-visible,
    .cm-mermaid-surface-viewport:focus-visible {
      outline: 2px solid var(--rip-focus);
      outline-offset: -2px;
    }
    .cm-mermaid-surface-button:disabled,
    .cm-mermaid-surface-select:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .cm-mermaid-surface-button.is-active,
    .cm-mermaid-surface-button.is-primary {
      border-color: var(--rip-accent);
      color: var(--rip-button-fg);
      background: var(--rip-accent);
    }
    .cm-mermaid-surface-colors {
      display: inline-flex;
      gap: 3px;
      padding: 0 2px;
    }
    .cm-mermaid-surface-swatch {
      width: 20px;
      min-width: 20px;
      height: 20px;
      padding: 0;
      border: 2px solid var(--swatch-stroke, var(--rip-border));
      border-radius: 50%;
      background: var(--swatch-fill, var(--rip-input-bg));
    }
    .cm-mermaid-surface-swatch[aria-pressed="true"] {
      box-shadow: 0 0 0 2px var(--rip-panel), 0 0 0 4px var(--rip-focus);
    }
    .cm-mermaid-surface-swatch.is-clear {
      display: inline-grid;
      place-items: center;
      line-height: 1;
      color: var(--rip-muted);
    }
    .cm-mermaid-surface-viewport {
      min-width: 0;
      min-height: 0;
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(color-mix(in srgb, var(--rip-border) 22%, transparent) 1px, transparent 1px),
        linear-gradient(90deg, color-mix(in srgb, var(--rip-border) 22%, transparent) 1px, transparent 1px),
        var(--rip-bg);
      background-size: 24px 24px;
      cursor: grab;
      touch-action: none;
    }
    .cm-mermaid-surface-viewport.is-dragging {
      cursor: grabbing;
    }
    .cm-mermaid-surface.is-connecting .cm-mermaid-surface-viewport {
      cursor: crosshair;
    }
    .cm-mermaid-surface-stage {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
      will-change: transform;
      transition: opacity 120ms ease;
    }
    .cm-mermaid-surface.has-error .cm-mermaid-surface-stage {
      opacity: 0.35;
    }
    .cm-mermaid-surface-stage svg {
      display: block;
      max-width: none;
      max-height: none;
      width: 100%;
      height: 100%;
    }
    .cm-mermaid-surface-stage g.node,
    .cm-mermaid-surface-stage g[data-id],
    .cm-mermaid-surface-stage path[data-id],
    .cm-mermaid-surface-stage g.edgeLabel {
      cursor: pointer;
    }
    .cm-mermaid-surface-stage path[data-id] {
      pointer-events: visibleStroke;
    }
    .cm-mermaid-surface-stage .is-rd-linked {
      filter: drop-shadow(0 0 5px color-mix(in srgb, var(--rip-accent) 85%, transparent));
    }
    .cm-mermaid-surface-stage .is-rd-selected {
      filter:
        drop-shadow(0 0 1.5px var(--rip-focus))
        drop-shadow(0 0 1.5px var(--rip-focus))
        drop-shadow(0 0 6px var(--rip-focus));
    }
    .cm-mermaid-surface-stage path.is-rd-selected {
      stroke: var(--rip-focus) !important;
      stroke-width: 3px !important;
    }
    .cm-mermaid-surface-stage .is-rd-connect-source {
      filter: drop-shadow(0 0 7px var(--rip-accent));
    }
    .cm-mermaid-surface-connector {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    }
    .cm-mermaid-surface-connector line {
      stroke: var(--rip-accent);
      stroke-width: 2px;
      stroke-dasharray: 6 4;
    }
    .cm-mermaid-surface-rename {
      position: absolute;
      z-index: 3;
      box-sizing: border-box;
      height: 30px;
      border: 2px solid var(--rip-focus);
      border-radius: 6px;
      padding: 0 8px;
      color: var(--rip-fg);
      background: var(--rip-input-bg);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
      font: 13px var(--vscode-font-family);
      text-align: center;
    }
    .cm-mermaid-surface-rename[hidden],
    .cm-mermaid-surface-templates[hidden] {
      display: none;
    }
    .cm-mermaid-surface-templates {
      position: absolute;
      inset: 0;
      display: flex;
      flex-wrap: wrap;
      align-content: center;
      justify-content: center;
      gap: 8px;
      padding: 16px;
    }
    .cm-mermaid-surface-templates-title {
      flex-basis: 100%;
      text-align: center;
      color: var(--rip-muted);
      font-size: 13px;
    }
    .cm-mermaid-surface-template {
      height: 32px;
      padding: 0 14px;
    }
    .cm-mermaid-surface-status {
      min-height: 22px;
      padding: 3px 10px;
      border-top: 1px solid var(--rip-border);
      color: var(--rip-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 16px;
    }
    .cm-mermaid-surface-status.is-error {
      color: var(--rip-danger);
      white-space: normal;
    }
    .cm-mermaid-editor-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10003;
      display: grid;
      padding: 20px;
      background: rgba(0, 0, 0, 0.56);
    }
    .cm-mermaid-editor-modal {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto 1fr;
      border: 1px solid var(--rip-border);
      border-radius: 10px;
      overflow: hidden;
      color: var(--rip-fg);
      background: var(--rip-panel);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.42);
      font-family: var(--vscode-font-family);
    }
    .cm-mermaid-editor-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--rip-border);
      background: color-mix(in srgb, var(--rip-panel) 88%, var(--rip-bg));
    }
    .cm-mermaid-editor-title {
      color: var(--rip-heading);
      font-size: 13px;
      font-weight: 700;
    }
    .cm-mermaid-editor-badge:not(:empty) {
      border: 1px solid var(--rip-border);
      border-radius: 999px;
      padding: 1px 8px;
      color: var(--rip-muted);
      font-size: 11px;
    }
    .cm-mermaid-editor-notice {
      flex: 1;
      min-width: 0;
      color: var(--rip-danger);
      font-size: 12px;
    }
    .cm-mermaid-editor-done {
      height: 28px;
      border: 1px solid var(--rip-accent);
      border-radius: 6px;
      padding: 0 14px;
      color: var(--rip-button-fg);
      background: var(--rip-accent);
      font: 12px var(--vscode-font-family);
      cursor: pointer;
    }
    .cm-mermaid-editor-body {
      min-height: 0;
      display: grid;
      grid-template-columns: var(--mermaid-editor-split, 38%) 6px minmax(0, 1fr);
    }
    .cm-mermaid-editor-source {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background: var(--rip-bg);
    }
    .cm-mermaid-editor-source .cm-editor {
      height: 100%;
      color: var(--rip-fg);
      background: var(--rip-bg);
      font: 13px/1.6 var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
    }
    .cm-mermaid-editor-source .cm-editor.cm-focused {
      outline: none;
    }
    /* The document's reading-width rules target every .cm-content; the
       modal's source editor must use its whole pane instead. */
    html[data-preview-width] body .cm-mermaid-editor-source .cm-editor .cm-content,
    .cm-mermaid-editor-source .cm-editor .cm-content {
      max-width: none;
      margin: 0;
    }
    .cm-mermaid-editor-source .cm-scroller {
      overflow: auto;
    }
    .cm-mermaid-editor-source .cm-content {
      caret-color: var(--rip-caret, var(--rip-fg));
    }
    .cm-mermaid-editor-source .cm-gutters {
      border-right: 1px solid var(--rip-border);
      color: var(--rip-muted);
      background: var(--rip-panel);
    }
    .cm-mermaid-editor-source .cm-activeLine {
      background: color-mix(in srgb, var(--rip-hover) 70%, transparent);
    }
    .cm-mermaid-editor-source .cm-selectionBackground,
    .cm-mermaid-editor-source .cm-editor.cm-focused .cm-selectionBackground {
      background: color-mix(in srgb, var(--rip-focus) 30%, transparent);
    }
    .cm-mermaid-editor-splitter {
      cursor: col-resize;
      background: var(--rip-border);
      touch-action: none;
    }
    .cm-mermaid-editor-splitter:hover {
      background: var(--rip-focus);
    }
    .cm-mermaid-editor-diagram {
      min-width: 0;
      min-height: 0;
    }
    /* Obsidian wikilinks to names no workspace file has. */
    .cm-wikilink-unresolved {
      opacity: 0.7;
      text-decoration-style: dashed;
    }
    a.cm-wikilink {
      color: var(--rip-link);
    }
    /* GitHub alerts, drawn like GitHub's .markdown-alert, and Obsidian
       callouts. Each color class sets --callout-color for the widget and for
       the quote lines of a callout being edited. */
    ${calloutThemeCss(darkThemeSelectors)}
    ${calloutColors
      .map((color) => `.cm-callout-${color} { --callout-color: var(--rip-callout-${color}); }`)
      .join("\n    ")}
    .cm-callout {
      box-sizing: border-box;
      max-width: 100%;
      margin: 0;
      border-left: 0.25em solid var(--callout-color);
      padding: 8px 16px;
      color: var(--rip-fg);
    }
    .cm-callout-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--callout-color);
      font-weight: 500;
      line-height: 1.5;
    }
    .cm-callout-icon {
      flex: none;
    }
    .cm-callout-body {
      display: grid;
      gap: 10px;
      margin-top: 6px;
    }
    .cm-callout-body:empty {
      display: none;
    }
    .cm-callout-obsidian {
      border-left: 0;
      border-radius: 4px;
      padding: 12px 16px;
      background: color-mix(in srgb, var(--callout-color) 10%, transparent);
    }
    .cm-callout-obsidian > .cm-callout-title {
      font-weight: 600;
    }
    .cm-callout.is-foldable > .cm-callout-title {
      cursor: pointer;
      user-select: none;
    }
    .cm-callout-fold {
      display: inline-block;
      transform: rotate(90deg);
      transition: transform 0.12s ease;
    }
    .cm-callout.is-collapsed > .cm-callout-title > .cm-callout-fold {
      transform: none;
    }
    .cm-callout.is-collapsed > .cm-callout-body {
      display: none;
    }
    @media print {
      .cm-callout.is-collapsed > .cm-callout-body {
        display: grid;
      }
    }
    .cm-editor .cm-line.cm-callout-line {
      border-left-color: var(--callout-color);
    }
    .cm-editor .cm-line.cm-callout-title-line {
      color: var(--callout-color);
      font-weight: 500;
    }
  `;
  document.head.appendChild(style);
}
