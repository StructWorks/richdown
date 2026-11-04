import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createWikilinkFileIndex } = require("../src/host/wikilinkFileIndex.js");

function createHarness({ files = ["/w/a.md"], hasListeners = () => true } = {}) {
  const state = { files: [...files], fileEvent: undefined, watchers: 0, disposed: 0 };
  const listFiles = vi.fn(async () => [...state.files]);
  const onChange = vi.fn();
  const index = createWikilinkFileIndex({
    listFiles,
    watchFiles: (onFileEvent) => {
      state.watchers += 1;
      state.fileEvent = onFileEvent;
      return { dispose: () => (state.disposed += 1) };
    },
    hasListeners,
    onChange,
    refreshDelayMs: 100,
  });
  return { index, listFiles, onChange, state };
}

async function settle(ms = 100) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe("wikilink file index", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("lists and watches the workspace only on first use", async () => {
    const { index, listFiles, state } = createHarness();
    expect(listFiles).not.toHaveBeenCalled();
    expect(state.watchers).toBe(0);

    expect(await index.get()).toEqual(["/w/a.md"]);
    await index.get();

    expect(listFiles).toHaveBeenCalledTimes(1);
    expect(state.watchers).toBe(1);
  });

  it("rebuilds once for a burst of file events and reports the change", async () => {
    const { index, listFiles, onChange, state } = createHarness();
    await index.get();

    state.files.push("/w/b.md", "/w/c.md");
    state.fileEvent("/w/b.md");
    await settle(50);
    state.fileEvent("/w/c.md");
    await settle(100);

    expect(listFiles).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(await index.get()).toEqual(["/w/a.md", "/w/b.md", "/w/c.md"]);
  });

  it("stays quiet when the rebuilt list is the same", async () => {
    // e.g. files created in node_modules, which findFiles leaves out.
    const { index, onChange, state } = createHarness();
    await index.get();

    state.fileEvent("/w/node_modules/x/index.js");
    await settle();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores events inside .git", async () => {
    const { index, listFiles, state } = createHarness();
    await index.get();

    state.fileEvent("/w/.git/index.lock");
    await settle();

    expect(listFiles).toHaveBeenCalledTimes(1);
  });

  it("drops the list instead of rebuilding when no editor is open", async () => {
    let open = true;
    const { index, listFiles, onChange, state } = createHarness({ hasListeners: () => open });
    await index.get();

    open = false;
    state.files.push("/w/b.md");
    state.fileEvent("/w/b.md");
    await settle();
    expect(listFiles).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();

    expect(await index.get()).toEqual(["/w/a.md", "/w/b.md"]);
    expect(listFiles).toHaveBeenCalledTimes(2);
    expect(state.watchers).toBe(1);
  });

  it("keeps the current list when a rebuild fails", async () => {
    const { index, listFiles, onChange, state } = createHarness();
    await index.get();

    listFiles.mockRejectedValueOnce(new Error("search failed"));
    state.fileEvent("/w/b.md");
    await settle();

    expect(onChange).not.toHaveBeenCalled();
    expect(await index.get()).toEqual(["/w/a.md"]);
  });

  it("resets on workspace folder changes", async () => {
    const { index, listFiles, onChange } = createHarness();
    index.reset();
    expect(onChange).not.toHaveBeenCalled();

    await index.get();
    index.reset();
    expect(onChange).toHaveBeenCalledTimes(1);

    await index.get();
    expect(listFiles).toHaveBeenCalledTimes(2);
  });

  it("stops watching on dispose", async () => {
    const { index, state } = createHarness();
    await index.get();

    index.dispose();

    expect(state.disposed).toBe(1);
  });
});
