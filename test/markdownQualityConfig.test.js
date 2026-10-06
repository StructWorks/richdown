import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildConfigSchema,
  createDefaultConfigText,
  parseConfigText,
  resolveFormatConfig,
  resolveLintConfig,
} = require("../src/host/markdownQualityConfig.js");
const { findChangedSpan, positionAtLfOffset } = require("../src/host/markdownQuality.js");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("parseConfigText", () => {
  it("accepts comments and trailing commas", () => {
    const { config, error } = parseConfigText(`{
      // line comment
      "lint": { /* block */ "rules": { "no-hard-tabs": false, }, },
      "url": "http://example.com/a,}",
    }`);
    expect(error).toBeUndefined();
    expect(config.lint.rules["no-hard-tabs"]).toBe(false);
    expect(config.url).toBe("http://example.com/a,}");
  });

  it("treats an empty file as an empty configuration", () => {
    expect(parseConfigText("  \n")).toEqual({ config: {} });
  });

  it("reports invalid JSON", () => {
    const text = '{\n  // comment\n  "lint": nope\n}';
    const { config, error } = parseConfigText(text);
    expect(config).toEqual({});
    expect(error.message).toContain("not valid JSON");
    // Node includes the position in some JSON.parse messages; the offset falls
    // back to the start of the file otherwise.
    expect(error.offset).toBeGreaterThanOrEqual(0);
    expect(error.offset).toBeLessThan(text.length);
  });

  it("rejects a top-level value that is not an object", () => {
    expect(parseConfigText("[]").error.message).toContain("JSON object");
  });
});

describe("resolveFormatConfig", () => {
  it("turns every rule on with its default options", () => {
    const { enabled, rules } = resolveFormatConfig({});
    expect(enabled).toBe(true);
    expect(rules["table-format"]).toEqual({});
    expect(rules["list-marker"]).toEqual({ style: "-" });
  });

  it("turns listed rules off and applies their options", () => {
    const { rules } = resolveFormatConfig({
      format: {
        rules: {
          "table-format": false,
          "final-newline": "off",
          "trailing-whitespace": { enabled: false },
          "list-marker": { style: "*" },
          "ordered-list-numbering": { style: "unknown" },
        },
      },
    });
    expect(rules["table-format"]).toBeNull();
    expect(rules["final-newline"]).toBeNull();
    expect(rules["trailing-whitespace"]).toBeNull();
    expect(rules["list-marker"]).toEqual({ style: "*" });
    expect(rules["ordered-list-numbering"]).toEqual({ style: "ordered" });
  });

  it("starts from every rule off with default: false", () => {
    const { rules } = resolveFormatConfig({
      format: { default: false, rules: { "table-format": true } },
    });
    expect(Object.entries(rules).filter(([, value]) => value)).toEqual([["table-format", {}]]);
  });

  it("can turn the formatter off for a project", () => {
    expect(resolveFormatConfig({ format: false }).enabled).toBe(false);
    expect(resolveFormatConfig({ format: { enabled: false } }).enabled).toBe(false);
  });
});

describe("resolveLintConfig", () => {
  it("uses each rule's default severity and leaves opt-in rules off", () => {
    const { rules } = resolveLintConfig({});
    expect(rules["heading-increment"]).toEqual({ severity: "warning", options: {} });
    expect(rules["unclosed-code-fence"].severity).toBe("error");
    expect(rules["no-missing-image-alt"].severity).toBe("info");
    expect(rules["line-length"]).toBeNull();
    expect(rules["no-bare-urls"]).toBeNull();
  });

  it("accepts a severity, true, false, or an options object", () => {
    const { rules } = resolveLintConfig({
      lint: {
        rules: {
          "heading-increment": "error",
          "no-hard-tabs": false,
          "no-bare-urls": true,
          "line-length": { severity: "hint", max: 80 },
          "single-h1": "loud",
        },
      },
    });
    expect(rules["heading-increment"].severity).toBe("error");
    expect(rules["no-hard-tabs"]).toBeNull();
    expect(rules["no-bare-urls"]).toEqual({ severity: "warning", options: {} });
    expect(rules["line-length"]).toEqual({ severity: "hint", options: { max: 80 } });
    expect(rules["single-h1"].severity).toBe("warning");
  });

  it("turns every rule on with default: true, including opt-in rules", () => {
    const { rules } = resolveLintConfig({ lint: { default: true } });
    expect(rules["line-length"]).toEqual({ severity: "warning", options: { max: 120 } });
  });
});

describe("createDefaultConfigText", () => {
  it("parses back to exactly the built-in defaults", () => {
    const { config, error } = parseConfigText(createDefaultConfigText());
    expect(error).toBeUndefined();
    expect(resolveFormatConfig(config)).toEqual(resolveFormatConfig({}));
    expect(resolveLintConfig(config)).toEqual(resolveLintConfig({}));
  });
});

describe("configuration schema", () => {
  it("matches the generated schemas/richdownrc.schema.json (run npm run generate:schema)", () => {
    const committed = JSON.parse(
      readFileSync(path.join(repoRoot, "schemas", "richdownrc.schema.json"), "utf8"),
    );
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildConfigSchema())));
  });

  it("is the schema package.json contributes for .richdownrc.json", () => {
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    expect(manifest.contributes.jsonValidation).toContainEqual({
      fileMatch: ".richdownrc.json",
      url: "./schemas/richdownrc.schema.json",
    });
  });
});

describe("format edit helpers", () => {
  it("finds the smallest changed span", () => {
    expect(findChangedSpan("a\nb\nc\n", "a\nB\nc\n")).toEqual({ from: 2, to: 3, text: "B" });
    expect(findChangedSpan("abc", "abc\n")).toEqual({ from: 3, to: 3, text: "\n" });
  });

  it("converts LF offsets to line and character", () => {
    expect(positionAtLfOffset("ab\ncd\n", 0)).toEqual({ line: 0, character: 0 });
    expect(positionAtLfOffset("ab\ncd\n", 4)).toEqual({ line: 1, character: 1 });
    expect(positionAtLfOffset("ab\ncd\n", 6)).toEqual({ line: 2, character: 0 });
  });
});
