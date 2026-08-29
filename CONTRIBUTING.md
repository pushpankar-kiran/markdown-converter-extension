# Contributing

Thanks for your interest in improving Markdown Converter! Contributions of all
kinds are welcome — bug reports, feature ideas, docs, and code.

## Ways to help

- 🐛 **Report a bug** — open a [bug report](../../issues/new?template=bug_report.yml). Include the file type, what you expected, and what happened.
- 💡 **Suggest a feature** — open a [feature request](../../issues/new?template=feature_request.yml).
- 🔧 **Send a pull request** — see below.

## Development setup

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone https://github.com/pushpankar-kiran/markdown-converter-extension.git
cd markdown-converter-extension
npm install
npm run build     # bundles into dist/
npm run watch     # rebuild on change
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. After changing code and rebuilding, click the **↻ reload** icon on the extension card

## Project layout

```
src/
  popup.js            # popup UI (drag-drop, results, view/copy/download)
  background.js       # service worker (context menus, link → .md)
  content-script.js   # page → Markdown (needs a DOM)
  viewer.js           # full-tab rendered Markdown preview
  lib/
    router.js         # file-type detection → converter dispatch
    quality-check.js  # post-conversion quality heuristics
    converters/       # one module per format (pdf, docx, xlsx, pptx, image, html)
public/manifest.json  # MV3 manifest
build.mjs             # esbuild bundling + asset copy
docs/                 # README images
```

## Pull request guidelines

- Keep changes focused; one topic per PR.
- Match the existing code style (no linter is enforced — just read the surrounding code).
- Make sure `npm run build` succeeds before opening the PR (CI runs it too).
- If you add a dependency, note **why** in the PR — MV3 forbids remote code, so everything must bundle cleanly and run client-side.
- Update the `README.md` and `CHANGELOG.md` if your change is user-visible.

## Reporting security issues

Please **do not** open a public issue for security problems — see [SECURITY.md](SECURITY.md).
