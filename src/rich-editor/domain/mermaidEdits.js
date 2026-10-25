// Visual edits for non-flowchart Mermaid diagrams.
//
// Like the flowchart helpers in mermaidSource.js, every function takes the
// diagram text and returns new text that differs only in the statements the
// edit touches. Functions that create something also return where it landed
// (an id or a line index) so the editor can select it and open its label for
// renaming. Line indexes are 0-based lines of the diagram text.
import {
  buildMermaidSourceIndex,
  CLASS_RELATION,
  ER_RELATION,
  mindmapLabelSpan,
  SEQUENCE_ARROW,
  SEQUENCE_BLOCK,
  SEQUENCE_BRANCH,
} from "./mermaidIndex.js";
import {
  findMermaidHeaderLine,
  getIndent,
  isIdentifierLike,
  splitMermaidLines,
  tokenPattern,
} from "./mermaidSource.js";

// ---------------------------------------------------------------------------
// Shared helpers

function read(code) {
  const lines = splitMermaidLines(code);
  return { lines, headerIndex: findMermaidHeaderLine(lines) };
}

// Indentation used for new top-level statements: the first body line's.
function bodyIndent(lines, headerIndex) {
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim()) return getIndent(lines[index]) || "    ";
  }
  return "    ";
}

function lastContentLine(lines) {
  let index = lines.length - 1;
  while (index > 0 && !lines[index].trim()) index -= 1;
  return index;
}

function insertLines(lines, at, newLines) {
  const next = [...lines];
  next.splice(at, 0, ...newLines);
  return next.join("\n");
}

function removeLineIndexes(lines, indexes) {
  return lines.filter((_, index) => !indexes.has(index)).join("\n");
}

function uniqueId(base, used) {
  if (!used.has(base)) return base;
  for (let index = 2; ; index += 1) {
    if (!used.has(`${base}${index}`)) return `${base}${index}`;
  }
}

function idFromLabel(label, prefix, used) {
  const clean = String(label ?? "").trim();
  if (isIdentifierLike(clean) && !used.has(clean)) return clean;
  for (let index = 1; ; index += 1) {
    if (!used.has(`${prefix}${index}`)) return `${prefix}${index}`;
  }
}

// Lines [start, end] of a block opened at `start` and closed by the first
// line matching `isClose` at the same nesting depth.
function blockRange(lines, start, isOpen, isClose) {
  let depth = 0;
  for (let index = start; index < lines.length; index += 1) {
    if (index > start && isOpen(lines[index])) depth += 1;
    if (index > start && isClose(lines[index])) {
      if (depth === 0) return [start, index];
      depth -= 1;
    }
  }
  return [start, start];
}

function indentLines(lines, from, to, by) {
  return lines.map((line, index) =>
    index >= from && index <= to && line.trim() ? `${by}${line}` : line,
  );
}

function dedentLines(lines, from, to, by) {
  return lines.map((line, index) =>
    index >= from && index <= to && line.startsWith(by) ? line.slice(by.length) : line,
  );
}

// ---------------------------------------------------------------------------
// Sequence diagrams

export const SEQUENCE_ARROWS = [
  { key: "->>", label: "Solid arrow" },
  { key: "-->>", label: "Dashed arrow" },
  { key: "->", label: "Solid line" },
  { key: "-->", label: "Dashed line" },
  { key: "-x", label: "Solid cross" },
  { key: "--x", label: "Dashed cross" },
  { key: "-)", label: "Async" },
  { key: "--)", label: "Dashed async" },
  { key: "<<->>", label: "Both ways" },
  { key: "<<-->>", label: "Both ways, dashed" },
];

export const SEQUENCE_BLOCKS = [
  { key: "loop", label: "Loop" },
  { key: "alt", label: "Alternative" },
  { key: "opt", label: "Optional" },
  { key: "par", label: "Parallel" },
  { key: "critical", label: "Critical" },
  { key: "break", label: "Break" },
];

const SEQUENCE_DECLARATION =
  /^(\s*)(create\s+)?(participant|actor)\s+([^\s]+)(?:\s+as\s+(.+))?\s*$/;

export function parseSequenceMessage(text) {
  const match = String(text ?? "").match(SEQUENCE_ARROW);
  if (!match) return null;
  return {
    indent: match[1],
    from: match[2].trim(),
    arrow: match[3],
    activation: match[4],
    to: match[5].trim(),
    text: match[6].trim(),
  };
}

export function classifySequenceLine(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || trimmed.startsWith("%%")) return null;
  if (SEQUENCE_DECLARATION.test(text)) return "participant";
  if (parseSequenceMessage(text)) return "message";
  if (/^note\s+(left of|right of|over)\b/i.test(trimmed)) return "note";
  if (SEQUENCE_BLOCK.test(text) || /^box\b/.test(trimmed)) return "block";
  if (SEQUENCE_BRANCH.test(text)) return "branch";
  if (/^end\b/.test(trimmed)) return "end";
  if (/^(activate|deactivate)\s/.test(trimmed)) return "activation";
  if (/^autonumber\b/.test(trimmed)) return "autonumber";
  return null;
}

// Participants in Mermaid's drawing order: first declaration or use.
export function getSequenceParticipants(code) {
  const { lines, headerIndex } = read(code);
  const participants = new Map();
  const see = (id, lineIndex, declaration = null) => {
    if (!id) return;
    const existing = participants.get(id);
    if (existing) {
      if (declaration && existing.declarationLine < 0) {
        Object.assign(existing, declaration, { declarationLine: lineIndex });
      }
      return;
    }
    participants.set(id, {
      id,
      label: declaration?.label ?? id,
      keyword: declaration?.keyword ?? "participant",
      declarationLine: declaration ? lineIndex : -1,
      created: Boolean(declaration?.created),
    });
  };
  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const text = lines[lineIndex];
    const declaration = text.match(SEQUENCE_DECLARATION);
    if (declaration) {
      see(declaration[4], lineIndex, {
        label: declaration[5]?.trim() ?? declaration[4],
        keyword: declaration[3],
        created: Boolean(declaration[2]),
      });
      continue;
    }
    const message = parseSequenceMessage(text);
    if (message) {
      see(message.from, lineIndex);
      see(message.to, lineIndex);
    }
  }
  return [...participants.values()];
}

export function hasSequenceAutonumber(code) {
  return splitMermaidLines(code).some((line) => /^\s*autonumber\b/.test(line));
}

export function toggleSequenceAutonumber(code) {
  const { lines, headerIndex } = read(code);
  const existing = lines.findIndex((line) => /^\s*autonumber\b/.test(line));
  if (existing >= 0) {
    return removeLineIndexes(lines, new Set([existing]));
  }
  return insertLines(lines, headerIndex + 1, [`${bodyIndent(lines, headerIndex)}autonumber`]);
}

export function addSequenceParticipant(code, label = "Participant") {
  const { lines, headerIndex } = read(code);
  const participants = getSequenceParticipants(code);
  const used = new Set(participants.map((participant) => participant.id));
  const clean = String(label).trim() || "Participant";
  const id = idFromLabel(clean, "P", used);
  const declaration =
    id === clean ? `participant ${id}` : `participant ${id} as ${clean.replace(/\r?\n/g, " ")}`;
  const declared = participants.filter((participant) => participant.declarationLine >= 0 && !participant.created);
  const at = declared.length
    ? Math.max(...declared.map((participant) => participant.declarationLine)) + 1
    : headerIndex + 1;
  const indent = declared.length
    ? getIndent(lines[declared[declared.length - 1].declarationLine])
    : bodyIndent(lines, headerIndex);
  return { code: insertLines(lines, at, [`${indent}${declaration}`]), id, lineIndex: at };
}

// Statement indent for a line inserted after `afterLine`: inside a block when
// that line opens one.
function statementIndent(lines, headerIndex, afterLine) {
  if (afterLine === null || afterLine === undefined || afterLine < 0) {
    return bodyIndent(lines, headerIndex);
  }
  const text = lines[afterLine];
  const indent = getIndent(text);
  return SEQUENCE_BLOCK.test(text) || SEQUENCE_BRANCH.test(text) || /^\s*box\b/.test(text)
    ? `${indent}  `
    : indent;
}

function insertionPoint(lines, afterLine) {
  return afterLine === null || afterLine === undefined || afterLine < 0
    ? lastContentLine(lines) + 1
    : afterLine + 1;
}

export function addSequenceMessage(
  code,
  { from, to, text = "Message", arrow = "->>", afterLine = null } = {},
) {
  const { lines, headerIndex } = read(code);
  if (!from || !to) return { code, lineIndex: -1 };
  const indent = statementIndent(lines, headerIndex, afterLine);
  const at = insertionPoint(lines, afterLine);
  const message = String(text).replace(/\r?\n/g, " ");
  return {
    code: insertLines(lines, at, [`${indent}${from}${arrow}${to}: ${message}`]),
    lineIndex: at,
  };
}

export function setSequenceMessageArrow(code, lineIndex, arrow) {
  const { lines } = read(code);
  const message = parseSequenceMessage(lines[lineIndex]);
  if (!message || !SEQUENCE_ARROWS.some((entry) => entry.key === arrow)) return code;
  const text = lines[lineIndex];
  const at = text.indexOf(message.arrow, message.indent.length + message.from.length);
  lines[lineIndex] = text.slice(0, at) + arrow + text.slice(at + message.arrow.length);
  return lines.join("\n");
}

export function reverseSequenceMessage(code, lineIndex) {
  const { lines } = read(code);
  const message = parseSequenceMessage(lines[lineIndex]);
  if (!message) return code;
  lines[lineIndex] =
    `${message.indent}${message.to}${message.arrow}${message.activation}${message.from}: ${message.text}`;
  return lines.join("\n");
}

export function addSequenceNote(code, participantIds, { text = "Note", afterLine = null } = {}) {
  const { lines, headerIndex } = read(code);
  const ids = [...new Set(participantIds.filter(Boolean))];
  if (!ids.length) return { code, lineIndex: -1 };
  const placement = ids.length === 1 ? `right of ${ids[0]}` : `over ${ids.slice(0, 2).join(",")}`;
  const indent = statementIndent(lines, headerIndex, afterLine);
  const at = insertionPoint(lines, afterLine);
  return {
    code: insertLines(lines, at, [`${indent}Note ${placement}: ${text}`]),
    lineIndex: at,
  };
}

function isSequenceOpener(line) {
  return SEQUENCE_BLOCK.test(line) || /^\s*box\b/.test(line);
}

function isSequenceEnd(line) {
  return /^\s*end\s*$/.test(line);
}

// Wraps a statement (or a whole block) in loop/alt/opt/... ... end.
export function wrapSequenceStatement(code, lineIndex, kind = "loop", title = "") {
  const { lines } = read(code);
  if (lineIndex < 0 || lineIndex >= lines.length || !lines[lineIndex].trim()) {
    return { code, lineIndex: -1 };
  }
  const [start, end] = isSequenceOpener(lines[lineIndex])
    ? blockRange(lines, lineIndex, isSequenceOpener, isSequenceEnd)
    : [lineIndex, lineIndex];
  const indent = getIndent(lines[start]);
  const caption = String(title || SEQUENCE_BLOCKS.find((block) => block.key === kind)?.label || kind);
  const indented = indentLines(lines, start, end, "  ");
  indented.splice(end + 1, 0, `${indent}end`);
  indented.splice(start, 0, `${indent}${kind} ${caption}`);
  return { code: indented.join("\n"), lineIndex: start };
}

// Removes one statement. Removing a block opener keeps its contents and drops
// its matching `end`.
export function removeSequenceLine(code, lineIndex) {
  const { lines } = read(code);
  if (lineIndex < 0 || lineIndex >= lines.length) return code;
  if (isSequenceOpener(lines[lineIndex])) {
    const [start, end] = blockRange(lines, lineIndex, isSequenceOpener, isSequenceEnd);
    const dedented = end > start ? dedentLines(lines, start + 1, end - 1, "  ") : lines;
    return removeLineIndexes(dedented, new Set(end > start ? [start, end] : [start]));
  }
  return removeLineIndexes(lines, new Set([lineIndex]));
}

export function removeSequenceParticipant(code, id) {
  const { lines } = read(code);
  const result = [];
  lines.forEach((text) => {
    const declaration = text.match(SEQUENCE_DECLARATION);
    if (declaration && declaration[4] === id) return;
    const message = parseSequenceMessage(text);
    if (message && (message.from === id || message.to === id)) return;
    if (new RegExp(`^\\s*(activate|deactivate|destroy)\\s+${tokenPattern(id).source}\\s*$`, "u").test(text)) {
      return;
    }
    const note = text.match(/^(\s*note\s+)(left of|right of|over)\s+([^:]+?)(\s*:.*)$/i);
    if (note) {
      const ids = note[3].split(",").map((part) => part.trim());
      if (ids.includes(id)) {
        const rest = ids.filter((part) => part !== id);
        if (!rest.length) return;
        result.push(`${note[1]}${note[2]} ${rest.join(",")}${note[4]}`);
        return;
      }
    }
    result.push(text);
  });
  return result.join("\n");
}

// Reorders participants. Mermaid draws them in order of first appearance, so
// every participant gets an explicit declaration at the top in the new order.
export function canMoveSequenceParticipants(code) {
  // Rewriting declarations would pull participants out of their `box` group.
  return !splitMermaidLines(code).some((line) => /^\s*box\b/.test(line));
}

export function moveSequenceParticipant(code, id, delta) {
  if (!canMoveSequenceParticipants(code)) return code;
  const participants = getSequenceParticipants(code).filter((participant) => !participant.created);
  const from = participants.findIndex((participant) => participant.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= participants.length) return code;
  const order = [...participants];
  [order[from], order[to]] = [order[to], order[from]];
  const { lines, headerIndex } = read(code);
  const declarationLines = new Set(
    participants.filter((participant) => participant.declarationLine >= 0).map((participant) => participant.declarationLine),
  );
  const indent = bodyIndent(lines, headerIndex);
  const declarations = order.map((participant) =>
    participant.declarationLine >= 0
      ? `${indent}${lines[participant.declarationLine].trim()}`
      : `${indent}participant ${participant.id}`,
  );
  const kept = lines.filter((_, index) => !declarationLines.has(index));
  let at = headerIndex + 1;
  while (at < kept.length && /^\s*(autonumber|title)\b/.test(kept[at])) at += 1;
  kept.splice(at, 0, ...declarations);
  return kept.join("\n");
}

// ---------------------------------------------------------------------------
// State diagrams

export const STATE_DIRECTIONS = ["TB", "LR", "BT", "RL"];

const STATE_TRANSITION =
  /^(\s*)(\[\*\]|[\p{L}\p{N}_.-]+)\s*-->\s*(\[\*\]|[\p{L}\p{N}_.-]+)\s*(?::(.*))?$/u;

export function getStateIds(code) {
  return new Set(
    buildMermaidSourceIndex(code, "state")
      .entries.flatMap((entry) => entry.keys)
      .map((key) => key.match(/^node:(.+)$/)?.[1])
      .filter((id) => id && !/_(start|end)$/.test(id)),
  );
}

// New states get an identifier-style default name so renaming them to a
// single word renames the id instead of adding an alias.
export function addState(code, { label = "NewState", from = null } = {}) {
  const { lines, headerIndex } = read(code);
  const used = getStateIds(code);
  const clean = String(label).trim() || "NewState";
  const id = idFromLabel(clean, "S", used);
  const indent = bodyIndent(lines, headerIndex);
  const added = [];
  if (id !== clean) added.push(`${indent}state "${clean.replace(/"/g, "'")}" as ${id}`);
  if (from) added.push(`${indent}${from} --> ${id}`);
  if (!added.length) added.push(`${indent}state ${id}`);
  const at = lastContentLine(lines) + 1;
  return { code: insertLines(lines, at, added), id, lineIndex: at + added.length - 1 };
}

export function connectStates(code, from, to) {
  const { lines, headerIndex } = read(code);
  // Self transitions (A --> A) are valid; [*] --> [*] is not.
  if (!from || !to || (from === "[*]" && to === "[*]")) return { code, lineIndex: -1 };
  const exists = lines.findIndex((line) => {
    const match = line.match(STATE_TRANSITION);
    return match && match[2] === from && match[3] === to;
  });
  if (exists >= 0) return { code, lineIndex: exists };
  const at = lastContentLine(lines) + 1;
  return {
    code: insertLines(lines, at, [`${bodyIndent(lines, headerIndex)}${from} --> ${to}`]),
    lineIndex: at,
  };
}

export function addStateNote(code, id, text = "Note") {
  const { lines, headerIndex } = read(code);
  const at = lastContentLine(lines) + 1;
  return {
    code: insertLines(lines, at, [`${bodyIndent(lines, headerIndex)}note right of ${id} : ${text}`]),
    lineIndex: at,
  };
}

export function getStateDirection(code) {
  const line = splitMermaidLines(code).find((text) => /^\s*direction\s+\w+/.test(text));
  return line ? line.trim().split(/\s+/)[1].toUpperCase() : "TB";
}

export function setStateDirection(code, direction) {
  const value = String(direction).toUpperCase();
  if (!STATE_DIRECTIONS.includes(value)) return code;
  const { lines, headerIndex } = read(code);
  const existing = lines.findIndex(
    (line, index) => index > headerIndex && /^\s*direction\s+\w+/.test(line) && getIndent(line).length <= getIndent(lines[headerIndex + 1] || "").length,
  );
  if (existing >= 0) {
    lines[existing] = `${getIndent(lines[existing])}direction ${value}`;
    return lines.join("\n");
  }
  return insertLines(lines, headerIndex + 1, [`${bodyIndent(lines, headerIndex)}direction ${value}`]);
}

// Removes a state with its transitions, notes, description lines, and (for a
// composite state) its whole block.
export function removeState(code, id) {
  const { lines, headerIndex } = read(code);
  const drop = new Set();
  const idPattern = tokenPattern(id).source;
  const declaration = new RegExp(`^\\s*state\\s+(?:"[^"]*"\\s+as\\s+)?${idPattern}\\b`, "u");
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const text = lines[index];
    if (declaration.test(text)) {
      if (/\{\s*$/.test(text)) {
        const [start, end] = blockRange(
          lines,
          index,
          (line) => /\{\s*$/.test(line),
          (line) => line.trim() === "}",
        );
        for (let line = start; line <= end; line += 1) drop.add(line);
        index = end;
      } else {
        drop.add(index);
      }
      continue;
    }
    const transition = text.match(STATE_TRANSITION);
    if (transition && (transition[2] === id || transition[3] === id)) {
      drop.add(index);
      continue;
    }
    if (new RegExp(`^\\s*${idPattern}\\s*:`, "u").test(text)) {
      drop.add(index);
      continue;
    }
    const note = text.match(/^\s*note\s+(?:left|right)\s+of\s+(\S+)\s*(:)?/);
    if (note && note[1] === id) {
      drop.add(index);
      if (!note[2]) {
        while (index + 1 < lines.length && !/^\s*end\s+note\s*$/i.test(lines[index])) {
          index += 1;
          drop.add(index);
        }
      }
    }
  }
  return removeLineIndexes(lines, drop);
}

// Removes a transition, description, or note (multi-line notes included).
export function removeStateLine(code, lineIndex) {
  const { lines } = read(code);
  const drop = new Set([lineIndex]);
  const text = lines[lineIndex] ?? "";
  const note = text.match(/^\s*note\s+(?:left|right)\s+of\s+\S+\s*(:)?/);
  if (note && !note[1]) {
    for (let index = lineIndex + 1; index < lines.length; index += 1) {
      drop.add(index);
      if (/^\s*end\s+note\s*$/i.test(lines[index])) break;
    }
  }
  return removeLineIndexes(lines, drop);
}

// ---------------------------------------------------------------------------
// Class diagrams

export const CLASS_RELATIONS = [
  { key: "<|--", label: "Inheritance" },
  { key: "*--", label: "Composition" },
  { key: "o--", label: "Aggregation" },
  { key: "-->", label: "Association" },
  { key: "--", label: "Link" },
  { key: "..>", label: "Dependency" },
  { key: "..|>", label: "Realization" },
  { key: "..", label: "Dashed link" },
];

function getClassIds(code) {
  return new Set(
    buildMermaidSourceIndex(code, "class")
      .entries.flatMap((entry) => entry.keys)
      .map((key) => key.match(/^node:(.+)$/)?.[1])
      .filter(Boolean),
  );
}

export function addClass(code, { name = "NewClass" } = {}) {
  const { lines, headerIndex } = read(code);
  const id = uniqueId(String(name).replace(/[^\p{L}\p{N}_]/gu, "") || "NewClass", getClassIds(code));
  const at = lastContentLine(lines) + 1;
  return {
    code: insertLines(lines, at, [`${bodyIndent(lines, headerIndex)}class ${id}`]),
    id,
    lineIndex: at,
  };
}

export function addClassMember(code, id, text = "+field") {
  const { lines, headerIndex } = read(code);
  const opener = new RegExp(`^\\s*class\\s+${tokenPattern(id).source}\\b.*\\{\\s*$`, "u");
  const start = lines.findIndex((line) => opener.test(line));
  if (start >= 0) {
    const [, end] = blockRange(lines, start, () => false, (line) => line.trim() === "}");
    const memberIndent = end > start + 1 ? getIndent(lines[start + 1]) : `${getIndent(lines[start])}    `;
    return { code: insertLines(lines, end, [`${memberIndent}${text}`]), lineIndex: end };
  }
  const at = lastContentLine(lines) + 1;
  return {
    code: insertLines(lines, at, [`${bodyIndent(lines, headerIndex)}${id} : ${text}`]),
    lineIndex: at,
  };
}

export function getClassRelation(code, lineIndex) {
  const text = splitMermaidLines(code)[lineIndex];
  const match = text?.match(CLASS_RELATION);
  if (!match) return null;
  return { from: match[2], arrow: match[3], to: match[4], label: match[5]?.trim() ?? "" };
}

export function connectClasses(code, from, to, arrow = "-->") {
  const { lines, headerIndex } = read(code);
  if (!from || !to) return { code, lineIndex: -1 };
  const at = lastContentLine(lines) + 1;
  return {
    code: insertLines(lines, at, [`${bodyIndent(lines, headerIndex)}${from} ${arrow} ${to}`]),
    lineIndex: at,
  };
}

export function setClassRelationArrow(code, lineIndex, arrow) {
  const { lines } = read(code);
  const relation = getClassRelation(code, lineIndex);
  if (!relation || !CLASS_RELATIONS.some((entry) => entry.key === arrow)) return code;
  const text = lines[lineIndex];
  const at = text.indexOf(relation.arrow, text.indexOf(relation.from) + relation.from.length);
  lines[lineIndex] = text.slice(0, at) + arrow + text.slice(at + relation.arrow.length);
  return lines.join("\n");
}

export function removeClass(code, id) {
  const { lines, headerIndex } = read(code);
  const drop = new Set();
  const idPattern = tokenPattern(id).source;
  const declaration = new RegExp(`^\\s*class\\s+${idPattern}(?![\\p{L}\\p{N}_])`, "u");
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const text = lines[index];
    if (declaration.test(text)) {
      drop.add(index);
      if (/\{\s*$/.test(text)) {
        while (index + 1 < lines.length && lines[index].trim() !== "}") {
          index += 1;
          drop.add(index);
        }
      }
      continue;
    }
    const relation = text.match(CLASS_RELATION);
    if (relation && (relation[2] === id || relation[4] === id)) {
      drop.add(index);
      continue;
    }
    if (
      new RegExp(`^\\s*${idPattern}\\s*:`, "u").test(text) ||
      new RegExp(`^\\s*(note\\s+for|style|cssClass|<<[^>]*>>)\\s+"?${idPattern}\\b`, "u").test(text)
    ) {
      drop.add(index);
    }
  }
  return removeLineIndexes(lines, drop);
}

export function removeClassLine(code, lineIndex) {
  const { lines } = read(code);
  return removeLineIndexes(lines, new Set([lineIndex]));
}

// ---------------------------------------------------------------------------
// ER diagrams

export const ER_CARDINALITIES = [
  { key: "one", label: "Exactly one", left: "||", right: "||" },
  { key: "zeroOrOne", label: "Zero or one", left: "|o", right: "o|" },
  { key: "oneOrMore", label: "One or more", left: "}|", right: "|{" },
  { key: "zeroOrMore", label: "Zero or more", left: "}o", right: "o{" },
];

function cardinalityKey(token, side) {
  const found = ER_CARDINALITIES.find((entry) => entry[side] === token);
  if (found) return found.key;
  // Mermaid also accepts the mirrored spelling on either side.
  const mirrored = ER_CARDINALITIES.find(
    (entry) => entry[side === "left" ? "right" : "left"] === token,
  );
  return mirrored?.key ?? "one";
}

export function getErRelation(code, lineIndex) {
  const text = splitMermaidLines(code)[lineIndex];
  const match = text?.match(ER_RELATION);
  if (!match) return null;
  return {
    from: match[2],
    to: match[6],
    left: cardinalityKey(match[3], "left"),
    right: cardinalityKey(match[5], "right"),
    identifying: match[4] === "--",
    label: match[7].trim(),
  };
}

export function setErRelation(code, lineIndex, { left, right, identifying } = {}) {
  const { lines } = read(code);
  const text = lines[lineIndex];
  const match = text?.match(ER_RELATION);
  if (!match) return code;
  const current = getErRelation(code, lineIndex);
  const leftToken = ER_CARDINALITIES.find((entry) => entry.key === (left ?? current.left))?.left ?? match[3];
  const rightToken = ER_CARDINALITIES.find((entry) => entry.key === (right ?? current.right))?.right ?? match[5];
  const line = (identifying ?? current.identifying) ? "--" : "..";
  const at = text.indexOf(`${match[3]}${match[4]}${match[5]}`);
  lines[lineIndex] =
    text.slice(0, at) + `${leftToken}${line}${rightToken}` + text.slice(at + 6);
  return lines.join("\n");
}

function getErEntities(code) {
  return new Set(
    buildMermaidSourceIndex(code, "er")
      .entries.flatMap((entry) => entry.keys)
      .map((key) => key.match(/^node:(.+)$/)?.[1])
      .filter(Boolean),
  );
}

export function addErEntity(code, { name = "ENTITY" } = {}) {
  const { lines, headerIndex } = read(code);
  const id = uniqueId(String(name).toUpperCase().replace(/[^\p{L}\p{N}_-]/gu, "_") || "ENTITY", getErEntities(code));
  const indent = bodyIndent(lines, headerIndex);
  const at = lastContentLine(lines) + 1;
  return {
    code: insertLines(lines, at, [`${indent}${id} {`, `${indent}    string id PK`, `${indent}}`]),
    id,
    lineIndex: at,
  };
}

export function connectErEntities(code, from, to, label = "has") {
  const { lines, headerIndex } = read(code);
  if (!from || !to) return { code, lineIndex: -1 };
  const at = lastContentLine(lines) + 1;
  return {
    code: insertLines(lines, at, [`${bodyIndent(lines, headerIndex)}${from} ||--o{ ${to} : ${label}`]),
    lineIndex: at,
  };
}

export function addErAttribute(code, entity, text = "string name") {
  const { lines, headerIndex } = read(code);
  const opener = new RegExp(`^\\s*${tokenPattern(entity).source}(?:\\["[^"]*"\\])?\\s*\\{\\s*$`, "u");
  const start = lines.findIndex((line) => opener.test(line));
  if (start >= 0) {
    const [, end] = blockRange(lines, start, () => false, (line) => line.trim() === "}");
    const indent = end > start + 1 ? getIndent(lines[start + 1]) : `${getIndent(lines[start])}    `;
    return { code: insertLines(lines, end, [`${indent}${text}`]), lineIndex: end };
  }
  const indent = bodyIndent(lines, headerIndex);
  const at = lastContentLine(lines) + 1;
  return {
    code: insertLines(lines, at, [`${indent}${entity} {`, `${indent}    ${text}`, `${indent}}`]),
    lineIndex: at + 1,
  };
}

export function removeErEntity(code, id) {
  const { lines, headerIndex } = read(code);
  const drop = new Set();
  const opener = new RegExp(`^\\s*${tokenPattern(id).source}(?:\\["[^"]*"\\])?\\s*\\{\\s*$`, "u");
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    if (opener.test(lines[index])) {
      while (index < lines.length) {
        drop.add(index);
        if (lines[index].trim() === "}") break;
        index += 1;
      }
      continue;
    }
    const relation = lines[index].match(ER_RELATION);
    if (relation && (relation[2] === id || relation[6] === id)) drop.add(index);
  }
  return removeLineIndexes(lines, drop);
}

export function removeErLine(code, lineIndex) {
  const { lines } = read(code);
  return removeLineIndexes(lines, new Set([lineIndex]));
}

// ---------------------------------------------------------------------------
// Mindmaps

export const MINDMAP_NODE_SHAPES = [
  { key: "default", label: "Default", open: "", close: "" },
  { key: "square", label: "Square", open: "[", close: "]" },
  { key: "rounded", label: "Rounded", open: "(", close: ")" },
  { key: "circle", label: "Circle", open: "((", close: "))" },
  { key: "bang", label: "Bang", open: "))", close: "((" },
  { key: "cloud", label: "Cloud", open: ")", close: "(" },
  { key: "hexagon", label: "Hexagon", open: "{{", close: "}}" },
];

function isMindmapDecoration(text) {
  const trimmed = text.trim();
  return trimmed.startsWith("::icon(") || trimmed.startsWith(":::");
}

export function getMindmapNodes(code) {
  const { lines, headerIndex } = read(code);
  const nodes = [];
  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const text = lines[lineIndex];
    if (!text.trim() || text.trim().startsWith("%%") || isMindmapDecoration(text)) continue;
    const indent = getIndent(text).length;
    const span = mindmapLabelSpan(text);
    const before = text.slice(indent, span.start).replace(/"$/, "");
    const after = text.slice(span.end).replace(/^"/, "").trimEnd();
    const shape =
      [...MINDMAP_NODE_SHAPES].sort((a, b) => b.open.length - a.open.length).find(
        (entry) => entry.open && before.endsWith(entry.open) && after.startsWith(entry.close),
      ) || MINDMAP_NODE_SHAPES[0];
    nodes.push({
      index: nodes.length,
      lineIndex,
      indent,
      label: text.slice(span.start, span.end),
      shape: shape.key,
      idPart: shape.open ? before.slice(0, before.length - shape.open.length) : "",
    });
  }
  // A node's subtree runs until the next node at the same or a lower indent.
  for (const node of nodes) {
    const next = nodes.find((other) => other.index > node.index && other.indent <= node.indent);
    node.endLine = (next ? next.lineIndex : lastContentLine(lines) + 1) - 1;
    node.children = nodes.filter(
      (other) => other.index > node.index && other.lineIndex <= node.endLine && other.indent > node.indent,
    );
  }
  return nodes;
}

function newMindmapLine(indent, label) {
  return `${" ".repeat(indent)}${String(label).replace(/\r?\n/g, " ")}`;
}

export function addMindmapChild(code, index, label = "New idea") {
  const { lines } = read(code);
  const nodes = getMindmapNodes(code);
  const node = nodes[index];
  if (!node) return { code, index: -1 };
  const indent = node.children.length ? node.children[0].indent : node.indent + 2;
  const at = node.endLine + 1;
  const newIndex = node.index + node.children.length + 1;
  return { code: insertLines(lines, at, [newMindmapLine(indent, label)]), index: newIndex };
}

export function addMindmapSibling(code, index, label = "New idea") {
  const nodes = getMindmapNodes(code);
  const node = nodes[index];
  if (!node) return { code, index: -1 };
  if (index === 0) return addMindmapChild(code, 0, label);
  const { lines } = read(code);
  const at = node.endLine + 1;
  return {
    code: insertLines(lines, at, [newMindmapLine(node.indent, label)]),
    index: node.index + node.children.length + 1,
  };
}

export function removeMindmapNode(code, index) {
  const nodes = getMindmapNodes(code);
  const node = nodes[index];
  if (!node || index === 0) return code;
  const { lines } = read(code);
  const drop = new Set();
  for (let line = node.lineIndex; line <= node.endLine; line += 1) drop.add(line);
  return removeLineIndexes(lines, drop);
}

// Swaps a node (with its subtree) with the previous or next sibling.
export function moveMindmapNode(code, index, delta) {
  const nodes = getMindmapNodes(code);
  const node = nodes[index];
  if (!node || index === 0) return { code, index };
  const parent = [...nodes]
    .reverse()
    .find((other) => other.index < node.index && other.indent < node.indent);
  const siblings = parent
    ? parent.children.filter((child) => child.indent === node.indent)
    : nodes.filter((other) => other.indent === node.indent);
  const position = siblings.indexOf(node);
  const other = siblings[position + delta];
  if (!other) return { code, index };
  const [first, second] = delta < 0 ? [other, node] : [node, other];
  const { lines } = read(code);
  const firstLines = lines.slice(first.lineIndex, first.endLine + 1);
  const secondLines = lines.slice(second.lineIndex, second.endLine + 1);
  const next = [
    ...lines.slice(0, first.lineIndex),
    ...secondLines,
    ...firstLines,
    ...lines.slice(second.endLine + 1),
  ];
  const nextIndex = delta < 0 ? other.index : node.index + other.children.length + 1;
  return { code: next.join("\n"), index: nextIndex };
}

export function setMindmapShape(code, index, shapeKey) {
  const nodes = getMindmapNodes(code);
  const node = nodes[index];
  const shape = MINDMAP_NODE_SHAPES.find((entry) => entry.key === shapeKey);
  if (!node || !shape) return code;
  const { lines } = read(code);
  const text = lines[node.lineIndex];
  const decoration = text.match(/\s*:::.*$/)?.[0] ?? "";
  const label = node.label.replace(/[[\](){}]/g, "");
  const id = node.idPart || (shape.open ? `n${index}` : "");
  lines[node.lineIndex] = shape.open
    ? `${" ".repeat(node.indent)}${id}${shape.open}${label}${shape.close}${decoration}`
    : `${" ".repeat(node.indent)}${label}${decoration}`;
  return lines.join("\n");
}
