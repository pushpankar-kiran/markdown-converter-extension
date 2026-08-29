// Full-tab Markdown preview. The popup stashes the converted Markdown in
// chrome.storage.session under an id, opens viewer.html?id=<id>, and this
// script renders it. Session storage (not local) means the preview data is
// transient — it clears when the browser closes, so we don't accumulate the
// user's document text on disk.
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

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

  // marked returns an HTML string. Inline <script>/handler attributes it may
  // contain won't execute: the extension-page CSP is script-src 'self', which
  // blocks inline script. The content is also the user's own converted file.
  els.rendered.innerHTML = marked.parse(currentMarkdown);
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
