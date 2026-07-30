import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { GutterMarker, gutter } from "@codemirror/view";

const gitChangeTypes = new Set(["added", "modified", "deleted"]);
const gitChangeOrder = ["deleted", "modified", "added"];

export function createGitDiffGutter(initialChanges = []) {
  const setGitDiffChanges = StateEffect.define();

  const gitDiffField = StateField.define({
    create(state) {
      return buildGitDiffState(state, initialChanges);
    },

    update(value, transaction) {
      let changes = value.changes;
      let shouldRebuild = transaction.docChanged;

      for (const effect of transaction.effects) {
        if (effect.is(setGitDiffChanges)) {
          changes = effect.value;
          shouldRebuild = true;
        }
      }

      return shouldRebuild
        ? buildGitDiffState(transaction.state, changes)
        : value;
    },

    provide: (field) =>
      gutter({
        class: "cm-git-diff-gutter",
        renderEmptyElements: true,
        markers: (view) => view.state.field(field).markers,
        // A preview widget (rich table, Mermaid diagram, Gherkin board, details
        // block, front matter card) replaces whole lines with a single block, and
        // CodeMirror asks for that block's marker here instead of reading the
        // line markers above. Without this, a change inside a previewed block
        // would leave no gutter mark at all.
        widgetMarker: (view, _widget, block) =>
          buildBlockMarker(view.state, view.state.field(field).changes, block),
        // Widget markers are not part of the marker RangeSet the gutter diffs,
        // so tell it explicitly when a new change set arrives.
        lineMarkerChange: (update) =>
          update.transactions.some((transaction) =>
            transaction.effects.some((effect) => effect.is(setGitDiffChanges)),
          ),
      }),
  });

  function update(view, changes) {
    if (!view) return;
    view.dispatch({
      effects: setGitDiffChanges.of(normalizeGitChanges(changes)),
    });
  }

  return {
    extension: gitDiffField,
    update,
  };
}

class GitDiffMarker extends GutterMarker {
  constructor(types) {
    super();
    this.types = types;
  }

  eq(other) {
    return this.types.join(",") === other.types.join(",");
  }

  get elementClass() {
    return this.types.map((type) => `cm-git-diff-line-${type}`).join(" ");
  }
}

// Collects every change that falls inside a block widget so the collapsed block
// carries one mark for the lines it hides.
function buildBlockMarker(state, changes, block) {
  const lineCount = Math.max(state.doc.lines, 1);
  const types = new Set();

  for (const change of changes) {
    const line = state.doc.line(clampLineNumber(change.line, lineCount));
    if (line.from >= block.from && line.from <= block.to) {
      types.add(change.type);
    }
  }

  return types.size > 0 ? new GitDiffMarker(sortChangeTypes(types)) : null;
}

function buildGitDiffState(state, changes) {
  const normalizedChanges = normalizeGitChanges(changes);
  const changesByLine = new Map();
  const lineCount = Math.max(state.doc.lines, 1);

  for (const change of normalizedChanges) {
    const lineNumber = clampLineNumber(change.line, lineCount);
    const types = changesByLine.get(lineNumber) || new Set();
    types.add(change.type);
    changesByLine.set(lineNumber, types);
  }

  const builder = new RangeSetBuilder();
  for (const [lineNumber, types] of [...changesByLine.entries()].sort(
    (left, right) => left[0] - right[0],
  )) {
    const line = state.doc.line(lineNumber);
    builder.add(line.from, line.from, new GitDiffMarker(sortChangeTypes(types)));
  }

  return {
    changes: normalizedChanges,
    markers: builder.finish(),
  };
}

function normalizeGitChanges(changes) {
  if (!Array.isArray(changes)) {
    return [];
  }
  return changes
    .map((change) => ({
      line: Number(change?.line),
      type: String(change?.type || ""),
    }))
    .filter(
      (change) =>
        Number.isInteger(change.line) &&
        change.line >= 1 &&
        gitChangeTypes.has(change.type),
    );
}

function clampLineNumber(lineNumber, lineCount) {
  return Math.min(Math.max(lineNumber, 1), lineCount);
}

function sortChangeTypes(types) {
  return [...types].sort(
    (left, right) => gitChangeOrder.indexOf(left) - gitChangeOrder.indexOf(right),
  );
}
