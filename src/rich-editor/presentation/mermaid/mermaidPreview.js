// Mermaid preview widget and modal viewer.
//
// Mermaid is loaded lazily because it is the heaviest browser-side dependency
// in the extension. The widget keeps diagram rendering, zoom controls, and modal
// pan/zoom behavior together so the editor entrypoint only toggles previews.
import { WidgetType } from "@codemirror/view";
import { normalizeMermaidPreviewSize } from "../../domain/settingsModel.js";

export function createMermaidPreviewWidgetClass({
  mermaidScriptUri,
  setActiveMermaidEdit,
}) {
  let mermaidLoadPromise = null;

  class MermaidPreviewWidget extends WidgetType {
    constructor(mermaidBlock, previewSize, revision) {
      super();
      this.mermaidBlock = mermaidBlock;
      this.previewSize = normalizeMermaidPreviewSize(previewSize);
      this.revision = revision;
    }
  
    eq(other) {
      return (
        other.mermaidBlock.from === this.mermaidBlock.from &&
        other.mermaidBlock.to === this.mermaidBlock.to &&
        other.mermaidBlock.signature === this.mermaidBlock.signature &&
        other.previewSize === this.previewSize &&
        other.revision === this.revision
      );
    }

    // Advisory height so CodeMirror reserves space before the widget is first
    // measured. Without it, measuring a tall diagram mid-scroll resizes the
    // document and kills downward scroll momentum. CodeMirror corrects this on
    // the real measure.
    get estimatedHeight() {
      const sourceHeight = (this.mermaidBlock.sourceLineCount || 1) * 20;
      return getMermaidPreviewHeight(
        sourceHeight,
        this.previewSize,
        this.mermaidBlock.code,
      );
    }
  
    toDOM(view) {
      const wrapper = document.createElement("div");
      wrapper.className = `cm-mermaid-preview is-${this.previewSize}`;
      wrapper.setAttribute("role", "button");
      wrapper.setAttribute("tabindex", "0");
      wrapper.title = "Click to edit Mermaid diagram";
      let viewportController = null;
      const lineHeight = getEditorLineHeight(view);
      const sourceHeight = this.mermaidBlock.sourceLineCount * lineHeight;
      wrapper.style.setProperty(
        "--mermaid-source-height",
        `${getMermaidPreviewHeight(
          sourceHeight,
          this.previewSize,
          this.mermaidBlock.code,
        )}px`,
      );
  
      const toolbar = createMermaidPreviewToolbar({
        onZoomOut: () => viewportController?.zoomBy(0.82),
        onZoomIn: () => viewportController?.zoomBy(1.22),
        onFit: () => viewportController?.fit(),
        onOpen: () => {
          if (this.svgMarkup) {
            openMermaidModal(this.svgMarkup);
          }
        },
      });
  
      const output = document.createElement("div");
      output.className = "cm-mermaid-output";
  
      const status = document.createElement("div");
      status.className = "cm-mermaid-status";
      status.textContent = this.mermaidBlock.code
        ? "Rendering Mermaid..."
        : "Empty Mermaid diagram";
      output.appendChild(status);
      wrapper.appendChild(toolbar);
      wrapper.appendChild(output);
  
      wrapper.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      wrapper.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        this.focusSource(view);
      });
      wrapper.addEventListener("click", (event) => {
        if (event.defaultPrevented) {
          return;
        }
        this.focusSource(view);
      });
  
      if (this.mermaidBlock.code) {
        this.render(output, view, (controller) => {
          viewportController = controller;
        });
      }
  
      return wrapper;
    }
  
    async render(output, view, setController) {
      try {
        const mermaid = await loadMermaid();
        const id = `richdown-mermaid-${this.mermaidBlock.from}-${Math.random()
          .toString(36)
          .slice(2)}`;
        const result = await mermaid.render(id, this.mermaidBlock.code);
        this.svgMarkup = result.svg;
        const { canvas, stage } = createMermaidCanvas(result.svg, "cm-mermaid");
        output.replaceChildren(canvas);
        if (typeof result.bindFunctions === "function") {
          result.bindFunctions(stage);
        }
        const controller = new MermaidViewportController(canvas, stage, {
          maxScale: 6,
          fitMaxScale: 1,
          scrollable: true,
        });
        setController(controller);
        controller.fit();
        requestEditorMeasure(view);
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        const pre = document.createElement("pre");
        pre.className = "cm-mermaid-error";
        pre.textContent = message;
        output.replaceChildren(pre);
        requestEditorMeasure(view);
      }
    }
  
    focusSource(view) {
      const anchor = Math.min(
        view.state.doc.length,
        this.mermaidBlock.from + "```mermaid\n".length,
      );
      view.dispatch({
        effects: setActiveMermaidEdit.of({
          from: this.mermaidBlock.from,
          to: this.mermaidBlock.sourceTo,
        }),
        selection: { anchor },
        scrollIntoView: true,
      });
      view.focus();
    }
  
    ignoreEvent() {
      return false;
    }
  }
  
  function createMermaidPreviewToolbar(actions) {
    const toolbar = document.createElement("div");
    toolbar.className = "cm-mermaid-toolbar";
    toolbar.addEventListener("mousedown", stopInteractiveEvent);
    toolbar.addEventListener("click", stopInteractiveEvent);
  
    toolbar.appendChild(
      createMermaidToolButton("-", "Zoom out", actions.onZoomOut),
    );
    toolbar.appendChild(
      createMermaidToolButton("+", "Zoom in", actions.onZoomIn),
    );
    toolbar.appendChild(createMermaidToolButton("Fit", "Fit diagram", actions.onFit));
    toolbar.appendChild(
      createMermaidToolButton("□", "Open diagram", actions.onOpen),
    );
    return toolbar;
  }
  
  function createMermaidToolButton(label, title, action, className = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cm-mermaid-tool-button${className ? ` ${className}` : ""}`;
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("mousedown", stopInteractiveEvent);
    button.addEventListener("click", (event) => {
      stopInteractiveEvent(event);
      action();
    });
    return button;
  }
  
  function stopInteractiveEvent(event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  function createMermaidCanvas(svgMarkup, classPrefix) {
    const canvas = document.createElement("div");
    canvas.className = `${classPrefix}-canvas`;
  
    const stage = document.createElement("div");
    stage.className = `${classPrefix}-stage`;
    stage.innerHTML = svgMarkup;
  
    const svg = stage.querySelector("svg");
    const size = getSvgNaturalSize(svg);
    stage.style.width = `${size.width}px`;
    stage.style.height = `${size.height}px`;
    if (svg) {
      svg.style.maxWidth = "none";
      svg.style.maxHeight = "none";
      svg.style.width = "100%";
      svg.style.height = "100%";
    }
  
    canvas.appendChild(stage);
    return { canvas, stage };
  }
  
  function getSvgNaturalSize(svg) {
    if (!svg) {
      return { width: 800, height: 480 };
    }
  
    const viewBox = svg.viewBox && svg.viewBox.baseVal;
    if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
      return { width: viewBox.width, height: viewBox.height };
    }
  
    const width = parseSvgLength(svg.getAttribute("width"));
    const height = parseSvgLength(svg.getAttribute("height"));
    if (width > 0 && height > 0) {
      return { width, height };
    }
  
    return { width: 800, height: 480 };
  }
  
  function parseSvgLength(value) {
    if (!value) {
      return 0;
    }
    const parsed = Number.parseFloat(String(value).replace("px", ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  
  class MermaidViewportController {
    constructor(container, stage, options = {}) {
      this.container = container;
      this.stage = stage;
      this.scale = 1;
      this.panX = 0;
      this.panY = 0;
      this.minScale = options.minScale ?? 0.08;
      this.maxScale = options.maxScale ?? 8;
      this.fitMaxScale = options.fitMaxScale ?? 2;
      this.scrollable = options.scrollable === true;
      this.dragging = false;
  
      const width = parseSvgLength(stage.style.width);
      const height = parseSvgLength(stage.style.height);
      this.naturalWidth = width || 800;
      this.naturalHeight = height || 480;
  
      if (options.enableMouse) {
        this.bindMouse();
      }
  
      window.setTimeout(() => this.fit(), 0);
    }
  
    fit() {
      const bounds = this.container.getBoundingClientRect();
      const scale = Math.min(
        bounds.width / this.naturalWidth,
        bounds.height / this.naturalHeight,
        this.fitMaxScale,
      );
      this.scale = clamp(scale || 1, this.minScale, this.maxScale);
      if (this.scrollable) {
        this.apply();
        this.container.scrollLeft = 0;
        this.container.scrollTop = 0;
        return;
      }
      this.panX = (bounds.width - this.naturalWidth * this.scale) / 2;
      this.panY = (bounds.height - this.naturalHeight * this.scale) / 2;
      this.apply();
    }
  
    zoomBy(factor, center) {
      const bounds = this.container.getBoundingClientRect();
      if (this.scrollable) {
        const anchor = center || {
          x: bounds.width / 2,
          y: bounds.height / 2,
        };
        const centerX = this.container.scrollLeft + anchor.x;
        const centerY = this.container.scrollTop + anchor.y;
        const nextScale = clamp(
          this.scale * factor,
          this.minScale,
          this.maxScale,
        );
        const ratio = nextScale / this.scale;
        this.scale = nextScale;
        this.apply();
        this.container.scrollLeft = centerX * ratio - anchor.x;
        this.container.scrollTop = centerY * ratio - anchor.y;
        return;
      }
      const anchor = center || {
        x: bounds.width / 2,
        y: bounds.height / 2,
      };
      const nextScale = clamp(
        this.scale * factor,
        this.minScale,
        this.maxScale,
      );
      const ratio = nextScale / this.scale;
      this.panX = anchor.x - (anchor.x - this.panX) * ratio;
      this.panY = anchor.y - (anchor.y - this.panY) * ratio;
      this.scale = nextScale;
      this.apply();
    }
  
    panBy(dx, dy) {
      if (this.scrollable) {
        this.container.scrollLeft -= dx;
        this.container.scrollTop -= dy;
        return;
      }
      this.panX += dx;
      this.panY += dy;
      this.apply();
    }
  
    apply() {
      if (this.scrollable) {
        const width = this.naturalWidth * this.scale;
        const height = this.naturalHeight * this.scale;
        this.stage.style.width = `${width}px`;
        this.stage.style.height = `${height}px`;
        this.stage.style.left = `${Math.max(
          0,
          (this.container.clientWidth - width) / 2,
        )}px`;
        this.stage.style.top = `${Math.max(
          0,
          (this.container.clientHeight - height) / 2,
        )}px`;
        this.stage.style.transform = "none";
        return;
      }
      this.stage.style.width = `${this.naturalWidth}px`;
      this.stage.style.height = `${this.naturalHeight}px`;
      this.stage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
  
    bindMouse() {
      this.container.addEventListener("wheel", (event) => {
        event.preventDefault();
        const bounds = this.container.getBoundingClientRect();
        const factor = event.deltaY < 0 ? 1.12 : 0.89;
        this.zoomBy(factor, {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        });
      });
  
      this.container.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        this.dragging = true;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
        this.container.classList.add("is-dragging");
        this.container.setPointerCapture(event.pointerId);
      });
  
      this.container.addEventListener("pointermove", (event) => {
        if (!this.dragging) {
          return;
        }
        event.preventDefault();
        this.panBy(event.clientX - this.lastX, event.clientY - this.lastY);
        this.lastX = event.clientX;
        this.lastY = event.clientY;
      });
  
      const stopDrag = (event) => {
        if (!this.dragging) {
          return;
        }
        this.dragging = false;
        this.container.classList.remove("is-dragging");
        if (event.pointerId !== undefined) {
          this.container.releasePointerCapture(event.pointerId);
        }
      };
      this.container.addEventListener("pointerup", stopDrag);
      this.container.addEventListener("pointercancel", stopDrag);
    }
  }
  
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  
  function openMermaidModal(svgMarkup) {
    document.querySelector(".cm-mermaid-modal-backdrop")?.remove();
  
    const backdrop = document.createElement("div");
    backdrop.className = "cm-mermaid-modal-backdrop";
  
    const modal = document.createElement("div");
    modal.className = "cm-mermaid-modal";
  
    const toolbar = document.createElement("div");
    toolbar.className = "cm-mermaid-modal-toolbar";
  
    const title = document.createElement("div");
    title.className = "cm-mermaid-modal-title";
    title.textContent = "Mermaid diagram";
  
    const controls = document.createElement("div");
    controls.className = "cm-mermaid-modal-controls";
  
    const { canvas, stage } = createMermaidCanvas(svgMarkup, "cm-mermaid-modal");
    const controller = new MermaidViewportController(canvas, stage, {
      maxScale: 10,
      fitMaxScale: 2,
      enableMouse: true,
    });
  
    const close = () => backdrop.remove();
    const buttons = [
      ["-", "Zoom out", () => controller.zoomBy(0.82)],
      ["+", "Zoom in", () => controller.zoomBy(1.22)],
      ["Fit", "Fit diagram", () => controller.fit()],
      ["←", "Move left", () => controller.panBy(-80, 0)],
      ["↑", "Move up", () => controller.panBy(0, -80)],
      ["↓", "Move down", () => controller.panBy(0, 80)],
      ["→", "Move right", () => controller.panBy(80, 0)],
      ["×", "Close", close],
    ];
    for (const [label, buttonTitle, action] of buttons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cm-mermaid-modal-button";
      button.textContent = label;
      button.title = buttonTitle;
      button.setAttribute("aria-label", buttonTitle);
      button.addEventListener("click", (event) => {
        stopInteractiveEvent(event);
        action();
      });
      controls.appendChild(button);
    }
  
    toolbar.appendChild(title);
    toolbar.appendChild(controls);
    modal.appendChild(toolbar);
    modal.appendChild(canvas);
    backdrop.appendChild(modal);
  
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) {
        close();
      }
    });
    window.addEventListener(
      "keydown",
      function closeOnEscape(event) {
        if (event.key !== "Escape") {
          return;
        }
        close();
        window.removeEventListener("keydown", closeOnEscape, true);
      },
      true,
    );
  
    document.body.appendChild(backdrop);
    window.setTimeout(() => controller.fit(), 0);
  }
  
  function getEditorLineHeight(view) {
    const style = getComputedStyle(view.contentDOM);
    const lineHeight = Number.parseFloat(style.lineHeight);
    if (Number.isFinite(lineHeight)) {
      return lineHeight;
    }
  
    const fontSize = Number.parseFloat(style.fontSize);
    return Number.isFinite(fontSize) ? fontSize * 1.72 : 25.8;
  }
  
  function requestEditorMeasure(view) {
    if (view && typeof view.requestMeasure === "function") {
      view.requestMeasure();
    }
  }
  
  function getMermaidPreviewHeight(sourceHeight, previewSize, code = "") {
    if (previewSize === "source") {
      return sourceHeight;
    }
    if (previewSize === "large") {
      return Math.max(sourceHeight, estimateLargeMermaidPreviewHeight(code));
    }
    return Math.max(sourceHeight, 260);
  }
  
  function estimateLargeMermaidPreviewHeight(code) {
    const lines = code.split(/\r?\n/).filter((line) => line.trim());
    const nodeLikeLines = lines.filter((line) =>
      /(?:-->|---|==>|-.->|::|subgraph\b|\w+\s*(?:\[|\(|\{|\>))/i.test(line),
    ).length;
    const complexity = Math.max(lines.length, nodeLikeLines);
    return Math.max(320, Math.min(620, 260 + complexity * 18));
  }
  
  function loadMermaid() {
    if (window.__richdownMermaid) {
      return Promise.resolve(window.__richdownMermaid);
    }

    if (!mermaidLoadPromise) {
      // Cache the script load promise so multiple visible diagrams do not append
      // duplicate Mermaid loader scripts to the webview.
      mermaidLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = mermaidScriptUri;
        script.onload = () => {
          const mermaid = window.__richdownMermaid;
          if (!mermaid) {
            reject(new Error("Mermaid loader did not expose Mermaid."));
            return;
          }
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: document.documentElement.dataset.richTheme === "default"
              ? "default"
              : "dark",
          });
          resolve(mermaid);
        };
        script.onerror = () => {
          reject(new Error("Failed to load Mermaid renderer."));
        };
        document.head.appendChild(script);
      });
    }
  
    return mermaidLoadPromise;
  }

  return MermaidPreviewWidget;
}
