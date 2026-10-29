// Asks the host which wikilink names point to a file.
//
// The editor only knows names; the host (the VS Code extension, or any other
// embedder) resolves them however it keeps its file list. Names are batched
// into one "resolveWikilinks" request per turn and cached. Without a host
// (exports, tests) nothing answers, every status stays unknown, and links are
// drawn as plain links.

export function createWikilinkResolver({ postMessage, onChange = () => {} }) {
  // name -> true (a file) | false (no file); absent = not asked or unknown.
  const statuses = new Map();
  const pending = new Set();
  const requested = new Set();
  let requestSequence = 0;
  let flushScheduled = false;
  const openRequests = new Map();

  function status(target) {
    if (!target) {
      return true;
    }
    if (statuses.has(target)) {
      return statuses.get(target);
    }
    if (!requested.has(target)) {
      pending.add(target);
      scheduleFlush();
    }
    return undefined;
  }

  function scheduleFlush() {
    if (flushScheduled) {
      return;
    }
    flushScheduled = true;
    Promise.resolve().then(() => {
      flushScheduled = false;
      if (pending.size === 0) {
        return;
      }
      const targets = [...pending];
      pending.clear();
      targets.forEach((target) => requested.add(target));
      const requestId = String((requestSequence += 1));
      openRequests.set(requestId, targets);
      postMessage({ type: "resolveWikilinks", requestId, targets });
    });
  }

  function handleResolved(message) {
    if (!openRequests.has(message.requestId)) {
      return;
    }
    openRequests.delete(message.requestId);
    let changed = false;
    for (const [target, found] of Object.entries(message.results || {})) {
      if (statuses.get(target) !== Boolean(found)) {
        statuses.set(target, Boolean(found));
        changed = true;
      }
    }
    if (changed) {
      onChange();
    }
  }

  // Files were created or deleted: ask again for every name on screen.
  function invalidate() {
    statuses.clear();
    requested.clear();
    openRequests.clear();
    onChange();
  }

  return { status, handleResolved, invalidate };
}
