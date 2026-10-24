// Keeps the Richdown webview and its VS Code TextDocument in step.
//
// The webview sends its whole text after every change, numbered with a
// version, and the host replaces the document with it. Every document change
// that did not come from the webview is sent back as an "update". Two things
// make that echo unsafe while the user is typing:
//
// - The change event for the webview's own edit has to be recognised, or the
//   text it already has comes back to it. Applied texts are remembered by
//   signature for that.
// - VS Code also fires the change event without content changes when the
//   document turns dirty or clean (the first keystroke in a new file, every
//   save). Echoing then sends text that is already older than what the user
//   has typed since; applying it in the webview undoes those keystrokes and
//   breaks an IME composition, which doubles the composed characters.
//
// Updates therefore carry the version of the last webview edit the document
// reflects, and the webview drops any update older than its own last edit:
// that edit is still on its way and replaces the document anyway.

const { applyLineEnding, normalizeToLf } = require("./lineEndings");

const maxRememberedEdits = 20;

function createWebviewDocumentSync({ getText, getLineEnding, replaceText, postMessage }) {
  let queuedEdit;
  let applying = false;
  let appliedVersion = 0;
  // Signature of an applied webview text -> the version it came with.
  const pendingSignatures = new Map();

  function markApplied(version) {
    // Versions only move forward; a leftover signature from an older edit
    // must not make newer updates look stale.
    if (typeof version === "number" && version > appliedVersion) {
      appliedVersion = version;
    }
  }

  function remember(text, version) {
    const signature = makeTextSignature(text);
    pendingSignatures.set(signature, version);
    if (pendingSignatures.size > maxRememberedEdits) {
      pendingSignatures.delete(pendingSignatures.keys().next().value);
    }
    return signature;
  }

  async function applyQueuedEdits() {
    if (applying) {
      return;
    }
    applying = true;
    try {
      while (queuedEdit !== undefined) {
        const { text, version } = queuedEdit;
        queuedEdit = undefined;
        const nextText = applyLineEnding(text, getLineEnding());
        if (nextText === getText()) {
          markApplied(version);
          continue;
        }

        const signature = remember(nextText, version);
        const applied = await replaceText(nextText);
        if (!applied) {
          pendingSignatures.delete(signature);
        }
        // Usually already marked by the change event. A rejected edit is
        // marked too, so the next update brings the webview back in line with
        // the document instead of being dropped as stale.
        markApplied(version);
      }
    } finally {
      applying = false;
      if (queuedEdit !== undefined) {
        void applyQueuedEdits();
      }
    }
  }

  // Only the newest queued text matters: each one is the whole document.
  function receiveEdit(text, version) {
    if (typeof text !== "string") {
      return Promise.resolve();
    }
    queuedEdit = { text, version };
    return applyQueuedEdits();
  }

  // Returns "none" for a change without content, "webview" for the echo of a
  // webview edit, and "external" when the webview was sent the new text.
  function handleDocumentChange(contentChanges) {
    if (contentChanges.length === 0) {
      return "none";
    }
    const signature = makeTextSignature(getText());
    if (pendingSignatures.has(signature)) {
      markApplied(pendingSignatures.get(signature));
      pendingSignatures.delete(signature);
      return "webview";
    }
    postUpdate();
    return "external";
  }

  function postUpdate(text = getText()) {
    postMessage({
      type: "update",
      // The webview editor works in LF; webview edits are converted back to
      // the document's own EOL before they are applied.
      text: normalizeToLf(text),
      version: appliedVersion,
    });
  }

  // Lint results are computed from the document of the moment, so they carry
  // the same version and the webview can drop results for older text.
  function postLintDiagnostics(diagnostics) {
    postMessage({ type: "lintDiagnostics", diagnostics, version: appliedVersion });
  }

  // A reloaded webview numbers its edits from zero again.
  function reset() {
    appliedVersion = 0;
    pendingSignatures.clear();
  }

  return {
    handleDocumentChange,
    postLintDiagnostics,
    postUpdate,
    receiveEdit,
    reset,
    get appliedVersion() {
      return appliedVersion;
    },
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

module.exports = {
  createWebviewDocumentSync,
  makeTextSignature,
};
