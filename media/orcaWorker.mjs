import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/host/wikilinks.js
var require_wikilinks = __commonJS({
  "src/host/wikilinks.js"(exports, module) {
    var path4 = __require("path");
    var toPosix2 = (filePath) => String(filePath).split(path4.sep).join("/").replace(/\\/g, "/");
    function splitWikilinkHref(href) {
      const text = String(href ?? "");
      const hash = text.indexOf("#");
      return hash >= 0 ? { target: text.slice(0, hash).trim(), heading: text.slice(hash + 1).trim() } : { target: text.trim(), heading: "" };
    }
    function resolveWikilinkTarget2(target, fromPath, files) {
      const wanted = toPosix2(target).replace(/^\.?\/+/, "").toLowerCase();
      if (!wanted) {
        return null;
      }
      const suffixes = [`/${wanted}`, `/${wanted}.md`];
      const candidates = files.filter((file) => {
        const normalized = `/${toPosix2(file).replace(/^\/+/, "")}`.toLowerCase();
        return suffixes.some((suffix) => normalized.endsWith(suffix));
      });
      if (candidates.length <= 1) {
        return candidates[0] ?? null;
      }
      const fromDir = fromPath ? path4.posix.dirname(toPosix2(fromPath)) : "";
      const ranked = candidates.map((file) => ({
        file,
        distance: fromDir ? folderDistance(fromDir, path4.posix.dirname(toPosix2(file))) : 0
      }));
      ranked.sort(
        (left, right) => left.distance - right.distance || left.file.length - right.file.length || left.file.localeCompare(right.file)
      );
      return ranked[0].file;
    }
    function folderDistance(from, to) {
      const fromParts = from.split("/").filter(Boolean);
      const toParts = to.split("/").filter(Boolean);
      let common = 0;
      while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
        common += 1;
      }
      return fromParts.length - common + (toParts.length - common);
    }
    function wikilinkCompletionItems(files, fromPath, rootPath, limit = 400) {
      const nameOf = (file) => {
        const base = path4.posix.basename(toPosix2(file));
        return /\.md$/i.test(base) ? base.slice(0, -3) : base;
      };
      const counts = /* @__PURE__ */ new Map();
      for (const file of files) {
        const key = nameOf(file).toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const fromDir = fromPath ? path4.posix.dirname(toPosix2(fromPath)) : toPosix2(rootPath || "");
      const items = files.filter((file) => !fromPath || toPosix2(file) !== toPosix2(fromPath)).map((file) => {
        const relative = rootPath ? path4.posix.relative(toPosix2(rootPath), toPosix2(file)) : nameOf(file);
        const unique = counts.get(nameOf(file).toLowerCase()) === 1;
        return {
          label: unique ? nameOf(file) : relative.replace(/\.md$/i, ""),
          detail: relative,
          distance: folderDistance(fromDir, path4.posix.dirname(toPosix2(file))),
          note: /\.md$/i.test(file)
        };
      });
      items.sort(
        (left, right) => Number(right.note) - Number(left.note) || left.distance - right.distance || left.label.localeCompare(right.label)
      );
      return items.slice(0, limit).map(({ label, detail }) => ({ label, detail }));
    }
    module.exports = {
      resolveWikilinkTarget: resolveWikilinkTarget2,
      splitWikilinkHref,
      wikilinkCompletionItems
    };
  }
});

// src/orca-worker/richdownWorker.js
import path3 from "node:path";

// src/orca-worker/documentLocator.js
import { readFile, stat } from "node:fs/promises";

// src/rich-editor/domain/textFingerprint.js
function normalizeFingerprintText(text) {
  return String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}
function fingerprintText(text) {
  const normalized = normalizeFingerprintText(text);
  let h1 = 3735928559;
  let h2 = 1103547991;
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507);
  h1 ^= Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507);
  h2 ^= Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return {
    length: normalized.length,
    hash: toHex(h2) + toHex(h1)
  };
}
function toHex(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}

// src/orca-worker/workspaceFiles.js
import { readdir } from "node:fs/promises";
import path from "node:path";
var SKIPPED_DIRECTORIES = /* @__PURE__ */ new Set(["node_modules"]);
function createWorkspaceFileIndex({
  maxEntries = 6e4,
  ttlMs = 1e4,
  now = Date.now
} = {}) {
  const cache = /* @__PURE__ */ new Map();
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
function isInsideFolder(filePath, root) {
  const relative = path.relative(root, filePath);
  if (relative === "") {
    return true;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  return relative.split(path.sep).every((segment) => segment.length > 0 && !segment.startsWith("."));
}
function isMarkdownPath(filePath) {
  return /\.(?:md|markdown)$/i.test(filePath);
}

// src/orca-worker/documentLocator.js
var UTF8_BOM_BYTES = 3;
var MAX_MATCHES = 8;
async function locateDocument({ roots, fingerprint, byteLength, listFiles }) {
  for (const root of roots) {
    const markdownFiles = (await listFiles(root)).filter(isMarkdownPath);
    const sizes = await Promise.all(
      markdownFiles.map(
        (file) => stat(file).then(
          (info) => info.size,
          () => -1
        )
      )
    );
    const candidates = markdownFiles.filter(
      (file, index) => sizes[index] === byteLength || sizes[index] === byteLength + UTF8_BOM_BYTES
    );
    const matches = [];
    for (const file of candidates) {
      let text;
      try {
        text = await readFile(file, "utf8");
      } catch (error) {
        continue;
      }
      const candidate = fingerprintText(text);
      if (candidate.length === fingerprint.length && candidate.hash === fingerprint.hash) {
        matches.push(file);
        if (matches.length >= MAX_MATCHES) {
          break;
        }
      }
    }
    if (matches.length > 0) {
      return { root, documentPaths: matches };
    }
  }
  return null;
}

// src/orca-worker/imageSources.js
var import_wikilinks = __toESM(require_wikilinks());
import { open, stat as stat2 } from "node:fs/promises";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
var IMAGE_CHUNK_BYTES = 3 * 128 * 1024;
var MAX_IMAGE_BYTES = 32 * 1024 * 1024;
var IMAGE_TYPES = {
  ".apng": "image/apng",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};
function imageMimeType(filePath) {
  return IMAGE_TYPES[path2.extname(filePath).toLowerCase()] ?? null;
}
function isRemoteImageSource(src) {
  return /^https?:\/\//i.test(String(src).trim().replace(/^</, ""));
}
async function findLocalImage({
  src,
  wikilink = false,
  documentPaths = [],
  workspaceRoot = null,
  allowedRoots = [],
  listFiles
}) {
  const candidates = wikilink ? await wikilinkCandidates(src, documentPaths, workspaceRoot, listFiles) : await pathCandidates(src, documentPaths, workspaceRoot, listFiles);
  const scopes = [
    ...allowedRoots,
    ...documentPaths.map((documentPath) => path2.dirname(documentPath))
  ];
  for (const candidate of candidates) {
    if (!imageMimeType(candidate)) {
      continue;
    }
    if (!scopes.some((root) => isInsideFolder(candidate, root))) {
      continue;
    }
    const info = await stat2(candidate).catch(() => null);
    if (info?.isFile()) {
      return { path: candidate, size: info.size, mtimeMs: info.mtimeMs };
    }
  }
  return null;
}
async function wikilinkCandidates(name, documentPaths, workspaceRoot, listFiles) {
  if (!workspaceRoot) {
    return [];
  }
  const file = (0, import_wikilinks.resolveWikilinkTarget)(
    name,
    documentPaths[0] ?? "",
    await listFiles(workspaceRoot)
  );
  return file ? [file] : [];
}
async function pathCandidates(src, documentPaths, workspaceRoot, listFiles) {
  const imagePath = parseImagePath(src);
  if (!imagePath) {
    return [];
  }
  if (path2.isAbsolute(imagePath)) {
    return workspaceRoot ? [imagePath, path2.join(workspaceRoot, imagePath)] : [imagePath];
  }
  if (documentPaths.length > 0) {
    return documentPaths.map(
      (documentPath) => path2.resolve(path2.dirname(documentPath), imagePath)
    );
  }
  if (!workspaceRoot) {
    return [];
  }
  const wanted = toPosix(path2.normalize(imagePath)).replace(/^(?:\.\.?\/)+/, "");
  if (!wanted) {
    return [];
  }
  return (await listFiles(workspaceRoot)).filter((file) => toPosix(file).endsWith(`/${wanted}`)).sort((left, right) => left.length - right.length);
}
function parseImagePath(src) {
  const trimmed = String(src ?? "").trim().replace(/^<|>$/g, "");
  if (/^file:/i.test(trimmed)) {
    try {
      return fileURLToPath(trimmed.split("#")[0]);
    } catch (error) {
      return null;
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^[a-z]:[\\/]/i.test(trimmed)) {
    return null;
  }
  const pathPart = trimmed.split(/[?#]/)[0];
  if (!pathPart) {
    return null;
  }
  try {
    return decodeURIComponent(pathPart);
  } catch (error) {
    return pathPart;
  }
}
async function readFileChunk(filePath, offset, length = IMAGE_CHUNK_BYTES) {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, offset);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
function createRemoteImageCache({
  fetchImpl = globalThis.fetch,
  ttlMs = 6e4,
  maxEntries = 64,
  timeoutMs = 15e3,
  now = Date.now
} = {}) {
  const cache = /* @__PURE__ */ new Map();
  function get(url) {
    const cached = cache.get(url);
    if (cached && now() - cached.at < ttlMs) {
      return cached.image;
    }
    const image = download(url);
    cache.set(url, { at: now(), image });
    image.catch(() => cache.delete(url));
    while (cache.size > maxEntries) {
      cache.delete(cache.keys().next().value);
    }
    return image;
  }
  async function download(url) {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (declaredLength > MAX_IMAGE_BYTES) {
      throw new Error("Image is too large.");
    }
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const mime = contentType.startsWith("image/") ? contentType : imageMimeType(new URL(url).pathname);
    if (!mime) {
      throw new Error("Not an image.");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error("Image is too large.");
    }
    const etag = response.headers.get("etag") || response.headers.get("last-modified") || `${bytes.length}`;
    return { bytes, mime, etag: `remote:${etag}` };
  }
  return { get };
}
function toPosix(filePath) {
  return String(filePath).split(path2.sep).join("/");
}

// src/orca-worker/richdownWorker.js
var MAX_OTHER_WORKSPACES = 8;
function createRichdownWorker({
  host,
  listFiles = createWorkspaceFileIndex().list,
  remoteImages = createRemoteImageCache(),
  workspaceTtlMs = 1e4,
  now = Date.now
}) {
  let workspaceList = null;
  function localWorkspaces() {
    if (workspaceList && now() - workspaceList.at < workspaceTtlMs) {
      return workspaceList.value;
    }
    const value = host.call("workspace.list").then(
      (result) => (result?.workspaces ?? []).filter(
        (workspace) => (workspace.hostId === "local" || workspace.hostId == null) && typeof workspace.path === "string" && path3.isAbsolute(workspace.path)
      )
    ).catch(() => []);
    workspaceList = { at: now(), value };
    return value;
  }
  async function workspaceRoots() {
    const [workspaces, context] = await Promise.all([
      localWorkspaces(),
      host.call("workspace.readContext").catch(() => null)
    ]);
    const focused = workspaces.find(
      (workspace) => context?.workspaceId && workspace.id === context.workspaceId
    ) ?? workspaces.find(
      (workspace) => context && workspace.name === context.displayName && (workspace.branch ?? "") === (context.branch ?? "")
    );
    const roots = [...new Set(workspaces.map((workspace) => path3.resolve(workspace.path)))];
    return { roots, focusedRoot: focused ? path3.resolve(focused.path) : null };
  }
  async function locate(input) {
    const fingerprint = input?.fingerprint;
    const byteLength = input?.byteLength;
    const { roots, focusedRoot } = await workspaceRoots();
    if (typeof fingerprint?.hash !== "string" || !Number.isInteger(fingerprint?.length) || !Number.isInteger(byteLength)) {
      return { documentPaths: [], workspaceRoot: focusedRoot };
    }
    const searched = [
      ...focusedRoot ? [focusedRoot] : [],
      ...roots.filter((root) => root !== focusedRoot).slice(0, MAX_OTHER_WORKSPACES)
    ];
    const found = await locateDocument({
      roots: searched,
      fingerprint,
      byteLength,
      listFiles
    });
    return found ? { documentPaths: found.documentPaths, workspaceRoot: found.root } : { documentPaths: [], workspaceRoot: focusedRoot };
  }
  async function readImage(input) {
    const src = typeof input?.src === "string" ? input.src.trim() : "";
    if (!src) {
      return { found: false };
    }
    const offset = Number.isInteger(input.offset) && input.offset >= 0 ? input.offset : 0;
    const wikilink = input.wikilink === true;
    if (!wikilink && isRemoteImageSource(src)) {
      let image2;
      try {
        image2 = await remoteImages.get(src.replace(/^<|>$/g, ""));
      } catch (error) {
        return { found: false };
      }
      return answerChunk({
        etag: image2.etag,
        mime: image2.mime,
        size: image2.bytes.length,
        offset,
        knownEtag: input.etag,
        read: async () => image2.bytes.subarray(offset, offset + IMAGE_CHUNK_BYTES)
      });
    }
    const { roots } = await workspaceRoots();
    const workspaceRoot = roots.includes(input.workspaceRoot) ? input.workspaceRoot : null;
    const documentPaths = (Array.isArray(input.documentPaths) ? input.documentPaths : []).filter(
      (documentPath) => typeof documentPath === "string" && isMarkdownPath(documentPath) && roots.some((root) => isInsideFolder(documentPath, root))
    );
    const image = await findLocalImage({
      src,
      wikilink,
      documentPaths,
      workspaceRoot,
      allowedRoots: roots,
      listFiles
    });
    if (!image || image.size > MAX_IMAGE_BYTES) {
      return { found: false };
    }
    return answerChunk({
      etag: `${image.mtimeMs}-${image.size}`,
      mime: imageMimeType(image.path),
      size: image.size,
      offset,
      knownEtag: input.etag,
      read: () => readFileChunk(image.path, offset)
    });
  }
  return { locate, readImage };
}
async function answerChunk({ etag, mime, size, offset, knownEtag, read }) {
  if (offset === 0 && knownEtag && knownEtag === etag) {
    return { found: true, notModified: true, etag };
  }
  const bytes = await read();
  return {
    found: true,
    mime,
    size,
    etag,
    offset,
    data: Buffer.from(bytes).toString("base64"),
    done: offset + bytes.length >= size
  };
}

// src/orcaWorker.js
function activate(orca) {
  const worker = createRichdownWorker({ host: orca.host });
  orca.panels.handle("richdown.locateDocument", (input) => worker.locate(input));
  orca.panels.handle("richdown.readImage", (input) => worker.readImage(input));
}
export {
  activate as default
};
