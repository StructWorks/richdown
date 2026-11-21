// Files of a workspace folder, for the Orca worker to find documents and images.
//
// Walked breadth first, so files near the root come first, without hidden
// folders (.git and the like) or node_modules, and cached for a few seconds so
// an editor's burst of image requests walks the folder once.
import { readdir } from "node:fs/promises";
import path from "node:path";

const SKIPPED_DIRECTORIES = new Set(["node_modules"]);

export function createWorkspaceFileIndex({
  maxEntries = 60_000,
  ttlMs = 10_000,
  now = Date.now,
} = {}) {
  const cache = new Map();

  function list(root) {
    const cached = cache.get(root);
    if (cached && now() - cached.at < ttlMs) {
      return cached.files;
    }
    const files = walk(root, maxEntries).catch(() => []);
    cache.set(root, { at: now(), files });
    return files;
  }

  return { list };
}

async function walk(root, maxEntries) {
  const files = [];
  const queue = [root];
  let visited = 0;
  while (queue.length > 0 && visited < maxEntries) {
    const directory = queue.shift();
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      visited += 1;
      if (visited > maxEntries) {
        break;
      }
      if (entry.name.startsWith(".")) {
        continue;
      }
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          queue.push(fullPath);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// Whether `filePath` is `root` or inside it, with no hidden folder or file
// (".git", ".env", ".ssh") between the two.
export function isInsideFolder(filePath, root) {
  const relative = path.relative(root, filePath);
  if (relative === "") {
    return true;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  return relative
    .split(path.sep)
    .every((segment) => segment.length > 0 && !segment.startsWith("."));
}

export function isMarkdownPath(filePath) {
  return /\.(?:md|markdown)$/i.test(filePath);
}
