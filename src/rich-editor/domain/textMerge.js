// Line-based three-way merge of a document edited in two places at once.
//
// Orca hands a custom editor three versions when the file changes outside
// while the editor still holds edits of its own: `base` (what both started
// from), `outside` (the file as an agent or another tool left it) and `mine`
// (the editor's text). Changes to different lines are combined. When both
// sides changed the same lines differently, both versions are kept between
// Git-style conflict markers, so neither side's text is lost and the reader
// sees exactly where to choose.
import { diffLineOperations } from "../../rich-diff/domain/diffRows.js";

export const CONFLICT_MARKERS = {
  mine: "<<<<<<< Richdown (your edits)",
  separator: "=======",
  outside: ">>>>>>> Changed outside the editor",
};

export function mergeText(base, outside, mine) {
  if (mine === base || mine === outside) {
    return outside;
  }
  if (outside === base) {
    return mine;
  }

  // Splitting on "\n" alone keeps a CRLF document's "\r" on each line, so
  // joining with "\n" restores every version byte for byte.
  const baseLines = base.split("\n");
  const mineHunks = collectHunks(baseLines, mine.split("\n"));
  const outsideHunks = collectHunks(baseLines, outside.split("\n"));
  const lineEnd = base.includes("\r\n") ? "\r" : "";

  const merged = [];
  let position = 0;
  let mineIndex = 0;
  let outsideIndex = 0;

  while (mineIndex < mineHunks.length || outsideIndex < outsideHunks.length) {
    const group = takeOverlappingGroup(
      mineHunks,
      outsideHunks,
      mineIndex,
      outsideIndex,
    );
    mineIndex = group.mineIndex;
    outsideIndex = group.outsideIndex;

    merged.push(...baseLines.slice(position, group.start));
    const mineRegion = applyHunks(baseLines, group.start, group.end, group.mine);
    const outsideRegion = applyHunks(
      baseLines,
      group.start,
      group.end,
      group.outside,
    );
    if (group.mine.length === 0 || sameLines(mineRegion, outsideRegion)) {
      merged.push(...outsideRegion);
    } else if (group.outside.length === 0) {
      merged.push(...mineRegion);
    } else {
      merged.push(
        CONFLICT_MARKERS.mine + lineEnd,
        ...mineRegion,
        CONFLICT_MARKERS.separator + lineEnd,
        ...outsideRegion,
        CONFLICT_MARKERS.outside + lineEnd,
      );
    }
    position = group.end;
  }

  merged.push(...baseLines.slice(position));
  return merged.join("\n");
}

// Changed regions of `baseLines`, in order: { start, end, lines } replaces
// baseLines[start, end) with `lines`. An insertion has start === end.
function collectHunks(baseLines, otherLines) {
  const hunks = [];
  let baseIndex = 0;
  let current = null;
  for (const operation of diffLineOperations(baseLines, otherLines)) {
    if (operation.type === "equal") {
      if (current) {
        hunks.push(current);
        current = null;
      }
      baseIndex += 1;
      continue;
    }
    current ??= { start: baseIndex, end: baseIndex, lines: [] };
    if (operation.type === "delete") {
      baseIndex += 1;
      current.end = baseIndex;
    } else {
      current.lines.push(operation.right.text);
    }
  }
  if (current) {
    hunks.push(current);
  }
  return hunks;
}

// The next run of hunks from either side that touch the same base lines. Two
// hunks overlap when their ranges intersect or when they start at the same
// line (two insertions at one point cannot both go first).
function takeOverlappingGroup(mineHunks, outsideHunks, mineIndex, outsideIndex) {
  const group = { mine: [], outside: [], start: 0, end: 0 };
  const first = nextHunk(mineHunks, outsideHunks, mineIndex, outsideIndex);
  group.start = first.hunk.start;
  group.end = first.hunk.end;

  let added = true;
  while (added) {
    added = false;
    while (
      mineIndex < mineHunks.length &&
      overlaps(group, mineHunks[mineIndex])
    ) {
      const hunk = mineHunks[mineIndex++];
      group.mine.push(hunk);
      group.end = Math.max(group.end, hunk.end);
      added = true;
    }
    while (
      outsideIndex < outsideHunks.length &&
      overlaps(group, outsideHunks[outsideIndex])
    ) {
      const hunk = outsideHunks[outsideIndex++];
      group.outside.push(hunk);
      group.end = Math.max(group.end, hunk.end);
      added = true;
    }
  }
  return { ...group, mineIndex, outsideIndex };
}

function nextHunk(mineHunks, outsideHunks, mineIndex, outsideIndex) {
  const mine = mineHunks[mineIndex];
  const outside = outsideHunks[outsideIndex];
  if (!outside || (mine && mine.start <= outside.start)) {
    return { hunk: mine };
  }
  return { hunk: outside };
}

function overlaps(group, hunk) {
  return hunk.start < group.end || hunk.start === group.start;
}

// baseLines[start, end) with `hunks` (all inside that range) applied.
function applyHunks(baseLines, start, end, hunks) {
  const lines = [];
  let position = start;
  for (const hunk of hunks) {
    lines.push(...baseLines.slice(position, hunk.start), ...hunk.lines);
    position = hunk.end;
  }
  lines.push(...baseLines.slice(position, end));
  return lines;
}

function sameLines(left, right) {
  return (
    left.length === right.length &&
    left.every((line, index) => line === right[index])
  );
}
