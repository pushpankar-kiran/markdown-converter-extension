// NOTE ON A KNOWN ISSUE: the "xlsx" (SheetJS) npm package has a published
// high-severity advisory (prototype pollution + ReDoS) with no patched
// version currently on the public npm registry. Mitigations applied here:
//   1. Parsed with `cellFormula: false, cellHTML: false` to avoid the
//      riskiest parsing paths.
//   2. Runs fully offline/client-side against files YOU choose — there's no
//      scenario where an untrusted third party feeds it a file without your
//      action, unlike a server processing uploads from strangers.
//   3. If you convert spreadsheets from untrusted sources, treat this as a
//      real (if narrow) risk and consider stripping macros/formulas first.
import * as XLSX from "xlsx";
import { runQualityCheck } from "../quality-check.js";

function sheetToMarkdownTable(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  if (rows.length === 0) return "";
  const header = rows[0];
  const body = rows.slice(1);
  const esc = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lines = [
    `| ${header.map(esc).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map(r => `| ${header.map((_, i) => esc(r[i])).join(" | ")} |`)
  ];
  return lines.join("\n");
}

async function convertXlsx(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellFormula: false, cellHTML: false });
  const parts = [];
  let rawTextParts = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const table = sheetToMarkdownTable(sheet);
    if (!table) continue;
    parts.push(`## ${name}\n\n${table}`);
    rawTextParts.push(XLSX.utils.sheet_to_csv(sheet));
  }
  const markdown = parts.join("\n\n");
  const rawText = rawTextParts.join("\n");

  const quality = runQualityCheck({
    sourceText: rawText,
    markdownText: markdown,
    expectedTableCount: wb.SheetNames.length
  });

  return { markdown, quality, meta: { sheetCount: wb.SheetNames.length } };
}

export { convertXlsx };
