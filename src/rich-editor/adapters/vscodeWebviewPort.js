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
