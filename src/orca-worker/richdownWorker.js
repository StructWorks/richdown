// What the Orca worker answers for the Richdown editor frame.
//
//   richdown.locateDocument { fingerprint, byteLength }
//     -> { documentPaths, workspaceRoot }: the files the open document may be
//        (empty when none matches) and the workspace it is in.
//   richdown.readImage { src, wikilink, documentPaths, workspaceRoot, offset, etag }
//     -> { found: false } | { found: true, notModified: true, etag }
//      | { found: true, mime, size, etag, offset, data (base64), done }
//
// Only workspaces on this machine are searched; paths the frame sends back are
// checked against them again before any file is read.
import path from "node:path";
import { locateDocument } from "./documentLocator.js";
import {
  findLocalImage,
  IMAGE_CHUNK_BYTES,
  imageMimeType,
  isRemoteImageSource,
  MAX_IMAGE_BYTES,
  readFileChunk,
} from "./imageSources.js";
import { createRemoteImageCache } from "./remoteImages.js";
import {
  createWorkspaceFileIndex,
  isInsideFolder,
  isMarkdownPath,
} from "./workspaceFiles.js";

// Other workspaces searched after the focused one, for a document opened
// from elsewhere.
const MAX_OTHER_WORKSPACES = 8;

export function createRichdownWorker({
  host,
  listFiles = createWorkspaceFileIndex().list,
  remoteImages = createRemoteImageCache(),
  workspaceTtlMs = 10_000,
  now = Date.now,
}) {
  let workspaceList = null;

  function localWorkspaces() {
    if (workspaceList && now() - workspaceList.at < workspaceTtlMs) {
      return workspaceList.value;
    }
    const value = host
      .call("workspace.list")
      .then((result) =>
        (result?.workspaces ?? []).filter(
          (workspace) =>
            (workspace.hostId === "local" || workspace.hostId == null) &&
            typeof workspace.path === "string" &&
            path.isAbsolute(workspace.path),
        ),
      )
      .catch(() => []);
    workspaceList = { at: now(), value };
    return value;
  }

  async function workspaceRoots() {
    const [workspaces, context] = await Promise.all([
      localWorkspaces(),
      host.call("workspace.readContext").catch(() => null),
    ]);
    const focused =
      workspaces.find(
        (workspace) => context?.workspaceId && workspace.id === context.workspaceId,
      ) ??
      workspaces.find(
        (workspace) =>
          context &&
          workspace.name === context.displayName &&
          (workspace.branch ?? "") === (context.branch ?? ""),
      );
    const roots = [...new Set(workspaces.map((workspace) => path.resolve(workspace.path)))];
    return { roots, focusedRoot: focused ? path.resolve(focused.path) : null };
  }

  async function locate(input) {
    const fingerprint = input?.fingerprint;
    const byteLength = input?.byteLength;
    const { roots, focusedRoot } = await workspaceRoots();
    if (
      typeof fingerprint?.hash !== "string" ||
      !Number.isInteger(fingerprint?.length) ||
      !Number.isInteger(byteLength)
    ) {
      return { documentPaths: [], workspaceRoot: focusedRoot };
    }
    const searched = [
      ...(focusedRoot ? [focusedRoot] : []),
      ...roots.filter((root) => root !== focusedRoot).slice(0, MAX_OTHER_WORKSPACES),
    ];
    const found = await locateDocument({
      roots: searched,
      fingerprint,
      byteLength,
      listFiles,
    });
    return found
      ? { documentPaths: found.documentPaths, workspaceRoot: found.root }
      : { documentPaths: [], workspaceRoot: focusedRoot };
  }

  async function readImage(input) {
    const src = typeof input?.src === "string" ? input.src.trim() : "";
    if (!src) {
      return { found: false };
    }
    const offset =
      Number.isInteger(input.offset) && input.offset >= 0 ? input.offset : 0;
    const wikilink = input.wikilink === true;

    if (!wikilink && isRemoteImageSource(src)) {
      let image;
      try {
        image = await remoteImages.get(src.replace(/^<|>$/g, ""));
      } catch (error) {
        return { found: false };
      }
      return answerChunk({
        etag: image.etag,
        mime: image.mime,
        size: image.bytes.length,
        offset,
        knownEtag: input.etag,
        read: async () => image.bytes.subarray(offset, offset + IMAGE_CHUNK_BYTES),
      });
    }

    const { roots } = await workspaceRoots();
    const workspaceRoot = roots.includes(input.workspaceRoot) ? input.workspaceRoot : null;
    const documentPaths = (Array.isArray(input.documentPaths) ? input.documentPaths : [])
      .filter(
        (documentPath) =>
          typeof documentPath === "string" &&
          isMarkdownPath(documentPath) &&
          roots.some((root) => isInsideFolder(documentPath, root)),
      );
    const image = await findLocalImage({
      src,
      wikilink,
      documentPaths,
      workspaceRoot,
      allowedRoots: roots,
      listFiles,
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
      read: () => readFileChunk(image.path, offset),
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
    done: offset + bytes.length >= size,
  };
}
