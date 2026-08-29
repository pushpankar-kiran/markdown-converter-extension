# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue.

Use GitHub's [private vulnerability reporting](https://github.com/pushpankar-kiran/markdown-converter-extension/security/advisories/new)
("Report a vulnerability" under the repository's **Security** tab). You'll get a
response as soon as possible.

## Scope & threat model

This extension runs **entirely client-side**. It never uploads your files and
makes no network calls except a one-time OCR language-model download from
`tessdata.projectnaptha.com` (trained data, not your content). There is no
backend, no telemetry, and no account system.

Because everything runs locally against files **you** explicitly choose, the
attack surface is small — but the following are known and worth understanding:

### Known dependency advisory: `xlsx` (SheetJS)

The `xlsx` package has a published high-severity advisory (prototype pollution +
ReDoS) with no patched release on the public npm registry at time of writing.

**Mitigations already applied** (`src/lib/converters/xlsx.js`):

- Parsed with `cellFormula: false` and `cellHTML: false`, avoiding the riskiest
  parsing paths.
- Only ever processes local files the user explicitly selects — there is no
  server ingesting files from untrusted strangers.

**If you convert spreadsheets from untrusted sources**, treat this as a real (if
narrow) risk and consider stripping macros/formulas first. We re-check npm for a
patched version periodically; a PR bumping to a fixed release is welcome.

### Rendered Markdown (viewer)

The viewer renders converted Markdown to HTML with `marked`. Because converted
files can be untrusted, the generated HTML is **sanitized with DOMPurify** before
it is inserted into the page — `<script>`, inline event handlers, `javascript:`
URLs, and embedding tags (`iframe`, `object`, `embed`, `form`, `base`, `meta`)
are stripped. This does not depend on the CSP.

As defense in depth, the extension-page **Content Security Policy** is
`script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; frame-src 'none';
base-uri 'none'; form-action 'none'` — so even if sanitization were bypassed, no
inline script could run and no frame/object/form could be injected.

### Least-privilege injection

The extension does **not** run a content script on every page. Page-to-Markdown
conversion injects its script **on demand** (via `chrome.scripting`) only when
you explicitly trigger it — from the popup button or the right-click menu. The
broad `host_permissions` that remain are used for two things only: injecting that
on-demand script into the tab you're converting, and fetching a file when you use
the "Convert this link" context menu.

## Supported versions

Only the latest release receives fixes. Please upgrade before reporting.
