---

description: "Task list for 002-page-editor"
---

# Tasks: Page Editor

**Input**: Design documents from `/specs/002-page-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/editor-mount.md, contracts/pages-api.md, quickstart.md

**Tests**: Required (constitution III). Write each test first and confirm it fails before the implementation task.

**Organization**: by user story, in priority order: US1, US2, US4 (P1), then US3 (P2), then US5 (P3). Paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: user story from spec.md

---

## Phase 1: Setup

- [X] T001 Add dependencies to `package.json`: `@blocknote/core`, `@blocknote/react` and `@blocknote/ariakit` pinned to `~0.55.0`, `marked` `^18`, `diff` `^9`; dev: `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/dom`, `vitest-axe` (research R1, R13). Commit the lockfile.
- [X] T002 Configure Vitest in `frontend/vite.config.ts` (`test.environment: 'jsdom'`, `test.include: ['tests/**/*.test.{ts,tsx}']`, setup file `frontend/tests/setup.ts` registering `vitest-axe` matchers), and include `tests` in `frontend/tsconfig.json`
- [X] T003 [P] Create the editor module skeleton under `frontend/src/editor/` (empty `index.ts`, `editor.css`) and `frontend/tests/{unit,contract,component,integration}/` per plan.md
- [X] T004 [P] Make the Spec Kit bash scripts executable (`git update-index --chmod=+x .specify/scripts/bash/*.sh`). They lacked the bit, so `setup-plan.sh` failed with "permission denied".

**Checkpoint**: `npm test` runs (no tests yet); `npm run build` passes

---

## Phase 2: Foundational (blocks every story)

The codec is the data-integrity core: every save goes through it.

### Tests (write first, must fail)

- [X] T005 [P] `frontend/tests/unit/codec/anchors.test.ts`:
  - parses only lines that are exactly `<!--b:<uuid>-->` (lowercase UUID)
  - neutralises anchor-like text inside blocks (`<!--b:` → `&lt;!--b:`)
  - de-duplicates repeated ids (first occurrence keeps the anchor)
- [X] T006 [P] `frontend/tests/unit/codec/decode.test.ts`:
  - anchors attach to the **next** segment and become its first block's id
  - lists, code fences, tables and blank lines form the expected segments
  - content without anchors decodes
  - unfaithful segments (raw HTML, footnotes, reference links) become one `rawMarkdown` block (research R4)
- [X] T007 [P] `frontend/tests/unit/codec/encode.test.ts`:
  - **decode → encode with no edits is byte-identical** (SC-007), including the spike fixture from research R2 (heading after an anchor, inline HTML, `-` bullets, `---`, padded tables)
  - editing one block re-serializes only its segment
  - new blocks get fresh anchors; list runs stay one segment
  - deleted segments drop their anchors
  - `rawMarkdown` text is written back exactly
  - pasted HTML containing `<script>`, `<style>`, `onclick` attributes and `<iframe>` encodes to Markdown containing none of them (FR-013, constitution IV)
- [X] T008 [P] `frontend/tests/contract/pages-api.test.ts` (stubbed `fetch`):
  - `getPageForEdit` returns `{ page, etag }` from the `ETag` header
  - `savePage` sends `If-Match` and returns the new etag
  - **412 and 409** → `VersionConflictError`
  - 401, 403, 404, 400 and 428 → `ApiRequestError` with status (contracts/pages-api.md)

### Implementation

- [X] T009 [P] `frontend/src/editor/codec/anchors.ts` (T005)
- [X] T010 `frontend/src/editor/codec/decode.ts`: `marked` lexer segmentation, per-segment `tryParseMarkdownToBlocks`, faithful check by comparing rendered HTML (R3, R4). Data-model `Segment` fields: `anchor`, `source`, `blockIds`, `snapshot`, `faithful`. (T006)
- [X] T011 `frontend/src/editor/codec/encode.ts`: the encode rule from data-model.md ("if a segment's blocks are present, in order, and deep-equal to `snapshot`, write `source` as it was"), anchors on their own line before each segment, blank-line separation, trailing newline preserved (T007)
- [X] T012 [P] `frontend/src/editor/blocks/rawMarkdown.tsx`: custom BlockNote block (monospaced, editable, labelled "Markdown avançado")
- [X] T013 [P] Extend `frontend/src/services/backend-api.ts`:
  - `request()` can return headers
  - `getPageForEdit`, `savePage` (`title` 1–255 characters after trimming)
  - `VersionConflictError` with `currentVersion`
  - `getPublicProfile`, `searchPages`, `listPageCommentAnchors` (follows pages of up to 100)
  
  Clara owns this file, so it needs her review. (T008)
- [X] T014 [P] `frontend/src/editor/report.ts`: `report(event, { pageId, status, version })`, emitting `editor.save_failed`, `editor.conflict`, `editor.auth_expired` and `editor.forbidden`, and never content or tokens (R14)

**Checkpoint**: codec and client tests green; the codec meets SC-007 on all fixtures

---

## Phase 3: User Story 1 - Edit and save a page (P1) 🎯 MVP

**Goal**: open a page in edit mode, change title and content, and save with version checks.

**Independent Test**: quickstart §2.

### Tests (write first, must fail)

- [X] T015 [P] [US1] `frontend/tests/integration/mount.test.ts`, per contracts/editor-mount.md:
  - `openPageEditor` mounts in the host and sets `body[data-editing]`
  - focus goes to the start of the content
  - `onClose({ saved: true, page })` fires after save
  - `requestClose()` asks to confirm when there are unsaved changes
  - after `onClose`, the shell's re-render focuses `#edit-page`
- [X] T016 [P] [US1] `frontend/tests/component/PageEditor.test.tsx`:
  - loading state
  - save via button and `Ctrl+S` sends the encoded content with `If-Match`
  - "Nada para salvar" when unchanged
  - title validation (empty, over 255)
  - network or 5xx failure keeps the text and offers retry
  - 403 and 404 messages; statuses announced in the `aria-live` region
  - a 412/409 never overwrites: the text is kept and a conflict state is shown (the full screen arrives in US2)
  - failed saves, 401 and 403 call `report()` with only `{pageId, status, version}`; no title, content or token in the payload (FR-016)
  - a save answered after 8 s (cold start) keeps "Salvando…" visible and then succeeds, with no client timeout
  - axe has no violations

### Implementation

- [X] T017 [US1] `frontend/src/editor/PageEditor.tsx`:
  - title field and BlockNote view (Ariakit UI) with the `rawMarkdown` block in the schema
  - save bar with the status state machine from data-model.md (loading, editing, saving, saved, failed, forbidden, deleted, and a minimal `conflict` state that keeps the text)
  - `Ctrl/Cmd+S`
  - unsaved-changes guard (`beforeunload`)
  - pt-BR messages from contracts/pages-api.md
- [X] T018 [US1] `frontend/src/editor/index.ts`: `openPageEditor`/`preloadPageEditor` with a dynamic `import('./PageEditor')` (a separate chunk, R10), `EditorHandle`, host show/hide, focus management
- [X] T019 [US1] `frontend/src/editor/editor.css`: editing surface, using the shell's existing CSS tokens; `prefers-reduced-motion` respected; visible focus
- [X] T020 [US1] Shell integration in `frontend/index.html` (`<div id="editor-root" hidden>`) and `frontend/src/main.ts`:
  - an "Editar" button `#edit-page` in `renderPage`
  - the `openPageEditor` call
  - `requestClose()` before navigation, search and logout
  - focus `#edit-page` after the re-render that follows `onClose`
  - CSS hiding the reading view while `body[data-editing]` is set
  
  Request Clara's review.

**Checkpoint**: MVP. A member edits and saves a page; untouched content and anchors are unchanged.

---

## Phase 4: User Story 2 - Recover from a version conflict (P1)

**Independent Test**: quickstart §3.

### Tests (write first, must fail)

- [X] T021 [P] [US2] `frontend/tests/component/ConflictScreen.test.tsx`:
  - shows both versions with the differences marked
  - **discard** loads the published version and removes the draft
  - **continue** loads the published version, keeps "Sua versão" in a side panel, and the next save uses the new etag
  - **replace** opens a confirmation naming the last editor and time; cancel saves nothing; confirm saves with the **new** etag
  - fully keyboard operable; axe has no violations

### Implementation

- [X] T022 [US2] `frontend/src/editor/ConflictScreen.tsx`: `diffLines` from `diff`, two columns at ≥ 900 px and unified below, the three actions, and the confirmation dialog (R6)
- [X] T023 [US2] Wire `VersionConflictError` in `PageEditor.tsx`: fetch the published page and `getPublicProfile(updatedBy)`, move to `conflict`, and `report('editor.conflict')`

---

## Phase 5: User Story 4 - Keep comments and wikilinks working (P1)

**Independent Test**: quickstart §5.

### Tests (write first, must fail)

- [ ] T024 [P] [US4] `frontend/tests/unit/codec/stability.test.ts`:
  - 20 consecutive random edit-and-encode cycles on a page with anchored blocks
  - every surviving block keeps its anchor and no anchor is duplicated (SC-003)
- [ ] T025 [P] [US4] `frontend/tests/component/commentWarning.test.tsx`:
  - deleting blocks whose anchors have comments shows a warning before saving and lists how many comments are affected (FR-009)
  - blocks without comments delete silently
- [ ] T026 [P] [US4] `frontend/tests/component/wikilinks.test.tsx`:
  - typing `[[` opens the picker, and search results show titles
  - choosing one inserts `[[<slug>]]`
  - Escape closes it, leaving the typed text

### Implementation

- [ ] T027 [US4] `frontend/src/editor/wikilinks.ts`: a `SuggestionMenuController` with trigger `[[`, `searchPages` debounced 200 ms, inserting `[[slug]]` (R8)
- [ ] T028 [US4] Comment-anchor warning in `PageEditor.tsx`: load `listPageCommentAnchors` on open, and compute anchors that would be deleted before saving

---

## Phase 6: User Story 3 - Never lose a draft (P2)

**Independent Test**: quickstart §4.

### Tests (write first, must fail)

- [ ] T029 [P] [US3] `frontend/tests/unit/drafts.test.ts`:
  - key `germinawiki.draft.<userId>.<pageId>.<tabId>` (`tabId` from `sessionStorage`), so two tabs never overwrite each other
  - debounced write; flush on `pagehide`
  - removed after save or discard
  - `clearDrafts(userId)` removes only that member's keys
  - unreadable or invalid drafts are ignored and removed
  - storage throwing does not break editing
- [ ] T030 [P] [US3] `frontend/tests/component/DraftBanner.test.tsx`: offers the newest draft across tabs, with its time and "e mais N rascunhos"; discarding removes only that one; restoring a draft whose `baseEtag` is stale leads to the conflict screen at the next save
- [ ] T031 [P] [US3] `frontend/tests/component/ReauthDialog.test.tsx`:
  - a 401 on save opens sign-in inside the editor; success retries the same payload
  - cancel keeps the draft and calls `onSignedOut`

### Implementation

- [ ] T032 [P] [US3] `frontend/src/editor/drafts.ts` (data-model `Draft`: `title`, `content`, `baseEtag`, `savedAt`; per-tab key)
- [ ] T033 [US3] `frontend/src/editor/DraftBanner.tsx` and its wiring in `PageEditor.tsx`
- [ ] T034 [US3] `frontend/src/editor/ReauthDialog.tsx`, reusing `login()` from `backend-api.ts`, wired to the `reauth` state
- [ ] T035 [US3] Call `clearDrafts(userId)` in the shell's `logout()` in `frontend/src/main.ts` (Clara's review)

---

## Phase 7: User Story 5 - Add images to a page (P3)

**Independent Test**: quickstart §6.

### Tests (write first, must fail)

- [ ] T036 [P] [US5] `frontend/tests/unit/images.test.ts` (stubbed `fetch`):
  - rejects types other than `image/png`, `image/jpeg`, `image/webp`, `image/gif` and sizes outside 1–5,242,880 before any request
  - runs request → PUT with exactly the returned headers → confirm
  - returns `<API base>` + `url`; maps 409 and network errors to messages

### Implementation

- [ ] T037 [US5] `frontend/src/editor/images.ts` and the `uploadFile` option in `PageEditor.tsx` (R9)

---

## Phase 8: Polish & cross-cutting

- [ ] T038 [P] Large-page check: a 2,000-line fixture test in `frontend/tests/unit/codec/performance.test.ts` (decode + encode under 500 ms in jsdom), plus a manual check of SC-005 per quickstart §7
- [ ] T039 [P] `README.md`: an editor section (how to edit, conflict behaviour, the stored anchor format) linking this spec
- [ ] T040 Build check: `npm run build` produces a separate editor chunk, and the main chunk contains no BlockNote (quickstart §1)
- [ ] T041 Run quickstart §2–§7 against production with a QA page and record the results here; then clean up
- [ ] T042 Ask Clara for a PATCH amendment of constitution IV ("HTTP 409" → "a version conflict (HTTP 409 or 412)"), or ask Camilla to return 409 (plan.md, Constitution Check note). In the same amendment, propose `report()` (research R14) as the project's logging mechanism for principle V.

## Dependencies

- Setup → Foundational (codec + client) → US1 (MVP) → US2, US4 and US3 in any order (each needs the US1 editor) → US5 → Polish
- Within each phase: tests → implementation; `[P]` tasks touch different files
- Shell-file tasks (T013, T020, T035) need Clara's review before merging

## Parallel examples

- Foundational tests T005–T008 together; then T009, T012, T013 and T014 together (T010 → T011 are sequential)
- US4 tests T024–T026 together
- US3 tests T029–T031 together; T032 alongside T034

## Implementation Strategy

1. **MVP** = Phases 1–3. Pages can be edited safely, with anchors kept and untouched content byte-identical. Demo, then continue.
2. Add the conflict screen (US2) before announcing editing to the class, because the constitution forbids silent overwrites.
3. US4, US3 and US5 follow, each shippable on its own.
4. Commits map to task ids (`feat(editor): … (T017)`), one logical change each.
