# Richdown

Richdown is a VS Code Markdown editor that keeps writing and previewing in one place. It opens Markdown files in a CodeMirror-based rich editor with inline Markdown previews, editable rich tables, Mermaid diagrams, syntax-highlighted code blocks, images, links, task checkboxes, and configurable writing themes.

## Features

- Opens `.md` and `.markdown` files with the Richdown editor by default.
- Toggle between Richdown and the standard VS Code text editor from the editor title button or the command palette.
- Preview headings, emphasis, inline code, links, images, blockquotes, task checkboxes, thematic breaks, code blocks, tables, details blocks, and Mermaid diagrams while editing.
- Edit Markdown tables as rich tables, including cell editing, row/column insertion, and row/column deletion.
- Render Mermaid diagrams lazily, with fit, zoom, pan, and modal viewing controls.
- Choose the preview width and theme from the in-editor settings button.
- Switch between the default VS Code theme and several built-in dark/light themes.

## Commands

- `Richdown: Toggle Markdown Open Mode`: Switch whether Markdown files open with Richdown or the standard VS Code text editor.

## Settings

- `richdown.openMarkdownAsRichEditor`: Open Markdown files with Richdown by default.
- `richdown.richTheme`: Select the Richdown editor theme. `default` follows the active VS Code theme.
- `richdown.showEmptyLineHint`: Show the `Click to write` hint for empty lines.
- `richdown.richTablePreview`: Render Markdown tables as editable rich tables.
- `richdown.mermaidPreview`: Render Mermaid code blocks as diagrams.
- `richdown.mermaidPreviewSize`: Choose the Mermaid preview height behavior.
- `richdown.previewWidth`: Choose the Richdown content width.

## Development

Install dependencies and build the bundled webview assets:

```bash
npm install
npm run build:all
```

Run the extension locally:

1. Open this folder in VS Code.
2. Press `F5` to start the Extension Development Host.
3. Open a Markdown file in the new VS Code window.

Package a VSIX:

```bash
npm run build:all
npx @vscode/vsce package
```

## Release Notes

Release notes are tracked in the root `CHANGELOG.md` file.
