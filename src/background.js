// MV3 service worker. Owns the context menus and turns a right-click into a
// downloaded .md file. File-type converters (PDF/DOCX/XLSX/PPTX/image) run
// fine here — no DOM needed. Page (HTML) conversion needs a DOM, so it is
// delegated to the content script instead.
import { convertFile } from "./lib/router.js";

const MENU_LINK = "md-convert-link";
const MENU_PAGE = "md-convert-page";

chrome.runtime.onInstalled.addListener(() => {
  // removeAll first so reloading the unpacked extension doesn't throw
  // "duplicate id" on the create calls.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_LINK,
      title: "Convert to Markdown",
      contexts: ["link"]
    });
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: "Convert this page to Markdown",
      contexts: ["page"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_LINK && info.linkUrl) {
      await handleLinkConversion(info.linkUrl);
    } else if (info.menuItemId === MENU_PAGE && tab?.id != null) {
      await handlePageConversion(tab.id);
    }
  } catch (e) {
    // No "notifications" permission is requested, so surface failures on the
    // toolbar badge rather than silently swallowing them.
    console.error("[md-converter] context-menu conversion failed:", e);
    flashBadge("err");
  }
});

// Fetch a linked file, run it through the right converter, download the .md.
async function handleLinkConversion(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch failed (${resp.status}) for ${url}`);
  const blob = await resp.blob();
  const name = filenameFromUrl(url);
  // Wrap the blob as a File so router.js's detectType() sees a .name/.type.
  const file = new File([blob], name, { type: blob.type || "" });

  const result = await convertFile(file);
  if (!result.markdown) {
    flashBadge("err");
    throw new Error(`No Markdown produced for ${name}`);
  }
  await downloadMarkdown(result.markdown, toMdName(result.sourceName || name));
  flashBadge("ok");
}

// Ask the content script (which has a DOM) to convert the current page.
async function handlePageConversion(tabId) {
  let res;
  try {
    res = await chrome.tabs.sendMessage(tabId, { type: "CONVERT_PAGE" });
  } catch {
    // Content script not present (e.g. tab predates install). Inject it, then
    // retry once. Will still fail on chrome:// and other restricted pages.
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content-script.js"]
    });
    res = await chrome.tabs.sendMessage(tabId, { type: "CONVERT_PAGE" });
  }
  if (!res?.ok || !res.result?.markdown) {
    flashBadge("err");
    throw new Error(res?.error || "Page conversion returned no Markdown");
  }
  await downloadMarkdown(
    res.result.markdown,
    toMdName(res.result.sourceName || "page")
  );
  flashBadge("ok");
}

// Service workers have no URL.createObjectURL, so encode the Markdown as a
// data: URL for chrome.downloads. utf-8 + encodeURIComponent keeps non-ASCII
// intact.
async function downloadMarkdown(markdown, filename) {
  const dataUrl =
    "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown);
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
}

function filenameFromUrl(url) {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split("/").pop() || "");
    if (last) return last;
    return (u.hostname || "download").replace(/[^\w.-]+/g, "_");
  } catch {
    return "download";
  }
}

function toMdName(sourceName) {
  const base = String(sourceName || "converted").replace(/\.[^.]+$/, "");
  const safe = base.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return (safe || "converted") + ".md";
}

// Brief green/red badge as lightweight feedback for a context-menu action,
// then clear it.
function flashBadge(kind) {
  const ok = kind === "ok";
  chrome.action.setBadgeBackgroundColor({ color: ok ? "#2f6f62" : "#a13d3d" });
  chrome.action.setBadgeText({ text: ok ? "md" : "!" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2500);
}
