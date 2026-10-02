import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vitest";

// markdownEditorRouter.js runs in the extension host as CommonJS.
const require = createRequire(import.meta.url);
const {
  REPLACED_TAB_WINDOW_MS,
  createMarkdownEditorRouter,
  createTabKey,
} = require("../src/host/markdownEditorRouter.js");

const A = "file:///notes/a.md";
const B = "file:///notes/b.md";
const tab = (uri, column = 1) => ({ key: createTabKey(column, uri), uri });
const on = { enabled: true };

let clock;
let router;

beforeEach(() => {
  clock = 1000;
  router = createMarkdownEditorRouter({ now: () => clock });
});

describe("markdown editor router", () => {
  it("hands a newly opened text tab to Richdown once", () => {
    router.sync([tab(A)]);
    expect(router.shouldHandOver(tab(A), on)).toBe(true);
    expect(router.shouldHandOver(tab(A), on)).toBe(false);
  });

  it("leaves text tabs that were open before activation alone", () => {
    router.seed([tab(A)]);
    router.sync([tab(A)]);
    expect(router.shouldHandOver(tab(A), on)).toBe(false);
  });

  it("keeps the text editor while the feature is off", () => {
    router.sync([tab(A)]);
    expect(router.shouldHandOver(tab(A), { enabled: false })).toBe(false);
  });

  it("decides a tab opened in the background when it is activated", () => {
    router.sync([tab(A), tab(B)]);
    router.sync([tab(A), tab(B)]);
    expect(router.shouldHandOver(tab(B), on)).toBe(true);
  });

  it("treats a text tab replacing a Richdown tab as a deliberate reopen", () => {
    router.noteRichTabsClosed([tab(A).key]);
    router.sync([tab(A)]);
    expect(router.shouldHandOver(tab(A), on)).toBe(false);

    // The choice holds for further text tabs of that file...
    router.sync([tab(A), tab(A, 2)]);
    expect(router.shouldHandOver(tab(A, 2), on)).toBe(false);

    // ...until every text tab of it is closed.
    router.sync([]);
    router.sync([tab(A)]);
    expect(router.shouldHandOver(tab(A), on)).toBe(true);
  });

  it("does not mistake a Richdown tab closed long ago or elsewhere for a reopen", () => {
    router.noteRichTabsClosed([tab(A, 2).key, tab(B).key]);
    clock += REPLACED_TAB_WINDOW_MS + 1;
    router.sync([tab(A), tab(B)]);
    expect(router.shouldHandOver(tab(A), on)).toBe(true);
    expect(router.shouldHandOver(tab(B), on)).toBe(true);
  });

  it("keeps a text editor Richdown opened itself", () => {
    router.expectTextTab(A);
    router.sync([tab(A)]);
    expect(router.shouldHandOver(tab(A), on)).toBe(false);
  });

  it("lets an unused text-editor request expire", () => {
    router.expectTextTab(A);
    clock += REPLACED_TAB_WINDOW_MS + 1;
    router.sync([tab(A)]);
    expect(router.shouldHandOver(tab(A), on)).toBe(true);
  });

  it("forgets a fresh tab that closes before it was activated", () => {
    router.sync([tab(A)]);
    router.sync([]);
    expect(router.shouldHandOver(tab(A), on)).toBe(false);
  });
});
