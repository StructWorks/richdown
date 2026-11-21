// Image sources for the rich editor inside an Orca editor frame.
//
// The frame can load nothing but the plugin's own files, so every image comes
// from the plugin's worker (src/orcaWorker.js): it finds the open document's
// file, reads the image next to it (or downloads a remote one) and returns it
// in base64 chunks, which become a blob: URL here.
//
// Widgets ask again whenever they are redrawn. A source loaded in the last few
// seconds is reused as is; after that the worker is asked whether it changed
// (same etag: keep the image), so an image an agent rewrites shows up on the
// next redraw.

const RECHECK_MS = 4000;
// Long enough for widgets still showing an old copy to be redrawn.
const REVOKE_DELAY_MS = 30_000;

export function createOrcaImageLoader({
  request,
  locateDocument,
  now = Date.now,
  createObjectUrl = (blob) => URL.createObjectURL(blob),
  revokeObjectUrl = (url) => URL.revokeObjectURL(url),
}) {
  const entries = new Map();

  function resolve(source) {
    if (typeof source !== "string" || source.length === 0) {
      return Promise.reject(new Error("Image could not be resolved."));
    }
    if (/^(data:|blob:)/i.test(source)) {
      return Promise.resolve(source);
    }
    const entry = entries.get(source);
    if (entry?.pending) {
      return entry.pending;
    }
    if (entry?.url && now() - entry.checkedAt < RECHECK_MS) {
      return Promise.resolve(entry.url);
    }
    const pending = load(source, entry).finally(() => {
      const current = entries.get(source);
      if (current?.pending === pending) {
        current.pending = null;
      }
    });
    entries.set(source, { ...entry, pending });
    return pending;
  }

  async function load(source, previous) {
    // The rich editor asks for an embed as "[[name]]".
    const embed = /^\[\[(.*)\]\]$/.exec(source);
    const base = {
      src: embed ? embed[1] : source,
      wikilink: Boolean(embed),
      ...(await locateDocument()),
    };
    const first = await request("richdown.readImage", {
      ...base,
      offset: 0,
      etag: previous?.url ? previous.etag : null,
    });
    if (first?.found && first.notModified && previous?.url) {
      entries.set(source, { ...previous, checkedAt: now(), pending: null });
      return previous.url;
    }
    if (!first?.found || typeof first.data !== "string") {
      entries.delete(source);
      throw new Error("Image not found.");
    }

    const chunks = [decodeBase64(first.data)];
    let received = chunks[0].length;
    let done = first.done === true;
    while (!done && received < first.size) {
      const next = await request("richdown.readImage", { ...base, offset: received });
      if (!next?.found || next.etag !== first.etag || typeof next.data !== "string") {
        // The file changed between chunks; the next redraw starts over.
        entries.delete(source);
        throw new Error("Image changed while loading.");
      }
      const chunk = decodeBase64(next.data);
      if (chunk.length === 0) {
        break;
      }
      chunks.push(chunk);
      received += chunk.length;
      done = next.done === true;
    }

    const url = createObjectUrl(new Blob(chunks, { type: first.mime }));
    if (previous?.url) {
      setTimeout(() => revokeObjectUrl(previous.url), REVOKE_DELAY_MS);
    }
    entries.set(source, { url, etag: first.etag, checkedAt: now(), pending: null });
    return url;
  }

  return { resolve };
}

function decodeBase64(data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
