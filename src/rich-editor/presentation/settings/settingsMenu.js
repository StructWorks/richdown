import {
  applyPreviewWidth,
  applyTheme,
  getMermaidSizeOptions,
  getPreviewWidthOptions,
  getThemeOptions,
} from "./themeController.js";
import {
  normalizeMermaidPreviewSize,
  normalizePreviewWidth,
} from "../../domain/settingsModel.js";

export function createSettingsMenuController({
  getSettings,
  postMessage,
  refreshDecorations,
}) {
  let lastActionKey = "";
  let lastActionTime = 0;

  function render() {
    if (document.querySelector(".cm-settings-root")) {
      return;
    }

    const container = document.createElement("div");
    container.className = "cm-settings-root";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-settings-button";
    button.title = "Rich Editor settings";
    button.setAttribute("aria-label", "Rich Editor settings");
    button.textContent = "⚙";

    const menu = document.createElement("div");
    menu.className = "cm-settings-menu";
    menu.hidden = true;

    container.addEventListener("click", (event) => event.stopPropagation());
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    menu.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    menu.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    menu.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    container.appendChild(menu);
    container.appendChild(button);
    document.body.appendChild(container);
    update();
  }

  function bindActions(menu) {
    for (const item of menu.querySelectorAll(".cm-settings-menu-item")) {
      const handle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        runAction(item, menu);
      };
      item.addEventListener("pointerdown", handle, true);
      item.addEventListener("mousedown", handle, true);
      item.addEventListener("click", handle, true);
    }
  }

  function runAction(item, menu) {
    const actionKey = getActionKey(item);
    const now = Date.now();
    if (actionKey && actionKey === lastActionKey && now - lastActionTime < 350) {
      return;
    }
    lastActionKey = actionKey;
    lastActionTime = now;

    const settings = getSettings();

    if (item.dataset.theme !== undefined) {
      const theme = item.dataset.theme;
      settings.richTheme = theme;
      applyTheme(theme);
      update();
      postMessage({ type: "setTheme", theme });
      menu.hidden = true;
      return;
    }

    if (item.dataset.toggleTablePreview !== undefined) {
      settings.richTablePreview = !settings.richTablePreview;
      update();
      refreshDecorations();
      postMessage({
        type: "setRichTablePreview",
        value: settings.richTablePreview,
      });
      return;
    }

    if (item.dataset.previewWidth !== undefined) {
      const previewWidth = normalizePreviewWidth(item.dataset.previewWidth);
      settings.previewWidth = previewWidth;
      applyPreviewWidth(previewWidth);
      update();
      postMessage({
        type: "setPreviewWidth",
        value: previewWidth,
      });
      return;
    }

    if (item.dataset.toggleMermaidPreview !== undefined) {
      settings.mermaidPreview = !settings.mermaidPreview;
      update();
      refreshDecorations();
      postMessage({
        type: "setMermaidPreview",
        value: settings.mermaidPreview,
      });
      return;
    }

    if (item.dataset.toggleMermaidColorized !== undefined) {
      settings.mermaidColorized = !settings.mermaidColorized;
      update();
      refreshDecorations();
      postMessage({
        type: "setMermaidColorized",
        value: settings.mermaidColorized,
      });
      return;
    }

    if (item.dataset.toggleGherkinPreview !== undefined) {
      settings.gherkinPreview = !settings.gherkinPreview;
      update();
      refreshDecorations();
      postMessage({
        type: "setGherkinPreview",
        value: settings.gherkinPreview,
      });
      return;
    }

    if (item.dataset.mermaidSize !== undefined) {
      const previewSize = normalizeMermaidPreviewSize(item.dataset.mermaidSize);
      settings.mermaidPreviewSize = previewSize;
      update();
      refreshDecorations();
      postMessage({
        type: "setMermaidPreviewSize",
        value: previewSize,
      });
    }
  }

  function update() {
    const menu = document.querySelector(".cm-settings-menu");
    if (!menu) return;

    const settings = getSettings();
    const currentTheme = document.documentElement.dataset.richTheme || "default";
    const currentMermaidSize = normalizeMermaidPreviewSize(
      settings.mermaidPreviewSize,
    );
    const currentPreviewWidth = normalizePreviewWidth(settings.previewWidth);
    menu.innerHTML = `
      <div class="cm-settings-section">
        <div class="cm-settings-menu-title">Appearance</div>
        <div class="cm-settings-subtitle">Theme</div>
        ${getThemeOptions()
          .map(
            (option) =>
              `<button type="button" class="cm-settings-menu-item${option.value === currentTheme ? " is-active" : ""}" data-theme="${option.value}"><span>${option.label}</span><span>${option.value === currentTheme ? "✓" : ""}</span></button>`,
          )
          .join("")}
        <div class="cm-settings-subtitle">Width</div>
        ${getPreviewWidthOptions()
          .map(
            (option) =>
              `<button type="button" class="cm-settings-menu-item${option.value === currentPreviewWidth ? " is-active" : ""}" data-preview-width="${option.value}"><span>${option.label}</span><span>${option.value === currentPreviewWidth ? "✓" : ""}</span></button>`,
          )
          .join("")}
      </div>
      <div class="cm-settings-section">
        <div class="cm-settings-menu-title">Preview</div>
        <button type="button" class="cm-settings-menu-item" data-toggle-table-preview="true"><span>Rich tables</span><span>${settings.richTablePreview ? "On" : "Off"}</span></button>
        <button type="button" class="cm-settings-menu-item" data-toggle-gherkin-preview="true"><span>Gherkin boards</span><span>${settings.gherkinPreview ? "On" : "Off"}</span></button>
      </div>
      <div class="cm-settings-section">
        <div class="cm-settings-menu-title">Mermaid</div>
        <button type="button" class="cm-settings-menu-item" data-toggle-mermaid-preview="true"><span>Diagrams</span><span>${settings.mermaidPreview ? "On" : "Off"}</span></button>
        <button type="button" class="cm-settings-menu-item" data-toggle-mermaid-colorized="true"><span>Colorized</span><span>${settings.mermaidColorized ? "On" : "Off"}</span></button>
        <div class="cm-settings-subtitle">Size</div>
        ${getMermaidSizeOptions()
          .map(
            (option) =>
              `<button type="button" class="cm-settings-menu-item${option.value === currentMermaidSize ? " is-active" : ""}" data-mermaid-size="${option.value}"><span>${option.label}</span><span>${option.value === currentMermaidSize ? "✓" : ""}</span></button>`,
          )
          .join("")}
      </div>
    `;
    bindActions(menu);
  }

  return { render, update };
}

function getActionKey(item) {
  if (item.dataset.theme !== undefined) return `theme:${item.dataset.theme}`;
  if (item.dataset.toggleTablePreview !== undefined) return "table-preview";
  if (item.dataset.previewWidth !== undefined) {
    return `preview-width:${item.dataset.previewWidth}`;
  }
  if (item.dataset.toggleMermaidPreview !== undefined) {
    return "mermaid-preview";
  }
  if (item.dataset.toggleMermaidColorized !== undefined) {
    return "mermaid-colorized";
  }
  if (item.dataset.toggleGherkinPreview !== undefined) {
    return "gherkin-preview";
  }
  if (item.dataset.mermaidSize !== undefined) {
    return `mermaid-size:${item.dataset.mermaidSize}`;
  }
  return "";
}
