// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPreviewHarness } from "./helpers/previewHarness.js";

const DIAGRAM = ["graph TD;", "  A-->B;", "  B-->C;"].join("\n");

function docFor(code = DIAGRAM, fence = "```") {
  return ["intro", "", `${fence}mermaid`, code, fence, ""].join("\n");
}

const SVG = '<svg width="400" height="200" viewBox="0 0 400 200"><g></g></svg>';

let harness;
let renderCalls;

// The webview loads Mermaid from a separate bundle that assigns
// window.__richdownMermaid. Installing a stub there exercises the whole render
// path without shipping the real renderer into the test run.
function installMermaid({ render } = {}) {
  renderCalls = [];
  window.__richdownMermaid = {
    initialize: vi.fn(),
    render:
      render ??
      ((id, code) => {
        renderCalls.push({ id, code });
        return Promise.resolve({ svg: SVG, bindFunctions: vi.fn() });
      }),
  };
  return window.__richdownMermaid;
}

function mount(options = {}) {
  harness = createPreviewHarness({
    doc: docFor(),
    mermaidScriptUri: "mermaid.js",
    ...options,
  });
  const widget = harness.widget("MermaidPreviewWidget");
  expect(widget, "the document must produce a mermaid preview").toBeTruthy();
  const dom = widget.toDOM(harness.view);
  document.body.appendChild(dom);
  return { widget, dom, view: harness.view };
}

function toolButton(dom, title) {
  return [...dom.querySelectorAll(".cm-mermaid-tool-button")].find(
    (button) => button.title === title,
  );
}

beforeEach(() => {
  installMermaid();
});

afterEach(() => {
  harness?.destroy();
  harness = null;
  delete window.__richdownMermaid;
  document.body.replaceChildren();
  document.head.querySelectorAll("script").forEach((script) => script.remove());
  vi.useRealTimers();
});

describe("mermaid preview decoration", () => {
  it("replaces a fenced mermaid block with a widget", () => {
    harness = createPreviewHarness({ doc: docFor() });
    const entry = harness.widgetEntry("MermaidPreviewWidget");

    expect(entry.spec.block).toBe(true);
    expect(entry.widget.mermaidBlock.code).toBe(DIAGRAM);
  });

  it.each([["~~~"], [":::"]])("also replaces a %s fence", (fence) => {
    harness = createPreviewHarness({ doc: docFor(DIAGRAM, fence) });
    expect(harness.widget("MermaidPreviewWidget")).toBeTruthy();
  });

  it("keeps the source when mermaid previews are disabled", () => {
    harness = createPreviewHarness({
      doc: docFor(),
      settings: { mermaidPreview: false },
    });
    expect(harness.widget("MermaidPreviewWidget")).toBeNull();
  });

  it("stays rendered when the caret is merely inside the block", () => {
    // Unlike tables and gherkin boards, a diagram only falls back to source on an
    // explicit edit request (click / Enter), not because the caret moved into it.
    const doc = docFor();
    harness = createPreviewHarness({
      doc,
      selection: { anchor: doc.indexOf("A-->B") },
    });
    expect(harness.widget("MermaidPreviewWidget")).toBeTruthy();
  });

  it("carries the preview size and colorized flag from settings", () => {
    harness = createPreviewHarness({
      doc: docFor(),
      settings: { mermaidPreviewSize: "large", mermaidColorized: false },
    });
    const widget = harness.widget("MermaidPreviewWidget");

    expect(widget.previewSize).toBe("large");
    expect(widget.colorized).toBe(false);
  });

  it("compares widgets by range, signature, size, color and revision", () => {
    harness = createPreviewHarness({ doc: docFor() });
    const widget = harness.widget("MermaidPreviewWidget");

    expect(widget.eq(widget)).toBe(true);
    expect(
      widget.eq({
        mermaidBlock: widget.mermaidBlock,
        previewSize: "large",
        colorized: widget.colorized,
        revision: widget.revision,
      }),
    ).toBe(false);
  });

  it("estimates a taller box for the large preview size", () => {
    harness = createPreviewHarness({ doc: docFor() });
    const readable = harness.widget("MermaidPreviewWidget").estimatedHeight;
    harness.destroy();

    harness = createPreviewHarness({
      doc: docFor(),
      settings: { mermaidPreviewSize: "large" },
    });
    expect(harness.widget("MermaidPreviewWidget").estimatedHeight).toBeGreaterThan(
      readable,
    );
  });

  it("matches the source height when the size follows the source", () => {
    harness = createPreviewHarness({
      doc: docFor(),
      settings: { mermaidPreviewSize: "source" },
    });
    const widget = harness.widget("MermaidPreviewWidget");
    expect(widget.estimatedHeight).toBe(widget.mermaidBlock.sourceLineCount * 20);
  });
});

describe("mermaid preview DOM", () => {
  it("builds a focusable preview with a zoom toolbar", () => {
    const { dom } = mount();

    expect(dom.className).toContain("cm-mermaid-preview");
    expect(dom.className).toContain("is-readable");
    expect(dom.getAttribute("role")).toBe("button");
    expect(dom.getAttribute("tabindex")).toBe("0");
    expect(
      [...dom.querySelectorAll(".cm-mermaid-tool-button")].map(
        (button) => button.title,
      ),
    ).toEqual(["Zoom out", "Zoom in", "Fit diagram", "Open diagram"]);
  });

  it("reserves a source height on the wrapper", () => {
    const { dom } = mount();
    expect(dom.style.getPropertyValue("--mermaid-source-height")).toMatch(/^\d+px$/);
  });

  it("says the diagram is empty when the block has no code", () => {
    harness = createPreviewHarness({ doc: docFor("") });
    const dom = harness.widget("MermaidPreviewWidget").toDOM(harness.view);

    expect(dom.querySelector(".cm-mermaid-status").textContent).toBe(
      "Empty Mermaid diagram",
    );
    expect(renderCalls).toEqual([]);
  });

  it("renders the diagram through the Mermaid bundle", async () => {
    const { dom } = mount();

    await vi.waitFor(() => {
      expect(dom.querySelector(".cm-mermaid-canvas")).toBeTruthy();
    });
    expect(renderCalls[0].code).toBe(DIAGRAM);
    expect(dom.querySelector(".cm-mermaid-stage svg")).toBeTruthy();
    expect(dom.querySelector(".cm-mermaid-status")).toBeNull();
  });

  it("sizes the stage from the SVG's natural size", async () => {
    const { dom } = mount();

    await vi.waitFor(() => {
      const stage = dom.querySelector(".cm-mermaid-stage");
      expect(stage.style.width).toBe("400px");
      expect(stage.style.height).toBe("200px");
    });
  });

  it("adds the Richdown palette to a colorized diagram", async () => {
    const { dom } = mount();

    await vi.waitFor(() => {
      const svg = dom.querySelector("svg");
      expect(svg.getAttribute("data-richdown-colorized")).toBe("true");
      expect(svg.querySelector("style[data-richdown-mermaid]")).toBeTruthy();
    });
  });

  it("leaves the diagram untouched when colorizing is off", async () => {
    const { dom } = mount({ settings: { mermaidColorized: false } });

    await vi.waitFor(() => expect(dom.querySelector("svg")).toBeTruthy());
    expect(dom.querySelector("svg").getAttribute("data-richdown-colorized")).toBeNull();
  });

  it("initializes Mermaid with a strict security level", async () => {
    const { dom } = mount();
    await vi.waitFor(() => expect(dom.querySelector("svg")).toBeTruthy());

    expect(window.__richdownMermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ startOnLoad: false, securityLevel: "strict" }),
    );
  });

  it("shows the renderer's message when a diagram fails", async () => {
    installMermaid({
      render: () => Promise.reject(new Error("Parse error on line 2")),
    });
    const { dom } = mount();

    await vi.waitFor(() => {
      expect(dom.querySelector(".cm-mermaid-error").textContent).toBe(
        "Parse error on line 2",
      );
    });
    expect(dom.querySelector(".cm-mermaid-canvas")).toBeNull();
  });

  it("reports a failure to load the Mermaid bundle", async () => {
    delete window.__richdownMermaid;
    const { dom } = mount();

    // jsdom never loads the injected script, so the loader's error path runs.
    document.head.querySelector("script[src='mermaid.js']").onerror();

    await vi.waitFor(() => {
      expect(dom.querySelector(".cm-mermaid-error").textContent).toBe(
        "Failed to load Mermaid renderer.",
      );
    });
  });

  it("reports a loader that does not expose Mermaid", async () => {
    delete window.__richdownMermaid;
    const { dom } = mount();

    document.head.querySelector("script[src='mermaid.js']").onload();

    await vi.waitFor(() => {
      expect(dom.querySelector(".cm-mermaid-error").textContent).toBe(
        "Mermaid loader did not expose Mermaid.",
      );
    });
  });
});

describe("mermaid zoom controls", () => {
  it("zooms the stage in and out", async () => {
    const { dom } = mount();
    await vi.waitFor(() => expect(dom.querySelector(".cm-mermaid-stage")).toBeTruthy());
    const stage = dom.querySelector(".cm-mermaid-stage");

    const before = Number.parseFloat(stage.style.width);
    toolButton(dom, "Zoom in").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    const zoomedIn = Number.parseFloat(stage.style.width);
    expect(zoomedIn).toBeGreaterThan(before);

    toolButton(dom, "Zoom out").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(Number.parseFloat(stage.style.width)).toBeLessThan(zoomedIn);
  });

  it("scrolls back to the origin when fitting", async () => {
    const { dom } = mount();
    await vi.waitFor(() => expect(dom.querySelector(".cm-mermaid-canvas")).toBeTruthy());
    const canvas = dom.querySelector(".cm-mermaid-canvas");
    canvas.scrollLeft = 40;

    toolButton(dom, "Fit diagram").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(canvas.scrollLeft).toBe(0);
  });

  it("opens a modal with the rendered diagram", async () => {
    const { dom } = mount();
    await vi.waitFor(() => expect(dom.querySelector("svg")).toBeTruthy());

    toolButton(dom, "Open diagram").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    const backdrop = document.querySelector(".cm-mermaid-modal-backdrop");

    expect(backdrop).toBeTruthy();
    expect(backdrop.querySelector(".cm-mermaid-modal-title").textContent).toBe(
      "Mermaid diagram",
    );
    expect(backdrop.querySelector(".cm-mermaid-modal-canvas svg")).toBeTruthy();
    expect(
      [...backdrop.querySelectorAll(".cm-mermaid-modal-button")].map(
        (button) => button.title,
      ),
    ).toEqual([
      "Zoom out",
      "Zoom in",
      "Fit diagram",
      "Move left",
      "Move up",
      "Move down",
      "Move right",
      "Close",
    ]);
  });

  it("closes the modal from its close button", async () => {
    const { dom } = mount();
    await vi.waitFor(() => expect(dom.querySelector("svg")).toBeTruthy());
    toolButton(dom, "Open diagram").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    document
      .querySelector('.cm-mermaid-modal-button[title="Close"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelector(".cm-mermaid-modal-backdrop")).toBeNull();
  });

  it("never stacks two modals", async () => {
    const { dom } = mount();
    await vi.waitFor(() => expect(dom.querySelector("svg")).toBeTruthy());
    const open = toolButton(dom, "Open diagram");

    open.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    open.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(
      document.querySelectorAll(".cm-mermaid-modal-backdrop"),
    ).toHaveLength(1);
  });

  it("pans the modal diagram", async () => {
    const { dom } = mount();
    await vi.waitFor(() => expect(dom.querySelector("svg")).toBeTruthy());
    toolButton(dom, "Open diagram").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    const stage = document.querySelector(".cm-mermaid-modal-stage");
    const before = stage.style.transform;

    document
      .querySelector('.cm-mermaid-modal-button[title="Move right"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(stage.style.transform).not.toBe(before);
  });

  it("does not open a modal before the diagram is rendered", () => {
    const { dom } = mount();
    toolButton(dom, "Open diagram").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(document.querySelector(".cm-mermaid-modal-backdrop")).toBeNull();
  });
});

describe("editing the mermaid source", () => {
  it("moves the caret into the block on click", () => {
    const { dom, view } = mount();
    dom.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.doc.lineAt(view.state.selection.main.anchor).text).toBe(
      "graph TD;",
    );
    expect(harness.widget("MermaidPreviewWidget")).toBeNull();
  });

  it("opens the source with Enter and Space", () => {
    const { dom, view } = mount();
    dom.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(view.state.selection.main.anchor).toBeGreaterThan(0);
  });

  it("ignores toolbar clicks", async () => {
    const { dom, view } = mount();
    await vi.waitFor(() => expect(dom.querySelector("svg")).toBeTruthy());

    toolButton(dom, "Zoom in").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    expect(view.state.selection.main.anchor).toBe(0);
  });

  it("stays rendered in a read-only editor", () => {
    const { dom, view } = mount({ readOnly: true });
    dom.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(view.state.selection.main.anchor).toBe(0);
    expect(harness.widget("MermaidPreviewWidget")).toBeTruthy();
  });

  it("stops observing the container when destroyed", async () => {
    const disconnect = vi.fn();
    window.ResizeObserver = class {
      observe() {}
      disconnect() {
        disconnect();
      }
    };
    const { dom, widget } = mount();
    await vi.waitFor(() => expect(dom.querySelector("svg")).toBeTruthy());

    widget.destroy();
    expect(disconnect).toHaveBeenCalled();
    delete window.ResizeObserver;
  });
});
