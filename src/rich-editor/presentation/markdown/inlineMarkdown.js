// Inline Markdown preview support.
//
// This module renders small inline constructs used inside richer previews
// (details bodies, table cells, image replacements). It intentionally covers a
// practical subset of Markdown rather than acting as a full parser.
import { WidgetType } from "@codemirror/view";

export function createInlineMarkdownSupport({ postMessage, requestEditorMeasure }) {
  let imageRequestId = 0;
  const pendingImageRequests = new Map();

  function handleResolvedImage(message) {
    const pending = pendingImageRequests.get(message.requestId);
    if (!pending) {
      return false;
    }

    window.clearTimeout(pending.timeout);
    pendingImageRequests.delete(message.requestId);
    if (message.uri) {
      pending.resolve(message.uri);
    } else {
      pending.reject(new Error("Image could not be resolved."));
    }
    return true;
  }

  function appendInlineMarkdown(parent, text, options = {}) {
    // A small token scanner is enough here because the editor source remains the
    // canonical Markdown. Full document parsing is handled elsewhere by
    // CodeMirror/Lezer.
    const pattern =
      /!\[(?<imageAlt>[^\]]*)\]\(\s*(?:<(?<imageSrcAngle>[^>]+)>|(?<imageSrc>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|`(?<code>[^`]+)`|\*\*(?<boldStar>[^*]+)\*\*|__(?<boldUnderscore>[^_]+)__|\*(?<italicStar>[^*\s][^*]*?)\*|_(?<italicUnderscore>[^_\s][^_]*?)_|~~(?<strike>[^~]+)~~|\[(?<linkText>[^\]]+)\]\(\s*(?:<(?<linkHrefAngle>[^>]+)>|(?<linkHref>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|(?<bareUrl>https?:\/\/[^\s)]+)/g;
    let lastIndex = 0;
  
    for (const match of text.matchAll(pattern)) {
      const groups = match.groups || {};
      if (match.index > lastIndex) {
        parent.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index)),
        );
      }
  
      if (groups.imageAlt !== undefined) {
        const src = groups.imageSrcAngle || groups.imageSrc || "";
        if (options.renderImages) {
          parent.appendChild(
            createInlineMarkdownImage(src, groups.imageAlt, options.onImageReady),
          );
        } else {
          parent.appendChild(document.createTextNode(match[0]));
        }
      } else if (groups.code !== undefined) {
        const code = document.createElement("code");
        code.textContent = groups.code;
        parent.appendChild(code);
      } else if (
        groups.boldStar !== undefined ||
        groups.boldUnderscore !== undefined
      ) {
        const strong = document.createElement("strong");
        strong.textContent = groups.boldStar ?? groups.boldUnderscore;
        parent.appendChild(strong);
      } else if (
        groups.italicStar !== undefined ||
        groups.italicUnderscore !== undefined
      ) {
        const emphasis = document.createElement("em");
        emphasis.textContent = groups.italicStar ?? groups.italicUnderscore;
        parent.appendChild(emphasis);
      } else if (groups.strike !== undefined) {
        const strike = document.createElement("s");
        strike.textContent = groups.strike;
        parent.appendChild(strike);
      } else if (groups.linkText !== undefined || groups.bareUrl !== undefined) {
        const href =
          groups.bareUrl || groups.linkHrefAngle || groups.linkHref || "";
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = groups.linkText || href;
        link.title = href;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          postMessage({ type: "openLink", href });
        });
        parent.appendChild(link);
      }
  
      lastIndex = match.index + match[0].length;
    }
  
    if (lastIndex < text.length) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
  }
  
  function createInlineMarkdownImage(src, alt, onImageReady) {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-inline-markdown-image";
    wrapper.title = src;
  
    const image = document.createElement("img");
    image.alt = alt || src;
  
    const error = document.createElement("span");
    error.className = "cm-inline-markdown-image-error";
    error.hidden = true;
    error.textContent = alt || src;
  
    resolveImageSource(src)
      .then((uri) => {
        image.src = uri;
        onImageReady?.();
      })
      .catch(() => {
        image.remove();
        error.hidden = false;
        onImageReady?.();
      });
  
    image.addEventListener("load", () => {
      onImageReady?.();
    });
    image.addEventListener("error", () => {
      image.remove();
      error.hidden = false;
      onImageReady?.();
    });
    image.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      postMessage({ type: "openLink", href: src });
    });
  
    wrapper.appendChild(image);
    wrapper.appendChild(error);
    return wrapper;
  }
  
  function findMarkdownImages(text) {
    const images = [];
    const pattern =
      /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
  
    for (const match of text.matchAll(pattern)) {
      images.push({
        from: match.index,
        to: match.index + match[0].length,
        alt: match[1] || "",
        src: match[2] || match[3] || "",
      });
    }
  
    return images;
  }
  
  function isRangeInsideRanges(from, to, ranges) {
    return ranges.some((range) => from >= range.from && to <= range.to);
  }
  
  class ImagePreviewWidget extends WidgetType {
    constructor(src, alt, from) {
      super();
      this.src = src;
      this.alt = alt;
      this.from = from;
    }
  
    eq(other) {
      return (
        other.src === this.src &&
        other.alt === this.alt &&
        other.from === this.from
      );
    }

    // The real image height isn't known until it loads, so reserve a nominal
    // block. This advisory value reduces (not eliminates) scroll jump; the
    // load handler re-measures once the image arrives.
    get estimatedHeight() {
      return 240;
    }
  
    toDOM(view) {
      const wrapper = document.createElement("span");
      wrapper.className = "cm-image-preview";
      wrapper.title = this.src;
  
      const image = document.createElement("img");
      image.alt = this.alt || this.src;
  
      const error = document.createElement("span");
      error.className = "cm-image-preview-error";
      error.hidden = true;
      error.textContent = `Image not found: ${this.src}`;
  
      resolveImageSource(this.src)
        .then((uri) => {
          image.src = uri;
          requestEditorMeasure(view);
        })
        .catch(() => {
          image.remove();
          error.hidden = false;
          requestEditorMeasure(view);
        });
  
      image.addEventListener("error", () => {
        image.remove();
        error.hidden = false;
        requestEditorMeasure(view);
      });
      image.addEventListener("load", () => {
        requestEditorMeasure(view);
      });
      image.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        postMessage({ type: "openLink", href: this.src });
      });
  
      wrapper.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      wrapper.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.focusSource(view);
      });
  
      wrapper.appendChild(image);
      wrapper.appendChild(error);
      if (this.alt) {
        const caption = document.createElement("span");
        caption.className = "cm-image-preview-caption";
        caption.textContent = this.alt;
        wrapper.appendChild(caption);
      }
      return wrapper;
    }
  
    focusSource(view) {
      view.dispatch({
        selection: { anchor: Math.min(this.from, view.state.doc.length) },
        scrollIntoView: true,
      });
      view.focus();
    }
  
    ignoreEvent() {
      return false;
    }
  }
  
  function resolveImageSource(src) {
    if (/^(https?:|data:|blob:)/i.test(src)) {
      return Promise.resolve(src);
    }
  
    const requestId = String((imageRequestId += 1));
    postMessage({ type: "resolveImage", requestId, src });
  
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pendingImageRequests.delete(requestId);
        reject(new Error("Timed out resolving image."));
      }, 5000);
      pendingImageRequests.set(requestId, {
        resolve,
        reject,
        timeout,
      });
    });
  }

  return {
    appendInlineMarkdown,
    findMarkdownImages,
    handleResolvedImage,
    ImagePreviewWidget,
    isRangeInsideRanges,
  };
}
