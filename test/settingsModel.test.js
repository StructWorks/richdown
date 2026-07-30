import { describe, expect, it } from "vitest";

import {
  hasPreviewSettingChanged,
  mermaidPreviewSizes,
  normalizeMermaidPreviewSize,
  normalizePreviewWidth,
  normalizeRichEditorSettings,
  previewWidths,
} from "../src/rich-editor/domain/settingsModel.js";

const defaults = {
  richTheme: "default",
  richTablePreview: true,
  mermaidPreview: true,
  mermaidColorized: true,
  mermaidPreviewSize: "readable",
  gherkinPreview: true,
  previewWidth: "default",
};

describe("normalizeRichEditorSettings", () => {
  // Settings arrive from the extension host, from persisted webview state and
  // from the export shell, so every path is normalized before use.
  it("falls back to the package.json defaults without input", () => {
    expect(normalizeRichEditorSettings()).toEqual(defaults);
    expect(normalizeRichEditorSettings({})).toEqual(defaults);
  });

  it("passes explicit settings through unchanged", () => {
    const explicit = {
      richTheme: "midnight",
      richTablePreview: false,
      mermaidPreview: false,
      mermaidColorized: false,
      mermaidPreviewSize: "large",
      gherkinPreview: false,
      previewWidth: "wide",
    };
    expect(normalizeRichEditorSettings(explicit)).toEqual(explicit);
  });

  it("only treats a strict false as disabling a preview toggle", () => {
    expect(
      normalizeRichEditorSettings({
        richTablePreview: 0,
        mermaidPreview: null,
        mermaidColorized: undefined,
        gherkinPreview: "false",
      }),
    ).toEqual(defaults);
  });

  it("falls back to following the VS Code theme for an empty theme name", () => {
    expect(normalizeRichEditorSettings({ richTheme: "" }).richTheme).toBe(
      "default",
    );
  });
});

describe("enum settings", () => {
  it("matches the contributed enums in package.json", () => {
    expect(mermaidPreviewSizes).toEqual(["source", "readable", "large"]);
    expect(previewWidths).toEqual(["default", "wide"]);
  });

  it.each(mermaidPreviewSizes)("keeps the valid mermaid size %s", (size) => {
    expect(normalizeMermaidPreviewSize(size)).toBe(size);
  });

  it.each([["huge"], [""], [null], [undefined], [2], ["READABLE"]])(
    "falls back to readable for the invalid mermaid size %j",
    (value) => {
      expect(normalizeMermaidPreviewSize(value)).toBe("readable");
    },
  );

  it.each(previewWidths)("keeps the valid preview width %s", (width) => {
    expect(normalizePreviewWidth(width)).toBe(width);
  });

  it.each([["full"], [""], [null], [undefined], ["WIDE"]])(
    "falls back to default for the invalid preview width %j",
    (value) => {
      expect(normalizePreviewWidth(value)).toBe("default");
    },
  );
});

describe("hasPreviewSettingChanged", () => {
  it("requires no rebuild for identical settings", () => {
    expect(
      hasPreviewSettingChanged(defaults, normalizeRichEditorSettings()),
    ).toBe(false);
  });

  it.each([
    ["richTablePreview", false],
    ["mermaidPreview", false],
    ["mermaidColorized", false],
    ["mermaidPreviewSize", "large"],
    ["gherkinPreview", false],
  ])("rebuilds previews when %s changes", (key, value) => {
    expect(
      hasPreviewSettingChanged(
        defaults,
        normalizeRichEditorSettings({ ...defaults, [key]: value }),
      ),
    ).toBe(true);
  });

  // Theme and content width are pure styling, applied without rebuilding the
  // preview decorations.
  it.each([
    ["richTheme", "forest"],
    ["previewWidth", "wide"],
  ])("does not rebuild previews when %s changes", (key, value) => {
    expect(
      hasPreviewSettingChanged(
        defaults,
        normalizeRichEditorSettings({ ...defaults, [key]: value }),
      ),
    ).toBe(false);
  });
});
