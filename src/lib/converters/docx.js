import mammoth from "mammoth";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { runQualityCheck } from "../quality-check.js";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
turndown.use(gfm);

async function convertDocx(arrayBuffer) {
  const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer });
  const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });

  const markdown = turndown.turndown(html)
    .replace(/\n{3,}/g, "\n\n") // collapse excess blank lines left by mammoth's HTML
    .trim();

  const expectedTableCount = (html.match(/<table/gi) || []).length;

  const quality = runQualityCheck({ sourceText: rawText, markdownText: markdown, expectedTableCount });

  if (messages && messages.some(m => m.type === "error")) {
    quality.flags.push({ level: "warning", message: "mammoth reported errors reading parts of this document — some formatting or content may not have converted." });
    if (quality.badge === "ok") quality.badge = "check-recommended";
  }

  return { markdown, quality, meta: { warnings: messages?.length || 0 } };
}

export { convertDocx };
