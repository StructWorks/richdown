// Draws the extension host's lint results (src/host/markdownLinter.js) in the
// rich editor: a wavy underline under the reported text, or a tinted line when
// the problem has no text of its own (an extra blank line, a missing blank
// line), with the messages in a hover tooltip. An overview ruler at the right
// edge shows where the problems are in the whole document, and F8 / Shift+F8
// move to the next or previous one (see lintOverviewRuler.js).
//
// The host lints a little after each edit. Until the next results arrive, the
// marks are mapped through the edits so they stay on the text they describe.
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, hoverTooltip, keymap } from "@codemirror/view";
import {
  createLintOverviewRuler,
  createProblemNavigation,
} from "./lintOverviewRuler.js";

const severities = new Set(["error", "warning", "info", "hint"]);

export function createLintDecorations(initialDiagnostics = []) {
  const setLintDiagnostics = StateEffect.define();

  const lintField = StateField.define({
    create(state) {
      return buildLintDecorations(state, initialDiagnostics);
    },

    update(decorations, transaction) {
      for (const effect of transaction.effects) {
        if (effect.is(setLintDiagnostics)) {
          return buildLintDecorations(transaction.state, effect.value);
        }
      }
      return transaction.docChanged ? decorations.map(transaction.changes) : decorations;
    },

    provide: (field) => EditorView.decorations.from(field),
  });

  const lintTooltip = hoverTooltip((view, pos) => {
    const found = findDiagnosticsAt(view.state, view.state.field(lintField), pos);
    if (found.diagnostics.length === 0) {
      return null;
    }
    return {
      pos: found.from,
      end: found.to,
      above: true,
      create: () => ({ dom: renderTooltip(found.diagnostics) }),
    };
  });

  function update(view, diagnostics) {
    if (!view) return;
    view.dispatch({ effects: setLintDiagnostics.of(diagnostics) });
  }

  const getDecorations = (state) => state.field(lintField);

  return {
    extension: [
      lintField,
      lintTooltip,
      createLintOverviewRuler(getDecorations),
      keymap.of(createProblemNavigation(getDecorations)),
    ],
    update,
  };
}

export function buildLintDecorations(state, diagnostics) {
  const doc = state.doc;
  const ranges = [];
  for (const diagnostic of normalizeDiagnostics(diagnostics)) {
    const line = doc.line(Math.min(diagnostic.line + 1, doc.lines));
    const from = line.from + Math.min(diagnostic.from, line.length);
    const to = line.from + Math.min(diagnostic.to, line.length);
    if (to > from) {
      ranges.push(
        Decoration.mark({
          class: `cm-richdown-lint cm-richdown-lint-${diagnostic.severity}`,
          diagnostic,
        }).range(from, to),
      );
    } else {
      ranges.push(
        Decoration.line({
          class: `cm-richdown-lint-line cm-richdown-lint-line-${diagnostic.severity}`,
          diagnostic,
        }).range(line.from),
      );
    }
  }
  return Decoration.set(ranges, true);
}

// Diagnostics under `pos`: marks that cover it and line marks on its line.
export function findDiagnosticsAt(state, decorations, pos) {
  const line = state.doc.lineAt(pos);
  const diagnostics = [];
  let from = pos;
  let to = pos;
  decorations.between(line.from, line.to, (rangeFrom, rangeTo, decoration) => {
    const diagnostic = decoration.spec.diagnostic;
    if (!diagnostic) {
      return;
    }
    const isLineMark = rangeFrom === rangeTo;
    if (!isLineMark && (pos < rangeFrom || pos > rangeTo)) {
      return;
    }
    diagnostics.push(diagnostic);
    from = Math.min(from, isLineMark ? line.from : rangeFrom);
    to = Math.max(to, isLineMark ? line.to : rangeTo);
  });
  return { diagnostics, from, to };
}

function normalizeDiagnostics(diagnostics) {
  if (!Array.isArray(diagnostics)) {
    return [];
  }
  return diagnostics
    .map((diagnostic) => ({
      line: Number(diagnostic?.line),
      from: Math.max(0, Number(diagnostic?.from) || 0),
      to: Math.max(0, Number(diagnostic?.to) || 0),
      severity: severities.has(diagnostic?.severity) ? diagnostic.severity : "warning",
      message: String(diagnostic?.message || ""),
      rule: String(diagnostic?.rule || ""),
    }))
    .filter((diagnostic) => Number.isInteger(diagnostic.line) && diagnostic.line >= 0);
}

function renderTooltip(diagnostics) {
  const dom = document.createElement("div");
  dom.className = "cm-richdown-lint-tooltip";
  for (const diagnostic of diagnostics) {
    const item = document.createElement("div");
    item.className = `cm-richdown-lint-message cm-richdown-lint-message-${diagnostic.severity}`;
    const message = document.createElement("span");
    message.textContent = diagnostic.message;
    item.append(message);
    if (diagnostic.rule) {
      const rule = document.createElement("span");
      rule.className = "cm-richdown-lint-rule";
      rule.textContent = diagnostic.rule;
      item.append(rule);
    }
    dom.append(item);
  }
  return dom;
}
