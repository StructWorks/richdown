// Mermaid preview widget and modal viewer.
//
// Mermaid is loaded lazily because it is the heaviest browser-side dependency
// in the extension. The widget keeps diagram rendering, zoom controls, and modal
// pan/zoom behavior together so the editor entrypoint only toggles previews.
import { WidgetType } from "@codemirror/view";
import { normalizeMermaidPreviewSize } from "../../domain/settingsModel.js";
import {
  clamp,
  createMermaidCanvas,
  MermaidViewportController,
  stopInteractiveEvent,
} from "./mermaidRenderer.js";

export function createMermaidPreviewWidgetClass({
  renderer,
  setActiveMermaidEdit,
  openMermaidEditor,
}) {

  class MermaidPreviewWidget extends WidgetType {
    constructor(mermaidBlock, previewSize, colorized, revision) {
      super();
      this.mermaidBlock = mermaidBlock;
      this.previewSize = normalizeMermaidPreviewSize(previewSize);
      this.colorized = colorized !== false;
      this.revision = revision;
    }
  
    eq(other) {
      return (
        other.mermaidBlock.from === this.mermaidBlock.from &&
        other.mermaidBlock.to === this.mermaidBlock.to &&
        other.mermaidBlock.signature === this.mermaidBlock.signature &&
        other.previewSize === this.previewSize &&
        other.colorized === this.colorized &&
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
        onEdit:
          view.state.readOnly || !openMermaidEditor
            ? null
            : () => openMermaidEditor(view, this.mermaidBlock.from),
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
        this.render(wrapper, output, view, sourceHeight, (controller) => {
          viewportController = controller;
        });
      }
  
      return wrapper;
    }

    destroy() {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      if (this.resizePreview) {
        window.removeEventListener("resize", this.resizePreview);
        this.resizePreview = null;
      }
    }
  
    async render(wrapper, output, view, sourceHeight, setController) {
      try {
        const result = await renderer.render(this.mermaidBlock.code, {
          colorized: this.colorized,
          idPrefix: `richdown-mermaid-${this.mermaidBlock.from}`,
        });
        const { canvas, stage, svgMarkup, naturalSize } = createMermaidCanvas(
          result.svg,
          "cm-mermaid",
          this.colorized,
        );
        this.svgMarkup = svgMarkup;
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
        let measuredWidth = 0;
        let measuredViewportHeight = 0;
        const resizePreview = () => {
          const width = wrapper.getBoundingClientRect().width;
          const viewportHeight = window.innerHeight || 0;
          if (
            width <= 0 ||
            (Math.abs(width - measuredWidth) < 1 &&
              Math.abs(viewportHeight - measuredViewportHeight) < 1)
          ) {
            return;
          }
          measuredWidth = width;
          measuredViewportHeight = viewportHeight;
          wrapper.style.setProperty(
            "--mermaid-source-height",
            `${getResponsiveMermaidPreviewHeight({
              sourceHeight,
              previewSize: this.previewSize,
              naturalWidth: naturalSize.width,
              naturalHeight: naturalSize.height,
              containerWidth: width,
            })}px`,
          );
          window.requestAnimationFrame(() => {
            controller.fit();
            requestEditorMeasure(view);
          });
        };
        resizePreview();
        if (typeof ResizeObserver === "function") {
          this.resizeObserver?.disconnect();
          this.resizeObserver = new ResizeObserver(resizePreview);
          this.resizeObserver.observe(wrapper);
        }
        if (this.resizePreview) {
          window.removeEventListener("resize", this.resizePreview);
        }
        this.resizePreview = resizePreview;
        window.addEventListener("resize", resizePreview);
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
      if (view.state.readOnly) {
        return;
      }
      const openingLine = view.state.doc.lineAt(this.mermaidBlock.from);
      const anchor = Math.min(
        view.state.doc.length,
        openingLine.to + 1,
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
    if (actions.onEdit) {
      toolbar.appendChild(
        createMermaidToolButton("✎", "Edit diagram", actions.onEdit),
      );
    }
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
  
    const { canvas, stage } = createMermaidCanvas(
      svgMarkup,
      "cm-mermaid-modal",
      false,
    );
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

  function getResponsiveMermaidPreviewHeight({
    sourceHeight,
    previewSize,
    naturalWidth,
    naturalHeight,
    containerWidth,
  }) {
    if (previewSize === "source") {
      return sourceHeight;
    }

    const viewportHeight = Math.max(window.innerHeight || 0, 600);
    const availableWidth = Math.max(240, containerWidth - 22);
    const width = Math.max(1, naturalWidth);
    const height = Math.max(1, naturalHeight);
    const fittedHeight = height * Math.min(1, availableWidth / width);
    const isLarge = previewSize === "large";
    const minimumHeight = isLarge ? 280 : 140;
    const maximumHeight = isLarge
      ? clamp(viewportHeight * 1.15, 760, 1200)
      : clamp(viewportHeight * 0.82, 560, 900);
    return Math.round(
      clamp(fittedHeight + 22, minimumHeight, maximumHeight),
    );
  }
  
  function estimateLargeMermaidPreviewHeight(code) {
    const lines = code.split(/\r?\n/).filter((line) => line.trim());
    const nodeLikeLines = lines.filter((line) =>
      /(?:-->|---|==>|-.->|::|subgraph\b|\w+\s*(?:\[|\(|\{|>))/i.test(line),
    ).length;
    const complexity = Math.max(lines.length, nodeLikeLines);
    return Math.max(320, Math.min(620, 260 + complexity * 18));
  }
  
  return MermaidPreviewWidget;
}
