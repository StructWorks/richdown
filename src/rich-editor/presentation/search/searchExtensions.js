import {
  getSearchQuery,
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
} from "@codemirror/search";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, ViewPlugin } from "@codemirror/view";

export function createSearchExtensions() {
  return [
    search({ top: true }),
    createRichSearchHighlightExtension(),
    highlightSelectionMatches({
      highlightWordAroundCursor: true,
      minSelectionLength: 2,
    }),
  ];
}

function createRichSearchHighlightExtension() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildSearchHighlights(view);
      }

      update(update) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.transactions.some((transaction) => transaction.effects.length > 0)
        ) {
          this.decorations = buildSearchHighlights(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

function buildSearchHighlights(view) {
  const query = getSearchQuery(view.state);
  if (!query.valid || !query.search) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder();
  let matchCount = 0;
  for (const range of view.visibleRanges) {
    const cursor = query.getCursor(view.state, range.from, range.to);
    for (let result = cursor.next(); !result.done; result = cursor.next()) {
      const { from, to } = result.value;
      if (from === to) {
        continue;
      }
      builder.add(
        from,
        to,
        Decoration.mark({ class: "cm-richdown-search-match" }),
      );
      matchCount += 1;
      if (matchCount > 500) {
        return builder.finish();
      }
    }
  }

  return builder.finish();
}

export function getSearchKeymap() {
  return searchKeymap;
}

export function installSearchShortcut({
  getView,
  closeSlashCommandMenu,
  closeTableContextMenu,
}) {
  window.addEventListener(
    "keydown",
    (event) => {
      const view = getView();
      if (!view || !isSearchShortcut(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeSlashCommandMenu();
      closeTableContextMenu();
      openSearchPanel(view);
    },
    true,
  );
}

function isSearchShortcut(event) {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "f"
  );
}
