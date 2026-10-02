import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { newestDraft } from '../../src/editor/drafts';
import { PageEditor, type EditorApi } from '../../src/editor/PageEditor';
import { ApiRequestError, type RemotePage } from '../../src/services/backend-api';

// US3 scenario 3: an expired session during editing never loses the text.
const page: RemotePage = { id: 'p1', title: 'Física', slug: 'fisica', version: 3, folderId: 'f1', content: 'Publicado.\n' };
let editor: { insertBlocks: Function; document: { id: string }[] };

function api(over: Partial<EditorApi> = {}): EditorApi {
  return {
    getPageForEdit: vi.fn(async () => ({ page, etag: '"p1-v3"' })),
    savePage: vi.fn()
      .mockRejectedValueOnce(new ApiRequestError('Sua sessão expirou. Entre novamente.', 401))
      .mockResolvedValue({ page: { ...page, version: 4 }, etag: '"p1-v4"' }),
    listPageCommentAnchors: vi.fn(async () => new Map()),
    getPublicProfile: vi.fn(),
    listPages: vi.fn(async () => []),
    searchPages: vi.fn(async () => []),
    requestImageUpload: vi.fn(),
    confirmImageUpload: vi.fn(),
    apiUrl: (path: string) => path,
    login: vi.fn(async () => ({ accessToken: 't', tokenType: 'Bearer' as const, expiresAt: '2099-01-01T00:00:00Z' })),
    ...over
  };
}

async function expire(fake = api()) {
  const onClose = vi.fn();
  const onSignedOut = vi.fn();
  const view = render(<PageEditor pageId="p1" currentUser={{ id: 'u1', name: 'Bia' }} api={fake} onClose={onClose}
    onSignedOut={onSignedOut} onEditorReady={e => { editor = e as never; }} />);
  await screen.findByText('Publicado.');
  act(() => { editor.insertBlocks([{ type: 'paragraph', content: 'Texto longo.' }], editor.document.at(-1)!.id, 'after'); });
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Salvar' }));
  const dialog = await screen.findByRole('dialog', { name: 'Sua sessão expirou' });
  return { fake, onClose, onSignedOut, user, dialog, view };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

test('a 401 on save opens sign-in inside the editor; signing in retries the same save', async () => {
  const { fake, onClose, user, dialog } = await expire();
  await user.type(within(dialog).getByLabelText('E-mail'), 'bia@escola.br');
  await user.type(within(dialog).getByLabelText('Senha'), 'segredo');
  await user.click(within(dialog).getByRole('button', { name: 'Entrar e salvar' }));

  await waitFor(() => expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ saved: true })));
  expect(fake.login).toHaveBeenCalledWith('bia@escola.br', 'segredo');
  const calls = (fake.savePage as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls[1][1]).toEqual(calls[0][1]);
  expect(calls[1][2]).toBe('"p1-v3"');
});

test('wrong credentials show an error and keep the dialog open', async () => {
  const login = vi.fn(async () => { throw new ApiRequestError('x', 401); });
  const { user, dialog, onClose } = await expire(api({ login }));
  await user.type(within(dialog).getByLabelText('E-mail'), 'bia@escola.br');
  await user.type(within(dialog).getByLabelText('Senha'), 'errada');
  await user.click(within(dialog).getByRole('button', { name: 'Entrar e salvar' }));
  expect(await within(dialog).findByText('E-mail ou senha inválidos.')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});

test('cancelling keeps the draft and hands over to the shell', async () => {
  const { user, dialog, onSignedOut } = await expire();
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(onSignedOut).toHaveBeenCalled();
  expect(newestDraft('u1', 'p1')?.draft.content).toContain('Texto longo.');
});

test('the dialog has no axe violations', async () => {
  const { dialog } = await expire();
  expect(await axe(dialog)).toHaveNoViolations();
});
