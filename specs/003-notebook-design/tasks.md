---

description: "Task list for 003-notebook-design"
---

# Tasks: Notebook Design

**Input**: Design documents from `/specs/003-notebook-design/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/design-tokens.md, contracts/binder-model.md, quickstart.md

**Tests**: Required (constitution III). Logic modules are test-first: write each test, see it fail, then implement. Layout, ruling and motion can't be measured in jsdom, so they are checked in headless Chrome (quickstart §2–§6).

**Organization**: by user story, in priority order: US1 and US2 (P1), US3 (P2), US4 and US5 (P3). Paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: user story from spec.md

---

## Phase 1: Setup

- [X] T001 Add `@fontsource/libertinus-serif` and `@fontsource-variable/public-sans` to `package.json` (R1); commit the lockfile
- [X] T002 [P] Create `frontend/src/theme/`, `frontend/src/shell/`, `frontend/tests/unit/{shell,theme}/` per plan.md

## Phase 2: Foundational (blocks every story)

- [X] T003 [P] Contrast test `frontend/tests/unit/theme/contrast.test.ts`: reads `tokens.css`, checks the ratios in contracts/design-tokens.md (ink and links ≥ 7:1 on paper, other text ≥ 4.5:1, cover text ≥ 7:1, focus ≥ 3:1, every divider ≥ 3:1 on the cover)
- [X] T004 `frontend/src/theme/tokens.css` per contracts/design-tokens.md, including the reduced-motion overrides; makes T003 pass
- [X] T005 [P] `frontend/src/theme/fonts.ts`: Fontsource imports limited to the Latin files (400, 400 italic, 700, variable sans) (R1)
- [X] T006 `frontend/src/theme/base.css`: page background, type defaults, links, buttons (primary, secondary, quiet, danger), fields, `<dialog>`, notices, focus ring, `.visually-hidden`, print rules (FR-001, FR-019, FR-022)
- [X] T007 [P] Binder model test `frontend/tests/unit/shell/binder.test.ts` covering contracts/binder-model.md guarantees 1–5
- [X] T008 `frontend/src/shell/binder.ts`: `buildBinder`, `dividerForPage`, `dividerById`, `allPages`; makes T007 pass
- [X] T009 [P] `frontend/src/theme/motion.ts`: `turnSheet(update)`, using View Transitions when supported and motion is allowed, and calling `update()` directly otherwise (R4)
- [X] T010 Switch `frontend/src/main.ts` to the theme (import `theme/fonts`, `tokens.css`, `base.css`, `notebook.css`), remove the old stylesheet imports and delete `styles.css`, `course.css`, `login.css`, `auth.css`, `workspace.css`; drop the Google Fonts import (R6); in `frontend/index.html` set `<meta name="theme-color">` to the cover colour

**Checkpoint**: `npm test` and `npm run build` pass; the app runs with the new tokens and fonts

## Phase 3: User Story 1 - Read a page on a ruled sheet (P1) 🎯 MVP

- [X] T011 [P] [US1] Excerpt test `frontend/tests/unit/reader/excerpt.test.ts`, then `frontend/src/reader/excerpt.ts` (data-model.md)
- [X] T012 [US1] Sheet styles in `notebook.css`: full-height paper sheet with the ruling (repeating background on `--rule`, `--rule-offset`), the red margin at `--margin-x`, headword on two rules, meta line, sections list as margin notes at ≥ 1280px and above the text below that (FR-006, FR-007)
- [X] T013 [US1] Rewrite `frontend/src/reader/article.css` on the tokens: body 19px/`--rule`, block margins in whole rules, h2/h3, blue pen-stroke links, red dashed missing links with a visually hidden "(página inexistente)", quote, code, tables, images, figures (FR-007–FR-009)
- [X] T014 [US1] `frontend/src/reader/rule.ts`: `snapToRule(root)`, which pads images, code blocks, tables and embedded HTML to whole rules (ResizeObserver plus image `load`) (R2); call it after the shell renders a page
- [X] T015 [US1] `renderPage` markup in `main.ts`: breadcrumb (section › subject), headword, meta line ("Atualizada em …" from `updatedAt`), pen-shaped "Editar" (`#edit-page`), sections list, article and contribution block; remove "PÁGINA DO BACKEND" and "Conteúdo carregado diretamente do workspace" (FR-006, FR-020)
- [X] T016 [US1] Measure the baseline offset in Chrome, set `--rule-offset`, and verify SC-003 on a mixed page (quickstart §3). `--rule-offset` set to `-8px` desktop, `-7px` mobile (`frontend/src/theme/tokens.css`), so each line's baseline lands on the rule. `design.mjs`'s `report.ruling` measurement (`mod` of each line's bottom against `--rule`) is the SC-003 check; re-verified fresh in T032 after the three post-run fixes (af19082, de01cfd, 271f573) landed, since the only prior run predates them.

**Checkpoint**: a page reads on the ruled sheet; SC-002 and SC-003 hold for the reading view

## Phase 4: User Story 2 - Find a subject in the binder (P1)

- [X] T017 [US2] Binder markup in `main.ts`: rendered from `buildBinder`, with the wordmark, search field (`#search`, R8), section labels, divider tabs (`data-divider`, `data-colour`), the current subject pulled out with its pages and groups, `aria-current`, and the account controls at the foot (FR-010)
- [X] T018 [US2] Binder styles in `notebook.css`: cover board, spiral rings on the right edge, tabs with cardstock edges, the pulled-out tab, page list, the "here" mark (FR-010)
- [X] T019 [US2] Home as the notebook's index in `renderCatalog`: headword, sections with subjects listed with dot leaders, page counts and cardstock tabs, search results as a list with excerpts, and the section filter (`#folder-select`); remove "BIBLIOTECA DE CONTEÚDOS", "Conteúdos do backend" and the decorative glyph icons (FR-011, FR-005)
- [X] T020 [US2] Contents sheet: `selectedSubject` state, `renderSubject()` with headword, meta, groups and page entries with excerpts, an empty state; dividers on home and in the binder open it (FR-011a)
- [X] T021 [US2] Drawer below 900px: "Matérias" toggle in the top bar (`aria-expanded`, `aria-controls`), Esc and page choice close it and return focus (FR-012)
- [X] T022 [P] [US2] Axe scan of binder, home and contents sheet markup. Done in-browser against the running app (`design.mjs`'s `axe()`, wcag2a/wcag2aa/wcag21aa/best-practice) instead of a jsdom fixture test, since the binder's cardstock tabs, spiral and drawer motion need the real layout; no `frontend/tests/component/screens.test.ts` was written. Re-verified fresh in T032 after the three post-run fixes.

**Checkpoint**: any page is reachable in ≤ 2 clicks from home (SC-001); the binder shows where you are

## Phase 5: User Story 3 - Edit on the same sheet (P2)

- [X] T023 [US3] Rewrite `frontend/src/editor/editor.css` on the tokens: the editor host covers the sheet column and the sheet keeps the ruling, margin, headword (title input) and 19px/`--rule` serif body; editor bar in the interface face; draft banner, alerts, dialogs and conflict screen on paper (FR-013, FR-014)
- [X] T024 [US3] Map BlockNote variables (`--bn-*`) to the tokens for menus, toolbar, side menu, picker and file panel (contracts/design-tokens.md)
- [X] T025 [US3] Margin draw on entering edit mode (`scaleY` over `--duration-turn`, none under reduced motion) and a saved notice with a check mark, announced (FR-015, US3 scenario 3)

## Phase 6: User Story 4 - Move through the notebook smoothly (P3)

- [X] T026 [US4] Page turn: `navigate()` in `main.ts` wraps view changes in `turnSheet`, and `notebook.css` defines `::view-transition-*` for `sheet` (240ms slide and fade with a leading-edge shadow); tab lift on hover and focus (FR-015)
- [X] T027 [P] [US4] Preview test `frontend/tests/unit/reader/preview.test.ts` (shows after delay on hover and at once on focus, hides on leave, blur and Esc, text only, `aria-describedby`), then `frontend/src/reader/preview.ts`; install it from `main.ts` with a lookup into the loaded pages (FR-016, R5)
- [X] T028 [US4] Reduced-motion check: every animation and transition respects `prefers-reduced-motion` (FR-017). `design.mjs`'s `report.motion` compares `no-preference` vs `reduce` contexts: 0 `startViewTransition` calls and no running animations/transitions under `reduce`. The only prior run predates the three post-run fixes (af19082 retimed the tab's transform animation, de01cfd kept text readable mid-turn, 271f573 only touched accessible naming); re-verified fresh in T032.

## Phase 7: User Story 5 - Sign in and manage the account in the same world (P3)

- [X] T029 [US5] Sign-in as the notebook cover: the cover board with a label holding the form (ids unchanged), no school branding, plain copy (FR-018, FR-005)
- [X] T030 [US5] Profile and contribution dialogs, the notice (toast), and loading, empty and error states on paper with the shared controls (FR-018)
- [X] T031 [P] [US5] Styles for the comments UI class names from web app PR #8 (`commentable-block`, `comment-toolbar`, `comment-toggle`, `comment-thread`, `comment-card`, `comment-meta`, `admin-reply`, forms) so they fit the sheet when it merges

## Phase 8: Polish & cross-cutting

- [ ] T032 Browser pass (quickstart §2–§6, §8) at 360/768/1280/1440 with screenshots; fix every overflow, misalignment or contrast problem found in one batch. Also measure SC-007: font bytes on first load (< 150 KB) and time from choosing a page to readable text, against the 002 build (< 100ms slower)
- [ ] T033 Run `impeccable detect` and the finish review (quickstart §7); fix findings; record the verdict here
- [ ] T034 [P] Write `DESIGN.md` (the documented system: tokens, typography, components, motion, do's and don'ts) and update the README's UI section
- [ ] T035 Full regression: `npm test`, `npm run build`, and the 002 editor quickstart script against the new look
- [ ] T036 Open the PR into `develop` after 002 merges, describing the shell markup changes, the deleted stylesheets and the search nuance (R8), and request Clara's review (constitution: integration work is reviewed by every affected owner)

## Dependencies & Execution Order

- Setup → Foundational → stories. US1 and US2 both need T008–T010. US3 needs US1's sheet (T012). US4 needs US1 and US2 markup. US5 needs Foundational only.
- Within a story, tests come before their module (T011, T027).
- [P] tasks touch different files and can be done in any order inside their phase.

## Implementation Strategy

MVP = Phases 1–4 (reading and navigation in the new world). Then US3 so editing matches, then US4/US5, then the finish (Phase 8), which is part of done, not optional.
