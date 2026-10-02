# Contract: Shell ↔ Page Editor

**Owners**: Clara (shell, `frontend/src/main.ts`, `frontend/index.html`) and Mancini (`frontend/src/editor/`). Any change to this contract needs both owners' review.

## Host element

`frontend/index.html` contains `<div id="editor-root"></div>` as a **sibling** of `#root`. The shell never writes into `#editor-root`, and the editor never writes into `#root`. The shell replaces `#root` on every render, which would destroy a React tree mounted inside it.

## Entry point

```ts
// frontend/src/editor/index.ts. The React editor is loaded lazily on the first call.
export function openPageEditor(options: OpenPageEditorOptions): Promise<EditorHandle>;
export function preloadPageEditor(): void; // optional: call when a page view is idle

type OpenPageEditorOptions = {
  pageId: string;
  host: HTMLElement;                 // document.getElementById('editor-root')
  currentUser: { id: string; name: string };
  onClose: (result: { saved: boolean; page?: RemotePage }) => void;
  onSignedOut: () => void;           // re-authentication was cancelled; the shell shows its login
};

type EditorHandle = {
  hasUnsavedChanges(): boolean;
  requestClose(): Promise<boolean>;  // asks to confirm when there are unsaved changes; true = closed
};
```

## Behaviour

| Situation | Editor | Shell |
|---|---|---|
| Member clicks "Editar" on a page | — | calls `openPageEditor({ pageId, host, … })`; disables the button while the promise is pending |
| Opening | sets `host.hidden = false`, `document.body.dataset.editing = "true"`, shows a loading state in the main column, then moves focus to the start of the content (spec US1 scenario 1) | hides the reading view of the main column while `body[data-editing]` is set (CSS); keeps the sidebar |
| Load fails (404, 403, network) | shows the error in place with "Voltar" | — |
| Save succeeds and the member leaves | unmounts, hides `host`, removes `data-editing`, calls `onClose({ saved: true, page })` | replaces `selectedPage` with `page`, re-renders, then focuses `#edit-page` |
| Member cancels | confirms if there are unsaved changes, then calls `onClose({ saved: false })` | re-renders the reading view, then focuses `#edit-page` |
| Member navigates in the sidebar, searches or logs out while editing | — | first `await handle.requestClose()`; continues only if `true` |
| Tab closing with unsaved changes | registers `beforeunload` (browser prompt) and flushes the draft | — |
| Logout | — | calls `clearDrafts(userId)` from `frontend/src/editor/drafts.ts` |

## Accessibility

- Opening moves focus to the start of the content. Closing returns focus to the "Editar" button (`id="edit-page"`). The **shell** does this after its re-render, because the editor can't focus an element the re-render replaces.
- Status changes (saving, saved, conflict, errors) are announced through one `aria-live="polite"` region inside `host`; errors use `role="alert"`.
