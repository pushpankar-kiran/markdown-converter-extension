// Full-tab Markdown preview. The popup stashes the converted Markdown in
// chrome.storage.session under an id, opens viewer.html?id=<id>, and this
// script renders it. Session storage (not local) means the preview data is
// transient — it clears when the browser closes, so we don't accumulate the
// user's document text on disk.
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ gfm: true, breaks: false });

// Converted files can be untrusted, so the HTML `marked` produces is sanitized
// before it ever touches innerHTML. This strips <script>, inline event handlers,
// javascript: URLs, and embedding tags — defense that does not depend on the CSP.
function renderMarkdown(md) {
  const rawHtml = marked.parse(md);
  return DOMPurify.sanitize(rawHtml, {
    FORBID_TAGS: ["style", "iframe", "object", "embed", "form", "base", "meta"],
    FORBID_ATTR: ["style"],
    ADD_ATTR: ["target"]
  });
}

const els = {
  fileName: document.getElementById("fileName"),
  metaLine: document.getElementById("metaLine"),
  rendered: document.getElementById("rendered"),
  raw: document.getElementById("raw"),
  emptyState: document.getElementById("emptyState"),
  tabRendered: document.getElementById("tabRendered"),
  tabRaw: document.getElementById("tabRaw"),
  copyBtn: document.getElementById("copyBtn"),
  downloadBtn: document.getElementById("downloadBtn")
};

let currentMarkdown = "";
let currentName = "converted";

init();

async function init() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return showEmpty("No preview id was provided.");

  let stored;
  try {
    const key = "md-view:" + id;
    const bag = await chrome.storage.session.get(key);
    stored = bag[key];
  } catch (e) {
    return showEmpty("Couldn't read the preview data: " + (e?.message || e));
  }

  if (!stored || typeof stored.markdown !== "string") {
    return showEmpty(
      "This preview has expired. Re-open it from the extension popup."
    );
  }

  currentMarkdown = stored.markdown;
  currentName = stored.name || "converted";

  const base = currentName.replace(/\.md$/i, "");
  els.fileName.textContent = base + ".md";
  document.title = base + " — Markdown Preview";
  els.metaLine.textContent = formatMeta(currentMarkdown);

  // Sanitized before assignment — see renderMarkdown(). The extension-page CSP
  // (no frame-src/object-src, script-src 'self') is a second layer on top.
  els.rendered.innerHTML = renderMarkdown(currentMarkdown);
  els.raw.textContent = currentMarkdown;

  wireControls();
}

function wireControls() {
  els.tabRendered.addEventListener("click", () => setMode("rendered"));
  els.tabRaw.addEventListener("click", () => setMode("raw"));

  els.copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentMarkdown);
      flash(els.copyBtn, "Copied");
    } catch {
      flash(els.copyBtn, "Copy failed");
    }
  });

  els.downloadBtn.addEventListener("click", () => {
    const blob = new Blob([currentMarkdown], {
      type: "text/markdown;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentName.replace(/\.md$/i, "") + ".md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
}

function setMode(mode) {
  const rendered = mode === "rendered";
  els.rendered.hidden = !rendered;
  els.raw.hidden = rendered;
  els.tabRendered.classList.toggle("is-active", rendered);
  els.tabRaw.classList.toggle("is-active", !rendered);
}

function showEmpty(msg) {
  els.rendered.hidden = true;
  els.raw.hidden = true;
  els.emptyState.hidden = false;
  els.emptyState.textContent = msg;
  // Nothing to copy/download.
  els.copyBtn.disabled = true;
  els.downloadBtn.disabled = true;
  els.tabRendered.disabled = true;
  els.tabRaw.disabled = true;
}

function formatMeta(md) {
  const words = md.trim() ? md.trim().split(/\s+/).length : 0;
  const bytes = new Blob([md]).size;
  const size =
    bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  return `${words.toLocaleString()} words · ${size}`;
}

function flash(btn, text) {
  const prev = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = prev), 1400);
}
