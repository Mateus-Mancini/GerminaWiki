# Research: Page Editor

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-01

Each section records a decision, why it was made, and the alternatives considered. Findings marked *spike* were measured with BlockNote 0.55.0 on Node 22, not taken from documentation.

## R1. Editor library: BlockNote 0.55 with the Ariakit UI package

- **Decision**: `@blocknote/core`, `@blocknote/react` and `@blocknote/ariakit` 0.55.x.
- **Rationale**: BlockNote is the editor named by the constitution's ownership table. 0.55 declares React `^18 || ^19` as its peer dependency, so it runs on our React 19. Of its three UI packages, Ariakit needs no CSS framework. Mantine would add `@mantine/core`, and shadcn requires Tailwind 4, which this app doesn't use. Ariakit also leaves the visual design to our own styles, which the design pass needs. The collaboration peer dependencies (`yjs`, `y-prosemirror`, `y-protocols`) are declared optional, and we don't use real-time collaboration (spec Assumptions). The license is MPL-2.0, which permits use in this project unmodified.
- **Alternatives**: plain `<textarea>` Markdown (Clara's "Contribuir" dialog): no structured editing, which fails FR-002. Tiptap or ProseMirror directly: BlockNote is a thin layer over them that already provides the block model, slash menu and file blocks. Writing those ourselves would be more code for the same result.

## R2. Markdown round trip *(spike)*: never let BlockNote re-serialize the whole page

- **Finding**: `tryParseMarkdownToBlocks` followed by `blocksToMarkdownLossy` on a representative page:
  - **dropped every `<!--b:uuid-->` anchor** (0 of 2 kept);
  - **merged the heading and the next paragraph into one line** (`# Título Parágrafo…`), because the HTML comment between them confused the block split;
  - rewrote untouched syntax (`-` → `*`, `---` → `***`, padded table cells) and stripped inline HTML (`<span>`);
  - kept `[[wikilinks]]` as plain text, which is correct.
- **Consequence**: a naive integration would corrupt page structure and orphan every comment on the first save. The comments API also rejects edits to comments whose anchor disappeared (comments spec, edge cases). This violates constitution Principle IV and spec FR-008, FR-011 and SC-007.
- **Decision**: a **segment-preserving codec** (R3) owns the conversion. BlockNote only ever converts the segments the member actually changed.

## R3. Segment-preserving codec *(spike)*

- **Decision**:
  1. **Load**: split the stored Markdown into top-level segments with a CommonMark lexer (`marked` 18's `lexer`, which returns each top-level token's exact source as `raw`). A token that is exactly an anchor comment (`<!--b:<uuid>-->`) attaches its UUID to the next segment and is not itself a segment.
  2. Parse each segment's source on its own with `tryParseMarkdownToBlocks`. Give the segment's first block the anchor UUID as its BlockNote block `id`, so anchors travel with blocks through every edit, move and split.
  3. Record for each segment: its anchor, its original source, the IDs of its blocks, and a snapshot of those blocks.
  4. **Save**: walk the editor's top-level blocks in order and regroup them by the segment their IDs came from.
     - A segment whose blocks are unchanged (same IDs, same order, deep-equal to the snapshot) is written back as its **original source, byte for byte**.
     - A changed segment is serialized by `blocksToMarkdownLossy`.
     - Consecutive new blocks form new segments: one per block, except that runs of list items of the same kind stay one segment, so lists aren't split.
  5. **Anchors on save**: keep the segment's anchor; give every new segment a fresh UUID (`crypto.randomUUID()`), so any block can receive comments; drop anchors of deleted segments. Segments are joined with a blank line, and the anchor sits on the line before the segment, which is the format the backend validates (`content.contains("<!--b:" + id + "-->")`).
- **Spike result**: anchors kept 3 of 3. Only the edited paragraph changed; lists, the table and inline HTML were untouched. Saving without edits reproduced the input **byte-identical**.
- **Rationale**: this meets FR-008, FR-011 and SC-007 with no fork of BlockNote, and the codec is a pure function pair (`decode`, `encode`) that is easy to unit-test exhaustively. It is the most important test target of the feature.
- **Pasted or typed anchors (FR-008, edge cases)**: only the codec writes anchors, and only from block IDs. When encoding, any text inside a block or a raw segment that matches the anchor pattern is neutralised (`<!--b:` becomes `&lt;!--b:`), so typed or pasted text can't create or steal an anchor. Block IDs created by paste or duplication are new random IDs. Before encoding, any repeated ID keeps its anchor only at its first occurrence.
- **Alternatives**:
  - A custom BlockNote serializer that emits anchors: still re-serializes untouched content, so SC-007 fails.
  - Storing BlockNote JSON instead of Markdown: breaks the backend data model, full-text search and the other features' contracts.
  - Anchors as invisible inline content: they would be lost whenever a member retypes a block.

## R4. Content the editor can't represent (FR-011)

- **Decision**: at load, a segment is **faithful** if converting its source to blocks and back gives the same HTML when both versions are rendered with `marked` (compared by meaning, not by bytes). A segment that isn't faithful (raw HTML, footnotes, reference-style links, unusual nesting) is loaded as a custom **`rawMarkdown` block**. That block shows the source in a monospaced editable area labelled "Markdown avançado", and encoding writes its text back exactly.
- **Rationale**: nothing is dropped silently, and members can still edit such content. Faithful segments get the full block editor.
- **Alternatives**: a read-only "can't edit this page" mode (too restrictive; most pages are mixed), or a warning dialog alone (the content would still be lost on save).

## R5. Version checks and conflict detection

- **Contract verified in production (2026-10-01)**:
  - `GET /api/pages/{id}` returns `ETag: "<id>-v<version>"`.
  - `PATCH` with `If-Match` returns 200 and the new `ETag`.
  - A stale tag returns **412** `{"error":"The page was modified by another request","currentVersion":"N"}`.
  - A missing tag returns 428; a malformed tag returns 400.
  - Before ms-germina-wiki#31, browsers could neither send `If-Match` (CORS preflight) nor read `ETag`. #31 fixed both and added a release check.
- **Decision**: the editor keeps the `ETag` from the load or the last save, sends it as `If-Match`, and treats **412 and 409** both as a version conflict (spec Assumptions). The constitution names 409; the plan records the actual 412 so the contract is explicit (Principle II).
- **Alternatives**: building the tag from `version` in the body. That works, but couples the client to the tag's format, and the header is the HTTP contract.

## R6. Conflict screen

- **Decision**: on conflict, fetch the current page (`GET`, new `ETag`) and show a line diff of the two Markdown texts, made with `diff` (jsdiff 9, `diffLines`). It renders as two labelled columns ("Sua versão", "Versão publicada") on wide screens and a unified, highlighted list on narrow ones. Actions:
  - **Descartar minhas alterações**: load the published version and delete the draft.
  - **Continuar editando sobre a versão publicada**: load the published version, keep the member's text in a side panel to copy from, and use the new `ETag`.
  - **Substituir pela minha versão**: a confirmation names who last updated the page and when (`updatedBy` resolved through `GET /api/users/{id}`, `updatedAt`). Only then does it save with the *new* `ETag`.
- **Rationale**: this satisfies the spec's US2 and the clarified override rule. jsdiff has no dependencies and is small.

## R7. Drafts and expired sessions

- **Decision**:
  - Drafts go in `localStorage` under `germinawiki.draft.<userId>.<pageId>.<tabId>` (a per-tab ID, so two tabs never overwrite each other), holding `{ title, content (encoded Markdown), baseEtag, savedAt }`. Writes are debounced (1 s) and also flushed on `pagehide`/`visibilitychange`.
  - A draft is deleted after a successful save or an explicit discard.
  - The shell's logout removes every `germinawiki.draft.<userId>.*` key (US3 scenario 5).
  - A 401 on save opens an in-editor sign-in dialog that reuses the shell's `login()`, then retries the same save.
- **Rationale**: the session lasts 15 minutes and can't be refreshed (no refresh endpoint), so expiry during editing is routine. Drafts encoded as Markdown are small and stay readable even if the editor version changes. Every storage call is wrapped, so the editor works (without recovery) when storage is unavailable.
- **Alternatives**: `sessionStorage` (lost when the tab closes, which fails US3) or IndexedDB (unnecessary for text this size).

## R8. Wikilinks (FR-010)

- **Decision**: a BlockNote suggestion menu with the trigger `[[` (multi-character triggers are supported; the matcher compares the text before the cursor, longest trigger first). It queries `GET /api/search?q=` (debounced 200 ms) and inserts the plain text `[[<slug>]]`. Stored wikilinks stay plain text in blocks, so they round-trip unchanged, as R2 found.
- **Rationale**: the wikilinks API resolves `[[slug]]` only, not titles (verified in production: `[[Alvo QA]]` produced no link).

## R9. Images (US5, FR-018)

- **Decision**: BlockNote's `uploadFile` option runs the backend image flow:
  1. `POST /api/pages/{id}/images/uploads` `{contentType, size}`.
  2. `PUT` to the presigned R2 URL with the exact `Content-Type`.
  3. `POST /api/pages/{id}/images` `{uploadKey, fileName}`.
  4. Return `<API base>/api/images/{imageId}`.
  - Types and size are checked on the client first (PNG, JPEG, WebP, GIF; 1 B to 5 MiB, the backend limits), so invalid files are refused before uploading.
  - The stored Markdown is `![<file name>](<API base>/api/images/{id})`. That address is public and redirects to a short-lived signed URL, so `<img>` works for every reader.
- **Rationale**: the address must be absolute. Firebase Hosting can't proxy `/api/*` to a Lambda URL, and the Function URL stays stable across deploys because it is bound to the `live` alias.

## R10. Bundle size and loading

- **Decision**: the editor is a separate chunk loaded by dynamic `import()` the first time a member clicks "Editar"; reading pages never downloads it. The chunk is prefetched once the page view is idle.
- **Rationale**: BlockNote with ProseMirror is several hundred KB. Reading is the common path, and SC-005 only covers opening edit mode.

## R11. Mounting inside Clara's shell (FR-017)

- **Decision**: the shell renders by replacing `#root`'s `innerHTML` on every state change, which would destroy a React tree inside it. The editor therefore mounts in its own host element, `#editor-root`, a sibling of `#root` in `index.html`, through one function:
  - `openPageEditor(options): Promise<EditorHandle>` (contract in [contracts/editor-mount.md](./contracts/editor-mount.md)).
  - While editing, the shell keeps its sidebar, and the editor covers the main column as the page's edit mode.
  - Shell changes are limited to an "Editar" button in `renderPage`, one call, and the draft cleanup in `logout`. Each needs Clara's review (constitution, Development Workflow).
- **Alternatives**: rewriting the shell in React (Clara's decision, out of scope), or rendering the editor inside `#root` (destroyed on every re-render).

## R12. API client

- **Decision**: extend Clara's `frontend/src/services/backend-api.ts` with:
  - `getPageForEdit(id)`, returning `{ page, etag }`;
  - `savePage(id, {title, content}, etag)`, returning `{ page, etag }` and throwing a typed `VersionConflictError` on 409/412;
  - the three image calls.
  
  The private `request()` is extended to return response headers when asked. Errors keep using her `ApiRequestError`, so the shell and the editor share one client (Principle V: no duplicated logic).

## R13. Testing

- **Decision**: Vitest (already configured) with `jsdom` and `@testing-library/react` and `@testing-library/user-event`.
  - **Codec**: unit tests, the largest suite. It covers the anchors, the unchanged byte-identity, faithful versus raw segments, lists, code fences, tables, pasted duplicate IDs, and a 20-cycle edit-save loop (SC-003).
  - **API client**: contract tests with a stubbed `fetch` (`If-Match` and `ETag`, 409/412 → conflict, 401, 404, 428).
  - **Component**: tests for save, conflict, draft restore and re-authentication.
  - **Mount contract**: tests for the shell integration.
  - **Accessibility**: `vitest-axe` 0.1 on the editor chrome (dialogs, toolbar, conflict screen).
- **Not chosen**: Playwright end-to-end tests. Browser downloads would need about 500 MB, and the development machine has under 3 GB free; the quickstart covers the real-browser runs manually. Revisit if CI time allows.

## R14. Observability (Principle V, FR-016)

- **Decision**: no error-reporting service exists in the project. The editor logs structured `console.warn` and `console.error` events: `editor.save_failed`, `editor.conflict`, `editor.auth_expired` and `editor.forbidden`, with only `{pageId, status, version}`, never content or tokens. A single `report()` function lets a future service replace the logging without touching the callers.
