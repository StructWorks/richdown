import { normalizePreviewWidth } from "../../domain/settingsModel.js";

export function applyTheme(themeName) {
  const theme = getTheme(themeName);
  const rootStyle = document.documentElement.style;
  document.documentElement.dataset.richTheme = themeName || "default";

  for (const [key, value] of Object.entries(theme)) {
    rootStyle.setProperty(
      `--rip-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      value,
    );
  }
}

export function applyPreviewWidth(previewWidth) {
  const width = normalizePreviewWidth(previewWidth);
  document.documentElement.dataset.previewWidth = width;
  document.documentElement.style.setProperty(
    "--rip-content-max-width",
    width === "wide" ? "none" : "960px",
  );
}

export function getThemeOptions() {
  return [
    { value: "default", label: "Default" },
    { value: "midnight", label: "Midnight" },
    { value: "graphite", label: "Graphite" },
    { value: "forest", label: "Forest" },
    { value: "ivory", label: "Ivory" },
    { value: "paper", label: "Paper" },
    { value: "solar", label: "Solar" },
  ];
}

export function getMermaidSizeOptions() {
  return [
    { label: "Source height", value: "source" },
    { label: "Readable", value: "readable" },
    { label: "Large", value: "large" },
  ];
}

export function getPreviewWidthOptions() {
  return [
    { label: "Default", value: "default" },
    { label: "Wide", value: "wide" },
  ];
}

function getTheme(themeName) {
  const themes = {
    default: {
      bg: "var(--vscode-editor-background)",
      fg: "var(--vscode-editor-foreground)",
      muted: "var(--vscode-descriptionForeground)",
      border: "var(--vscode-panel-border)",
      panel: "var(--vscode-editorWidget-background)",
      inputBg: "var(--vscode-input-background)",
      codeBg: "var(--vscode-textCodeBlock-background)",
      hover:
        "color-mix(in srgb, var(--vscode-editor-selectionBackground) 16%, transparent)",
      focus: "var(--vscode-focusBorder)",
      caret: "var(--vscode-editorCursor-foreground)",
      accent: "var(--vscode-button-background)",
      buttonFg: "var(--vscode-button-foreground)",
      heading: "var(--vscode-textLink-foreground)",
      link: "var(--vscode-textLink-foreground)",
      quoteBorder: "var(--vscode-textBlockQuote-border)",
      rowAlt:
        "color-mix(in srgb, var(--vscode-editorWidget-background) 45%, transparent)",
      syntaxPurple: "var(--vscode-charts-purple, #c586c0)",
      syntaxOrange: "var(--vscode-charts-orange, #ce9178)",
      syntaxGreen: "var(--vscode-charts-green, #b5cea8)",
      syntaxBlue: "var(--vscode-charts-blue, #9cdcfe)",
      danger: "var(--vscode-errorForeground, #f14c4c)",
    },
    midnight: {
      bg: "#0b1020",
      fg: "#d9e4ff",
      muted: "#8796b8",
      border: "#26314f",
      panel: "#111936",
      inputBg: "#0f1730",
      codeBg: "#070b16",
      hover: "rgba(93, 144, 255, 0.14)",
      focus: "#7aa2ff",
      caret: "#ffffff",
      accent: "#6f9cff",
      buttonFg: "#081120",
      heading: "#8fb4ff",
      link: "#8fb4ff",
      quoteBorder: "#5e7fd6",
      rowAlt: "rgba(143, 180, 255, 0.08)",
      syntaxPurple: "#d7a7ff",
      syntaxOrange: "#ffc08a",
      syntaxGreen: "#9ce6b3",
      syntaxBlue: "#8bd7ff",
      danger: "#ff8a8a",
    },
    graphite: {
      bg: "#151617",
      fg: "#e5e1d8",
      muted: "#9b9891",
      border: "#343536",
      panel: "#202224",
      inputBg: "#1b1d1f",
      codeBg: "#101112",
      hover: "rgba(229, 225, 216, 0.08)",
      focus: "#d0a85c",
      caret: "#f5f0e6",
      accent: "#d0a85c",
      buttonFg: "#171717",
      heading: "#e2bd72",
      link: "#e2bd72",
      quoteBorder: "#8e7a55",
      rowAlt: "rgba(255, 255, 255, 0.045)",
      syntaxPurple: "#cfa8ff",
      syntaxOrange: "#e6b17e",
      syntaxGreen: "#9bcf9d",
      syntaxBlue: "#8ebbdc",
      danger: "#ff8f8f",
    },
    forest: {
      bg: "#0f1712",
      fg: "#dce8dc",
      muted: "#8ea08f",
      border: "#263529",
      panel: "#17231a",
      inputBg: "#121d15",
      codeBg: "#0a100c",
      hover: "rgba(121, 184, 136, 0.12)",
      focus: "#79b888",
      caret: "#effff0",
      accent: "#79b888",
      buttonFg: "#071008",
      heading: "#a4d8a9",
      link: "#9fd6b3",
      quoteBorder: "#5b936a",
      rowAlt: "rgba(164, 216, 169, 0.07)",
      syntaxPurple: "#d0a8ff",
      syntaxOrange: "#e9bd8c",
      syntaxGreen: "#93d79b",
      syntaxBlue: "#8fcbd4",
      danger: "#ff8a8a",
    },
    ivory: {
      bg: "#fbf5e8",
      fg: "#2f2b25",
      muted: "#776f62",
      border: "#ded3bf",
      panel: "#f1e7d5",
      inputBg: "#fffaf0",
      codeBg: "#f2eadc",
      hover: "rgba(107, 78, 42, 0.09)",
      focus: "#a46c28",
      caret: "#2f2b25",
      accent: "#a46c28",
      buttonFg: "#fff8ee",
      heading: "#7a4f1e",
      link: "#8a5a24",
      quoteBorder: "#bc8f55",
      rowAlt: "rgba(122, 79, 30, 0.06)",
      syntaxPurple: "#8a4fb0",
      syntaxOrange: "#a75d17",
      syntaxGreen: "#3f7a3f",
      syntaxBlue: "#2e6f9f",
      danger: "#b42318",
    },
    paper: {
      bg: "#ffffff",
      fg: "#202124",
      muted: "#6b7280",
      border: "#d7dbe2",
      panel: "#f3f5f8",
      inputBg: "#ffffff",
      codeBg: "#f5f7fa",
      hover: "rgba(31, 111, 235, 0.08)",
      focus: "#1f6feb",
      caret: "#202124",
      accent: "#1f6feb",
      buttonFg: "#ffffff",
      heading: "#0b5cad",
      link: "#0b5cad",
      quoteBorder: "#8aa6c8",
      rowAlt: "#f8fafc",
      syntaxPurple: "#7c3aed",
      syntaxOrange: "#b45309",
      syntaxGreen: "#15803d",
      syntaxBlue: "#0369a1",
      danger: "#b42318",
    },
    solar: {
      bg: "#fdf6e3",
      fg: "#3b3a32",
      muted: "#7b7662",
      border: "#d8ceb0",
      panel: "#eee5c8",
      inputBg: "#fff9e8",
      codeBg: "#f4edcf",
      hover: "rgba(181, 137, 0, 0.1)",
      focus: "#b58900",
      caret: "#3b3a32",
      accent: "#b58900",
      buttonFg: "#fff8df",
      heading: "#9b6d00",
      link: "#0f6c8c",
      quoteBorder: "#b58900",
      rowAlt: "rgba(181, 137, 0, 0.07)",
      syntaxPurple: "#6c54a3",
      syntaxOrange: "#b85c00",
      syntaxGreen: "#5f7f00",
      syntaxBlue: "#227894",
      danger: "#b42318",
    },
  };
  return themes[themeName] || themes.default;
}
