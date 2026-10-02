import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PageEditor, type EditorApi } from '../../src/editor/PageEditor';
import type { RemotePage } from '../../src/services/backend-api';

// FR-009: warn before saving when deleted blocks carry comments.
const A1 = '11111111-1111-4111-8111-111111111111';
const A2 = '22222222-2222-4222-8222-222222222222';
const page: RemotePage = {
  id: 'p1', title: 'Física', slug: 'fisica', version: 3, folderId: 'f1',
  content: `<!--b:${A1}-->\nComentado.\n\n<!--b:${A2}-->\nSem comentários.\n`
};

let editor: { removeBlocks: (ids: string[]) => void };

function api(counts: Map<string, number> | Error): EditorApi {
  return {
    getPageForEdit: vi.fn(async () => ({ page, etag: '"p1-v3"' })),
    savePage: vi.fn(async () => ({ page: { ...page, version: 4 }, etag: '"p1-v4"' })),
    listPageCommentAnchors: vi.fn(async () => { if (counts instanceof Error) throw counts; return counts; }),
    getPublicProfile: vi.fn(),
    searchPages: vi.fn(async () => []),
    requestImageUpload: vi.fn(),
    confirmImageUpload: vi.fn(),
    apiUrl: (path: string) => path,
    login: vi.fn()
  };
}

async function open(fake: EditorApi) {
  const onClose = vi.fn();
  render(<PageEditor pageId="p1" currentUser={{ id: 'u1', name: 'Bia' }} api={fake} onClose={onClose}
    onSignedOut={vi.fn()} onEditorReady={e => { editor = e as never; }} />);
  await screen.findByText('Comentado.');
  return { onClose, user: userEvent.setup() };
}

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

test('deleting a commented block asks before saving and says how many comments are affected', async () => {
  const fake = api(new Map([[A1, 2]]));
  const { onClose, user } = await open(fake);
  act(() => editor.removeBlocks([A1]));
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));

  const dialog = await screen.findByRole('alertdialog', { name: 'Remover blocos com comentários?' });
  expect(within(dialog).getByText(/2 comentários perderão o lugar/)).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Voltar' }));
  expect(fake.savePage).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Salvar mesmo assim' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ saved: true })));
});

test('deleting a block without comments saves without asking', async () => {
  const fake = api(new Map([[A1, 2]]));
  const { onClose, user } = await open(fake);
  act(() => editor.removeBlocks([A2]));
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ saved: true })));
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

test('when comments could not be checked, deleting an anchored block still asks', async () => {
  const fake = api(new Error('offline'));
  const { user } = await open(fake);
  act(() => editor.removeBlocks([A2]));
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Remover blocos com comentários?' });
  expect(within(dialog).getByText(/podem ter comentários/)).toBeTruthy();
});
