const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  containsMermaidBlocks,
  createExportImageMap,
  createHtmlExport,
  writePdfExport
} = require('./src/export/markdownExport');

const richEditorViewType = 'richdown.richEditor';
const legacyMarkdownEditorAssociationPatterns = ['*.md', '*.markdown'];
// VS Code matches editor-association globs that contain a path separator against
// `${resource.scheme}:${resource.path}`, so a scheme-qualified pattern only applies
// to that scheme. Local files use `file:`; WSL, SSH, Dev Containers, and Codespaces
// use `vscode-remote:`; web/virtual workspaces use `vscode-vfs:`. Covering the remote
// schemes keeps "open by default" working when connected to WSL and other remotes,
// while still excluding Source Control diff resources (which use the `git:` scheme).
const markdownFileEditorAssociationSchemes = ['file', 'vscode-remote', 'vscode-vfs'];
const markdownFileEditorAssociationExtensions = ['md', 'markdown'];
const markdownFileEditorAssociationPatterns = markdownFileEditorAssociationSchemes.flatMap(
  scheme => markdownFileEditorAssociationExtensions.map(extension => `${scheme}:/**/*.${extension}`)
);
const markdownDiffEditorAssociationPatterns = ['*.md', '*.markdown'];
const richThemeValues = ['default', 'midnight', 'graphite', 'forest', 'ivory', 'paper', 'solar'];
const mermaidPreviewSizeValues = ['source', 'readable', 'large'];
const previewWidthValues = ['default', 'wide'];

let disposables = [];

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('richdown.toggle', toggleMarkdownOpenMode));
  context.subscriptions.push(vscode.commands.registerCommand('richdown.openGitDiff', openGitDiff));
  context.subscriptions.push(vscode.commands.registerCommand('richdown.openRichDiff', resource => openRichDiff(context, resource)));
  context.subscriptions.push(vscode.commands.registerCommand('richdown.exportHtml', resource => exportMarkdown(context, resource, 'html')));
  context.subscriptions.push(vscode.commands.registerCommand('richdown.exportPdf', resource => exportMarkdown(context, resource, 'pdf')));
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(
    richEditorViewType,
    new RichdownEditorProvider(context),
    {
      webviewOptions: {
        retainContextWhenHidden: true
      },
      supportsMultipleEditorsPerDocument: false
    }
  ));

  disposables = [
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('richdown.openMarkdownAsRichEditor')) {
        void syncMarkdownEditorAssociations();
      }
    })
  ];

  context.subscriptions.push(...disposables);
  void syncMarkdownEditorAssociations();
}

function deactivate() {}

async function toggleMarkdownOpenMode(resource) {
  const config = vscode.workspace.getConfiguration('richdown');
  const useRichEditor = config.get('openMarkdownAsRichEditor', true);
  const nextValue = !useRichEditor;
  await config.update('openMarkdownAsRichEditor', nextValue, vscode.ConfigurationTarget.Global);
  await syncMarkdownEditorAssociations(nextValue);
  await reopenMarkdownResource(resource, nextValue);
  vscode.window.showInformationMessage(
    nextValue
      ? 'Markdown files will open with Richdown by default.'
      : 'Markdown files will open with the standard VS Code text editor by default.'
  );
}

async function openGitDiff(resource) {
  const uri = getMarkdownResourceUri(resource);
  if (!uri) {
    vscode.window.showWarningMessage('Open a Markdown file to view its Git diff.');
    return;
  }
  if (uri.scheme !== 'file') {
    vscode.window.showWarningMessage('Git diff is only available for local Markdown files.');
    return;
  }

  try {
    const headUri = uri.with({
      scheme: 'git',
      path: uri.path,
      query: JSON.stringify({ path: uri.fsPath, ref: 'HEAD' })
    });
    await vscode.commands.executeCommand(
      'vscode.diff',
      headUri,
      uri,
      `${path.basename(uri.fsPath)} (HEAD <-> Working Tree)`,
      { preview: false }
    );
    return;
  } catch (error) {
    // Fall back to the Git extension command for unusual repository states.
  }

  try {
    await vscode.commands.executeCommand('git.openChange', uri);
  } catch (error) {
    vscode.window.showWarningMessage(
      'Git diff is not available for this Markdown file. Make sure it belongs to a Git repository and has changes.'
    );
  }
}

async function openRichDiff(context, resource) {
  const uri = getMarkdownResourceUri(resource);
  if (!uri) {
    vscode.window.showWarningMessage('Open a Markdown file to view its Richdown diff.');
    return;
  }
  if (uri.scheme !== 'file') {
    vscode.window.showWarningMessage('Richdown diff is only available for local Markdown files.');
    return;
  }

  let leftText = '';
  let leftLabel = 'HEAD';
  const rightLabel = 'Working Tree';
  const headUri = createGitHeadUri(uri);
  try {
    leftText = await readUriText(headUri);
  } catch (error) {
    leftText = '';
    leftLabel = 'HEAD (not available)';
  }

  let rightText;
  try {
    rightText = await readUriText(uri);
  } catch (error) {
    vscode.window.showWarningMessage('Richdown could not read this Markdown file.');
    return;
  }

  createRichDiffPanel(context, uri, {
    leftText,
    rightText,
    leftLabel,
    rightLabel
  });
}

async function exportMarkdown(context, resource, format) {
  const uri = getMarkdownResourceUri(resource);
  const label = format === 'pdf' ? 'PDF' : 'HTML';
  if (!uri) {
    vscode.window.showWarningMessage(`Open a Markdown file to export ${label}.`);
    return;
  }
  if (uri.scheme !== 'file') {
    vscode.window.showWarningMessage(`Richdown ${label} export is only available for local Markdown files.`);
    return;
  }

  const targetUri = await pickExportTargetUri(uri, format);
  if (!targetUri) {
    return;
  }
  if (targetUri.scheme !== 'file') {
    vscode.window.showWarningMessage(`Richdown ${label} export can only write local files.`);
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Exporting ${path.basename(uri.fsPath)} to ${label}...`,
        cancellable: false
      },
      async () => {
        const markdown = await readMarkdownTextForExport(uri);
        const title = getExportTitle(markdown, path.basename(uri.fsPath, path.extname(uri.fsPath)));
        const allowedRoots = getExportAllowedRoots(uri);
        const settings = getExportRichEditorSettings();
        const imageMap = await createExportImageMap({
          markdown,
          sourcePath: uri.fsPath,
          allowedRoots
        });
        const includeMermaid = containsMermaidBlocks(markdown);

        if (format === 'html') {
          const assets = await copyRichdownExportAssets(context, targetUri, { includeMermaid });
          const html = createHtmlExport({
            markdown,
            title,
            settings,
            richEditorScriptHref: assets.richEditorScriptHref,
            mermaidScriptHref: assets.mermaidScriptHref,
            imageMap,
            colorThemeKind: 'light'
          });
          await vscode.workspace.fs.writeFile(targetUri, Buffer.from(html, 'utf8'));
        } else {
          const tempDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'richdown-export-'));
          try {
            const tempHtmlPath = path.join(tempDirectory, `${sanitizeExportAssetName(title)}.html`);
            const tempHtmlUri = vscode.Uri.file(tempHtmlPath);
            const assets = await copyRichdownExportAssets(context, tempHtmlUri, { includeMermaid });
            const html = createHtmlExport({
              markdown,
              title,
              settings,
              richEditorScriptHref: assets.richEditorScriptHref,
              mermaidScriptHref: assets.mermaidScriptHref,
              imageMap,
              colorThemeKind: 'light'
            });
            await fs.promises.writeFile(tempHtmlPath, html, 'utf8');
            await writePdfExport({
              htmlPath: tempHtmlPath,
              outputPath: targetUri.fsPath
            });
          } finally {
            await fs.promises.rm(tempDirectory, { recursive: true, force: true });
          }
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Richdown ${label} export failed: ${message}`);
    return;
  }

  const openAction = await vscode.window.showInformationMessage(
    `Exported ${label}: ${path.basename(targetUri.fsPath)}`,
    'Open'
  );
  if (openAction === 'Open') {
    await vscode.commands.executeCommand('vscode.open', targetUri);
  }
}

async function pickExportTargetUri(sourceUri, format) {
  const extension = format === 'pdf' ? 'pdf' : 'html';
  const label = format === 'pdf' ? 'PDF' : 'HTML';
  const baseName = path.basename(sourceUri.fsPath, path.extname(sourceUri.fsPath));
  return vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(path.dirname(sourceUri.fsPath), `${baseName}.${extension}`)),
    filters: {
      [label]: [extension]
    },
    saveLabel: `Export ${label}`
  });
}

async function readMarkdownTextForExport(uri) {
  const openDocument = vscode.workspace.textDocuments.find(document =>
    document.uri.toString() === uri.toString()
  );
  if (openDocument) {
    return openDocument.getText();
  }
  return readUriText(uri);
}

function getExportTitle(markdown, fallback) {
  const heading = String(markdown || "").match(/^\s{0,3}#\s+(.+)$/m);
  return heading ? heading[1].trim() : fallback;
}

function getExportAllowedRoots(uri) {
  const roots = new Set([path.dirname(uri.fsPath)]);
  for (const folder of vscode.workspace.workspaceFolders || []) {
    if (folder?.uri?.fsPath) {
      roots.add(folder.uri.fsPath);
    }
  }
  return [...roots];
}

function getExportRichEditorSettings() {
  return {
    ...getRichEditorSettings(),
    richTheme: 'paper'
  };
}

async function copyRichdownExportAssets(context, targetUri, { includeMermaid }) {
  const assetDirectoryName = `${sanitizeExportAssetName(
    path.basename(targetUri.fsPath, path.extname(targetUri.fsPath))
  )}_assets`;
  const assetDirectory = path.join(path.dirname(targetUri.fsPath), assetDirectoryName);
  await fs.promises.mkdir(assetDirectory, { recursive: true });

  await fs.promises.copyFile(
    path.join(context.extensionPath, 'media', 'richEditor.js'),
    path.join(assetDirectory, 'richEditor.js')
  );

  let mermaidScriptHref = '';
  if (includeMermaid) {
    await fs.promises.copyFile(
      path.join(context.extensionPath, 'media', 'mermaid.js'),
      path.join(assetDirectory, 'mermaid.js')
    );
    mermaidScriptHref = `${encodeURIComponent(assetDirectoryName)}/mermaid.js`;
  }

  return {
    richEditorScriptHref: `${encodeURIComponent(assetDirectoryName)}/richEditor.js`,
    mermaidScriptHref
  };
}

function sanitizeExportAssetName(name) {
  return String(name || 'richdown-export')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'richdown-export';
}

function createGitHeadUri(uri) {
  return uri.with({
    scheme: 'git',
    path: uri.path,
    query: JSON.stringify({ path: uri.fsPath, ref: 'HEAD' })
  });
}

async function readUriText(uri) {
  const content = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(content).toString('utf8');
}

function createRichDiffPanel(context, documentUri, diffData) {
  const workspaceRoots = vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders.map(folder => folder.uri)
    : [];
  const panel = vscode.window.createWebviewPanel(
    'richdown.richDiff',
    `${path.basename(documentUri.fsPath)} Rich Diff`,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        context.extensionUri,
        vscode.Uri.file(path.dirname(documentUri.fsPath)),
        ...workspaceRoots
      ]
    }
  );

  const postSettings = () => {
    panel.webview.postMessage({
      type: 'settings',
      settings: getRichEditorSettings()
    });
  };
  const postWorkingTree = async () => {
    try {
      panel.webview.postMessage({
        type: 'updateRight',
        text: await readUriText(documentUri)
      });
    } catch (error) {
      // The panel can keep showing the last successfully loaded text.
    }
  };

  panel.webview.html = getRichDiffHtml(context, panel.webview, {
    ...diffData,
    fileName: path.basename(documentUri.fsPath),
    filePath: documentUri.fsPath
  }, getRichEditorSettings());

  const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document.uri.toString() === documentUri.toString()) {
      void postWorkingTree();
    }
  });
  const changeConfigurationSubscription = vscode.workspace.onDidChangeConfiguration(event => {
    if (
      event.affectsConfiguration('richdown.richTheme') ||
      event.affectsConfiguration('richdown.mermaidPreview') ||
      event.affectsConfiguration('richdown.mermaidColorized') ||
      event.affectsConfiguration('richdown.mermaidPreviewSize') ||
      event.affectsConfiguration('richdown.gherkinPreview') ||
      event.affectsConfiguration('richdown.previewWidth')
    ) {
      postSettings();
    }
  });

  panel.onDidDispose(() => {
    changeDocumentSubscription.dispose();
    changeConfigurationSubscription.dispose();
  });

  panel.webview.onDidReceiveMessage(async event => {
    if (event.type === 'openLink') {
      await openMarkdownLink({ uri: documentUri }, event.href);
      return;
    }

    if (event.type === 'resolveImage') {
      const uri = resolveMarkdownImageUri({ uri: documentUri }, panel.webview, event.src);
      panel.webview.postMessage({
        type: 'resolvedImage',
        requestId: event.requestId,
        uri
      });
      return;
    }

    if (event.type === 'copyText') {
      if (typeof event.text === 'string') {
        await vscode.env.clipboard.writeText(event.text);
      }
    }
  });
}

async function syncMarkdownEditorAssociations(value) {
  const useRichEditor = typeof value === 'boolean'
    ? value
    : vscode.workspace
      .getConfiguration('richdown')
      .get('openMarkdownAsRichEditor', true);
  const workbenchConfig = vscode.workspace.getConfiguration('workbench');
  await updateEditorAssociations(workbenchConfig, useRichEditor);
  await updateDiffEditorAssociations(workbenchConfig);
}

async function updateEditorAssociations(workbenchConfig, useRichEditor) {
  const nextAssociations = getConfigurationObject(workbenchConfig, 'editorAssociations');
  let changed = false;

  for (const pattern of legacyMarkdownEditorAssociationPatterns) {
    if (nextAssociations[pattern] === richEditorViewType || nextAssociations[pattern] === 'default') {
      delete nextAssociations[pattern];
      changed = true;
    }
  }

  for (const pattern of markdownFileEditorAssociationPatterns) {
    if (useRichEditor) {
      if (nextAssociations[pattern] !== richEditorViewType) {
        nextAssociations[pattern] = richEditorViewType;
        changed = true;
      }
    } else if (nextAssociations[pattern] === richEditorViewType) {
      delete nextAssociations[pattern];
      changed = true;
    }
  }

  if (changed) {
    await workbenchConfig.update('editorAssociations', nextAssociations, vscode.ConfigurationTarget.Global);
  }
}

async function updateDiffEditorAssociations(workbenchConfig) {
  const nextAssociations = getConfigurationObject(workbenchConfig, 'diffEditorAssociations');
  let changed = false;

  for (const pattern of markdownDiffEditorAssociationPatterns) {
    if (nextAssociations[pattern] !== 'default') {
      nextAssociations[pattern] = 'default';
      changed = true;
    }
  }

  if (changed) {
    await workbenchConfig.update('diffEditorAssociations', nextAssociations, vscode.ConfigurationTarget.Global);
  }
}

function getConfigurationObject(config, key) {
  const value = config.get(key, {});
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
}

async function reopenMarkdownResource(resource, useRichEditor) {
  if (isActiveDiffTab()) {
    return;
  }

  const uri = getMarkdownResourceUri(resource);
  if (!uri) {
    return;
  }

  const activeTabInput = vscode.window.tabGroups?.activeTabGroup?.activeTab?.input;
  if (isSameUri(getTabInputUri(activeTabInput), uri)) {
    try {
      await vscode.commands.executeCommand(
        'reopenActiveEditorWith',
        useRichEditor ? richEditorViewType : 'default'
      );
      return;
    } catch (error) {
      // Fall back to opening explicitly if this VS Code build does not expose the internal reopen command.
    }
  }

  await vscode.commands.executeCommand(
    'vscode.openWith',
    uri,
    useRichEditor ? richEditorViewType : 'default',
    { viewColumn: vscode.ViewColumn.Active, preview: false }
  );
}

function getMarkdownResourceUri(resource) {
  if (isMarkdownUri(resource)) {
    return resource;
  }

  if (isMarkdownUri(resource?.resourceUri)) {
    return resource.resourceUri;
  }

  if (isMarkdownUri(resource?.uri)) {
    return resource.uri;
  }

  if (Array.isArray(resource) && resource.length > 0) {
    return getMarkdownResourceUri(resource[0]);
  }

  const activeEditorUri = vscode.window.activeTextEditor?.document?.uri;
  if (isMarkdownUri(activeEditorUri)) {
    return activeEditorUri;
  }

  const activeTabInput = vscode.window.tabGroups?.activeTabGroup?.activeTab?.input;
  if (isMarkdownUri(activeTabInput?.uri)) {
    return activeTabInput.uri;
  }

  return undefined;
}

function isMarkdownUri(uri) {
  if (!uri || typeof uri.fsPath !== 'string') {
    return false;
  }
  const extension = path.extname(uri.fsPath).toLowerCase();
  return extension === '.md' || extension === '.markdown';
}

function getTabInputUri(input) {
  if (isMarkdownUri(input?.uri)) {
    return input.uri;
  }
  return undefined;
}

function isSameUri(a, b) {
  return Boolean(a && b && a.toString() === b.toString());
}

function isActiveDiffTab() {
  const input = vscode.window.tabGroups?.activeTabGroup?.activeTab?.input;
  if (!input) {
    return false;
  }
  if (typeof vscode.TabInputTextDiff === 'function' && input instanceof vscode.TabInputTextDiff) {
    return true;
  }
  return Boolean(input && typeof input === 'object' && 'original' in input && 'modified' in input);
}

function isPathWithinAllowedScope(absolutePath, documentUri) {
  if (typeof absolutePath !== 'string' || absolutePath.length === 0) {
    return false;
  }
  const normalized = path.normalize(absolutePath);
  for (const segment of normalized.split(path.sep)) {
    if (segment.length > 0 && segment !== '.' && segment !== '..' && segment.startsWith('.')) {
      return false;
    }
  }
  const allowedRoots = [];
  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  for (const folder of workspaceFolders) {
    if (folder?.uri?.fsPath) {
      allowedRoots.push(path.normalize(folder.uri.fsPath));
    }
  }
  if (documentUri && typeof documentUri.fsPath === 'string') {
    allowedRoots.push(path.normalize(path.dirname(documentUri.fsPath)));
  }
  if (allowedRoots.length === 0) {
    return true;
  }
  return allowedRoots.some(root =>
    normalized === root || normalized.startsWith(root + path.sep)
  );
}

class RichdownEditorProvider {
  constructor(context) {
    this.context = context;
  }

  resolveCustomTextEditor(document, webviewPanel) {
    const workspaceRoots = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders.map(folder => folder.uri)
      : [];
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.context.extensionUri,
        vscode.Uri.file(path.dirname(document.uri.fsPath)),
        ...workspaceRoots
      ]
    };

    let queuedWebviewText;
    let applyingWebviewEdit = false;
    const pendingWebviewEditSignatures = new Set();
    let externalFileUpdateTimer;
    let externalFileUpdateSequence = 0;
    let hasDeferredExternalUpdate = false;

    const updateWebview = text => {
      webviewPanel.webview.postMessage({
        type: 'update',
        text: text ?? document.getText()
      });
    };
    const rememberWebviewEdit = text => {
      const signature = makeTextSignature(text);
      pendingWebviewEditSignatures.add(signature);
      if (pendingWebviewEditSignatures.size > 20) {
        pendingWebviewEditSignatures.delete(pendingWebviewEditSignatures.values().next().value);
      }
      return signature;
    };
    const applyQueuedWebviewEdits = async () => {
      if (applyingWebviewEdit) {
        return;
      }

      applyingWebviewEdit = true;
      try {
        while (queuedWebviewText !== undefined) {
          const nextText = queuedWebviewText;
          queuedWebviewText = undefined;

          if (nextText === document.getText()) {
            continue;
          }

          const signature = rememberWebviewEdit(nextText);
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
          );
          edit.replace(document.uri, fullRange, nextText);
          const applied = await vscode.workspace.applyEdit(edit);
          if (!applied) {
            pendingWebviewEditSignatures.delete(signature);
          }
        }
      } finally {
        applyingWebviewEdit = false;
        if (queuedWebviewText !== undefined) {
          void applyQueuedWebviewEdits();
        }
      }
    };
    const updateTheme = () => {
      webviewPanel.webview.postMessage({
        type: 'theme',
        theme: getRichEditorTheme()
      });
    };
    const updateSettings = () => {
      webviewPanel.webview.postMessage({
        type: 'settings',
        settings: getRichEditorSettings()
      });
    };
    let gitDiffUpdateTimer;
    let gitDiffUpdateSequence = 0;
    const postGitDiff = async text => {
      const sequence = ++gitDiffUpdateSequence;
      try {
        const changes = await getGitDiffLineChanges(document, text ?? document.getText());
        if (sequence !== gitDiffUpdateSequence) {
          return;
        }
        webviewPanel.webview.postMessage({
          type: 'gitDiff',
          changes
        });
      } catch (error) {
        if (sequence === gitDiffUpdateSequence) {
          webviewPanel.webview.postMessage({
            type: 'gitDiff',
            changes: []
          });
        }
      }
    };
    const scheduleGitDiffUpdate = (text, delay = 120) => {
      if (gitDiffUpdateTimer) {
        clearTimeout(gitDiffUpdateTimer);
      }
      gitDiffUpdateTimer = setTimeout(() => {
        gitDiffUpdateTimer = undefined;
        void postGitDiff(text);
      }, delay);
    };

    const refreshWebviewFromDisk = async () => {
      const sequence = ++externalFileUpdateSequence;
      try {
        const diskText = await readUriText(document.uri);
        if (sequence !== externalFileUpdateSequence || diskText === document.getText()) {
          hasDeferredExternalUpdate = false;
          return;
        }

        // VS Code normally reloads clean TextDocuments after an external write,
        // which is then handled by onDidChangeTextDocument below. Some tools use
        // atomic file replacement, however, and that notification can arrive late
        // or be missed by a custom editor. Update the webview directly as a
        // fallback. Never replace unsaved Richdown edits with the disk copy.
        if (document.isDirty) {
          hasDeferredExternalUpdate = true;
          return;
        }

        hasDeferredExternalUpdate = false;
        updateWebview(diskText);
        scheduleGitDiffUpdate(diskText, 0);
      } catch (error) {
        // The file may be between rename and create during an atomic write. The
        // create event (or the next focus change) will retry the read.
      }
    };
    const scheduleExternalFileRefresh = (delay = 80) => {
      if (externalFileUpdateTimer) {
        clearTimeout(externalFileUpdateTimer);
      }
      externalFileUpdateTimer = setTimeout(() => {
        externalFileUpdateTimer = undefined;
        void refreshWebviewFromDisk();
      }, delay);
    };

    const externalFileWatcher = document.uri.scheme === 'file'
      ? vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(path.dirname(document.uri.fsPath), '*'),
          false,
          false,
          true
        )
      : undefined;
    const handleWatchedFileChange = uri => {
      if (isSameUri(uri, document.uri)) {
        scheduleExternalFileRefresh();
      }
    };
    externalFileWatcher?.onDidChange(handleWatchedFileChange);
    externalFileWatcher?.onDidCreate(handleWatchedFileChange);

    webviewPanel.webview.html = getRichEditorHtml(this.context, webviewPanel.webview, document.getText(), getRichEditorSettings());
    scheduleGitDiffUpdate(document.getText(), 0);

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.toString() === document.uri.toString()) {
        const nextText = document.getText();
        hasDeferredExternalUpdate = false;
        if (pendingWebviewEditSignatures.delete(makeTextSignature(nextText))) {
          scheduleGitDiffUpdate(nextText);
          return;
        }
        updateWebview(nextText);
        scheduleGitDiffUpdate(nextText);
      }
    });
    const changeConfigurationSubscription = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('richdown.richTheme')) {
        updateTheme();
      }
      if (
        event.affectsConfiguration('richdown.richTablePreview') ||
        event.affectsConfiguration('richdown.mermaidPreview') ||
        event.affectsConfiguration('richdown.mermaidColorized') ||
        event.affectsConfiguration('richdown.mermaidPreviewSize') ||
        event.affectsConfiguration('richdown.gherkinPreview') ||
        event.affectsConfiguration('richdown.previewWidth')
      ) {
        updateSettings();
      }
    });
    const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument(savedDocument => {
      if (
        hasDeferredExternalUpdate &&
        savedDocument.uri.toString() === document.uri.toString()
      ) {
        scheduleExternalFileRefresh(0);
      }
    });
    const windowStateSubscription = vscode.window.onDidChangeWindowState(state => {
      if (state.focused) {
        scheduleExternalFileRefresh(0);
      }
    });
    const viewStateSubscription = webviewPanel.onDidChangeViewState(event => {
      if (event.webviewPanel.visible) {
        scheduleExternalFileRefresh(0);
      }
    });

    webviewPanel.onDidDispose(() => {
      if (gitDiffUpdateTimer) {
        clearTimeout(gitDiffUpdateTimer);
      }
      if (externalFileUpdateTimer) {
        clearTimeout(externalFileUpdateTimer);
      }
      gitDiffUpdateSequence += 1;
      externalFileUpdateSequence += 1;
      externalFileWatcher?.dispose();
      changeDocumentSubscription.dispose();
      changeConfigurationSubscription.dispose();
      saveDocumentSubscription.dispose();
      windowStateSubscription.dispose();
      viewStateSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async event => {
      if (event.type === 'ready') {
        scheduleGitDiffUpdate(document.getText(), 0);
        scheduleExternalFileRefresh(0);
        return;
      }

      if (event.type === 'edit') {
        if (typeof event.text === 'string') {
          queuedWebviewText = event.text;
          void applyQueuedWebviewEdits();
        }
        return;
      }

      if (event.type === 'openLink') {
        await openMarkdownLink(document, event.href);
        return;
      }

      if (event.type === 'resolveImage') {
        const uri = resolveMarkdownImageUri(document, webviewPanel.webview, event.src);
        webviewPanel.webview.postMessage({
          type: 'resolvedImage',
          requestId: event.requestId,
          uri
        });
        return;
      }

      if (event.type === 'copyText') {
        if (typeof event.text === 'string') {
          await vscode.env.clipboard.writeText(event.text);
        }
        return;
      }

      if (event.type === 'webviewError') {
        console.warn(
          `[Richdown] ${event.context || 'webview'}: ${event.message || 'Unknown webview error'}`
        );
        if (event.stack) {
          console.warn(event.stack);
        }
        return;
      }

      if (event.type === 'setTheme') {
        if (!richThemeValues.includes(event.theme)) {
          return;
        }
        await vscode.workspace
          .getConfiguration('richdown')
          .update('richTheme', event.theme, vscode.ConfigurationTarget.Global);
        return;
      }

      if (event.type === 'setRichTablePreview') {
        if (typeof event.value !== 'boolean') {
          return;
        }
        await vscode.workspace
          .getConfiguration('richdown')
          .update('richTablePreview', event.value, vscode.ConfigurationTarget.Global);
        return;
      }

      if (event.type === 'setMermaidPreview') {
        if (typeof event.value !== 'boolean') {
          return;
        }
        await vscode.workspace
          .getConfiguration('richdown')
          .update('mermaidPreview', event.value, vscode.ConfigurationTarget.Global);
        return;
      }

      if (event.type === 'setMermaidColorized') {
        if (typeof event.value !== 'boolean') {
          return;
        }
        await vscode.workspace
          .getConfiguration('richdown')
          .update('mermaidColorized', event.value, vscode.ConfigurationTarget.Global);
        return;
      }

      if (event.type === 'setMermaidPreviewSize') {
        if (!mermaidPreviewSizeValues.includes(event.value)) {
          return;
        }
        await vscode.workspace
          .getConfiguration('richdown')
          .update('mermaidPreviewSize', event.value, vscode.ConfigurationTarget.Global);
        return;
      }

      if (event.type === 'setGherkinPreview') {
        if (typeof event.value !== 'boolean') {
          return;
        }
        await vscode.workspace
          .getConfiguration('richdown')
          .update('gherkinPreview', event.value, vscode.ConfigurationTarget.Global);
        return;
      }

      if (event.type === 'setPreviewWidth') {
        if (!previewWidthValues.includes(event.value)) {
          return;
        }
        await vscode.workspace
          .getConfiguration('richdown')
          .update('previewWidth', event.value, vscode.ConfigurationTarget.Global);
      }
    });
  }
}

function getRichEditorTheme() {
  return vscode.workspace
    .getConfiguration('richdown')
    .get('richTheme', 'default');
}

function getRichEditorSettings() {
  const config = vscode.workspace.getConfiguration('richdown');
  return {
    richTheme: config.get('richTheme', 'default'),
    richTablePreview: config.get('richTablePreview', true),
    mermaidPreview: config.get('mermaidPreview', true),
    mermaidColorized: config.get('mermaidColorized', true),
    mermaidPreviewSize: config.get('mermaidPreviewSize', 'readable'),
    gherkinPreview: config.get('gherkinPreview', true),
    previewWidth: config.get('previewWidth', 'default')
  };
}

async function getGitDiffLineChanges(document, text) {
  if (!document || document.uri.scheme !== 'file') {
    return [];
  }

  const repository = await getGitRepositoryForUri(document.uri);
  if (!repository) {
    return [];
  }

  let headText;
  try {
    headText = await readUriText(createGitHeadUri(document.uri));
  } catch (error) {
    if (!repositoryHasResourceChange(repository, document.uri)) {
      return [];
    }
    headText = '';
  }

  const currentText = typeof text === 'string' ? text : document.getText();
  return createLineChanges(headText, currentText);
}

async function getGitRepositoryForUri(uri) {
  try {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
      return undefined;
    }

    const gitExports = gitExtension.isActive
      ? gitExtension.exports
      : await gitExtension.activate();
    const gitApi = gitExports?.getAPI?.(1);
    if (!gitApi || !Array.isArray(gitApi.repositories)) {
      return undefined;
    }

    return gitApi.repositories
      .filter(repository => isUriInsideRoot(uri, repository.rootUri))
      .sort((left, right) => right.rootUri.fsPath.length - left.rootUri.fsPath.length)[0];
  } catch (error) {
    return undefined;
  }
}

function isUriInsideRoot(uri, rootUri) {
  if (!uri?.fsPath || !rootUri?.fsPath) {
    return false;
  }
  const filePath = path.normalize(uri.fsPath);
  const rootPath = path.normalize(rootUri.fsPath);
  return filePath === rootPath || filePath.startsWith(rootPath + path.sep);
}

function repositoryHasResourceChange(repository, uri) {
  const state = repository?.state;
  if (!state) {
    return false;
  }

  const changeGroups = [
    state.workingTreeChanges,
    state.indexChanges,
    state.mergeChanges,
    state.untrackedChanges
  ];

  return changeGroups.some(group =>
    Array.isArray(group) &&
    group.some(change => isSameUri(change?.resourceUri || change?.uri, uri))
  );
}

function createLineChanges(baseText, currentText) {
  if (baseText === currentText) {
    return [];
  }

  const baseLines = splitDiffLines(baseText);
  const currentLines = splitDiffLines(currentText);
  const lineCount = Math.max(currentLines.length, 1);
  const changesByLine = new Map();

  for (const hunk of createLineDiffHunks(baseLines, currentLines)) {
    appendLineChangeHunk(changesByLine, hunk, lineCount);
  }

  return [...changesByLine.entries()]
    .sort((left, right) => left[0] - right[0])
    .flatMap(([line, types]) =>
      [...types].sort().map(type => ({
        line,
        type
      }))
    );
}

function splitDiffLines(text) {
  if (!text) {
    return [];
  }
  return text.split(/\r\n|\n|\r/);
}

function createLineDiffHunks(baseLines, currentLines) {
  let prefixLength = 0;
  while (
    prefixLength < baseLines.length &&
    prefixLength < currentLines.length &&
    baseLines[prefixLength] === currentLines[prefixLength]
  ) {
    prefixLength += 1;
  }

  let baseEnd = baseLines.length - 1;
  let currentEnd = currentLines.length - 1;
  while (
    baseEnd >= prefixLength &&
    currentEnd >= prefixLength &&
    baseLines[baseEnd] === currentLines[currentEnd]
  ) {
    baseEnd -= 1;
    currentEnd -= 1;
  }

  const baseCount = baseEnd - prefixLength + 1;
  const currentCount = currentEnd - prefixLength + 1;
  if (baseCount <= 0 && currentCount <= 0) {
    return [];
  }
  if (baseCount <= 0 || currentCount <= 0 || baseCount * currentCount > 1200000) {
    return [
      {
        baseStart: prefixLength,
        baseCount: Math.max(baseCount, 0),
        currentStart: prefixLength,
        currentCount: Math.max(currentCount, 0)
      }
    ];
  }

  return createMiddleLineDiffHunks(
    baseLines.slice(prefixLength, baseEnd + 1),
    currentLines.slice(prefixLength, currentEnd + 1),
    prefixLength
  );
}

function createMiddleLineDiffHunks(baseLines, currentLines, offset) {
  const columnCount = currentLines.length + 1;
  const lcs = new Uint32Array((baseLines.length + 1) * columnCount);
  const index = (baseIndex, currentIndex) => baseIndex * columnCount + currentIndex;

  for (let baseIndex = baseLines.length - 1; baseIndex >= 0; baseIndex -= 1) {
    for (
      let currentIndex = currentLines.length - 1;
      currentIndex >= 0;
      currentIndex -= 1
    ) {
      lcs[index(baseIndex, currentIndex)] =
        baseLines[baseIndex] === currentLines[currentIndex]
          ? lcs[index(baseIndex + 1, currentIndex + 1)] + 1
          : Math.max(
            lcs[index(baseIndex + 1, currentIndex)],
            lcs[index(baseIndex, currentIndex + 1)]
          );
    }
  }

  const hunks = [];
  let activeHunk;
  let baseIndex = 0;
  let currentIndex = 0;

  const ensureHunk = () => {
    if (!activeHunk) {
      activeHunk = {
        baseStart: offset + baseIndex,
        baseCount: 0,
        currentStart: offset + currentIndex,
        currentCount: 0
      };
    }
    return activeHunk;
  };
  const flushHunk = () => {
    if (activeHunk) {
      hunks.push(activeHunk);
      activeHunk = undefined;
    }
  };

  while (baseIndex < baseLines.length && currentIndex < currentLines.length) {
    if (baseLines[baseIndex] === currentLines[currentIndex]) {
      flushHunk();
      baseIndex += 1;
      currentIndex += 1;
    } else if (
      lcs[index(baseIndex + 1, currentIndex)] >=
      lcs[index(baseIndex, currentIndex + 1)]
    ) {
      ensureHunk().baseCount += 1;
      baseIndex += 1;
    } else {
      ensureHunk().currentCount += 1;
      currentIndex += 1;
    }
  }

  while (baseIndex < baseLines.length) {
    ensureHunk().baseCount += 1;
    baseIndex += 1;
  }
  while (currentIndex < currentLines.length) {
    ensureHunk().currentCount += 1;
    currentIndex += 1;
  }
  flushHunk();

  return hunks;
}

function appendLineChangeHunk(changesByLine, hunk, lineCount) {
  const pairedCount = Math.min(hunk.baseCount, hunk.currentCount);

  for (let index = 0; index < pairedCount; index += 1) {
    addLineChange(changesByLine, hunk.currentStart + index + 1, 'modified', lineCount);
  }

  for (let index = pairedCount; index < hunk.currentCount; index += 1) {
    addLineChange(changesByLine, hunk.currentStart + index + 1, 'added', lineCount);
  }

  if (hunk.baseCount > pairedCount) {
    addLineChange(
      changesByLine,
      hunk.currentStart + pairedCount + 1,
      'deleted',
      lineCount
    );
  }
}

function addLineChange(changesByLine, lineNumber, type, lineCount) {
  const line = Math.min(Math.max(lineNumber, 1), lineCount);
  const types = changesByLine.get(line) || new Set();
  types.add(type);
  changesByLine.set(line, types);
}

function makeTextSignature(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${hash >>> 0}`;
}

async function openMarkdownLink(document, href) {
  if (!href || typeof href !== 'string') {
    return;
  }

  const external = /^(https?:|mailto:)/i.test(href);
  if (external) {
    await vscode.env.openExternal(vscode.Uri.parse(href));
    return;
  }

  const [pathPart, fragment] = href.split('#');
  let targetUri = document.uri;
  if (pathPart) {
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathPart);
    } catch (error) {
      return;
    }
    const resolved = path.resolve(path.dirname(document.uri.fsPath), decodedPath);
    if (!isPathWithinAllowedScope(resolved, document.uri)) {
      vscode.window.showWarningMessage('Richdown blocked a link that points outside the workspace.');
      return;
    }
    targetUri = vscode.Uri.file(resolved);
  }

  await vscode.commands.executeCommand('vscode.open', targetUri);

  if (fragment) {
    vscode.window.showInformationMessage(`Opened link target: #${fragment}`);
  }
}

function resolveMarkdownImageUri(document, webview, src) {
  if (!src || typeof src !== 'string') {
    return undefined;
  }

  const trimmed = src.trim().replace(/^<|>$/g, '');
  if (/^(https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  try {
    if (/^file:/i.test(trimmed)) {
      const fileUri = vscode.Uri.parse(trimmed);
      if (!isPathWithinAllowedScope(fileUri.fsPath, document.uri)) {
        return undefined;
      }
      return webview.asWebviewUri(fileUri).toString();
    }

    const [pathPart, fragment] = trimmed.split('#');
    const decodedPath = decodeURIComponent(pathPart);
    const imagePath = path.isAbsolute(decodedPath)
      ? decodedPath
      : path.resolve(path.dirname(document.uri.fsPath), decodedPath);
    if (!isPathWithinAllowedScope(imagePath, document.uri)) {
      return undefined;
    }
    const imageUri = webview.asWebviewUri(vscode.Uri.file(imagePath)).toString();
    return fragment ? `${imageUri}#${fragment}` : imageUri;
  } catch (error) {
    return undefined;
  }
}

function getRichEditorHtml(context, webview, initialText, settings) {
  const nonce = getNonce();
  const scriptUri = getWebviewMediaUri(context, webview, 'richEditor.js');
  const mermaidScriptUri = getWebviewMediaUri(context, webview, 'mermaid.js');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: http: data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';">
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }
    #editor {
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="editor" aria-label="Markdown editor"></div>
  <script type="application/json" id="initial-document">${serializeForScript(initialText)}</script>
  <script type="application/json" id="initial-settings">${serializeForScript(settings)}</script>
  <script type="application/json" id="mermaid-script-uri">${serializeForScript(mermaidScriptUri.toString())}</script>
  <script type="application/json" id="initial-git-diff">${serializeForScript([])}</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getWebviewMediaUri(context, webview, fileName) {
  const mediaUri = vscode.Uri.joinPath(context.extensionUri, 'media', fileName);
  const webviewUri = webview.asWebviewUri(mediaUri).toString();
  try {
    const stat = fs.statSync(mediaUri.fsPath);
    return `${webviewUri}?v=${Math.floor(stat.mtimeMs)}`;
  } catch (error) {
    return webviewUri;
  }
}

function getRichDiffHtml(context, webview, diffData, settings) {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'richDiff.js'));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: http: data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';">
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }
    #diff {
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="diff" aria-label="Richdown diff"></div>
  <script type="application/json" id="initial-diff">${serializeForScript(diffData)}</script>
  <script type="application/json" id="initial-settings">${serializeForScript(settings)}</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function serializeForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function getNonce() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

module.exports = {
  activate,
  deactivate
};
