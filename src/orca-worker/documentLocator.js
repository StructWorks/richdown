// Finds the file an Orca editor frame has open.
//
// Orca gives a custom editor the document's text but never its path, and
// Richdown needs the path to resolve relative images. The frame sends a
// fingerprint of the text as it opened (domain/textFingerprint.js); this looks
// for Markdown files of that size in the workspace and compares fingerprints.
// Every file with the same text is returned, since copies (a README in each
// worktree) are common; images are then looked up next to each in turn.
import { readFile, stat } from "node:fs/promises";
import { fingerprintText } from "../rich-editor/domain/textFingerprint.js";
import { isMarkdownPath } from "./workspaceFiles.js";

const UTF8_BOM_BYTES = 3;
const MAX_MATCHES = 8;

// `roots` in the order to search (the focused workspace first); the first
// root with a match wins. Returns { root, documentPaths } or null.
export async function locateDocument({ roots, fingerprint, byteLength, listFiles }) {
  for (const root of roots) {
    const markdownFiles = (await listFiles(root)).filter(isMarkdownPath);
    const sizes = await Promise.all(
      markdownFiles.map((file) =>
        stat(file).then(
          (info) => info.size,
          () => -1,
        ),
      ),
    );
    const candidates = markdownFiles.filter(
      (file, index) =>
        sizes[index] === byteLength || sizes[index] === byteLength + UTF8_BOM_BYTES,
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
      if (
        candidate.length === fingerprint.length &&
        candidate.hash === fingerprint.hash
      ) {
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
