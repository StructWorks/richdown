// Detects pending Copilot (chat editing) changes to a document.
//
// VS Code has no extension API for chat editing sessions. While a session
// holds unreviewed edits to a file, though, VS Code keeps the file's
// pre-edit text in a model with the `chat-editing-text-model` scheme and the
// file's path, and every text model is synced to extensions as a
// TextDocument. Keep copies the current text into that model and Undo writes
// the original text back to the file, so the edits are pending exactly while
// the two texts differ.

const { normalizeToLf } = require("./lineEndings");

const CHAT_EDITING_ORIGINAL_SCHEME = "chat-editing-text-model";

function isChatEditingOriginalUri(uri) {
  return uri?.scheme === CHAT_EDITING_ORIGINAL_SCHEME;
}

function hasPendingChatEdits(documents, document) {
  const path = document?.uri?.path;
  if (!path) {
    return false;
  }
  const currentText = normalizeToLf(document.getText());
  return documents.some(
    (candidate) =>
      isChatEditingOriginalUri(candidate.uri) &&
      candidate.uri.path === path &&
      normalizeToLf(candidate.getText()) !== currentText,
  );
}

module.exports = {
  CHAT_EDITING_ORIGINAL_SCHEME,
  hasPendingChatEdits,
  isChatEditingOriginalUri,
};
