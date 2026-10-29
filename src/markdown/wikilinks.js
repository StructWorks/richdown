// Obsidian wikilinks and embeds.
//
//   [[note]]  [[note|alias]]  [[note#heading]]  [[#heading]]
//   ![[image.png]]  ![[image.png|300]]
//
// Only the syntax lives here. Which file a name points to is up to the host
// (the VS Code extension resolves names against the workspace, like Obsidian
// against the vault), so the editor and the diff only ask about names.
// DOM-free, so the rich editor and the Richdown diff share it.

const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;
const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|svg|webp|bmp|avif|ico|tiff?)$/i;

// Every wikilink on a line: { from, to, embed, target, heading, alias, width,
// label, labelFrom, labelTo }. `target` is the note or file name ("" for a
// link to a heading in the same note), `label` the text a reader sees, and
// labelFrom/labelTo the columns of the source text that shows as the label
// when the syntax is hidden. `width` is set for an embed sized with "|300".
export function findWikilinks(text) {
  const links = [];
  for (const match of String(text ?? "").matchAll(WIKILINK)) {
    const embed = match[1] === "!";
    const inner = match[2];
    const innerFrom = match.index + match[1].length + 2;
    const pipe = inner.indexOf("|");
    // Inside a table the alias pipe is escaped, as Obsidian writes it:
    // [[note\|alias]].
    const destination = (pipe >= 0 ? inner.slice(0, pipe) : inner).replace(/\\$/, "");
    const alias = pipe >= 0 ? inner.slice(pipe + 1).trim() : "";
    const hash = destination.indexOf("#");
    const target = (hash >= 0 ? destination.slice(0, hash) : destination).trim();
    const heading = hash >= 0 ? destination.slice(hash + 1).trim() : "";
    if (!target && !heading) {
      continue;
    }
    const size = embed ? /^(\d+)(?:x(\d+))?$/.exec(alias) : null;
    const label = alias && !size ? alias : heading && !target ? heading : destination.trim();
    const labelFrom = alias && !size ? innerFrom + pipe + 1 : innerFrom;
    links.push({
      from: match.index,
      to: match.index + match[0].length,
      embed,
      target,
      heading,
      alias: size ? "" : alias,
      width: size ? Number(size[1]) : null,
      label,
      labelFrom,
      labelTo: alias && !size ? innerFrom + inner.length : innerFrom + (pipe >= 0 ? pipe : inner.length),
    });
  }
  return links;
}

export function isImageTarget(target) {
  return IMAGE_EXTENSION.test(String(target ?? ""));
}

// The name the host resolves: the target with its heading, as written.
export function wikilinkHref(link) {
  return link.heading ? `${link.target}#${link.heading}` : link.target;
}
