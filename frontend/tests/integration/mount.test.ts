import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { EditorApi } from '../../src/editor/PageEditor';

// contracts/editor-mount.md: the shell ↔ editor contract.
const page = { id: 'p1', title: 'Física', slug: 'fisica', content: 'Texto.\n', version: 1, folderId: 'f1' };
const api: EditorApi = {
  getPageForEdit: vi.fn(async () => ({ page, etag: '"p1-v1"' })),
  savePage: vi.fn(async () => ({ page: { ...page, version: 2 }, etag: '"p1-v2"' })),
  listPageCommentAnchors: vi.fn(async () => new Map()),
  getPublicProfile: vi.fn(async () => ({ id: 'u2', name: 'Ana', avatarUrl: null, bio: null }))
};

let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="root"><button id="edit-page">Editar</button></div><div id="editor-root" hidden></div>';
  host = document.getElementById('editor-root')!;
});
afterEach(() => { document.body.innerHTML = ''; delete document.body.dataset.editing; });

async function openEditor(onClose = vi.fn()) {
  const { openPageEditor } = await import('../../src/editor');
  const handle = await openPageEditor({
    pageId: 'p1', host, currentUser: { id: 'u1', name: 'Bia' }, onClose, onSignedOut: vi.fn(), api
  });
  await waitFor(() => expect(host.querySelector('input[aria-label="Título da página"]')).toBeTruthy());
  return { handle, onClose };
}

describe('openPageEditor', () => {
  test('mounts in its own host, marks the body as editing and never touches #root', async () => {
    const root = document.getElementById('root')!.innerHTML;
    await openEditor();
    expect(host.hidden).toBe(false);
    expect(document.body.dataset.editing).toBe('true');
    expect(document.getElementById('root')!.innerHTML).toBe(root);
  });

  test('focus goes to the start of the content', async () => {
    await openEditor();
    await waitFor(() => expect(host.querySelector('[contenteditable="true"]')?.contains(document.activeElement)).toBe(true));
  });

  test('requestClose without changes closes, unmounts and hides the host', async () => {
    const { handle, onClose } = await openEditor();
    expect(handle.hasUnsavedChanges()).toBe(false);
    await expect(handle.requestClose()).resolves.toBe(true);
    expect(onClose).toHaveBeenCalledWith({ saved: false });
    expect(host.hidden).toBe(true);
    expect(host.childElementCount).toBe(0);
    expect(document.body.dataset.editing).toBeUndefined();
  });

  test('requestClose with unsaved changes asks to confirm and resolves with the choice', async () => {
    const { handle, onClose } = await openEditor();
    const title = host.querySelector<HTMLInputElement>('input[aria-label="Título da página"]')!;
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.type(title, ' moderna');
    await waitFor(() => expect(handle.hasUnsavedChanges()).toBe(true));

    const staying = handle.requestClose();
    await user.click(await waitFor(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'Continuar editando')!));
    await expect(staying).resolves.toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    const leaving = handle.requestClose();
    await user.click(await waitFor(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'Descartar')!));
    await expect(leaving).resolves.toBe(true);
    expect(onClose).toHaveBeenCalledWith({ saved: false });
  });
});
