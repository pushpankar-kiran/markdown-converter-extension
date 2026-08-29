// Injected into every page (declared in manifest.json, and re-injectable on
// demand via chrome.scripting from the popup for tabs that predate install).
// Its only job: convert the current page to Markdown when asked. This needs a
// live DOM (Readability + DOMParser), which is exactly why it lives here and
// not in the background service worker.
import { convertHtmlDocument } from "./lib/converters/html.js";

// Guard against double-injection: the manifest injects this at document_idle,
// but the popup may also inject it via chrome.scripting into a tab that was
// already open when the extension was installed. Registering the listener
// twice would make the second listener clobber the first's response.
if (!window.__MD_CONVERTER_LOADED__) {
  window.__MD_CONVERTER_LOADED__ = true;

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "CONVERT_PAGE") return;
    try {
      const result = convertHtmlDocument(
        document.documentElement.outerHTML,
        location.href
      );
      const markdown = result.markdown || "";
      sendResponse({
        ok: true,
        result: {
          ...result,
          sourceName: pageFilename(),
          pageUrl: location.href,
          sourceSizeBytes: null,
          outputSizeBytes: new Blob([markdown]).size,
          type: "html"
        }
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
    // Response is sent synchronously above, so no need to return true.
  });
}

// Turn the page title (or hostname) into a reasonable base filename.
function pageFilename() {
  const raw = (document.title || location.hostname || "page").trim();
  const slug = raw
    .replace(/[\\/:*?"<>|]+/g, " ") // strip characters illegal in filenames
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return (slug || "page") + ".html";
}
