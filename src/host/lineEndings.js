// End-of-line translation between the VS Code document and the webview.
//
// CodeMirror always stores its document with LF line breaks: it splits incoming
// strings on /\r\n?|\n/, so a CRLF document loses its carriage returns as soon
// as it reaches the webview. VS Code keeps the file's own EOL sequence instead,
// and new files on Windows default to CRLF. Without a translation at the
// boundary the two sides never compare equal, so every keystroke was echoed
// back to the webview as an "external" update whose minimal change was a lone
// "\r" — which CodeMirror inserts as an extra line break while the caret is
// remapped against the longer CRLF offsets.
//
// The webview keeps its own copy of normalizeToLf in
// src/rich-editor/domain/textChange.js: this module is CommonJS for the
// extension host, and the two bundles do not share modules.

const LF = "\n";
const CRLF = "\r\n";

function normalizeToLf(text) {
  return String(text ?? "").replace(/\r\n?/g, LF);
}

function applyLineEnding(text, lineEnding) {
  const normalized = normalizeToLf(text);
  return lineEnding === CRLF ? normalized.replace(/\n/g, CRLF) : normalized;
}

module.exports = {
  CRLF,
  LF,
  applyLineEnding,
  normalizeToLf,
};
