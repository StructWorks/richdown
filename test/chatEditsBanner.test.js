// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { createChatEditsBanner } from "../src/rich-editor/presentation/chatEdits/chatEditsBanner.js";

afterEach(() => {
  document.body.replaceChildren();
});

describe("chat edits banner", () => {
  it("appears while Copilot edits are pending and disappears after", () => {
    const banner = createChatEditsBanner({ postMessage: vi.fn() });
    banner.update(true);
    banner.update(true);
    expect(document.querySelectorAll(".richdown-chat-edits-banner")).toHaveLength(1);
    expect(document.body.textContent).toContain("Copilot has pending edits");

    banner.update(false);
    expect(document.querySelector(".richdown-chat-edits-banner")).toBeNull();
  });

  it("sends the chosen action to the host", () => {
    const postMessage = vi.fn();
    createChatEditsBanner({ postMessage }).update(true);
    const buttons = [...document.querySelectorAll(".richdown-chat-edits-button")];
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Review Changes",
      "Keep",
      "Undo",
    ]);

    for (const button of buttons) {
      button.click();
    }
    expect(postMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: "chatEditAction", action: "review" },
      { type: "chatEditAction", action: "keep" },
      { type: "chatEditAction", action: "undo" },
    ]);
  });
});
