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
    .cm-table-context-menu-item:hover {
      background: var(--rip-hover);
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
  `;
  document.head.appendChild(style);
}
