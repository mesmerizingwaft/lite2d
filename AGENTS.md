# Agent Notes

## Regression: sample transparent PNG rendering

When changes touch PNG import, mesh creation, Pixi rendering, editor store state, or file input behavior, verify the two transparent PNG samples still render in the editor.

1. Run `npm install` if dependencies are not installed.
2. Run `npm run build` and confirm it completes without errors.
3. Run `npm run test:e2e`.

The Playwright test starts the Vite dev server, imports both sample files through the Parts file input, toggles each part to measure it by itself, and reads back the WebGL canvas pixels. If Playwright browsers are not installed yet, run `npx playwright install chromium` once.

Expected result: each PNG appears centered in the 512x512 editor canvas, with only its opaque colored pixels drawn and transparent areas showing the canvas background. The samples must not appear as solid white 200x200 squares. This is a regression test for transparent PNG loading and Pixi mesh display.

Pixel-level expected values for the current samples:
- `samples/base.png`: 11,446 visible pixels, color `rgb(185, 122, 87)`.
- `samples/object.png`: 1,869 visible pixels, color `rgb(136, 0, 21)`.

Manual fallback: start the app with `npm run dev -- --host 127.0.0.1`, open `http://127.0.0.1:5173/`, import `samples/base.png` and `samples/object.png`, then confirm each sample renders alone on the canvas without becoming a solid white square.
