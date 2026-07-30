# Changelog

All notable changes to Richdown will be documented in this file.

## 0.8.2 - 2026-07-30

- Fixed the Git change markers beside the line numbers not appearing for edits inside a rendered block. A change in a rich table, Mermaid diagram, Gherkin board, `<details>` section, or front matter card now marks the whole block instead of showing nothing.

## 0.8.1 - 2026-07-22

- Made rich tables wrap long cell text within the editor width instead of forcing horizontal scrolling; scrolling now only appears when many columns cannot fit even after wrapping.
- Reclaimed cell space previously reserved for the hover Actions button so narrow columns stay readable; the button now overlays the cell corner while hovered.
- Fixed the table +Row/+Column toolbar buttons wrapping their labels in narrow windows, and kept wide tables from stretching the whole editor horizontally.
- Removed the fixed 720px width and 460px height caps on image previews so images align with the surrounding content width; smaller images keep their natural size.

## 0.8.0 - 2026-07-17

- Added completions matching the standard VS Code editor. Richdown runs VS Code's registered completion providers against the real document and shows their suggestions inline — including ones contributed by other extensions, such as model names in agent files and Markdown link path/anchor suggestions. Like VS Code, completions open inside link targets, on front matter keys and values, or with Ctrl+Space — never while typing ordinary text.
- Added YAML front matter rendering: documents that start with a `---` fenced header now show a clean metadata card with keys, values, and tag chips instead of raw delimiter lines. Clicking the card edits the YAML source with proper YAML syntax parsing, and the card returns when the caret leaves the block.

## 0.7.5 - 2026-07-16

- Fixed "open Markdown with Richdown by default" not taking effect for files opened over a remote connection (WSL, SSH, Dev Containers, Codespaces, and web/virtual workspaces). The editor associations now cover the `vscode-remote` and `vscode-vfs` schemes in addition to local files.

## 0.7.4 - 2026-07-15

- Fixed underscores in table cells and other rich inline previews being mistaken for emphasis inside identifiers.
- Improved expanded `<details>` spacing, nested list layout, wide-table handling, and fenced-code language labels and syntax highlighting.
- Made Mermaid preview heights follow each rendered diagram's aspect ratio and available editor width, with viewport-aware limits for tall diagrams.
- Made rich tables easier to operate with visible row and column controls, keyboard cell navigation, accessible action menus, edit cancellation, and multi-cell tabular paste.
- Fixed rich-table edge cases for escaped and inline-code pipes, indented or outer-pipe-free rows, whitespace preservation, and predictable Tab and Escape focus behavior.

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
