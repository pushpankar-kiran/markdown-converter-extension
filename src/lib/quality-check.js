// Shared quality-check heuristics, applied after every conversion regardless
// of source format. These are heuristics, not proof of correctness — see
// README section "Honest limitations" for what this can and can't catch.

function wordCount(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function wordCountRatioCheck(sourceText, markdownText) {
  const srcWords = wordCount(sourceText);
  const outWords = wordCount(markdownText);
  if (srcWords === 0) {
    return { level: "info", message: "No comparable source text was available to check against." };
  }
  const ratio = outWords / srcWords;
  if (ratio < 0.85) {
    const pctLost = Math.round((1 - ratio) * 100);
    return {
      level: "warning",
      message: `Output has about ${pctLost}% fewer words than the source (${outWords} vs ${srcWords}). Some content may be missing — worth a skim.`
    };
  }
  if (ratio > 1.35) {
    return {
      level: "info",
      message: `Output is notably longer than the source (${outWords} vs ${srcWords} words). Check for accidental duplication.`
    };
  }
  return { level: "ok", message: `Word count looks consistent (${outWords} vs ${srcWords} in the source).` };
}

function tableCountCheck(expectedTableCount, markdownText) {
  if (expectedTableCount == null) return null;
  const blocks = (markdownText.match(/(^\|.*\|$\n?)+/gm) || []);
  const outputTables = blocks.length;
  if (outputTables < expectedTableCount) {
    return {
      level: "warning",
      message: `Source appeared to contain ${expectedTableCount} table(s), but only ${outputTables} table(s) appear in the output.`
    };
  }
  return { level: "ok", message: `Table count matches (${outputTables}).` };
}

function truncationCheck(markdownText) {
  const trimmed = (markdownText || "").trim();
  if (!trimmed) return { level: "warning", message: "Output is empty." };
  const lastChar = trimmed.slice(-1);
  const endsOk = ".!?\"'`)]}*_".includes(lastChar) || trimmed.endsWith("```") || /\n$/.test(markdownText);
  if (!endsOk) {
    return {
      level: "info",
      message: "Output doesn't end on an obvious sentence or section boundary — worth checking the end of the file wasn't cut off."
    };
  }
  return { level: "ok", message: "Output ends cleanly." };
}

// PDF-specific: surface pdf-inspector's own native signals rather than
// discarding them. These are real fields returned by the library, not
// heuristics we invented.
function pdfNativeSignals(result) {
  const flags = [];
  if (result.pagesNeedingOcr && result.pagesNeedingOcr.length > 0) {
    flags.push({
      level: "warning",
      message: `${result.pagesNeedingOcr.length} page(s) had no extractable text and were skipped: page(s) ${result.pagesNeedingOcr.join(", ")}. Re-run with OCR if you need that content.`
    });
  }
  if (result.hasEncodingIssues) {
    flags.push({
      level: "warning",
      message: "This PDF's font encoding looked unusual — check the output for garbled characters."
    });
  }
  if (typeof result.confidence === "number" && result.confidence < 0.7) {
    flags.push({
      level: "info",
      message: `Classification confidence was ${(result.confidence * 100).toFixed(0)}% — worth a manual skim.`
    });
  }
  return flags;
}

// Combines every applicable check into one summary badge + flag list.
function summarize(flags) {
  const hasWarning = flags.some(f => f.level === "warning");
  const hasInfo = flags.some(f => f.level === "info");
  let badge = "ok";
  if (hasWarning && flags.filter(f => f.level === "warning").length > 1) badge = "likely-incomplete";
  else if (hasWarning) badge = "check-recommended";
  else if (hasInfo) badge = "check-recommended";
  return { badge, flags: flags.filter(f => f.level !== "ok") };
}

function runQualityCheck({ sourceText, markdownText, expectedTableCount, pdfResult }) {
  const flags = [];
  flags.push(wordCountRatioCheck(sourceText, markdownText));
  const tableFlag = tableCountCheck(expectedTableCount, markdownText);
  if (tableFlag) flags.push(tableFlag);
  flags.push(truncationCheck(markdownText));
  if (pdfResult) flags.push(...pdfNativeSignals(pdfResult));
  return summarize(flags);
}

export { runQualityCheck, wordCount };
