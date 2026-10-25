// Table views of data-style Mermaid diagrams.
//
// Pie charts, gantt charts, journeys, timelines, sankey diagrams, and
// quadrant charts are lists of one-line records, optionally grouped by
// `section` lines. A table spec says how to read a record line into cells and
// how to write cells back; the generic functions below then read, edit,
// insert, remove, and reorder records without touching any other line.
import {
  detectMermaidDiagramType,
  findMermaidHeaderLine,
  getIndent,
  splitMermaidLines,
} from "./mermaidSource.js";
import { GANTT_SETTINGS, GANTT_TAGS } from "./mermaidIndex.js";

const SECTION = /^(\s*)section\s+(.*)$/;

function sectionGroup(text) {
  const match = text.match(SECTION);
  return match ? { kind: "group", cells: [match[2].trim()] } : null;
}

function formatSection(row, indent) {
  return `${indent}section ${clean(row.cells[0]) || "Section"}`;
}

function clean(value) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

// Text that ends at a ":" in the source cannot contain one.
function field(value) {
  return clean(value).replace(/:/g, " -");
}

const GANTT_STATUSES = ["", "active", "done", "crit", "milestone", "crit, active", "crit, done"];

const SPECS = {
  pie: {
    title: "Slices",
    columns: [
      { key: "label", label: "Label" },
      { key: "value", label: "Value", type: "number" },
    ],
    parse(text) {
      const match = text.match(/^\s*"([^"]*)"\s*:\s*(.*)$/);
      return match ? { kind: "row", cells: [match[1], match[2].trim()] } : null;
    },
    format(row, indent) {
      return `${indent}"${clean(row.cells[0]).replace(/"/g, "'")}" : ${clean(row.cells[1]) || "0"}`;
    },
    newRow: () => ["New slice", "10"],
  },

  gantt: {
    title: "Tasks",
    groups: true,
    columns: [
      { key: "name", label: "Task" },
      { key: "status", label: "Status", type: "select", options: GANTT_STATUSES },
      { key: "id", label: "Id" },
      { key: "start", label: "Start / after" },
      { key: "end", label: "Duration / end" },
    ],
    parse(text, context) {
      const group = sectionGroup(text);
      if (group) return group;
      const trimmed = text.trim();
      const colon = text.indexOf(":");
      if (colon <= 0 || GANTT_SETTINGS.test(trimmed) || /^(title|section)\b/.test(trimmed)) {
        return null;
      }
      if (context.lineIndex === context.headerIndex) return null;
      const parts = text
        .slice(colon + 1)
        .split(",")
        .map((part) => part.trim());
      const tags = [];
      while (parts.length && GANTT_TAGS.has(parts[0])) tags.push(parts.shift());
      // Mermaid reads 1 part as the duration, 2 as start + end, 3 as id too.
      let id = "";
      let start = "";
      let end = parts[0] ?? "";
      if (parts.length >= 3) {
        [id, start] = parts;
        end = parts.slice(2).join(", ");
      } else if (parts.length === 2) {
        [start, end] = parts;
      }
      return { kind: "row", cells: [text.slice(0, colon).trim(), tags.join(", "), id, start, end] };
    },
    format(row, indent) {
      const [name, status, id, start, end] = row.cells.map(clean);
      const parts = status ? status.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
      // An id is only recognised when a start is given as well.
      if (id && start) parts.push(id);
      if (start) parts.push(start);
      parts.push(end || "1d");
      return `${indent}${field(name) || "Task"} :${parts.join(", ")}`;
    },
    formatGroup: formatSection,
    newRow: () => ["New task", "", "", "", "1d"],
    newGroup: () => ["New section"],
  },

  journey: {
    title: "Tasks",
    groups: true,
    columns: [
      { key: "task", label: "Task" },
      { key: "score", label: "Score (1-5)", type: "number" },
      { key: "actors", label: "Actors" },
    ],
    parse(text) {
      const group = sectionGroup(text);
      if (group) return group;
      if (/^\s*title\b/.test(text)) return null;
      const parts = text.split(":");
      if (parts.length < 2) return null;
      return {
        kind: "row",
        cells: [parts[0].trim(), (parts[1] ?? "").trim(), parts.slice(2).join(":").trim()],
      };
    },
    format(row, indent) {
      const [task, score, actors] = row.cells.map(clean);
      const base = `${indent}${field(task) || "Task"}: ${field(score) || "3"}`;
      return actors ? `${base}: ${field(actors)}` : base;
    },
    formatGroup: formatSection,
    newRow: () => ["New task", "3", ""],
    newGroup: () => ["New section"],
  },

  timeline: {
    title: "Events",
    groups: true,
    columns: [
      { key: "period", label: "Period" },
      { key: "events", label: "Events (separate with :)" },
    ],
    parse(text) {
      const group = sectionGroup(text);
      if (group) return group;
      if (/^\s*title\b/.test(text)) return null;
      const colon = text.indexOf(":");
      if (colon < 0) {
        return text.trim() ? { kind: "row", cells: [text.trim(), ""] } : null;
      }
      return {
        kind: "row",
        cells: [
          text.slice(0, colon).trim(),
          text
            .slice(colon + 1)
            .split(":")
            .map((part) => part.trim())
            .filter(Boolean)
            .join(" : "),
        ],
      };
    },
    format(row, indent) {
      const period = field(row.cells[0]);
      const events = clean(row.cells[1])
        .split(":")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" : ");
      if (!events) return `${indent}${period || "Period"}`;
      return period ? `${indent}${period} : ${events}` : `${indent}: ${events}`;
    },
    formatGroup: formatSection,
    newRow: () => ["New period", "Event"],
    newGroup: () => ["New section"],
  },

  sankey: {
    title: "Flows",
    columns: [
      { key: "source", label: "Source" },
      { key: "target", label: "Target" },
      { key: "value", label: "Value", type: "number" },
    ],
    parse(text) {
      const fields = [];
      const pattern = /\s*("([^"]*)"|[^,]*)\s*(,|$)/gy;
      let match;
      while (pattern.lastIndex < text.length && (match = pattern.exec(text))) {
        fields.push(match[2] ?? match[1].trim());
        if (!match[3]) break;
      }
      return fields.length >= 3 ? { kind: "row", cells: fields.slice(0, 3) } : null;
    },
    format(row, indent) {
      const csv = (value) => {
        const text = clean(value).replace(/"/g, "'");
        return text.includes(",") ? `"${text}"` : text;
      };
      return `${indent}${csv(row.cells[0]) || "Source"},${csv(row.cells[1]) || "Target"},${clean(row.cells[2]) || "1"}`;
    },
    newRow: () => ["Source", "Target", "10"],
  },

  quadrant: {
    title: "Points",
    columns: [
      { key: "name", label: "Point" },
      { key: "x", label: "x (0-1)", type: "number" },
      { key: "y", label: "y (0-1)", type: "number" },
    ],
    parse(text) {
      const match = text.match(/^\s*([^:]+?)\s*:\s*\[\s*([^,\]]*)\s*,\s*([^\]]*)\s*\](.*)$/);
      return match
        ? { kind: "row", cells: [match[1], match[2].trim(), match[3].trim()], extra: match[4] }
        : null;
    },
    format(row, indent) {
      const [name, x, y] = row.cells.map(clean);
      return `${indent}${field(name) || "Point"}: [${x || "0.5"}, ${y || "0.5"}]${row.extra ?? ""}`;
    },
    newRow: () => ["New point", "0.5", "0.5"],
  },
};

export function getMermaidTableSpec(code, type = detectMermaidDiagramType(code)) {
  if (type === "other") {
    const lines = splitMermaidLines(code);
    const header = lines[findMermaidHeaderLine(lines)]?.trim() ?? "";
    return /^sankey/.test(header) ? SPECS.sankey : null;
  }
  return SPECS[type] ?? null;
}

export function readMermaidTable(code, spec) {
  const lines = splitMermaidLines(code);
  const headerIndex = findMermaidHeaderLine(lines);
  const rows = [];
  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const text = lines[lineIndex];
    if (!text.trim() || text.trim().startsWith("%%")) continue;
    const row = spec.parse(text, { lineIndex, headerIndex });
    if (row) rows.push({ ...row, lineIndex, indent: getIndent(text) });
  }
  return rows;
}

function rowIndent(rows, kind, lines, headerIndex) {
  const sample = rows.find((row) => row.kind === kind) || rows[0];
  if (sample) return sample.indent;
  const body = lines.slice(headerIndex + 1).find((line) => line.trim());
  return body ? getIndent(body) : "    ";
}

function formatRow(spec, row, indent) {
  return row.kind === "group" ? spec.formatGroup(row, indent) : spec.format(row, indent);
}

export function updateMermaidTableRow(code, spec, lineIndex, cells) {
  const lines = splitMermaidLines(code);
  const headerIndex = findMermaidHeaderLine(lines);
  const current = spec.parse(lines[lineIndex] ?? "", { lineIndex, headerIndex });
  if (!current) return code;
  lines[lineIndex] = formatRow(spec, { ...current, cells }, getIndent(lines[lineIndex]));
  return lines.join("\n");
}

// Inserts a record (or a section) after `afterLine`, or at the end of the
// table. Returns the new line's index.
export function insertMermaidTableRow(code, spec, { afterLine = null, kind = "row" } = {}) {
  const lines = splitMermaidLines(code);
  const headerIndex = findMermaidHeaderLine(lines);
  const rows = readMermaidTable(code, spec);
  if (kind === "group" && !spec.groups) return { code, lineIndex: -1 };
  const row = { kind, cells: kind === "group" ? spec.newGroup() : spec.newRow() };
  let at;
  if (afterLine !== null && afterLine >= 0) {
    at = afterLine + 1;
  } else {
    at = rows.length ? rows[rows.length - 1].lineIndex + 1 : headerIndex + 1;
    while (at > headerIndex + 1 && !lines[at - 1].trim()) at -= 1;
  }
  lines.splice(at, 0, formatRow(spec, row, rowIndent(rows, kind, lines, headerIndex)));
  return { code: lines.join("\n"), lineIndex: at };
}

export function removeMermaidTableRow(code, lineIndex) {
  const lines = splitMermaidLines(code);
  lines.splice(lineIndex, 1);
  return lines.join("\n");
}

// Swaps a record with the previous or next record line.
export function moveMermaidTableRow(code, spec, lineIndex, delta) {
  const rows = readMermaidTable(code, spec);
  const position = rows.findIndex((row) => row.lineIndex === lineIndex);
  const other = rows[position + delta];
  if (position < 0 || !other) return { code, lineIndex };
  const lines = splitMermaidLines(code);
  [lines[lineIndex], lines[other.lineIndex]] = [lines[other.lineIndex], lines[lineIndex]];
  return { code: lines.join("\n"), lineIndex: other.lineIndex };
}
