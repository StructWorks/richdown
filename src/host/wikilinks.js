// Resolving Obsidian wikilink names to workspace files.
//
// The rich editor only knows the name in [[name]]; the host decides which file
// it means, the way Obsidian does within a vault: the name matches a file name
// or the end of a path, ".md" may be left off, letter case does not matter,
// and when several files match, the one nearest the linking note wins. The
// functions take plain path lists so they stay free of `vscode`.

const path = require("path");

const toPosix = (filePath) => String(filePath).split(path.sep).join("/").replace(/\\/g, "/");

// "note#heading" -> { target: "note", heading: "heading" }.
function splitWikilinkHref(href) {
  const text = String(href ?? "");
  const hash = text.indexOf("#");
  return hash >= 0
    ? { target: text.slice(0, hash).trim(), heading: text.slice(hash + 1).trim() }
    : { target: text.trim(), heading: "" };
}

// The file in `files` (absolute paths) that `target` names, seen from the note
// at `fromPath`, or null.
function resolveWikilinkTarget(target, fromPath, files) {
  const wanted = toPosix(target).replace(/^\.?\/+/, "").toLowerCase();
  if (!wanted) {
    return null;
  }
  const suffixes = [`/${wanted}`, `/${wanted}.md`];
  const candidates = files.filter((file) => {
    const normalized = `/${toPosix(file).replace(/^\/+/, "")}`.toLowerCase();
    return suffixes.some((suffix) => normalized.endsWith(suffix));
  });
  if (candidates.length <= 1) {
    return candidates[0] ?? null;
  }
  const fromDir = fromPath ? path.posix.dirname(toPosix(fromPath)) : "";
  const ranked = candidates.map((file) => ({
    file,
    distance: fromDir ? folderDistance(fromDir, path.posix.dirname(toPosix(file))) : 0,
  }));
  ranked.sort(
    (left, right) =>
      left.distance - right.distance ||
      left.file.length - right.file.length ||
      left.file.localeCompare(right.file),
  );
  return ranked[0].file;
}

// Steps up from `from` to the nearest common folder, then down to `to`.
function folderDistance(from, to) {
  const fromParts = from.split("/").filter(Boolean);
  const toParts = to.split("/").filter(Boolean);
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common += 1;
  }
  return fromParts.length - common + (toParts.length - common);
}

// Completion items for "[[": the shortest name that still finds each file
// (its file name, without ".md" for notes, or a longer path when the name is
// shared), nearest files first.
function wikilinkCompletionItems(files, fromPath, rootPath, limit = 400) {
  const nameOf = (file) => {
    const base = path.posix.basename(toPosix(file));
    return /\.md$/i.test(base) ? base.slice(0, -3) : base;
  };
  const counts = new Map();
  for (const file of files) {
    const key = nameOf(file).toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const fromDir = fromPath ? path.posix.dirname(toPosix(fromPath)) : toPosix(rootPath || "");
  const items = files
    .filter((file) => !fromPath || toPosix(file) !== toPosix(fromPath))
    .map((file) => {
      const relative = rootPath ? path.posix.relative(toPosix(rootPath), toPosix(file)) : nameOf(file);
      const unique = counts.get(nameOf(file).toLowerCase()) === 1;
      return {
        label: unique ? nameOf(file) : relative.replace(/\.md$/i, ""),
        detail: relative,
        distance: folderDistance(fromDir, path.posix.dirname(toPosix(file))),
        note: /\.md$/i.test(file),
      };
    });
  // Notes before other files, then nearest first.
  items.sort(
    (left, right) =>
      Number(right.note) - Number(left.note) ||
      left.distance - right.distance ||
      left.label.localeCompare(right.label),
  );
  return items.slice(0, limit).map(({ label, detail }) => ({ label, detail }));
}

module.exports = {
  resolveWikilinkTarget,
  splitWikilinkHref,
  wikilinkCompletionItems,
};
