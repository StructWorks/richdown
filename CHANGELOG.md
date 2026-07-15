# Changelog

All notable changes to Richdown will be documented in this file.

## 0.7.4 - 2026-07-15

- Fixed underscores in table cells and other rich inline previews being mistaken for emphasis inside identifiers.

## 0.7.3 - 2026-07-15

- Fixed Markdown block rendering inside expanded `<details>` previews, including code fences, headings, lists, quotes, images, and tables.

## 0.7.2 - 2026-07-15

- Added automatic refresh for Markdown files changed on disk by AI agents and other external tools while they are open in Richdown.

## 0.7.1 - 2026-07-10

- Fixed packaged VSIX builds so the export runtime is included and Richdown commands register correctly after activation.

## 0.7.0 - 2026-07-09

- Added HTML export for local Markdown files as a standalone Richdown preview using the same rich table, Mermaid, Gherkin, image, task, code, and theme UI as the editor.
- Added PDF export for local Markdown files by printing the standalone Richdown preview through an installed Chromium-based browser.

## 0.6.0 - 2026-07-08

- Added clearer colorized Mermaid rendering for inline diagram previews.
- Added a setting to turn Mermaid colorization on or off.
- Added Mermaid preview support for Azure DevOps-style `::: mermaid` blocks.
- Added Gherkin fenced code block support with switchable BDD board and source views.

## 0.5.0 - 2026-06-14

- Added inline color swatches after Markdown inline code color values.
- Added Git change markers beside line numbers for added, changed, and deleted lines.
- Added stronger Richdown search match highlighting for the active search query.

## 0.3.0 - 2026-05-16

- Added `Richdown: Open Rich Diff` for viewing Markdown changes with Richdown-rendered side-by-side diffs.
- Added a Source Control context menu entry for opening Markdown changes in Richdown Diff.
- Added rich diff rendering for headings, lists, task checkboxes, blockquotes, thematic breaks, tables, images, links, and syntax-highlighted code blocks with copy controls.
- Kept the VS Code native diff viewer available as `Richdown: Open Git Diff`.

## 0.2.0 - 2026-05-16

- Added `Richdown: Open Git Diff` for opening the VS Code Git diff of the current Markdown file.
- Added an editor title diff button for Markdown files.
- Kept Markdown files in Source Control Changes on VS Code's native diff viewer while regular local Markdown files open directly in Richdown without a reopen flicker.

## 0.1.0 - 2026-05-15

- Initial Richdown release.
- Added a custom Markdown editor with inline rich preview behavior.
- Added editable rich tables with cell editing, row and column actions, and inline Markdown rendering inside cells.
- Added Mermaid diagram previews with lazy loading, zoom, pan, fit, and modal viewing.
- Added syntax-highlighted fenced code blocks with copy controls.
- Added configurable themes, preview width, and empty-line hint visibility.
- Added image previews, clickable links, task checkboxes, details previews, and slash-command Markdown insertion.
- Increased the Large Mermaid preview area for detailed diagrams.
