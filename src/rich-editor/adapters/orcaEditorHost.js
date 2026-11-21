// The editor host inside an Orca custom editor frame.
//
// In VS Code the extension host answers the editor's messages. An Orca editor
// frame has no such process: Orca gives it the document through
// orca.document.session() and nothing of the file system, not even the file's
// path. This adapter plays the host's part inside the frame and speaks the same
// message protocol, so src/richEditor.js runs unchanged:
//
// - edits go to the session; outside changes come back as "update" messages,
//   with concurrent writes merged line by line (domain/textMerge.js);
// - lint and format run here, on the default rule set;
// - settings are the plugin's own Orca settings (`settings:own`), which the
//   person can also change under the plugin in Orca's Settings;
// - images come from the plugin's worker (adapters/orcaImageLoader.js), which
//   finds the open file by its text and reads the images next to it;
// - web links open through orca.shell, and links within the document scroll to
//   their target. Other requests that need the file system (links to other
//   files, wikilinks, path completions) are answered empty so the editor shows
//   them the way it does without a host.
import {
  mermaidPreviewSizes,
  normalizeRichEditorSettings,
  previewWidths,
  richThemes,
} from "../domain/settingsModel.js";
import { normalizeLineEndings } from "../domain/textChange.js";
import { mergeText } from "../domain/textMerge.js";
import { fingerprintText } from "../domain/textFingerprint.js";
import { createOrcaImageLoader } from "./orcaImageLoader.js";

const CRLF = "\r\n";
const LF = "\n";

// Message type -> Orca setting key and the values it accepts.
const SETTING_MESSAGES = {
  setTheme: {
    key: "richTheme",
    field: "theme",
    accepts: (value) => richThemes.includes(value),
  },
  setRichTablePreview: { key: "richTablePreview", accepts: isBoolean },
  setMermaidPreview: { key: "mermaidPreview", accepts: isBoolean },
  setMermaidColorized: { key: "mermaidColorized", accepts: isBoolean },
  setGherkinPreview: { key: "gherkinPreview", accepts: isBoolean },
  setMermaidPreviewSize: {
    key: "mermaidPreviewSize",
    accepts: (value) => mermaidPreviewSizes.includes(value),
  },
  setPreviewWidth: {
    key: "previewWidth",
    accepts: (value) => previewWidths.includes(value),
  },
};

export async function createOrcaEditorHost({
  orca,
  lint,
  format,
  parseLinkFragment,
  mermaidScriptUri,
  lintDelayMs = 300,
  sessionDebounceMs = 150,
  copyText = copyToClipboard,
  requestTimeoutMs = 30_000,
}) {
  if (!orca?.document) {
    throw new Error("Richdown must run as an Orca custom editor.");
  }

  const session = await orca.document.session({
    merge: mergeText,
    debounceMs: sessionDebounceMs,
  });
  let lineEnding = detectLineEnding(session.value) ?? LF;
  // The editor's text, always LF, as of the last message from either side.
  let currentText = normalizeLineEndings(session.value);
  let pluginSettings = await readPluginSettings(orca);
  let handler = null;
  // Messages from before the editor listens, such as an outside change while
  // the editor module loads; they are handed over once it does.
  const undelivered = [];
  let lintTimer = null;

  syncColorSchemeClass();
  orca.on?.("theme", () => syncColorSchemeClass());

  // The text as the file was opened identifies the file; it is looked up the
  // first time an image needs the document's folder.
  const openedText = session.value;
  let documentLocation = null;
  const requestWorker = (name, input) => {
    if (typeof orca.plugin?.request !== "function") {
      return Promise.reject(new Error("The Richdown worker is not available."));
    }
    return orca.plugin.request(name, input, { timeoutMs: requestTimeoutMs });
  };
  const imageLoader = createOrcaImageLoader({
    request: requestWorker,
    locateDocument: () => {
      documentLocation ??= requestWorker("richdown.locateDocument", {
        fingerprint: fingerprintText(openedText),
        byteLength: new TextEncoder().encode(openedText).length,
      }).then(
        (location) => ({
          documentPaths: location?.documentPaths ?? [],
          workspaceRoot: location?.workspaceRoot ?? null,
        }),
        (error) => {
          console.warn("[Richdown] Could not find the open file for its images", error);
          documentLocation = null;
          return { documentPaths: [], workspaceRoot: null };
        },
      );
      return documentLocation;
    },
  });

  session.onReplace((value) => {
    lineEnding = detectLineEnding(value) ?? lineEnding;
    currentText = normalizeLineEndings(value);
    deliver({ type: "update", text: currentText });
    scheduleLint(0);
  });

  orca.settings?.onDidChange?.(async () => {
    const previousLintEnabled = pluginSettings.lintEnabled;
    pluginSettings = await readPluginSettings(orca);
    deliver({
      type: "settings",
      settings: normalizeRichEditorSettings(pluginSettings),
    });
    if (pluginSettings.lintEnabled !== previousLintEnabled) {
      scheduleLint(0);
    }
  });

  // Replies arrive after the request returns, as window messages do in VS
  // Code: the editor registers what it waits for after posting.
  function deliver(message) {
    queueMicrotask(() => {
      if (handler) {
        handler(message);
      } else {
        undelivered.push(message);
      }
    });
  }

  function toFileText(text) {
    return lineEnding === CRLF ? text.replace(/\n/g, CRLF) : text;
  }

  function scheduleLint(delay = lintDelayMs) {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(() => {
      lintTimer = null;
      const diagnostics =
        pluginSettings.lintEnabled === false ? [] : lint(currentText);
      deliver({ type: "lintDiagnostics", diagnostics });
    }, delay);
  }

  function applyFormat() {
    if (session.readOnly || pluginSettings.formatEnabled === false) {
      return;
    }
    const formatted = format(currentText);
    if (typeof formatted !== "string" || formatted === currentText) {
      return;
    }
    currentText = formatted;
    deliver({ type: "update", text: formatted });
    session.change(toFileText(formatted));
    scheduleLint(0);
  }

  function openLink(href) {
    if (typeof href !== "string" || href.length === 0) {
      return;
    }
    if (/^(https?:|mailto:)/i.test(href)) {
      orca.shell?.openExternal(href).catch((error) => {
        console.warn("[Richdown] Could not open link", error);
      });
      return;
    }
    if (href.startsWith("#")) {
      const target = parseLinkFragment(href.slice(1));
      if (target) {
        deliver({ type: "reveal", target });
      }
    }
    // Links to other files need the file's path, which Orca does not give
    // an editor frame.
  }

  const handlers = {
    ready() {
      scheduleLint(0);
    },
    edit(message) {
      if (typeof message.text !== "string") {
        return;
      }
      currentText = message.text;
      session.change(toFileText(message.text));
      scheduleLint();
    },
    formatDocument: applyFormat,
    openLink(message) {
      openLink(message.href);
    },
    copyText(message) {
      if (typeof message.text === "string") {
        void copyText(message.text);
      }
    },
    resolveWikilinks(message) {
      deliver({ type: "wikilinksResolved", requestId: message.requestId, results: {} });
    },
    requestWikilinkCompletions(message) {
      deliver({ type: "wikilinkCompletions", requestId: message.requestId, items: [] });
    },
    requestHostCompletions(message) {
      deliver({ type: "hostCompletions", requestId: message.requestId, items: [] });
    },
    requestLinkCompletions(message) {
      deliver({ type: "linkCompletions", requestId: message.requestId, paths: [] });
    },
    webviewError(message) {
      console.error(
        `[Richdown] ${message.context || "editor"}: ${message.message || "Unknown error"}`,
      );
    },
  };

  function postMessage(message) {
    if (!message || typeof message.type !== "string") {
      return;
    }
    const setting = SETTING_MESSAGES[message.type];
    if (setting) {
      const value = message[setting.field ?? "value"];
      if (setting.accepts(value)) {
        pluginSettings = { ...pluginSettings, [setting.key]: value };
        orca.settings?.set(setting.key, value).catch((error) => {
          console.warn(`[Richdown] Could not save setting ${setting.key}`, error);
        });
      }
      return;
    }
    handlers[message.type]?.(message);
  }

  return {
    exportMode: false,
    readOnly: session.readOnly === true,
    initial: {
      document: currentText,
      settings: normalizeRichEditorSettings(pluginSettings),
      mermaidScriptUri,
      gitDiffChanges: [],
      imageMap: {},
      reveal: null,
    },
    resolveImageSource: (source) =>
      pluginSettings.remoteImages === false && /^\s*<?https?:/i.test(source)
        ? Promise.reject(new Error("Remote images are turned off."))
        : imageLoader.resolve(source),
    postMessage,
    onMessage(nextHandler) {
      handler = nextHandler;
      for (const message of undelivered.splice(0)) {
        deliver(message);
      }
    },
  };
}

async function readPluginSettings(orca) {
  try {
    const values = await orca.settings?.get();
    return values && typeof values === "object" ? values : {};
  } catch (error) {
    // Without the settings grant the editor still works on its defaults.
    console.warn("[Richdown] Could not read settings", error);
    return {};
  }
}

function detectLineEnding(text) {
  if (typeof text !== "string") {
    return undefined;
  }
  if (text.includes(CRLF)) {
    return CRLF;
  }
  return text.includes(LF) ? LF : undefined;
}

// Rules written for VS Code's dark and light themes key off these classes;
// Orca marks the scheme on <html> instead.
function syncColorSchemeClass() {
  const dark = document.documentElement.classList.contains("dark");
  document.body.classList.toggle("vscode-dark", dark);
  document.body.classList.toggle("vscode-light", !dark);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (error) {
    // The frame may not be allowed the async clipboard; fall back below.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = "position:fixed;top:-1000px;opacity:0";
  const previousFocus = document.activeElement;
  document.body.append(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } finally {
    textarea.remove();
    previousFocus?.focus?.();
  }
}

function isBoolean(value) {
  return typeof value === "boolean";
}
