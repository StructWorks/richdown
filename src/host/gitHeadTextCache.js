// HEAD copies of files, kept while the repository's HEAD commit stays the same.
//
// The Git change markers diff the editor text against HEAD after every edit.
// Reading HEAD goes through the Git extension (a `git show` per read) and
// passes the whole file through the window each time, although it only
// changes when HEAD moves. Reads are therefore cached per file and HEAD
// commit; a commit, checkout or reset gives a new commit and a fresh read.
// Failed reads (a file that is not in HEAD) are cached too, for the same
// reason. Without a known commit nothing is cached.

const defaultMaxEntries = 32;

function createGitHeadTextCache({ readHeadText, maxEntries = defaultMaxEntries }) {
  // uri key -> { commit, text: Promise<string> }, oldest first.
  const entries = new Map();

  function read(uri, commit) {
    if (!commit) {
      return Promise.resolve().then(() => readHeadText(uri));
    }
    const key = String(uri);
    const cached = entries.get(key);
    if (cached && cached.commit === commit) {
      entries.delete(key);
      entries.set(key, cached);
      return cached.text;
    }
    const text = Promise.resolve().then(() => readHeadText(uri));
    // Callers await the promise right away; this only keeps a cached
    // rejection from being reported as unhandled.
    text.catch(() => {});
    entries.delete(key);
    entries.set(key, { commit, text });
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);
    }
    return text;
  }

  function forget(uri) {
    entries.delete(String(uri));
  }

  return {
    forget,
    read,
    get size() {
      return entries.size;
    },
  };
}

module.exports = {
  createGitHeadTextCache,
};
