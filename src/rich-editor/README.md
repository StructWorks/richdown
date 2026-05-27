# Rich Editor Architecture

Richdown's rich editor follows a lightweight Clean Architecture layout.

```text
rich-editor/
  domain/        Pure Markdown/settings/text logic. No DOM, VS Code, or CodeMirror.
  application/   Use cases that coordinate domain decisions.
  adapters/      Boundary adapters for host APIs such as VS Code webview.
  presentation/  CodeMirror extensions, widgets, menus, styles, and DOM UI.
```

Dependency direction:

```text
presentation -> application -> domain
adapters ---------------------> domain
main entrypoint wires the layers together
```

Layer rules:

- `domain` must stay framework-free and browser-free.
- `application` can import `domain`, but not `presentation`.
- `presentation` can depend on CodeMirror, DOM, and application/domain services.
- `adapters` isolate host APIs such as `vscode.postMessage`.
- `src/richEditor.js` is the composition root for the webview editor.

When adding a feature, start by putting parsing/normalization rules in `domain`,
workflow decisions in `application`, and rendering or interaction code in
`presentation`.
