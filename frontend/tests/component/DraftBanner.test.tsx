import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { saveDraft, newestDraft } from '../../src/editor/drafts';
import { PageEditor, type EditorApi } from '../../src/editor/PageEditor';
import { VersionConflictError, type RemotePage } from '../../src/services/backend-api';

const A1 = '11111111-1111-4111-8111-111111111111';
const page: RemotePage = { id: 'p1', title: 'Física', slug: 'fisica', version: 3, folderId: 'f1', content: `<!--b:${A1}-->\nPublicado.\n` };
const draftContent = `<!--b:${A1}-->\nPublicado.\n\n<!--b:22222222-2222-4222-8222-222222222222-->\nRascunho guardado.\n`;

function api(over: Partial<EditorApi> = {}): EditorApi {
  return {
    getPageForEdit: vi.fn(async () => ({ page, etag: '"p1-v3"' })),
    savePage: vi.fn(async (_id, changes) => ({ page: { ...page, ...changes, version: 4 }, etag: '"p1-v4"' })),
    listPageCommentAnchors: vi.fn(async () => new Map()),
    getPublicProfile: vi.fn(async () => ({ id: 'u2', name: 'Ana', avatarUrl: null, bio: null })),
    listPages: vi.fn(async () => []),
    searchPages: vi.fn(async () => []),
    requestImageUpload: vi.fn(),
    confirmImageUpload: vi.fn(),
    apiUrl: (path: string) => path,
    login: vi.fn(),
    ...over
  };
}

let editor: { insertBlocks: Function; document: { id: string }[] };

async function open(fake = api()) {
  const onClose = vi.fn();
  render(<PageEditor pageId="p1" currentUser={{ id: 'u1', name: 'Bia' }} api={fake} onClose={onClose}
    onSignedOut={vi.fn()} onEditorReady={e => { editor = e as never; }} />);
  await screen.findByText('Publicado.');
  // The title field appears in the same commit that starts the draft writer.
  await screen.findByRole('textbox', { name: 'Título da página' });
  return { fake, onClose, user: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

test('a kept draft is offered with its time and the number of other drafts', async () => {
  saveDraft('u1', 'p1', { title: 'Física', content: draftContent, baseEtag: '"p1-v3"', savedAt: '2026-10-01T17:05:00.000Z' }, 'tab-a');
  saveDraft('u1', 'p1', { title: 'Física', content: 'Velho.\n', baseEtag: '"p1-v3"', savedAt: '2026-10-01T10:00:00.000Z' }, 'tab-b');
  await open();
  const banner = screen.getByRole('region', { name: 'Rascunho não salvo' });
  expect(within(banner).getByText(/01\/10 às 14:05/)).toBeTruthy();
  expect(within(banner).getByText(/e mais 1 rascunho/)).toBeTruthy();
});

test('restoring puts the draft in the editor; saving sends it and removes the draft', async () => {
  saveDraft('u1', 'p1', { title: 'Física', content: draftContent, baseEtag: '"p1-v3"', savedAt: new Date().toISOString() }, 'tab-a');
  const { fake, onClose, user } = await open();
  await user.click(screen.getByRole('button', { name: 'Restaurar rascunho' }));
  expect(await screen.findByText('Rascunho guardado.')).toBeTruthy();
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ saved: true })));
  expect((fake.savePage as ReturnType<typeof vi.fn>).mock.calls[0][1].content).toBe(draftContent);
  expect(newestDraft('u1', 'p1')).toBeNull();
});

test('discarding removes only the offered draft', async () => {
  saveDraft('u1', 'p1', { title: 'Física', content: draftContent, baseEtag: '"p1-v3"', savedAt: '2026-10-01T17:05:00.000Z' }, 'tab-a');
  saveDraft('u1', 'p1', { title: 'Física', content: 'Velho.\n', baseEtag: '"p1-v3"', savedAt: '2026-10-01T10:00:00.000Z' }, 'tab-b');
  const { user } = await open();
  await user.click(screen.getByRole('button', { name: 'Descartar rascunho' }));
  expect(screen.queryByRole('region', { name: 'Rascunho não salvo' })).toBeNull();
  expect(newestDraft('u1', 'p1')!.draft.content).toBe('Velho.\n');
});

test('a draft started from an older version leads to the conflict screen when saved', async () => {
  saveDraft('u1', 'p1', { title: 'Física', content: draftContent, baseEtag: '"p1-v2"', savedAt: new Date().toISOString() }, 'tab-a');
  const savePage = vi.fn(async (_id: string, _changes: unknown, etag: string) => {
    if (etag === '"p1-v2"') throw new VersionConflictError('x', 412, 3);
    return { page, etag: '"p1-v4"' };
  });
  const { user } = await open(api({ savePage }));
  await user.click(screen.getByRole('button', { name: 'Restaurar rascunho' }));
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));
  expect(await screen.findByRole('heading', { name: 'Esta página mudou enquanto você editava' })).toBeTruthy();
  expect(savePage.mock.calls[0][2]).toBe('"p1-v2"');
});

test('a draft identical to the published page is not offered', async () => {
  saveDraft('u1', 'p1', { title: 'Física', content: page.content, baseEtag: '"p1-v3"', savedAt: new Date().toISOString() }, 'tab-a');
  await open();
  expect(screen.queryByRole('region', { name: 'Rascunho não salvo' })).toBeNull();
});

test('typing keeps a draft for this tab', async () => {
  await open();
  act(() => { editor.insertBlocks([{ type: 'paragraph', content: 'Não perca isto.' }], editor.document.at(-1)!.id, 'after'); });
  window.dispatchEvent(new Event('pagehide'));
  await waitFor(() => expect(newestDraft('u1', 'p1')?.draft.content).toContain('Não perca isto.'));
});
