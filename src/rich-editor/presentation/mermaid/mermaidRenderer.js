// Shared Mermaid rendering pieces.
//
// The inline preview, the inline live editor, and the editor modal all draw
// diagrams through one lazily loaded Mermaid bundle. This module owns that
// loader, the Richdown palette, SVG sizing, and the pan/zoom controller so the
// three surfaces render and behave identically.

export function createMermaidRenderer({ mermaidScriptUri }) {
  let mermaidLoadPromise = null;

  function load() {
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
          mermaid.initialize(getMermaidConfig(true));
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

  async function render(code, { colorized = true, idPrefix = "richdown-mermaid" } = {}) {
    const mermaid = await load();
    mermaid.initialize(getMermaidConfig(colorized));
    const renderId = `${idPrefix}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await mermaid.render(renderId, code);
      return { svg: result.svg, bindFunctions: result.bindFunctions, renderId };
    } finally {
      // A failed render can leave Mermaid's scratch container (and its error
      // graphic) attached to <body>.
      document.getElementById(`d${renderId}`)?.remove();
    }
  }

  return { load, render };
}

export function stopInteractiveEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Puts rendered SVG markup into `stage`, sized to the diagram's natural size.
export function installMermaidSvg(stage, svgMarkup, colorized = true) {
  stage.innerHTML = svgMarkup;
  const svg = stage.querySelector("svg");
  if (colorized) {
    colorizeMermaidSvg(svg);
  }
  const size = getSvgNaturalSize(svg);
  stage.style.width = `${size.width}px`;
  stage.style.height = `${size.height}px`;
  if (svg) {
    svg.style.maxWidth = "none";
    svg.style.maxHeight = "none";
    svg.style.width = "100%";
    svg.style.height = "100%";
  }
  return { svg, size };
}

export function createMermaidCanvas(svgMarkup, classPrefix, colorized = true) {
  const canvas = document.createElement("div");
  canvas.className = `${classPrefix}-canvas`;

  const stage = document.createElement("div");
  stage.className = `${classPrefix}-stage`;
  const { size } = installMermaidSvg(stage, svgMarkup, colorized);

  canvas.appendChild(stage);
  return {
    canvas,
    stage,
    svgMarkup: stage.innerHTML,
    naturalSize: size,
  };
}

export function colorizeMermaidSvg(svg) {
  if (!svg || svg.querySelector("style[data-richdown-mermaid]")) {
    return;
  }
  svg.setAttribute("data-richdown-colorized", "true");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.setAttribute("data-richdown-mermaid", "true");
  style.textContent = getMermaidSvgPaletteCss();
  svg.insertBefore(style, svg.firstChild);
}

function getMermaidSvgPaletteCss() {
  return `
    .node:nth-of-type(6n+1) rect,
    .node:nth-of-type(6n+1) polygon,
    .node:nth-of-type(6n+1) circle,
    .node:nth-of-type(6n+1) ellipse { fill: #dbeafe !important; stroke: #2563eb !important; }
    .node:nth-of-type(6n+2) rect,
    .node:nth-of-type(6n+2) polygon,
    .node:nth-of-type(6n+2) circle,
    .node:nth-of-type(6n+2) ellipse { fill: #dcfce7 !important; stroke: #16a34a !important; }
    .node:nth-of-type(6n+3) rect,
    .node:nth-of-type(6n+3) polygon,
    .node:nth-of-type(6n+3) circle,
    .node:nth-of-type(6n+3) ellipse { fill: #fef3c7 !important; stroke: #d97706 !important; }
    .node:nth-of-type(6n+4) rect,
    .node:nth-of-type(6n+4) polygon,
    .node:nth-of-type(6n+4) circle,
    .node:nth-of-type(6n+4) ellipse { fill: #fce7f3 !important; stroke: #db2777 !important; }
    .node:nth-of-type(6n+5) rect,
    .node:nth-of-type(6n+5) polygon,
    .node:nth-of-type(6n+5) circle,
    .node:nth-of-type(6n+5) ellipse { fill: #ede9fe !important; stroke: #7c3aed !important; }
    .node:nth-of-type(6n) rect,
    .node:nth-of-type(6n) polygon,
    .node:nth-of-type(6n) circle,
    .node:nth-of-type(6n) ellipse { fill: #ccfbf1 !important; stroke: #0f766e !important; }
    .node rect,
    .node polygon,
    .node circle,
    .node ellipse,
    .classGroup rect,
    .stateGroup rect { stroke-width: 1.5px !important; }
    .cluster rect { fill: #f8fafc !important; stroke: #94a3b8 !important; stroke-width: 1.4px !important; stroke-dasharray: 5 4 !important; }
    .edgeLabel rect,
    .labelBkg { fill: #f8fafc !important; opacity: 0.96 !important; }
    .edgePath .path,
    .flowchart-link,
    .messageLine0,
    .messageLine1,
    .transition { stroke: #64748b !important; stroke-width: 1.5px !important; }
    marker path { fill: #64748b !important; stroke: #64748b !important; }
    .actor,
    .participant rect { fill: #dbeafe !important; stroke: #2563eb !important; }
    .activation0,
    .activation1,
    .activation2 { fill: #fef3c7 !important; stroke: #d97706 !important; }
    .note { fill: #fef3c7 !important; stroke: #d97706 !important; }
    text,
    .label,
    .nodeLabel,
    .edgeLabel,
    .cluster-label,
    .messageText,
    .actor > text { fill: #172033 !important; color: #172033 !important; }
  `;
}

export function getSvgNaturalSize(svg) {
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

export function parseSvgLength(value) {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(String(value).replace("px", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export class MermaidViewportController {
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
    // "always" zooms on every wheel event; "modifier" leaves plain wheel
    // scrolling to the page so an inline editor does not trap the document.
    this.wheelZoom = options.wheelZoom ?? "always";
    this.canStartPan = options.canStartPan ?? (() => true);
    this.onUserZoom = options.onUserZoom ?? (() => {});
    this.dragging = false;
    this.moved = false;
    this.captured = false;

    const width = parseSvgLength(stage.style.width);
    const height = parseSvgLength(stage.style.height);
    this.naturalWidth = width || 800;
    this.naturalHeight = height || 480;

    if (options.enableMouse) {
      this.bindMouse();
    }

    window.setTimeout(() => this.fit(), 0);
  }

  setNaturalSize(width, height) {
    this.naturalWidth = width || 800;
    this.naturalHeight = height || 480;
    this.apply();
  }

  fit() {
    const bounds = this.container.getBoundingClientRect();
    const scale = Math.min(
      bounds.width / this.naturalWidth,
      bounds.height / this.naturalHeight,
      this.fitMaxScale,
    );
    // Fit must always show the whole diagram. Very wide diagrams need scales
    // below minScale, which only bounds manual zoom-out; clamping the fit
    // scale there would draw the diagram wider than the preview box.
    this.scale =
      scale > 0 && Number.isFinite(scale)
        ? Math.min(scale, this.maxScale)
        : 1;
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
        // Fitting a very wide diagram can land below minScale; never let a
        // zoom-out request bounce the scale back up to minScale.
        Math.min(this.minScale, this.scale),
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
      Math.min(this.minScale, this.scale),
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
      if (
        this.wheelZoom === "modifier" &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return;
      }
      event.preventDefault();
      const bounds = this.container.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.12 : 0.89;
      this.zoomBy(factor, {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      this.onUserZoom();
    });

    this.container.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !this.canStartPan(event)) {
        return;
      }
      event.preventDefault();
      this.dragging = true;
      this.moved = false;
      this.captured = false;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.container.classList.add("is-dragging");
    });

    this.container.addEventListener("pointermove", (event) => {
      if (!this.dragging) {
        return;
      }
      event.preventDefault();
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 0) {
        this.moved = true;
        this.onUserZoom();
      }
      // Capture only once the pointer really drags: a captured pointer
      // retargets the click to the container, so a plain click would never
      // reach the button or diagram element under it.
      if (this.moved && !this.captured) {
        this.captured = true;
        this.container.setPointerCapture?.(event.pointerId);
      }
      this.panBy(dx, dy);
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });

    const stopDrag = (event) => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      this.container.classList.remove("is-dragging");
      if (this.captured && event.pointerId !== undefined) {
        this.container.releasePointerCapture?.(event.pointerId);
      }
    };
    this.container.addEventListener("pointerup", stopDrag);
    this.container.addEventListener("pointercancel", stopDrag);
  }
}

export function getMermaidConfig(colorized = true) {
  if (!colorized) {
    return {
      startOnLoad: false,
      securityLevel: "strict",
      theme:
        document.documentElement.dataset.richTheme === "default"
          ? "default"
          : "dark",
    };
  }

  return {
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      background: "transparent",
      primaryColor: "#dbeafe",
      primaryTextColor: "#172033",
      primaryBorderColor: "#2563eb",
      secondaryColor: "#dcfce7",
      secondaryTextColor: "#172033",
      secondaryBorderColor: "#16a34a",
      tertiaryColor: "#fef3c7",
      tertiaryTextColor: "#172033",
      tertiaryBorderColor: "#d97706",
      mainBkg: "#dbeafe",
      secondBkg: "#dcfce7",
      nodeBorder: "#2563eb",
      clusterBkg: "#f8fafc",
      clusterBorder: "#94a3b8",
      lineColor: "#64748b",
      edgeLabelBackground: "#f8fafc",
      textColor: "#172033",
      titleColor: "#172033",
      actorBkg: "#dbeafe",
      actorBorder: "#2563eb",
      actorTextColor: "#172033",
      actorLineColor: "#64748b",
      signalColor: "#64748b",
      signalTextColor: "#172033",
      noteBkgColor: "#fef3c7",
      noteTextColor: "#172033",
      noteBorderColor: "#d97706",
      labelBoxBkgColor: "#f8fafc",
      labelBoxBorderColor: "#94a3b8",
      labelTextColor: "#172033",
      loopTextColor: "#172033",
      stateBkg: "#dbeafe",
      stateBorder: "#2563eb",
      classText: "#172033",
      taskBkgColor: "#dbeafe",
      taskTextColor: "#172033",
      taskTextOutsideColor: "#172033",
      taskBorderColor: "#2563eb",
      activeTaskBkgColor: "#fef3c7",
      doneTaskBkgColor: "#dcfce7",
      critBkgColor: "#fee2e2",
      sectionBkgColor: "#dbeafe",
      sectionBkgColor2: "#dcfce7",
      gridColor: "#cbd5e1",
    },
  };
}
