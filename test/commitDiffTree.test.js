import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createCommitDiffTree } = require("../src/host/commitDiffTree.js");

// The parts of the VS Code API the tree uses.
const vscode = {
  EventEmitter: class {
    constructor() {
      this.listeners = [];
      this.event = (listener) => this.listeners.push(listener);
    }
    fire(value) {
      this.listeners.forEach((listener) => listener(value));
    }
    dispose() {
      this.listeners = [];
    }
  },
  TreeItem: class {
    constructor(label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon: class {
    constructor(id, color) {
      this.id = id;
      this.color = color;
    }
  },
  ThemeColor: class {
    constructor(id) {
      this.id = id;
    }
  },
};

const now = Date.UTC(2026, 10, 18, 12);

function commit(name, { parents = [`${name}-parent`], subject = `Commit ${name}`, files = 1 } = {}) {
  return {
    hash: `${name}`.padEnd(40, "0"),
    shortHash: `${name}`.padEnd(7, "0"),
    parents,
    author: "Ada",
    authorTime: now - 2 * 60 * 60 * 1000,
    subject,
    isMerge: parents.length > 1,
    markdownFileCount: files,
  };
}

function repository(name, { commits = [], head = commits[0]?.hash ?? "", changes = [] } = {}) {
  return {
    rootPath: `/work/${name}`,
    name,
    description: "",
    source: {
      resolveCommit: vi.fn(async () => {
        if (!head) throw new Error("no HEAD");
        return head;
      }),
      listCommits: vi.fn(async ({ maxCount }) => commits.slice(0, maxCount)),
      getEmptyTree: vi.fn(async () => "empty-tree"),
      listMarkdownChanges: vi.fn(async () => changes),
    },
  };
}

function createTree(repositories) {
  return createCommitDiffTree({
    vscode,
    listRepositories: async () => repositories,
    formatDate: () => "18/11/2026",
    now: () => now,
  });
}

describe("Markdown Commits tree", () => {
  it("lists one repository's commits at the top level", async () => {
    const repo = repository("docs", { commits: [commit("a"), commit("b")] });
    const tree = createTree([repo]);

    const nodes = await tree.getChildren();

    expect(nodes.map((node) => node.kind)).toEqual(["commit", "commit"]);
    expect(nodes[0].isHead).toBe(true);
    expect(nodes[1].isHead).toBe(false);
  });

  it("groups commits under each repository when there are several", async () => {
    const first = repository("app", { commits: [commit("a")] });
    const second = repository("docs", { commits: [commit("b")] });
    const tree = createTree([first, second]);

    const repositories = await tree.getChildren();
    expect(repositories.map((node) => node.repository.name)).toEqual(["app", "docs"]);

    const item = tree.getTreeItem(repositories[0]);
    expect(item).toMatchObject({
      label: "app",
      id: "repository:/work/app",
      collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
    });

    const commits = await tree.getChildren(repositories[1]);
    expect(commits.map((node) => node.commit.subject)).toEqual(["Commit b"]);
  });

  it("describes a commit row and opens the commit diff when selected", async () => {
    const repo = repository("docs", { commits: [commit("a"), commit("b", { files: 2 })] });
    const tree = createTree([repo]);
    const [head, older] = await tree.getChildren();

    const item = tree.getTreeItem(older);

    expect(item).toMatchObject({
      label: "Commit b",
      id: `commit:/work/docs:${older.commit.hash}`,
      description: "b000000 · 2 hours ago",
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: "richdown.commit",
    });
    expect(item.tooltip).toBe("Commit b\nb000000 · Ada · 18/11/2026\n2 Markdown files");
    expect(item.iconPath.id).toBe("git-commit");
    expect(item.command).toMatchObject({ command: "richdown.commitDiff.open", arguments: [older] });
    // HEAD has nothing later to compare through.
    expect(tree.getTreeItem(head).contextValue).toBe("richdown.commit.head");
    expect(tree.getTreeItem(head).tooltip).toContain("\nHEAD");
  });

  it("notes merge commits in the tooltip", async () => {
    const merge = commit("m", { parents: ["p1", "p2"], files: 0 });
    const tree = createTree([repository("docs", { commits: [merge] })]);
    const [node] = await tree.getChildren();

    expect(tree.getTreeItem(node).tooltip).toContain("Merge commit, compared with its first parent");
  });

  it("expands a commit into the Markdown files it changed", async () => {
    const changes = [
      { status: "added", path: "docs/new.md", additions: 4, deletions: 0 },
      { status: "renamed", path: "guide.md", oldPath: "old/guide.md", additions: 1, deletions: 2 },
      { status: "deleted", path: "gone.md", additions: 0, deletions: 3 },
    ];
    const repo = repository("docs", { commits: [commit("a")], changes });
    const tree = createTree([repo]);
    const [commitNode] = await tree.getChildren();

    const files = await tree.getChildren(commitNode);

    expect(repo.source.listMarkdownChanges).toHaveBeenCalledWith("a-parent", commitNode.commit.hash);
    expect(files.map((node) => node.file.path)).toEqual(["docs/new.md", "guide.md", "gone.md"]);

    const added = tree.getTreeItem(files[0]);
    expect(added).toMatchObject({
      label: "new.md",
      description: "docs · +4",
      contextValue: "richdown.commitFile",
      collapsibleState: vscode.TreeItemCollapsibleState.None,
    });
    expect(added.id).toBe(`commit:/work/docs:${commitNode.commit.hash}:docs/new.md`);
    expect(added.iconPath).toMatchObject({ id: "diff-added", color: { id: "gitDecoration.addedResourceForeground" } });
    expect(added.command).toMatchObject({ command: "richdown.commitDiff.open", arguments: [files[0]] });

    const renamed = tree.getTreeItem(files[1]);
    expect(renamed.description).toBe("+1 -2");
    expect(renamed.tooltip).toBe("old/guide.md → guide.md\nRenamed · +1 -2");

    // A deleted file has no working-tree copy to open.
    expect(tree.getTreeItem(files[2]).contextValue).toBe("richdown.commitFile.deleted");
  });

  it("compares a root commit with the empty tree and reads each commit's files once", async () => {
    const root = commit("r", { parents: [] });
    const repo = repository("docs", { commits: [root], changes: [{ status: "added", path: "a.md" }] });
    const tree = createTree([repo]);
    const [commitNode] = await tree.getChildren();

    await tree.getChildren(commitNode);
    await tree.getChildren(commitNode);

    expect(repo.source.listMarkdownChanges).toHaveBeenCalledTimes(1);
    expect(repo.source.listMarkdownChanges).toHaveBeenCalledWith("empty-tree", root.hash);
  });

  it("says so when a merge commit changed no Markdown against its first parent", async () => {
    const repo = repository("docs", { commits: [commit("m", { parents: ["p1", "p2"] })], changes: [] });
    const tree = createTree([repo]);
    const [commitNode] = await tree.getChildren();

    const [message] = await tree.getChildren(commitNode);

    expect(message.kind).toBe("message");
    expect(tree.getTreeItem(message)).toMatchObject({
      label: "No Markdown changes against the first parent",
      id: `message:commit:/work/docs:${commitNode.commit.hash}`,
    });
  });

  it("leaves out repositories without commits", async () => {
    const empty = repository("empty");
    const docs = repository("docs", { commits: [commit("a")] });
    const tree = createTree([empty, docs]);

    const nodes = await tree.getChildren();

    // Only one repository is left, so its commits need no repository row.
    expect(nodes.map((node) => node.kind)).toEqual(["commit"]);
    expect(empty.source.listCommits).not.toHaveBeenCalled();
  });

  it("says so when no repository has commits yet", async () => {
    const tree = createTree([repository("empty"), repository("other")]);
    const [message] = await tree.getChildren();

    expect(tree.getTreeItem(message)).toMatchObject({ label: "No commits yet", id: "message:root" });
  });

  it("says so when no commit changed Markdown", async () => {
    const tree = createTree([repository("code", { head: "h".padEnd(40, "0") })]);
    const [message] = await tree.getChildren();

    expect(tree.getTreeItem(message).label).toBe("No commits changed Markdown files");
  });

  it("keeps a repository whose history could not be read, with the error", async () => {
    const broken = repository("broken", { head: "h".padEnd(40, "0") });
    broken.source.listCommits.mockRejectedValue(new Error("bad object"));
    const tree = createTree([broken, repository("docs", { commits: [commit("a")] })]);

    const nodes = await tree.getChildren();
    expect(nodes.map((node) => node.repository.name)).toEqual(["broken", "docs"]);

    const [message] = await tree.getChildren(nodes[0]);
    expect(tree.getTreeItem(message).label).toBe("Could not read the Git history: bad object");
  });

  it("shows a Git error until the view is refreshed", async () => {
    const repo = repository("docs", { commits: [commit("a")] });
    repo.source.listCommits.mockRejectedValueOnce(new Error("bad object"));
    const tree = createCommitDiffTree({
      vscode,
      listRepositories: async () => [repo],
      getErrorMessage: (error) => `git: ${error.message}`,
    });

    const [message] = await tree.getChildren();
    expect(tree.getTreeItem(message)).toMatchObject({ label: "Could not read the Git history: git: bad object" });
    expect(tree.getTreeItem(message).iconPath.id).toBe("warning");
    expect((await tree.getChildren())[0].kind).toBe("message");
    expect(repo.source.listCommits).toHaveBeenCalledTimes(1);

    tree.refresh();
    const nodes = await tree.getChildren();
    expect(nodes.map((node) => node.kind)).toEqual(["commit"]);
  });

  it("offers more commits when the history is longer than one page", async () => {
    const commits = Array.from({ length: 60 }, (_, index) => commit(`c${index}`));
    const repo = repository("docs", { commits });
    const tree = createTree([repo]);

    const firstPage = await tree.getChildren();
    expect(firstPage).toHaveLength(51);
    const more = firstPage.at(-1);
    expect(more.kind).toBe("more");
    expect(tree.getTreeItem(more).command).toMatchObject({
      command: "richdown.commitDiff.showMore",
      arguments: ["/work/docs"],
    });
    expect(repo.source.listCommits).toHaveBeenLastCalledWith({ maxCount: 51 });

    const changed = vi.fn();
    tree.onDidChangeTreeData(changed);
    tree.showMore("/work/docs");
    expect(changed).toHaveBeenCalledTimes(1);

    const secondPage = await tree.getChildren();
    expect(secondPage).toHaveLength(60);
    expect(secondPage.every((node) => node.kind === "commit")).toBe(true);
  });

  it("reads the history again only after a refresh", async () => {
    const repo = repository("docs", { commits: [commit("a")] });
    const tree = createTree([repo]);
    const changed = vi.fn();
    tree.onDidChangeTreeData(changed);

    await tree.getChildren();
    await tree.getChildren();
    expect(repo.source.listCommits).toHaveBeenCalledTimes(1);

    tree.refresh("/work/other");
    await tree.getChildren();
    expect(repo.source.listCommits).toHaveBeenCalledTimes(1);

    tree.refresh("/work/docs");
    await tree.getChildren();
    expect(repo.source.listCommits).toHaveBeenCalledTimes(2);

    tree.refresh();
    await tree.getChildren();
    expect(repo.source.listCommits).toHaveBeenCalledTimes(3);
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it("returns nothing when there is no repository", async () => {
    expect(await createTree([]).getChildren()).toEqual([]);
  });
});
