import { EditorView } from "@codemirror/view";
import {
  isMatchingMarkdownCodeFenceClosing,
  parseMarkdownCodeFenceOpening,
} from "../../domain/markdownBlocks.js";

export function createOutlineNavigation() {
  let outlineRoot = null;
  let outlineButton = null;
  let outlinePanel = null;
  let outlineList = null;
  let outlineHeadings = [];

  function render(editorView) {
    if (outlineRoot) {
      update(editorView, { rebuild: true });
      return;
    }

    outlineRoot = document.createElement("div");
    outlineRoot.className = "richdown-outline-root";

    outlineButton = document.createElement("button");
    outlineButton.type = "button";
    outlineButton.className = "richdown-outline-button";
    outlineButton.title = "Document sections";
    outlineButton.setAttribute("aria-label", "Document sections");
    outlineButton.textContent = "☰";
    outlineButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    });
    outlineButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    outlinePanel = document.createElement("nav");
    outlinePanel.className = "richdown-outline-panel";
    outlinePanel.hidden = true;
    outlinePanel.setAttribute("aria-label", "Document sections");
    outlinePanel.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    outlinePanel.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    const title = document.createElement("div");
    title.className = "richdown-outline-title";
    title.textContent = "Sections";
    outlineList = document.createElement("div");
    outlineList.className = "richdown-outline-list";

    outlinePanel.appendChild(title);
    outlinePanel.appendChild(outlineList);
    outlineRoot.appendChild(outlinePanel);
    outlineRoot.appendChild(outlineButton);
    document.body.appendChild(outlineRoot);

    update(editorView, { rebuild: true });
  }

  function sync(updateInfo) {
    if (!outlineRoot) {
      return;
    }
    if (updateInfo.docChanged) {
      update(updateInfo.view, { rebuild: true });
      return;
    }
    if (updateInfo.selectionSet || updateInfo.viewportChanged) {
      update(updateInfo.view);
    }
  }

  function toggle() {
    if (!outlineRoot || !outlinePanel) {
      return;
    }
    const nextOpen = outlinePanel.hidden;
    outlinePanel.hidden = !nextOpen;
    outlineRoot.classList.toggle("is-open", nextOpen);
  }

  function close() {
    if (!outlineRoot || !outlinePanel || outlinePanel.hidden) {
      return false;
    }
    outlinePanel.hidden = true;
    outlineRoot.classList.remove("is-open");
    return true;
  }

  function update(editorView, options = {}) {
    if (!outlineList) {
      return;
    }
    if (options.rebuild) {
      outlineHeadings = collectDocumentHeadings(editorView.state.doc);
      outlineList.replaceChildren(
        ...(outlineHeadings.length
          ? outlineHeadings.map((heading, index) =>
              createOutlineItem(editorView, heading, index),
            )
          : [createOutlineEmptyState()]),
      );
    }
    updateActiveItem(editorView);
  }

  function createOutlineItem(editorView, heading, index) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "richdown-outline-item";
    item.dataset.headingIndex = String(index);
    item.title = heading.text;
    item.style.paddingLeft = `${7 + Math.max(0, heading.level - 2) * 12}px`;

    const level = document.createElement("span");
    level.className = "richdown-outline-level";
    level.textContent = `H${heading.level}`;

    const text = document.createElement("span");
    text.className = "richdown-outline-text";
    text.textContent = heading.text;

    item.appendChild(level);
    item.appendChild(text);
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      jumpToHeading(editorView, heading);
    });
    return item;
  }

  function jumpToHeading(editorView, heading) {
    const anchor = Math.min(heading.from, editorView.state.doc.length);
    editorView.dispatch({
      selection: { anchor },
      effects: EditorView.scrollIntoView(anchor, { y: "start", yMargin: 0 }),
    });
    editorView.focus();
    close();
  }

  function updateActiveItem(editorView) {
    if (!outlineList || outlineHeadings.length === 0) {
      return;
    }
    const position = editorView.state.selection.main.from;
    let activeIndex = -1;
    for (let index = 0; index < outlineHeadings.length; index += 1) {
      if (outlineHeadings[index].from <= position) {
        activeIndex = index;
      } else {
        break;
      }
    }

    for (const item of outlineList.querySelectorAll(".richdown-outline-item")) {
      const isActive =
        Number.parseInt(item.dataset.headingIndex || "-1", 10) === activeIndex;
      item.classList.toggle("is-active", isActive);
      if (isActive) {
        item.scrollIntoView({ block: "nearest" });
      }
    }
  }

  return { close, render, sync };
}

function createOutlineEmptyState() {
  const empty = document.createElement("div");
  empty.className = "richdown-outline-empty";
  empty.textContent = "No sections";
  return empty;
}

function collectDocumentHeadings(doc) {
  const headings = [];
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber);
    if (inFence) {
      if (
        isMatchingMarkdownCodeFenceClosing(line.text, {
          char: fenceChar,
          length: fenceLength,
        })
      ) {
        inFence = false;
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }

    const fence = parseMarkdownCodeFenceOpening(line.text);
    if (fence) {
      inFence = true;
      fenceChar = fence.char;
      fenceLength = fence.length;
      continue;
    }

    const heading = line.text.match(/^\s{0,3}(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!heading) {
      continue;
    }
    headings.push({
      from: line.from,
      level: heading[1].length,
      text: cleanOutlineHeadingText(heading[2]),
    });
  }

  return headings;
}

function cleanOutlineHeadingText(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}
