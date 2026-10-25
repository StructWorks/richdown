// Diagram-specific tools for the Mermaid editor surface.
//
// Each toolkit adds controls for one diagram type and tells the surface how
// that type connects (drag from one element to another), and how a selected
// element is deleted. Toolkits only compute new source text; the surface
// applies it, re-renders, and selects what was created so it can be renamed.
import {
  addClass,
  addClassMember,
  addErAttribute,
  addErEntity,
  addMindmapChild,
  addMindmapSibling,
  addSequenceMessage,
  addSequenceNote,
  addSequenceParticipant,
  addState,
  addStateNote,
  canMoveSequenceParticipants,
  CLASS_RELATIONS,
  classifySequenceLine,
  connectClasses,
  connectErEntities,
  connectStates,
  ER_CARDINALITIES,
  getClassRelation,
  getErRelation,
  getMindmapNodes,
  getSequenceParticipants,
  getStateDirection,
  hasSequenceAutonumber,
  MINDMAP_NODE_SHAPES,
  moveMindmapNode,
  moveSequenceParticipant,
  parseSequenceMessage,
  removeClass,
  removeClassLine,
  removeErEntity,
  removeErLine,
  removeMindmapNode,
  removeSequenceLine,
  removeSequenceParticipant,
  removeState,
  removeStateLine,
  reverseSequenceMessage,
  SEQUENCE_ARROWS,
  SEQUENCE_BLOCKS,
  setClassRelationArrow,
  setErRelation,
  setMindmapShape,
  setSequenceMessageArrow,
  setStateDirection,
  STATE_DIRECTIONS,
  toggleSequenceAutonumber,
  wrapSequenceStatement,
} from "../../domain/mermaidEdits.js";
import {
  addFlowchartEdge,
  addFlowchartNode,
  FLOWCHART_COLORS,
  FLOWCHART_DIRECTIONS,
  FLOWCHART_SHAPES,
  getFlowchartDirection,
  getFlowchartNode,
  getFlowchartNodeColor,
  removeFlowchartEdge,
  removeFlowchartNode,
  setFlowchartDirection,
  setFlowchartNodeColor,
  setFlowchartNodeShape,
} from "../../domain/mermaidSource.js";
import {
  getMermaidTableSpec,
  readMermaidTable,
  removeMermaidTableRow,
  insertMermaidTableRow,
} from "../../domain/mermaidTables.js";

const DIRECTION_LABELS = {
  TD: "Top → down",
  TB: "Top → down",
  LR: "Left → right",
  BT: "Bottom → up",
  RL: "Right → left",
};

// Value after `prefix` in the first matching key of a target.
export function targetKey(target, prefix) {
  const key = target?.keys?.find((candidate) => candidate.startsWith(prefix));
  return key ? key.slice(prefix.length) : null;
}

export function createMermaidToolkit(type, api) {
  const factory = TOOLKITS[type] || (getMermaidTableSpec(api.getCode(), type) ? tableToolkit : null);
  return factory ? factory(api) : null;
}

function group(...children) {
  const element = document.createElement("div");
  element.className = "cm-mermaid-surface-tools";
  element.append(...children.filter(Boolean));
  return element;
}

function setOptions(select, options, placeholder = null) {
  select.replaceChildren();
  if (placeholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.appendChild(option);
  }
  for (const [value, label] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
}

// ---------------------------------------------------------------------------

function flowchartToolkit(api) {
  const selectedNode = () => {
    const target = api.getSelection();
    return target?.kind === "node" && target.id ? getFlowchartNode(api.getCode(), target.id) : null;
  };
  const editNode = (edit) => {
    const node = selectedNode();
    if (node) api.apply(edit(api.getCode(), node.id));
  };

  const addButton = api.createButton("+ Node", "Add a node (connected to the selected node)", () => {
    const from = selectedNode()?.id ?? null;
    const result = addFlowchartNode(api.getCode(), { label: "New node", from });
    if (result.id) api.apply(result.code, { select: { keys: [`node:${result.id}`] }, rename: true });
  });
  const shape = api.createSelect(
    "Node shape",
    FLOWCHART_SHAPES.map((entry) => [entry.key, entry.label]),
    (value) => editNode((code, id) => setFlowchartNodeShape(code, id, value)),
  );
  const colors = document.createElement("div");
  colors.className = "cm-mermaid-surface-colors";
  const swatches = FLOWCHART_COLORS.map((color) => {
    const button = api.createButton("", `Color: ${color.label}`, () =>
      editNode((code, id) => setFlowchartNodeColor(code, id, color.key)),
    );
    button.classList.add("cm-mermaid-surface-swatch");
    button.dataset.color = color.key;
    button.style.setProperty("--swatch-fill", color.fill);
    button.style.setProperty("--swatch-stroke", color.stroke);
    colors.appendChild(button);
    return button;
  });
  const clearColor = api.createButton("×", "Remove color", () =>
    editNode((code, id) => setFlowchartNodeColor(code, id, null)),
  );
  clearColor.classList.add("cm-mermaid-surface-swatch", "is-clear");
  colors.appendChild(clearColor);
  const direction = api.createSelect(
    "Diagram direction",
    FLOWCHART_DIRECTIONS.map((value) => [value, DIRECTION_LABELS[value]]),
    (value) => api.apply(setFlowchartDirection(api.getCode(), value)),
  );

  return {
    element: group(addButton, shape, colors, direction),
    connectHint: "Drag from one node to another, or click two nodes, to connect them.",
    sync() {
      const node = selectedNode();
      shape.disabled = !node || node.shape === "attrs";
      shape.value = node?.shape && node.shape !== "attrs" ? node.shape : "rect";
      const color = node ? getFlowchartNodeColor(api.getCode(), node.id) : null;
      for (const swatch of swatches) {
        swatch.disabled = !node;
        swatch.setAttribute("aria-pressed", String(swatch.dataset.color === color));
      }
      clearColor.disabled = !node || !color;
      const current = getFlowchartDirection(api.getCode());
      direction.value = current === "TB" ? "TD" : current || "TD";
    },
    canConnect: (target) => target?.kind === "node" && Boolean(target.id),
    connect(from, to) {
      api.apply(addFlowchartEdge(api.getCode(), from.id, to.id));
    },
    canRemove: (target) =>
      (target?.kind === "node" && Boolean(target.id)) || (target?.kind === "edge" && Boolean(target.from)),
    remove(target) {
      if (target.kind === "node") return removeFlowchartNode(api.getCode(), target.id);
      return removeFlowchartEdge(api.getCode(), target.from, target.to, target.occurrence);
    },
  };
}

// ---------------------------------------------------------------------------

function sequenceToolkit(api) {
  const participantOf = (target) => {
    const id = targetKey(target, "participant:");
    if (id) return id;
    if (targetKey(target, "participantLabel:")) return api.entryOf(target)?.id ?? null;
    return null;
  };
  const statementLine = () => {
    const target = api.getSelection();
    return targetKey(target, "stmt:") !== null ? api.selectionLine() : null;
  };
  const selectedMessage = () => {
    const line = statementLine();
    return line === null ? null : parseSequenceMessage(api.lines()[line]);
  };

  const addParticipant = api.createButton("+ Participant", "Add a participant", () => {
    const result = addSequenceParticipant(api.getCode(), "Participant");
    api.apply(result.code, { select: { keys: [`participant:${result.id}`] }, rename: true });
  });
  const addMessage = api.createButton("+ Message", "Add a message after the selected statement", () => {
    const participants = getSequenceParticipants(api.getCode()).map((participant) => participant.id);
    const selected = participantOf(api.getSelection());
    const message = selectedMessage();
    const from = selected ?? message?.from ?? participants[0] ?? "A";
    const to =
      message && !selected
        ? message.to
        : participants[participants.indexOf(from) + 1] ?? participants.find((id) => id !== from) ?? "B";
    const result = addSequenceMessage(api.getCode(), { from, to, afterLine: statementLine() });
    api.apply(result.code, { select: { line: result.lineIndex }, rename: true });
  });
  const arrow = api.createSelect(
    "Message arrow",
    SEQUENCE_ARROWS.map((entry) => [entry.key, entry.label]),
    (value) => {
      const line = statementLine();
      if (line !== null) api.apply(setSequenceMessageArrow(api.getCode(), line, value));
    },
  );
  const reverse = api.createButton("⇄", "Reverse the selected message", () => {
    const line = statementLine();
    if (line !== null) api.apply(reverseSequenceMessage(api.getCode(), line));
  });
  const addNote = api.createButton("+ Note", "Add a note to the selected participant or message", () => {
    const participant = participantOf(api.getSelection());
    const message = selectedMessage();
    const ids = participant ? [participant] : message ? [message.from, message.to] : [];
    const result = addSequenceNote(api.getCode(), ids, { afterLine: statementLine() });
    if (result.lineIndex >= 0) api.apply(result.code, { select: { line: result.lineIndex }, rename: true });
  });
  const wrap = api.createSelect("Wrap the selected statement", [], (value) => {
    const line = statementLine();
    wrap.value = "";
    if (line === null || !value) return;
    const result = wrapSequenceStatement(api.getCode(), line, value);
    api.apply(result.code, { select: { line: result.lineIndex }, rename: true });
  });
  setOptions(wrap, SEQUENCE_BLOCKS.map((block) => [block.key, block.label]), "Wrap in…");
  const moveLeft = api.createButton("◀", "Move the selected participant left", () => move(-1));
  const moveRight = api.createButton("▶", "Move the selected participant right", () => move(1));
  const autonumber = api.createButton("#", "Number the messages", () =>
    api.apply(toggleSequenceAutonumber(api.getCode())),
  );

  function move(delta) {
    const id = participantOf(api.getSelection());
    if (id) api.apply(moveSequenceParticipant(api.getCode(), id, delta), { select: { keys: [`participant:${id}`] } });
  }

  return {
    element: group(addParticipant, addMessage, arrow, reverse, addNote, wrap, moveLeft, moveRight, autonumber),
    connectHint: "Drag from one participant to another to add a message.",
    sync() {
      const message = selectedMessage();
      const participant = participantOf(api.getSelection());
      arrow.disabled = !message;
      arrow.value = message?.arrow ?? "->>";
      reverse.disabled = !message;
      addNote.disabled = !message && !participant;
      wrap.disabled = statementLine() === null;
      moveLeft.disabled = moveRight.disabled =
        !participant || !canMoveSequenceParticipants(api.getCode());
      autonumber.setAttribute("aria-pressed", String(hasSequenceAutonumber(api.getCode())));
      autonumber.classList.toggle("is-active", hasSequenceAutonumber(api.getCode()));
    },
    canConnect: (target) => Boolean(participantOf(target)),
    connect(from, to) {
      const result = addSequenceMessage(api.getCode(), {
        from: participantOf(from),
        to: participantOf(to),
        afterLine: statementLine(),
      });
      api.apply(result.code, { select: { line: result.lineIndex }, rename: true });
    },
    canRemove: (target) => Boolean(participantOf(target)) || targetKey(target, "stmt:") !== null,
    remove(target) {
      const participant = participantOf(target);
      if (participant) return removeSequenceParticipant(api.getCode(), participant);
      const line = api.selectionLine();
      if (line === null) return api.getCode();
      return classifySequenceLine(api.lines()[line]) ? removeSequenceLine(api.getCode(), line) : api.getCode();
    },
  };
}

// ---------------------------------------------------------------------------

function stateRef(target) {
  const id = targetKey(target, "node:");
  if (!id) return null;
  return /_(start|end)$/.test(id) ? "[*]" : id;
}

function stateToolkit(api) {
  const selectedState = () => {
    const ref = stateRef(api.getSelection());
    return ref && ref !== "[*]" ? ref : null;
  };
  const addButton = api.createButton("+ State", "Add a state (after the selected state)", () => {
    const result = addState(api.getCode(), { from: selectedState() });
    api.apply(result.code, { select: { keys: [`node:${result.id}`] }, rename: true });
  });
  const addNote = api.createButton("+ Note", "Add a note to the selected state", () => {
    const id = selectedState();
    if (!id) return;
    const result = addStateNote(api.getCode(), id);
    api.apply(result.code, { select: { keys: [`note:${id}`] }, rename: true });
  });
  const start = api.createButton("▶ Start", "Make the selected state a start state", () => {
    const id = selectedState();
    if (id) api.apply(connectStates(api.getCode(), "[*]", id).code);
  });
  const end = api.createButton("End ■", "Make the selected state an end state", () => {
    const id = selectedState();
    if (id) api.apply(connectStates(api.getCode(), id, "[*]").code);
  });
  const direction = api.createSelect(
    "Diagram direction",
    STATE_DIRECTIONS.map((value) => [value, DIRECTION_LABELS[value]]),
    (value) => api.apply(setStateDirection(api.getCode(), value)),
  );
  return {
    element: group(addButton, addNote, start, end, direction),
    connectHint: "Drag from one state to another to add a transition.",
    sync() {
      const id = selectedState();
      addNote.disabled = start.disabled = end.disabled = !id;
      direction.value = getStateDirection(api.getCode());
    },
    canConnect: (target) => Boolean(stateRef(target)),
    connect(from, to) {
      const result = connectStates(api.getCode(), stateRef(from), stateRef(to));
      if (result.lineIndex >= 0) api.apply(result.code, { select: { line: result.lineIndex } });
    },
    canRemove: (target) =>
      Boolean(selectedStateOf(target)) ||
      targetKey(target, "stateEdge:") !== null ||
      targetKey(target, "note:") !== null,
    remove(target) {
      const id = selectedStateOf(target);
      if (id) return removeState(api.getCode(), id);
      const line = api.selectionLine();
      return line === null ? api.getCode() : removeStateLine(api.getCode(), line);
    },
  };
}

function selectedStateOf(target) {
  const ref = stateRef(target);
  return ref && ref !== "[*]" ? ref : null;
}

// ---------------------------------------------------------------------------

function classToolkit(api) {
  const selectedClass = () => targetKey(api.getSelection(), "node:");
  const relationLine = () =>
    targetKey(api.getSelection(), "rel:") !== null ? api.selectionLine() : null;

  const addButton = api.createButton("+ Class", "Add a class", () => {
    const result = addClass(api.getCode());
    api.apply(result.code, { select: { keys: [`node:${result.id}`] }, rename: true });
  });
  const addMember = api.createButton("+ Member", "Add a member to the selected class", () => {
    const id = selectedClass();
    if (!id) return;
    const result = addClassMember(api.getCode(), id, "+field");
    api.apply(result.code, { select: { keys: [`member:${id}:+field`, `node:${id}`] }, rename: true });
  });
  const relation = api.createSelect(
    "Relation type",
    CLASS_RELATIONS.map((entry) => [entry.key, entry.label]),
    (value) => {
      const line = relationLine();
      if (line !== null) api.apply(setClassRelationArrow(api.getCode(), line, value));
    },
  );
  return {
    element: group(addButton, addMember, relation),
    connectHint: "Drag from one class to another to add a relation.",
    sync() {
      addMember.disabled = !selectedClass();
      const line = relationLine();
      const current = line === null ? null : getClassRelation(api.getCode(), line);
      relation.disabled = !current;
      relation.value = current?.arrow ?? "-->";
    },
    canConnect: (target) => Boolean(targetKey(target, "node:")),
    connect(from, to) {
      const result = connectClasses(api.getCode(), targetKey(from, "node:"), targetKey(to, "node:"));
      api.apply(result.code, { select: { line: result.lineIndex } });
    },
    canRemove: (target) => Boolean(target?.keys?.length),
    remove(target) {
      const member = target.keys.find((key) => key.startsWith("member:"));
      const id = targetKey(target, "node:");
      if (id && !member) return removeClass(api.getCode(), id);
      const line = api.selectionLine();
      return line === null ? api.getCode() : removeClassLine(api.getCode(), line);
    },
  };
}

// ---------------------------------------------------------------------------

function erToolkit(api) {
  const selectedEntity = () => targetKey(api.getSelection(), "node:");
  const relationLine = () =>
    targetKey(api.getSelection(), "edge:") !== null ? api.selectionLine() : null;
  const cardinalities = ER_CARDINALITIES.map((entry) => [entry.key, entry.label]);

  const addButton = api.createButton("+ Entity", "Add an entity", () => {
    const result = addErEntity(api.getCode());
    api.apply(result.code, { select: { keys: [`node:${result.id}`] }, rename: true });
  });
  const addAttribute = api.createButton("+ Attribute", "Add an attribute to the selected entity", () => {
    const id = selectedEntity();
    if (!id) return;
    const result = addErAttribute(api.getCode(), id, "string name");
    api.apply(result.code, { select: { line: result.lineIndex } });
  });
  const left = api.createSelect("Cardinality at the first entity", cardinalities, (value) => setRelation({ left: value }));
  const right = api.createSelect("Cardinality at the second entity", cardinalities, (value) => setRelation({ right: value }));
  const identifying = api.createButton("Identifying", "Toggle identifying (solid) / non-identifying (dashed)", () => {
    const line = relationLine();
    const current = line === null ? null : getErRelation(api.getCode(), line);
    if (current) setRelation({ identifying: !current.identifying });
  });

  function setRelation(change) {
    const line = relationLine();
    if (line !== null) api.apply(setErRelation(api.getCode(), line, change));
  }

  return {
    element: group(addButton, addAttribute, left, right, identifying),
    connectHint: "Drag from one entity to another to add a relationship.",
    sync() {
      addAttribute.disabled = !selectedEntity();
      const line = relationLine();
      const current = line === null ? null : getErRelation(api.getCode(), line);
      left.disabled = right.disabled = identifying.disabled = !current;
      left.value = current?.left ?? "one";
      right.value = current?.right ?? "one";
      identifying.setAttribute("aria-pressed", String(Boolean(current?.identifying)));
      identifying.classList.toggle("is-active", Boolean(current?.identifying));
    },
    canConnect: (target) => Boolean(targetKey(target, "node:")) && !target.keys.some((key) => key.startsWith("attr")),
    connect(from, to) {
      const result = connectErEntities(api.getCode(), targetKey(from, "node:"), targetKey(to, "node:"));
      api.apply(result.code, { select: { line: result.lineIndex }, rename: true });
    },
    canRemove: (target) => Boolean(target?.keys?.length),
    remove(target) {
      const attribute = target.keys.some((key) => key.startsWith("attr"));
      const id = targetKey(target, "node:");
      if (id && !attribute) return removeErEntity(api.getCode(), id);
      const line = api.selectionLine();
      return line === null ? api.getCode() : removeErLine(api.getCode(), line);
    },
  };
}

// ---------------------------------------------------------------------------

function mindmapToolkit(api) {
  const selectedIndex = () => {
    const value = targetKey(api.getSelection(), "mindmap:");
    return value === null ? null : Number(value);
  };
  const addChild = api.createButton("+ Child", "Add a child to the selected idea", () => {
    const result = addMindmapChild(api.getCode(), selectedIndex() ?? 0);
    api.apply(result.code, { select: { keys: [`mindmap:${result.index}`] }, rename: true });
  });
  const addSibling = api.createButton("+ Sibling", "Add an idea next to the selected one", () => {
    const index = selectedIndex();
    if (index === null) return;
    const result = addMindmapSibling(api.getCode(), index);
    api.apply(result.code, { select: { keys: [`mindmap:${result.index}`] }, rename: true });
  });
  const moveUp = api.createButton("↑", "Move the selected idea up", () => move(-1));
  const moveDown = api.createButton("↓", "Move the selected idea down", () => move(1));
  const shape = api.createSelect(
    "Idea shape",
    MINDMAP_NODE_SHAPES.map((entry) => [entry.key, entry.label]),
    (value) => {
      const index = selectedIndex();
      if (index !== null) api.apply(setMindmapShape(api.getCode(), index, value));
    },
  );
  function move(delta) {
    const index = selectedIndex();
    if (index === null) return;
    const result = moveMindmapNode(api.getCode(), index, delta);
    api.apply(result.code, { select: { keys: [`mindmap:${result.index}`] } });
  }
  return {
    element: group(addChild, addSibling, moveUp, moveDown, shape),
    sync() {
      const index = selectedIndex();
      const node = index === null ? null : getMindmapNodes(api.getCode())[index];
      addSibling.disabled = moveUp.disabled = moveDown.disabled = !node || index === 0;
      shape.disabled = !node;
      shape.value = node?.shape ?? "default";
    },
    canRemove: (target) => {
      const index = targetKey(target, "mindmap:");
      return index !== null && Number(index) > 0;
    },
    remove: (target) => removeMindmapNode(api.getCode(), Number(targetKey(target, "mindmap:"))),
  };
}

// ---------------------------------------------------------------------------

// Data-style diagrams (pie, gantt, journey, timeline, sankey, quadrant): the
// table panel does the editing; the toolbar adds a record next to the
// selection, and Delete removes the selected record's line.
function tableToolkit(api) {
  const spec = () => getMermaidTableSpec(api.getCode());
  const recordLine = () => {
    const line = api.selectionLine();
    if (line === null || !spec()) return null;
    return readMermaidTable(api.getCode(), spec()).some((row) => row.lineIndex === line) ? line : null;
  };
  const addRow = api.createButton("+ Row", "Add a record after the selected one", () => {
    const result = insertMermaidTableRow(api.getCode(), spec(), { afterLine: recordLine() });
    if (result.lineIndex >= 0) api.apply(result.code, { select: { line: result.lineIndex }, rename: true });
  });
  return {
    element: group(addRow),
    sync() {},
    canRemove: () => recordLine() !== null,
    remove() {
      const line = recordLine();
      return line === null ? api.getCode() : removeMermaidTableRow(api.getCode(), line);
    },
  };
}

const TOOLKITS = {
  flowchart: flowchartToolkit,
  sequence: sequenceToolkit,
  state: stateToolkit,
  class: classToolkit,
  er: erToolkit,
  mindmap: mindmapToolkit,
};
