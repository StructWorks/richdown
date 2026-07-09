const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { spawn } = require("child_process");

const maxEmbeddedImageBytes = 10 * 1024 * 1024;

function createHtmlExport({
  markdown,
  title,
  settings,
  richEditorScriptHref,
  mermaidScriptHref = "",
  imageMap = {},
  colorThemeKind = "dark",
}) {
  const safeTitle = escapeHtml(title || "Richdown export");
  const exportSettings = {
    ...settings,
    // Export should always read as the rendered Richdown surface.
    richTablePreview: true,
    mermaidPreview: true,
    gherkinPreview: true,
  };

  return `<!doctype html>
<html lang="en" data-richdown-export="true">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>${getExportShellCss(colorThemeKind)}</style>
</head>
<body>
  <div id="editor" aria-label="Richdown preview"></div>
  <script type="application/json" id="initial-document">${serializeForScript(markdown || "")}</script>
  <script type="application/json" id="initial-settings">${serializeForScript(exportSettings)}</script>
  <script type="application/json" id="mermaid-script-uri">${serializeForScript(mermaidScriptHref || "")}</script>
  <script type="application/json" id="initial-git-diff">${serializeForScript([])}</script>
  <script type="application/json" id="initial-image-map">${serializeForScript(imageMap)}</script>
  <script type="application/json" id="initial-runtime">${serializeForScript({ exportMode: true })}</script>
  <script src="${escapeAttribute(richEditorScriptHref)}"></script>
</body>
</html>
`;
}

async function createExportImageMap({
  markdown,
  sourcePath,
  allowedRoots = [],
  embedLimitBytes = maxEmbeddedImageBytes,
}) {
  const imageMap = {};
  const imageSources = findMarkdownImageSources(markdown || "");
  const realAllowedRoots = await resolveAllowedRoots(allowedRoots);

  for (const src of imageSources) {
    if (isRemoteOrDataUri(src)) {
      continue;
    }

    const resolvedPath = await resolveLocalPath(src, sourcePath, realAllowedRoots);
    if (!resolvedPath) {
      continue;
    }

    const mappedUri = await createImageUri(resolvedPath, embedLimitBytes);
    if (!mappedUri) {
      continue;
    }

    imageMap[src] = mappedUri;
    try {
      const decoded = decodeURI(src);
      imageMap[decoded] = mappedUri;
    } catch (error) {
      // Keep the original key when the source is not valid URI text.
    }
  }

  return imageMap;
}

async function writePdfExport({
  htmlPath,
  outputPath,
  browserPath,
  timeoutMs = 90000,
}) {
  const executable = browserPath || findChromiumExecutable();
  if (!executable) {
    throw new Error(
      "Richdown PDF export needs Google Chrome, Microsoft Edge, Chromium, or Brave on PATH or in the standard application folder.",
    );
  }

  const userDataDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "richdown-export-browser-"),
  );
  let browser = null;
  let client = null;
  const browserErrors = [];

  const args = [
    "--headless",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--allow-file-access-from-files",
    "--run-all-compositor-stages-before-draw",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ];

  try {
    browser = spawn(executable, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    browser.stderr.on("data", (chunk) => {
      const text = String(chunk || "").trim();
      if (text) {
        browserErrors.push(text);
      }
    });

    const port = await waitForDevToolsPort(userDataDir, timeoutMs, browser);
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const pageTarget = targets.find((target) => target.type === "page");
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error("Chrome did not expose a debuggable page for PDF export.");
    }

    client = await CdpClient.connect(pageTarget.webSocketDebuggerUrl, timeoutMs);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setEmulatedMedia", { media: "print" });

    const loadEvent = client.waitForEvent("Page.loadEventFired", timeoutMs);
    await client.send("Page.navigate", {
      url: pathToFileURL(htmlPath).href,
    });
    await loadEvent;
    await expandViewportForExport(client, timeoutMs);
    await waitForRichdownExportReady(client, timeoutMs);
    await fitMermaidPreviewsForExport(client, timeoutMs);

    const pdfResult = await client.send(
      "Page.printToPDF",
      {
        displayHeaderFooter: false,
        printBackground: true,
        preferCSSPageSize: true,
      },
      timeoutMs,
    );
    await fs.promises.writeFile(outputPath, Buffer.from(pdfResult.data, "base64"));
    const stat = await fs.promises.stat(outputPath);
    if (!stat.size) {
      throw new Error("Chromium created an empty PDF.");
    }
  } catch (error) {
    if (browserErrors.length > 0) {
      const details = browserErrors.join("\n").slice(-4000);
      throw new Error(`${error.message}\nChrome output:\n${details}`);
    }
    throw error;
  } finally {
    if (client) {
      client.close();
    }
    if (browser && !browser.killed) {
      browser.kill();
    }
    if (browser) {
      await waitForProcessExit(browser, 3000);
    }
    await fs.promises.rm(userDataDir, { recursive: true, force: true });
  }
}

function containsMermaidBlocks(markdown) {
  return /(^|[\r\n])[\t ]*(?:`{3,}|~{3,}|:{3,})\s*mermaid\b/i.test(
    markdown || "",
  );
}

async function waitForDevToolsPort(userDataDir, timeoutMs, browser) {
  const activePortPath = path.join(userDataDir, "DevToolsActivePort");
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (browser.exitCode !== null) {
      throw new Error(`Chrome exited before PDF export could start. Exit code: ${browser.exitCode}`);
    }

    try {
      const content = await fs.promises.readFile(activePortPath, "utf8");
      const [portText] = content.split(/\r?\n/);
      const port = Number.parseInt(portText, 10);
      if (Number.isInteger(port) && port > 0) {
        return port;
      }
    } catch (error) {
      // Chrome writes this file after the debugging server starts.
    }

    await delay(80);
  }

  throw new Error("Timed out waiting for Chrome PDF export to start.");
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Chrome DevTools request failed: ${response.statusCode} ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(10000, () => {
      request.destroy(new Error("Timed out connecting to Chrome DevTools."));
    });
  });
}

async function waitForRichdownExportReady(client, timeoutMs) {
  const expression = `
    (() => new Promise((resolve) => {
      const startedAt = Date.now();
      const timeoutMs = ${Math.max(1000, Number(timeoutMs) - 5000)};

      function getState() {
        const editorReady = Boolean(document.querySelector(".cm-editor"));
        const mermaidPreviews = Array.from(document.querySelectorAll(".cm-mermaid-preview"));
        const renderedMermaid = mermaidPreviews.filter((preview) => preview.querySelector("svg")).length;
        const erroredMermaid = mermaidPreviews.filter((preview) => preview.querySelector(".cm-mermaid-error")).length;
        const pendingMermaid = mermaidPreviews.filter((preview) => preview.querySelector(".cm-mermaid-status")).length;
        const ready =
          editorReady &&
          (mermaidPreviews.length === 0 ||
            renderedMermaid + erroredMermaid >= mermaidPreviews.length);

        return {
          editorReady,
          mermaidPreviews: mermaidPreviews.length,
          renderedMermaid,
          erroredMermaid,
          pendingMermaid,
          ready,
        };
      }

      function tick() {
        const state = getState();
        if (state.ready || Date.now() - startedAt > timeoutMs) {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(getState())));
          return;
        }
        window.setTimeout(tick, 120);
      }

      tick();
    }))()
  `;

  const result = await client.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    timeoutMs,
  );

  const state = result?.result?.value;
  if (!state?.ready) {
    throw new Error(
      `Timed out waiting for Richdown export rendering. Mermaid: ${state?.renderedMermaid || 0}/${state?.mermaidPreviews || 0} rendered, ${state?.erroredMermaid || 0} failed.`,
    );
  }
}

async function expandViewportForExport(client, timeoutMs) {
  const viewportWidth = getA4PrintableWidthPx();

  await client.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: viewportWidth,
      height: 1600,
      deviceScaleFactor: 1,
      mobile: false,
    },
    timeoutMs,
  );
  await waitForPageFrames(client, timeoutMs);

  const metrics = await client.send("Page.getLayoutMetrics", {}, timeoutMs);
  const contentHeight = Math.ceil(metrics?.cssContentSize?.height || 1600);
  const viewportHeight = Math.max(1600, Math.min(contentHeight + 800, 120000));

  await client.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
      mobile: false,
    },
    timeoutMs,
  );
  await waitForPageFrames(client, timeoutMs);
}

function getA4PrintableWidthPx() {
  const a4WidthMm = 210;
  const horizontalMarginMm = 28;
  const cssPxPerInch = 96;
  const mmPerInch = 25.4;
  return Math.round(((a4WidthMm - horizontalMarginMm) / mmPerInch) * cssPxPerInch);
}

async function waitForPageFrames(client, timeoutMs) {
  await client.send(
    "Runtime.evaluate",
    {
      expression: `
        new Promise((resolve) => {
          window.dispatchEvent(new Event("resize"));
          window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    },
    timeoutMs,
  );
}

async function fitMermaidPreviewsForExport(client, timeoutMs) {
  await client.send(
    "Runtime.evaluate",
    {
      expression: `
        new Promise((resolve) => {
          function parseLength(value) {
            const parsed = Number.parseFloat(String(value || "").replace("px", ""));
            return Number.isFinite(parsed) ? parsed : 0;
          }

          function getNaturalSize(svg, stage) {
            const viewBox = svg && svg.viewBox && svg.viewBox.baseVal;
            if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
              return { width: viewBox.width, height: viewBox.height };
            }
            const attrWidth = parseLength(svg && svg.getAttribute("width"));
            const attrHeight = parseLength(svg && svg.getAttribute("height"));
            if (attrWidth > 0 && attrHeight > 0) {
              return { width: attrWidth, height: attrHeight };
            }
            return {
              width: parseLength(stage.style.width) || 800,
              height: parseLength(stage.style.height) || 480,
            };
          }

          let fitted = 0;
          for (const preview of document.querySelectorAll(".cm-mermaid-preview")) {
            const canvas = preview.querySelector(".cm-mermaid-canvas");
            const stage = preview.querySelector(".cm-mermaid-stage");
            const svg = stage && stage.querySelector("svg");
            if (!canvas || !stage || !svg) {
              continue;
            }

            const canvasRect = canvas.getBoundingClientRect();
            const availableWidth = Math.max(1, canvas.clientWidth || canvasRect.width);
            const availableHeight = Math.max(1, canvas.clientHeight || canvasRect.height);
            const naturalSize = getNaturalSize(svg, stage);
            const scale = Math.min(
              availableWidth / naturalSize.width,
              availableHeight / naturalSize.height,
              1,
            );
            const nextWidth = Math.max(1, Math.floor(naturalSize.width * scale));
            const nextHeight = Math.max(1, Math.floor(naturalSize.height * scale));

            canvas.style.overflow = "hidden";
            stage.style.position = "absolute";
            stage.style.transform = "none";
            stage.style.width = nextWidth + "px";
            stage.style.height = nextHeight + "px";
            stage.style.left = Math.max(0, (availableWidth - nextWidth) / 2) + "px";
            stage.style.top = Math.max(0, (availableHeight - nextHeight) / 2) + "px";
            svg.style.maxWidth = "none";
            svg.style.maxHeight = "none";
            svg.style.width = "100%";
            svg.style.height = "100%";
            fitted += 1;
          }

          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve({ fitted })));
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    },
    timeoutMs,
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForProcessExit(processHandle, timeoutMs) {
  if (processHandle.exitCode !== null || processHandle.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    processHandle.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = [];
    this.buffer = Buffer.alloc(0);
    this.fragments = [];

    socket.on("data", (chunk) => this.handleData(chunk));
    socket.on("error", (error) => this.rejectAll(error));
    socket.on("close", () => this.rejectAll(new Error("Chrome DevTools connection closed.")));
  }

  static connect(wsUrl, timeoutMs) {
    return connectWebSocket(wsUrl, timeoutMs).then((socket) => new CdpClient(socket));
  }

  send(method, params = {}, timeoutMs = 30000) {
    const id = this.nextId++;
    const message = { id, method, params };
    this.socket.write(encodeWebSocketFrame(JSON.stringify(message)));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for Chrome DevTools method ${method}.`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve,
        reject,
        timeout,
      });
    });
  }

  waitForEvent(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.eventWaiters = this.eventWaiters.filter((waiter) => waiter.resolve !== resolve);
        reject(new Error(`Timed out waiting for Chrome DevTools event ${method}.`));
      }, timeoutMs);

      this.eventWaiters.push({
        method,
        resolve,
        reject,
        timeout,
      });
    });
  }

  close() {
    try {
      this.socket.end();
    } catch (error) {
      // Ignore shutdown errors.
    }
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (this.buffer.length >= 2) {
      const frame = decodeWebSocketFrame(this.buffer);
      if (!frame) {
        return;
      }

      this.buffer = this.buffer.slice(frame.frameLength);
      if (frame.opcode === 8) {
        this.close();
        return;
      }
      if (frame.opcode === 9) {
        this.socket.write(encodeWebSocketFrame(frame.payload, 10));
        continue;
      }
      if (frame.opcode !== 1 && frame.opcode !== 0) {
        continue;
      }

      if (frame.opcode === 1 && frame.fin) {
        this.handleMessage(frame.payload.toString("utf8"));
        continue;
      }

      this.fragments.push(frame.payload);
      if (frame.fin) {
        this.handleMessage(Buffer.concat(this.fragments).toString("utf8"));
        this.fragments = [];
      }
    }
  }

  handleMessage(text) {
    let message;
    try {
      message = JSON.parse(text);
    } catch (error) {
      return;
    }

    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "Chrome DevTools command failed."));
      } else {
        pending.resolve(message.result || {});
      }
      return;
    }

    if (message.method) {
      const matchingWaiters = this.eventWaiters.filter((waiter) => waiter.method === message.method);
      this.eventWaiters = this.eventWaiters.filter((waiter) => waiter.method !== message.method);
      for (const waiter of matchingWaiters) {
        clearTimeout(waiter.timeout);
        waiter.resolve(message.params || {});
      }
    }
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();

    for (const waiter of this.eventWaiters) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
    this.eventWaiters = [];
  }
}

function connectWebSocket(wsUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(wsUrl);
    const port = Number.parseInt(url.port || "80", 10);
    const socket = net.createConnection({ host: url.hostname, port });
    const key = crypto.randomBytes(16).toString("base64");
    let handshakeBuffer = Buffer.alloc(0);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timed out connecting to Chrome DevTools websocket."));
    }, timeoutMs);

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.on("connect", () => {
      const request = [
        `GET ${url.pathname}${url.search} HTTP/1.1`,
        `Host: ${url.hostname}:${port}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "",
        "",
      ].join("\r\n");
      socket.write(request);
    });

    function onHandshakeData(chunk) {
      handshakeBuffer = Buffer.concat([handshakeBuffer, chunk]);
      const headerEnd = handshakeBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const header = handshakeBuffer.slice(0, headerEnd).toString("utf8");
      if (!/^HTTP\/1\.1 101\b/.test(header)) {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error(`Chrome DevTools websocket handshake failed: ${header.split("\r\n")[0]}`));
        return;
      }

      socket.off("data", onHandshakeData);
      socket.removeAllListeners("error");
      clearTimeout(timeout);

      resolve(socket);
      const leftover = handshakeBuffer.slice(headerEnd + 4);
      if (leftover.length) {
        setImmediate(() => socket.emit("data", leftover));
      }
    }

    socket.on("data", onHandshakeData);
  });
}

function encodeWebSocketFrame(payload, opcode = 1) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), "utf8");
  const mask = crypto.randomBytes(4);
  let headerLength = 2;
  if (data.length >= 126 && data.length <= 65535) {
    headerLength += 2;
  } else if (data.length > 65535) {
    headerLength += 8;
  }

  const frame = Buffer.alloc(headerLength + 4 + data.length);
  frame[0] = 0x80 | opcode;
  if (data.length < 126) {
    frame[1] = 0x80 | data.length;
  } else if (data.length <= 65535) {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(data.length, 2);
  } else {
    frame[1] = 0x80 | 127;
    frame.writeBigUInt64BE(BigInt(data.length), 2);
  }

  mask.copy(frame, headerLength);
  for (let index = 0; index < data.length; index += 1) {
    frame[headerLength + 4 + index] = data[index] ^ mask[index % 4];
  }
  return frame;
}

function decodeWebSocketFrame(buffer) {
  if (buffer.length < 2) {
    return null;
  }

  const first = buffer[0];
  const second = buffer[1];
  const fin = Boolean(first & 0x80);
  const opcode = first & 0x0f;
  const masked = Boolean(second & 0x80);
  let payloadLength = second & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }
    payloadLength = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }

  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) {
      return null;
    }
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  const frameLength = offset + payloadLength;
  if (buffer.length < frameLength) {
    return null;
  }

  const payload = Buffer.from(buffer.slice(offset, frameLength));
  if (mask) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
  }

  return {
    fin,
    opcode,
    payload,
    frameLength,
  };
}

function findMarkdownImageSources(markdown) {
  const sources = new Set();
  const pattern =
    /!\[[^\]]*]\(\s*(?:<([^>]+)>|([^) \t\r\n]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

  for (const match of String(markdown || "").matchAll(pattern)) {
    const source = match[1] || match[2] || "";
    if (source) {
      sources.add(source);
    }
  }

  return [...sources];
}

async function resolveAllowedRoots(allowedRoots) {
  const roots = [];
  for (const root of allowedRoots || []) {
    try {
      roots.push(await fs.promises.realpath(root));
    } catch (error) {
      roots.push(path.resolve(root));
    }
  }
  return roots;
}

async function resolveLocalPath(src, sourcePath, realAllowedRoots) {
  const cleanSrc = stripUriFragmentAndQuery(src);
  let decodedSrc = cleanSrc;
  try {
    decodedSrc = decodeURI(cleanSrc);
  } catch (error) {
    // Fall back to the literal source.
  }

  const candidate = path.isAbsolute(decodedSrc)
    ? decodedSrc
    : path.resolve(path.dirname(sourcePath), decodedSrc);

  let realCandidate;
  try {
    realCandidate = await fs.promises.realpath(candidate);
  } catch (error) {
    return null;
  }

  if (!isPathInsideAnyRoot(realCandidate, realAllowedRoots)) {
    return null;
  }
  return realCandidate;
}

function stripUriFragmentAndQuery(src) {
  const hashIndex = src.indexOf("#");
  const queryIndex = src.indexOf("?");
  const endIndexes = [hashIndex, queryIndex].filter((index) => index >= 0);
  if (!endIndexes.length) {
    return src;
  }
  return src.slice(0, Math.min(...endIndexes));
}

function isPathInsideAnyRoot(filePath, roots) {
  return roots.some((root) => {
    const relative = path.relative(root, filePath);
    return (
      relative === "" ||
      (!relative.startsWith("..") && !path.isAbsolute(relative))
    );
  });
}

async function createImageUri(imagePath, embedLimitBytes) {
  const stat = await fs.promises.stat(imagePath);
  if (!stat.isFile()) {
    return null;
  }

  const mimeType = getImageMimeType(imagePath);
  if (!mimeType) {
    return null;
  }

  if (stat.size > embedLimitBytes) {
    return pathToFileURL(imagePath).href;
  }

  const data = await fs.promises.readFile(imagePath);
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

function getImageMimeType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".apng":
      return "image/apng";
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "";
  }
}

function findChromiumExecutable() {
  const envPath = process.env.RICHDOWN_CHROME_PATH || process.env.CHROME_PATH;
  if (envPath && isExecutableFile(envPath)) {
    return envPath;
  }

  const candidates = getChromiumCandidates();
  return candidates.find(isExecutableFile) || "";
}

function getChromiumCandidates() {
  if (process.platform === "darwin") {
    const homeApplications = path.join(os.homedir(), "Applications");
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      path.join(homeApplications, "Google Chrome.app/Contents/MacOS/Google Chrome"),
      path.join(homeApplications, "Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
      path.join(homeApplications, "Chromium.app/Contents/MacOS/Chromium"),
      path.join(homeApplications, "Brave Browser.app/Contents/MacOS/Brave Browser"),
      ...findExecutablesOnPath([
        "google-chrome",
        "google-chrome-stable",
        "microsoft-edge",
        "chromium",
        "chromium-browser",
        "brave-browser",
      ]),
    ];
  }

  if (process.platform === "win32") {
    const roots = [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ].filter(Boolean);
    return [
      ...roots.map((root) =>
        path.join(root, "Google/Chrome/Application/chrome.exe"),
      ),
      ...roots.map((root) =>
        path.join(root, "Microsoft/Edge/Application/msedge.exe"),
      ),
      ...roots.map((root) =>
        path.join(root, "BraveSoftware/Brave-Browser/Application/brave.exe"),
      ),
      ...findExecutablesOnPath(["chrome.exe", "msedge.exe", "chromium.exe"]),
    ];
  }

  return findExecutablesOnPath([
    "google-chrome-stable",
    "google-chrome",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "brave-browser",
  ]);
}

function findExecutablesOnPath(names) {
  const pathEntries = String(process.env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean);
  const candidates = [];
  for (const entry of pathEntries) {
    for (const name of names) {
      candidates.push(path.join(entry, name));
    }
  }
  return candidates;
}

function isExecutableFile(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function getExportShellCss(colorThemeKind) {
  return `
    ${getVsCodeFallbackVariables(colorThemeKind)}
    * { box-sizing: border-box; }
    html,
    body {
      width: 100%;
      min-height: 100%;
      margin: 0;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }
    body {
      overflow: auto;
    }
    #editor {
      min-height: 100vh;
    }
    html[data-richdown-export="true"] .cm-editor {
      min-height: 100vh;
      height: auto;
    }
    html[data-richdown-export="true"] .cm-scroller {
      min-height: 100vh;
      overflow: visible;
    }
    html[data-richdown-export="true"] .cm-content {
      min-height: auto;
    }
    html[data-richdown-export="true"] .cm-gutters,
    html[data-richdown-export="true"] .cm-cursorLayer,
    html[data-richdown-export="true"] .cm-selectionLayer,
    html[data-richdown-export="true"] .cm-settings-root,
    html[data-richdown-export="true"] .richdown-outline-root,
    html[data-richdown-export="true"] .cm-rich-table-toolbar {
      display: none !important;
    }
    html[data-richdown-export="true"] .cm-activeLine {
      background: transparent;
    }
    html[data-richdown-export="true"] .cm-rich-table-cell-editor {
      display: none !important;
    }
    html[data-richdown-export="true"] .cm-gherkin-actions .cm-gherkin-button:last-child {
      display: none !important;
    }
    html[data-richdown-export="true"] .cm-rich-table-cell-preview {
      min-height: auto;
    }
    @page {
      size: A4;
      margin: 14mm;
    }
    @media print {
      html,
      body {
        width: auto;
        min-height: 0;
        color: #202124;
        background: #ffffff;
        font-size: 12px;
      }
      #editor,
      html[data-richdown-export="true"] .cm-editor,
      html[data-richdown-export="true"] .cm-scroller {
        min-height: 0 !important;
        height: auto !important;
        overflow: visible !important;
      }
      html[data-richdown-export="true"] .cm-editor {
        font-size: 11px !important;
      }
      html[data-richdown-export="true"] .cm-scroller {
        line-height: 1.5 !important;
      }
      html[data-richdown-export="true"] .cm-content {
        max-width: none !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      html[data-richdown-export="true"] .cm-line {
        line-height: 1.5 !important;
      }
      html[data-richdown-export="true"] .cm-heading-line {
        line-height: 1.25 !important;
      }
      html[data-richdown-export="true"] .cm-heading-1 {
        font-size: 1.55rem !important;
        padding-bottom: 0.08em !important;
      }
      html[data-richdown-export="true"] .cm-heading-2 {
        font-size: 1.32rem !important;
        padding-bottom: 0.06em !important;
      }
      html[data-richdown-export="true"] .cm-heading-3 {
        font-size: 1.18rem !important;
      }
      html[data-richdown-export="true"] .cm-heading-4 {
        font-size: 1.06rem !important;
      }
      html[data-richdown-export="true"] .cm-heading-5,
      html[data-richdown-export="true"] .cm-heading-6 {
        font-size: 0.98rem !important;
      }
      html[data-richdown-export="true"] .cm-details-summary {
        font-size: 10.5px !important;
        padding: 6px 8px !important;
      }
      html[data-richdown-export="true"] .cm-rich-table-preview,
      html[data-richdown-export="true"] .cm-rich-table-scroll {
        width: 100% !important;
        max-width: 100% !important;
        overflow: visible !important;
      }
      html[data-richdown-export="true"] .cm-rich-table {
        width: 100% !important;
        table-layout: auto !important;
      }
      html[data-richdown-export="true"] .cm-rich-table th,
      html[data-richdown-export="true"] .cm-rich-table td {
        overflow-wrap: break-word !important;
        word-break: normal !important;
      }
      html[data-richdown-export="true"] .cm-rich-table,
      html[data-richdown-export="true"] .cm-gherkin-preview {
        font-size: 10.5px !important;
      }
      html[data-richdown-export="true"] .cm-rich-table-preview,
      html[data-richdown-export="true"] .cm-mermaid-preview,
      html[data-richdown-export="true"] .cm-gherkin-preview,
      html[data-richdown-export="true"] .cm-details-preview,
      html[data-richdown-export="true"] .cm-image-preview {
        box-shadow: none !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-toolbar-label,
      html[data-richdown-export="true"] .cm-gherkin-stat,
      html[data-richdown-export="true"] .cm-gherkin-step-keyword,
      html[data-richdown-export="true"] .cm-gherkin-examples-title,
      html[data-richdown-export="true"] .cm-gherkin-empty {
        font-size: 10px !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-source,
      html[data-richdown-export="true"] .cm-gherkin-step-table,
      html[data-richdown-export="true"] .cm-gherkin-example-table {
        font-size: 10.5px !important;
      }
      html[data-richdown-export="true"] .cm-codeblock-line {
        background-color: var(--rip-code-bg) !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        padding-left: 10px !important;
        padding-right: 10px !important;
      }
      html[data-richdown-export="true"] .cm-codeblock-first {
        border-top-left-radius: 6px !important;
        border-top-right-radius: 6px !important;
      }
      html[data-richdown-export="true"] .cm-codeblock-last {
        border-bottom-left-radius: 6px !important;
        border-bottom-right-radius: 6px !important;
      }
      html[data-richdown-export="true"] .cm-code-indent-guides-line::before {
        display: none !important;
      }
      html[data-richdown-export="true"] .cm-mermaid-canvas {
        overflow: hidden !important;
      }
      html[data-richdown-export="true"] .cm-mermaid-stage {
        transform: none !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-preview {
        overflow: visible !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-board {
        gap: 10px !important;
        padding: 10px !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-feature-section,
      html[data-richdown-export="true"] .cm-gherkin-group {
        gap: 10px !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-feature {
        gap: 8px !important;
        padding: 12px !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-scenario-grid {
        grid-template-columns: 1fr !important;
        gap: 10px !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-scenario {
        gap: 8px !important;
        padding: 10px !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-preview,
      html[data-richdown-export="true"] .cm-gherkin-board,
      html[data-richdown-export="true"] .cm-gherkin-feature-section,
      html[data-richdown-export="true"] .cm-gherkin-group,
      html[data-richdown-export="true"] .cm-gherkin-scenario {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-step,
      html[data-richdown-export="true"] .cm-gherkin-examples {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      html[data-richdown-export="true"] .cm-gherkin-flow {
        gap: 7px !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-step {
        column-gap: 8px !important;
        padding: 7px 9px 7px 8px !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-step-table,
      html[data-richdown-export="true"] .cm-gherkin-example-table {
        table-layout: auto !important;
        width: 100% !important;
      }
      html[data-richdown-export="true"] .cm-gherkin-step-table td,
      html[data-richdown-export="true"] .cm-gherkin-example-table td {
        overflow-wrap: break-word !important;
        word-break: normal !important;
      }
      html[data-richdown-export="true"] .cm-code-copy-widget {
        display: none !important;
      }
      html[data-richdown-export="true"] .cm-line,
      html[data-richdown-export="true"] .cm-widgetBuffer {
        page-break-inside: auto;
      }
      html[data-richdown-export="true"] .cm-rich-table-preview,
      html[data-richdown-export="true"] .cm-mermaid-preview,
      html[data-richdown-export="true"] .cm-details-preview,
      html[data-richdown-export="true"] .cm-image-preview {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      html[data-richdown-export="true"] .cm-mermaid-toolbar,
      html[data-richdown-export="true"] .cm-gherkin-actions {
        display: none !important;
      }
    }
  `;
}

function getVsCodeFallbackVariables(colorThemeKind) {
  if (colorThemeKind === "light") {
    return `
    :root {
      --vscode-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --vscode-editor-font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      --vscode-editor-background: #ffffff;
      --vscode-editor-foreground: #202124;
      --vscode-descriptionForeground: #6b7280;
      --vscode-panel-border: #d7dbe2;
      --vscode-editorWidget-background: #f3f5f8;
      --vscode-input-background: #ffffff;
      --vscode-textCodeBlock-background: #f5f7fa;
      --vscode-editor-selectionBackground: #add6ff;
      --vscode-focusBorder: #1f6feb;
      --vscode-editorCursor-foreground: #202124;
      --vscode-button-background: #1f6feb;
      --vscode-button-foreground: #ffffff;
      --vscode-textLink-foreground: #0b5cad;
      --vscode-textBlockQuote-border: #8aa6c8;
      --vscode-charts-purple: #7c3aed;
      --vscode-charts-orange: #b45309;
      --vscode-charts-green: #15803d;
      --vscode-charts-blue: #0369a1;
      --vscode-errorForeground: #b42318;
    }`;
  }

  return `
    :root {
      --vscode-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --vscode-editor-font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      --vscode-editor-background: #1e1e1e;
      --vscode-editor-foreground: #d4d4d4;
      --vscode-descriptionForeground: #9d9d9d;
      --vscode-panel-border: #3c3c3c;
      --vscode-editorWidget-background: #252526;
      --vscode-input-background: #3c3c3c;
      --vscode-textCodeBlock-background: #1b1b1b;
      --vscode-editor-selectionBackground: #264f78;
      --vscode-focusBorder: #007fd4;
      --vscode-editorCursor-foreground: #aeafad;
      --vscode-button-background: #0e639c;
      --vscode-button-foreground: #ffffff;
      --vscode-textLink-foreground: #4fc1ff;
      --vscode-textBlockQuote-border: #5f6f7a;
      --vscode-charts-purple: #c586c0;
      --vscode-charts-orange: #ce9178;
      --vscode-charts-green: #b5cea8;
      --vscode-charts-blue: #9cdcfe;
      --vscode-errorForeground: #f14c4c;
    }`;
}

function isRemoteOrDataUri(src) {
  return /^(?:https?:|data:|blob:)/i.test(src);
}

function serializeForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

module.exports = {
  containsMermaidBlocks,
  createExportImageMap,
  createHtmlExport,
  findChromiumExecutable,
  writePdfExport,
};
