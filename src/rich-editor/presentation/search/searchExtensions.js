import {
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
} from "@codemirror/search";

export function createSearchExtensions() {
  return [
    search({ top: true }),
    highlightSelectionMatches({
      highlightWordAroundCursor: true,
      minSelectionLength: 2,
    }),
  ];
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
