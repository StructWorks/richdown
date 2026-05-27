import {
  hasPreviewSettingChanged,
  normalizeRichEditorSettings,
} from "../domain/settingsModel.js";

export function applySettingsPatch(currentSettings, settingsPatch = {}) {
  const nextSettings = normalizeRichEditorSettings({
    ...currentSettings,
    ...settingsPatch,
  });

  return {
    settings: nextSettings,
    previewChanged: hasPreviewSettingChanged(currentSettings, nextSettings),
  };
}
