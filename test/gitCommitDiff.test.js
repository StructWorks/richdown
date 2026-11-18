import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  createCommitComparison,
  createGitCommitDiffSource,
  formatRelativeTime,
  loadMarkdownFileDiff,
  parseCommitLog,
  parseNameStatus,
  parseNumstat,
} = require("../src/host/gitCommitDiff.js");

// Output shapes captured from git 2.54 with the flags the module passes.
const RS = "\x1e";
const US = "\x1f";

function logRecord({ hash, short, parents = "", author = "Ada", time = "1700000000", subject }, files = "") {
  return `${RS}${[hash, short, parents, author, time, subject].join(US)}\0${files}`;
}

describe("git commit diff parsing", () => {
  it("reads commits and counts their Markdown files", () => {
    const output =
      logRecord(
        { hash: "c2".padEnd(40, "0"), short: "c200000", parents: "c1".padEnd(40, "0"), subject: "Second" },
        "\nM\0README.md\0R087\0a.md\0docs/a.md\0",
      ) +
      logRecord({ hash: "c1".padEnd(40, "0"), short: "c100000", subject: "Root" }, "\nA\0a.md\0");

    const commits = parseCommitLog(output);

    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      shortHash: "c200000",
      parents: ["c1".padEnd(40, "0")],
      author: "Ada",
      authorTime: 1700000000000,
      subject: "Second",
      isMerge: false,
      markdownFileCount: 2,
    });
    expect(commits[1]).toMatchObject({ parents: [], markdownFileCount: 1 });
  });

  it("marks merge commits, which list no files", () => {
    const [commit] = parseCommitLog(
      logRecord({ hash: "m".padEnd(40, "0"), short: "m000000", parents: "a b", subject: "Merge" }),
    );

    expect(commit.isMerge).toBe(true);
    expect(commit.markdownFileCount).toBe(0);
  });

  it("keeps separators that appear inside a subject", () => {
    const [commit] = parseCommitLog(
      logRecord({ hash: "x".padEnd(40, "0"), short: "x000000", subject: `a${US}b` }),
    );
    expect(commit.subject).toBe(`a${US}b`);
  });

  it("returns no commits for empty output", () => {
    expect(parseCommitLog("")).toEqual([]);
    expect(parseCommitLog(undefined)).toEqual([]);
  });

  it("reads name-status entries, including renames and unusual names", () => {
    expect(
      parseNameStatus("A\0New.MD\0D\0docs/b c.md\0R087\0a.md\0docs/renamed.md\0M\0x.md\0T\0y.md\0"),
    ).toEqual([
      { status: "added", path: "New.MD" },
      { status: "deleted", path: "docs/b c.md" },
      { status: "renamed", path: "docs/renamed.md", oldPath: "a.md" },
      { status: "modified", path: "x.md" },
      { status: "modified", path: "y.md" },
    ]);
  });

  it("treats a copy as an added file", () => {
    expect(parseNameStatus("C100\0a.md\0b.md\0")).toEqual([
      { status: "added", path: "b.md" },
    ]);
  });

  it("reads numstat counts, including renames and binary files", () => {
    const stats = parseNumstat("1\t0\tNew.MD\0" + "0\t1\tdocs/b c.md\0" + "1\t0\t\0a.md\0docs/renamed.md\0" + "-\t-\tlogo.md\0");

    expect(stats.get("New.MD")).toEqual({ additions: 1, deletions: 0 });
    expect(stats.get("docs/b c.md")).toEqual({ additions: 0, deletions: 1 });
    expect(stats.get("docs/renamed.md")).toEqual({ additions: 1, deletions: 0 });
    expect(stats.get("logo.md")).toEqual({ additions: null, deletions: null });
  });
});

describe("git commit diff source", () => {
  function fakeGit(responses) {
    return vi.fn(async (args) => {
      const key = args[0] === "diff" ? `diff ${args.includes("--numstat") ? "numstat" : "name-status"}` : args[0];
      if (!(key in responses)) throw new Error(`unexpected git ${args.join(" ")}`);
      return typeof responses[key] === "function" ? responses[key](args) : responses[key];
    });
  }

  it("limits the log to Markdown pathspecs", async () => {
    const runGit = fakeGit({ log: "" });
    await createGitCommitDiffSource({ runGit }).listCommits({ maxCount: 5 });

    const args = runGit.mock.calls[0][0];
    expect(args).toContain("--max-count=5");
    expect(args.slice(args.indexOf("--") + 1)).toEqual([":(icase)*.md", ":(icase)*.markdown"]);
  });

  it("lists changed files with their line counts, sorted by path", async () => {
    const runGit = fakeGit({
      "diff name-status": "M\0z.md\0A\0a.md\0",
      "diff numstat": "2\t1\tz.md\0" + "4\t0\ta.md\0",
    });

    const files = await createGitCommitDiffSource({ runGit }).listMarkdownChanges("base", "target");

    expect(files).toEqual([
      { status: "added", path: "a.md", additions: 4, deletions: 0 },
      { status: "modified", path: "z.md", additions: 2, deletions: 1 },
    ]);
  });

  it("asks Git once for the empty tree", async () => {
    const runGit = fakeGit({ "hash-object": "4b825dc\n" });
    const source = createGitCommitDiffSource({ runGit });

    expect(await source.getEmptyTree()).toBe("4b825dc");
    expect(await source.getEmptyTree()).toBe("4b825dc");
    expect(runGit).toHaveBeenCalledTimes(1);
    expect(runGit.mock.calls[0][1]).toEqual({ input: "" });
  });

  it("reads one commit by hash without a Markdown filter", async () => {
    const hash = "c3".padEnd(40, "0");
    const runGit = fakeGit({ log: logRecord({ hash, short: "c300000", parents: "c2".padEnd(40, "0"), subject: "Code" }) });

    const commit = await createGitCommitDiffSource({ runGit }).readCommit(hash);

    expect(commit).toMatchObject({ hash, shortHash: "c300000", subject: "Code", isMerge: false });
    const args = runGit.mock.calls[0][0];
    expect(args.slice(-2)).toEqual([hash, "--"]);
    expect(args).toContain("-1");
  });

  it("refuses to read a commit from anything but a hash", async () => {
    const runGit = fakeGit({});
    const source = createGitCommitDiffSource({ runGit });

    await expect(source.readCommit("--output=x")).rejects.toThrow("Not a commit hash");
    await expect(source.readCommit("")).rejects.toThrow("Not a commit hash");
    expect(runGit).not.toHaveBeenCalled();
  });

  it("reports a commit Git does not return", async () => {
    const runGit = fakeGit({ log: "" });
    await expect(createGitCommitDiffSource({ runGit }).readCommit("abcdef1")).rejects.toThrow(
      "Commit abcdef1 was not found.",
    );
  });

  it("reads a file at a revision as a blob", async () => {
    const runGit = fakeGit({ "cat-file": (args) => `text of ${args[2]}` });
    expect(await createGitCommitDiffSource({ runGit }).readFile("abc", "docs/a.md")).toBe(
      "text of abc:docs/a.md",
    );
  });
});

describe("commit comparisons", () => {
  const commit = {
    hash: "c2".padEnd(40, "0"),
    shortHash: "c200000",
    parents: ["p1".padEnd(40, "0")],
    subject: "Second",
  };

  function fakeSource(overrides = {}) {
    return {
      countCommits: vi.fn(async () => 3),
      getEmptyTree: vi.fn(async () => "empty"),
      readFile: vi.fn(async (ref, filePath) => `${ref}:${filePath}`),
      resolveCommit: vi.fn(async () => "h3".padEnd(40, "0")),
      ...overrides,
    };
  }

  it("compares a commit with its first parent", async () => {
    const comparison = await createCommitComparison(fakeSource(), commit);

    expect(comparison).toMatchObject({
      base: commit.parents[0],
      target: commit.hash,
      baseLabel: "p100000",
      targetLabel: "c200000",
      changeLabel: "c200000",
      headHash: null,
    });
  });

  it("compares a root commit with the empty tree", async () => {
    const source = fakeSource();
    const comparison = await createCommitComparison(source, { ...commit, parents: [] });

    expect(comparison.base).toBe("empty");
    expect(comparison.baseLabel).toBe("Empty");
  });

  it("compares from before the commit up to HEAD", async () => {
    const source = fakeSource();
    const comparison = await createCommitComparison(source, commit, { throughHead: true });

    expect(comparison).toMatchObject({
      base: commit.parents[0],
      target: "h3".padEnd(40, "0"),
      targetLabel: "h300000 (HEAD)",
      changeLabel: "c200000…h300000",
      commitCount: 3,
    });
    expect(source.countCommits).toHaveBeenCalledWith(commit.parents[0], "h3".padEnd(40, "0"));
  });

  it("loads both sides of a modified file", async () => {
    const source = fakeSource();
    const comparison = await createCommitComparison(source, commit);
    const diff = await loadMarkdownFileDiff(source, comparison, { status: "modified", path: "docs/a.md" });

    expect(diff).toMatchObject({
      layout: "split",
      fileName: "a.md",
      filePath: "docs/a.md",
      leftText: `${commit.parents[0]}:docs/a.md`,
      rightText: `${commit.hash}:docs/a.md`,
      leftLabel: "p100000",
      rightLabel: "c200000",
    });
  });

  it("reads a renamed file's old side from its old path", async () => {
    const source = fakeSource();
    const comparison = await createCommitComparison(source, commit);
    const diff = await loadMarkdownFileDiff(source, comparison, {
      status: "renamed",
      path: "docs/b.md",
      oldPath: "a.md",
    });

    expect(diff.leftText).toBe(`${commit.parents[0]}:a.md`);
    expect(diff.filePath).toBe("a.md → docs/b.md");
  });

  it("shows an added file as a single pane", async () => {
    const source = fakeSource();
    const comparison = await createCommitComparison(source, commit);
    const diff = await loadMarkdownFileDiff(source, comparison, { status: "added", path: "new.md" });

    expect(diff).toMatchObject({
      layout: "single",
      singleSide: "right",
      rightText: `${commit.hash}:new.md`,
      singleLabel: "Added in c200000",
    });
    expect(source.readFile).toHaveBeenCalledTimes(1);
  });

  it("shows a deleted file as a single pane from the base", async () => {
    const source = fakeSource();
    const comparison = await createCommitComparison(source, commit);
    const diff = await loadMarkdownFileDiff(source, comparison, { status: "deleted", path: "old.md" });

    expect(diff).toMatchObject({
      layout: "single",
      singleSide: "left",
      leftText: `${commit.parents[0]}:old.md`,
      singleLabel: "Deleted in c200000",
    });
  });
});

describe("relative commit times", () => {
  const now = Date.UTC(2026, 10, 15, 12);

  it.each([
    [now - 30 * 1000, "just now"],
    [now - 60 * 1000, "1 minute ago"],
    [now - 3 * 60 * 60 * 1000, "3 hours ago"],
    [now - 2 * 24 * 60 * 60 * 1000, "2 days ago"],
    [now - 400 * 24 * 60 * 60 * 1000, "1 year ago"],
  ])("formats %s", (time, expected) => {
    expect(formatRelativeTime(time, now)).toBe(expected);
  });

  it("returns nothing for an unknown time", () => {
    expect(formatRelativeTime(0, now)).toBe("");
  });
});

// The same calls against a real repository, so the flags and parsing agree
// with what Git actually prints.
function hasGit() {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.runIf(hasGit())("git commit diff against a real repository", () => {
  let repo;
  let source;

  const git = (...args) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" });

  beforeAll(() => {
    repo = mkdtempSync(path.join(tmpdir(), "richdown-commit-diff-"));
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    git("config", "commit.gpgsign", "false");
    writeFileSync(path.join(repo, "a.md"), "# A\n\none\ntwo\nthree\nfour\nfive\n");
    mkdirSync(path.join(repo, "docs"));
    writeFileSync(path.join(repo, "docs", "b c.md"), "# B\n");
    writeFileSync(path.join(repo, "code.js"), "1\n");
    git("add", ".");
    git("commit", "-qm", "Root");
    git("mv", "a.md", "docs/renamed.md");
    writeFileSync(path.join(repo, "docs", "renamed.md"), "# A\n\none\ntwo\nthree\nfour\nfive\nsix\n");
    writeFileSync(path.join(repo, "New.MD"), "# New\n");
    git("rm", "-q", "docs/b c.md");
    git("add", ".");
    git("commit", "-qm", "Rework docs");
    writeFileSync(path.join(repo, "code.js"), "2\n");
    git("commit", "-qam", "Code only");

    source = createGitCommitDiffSource({
      runGit: (args, { input = "" } = {}) =>
        Promise.resolve(
          execFileSync("git", args, { cwd: repo, encoding: "utf8", input }),
        ),
    });
  });

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("lists only commits that touched Markdown", async () => {
    const commits = await source.listCommits();

    expect(commits.map((commit) => commit.subject)).toEqual(["Rework docs", "Root"]);
    expect(commits.map((commit) => commit.markdownFileCount)).toEqual([3, 2]);
  });

  it("lists a commit's Markdown changes and reads both sides", async () => {
    const [rework] = await source.listCommits();
    const comparison = await createCommitComparison(source, rework);
    const files = await source.listMarkdownChanges(comparison.base, comparison.target);

    expect(files).toEqual([
      { status: "deleted", path: "docs/b c.md", additions: 0, deletions: 1 },
      { status: "renamed", path: "docs/renamed.md", oldPath: "a.md", additions: 1, deletions: 0 },
      { status: "added", path: "New.MD", additions: 1, deletions: 0 },
    ]);

    const renamed = await loadMarkdownFileDiff(source, comparison, files[1]);
    expect(renamed.leftText).toBe("# A\n\none\ntwo\nthree\nfour\nfive\n");
    expect(renamed.rightText).toBe("# A\n\none\ntwo\nthree\nfour\nfive\nsix\n");
  });

  it("compares the root commit with the empty tree", async () => {
    const root = (await source.listCommits()).at(-1);
    const comparison = await createCommitComparison(source, root);
    const files = await source.listMarkdownChanges(comparison.base, comparison.target);

    expect(files.map((file) => [file.status, file.path])).toEqual([
      ["added", "a.md"],
      ["added", "docs/b c.md"],
    ]);
  });

  it("reads a commit that did not touch Markdown", async () => {
    const head = git("rev-parse", "HEAD").trim();
    const commit = await source.readCommit(head);

    expect(commit).toMatchObject({ hash: head, subject: "Code only", parents: [expect.any(String)] });
  });

  it("compares from the root commit up to HEAD", async () => {
    const root = (await source.listCommits()).at(-1);
    const comparison = await createCommitComparison(source, root, { throughHead: true });
    const files = await source.listMarkdownChanges(comparison.base, comparison.target);

    expect(comparison.commitCount).toBe(3);
    expect(files.map((file) => [file.status, file.path])).toEqual([
      ["added", "docs/renamed.md"],
      ["added", "New.MD"],
    ]);
  });
});
