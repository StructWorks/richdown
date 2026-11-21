// Image files for the Orca editor frame (remote images: remoteImages.js).
//
// The frame has no file system or network, so the worker reads images for it
// and hands them over in base64 chunks. Local images follow the VS Code
// extension's rules: a path relative to the document (or a `file:` URL, or an
// absolute path), inside the workspace or the document's folder, never through
// a hidden folder, and only image file types. `![[name]]` embeds are found by
// name the way wikilinks are.
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWikilinkTarget } from "../host/wikilinks.js";
import { isInsideFolder } from "./workspaceFiles.js";

// A multiple of 3, so the base64 of each chunk can be joined as is; its base64
// stays well under Orca's 1 MiB limit for a request's answer.
export const IMAGE_CHUNK_BYTES = 3 * 128 * 1024;
export const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

const IMAGE_TYPES = {
  ".apng": "image/apng",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export function imageMimeType(filePath) {
  return IMAGE_TYPES[path.extname(filePath).toLowerCase()] ?? null;
}

export function isRemoteImageSource(src) {
  return /^https?:\/\//i.test(String(src).trim().replace(/^</, ""));
}

// The local image `src` names, as { path, size, mtimeMs }, or null.
//   documentPaths: files the open document may be (see documentLocator.js);
//   workspaceRoot: the workspace it is in; allowedRoots: every local
//   workspace; listFiles(root): the workspace's files.
export async function findLocalImage({
  src,
  wikilink = false,
  documentPaths = [],
  workspaceRoot = null,
  allowedRoots = [],
  listFiles,
}) {
  const candidates = wikilink
    ? await wikilinkCandidates(src, documentPaths, workspaceRoot, listFiles)
    : await pathCandidates(src, documentPaths, workspaceRoot, listFiles);
  const scopes = [
    ...allowedRoots,
    ...documentPaths.map((documentPath) => path.dirname(documentPath)),
  ];
  for (const candidate of candidates) {
    if (!imageMimeType(candidate)) {
      continue;
    }
    if (!scopes.some((root) => isInsideFolder(candidate, root))) {
      continue;
    }
    const info = await stat(candidate).catch(() => null);
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
  const file = resolveWikilinkTarget(
    name,
    documentPaths[0] ?? "",
    await listFiles(workspaceRoot),
  );
  return file ? [file] : [];
}

async function pathCandidates(src, documentPaths, workspaceRoot, listFiles) {
  const imagePath = parseImagePath(src);
  if (!imagePath) {
    return [];
  }
  if (path.isAbsolute(imagePath)) {
    // "/images/a.png" is also how documentation sites write a path from the
    // repository root.
    return workspaceRoot
      ? [imagePath, path.join(workspaceRoot, imagePath)]
      : [imagePath];
  }
  if (documentPaths.length > 0) {
    return documentPaths.map((documentPath) =>
      path.resolve(path.dirname(documentPath), imagePath),
    );
  }
  // The document's file is unknown (it has unsaved text, or is outside the
  // workspace): take the workspace file whose path ends the same way.
  if (!workspaceRoot) {
    return [];
  }
  const wanted = toPosix(path.normalize(imagePath)).replace(/^(?:\.\.?\/)+/, "");
  if (!wanted) {
    return [];
  }
  return (await listFiles(workspaceRoot))
    .filter((file) => toPosix(file).endsWith(`/${wanted}`))
    .sort((left, right) => left.length - right.length);
}

// The file path in a Markdown image source, or null for other URL schemes.
export function parseImagePath(src) {
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

export async function readFileChunk(filePath, offset, length = IMAGE_CHUNK_BYTES) {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, offset);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function toPosix(filePath) {
  return String(filePath).split(path.sep).join("/");
}
