// The smallest single replacement that turns one document text into another.
//
// The webview sends its whole text after every change. Replacing the whole
// VS Code document with it made every keystroke a full-document edit: the
// window keeps the old and the new text of each edit on its undo stack, and
// every listener (other extensions, language servers) receives the whole
// document again. On long documents that grew the window's memory until it
// crashed with "oom". Only the changed span is replaced instead.
//
// The webview has an ES module counterpart, getMinimalTextChange in
// src/rich-editor/domain/textChange.js; this one is CommonJS for the host and
// also keeps CRLF pairs and surrogate pairs whole, because VS Code document
// offsets cannot point between "\r" and "\n".

function getMinimalTextEdit(currentText, nextText) {
  const maxPrefixLength = Math.min(currentText.length, nextText.length);
  let prefixLength = 0;
  while (
    prefixLength < maxPrefixLength &&
    currentText.charCodeAt(prefixLength) === nextText.charCodeAt(prefixLength)
  ) {
    prefixLength += 1;
  }
  if (prefixLength > 0 && splitsPair(currentText, prefixLength)) {
    prefixLength -= 1;
  }

  const maxSuffixLength = Math.min(currentText.length, nextText.length) - prefixLength;
  let suffixLength = 0;
  while (
    suffixLength < maxSuffixLength &&
    currentText.charCodeAt(currentText.length - suffixLength - 1) ===
      nextText.charCodeAt(nextText.length - suffixLength - 1)
  ) {
    suffixLength += 1;
  }
  if (suffixLength > 0 && splitsPair(currentText, currentText.length - suffixLength)) {
    suffixLength -= 1;
  }

  return {
    from: prefixLength,
    to: currentText.length - suffixLength,
    insert: nextText.slice(prefixLength, nextText.length - suffixLength),
  };
}

// True when an offset falls inside "\r\n" or inside a surrogate pair.
function splitsPair(text, offset) {
  if (offset <= 0 || offset >= text.length) {
    return false;
  }
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return (
    (before === 0x0d && after === 0x0a) ||
    (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
  );
}

module.exports = {
  getMinimalTextEdit,
};
