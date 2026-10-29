// CodeMirror preview orchestration for Richdown.
//
// The factory below wires together state fields, effects, and replacement
// widgets for block-level previews. Smaller decoration-only concerns live in
// syntaxPreviewDecorations.js; larger DOM widgets live in their own folders.
import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import {
  findCalloutBlocks,
  findDetailsBlocks,
  findFrontmatterBlock,
  findGherkinBlocks,
  findMermaidBlocks,
  findTableBlocks,
  isEditingDetailsBlock,
  isEditingGherkinBlock,
  isEditingMermaidBlock,
  isEditingTableBlock,
  rangeIntersectsRanges,
  selectionInsideRange,
} from "../../domain/markdownBlocks.js";
import { createCalloutPreviewWidgetClass } from "../callout/calloutPreview.js";
import { createDetailsPreviewWidgetClass } from "../details/detailsPreview.js";
import { createFrontmatterPreviewWidgetClass } from "../frontmatter/frontmatterPreview.js";
import { createGherkinPreviewWidgetClass } from "../gherkin/gherkinPreview.js";
import { readMermaidBlockContent } from "../../domain/mermaidSource.js";
import { openMermaidEditorModal } from "../mermaid/mermaidEditorModal.js";
import { createMermaidLiveEditorWidgetClass } from "../mermaid/mermaidLiveEditor.js";
import { createMermaidPreviewWidgetClass } from "../mermaid/mermaidPreview.js";
import { createMermaidRenderer } from "../mermaid/mermaidRenderer.js";
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
  wikilinkClassName,
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
  
  function safeBuildMermaidDecorationState(state, activeEdit, diagnostic) {
    try {
      return buildMermaidDecorationState(state, activeEdit, diagnostic);
    } catch (error) {
      reportError("mermaid-preview", error);
      return {
        activeEdit: null,
        diagnostic: null,
        decorations: Decoration.none,
      };
    }
  }

  function safeBuildGherkinDecorationState(state, activeEdit, modes) {
    try {
      return buildGherkinDecorationState(state, activeEdit, modes);
    } catch (error) {
      reportError("gherkin-preview", error);
      return {
        activeEdit: null,
        modes,
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
    getPreviewedBlockRanges,
    isLineFocused,
    findMarkdownImages,
    ImagePreviewWidget,
    isRangeInsideRanges,
    postMessage,
    refreshPreviewDecorations,
    wikilinkClassName,
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
  
  // Folded state of foldable callouts, by callout source. Folding is a view
  // state only, so it lives outside the document and the editor state.
  const calloutFoldStates = new Map();
  const CalloutPreviewWidget = createCalloutPreviewWidgetClass({
    appendInlineMarkdown,
    requestEditorMeasure,
    foldStates: calloutFoldStates,
  });

  const calloutDecorationField = StateField.define({
    create(state) {
      return safeBuildDecorations("callout-preview", () => buildCalloutDecorations(state));
    },

    update(value, transaction) {
      if (
        !transaction.docChanged &&
        !transaction.selection &&
        !transaction.effects.some(
          (effect) => effect.is(toggleDetailsPreview) || effect.is(setActiveDetailsEdit),
        )
      ) {
        return value;
      }
      return safeBuildDecorations("callout-preview", () =>
        buildCalloutDecorations(transaction.state),
      );
    },

    provide: (field) => EditorView.decorations.from(field),
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
  
  // Parse error reported by the live editor for the diagram being edited:
  // { from: block start, lineIndex: 0-based diagram line } or null.
  const setMermaidDiagnostic = StateEffect.define({
    map(value, changes) {
      return value ? { ...value, from: changes.mapPos(value.from) } : null;
    },
  });

  const mermaidRenderer = createMermaidRenderer({ mermaidScriptUri });

  // Leaving edit mode turns the source back into a preview widget. A caret
  // left inside it would keep typing into the hidden diagram text, so it moves
  // to the line after the block (or before it, or onto a new last line).
  function moveCaretOutOfMermaidBlock(view, blockFrom) {
    const block = findMermaidBlocks(view.state.doc).find((candidate) => candidate.from === blockFrom);
    const effects = setActiveMermaidEdit.of(null);
    if (!block) {
      view.dispatch({ effects });
      return;
    }
    const { doc } = view.state;
    if (block.sourceTo < doc.length) {
      view.dispatch({ selection: { anchor: block.sourceTo + 1 }, effects });
    } else if (block.from > 0) {
      view.dispatch({ selection: { anchor: block.from - 1 }, effects });
    } else {
      view.dispatch({
        changes: { from: doc.length, insert: "\n" },
        selection: { anchor: doc.length + 1 },
        effects,
      });
    }
  }

  function openMermaidEditor(view, blockFrom) {
    moveCaretOutOfMermaidBlock(view, blockFrom);
    openMermaidEditorModal({
      view,
      blockFrom,
      renderer: mermaidRenderer,
      colorized: getSettings().mermaidColorized,
    });
  }

  const MermaidPreviewWidget = createMermaidPreviewWidgetClass({
    renderer: mermaidRenderer,
    setActiveMermaidEdit,
    openMermaidEditor,
  });

  const MermaidLiveEditorWidget = createMermaidLiveEditorWidgetClass({
    renderer: mermaidRenderer,
    setMermaidDiagnostic,
    exitMermaidEdit: (view, blockFrom) => {
      moveCaretOutOfMermaidBlock(view, blockFrom);
      view.focus();
    },
    openMermaidEditor,
    requestEditorMeasure,
  });
  
  const mermaidDecorationField = StateField.define({
    create(state) {
      return safeBuildMermaidDecorationState(state, null, null);
    },
  
    update(value, transaction) {
      let activeEdit = value.activeEdit;
      let diagnostic = value.diagnostic;
      let editChanged = false;
  
      if (activeEdit && transaction.docChanged) {
        activeEdit = {
          from: transaction.changes.mapPos(activeEdit.from),
          to: transaction.changes.mapPos(activeEdit.to),
        };
        editChanged = true;
      }
      if (diagnostic && transaction.docChanged) {
        diagnostic = { ...diagnostic, from: transaction.changes.mapPos(diagnostic.from) };
      }
  
      for (const effect of transaction.effects) {
        if (effect.is(setActiveMermaidEdit)) {
          activeEdit = effect.value;
          editChanged = true;
        }
        if (effect.is(setMermaidDiagnostic)) {
          diagnostic = effect.value;
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
  
      return safeBuildMermaidDecorationState(
        transaction.state,
        activeEdit,
        diagnostic,
      );
    },
  
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });

  const setActiveGherkinEdit = StateEffect.define({
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

  const setGherkinPreviewMode = StateEffect.define();

  const GherkinPreviewWidget = createGherkinPreviewWidgetClass({
    setActiveGherkinEdit,
    setGherkinPreviewMode,
    requestEditorMeasure,
  });

  const gherkinDecorationField = StateField.define({
    create(state) {
      return safeBuildGherkinDecorationState(state, null, new Map());
    },

    update(value, transaction) {
      let modes = value.modes;
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
        if (effect.is(setActiveGherkinEdit)) {
          activeEdit = effect.value;
          shouldRebuild = true;
        }
        if (effect.is(setGherkinPreviewMode)) {
          modes = new Map(modes);
          modes.set(effect.value.key, effect.value.mode);
          shouldRebuild = true;
        }
        if (effect.is(refreshPreviewDecorations)) {
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

      return safeBuildGherkinDecorationState(
        transaction.state,
        activeEdit,
        modes,
      );
    },

    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });
  
  const setActiveFrontmatterEdit = StateEffect.define({
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

  const FrontmatterPreviewWidget = createFrontmatterPreviewWidgetClass({
    requestEditorMeasure,
    setActiveFrontmatterEdit,
  });

  function safeBuildFrontmatterDecorationState(state, activeEdit) {
    try {
      return buildFrontmatterDecorationState(state, activeEdit);
    } catch (error) {
      reportError("frontmatter-preview", error);
      return {
        activeEdit: null,
        decorations: Decoration.none,
      };
    }
  }

  // Front matter follows the Mermaid pattern: the metadata card is shown until
  // a click on it explicitly activates source editing. Selection alone must not
  // switch modes because the initial caret sits at position 0, inside the block.
  const frontmatterDecorationField = StateField.define({
    create(state) {
      return safeBuildFrontmatterDecorationState(state, null);
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
        if (effect.is(setActiveFrontmatterEdit)) {
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

      return safeBuildFrontmatterDecorationState(transaction.state, activeEdit);
    },

    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });

  function buildFrontmatterDecorationState(state, activeEdit) {
    const builder = new RangeSetBuilder();
    const frontmatterBlock = findFrontmatterBlock(state.doc);
    if (!frontmatterBlock) {
      return { activeEdit: null, decorations: builder.finish() };
    }

    const editing =
      !state.readOnly &&
      activeEdit &&
      activeEdit.from === frontmatterBlock.from &&
      selectionInsideRange(
        state.selection,
        frontmatterBlock.from,
        frontmatterBlock.sourceTo,
      );
    if (!editing) {
      builder.add(
        frontmatterBlock.from,
        frontmatterBlock.to,
        Decoration.replace({
          block: true,
          widget: new FrontmatterPreviewWidget(frontmatterBlock),
        }),
      );
      return { activeEdit: null, decorations: builder.finish() };
    }

    for (
      let lineNumber = 1;
      lineNumber <= frontmatterBlock.sourceLineCount;
      lineNumber += 1
    ) {
      const line = state.doc.line(lineNumber);
      const classes = ["cm-frontmatter-line"];
      if (lineNumber === 1 || lineNumber === frontmatterBlock.sourceLineCount) {
        classes.push("cm-frontmatter-boundary-line");
      }
      if (lineNumber === 1) {
        classes.push("cm-frontmatter-first-line");
      }
      if (lineNumber === frontmatterBlock.sourceLineCount) {
        classes.push("cm-frontmatter-last-line");
      }
      builder.add(
        line.from,
        line.from,
        Decoration.line({ class: classes.join(" ") }),
      );
    }
    return {
      activeEdit: { from: frontmatterBlock.from, to: frontmatterBlock.sourceTo },
      decorations: builder.finish(),
    };
  }

  function exitFrontmatterEditMode(view, force = false) {
    if (!view) return;
    const activeEdit = view.state.field(frontmatterDecorationField).activeEdit;
    if (!force && !activeEdit) return;
    view.dispatch({
      effects: setActiveFrontmatterEdit.of(null),
    });
  }

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

  function exitGherkinEditMode(view, force = false) {
    if (!view) return;
    const activeEdit = view.state.field(gherkinDecorationField).activeEdit;
    if (!force && !activeEdit) return;
    view.dispatch({
      effects: setActiveGherkinEdit.of(null),
    });
  }
  
  // Callouts the caret is not in are drawn as widgets; the one it is in shows
  // its Markdown. Read-only views always draw them.
  function getPreviewedCalloutBlocks(state) {
    const detailsRanges = getPreviewedDetailsRanges(state);
    return findCalloutBlocks(state.doc).filter(
      (block) =>
        !rangeIntersectsRanges(block.from, block.to, detailsRanges) &&
        (state.readOnly ||
          !state.selection.ranges.some(
            (range) => range.from <= block.to && range.to >= block.from,
          )),
    );
  }

  function buildCalloutDecorations(state) {
    const builder = new RangeSetBuilder();
    for (const block of getPreviewedCalloutBlocks(state)) {
      builder.add(
        block.from,
        block.to,
        Decoration.replace({ block: true, widget: new CalloutPreviewWidget(block) }),
      );
    }
    return builder.finish();
  }

  function getPreviewedDetailsRanges(state) {
    const activeEdit = getActiveDetailsEdit(state);
    return findDetailsBlocks(state.doc)
      .filter((block) => !activeEdit || activeEdit.from !== block.from)
      .map((block) => ({ from: block.from, to: block.to }));
  }

  // Ranges that other decorations must leave alone: previewed <details> blocks
  // and callouts, plus the YAML front matter block. The front matter range is
  // included even while it is being edited so its lines never pick up
  // Markdown styling such as thematic breaks or list markers.
  function getPreviewedBlockRanges(state) {
    const ranges = [
      ...getPreviewedDetailsRanges(state),
      ...getPreviewedCalloutBlocks(state).map((block) => ({ from: block.from, to: block.to })),
    ];
    const frontmatterBlock = findFrontmatterBlock(state.doc);
    if (frontmatterBlock) {
      ranges.push({ from: frontmatterBlock.from, to: frontmatterBlock.to });
    }
    return ranges;
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
    const previewedBlockRanges = getPreviewedBlockRanges(state);
    // When rich table preview is disabled, keep the lightweight line styling so
    // Markdown tables still look structured without replacing the source.
    let nextActiveEdit = getSettings().richTablePreview ? activeEdit : null;
  
    for (const tableBlock of tableBlocks) {
      if (
        rangeIntersectsRanges(
          tableBlock.from,
          tableBlock.sourceTo,
          previewedBlockRanges,
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
        isEditingTableBlock(tableBlock, nextActiveEdit, state.selection) ||
        (!state.readOnly &&
          selectionInsideRange(
            state.selection,
            tableBlock.from,
            tableBlock.sourceTo,
          ))
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
  
  function buildMermaidDecorationState(state, activeEdit, diagnostic) {
    const builder = new RangeSetBuilder();
    if (!getSettings().mermaidPreview) {
      return {
        activeEdit: null,
        diagnostic: null,
        decorations: builder.finish(),
      };
    }
  
    const mermaidBlocks = findMermaidBlocks(state.doc);
    const previewedBlockRanges = getPreviewedBlockRanges(state);
    let nextActiveEdit = activeEdit;
    let editedBlock = null;
  
    for (const mermaidBlock of mermaidBlocks) {
      if (
        rangeIntersectsRanges(
          mermaidBlock.from,
          mermaidBlock.sourceTo,
          previewedBlockRanges,
        )
      ) {
        continue;
      }
  
      if (isEditingMermaidBlock(mermaidBlock, nextActiveEdit, state.selection)) {
        nextActiveEdit = {
          from: mermaidBlock.from,
          to: mermaidBlock.sourceTo,
        };
        editedBlock = mermaidBlock;
        addMermaidLiveEditor(builder, state, mermaidBlock, diagnostic);
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
            getSettings().mermaidColorized,
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
      diagnostic:
        editedBlock && diagnostic && diagnostic.from === editedBlock.from
          ? diagnostic
          : null,
      decorations: builder.finish(),
    };
  }

  // Edit mode keeps the diagram source in the document and adds a live,
  // interactive drawing right under the closing fence.
  function addMermaidLiveEditor(builder, state, mermaidBlock, diagnostic) {
    const firstLine = state.doc.lineAt(mermaidBlock.from).number;
    const lastLine = state.doc.lineAt(mermaidBlock.sourceTo).number;
    const errorLine =
      diagnostic && diagnostic.from === mermaidBlock.from && mermaidBlock.hasContentLines
        ? mermaidBlock.firstContentLineNumber + diagnostic.lineIndex
        : -1;
    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
      const classes = ["cm-mermaid-source-line"];
      if (lineNumber === firstLine) classes.push("is-first");
      if (lineNumber === lastLine) classes.push("is-last");
      if (lineNumber === errorLine) classes.push("cm-mermaid-error-line");
      const line = state.doc.line(lineNumber);
      builder.add(line.from, line.from, Decoration.line({ class: classes.join(" ") }));
    }

    const head = state.selection.main.head;
    const caretLine =
      mermaidBlock.hasContentLines &&
      head >= mermaidBlock.contentFrom &&
      head <= mermaidBlock.contentTo
        ? state.doc.lineAt(head).number - mermaidBlock.firstContentLineNumber
        : -1;
    builder.add(
      mermaidBlock.sourceTo,
      mermaidBlock.sourceTo,
      Decoration.widget({
        block: true,
        side: 1,
        widget: new MermaidLiveEditorWidget(
          mermaidBlock,
          readMermaidBlockContent(state.doc, mermaidBlock),
          caretLine,
          getSettings().mermaidColorized,
          previewDecorationRevision,
        ),
      }),
    );
  }

  function buildGherkinDecorationState(state, activeEdit, modes) {
    const builder = new RangeSetBuilder();
    if (!getSettings().gherkinPreview) {
      return {
        activeEdit: null,
        modes,
        decorations: builder.finish(),
      };
    }

    const gherkinBlocks = findGherkinBlocks(state.doc);
    const previewedBlockRanges = getPreviewedBlockRanges(state);
    const blockKeys = new Set(gherkinBlocks.map((block) => block.key));
    const nextModes = new Map(
      [...modes].filter(([key]) => blockKeys.has(key)),
    );
    let nextActiveEdit = activeEdit;

    for (const gherkinBlock of gherkinBlocks) {
      if (
        rangeIntersectsRanges(
          gherkinBlock.from,
          gherkinBlock.sourceTo,
          previewedBlockRanges,
        )
      ) {
        continue;
      }

      if (
        isEditingGherkinBlock(gherkinBlock, nextActiveEdit, state.selection) ||
        (!state.readOnly &&
          selectionInsideRange(
            state.selection,
            gherkinBlock.from,
            gherkinBlock.sourceTo,
          ))
      ) {
        nextActiveEdit = {
          from: gherkinBlock.from,
          to: gherkinBlock.sourceTo,
        };
        continue;
      }

      builder.add(
        gherkinBlock.from,
        gherkinBlock.to,
        Decoration.replace({
          block: true,
          widget: new GherkinPreviewWidget(
            gherkinBlock,
            nextModes.get(gherkinBlock.key),
            previewDecorationRevision,
          ),
        }),
      );
    }

    if (
      nextActiveEdit &&
      !gherkinBlocks.some(
        (gherkinBlock) => gherkinBlock.from === nextActiveEdit.from,
      )
    ) {
      nextActiveEdit = null;
    }

    return {
      activeEdit: nextActiveEdit,
      modes: nextModes,
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

  // Redraws inline decorations only, for example when the host has answered
  // which wikilink names point to files.
  function refreshInline(view) {
    if (view) {
      view.dispatch({ effects: refreshPreviewDecorations.of(null) });
    }
  }

  function refresh(view) {
    if (!view) return;
    // Some previews depend on settings rather than source text. Bumping this
    // revision forces existing widgets, especially Mermaid, to redraw.
    previewDecorationRevision += 1;
    view.dispatch({
      effects: [
        refreshPreviewDecorations.of(null),
        setActiveFrontmatterEdit.of(null),
        setActiveTableEdit.of(null),
        setActiveMermaidEdit.of(null),
        setActiveGherkinEdit.of(null),
      ],
    });
    requestEditorMeasure(view);
  }

  return {
    extensions: [
      frontmatterDecorationField,
      detailsDecorationField,
      calloutDecorationField,
      tableDecorationField,
      mermaidDecorationField,
      gherkinDecorationField,
      blockLineDecorations,
      codeBlockCopyButtons,
      inlineDecorations,
      taskCheckboxes,
    ],
    refresh,
    refreshInline,
    openMermaidEditor,
    exitDetailsEditMode,
    exitFrontmatterEditMode,
    exitTableEditMode,
    exitMermaidEditMode,
    exitGherkinEditMode,
    isLineFocused,
  };
}
