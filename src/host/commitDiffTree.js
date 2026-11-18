// The Markdown Commits view in Source Control: the recent commits that
// changed Markdown files, each expanding to the files it changed. Selecting a
// commit or one of its files opens the commit diff panel, so after an agent
// has committed its work the review is a click away from Changes.
//
// The tree only reads Git through the repositories `listRepositories()`
// returns ({ rootPath, name, description, source } with a gitCommitDiff
// source). `vscode` is passed in so the tree can be tested without VS Code.

const { createCommitComparison, formatRelativeTime } = require('./gitCommitDiff');

const commitsPerPage = 50;

const fileStatuses = {
  added: { name: 'Added', icon: 'diff-added', color: 'gitDecoration.addedResourceForeground' },
  deleted: { name: 'Deleted', icon: 'diff-removed', color: 'gitDecoration.deletedResourceForeground' },
  modified: { name: 'Modified', icon: 'diff-modified', color: 'gitDecoration.modifiedResourceForeground' },
  renamed: { name: 'Renamed', icon: 'diff-renamed', color: 'gitDecoration.renamedResourceForeground' }
};

function createCommitDiffTree({
  vscode,
  listRepositories,
  getErrorMessage = error => error?.message || String(error),
  formatDate = timeMs => new Date(timeMs).toLocaleString(),
  now = () => Date.now()
}) {
  const changeEmitter = new vscode.EventEmitter();
  // rootPath -> Promise of { headHash, commits, hasMore } or { error }. An
  // error stays until the next refresh rather than running Git on every read.
  const histories = new Map();
  // rootPath -> how many commits the view lists
  const limits = new Map();
  // rootPath + commit hash -> Promise of the commit's changed Markdown files.
  // Commits never change, so these stay cached.
  const commitFiles = new Map();

  const getLimit = rootPath => limits.get(rootPath) || commitsPerPage;

  // Without a rootPath every repository's history is read again.
  function refresh(rootPath) {
    if (rootPath === undefined) {
      histories.clear();
    } else {
      histories.delete(rootPath);
    }
    changeEmitter.fire(undefined);
  }

  function showMore(rootPath) {
    limits.set(rootPath, getLimit(rootPath) + commitsPerPage);
    refresh(rootPath);
  }

  async function getChildren(node) {
    if (!node) {
      const repositories = await listRepositories();
      if (repositories.length === 0) {
        return [];
      }
      // A repository without commits (such as a fresh `git init` nested in
      // the workspace) has nothing to review, so it gets no row.
      const results = await Promise.all(repositories.map(getHistory));
      const shown = repositories.filter((repository, index) => results[index].headHash !== '');
      if (shown.length === 0) {
        return [createMessage('root', 'No commits yet')];
      }
      // One repository needs no repository row above its commits.
      if (shown.length === 1) {
        return getCommitNodes(shown[0]);
      }
      return shown.map(repository => ({ kind: 'repository', repository }));
    }
    if (node.kind === 'repository') {
      return getCommitNodes(node.repository);
    }
    if (node.kind === 'commit') {
      return getFileNodes(node);
    }
    return [];
  }

  function getHistory(repository) {
    const { rootPath, source } = repository;
    if (!histories.has(rootPath)) {
      const limit = getLimit(rootPath);
      const history = (async () => {
        // A repository without commits has no HEAD; git log would fail.
        const headHash = await source.resolveCommit('HEAD').catch(() => '');
        if (!headHash) {
          return { headHash, commits: [], hasMore: false };
        }
        // One extra commit tells whether there are more to show.
        const commits = await source.listCommits({ maxCount: limit + 1 });
        return { headHash, commits: commits.slice(0, limit), hasMore: commits.length > limit };
      })().catch(error => ({ error }));
      histories.set(rootPath, history);
    }
    return histories.get(rootPath);
  }

  async function getCommitNodes(repository) {
    const parentId = `repository:${repository.rootPath}`;
    const history = await getHistory(repository);
    if (history.error) {
      return [createMessage(parentId, `Could not read the Git history: ${getErrorMessage(history.error)}`, 'warning')];
    }
    if (!history.headHash) {
      return [createMessage(parentId, 'No commits yet')];
    }
    if (history.commits.length === 0) {
      return [createMessage(parentId, 'No commits changed Markdown files')];
    }
    const nodes = history.commits.map(commit => ({
      kind: 'commit',
      repository,
      commit,
      isHead: commit.hash === history.headHash
    }));
    if (history.hasMore) {
      nodes.push({ kind: 'more', repository });
    }
    return nodes;
  }

  async function getFileNodes(node) {
    const { repository, commit } = node;
    const key = `${repository.rootPath}\0${commit.hash}`;
    if (!commitFiles.has(key)) {
      const files = createCommitComparison(repository.source, commit)
        .then(comparison => repository.source.listMarkdownChanges(comparison.base, comparison.target));
      files.catch(() => commitFiles.delete(key));
      commitFiles.set(key, files);
    }
    const parentId = getCommitId(node);
    try {
      const files = await commitFiles.get(key);
      if (files.length === 0) {
        // A merge commit can touch Markdown only through its other parents.
        return [createMessage(parentId, 'No Markdown changes against the first parent')];
      }
      return files.map(file => ({ kind: 'file', repository, commit, file }));
    } catch (error) {
      return [createMessage(parentId, `Could not list the files: ${getErrorMessage(error)}`, 'warning')];
    }
  }

  function getTreeItem(node) {
    if (node.kind === 'repository') return getRepositoryItem(node);
    if (node.kind === 'commit') return getCommitItem(node);
    if (node.kind === 'file') return getFileItem(node);
    if (node.kind === 'more') return getMoreItem(node);
    return getMessageItem(node);
  }

  function getRepositoryItem({ repository }) {
    const item = new vscode.TreeItem(repository.name, vscode.TreeItemCollapsibleState.Expanded);
    item.id = `repository:${repository.rootPath}`;
    item.description = repository.description || '';
    item.tooltip = repository.rootPath;
    item.iconPath = new vscode.ThemeIcon('repo');
    item.contextValue = 'richdown.repository';
    return item;
  }

  function getCommitItem(node) {
    const { commit } = node;
    const item = new vscode.TreeItem(commit.subject || '(no subject)', vscode.TreeItemCollapsibleState.Collapsed);
    item.id = getCommitId(node);
    item.description = [commit.shortHash, formatRelativeTime(commit.authorTime, now())]
      .filter(Boolean)
      .join(' · ');
    item.tooltip = [
      commit.subject || '(no subject)',
      [commit.shortHash, commit.author, commit.authorTime ? formatDate(commit.authorTime) : '']
        .filter(Boolean)
        .join(' · '),
      commit.isMerge
        ? 'Merge commit, compared with its first parent'
        : `${commit.markdownFileCount} Markdown file${commit.markdownFileCount === 1 ? '' : 's'}`,
      node.isHead ? 'HEAD' : ''
    ].filter(Boolean).join('\n');
    item.iconPath = new vscode.ThemeIcon('git-commit');
    // HEAD has no later commits, so it does not offer Compare Through HEAD.
    item.contextValue = node.isHead ? 'richdown.commit.head' : 'richdown.commit';
    item.command = {
      command: 'richdown.commitDiff.open',
      title: 'Open Commit Diff',
      arguments: [node]
    };
    return item;
  }

  function getFileItem(node) {
    const { file } = node;
    const status = fileStatuses[file.status] || fileStatuses.modified;
    const slash = file.path.lastIndexOf('/');
    const counts = [
      file.additions ? `+${file.additions}` : '',
      file.deletions ? `-${file.deletions}` : ''
    ].filter(Boolean).join(' ');
    const item = new vscode.TreeItem(
      slash >= 0 ? file.path.slice(slash + 1) : file.path,
      vscode.TreeItemCollapsibleState.None
    );
    item.id = `${getCommitId(node)}:${file.path}`;
    item.description = [slash >= 0 ? file.path.slice(0, slash) : '', counts].filter(Boolean).join(' · ');
    item.tooltip = [
      file.oldPath ? `${file.oldPath} → ${file.path}` : file.path,
      [status.name, counts].filter(Boolean).join(' · ')
    ].join('\n');
    item.iconPath = new vscode.ThemeIcon(status.icon, new vscode.ThemeColor(status.color));
    // A deleted file is not in the working tree, so it cannot be opened.
    item.contextValue = file.status === 'deleted' ? 'richdown.commitFile.deleted' : 'richdown.commitFile';
    item.command = {
      command: 'richdown.commitDiff.open',
      title: 'Open Commit Diff',
      arguments: [node]
    };
    return item;
  }

  function getMoreItem({ repository }) {
    const item = new vscode.TreeItem('Show More Commits', vscode.TreeItemCollapsibleState.None);
    item.id = `more:${repository.rootPath}`;
    item.iconPath = new vscode.ThemeIcon('ellipsis');
    item.command = {
      command: 'richdown.commitDiff.showMore',
      title: 'Show More Commits',
      arguments: [repository.rootPath]
    };
    return item;
  }

  function getMessageItem(node) {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.id = node.id;
    item.iconPath = new vscode.ThemeIcon(node.icon);
    return item;
  }

  return {
    onDidChangeTreeData: changeEmitter.event,
    getChildren,
    getTreeItem,
    refresh,
    showMore,
    dispose() {
      changeEmitter.dispose();
    }
  };
}

function getCommitId({ repository, commit }) {
  return `commit:${repository.rootPath}:${commit.hash}`;
}

function createMessage(parentId, label, icon = 'info') {
  return { kind: 'message', id: `message:${parentId}`, label, icon };
}

module.exports = {
  createCommitDiffTree
};
