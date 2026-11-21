export function createVsCodeWebviewPort(vscode) {
  return {
    postMessage(message) {
      if (vscode && typeof vscode.postMessage === "function") {
        vscode.postMessage(message);
        return;
      }
      if (message?.type === "openLink" && message.href) {
        window.open(message.href, "_blank", "noopener,noreferrer");
      }
    },
  };
}

// The editor host inside a VS Code webview, and in HTML/PDF exports of it.
// The extension serves the initial state as JSON scripts in the page and talks
// to the editor through acquireVsCodeApi() and window "message" events.
export function createVsCodeEditorHost() {
  const runtime = readJsonScript("initial-runtime", {});
  const exportMode = runtime.exportMode === true;
  const vscode =
    typeof acquireVsCodeApi === "function" && !exportMode
      ? acquireVsCodeApi()
      : null;
  const port = createVsCodeWebviewPort(vscode);
  return {
    exportMode,
    readOnly: false,
    initial: {
      document: readJsonScript("initial-document", ""),
      settings: readJsonScript("initial-settings", {}),
      mermaidScriptUri: readJsonScript("mermaid-script-uri", ""),
      gitDiffChanges: readJsonScript("initial-git-diff", []),
      imageMap: readJsonScript("initial-image-map", {}),
      reveal: readJsonScript("initial-reveal", null),
    },
    postMessage: (message) => port.postMessage(message),
    onMessage(handler) {
      window.addEventListener("message", (event) => handler(event.data));
    },
  };
}

function readJsonScript(id, fallback) {
  const element = document.querySelector(`#${id}`);
  if (!element) {
    return fallback;
  }
  try {
    return JSON.parse(element.textContent || "null") ?? fallback;
  } catch (error) {
    return fallback;
  }
}
