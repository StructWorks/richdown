// Remote images for the Orca editor frame, which has no network of its own.
//
// The URLs come from document text, which may not be the reader's own (a
// cloned repository, a file an agent fetched), so the worker must not become
// a way to reach the reader's machine or network:
//
// - only http and https, and only to public addresses: the address is checked
//   when the connection is made (after DNS, so a name that resolves to
//   127.0.0.1 or 169.254.169.254 is refused too), IP literals before that;
// - redirects are followed by hand, each target checked the same way;
// - the body is counted as it arrives and the download stops at the size
//   limit, whatever Content-Length said;
// - only images are kept.
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { imageMimeType, MAX_IMAGE_BYTES } from "./imageSources.js";

const PRIVATE_RANGES = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  PRIVATE_RANGES.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
]) {
  PRIVATE_RANGES.addSubnet(address, prefix, "ipv6");
}

// Whether `address` (an IP literal) is a public unicast address.
export function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 0) {
    return false;
  }
  if (family === 6) {
    // An IPv4-mapped address (::ffff:127.0.0.1) is the IPv4 address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) {
      return isPublicAddress(mapped[1]);
    }
  }
  return !PRIVATE_RANGES.check(address, family === 4 ? "ipv4" : "ipv6");
}

// A dns.lookup for http.request that refuses a name if any address it
// resolves to is not allowed, so the check holds for the address the socket
// actually connects to.
function guardedLookup(isAllowedAddress) {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error);
        return;
      }
      if (addresses.length === 0 || !addresses.every((entry) => isAllowedAddress(entry.address))) {
        callback(refused(hostname));
        return;
      }
      if (options.all) {
        callback(null, addresses);
      } else {
        callback(null, addresses[0].address, addresses[0].family);
      }
    });
  };
}

// Downloads one image: { bytes, mime, etag }.
export function downloadImage(
  url,
  {
    isAllowedAddress = isPublicAddress,
    maxBytes = MAX_IMAGE_BYTES,
    maxRedirects = 5,
    timeoutMs = 15_000,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => fail(new Error("Timed out.")), timeoutMs);
    let activeRequest = null;
    let settled = false;

    function fail(error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(deadline);
      activeRequest?.destroy();
      reject(error);
    }

    function succeed(image) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(deadline);
      resolve(image);
    }

    function attempt(target, redirectsLeft) {
      let parsed;
      try {
        parsed = new URL(target);
      } catch (error) {
        fail(new Error("Not a URL."));
        return;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        fail(new Error("Only http and https images are loaded."));
        return;
      }
      if (parsed.username || parsed.password) {
        fail(new Error("URLs with credentials are not loaded."));
        return;
      }
      // Node connects to an IP literal without a lookup, so check it here.
      const host = parsed.hostname.replace(/^\[|\]$/g, "");
      if (net.isIP(host) && !isAllowedAddress(host)) {
        fail(refused(host));
        return;
      }

      const client = parsed.protocol === "https:" ? https : http;
      const request = client.get(
        parsed,
        {
          lookup: guardedLookup(isAllowedAddress),
          headers: { accept: "image/*", "user-agent": "Richdown-Orca" },
        },
        (response) => {
          const status = response.statusCode ?? 0;
          if (status >= 300 && status < 400 && response.headers.location) {
            response.resume();
            if (redirectsLeft <= 0) {
              fail(new Error("Too many redirects."));
              return;
            }
            attempt(new URL(response.headers.location, parsed).href, redirectsLeft - 1);
            return;
          }
          if (status < 200 || status >= 300) {
            response.resume();
            fail(new Error(`HTTP ${status}`));
            return;
          }
          const contentType = String(response.headers["content-type"] || "")
            .split(";")[0]
            .trim()
            .toLowerCase();
          const mime = contentType.startsWith("image/")
            ? contentType
            : imageMimeType(parsed.pathname);
          if (!mime) {
            fail(new Error("Not an image."));
            return;
          }
          if (Number(response.headers["content-length"]) > maxBytes) {
            fail(new Error("Image is too large."));
            return;
          }
          const chunks = [];
          let received = 0;
          response.on("data", (chunk) => {
            received += chunk.length;
            if (received > maxBytes) {
              fail(new Error("Image is too large."));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => {
            const bytes = Buffer.concat(chunks);
            const etag =
              response.headers.etag || response.headers["last-modified"] || `${bytes.length}`;
            succeed({ bytes, mime, etag: `remote:${etag}` });
          });
          response.on("error", fail);
        },
      );
      activeRequest = request;
      request.on("error", fail);
    }

    attempt(url, maxRedirects);
  });
}

// Remote images, fetched once and kept for a minute so the chunks of one image
// (and the same badge in several places) come from one download. Kept images
// stay under `maxTotalBytes` together.
export function createRemoteImageCache({
  download = (url) => downloadImage(url),
  ttlMs = 60_000,
  maxEntries = 64,
  maxTotalBytes = 64 * 1024 * 1024,
  now = Date.now,
} = {}) {
  const cache = new Map();

  function get(url) {
    const cached = cache.get(url);
    if (cached && now() - cached.at < ttlMs) {
      return cached.image;
    }
    const entry = { at: now(), image: download(url), size: 0 };
    cache.set(url, entry);
    entry.image.then(
      (image) => {
        entry.size = image.bytes.length;
        trim(entry);
      },
      () => {
        if (cache.get(url) === entry) {
          cache.delete(url);
        }
      },
    );
    trim(entry);
    return entry.image;
  }

  // Drops the oldest images, never the one just asked for.
  function trim(keep) {
    let total = 0;
    for (const entry of cache.values()) {
      total += entry.size;
    }
    for (const [url, entry] of cache) {
      if (cache.size <= maxEntries && total <= maxTotalBytes) {
        break;
      }
      if (entry !== keep) {
        cache.delete(url);
        total -= entry.size;
      }
    }
  }

  return { get };
}

function refused(host) {
  const error = new Error(`Refused to load an image from ${host}: not a public address.`);
  error.code = "address_refused";
  return error;
}
