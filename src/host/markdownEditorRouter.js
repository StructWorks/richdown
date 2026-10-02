// Decides when a Markdown text editor should be handed over to Richdown.
//
// VS Code passes a requested position (a `file.md#L12` link, a Search result,
// ...) only to text editors: custom editors are resolved without it, and
// there is no API to read it later. Richdown therefore takes over new
// Markdown text editors, carrying the selection VS Code applied to them:
//
// - With its editor association (the default), plain opens go straight to
//   Richdown, and text editors only appear when an extension asks for one
//   with `showTextDocument` — which is how AI extensions such as Claude Code
//   and Codex open file links. Those editors already flash on screen, so
//   handing them over adds no flicker to ordinary opens.
// - With `richdown.jumpToOpenedPosition`, the association is removed so that
//   Search results and chat links reach a text editor too, at the cost of a
//   brief text editor on every open.
//
// Not every new text editor should be taken over, though: text tabs restored
// at startup, a "Reopen Editor With > Text Editor", and text editors Richdown
// opens itself were asked for. This module keeps that bookkeeping free of the
// vscode API so it can be tested.

// A text tab that replaces a Richdown tab in the same group within this window
// was opened deliberately with "Reopen Editor With", not by a plain open.
const REPLACED_TAB_WINDOW_MS = 1500;

function createMarkdownEditorRouter({ now = () => Date.now() } = {}) {
  // Keys of every Markdown text tab seen at the last sync.
  let knownTabKeys = new Set();
  // Text tabs opened since then that have not been decided yet.
  const freshTabKeys = new Set();
  // Uris the user chose to read in the text editor.
  const textModeUris = new Set();
  // tab key -> time a Richdown tab with that key closed.
  const closedRichTabs = new Map();
  // uri -> time Richdown asked for a text editor of that file.
  const textIntents = new Map();

  function seed(textTabs) {
    // Text tabs that exist before Richdown starts were opened as text on
    // purpose (or restored that way), so leave them alone.
    for (const tab of textTabs) {
      knownTabKeys.add(tab.key);
      textModeUris.add(tab.uri);
    }
  }

  function noteRichTabsClosed(tabKeys) {
    const time = now();
    for (const key of tabKeys) {
      closedRichTabs.set(key, time);
    }
  }

  function expectTextTab(uri) {
    textIntents.set(uri, now());
  }

  function sync(textTabs) {
    const time = now();
    for (const times of [closedRichTabs, textIntents]) {
      for (const [key, since] of times) {
        if (time - since > REPLACED_TAB_WINDOW_MS) {
          times.delete(key);
        }
      }
    }

    const nextTabKeys = new Set();
    const openUris = new Set();
    for (const tab of textTabs) {
      nextTabKeys.add(tab.key);
      openUris.add(tab.uri);
      if (knownTabKeys.has(tab.key)) {
        continue;
      }
      if (closedRichTabs.has(tab.key) || textIntents.has(tab.uri)) {
        closedRichTabs.delete(tab.key);
        textIntents.delete(tab.uri);
        textModeUris.add(tab.uri);
        continue;
      }
      if (!textModeUris.has(tab.uri)) {
        freshTabKeys.add(tab.key);
      }
    }

    for (const key of freshTabKeys) {
      if (!nextTabKeys.has(key)) {
        freshTabKeys.delete(key);
      }
    }
    for (const uri of textModeUris) {
      if (!openUris.has(uri)) {
        textModeUris.delete(uri);
      }
    }
    knownTabKeys = nextTabKeys;
  }

  // True when the active text tab should become Richdown. A tab is only
  // decided once, on its first activation.
  function shouldHandOver(tab, { enabled }) {
    if (!freshTabKeys.has(tab.key)) {
      return false;
    }
    freshTabKeys.delete(tab.key);
    return enabled && !textModeUris.has(tab.uri);
  }

  return {
    expectTextTab,
    noteRichTabsClosed,
    seed,
    shouldHandOver,
    sync,
  };
}

function createTabKey(viewColumn, uri) {
  return `${viewColumn}|${uri}`;
}

module.exports = {
  REPLACED_TAB_WINDOW_MS,
  createMarkdownEditorRouter,
  createTabKey,
};
