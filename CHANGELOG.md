# Changelog

All notable changes to Richdown will be documented in this file.

## 0.10.1 - 2026-10-27

- Flowcharts can now be grouped into subgraphs from the Mermaid editor. **+ Subgraph** wraps the selected node in a new subgraph (inside the node's current one), nests a new subgraph in the selected subgraph, or adds one with a first node. The **Subgraph** dropdown moves the selected node into another subgraph or out to the top level, rewriting the source so the node really is drawn there. Click a subgraph to jump to its `subgraph` line and select it, double-click to rename its title, and color it, connect it, add nodes inside it with **+ Node**, or remove it with **Delete** (its contents stay). **+ Node** from a node inside a subgraph adds the new node to the same subgraph.
- In rich tables, `Enter` in the last row adds a row and continues in the same column; `Enter` in an empty last row removes it and leaves the table. `Escape` now leaves the table for the line below and keeps what was typed (it used to revert the cell).
- Wrapped list items, including nested, numbered, and task items, now continue under the item's text instead of at the start of the line.
- Fixed the template buttons of an empty Mermaid diagram doing nothing when clicked.
- Fixed Mermaid editor dropdowns showing light text on a white list in dark themes.
- Fixed `Enter` and `Escape` used to confirm or cancel an IME conversion (for example Japanese input) in a rich table cell or the Mermaid table editor moving to another row or leaving the table.

## 0.10.0 - 2026-10-25

- Added a rich Mermaid editor. Click a diagram to edit its source with a live, interactive drawing right under it. Parse errors underline the failing source line, and the last good drawing stays visible. **Edit diagram** (✎ on the diagram toolbar, or ⤢ while editing) opens a larger split view with the source on the left and the diagram on the right. Every visual edit is a small rewrite of the source, so undo works as usual. Empty diagrams offer templates, and Mermaid source is now syntax highlighted.
- Clicking an element of any Mermaid diagram type jumps to the statement that draws it, double-clicking renames it in place, and the elements drawn by the caret's line are highlighted. This covers flowcharts, sequence, class, state, ER, gantt, pie, mindmap, journey, timeline, git, quadrant, xychart, sankey, block, kanban, architecture, requirement, C4, packet, radar, and treemap diagrams; for example a gantt bar maps to its task line and a pie wedge to its data line. Renaming something that other lines refer to by name (a class, state, entity, git branch, or sankey node) renames every reference; a multi-word name for a class or state becomes its display label.
- Diagrams can be edited visually from the editor toolbar, and Shift-dragging (or **Connect**) from one element to another connects them:
  - Flowcharts: add nodes, connect them, change shapes and colors, and switch the direction.
  - Sequence diagrams: add participants and messages, change a message's arrow or reverse it, add notes, wrap statements in loop/alt/opt/par/critical/break blocks, reorder participants, and toggle autonumbering.
  - State diagrams: add states, transitions, notes, and start and end markers, and set the direction.
  - Class diagrams: add classes, members, and relations, and change the relation type.
  - ER diagrams: add entities, attributes, and relationships, and set each side's cardinality and whether the relationship is identifying.
  - Mindmaps: add children and siblings, move ideas up and down, and change their shape.
  - Delete removes the selected element together with the lines that refer to it.
- Pie charts, gantt charts, user journeys, timelines, sankey diagrams, and quadrant charts can be edited as a table under the diagram: edit cells (Enter moves down and adds a row at the end), add rows and sections, reorder, and delete. Gantt tasks get separate Status, Id, Start, and Duration columns.

## 0.9.4 - 2026-10-25

- Writing a table from scratch with the keyboard is easier. Press `Enter` at the end of a header row such as `| Name | Age |` to add the delimiter row and an empty first row, with the caret in its first cell (a missing closing `|` is added). Inside table source, `Tab` and `Shift+Tab` move between cells and select their text, `Tab` on the last cell adds a row, `Enter` adds a row below, and `Enter` on an empty last row removes it and leaves the table. The `/Table` slash command now selects the first header so you can type over it right away.
- Arrow keys now move through rich tables predictably. Up and Down from the line above or below a table enter its cells (in the column under the caret) instead of jumping over the whole table, move between rows inside it, and leave it from the top or bottom row; Down from the last row of a table that ends the document adds a line to continue on. Right at the end of the line above and Left at the start of the line below enter the first and last cell, and the same keys at the table's first and last cell leave it. Previously Up and Down inside a cell dropped the caret into the text around the table.
- Added **Edit as Markdown** to the table cell actions (right-click or `Shift+F10`, which now also works while editing a cell) to show a table's Markdown source.
- Fixed cell edits being written twice when moving between cells quickly and then leaving the table, which left stray `|` characters at the end of the table. Opening the cell actions menu no longer commits pending edits first, so its actions (such as adding a row) no longer apply to an outdated copy of the table.

## 0.9.3 - 2026-10-24

- Fixed typing in the Richdown editor losing or doubling characters, most often when writing a new file from the top or typing headings with a Japanese (IME) input method. When a file turned dirty or was saved, the editor could be sent the document as it was a few keystrokes earlier; applying it undid what had been typed since and broke an IME composition in progress. The editor now ignores any update that does not include its own latest edit.
- Fixed lint squiggles arriving during an IME composition dropping the `##` marker and its space before the composed text or doubling it. Lint results now wait until the composition ends, and results computed for older text are dropped instead of landing on the wrong characters. CodeMirror is updated to 6.43.15, which fixes a crash in redrawing marks around a composition.
- Fixed moving the caret up or down into a heading line placing it inside the hidden `##` marker, so typing turned `## Title` into `##xTitle`. The caret now lands at the start of the heading text.

## 0.9.2 - 2026-10-21

- Fixed `#heading` links in the Richdown editor. They no longer jump to a `# comment` inside a code block, and they now reach setext headings and `<a id="...">` anchors. Heading anchors follow GitHub's rules, so `## C++ / C#` is `#c--c`, and the link checker uses the same rules. Links with a title (`[text](#anchor "title")`) or an `<...>` target can now be clicked.

## 0.9.1 - 2026-10-07

- Added a Markdown formatter. `Richdown: Format Document` (also `Shift+Alt+F` in the Richdown editor, and VS Code's Format Document when Richdown is the Markdown formatter) converts setext headings, normalizes heading spacing, list markers and ordered list numbers, aligns tables with East Asian wide characters counted as two columns, adds blank lines around headings, code blocks, lists and tables, and cleans up whitespace. Set `richdown.formatOnSave` to format on save.
- Added Markdown lint rules. Problems appear in the Problems panel and as squiggles with hover messages in the Richdown editor. An overview ruler at the editor's right edge marks where every problem is in the whole document; click a mark to scroll there, or press F8 / Shift+F8 to move to the next or previous problem. Turn checking off with `richdown.lint.enabled`, or silence a rule in a document with `<!-- richdown-lint-disable-next-line rule-name -->`.
- Each formatter and lint rule can be turned on or off, or given options and a severity, in a `.richdownrc.json` file, which VS Code completes and validates. `Richdown: Create Formatter and Lint Configuration` creates one that lists every rule.

## 0.9.0 - 2026-10-02

- Fixed `<br>` tags inside table cells showing as literal text in rich tables, Richdown Diff, and HTML/PDF export; they now render as line breaks.
- Links inside Richdown and Richdown Diff to `#heading` anchors and `#L12` lines now scroll to the target instead of only opening the file.
- Markdown file links opened by AI extensions such as Claude Code and Codex now open in Richdown at the linked line with the match highlighted. Those extensions open files with `showTextDocument`, which always uses the text editor, so Richdown takes such new text editors over and carries their position. Ordinary opens still go straight to Richdown. "Reopen Editor With > Text Editor" keeps a file in the text editor.
- Added the `richdown.jumpToOpenedPosition` setting (off by default) to also jump to VS Code Search results and Copilot Chat links. VS Code passes the position only to text editors, so in this mode every Markdown file opens in the text editor first and switches to Richdown right away, which causes a visible flicker, and Richdown does not add its `workbench.editorAssociations` entries.
- Added a banner for pending GitHub Copilot edits to the open file, with Keep, Undo, and Review Changes. Copilot's inline diff and Keep/Undo controls exist only in the text editor, so Review Changes reopens the file there, and Richdown takes it back once every edit is kept or undone.

## 0.8.4 - 2026-08-20

- Fixed Richdown failing to open any Markdown file after 0.8.3. The line-ending module added in that release was excluded from the packaged extension, so the extension host threw while loading and the rich editor never started.

## 0.8.3 - 2026-08-18

- Fixed typing in the rich editor on Windows inserting stray blank lines and jumping the caret. Documents that use CRLF line endings — the default for new files on Windows — are now translated to the editor's LF text and written back with the document's own line endings, so an edit is no longer echoed back as an external change.

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
