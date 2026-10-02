# Data Model: Page Editor

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

The editor owns no server data. These are the client-side shapes it works with, and the stored Markdown format it shares with other features.

## Page (server, read and written)

| Field | Type | Rules |
|---|---|---|
| `id` | UUID | read-only |
| `title` | string | required, 1–255 characters after trimming (save blocked inline otherwise) |
| `slug` | string | read-only here; used by wikilinks |
| `content` | Markdown string | written only through the codec |
| `version` | integer | read-only; increases by 1 per save |
| `folderId`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` | — | read-only; `updatedBy`/`updatedAt` are shown in the override confirmation |

Paired with **`etag`** (string, from the `ETag` response header, `"<id>-v<version>"`). This is the editor's expected version and is sent as `If-Match`.

## Stored content format (shared contract with comments-ui and wikilinks)

```text
<!--b:<uuid>-->
<top-level Markdown block: heading, paragraph, list, quote, code fence, table, image, …>

<!--b:<uuid>-->
<next block>
```

- An anchor is a line containing exactly `<!--b:<uuid>-->` (lowercase UUID). It belongs to the top-level block that **immediately follows** it.
- Blocks are separated by a blank line.
- Every block written by this editor gets an anchor. Older content without anchors stays valid, and its blocks gain anchors only when edited.
- Each anchor UUID appears at most once per page.
- Wikilinks are plain text `[[<slug>]]` inside blocks.
- Images are `![<file name>](<API base>/api/images/<imageId>)`.

## Segment (client, codec)

| Field | Type | Meaning |
|---|---|---|
| `anchor` | UUID or `null` | the anchor that preceded the segment in the stored content |
| `source` | string | the exact original Markdown of the segment |
| `blockIds` | string[] | IDs of the editor blocks created from it; the first equals `anchor` when present |
| `snapshot` | block JSON | the blocks as first loaded, for change detection |
| `faithful` | boolean | `false` → loaded as one `rawMarkdown` block (R4) |

**Encode rule**: if a segment's blocks are present, in order, and deep-equal to `snapshot`, write `source` as it was. Otherwise serialize the blocks. New blocks form new segments with fresh anchors; segments whose blocks are all gone are dropped with their anchors.

## EditSession (client)

| Field | Type |
|---|---|
| `pageId` | UUID |
| `etag` | string (expected version) |
| `baseContent` | string (content as loaded, for "nothing to save" and diffs) |
| `segments` | Segment[] |
| `status` | see state machine |
| `deletedAnchorsWithComments` | UUID[] (computed before save, FR-009) |

### Status state machine

```text
loading ──► editing ◄──────────────┐
               │ save              │
               ▼                   │
            saving ──200──► saved ─┘ (closes edit mode)
               │
               ├─409/412──► conflict ──discard──► editing (published version)
               │                     ├─continue─► editing (published version + side panel)
               │                     └─replace──► confirming ──yes──► saving (new etag)
               │                                              └─no───► conflict
               ├─401──► reauth ──signed in──► saving (same payload)
               ├─403──► forbidden (text kept for copying)
               ├─404──► deleted (text kept for copying)
               └─other/network──► failed ──retry──► saving
```

## Draft (client, `localStorage`)

Key: `germinawiki.draft.<userId>.<pageId>.<tabId>`, where `tabId` is a random ID kept in `sessionStorage` for the tab's lifetime, so two tabs editing the same page never overwrite each other's draft.

| Field | Type | Rules |
|---|---|---|
| `title` | string | |
| `content` | string | encoded Markdown (not editor JSON, so it stays readable across editor versions) |
| `baseEtag` | string | the version the draft started from; a mismatch at the next save leads to conflict |
| `savedAt` | ISO 8601 timestamp | shown in the restore banner |

Lifecycle: written 1 s after the last change and on `pagehide`; removed after a successful save, an explicit discard, or logout (every key with the member's prefix). An unreadable or invalid draft is ignored and removed. When editing starts, the banner offers the **newest** draft for that member and page across all tabs, and says how many others exist ("e mais N rascunhos"). Discarding removes only the one shown.

## Conflict (client)

| Field | Type |
|---|---|
| `mine` | `{ title, content }` |
| `published` | Page + its new `etag` |
| `lastEditor` | `{ name, at }` from `updatedBy` (resolved via `GET /api/users/{id}`) and `updatedAt` |
| `diff` | line diff of `mine.content` and `published.content` |
