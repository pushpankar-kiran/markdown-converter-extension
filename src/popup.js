// Popup UI: drag-and-drop / file-picker → converters, render results with a
// quality badge, per-file Copy / Download, and a "Download all (.zip)". Plus a
// "Convert this page" button that delegates to the content script (which has
// the DOM that Readability needs).
import { convertFile } from "./lib/router.js";
import JSZip from "jszip";

const els = {
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  browseBtn: document.getElementById("browseBtn"),
  convertPageBtn: document.getElementById("convertPageBtn"),
  results: document.getElementById("results"),
  resultsList: document.getElementById("resultsList"),
  resultsCount: document.getElementById("resultsCount"),
  downloadAllBtn: document.getElementById("downloadAllBtn"),
  statusLine: document.getElementById("statusLine")
};

// Every successful conversion is kept here so "Download all" and dedupe of
// zip filenames can see the whole set.
const results = [];

// ---- File picker + drag & drop --------------------------------------------

els.browseBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // don't also trigger the dropzone's own click handler
  els.fileInput.click();
});

els.dropzone.addEventListener("click", () => els.fileInput.click());

els.dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    els.fileInput.click();
  }
});

els.fileInput.addEventListener("change", () => {
  if (els.fileInput.files?.length) handleFiles([...els.fileInput.files]);
  els.fileInput.value = ""; // allow re-picking the same file
});

["dragenter", "dragover"].forEach((type) =>
  els.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    e.stopPropagation();
    els.dropzone.classList.add("dragover");
  })
);
["dragleave", "dragend"].forEach((type) =>
  els.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    e.stopPropagation();
    els.dropzone.classList.remove("dragover");
  })
);
els.dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  els.dropzone.classList.remove("dragover");
  const files = [...(e.dataTransfer?.files || [])];
  if (files.length) handleFiles(files);
});

// ---- Convert this page ----------------------------------------------------

els.convertPageBtn.addEventListener("click", async () => {
  els.convertPageBtn.disabled = true;
  setStatus("Reading the current page…");
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    if (!tab?.id) throw new Error("No active tab.");

    let res;
    try {
      res = await chrome.tabs.sendMessage(tab.id, { type: "CONVERT_PAGE" });
    } catch {
      // Tab predates the extension (no content script yet) — inject and retry.
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content-script.js"]
      });
      res = await chrome.tabs.sendMessage(tab.id, { type: "CONVERT_PAGE" });
    }

    if (!res?.ok) {
      throw new Error(res?.error || "Couldn't read this page.");
    }
    addResult(res.result);
    setStatus("Page converted.");
  } catch (e) {
    setStatus(
      "Can't convert this page — browser/internal pages (chrome://, the Web Store, etc.) are off-limits."
    );
    console.error("[md-converter] page conversion:", e);
  } finally {
    els.convertPageBtn.disabled = false;
  }
});

// ---- Core: run each file through the converter ----------------------------

async function handleFiles(files) {
  els.results.hidden = false;
  for (const file of files) {
    const row = renderPending(file.name);
    setStatus(`Converting ${file.name}…`);
    try {
      const result = await convertFile(file);
      finalizeRow(row, result);
      if (result.markdown) results.push(result);
    } catch (e) {
      failRow(row, file.name, e);
      console.error("[md-converter] conversion failed:", e);
    }
  }
  updateResultsHeader();
  setStatus("Done.");
}

// ---- Rendering ------------------------------------------------------------

function renderPending(name) {
  const li = document.createElement("li");
  li.className = "result-item";
  li.innerHTML = `
    <div class="result-top">
      <span class="result-badge check-recommended"></span>
      <span class="result-name"></span>
    </div>
    <p class="result-sizes">Converting…</p>`;
  li.querySelector(".result-name").textContent = name;
  els.resultsList.appendChild(li);
  return li;
}

function finalizeRow(li, result) {
  const badge = result.quality?.badge || "check-recommended";
  const flags = result.quality?.flags || [];

  li.innerHTML = "";

  const top = document.createElement("div");
  top.className = "result-top";
  const dot = document.createElement("span");
  dot.className = `result-badge ${badge}`;
  const name = document.createElement("span");
  name.className = "result-name";
  name.textContent = result.sourceName || "converted";
  top.append(dot, name);

  const sizes = document.createElement("p");
  sizes.className = "result-sizes";
  sizes.innerHTML = sizeSummary(result);

  li.append(top, sizes);

  if (flags.length) {
    const flagWrap = document.createElement("div");
    flagWrap.className = "result-flags";
    for (const f of flags) {
      const d = document.createElement("div");
      d.className = `flag ${f.level === "warning" ? "warning" : "info"}`;
      d.textContent = f.message;
      flagWrap.appendChild(d);
    }
    li.appendChild(flagWrap);
  }

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const viewBtn = document.createElement("button");
  viewBtn.textContent = "View";
  viewBtn.addEventListener("click", () =>
    openViewer(result.markdown, mdName(result.sourceName), viewBtn)
  );
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => copyMarkdown(result.markdown, copyBtn));
  const dlBtn = document.createElement("button");
  dlBtn.textContent = "Download .md";
  dlBtn.addEventListener("click", () =>
    downloadMd(result.markdown, mdName(result.sourceName))
  );
  actions.append(viewBtn, copyBtn, dlBtn);
  li.appendChild(actions);
}

function failRow(li, name, err) {
  li.innerHTML = "";
  const top = document.createElement("div");
  top.className = "result-top";
  const dot = document.createElement("span");
  dot.className = "result-badge likely-incomplete";
  const nameEl = document.createElement("span");
  nameEl.className = "result-name";
  nameEl.textContent = name;
  top.append(dot, nameEl);

  const flagWrap = document.createElement("div");
  flagWrap.className = "result-flags";
  const d = document.createElement("div");
  d.className = "flag warning";
  d.textContent = `Conversion failed: ${String(err?.message || err)}`;
  flagWrap.appendChild(d);

  li.append(top, flagWrap);
}

// Used by the "Convert this page" path — the result already has the router
// shape, so reuse the same renderer.
function addResult(result) {
  els.results.hidden = false;
  const li = renderPending(result.sourceName || "page");
  finalizeRow(li, result);
  if (result.markdown) results.push(result);
  updateResultsHeader();
}

function sizeSummary(result) {
  const out = formatBytes(result.outputSizeBytes);
  const time =
    typeof result.elapsedMs === "number" ? ` · ${result.elapsedMs} ms` : "";
  if (typeof result.sourceSizeBytes === "number" && result.sourceSizeBytes > 0) {
    const src = formatBytes(result.sourceSizeBytes);
    const ratio = result.outputSizeBytes / result.sourceSizeBytes;
    const delta =
      ratio <= 1
        ? `${Math.round((1 - ratio) * 100)}% smaller`
        : `${Math.round((ratio - 1) * 100)}% larger`;
    return `${escapeHtml(src)} → <b>${escapeHtml(out)}</b> · ${delta}${time}`;
  }
  return `web page → <b>${escapeHtml(out)}</b>${time}`;
}

function updateResultsHeader() {
  const n = els.resultsList.children.length;
  els.resultsCount.textContent = n === 1 ? "1 file" : `${n} files`;
  els.downloadAllBtn.hidden = results.length < 2;
}

// ---- Actions --------------------------------------------------------------

async function copyMarkdown(markdown, btn) {
  try {
    await navigator.clipboard.writeText(markdown || "");
    const prev = btn.textContent;
    btn.textContent = "Copied";
    setStatus("Copied to clipboard.");
    setTimeout(() => (btn.textContent = prev), 1400);
  } catch (e) {
    setStatus("Copy failed — clipboard permission denied.");
    console.error("[md-converter] copy failed:", e);
  }
}

// Stash the Markdown in session storage under a fresh id, then open the
// full-tab viewer pointed at it. Session storage keeps the text off disk and
// clears when the browser closes.
async function openViewer(markdown, filename, btn) {
  try {
    const id =
      (crypto.randomUUID && crypto.randomUUID()) ||
      Date.now().toString(36) + Math.random().toString(36).slice(2);
    await chrome.storage.session.set({
      ["md-view:" + id]: { markdown: markdown || "", name: filename }
    });
    await chrome.tabs.create({
      url: chrome.runtime.getURL("viewer.html?id=" + id)
    });
    setStatus("Opened preview in a new tab.");
  } catch (e) {
    setStatus("Couldn't open the preview.");
    console.error("[md-converter] open viewer failed:", e);
    if (btn) {
      const prev = btn.textContent;
      btn.textContent = "Failed";
      setTimeout(() => (btn.textContent = prev), 1400);
    }
  }
}

function downloadMd(markdown, filename) {
  const blob = new Blob([markdown || ""], {
    type: "text/markdown;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  setStatus(`Saved ${filename}`);
}

els.downloadAllBtn.addEventListener("click", async () => {
  if (results.length < 2) return;
  setStatus("Bundling .zip…");
  try {
    const zip = new JSZip();
    const used = new Map();
    for (const r of results) {
      let base = mdName(r.sourceName);
      // De-dupe identical filenames within the zip.
      if (used.has(base)) {
        const n = used.get(base) + 1;
        used.set(base, n);
        base = base.replace(/\.md$/, `-${n}.md`);
      } else {
        used.set(base, 1);
      }
      zip.file(base, r.markdown || "");
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "markdown-conversions.zip");
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setStatus("Saved markdown-conversions.zip");
  } catch (e) {
    setStatus("Zip failed.");
    console.error("[md-converter] zip failed:", e);
  }
});

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---- Helpers --------------------------------------------------------------

function mdName(sourceName) {
  const base = String(sourceName || "converted").replace(/\.[^.]+$/, "");
  const safe = base.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return (safe || "converted") + ".md";
}

function formatBytes(bytes) {
  if (typeof bytes !== "number" || !isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function setStatus(text) {
  els.statusLine.textContent = text;
}
