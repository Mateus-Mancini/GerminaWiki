# Feature Specification: Page Editor

**Feature Branch**: `002-page-editor`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "editor-ui (owner: Mancini): a Notion-style block editor (BlockNote) to edit wiki pages, save them, and handle version conflicts with a dedicated screen. Pages are stored as Markdown; comment anchors embedded in the content (`<!--b:<uuid>-->`) and `[[wikilinks]]` must survive edits. Builds on 001-wiki-workspace (US3, FR-008) and the backend pages API."

## Context

`001-wiki-workspace` (owner: Clara) defines the workspace and lists page editing under User Story 3, assigning `editor-ui` to Mancini (constitution, Product Ownership). This feature specifies that editor in detail: how a member opens a page for editing, saves it, recovers from a version conflict, and keeps the content that other features depend on (comment anchors, wikilinks) intact. Creating pages from the subject view ("Contribuir") stays in Clara's workspace flow; this feature only edits pages that already exist.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit and save a page (Priority: P1)

A signed-in member reading a page chooses to edit it, changes its text and title directly on the page (headings, paragraphs, lists, quotes, code, links) in a document-like editor, and saves. The page then shows the saved content to everyone.

**Why this priority**: Editing is the core of a wiki. Without it the wiki is read-only, and every other editor capability depends on this flow.

**Independent Test**: With a member account and an existing page, open the page, enter edit mode, change a heading and a paragraph, save, reload the page and see the change. Can be tested without conflicts or images.

**Acceptance Scenarios**:

1. **Given** a signed-in member viewing a page, **When** they choose "Editar", **Then** the page opens in the editor with its current title and content, formatted as when reading, and the cursor is placed in the content.
2. **Given** an editing session with changes, **When** the member saves (button or keyboard shortcut), **Then** the change is stored, the member sees a clear confirmation, and the page leaves edit mode showing the saved version.
3. **Given** an editing session without changes, **When** the member looks at the save control, **Then** it shows there is nothing to save and saving does not create a new version.
4. **Given** an editing session with unsaved changes, **When** the member tries to leave (cancel, navigate to another page, sign out, or close the tab), **Then** they are warned and may stay, or leave and discard the changes.
5. **Given** a save fails for a reason other than a conflict or an expired session (network failure, server error), **When** the failure is reported, **Then** the member's changes stay in the editor, the message says what happened in plain Portuguese, and the member can retry.

---

### User Story 2 - Recover from a version conflict (Priority: P1)

Two members edit the same page. The second one to save is told that the page changed since they started, sees what changed, and decides what to do without losing their own text. Nobody's work is silently overwritten.

**Why this priority**: The constitution (Principle IV) forbids silent overwrites and requires a recoverable conflict. With several students editing shared subject pages, conflicts are expected, and losing work would destroy trust in the wiki.

**Independent Test**: Open the same page in two browser sessions, save a change in the first, then save a different change in the second; the second session shows the conflict screen, and each resolution option behaves as described.

**Acceptance Scenarios**:

1. **Given** a member started editing version N of a page and someone else saved version N+1, **When** the member saves, **Then** the save is rejected, the member's text is kept, and a conflict screen explains that the page was changed by someone else in the meantime.
2. **Given** the conflict screen, **When** the member reviews it, **Then** they can see their version and the current published version side by side or with the differences highlighted, and copy any part of their own text.
3. **Given** the conflict screen, **When** the member chooses to discard their changes, **Then** the editor shows the current published version and their draft is removed.
4. **Given** the conflict screen, **When** the member chooses to continue editing on top of the current version, **Then** the editor loads the current published version with the member's text still available for copying, and the next save is checked against that new version.
5. **Given** the conflict screen, **When** the member chooses to replace the published version with theirs, **Then** they must confirm explicitly that the other person's changes will be lost before the save happens; without confirmation nothing is saved. [NEEDS CLARIFICATION: should "replace with my version" be offered at all?]

---

### User Story 3 - Never lose a draft (Priority: P2)

A member writing a long text loses their connection, their session expires, or the tab closes. When they come back to the page, their unsaved draft is offered back to them.

**Why this priority**: Sessions expire after 15 minutes and cannot be renewed silently, and students often edit on unstable connections. Without draft recovery, a long editing session can end in lost work, but the editor is usable without it, hence P2.

**Independent Test**: Start editing, type text, close the tab without saving, reopen the page and enter edit mode; the draft is offered. Separately, let the session expire during editing and save; the member signs in again and the save completes with the draft intact.

**Acceptance Scenarios**:

1. **Given** a member has unsaved changes, **When** the tab closes or the device goes offline, **Then** the draft is kept on that device for that page.
2. **Given** a kept draft for a page, **When** the same member edits that page again on the same device, **Then** they are offered to restore the draft or discard it, with the time it was last changed; if the page changed since the draft started, restoring goes through the conflict screen (User Story 2) at the next save.
3. **Given** a member's session expired while editing, **When** they save, **Then** they are asked to sign in again without leaving the editor, and after signing in the save is retried with the same content.
4. **Given** a draft was saved successfully or explicitly discarded, **When** the member edits the page again, **Then** no draft is offered.
5. **Given** a member signs out, **When** sign-out completes, **Then** drafts stored on that device for that member are removed, so the next person using a shared school computer cannot read them.

---

### User Story 4 - Keep comments and wikilinks working after edits (Priority: P1)

Comments are attached to specific blocks of a page, and pages link to each other with wikilinks. When a member edits a page, the blocks they did not delete keep their comments, and wikilinks keep linking.

**Why this priority**: Comments (JP) and wikilinks (Camilla) are separate features that rely on the page content. If editing breaks them, every save silently damages other people's work, which violates the constitution's data integrity principle.

**Independent Test**: Take a page with a comment on its second paragraph and a wikilink; edit the first paragraph and save; the comment is still on the second paragraph and the wikilink still points to its target.

**Acceptance Scenarios**:

1. **Given** a page whose blocks carry comment anchors, **When** a member edits other blocks and saves, **Then** every untouched block keeps its anchor and its comments.
2. **Given** a block with an anchor, **When** a member edits the text of that block (without deleting it), **Then** the block keeps its anchor.
3. **Given** a block with an anchor, **When** a member deletes that block, **Then** the anchor is removed with it, and if the block had comments the member is told before saving that those comments will lose their place.
4. **Given** a page with `[[slug]]` wikilinks, **When** it is edited and saved, **Then** the wikilinks are stored exactly as written and still resolve to their targets.
5. **Given** a member types a wikilink while editing, **When** they type the opening brackets, **Then** they can pick an existing page by title, and the link is stored by that page's slug.
6. **Given** a page contains content the editor cannot represent faithfully, **When** it is opened for editing, **Then** that content is kept unchanged on save or the member is warned before editing; it is never dropped silently.

---

### User Story 5 - Add images to a page (Priority: P3)

While editing, a member adds an image to the page from their device. It uploads, appears in place, and is visible to readers after saving. [NEEDS CLARIFICATION: is image upload part of this feature?]

**Why this priority**: Images make subject pages far more useful (diagrams, photos of the board), and the storage backend is ready. The editor is complete without them, so P3.

**Independent Test**: In edit mode, insert a PNG from the device, see upload progress, save, and see the image when reading the page as another member.

**Acceptance Scenarios**:

1. **Given** edit mode, **When** a member inserts an image of an allowed type and size, **Then** it shows upload progress, then the image in place.
2. **Given** a file that is not an allowed image type or exceeds the size limit, **When** the member tries to insert it, **Then** it is rejected before uploading, with a message naming the allowed types and limit.
3. **Given** an image upload fails, **When** the failure is reported, **Then** the rest of the editing session is unaffected and the member can retry or remove the placeholder.

---

### Edge Cases

- The page is deleted by someone else while a member is editing it: saving reports that the page no longer exists, and the member can copy their text; nothing is recreated silently.
- The member's account is not allowed to edit (server refuses): the editor shows that they lack permission and keeps their text for copying; the edit action is not shown when the server is known to refuse.
- The page is very long (thousands of lines): opening and typing stay responsive (see SC-005).
- The member pastes formatted text from another site or document: the result contains only formatting the wiki supports; scripts, styles and embedded objects are removed.
- The member pastes text containing something that looks like a comment anchor: it is not treated as an anchor and cannot hijack another block's comments.
- Two blocks end up with the same anchor (e.g. after duplicating a block): only one keeps it; the copy gets none.
- The API is waking up from idle (cold start) when the member saves: the save waits and succeeds, with a visible "saving" state, rather than failing on the first slow response.
- The member edits the title to empty or to more than the allowed length: saving is blocked with an inline message.
- The member opens the same page for editing in two tabs: the tabs are treated like two members (User Story 2 applies), and drafts do not overwrite each other silently.
- Keyboard-only and screen-reader use: every action (edit, save, cancel, conflict choices, draft restore) is reachable and announced.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Signed-in members MUST be able to switch a page they are reading into edit mode and back, without leaving the page's address.
- **FR-002**: The editor MUST let members edit the page title and content as structured blocks (headings, paragraphs, bulleted and numbered lists, quotes, code blocks, links), with formatting shown as it will be read.
- **FR-003**: Saving MUST send the content together with the version the member started from, so the server can reject saves based on an outdated version; the client MUST NOT overwrite a newer version without the member's explicit confirmation.
- **FR-004**: The system MUST treat a server response meaning "the page changed since that version" as a version conflict and show the conflict screen (User Story 2), keeping the member's text.
- **FR-005**: The conflict screen MUST show the member's version and the current published version with the differences identifiable, and offer at least: discard my changes, and continue editing on top of the current version.
- **FR-006**: Unsaved changes MUST be kept on the member's device per page and per member until saved, discarded, or the member signs out, and MUST be offered back when editing that page again.
- **FR-007**: When the session expires during editing, the member MUST be able to sign in again without leaving the editor, and the pending save MUST then complete or report a conflict; the draft MUST never be lost because of expiry.
- **FR-008**: The editor MUST preserve each comment anchor attached to a block that still exists after editing, MUST NOT create duplicate anchors, and MUST NOT accept anchors from pasted text.
- **FR-009**: Before saving, the member MUST be told when deleted blocks carried comments.
- **FR-010**: The editor MUST store wikilinks in the `[[slug]]` form understood by the wikilinks feature and MUST offer a page picker when a member starts a wikilink.
- **FR-011**: Content the editor cannot represent MUST be preserved unchanged or reported to the member before editing; it MUST NOT be dropped silently.
- **FR-012**: Leaving edit mode, navigating away, signing out or closing the tab with unsaved changes MUST ask for confirmation.
- **FR-013**: Pasted content MUST be reduced to the formatting the wiki supports; no scripts, styles, event handlers or embedded objects may be stored.
- **FR-014**: Every save outcome (saved, conflict, session expired, permission denied, page deleted, network or server failure) MUST have a distinct, actionable message in Portuguese, announced to assistive technology.
- **FR-015**: All editor actions MUST be operable by keyboard, with visible focus and state, and the editor MUST respect the reduced-motion preference.
- **FR-016**: Failed saves, conflicts and authorization failures MUST be reported through the project's error-reporting mechanism without including page content or credentials (constitution Principle V).
- **FR-017**: The editor MUST be mountable by the app shell as a self-contained component with a documented contract (inputs, events, loading and error states), without the shell depending on its internals (constitution Principle II).
- **FR-018**: Members MUST be able to add images while editing, uploaded directly to the image storage and recorded on the page, within the allowed types and size. *(User Story 5; subject to clarification.)*

### Key Entities

- **Page**: an existing wiki page with a title, Markdown content, a version number that increases on every save, and the folder it belongs to. The editor reads and writes title and content only.
- **Page version**: the version the member started editing from; sent with every save and replaced by the new version after a successful save.
- **Block anchor**: a stable identifier attached to a content block, stored inside the page content, to which comments refer.
- **Draft**: the member's unsaved title and content for one page, the version it was based on, and when it last changed; kept only on the member's device.
- **Conflict**: the pair (member's draft, current published version) presented when a save is rejected because the page changed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can open a page, change a paragraph and save it in under 30 seconds on first use, without instructions.
- **SC-002**: In concurrency tests, 100% of conflicting saves are detected, and in 0 cases is either member's text lost or overwritten without explicit confirmation.
- **SC-003**: After 20 consecutive edit-and-save cycles on a page with commented blocks, 100% of comments on surviving blocks are still attached to the same blocks.
- **SC-004**: Closing the tab, losing the connection, or letting the session expire during editing loses no typed text in 100% of test runs.
- **SC-005**: On a page of 2,000 lines, edit mode opens in under 2 seconds and typing shows no perceptible delay on a typical school laptop.
- **SC-006**: Every editor action can be completed with keyboard only, and the editor has no critical or serious automated accessibility violations.
- **SC-007**: A page saved without changes to its text is byte-for-byte identical to its previous content (opening and saving does not reformat or alter content).

## Assumptions

- Any signed-in member may edit any page; the server is the authority and may refuse (e.g. future admin-only pages), and the editor handles that refusal. Role-based editing rules are out of scope.
- Pages are created through the existing workspace flows (e.g. "Contribuir"); creating, moving, renaming the address (slug) of, and deleting pages are out of scope for this feature.
- Page content is Markdown, and comment anchors are stored inside it as `<!--b:<uuid>-->` immediately before the block they belong to (backend data model; comments API).
- The pages API returns the current version with every read and save, requires it on every save, and rejects outdated saves. Today it answers outdated saves with HTTP 412 and the current version; the constitution names HTTP 409. The editor treats both as a version conflict, and the planning phase records this contract.
- Real-time collaborative editing (several people typing in the same document live) is out of scope; conflicts are resolved at save time.
- Version history and restoring older versions are out of scope (the backend keeps only the current version).
- Drafts live only on the device where they were typed; they are not synced across devices.
- The editor UI text is in Brazilian Portuguese, consistent with the rest of the app, and follows the project's visual direction (document-like editing in the style of Notion, reading in the style of Wikipedia).
- The sign-in screen and session handling are provided by the workspace (`001-wiki-workspace`); this feature reuses them for re-authentication.
