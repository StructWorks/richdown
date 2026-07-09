export const mermaidPreviewSizes = ["source", "readable", "large"];
export const previewWidths = ["default", "wide"];

export function normalizeRichEditorSettings(nextSettings = {}) {
  return {
    richTheme: nextSettings.richTheme || "default",
    richTablePreview: nextSettings.richTablePreview !== false,
    mermaidPreview: nextSettings.mermaidPreview !== false,
    mermaidColorized: nextSettings.mermaidColorized !== false,
    mermaidPreviewSize: normalizeMermaidPreviewSize(
      nextSettings.mermaidPreviewSize,
    ),
    gherkinPreview: nextSettings.gherkinPreview !== false,
    previewWidth: normalizePreviewWidth(nextSettings.previewWidth),
  };
}

export function normalizeMermaidPreviewSize(value) {
  return mermaidPreviewSizes.includes(value) ? value : "readable";
}

export function normalizePreviewWidth(value) {
  return previewWidths.includes(value) ? value : "default";
}

export function hasPreviewSettingChanged(previousSettings, nextSettings) {
  return (
    previousSettings.richTablePreview !== nextSettings.richTablePreview ||
    previousSettings.mermaidPreview !== nextSettings.mermaidPreview ||
    previousSettings.mermaidColorized !== nextSettings.mermaidColorized ||
    previousSettings.mermaidPreviewSize !== nextSettings.mermaidPreviewSize ||
    previousSettings.gherkinPreview !== nextSettings.gherkinPreview
  );
}
