const vscode = require('vscode');
const path = require('path');

const richEditorViewType = 'richdown.richEditor';
const legacyMarkdownEditorAssociationPatterns = ['*.md', '*.markdown'];
const markdownFileEditorAssociationPatterns = ['file:/**/*.md', 'file:/**/*.markdown'];
const markdownDiffEditorAssociationPatterns = ['*.md', '*.markdown'];
const richThemeValues = ['default', 'midnight', 'graphite', 'forest', 'ivory', 'paper', 'solar'];
const mermaidPreviewSizeValues = ['source', 'readable', 'large'];
const previewWidthValues = ['default', 'wide'];

let disposables = [];

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('richdown.toggle', toggleMarkdownOpenMode));
  context.subscriptions.push(vscode.commands.registerCommand('richdown.openGitDiff', openGitDiff));
  context.subscriptions.push(vscode.commands.registerCommand('richdown.openRichDiff', resource => openRichDiff(context, resource)));
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
      event.affectsConfiguration('richdown.mermaidPreviewSize') ||
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

    webviewPanel.webview.html = getRichEditorHtml(this.context, webviewPanel.webview, document.getText(), getRichEditorSettings());

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document.uri.toString() === document.uri.toString()) {
        const nextText = document.getText();
        if (pendingWebviewEditSignatures.delete(makeTextSignature(nextText))) {
          return;
        }
        updateWebview(nextText);
      }
    });
    const changeConfigurationSubscription = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('richdown.richTheme')) {
        updateTheme();
      }
      if (
        event.affectsConfiguration('richdown.showEmptyLineHint') ||
        event.affectsConfiguration('richdown.richTablePreview') ||
        event.affectsConfiguration('richdown.mermaidPreview') ||
        event.affectsConfiguration('richdown.mermaidPreviewSize') ||
        event.affectsConfiguration('richdown.previewWidth')
      ) {
        updateSettings();
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      changeConfigurationSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async event => {
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

      if (event.type === 'setShowEmptyLineHint') {
        if (typeof event.value !== 'boolean') {
          return;
        }
        await vscode.workspace
          .getConfiguration('richdown')
          .update('showEmptyLineHint', event.value, vscode.ConfigurationTarget.Global);
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

      if (event.type === 'setMermaidPreviewSize') {
        if (!mermaidPreviewSizeValues.includes(event.value)) {
          return;
        }
        await vscode.workspace
          .getConfiguration('richdown')
          .update('mermaidPreviewSize', event.value, vscode.ConfigurationTarget.Global);
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
    showEmptyLineHint: config.get('showEmptyLineHint', true),
    richTablePreview: config.get('richTablePreview', true),
    mermaidPreview: config.get('mermaidPreview', true),
    mermaidPreviewSize: config.get('mermaidPreviewSize', 'readable'),
    previewWidth: config.get('previewWidth', 'default')
  };
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
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'richEditor.js'));
  const mermaidScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'mermaid.js'));
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
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
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
