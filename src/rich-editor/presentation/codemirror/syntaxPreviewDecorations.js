// Inline and line-level CodeMirror decorations.
//
// These decorations keep the document as editable Markdown while hiding or
// enhancing syntax markers when a line is not focused. Block replacement widgets
// are handled by previewExtensions.js.
import { syntaxTree } from "@codemirror/language";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, ViewPlugin } from "@codemirror/view";
import {
  findMermaidFenceBlocks,
  isThematicBreakLine,
  parseListMarker,
  rangeIntersectsRanges,
} from "../../domain/markdownBlocks.js";
import { isMarkdownMarker } from "./links.js";
import {
  CheckboxWidget,
  CodeCopyButtonWidget,
  ColorPreviewWidget,
  ListMarkerWidget,
} from "./widgets.js";

export function createSyntaxPreviewDecorations({
  safeBuildDecorations,
  getPreviewedBlockRanges,
  isLineFocused,
  findMarkdownImages,
  ImagePreviewWidget,
  isRangeInsideRanges,
  postMessage,
}) {
  const blockLineDecorations = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = safeBuildDecorations("block-line-decorations", () =>
          buildBlockLineDecorations(view),
        );
      }
  
      update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = safeBuildDecorations("block-line-decorations", () =>
            buildBlockLineDecorations(update.view),
          );
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
  
  const inlineDecorations = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = safeBuildDecorations("inline-decorations", () =>
          buildInlineDecorations(view),
        );
      }
  
      update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = safeBuildDecorations("inline-decorations", () =>
            buildInlineDecorations(update.view),
          );
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
  
  const taskCheckboxes = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = safeBuildDecorations("task-checkboxes", () =>
          buildTaskCheckboxes(view),
        );
      }
  
      update(update) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = safeBuildDecorations("task-checkboxes", () =>
            buildTaskCheckboxes(update.view),
          );
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
  
  const codeBlockCopyButtons = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = safeBuildDecorations("code-copy-buttons", () =>
          buildCodeBlockCopyButtons(view),
        );
      }
  
      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = safeBuildDecorations("code-copy-buttons", () =>
            buildCodeBlockCopyButtons(update.view),
          );
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );

  function buildBlockLineDecorations(view) {
    const builder = new RangeSetBuilder();
    const classesByLine = new Map();
    const stylesByLine = new Map();
    // Merge regex-based Markdown line classes with parser-provided code block
    // classes before writing decorations, because CodeMirror requires line
    // decorations to be emitted in document order.
    const codeBlockLineSpecs = collectCodeBlockLineSpecs(view);
    const codeBlockLineStarts = new Set(codeBlockLineSpecs.keys());
    const previewedBlockRanges = getPreviewedBlockRanges(view.state);
  
    for (const range of view.visibleRanges) {
      let position = range.from;
      while (position <= range.to) {
        const line = view.state.doc.lineAt(position);
        if (rangeIntersectsRanges(line.from, line.to, previewedBlockRanges)) {
          position = line.to + 1;
          if (position > view.state.doc.length) break;
          continue;
        }
        if (!codeBlockLineStarts.has(line.from)) {
          const heading = line.text.match(/^(\s{0,3})(#{1,6})\s+/);
          if (isThematicBreakLine(line.text)) {
            addLineClass(classesByLine, line.from, "cm-thematic-break-line");
          } else if (heading) {
            const level = heading[2].length;
            addLineClass(
              classesByLine,
              line.from,
              `cm-heading-line cm-heading-${level}`,
            );
          } else if (/^\s*>\s?/.test(line.text)) {
            addLineClass(classesByLine, line.from, "cm-quote-line");
          }
          const listMarker = parseListMarker(line.text);
          if (listMarker) {
            addLineClass(
              classesByLine,
              line.from,
              `cm-list-line cm-list-depth-${Math.min(listMarker.level, 3)} ${
                listMarker.ordered ? "cm-list-ordered" : "cm-list-unordered"
              }`,
            );
          }
        }
        position = line.to + 1;
        if (position > view.state.doc.length) break;
      }
    }
  
    for (const [lineStart, spec] of codeBlockLineSpecs) {
      if (
        rangeIntersectsRanges(lineStart, lineStart + 1, previewedBlockRanges)
      ) {
        continue;
      }
      addLineClass(classesByLine, lineStart, spec.className);
      if (spec.style) {
        stylesByLine.set(lineStart, spec.style);
      }
    }
  
    for (const [lineStart, className] of [...classesByLine.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      const style = stylesByLine.get(lineStart);
      builder.add(
        lineStart,
        lineStart,
        Decoration.line(
          style
            ? { class: className, attributes: { style } }
            : { class: className },
        ),
      );
    }
  
    return builder.finish();
  }
  
  function collectCodeBlockLineSpecs(view) {
    const lineSpecs = new Map();
    const doc = view.state.doc;
    const tabSize = Math.max(1, view.state.facet(EditorState.tabSize) || 4);
    for (const range of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from: range.from,
        to: range.to,
        enter(node) {
          if (node.name !== "FencedCode" && node.name !== "CodeBlock") {
            return;
          }
  
          const firstLineNumber = doc.lineAt(node.from).number;
          const lastLineNumber = doc.lineAt(
            Math.max(node.from, node.to - 1),
          ).number;
          // Indent guides are only rendered while the caret/selection is
          // inside the code block, mirroring VS Code's focused editor look.
          const blockFocused = isCodeBlockFocused(view.state, node);
          const codeLineRange = blockFocused
            ? getCodeBlockContentLineRange(doc, node)
            : null;
          const indentUnit = codeLineRange
            ? inferCodeBlockIndentUnit(doc, codeLineRange, tabSize)
            : tabSize;
          const indentColumnsByLineNumber = codeLineRange
            ? getCodeBlockIndentColumnsByLine(doc, codeLineRange, tabSize)
            : new Map();
          let position = Math.max(node.from, range.from);
          while (position <= node.to && position <= range.to) {
            const line = doc.lineAt(position);
            const classes = ["cm-codeblock-line"];
            if (line.number === firstLineNumber) {
              classes.push("cm-codeblock-first");
            }
            if (line.number === lastLineNumber) {
              classes.push("cm-codeblock-last");
            }
            const style =
              codeLineRange &&
              line.number >= codeLineRange.fromLineNumber &&
              line.number <= codeLineRange.toLineNumber
                ? getIndentGuideLineStyle(
                    indentColumnsByLineNumber.get(line.number) || 0,
                    indentUnit,
                  )
                : "";
            if (style) {
              classes.push("cm-code-indent-guides-line");
            }
            lineSpecs.set(line.from, {
              className: classes.join(" "),
              style,
            });
            position = line.to + 1;
            if (position > doc.length) break;
          }
        },
      });
    }
    collectMermaidColonFenceLineSpecs(view, lineSpecs, tabSize);
    return lineSpecs;
  }

  function collectMermaidColonFenceLineSpecs(view, lineSpecs, tabSize) {
    const doc = view.state.doc;
    const mermaidBlocks = findMermaidFenceBlocks(doc, { includeUnclosed: true });
    for (const block of mermaidBlocks) {
      if (block.fenceChar !== ":" || !rangeIntersectsVisibleRanges(view, block.from, block.to)) {
        continue;
      }

      const firstLineNumber = doc.lineAt(block.from).number;
      const lastLineNumber = doc.lineAt(Math.max(block.from, block.to - 1)).number;
      const blockFocused = isCodeBlockFocused(view.state, block);
      const codeLineRange = blockFocused
        ? getMermaidFenceContentLineRange(doc, block)
        : null;
      const indentUnit = codeLineRange
        ? inferCodeBlockIndentUnit(doc, codeLineRange, tabSize)
        : tabSize;
      const indentColumnsByLineNumber = codeLineRange
        ? getCodeBlockIndentColumnsByLine(doc, codeLineRange, tabSize)
        : new Map();

      for (
        let lineNumber = firstLineNumber;
        lineNumber <= lastLineNumber;
        lineNumber += 1
      ) {
        const line = doc.line(lineNumber);
        const classes = ["cm-codeblock-line"];
        if (line.number === firstLineNumber) {
          classes.push("cm-codeblock-first");
        }
        if (line.number === lastLineNumber) {
          classes.push("cm-codeblock-last");
        }
        const style =
          codeLineRange &&
          line.number >= codeLineRange.fromLineNumber &&
          line.number <= codeLineRange.toLineNumber
            ? getIndentGuideLineStyle(
                indentColumnsByLineNumber.get(line.number) || 0,
                indentUnit,
              )
            : "";
        if (style) {
          classes.push("cm-code-indent-guides-line");
        }
        lineSpecs.set(line.from, {
          className: classes.join(" "),
          style,
        });
      }
    }
  }

  function rangeIntersectsVisibleRanges(view, from, to) {
    return view.visibleRanges.some((range) =>
      rangeIntersectsRanges(from, to, [range]),
    );
  }
  
  function buildCodeBlockCopyButtons(view) {
    const ranges = [];
    const seenBlocks = new Set();
    const previewedBlockRanges = getPreviewedBlockRanges(view.state);
    const doc = view.state.doc;
  
    for (const range of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from: range.from,
        to: range.to,
        enter(node) {
          if (node.name !== "FencedCode" && node.name !== "CodeBlock") {
            return;
          }
          const blockKey = `${node.from}:${node.to}`;
          if (
            seenBlocks.has(blockKey) ||
            rangeIntersectsRanges(node.from, node.to, previewedBlockRanges)
          ) {
            return;
          }
          seenBlocks.add(blockKey);
          const codeBlock = getCodeBlockCopyInfo(doc, node);
          if (!codeBlock || !codeBlock.code) {
            return;
          }
          ranges.push({
            from: codeBlock.buttonPosition,
            decoration: Decoration.widget({
              side: 1,
              widget: new CodeCopyButtonWidget(codeBlock.code, (message) =>
                postMessage(message),
              ),
            }),
          });
        },
      });
    }
    for (const block of findMermaidFenceBlocks(doc, { includeUnclosed: true })) {
      if (
        block.fenceChar !== ":" ||
        seenBlocks.has(`${block.from}:${block.to}`) ||
        !rangeIntersectsVisibleRanges(view, block.from, block.to) ||
        rangeIntersectsRanges(block.from, block.to, previewedBlockRanges) ||
        !block.code
      ) {
        continue;
      }
      seenBlocks.add(`${block.from}:${block.to}`);
      ranges.push({
        from: doc.lineAt(block.from).to,
        decoration: Decoration.widget({
          side: 1,
          widget: new CodeCopyButtonWidget(block.code, (message) =>
            postMessage(message),
          ),
        }),
      });
    }
  
    return Decoration.set(
      ranges.map((range) => range.decoration.range(range.from)),
      true,
    );
  }
  
  function getCodeBlockCopyInfo(doc, node) {
    const openingLine = doc.lineAt(node.from);
    if (node.name === "FencedCode") {
      const closingLine =
        node.to > node.from ? doc.lineAt(Math.max(node.from, node.to - 1)) : null;
      const hasClosingFence =
        closingLine &&
        closingLine.number > openingLine.number &&
        /^\s{0,3}(`{3,}|~{3,})\s*$/.test(closingLine.text);
      const firstCodeLineNumber = openingLine.number + 1;
      const lastCodeLineNumber = hasClosingFence
        ? closingLine.number - 1
        : doc.lineAt(node.to).number;
      return {
        buttonPosition: openingLine.to,
        code: getLinesText(doc, firstCodeLineNumber, lastCodeLineNumber),
      };
    }
  
    return {
      buttonPosition: openingLine.to,
      code: getLinesText(doc, openingLine.number, doc.lineAt(node.to).number),
    };
  }
  
  function getLinesText(doc, fromLineNumber, toLineNumber) {
    if (toLineNumber < fromLineNumber) {
      return "";
    }
    const lines = [];
    for (
      let lineNumber = fromLineNumber;
      lineNumber <= toLineNumber && lineNumber <= doc.lines;
      lineNumber += 1
    ) {
      lines.push(doc.line(lineNumber).text);
    }
    return lines.join("\n");
  }
  
  function addLineClass(classesByLine, lineStart, className) {
    const current = classesByLine.get(lineStart);
    classesByLine.set(lineStart, current ? `${current} ${className}` : className);
  }

  function isCodeBlockFocused(state, block) {
    // Read-only (viewer) mode never shows focus-dependent chrome.
    if (state.readOnly) {
      return false;
    }
    return state.selection.ranges.some(
      (range) => range.from <= block.to && range.to >= block.from,
    );
  }

  function getCodeBlockContentLineRange(doc, block) {
    const openingLine = doc.lineAt(block.from);
    if (block.name === "FencedCode") {
      const closingLine =
        block.to > block.from
          ? doc.lineAt(Math.max(block.from, block.to - 1))
          : null;
      const hasClosingFence =
        closingLine &&
        closingLine.number > openingLine.number &&
        /^\s{0,3}(`{3,}|~{3,})\s*$/.test(closingLine.text);
      const fromLineNumber = openingLine.number + 1;
      const toLineNumber = hasClosingFence
        ? closingLine.number - 1
        : doc.lineAt(block.to).number;
      return toLineNumber >= fromLineNumber
        ? { fromLineNumber, toLineNumber }
        : null;
    }

    return {
      fromLineNumber: openingLine.number,
      toLineNumber: doc.lineAt(Math.max(block.from, block.to - 1)).number,
    };
  }

  function getMermaidFenceContentLineRange(doc, block) {
    const openingLine = doc.lineAt(block.from);
    const endLine = doc.lineAt(Math.max(block.from, block.to - 1));
    const fromLineNumber = openingLine.number + 1;
    const toLineNumber = block.closed ? endLine.number - 1 : endLine.number;
    return toLineNumber >= fromLineNumber
      ? { fromLineNumber, toLineNumber }
      : null;
  }

  function inferCodeBlockIndentUnit(doc, lineRange, tabSize) {
    let smallestIndent = Infinity;
    for (
      let lineNumber = lineRange.fromLineNumber;
      lineNumber <= lineRange.toLineNumber && lineNumber <= doc.lines;
      lineNumber += 1
    ) {
      const line = doc.line(lineNumber);
      if (!line.text.trim()) {
        continue;
      }
      const indentColumns = countLeadingIndentColumns(line.text, tabSize);
      if (indentColumns > 1) {
        smallestIndent = Math.min(smallestIndent, indentColumns);
      }
    }

    if (!Number.isFinite(smallestIndent)) {
      return tabSize;
    }
    return Math.max(2, Math.min(tabSize, smallestIndent));
  }

  function getCodeBlockIndentColumnsByLine(doc, lineRange, tabSize) {
    const lineEntries = [];
    let previousNonBlankIndent = null;
    for (
      let lineNumber = lineRange.fromLineNumber;
      lineNumber <= lineRange.toLineNumber && lineNumber <= doc.lines;
      lineNumber += 1
    ) {
      const line = doc.line(lineNumber);
      const indentColumns = countLeadingIndentColumns(line.text, tabSize);
      const isBlank = !line.text.trim();
      lineEntries.push({
        lineNumber,
        indentColumns,
        isBlank,
        previousNonBlankIndent,
      });
      if (!isBlank) {
        previousNonBlankIndent = indentColumns;
      }
    }

    const indentColumnsByLineNumber = new Map();
    let nextNonBlankIndent = null;
    for (let index = lineEntries.length - 1; index >= 0; index -= 1) {
      const entry = lineEntries[index];
      if (entry.isBlank) {
        const inheritedIndent = Math.max(
          entry.previousNonBlankIndent ?? 0,
          nextNonBlankIndent ?? 0,
        );
        indentColumnsByLineNumber.set(
          entry.lineNumber,
          Math.max(entry.indentColumns, inheritedIndent),
        );
      } else {
        indentColumnsByLineNumber.set(entry.lineNumber, entry.indentColumns);
        nextNonBlankIndent = entry.indentColumns;
      }
    }

    return indentColumnsByLineNumber;
  }

  function countLeadingIndentColumns(text, tabSize) {
    let column = 0;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === " ") {
        column += 1;
      } else if (character === "\t") {
        column += tabSize - (column % tabSize);
      } else {
        return column;
      }
    }
    return column;
  }

  function getIndentGuideLineStyle(indentColumns, indentUnit) {
    if (indentColumns <= 0) {
      return "";
    }
    const normalizedIndentUnit = Math.max(1, indentUnit || 1);
    const guideCount = Math.min(
      Math.max(1, Math.floor(indentColumns / normalizedIndentUnit)),
      12,
    );
    // Draw a 1px guide on every indent-unit column (0, unit, 2*unit, ...)
    // like VS Code. A single repeating gradient paints all guides at once and
    // the overlay width cuts the pattern off after the last guide, so no line
    // is ever drawn on the column where the text starts.
    return [
      `--cm-code-indent-width: calc(${
        (guideCount - 1) * normalizedIndentUnit
      }ch + 1px)`,
      `--cm-code-indent-guides: repeating-linear-gradient(to right, var(--cm-code-indent-guide) 0 1px, transparent 1px ${normalizedIndentUnit}ch)`,
    ].join("; ");
  }

  function hasAncestor(nodeRef, name) {
    let node = nodeRef.node.parent;
    while (node) {
      if (node.name === name) {
        return true;
      }
      node = node.parent;
    }
    return false;
  }
  
  function buildInlineDecorations(view) {
    const ranges = [];
    // Image previews replace the whole Markdown image token. Keep their ranges
    // so syntax marks from the parser do not overlap the replacement widget.
    const imageRanges = [];
    const previewedBlockRanges = getPreviewedBlockRanges(view.state);
  
    for (const range of view.visibleRanges) {
      let position = range.from;
      while (position <= range.to) {
        const line = view.state.doc.lineAt(position);
        if (rangeIntersectsRanges(line.from, line.to, previewedBlockRanges)) {
          position = line.to + 1;
          if (position > view.state.doc.length) break;
          continue;
        }
        const lineFocused = isLineFocused(view.state, line);
        const heading = line.text.match(/^(\s{0,3})(#{1,6})(\s+)/);
        if (heading) {
          ranges.push({
            from: line.from + heading[1].length + heading[2].length,
            to:
              line.from +
              heading[1].length +
              heading[2].length +
              heading[3].length,
            decoration: Decoration.mark({ class: "cm-markdown-marker" }),
          });
        }
  
        const listMarker = parseListMarker(line.text);
        if (listMarker && !lineFocused) {
          ranges.push({
            from: line.from + listMarker.markerFrom,
            to: line.from + listMarker.markerTo,
            decoration: Decoration.replace({
              widget: new ListMarkerWidget(listMarker),
            }),
          });
        }
  
        if (!lineFocused) {
          for (const image of findMarkdownImages(line.text)) {
            const imageRange = {
              from: line.from + image.from,
              to: line.from + image.to,
            };
            imageRanges.push(imageRange);
            ranges.push({
              ...imageRange,
              decoration: Decoration.replace({
                widget: new ImagePreviewWidget(
                  image.src,
                  image.alt,
                  line.from + image.from,
                ),
              }),
            });
          }
        }
  
        position = line.to + 1;
        if (position > view.state.doc.length) break;
      }
  
      syntaxTree(view.state).iterate({
        from: range.from,
        to: range.to,
        enter(node) {
          if (
            isRangeInsideRanges(node.from, node.to, imageRanges) ||
            rangeIntersectsRanges(node.from, node.to, previewedBlockRanges)
          ) {
            return;
          }
  
          const nodeName = node.name;
          if (isMarkdownMarker(nodeName)) {
            ranges.push({
              from: node.from,
              to: node.to,
              decoration: Decoration.mark({ class: "cm-markdown-marker" }),
            });
          }
          if (nodeName === "URL") {
            ranges.push({
              from: node.from,
              to: node.to,
              decoration: Decoration.mark({
                class: hasAncestor(node, "Link")
                  ? "cm-markdown-marker"
                  : "cm-link",
              }),
            });
          }
          if (nodeName === "Link") {
            ranges.push({
              from: node.from,
              to: node.to,
              decoration: Decoration.mark({ class: "cm-link" }),
            });
          }
          if (nodeName === "InlineCode") {
            ranges.push({
              from: node.from,
              to: node.to,
              decoration: Decoration.mark({ class: "cm-inline-code" }),
            });
            const color = getInlineCodeColor(
              view.state.doc.sliceString(node.from, node.to),
            );
            if (color) {
              ranges.push({
                from: node.from,
                to: node.from,
                decoration: Decoration.widget({
                  side: -1,
                  widget: new ColorPreviewWidget(color),
                }),
              });
            }
          }
        },
      });
    }
  
    return Decoration.set(
      ranges.map((range) => range.decoration.range(range.from, range.to)),
      true,
    );
  }

  function getInlineCodeColor(source) {
    const code = getInlineCodeText(source).trim();
    if (isHexColorCode(code)) {
      return code;
    }
    if (!isFunctionalColorCode(code)) {
      return null;
    }
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
      return null;
    }
    return CSS.supports("color", code) ? code : null;
  }

  function getInlineCodeText(source) {
    const opening = source.match(/^`+/)?.[0];
    if (!opening || !source.endsWith(opening)) {
      return source;
    }
    return source.slice(opening.length, -opening.length);
  }

  function isHexColorCode(value) {
    return /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
  }

  function isFunctionalColorCode(value) {
    return /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/i.test(value);
  }
  
  function buildTaskCheckboxes(view) {
    const builder = new RangeSetBuilder();
    const previewedBlockRanges = getPreviewedBlockRanges(view.state);
  
    for (const range of view.visibleRanges) {
      let position = range.from;
      while (position <= range.to) {
        const line = view.state.doc.lineAt(position);
        if (rangeIntersectsRanges(line.from, line.to, previewedBlockRanges)) {
          position = line.to + 1;
          if (position > view.state.doc.length) break;
          continue;
        }
        const match = line.text.match(/^(\s*[-*+]\s+)\[( |x)\]/i);
        if (match && !isLineFocused(view.state, line)) {
          const from = line.from + match[1].length;
          builder.add(
            from,
            from + 3,
            Decoration.replace({
              widget: new CheckboxWidget(match[2].toLowerCase() === "x", from),
            }),
          );
        }
        position = line.to + 1;
        if (position > view.state.doc.length) break;
      }
    }
  
    return builder.finish();
  }

  return {
    blockLineDecorations,
    codeBlockCopyButtons,
    inlineDecorations,
    taskCheckboxes,
  };
}
