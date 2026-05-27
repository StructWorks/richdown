export function createVsCodeWebviewPort(vscode) {
  return {
    postMessage(message) {
      vscode.postMessage(message);
    },
  };
}
