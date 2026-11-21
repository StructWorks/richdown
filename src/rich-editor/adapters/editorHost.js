// Picks the embedder the rich editor talks to.
//
// An editor host gives the editor its initial state and carries the message
// protocol between the editor and whatever owns the file:
//
//   {
//     exportMode: boolean,      // read-only HTML/PDF export, no host to answer
//     readOnly: boolean,        // the file cannot be edited
//     initial: { document, settings, mermaidScriptUri, gitDiffChanges,
//                imageMap, reveal },
//     resolveImageSource(src),  // optional: Promise of an image URL; without
//                               // it the editor asks with "resolveImage"
//     postMessage(message),     // editor -> host ("edit", "openLink", ...)
//     onMessage(handler),       // host -> editor ("update", "settings", ...)
//   }
//
// VS Code's webview is the default. Another embedder (the Orca plugin) installs
// its own host before it loads src/richEditor.js.
import { createVsCodeEditorHost } from "./vscodeWebviewPort.js";

let installedHost = null;

export function installEditorHost(host) {
  installedHost = host;
}

export function resolveEditorHost() {
  return installedHost ?? createVsCodeEditorHost();
}
