// @vitest-environment jsdom
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

import {
  applyPreviewWidth,
  applyTheme,
  getMermaidSizeOptions,
  getPreviewWidthOptions,
  getThemeOptions,
} from "../src/rich-editor/presentation/settings/themeController.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const contributed = packageJson.contributes.configuration.properties;

beforeEach(() => {
  document.documentElement.removeAttribute("style");
  delete document.documentElement.dataset.richTheme;
  delete document.documentElement.dataset.previewWidth;
});

describe("applyTheme", () => {
  it("records the theme name and writes the palette as CSS variables", () => {
    applyTheme("midnight");
    const root = document.documentElement;

    expect(root.dataset.richTheme).toBe("midnight");
    expect(root.style.getPropertyValue("--rip-bg")).not.toBe("");
    expect(root.style.getPropertyValue("--rip-fg")).not.toBe("");
  });

  it("converts camelCase palette keys to dashed variable names", () => {
    applyTheme("midnight");
    expect(
      document.documentElement.style.getPropertyValue("--rip-input-bg"),
    ).not.toBe("");
    expect(document.documentElement.style.getPropertyValue("--rip-inputBg")).toBe(
      "",
    );
  });

  it("falls back to the VS Code theme variables for the default theme", () => {
    applyTheme("default");
    expect(document.documentElement.style.getPropertyValue("--rip-bg")).toBe(
      "var(--vscode-editor-background)",
    );
  });

  it("treats an unknown or missing theme name as the default theme", () => {
    applyTheme("midnight");
    const midnightBackground =
      document.documentElement.style.getPropertyValue("--rip-bg");

    applyTheme(undefined);
    expect(document.documentElement.dataset.richTheme).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--rip-bg")).toBe(
      "var(--vscode-editor-background)",
    );
    expect(
      document.documentElement.style.getPropertyValue("--rip-bg"),
    ).not.toBe(midnightBackground);
  });

  it("replaces the previous palette when the theme switches", () => {
    applyTheme("midnight");
    const midnight = document.documentElement.style.getPropertyValue("--rip-bg");
    applyTheme("paper");
    expect(document.documentElement.style.getPropertyValue("--rip-bg")).not.toBe(
      midnight,
    );
  });
});

describe("applyPreviewWidth", () => {
  it("uses the writing width by default", () => {
    applyPreviewWidth("default");
    expect(document.documentElement.dataset.previewWidth).toBe("default");
    expect(
      document.documentElement.style.getPropertyValue("--rip-content-max-width"),
    ).toBe("960px");
  });

  it("removes the width cap in wide mode", () => {
    applyPreviewWidth("wide");
    expect(document.documentElement.dataset.previewWidth).toBe("wide");
    expect(
      document.documentElement.style.getPropertyValue("--rip-content-max-width"),
    ).toBe("none");
  });

  it("normalizes an unknown width to the default", () => {
    applyPreviewWidth("full");
    expect(document.documentElement.dataset.previewWidth).toBe("default");
    expect(
      document.documentElement.style.getPropertyValue("--rip-content-max-width"),
    ).toBe("960px");
  });
});

// The settings menu is built from these lists, so they must stay in step with
// the enums contributed in package.json.
describe("settings menu options", () => {
  it.each([
    ["richdown.richTheme", getThemeOptions],
    ["richdown.mermaidPreviewSize", getMermaidSizeOptions],
    ["richdown.previewWidth", getPreviewWidthOptions],
  ])("matches the contributed enum for %s", (setting, getOptions) => {
    expect(getOptions().map((option) => option.value)).toEqual(
      contributed[setting].enum,
    );
  });

  it("labels every option", () => {
    for (const getOptions of [
      getThemeOptions,
      getMermaidSizeOptions,
      getPreviewWidthOptions,
    ]) {
      for (const option of getOptions()) {
        expect(option.label).toBeTruthy();
      }
    }
  });
});
