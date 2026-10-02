# Quickstart: Validate the Page Editor

**Feature**: [spec.md](./spec.md) | Contracts: [editor-mount](./contracts/editor-mount.md), [pages-api](./contracts/pages-api.md)

## Prerequisites

- Node 22, then `npm ci` at the repository root
- A member account (ask the backend owner; test accounts are shared privately, never in the repository)
- `VITE_API_BASE_URL` pointing at the API (production is the only environment): `export VITE_API_BASE_URL=https://ih744ae7njca2on6vmsuutp7p40yosgh.lambda-url.sa-east-1.on.aws`
- Testing creates data in production. Use a page titled `QA …` in a `QA …` folder, and delete both at the end.

## 1. Automated checks

```bash
npm run typecheck
npm test            # codec, drafts, API contract, components (+ axe), mount integration
npm run build       # the editor must be a separate chunk: dist/assets/editor-*.js
```

Expected: everything passes, and the main chunk doesn't contain BlockNote. Check with `grep -L blocknote frontend/dist/assets/index-*.js`, which should print the file name.

## 2. Edit and save (US1)

`npm run dev` → http://localhost:3000 → sign in → open the QA page → **Editar**.

1. Time it (SC-001: under 30 s from "Editar" to saved). Change the title and a paragraph, then press `Ctrl+S`. You should see "Salvo" announced, the reading view showing the change, and the version increased by 1.
2. Open **Editar**, change nothing, and look at the save control. It should be disabled ("Nada para salvar").
3. Change text, then click **Cancelar**. A confirmation should appear; choosing "Descartar" restores the reading view unchanged.

## 3. Conflict (US2)

Open the QA page in two browsers (or a private window), both in **Editar**.

1. Save a change in A, then save a different change in B. B should show the conflict screen, with both versions and differences highlighted.
2. **Descartar minhas alterações** should show A's version.
3. Repeat, choose **Continuar editando**: you should be editing A's version with B's text in the side panel, and the next save should succeed.
4. Repeat, choose **Substituir pela minha versão**: a confirmation names A's member and time. **Cancelar** should save nothing; **Confirmar** should publish B's text.

## 4. Drafts and session expiry (US3)

1. Type in edit mode and close the tab. Reopen the page and click **Editar**: the draft should be offered with its time. Restore it.
2. Discard the draft, then reopen: no offer.
3. In DevTools → Application → Session Storage, delete `germinawiki.auth-session` (simulates expiry), then save. The sign-in dialog should appear inside the editor; after signing in, the save completes.
4. With a draft kept, log out. `localStorage` should contain no `germinawiki.draft.*` keys.

## 5. Anchors and wikilinks (US4)

1. With a member token, create a comment on the QA page's second block (`POST /api/comments` with that block's anchor UUID from the content).
2. Edit and save only the first block. `GET /api/pages/{id}` should show the second block's `<!--b:…-->` unchanged, and `GET /api/comments/{id}` should still return 200.
3. Delete the commented block and save. A warning should say comments will lose their place before the save happens.
4. Type `[[`, then part of a page title, and pick it. The saved content should contain `[[<slug>]]`, and `GET /api/pages/{id}/wikilinks` should list the target.
5. A page whose content has raw HTML: that part should show as "Markdown avançado", and saving without touching it should leave it byte-identical.

## 6. Images (US5)

1. Insert a PNG under 5 MB. Upload progress should appear, then the image.
2. Save, then read the page as another member: the image loads (`/api/images/{id}` redirects to R2).
3. Try a `.svg` or a file over 5 MB: it should be refused before uploading, with the allowed types and limit named.

## 7. Accessibility and performance

- Do the whole of §2–§4 with the keyboard only. Focus should always be visible, and statuses should be announced (check with a screen reader or the DevTools accessibility tree).
- Turn on `prefers-reduced-motion` in DevTools rendering. There should be no animated transitions.
- Paste a 2,000-line Markdown page as content, save, then reopen in edit mode. It should open in under 2 s, and typing should show no lag (DevTools Performance: no long tasks over 50 ms while typing).

## Cleanup

Delete the QA page and folder (`DELETE /api/pages/{id}`, `DELETE /api/folders/{id}`) and log out.
