# Richdown for Orca

Richdown's rich Markdown editor as an [Orca](https://orca.dev) plugin. It opens `.md` and `.markdown` files with inline previews, editable tables, colored Mermaid diagrams, Gherkin boards, images, and Markdown lint and formatting.

This repository is the plugin exactly as Orca installs it. It is generated from [StructWorks/richdown](https://github.com/StructWorks/richdown), where Richdown is developed together with its VS Code extension; please open issues and pull requests there.

Version {{version}}, built from [StructWorks/richdown@{{commit}}](https://github.com/StructWorks/richdown/commit/{{commit}}).

## Install

```bash
orca plugin install StructWorks/richdown-orca
```

Or in Orca: **Settings → Plugins → Add plugin → From a Git URL…** with `https://github.com/StructWorks/richdown-orca`.

Orca opens Markdown in its Source view first; choose **Richdown** in the view toggle beside Source. Settings are under the plugin in Orca's Settings.

## What it can access

An Orca editor receives the open file's text but not its path, and has no file system or network. To show images, Richdown runs a small Node.js worker (`orcaWorker.mjs`), which is why Orca asks you to approve running code and reading your workspaces:

- **Workspaces** (`workspace:read`): the worker lists your local workspaces to find the open file, by matching its text against the Markdown files in them.
- **Files**: it reads image files (by file type) next to the document, from inside your local workspaces only and never through hidden folders. It does not write files.
- **Network**: remote images are downloaded only from public addresses, never from your machine or private network (redirects are checked too), up to 32 MB each. Turn this off with the **Remote images** setting.
- **Settings** (`settings:own`): the plugin's own settings.

The editor itself sends nothing anywhere. There is no tracking or analytics.

## What is in this repository

| File | What it is |
| --- | --- |
| `orca-plugin.json` | The plugin manifest. |
| `editor.html`, `orcaEditor.js` | The editor frame. `orcaEditor.js` is CodeMirror and Richdown, bundled and minified. |
| `mermaid.js` | [Mermaid](https://mermaid.js.org), loaded by the editor when a document has a diagram; bundled and minified. |
| `orcaWorker.mjs` | The Node.js worker, bundled but not minified. |
| `source/` | The Richdown source files the bundles are built from, with `package.json`, `package-lock.json` and the build script. |

Third-party license notices are kept at the end of each bundle.

## Rebuild and compare

```bash
cd source
npm ci
node scripts/build-orca-plugin.mjs --out ../rebuilt
cmp ../orcaEditor.js ../rebuilt/orcaEditor.js
cmp ../mermaid.js ../rebuilt/mermaid.js
cmp ../orcaWorker.mjs ../rebuilt/orcaWorker.mjs
```

## License

MIT. See `LICENSE`.
