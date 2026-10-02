// Banner for pending Copilot (chat editing) changes.
//
// Copilot shows its inline diff and Keep/Undo controls only in the text
// editor, so a file open in Richdown would change without any way to review
// it. The host reports when this document has pending edits; the banner lets
// the reader keep or undo them, or review them in the text editor.

const actions = [
  { action: "review", label: "Review Changes", primary: true },
  { action: "keep", label: "Keep" },
  { action: "undo", label: "Undo" },
];

export function createChatEditsBanner({ postMessage }) {
  let banner = null;

  function update(pending) {
    if (!pending) {
      banner?.remove();
      banner = null;
      return;
    }
    if (banner) {
      return;
    }

    banner = document.createElement("div");
    banner.className = "richdown-chat-edits-banner";
    banner.setAttribute("role", "status");

    const message = document.createElement("span");
    message.className = "richdown-chat-edits-message";
    message.textContent = "Copilot has pending edits to this file.";
    banner.appendChild(message);

    for (const { action, label, primary } of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = primary
        ? "richdown-chat-edits-button is-primary"
        : "richdown-chat-edits-button";
      button.textContent = label;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        postMessage({ type: "chatEditAction", action });
      });
      banner.appendChild(button);
    }

    document.body.appendChild(banner);
  }

  return { update };
}
