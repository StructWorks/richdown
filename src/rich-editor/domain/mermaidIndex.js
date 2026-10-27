// Source index for every Mermaid diagram type.
//
// Mermaid draws each diagram type differently, but every drawn element comes
// from a statement in the source. The index records those statements as
// entries: the keys the rendered element can be recognised by (node ids,
// statement numbers, task ids...), the line, and where the visible label sits
// in that line. The diagram surface turns a clicked SVG element into keys and
// text; the index turns those back into a source line, the label to rename,
// or (for the caret's line) the keys to highlight.
//
// Key formats by diagram type (see the builders below):
//   flowchart  node:ID  edge:FROM>TO#N (Nth parallel edge)  edge:FROM>TO
//              subgraph:ID
//   sequence   participant:ID  participantLabel:TEXT  stmt:N (Mermaid's
//              message index, also used by notes and control blocks)
//   class      node:ID  member:ID:TEXT  rel:N (1-based)  edge:FROM>TO
//   state      node:ID  stateEdge:N  note:ID
//   er         node:ID  attr:ENTITY:NAME  attrRow:ENTITY:N  edge:FROM>TO
//   gantt      task:ID  taskIndex:N  section:TEXT  title
//   pie        slice:N  title
//   mindmap    mindmap:N
//   journey    journeyTask:N  section:TEXT  title
//   timeline   timeline:N  title
//   git        commit:ID  commitSeq:N  branch:NAME  tag:NAME
//   xychart    plot:N  title
//   block/kanban/architecture/requirement   node:ID  field:ID:NAME
// Types without structural ids (quadrant, sankey, packet, radar, treemap,
// C4 ...) are matched through their labels.
import {
  detectMermaidDiagramType,
  findMermaidHeaderLine,
  firstLineMatching,
  formatFlowchartLabel,
  getIndent,
  isIdentifierLike,
  parseFlowchart,
  parseFlowchartNodeRef,
  readFlowchartSubgraphs,
  renameFlowchartEdgeLabel,
  renameFlowchartNodeLabel,
  renameSequenceParticipant,
  replaceMermaidText,
  splitMermaidLines,
  tokenPattern,
} from "./mermaidSource.js";

// ---------------------------------------------------------------------------
// Public API

export function buildMermaidSourceIndex(code, type = detectMermaidDiagramType(code)) {
  const lines = splitMermaidLines(code);
  const headerIndex = findMermaidHeaderLine(lines);
  const context = { code, lines, headerIndex, type, entries: [] };
  if (headerIndex >= 0) {
    const builder = BUILDERS[type] || buildByLabels;
    builder(context);
  }
  return { type, lines, headerIndex, entries: context.entries };
}

// The entry behind a rendered element: structural keys first, then the
// element's text matched against labels, then any line containing the text.
export function findMermaidSourceEntry(index, target) {
  if (!target) {
    return null;
  }
  for (const key of target.keys || []) {
    const entry = index.entries.find((candidate) => candidate.keys.includes(key));
    if (entry) {
      return entry;
    }
  }
  const text = normalizeLabel(target.text);
  if (!text) {
    return null;
  }
  const exact = index.entries.find((entry) => normalizeLabel(entry.label) === text);
  if (exact) {
    return exact;
  }
  const loose = index.entries
    .filter((entry) => {
      const label = normalizeLabel(entry.label).toLowerCase();
      const wanted = text.toLowerCase();
      return label.length > 1 && (label.includes(wanted) || wanted.includes(label));
    })
    .sort((left, right) => right.label.length - left.label.length)[0];
  if (loose) {
    return loose;
  }
  const start = Math.max(0, index.headerIndex);
  const raw = String(target.text).trim();
  for (const candidate of [raw, text, raw.split(/\s*\n\s*/)[0]]) {
    if (!candidate) continue;
    const lineIndex = firstLineMatching(index.lines, start, (line) => line.includes(candidate));
    if (lineIndex >= 0) {
      const column = index.lines[lineIndex].indexOf(candidate);
      return {
        keys: [],
        lineIndex,
        start: column,
        end: column + candidate.length,
        label: candidate,
        rename: "span",
        format: "text",
      };
    }
  }
  return null;
}

// Finds the source line behind something the user clicked in the diagram.
export function findMermaidSourceLine(code, target, type = detectMermaidDiagramType(code)) {
  const entry = findMermaidSourceEntry(buildMermaidSourceIndex(code, type), normalizeTarget(target));
  return entry ? entry.lineIndex : -1;
}

// Keys and labels of everything the given line draws: used to highlight the
// caret line's elements. `ids` lists bare node ids for convenience.
export function getMermaidLineReferences(code, lineIndex, type = detectMermaidDiagramType(code)) {
  const index = buildMermaidSourceIndex(code, type);
  const keys = new Set();
  const texts = new Set();
  const ids = new Set();
  for (const entry of index.entries) {
    if (entry.lineIndex !== lineIndex) continue;
    for (const key of entry.keys) {
      keys.add(key);
      const id = key.match(/^(?:node|participant):(.+)$/)?.[1];
      if (id) ids.add(id);
    }
    for (const id of entry.mentions || []) {
      ids.add(id);
      keys.add(`node:${id}`);
      keys.add(`participant:${id}`);
    }
    const label = normalizeLabel(entry.label);
    if (label) texts.add(label);
  }
  return { keys, texts, ids };
}

// The current source label of a clicked element, for prefilling the rename
// box when the drawing itself shows no text (timeline shapes, auto commits).
export function getMermaidTargetLabel(code, target, type = detectMermaidDiagramType(code)) {
  const entry = findMermaidSourceEntry(buildMermaidSourceIndex(code, type), normalizeTarget(target));
  if (!entry || !["span", "identifier", "participant", "csvField", "flowchart"].includes(entry.rename)) {
    return "";
  }
  return entry.label;
}

// Rewrites the label of a clicked element. Returns the code unchanged when
// the element cannot be renamed to `newText` (for example a multi-word name
// for something that is referenced by its identifier).
export function renameMermaidTarget(code, target, newText, type = detectMermaidDiagramType(code)) {
  const normalized = normalizeTarget(target);
  if (!normalized) {
    return code;
  }
  if (type === "flowchart") {
    let renamed = code;
    if (normalized.kind === "node" && normalized.id) {
      renamed = renameFlowchartNodeLabel(code, normalized.id, newText);
    } else if (normalized.kind === "edge" && normalized.from && normalized.to) {
      renamed = renameFlowchartEdgeLabel(
        code,
        normalized.from,
        normalized.to,
        newText,
        normalized.occurrence,
      );
    }
    // Subgraph titles and other non-node labels go through the index below.
    if (renamed !== code) {
      return renamed;
    }
  }
  const index = buildMermaidSourceIndex(code, type);
  const entry = findMermaidSourceEntry(index, normalized);
  if (!entry) {
    return replaceMermaidText(code, normalized.text, newText);
  }
  return renameEntry(code, index, entry, newText);
}

export function normalizeLabel(text) {
  let value = String(text ?? "").replace(/\s+/g, " ").trim();
  for (;;) {
    const next = value
      .replace(/^\[(.*)\]$/, "$1")
      .replace(/^<<(.*)>>$/, "$1")
      .replace(/^"(.*)"$/, "$1")
      .trim();
    if (next === value) return value;
    value = next;
  }
}

// Accepts the older { kind, id, from, to, text } targets as well as
// { keys, text } and fills in keys for the former.
function normalizeTarget(target) {
  if (!target) {
    return null;
  }
  const keys = [...(target.keys || [])];
  if (target.kind === "node" && target.id) {
    keys.push(`node:${target.id}`, `participant:${target.id}`);
  }
  if (target.kind === "edge" && target.from && target.to) {
    keys.push(`edge:${target.from}>${target.to}#${target.occurrence ?? 0}`);
    keys.push(`edge:${target.from}>${target.to}`);
  }
  return { ...target, keys };
}

// ---------------------------------------------------------------------------
// Renaming

function renameEntry(code, index, entry, newText) {
  const text = String(newText ?? "").replace(/\r?\n/g, " ").trim();
  if (entry.rename === "flowchart") {
    return entry.edge
      ? renameFlowchartEdgeLabel(code, entry.edge.from, entry.edge.to, text, entry.edge.occurrence)
      : renameFlowchartNodeLabel(code, entry.id, text);
  }
  if (!text) {
    return code;
  }
  const lines = [...index.lines];
  const line = lines[entry.lineIndex];
  switch (entry.rename) {
    case "span": {
      if (text === entry.label) return code;
      const value = formatSpan(text, entry);
      lines[entry.lineIndex] = line.slice(0, entry.start) + value + line.slice(entry.end);
      return lines.join("\n");
    }
    case "appendLabel": {
      lines[entry.lineIndex] = `${line.replace(/\s+$/, "")} : ${formatSpan(text, entry)}`;
      return lines.join("\n");
    }
    case "appendGitId": {
      lines[entry.lineIndex] = `${line.replace(/\s+$/, "")} id: "${formatSpan(text, { format: "quoted" })}"`;
      return lines.join("\n");
    }
    case "participant":
      return renameSequenceParticipant(code, entry.id, text);
    case "identifier":
      return renameIdentifier(code, index, entry, text);
    case "csvField": {
      // Renames a sankey node everywhere it appears as a whole field.
      const value = text.replace(/,/g, " ").replace(/"/g, "'");
      return index.lines
        .map((row, lineIndex) =>
          lineIndex <= index.headerIndex
            ? row
            : row
                .split(",")
                .map((field) =>
                  field.trim().replace(/^"(.*)"$/, "$1") === entry.label
                    ? field.replace(entry.label, value)
                    : field,
                )
                .join(","),
        )
        .join("\n");
    }
    default:
      return code;
  }
}

function formatSpan(text, entry) {
  switch (entry.format) {
    case "quoted":
      return text.replace(/"/g, "'");
    case "word":
      return text.replace(/\s+/g, "_");
    case "field":
      // Text that ends at a ":" or "," separator in the source.
      return text.replace(/:/g, " -").replace(/,/g, entry.allowComma ? "," : " ");
    case "bracket":
      return text.replace(/[[\](){}]/g, "");
    case "erLabel":
      return /\s/.test(text) || entry.quoted ? `"${text.replace(/"/g, "'")}"` : text;
    case "flowLabel":
      return formatFlowchartLabel(text) || text;
    case "bracketTitle":
      return ` [${formatFlowchartLabel(text) || text}]`;
    default:
      return text;
  }
}

function renameIdentifier(code, index, entry, text) {
  if (text === entry.label) {
    return code;
  }
  if (isIdentifierLike(text) || (entry.allowPath && /^[\w./-]+$/.test(text))) {
    const pattern = tokenPattern(entry.label);
    const lines = index.lines.map((line, lineIndex) =>
      lineIndex < index.headerIndex ? line : line.replace(pattern, () => text),
    );
    return lines.join("\n");
  }
  // Multi-word names become display labels where the syntax has them.
  const lines = [...index.lines];
  const indent = getIndent(lines[index.headerIndex + 1] || "") || "    ";
  const label = text.replace(/"/g, "'");
  if (index.type === "class") {
    const declaration = new RegExp(
      `^(\\s*class\\s+${tokenPattern(entry.label).source})(?:\\["[^"]*"\\])?`,
      "u",
    );
    const lineIndex = firstLineMatching(lines, index.headerIndex + 1, (line) =>
      declaration.test(line),
    );
    if (lineIndex >= 0) {
      lines[lineIndex] = lines[lineIndex].replace(declaration, `$1["${label}"]`);
    } else {
      lines.splice(index.headerIndex + 1, 0, `${indent}class ${entry.label}["${label}"]`);
    }
    return lines.join("\n");
  }
  if (index.type === "state") {
    const declaration = new RegExp(
      `^(\\s*)state\\s+"[^"]*"\\s+as\\s+${tokenPattern(entry.label).source}\\s*$`,
      "u",
    );
    const lineIndex = firstLineMatching(lines, index.headerIndex + 1, (line) =>
      declaration.test(line),
    );
    if (lineIndex >= 0) {
      lines[lineIndex] = `${getIndent(lines[lineIndex])}state "${label}" as ${entry.label}`;
    } else {
      lines.splice(index.headerIndex + 1, 0, `${indent}state "${label}" as ${entry.label}`);
    }
    return lines.join("\n");
  }
  return code;
}

// ---------------------------------------------------------------------------
// Entry helpers

// `extra.start`/`extra.end` (for example from quotedOrTrimmed) narrow the
// span; `extra.label` overrides the label read from the span.
function addEntry(context, keys, lineIndex, start, end, extra = {}) {
  const line = context.lines[lineIndex];
  const { start: spanStart, end: spanEnd, label, ...rest } = extra;
  let from = Math.max(0, spanStart ?? start);
  let to = Math.min(line.length, spanEnd ?? end);
  while (from < to && /\s/.test(line[from])) from += 1;
  while (to > from && /\s/.test(line[to - 1])) to -= 1;
  const entry = {
    keys,
    lineIndex,
    start: from,
    end: to,
    label: label ?? line.slice(from, to),
    rename: "span",
    format: "text",
    ...rest,
  };
  context.entries.push(entry);
  return entry;
}

// Drops the first-mention entry recorded for `key` so an explicit declaration
// (`class X`, `state X {`, `X {`) becomes the place a click on X jumps to.
function dropImplicit(context, key) {
  context.entries = context.entries.filter(
    (entry) => !(entry.implicit && entry.keys.includes(key)),
  );
}

function addLineEntry(context, keys, lineIndex, extra = {}) {
  return addEntry(context, keys, lineIndex, 0, context.lines[lineIndex].length, {
    rename: null,
    ...extra,
  });
}

// Span of a quoted string's contents, or of the trimmed text, in [from, to).
function quotedOrTrimmed(line, from, to) {
  const slice = line.slice(from, to);
  const quote = slice.match(/"([^"]*)"/);
  if (quote) {
    const start = from + quote.index + 1;
    return { start, end: start + quote[1].length, quoted: true };
  }
  return { start: from, end: to, quoted: false };
}

function forEachBodyLine(context, callback) {
  const { lines, headerIndex } = context;
  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const text = lines[lineIndex];
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("%%")) continue;
    if (callback(text, lineIndex, trimmed) === false) break;
  }
}

function addTitle(context, text, lineIndex, allowKeywordPrefix = false) {
  const match = text.match(
    allowKeywordPrefix ? /^(\s*\S+\s+title\s+)(.+)$/ : /^(\s*title\s+)(.+)$/,
  );
  if (match) {
    addEntry(context, ["title"], lineIndex, match[1].length, text.length, {
      ...quotedOrTrimmed(text, match[1].length, text.length),
    });
    return true;
  }
  return false;
}

function addTitleFromHeader(context) {
  const header = context.lines[context.headerIndex];
  addTitle(context, header, context.headerIndex, true);
}

// ---------------------------------------------------------------------------
// Builders

const BUILDERS = {
  flowchart: buildFlowchart,
  sequence: buildSequence,
  class: buildClass,
  state: buildState,
  er: buildEr,
  gantt: buildGantt,
  pie: buildPie,
  mindmap: buildMindmap,
  journey: buildJourney,
  timeline: buildTimeline,
  git: buildGit,
  quadrant: buildQuadrant,
  other: buildOther,
};

function buildFlowchart(context) {
  const model = parseFlowchart(context.code);
  for (const node of model.nodes.values()) {
    const { lineIndex, ref } = node.labeled || node.refs[0];
    const labeled = Boolean(node.labeled && ref.labelStart >= 0);
    addEntry(
      context,
      [`node:${node.id}`],
      lineIndex,
      labeled ? ref.labelStart : ref.start,
      labeled ? ref.labelEnd : ref.idEnd,
      { rename: "flowchart", id: node.id },
    );
  }
  const seen = new Map();
  for (const edge of model.edges) {
    const pair = `${edge.from}>${edge.to}`;
    const occurrence = seen.get(pair) || 0;
    seen.set(pair, occurrence + 1);
    const { link } = edge;
    addEntry(
      context,
      [`edge:${pair}#${occurrence}`, `edge:${pair}`],
      edge.lineIndex,
      link.labelStart >= 0 ? link.labelStart : link.start,
      link.labelStart >= 0 ? link.labelEnd : link.arrowEnd,
      {
        rename: "flowchart",
        label: link.label ?? "",
        edge: { from: edge.from, to: edge.to, occurrence },
        mentions: [edge.from, edge.to],
      },
    );
  }
  for (const subgraph of readFlowchartSubgraphs(model)) {
    const line = context.lines[subgraph.lineIndex];
    const keys = [`subgraph:${subgraph.id}`];
    const match = line.match(/^(\s*subgraph\s+)([^\s[]+)(\s*\[)?/);
    if (subgraph.form === "bracket" && match?.[3]) {
      const open = match[0].length;
      const close = line.lastIndexOf("]");
      const span = quotedOrTrimmed(line, open, close < open ? line.length : close);
      addEntry(context, keys, subgraph.lineIndex, open, close < open ? line.length : close, {
        ...span,
        format: span.quoted ? "quoted" : "flowLabel",
      });
    } else if (subgraph.form === "id" && match) {
      // `subgraph S` is both id and title; renaming adds a title so edges and
      // styles naming S keep working.
      const idEnd = match[1].length + match[2].length;
      addEntry(context, keys, subgraph.lineIndex, idEnd, idEnd, {
        label: subgraph.title,
        format: "bracketTitle",
      });
    } else if (match) {
      addEntry(context, keys, subgraph.lineIndex, match[1].length, line.length, {
        format: "text",
      });
    }
  }
}

export const SEQUENCE_ARROW =
  /^(\s*)([^\s:>-][^:>]*?)\s*(<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-]?)\s*([^:]+?)\s*:(.*)$/;
export const SEQUENCE_BLOCK = /^(\s*)(loop|alt|opt|par_over|par|critical|break|rect)\b(.*)$/;
export const SEQUENCE_BRANCH = /^(\s*)(else|and|option)\b(.*)$/;

function buildSequence(context) {
  const { lines } = context;
  let statement = 0;
  const stack = [];
  const participants = new Map();
  const mentions = [];

  const declareParticipant = (id, lineIndex, start, end, alias) => {
    if (participants.has(id)) return;
    const entry = addEntry(context, [`participant:${id}`], lineIndex, start, end, {
      rename: "participant",
      id,
    });
    if (alias) entry.keys.push(`participantLabel:${normalizeLabel(alias)}`);
    entry.keys.push(`participantLabel:${id}`);
    participants.set(id, entry);
  };

  forEachBodyLine(context, (text, lineIndex, trimmed) => {
    const participant = text.match(
      /^(\s*(?:create\s+)?(?:participant|actor)\s+)([^\s]+)(?:\s+as\s+(.+))?\s*$/,
    );
    if (participant) {
      const id = participant[2];
      if (participant[3]) {
        const aliasStart = text.lastIndexOf(participant[3]);
        declareParticipant(id, lineIndex, aliasStart, aliasStart + participant[3].length, participant[3]);
      } else {
        const start = participant[1].length;
        declareParticipant(id, lineIndex, start, start + id.length, null);
      }
      return;
    }
    if (/^autonumber\b/.test(trimmed)) {
      statement += 1;
      return;
    }
    if (/^box\b/.test(trimmed)) {
      stack.push({ kind: "box" });
      return;
    }
    const message = text.match(SEQUENCE_ARROW);
    if (message) {
      const from = message[2].trim();
      const to = message[5].trim();
      const colon = text.indexOf(":", message[1].length + message[2].length);
      addEntry(context, [`stmt:${statement}`, `message:${from}>${to}`], lineIndex, colon + 1, text.length, {
        mentions: [from, to],
      });
      mentions.push({ id: from, lineIndex }, { id: to, lineIndex });
      statement += message[4] ? 2 : 1;
      return;
    }
    const note = text.match(/^(\s*note\s+(?:left of|right of|over)\s+([^:]+?)\s*:)(.*)$/i);
    if (note) {
      addEntry(context, [`stmt:${statement}`], lineIndex, note[1].length, text.length, {
        mentions: note[2].split(",").map((id) => id.trim()),
      });
      statement += 1;
      return;
    }
    const block = text.match(SEQUENCE_BLOCK);
    if (block) {
      const start = block[1].length + block[2].length;
      const entry = addEntry(context, [`stmt:${statement}`], lineIndex, start, text.length, {
        rename: block[2] === "rect" ? null : "span",
      });
      stack.push({ kind: "block", entry });
      statement += 1;
      return;
    }
    const branch = text.match(SEQUENCE_BRANCH);
    if (branch) {
      addEntry(context, [`stmt:${statement}`], lineIndex, branch[1].length + branch[2].length, text.length);
      statement += 1;
      return;
    }
    if (/^end\b/.test(trimmed)) {
      const open = stack.pop();
      if (open?.kind === "block") {
        // Mermaid ids the drawn block by its closing statement.
        open.entry.keys.push(`stmt:${statement}`);
      }
      if (open?.kind !== "box") statement += 1;
      return;
    }
    const activation = text.match(/^\s*(activate|deactivate)\s+(\S+)/);
    if (activation) {
      addLineEntry(context, [`stmt:${statement}`], lineIndex, { mentions: [activation[2]] });
      statement += 1;
    }
  });

  // Participants that are only ever used in messages are declared implicitly.
  for (const { id, lineIndex } of mentions) {
    if (participants.has(id)) continue;
    const line = lines[lineIndex];
    const pattern = tokenPattern(id);
    const match = pattern.exec(line);
    if (match) {
      declareParticipant(id, lineIndex, match.index, match.index + id.length, null);
    }
  }
}

export const CLASS_RELATION =
  /^(\s*)([\p{L}\p{N}_.~-]+)\s*(?:"[^"]*"\s*)?(<\|--|\*--|o--|-->|--\*|--o|--\|>|\.\.>|<\.\.|\.\.\|>|<\|\.\.|--|\.\.|<-->|<--)\s*(?:"[^"]*"\s*)?([\p{L}\p{N}_.~-]+)\s*(?::(.*))?$/u;

function buildClass(context) {
  let relation = 0;
  let openClass = null;
  const declared = new Set();
  const declare = (id, lineIndex, start, explicit = false) => {
    if (explicit) {
      dropImplicit(context, `node:${id}`);
    } else if (declared.has(id)) {
      return;
    }
    declared.add(id);
    addEntry(context, [`node:${id}`], lineIndex, start, start + id.length, {
      rename: "identifier",
      format: "word",
      implicit: !explicit,
    });
  };

  forEachBodyLine(context, (text, lineIndex, trimmed) => {
    if (openClass) {
      if (trimmed === "}") {
        openClass = null;
        return;
      }
      addEntry(context, [`member:${openClass}:${normalizeLabel(trimmed)}`], lineIndex, 0, text.length, {
        mentions: [openClass],
      });
      return;
    }
    const declaration = text.match(/^(\s*class\s+)([\p{L}\p{N}_.-]+)(~[^~]*~)?(\["([^"]*)"\])?.*?(\{)?\s*$/u);
    if (declaration) {
      const id = declaration[2];
      if (declaration[4]) {
        const start = text.indexOf('"', declaration[1].length) + 1;
        dropImplicit(context, `node:${id}`);
        declared.add(id);
        addEntry(context, [`node:${id}`], lineIndex, start, start + declaration[5].length, {
          format: "quoted",
        });
      } else {
        declare(id, lineIndex, declaration[1].length, true);
      }
      if (declaration[6]) openClass = id;
      return;
    }
    const memberLine = text.match(/^(\s*)([\p{L}\p{N}_.-]+)\s*:(?!:)(.*)$/u);
    if (memberLine && !CLASS_RELATION.test(text)) {
      const id = memberLine[2];
      addEntry(
        context,
        [`member:${id}:${normalizeLabel(memberLine[3])}`],
        lineIndex,
        text.indexOf(":", memberLine[1].length) + 1,
        text.length,
        { mentions: [id] },
      );
      return;
    }
    const note = text.match(/^\s*note\s+for\s+(\S+)\s+"([^"]*)"/);
    if (note) {
      const start = text.indexOf('"') + 1;
      addEntry(context, [`note:${note[1]}`], lineIndex, start, start + note[2].length, {
        format: "quoted",
        mentions: [note[1]],
      });
      return;
    }
    const rel = text.match(CLASS_RELATION);
    if (rel) {
      relation += 1;
      const from = rel[2];
      const to = rel[4];
      const colon = rel[5] !== undefined ? text.lastIndexOf(":") : -1;
      addEntry(
        context,
        [`rel:${relation}`, `edge:${from}>${to}`],
        lineIndex,
        colon >= 0 ? colon + 1 : 0,
        colon >= 0 ? text.length : 0,
        { rename: colon >= 0 ? "span" : "appendLabel", label: rel[5]?.trim() ?? "", mentions: [from, to] },
      );
      declare(from, lineIndex, text.indexOf(from));
      declare(to, lineIndex, text.indexOf(to, text.indexOf(rel[3]) + rel[3].length));
    }
  });
}

function buildState(context) {
  let edge = 0;
  const scopes = ["root"];
  const declared = new Set();
  const declare = (id, lineIndex, start, explicit = false) => {
    if (id === "[*]") return;
    if (explicit) {
      dropImplicit(context, `node:${id}`);
    } else if (declared.has(id)) {
      return;
    }
    declared.add(id);
    addEntry(context, [`node:${id}`], lineIndex, start, start + id.length, {
      rename: "identifier",
      format: "word",
      implicit: !explicit,
    });
  };
  let openNote = null;

  forEachBodyLine(context, (text, lineIndex, trimmed) => {
    if (openNote) {
      if (/^end\s+note$/i.test(trimmed)) {
        openNote = null;
      } else if (!openNote.hasText) {
        openNote.hasText = true;
        addEntry(context, [`note:${openNote.id}`], lineIndex, 0, text.length, {
          mentions: [openNote.id],
        });
      }
      return;
    }
    const alias = text.match(/^(\s*state\s+)"([^"]*)"\s+as\s+([\p{L}\p{N}_.-]+)/u);
    if (alias) {
      dropImplicit(context, `node:${alias[3]}`);
      declared.add(alias[3]);
      const start = alias[1].length + 1;
      addEntry(context, [`node:${alias[3]}`], lineIndex, start, start + alias[2].length, {
        format: "quoted",
      });
      if (/\{\s*$/.test(text)) scopes.push(alias[3]);
      return;
    }
    const composite = text.match(/^(\s*state\s+)([\p{L}\p{N}_.-]+)/u);
    if (composite) {
      declare(composite[2], lineIndex, composite[1].length, true);
      if (/\{\s*$/.test(text)) scopes.push(composite[2]);
      return;
    }
    if (trimmed === "}") {
      if (scopes.length > 1) scopes.pop();
      return;
    }
    const note = text.match(/^\s*note\s+(?:left|right)\s+of\s+([\p{L}\p{N}_.-]+)\s*(:)?(.*)$/u);
    if (note) {
      if (note[2]) {
        addEntry(context, [`note:${note[1]}`], lineIndex, text.indexOf(":") + 1, text.length, {
          mentions: [note[1]],
        });
      } else {
        openNote = { id: note[1], hasText: false };
      }
      edge += 1;
      return;
    }
    const transition = text.match(/^(\s*)(\[\*\]|[\p{L}\p{N}_.-]+)\s*-->\s*(\[\*\]|[\p{L}\p{N}_.-]+)\s*(?::(.*))?$/u);
    if (transition) {
      const [, , from, to, label] = transition;
      const scope = scopes[scopes.length - 1];
      const keys = [`stateEdge:${edge}`];
      if (from === "[*]") keys.push(`node:${scope}_start`);
      if (to === "[*]") keys.push(`node:${scope}_end`);
      const colon = label !== undefined ? text.indexOf(":", text.indexOf("-->")) : -1;
      addEntry(context, keys, lineIndex, colon >= 0 ? colon + 1 : 0, colon >= 0 ? text.length : 0, {
        rename: colon >= 0 ? "span" : "appendLabel",
        label: label?.trim() ?? "",
        mentions: [from, to].filter((id) => id !== "[*]"),
      });
      edge += 1;
      declare(from, lineIndex, text.indexOf(from));
      declare(to, lineIndex, text.indexOf(to, text.indexOf("-->") + 3));
      return;
    }
    const description = text.match(/^(\s*)([\p{L}\p{N}_.-]+)\s*:(.*)$/u);
    if (description) {
      const id = description[2];
      declared.add(id);
      context.entries = context.entries.filter(
        (entry) => !(entry.keys[0] === `node:${id}` && entry.rename === "identifier"),
      );
      addEntry(context, [`node:${id}`], lineIndex, text.indexOf(":") + 1, text.length);
    }
  });
}

export const ER_RELATION =
  /^(\s*)([\p{L}\p{N}_-]+)(?:\["[^"]*"\])?\s+([|}o{]{2})(--|\.\.)([|}o{]{2})\s+([\p{L}\p{N}_-]+)(?:\["[^"]*"\])?\s*:\s*(.*)$/u;

function buildEr(context) {
  let relation = 0;
  let openEntity = null;
  let row = 0;
  const declared = new Set();
  const declare = (id, lineIndex, start, explicit = false) => {
    if (explicit) {
      dropImplicit(context, `node:${id}`);
    } else if (declared.has(id)) {
      return;
    }
    declared.add(id);
    addEntry(context, [`node:${id}`], lineIndex, start, start + id.length, {
      rename: "identifier",
      format: "word",
      implicit: !explicit,
    });
  };

  forEachBodyLine(context, (text, lineIndex, trimmed) => {
    if (openEntity) {
      if (trimmed === "}") {
        openEntity = null;
        return;
      }
      const attribute = text.match(/^(\s*)(\S+)\s+([\p{L}\p{N}_()[\]*-]+)/u);
      if (attribute) {
        const start = text.indexOf(attribute[3], attribute[1].length + attribute[2].length);
        addEntry(
          context,
          [`attr:${openEntity}:${attribute[3]}`, `attrRow:${openEntity}:${row}`],
          lineIndex,
          start,
          start + attribute[3].length,
          { format: "word", mentions: [openEntity] },
        );
        row += 1;
      }
      return;
    }
    const block = text.match(/^(\s*)([\p{L}\p{N}_-]+)(?:\["([^"]*)"\])?\s*\{\s*$/u);
    if (block) {
      if (block[3] !== undefined) {
        const start = text.indexOf('"') + 1;
        dropImplicit(context, `node:${block[2]}`);
        declared.add(block[2]);
        addEntry(context, [`node:${block[2]}`], lineIndex, start, start + block[3].length, {
          format: "quoted",
        });
      } else {
        declare(block[2], lineIndex, block[1].length, true);
      }
      openEntity = block[2];
      row = 0;
      return;
    }
    const rel = text.match(ER_RELATION);
    if (rel) {
      const from = rel[2];
      const to = rel[6];
      const colon = text.indexOf(":", text.indexOf(rel[4]));
      const span = quotedOrTrimmed(text, colon + 1, text.length);
      addEntry(context, [`edge:${from}>${to}`, `erRel:${relation}`], lineIndex, span.start, span.end, {
        format: "erLabel",
        quoted: span.quoted,
        mentions: [from, to],
      });
      relation += 1;
      declare(from, lineIndex, text.indexOf(from));
      declare(to, lineIndex, text.indexOf(to, text.indexOf(rel[5]) + 2));
    }
  });
}

export const GANTT_SETTINGS =
  /^(dateFormat|axisFormat|tickInterval|excludes|includes|todayMarker|weekday|weekend|displayMode|inclusiveEndDates|topAxis|click|accTitle|accDescr)\b/;
export const GANTT_TAGS = new Set(["crit", "done", "active", "milestone", "vert"]);

function buildGantt(context) {
  let task = 0;
  let autoId = 0;
  let section = 0;
  forEachBodyLine(context, (text, lineIndex, trimmed) => {
    if (addTitle(context, text, lineIndex)) return;
    const sectionMatch = text.match(/^(\s*section\s+)(.+)$/);
    if (sectionMatch) {
      addEntry(context, [`section:${normalizeLabel(sectionMatch[2])}`, `sectionIndex:${section}`], lineIndex, sectionMatch[1].length, text.length);
      section += 1;
      return;
    }
    if (GANTT_SETTINGS.test(trimmed)) return;
    const colon = text.indexOf(":");
    if (colon <= 0) return;
    const parts = text
      .slice(colon + 1)
      .split(",")
      .map((part) => part.trim())
      .filter((part) => !GANTT_TAGS.has(part));
    let id;
    if (parts.length >= 3) {
      id = parts[0];
    } else {
      autoId += 1;
      id = `task${autoId}`;
    }
    addEntry(context, [`task:${id}`, `taskIndex:${task}`], lineIndex, 0, colon, { format: "field", allowComma: true });
    task += 1;
  });
}

function buildPie(context) {
  addTitleFromHeader(context);
  let slice = 0;
  forEachBodyLine(context, (text, lineIndex) => {
    if (addTitle(context, text, lineIndex)) return;
    const data = text.match(/^(\s*)"([^"]*)"\s*:/);
    if (data) {
      const start = data[1].length + 1;
      addEntry(context, [`slice:${slice}`], lineIndex, start, start + data[2].length, { format: "quoted" });
      slice += 1;
    }
  });
}

function buildMindmap(context) {
  let node = 0;
  forEachBodyLine(context, (text, lineIndex, trimmed) => {
    if (trimmed.startsWith("::icon(") || trimmed.startsWith(":::")) return;
    const span = mindmapLabelSpan(text);
    addEntry(context, [`mindmap:${node}`], lineIndex, span.start, span.end, { format: span.format });
    node += 1;
  });
}

export const MINDMAP_SHAPES = [
  ["((", "))"],
  ["))", "(("],
  ["{{", "}}"],
  ["[", "]"],
  ["(", ")"],
  [")", "("],
];

// A mindmap node is "id", "id[label]", "id((label))"... and ids may contain
// spaces, so the label starts at the first shape opener whose closer ends the
// line.
export function mindmapLabelSpan(text) {
  const indent = getIndent(text).length;
  const body = text.slice(indent).replace(/\s*:::.*$/, "").trimEnd();
  for (let offset = 1; offset < body.length; offset += 1) {
    for (const [open, close] of MINDMAP_SHAPES) {
      if (!body.startsWith(open, offset) || !body.endsWith(close)) continue;
      const labelStart = indent + offset + open.length;
      const labelEnd = indent + body.length - close.length;
      if (labelEnd <= labelStart) continue;
      const span = quotedOrTrimmed(text, labelStart, labelEnd);
      return { start: span.start, end: span.end, format: span.quoted ? "quoted" : "bracket" };
    }
  }
  return { start: indent, end: indent + body.length, format: "text" };
}

function buildJourney(context) {
  let task = 0;
  forEachBodyLine(context, (text, lineIndex) => {
    if (addTitle(context, text, lineIndex)) return;
    const section = text.match(/^(\s*section\s+)(.+)$/);
    if (section) {
      addEntry(context, [`section:${normalizeLabel(section[2])}`], lineIndex, section[1].length, text.length);
      return;
    }
    const colon = text.indexOf(":");
    if (colon > 0) {
      addEntry(context, [`journeyTask:${task}`], lineIndex, 0, colon, { format: "field" });
      task += 1;
    }
  });
}

function buildTimeline(context) {
  let node = 0;
  forEachBodyLine(context, (text, lineIndex) => {
    if (addTitle(context, text, lineIndex)) return;
    const section = text.match(/^(\s*section\s+)(.+)$/);
    if (section) {
      addEntry(context, [`timeline:${node}`], lineIndex, section[1].length, text.length);
      node += 1;
      return;
    }
    let position = 0;
    for (const part of text.split(":")) {
      const start = position;
      position += part.length + 1;
      if (!part.trim()) continue;
      addEntry(context, [`timeline:${node}`], lineIndex, start, start + part.length, { format: "field" });
      node += 1;
    }
  });
}

function buildGit(context) {
  let sequence = 0;
  forEachBodyLine(context, (text, lineIndex, trimmed) => {
    const branch = text.match(/^(\s*branch\s+)(\S+)/);
    if (branch) {
      addEntry(context, [`branch:${branch[2]}`], lineIndex, branch[1].length, branch[1].length + branch[2].length, {
        rename: "identifier",
        allowPath: true,
      });
      return;
    }
    if (!/^(commit|merge|cherry-pick)\b/.test(trimmed)) return;
    const keys = [`commitSeq:${sequence}`];
    const id = text.match(/\bid:\s*"([^"]*)"/);
    const tag = text.match(/\btag:\s*"([^"]*)"/);
    if (id && !trimmed.startsWith("cherry-pick")) keys.push(`commit:${id[1]}`);
    if (tag) {
      const tagStart = tag.index + tag[0].indexOf('"') + 1;
      addEntry(context, [`tag:${tag[1]}`], lineIndex, tagStart, tagStart + tag[1].length, { format: "quoted" });
    }
    const merged = text.match(/^(\s*merge\s+)(\S+)/);
    if (id && !trimmed.startsWith("cherry-pick")) {
      const start = id.index + id[0].indexOf('"') + 1;
      addEntry(context, keys, lineIndex, start, start + id[1].length, { format: "quoted" });
    } else {
      addEntry(context, keys, lineIndex, 0, text.length, {
        // A cherry-pick's id names the picked commit, not the new one.
        rename: trimmed.startsWith("cherry-pick") ? null : "appendGitId",
        mentions: merged ? [merged[2]] : [],
      });
    }
    sequence += 1;
  });
}

function buildQuadrant(context) {
  addTitleFromHeader(context);
  forEachBodyLine(context, (text, lineIndex) => {
    if (addTitle(context, text, lineIndex)) return;
    const axis = text.match(/^(\s*[xy]-axis\s+)(.*)$/);
    if (axis) {
      const arrow = text.indexOf("-->");
      const firstEnd = arrow >= 0 ? arrow : text.length;
      addEntry(context, [], lineIndex, axis[1].length, firstEnd, quotedOrTrimmed(text, axis[1].length, firstEnd));
      if (arrow >= 0) addEntry(context, [], lineIndex, arrow + 3, text.length, quotedOrTrimmed(text, arrow + 3, text.length));
      return;
    }
    const quadrant = text.match(/^(\s*quadrant-(\d)\s+)(.*)$/);
    if (quadrant) {
      addEntry(context, [`quadrant:${quadrant[2]}`], lineIndex, quadrant[1].length, text.length);
      return;
    }
    const point = text.match(/^(\s*)([^:]+?)\s*:\s*\[/);
    if (point) {
      addEntry(context, [], lineIndex, point[1].length, point[1].length + point[2].length, { format: "field" });
    }
  });
}

function buildOther(context) {
  const header = context.lines[context.headerIndex].trim();
  if (/^xychart/.test(header)) return buildXyChart(context);
  if (/^block/.test(header)) return buildShapedNodes(context);
  if (/^kanban/.test(header)) return buildShapedNodes(context);
  if (/^architecture/.test(header)) return buildArchitecture(context);
  if (/^requirementDiagram/.test(header)) return buildRequirement(context);
  if (/^sankey/.test(header)) return buildSankey(context);
  return buildByLabels(context);
}

function buildXyChart(context) {
  addTitleFromHeader(context);
  let plot = 0;
  forEachBodyLine(context, (text, lineIndex) => {
    if (addTitle(context, text, lineIndex)) return;
    const series = text.match(/^(\s*)(bar|line)\b/);
    if (series) {
      addLineEntry(context, [`plot:${plot}`], lineIndex);
      plot += 1;
      return;
    }
    const axis = text.match(/^(\s*[xy]-axis\s+)/);
    if (axis) {
      for (const label of labelSpans(text, axis[0].length)) {
        addEntry(context, [], lineIndex, label.start, label.end, { format: label.format });
      }
    }
  });
}

// block-beta and kanban: lines of `id["Label"]`-style nodes.
function buildShapedNodes(context) {
  const seen = new Set();
  forEachBodyLine(context, (text, lineIndex) => {
    let position = getIndent(text).length;
    while (position < text.length) {
      const ref = parseFlowchartNodeRef(text, position);
      if (!ref) {
        position += 1;
        continue;
      }
      if (!seen.has(ref.id) && !/^(columns|space|end|block)$/.test(ref.id)) {
        seen.add(ref.id);
        const labeled = ref.labelStart >= 0;
        addEntry(context, [`node:${ref.id}`], lineIndex, labeled ? ref.labelStart : ref.start, labeled ? ref.labelEnd : ref.idEnd, {
          ...(labeled ? quotedOrTrimmed(text, ref.labelStart, ref.labelEnd) : {}),
          rename: labeled ? "span" : "identifier",
          format: labeled ? "bracket" : "word",
        });
      }
      position = Math.max(ref.end, position + 1);
    }
  });
}

function buildArchitecture(context) {
  forEachBodyLine(context, (text, lineIndex) => {
    const item = text.match(/^(\s*(?:service|group|junction)\s+)([\p{L}\p{N}_-]+)/u);
    if (!item) return;
    const open = text.indexOf("[", item[0].length);
    const close = open >= 0 ? text.indexOf("]", open) : -1;
    if (open >= 0 && close > open) {
      addEntry(context, [`node:${item[2]}`], lineIndex, open + 1, close, {
        ...quotedOrTrimmed(text, open + 1, close),
        format: "bracket",
      });
    } else {
      addEntry(context, [`node:${item[2]}`], lineIndex, item[1].length, item[0].length, {
        rename: "identifier",
        format: "word",
      });
    }
  });
}

const REQUIREMENT_FIELD_NAMES = {
  id: "id",
  text: "text",
  risk: "risk",
  verifymethod: "verification",
  type: "type",
  docref: "doc ref",
};

function buildRequirement(context) {
  let open = null;
  forEachBodyLine(context, (text, lineIndex, trimmed) => {
    if (open) {
      if (trimmed === "}") {
        open = null;
        return;
      }
      const field = text.match(/^(\s*)(\w+)\s*:\s*(.*)$/);
      if (field) {
        const name = REQUIREMENT_FIELD_NAMES[field[2].toLowerCase()] || field[2].toLowerCase();
        const start = text.indexOf(":") + 1;
        addEntry(context, [`field:${open}:${name}`], lineIndex, start, text.length, {
          ...quotedOrTrimmed(text, start, text.length),
          mentions: [open],
        });
      }
      return;
    }
    const block = text.match(/^(\s*\w+\s+)([\p{L}\p{N}_-]+)\s*\{\s*$/u);
    if (block) {
      open = block[2];
      addEntry(context, [`node:${block[2]}`], lineIndex, block[1].length, block[1].length + block[2].length, {
        rename: "identifier",
        format: "word",
      });
      return;
    }
    const relation = text.match(/^\s*([\p{L}\p{N}_-]+)\s*-\s*(\w+)\s*->\s*([\p{L}\p{N}_-]+)/u);
    if (relation) {
      const start = text.indexOf(relation[2], text.indexOf("-"));
      addEntry(context, [`edge:${relation[1]}>${relation[3]}`], lineIndex, start, start + relation[2].length, {
        rename: null,
        mentions: [relation[1], relation[3]],
      });
    }
  });
}

// sankey-beta: CSV rows "source,target,value". Mermaid draws nodes in order
// of first appearance and one link per row.
function buildSankey(context) {
  const nodes = new Map();
  let link = 0;
  forEachBodyLine(context, (text, lineIndex) => {
    const fields = text.split(",");
    if (fields.length < 3) return;
    let position = 0;
    fields.slice(0, 2).forEach((field) => {
      const name = field.trim().replace(/^"(.*)"$/, "$1");
      if (name && !nodes.has(name)) {
        nodes.set(name, nodes.size);
        addEntry(context, [`sankeyNode:${nodes.get(name)}`], lineIndex, position, position + field.length, {
          ...quotedOrTrimmed(text, position, position + field.length),
          rename: "csvField",
        });
      }
      position += field.length + 1;
    });
    addLineEntry(context, [`sankeyLink:${link}`], lineIndex);
    link += 1;
  });
}

// Fallback for diagram types without structural ids: every quoted string and
// every bracketed or colon-delimited label becomes an entry matched by text.
function buildByLabels(context) {
  addTitleFromHeader(context);
  forEachBodyLine(context, (text, lineIndex) => {
    if (addTitle(context, text, lineIndex)) return;
    const curve = text.match(/^(\s*curve\s+)([\p{L}\p{N}_-]+)(?!\s*\[)/u);
    if (curve) {
      addEntry(context, [], lineIndex, curve[1].length, curve[1].length + curve[2].length, {
        rename: "identifier",
        format: "word",
      });
      return;
    }
    const axis = text.match(/^(\s*axis\s+)(.*)$/);
    if (axis && !axis[2].includes('"')) {
      let position = axis[1].length;
      for (const part of axis[2].split(",")) {
        addEntry(context, [], lineIndex, position, position + part.length, { format: "field" });
        position += part.length + 1;
      }
      return;
    }
    const spans = labelSpans(text, getIndent(text).length);
    if (spans.length) {
      for (const span of spans) {
        addEntry(context, [], lineIndex, span.start, span.end, { format: span.format });
      }
      return;
    }
    // Plain CSV (sankey) and "name: value" style lines.
    let position = 0;
    for (const part of text.split(/[,:]/)) {
      const start = position;
      position += part.length + 1;
      if (part.trim() && !/^[\s\d.%-]+$/.test(part)) {
        addEntry(context, [], lineIndex, start, start + part.length, { format: "field" });
      }
    }
  });
}

function labelSpans(text, from) {
  const spans = [];
  const quoted = /"([^"]*)"/g;
  quoted.lastIndex = from;
  for (const match of text.matchAll(quoted)) {
    if (match.index < from) continue;
    spans.push({ start: match.index + 1, end: match.index + 1 + match[1].length, format: "quoted" });
  }
  if (spans.length) return spans;
  const list = text.slice(from).match(/^\s*\[(.*)\]\s*$/);
  if (list) {
    let position = text.indexOf("[", from) + 1;
    for (const part of list[1].split(",")) {
      spans.push({ start: position, end: position + part.length, format: "field" });
      position += part.length + 1;
    }
  }
  return spans;
}
