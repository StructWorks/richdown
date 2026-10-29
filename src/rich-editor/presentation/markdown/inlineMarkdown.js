// Inline Markdown preview support.
//
// This module renders small inline constructs used inside richer previews
// (details bodies, table cells, image replacements). It intentionally covers a
// practical subset of Markdown rather than acting as a full parser.
import { WidgetType } from "@codemirror/view";
import {
  findWikilinks,
  isImageTarget,
  wikilinkHref,
} from "../../../markdown/wikilinks.js";

export function createInlineMarkdownSupport({
  postMessage,
  requestEditorMeasure,
  resolveImageSource: customResolveImageSource,
  getWikilinkStatus = () => undefined,
}) {
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
    // Underscore emphasis cannot open or close inside a word. Keeping those
    // boundaries explicit prevents identifiers such as snake_case and
    // CONFIG__VALUE from losing underscores in table/details previews.
    // A table row cannot contain a newline, so GFM tables spell line breaks
    // as <br>; render it rather than leaving the tag as literal text.
    const pattern =
      /(?<wikilink>!?\[\[[^[\]\n]+?\]\])|!\[(?<imageAlt>[^\]]*)\]\(\s*(?:<(?<imageSrcAngle>[^>]+)>|(?<imageSrc>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|`(?<code>[^`]+)`|(?<lineBreak><[Bb][Rr]\s*\/?>)|\*\*(?<boldStar>[^*]+)\*\*|(?<![\p{L}\p{N}\p{M}_])__(?<boldUnderscore>[^_\s](?:[^_]*?[^_\s])?)__(?![\p{L}\p{N}\p{M}_])|\*(?<italicStar>[^*\s][^*]*?)\*|(?<![\p{L}\p{N}\p{M}_])_(?<italicUnderscore>[^_\s](?:[^_]*?[^_\s])?)_(?![\p{L}\p{N}\p{M}_])|~~(?<strike>[^~]+)~~|\[(?<linkText>[^\]]+)\]\(\s*(?:<(?<linkHrefAngle>[^>]+)>|(?<linkHref>[^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)|(?<bareUrl>https?:\/\/[^\s)]+)/gu;
    let lastIndex = 0;
  
    for (const match of text.matchAll(pattern)) {
      const groups = match.groups || {};
      if (match.index > lastIndex) {
        parent.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index)),
        );
      }
  
      const wikilink = groups.wikilink ? findWikilinks(groups.wikilink)[0] : null;
      if (wikilink) {
        if (wikilink.embed && isImageTarget(wikilink.target) && options.renderImages) {
          parent.appendChild(
            createInlineMarkdownImage(wikilink.target, wikilink.alias, options.onImageReady, {
              wikilink: true,
              width: wikilink.width,
            }),
          );
        } else {
          parent.appendChild(createWikilinkElement(wikilink));
        }
      } else if (groups.wikilink) {
        parent.appendChild(document.createTextNode(match[0]));
      } else if (groups.imageAlt !== undefined) {
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
      } else if (groups.lineBreak !== undefined) {
        parent.appendChild(document.createElement("br"));
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
  
  function createWikilinkElement(wikilink) {
    const link = document.createElement("a");
    link.href = "#";
    link.className = wikilinkClassName(wikilink.target);
    link.textContent = wikilink.label;
    link.title = wikilinkHref(wikilink);
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      postMessage({ type: "openWikilink", href: wikilinkHref(wikilink) });
    });
    return link;
  }

  // An unresolved name gets its own look, like Obsidian's links to notes that
  // do not exist yet. Unknown (no host answered) looks like a plain link.
  function wikilinkClassName(target) {
    return getWikilinkStatus(target) === false
      ? "cm-wikilink cm-wikilink-unresolved"
      : "cm-wikilink";
  }

  function createInlineMarkdownImage(src, alt, onImageReady, imageOptions = {}) {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-inline-markdown-image";
    wrapper.title = src;
  
    const image = document.createElement("img");
    image.alt = alt || src;
    if (imageOptions.width) {
      image.style.width = `${imageOptions.width}px`;
    }
  
    const error = document.createElement("span");
    error.className = "cm-inline-markdown-image-error";
    error.hidden = true;
    error.textContent = alt || src;
  
    resolveImageSource(src, imageOptions)
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
  
  // `options.wikilink` marks an Obsidian embed, whose src is a file name for
  // the host to find; `options.width` is its "|300" size.
  class ImagePreviewWidget extends WidgetType {
    constructor(src, alt, from, options = {}) {
      super();
      this.src = src;
      this.alt = alt;
      this.from = from;
      this.wikilink = Boolean(options.wikilink);
      this.width = options.width || null;
    }
  
    eq(other) {
      return (
        other.src === this.src &&
        other.alt === this.alt &&
        other.from === this.from &&
        other.wikilink === this.wikilink &&
        other.width === this.width
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
      if (this.width) {
        image.style.width = `${this.width}px`;
      }
  
      const error = document.createElement("span");
      error.className = "cm-image-preview-error";
      error.hidden = true;
      error.textContent = `Image not found: ${this.src}`;
  
      resolveImageSource(this.src, { wikilink: this.wikilink })
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
        postMessage(
          this.wikilink
            ? { type: "openWikilink", href: this.src }
            : { type: "openLink", href: this.src },
        );
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
      if (view.state.readOnly) {
        return;
      }
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
  
  // Embeds are looked up by name: the host is asked with `wikilink: true`,
  // and an export's image map keys them as "[[name]]".
  function resolveImageSource(src, { wikilink = false } = {}) {
    if (!wikilink && /^(https?:|data:|blob:)/i.test(src)) {
      return Promise.resolve(src);
    }

    if (typeof customResolveImageSource === "function") {
      return customResolveImageSource(wikilink ? `[[${src}]]` : src);
    }
  
    const requestId = String((imageRequestId += 1));
    postMessage(
      wikilink
        ? { type: "resolveImage", requestId, src, wikilink: true }
        : { type: "resolveImage", requestId, src },
    );
  
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
    wikilinkClassName,
    handleResolvedImage,
    ImagePreviewWidget,
    isRangeInsideRanges,
  };
}
