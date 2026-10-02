# Implementation Plan: Page Editor

**Branch**: `002-page-editor` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-page-editor/spec.md`

## Summary

A block editor (BlockNote) that edits existing wiki pages inside the current workspace. The page's Markdown goes through a **segment-preserving codec** (research R2, R3): untouched content is written back byte for byte, comment anchors travel as block IDs, and only edited segments are re-serialized. A spike showed that BlockNote's own Markdown conversion deletes anchors and merges blocks, so this is required. Saves send the page `ETag` as `If-Match`; a 409 or 412 opens a conflict screen with a diff and three explicit choices. Drafts survive tab closes and the 15-minute session expiry. `[[` opens a page picker. Images upload straight to R2 through the existing image API. The editor is a lazily loaded React component that the plain-TypeScript shell opens through one function.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), React 19, Node 22 for tooling

**Primary Dependencies**:
- `@blocknote/core`, `@blocknote/react`, `@blocknote/ariakit` 0.55.x (R1)
- `marked` 18, used only for its lexer and for HTML comparison (R3, R4)
- `diff` 9 (R6)
- existing: Vite 6, `@vitejs/plugin-react` 5

**Storage**: the backend pages API (Markdown, `ETag`/`If-Match`); `localStorage` for drafts (R7); R2 for images through the backend (R9)

**Testing**: Vitest 2 with `jsdom`, `@testing-library/react` and `@testing-library/user-event`, plus `vitest-axe` (R13)

**Target Platform**: current Chrome, Firefox, Safari and Edge on desktop; usable on tablets. The app is a static SPA on Firebase Hosting.

**Project Type**: web application (frontend only; the backend is in `ms-germina-wiki`)

**Performance Goals**: a 2,000-line page opens in edit mode in under 2 s and typing has no perceptible delay (SC-005); the reading path doesn't load the editor (R10)

**Constraints**:
- $0 hosting (static, no server)
- UI text in pt-BR
- keyboard-operable, `prefers-reduced-motion` respected
- no page content or tokens in logs
- under 3 GB free disk on the development machine (no Playwright browsers)

**Scale/Scope**: about a dozen members; pages up to a few thousand lines; one editor open per tab

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | How this plan complies | Status |
|---|---|---|
| I. Ownership and scope | `editor-ui` belongs to Mancini (ownership table). Shell edits are limited to the mount call, an "Editar" button, the `#editor-root` host and draft cleanup on logout (R11). Clara reviews them. Page creation stays in her flow. | ✅ |
| II. Contracts before integration | [contracts/editor-mount.md](./contracts/editor-mount.md) (shell ↔ editor) and [contracts/pages-api.md](./contracts/pages-api.md) (editor ↔ backend, including the actual **412** conflict status) come before any code. The anchor format is shared with comments-ui and is documented there. | ✅ |
| III. Testable workflows | Codec unit tests (largest suite), API contract tests, component tests for save, conflict, draft and re-authentication, and a mount integration test (R13). | ✅ |
| IV. Security and data integrity | The server decides permissions, and 403 is handled. Saves always carry `If-Match`, and conflicts are recoverable. Override requires explicit confirmation (clarified). Pasted content is reduced to supported blocks. Anchors can't be forged or duplicated (R3). Nothing is dropped silently (R4). | ✅ (see note) |
| V. Simple, accessible, observable | One shared API client (R12). One mount function. Keyboard and screen-reader paths for every action. Structured logs without content (R14). | ✅ |

**Note on IV**: the constitution says conflicts arrive as HTTP **409**, but the pages API returns **412 Precondition Failed** (verified in production). The editor treats both as a conflict, so the principle's intent is met. Aligning the wording is a PATCH amendment for Clara, or a backend change for Camilla. It is recorded here and doesn't block this feature.

**Note on V**: the project has no logging or error-reporting mechanism yet. The editor's structured `report()` events (research R14) are the first one; T042 proposes that the shell adopt the same function.

**Post-design re-check (after Phase 1)**: no violations, so no Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/002-page-editor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── editor-mount.md      # shell ↔ editor
│   └── pages-api.md         # editor ↔ backend (pages, search, images)
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/
├── index.html                       # + <div id="editor-root"> (shell host, Clara)
├── src/
│   ├── main.ts                      # + "Editar" button, openPageEditor call, draft cleanup on logout (Clara)
│   ├── services/
│   │   └── backend-api.ts           # + getPageForEdit, savePage, VersionConflictError, image calls (R12)
│   └── editor/                      # editor-ui (Mancini)
│       ├── index.ts                 # openPageEditor(): lazy-loads the React editor (contract)
│       ├── PageEditor.tsx           # editing surface: title, BlockNote, save bar
│       ├── ConflictScreen.tsx       # diff + 3 choices (R6)
│       ├── ReauthDialog.tsx         # in-editor sign-in on 401 (R7)
│       ├── DraftBanner.tsx          # restore or discard a kept draft (R7)
│       ├── codec/
│       │   ├── decode.ts            # Markdown → segments + blocks (R3, R4)
│       │   ├── encode.ts            # blocks → Markdown, untouched segments verbatim (R3)
│       │   └── anchors.ts           # anchor parsing, neutralising, de-duplication
│       ├── blocks/rawMarkdown.tsx   # custom block for content BlockNote can't represent (R4)
│       ├── wikilinks.ts             # "[[" suggestion menu (R8)
│       ├── images.ts                # uploadFile through the image API (R9)
│       ├── drafts.ts                # localStorage drafts (R7)
│       ├── report.ts                # structured, content-free logging (R14)
│       └── editor.css
└── tests/
    ├── unit/codec/                  # decode, encode, anchors, 20-cycle stability
    ├── unit/drafts.test.ts
    ├── contract/pages-api.test.ts   # stubbed fetch: ETag/If-Match, 409/412, 401, 403, 404, 428
    ├── component/                   # PageEditor, ConflictScreen, ReauthDialog, DraftBanner (+ axe)
    └── integration/mount.test.ts    # openPageEditor ↔ shell host contract
```

**Structure Decision**: the single web app in `frontend/`, keeping Clara's layout (`src/services`, `frontend/tests`). Everything owned by this feature lives under `frontend/src/editor/`, so ownership is visible in the tree. Shared code changes only in the API client.

## Complexity Tracking

No constitution violations. The codec is the only unusual piece. It exists because the spike showed the simpler option (BlockNote's own Markdown conversion) corrupts pages (research R2).
