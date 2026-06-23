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

function buildGitDiffState(state, changes) {
  const normalizedChanges = normalizeGitChanges(changes);
  const changesByLine = new Map();
  const lineCount = Math.max(state.doc.lines, 1);

  for (const change of normalizedChanges) {
    const lineNumber = Math.min(Math.max(change.line, 1), lineCount);
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

function sortChangeTypes(types) {
  return [...types].sort(
    (left, right) => gitChangeOrder.indexOf(left) - gitChangeOrder.indexOf(right),
  );
}
