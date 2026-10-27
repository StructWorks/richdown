// @vitest-environment jsdom
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPreviewHarness } from "./helpers/previewHarness.js";

const FLOW = ["flowchart TD", "    A[Start] --> B", "    B --> C(End)"].join("\n");

function docFor(code = FLOW) {
  return ["intro", "", "```mermaid", code, "```", "", "outro"].join("\n");
}

// A small stand-in for Mermaid's flowchart output: node groups and edge paths
// carry the same ids and data-ids the real renderer emits, derived from the
// node ids that appear in the diagram text.
function fakeSvg(renderId, code) {
  const nodes = [...new Set(code.match(/\b(?:[A-Z]|N\d+)\b/g) || [])];
  const groups = nodes
    .map(
      (id, index) =>
        `<g class="node default" id="${renderId}-flowchart-${id}-${index}"><rect></rect><g class="label"><text>${id}</text></g></g>`,
    )
    .join("");
  const edges = [...code.matchAll(/\b([A-Z]|N\d+)\b[^\n]*?-->\s*(?:\|[^|]*\|\s*)?\b([A-Z]|N\d+)\b/g)]
    .map(([, from, to]) => `<path class="flowchart-link" data-id="L_${from}_${to}_0"></path>`)
    .join("");
  const clusters = [...code.matchAll(/^\s*subgraph\s+([^\s[]+)(?:\s*\[([^\]]*)\])?/gm)]
    .map(
      ([, id, title]) =>
        `<g class="cluster" id="${renderId}-${id}"><rect></rect><g class="cluster-label"><text>${title ?? id}</text></g></g>`,
    )
    .join("");
  return `<svg viewBox="0 0 400 200">${clusters}${edges}${groups}</svg>`;
}

let harness;
let renderCalls;

function installMermaid({ render } = {}) {
  renderCalls = [];
  window.__richdownMermaid = {
    initialize: vi.fn(),
    render:
      render ??
      ((id, code) => {
        renderCalls.push({ id, code });
        return Promise.resolve({ svg: fakeSvg(id, code), bindFunctions: vi.fn() });
      }),
  };
}

function mountEditing(options = {}) {
  harness = createPreviewHarness({
    doc: docFor(options.code),
    mermaidScriptUri: "mermaid.js",
    ...options,
  });
  const preview = harness.widget("MermaidPreviewWidget").toDOM(harness.view);
  document.body.appendChild(preview);
  preview.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const entry = harness.widgetEntry("MermaidLiveEditorWidget");
  expect(entry, "clicking the preview opens the live editor").toBeTruthy();
  const dom = entry.widget.toDOM(harness.view);
  document.body.appendChild(dom);
  return { entry, dom, view: harness.view };
}

// CodeMirror reuses the live editor's DOM across edits; mirror that by
// feeding the next widget into the mounted DOM.
function syncLiveWidget(dom) {
  const next = harness.widget("MermaidLiveEditorWidget");
  expect(next.updateDOM(dom, harness.view)).toBe(true);
  return next;
}

function node(dom, id) {
  return [...dom.querySelectorAll("g.node")].find((group) =>
    group.id.includes(`-flowchart-${id}-`),
  );
}

function surfaceButton(root, title) {
  return [...root.querySelectorAll(".cm-mermaid-surface-button")].find(
    (button) => button.title === title,
  );
}

async function rendered(dom) {
  await vi.waitFor(() => expect(dom.querySelector(".cm-mermaid-surface-stage svg")).toBeTruthy());
}

function click(element, init = {}) {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
}

function diagramText() {
  const text = harness.text();
  return text.slice(text.indexOf("```mermaid\n") + 11, text.lastIndexOf("\n```"));
}

beforeEach(() => {
  installMermaid();
});

afterEach(() => {
  document.querySelector(".cm-mermaid-editor-backdrop")?.__richdownClose?.();
  harness?.destroy();
  harness = null;
  delete window.__richdownMermaid;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("inline live editor", () => {
  it("keeps the source in the document and adds a live diagram after the fence", () => {
    const { entry, view } = mountEditing();
    const closingFence = view.state.doc.line(7);

    expect(closingFence.text).toBe("```");
    expect(entry.from).toBe(closingFence.to);
    expect(entry.spec.block).toBe(true);
    expect(entry.widget.code).toBe(FLOW);
    expect(harness.lineClasses().filter((name) => name.includes("cm-mermaid-source-line"))).toHaveLength(5);
  });

  it("renders the diagram and its flowchart tools", async () => {
    const { dom } = mountEditing();
    await rendered(dom);

    expect(renderCalls.at(-1).code).toBe(FLOW);
    expect(surfaceButton(dom, "Add a node (connected to the selected node)")).toBeTruthy();
    expect(surfaceButton(dom, "Connect: drag from one element to another")).toBeTruthy();
    expect(surfaceButton(dom, "Finish editing the diagram")).toBeTruthy();
  });

  it("swaps in the tools of the diagram type", async () => {
    const { dom } = mountEditing({ code: "sequenceDiagram\n  A->>B: hi" });
    await rendered(dom);
    expect(surfaceButton(dom, "Add a node (connected to the selected node)")).toBeUndefined();
    expect(surfaceButton(dom, "Add a participant")).toBeTruthy();
  });

  it("jumps to a node's source line when the node is clicked", async () => {
    const { dom, view } = mountEditing();
    await rendered(dom);

    click(node(dom, "C").querySelector("rect"));

    expect(view.state.doc.lineAt(view.state.selection.main.head).text).toBe("    B --> C(End)");
    expect(node(dom, "C").classList.contains("is-rd-selected")).toBe(true);
    expect(harness.widget("MermaidLiveEditorWidget"), "edit mode survives the jump").toBeTruthy();
  });

  it("highlights what the caret's line draws", async () => {
    const { dom, view } = mountEditing();
    await rendered(dom);
    view.dispatch({ selection: { anchor: view.state.doc.line(5).from + 6 } });
    syncLiveWidget(dom);

    expect(node(dom, "A").classList.contains("is-rd-linked")).toBe(true);
    expect(node(dom, "B").classList.contains("is-rd-linked")).toBe(true);
    expect(node(dom, "C").classList.contains("is-rd-linked")).toBe(false);
  });

  it("renames a node label in place", async () => {
    const { dom } = mountEditing();
    await rendered(dom);

    node(dom, "C").dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    const input = dom.querySelector(".cm-mermaid-surface-rename");
    expect(input.hidden).toBe(false);
    input.value = "Finish";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(diagramText()).toBe(["flowchart TD", "    A[Start] --> B", "    B --> C(Finish)"].join("\n"));
    expect(input.hidden).toBe(true);
  });

  it("adds a node connected to the selected node and opens its rename box", async () => {
    const { dom } = mountEditing();
    await rendered(dom);
    click(node(dom, "C"));

    click(surfaceButton(dom, "Add a node (connected to the selected node)"));

    expect(diagramText().split("\n").at(-1)).toBe("    C --> N1[New node]");
    await vi.waitFor(() => {
      expect(dom.querySelector(".cm-mermaid-surface-rename").hidden).toBe(false);
    });
  });

  it("changes the selected node's shape and color", async () => {
    const { dom } = mountEditing();
    await rendered(dom);
    click(node(dom, "A"));

    const shape = dom.querySelector('select[title="Node shape"]');
    expect(shape.disabled).toBe(false);
    expect(shape.value).toBe("rect");
    shape.value = "rhombus";
    shape.dispatchEvent(new Event("change"));
    expect(diagramText()).toContain("A{Start}");

    click(surfaceButton(dom, "Color: Green"));
    expect(diagramText().split("\n").at(-1)).toBe(
      "    style A fill:#dcfce7,stroke:#16a34a,color:#172033",
    );
  });

  it("deletes the selected node with Delete", async () => {
    const { dom } = mountEditing();
    await rendered(dom);
    click(node(dom, "C"));

    dom
      .querySelector(".cm-mermaid-surface-viewport")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));

    expect(diagramText()).toBe(["flowchart TD", "    A[Start] --> B"].join("\n"));
  });

  it("deletes a selected edge", async () => {
    const { dom } = mountEditing();
    await rendered(dom);
    click(dom.querySelector('path[data-id="L_B_C_0"]'));
    click(surfaceButton(dom, "Delete the selected element"));

    expect(diagramText()).toBe(["flowchart TD", "    A[Start] --> B", "    C(End)"].join("\n"));
  });

  it("connects two nodes in connect mode", async () => {
    const { dom } = mountEditing();
    await rendered(dom);
    click(surfaceButton(dom, "Connect: drag from one element to another"));
    const viewport = dom.querySelector(".cm-mermaid-surface-viewport");

    const down = (target) =>
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
    const up = (target) => target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    down(node(dom, "C").querySelector("rect"));
    up(node(dom, "C").querySelector("rect"));
    down(node(dom, "A").querySelector("rect"));

    expect(diagramText().split("\n").at(-1)).toBe("    C --> A");
    expect(viewport).toBeTruthy();
  });

  it("changes the flowchart direction", async () => {
    const { dom } = mountEditing();
    await rendered(dom);
    const direction = dom.querySelector('select[title="Diagram direction"]');
    expect(direction.value).toBe("TD");
    direction.value = "LR";
    direction.dispatchEvent(new Event("change"));
    expect(diagramText().split("\n")[0]).toBe("flowchart LR");
  });

  it("marks the failing source line and keeps the last drawing", async () => {
    const { dom } = mountEditing();
    await rendered(dom);
    window.__richdownMermaid.render = () =>
      Promise.reject(
        Object.assign(new Error("Parse error on line 2:\nmore"), {
          hash: { loc: { first_line: 2 } },
        }),
      );
    const surface = dom.__richdownMermaidSurface;
    surface.update(`${FLOW}\n    oops [`);
    await surface.renderNow();

    expect(dom.querySelector(".cm-mermaid-surface-status").textContent).toBe(
      "Line 2: Syntax error",
    );
    expect(dom.querySelector(".cm-mermaid-surface-stage svg")).toBeTruthy();
    await vi.waitFor(() => {
      expect(harness.lineClasses().some((name) => name.includes("cm-mermaid-error-line"))).toBe(
        true,
      );
    });
    const errorEntry = harness
      .entries()
      .find((entry) => entry.className?.includes("cm-mermaid-error-line"));
    expect(harness.view.state.doc.lineAt(errorEntry.from).text).toBe("    A[Start] --> B");
  });

  it("offers templates for an empty diagram", async () => {
    harness = createPreviewHarness({ doc: "```mermaid\n```\n", mermaidScriptUri: "m.js" });
    const preview = harness.widget("MermaidPreviewWidget").toDOM(harness.view);
    click(preview);
    const dom = harness.widget("MermaidLiveEditorWidget").toDOM(harness.view);
    await vi.waitFor(() => {
      expect(dom.querySelector(".cm-mermaid-surface-templates").hidden).toBe(false);
    });

    click(surfaceButton(dom, "Insert a Pie diagram"));

    expect(harness.text()).toMatch(/^```mermaid\npie title Share\n/);
  });

  it("does not turn a press on a template button into a diagram pan", async () => {
    harness = createPreviewHarness({ doc: "```mermaid\n```\n", mermaidScriptUri: "m.js" });
    click(harness.widget("MermaidPreviewWidget").toDOM(harness.view));
    const dom = harness.widget("MermaidLiveEditorWidget").toDOM(harness.view);
    document.body.appendChild(dom);
    const viewport = dom.querySelector(".cm-mermaid-surface-viewport");
    viewport.setPointerCapture = vi.fn();
    await vi.waitFor(() => {
      expect(dom.querySelector(".cm-mermaid-surface-templates").hidden).toBe(false);
    });
    const button = surfaceButton(dom, "Insert a Flowchart diagram");

    // A captured pointer would retarget the click away from the button.
    const pressed = button.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }),
    );
    expect(pressed, "the press is not cancelled").toBe(true);
    expect(viewport.classList.contains("is-dragging")).toBe(false);
    expect(viewport.setPointerCapture).not.toHaveBeenCalled();
  });

  it("captures the pointer only once the diagram is really dragged", async () => {
    const { dom } = mountEditing();
    await rendered(dom);
    const viewport = dom.querySelector(".cm-mermaid-surface-viewport");
    viewport.setPointerCapture = vi.fn();
    viewport.releasePointerCapture = vi.fn();
    const stage = dom.querySelector(".cm-mermaid-surface-stage");

    stage.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 5, clientY: 5 }));
    expect(viewport.setPointerCapture).not.toHaveBeenCalled();
    viewport.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 30, clientY: 5 }));
    expect(viewport.setPointerCapture).toHaveBeenCalledTimes(1);
    viewport.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    expect(viewport.classList.contains("is-dragging")).toBe(false);
  });

  it("leaves edit mode from the Done button with the caret after the block", async () => {
    const { dom, view } = mountEditing();
    click(surfaceButton(dom, "Finish editing the diagram"));
    expect(harness.widget("MermaidLiveEditorWidget")).toBeNull();
    expect(harness.widget("MermaidPreviewWidget")).toBeTruthy();

    // Typing now must not go into the hidden diagram source.
    const head = view.state.selection.main.head;
    expect(view.state.doc.lineAt(head).number).toBe(8);
    view.dispatch(view.state.replaceSelection("typed"));
    expect(diagramText()).toBe(FLOW);
  });

  it("commits a cell typed before records moved to the right record", async () => {
    const { dom, view } = mountEditing({ code: 'pie title Pets\n    "Dogs" : 386\n    "Cats" : 85' });
    const cats = dom.querySelectorAll(".cm-mermaid-table-input")[3];
    cats.focus();
    cats.value = "90";
    // A record is added above while the cell still has focus.
    const header = view.state.doc.line(4);
    view.dispatch({ changes: { from: header.to, insert: '\n    "Fish" : 1' } });
    syncLiveWidget(dom);

    cats.dispatchEvent(new Event("change"));

    expect(diagramText()).toBe('pie title Pets\n    "Fish" : 1\n    "Dogs" : 386\n    "Cats" : 90');
  });
});

describe("flowchart subgraphs", () => {
  const GROUPED = [
    "flowchart TD",
    "    A[Start] --> B",
    "    subgraph S1 [Backend]",
    "        C",
    "    end",
  ].join("\n");
  const cluster = (dom, id) => dom.querySelector(`g.cluster[id$="-${id}"]`);
  const addSubgraphTitle = "Add a subgraph (around the selected node, or inside the selected subgraph)";

  it("wraps the selected node in a new subgraph and opens its title for renaming", async () => {
    const { dom } = mountEditing();
    await rendered(dom);
    click(node(dom, "B"));

    click(surfaceButton(dom, addSubgraphTitle));

    expect(diagramText()).toBe(
      [FLOW, "    subgraph S1 [Group]", "        B", "    end"].join("\n"),
    );
    const input = dom.querySelector(".cm-mermaid-surface-rename");
    await vi.waitFor(() => expect(input.hidden).toBe(false));
    expect(input.value).toBe("Group");
    input.value = "Core";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(diagramText()).toContain("    subgraph S1 [Core]");
  });

  it("selects a subgraph from its cluster and adds a node inside it", async () => {
    const { dom, view } = mountEditing({ code: GROUPED });
    await rendered(dom);

    click(cluster(dom, "S1").querySelector("rect"));
    expect(cluster(dom, "S1").classList.contains("is-rd-selected")).toBe(true);
    expect(view.state.doc.lineAt(view.state.selection.main.head).text).toBe(
      "    subgraph S1 [Backend]",
    );

    click(surfaceButton(dom, "Add a node (connected to the selected node)"));
    expect(diagramText()).toBe(
      [
        "flowchart TD",
        "    A[Start] --> B",
        "    subgraph S1 [Backend]",
        "        C",
        "        N1[New node]",
        "    end",
      ].join("\n"),
    );
  });

  it("moves the selected node into a subgraph from the dropdown", async () => {
    const { dom } = mountEditing({ code: GROUPED });
    await rendered(dom);
    const membership = dom.querySelector('select[title="Subgraph of the selected node"]');
    expect(membership.hidden).toBe(false);
    expect(membership.disabled).toBe(true);

    click(node(dom, "A"));
    expect(membership.disabled).toBe(false);
    expect(membership.value).toBe("");
    expect([...membership.options].map((option) => option.textContent)).toEqual([
      "No subgraph",
      "Backend",
    ]);
    membership.value = "S1";
    membership.dispatchEvent(new Event("change"));

    expect(diagramText()).toBe(
      [
        "flowchart TD",
        "    A[Start] --> B",
        "    subgraph S1 [Backend]",
        "        C",
        "        A",
        "    end",
      ].join("\n"),
    );
  });

  it("removes a selected subgraph but keeps its nodes", async () => {
    const { dom } = mountEditing({ code: GROUPED });
    await rendered(dom);
    click(cluster(dom, "S1").querySelector("text"));

    click(surfaceButton(dom, "Delete the selected element"));

    expect(diagramText()).toBe(["flowchart TD", "    A[Start] --> B", "    C"].join("\n"));
  });
});

describe("diagram tools beyond flowcharts", () => {
  it("adds a sequence participant and opens it for renaming", async () => {
    const { dom } = mountEditing({ code: "sequenceDiagram\n    A->>B: hi" });
    await rendered(dom);

    click(surfaceButton(dom, "Add a participant"));

    expect(diagramText()).toBe("sequenceDiagram\n    participant Participant\n    A->>B: hi");
  });

  it("toggles sequence autonumbering", async () => {
    const { dom } = mountEditing({ code: "sequenceDiagram\n    A->>B: hi" });
    await rendered(dom);
    click(surfaceButton(dom, "Number the messages"));
    expect(diagramText().split("\n")[1]).toBe("    autonumber");
  });

  it("adds a class", async () => {
    const { dom } = mountEditing({ code: "classDiagram\n    class Animal" });
    await rendered(dom);
    click(surfaceButton(dom, "Add a class"));
    expect(diagramText().split("\n").at(-1)).toBe("    class NewClass");
  });

  it("edits pie slices in the table panel", async () => {
    const { dom } = mountEditing({ code: 'pie title Pets\n    "Dogs" : 386\n    "Cats" : 85' });
    const panel = dom.querySelector(".cm-mermaid-surface-panel");
    expect(panel.hidden).toBe(false);
    const inputs = panel.querySelectorAll(".cm-mermaid-table-input");
    expect([...inputs].map((input) => input.value)).toEqual(["Dogs", "386", "Cats", "85"]);

    inputs[3].value = "90";
    inputs[3].dispatchEvent(new Event("change"));
    expect(diagramText()).toBe('pie title Pets\n    "Dogs" : 386\n    "Cats" : 90');

    click(panel.querySelector(".cm-mermaid-table-footer .cm-mermaid-surface-button"));
    expect(diagramText().split("\n").at(-1)).toBe('    "New slice" : 10');
    expect(panel.querySelectorAll("tbody tr")).toHaveLength(3);
  });

  it("hides the table toggle for diagrams without records", async () => {
    const { dom } = mountEditing({ code: "mindmap\n  root\n    A" });
    expect(surfaceButton(dom, "Show or hide the data table").hidden).toBe(true);
    expect(surfaceButton(dom, "Add a child to the selected idea")).toBeTruthy();
  });
});

describe("Mermaid editor modal", () => {
  function openModal() {
    harness = createPreviewHarness({ doc: docFor(), mermaidScriptUri: "mermaid.js" });
    const preview = harness.widget("MermaidPreviewWidget").toDOM(harness.view);
    document.body.appendChild(preview);
    click(preview.querySelector('.cm-mermaid-tool-button[title="Edit diagram"]'));
    const backdrop = document.querySelector(".cm-mermaid-editor-backdrop");
    expect(backdrop).toBeTruthy();
    return backdrop;
  }

  function sourceView(backdrop) {
    return EditorView.findFromDOM(
      backdrop.querySelector(".cm-mermaid-editor-source .cm-editor"),
    );
  }

  it("opens a split editor holding the diagram text", async () => {
    const backdrop = openModal();
    expect(backdrop.querySelector(".cm-mermaid-editor-source .cm-content").textContent).toContain(
      "A[Start] --> B",
    );
    expect(backdrop.querySelector(".cm-mermaid-editor-badge").textContent).toBe("Flowchart");
    await rendered(backdrop);
  });

  it("writes source edits back into the document", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const backdrop = openModal();
    const view = sourceView(backdrop);
    view.dispatch({ changes: { from: view.state.doc.length, insert: "\n    C --> A" } });

    expect(diagramText()).toBe(FLOW);
    vi.advanceTimersByTime(300);
    expect(diagramText()).toBe(`${FLOW}\n    C --> A`);
  });

  it("applies visual edits through the modal source and flushes on close", async () => {
    const backdrop = openModal();
    await rendered(backdrop);
    const view = sourceView(backdrop);
    click(node(backdrop, "B"));
    expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(2);

    click(surfaceButton(backdrop, "Color: Red"));
    expect(view.state.doc.toString()).toContain("style B fill:#fee2e2");

    click(backdrop.querySelector(".cm-mermaid-editor-done"));
    expect(document.querySelector(".cm-mermaid-editor-backdrop")).toBeNull();
    expect(diagramText()).toContain("style B fill:#fee2e2");
  });

  it("keeps writing to its own block when the document changes above it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const backdrop = openModal();
    const view = sourceView(backdrop);
    harness.view.dispatch({ changes: { from: 0, insert: "```mermaid\npie\n```\n\n" } });

    view.dispatch({ changes: { from: view.state.doc.length, insert: "\n    C --> A" } });
    vi.advanceTimersByTime(300);

    expect(harness.text().startsWith("```mermaid\npie\n```\n\nintro")).toBe(true);
    expect(harness.text()).toContain(`${FLOW}\n    C --> A`);
  });

  it("pulls outside edits of the diagram into the modal", () => {
    const backdrop = openModal();
    const view = sourceView(backdrop);
    const start = harness.text().indexOf("A[Start]");
    harness.view.dispatch({ changes: { from: start + 2, to: start + 7, insert: "Begin" } });

    expect(view.state.doc.toString()).toContain("A[Begin]");
  });

  it("closes on Escape", () => {
    const backdrop = openModal();
    backdrop
      .querySelector(".cm-mermaid-editor-modal")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".cm-mermaid-editor-backdrop")).toBeNull();
  });
});
