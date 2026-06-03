// CodeMirror preview orchestration for Richdown.
//
// The factory below wires together state fields, effects, and replacement
// widgets for block-level previews. Smaller decoration-only concerns live in
// syntaxPreviewDecorations.js; larger DOM widgets live in their own folders.
import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import {
  findDetailsBlocks,
  findMermaidBlocks,
  findTableBlocks,
  isEditingDetailsBlock,
  isEditingMermaidBlock,
  isEditingTableBlock,
  rangeIntersectsRanges,
  selectionInsideRange,
} from "../../domain/markdownBlocks.js";
import { createDetailsPreviewWidgetClass } from "../details/detailsPreview.js";
import { createMermaidPreviewWidgetClass } from "../mermaid/mermaidPreview.js";
import { createSyntaxPreviewDecorations } from "./syntaxPreviewDecorations.js";
import { createTablePreviewWidgetClass } from "../table/tablePreview.js";

export function createPreviewExtensions({
  appendInlineMarkdown,
  findMarkdownImages,
  ImagePreviewWidget,
  isRangeInsideRanges,
  mermaidScriptUri,
  postMessage,
  reportError,
  requestEditorMeasure,
  getSettings,
}) {
  let previewDecorationRevision = 0;

  function safeBuildDecorations(context, build) {
    try {
      return build();
    } catch (error) {
      reportError(context, error);
      return Decoration.none;
    }
  }
  
  function safeBuildDetailsDecorationState(state, openStates, activeEdit) {
    try {
      return buildDetailsDecorationState(state, openStates, activeEdit);
    } catch (error) {
      reportError("details-preview", error);
      return {
        activeEdit: null,
        openStates,
        decorations: Decoration.none,
      };
    }
  }
  
  function safeBuildTableDecorationState(state, activeEdit) {
    try {
      return buildTableDecorationState(state, activeEdit);
    } catch (error) {
      reportError("table-preview", error);
      return {
        activeEdit: null,
        decorations: Decoration.none,
      };
    }
  }
  
  function safeBuildMermaidDecorationState(state, activeEdit) {
    try {
      return buildMermaidDecorationState(state, activeEdit);
    } catch (error) {
      reportError("mermaid-preview", error);
      return {
        activeEdit: null,
        decorations: Decoration.none,
      };
    }
  }
  
  const toggleDetailsPreview = StateEffect.define();
  const refreshPreviewDecorations = StateEffect.define();

  const {
    blockLineDecorations,
    codeBlockCopyButtons,
    inlineDecorations,
    taskCheckboxes,
  } = createSyntaxPreviewDecorations({
    safeBuildDecorations,
    getPreviewedDetailsRanges,
    isLineFocused,
    findMarkdownImages,
    ImagePreviewWidget,
    isRangeInsideRanges,
    postMessage,
  });
  
  const setActiveDetailsEdit = StateEffect.define({
    map(value, changes) {
      if (!value) {
        return null;
      }
      return {
        from: changes.mapPos(value.from),
        to: changes.mapPos(value.to),
      };
    },
  });

  const DetailsPreviewWidget = createDetailsPreviewWidgetClass({
    appendInlineMarkdown,
    requestEditorMeasure,
    setActiveDetailsEdit,
    toggleDetailsPreview,
  });
  
  const detailsDecorationField = StateField.define({
    create(state) {
      return safeBuildDetailsDecorationState(state, new Map(), null);
    },
  
    update(value, transaction) {
      let openStates = value.openStates;
      let activeEdit = value.activeEdit;
      let shouldRebuild = transaction.docChanged || transaction.selection;
  
      if (activeEdit && transaction.docChanged) {
        activeEdit = {
          from: transaction.changes.mapPos(activeEdit.from),
          to: transaction.changes.mapPos(activeEdit.to),
        };
        shouldRebuild = true;
      }
  
      for (const effect of transaction.effects) {
        if (effect.is(toggleDetailsPreview)) {
          openStates = new Map(openStates);
          openStates.set(effect.value.key, effect.value.open);
          shouldRebuild = true;
        }
        if (effect.is(setActiveDetailsEdit)) {
          activeEdit = effect.value;
          shouldRebuild = true;
        }
      }
  
      if (
        activeEdit &&
        !selectionInsideRange(
          transaction.state.selection,
          activeEdit.from,
          activeEdit.to,
        )
      ) {
        activeEdit = null;
        shouldRebuild = true;
      }
  
      if (!shouldRebuild) {
        return value;
      }
  
      return safeBuildDetailsDecorationState(
        transaction.state,
        openStates,
        activeEdit,
      );
    },
  
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });
  
  const setActiveTableEdit = StateEffect.define({
    map(value, changes) {
      if (!value) {
        return null;
      }
      return {
        from: changes.mapPos(value.from),
        to: changes.mapPos(value.to),
      };
    },
  });
  
  const TablePreviewWidget = createTablePreviewWidgetClass({
    setActiveTableEdit,
    requestEditorMeasure,
    appendInlineMarkdown,
  });
  
  const tableDecorationField = StateField.define({
    create(state) {
      return safeBuildTableDecorationState(state, null);
    },
  
    update(value, transaction) {
      let activeEdit = value.activeEdit;
      let editChanged = false;
  
      if (activeEdit && transaction.docChanged) {
        activeEdit = {
          from: transaction.changes.mapPos(activeEdit.from),
          to: transaction.changes.mapPos(activeEdit.to),
        };
        editChanged = true;
      }
  
      // Active edit ranges are tracked as CodeMirror state instead of DOM state
      // so cursor movement and document changes can consistently switch between
      // source text and rich table preview.
      for (const effect of transaction.effects) {
        if (effect.is(setActiveTableEdit)) {
          activeEdit = effect.value;
          editChanged = true;
        }
        if (effect.is(refreshPreviewDecorations)) {
          editChanged = true;
        }
      }
  
      if (
        activeEdit &&
        !selectionInsideRange(
          transaction.state.selection,
          activeEdit.from,
          activeEdit.to,
        )
      ) {
        activeEdit = null;
        editChanged = true;
      }
  
      if (!transaction.docChanged && !transaction.selection && !editChanged) {
        return value;
      }
  
      return safeBuildTableDecorationState(transaction.state, activeEdit);
    },
  
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });
  
  const setActiveMermaidEdit = StateEffect.define({
    map(value, changes) {
      if (!value) {
        return null;
      }
      return {
        from: changes.mapPos(value.from),
        to: changes.mapPos(value.to),
      };
    },
  });
  
  const MermaidPreviewWidget = createMermaidPreviewWidgetClass({
    mermaidScriptUri,
    setActiveMermaidEdit,
  });
  
  const mermaidDecorationField = StateField.define({
    create(state) {
      return safeBuildMermaidDecorationState(state, null);
    },
  
    update(value, transaction) {
      let activeEdit = value.activeEdit;
      let editChanged = false;
  
      if (activeEdit && transaction.docChanged) {
        activeEdit = {
          from: transaction.changes.mapPos(activeEdit.from),
          to: transaction.changes.mapPos(activeEdit.to),
        };
        editChanged = true;
      }
  
      for (const effect of transaction.effects) {
        if (effect.is(setActiveMermaidEdit)) {
          activeEdit = effect.value;
          editChanged = true;
        }
        if (effect.is(refreshPreviewDecorations)) {
          editChanged = true;
        }
      }
  
      if (
        activeEdit &&
        !selectionInsideRange(
          transaction.state.selection,
          activeEdit.from,
          activeEdit.to,
        )
      ) {
        activeEdit = null;
        editChanged = true;
      }
  
      if (!transaction.docChanged && !transaction.selection && !editChanged) {
        return value;
      }
  
      return safeBuildMermaidDecorationState(transaction.state, activeEdit);
    },
  
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });
  
  function exitDetailsEditMode(view, force = false) {
    if (!view) return;
    const activeEdit = view.state.field(detailsDecorationField).activeEdit;
    if (!force && !activeEdit) return;
    view.dispatch({
      effects: setActiveDetailsEdit.of(null),
    });
  }
  
  function exitTableEditMode(view, force = false) {
    if (!view) return;
    const activeEdit = view.state.field(tableDecorationField).activeEdit;
    if (!force && !activeEdit) return;
    view.dispatch({
      effects: setActiveTableEdit.of(null),
    });
  }
  
  function exitMermaidEditMode(view, force = false) {
    if (!view) return;
    const activeEdit = view.state.field(mermaidDecorationField).activeEdit;
    if (!force && !activeEdit) return;
    view.dispatch({
      effects: setActiveMermaidEdit.of(null),
    });
  }
  
  function getPreviewedDetailsRanges(state) {
    const activeEdit = getActiveDetailsEdit(state);
    return findDetailsBlocks(state.doc)
      .filter((block) => !activeEdit || activeEdit.from !== block.from)
      .map((block) => ({ from: block.from, to: block.to }));
  }
  
  function getActiveDetailsEdit(state) {
    try {
      return state.field(detailsDecorationField).activeEdit;
    } catch (error) {
      return null;
    }
  }
  
  function buildDetailsDecorationState(state, openStates, activeEdit) {
    const builder = new RangeSetBuilder();
    const detailsBlocks = findDetailsBlocks(state.doc);
  
    for (const detailsBlock of detailsBlocks) {
      if (isEditingDetailsBlock(detailsBlock, activeEdit, state.selection)) {
        continue;
      }
  
      // Persist user toggles by a content-derived key. If the source changes,
      // the key changes too and the preview naturally falls back to source state.
      const open = openStates.has(detailsBlock.key)
        ? openStates.get(detailsBlock.key)
        : detailsBlock.openByDefault;
      builder.add(
        detailsBlock.from,
        detailsBlock.to,
        Decoration.replace({
          block: true,
          widget: new DetailsPreviewWidget(detailsBlock, open),
        }),
      );
    }
  
    return {
      activeEdit,
      openStates,
      decorations: builder.finish(),
    };
  }
  
  function buildTableDecorationState(state, activeEdit) {
    const builder = new RangeSetBuilder();
    const tableBlocks = findTableBlocks(state.doc);
    const previewedDetailsRanges = getPreviewedDetailsRanges(state);
    // When rich table preview is disabled, keep the lightweight line styling so
    // Markdown tables still look structured without replacing the source.
    let nextActiveEdit = getSettings().richTablePreview ? activeEdit : null;
  
    for (const tableBlock of tableBlocks) {
      if (
        rangeIntersectsRanges(
          tableBlock.from,
          tableBlock.sourceTo,
          previewedDetailsRanges,
        )
      ) {
        continue;
      }
  
      if (!getSettings().richTablePreview) {
        for (const row of tableBlock.sourceRows) {
          builder.add(
            row.line.from,
            row.line.from,
            Decoration.line({ class: `cm-table-line cm-table-${row.role}-line` }),
          );
          addTableLineMarks(builder, row.line, row.role);
        }
      } else if (
        isEditingTableBlock(tableBlock, nextActiveEdit, state.selection)
      ) {
        nextActiveEdit = {
          from: tableBlock.from,
          to: tableBlock.sourceTo,
        };
        for (const row of tableBlock.sourceRows) {
          builder.add(
            row.line.from,
            row.line.from,
            Decoration.line({ class: `cm-table-line cm-table-${row.role}-line` }),
          );
          addTableLineMarks(builder, row.line, row.role);
        }
      } else {
        builder.add(
          tableBlock.from,
          tableBlock.to,
          Decoration.replace({
            block: true,
            widget: new TablePreviewWidget(tableBlock),
          }),
        );
      }
    }
  
    if (
      nextActiveEdit &&
      !tableBlocks.some((tableBlock) => tableBlock.from === nextActiveEdit.from)
    ) {
      nextActiveEdit = null;
    }
  
    return {
      activeEdit: nextActiveEdit,
      decorations: builder.finish(),
    };
  }
  
  function buildMermaidDecorationState(state, activeEdit) {
    const builder = new RangeSetBuilder();
    if (!getSettings().mermaidPreview) {
      return {
        activeEdit: null,
        decorations: builder.finish(),
      };
    }
  
    const mermaidBlocks = findMermaidBlocks(state.doc);
    const previewedDetailsRanges = getPreviewedDetailsRanges(state);
    let nextActiveEdit = activeEdit;
  
    for (const mermaidBlock of mermaidBlocks) {
      if (
        rangeIntersectsRanges(
          mermaidBlock.from,
          mermaidBlock.sourceTo,
          previewedDetailsRanges,
        )
      ) {
        continue;
      }
  
      if (isEditingMermaidBlock(mermaidBlock, nextActiveEdit, state.selection)) {
        nextActiveEdit = {
          from: mermaidBlock.from,
          to: mermaidBlock.sourceTo,
        };
        continue;
      }
  
      builder.add(
        mermaidBlock.from,
        mermaidBlock.to,
        Decoration.replace({
          block: true,
          widget: new MermaidPreviewWidget(
            mermaidBlock,
            getSettings().mermaidPreviewSize,
            previewDecorationRevision,
          ),
        }),
      );
    }
  
    if (
      nextActiveEdit &&
      !mermaidBlocks.some(
        (mermaidBlock) => mermaidBlock.from === nextActiveEdit.from,
      )
    ) {
      nextActiveEdit = null;
    }
  
    return {
      activeEdit: nextActiveEdit,
      decorations: builder.finish(),
    };
  }
  
  function addTableLineMarks(builder, line, tableRole) {
    const cellClass =
      tableRole === "header"
        ? "cm-table-header-cell"
        : tableRole === "delimiter"
          ? "cm-table-delimiter-text"
          : "cm-table-cell";
  
    let segmentStart = 0;
    for (let index = 0; index < line.text.length; index += 1) {
      if (line.text[index] !== "|") {
        continue;
      }
  
      if (segmentStart < index) {
        builder.add(
          line.from + segmentStart,
          line.from + index,
          Decoration.mark({ class: cellClass }),
        );
      }
      builder.add(
        line.from + index,
        line.from + index + 1,
        Decoration.mark({ class: "cm-table-pipe" }),
      );
      segmentStart = index + 1;
    }
  
    if (segmentStart < line.text.length) {
      builder.add(
        line.from + segmentStart,
        line.to,
        Decoration.mark({ class: cellClass }),
      );
    }
  }
  
  function isLineFocused(state, line) {
    // In read-only (viewer) mode no line is ever "focused", so all Markdown
    // syntax stays concealed and the document reads as rendered output.
    if (state.readOnly) {
      return false;
    }
    return state.selection.ranges.some(
      (range) => range.from <= line.to && range.to >= line.from,
    );
  }

  function refresh(view) {
    if (!view) return;
    // Some previews depend on settings rather than source text. Bumping this
    // revision forces existing widgets, especially Mermaid, to redraw.
    previewDecorationRevision += 1;
    view.dispatch({
      effects: [
        refreshPreviewDecorations.of(null),
        setActiveTableEdit.of(null),
        setActiveMermaidEdit.of(null),
      ],
    });
    requestEditorMeasure(view);
  }

  return {
    extensions: [
      detailsDecorationField,
      tableDecorationField,
      mermaidDecorationField,
      blockLineDecorations,
      codeBlockCopyButtons,
      inlineDecorations,
      taskCheckboxes,
    ],
    refresh,
    exitDetailsEditMode,
    exitTableEditMode,
    exitMermaidEditMode,
    isLineFocused,
  };
}
