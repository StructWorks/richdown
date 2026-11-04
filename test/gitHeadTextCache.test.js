import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createGitHeadTextCache } = require("../src/host/gitHeadTextCache.js");

describe("git HEAD text cache", () => {
  it("reads HEAD once while the commit stays the same", async () => {
    const readHeadText = vi.fn(async (uri) => `head of ${uri}`);
    const cache = createGitHeadTextCache({ readHeadText });

    expect(await cache.read("file:///a.md", "c1")).toBe("head of file:///a.md");
    expect(await cache.read("file:///a.md", "c1")).toBe("head of file:///a.md");

    expect(readHeadText).toHaveBeenCalledTimes(1);
  });

  it("reads again after HEAD moves", async () => {
    let version = 0;
    const readHeadText = vi.fn(async () => `v${(version += 1)}`);
    const cache = createGitHeadTextCache({ readHeadText });

    expect(await cache.read("file:///a.md", "c1")).toBe("v1");
    expect(await cache.read("file:///a.md", "c2")).toBe("v2");
    expect(readHeadText).toHaveBeenCalledTimes(2);
  });

  it("does not cache without a known commit", async () => {
    const readHeadText = vi.fn(async () => "text");
    const cache = createGitHeadTextCache({ readHeadText });

    await cache.read("file:///a.md", undefined);
    await cache.read("file:///a.md", undefined);

    expect(readHeadText).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it("caches a file that is not in HEAD as a failure", async () => {
    const readHeadText = vi.fn(async () => {
      throw new Error("not in HEAD");
    });
    const cache = createGitHeadTextCache({ readHeadText });

    await expect(cache.read("file:///new.md", "c1")).rejects.toThrow("not in HEAD");
    await expect(cache.read("file:///new.md", "c1")).rejects.toThrow("not in HEAD");
    expect(readHeadText).toHaveBeenCalledTimes(1);
  });

  it("keeps only the most recently used files", async () => {
    const readHeadText = vi.fn(async (uri) => uri);
    const cache = createGitHeadTextCache({ readHeadText, maxEntries: 2 });

    await cache.read("a", "c1");
    await cache.read("b", "c1");
    await cache.read("a", "c1");
    await cache.read("c", "c1");
    expect(cache.size).toBe(2);

    await cache.read("a", "c1");
    expect(readHeadText).toHaveBeenCalledTimes(3);
    await cache.read("b", "c1");
    expect(readHeadText).toHaveBeenCalledTimes(4);
  });

  it("forgets a closed file", async () => {
    const readHeadText = vi.fn(async () => "text");
    const cache = createGitHeadTextCache({ readHeadText });

    await cache.read("file:///a.md", "c1");
    cache.forget("file:///a.md");
    await cache.read("file:///a.md", "c1");

    expect(readHeadText).toHaveBeenCalledTimes(2);
  });
});
