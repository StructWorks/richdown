// Markdown changes recorded in Git commits, for the Richdown commit diff.
//
// Coding agents such as Claude Code and Codex often commit (and push) their
// work inside the session, so VS Code's Source Control view has nothing left
// to show. This module reads commit history instead: the recent commits that
// touched Markdown, the Markdown files a commit (or a run of commits up to
// HEAD) changed, and each file's text before and after.
//
// Everything goes through an injected `runGit(args, options)` that resolves to
// git's stdout, so the parsing can be tested without a repository. Paths are
// read with `-z`, which keeps unusual file names unquoted.

const markdownPathspecs = [':(icase)*.md', ':(icase)*.markdown'];
const fieldSeparator = '\x1f';
const recordSeparator = '\x1e';
const logFormat = `--format=${recordSeparator}%H${fieldSeparator}%h${fieldSeparator}%P${fieldSeparator}%an${fieldSeparator}%at${fieldSeparator}%s`;
const defaultMaxCommits = 100;

// `git log -z --format=<record> --name-status`: each record starts with the
// record separator, its fields end with NUL, and the file entries follow as
// NUL-separated tokens (the first one prefixed by a newline).
function parseCommitLog(output) {
  const commits = [];
  for (const record of String(output || '').split(recordSeparator)) {
    if (!record.trim()) {
      continue;
    }
    const headerEnd = record.indexOf('\0');
    const header = headerEnd >= 0 ? record.slice(0, headerEnd) : record;
    const [hash, shortHash, parents, author, authorTime, ...subject] = header.split(fieldSeparator);
    if (!hash) {
      continue;
    }
    const parentHashes = (parents || '').split(' ').filter(Boolean);
    const files = headerEnd >= 0 ? parseNameStatus(record.slice(headerEnd + 1)) : [];
    commits.push({
      hash,
      shortHash: shortHash || hash.slice(0, 7),
      parents: parentHashes,
      author: author || '',
      authorTime: Number(authorTime) * 1000 || 0,
      subject: subject.join(fieldSeparator),
      isMerge: parentHashes.length > 1,
      markdownFileCount: files.length
    });
  }
  return commits;
}

// `git diff --name-status -z`: a status token, then one path, or two for a
// rename or copy (old path first).
function parseNameStatus(output) {
  const tokens = String(output || '').split('\0');
  const files = [];
  let index = 0;
  while (index < tokens.length) {
    const code = tokens[index].trim();
    if (!code) {
      index += 1;
      continue;
    }
    const kind = code[0];
    if (kind === 'R' || kind === 'C') {
      const oldPath = tokens[index + 1];
      const newPath = tokens[index + 2];
      index += 3;
      if (newPath) {
        files.push(kind === 'R'
          ? { status: 'renamed', path: newPath, oldPath }
          : { status: 'added', path: newPath });
      }
      continue;
    }
    const filePath = tokens[index + 1];
    index += 2;
    if (filePath) {
      files.push({ status: getStatusName(kind), path: filePath });
    }
  }
  return files;
}

function getStatusName(kind) {
  if (kind === 'A') return 'added';
  if (kind === 'D') return 'deleted';
  return 'modified';
}

// `git diff --numstat -z`: `added<TAB>deleted<TAB>path` per file, or for a
// rename `added<TAB>deleted<TAB>` followed by the old and new path tokens.
// Binary files report `-` for both counts.
function parseNumstat(output) {
  const tokens = String(output || '').split('\0');
  const stats = new Map();
  let index = 0;
  while (index < tokens.length) {
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(tokens[index].replace(/^\n/, ''));
    if (!match) {
      index += 1;
      continue;
    }
    let filePath = match[3];
    index += 1;
    if (!filePath) {
      filePath = tokens[index + 1];
      index += 2;
    }
    if (filePath) {
      stats.set(filePath, {
        additions: match[1] === '-' ? null : Number(match[1]),
        deletions: match[2] === '-' ? null : Number(match[2])
      });
    }
  }
  return stats;
}

function createGitCommitDiffSource({ runGit }) {
  let emptyTree;

  async function listCommits({ maxCount = defaultMaxCommits } = {}) {
    const output = await runGit([
      'log',
      `--max-count=${maxCount}`,
      '-z',
      '-M',
      logFormat,
      '--name-status',
      '--',
      ...markdownPathspecs
    ]);
    return parseCommitLog(output);
  }

  async function resolveCommit(ref) {
    const output = await runGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return output.trim();
  }

  // One commit by hash, whether or not it changed Markdown (for a commit
  // picked in the Timeline). Its markdownFileCount is not read and stays 0.
  async function readCommit(hash) {
    if (!/^[0-9a-f]{4,64}$/i.test(String(hash || ''))) {
      throw new Error(`Not a commit hash: ${hash}`);
    }
    const output = await runGit(['log', '-1', '-z', logFormat, hash, '--']);
    const [commit] = parseCommitLog(output);
    if (!commit) {
      throw new Error(`Commit ${hash} was not found.`);
    }
    return commit;
  }

  // The empty tree stands in for the parent of a root commit. Asking Git for
  // it keeps SHA-256 repositories working.
  async function getEmptyTree() {
    if (!emptyTree) {
      emptyTree = runGit(['hash-object', '-t', 'tree', '--stdin'], { input: '' })
        .then(output => output.trim());
      emptyTree.catch(() => {
        emptyTree = undefined;
      });
    }
    return emptyTree;
  }

  async function countCommits(base, target) {
    const output = await runGit(['rev-list', '--count', base ? `${base}..${target}` : target]);
    return Number(output.trim()) || 0;
  }

  async function listMarkdownChanges(base, target) {
    const diffArgs = ['diff', '--no-ext-diff', '--no-color', '-M', '-z'];
    const [nameStatus, numstat] = await Promise.all([
      runGit([...diffArgs, '--name-status', base, target, '--', ...markdownPathspecs]),
      runGit([...diffArgs, '--numstat', base, target, '--', ...markdownPathspecs])
    ]);
    const stats = parseNumstat(numstat);
    return parseNameStatus(nameStatus)
      .map(file => ({
        ...file,
        additions: stats.get(file.path)?.additions ?? null,
        deletions: stats.get(file.path)?.deletions ?? null
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  function readFile(ref, filePath) {
    return runGit(['cat-file', 'blob', `${ref}:${filePath}`]);
  }

  return {
    countCommits,
    getEmptyTree,
    listCommits,
    listMarkdownChanges,
    readCommit,
    readFile,
    resolveCommit
  };
}

// What the commit diff compares: one commit against its first parent, or with
// `throughHead`, everything from just before the commit up to HEAD (the usual
// shape of an agent session that made several commits).
async function createCommitComparison(source, commit, { throughHead = false } = {}) {
  const parent = commit.parents[0];
  const abbreviate = hash => hash.slice(0, commit.shortHash.length || 7);
  const base = parent || await source.getEmptyTree();
  const baseLabel = parent ? abbreviate(parent) : 'Empty';

  if (!throughHead) {
    return {
      key: `${base}..${commit.hash}`,
      base,
      target: commit.hash,
      baseLabel,
      targetLabel: commit.shortHash,
      changeLabel: commit.shortHash,
      commit,
      commitCount: 1,
      headHash: null
    };
  }

  const headHash = await source.resolveCommit('HEAD');
  const commitCount = await source.countCommits(parent, headHash);
  return {
    key: `${base}..${headHash}`,
    base,
    target: headHash,
    baseLabel,
    targetLabel: `${abbreviate(headHash)} (HEAD)`,
    changeLabel: `${commit.shortHash}…${abbreviate(headHash)}`,
    commit,
    commitCount,
    headHash
  };
}

// Loads both sides of one changed file. Added and deleted files have only one
// side, so they are shown as a single rendered pane.
async function loadMarkdownFileDiff(source, comparison, file) {
  const fileName = file.path.split('/').pop();
  const filePath = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path;
  const common = { fileName, filePath, status: file.status };

  if (file.status === 'added') {
    const text = await source.readFile(comparison.target, file.path);
    return {
      ...common,
      layout: 'single',
      singleSide: 'right',
      leftText: '',
      rightText: text,
      singleLabel: `Added in ${comparison.changeLabel}`
    };
  }

  if (file.status === 'deleted') {
    const text = await source.readFile(comparison.base, file.path);
    return {
      ...common,
      layout: 'single',
      singleSide: 'left',
      leftText: text,
      rightText: '',
      singleLabel: `Deleted in ${comparison.changeLabel}`
    };
  }

  const [leftText, rightText] = await Promise.all([
    source.readFile(comparison.base, file.oldPath || file.path),
    source.readFile(comparison.target, file.path)
  ]);
  return {
    ...common,
    layout: 'split',
    leftText,
    rightText,
    leftLabel: comparison.baseLabel,
    rightLabel: comparison.targetLabel
  };
}

function formatRelativeTime(timeMs, nowMs = Date.now()) {
  if (!timeMs) {
    return '';
  }
  const seconds = Math.max(0, Math.round((nowMs - timeMs) / 1000));
  const units = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['week', 7 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60]
  ];
  for (const [unit, size] of units) {
    const count = Math.floor(seconds / size);
    if (count >= 1) {
      return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

module.exports = {
  createCommitComparison,
  createGitCommitDiffSource,
  formatRelativeTime,
  loadMarkdownFileDiff,
  parseCommitLog,
  parseNameStatus,
  parseNumstat
};
