# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-08-29

### Changed
- The per-result **View / Copy / Download .md** actions are now proper buttons
  (View is a filled primary button) instead of text links.

### Added
- Uploading a file or converting a page **while a conversion is already running**
  is now refused with a clear error and a shake on the drop zone, so results
  can't interleave.

## [1.0.1] - 2026-08-29

### Fixed
- PDF conversion no longer logs a `wasm-bindgen` deprecation warning — the WASM
  loader is now called with a single options object (`init({ module_or_path })`).

## [1.0.0] - 2026-08-29

### Added
- Convert **PDF, DOCX, XLSX/CSV, PPTX, images (OCR), and web pages** to Markdown,
  entirely client-side.
- Automatic **quality checks** (word-count ratio, table count, truncation, and
  the PDF engine's native confidence/OCR/encoding signals) with a status badge.
- **Popup UI** with drag-and-drop, file picker, per-file Copy / Download `.md`,
  and **Download all (.zip)**.
- **Convert this page to Markdown** — article extraction via Readability.
- **Right-click context menus** for links and pages.
- Built-in **rendered Markdown viewer** in a new tab, with a Raw toggle.

[1.0.2]: https://github.com/pushpankar-kiran/markdown-converter-extension/releases/tag/v1.0.2
[1.0.1]: https://github.com/pushpankar-kiran/markdown-converter-extension/releases/tag/v1.0.1
[1.0.0]: https://github.com/pushpankar-kiran/markdown-converter-extension/releases/tag/v1.0.0
