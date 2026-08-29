// Builds the extension into dist/. MV3 forbids remote/unbundled code, so
// esbuild bundles each entry point into a single self-contained IIFE, and the
// wasm/OCR runtime assets are copied in locally.
//
//   node build.mjs          one-off build
//   node build.mjs --watch  rebuild on change (does not re-copy assets)
import * as esbuild from "esbuild";
import { rm, mkdir, cp, copyFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(ROOT, "dist");
const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: {
    popup: path.join(ROOT, "src/popup.js"),
    background: path.join(ROOT, "src/background.js"),
    "content-script": path.join(ROOT, "src/content-script.js"),
    viewer: path.join(ROOT, "src/viewer.js")
  },
  outdir: OUT,
  bundle: true,
  format: "iife", // classic scripts, no import statements — required by MV3 CSP
  platform: "browser",
  mainFields: ["browser", "module", "main"],
  conditions: ["browser"],
  target: ["chrome110"],
  logLevel: "info",
  // SheetJS (xlsx) references Node builtins behind `typeof require` guards that
  // never run in a browser. Mark them external so esbuild doesn't try to bundle
  // them; the guarded code paths stay dead at runtime.
  external: [
    "fs", "crypto", "stream", "path", "os", "util", "events", "buffer",
    "node:fs", "node:crypto", "node:stream", "node:path", "node:os",
    "node:util", "node:events", "node:buffer"
  ]
};

async function copyAssets() {
  await mkdir(path.join(OUT, "wasm"), { recursive: true });
  await mkdir(path.join(OUT, "tesseract"), { recursive: true });
  await mkdir(path.join(OUT, "icons"), { recursive: true });

  // Static extension files.
  await copyReq("public/manifest.json", "manifest.json");
  await copyReq("src/popup.html", "popup.html");
  await copyReq("src/popup.css", "popup.css");
  await copyReq("src/viewer.html", "viewer.html");
  await copyReq("src/viewer.css", "viewer.css");

  // Icons (generated separately; warn but don't fail if missing).
  for (const size of [16, 48, 128]) {
    await copyOpt(`icons/icon${size}.png`, `icons/icon${size}.png`);
  }

  // pdf-inspector wasm — loaded at runtime via chrome.runtime.getURL("wasm/…").
  await copyReq(
    "node_modules/@firecrawl/pdf-inspector-wasm/pdf_inspector_wasm_bg.wasm",
    "wasm/pdf_inspector_wasm_bg.wasm"
  );

  // Tesseract OCR runtime — worker + core must ship locally (MV3 forbids CDN
  // code). Language traineddata is still fetched at runtime (data, not code).
  await copyReq(
    "node_modules/tesseract.js/dist/worker.min.js",
    "tesseract/worker.min.js"
  );
  // Copy every core variant so whichever tesseract.js picks resolves locally.
  for (const f of [
    "tesseract-core-simd.wasm.js",
    "tesseract-core-simd.wasm",
    "tesseract-core.wasm.js",
    "tesseract-core.wasm",
    "tesseract-core-simd-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm"
  ]) {
    await copyOpt(`node_modules/tesseract.js-core/${f}`, `tesseract/${f}`);
  }
}

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Required asset: throw if missing (a real build error).
async function copyReq(from, to) {
  const src = path.join(ROOT, from);
  if (!(await exists(src))) {
    throw new Error(
      `Missing required asset: ${from}\n` +
        `  → run "npm install" first, then rebuild.`
    );
  }
  await cp(src, path.join(OUT, to));
}

// Optional asset: warn if missing, keep going.
async function copyOpt(from, to) {
  const src = path.join(ROOT, from);
  if (!(await exists(src))) {
    console.warn(`  (skipped, not found) ${from}`);
    return;
  }
  await cp(src, path.join(OUT, to));
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await copyAssets();
    await ctx.watch();
    console.log("watching for changes… (Ctrl+C to stop)");
  } else {
    await esbuild.build(buildOptions);
    await copyAssets();
    console.log("\n✓ Built extension to dist/. Load it via chrome://extensions → Load unpacked.");
  }
}

main().catch((e) => {
  console.error("\n✗ Build failed:\n" + (e?.message || e));
  process.exit(1);
});
