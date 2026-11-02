import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  highlightSelectionMatches,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  searchKeymap,
  SearchQuery,
  selectMatches,
  setSearchQuery,
} from "@codemirror/search";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, runScopeHandlers, ViewPlugin } from "@codemirror/view";

// Matches past this many are not counted; the count then reads "999+".
const maxCountedMatches = 999;

export function createSearchExtensions() {
  return [
    search({ top: true, createPanel: (view) => new RichSearchPanel(view) }),
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

// A find widget in the manner of VS Code's: one compact row floating over the
// top right of the document (find field, match options, match count, previous
// and next, close), with the replace row folded away behind a toggle.
class RichSearchPanel {
  constructor(view) {
    this.view = view;
    this.query = getSearchQuery(view.state);
    const readOnly = view.state.readOnly;

    this.searchField = createField("search", "Find", this.query.search);
    // CodeMirror focuses and selects the field marked as the main one.
    this.searchField.setAttribute("main-field", "true");
    this.replaceField = createField("replace", "Replace", this.query.replace);
    this.caseToggle = createToggle("case", "Aa", "Match Case", this.query.caseSensitive);
    this.wordToggle = createToggle("word", "ab", "Match Whole Word", this.query.wholeWord);
    this.regexpToggle = createToggle("re", ".*", "Use Regular Expression", this.query.regexp);
    this.count = document.createElement("span");
    this.count.className = "cm-richdown-search-count";
    this.count.setAttribute("aria-live", "polite");

    this.replaceToggle = createButton("toggle-replace", "›", "Toggle Replace", () =>
      this.setReplaceOpen(!this.replaceOpen),
    );
    const findRow = createRow("cm-richdown-search-find-row", [
      wrapField(this.searchField, [this.caseToggle, this.wordToggle, this.regexpToggle]),
      this.count,
      createButton("prev", "↑", "Previous Match (Shift+Enter)", () => findPrevious(view)),
      createButton("next", "↓", "Next Match (Enter)", () => findNext(view)),
      createButton("close", "×", "Close (Escape)", () => closeSearchPanel(view)),
    ]);
    this.replaceRow = createRow("cm-richdown-search-replace-row", [
      wrapField(this.replaceField, []),
      createButton("replace", "Replace", "Replace (Enter)", () => replaceNext(view)),
      createButton("replaceAll", "All", "Replace All", () => replaceAll(view)),
    ]);

    this.dom = document.createElement("div");
    this.dom.className = "cm-search cm-richdown-search";
    this.dom.append(
      ...(readOnly ? [] : [this.replaceToggle]),
      createRow("cm-richdown-search-rows", readOnly ? [findRow] : [findRow, this.replaceRow]),
    );
    this.dom.addEventListener("keydown", (event) => this.keydown(event));
    for (const field of [this.searchField, this.replaceField]) {
      field.addEventListener("input", () => this.commit());
    }
    for (const toggle of [this.caseToggle, this.wordToggle, this.regexpToggle]) {
      toggle.addEventListener("click", () => {
        toggle.setAttribute("aria-pressed", String(toggle.getAttribute("aria-pressed") !== "true"));
        this.commit();
      });
    }
    this.setReplaceOpen(Boolean(this.query.replace));
    this.updateCount();
  }

  get top() {
    return true;
  }

  mount() {
    this.searchField.select();
  }

  setReplaceOpen(open) {
    this.replaceOpen = open;
    this.dom.classList.toggle("is-replace-open", open);
    this.replaceToggle.setAttribute("aria-expanded", String(open));
  }

  commit() {
    const query = new SearchQuery({
      search: this.searchField.value,
      replace: this.replaceField.value,
      caseSensitive: isPressed(this.caseToggle),
      wholeWord: isPressed(this.wordToggle),
      regexp: isPressed(this.regexpToggle),
    });
    if (!query.eq(this.query)) {
      this.query = query;
      this.view.dispatch({ effects: setSearchQuery.of(query) });
    }
  }

  keydown(event) {
    if (runScopeHandlers(this.view, event, "search-panel")) {
      event.preventDefault();
      return;
    }
    if (event.key !== "Enter" || event.isComposing) {
      return;
    }
    if (event.target === this.searchField) {
      event.preventDefault();
      if (event.altKey) {
        selectMatches(this.view);
        this.view.focus();
      } else {
        (event.shiftKey ? findPrevious : findNext)(this.view);
      }
    } else if (event.target === this.replaceField) {
      event.preventDefault();
      (event.metaKey || event.ctrlKey ? replaceAll : replaceNext)(this.view);
    }
  }

  update(update) {
    for (const transaction of update.transactions) {
      for (const effect of transaction.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.setQuery(effect.value);
        }
      }
    }
    if (
      update.docChanged ||
      update.selectionSet ||
      update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(setSearchQuery)),
      )
    ) {
      this.updateCount();
    }
  }

  setQuery(query) {
    this.query = query;
    this.searchField.value = query.search;
    this.replaceField.value = query.replace;
    this.caseToggle.setAttribute("aria-pressed", String(query.caseSensitive));
    this.wordToggle.setAttribute("aria-pressed", String(query.wholeWord));
    this.regexpToggle.setAttribute("aria-pressed", String(query.regexp));
  }

  // "3 of 12": which match the selection is on, VS Code style.
  updateCount() {
    const { query, view } = this;
    this.dom.classList.toggle("has-no-results", false);
    if (!query.search) {
      this.count.textContent = "";
      return;
    }
    if (!query.valid) {
      this.count.textContent = "Invalid";
      this.dom.classList.toggle("has-no-results", true);
      return;
    }
    const selection = view.state.selection.main;
    let total = 0;
    let current = 0;
    const cursor = query.getCursor(view.state);
    for (let result = cursor.next(); !result.done; result = cursor.next()) {
      total += 1;
      if (result.value.from === selection.from && result.value.to === selection.to) {
        current = total;
      }
      if (total > maxCountedMatches) {
        break;
      }
    }
    const totalText = total > maxCountedMatches ? `${maxCountedMatches}+` : String(total);
    this.count.textContent =
      total === 0 ? "No results" : `${current || "?"} of ${totalText}`;
    this.dom.classList.toggle("has-no-results", total === 0);
  }
}

function createField(name, label, value) {
  const field = document.createElement("input");
  field.className = "cm-textfield";
  field.name = name;
  field.value = value;
  field.placeholder = label;
  field.setAttribute("aria-label", label);
  field.setAttribute("form", "");
  field.spellcheck = false;
  return field;
}

// A field with its option toggles drawn inside its right edge.
function wrapField(field, toggles) {
  const wrapper = document.createElement("div");
  wrapper.className = "cm-richdown-search-field";
  wrapper.append(field);
  if (toggles.length) {
    wrapper.append(createRow("cm-richdown-search-toggles", toggles));
  }
  return wrapper;
}

function createToggle(name, text, label, pressed) {
  const toggle = createButton(name, text, label);
  toggle.classList.add("cm-richdown-search-toggle");
  toggle.setAttribute("aria-pressed", String(pressed));
  return toggle;
}

function createButton(name, text, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.name = name;
  button.textContent = text;
  button.title = label;
  button.setAttribute("aria-label", label);
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}

function createRow(className, children) {
  const row = document.createElement("div");
  row.className = className;
  row.append(...children);
  return row;
}

function isPressed(toggle) {
  return toggle.getAttribute("aria-pressed") === "true";
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
      // The Mermaid editor modal covers the document; searching it would open
      // a panel behind the modal.
      if (
        !view ||
        !isSearchShortcut(event) ||
        event.target?.closest?.(".cm-mermaid-editor-backdrop")
      ) {
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
