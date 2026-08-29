import { createWorker } from "tesseract.js";
import { runQualityCheck } from "../quality-check.js";

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL("tesseract/worker.min.js"),
      corePath: chrome.runtime.getURL("tesseract/tesseract-core-simd.wasm.js"),
      // Language traineddata is fetched from the network the first time a
      // given language is used (~10-15MB), then cached by the browser.
      // Everything else here is local — see project docs for this tradeoff.
      langPath: "https://tessdata.projectnaptha.com/4.0.0"
    });
  }
  return workerPromise;
}

async function convertImage(arrayBuffer, mimeType, onProgress) {
  const worker = await getWorker();
  if (onProgress) worker.setLogger?.(onProgress); // best-effort; version-dependent API

  const blob = new Blob([arrayBuffer], { type: mimeType });
  const { data } = await worker.recognize(blob);

  const text = (data.text || "").trim();
  const avgConfidence = data.confidence; // 0-100

  const markdown = text ? text : "*(no text was detected in this image)*";

  const quality = runQualityCheck({ sourceText: text, markdownText: markdown });
  if (!text) {
    quality.badge = "likely-incomplete";
    quality.flags.push({ level: "warning", message: "No text was detected in this image." });
  } else if (avgConfidence < 60) {
    quality.badge = quality.badge === "ok" ? "check-recommended" : quality.badge;
    quality.flags.push({ level: "warning", message: `OCR confidence was low (${Math.round(avgConfidence)}%) — expect some misread characters, especially with handwriting or low-resolution scans.` });
  } else {
    quality.flags.push({ level: "info", message: `OCR confidence: ${Math.round(avgConfidence)}%.` });
  }

  return { markdown, quality, meta: { confidence: avgConfidence } };
}

export { convertImage };
