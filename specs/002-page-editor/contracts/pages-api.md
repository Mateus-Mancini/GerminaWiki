# Contract: Page Editor ↔ Backend

Backend: `ms-germina-wiki` (pages: Camilla; comments: João Pedro; images: Mancini). Base URL `VITE_API_BASE_URL`. Every call sends `Authorization: Bearer <token>`. Statuses below were **verified against production on 2026-10-01** after ms-germina-wiki#31.

## Load a page for editing

`GET /api/pages/{id}` → `200` with a `Page` body and `ETag: "<id>-v<version>"` (readable by browsers: `Access-Control-Expose-Headers: etag`).

| Status | Editor behaviour |
|---|---|
| 401 | re-authentication |
| 404 | "Esta página não existe mais." |

## Save

`PATCH /api/pages/{id}` with headers `If-Match: <etag>` and `Content-Type: application/json`, and body `{ "title": string, "content": string }` (title omitted when unchanged).

| Status | Body | Editor behaviour |
|---|---|---|
| 200 | `Page` + new `ETag` | saved; keep the new `etag` |
| **412** | `{"error":"The page was modified by another request","currentVersion":"N"}` | **conflict** |
| 409 | (constitution wording; not currently returned) | **conflict** (same as 412) |
| 428 | missing `If-Match` | bug: report and show a generic failure (the editor always sends it) |
| 400 | invalid body or malformed tag | inline validation message |
| 401 | | re-authentication, then retry the same request |
| 403 | | "Você não tem permissão para editar esta página." |
| 404 | | page deleted while editing; text kept for copying |
| 5xx / network | | "Não foi possível salvar." with retry; text kept |

CORS: `If-Match` is allowed in preflight from the web app origin and `localhost:3000` (checked by the backend release workflow).

## Conflict details

`GET /api/pages/{id}` (new `ETag`) and `GET /api/users/{updatedBy}` → `{ id, name, avatarUrl, bio }` for "Atualizada por <name> às <hh:mm>".

## Wikilink picker

`GET /api/search?q=<text>` → `Page[]`; the picker shows `title` and inserts `[[<slug>]]`.

## Comment anchors (read-only use)

`GET /api/comments?pageId=<id>&size=100&page=N` (max size 100) → `{ items: [{ anchor: { blockId }, … }], page, size, … }`, following pages until exhausted. The `anchor.blockId`s tell the editor which anchors carry comments, for the FR-009 warning before deleting such blocks.

## Images

1. `POST /api/pages/{id}/images/uploads` `{ "contentType": "image/png"|"image/jpeg"|"image/webp"|"image/gif", "size": 1..5242880 }` → `201 { uploadKey, uploadUrl, method: "PUT", headers, expiresAt }`
2. `PUT <uploadUrl>` with exactly the returned headers (including `Content-Type`) → `200` (direct to R2, never through the API)
3. `POST /api/pages/{id}/images` `{ "uploadKey", "fileName" }` → `201 { id, pageId, fileName, contentType, size, uploadedBy, createdAt, url }`, where `url` is the relative path `/api/images/{id}`
4. Stored URL: `<API base>` + `url` (absolute, because the web app and API have different origins; public, `302` to a short-lived signed URL)

Errors: 400 type or size (prevented client-side first), 403/404 from confirm, 409 when the uploaded object doesn't match the declared type or size.
