// The workspace file list that wikilink names are resolved against.
//
// Listing the workspace is expensive (up to 20000 URIs through the window),
// so the list is built once, on the first wikilink lookup, and only then is
// the workspace watched. File creations and deletions used to drop the list
// and make every open editor ask again, which rebuilt it after each event: a
// build or `npm install` rebuilt it hundreds of times. Events are now
// collected for a moment and the list is rebuilt once; editors are told only
// when the list really changed (events in excluded folders change nothing).
// With no editor open the list is just dropped and rebuilt on the next use.

const defaultRefreshDelayMs = 1000;

function createWikilinkFileIndex({
  listFiles,
  watchFiles,
  hasListeners = () => true,
  onChange = () => {},
  refreshDelayMs = defaultRefreshDelayMs,
}) {
  let files; // Promise<string[]> | undefined
  let watcher;
  let refreshTimer;
  let generation = 0;

  function get() {
    if (!files) {
      files = Promise.resolve()
        .then(listFiles)
        .catch(() => []);
      if (!watcher) {
        watcher = watchFiles(handleFileEvent);
      }
    }
    return files;
  }

  function handleFileEvent(fsPath) {
    if (!files || isInsideGitDirectory(fsPath)) {
      return;
    }
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      void refresh();
    }, refreshDelayMs);
  }

  async function refresh() {
    if (!files) {
      return;
    }
    if (!hasListeners()) {
      files = undefined;
      return;
    }
    const current = files;
    const sequence = ++generation;
    let next;
    try {
      next = await listFiles();
    } catch (error) {
      // Keep the list we have; the next event tries again.
      return;
    }
    if (sequence !== generation || files !== current) {
      return;
    }
    if (sameFiles(await current, next)) {
      return;
    }
    files = Promise.resolve(next);
    onChange();
  }

  // Workspace folders changed: the old list is no use at all.
  function reset() {
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
    generation += 1;
    if (!files) {
      return;
    }
    files = undefined;
    onChange();
  }

  function dispose() {
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
    generation += 1;
    files = undefined;
    watcher?.dispose();
    watcher = undefined;
  }

  return { dispose, get, handleFileEvent, reset };
}

function sameFiles(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  const known = new Set(left);
  return right.every((file) => known.has(file));
}

function isInsideGitDirectory(fsPath) {
  return /(^|[\\/])\.git([\\/]|$)/.test(String(fsPath || ""));
}

module.exports = {
  createWikilinkFileIndex,
};
