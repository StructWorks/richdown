import http from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRemoteImageCache,
  downloadImage,
  isPublicAddress,
} from "../src/orca-worker/remoteImages.js";

const PNG = Buffer.from("89504e470d0a1a0a", "hex");

let server;
let base;
let routes;

beforeEach(async () => {
  routes = {};
  server = http.createServer((request, response) => {
    const route = routes[request.url];
    if (!route) {
      response.writeHead(404).end();
      return;
    }
    route(request, response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
});

// The test server is on 127.0.0.1, which a real download refuses; these
// options let it through and nothing else.
const allowTestServer = { isAllowedAddress: (address) => address === "127.0.0.1" };

describe("isPublicAddress", () => {
  it("refuses loopback, private, link-local and other special addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.10",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "not an address",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("accepts public addresses", () => {
    for (const address of ["93.184.216.34", "8.8.8.8", "2606:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isPublicAddress(address), address).toBe(true);
    }
  });
});

describe("downloadImage", () => {
  it("refuses the machine's own addresses by default", async () => {
    routes["/a.png"] = (request, response) => {
      response.writeHead(200, { "content-type": "image/png" }).end(PNG);
    };

    await expect(downloadImage(`${base}/a.png`)).rejects.toMatchObject({ code: "address_refused" });
    await expect(
      downloadImage(`http://localhost:${server.address().port}/a.png`),
    ).rejects.toMatchObject({ code: "address_refused" });
  });

  it("downloads an image with its type and etag", async () => {
    routes["/a.png"] = (request, response) => {
      response.writeHead(200, { "content-type": "image/png", etag: '"v1"' }).end(PNG);
    };

    const image = await downloadImage(`${base}/a.png`, allowTestServer);

    expect(image).toMatchObject({ mime: "image/png", etag: 'remote:"v1"' });
    expect(image.bytes.equals(PNG)).toBe(true);
  });

  it("checks every redirect target", async () => {
    routes["/moved.png"] = (request, response) => {
      response.writeHead(302, { location: `${base}/a.png` }).end();
    };
    routes["/a.png"] = (request, response) => {
      response.writeHead(200, { "content-type": "image/png" }).end(PNG);
    };
    routes["/to-loopback6.png"] = (request, response) => {
      response.writeHead(302, { location: `http://[::1]:${server.address().port}/a.png` }).end();
    };
    routes["/to-metadata.png"] = (request, response) => {
      response.writeHead(301, { location: "http://169.254.169.254/latest/meta-data" }).end();
    };

    await expect(downloadImage(`${base}/moved.png`, allowTestServer)).resolves.toMatchObject({ mime: "image/png" });
    await expect(downloadImage(`${base}/to-loopback6.png`, allowTestServer)).rejects.toMatchObject({ code: "address_refused" });
    await expect(downloadImage(`${base}/to-metadata.png`, allowTestServer)).rejects.toMatchObject({ code: "address_refused" });
  });

  it("stops at the size limit even without a Content-Length", async () => {
    routes["/big.png"] = (request, response) => {
      response.writeHead(200, { "content-type": "image/png" });
      for (let index = 0; index < 8; index += 1) {
        response.write(Buffer.alloc(512, 1));
      }
      response.end();
    };
    routes["/declared.png"] = (request, response) => {
      response.writeHead(200, { "content-type": "image/png", "content-length": "4096" }).end(Buffer.alloc(4096));
    };

    await expect(
      downloadImage(`${base}/big.png`, { ...allowTestServer, maxBytes: 1024 }),
    ).rejects.toThrow(/too large/);
    await expect(
      downloadImage(`${base}/declared.png`, { ...allowTestServer, maxBytes: 1024 }),
    ).rejects.toThrow(/too large/);
  });

  it("refuses pages, failures, bad or endless redirects and other schemes", async () => {
    routes["/page"] = (request, response) => {
      response.writeHead(200, { "content-type": "text/html" }).end("<html>");
    };
    routes["/loop.png"] = (request, response) => {
      response.writeHead(302, { location: "/loop.png" }).end();
    };
    routes["/bad-redirect.png"] = (request, response) => {
      response.writeHead(302, { location: "http://[::1" }).end();
    };

    await expect(downloadImage(`${base}/page`, allowTestServer)).rejects.toThrow(/Not an image/);
    await expect(downloadImage(`${base}/gone.png`, allowTestServer)).rejects.toThrow(/HTTP 404/);
    await expect(downloadImage(`${base}/loop.png`, allowTestServer)).rejects.toThrow(/redirects/);
    await expect(downloadImage(`${base}/bad-redirect.png`, allowTestServer)).rejects.toThrow(/Bad redirect/);
    await expect(downloadImage("ftp://example.com/a.png")).rejects.toThrow(/http and https/);
    await expect(downloadImage("http://user:pass@example.com/a.png")).rejects.toThrow(/credentials/);
  });
});

describe("remote image cache", () => {
  const image = (size) => ({ bytes: Buffer.alloc(size), mime: "image/png", etag: `remote:${size}` });

  it("downloads each URL once while it is fresh", async () => {
    let clock = 0;
    const download = vi.fn(async () => image(10));
    const cache = createRemoteImageCache({ download, ttlMs: 1000, now: () => clock });

    await cache.get("https://example.com/a.png");
    await cache.get("https://example.com/a.png");
    clock = 1500;
    await cache.get("https://example.com/a.png");

    expect(download).toHaveBeenCalledTimes(2);
  });

  it("keeps downloaded images under the total byte budget", async () => {
    const download = vi.fn(async (url) => image(Number(new URL(url).pathname.slice(1))));
    const cache = createRemoteImageCache({ download, maxTotalBytes: 100 });

    await cache.get("https://example.com/60");
    await cache.get("https://example.com/50");
    // The 60-byte image was dropped to make room, so it downloads again.
    await cache.get("https://example.com/60");

    expect(download.mock.calls.map(([url]) => url)).toEqual([
      "https://example.com/60",
      "https://example.com/50",
      "https://example.com/60",
    ]);
  });

  it("forgets a failed download", async () => {
    const download = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(image(5));
    const cache = createRemoteImageCache({ download });

    await expect(cache.get("https://example.com/a.png")).rejects.toThrow();
    await expect(cache.get("https://example.com/a.png")).resolves.toMatchObject({ mime: "image/png" });
  });
});
