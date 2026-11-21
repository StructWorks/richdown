import js from "@eslint/js";
import globals from "globals";

// The repository holds three kinds of JavaScript:
//   - extension host code (CommonJS, node globals): extension.js, src/export,
//     src/host; the Orca plugin worker (ESM, node globals): src/orcaWorker.js,
//     src/orca-worker
//   - webview code (ESM, browser globals): src/richEditor.js, src/richDiff.js,
//     src/mermaidLoader.js, the Orca editor entry src/orcaEditor.js, and
//     everything under src/rich-editor and src/rich-diff
//   - tests and tooling (ESM, node globals, jsdom in some suites)
// media/*.js and build/ (the Orca plugin) are generated and never linted.
export default [
  {
    ignores: ["media/**", "build/**", "coverage/**", "node_modules/**", "articles/**", "examples/**"],
  },
  js.configs.recommended,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      // Several catch blocks exist only to keep a preview readable when an
      // optional step fails; the reason is written as a comment instead of code.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": [
        "error",
        {
          args: "after-used",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-throw-literal": "error",
    },
  },
  {
    files: ["extension.js", "src/export/**/*.js", "src/host/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: globals.node,
    },
  },
  {
    // The Orca plugin worker runs in Node as an ES module.
    files: ["src/orcaWorker.js", "src/orca-worker/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    // Repository tooling: printing progress is the point of these scripts.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: [
      "src/richEditor.js",
      "src/orcaEditor.js",
      "src/richDiff.js",
      "src/mermaidLoader.js",
      "src/markdown/**/*.js",
      "src/rich-editor/**/*.js",
      "src/rich-diff/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Injected by the VS Code webview host and by the Mermaid loader bundle.
        acquireVsCodeApi: "readonly",
      },
    },
  },
  {
    files: ["test/**/*.js", "vitest.config.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
];
