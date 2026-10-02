# Implementation Plan: Notebook Design

**Branch**: `003-notebook-design` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-notebook-design/spec.md`

## Summary

Replace the web app's look with the Caderno Universitário world chosen by the product owner. Every screen takes its values from one set of design tokens: cool ruled paper, blue-black ink, wiki-blue and red links, and eight cardstock colours for subjects. Libertinus Serif and Public Sans are bundled with the app (R1). Article text sits on a 32px ruling (R2). The shell's sidebar becomes a binder of colour divider tabs built from a pure, tested model (R3, contract binder-model), and the card-grid home becomes the notebook's index. Each subject gets a contents sheet. Navigation turns the sheet through the View Transitions API (R4). Internal links show previews from data already loaded (R5). The editor keeps the same sheet, themed through BlockNote's variables. The shell keeps its plain-TypeScript renderer and every id it exposes; only its markup and CSS change (R6, R7), and Clara reviews them.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), React 19 (editor only), CSS with custom properties, Node 22 for tooling

**Primary Dependencies**:
- new: `@fontsource/libertinus-serif`, `@fontsource-variable/public-sans` (OFL-1.1, bundled; R1)
- existing: Vite 6, `marked` 18 and DOMPurify (reader), BlockNote 0.55 (editor)
- browser APIs: View Transitions (progressive), `ResizeObserver`

**Storage**: none new; colours and view state are derived (data-model.md)

**Testing**: Vitest 3 + jsdom for the binder model, excerpt, token contrast, link preview and axe scans of rendered markup; headless Chrome scripts for layout, ruling, overflow and motion (R10); `impeccable detect` and the finish review

**Target Platform**: current Chrome and Edge (school machines), Firefox and Safari; desktop first, usable from 360px; classroom projectors at 1280×720

**Project Type**: web application (frontend only)

**Performance Goals**: first-view fonts ≤ 150 KB (about 99 KB measured), page opening no more than 100ms slower (SC-007), transitions ≤ 300ms (SC-004)

**Constraints**:
- $0 hosting: static assets only, no third-party font host
- pt-BR copy
- light theme only
- no gradients as decoration, no glassmorphism, no emoji icons, no school branding (FR-005)
- keyboard and reduced motion (FR-017, FR-019)
- shell ids and behaviour unchanged (FR-020)

**Scale/Scope**: about a dozen members, tens of subjects and hundreds of pages; 7 screens (sign-in, home, contents sheet, page, editor, profile and contribution dialogs) plus notices and states

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | How this plan complies | Status |
|---|---|---|
| I. Ownership and scope | The visual layer across the app was requested by the product owner, for Mancini to lead (`frontend-impeccable-pass`). The shell (`main.ts`, its stylesheets) is Clara's. Its logic, state, handlers and ids stay as they are; markup and CSS change, and new logic lives in Mancini's new modules (`shell/binder.ts`, `reader/excerpt.ts`, `reader/preview.ts`, `theme/`). Clara reviews the PR. The comments UI stays hers (PR #8); only styles for its class names are provided. | ✅ |
| II. Contracts before integration | [contracts/design-tokens.md](./contracts/design-tokens.md) is the contract between theme, shell, reader, editor and future screens. [contracts/binder-model.md](./contracts/binder-model.md) defines the shell's navigation model. No API contract changes. | ✅ |
| III. Testable workflows | Unit tests: binder model, colour rule, excerpt, token contrast, preview behaviour. axe scans of rendered screens. Browser checks for ruling, overflow, motion and editor parity (quickstart §2–§6). | ✅ |
| IV. Security and data integrity | Content still renders only through the sanitising reader (002). Previews use the same sanitised excerpt text, inserted as text and never as HTML. No new data paths. | ✅ |
| V. Simple, accessible, observable | One token file and no runtime theming library. Contrast is tested from token values. `aria-current`, a disclosure pattern for the drawer, tooltips tied to `aria-describedby`, reduced motion honoured, and status messages still announced. | ✅ |

**Post-design re-check (after Phase 1)**: no violations, so no Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/003-notebook-design/
├── plan.md
├── research.md            # R1–R10
├── data-model.md          # binder, excerpt, view state
├── quickstart.md          # validation in a browser
├── contracts/
│   ├── design-tokens.md
│   └── binder-model.md
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/
├── index.html                     # theme-color, no Google Fonts
├── src/
│   ├── theme/                     # NEW (Mancini)
│   │   ├── fonts.ts               # Fontsource imports (latin, 400/400i/700 + variable sans)
│   │   ├── tokens.css             # contracts/design-tokens.md
│   │   ├── base.css               # paper, type, controls, dialogs, notices, focus, print
│   │   ├── notebook.css           # binder, sheet, home index, contents sheet, sign-in, motion, responsive
│   │   └── motion.ts              # turnSheet(render): View Transitions with reduced-motion fallback
│   ├── shell/
│   │   └── binder.ts              # NEW: buildBinder & helpers (contracts/binder-model.md)
│   ├── reader/
│   │   ├── article.ts / .css      # from 002; CSS rewritten on tokens + snapToRule
│   │   ├── excerpt.ts             # NEW
│   │   ├── preview.ts             # NEW: link previews
│   │   └── rule.ts                # NEW: snapToRule(root)
│   ├── editor/editor.css          # rewritten on tokens; BlockNote variables
│   ├── main.ts                    # Clara's: markup restructured, imports theme; old CSS imports removed
│   └── styles.css, course.css, login.css, auth.css, workspace.css   # DELETED (replaced by theme/)
└── tests/
    ├── unit/shell/binder.test.ts
    ├── unit/reader/{excerpt,preview}.test.ts
    ├── unit/theme/contrast.test.ts
    └── component/screens.test.ts  # axe over home, contents sheet, page and sign-in markup
```

**Structure Decision**: the theme and the new view logic are Mancini's new modules. The shell keeps its single-file renderer with new markup.

## Phases

1. **Foundation**: tokens, fonts, base styles, motion helper, binder model, and deletion of the old stylesheets. The app is temporarily plain but works.
2. **US1 Reading**: page sheet, ruling, article typography, sections list, meta line, `snapToRule`.
3. **US2 Binder and home**: binder tabs, drawer, index home, contents sheet, search in the binder.
4. **US3 Editor**: editor sheet parity, BlockNote theming, margin draw, save confirmation.
5. **US4 Motion and previews**: page turn, tab lift, link previews.
6. **US5 Other screens**: sign-in cover, dialogs, notices, states, print.
7. **Polish and finish**: browser pass at four widths, detector, finish review, fixes, `DESIGN.md`.

## Complexity Tracking

None.
