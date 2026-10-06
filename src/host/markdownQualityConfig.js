// .richdownrc.json: which formatter and lint rules run for a Markdown file.
//
// The nearest .richdownrc.json above a document applies to it (see
// src/host/markdownQuality.js). The file is JSON with comments:
//
//   {
//     "format": {
//       "rules": { "table-format": false, "list-marker": { "style": "*" } }
//     },
//     "lint": {
//       "default": true,
//       "rules": { "no-hard-tabs": false, "line-length": { "severity": "info", "max": 100 } }
//     }
//   }
//
// A section can be `false` or `{ "enabled": false }` to turn the formatter or
// the linter off for the project. `default` switches every rule the file does
// not list on or off; without it, unlisted rules keep their built-in default.

const { formatRules } = require("./markdownFormatter");
const { lintRules, severities } = require("./markdownLinter");

const configFileName = ".richdownrc.json";

// Parses JSON with // and /* */ comments and trailing commas.
function parseConfigText(text) {
  const stripped = stripJsonComments(String(text ?? ""));
  if (stripped.trim() === "") {
    return { config: {} };
  }
  try {
    const config = JSON.parse(stripped);
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return { config: {}, error: { message: `${configFileName} must contain a JSON object.`, offset: 0 } };
    }
    return { config };
  } catch (error) {
    const position = /position (\d+)/.exec(error.message);
    return {
      config: {},
      error: {
        message: `${configFileName} is not valid JSON: ${error.message}`,
        offset: position ? Number(position[1]) : 0,
      },
    };
  }
}

// Comments and trailing commas become spaces of the same length, so a
// JSON.parse error offset still points into the original text.
function stripJsonComments(text) {
  let result = "";
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '"') {
      let end = index + 1;
      while (end < text.length && text[end] !== '"') {
        end += text[end] === "\\" ? 2 : 1;
      }
      result += text.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    if (character === "/" && text[index + 1] === "/") {
      const end = text.indexOf("\n", index);
      const stop = end === -1 ? text.length : end;
      result += " ".repeat(stop - index);
      index = stop;
      continue;
    }
    if (character === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      const stop = end === -1 ? text.length : end + 2;
      result += text.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }
    // A trailing comma before } or ] is dropped.
    if (character === "," && /^\s*[}\]]/.test(text.slice(index + 1))) {
      result += " ";
      index += 1;
      continue;
    }
    result += character;
    index += 1;
  }
  return result;
}

// { enabled, rules } with rules mapping each format rule name to its options,
// or null when the rule is off.
function resolveFormatConfig(config) {
  const section = readSection(config?.format);
  const rules = {};
  for (const rule of formatRules) {
    rules[rule.name] = resolveFormatRule(rule, section);
  }
  return { enabled: section.enabled, rules };
}

function resolveFormatRule(rule, section) {
  const value = Object.prototype.hasOwnProperty.call(section.rules, rule.name)
    ? section.rules[rule.name]
    : section.defaultValue ?? true;
  if (value === false || value === "off") {
    return null;
  }
  const options = isPlainObject(value) ? value : {};
  if (options.enabled === false) {
    return null;
  }
  return resolveOptions(rule, options);
}

// { enabled, rules } with rules mapping each lint rule name to
// { severity, options }, or null when the rule is off.
function resolveLintConfig(config) {
  const section = readSection(config?.lint);
  const rules = {};
  for (const rule of lintRules) {
    rules[rule.name] = resolveLintRule(rule, section);
  }
  return { enabled: section.enabled, rules };
}

function resolveLintRule(rule, section) {
  const defaultSeverity = rule.defaultSeverity || "warning";
  const listed = Object.prototype.hasOwnProperty.call(section.rules, rule.name);
  const value = listed
    ? section.rules[rule.name]
    : section.defaultValue ?? rule.defaultEnabled !== false;
  if (value === false || value === "off") {
    return null;
  }
  if (typeof value === "string") {
    return {
      severity: severities.includes(value) ? value : defaultSeverity,
      options: resolveOptions(rule, {}),
    };
  }
  const options = isPlainObject(value) ? value : {};
  if (options.enabled === false) {
    return null;
  }
  return {
    severity: severities.includes(options.severity) ? options.severity : defaultSeverity,
    options: resolveOptions(rule, options),
  };
}

function readSection(value) {
  if (value === false) {
    return { enabled: false, rules: {}, defaultValue: undefined };
  }
  const section = isPlainObject(value) ? value : {};
  return {
    enabled: section.enabled !== false,
    rules: isPlainObject(section.rules) ? section.rules : {},
    defaultValue: typeof section.default === "boolean" ? section.default : undefined,
  };
}

// Fills in defaults and drops option values the rule does not accept.
function resolveOptions(rule, given) {
  const options = {};
  for (const [name, spec] of Object.entries(rule.options || {})) {
    const value = given[name];
    const valid = spec.enum
      ? spec.enum.includes(value)
      : spec.type === "integer"
        ? Number.isInteger(value) && value >= (spec.minimum ?? -Infinity)
        : value !== undefined;
    options[name] = valid ? value : spec.default;
  }
  return options;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// The file "Richdown: Create Formatter and Lint Configuration" writes: every
// rule at its default, with its description, so users only flip values.
function createDefaultConfigText() {
  const lines = ["{", '  "format": {', '    "rules": {'];
  formatRules.forEach((rule, index) => {
    const value = rule.options ? formatInlineObject(defaultOptions(rule)) : "true";
    lines.push(`      // ${rule.description}`);
    lines.push(`      "${rule.name}": ${value}${index < formatRules.length - 1 ? "," : ""}`);
  });
  lines.push("    }", "  },", '  "lint": {', '    "rules": {');
  lintRules.forEach((rule, index) => {
    const severity = rule.defaultSeverity || "warning";
    const optionsValue = rule.options
      ? formatInlineObject({ severity, ...defaultOptions(rule) })
      : `"${severity}"`;
    const value = rule.defaultEnabled === false ? "false" : optionsValue;
    lines.push(`      // ${rule.description}`);
    if (rule.defaultEnabled === false) {
      lines.push(`      // Off by default. To turn it on: ${optionsValue}`);
    }
    lines.push(`      "${rule.name}": ${value}${index < lintRules.length - 1 ? "," : ""}`);
  });
  lines.push("    }", "  }", "}", "");
  return lines.join("\n");
}

function formatInlineObject(value) {
  const entries = Object.entries(value).map(
    ([name, entry]) => `${JSON.stringify(name)}: ${JSON.stringify(entry)}`,
  );
  return `{ ${entries.join(", ")} }`;
}

function defaultOptions(rule) {
  return Object.fromEntries(
    Object.entries(rule.options || {}).map(([name, spec]) => [name, spec.default]),
  );
}

// JSON schema for .richdownrc.json, contributed through package.json
// "jsonValidation" so VS Code completes and validates rule names.
// schemas/richdownrc.schema.json is generated from it with
// `npm run generate:schema`; a test keeps the two in sync.
function buildConfigSchema() {
  const severityEnum = [...severities, "off"];
  const optionProperties = (rule) =>
    Object.fromEntries(
      Object.entries(rule.options || {}).map(([name, spec]) => [
        name,
        spec.enum
          ? { enum: spec.enum, default: spec.default }
          : { type: spec.type, minimum: spec.minimum, default: spec.default },
      ]),
    );
  const formatRuleSchema = (rule) => ({
    description: rule.description,
    default: rule.options ? defaultOptions(rule) : true,
    anyOf: [
      { type: "boolean" },
      { const: "off" },
      {
        type: "object",
        properties: { enabled: { type: "boolean" }, ...optionProperties(rule) },
        additionalProperties: false,
      },
    ],
  });
  const lintRuleSchema = (rule) => ({
    description: `${rule.description} Default: ${
      rule.defaultEnabled === false ? "off" : rule.defaultSeverity || "warning"
    }.`,
    anyOf: [
      { type: "boolean" },
      { enum: severityEnum },
      {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          severity: { enum: severities },
          ...optionProperties(rule),
        },
        additionalProperties: false,
      },
    ],
  });
  const section = (description, rules, ruleSchema) => ({
    description,
    anyOf: [
      { type: "boolean", const: false },
      {
        type: "object",
        properties: {
          enabled: {
            type: "boolean",
            default: true,
            description: "Set to false to turn this off for every file under this configuration.",
          },
          default: {
            type: "boolean",
            description: "Turn every rule not listed in \"rules\" on (true) or off (false). Without it, unlisted rules keep their built-in default.",
          },
          rules: {
            type: "object",
            properties: Object.fromEntries(rules.map((rule) => [rule.name, ruleSchema(rule)])),
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    ],
  });
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Richdown formatter and lint configuration",
    type: "object",
    properties: {
      $schema: { type: "string" },
      format: section("Formatter rules applied by \"Richdown: Format Document\" and on save.", formatRules, formatRuleSchema),
      lint: section("Lint rules reported in the Problems panel and the Richdown editor.", lintRules, lintRuleSchema),
    },
    additionalProperties: false,
  };
}

module.exports = {
  buildConfigSchema,
  configFileName,
  createDefaultConfigText,
  parseConfigText,
  resolveFormatConfig,
  resolveLintConfig,
};
