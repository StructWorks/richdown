// Inline and line-level CodeMirror decorations.
//
// These decorations keep the document as editable Markdown while hiding or
// enhancing syntax markers when a line is not focused. Block replacement widgets
// are handled by previewExtensions.js.
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, ViewPlugin } from "@codemirror/view";
import {
  isThematicBreakLine,
  parseListMarker,
  rangeIntersectsRanges,
} from "../../domain/markdownBlocks.js";
import { isMarkdownMarker } from "./links.js";
import { CheckboxWidget, CodeCopyButtonWidget, ListMarkerWidget } from "./widgets.js";

export function createSyntaxPreviewDecorations({
  safeBuildDecorations,
  getPreviewedDetailsRanges,
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
    // Merge regex-based Markdown line classes with parser-provided code block
    // classes before writing decorations, because CodeMirror requires line
    // decorations to be emitted in document order.
    const codeBlockLineClasses = collectCodeBlockLineClasses(view);
    const codeBlockLineStarts = new Set(codeBlockLineClasses.keys());
    const previewedDetailsRanges = getPreviewedDetailsRanges(view.state);
  
    for (const range of view.visibleRanges) {
      let position = range.from;
      while (position <= range.to) {
        const line = view.state.doc.lineAt(position);
        if (rangeIntersectsRanges(line.from, line.to, previewedDetailsRanges)) {
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
  
    for (const [lineStart, className] of codeBlockLineClasses) {
      if (
        rangeIntersectsRanges(lineStart, lineStart + 1, previewedDetailsRanges)
      ) {
        continue;
      }
      addLineClass(classesByLine, lineStart, className);
    }
  
    for (const [lineStart, className] of [...classesByLine.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      builder.add(lineStart, lineStart, Decoration.line({ class: className }));
    }
  
    return builder.finish();
  }
  
  function collectCodeBlockLineClasses(view) {
    const lineClasses = new Map();
    const doc = view.state.doc;
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
            lineClasses.set(line.from, classes.join(" "));
            position = line.to + 1;
            if (position > doc.length) break;
          }
        },
      });
    }
    return lineClasses;
  }
  
  function buildCodeBlockCopyButtons(view) {
    const ranges = [];
    const seenBlocks = new Set();
    const previewedDetailsRanges = getPreviewedDetailsRanges(view.state);
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
            rangeIntersectsRanges(node.from, node.to, previewedDetailsRanges)
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
  
  function buildInlineDecorations(view) {
    const ranges = [];
    // Image previews replace the whole Markdown image token. Keep their ranges
    // so syntax marks from the parser do not overlap the replacement widget.
    const imageRanges = [];
    const previewedDetailsRanges = getPreviewedDetailsRanges(view.state);
  
    for (const range of view.visibleRanges) {
      let position = range.from;
      while (position <= range.to) {
        const line = view.state.doc.lineAt(position);
        if (rangeIntersectsRanges(line.from, line.to, previewedDetailsRanges)) {
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
            rangeIntersectsRanges(node.from, node.to, previewedDetailsRanges)
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
          }
        },
      });
    }
  
    return Decoration.set(
      ranges.map((range) => range.decoration.range(range.from, range.to)),
      true,
    );
  }
  
  function buildTaskCheckboxes(view) {
    const builder = new RangeSetBuilder();
    const previewedDetailsRanges = getPreviewedDetailsRanges(view.state);
  
    for (const range of view.visibleRanges) {
      let position = range.from;
      while (position <= range.to) {
        const line = view.state.doc.lineAt(position);
        if (rangeIntersectsRanges(line.from, line.to, previewedDetailsRanges)) {
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
