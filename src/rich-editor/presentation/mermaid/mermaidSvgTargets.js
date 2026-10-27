// Recognises rendered Mermaid SVG elements.
//
// Each diagram type draws its statements with its own ids, classes and data
// attributes (worked out against Mermaid 11's output). `describeMermaidElement`
// reduces a clicked element to the keys the source index understands (see
// domain/mermaidIndex.js) plus its visible text, and names the element to
// highlight. `findMermaidElements` runs the same description over every
// candidate element to find what a set of keys or labels draws.
import { normalizeLabel } from "../../domain/mermaidIndex.js";
import {
  parseFlowchartEdgeDomId,
  parseMermaidNodeDomId,
} from "../../domain/mermaidSource.js";

const TEXT_SELECTOR =
  "text, foreignObject, .nodeLabel, .edgeLabel, .messageText, .label, .cluster-label";

const CANDIDATE_SELECTOR = [
  "g.node",
  "g.cluster",
  "g.statediagram-cluster",
  "g[data-et='participant']",
  "[data-et='message']",
  "[data-et='note']",
  "[data-et='control-structure']",
  "path[data-id]",
  "rect.task",
  "text.taskText",
  "text.taskTextOutsideLeft",
  "text.taskTextOutsideRight",
  "text.sectionTitle",
  "text.titleText",
  "path.pieCircle",
  "g.legend",
  "text.pieTitleText",
  "circle.commit",
  "text.commit-label",
  "text.tag-label",
  "g.branchLabel",
  "g.data-point",
  "path[id*='-node-']",
  "g[class*='-plot-']",
  "g.architecture-service",
  "g.links > g.link",
  "rect.node-bkg",
  "text.task",
  "text",
  // HTML labels (class members, ER attributes, requirement fields).
  "g.label",
  "foreignObject",
].join(", ");

const GIT_COMMIT_CLASSES = /^(commit|commit\d+|commit-merge|commit-reverse|commit-cherry-pick|commit-highlight\d*|commit-highlight-inner|commit-bullets)$/;

export function describeMermaidElement(element, context) {
  const { stage } = context;
  if (!element || !stage.contains(element)) {
    return null;
  }
  const describe = DESCRIBERS[context.type];
  const described = describe?.(element, context);
  if (described) {
    return described;
  }
  return describeByText(element, context);
}

// Descriptions of every drawn element whose keys intersect `keys`, or whose
// own text matches one of `texts` when it carries no structural key. A label
// inside a node is described on its own (a class member, an ER attribute), so
// the matching description is returned rather than re-describing its group.
export function findMermaidTargets(context, { keys, texts }) {
  const found = [];
  const seen = new Set();
  if (!keys.size && !texts.size) {
    return found;
  }
  for (const candidate of context.stage.querySelectorAll(CANDIDATE_SELECTOR)) {
    const description = describeMermaidElement(candidate, context);
    if (!description?.element) continue;
    const identity = `${description.keys[0] ?? description.text}`;
    if (seen.has(description.element) && seen.has(identity)) continue;
    const matched = description.keys.length
      ? description.keys.some((key) => keys.has(key))
      : texts.has(normalizeLabel(description.text));
    if (matched) {
      seen.add(description.element);
      seen.add(identity);
      found.push(description);
    }
  }
  return found;
}

export function findMermaidElements(context, query) {
  return new Set(findMermaidTargets(context, query).map((description) => description.element));
}

export function collectMermaidNodeIds(context) {
  const ids = new Set();
  for (const node of context.stage.querySelectorAll("g.node")) {
    const parsed = parseMermaidNodeDomId(node.id, context.renderId);
    if (parsed) ids.add(parsed.id);
  }
  return ids;
}

// ---------------------------------------------------------------------------

function stripRenderId(id, renderId) {
  const value = String(id ?? "");
  return renderId && value.startsWith(`${renderId}-`)
    ? value.slice(renderId.length + 1)
    : value;
}

function readText(element) {
  return element ? element.textContent.replace(/\s+/g, " ").trim() : "";
}

function closestIn(element, selector, stage) {
  const found = element.closest(selector);
  return found && stage.contains(found) ? found : null;
}

function indexIn(stage, selector, element) {
  return [...stage.querySelectorAll(selector)].indexOf(element);
}

// The label the user actually clicked inside `group`, or "" when the click
// landed on the shape itself.
function clickedText(element, group) {
  const label = element.closest(TEXT_SELECTOR);
  return label && group.contains(label) ? readText(label) : "";
}

function firstLabelText(group) {
  return readText(group.querySelector("g.label, text, foreignObject"));
}

function describeByText(element, context) {
  const label = closestIn(element, TEXT_SELECTOR, context.stage);
  const text = readText(label);
  if (!text) return null;
  return {
    kind: "text",
    keys: [],
    text,
    element: label.closest("g") && context.stage.contains(label.closest("g"))
      ? label.closest("g")
      : label,
  };
}

function describeNodeGroup(element, context, toKeys) {
  const group = closestIn(
    element,
    "g.node, g.cluster, g.statediagram-cluster",
    context.stage,
  );
  if (!group) return null;
  const parsed = parseMermaidNodeDomId(group.id, context.renderId);
  const id = parsed?.id ?? group.getAttribute("data-id");
  if (!id) return null;
  return { ...toKeys(id, group), element: group };
}

const DESCRIBERS = {
  flowchart(element, context) {
    const node = describeNodeGroup(element, context, (id, group) => ({
      kind: "node",
      id,
      keys: [`node:${id}`],
      text: readText(group) || id,
    }));
    if (node) return node;
    const data = closestIn(element, "[data-id]", context.stage);
    const edge = data && parseFlowchartEdgeDomId(data.getAttribute("data-id"), context.nodeIds);
    if (edge) {
      const dataId = data.getAttribute("data-id");
      const path = findByDataId(context.stage, "path", dataId);
      return {
        kind: "edge",
        ...edge,
        dataId,
        keys: [`edge:${edge.from}>${edge.to}#${edge.occurrence}`, `edge:${edge.from}>${edge.to}`],
        text: readText(findByDataId(context.stage, "g.label", dataId)),
        element: path || data,
        extraElements: [findByDataId(context.stage, "g.label", dataId)].filter(Boolean),
      };
    }
    // Subgraph clusters carry "<renderId>-<subgraph id>".
    const cluster = closestIn(element, "g.cluster", context.stage);
    const clusterId = cluster && stripRenderId(cluster.id, context.renderId);
    if (clusterId) {
      return {
        kind: "subgraph",
        id: clusterId,
        keys: [`subgraph:${clusterId}`],
        text: readText(cluster.querySelector(".cluster-label")) || readText(cluster) || clusterId,
        element: cluster,
      };
    }
    return null;
  },

  sequence(element, context) {
    const { stage } = context;
    let statement = closestIn(
      element,
      "[data-et='message'], [data-et='note'], [data-et='control-structure']",
      stage,
    );
    if (!statement && element.matches("text.messageText")) {
      let next = element.nextElementSibling;
      while (next && !next.matches("[data-et='message']")) next = next.nextElementSibling;
      statement = next;
    }
    if (statement) {
      const index = statement.getAttribute("data-id");
      let text = readText(statement);
      if (statement.matches("[data-et='control-structure']")) {
        // "loop" badge + "[Every min]": only the bracketed title is source text.
        text = normalizeLabel(readText(statement.querySelector("text.loopText")));
      }
      if (statement.matches("[data-et='message']")) {
        let previous = statement.previousElementSibling;
        while (previous && !previous.matches("text.messageText")) {
          previous = previous.previousElementSibling;
        }
        text = readText(previous);
      }
      return {
        kind: "statement",
        keys: [`stmt:${index.replace(/^i/, "")}`],
        text,
        element: statement,
      };
    }
    const participant = closestIn(
      element,
      "[data-et='participant'], [data-et='life-line']",
      stage,
    );
    if (participant) {
      const id = participant.getAttribute("data-id");
      const group =
        [...stage.querySelectorAll("[data-et='participant']")].find(
          (candidate) => candidate.getAttribute("data-id") === id,
        ) || participant;
      return {
        kind: "node",
        id,
        keys: [`participant:${id}`],
        text: readText(group) || id,
        element: group,
      };
    }
    // Bottom actor boxes carry no ids; their label names the participant.
    if (element.matches("rect.actor, text.actor, text.actor tspan")) {
      const label = element.matches("rect")
        ? element.nextElementSibling?.matches("text") ? element.nextElementSibling : null
        : element.closest("text");
      const text = readText(label);
      if (text) {
        return {
          kind: "node",
          keys: [`participantLabel:${normalizeLabel(text)}`],
          text,
          element: element.matches("rect") ? element : label,
        };
      }
    }
    return null;
  },

  class(element, context) {
    const node = describeNodeGroup(element, context, (id, group) => {
      const name = firstLabelText(group) || id;
      const text = clickedText(element, group) || name;
      const keys = text !== name ? [`member:${id}:${normalizeLabel(text)}`] : [];
      return { kind: "node", id, keys: [...keys, `node:${id}`], text };
    });
    if (node) return node;
    const data = closestIn(element, "[data-id]", context.stage);
    const match = data?.getAttribute("data-id").match(/^id_(.+)_(\d+)$/);
    if (match) {
      const pair = splitPair(match[1], context.nodeIds, "_");
      return {
        kind: "edge",
        keys: [`rel:${match[2]}`, ...(pair ? [`edge:${pair.from}>${pair.to}`] : [])],
        text: readText(findByDataId(context.stage, "g.label", data.getAttribute("data-id"))),
        element: findByDataId(context.stage, "path", data.getAttribute("data-id")) || data,
      };
    }
    return null;
  },

  state(element, context) {
    const node = describeNodeGroup(element, context, (id, group) => {
      // Notes are "<state>----note-<n>"; the node id parser drops the "-<n>".
      const note = id.match(/^(.+)----note(?:-\d+)?$/);
      return {
        kind: "node",
        id: note ? undefined : id,
        keys: note ? [`note:${note[1]}`] : [`node:${id}`],
        text: firstLabelText(group) || (note ? "" : id),
      };
    });
    if (node) return node;
    const data = closestIn(element, "[data-id]", context.stage);
    const edge = data?.getAttribute("data-id").match(/^edge(\d+)$/);
    if (edge) {
      const dataId = data.getAttribute("data-id");
      return {
        kind: "edge",
        keys: [`stateEdge:${edge[1]}`],
        text: readText(findByDataId(context.stage, "g.label", dataId)),
        element: findByDataId(context.stage, "path", dataId) || data,
      };
    }
    return null;
  },

  er(element, context) {
    const node = describeNodeGroup(element, context, (id, group) => {
      const attribute = element.closest("g.label[class*='attribute-']");
      if (attribute && group.contains(attribute)) {
        const labels = [...group.querySelectorAll("g.label[class*='attribute-']")];
        const types = labels.filter((label) => label.matches(".attribute-type"));
        const row = types.filter(
          (type) => labels.indexOf(type) <= labels.indexOf(attribute),
        ).length - 1;
        const text = readText(attribute);
        const keys = [`attrRow:${id}:${Math.max(0, row)}`];
        if (attribute.matches(".attribute-name")) keys.unshift(`attr:${id}:${text}`);
        return { kind: "node", keys: [...keys, `node:${id}`], text };
      }
      return { kind: "node", id, keys: [`node:${id}`], text: readText(group.querySelector("g.label.name, g.label")) || id };
    });
    if (node) return node;
    const data = closestIn(element, "[data-id]", context.stage);
    const match = data?.getAttribute("data-id").match(/^id_entity-(.+)-\d+_entity-(.+)-\d+_\d+$/);
    if (match) {
      const dataId = data.getAttribute("data-id");
      return {
        kind: "edge",
        keys: [`edge:${match[1]}>${match[2]}`],
        text: readText(findByDataId(context.stage, "g.label", dataId)),
        element: findByDataId(context.stage, "path", dataId) || data,
      };
    }
    return null;
  },

  gantt(element, context) {
    const { stage, renderId } = context;
    const task = closestIn(element, "rect.task, text[id$='-text']", stage);
    if (task) {
      const raw = stripRenderId(task.id, renderId);
      const id = task.matches("rect") ? raw : raw.replace(/-text$/, "");
      const label = stage.querySelector(`[id="${cssEscape(`${renderId}-${id}-text`)}"]`);
      const rect = stage.querySelector(`rect[id="${cssEscape(`${renderId}-${id}`)}"]`);
      return { kind: "task", keys: [`task:${id}`], text: readText(label), element: rect || task };
    }
    if (element.matches("text.sectionTitle, text.sectionTitle *")) {
      const text = readText(element.closest("text"));
      return { kind: "text", keys: [`section:${normalizeLabel(text)}`], text, element: element.closest("text") };
    }
    if (element.matches("text.titleText")) {
      return { kind: "text", keys: ["title"], text: readText(element), element };
    }
    return null;
  },

  pie(element, context) {
    const { stage } = context;
    for (const [selector, target] of [
      ["path.pieCircle", (el) => el],
      ["text.slice", (el) => el],
      ["g.legend", (el) => el],
    ]) {
      const hit = closestIn(element, selector, stage);
      if (hit) {
        const index = indexIn(stage, selector, hit);
        const legend = stage.querySelectorAll("g.legend")[index];
        return { kind: "slice", keys: [`slice:${index}`], text: readText(legend), element: target(hit) };
      }
    }
    if (element.matches("text.pieTitleText")) {
      return { kind: "text", keys: ["title"], text: readText(element), element };
    }
    return null;
  },

  mindmap(element, context) {
    const group = closestIn(element, "g.node", context.stage);
    const index = group && stripRenderId(group.id, context.renderId).match(/^node_(\d+)$/)?.[1];
    if (index !== undefined && index !== null) {
      return { kind: "node", keys: [`mindmap:${index}`], text: readText(group), element: group };
    }
    const data = closestIn(element, "[data-id]", context.stage);
    const edge = data?.getAttribute("data-id").match(/^edge_\d+_(\d+)$/);
    if (edge) {
      return { kind: "edge", keys: [`mindmap:${edge[1]}`], text: "", element: data };
    }
    return null;
  },

  journey(element, context) {
    const { stage, renderId } = context;
    for (const selector of ["rect.task", "text.task"]) {
      const hit = closestIn(element, selector, stage);
      if (hit) {
        const index = indexIn(stage, selector, hit);
        return {
          kind: "task",
          keys: [`journeyTask:${index}`],
          text: readText(stage.querySelectorAll("text.task")[index]),
          element: stage.querySelectorAll("rect.task")[index] || hit,
        };
      }
    }
    const line = closestIn(element, "line.task-line", stage);
    const index = line && stripRenderId(line.id, renderId).match(/^task(\d+)$/)?.[1];
    if (index !== undefined && index !== null) {
      return { kind: "task", keys: [`journeyTask:${index}`], text: "", element: line };
    }
    return null;
  },

  timeline(element, context) {
    const { stage, renderId } = context;
    const shape = closestIn(element, "path[id*='-node-']", stage);
    const index = shape && stripRenderId(shape.id, renderId).match(/^node-(\d+)$/)?.[1];
    if (index !== undefined && index !== null) {
      return { kind: "node", keys: [`timeline:${index}`], text: "", element: shape.closest("g") || shape };
    }
    return null;
  },

  git(element, context) {
    const { stage } = context;
    const commit = closestIn(element, "circle.commit, rect.commit, text.commit-label", stage);
    if (commit) {
      const id = commit.matches("text")
        ? readText(commit)
        : [...commit.classList].find((name) => !GIT_COMMIT_CLASSES.test(name));
      if (id) {
        const sequence = id.match(/^(\d+)-[0-9a-f]+$/);
        return {
          kind: "commit",
          keys: [sequence ? `commitSeq:${sequence[1]}` : `commit:${id}`],
          text: sequence ? "" : id,
          element: commit,
        };
      }
    }
    const tag = closestIn(element, "text.tag-label", stage);
    if (tag) {
      return { kind: "text", keys: [`tag:${readText(tag)}`], text: readText(tag), element: tag };
    }
    const branch = closestIn(element, "g.branchLabel", stage);
    if (branch) {
      return { kind: "text", keys: [`branch:${readText(branch)}`], text: readText(branch), element: branch };
    }
    return null;
  },

  other(element, context) {
    const { stage, renderId } = context;
    const sankey = describeSankey(element, stage);
    if (sankey) return sankey;
    const plot = closestIn(element, "g[class*='-plot-']", stage);
    const plotIndex = plot?.getAttribute("class").match(/(?:bar|line)-plot-(\d+)/)?.[1];
    if (plotIndex !== undefined && plotIndex !== null) {
      return { kind: "plot", keys: [`plot:${plotIndex}`], text: "", element: plot };
    }
    const owner = closestIn(
      element,
      "g.node, g.cluster, g.architecture-service, rect.node-bkg",
      stage,
    );
    if (owner?.id && renderId && owner.id.startsWith(`${renderId}-`)) {
      const id = stripRenderId(owner.id, renderId).replace(/^(service|group|junction)-/, "");
      // Architecture groups are a bare rect; their title is not inside it.
      const text = owner.matches("rect")
        ? ""
        : clickedText(element, owner) || firstLabelText(owner);
      const keys = [`node:${id}`];
      const field = text.match(/^([\w ]+):\s/);
      if (field) keys.unshift(`field:${id}:${field[1].toLowerCase()}`);
      return { kind: "node", keys, text, element: owner };
    }
    return null;
  },
};

DESCRIBERS.quadrant = (element, context) => {
  const point = closestIn(element, "g.data-point", context.stage);
  return point ? { kind: "text", keys: [], text: readText(point), element: point } : null;
};

// sankey-beta draws nodes (g.nodes > g.node) and their labels
// (g.node-labels > text) in the same order, and one g.link per CSV row.
function describeSankey(element, stage) {
  // Other "other" diagrams (requirement, block...) also use g.nodes > g.node.
  if (!stage.querySelector("g.node-labels")) return null;
  const link = closestIn(element, "g.links > g.link", stage);
  if (link) {
    return { kind: "link", keys: [`sankeyLink:${indexIn(stage, "g.links > g.link", link)}`], text: "", element: link };
  }
  const node = closestIn(element, "g.nodes > g.node", stage);
  const label = closestIn(element, "g.node-labels > text", stage);
  if (!node && !label) return null;
  const index = node
    ? indexIn(stage, "g.nodes > g.node", node)
    : indexIn(stage, "g.node-labels > text", label);
  const text = stage.querySelectorAll("g.node-labels > text")[index]?.textContent.split("\n")[0].trim() ?? "";
  return {
    kind: "node",
    keys: [`sankeyNode:${index}`],
    text,
    element: stage.querySelectorAll("g.nodes > g.node")[index] || node || label,
  };
}

function findByDataId(stage, selector, dataId) {
  return (
    [...stage.querySelectorAll(`${selector}[data-id]`)].find(
      (element) => element.getAttribute("data-id") === dataId,
    ) || null
  );
}

function splitPair(body, ids, separator) {
  for (let index = 1; index < body.length - 1; index += 1) {
    if (body[index] !== separator) continue;
    const from = body.slice(0, index);
    const to = body.slice(index + 1);
    if (ids.has(from) && ids.has(to)) return { from, to };
  }
  return null;
}

// Escapes a value for use inside a double-quoted attribute selector.
function cssEscape(value) {
  return String(value).replace(/["\\]/g, "\\$&");
}
