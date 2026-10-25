// Interactive diagram surface for the rich Mermaid editor.
//
// The surface renders the current diagram text and turns the drawing into an
// editing target: clicking an element reveals its source line, double-clicking
// renames it in place, and each diagram type gets its own visual tools (see
// mermaidDiagramTools.js) plus, for data-style diagrams, a table panel. It
// never owns the text. Every edit is
// handed to `applyCode`, so the host (the inline editor or the modal) keeps a
// single source of truth with normal undo.
import {
  detectMermaidDiagramType,
  getFlowchartNodeIds,
  getMermaidErrorLine,
  MERMAID_TEMPLATES,
  parseMermaidNodeDomId,
  summarizeMermaidError,
} from "../../domain/mermaidSource.js";
import { getMermaidTableSpec } from "../../domain/mermaidTables.js";
import { createMermaidToolkit } from "./mermaidDiagramTools.js";
import { createMermaidTableEditor } from "./mermaidTableEditor.js";
import {
  buildMermaidSourceIndex,
  findMermaidSourceEntry,
  findMermaidSourceLine,
  getMermaidLineReferences,
  getMermaidTargetLabel,
  normalizeLabel,
  renameMermaidTarget,
} from "../../domain/mermaidIndex.js";
import {
  collectMermaidNodeIds,
  describeMermaidElement,
  findMermaidElements,
  findMermaidTargets,
} from "./mermaidSvgTargets.js";
import {
  installMermaidSvg,
  MermaidViewportController,
  stopInteractiveEvent,
} from "./mermaidRenderer.js";

const RENDER_DELAY = 220;
const SELECTED_CLASS = "is-rd-selected";
const LINKED_CLASS = "is-rd-linked";
const CONNECT_SOURCE_CLASS = "is-rd-connect-source";

export function createMermaidEditorSurface({
  renderer,
  colorized = true,
  variant = "inline",
  readOnly = false,
  code: initialCode = "",
  applyCode,
  revealLine,
  onDiagnostics = () => {},
  onResize = () => {},
  // Called after an in-place rename closes, so the host can put focus back
  // where typing should continue.
  onFocusReturn = null,
  actions = [],
}) {
  const state = {
    code: initialCode,
    type: detectMermaidDiagramType(initialCode),
    renderId: "",
    nodeIds: new Set(),
    hasDiagram: false,
    selected: null,
    connectMode: false,
    connectSource: null,
    connectDrag: null,
    userZoomed: false,
    // { keys } or { line }, plus rename: what to select after the next render.
    pendingSelect: null,
    tableOpen: true,
    highlightedLine: -1,
    renderTimer: 0,
    renderToken: 0,
    lastDiagnostic: undefined,
    pointerStart: null,
    destroyed: false,
    renaming: null,
  };

  const root = document.createElement("div");
  root.className = `cm-mermaid-surface is-${variant}`;

  const toolbar = document.createElement("div");
  toolbar.className = "cm-mermaid-surface-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Mermaid diagram tools");

  const viewport = document.createElement("div");
  viewport.className = "cm-mermaid-surface-viewport";
  viewport.tabIndex = 0;
  viewport.setAttribute("aria-label", "Mermaid diagram");

  const stage = document.createElement("div");
  stage.className = "cm-mermaid-surface-stage";

  const connector = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  connector.setAttribute("class", "cm-mermaid-surface-connector");
  const connectorLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  connector.appendChild(connectorLine);
  connector.style.display = "none";

  const renameInput = document.createElement("input");
  renameInput.type = "text";
  renameInput.className = "cm-mermaid-surface-rename";
  renameInput.setAttribute("aria-label", "Rename diagram element");
  renameInput.hidden = true;

  const templates = document.createElement("div");
  templates.className = "cm-mermaid-surface-templates";
  templates.hidden = true;

  const status = document.createElement("div");
  status.className = "cm-mermaid-surface-status";
  status.setAttribute("role", "status");

  const panel = document.createElement("div");
  panel.className = "cm-mermaid-surface-panel";
  panel.hidden = true;

  viewport.append(stage, connector, renameInput, templates);
  root.append(toolbar, viewport, panel, status);

  const controller = new MermaidViewportController(viewport, stage, {
    maxScale: 6,
    fitMaxScale: variant === "modal" ? 1.6 : 1,
    enableMouse: true,
    wheelZoom: variant === "modal" ? "always" : "modifier",
    canStartPan: (event) => !resolveTarget(event.target) && !state.renaming,
    onUserZoom: () => {
      state.userZoomed = true;
    },
  });

  // ---------------------------------------------------------------- toolbar

  const diagramTools = document.createElement("div");
  diagramTools.className = "cm-mermaid-surface-group is-diagram";
  const connectButton = createButton(
    "Connect",
    "Connect: drag from one element to another",
    () => toggleConnectMode(),
  );
  const deleteButton = createButton("Delete", "Delete the selected element", deleteSelected);
  const tableButton = createButton("Table", "Show or hide the data table", () => {
    state.tableOpen = !state.tableOpen;
    syncTable();
    syncToolbar();
  });

  let toolkit = null;
  let toolkitType;
  let tableEditor = null;
  let tableSpec = null;

  const toolkitApi = {
    getCode: () => state.code,
    lines: () => state.code.split("\n"),
    getSelection: () => state.selected,
    selectionLine() {
      if (!state.selected) return null;
      const line = findMermaidSourceLine(state.code, state.selected, state.type);
      return line >= 0 ? line : null;
    },
    entryOf: (target) =>
      findMermaidSourceEntry(buildMermaidSourceIndex(state.code, state.type), target),
    apply: applyEdit,
    createButton,
    createSelect,
  };

  const viewTools = document.createElement("div");
  viewTools.className = "cm-mermaid-surface-group is-view";
  viewTools.append(
    createButton("-", "Zoom out", () => zoom(0.82)),
    createButton("+", "Zoom in", () => zoom(1.22)),
    createButton("Fit", "Fit diagram", () => {
      state.userZoomed = false;
      controller.fit();
    }),
    ...actions.map((action) => {
      const button = createButton(action.label, action.title, action.run);
      if (action.className) button.classList.add(action.className);
      return button;
    }),
  );
  toolbar.append(diagramTools, viewTools);

  function createButton(label, title, run) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-mermaid-surface-button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      stopInteractiveEvent(event);
      run();
    });
    return button;
  }

  function createSelect(title, options, onChange) {
    const select = document.createElement("select");
    select.className = "cm-mermaid-surface-select";
    select.title = title;
    select.setAttribute("aria-label", title);
    for (const [value, label] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }

  function zoom(factor) {
    state.userZoomed = true;
    controller.zoomBy(factor);
  }

  function ensureToolkit() {
    if (toolkitType === state.type) return;
    toolkitType = state.type;
    toolkit = readOnly ? null : createMermaidToolkit(state.type, toolkitApi);
    if (state.connectMode && !toolkit?.canConnect) {
      state.connectMode = false;
      state.connectSource = null;
    }
    diagramTools.replaceChildren(
      ...[
        toolkit?.element,
        toolkit?.canConnect ? connectButton : null,
        toolkit?.remove ? deleteButton : null,
        tableButton,
      ].filter(Boolean),
    );
  }

  function syncToolbar() {
    ensureToolkit();
    tableSpec = readOnly ? null : getMermaidTableSpec(state.code, state.type);
    tableButton.hidden = !tableSpec;
    tableButton.setAttribute("aria-pressed", String(Boolean(tableSpec && state.tableOpen)));
    tableButton.classList.toggle("is-active", Boolean(tableSpec && state.tableOpen));
    diagramTools.hidden = !toolkit && !tableSpec;
    deleteButton.disabled = !(state.selected && toolkit?.canRemove?.(state.selected));
    connectButton.setAttribute("aria-pressed", String(state.connectMode));
    connectButton.classList.toggle("is-active", state.connectMode);
    root.classList.toggle("is-connecting", state.connectMode);
    toolkit?.sync();
  }

  function syncTable() {
    const visible = Boolean(tableSpec && state.tableOpen);
    panel.hidden = !visible;
    root.classList.toggle("has-panel", visible);
    if (!visible) {
      tableEditor = null;
      panel.replaceChildren();
      return;
    }
    if (!tableEditor || tableEditor.spec !== tableSpec) {
      const editor = createMermaidTableEditor({
        spec: tableSpec,
        getCode: () => state.code,
        apply: (code) => apply(code),
        revealLine,
      });
      tableEditor = { ...editor, spec: tableSpec };
      panel.replaceChildren(editor.element);
      return;
    }
    tableEditor.refresh();
  }

  // ---------------------------------------------------------------- render

  function update(code) {
    if (state.destroyed || code === state.code) {
      return;
    }
    state.code = code;
    state.type = detectMermaidDiagramType(code);
    syncToolbar();
    syncTable();
    scheduleRender();
  }

  function scheduleRender(delay = RENDER_DELAY) {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(renderNow, delay);
  }

  async function renderNow() {
    const token = ++state.renderToken;
    const code = state.code;
    if (!code.trim()) {
      stage.replaceChildren();
      state.hasDiagram = false;
      showTemplates(!readOnly);
      setStatus(readOnly ? "Empty Mermaid diagram" : "Pick a template or start typing.");
      report(null);
      return;
    }
    showTemplates(false);
    if (!state.hasDiagram) {
      setStatus("Rendering Mermaid...");
    }
    try {
      const result = await renderer.render(code, {
        colorized,
        idPrefix: "richdown-mermaid-edit",
      });
      if (token !== state.renderToken || state.destroyed) {
        return;
      }
      const { size } = installMermaidSvg(stage, result.svg, colorized);
      if (typeof result.bindFunctions === "function") {
        result.bindFunctions(stage);
      }
      state.renderId = result.renderId;
      state.nodeIds =
        state.type === "flowchart"
          ? getFlowchartNodeIds(code)
          : collectMermaidNodeIds({ stage, renderId: state.renderId });
      state.hasDiagram = true;
      root.classList.remove("has-error");
      controller.setNaturalSize(size.width, size.height);
      if (!state.userZoomed) {
        controller.fit();
      }
      restoreSelection();
      applyLineHighlight();
      setStatus(getHint());
      report(null);
    } catch (error) {
      if (token !== state.renderToken || state.destroyed) {
        return;
      }
      const message = summarizeMermaidError(error);
      const lineIndex = getMermaidErrorLine(error, code);
      root.classList.toggle("has-error", true);
      setStatus(
        lineIndex >= 0 ? `Line ${lineIndex + 1}: ${message}` : message,
        true,
      );
      status.title = String(error?.message ?? error);
      report({ lineIndex, message });
    }
  }

  function report(diagnostic) {
    const key = diagnostic ? `${diagnostic.lineIndex}:${diagnostic.message}` : null;
    if (key === state.lastDiagnostic) {
      return;
    }
    state.lastDiagnostic = key;
    onDiagnostics(diagnostic);
  }

  function setStatus(text, isError = false) {
    status.textContent = text;
    status.title = "";
    status.classList.toggle("is-error", isError);
  }

  function getHint() {
    if (readOnly) {
      return "Click an element to find it in the source.";
    }
    if (state.connectMode) {
      return state.connectSource
        ? `Connecting from ${state.connectSource.text || "the selection"}: click or drop on another element.`
        : toolkit?.connectHint || "Drag from one element to another to connect them.";
    }
    const base = "Click to jump to source · Double-click to rename";
    return toolkit?.canConnect ? `${base} · Shift-drag to connect` : base;
  }

  function showTemplates(visible) {
    templates.hidden = !visible;
    if (!visible || templates.childElementCount) {
      return;
    }
    const title = document.createElement("div");
    title.className = "cm-mermaid-surface-templates-title";
    title.textContent = "Start from a template";
    templates.appendChild(title);
    for (const template of MERMAID_TEMPLATES) {
      const button = createButton(template.label, `Insert a ${template.label} diagram`, () =>
        apply(template.code),
      );
      button.classList.add("cm-mermaid-surface-template");
      templates.appendChild(button);
    }
  }

  // ---------------------------------------------------------------- targets

  function svgContext() {
    return { stage, renderId: state.renderId, type: state.type, nodeIds: state.nodeIds };
  }

  function resolveTarget(element) {
    return state.hasDiagram ? describeMermaidElement(element, svgContext()) : null;
  }

  function readLabel(element) {
    return element ? element.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function findNodeElement(id) {
    return [...stage.querySelectorAll("g.node")].find(
      (node) => parseMermaidNodeDomId(node.id, state.renderId)?.id === id,
    );
  }

  // Re-finds a selected target after a re-render, most specific key first.
  function findTarget(target) {
    const context = svgContext();
    for (const key of target.keys || []) {
      const [match] = findMermaidTargets(context, { keys: new Set([key]), texts: new Set() });
      if (match) return match;
    }
    if (!target.keys?.length && target.text) {
      const [match] = findMermaidTargets(context, {
        keys: new Set(),
        texts: new Set([normalizeLabel(target.text)]),
      });
      if (match) return match;
    }
    return null;
  }

  function select(target, { reveal = true } = {}) {
    stage
      .querySelectorAll(`.${SELECTED_CLASS}`)
      .forEach((element) => element.classList.remove(SELECTED_CLASS));
    state.selected = target;
    for (const element of [target?.element, ...(target?.extraElements || [])]) {
      element?.classList.add(SELECTED_CLASS);
    }
    syncToolbar();
    if (reveal && target) {
      const line = findMermaidSourceLine(state.code, target, state.type);
      if (line >= 0) {
        revealLine(line);
      }
    }
  }

  function restoreSelection() {
    if (state.pendingSelect) {
      const { keys, line, rename } = state.pendingSelect;
      state.pendingSelect = null;
      const wanted =
        keys ||
        buildMermaidSourceIndex(state.code, state.type)
          .entries.filter((entry) => entry.lineIndex === line)
          .flatMap((entry) => entry.keys);
      const target = wanted?.length ? findTarget({ keys: wanted }) : null;
      if (target) {
        select(target, { reveal: !rename });
        if (rename) {
          startRename(target);
        }
        return;
      }
    }
    if (!state.selected) {
      syncToolbar();
      return;
    }
    const target = findTarget(state.selected);
    select(target, { reveal: false });
  }

  function highlightLine(lineIndex) {
    state.highlightedLine = lineIndex;
    applyLineHighlight();
  }

  function applyLineHighlight() {
    stage
      .querySelectorAll(`.${LINKED_CLASS}`)
      .forEach((element) => element.classList.remove(LINKED_CLASS));
    if (!state.hasDiagram || state.highlightedLine < 0) {
      return;
    }
    const { keys, texts } = getMermaidLineReferences(
      state.code,
      state.highlightedLine,
      state.type,
    );
    for (const element of findMermaidElements(svgContext(), { keys, texts })) {
      element.classList.add(LINKED_CLASS);
    }
  }

  // ---------------------------------------------------------------- editing

  function apply(nextCode) {
    if (readOnly || nextCode === state.code) {
      return;
    }
    applyCode(nextCode);
    update(nextCode);
  }

  function applyEdit(nextCode, { select: selection = null, rename = false } = {}) {
    if (readOnly || nextCode === state.code) {
      return;
    }
    if (selection) {
      state.pendingSelect = { ...selection, rename };
    }
    apply(nextCode);
  }

  function deleteSelected() {
    const target = state.selected;
    if (readOnly || !target || !toolkit?.remove || !toolkit.canRemove(target)) {
      return;
    }
    const next = toolkit.remove(target);
    if (next !== state.code) {
      select(null, { reveal: false });
      apply(next);
    }
  }

  function toggleConnectMode(force) {
    state.connectMode = typeof force === "boolean" ? force : !state.connectMode;
    setConnectSource(null);
    syncToolbar();
    setStatus(getHint());
  }

  function setConnectSource(target) {
    stage
      .querySelectorAll(`.${CONNECT_SOURCE_CLASS}`)
      .forEach((element) => element.classList.remove(CONNECT_SOURCE_CLASS));
    state.connectSource = target;
    target?.element?.classList.add(CONNECT_SOURCE_CLASS);
    if (state.hasDiagram) {
      setStatus(getHint());
    }
  }

  function sameTarget(a, b) {
    return Boolean(a && b) && (a.keys?.[0] ?? a.text) === (b.keys?.[0] ?? b.text);
  }

  function connect(from, to) {
    if (!from || !to || !toolkit?.connect) {
      return;
    }
    toolkit.connect(from, to);
  }

  function startRename(target) {
    if (readOnly || !target?.element) {
      return;
    }
    const bounds = target.element.getBoundingClientRect();
    const frame = viewport.getBoundingClientRect();
    const width = Math.max(140, bounds.width + 24);
    renameInput.style.left = `${Math.max(4, bounds.left - frame.left + bounds.width / 2 - width / 2)}px`;
    renameInput.style.top = `${Math.max(4, bounds.top - frame.top + bounds.height / 2 - 15)}px`;
    renameInput.style.width = `${width}px`;
    // The source label is what gets rewritten; the drawing may decorate it
    // ("Text: ..." in requirement boxes, "[...]" around loop titles).
    renameInput.value =
      getMermaidTargetLabel(state.code, target, state.type) || target.text || "";
    renameInput.hidden = false;
    state.renaming = target;
    renameInput.focus({ preventScroll: true });
    renameInput.select();
  }

  // Enter/Escape hand focus back to where typing continues; a blur means the
  // user already moved focus somewhere else, which must not be taken back.
  function finishRename(commit, { returnFocus = true } = {}) {
    const target = state.renaming;
    if (!target) {
      return;
    }
    state.renaming = null;
    renameInput.hidden = true;
    const value = renameInput.value;
    const original =
      getMermaidTargetLabel(state.code, target, state.type) || target.text || "";
    if (commit && value.trim() && value.trim() !== original.trim()) {
      const next = renameMermaidTarget(state.code, target, value, state.type);
      if (next === state.code) {
        setStatus("This name is used as an identifier here; use a single word.", true);
      } else {
        apply(next);
      }
    } else if (commit && target.kind === "edge" && !value.trim() && target.text) {
      apply(renameMermaidTarget(state.code, target, "", state.type));
    }
    if (!returnFocus) {
      return;
    }
    if (onFocusReturn) {
      onFocusReturn();
    } else {
      viewport.focus({ preventScroll: true });
    }
  }

  renameInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      finishRename(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finishRename(false);
    }
  });
  renameInput.addEventListener("blur", () => finishRename(true, { returnFocus: false }));
  renameInput.addEventListener("pointerdown", (event) => event.stopPropagation());

  // ---------------------------------------------------------------- pointer

  // Keep focus where it is (the inline editor's caret) unless the user is
  // typing into one of the surface's own form controls.
  root.addEventListener("mousedown", (event) => {
    if (event.target.closest("input, select")) {
      return;
    }
    event.preventDefault();
    if (variant === "modal") {
      viewport.focus({ preventScroll: true });
    }
  });

  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || state.renaming) {
      return;
    }
    state.pointerStart = { x: event.clientX, y: event.clientY };
    const target = resolveTarget(event.target);
    if (
      readOnly ||
      !toolkit?.canConnect?.(target) ||
      !(state.connectMode || event.shiftKey)
    ) {
      return;
    }
    event.preventDefault();
    if (state.connectSource && !sameTarget(state.connectSource, target)) {
      const from = state.connectSource;
      setConnectSource(null);
      connect(from, target);
      return;
    }
    state.connectDrag = { source: target, pointerId: event.pointerId };
    viewport.setPointerCapture?.(event.pointerId);
    drawConnector(target.element, event);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!state.connectDrag) {
      return;
    }
    event.preventDefault();
    drawConnector(state.connectDrag.source.element, event);
  });

  viewport.addEventListener("pointerup", (event) => {
    const drag = state.connectDrag;
    if (!drag) {
      return;
    }
    state.connectDrag = null;
    connector.style.display = "none";
    viewport.releasePointerCapture?.(drag.pointerId);
    const dropTarget = resolveTarget(
      document.elementFromPoint?.(event.clientX, event.clientY) ?? event.target,
    );
    if (toolkit?.canConnect?.(dropTarget) && !sameTarget(dropTarget, drag.source)) {
      setConnectSource(null);
      connect(drag.source, dropTarget);
      state.pointerStart = null;
      return;
    }
    if (state.connectMode) {
      setConnectSource(drag.source);
    }
  });

  viewport.addEventListener("click", (event) => {
    if (state.renaming || movedSincePointerDown(event) || controller.moved) {
      controller.moved = false;
      return;
    }
    if (state.connectMode) {
      return;
    }
    const target = resolveTarget(event.target);
    select(target);
  });

  viewport.addEventListener("dblclick", (event) => {
    const target = resolveTarget(event.target);
    if (!target) {
      return;
    }
    event.preventDefault();
    select(target);
    startRename(target);
  });

  viewport.addEventListener("keydown", (event) => {
    if (state.renaming) {
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && state.selected) {
      event.preventDefault();
      event.stopPropagation();
      deleteSelected();
    } else if ((event.key === "Enter" || event.key === "F2") && state.selected) {
      event.preventDefault();
      event.stopPropagation();
      startRename(state.selected.element ? state.selected : null);
    } else if (event.key === "Escape" && (state.connectMode || state.selected)) {
      event.preventDefault();
      event.stopPropagation();
      if (state.connectMode) {
        toggleConnectMode(false);
      } else {
        select(null, { reveal: false });
      }
    }
  });

  function movedSincePointerDown(event) {
    const start = state.pointerStart;
    state.pointerStart = null;
    return Boolean(
      start && Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 4,
    );
  }

  function drawConnector(fromElement, event) {
    const frame = viewport.getBoundingClientRect();
    const bounds = fromElement.getBoundingClientRect();
    connectorLine.setAttribute("x1", String(bounds.left - frame.left + bounds.width / 2));
    connectorLine.setAttribute("y1", String(bounds.top - frame.top + bounds.height / 2));
    connectorLine.setAttribute("x2", String(event.clientX - frame.left));
    connectorLine.setAttribute("y2", String(event.clientY - frame.top));
    connector.style.display = "block";
  }

  let resizeObserver = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => {
      if (!state.userZoomed) {
        controller.fit();
      }
      onResize();
    });
    resizeObserver.observe(viewport);
  }

  syncToolbar();
  syncTable();
  scheduleRender(0);

  return {
    element: root,
    update,
    highlightLine,
    fit: () => controller.fit(),
    focus: () => viewport.focus({ preventScroll: true }),
    getSelection: () => state.selected,
    selectNode(id) {
      const element = findNodeElement(id);
      if (element) {
        select({ kind: "node", id, text: readLabel(element) || id, element }, { reveal: false });
      }
    },
    renderNow,
    destroy() {
      state.destroyed = true;
      window.clearTimeout(state.renderTimer);
      resizeObserver?.disconnect();
    },
  };
}
