// Pure Mermaid source helpers for the rich Mermaid editor.
//
// Everything here works on the diagram text alone (no DOM, CodeMirror, or
// Mermaid runtime) so the visual editor can be tested line by line. The source
// stays the single source of truth: visual edits are expressed as rewrites of
// the smallest piece of text that carries them, and any line the flowchart
// parser does not understand is left exactly as the author wrote it.
import { getMinimalTextChange } from "./textChange.js";

export const MERMAID_TEMPLATES = [
  {
    key: "flowchart",
    label: "Flowchart",
    code: [
      "flowchart TD",
      "    A[Start] --> B{Decision}",
      "    B -->|Yes| C[Do it]",
      "    B -->|No| D[Skip]",
    ].join("\n"),
  },
  {
    key: "sequence",
    label: "Sequence",
    code: [
      "sequenceDiagram",
      "    participant A as Alice",
      "    participant B as Bob",
      "    A->>B: Hello Bob",
      "    B-->>A: Hi Alice",
    ].join("\n"),
  },
  {
    key: "class",
    label: "Class",
    code: [
      "classDiagram",
      "    class Animal {",
      "        +String name",
      "        +move()",
      "    }",
      "    Animal <|-- Dog",
    ].join("\n"),
  },
  {
    key: "state",
    label: "State",
    code: [
      "stateDiagram-v2",
      "    [*] --> Idle",
      "    Idle --> Running: start",
      "    Running --> Idle: stop",
      "    Running --> [*]",
    ].join("\n"),
  },
  {
    key: "er",
    label: "ER",
    code: [
      "erDiagram",
      "    CUSTOMER ||--o{ ORDER : places",
      "    ORDER ||--|{ LINE_ITEM : contains",
    ].join("\n"),
  },
  {
    key: "gantt",
    label: "Gantt",
    code: [
      "gantt",
      "    title Plan",
      "    dateFormat YYYY-MM-DD",
      "    section Build",
      "    Design :a1, 2026-01-01, 5d",
      "    Implement :after a1, 10d",
    ].join("\n"),
  },
  {
    key: "pie",
    label: "Pie",
    code: ['pie title Share', '    "A" : 40', '    "B" : 35', '    "C" : 25'].join(
      "\n",
    ),
  },
  {
    key: "mindmap",
    label: "Mindmap",
    code: ["mindmap", "  root((Topic))", "    Idea A", "    Idea B"].join("\n"),
  },
];

export const FLOWCHART_DIRECTIONS = ["TD", "LR", "BT", "RL"];

export const FLOWCHART_SHAPES = [
  { key: "rect", label: "Rectangle", open: "[", close: "]" },
  { key: "round", label: "Rounded", open: "(", close: ")" },
  { key: "stadium", label: "Stadium", open: "([", close: "])" },
  { key: "subroutine", label: "Subroutine", open: "[[", close: "]]" },
  { key: "cylinder", label: "Database", open: "[(", close: ")]" },
  { key: "circle", label: "Circle", open: "((", close: "))" },
  { key: "doublecircle", label: "Double circle", open: "(((", close: ")))" },
  { key: "rhombus", label: "Decision", open: "{", close: "}" },
  { key: "hexagon", label: "Hexagon", open: "{{", close: "}}" },
  { key: "parallelogram", label: "Parallelogram", open: "[/", close: "/]" },
  {
    key: "parallelogram-alt",
    label: "Parallelogram (alt)",
    open: "[\\",
    close: "\\]",
  },
  { key: "trapezoid", label: "Trapezoid", open: "[/", close: "\\]" },
  { key: "trapezoid-alt", label: "Trapezoid (alt)", open: "[\\", close: "/]" },
  { key: "asymmetric", label: "Flag", open: ">", close: "]" },
];

export const FLOWCHART_COLORS = [
  { key: "blue", label: "Blue", fill: "#dbeafe", stroke: "#2563eb" },
  { key: "green", label: "Green", fill: "#dcfce7", stroke: "#16a34a" },
  { key: "amber", label: "Amber", fill: "#fef3c7", stroke: "#d97706" },
  { key: "pink", label: "Pink", fill: "#fce7f3", stroke: "#db2777" },
  { key: "violet", label: "Violet", fill: "#ede9fe", stroke: "#7c3aed" },
  { key: "teal", label: "Teal", fill: "#ccfbf1", stroke: "#0f766e" },
  { key: "red", label: "Red", fill: "#fee2e2", stroke: "#dc2626" },
  { key: "slate", label: "Slate", fill: "#f1f5f9", stroke: "#64748b" },
];

const DIAGRAM_TYPES = [
  [/^(?:flowchart|graph)(?:-elk)?\b/i, "flowchart"],
  [/^sequenceDiagram\b/, "sequence"],
  [/^classDiagram(?:-v2)?\b/, "class"],
  [/^stateDiagram(?:-v2)?\b/, "state"],
  [/^erDiagram\b/, "er"],
  [/^gantt\b/, "gantt"],
  [/^pie\b/, "pie"],
  [/^mindmap\b/, "mindmap"],
  [/^journey\b/, "journey"],
  [/^gitGraph\b/, "git"],
  [/^timeline\b/, "timeline"],
  [/^quadrantChart\b/, "quadrant"],
];

const WORD = String.raw`[\p{L}\p{N}_]`;
const ID_PATTERN = new RegExp(String.raw`${WORD}+(?:[.\-]${WORD}+)*`, "uy");
const LINK_ID_PREFIX = String.raw`(?:${WORD}+@)?`;
// Plain links in the order Mermaid's lexer would prefer them: arrow heads
// before open lines so "-->" is never read as "--" followed by ">".
const PLAIN_LINK_PATTERN = new RegExp(
  String.raw`${LINK_ID_PREFIX}[<ox]?(?:-{2,}>|-\.+->|-\.+-[ox](?!${WORD})|-\.+-|-{2,}[ox](?!${WORD})|-{3,}|={2,}>|={2,}[ox](?!${WORD})|={3,}|~{3,})`,
  "uy",
);
const TEXT_LINK_OPENER = new RegExp(
  String.raw`${LINK_ID_PREFIX}[<ox]?(--|==|-\.)(?=\s)`,
  "uy",
);
const TEXT_LINK_CLOSERS = {
  "--": /\s(-{2,}>|-{2,}[ox](?![\p{L}\p{N}_])|-{3,})/gu,
  "==": /\s(={2,}>|={2,}[ox](?![\p{L}\p{N}_])|={3,})/gu,
  "-.": /\s(\.-+>|\.-+[ox](?![\p{L}\p{N}_])|\.-+)/gu,
};
const PIPE_LABEL_PATTERN = /\s*\|([^|]*)\|/y;
const CLASS_SUFFIX_PATTERN = new RegExp(String.raw`:::${WORD}[\p{L}\p{N}_-]*`, "uy");
const SHAPES_BY_OPENER = [...FLOWCHART_SHAPES].sort(
  (left, right) => right.open.length - left.open.length,
);

// Raw diagram text of a block found by findMermaidBlocks (fences excluded).
export function readMermaidBlockContent(doc, block) {
  return block.hasContentLines
    ? doc.sliceString(block.contentFrom, block.contentTo)
    : "";
}

// Smallest document change that turns the block's diagram text into
// `nextCode`, or null when nothing changes. Keeping the change small preserves
// the caret, undo granularity, and VS Code's dirty-range tracking.
export function getMermaidBlockContentChange(block, currentCode, nextCode) {
  const next = String(nextCode ?? "");
  if (next === currentCode) {
    return null;
  }
  if (!block.hasContentLines) {
    return { from: block.contentFrom, to: block.contentFrom, insert: `${next}\n` };
  }
  const change = getMinimalTextChange(currentCode, next);
  return {
    from: block.contentFrom + change.from,
    to: block.contentFrom + change.to,
    insert: change.insert,
  };
}

export function splitMermaidLines(code) {
  return String(code ?? "").split("\n");
}

// Index of the line that names the diagram type ("flowchart TD", "pie" ...),
// skipping blank lines, %% comments/directives, and a YAML front matter block.
// Mermaid reports parse errors relative to this line.
export function findMermaidHeaderLine(lines) {
  let index = 0;
  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }
  if (index < lines.length && lines[index].trim() === "---") {
    index += 1;
    while (index < lines.length && lines[index].trim() !== "---") {
      index += 1;
    }
    index += 1;
  }
  for (; index < lines.length; index += 1) {
    const text = lines[index].trim();
    if (!text || text.startsWith("%%")) {
      continue;
    }
    return index;
  }
  return -1;
}

export function detectMermaidDiagramType(code) {
  const lines = splitMermaidLines(code);
  const headerIndex = findMermaidHeaderLine(lines);
  if (headerIndex < 0) {
    return null;
  }
  const header = lines[headerIndex].trim();
  for (const [pattern, type] of DIAGRAM_TYPES) {
    if (pattern.test(header)) {
      return type;
    }
  }
  return "other";
}

// Maps a Mermaid parse error to a 0-based line of `code`, or -1 when the error
// does not carry a position (load failures, renderer crashes). The line named
// in the message wins: Jison's `loc` points at the token before the failure,
// which is the previous line when the bad token starts a line.
export function getMermaidErrorLine(error, code) {
  const lines = splitMermaidLines(code);
  const match = String(error?.message ?? error ?? "").match(/\bline (\d+)/i);
  let lineNumber = match ? Number(match[1]) : null;
  if (lineNumber === null) {
    const hashLine = error?.hash?.loc?.first_line;
    lineNumber = Number.isInteger(hashLine) ? hashLine : null;
  }
  if (!lineNumber || lineNumber < 1) {
    return -1;
  }
  const parsedLines = getMermaidParsedLines(lines);
  return parsedLines[lineNumber - 1] ?? parsedLines[parsedLines.length - 1] ?? -1;
}

// Indexes of the source lines Mermaid actually parses, in order. Mermaid drops
// front matter and directives before the header, then removes whole-line %%
// comments together with the blank lines right before them (its
// cleanupComments), so its line numbers skip those lines.
function getMermaidParsedLines(lines) {
  const parsed = [];
  let blanks = [];
  for (let index = Math.max(0, findMermaidHeaderLine(lines)); index < lines.length; index += 1) {
    const text = lines[index];
    if (!text.trim()) {
      blanks.push(index);
      continue;
    }
    if (/^\s*%%(?!\{)./.test(text)) {
      blanks = [];
      continue;
    }
    parsed.push(...blanks, index);
    blanks = [];
  }
  parsed.push(...blanks);
  return parsed;
}

// Short, single-line description of a Mermaid error for status bars.
export function summarizeMermaidError(error) {
  const message = String(error?.message ?? error ?? "Mermaid error");
  const got = message.match(/got '([^']+)'/)?.[1];
  const found = message.match(/but found:? [`']([^`']+)[`']/)?.[1];
  if (/parse error|parsing failed|lexer error/i.test(message)) {
    const token = got || found;
    return token ? `Syntax error near ${token}` : "Syntax error";
  }
  return message.split("\n")[0];
}

// Mermaid node groups carry DOM ids like "<renderId>-flowchart-A-0".
export function parseMermaidNodeDomId(domId, renderId = "") {
  let value = String(domId ?? "");
  if (renderId && value.startsWith(`${renderId}-`)) {
    value = value.slice(renderId.length + 1);
  }
  const match = value.match(/^(flowchart|classId|state|entity)-(.+)-(\d+)$/);
  if (!match) {
    return null;
  }
  return { kind: match[1], id: match[2] };
}

// Flowchart edges carry data-ids like "L_A_B_0". Node ids may contain "_", so
// the split is resolved against the ids the source actually defines.
export function parseFlowchartEdgeDomId(dataId, nodeIds) {
  const match = String(dataId ?? "").match(/^L[_-](.+)[_-](\d+)$/);
  if (!match) {
    return null;
  }
  const body = match[1];
  const known = nodeIds instanceof Set ? nodeIds : new Set(nodeIds || []);
  for (let index = 1; index < body.length - 1; index += 1) {
    if (body[index] !== "_" && body[index] !== "-") {
      continue;
    }
    const from = body.slice(0, index);
    const to = body.slice(index + 1);
    if (known.has(from) && known.has(to)) {
      return { from, to, occurrence: Number(match[2]) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Flowchart parsing

export function parseFlowchart(code) {
  const lines = splitMermaidLines(code);
  const headerIndex = findMermaidHeaderLine(lines);
  const statements = [];
  const nodes = new Map();
  const edges = [];
  let direction = null;
  let depth = 0;
  const lineDepths = [];

  lines.forEach((text, lineIndex) => {
    lineDepths.push(depth);
    if (lineIndex === headerIndex) {
      const header = text.match(
        /^(\s*)(?:flowchart|graph)(?:-elk)?(?:\s+(TB|TD|BT|RL|LR))?\s*/i,
      );
      direction = header?.[2] ? header[2].toUpperCase() : "TD";
      const headerEnd = header ? header[0].length : text.length;
      statements.push({
        lineIndex,
        start: 0,
        end: headerEnd,
        kind: "header",
      });
      // "graph TD; A-->B" keeps statements on the header line.
      if (text[headerEnd] === ";") {
        statements.push(...parseFlowchartLine(text, lineIndex, headerEnd + 1));
      }
      return;
    }
    if (headerIndex < 0 || lineIndex < headerIndex) {
      return;
    }
    for (const statement of parseFlowchartLine(text, lineIndex)) {
      statements.push(statement);
      if (statement.kind === "subgraph") {
        depth += 1;
      } else if (statement.kind === "end") {
        depth = Math.max(0, depth - 1);
      }
    }
  });

  for (const statement of statements) {
    collectStatementNodes(statement, nodes);
    if (statement.kind !== "chain") {
      continue;
    }
    statement.links.forEach((link, linkIndex) => {
      for (const fromRef of statement.groups[linkIndex]) {
        for (const toRef of statement.groups[linkIndex + 1]) {
          edges.push({
            from: fromRef.id,
            to: toRef.id,
            lineIndex: statement.lineIndex,
            statement,
            linkIndex,
            link,
          });
        }
      }
    });
  }

  return {
    lines,
    headerIndex,
    direction,
    statements,
    nodes,
    edges,
    lineDepths,
  };
}

function collectStatementNodes(statement, nodes) {
  if (statement.kind !== "chain") {
    return;
  }
  for (const group of statement.groups) {
    for (const ref of group) {
      let node = nodes.get(ref.id);
      if (!node) {
        node = { id: ref.id, refs: [], labeled: null };
        nodes.set(ref.id, node);
      }
      node.refs.push({ lineIndex: statement.lineIndex, ref, statement });
      if (!node.labeled && ref.shape) {
        node.labeled = { lineIndex: statement.lineIndex, ref, statement };
      }
    }
  }
}

function parseFlowchartLine(text, lineIndex, startAt = 0) {
  const statements = [];
  let position = startAt;
  while (position < text.length) {
    position = skipSpaces(text, position);
    if (position >= text.length) {
      break;
    }
    if (text[position] === ";") {
      position += 1;
      continue;
    }
    const statement = parseFlowchartStatement(text, position, lineIndex);
    statements.push(statement);
    position = statement.end;
    if (statement.kind === "unknown") {
      break;
    }
  }
  return statements;
}

function parseFlowchartStatement(text, start, lineIndex) {
  const rest = text.slice(start);
  const whole = (kind, extra = {}) => ({
    lineIndex,
    start,
    end: text.length,
    kind,
    ...extra,
  });

  if (rest.startsWith("%%")) {
    return whole("comment");
  }
  if (/^subgraph\b/.test(rest)) {
    return whole("subgraph");
  }
  if (/^end\s*;?\s*$/.test(rest)) {
    return whole("end");
  }
  if (/^direction\s+\w+/.test(rest)) {
    return whole("direction");
  }
  const style = rest.match(/^style\s+(\S+)/);
  if (style) {
    return whole("style", { target: style[1] });
  }
  if (/^classDef\b/.test(rest)) {
    return whole("classDef");
  }
  const classAssign = rest.match(/^class\s+(\S+)\s+(\S+)/);
  if (classAssign) {
    return whole("class", {
      targets: classAssign[1].split(","),
      className: classAssign[2],
    });
  }
  const click = rest.match(/^click\s+(\S+)/);
  if (click) {
    return whole("click", { target: click[1] });
  }
  if (/^linkStyle\b/.test(rest)) {
    return whole("linkStyle");
  }

  const chain = parseFlowchartChain(text, start);
  if (!chain) {
    return whole("unknown");
  }
  return { lineIndex, start, end: chain.end, kind: "chain", ...chain };
}

function parseFlowchartChain(text, start) {
  const groups = [];
  const links = [];
  let position = start;

  for (;;) {
    const group = parseFlowchartGroup(text, position);
    if (!group) {
      return null;
    }
    groups.push(group.refs);
    position = skipSpaces(text, group.end);
    if (position >= text.length || text[position] === ";") {
      return { groups, links, end: position };
    }
    const link = parseFlowchartLink(text, position);
    if (!link) {
      return null;
    }
    links.push(link);
    position = skipSpaces(text, link.end);
  }
}

function parseFlowchartGroup(text, start) {
  const refs = [];
  let position = start;
  for (;;) {
    const ref = parseFlowchartNodeRef(text, position);
    if (!ref) {
      return null;
    }
    refs.push(ref);
    const next = skipSpaces(text, ref.end);
    if (text[next] !== "&") {
      return { refs, end: ref.end };
    }
    position = skipSpaces(text, next + 1);
  }
}

export function parseFlowchartNodeRef(text, start) {
  ID_PATTERN.lastIndex = start;
  const idMatch = ID_PATTERN.exec(text);
  if (!idMatch) {
    return null;
  }
  const id = idMatch[0];
  if (id === "end" || id === "subgraph") {
    return null;
  }
  const idEnd = start + id.length;
  const ref = {
    id,
    start,
    idEnd,
    end: idEnd,
    shape: null,
    shapeEnd: idEnd,
    labelStart: -1,
    labelEnd: -1,
    label: null,
  };

  const shape = parseFlowchartShape(text, idEnd);
  if (shape) {
    Object.assign(ref, shape);
    ref.end = shape.shapeEnd;
  }

  CLASS_SUFFIX_PATTERN.lastIndex = ref.end;
  const classSuffix = CLASS_SUFFIX_PATTERN.exec(text);
  if (classSuffix) {
    ref.end += classSuffix[0].length;
  }
  return ref;
}

function parseFlowchartShape(text, start) {
  if (text.startsWith("@{", start)) {
    return parseFlowchartAttributeShape(text, start);
  }

  let best = null;
  for (const shape of SHAPES_BY_OPENER) {
    if (!text.startsWith(shape.open, start)) {
      continue;
    }
    if (best && best.openLength > shape.open.length) {
      break;
    }
    const labelStart = start + shape.open.length;
    let labelEnd;
    let closeStart;
    if (text[labelStart] === '"') {
      const quoteEnd = text.indexOf('"', labelStart + 1);
      if (quoteEnd < 0 || !text.startsWith(shape.close, quoteEnd + 1)) {
        continue;
      }
      labelEnd = quoteEnd + 1;
      closeStart = quoteEnd + 1;
    } else {
      closeStart = text.indexOf(shape.close, labelStart);
      if (closeStart < 0) {
        continue;
      }
      labelEnd = closeStart;
    }
    if (!best || closeStart < best.closeStart) {
      best = {
        openLength: shape.open.length,
        closeStart,
        shape: shape.key,
        labelStart,
        labelEnd,
        shapeEnd: closeStart + shape.close.length,
      };
    }
  }
  if (!best) {
    return null;
  }
  const raw = text.slice(best.labelStart, best.labelEnd);
  return {
    shape: best.shape,
    labelStart: best.labelStart,
    labelEnd: best.labelEnd,
    shapeEnd: best.shapeEnd,
    label: unquoteFlowchartLabel(raw),
  };
}

function parseFlowchartAttributeShape(text, start) {
  let position = start + 2;
  let quote = null;
  for (; position < text.length; position += 1) {
    const character = text[position];
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "}") {
      break;
    }
  }
  if (position >= text.length) {
    return null;
  }
  const body = text.slice(start + 2, position);
  const label = body.match(/\blabel\s*:\s*("([^"]*)"|'([^']*)'|[^,}]+)/);
  const labelOffset = label ? start + 2 + label.index + label[0].indexOf(label[1]) : -1;
  return {
    shape: "attrs",
    labelStart: label ? labelOffset : -1,
    labelEnd: label ? labelOffset + label[1].length : -1,
    shapeEnd: position + 1,
    label: label ? unquoteFlowchartLabel(label[1].trim()) : null,
  };
}

function parseFlowchartLink(text, start) {
  PLAIN_LINK_PATTERN.lastIndex = start;
  const plain = PLAIN_LINK_PATTERN.exec(text);
  if (plain) {
    const link = {
      start,
      arrowEnd: start + plain[0].length,
      end: start + plain[0].length,
      arrow: plain[0],
      label: null,
      labelStart: -1,
      labelEnd: -1,
      labelKind: null,
    };
    PIPE_LABEL_PATTERN.lastIndex = link.end;
    const pipe = PIPE_LABEL_PATTERN.exec(text);
    if (pipe) {
      link.labelKind = "pipe";
      link.labelStart = link.end + pipe[0].indexOf("|") + 1;
      link.labelEnd = link.labelStart + pipe[1].length;
      link.label = unquoteFlowchartLabel(pipe[1].trim());
      link.end += pipe[0].length;
    }
    return link;
  }

  TEXT_LINK_OPENER.lastIndex = start;
  const opener = TEXT_LINK_OPENER.exec(text);
  if (!opener) {
    return null;
  }
  const closer = TEXT_LINK_CLOSERS[opener[1]];
  closer.lastIndex = start + opener[0].length + 1;
  const closing = closer.exec(text);
  if (!closing) {
    return null;
  }
  const rawStart = start + opener[0].length;
  const rawEnd = closing.index;
  const raw = text.slice(rawStart, rawEnd);
  const leading = raw.length - raw.trimStart().length;
  const labelText = raw.trim();
  if (!labelText) {
    return null;
  }
  const closeToken = closing[1];
  const end = closing.index + 1 + closeToken.length;
  return {
    start,
    arrowEnd: end,
    end,
    arrow: text.slice(start, end),
    closeToken,
    label: unquoteFlowchartLabel(labelText),
    labelStart: rawStart + leading,
    labelEnd: rawStart + leading + labelText.length,
    labelKind: "inline",
  };
}

function skipSpaces(text, position) {
  while (position < text.length && (text[position] === " " || text[position] === "\t")) {
    position += 1;
  }
  return position;
}

function unquoteFlowchartLabel(raw) {
  const text = String(raw ?? "");
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/#quot;/g, '"');
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1);
  }
  return text;
}

// Labels are written unquoted when Mermaid would read them back verbatim and
// quoted otherwise. Double quotes cannot be escaped portably in every Mermaid
// version, so they become single quotes.
export function formatFlowchartLabel(label) {
  const clean = String(label ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/"/g, "'")
    .trim();
  if (!clean) {
    return "";
  }
  return /[[\](){}|<>;&#:@=]|^[\s-]|--|==/.test(clean) ? `"${clean}"` : clean;
}

function getShape(key) {
  return FLOWCHART_SHAPES.find((shape) => shape.key === key) || FLOWCHART_SHAPES[0];
}

function replaceInLine(lines, lineIndex, from, to, insert) {
  const next = [...lines];
  const text = next[lineIndex];
  next[lineIndex] = text.slice(0, from) + insert + text.slice(to);
  return next;
}

export function getIndent(text) {
  return text.match(/^\s*/)[0];
}

function getStatementIndent(model) {
  for (const statement of model.statements) {
    if (statement.kind === "chain" && model.lineDepths[statement.lineIndex] === 0) {
      return getIndent(model.lines[statement.lineIndex]) || "    ";
    }
  }
  return "    ";
}

// New statements go after the last top-level node/edge line so they stay out
// of subgraphs and ahead of trailing style/class/click definitions.
function getInsertionLine(model) {
  let index = model.headerIndex;
  for (const statement of model.statements) {
    const lineIndex = statement.lineIndex;
    if (
      (statement.kind === "chain" || statement.kind === "end") &&
      model.lineDepths[lineIndex] === (statement.kind === "end" ? 1 : 0)
    ) {
      index = Math.max(index, lineIndex);
    }
  }
  return index + 1;
}

function insertLines(model, newLines, at = getInsertionLine(model)) {
  const lines = [...model.lines];
  lines.splice(at, 0, ...newLines);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Flowchart subgraphs

// Subgraph blocks in source order. Ids follow Mermaid: "subgraph id [title]"
// and "subgraph id" name the block; a bare title with spaces gets
// "subGraphN", numbered in the order blocks close. `parent` is the enclosing
// block's id; an unclosed block keeps endLine -1.
export function readFlowchartSubgraphs(model) {
  const subgraphs = [];
  const stack = [];
  let closed = 0;
  for (const statement of model.statements) {
    if (statement.kind === "subgraph") {
      const header = parseSubgraphHeader(
        model.lines[statement.lineIndex].slice(statement.start),
      );
      const subgraph = {
        ...header,
        lineIndex: statement.lineIndex,
        endLine: -1,
        depth: stack.length,
        parentBlock: stack.at(-1) ?? null,
        order: -1,
      };
      subgraphs.push(subgraph);
      stack.push(subgraph);
    } else if (statement.kind === "end" && stack.length) {
      const subgraph = stack.pop();
      subgraph.endLine = statement.lineIndex;
      subgraph.order = closed;
      subgraph.id = subgraph.id ?? `subGraph${closed}`;
      closed += 1;
    }
  }
  return subgraphs.map(({ parentBlock, ...subgraph }) => ({
    ...subgraph,
    parent: parentBlock?.id ?? null,
  }));
}

export function getFlowchartSubgraphs(code) {
  return readFlowchartSubgraphs(parseFlowchart(code));
}

function parseSubgraphHeader(text) {
  const rest = text.replace(/^subgraph\b\s*/, "").trim();
  const bracket = rest.match(/^([^\s[]+)\s*\[(.*)\]$/);
  if (bracket) {
    return { id: bracket[1], title: unquoteFlowchartLabel(bracket[2].trim()), form: "bracket" };
  }
  const title = unquoteFlowchartLabel(rest);
  if (!rest || /\s/.test(title)) {
    return { id: null, title, form: "title" };
  }
  return { id: title, title, form: "id" };
}

// The innermost closed subgraph whose body holds `lineIndex`.
function subgraphAt(subgraphs, lineIndex) {
  let owner = null;
  for (const subgraph of subgraphs) {
    if (
      subgraph.endLine >= 0 &&
      subgraph.lineIndex < lineIndex &&
      lineIndex < subgraph.endLine &&
      (!owner || subgraph.depth > owner.depth)
    ) {
      owner = subgraph;
    }
  }
  return owner;
}

function subgraphBodyIndent(model, subgraph) {
  for (let lineIndex = subgraph.lineIndex + 1; lineIndex < subgraph.endLine; lineIndex += 1) {
    if (model.lines[lineIndex].trim()) {
      return getIndent(model.lines[lineIndex]);
    }
  }
  return `${getIndent(model.lines[subgraph.lineIndex])}    `;
}

function ancestorsOf(subgraphs, subgraph) {
  const chain = new Set();
  for (let current = subgraph; current; ) {
    chain.add(current);
    current = current.parent ? subgraphs.find((entry) => entry.id === current.parent) : null;
  }
  return chain;
}

// The subgraph Mermaid draws a node in. Every node mentioned in a block's own
// body belongs to it, and blocks claim nodes in the order they close, so an
// inner or earlier block wins over later ones.
export function getFlowchartNodeSubgraph(code, id) {
  const model = parseFlowchart(code);
  const subgraphs = readFlowchartSubgraphs(model).filter((subgraph) => subgraph.endLine >= 0);
  const owners = new Set();
  for (const statement of model.statements) {
    if (statement.kind !== "chain" || !statement.groups.flat().some((ref) => ref.id === id)) {
      continue;
    }
    const owner = subgraphAt(subgraphs, statement.lineIndex);
    if (owner) owners.add(owner);
  }
  const [first] = [...owners].sort((left, right) => left.order - right.order);
  return first?.id ?? null;
}

// Moves a node into `subgraphId`, or out to the top level for null. Mentions
// in other blocks would keep claiming the node, so they are taken out: a lone
// mention is dropped (its label and shape travel with the node) and an edge is
// moved to the top level, leaving bare ids behind so the other nodes stay
// where they were.
export function moveFlowchartNodeToSubgraph(code, id, subgraphId = null) {
  const model = parseFlowchart(code);
  const subgraphs = readFlowchartSubgraphs(model);
  const target = subgraphId
    ? subgraphs.find((subgraph) => subgraph.id === subgraphId && subgraph.endLine >= 0)
    : null;
  if (
    !model.nodes.has(id) ||
    (subgraphId && !target) ||
    subgraphs.some((subgraph) => subgraph.id === id)
  ) {
    return code;
  }
  // Enclosing blocks close after the target, so their mentions never win.
  const keep = target ? ancestorsOf(subgraphs, target) : new Set();
  let carried = null;
  let mentionedInTarget = false;
  const moved = [];
  let next = rewriteStatements(model, (statement, lineText) => {
    if (statement.kind !== "chain") return undefined;
    const refs = statement.groups.flat();
    if (!refs.some((ref) => ref.id === id)) return undefined;
    const owner = subgraphAt(subgraphs, statement.lineIndex);
    if (owner === target) {
      mentionedInTarget = true;
      return undefined;
    }
    if (!owner || keep.has(owner)) return undefined;
    const others = refs.filter((ref) => ref.id !== id);
    if (!statement.links.length) {
      const own = refs.find((ref) => ref.id === id && ref.shape);
      if (own && !carried) carried = refText(lineText, own);
      return others.length ? [others.map((ref) => refText(lineText, ref)).join(" & ")] : [];
    }
    moved.push(lineText.slice(statement.start, statement.end).trim());
    return [...new Set(others.map((ref) => ref.id))];
  });
  if (moved.length) {
    const movedModel = parseFlowchart(next);
    const indent = getStatementIndent(movedModel);
    next = insertLines(movedModel, moved.map((text) => `${indent}${text}`));
  }
  const model2 = parseFlowchart(next);
  const entry = carried ?? (mentionedInTarget ? null : id);
  if (!entry) {
    return next;
  }
  if (!target) {
    // At the top level a bare id is only needed when nothing mentions it.
    if (!carried && model2.nodes.has(id)) return next;
    return insertLines(model2, [`${getStatementIndent(model2)}${entry}`]);
  }
  const host = readFlowchartSubgraphs(model2).find((subgraph) => subgraph.id === target.id);
  return insertLines(model2, [`${subgraphBodyIndent(model2, host)}${entry}`], host.endLine);
}

function nextFlowchartSubgraphId(model, subgraphs) {
  const used = new Set([...model.nodes.keys(), ...subgraphs.map((subgraph) => subgraph.id)]);
  for (let index = 1; ; index += 1) {
    const id = `S${index}`;
    if (!used.has(id)) return id;
  }
}

// Adds a subgraph. With `nodeId` the node moves into it, and the new block
// nests inside the node's current subgraph; otherwise it starts with a new
// node, inside `parent` when given.
export function addFlowchartSubgraph(code, { title = "Group", parent = null, nodeId = null } = {}) {
  const model = parseFlowchart(code);
  if (model.headerIndex < 0) {
    return { code, id: null, nodeId: null };
  }
  const subgraphs = readFlowchartSubgraphs(model);
  const isSubgraph = (value) => subgraphs.some((subgraph) => subgraph.id === value);
  const wraps = Boolean(nodeId && model.nodes.has(nodeId) && !isSubgraph(nodeId));
  const hostId = parent ?? (wraps ? getFlowchartNodeSubgraph(code, nodeId) : null);
  const host = hostId
    ? subgraphs.find((subgraph) => subgraph.id === hostId && subgraph.endLine >= 0)
    : null;
  const id = nextFlowchartSubgraphId(model, subgraphs);
  const indent = host ? subgraphBodyIndent(model, host) : getStatementIndent(model);
  const newNodeId = wraps ? null : nextFlowchartNodeId(code);
  const block = [
    `${indent}subgraph ${id} [${formatFlowchartLabel(title) || id}]`,
    ...(newNodeId ? [`${indent}    ${newNodeId}[New node]`] : []),
    `${indent}end`,
  ];
  let next = insertLines(model, block, host ? host.endLine : getInsertionLine(model));
  if (wraps) {
    next = moveFlowchartNodeToSubgraph(next, nodeId, id);
  }
  return { code: next, id, nodeId: wraps ? nodeId : newNodeId };
}

// Removes a subgraph block but keeps what it drew: the body moves up one
// level. Edges, styles, and clicks aimed at the block go with it, as does a
// `direction` line that only applied inside it.
export function removeFlowchartSubgraph(code, id) {
  const model = parseFlowchart(code);
  const subgraph = readFlowchartSubgraphs(model).find(
    (entry) => entry.id === id && entry.endLine >= 0,
  );
  if (!subgraph) {
    return code;
  }
  const outer = getIndent(model.lines[subgraph.lineIndex]);
  const inner = subgraphBodyIndent(model, subgraph);
  const strip = inner.startsWith(outer) ? inner.length - outer.length : 0;
  const directionLines = new Set(
    model.statements
      .filter(
        (statement) =>
          statement.kind === "direction" &&
          model.lineDepths[statement.lineIndex] === subgraph.depth + 1 &&
          statement.lineIndex > subgraph.lineIndex &&
          statement.lineIndex < subgraph.endLine,
      )
      .map((statement) => statement.lineIndex),
  );
  const dedent = new RegExp(`^[ \\t]{0,${strip}}`);
  const lines = model.lines.flatMap((text, lineIndex) => {
    if (
      lineIndex === subgraph.lineIndex ||
      lineIndex === subgraph.endLine ||
      directionLines.has(lineIndex)
    ) {
      return [];
    }
    const inside = lineIndex > subgraph.lineIndex && lineIndex < subgraph.endLine;
    return [inside && strip ? text.replace(dedent, "") : text];
  });
  return removeFlowchartReferences(parseFlowchart(lines.join("\n")), id);
}

export function getFlowchartNodeIds(code) {
  return new Set(parseFlowchart(code).nodes.keys());
}

export function getFlowchartNode(code, id) {
  const model = parseFlowchart(code);
  const node = model.nodes.get(id);
  if (!node) {
    return null;
  }
  return {
    id,
    shape: node.labeled?.ref.shape ?? null,
    label: node.labeled?.ref.label ?? id,
    lineIndex: (node.labeled || node.refs[0]).lineIndex,
  };
}

export function getFlowchartDirection(code) {
  return parseFlowchart(code).direction;
}

export function setFlowchartDirection(code, direction) {
  const value = String(direction || "").toUpperCase();
  if (!FLOWCHART_DIRECTIONS.includes(value) && value !== "TB") {
    return code;
  }
  const model = parseFlowchart(code);
  if (model.headerIndex < 0) {
    return code;
  }
  const lines = [...model.lines];
  lines[model.headerIndex] = lines[model.headerIndex].replace(
    /^(\s*(?:flowchart|graph)(?:-elk)?)(?:\s+(?:TB|TD|BT|RL|LR))?/i,
    `$1 ${value}`,
  );
  return lines.join("\n");
}

export function nextFlowchartNodeId(code) {
  const ids = getFlowchartNodeIds(code);
  for (let index = 1; ; index += 1) {
    const id = `N${index}`;
    if (!ids.has(id)) {
      return id;
    }
  }
}

export function renameFlowchartNodeLabel(code, id, label) {
  const text = formatFlowchartLabel(label);
  const model = parseFlowchart(code);
  const node = model.nodes.get(id);
  if (!node || !text) {
    return code;
  }
  if (node.labeled) {
    const { lineIndex, ref } = node.labeled;
    if (ref.shape === "attrs") {
      const quoted = `"${text.replace(/^"|"$/g, "")}"`;
      if (ref.labelStart >= 0) {
        return replaceInLine(model.lines, lineIndex, ref.labelStart, ref.labelEnd, quoted).join("\n");
      }
      return replaceInLine(
        model.lines,
        lineIndex,
        ref.shapeEnd - 1,
        ref.shapeEnd - 1,
        `, label: ${quoted} `,
      ).join("\n");
    }
    return replaceInLine(model.lines, lineIndex, ref.labelStart, ref.labelEnd, text).join("\n");
  }
  const { lineIndex, ref } = node.refs[0];
  return replaceInLine(model.lines, lineIndex, ref.idEnd, ref.idEnd, `[${text}]`).join("\n");
}

export function setFlowchartNodeShape(code, id, shapeKey) {
  const shape = getShape(shapeKey);
  const model = parseFlowchart(code);
  const node = model.nodes.get(id);
  if (!node) {
    return code;
  }
  if (node.labeled) {
    const { lineIndex, ref } = node.labeled;
    if (ref.shape === "attrs") {
      return code;
    }
    const rawLabel = model.lines[lineIndex].slice(ref.labelStart, ref.labelEnd);
    return replaceInLine(
      model.lines,
      lineIndex,
      ref.idEnd,
      ref.shapeEnd,
      `${shape.open}${rawLabel}${shape.close}`,
    ).join("\n");
  }
  const { lineIndex, ref } = node.refs[0];
  return replaceInLine(
    model.lines,
    lineIndex,
    ref.idEnd,
    ref.idEnd,
    `${shape.open}${formatFlowchartLabel(id) || id}${shape.close}`,
  ).join("\n");
}

export function getFlowchartNodeColor(code, id) {
  const model = parseFlowchart(code);
  const style = model.statements.find(
    (statement) => statement.kind === "style" && statement.target === id,
  );
  if (!style) {
    return null;
  }
  const fill = model.lines[style.lineIndex].match(/fill:\s*(#[0-9a-f]{3,8})/i)?.[1];
  return (
    FLOWCHART_COLORS.find(
      (color) => color.fill.toLowerCase() === String(fill).toLowerCase(),
    )?.key ?? null
  );
}

// Colors are written as `style <id> ...` lines: Mermaid applies them inline
// with !important, so they win over Richdown's palette as well.
export function setFlowchartNodeColor(code, id, colorKey) {
  const model = parseFlowchart(code);
  if (!hasFlowchartElement(model, id)) {
    return code;
  }
  const color = FLOWCHART_COLORS.find((entry) => entry.key === colorKey) || null;
  const styleLines = new Set(
    model.statements
      .filter((statement) => statement.kind === "style" && statement.target === id)
      .map((statement) => statement.lineIndex),
  );
  const indent = getStatementIndent(model);
  const styleText = color
    ? `style ${id} fill:${color.fill},stroke:${color.stroke},color:#172033`
    : null;
  if (!styleLines.size) {
    if (!styleText) {
      return code;
    }
    const lines = [...model.lines];
    let last = lines.length - 1;
    while (last > model.headerIndex && !lines[last].trim()) {
      last -= 1;
    }
    lines.splice(last + 1, 0, `${indent}${styleText}`);
    return lines.join("\n");
  }
  const lines = [];
  let replaced = false;
  model.lines.forEach((text, lineIndex) => {
    if (!styleLines.has(lineIndex)) {
      lines.push(text);
      return;
    }
    if (styleText && !replaced) {
      lines.push(`${getIndent(text)}${styleText}`);
      replaced = true;
    }
  });
  return lines.join("\n");
}

// Colors and edges also apply to subgraphs, which are addressed by their id.
function hasFlowchartElement(model, id) {
  return (
    model.nodes.has(id) ||
    readFlowchartSubgraphs(model).some((subgraph) => subgraph.id === id && subgraph.endLine >= 0)
  );
}

// `subgraph` puts the new statement inside that block instead of at the top
// level.
export function addFlowchartNode(
  code,
  { label = "New node", shape = "rect", from = null, subgraph = null } = {},
) {
  const model = parseFlowchart(code);
  if (model.headerIndex < 0) {
    return { code, id: null };
  }
  const id = nextFlowchartNodeId(code);
  const shapeSpec = getShape(shape);
  const nodeText = `${id}${shapeSpec.open}${formatFlowchartLabel(label) || id}${shapeSpec.close}`;
  const statement =
    from && hasFlowchartElement(model, from) ? `${from} --> ${nodeText}` : nodeText;
  const host = subgraph
    ? readFlowchartSubgraphs(model).find((entry) => entry.id === subgraph && entry.endLine >= 0)
    : null;
  if (host) {
    return {
      code: insertLines(model, [`${subgraphBodyIndent(model, host)}${statement}`], host.endLine),
      id,
    };
  }
  return {
    code: insertLines(model, [`${getStatementIndent(model)}${statement}`]),
    id,
  };
}

export function addFlowchartEdge(code, from, to, label = "") {
  const model = parseFlowchart(code);
  if (
    model.headerIndex < 0 ||
    !from ||
    !to ||
    !hasFlowchartElement(model, from) ||
    !hasFlowchartElement(model, to)
  ) {
    return code;
  }
  if (model.edges.some((edge) => edge.from === from && edge.to === to)) {
    return code;
  }
  const text = formatFlowchartLabel(label);
  const arrow = text ? `-->|${text}|` : "-->";
  return insertLines(model, [`${getStatementIndent(model)}${from} ${arrow} ${to}`]);
}

function findFlowchartEdge(model, from, to, occurrence = 0) {
  const matches = model.edges.filter((edge) => edge.from === from && edge.to === to);
  return matches[occurrence] || matches[0] || null;
}

export function renameFlowchartEdgeLabel(code, from, to, label, occurrence = 0) {
  const model = parseFlowchart(code);
  const edge = findFlowchartEdge(model, from, to, occurrence);
  if (!edge) {
    return code;
  }
  const { link, lineIndex } = edge;
  const text = formatFlowchartLabel(label);
  const lineText = model.lines[lineIndex];
  if (link.labelKind === "pipe") {
    if (!text) {
      return replaceInLine(model.lines, lineIndex, link.arrowEnd, link.end, "").join("\n");
    }
    return replaceInLine(model.lines, lineIndex, link.labelStart, link.labelEnd, text).join("\n");
  }
  if (link.labelKind === "inline") {
    if (!text) {
      const head = lineText.slice(link.start, link.start + 1) === "<" ? "<" : "";
      return replaceInLine(
        model.lines,
        lineIndex,
        link.start,
        link.end,
        `${head}${link.closeToken.replace(/^\./, "-.")}`,
      ).join("\n");
    }
    return replaceInLine(model.lines, lineIndex, link.labelStart, link.labelEnd, text).join("\n");
  }
  if (!text) {
    return code;
  }
  return replaceInLine(model.lines, lineIndex, link.arrowEnd, link.arrowEnd, `|${text}|`).join("\n");
}

function refText(lineText, ref) {
  return lineText.slice(ref.start, ref.end);
}

function linkText(lineText, link) {
  return lineText.slice(link.start, link.end);
}

// Rebuilds one chain statement after removing nodes or links from it. Returns
// the replacement statements (possibly none) as source text.
function rebuildChain(model, statement, { removeId = null, removeLink = null }) {
  const lineText = model.lines[statement.lineIndex];
  const outputs = [];
  let current = null;
  let pendingLink = null;

  const flush = () => {
    if (current) {
      outputs.push(current);
    }
    current = null;
    pendingLink = null;
  };

  statement.groups.forEach((group, groupIndex) => {
    const kept = group.filter((ref) => ref.id !== removeId);
    if (!kept.length) {
      flush();
      return;
    }
    if (current && pendingLink) {
      current.links.push(pendingLink);
      current.groups.push(kept);
    } else {
      flush();
      current = { groups: [kept], links: [] };
    }
    pendingLink = statement.links[groupIndex] || null;
    if (!pendingLink || !removeLink || removeLink.linkIndex !== groupIndex) {
      return;
    }
    // Removing one pair of a fan-out ("A --> B & C") keeps the other pairs
    // as explicit edges.
    const link = pendingLink;
    const pairs = [];
    for (const fromRef of kept) {
      for (const toRef of statement.groups[groupIndex + 1]) {
        if (!(fromRef.id === removeLink.from && toRef.id === removeLink.to)) {
          pairs.push({ groups: [[fromRef], [toRef]], links: [link] });
        }
      }
    }
    flush();
    outputs.push(...pairs);
  });
  flush();

  const mentions = new Map();
  const mention = (id) => mentions.set(id, (mentions.get(id) || 0) + 1);
  for (const other of model.statements) {
    if (other === statement || other.kind !== "chain") continue;
    for (const group of other.groups) {
      for (const ref of group) mention(ref.id);
    }
  }
  for (const output of outputs) {
    if (output.groups.length > 1) {
      for (const group of output.groups) {
        for (const ref of group) mention(ref.id);
      }
    }
  }

  return outputs
    .map((output) => {
      if (output.groups.length > 1) {
        return output;
      }
      // A lone node reference only matters when it defines the node or when
      // the node would otherwise disappear from the diagram.
      const refs = output.groups[0].filter(
        (ref) => ref.shape || !mentions.has(ref.id),
      );
      for (const ref of refs) mention(ref.id);
      return refs.length ? { groups: [refs], links: [] } : null;
    })
    .filter(Boolean)
    .map((output) =>
      output.groups
        .map((group, index) => {
          const groupText = group.map((ref) => refText(lineText, ref)).join(" & ");
          const link = output.links[index];
          return link ? `${groupText} ${linkText(lineText, link)}` : groupText;
        })
        .join(" "),
    );
}

function rewriteStatements(model, rewrite) {
  const byLine = new Map();
  for (const statement of model.statements) {
    if (!byLine.has(statement.lineIndex)) {
      byLine.set(statement.lineIndex, []);
    }
    byLine.get(statement.lineIndex).push(statement);
  }

  const lines = [];
  model.lines.forEach((text, lineIndex) => {
    const statements = byLine.get(lineIndex);
    if (!statements) {
      lines.push(text);
      return;
    }
    let changed = false;
    const parts = [];
    for (const statement of statements) {
      const result = rewrite(statement, text);
      if (result === undefined) {
        parts.push(text.slice(statement.start, statement.end).trim());
        continue;
      }
      changed = true;
      parts.push(...result);
    }
    if (!changed) {
      lines.push(text);
      return;
    }
    const indent = getIndent(text);
    if (!parts.length) {
      return;
    }
    if (statements.length === 1) {
      for (const part of parts) {
        lines.push(`${indent}${part}`);
      }
      return;
    }
    lines.push(`${indent}${parts.join("; ")}`);
  });
  return lines.join("\n");
}

export function removeFlowchartNode(code, id) {
  const model = parseFlowchart(code);
  if (!model.nodes.has(id)) {
    return code;
  }
  return removeFlowchartReferences(model, id);
}

// Drops every edge, style, class, and click statement naming `id`.
function removeFlowchartReferences(model, id) {
  return rewriteStatements(model, (statement, lineText) => {
    if (statement.kind === "chain") {
      const touches = statement.groups.some((group) =>
        group.some((ref) => ref.id === id),
      );
      return touches ? rebuildChain(model, statement, { removeId: id }) : undefined;
    }
    if (
      (statement.kind === "style" || statement.kind === "click") &&
      statement.target === id
    ) {
      return [];
    }
    if (statement.kind === "class" && statement.targets.includes(id)) {
      const targets = statement.targets.filter((target) => target !== id);
      if (!targets.length) {
        return [];
      }
      const rest = lineText
        .slice(statement.start, statement.end)
        .trim()
        .replace(/^class\s+\S+/, `class ${targets.join(",")}`);
      return [rest];
    }
    return undefined;
  });
}

export function removeFlowchartEdge(code, from, to, occurrence = 0) {
  const model = parseFlowchart(code);
  const edge = findFlowchartEdge(model, from, to, occurrence);
  if (!edge) {
    return code;
  }
  return rewriteStatements(model, (statement) =>
    statement === edge.statement
      ? rebuildChain(model, statement, {
          removeLink: { linkIndex: edge.linkIndex, from, to },
        })
      : undefined,
  );
}

// ---------------------------------------------------------------------------
// Diagram-agnostic source navigation and label edits

// Whole-token match. Ids may contain dashes (`CUSTOMER-ADDRESS`, `A-B`), so a
// dash joined to more word characters extends the token; a dash that starts
// an arrow (`A->>B`, `A-->B`) does not.
export function tokenPattern(text) {
  const escaped = String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])(?<![\\p{L}\\p{N}_]-)${escaped}(?![\\p{L}\\p{N}_])(?!-[\\p{L}\\p{N}_])`,
    "gu",
  );
}

export function isIdentifierLike(text) {
  return /^[\p{L}\p{N}_]+$/u.test(String(text ?? ""));
}

export function firstLineMatching(lines, startIndex, predicate) {
  for (let index = Math.max(0, startIndex); index < lines.length; index += 1) {
    if (predicate(lines[index], index)) {
      return index;
    }
  }
  return -1;
}

// Replaces text the user edited in place on a non-flowchart diagram. A single
// identifier is renamed everywhere so references stay consistent; other text
// is replaced at its first occurrence after the header.
export function replaceMermaidText(code, oldText, newText) {
  const from = String(oldText ?? "").trim();
  const to = String(newText ?? "").replace(/\r?\n/g, " ").trim();
  if (!from || !to || from === to) {
    return code;
  }
  const lines = splitMermaidLines(code);
  const headerIndex = Math.max(0, findMermaidHeaderLine(lines));

  const messageLine = firstLineMatching(lines, headerIndex + 1, (line) => {
    const colon = line.indexOf(":");
    return colon >= 0 && line.slice(colon + 1).trim() === from;
  });
  if (messageLine >= 0) {
    const line = lines[messageLine];
    const at = line.lastIndexOf(from);
    lines[messageLine] = line.slice(0, at) + to + line.slice(at + from.length);
    return lines.join("\n");
  }

  if (isIdentifierLike(from)) {
    const pattern = tokenPattern(from);
    let changed = false;
    const next = lines.map((line, index) => {
      if (index < headerIndex) return line;
      const replaced = line.replace(pattern, () => to);
      changed ||= replaced !== line;
      return replaced;
    });
    return changed ? next.join("\n") : code;
  }

  const lineIndex = firstLineMatching(lines, headerIndex, (line) => line.includes(from));
  if (lineIndex < 0) {
    return code;
  }
  const line = lines[lineIndex];
  const at = line.indexOf(from);
  lines[lineIndex] = line.slice(0, at) + to + line.slice(at + from.length);
  return lines.join("\n");
}

// Sequence participants show their alias when they have one. Renaming to a
// value that is not a valid identifier introduces an alias instead of breaking
// every message that refers to the participant.
export function renameSequenceParticipant(code, id, newText) {
  const to = String(newText ?? "").replace(/\r?\n/g, " ").trim();
  if (!id || !to) {
    return code;
  }
  const lines = splitMermaidLines(code);
  const headerIndex = Math.max(0, findMermaidHeaderLine(lines));
  const idPattern = tokenPattern(id).source;
  const declaration = new RegExp(
    `^(\\s*(?:participant|actor)\\s+${idPattern})(?:\\s+as\\s+(.*))?$`,
    "u",
  );
  const declarationLine = firstLineMatching(lines, headerIndex + 1, (line) =>
    declaration.test(line),
  );
  if (declarationLine >= 0) {
    const match = lines[declarationLine].match(declaration);
    if (match[2] !== undefined || !isIdentifierLike(to)) {
      lines[declarationLine] = `${match[1]} as ${to}`;
      return lines.join("\n");
    }
  }
  if (isIdentifierLike(to)) {
    return replaceMermaidText(code, id, to);
  }
  const indent = getIndent(lines[headerIndex + 1] || "") || "    ";
  lines.splice(headerIndex + 1, 0, `${indent}participant ${id} as ${to}`);
  return lines.join("\n");
}
