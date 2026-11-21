// A short fingerprint of a document's text, to find the file it came from.
//
// An Orca editor frame gets the document's text but not its path. The Orca
// worker finds the Markdown file with the same text in the workspace; the
// frame sends this fingerprint instead of the whole text. Line endings and a
// byte order mark do not count, so the text Orca decoded and the file's bytes
// compare equal.

export function normalizeFingerprintText(text) {
  return String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
}

// { length, hash }: the normalized text's length and a 64-bit hash of it
// (cyrb53-style, two 32-bit lanes), as 16 hex digits.
export function fingerprintText(text) {
  const normalized = normalizeFingerprintText(text);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return {
    length: normalized.length,
    hash: toHex(h2) + toHex(h1),
  };
}

function toHex(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}
