import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    setupFiles: ["test/setup/jsdomPolyfills.js"],
    // Most of the tested code is pure logic, so Node stays the default
    // environment. DOM suites opt in per file with a
    // `// @vitest-environment jsdom` docblock.
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      reporter: ["text", "html"],
      // Set just under the current numbers so a regression fails the run while
      // ordinary refactors do not. The uncovered remainder is mostly the PDF
      // export's Chrome DevTools plumbing, which needs a real browser.
      thresholds: {
        statements: 82,
        branches: 74,
        functions: 80,
        lines: 82,
      },
    },
  },
});
