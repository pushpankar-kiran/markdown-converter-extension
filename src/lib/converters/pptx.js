// pptx has no dedicated conversion library on npm. A .pptx file is actually
// a zip archive of XML files, so this parses ppt/slides/slideN.xml directly
// and pulls out text runs (<a:t> elements). This is text-only: layout,
// design, images, and speaker notes (unless included below) don't carry
// over — see the "what this won't do well" note in the project docs.
import JSZip from "jszip";
import { runQualityCheck } from "../quality-check.js";

function extractTextFromSlideXml(xml) {
  // Matches text inside <a:t>...</a:t> runs, which is where PowerPoint
  // stores literal visible text regardless of formatting.
  const matches = [...xml.matchAll(/<a:t(?:\s[^>]*)?>(.*?)<\/a:t>/gs)];
  return matches
    .map(m => m[1]
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
    .join(" ");
}

async function convertPptx(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return na - nb;
    });

  const sections = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const text = extractTextFromSlideXml(xml).trim();
    sections.push(`## Slide ${i + 1}\n\n${text || "*(no text on this slide)*"}`);
  }

  const markdown = sections.join("\n\n");
  const rawText = sections.join("\n");

  const quality = runQualityCheck({ sourceText: rawText, markdownText: markdown });
  if (slideFiles.length === 0) {
    quality.badge = "likely-incomplete";
    quality.flags.push({ level: "warning", message: "No slides were found — this file may not be a valid .pptx, or uses an unexpected internal structure." });
  } else {
    quality.flags.push({ level: "info", message: "PowerPoint conversion is text-only — slide design, images, and layout are not preserved." });
  }

  return { markdown, quality, meta: { slideCount: slideFiles.length } };
}

export { convertPptx };
