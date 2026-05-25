export function createFallbackEditor({ root, postMessage }) {
  let textarea = null;
  let applyingExternalUpdate = false;

  function render(text) {
    root.replaceChildren();

    const container = document.createElement("div");
    container.className = "richdown-fallback";

    const banner = document.createElement("div");
    banner.className = "richdown-fallback-banner";
    banner.textContent =
      "Rich preview could not start, so this file is open in plain Markdown mode.";

    textarea = document.createElement("textarea");
    textarea.className = "richdown-fallback-editor";
    textarea.value = text;
    textarea.spellcheck = true;
    textarea.addEventListener("input", () => {
      if (applyingExternalUpdate) {
        return;
      }
      postMessage({
        type: "edit",
        text: textarea.value,
      });
    });

    container.appendChild(banner);
    container.appendChild(textarea);
    root.appendChild(container);
    textarea.focus({ preventScroll: true });
  }

  function applyUpdate(nextText) {
    if (typeof nextText !== "string" || !textarea) {
      return;
    }
    if (nextText === textarea.value) {
      return;
    }

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;
    applyingExternalUpdate = true;
    try {
      textarea.value = nextText;
      textarea.selectionStart = Math.min(selectionStart, nextText.length);
      textarea.selectionEnd = Math.min(selectionEnd, nextText.length);
      textarea.scrollTop = scrollTop;
      textarea.scrollLeft = scrollLeft;
    } finally {
      applyingExternalUpdate = false;
    }
  }

  return { applyUpdate, render };
}
