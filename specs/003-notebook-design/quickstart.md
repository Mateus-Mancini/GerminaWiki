# Quickstart: Validate the Notebook Design

## Prerequisites

- Node 22, then `npm ci` at the repository root.
- A member account (test accounts are shared privately, never in the repository).
- Production is the only environment: `export VITE_API_BASE_URL=https://ih744ae7njca2on6vmsuutp7p40yosgh.lambda-url.sa-east-1.on.aws`.
- Checks that create data use a `QA …` folder and pages, which are deleted at the end.

## 1. Automated checks

```bash
npm run typecheck
npm test            # binder model, excerpt, token contrast, link preview, axe on rendered screens
npm run build       # fonts bundled; note the CSS and font sizes reported
```

Expected: everything passes. `frontend/dist/assets` holds the four Latin woff2 files the first view needs (about 99 KB), and no request goes to `fonts.googleapis.com`.

## 2. Screens at four widths

Build (`npm run build`) and serve the result (`npm run preview`). Sign in, then capture the home, a subject's contents sheet, a page with headings, a quote, code, a table, an image and both kinds of links, the editor, the sign-in screen, and the profile and contribution dialogs, at 360, 768, 1280 and 1440 px wide.

- No screen scrolls horizontally (SC-005).
- The binder shows sections and colour tabs. The current subject is pulled out and the current page is marked (US2).
- Below 900px, "Matérias" opens the binder as a drawer. Esc closes it and focus returns to the toggle.

## 3. Ruling (SC-003)

On the test page, measure each paragraph line's baseline (a `Range` over each text line) against the sheet's rule positions. Every baseline is within 2px of a rule, including after the image, the code block and the table. The measured correction is recorded as `--rule-offset`.

## 4. Reading at projector size (SC-002)

At 1280×720: body text is at least 18px, and the axe scan of the page, home, binder and sign-in has no violations.

## 5. Motion (SC-004)

- Open another page: the new sheet slides in over about 240ms.
- Hover a divider tab: it lifts.
- Choose Editar: the margin line draws down the sheet.
- Hover a blue internal link for half a second: a preview shows the target's title and opening line, and Tab focus shows it too.
- Repeat with `prefers-reduced-motion: reduce`: nothing slides, lifts or draws, and the preview simply appears.

## 6. Editing on the same sheet (US3)

Choose Editar on the test page and compare it with the reading screenshot: the headword size, body face, ruling and margin match. Open the slash menu, the formatting toolbar and the `[[` picker: they use the notebook's paper, ink and typefaces. Save, then check that the confirmation shows and is announced.

## 7. Design detector and finish (SC-006)

```bash
.claude/skills/impeccable/scripts/impeccable detect --json frontend/src
```

Expected: no findings. Then the finish review is run, and its verdict is recorded in tasks.md.

## 8. Print

Print preview of a page shows the headword, meta line and article only.

## Cleanup

Delete the QA pages and folder.
