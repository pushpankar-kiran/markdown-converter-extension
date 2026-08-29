import { convertPdf } from "./converters/pdf.js";
import { convertDocx } from "./converters/docx.js";
import { convertXlsx } from "./converters/xlsx.js";
import { convertPptx } from "./converters/pptx.js";
import { convertImage } from "./converters/image.js";

const EXT_MAP = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx", xls: "xlsx", csv: "xlsx",
  pptx: "pptx",
  png: "image", jpg: "image", jpeg: "image", webp: "image", bmp: "image", gif: "image"
};

function detectType(filename, mimeType) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (EXT_MAP[ext]) return EXT_MAP[ext];
  if (mimeType?.includes("pdf")) return "pdf";
  if (mimeType?.includes("wordprocessingml")) return "docx";
  if (mimeType?.includes("spreadsheetml") || mimeType?.includes("csv")) return "xlsx";
  if (mimeType?.includes("presentationml")) return "pptx";
  if (mimeType?.startsWith("image/")) return "image";
  return null;
}

async function convertFile(file) {
  const type = detectType(file.name, file.type);
  const arrayBuffer = await file.arrayBuffer();

  if (!type) {
    return {
      markdown: "",
      quality: { badge: "likely-incomplete", flags: [{ level: "warning", message: `Unrecognized file type for "${file.name}". Supported: PDF, DOCX, XLSX/CSV, PPTX, PNG/JPG/WEBP.` }] },
      meta: {}
    };
  }

  const start = performance.now();
  let result;
  switch (type) {
    case "pdf": result = await convertPdf(arrayBuffer); break;
    case "docx": result = await convertDocx(arrayBuffer); break;
    case "xlsx": result = await convertXlsx(arrayBuffer); break;
    case "pptx": result = await convertPptx(arrayBuffer); break;
    case "image": result = await convertImage(arrayBuffer, file.type || "image/png"); break;
  }
  const elapsedMs = Math.round(performance.now() - start);

  return {
    ...result,
    sourceName: file.name,
    sourceSizeBytes: file.size,
    outputSizeBytes: new Blob([result.markdown]).size,
    elapsedMs,
    type
  };
}

export { convertFile, detectType };
