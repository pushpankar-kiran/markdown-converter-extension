import init, { processPdf, extractText } from "@firecrawl/pdf-inspector-wasm";
import { runQualityCheck } from "../quality-check.js";

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  const wasmUrl = chrome.runtime.getURL("wasm/pdf_inspector_wasm_bg.wasm");
  await init(wasmUrl);
  initialized = true;
}

async function convertPdf(arrayBuffer, { profile = "compact" } = {}) {
  await ensureInit();
  const bytes = new Uint8Array(arrayBuffer);
  const result = processPdf(bytes, { profile, includePageMarkers: false, includeImages: false });

  if (!result.markdown) {
    return {
      markdown: "",
      quality: { badge: "likely-incomplete", flags: [{
        level: "warning",
        message: result.pdfType === "Scanned" || result.pdfType === "ImageBased"
          ? "This PDF has no extractable text (it looks scanned/image-based). Try the image/OCR converter instead."
          : "No text could be extracted from this PDF."
      }] },
      meta: { pdfType: result.pdfType, pageCount: result.pageCount, confidence: result.confidence }
    };
  }

  let rawText = "";
  try {
    rawText = extractText(bytes) || "";
  } catch (_) {
    // If raw extraction itself fails, the word-count check just gets skipped below.
  }

  const quality = runQualityCheck({
    sourceText: rawText,
    markdownText: result.markdown,
    pdfResult: result
  });

  return {
    markdown: result.markdown,
    quality,
    meta: {
      pdfType: result.pdfType,
      pageCount: result.pageCount,
      confidence: result.confidence,
      processingTimeMs: result.processingTimeMs
    }
  };
}

export { convertPdf };
