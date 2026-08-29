import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { runQualityCheck } from "../quality-check.js";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
turndown.use(gfm);

// docHtml: full page HTML string, pageUrl: the page's URL (Readability uses
// it to resolve relative links/images).
function convertHtmlDocument(docHtml, pageUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(docHtml, "text/html");

  // Readability mutates the document, so give it a fresh parse each time.
  const base = doc.createElement("base");
  base.href = pageUrl;
  doc.head.appendChild(base);

  const reader = new Readability(doc);
  const article = reader.parse();

  if (!article || !article.content) {
    return {
      markdown: "",
      quality: { badge: "likely-incomplete", flags: [{ level: "warning", message: "Couldn't identify readable article content on this page — it may not be a standard article layout." }] },
      meta: {}
    };
  }

  const title = article.title ? `# ${article.title}\n\n` : "";
  const markdown = (title + turndown.turndown(article.content)).trim();
  const rawText = article.textContent || "";

  const quality = runQualityCheck({ sourceText: rawText, markdownText: markdown });
  quality.flags.push({ level: "info", message: "Only the main article content was extracted — navigation, ads, and sidebars were intentionally excluded." });

  return { markdown, quality, meta: { title: article.title, byline: article.byline } };
}

export { convertHtmlDocument };
