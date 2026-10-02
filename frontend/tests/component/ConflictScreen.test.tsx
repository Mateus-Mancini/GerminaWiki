import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ConflictScreen } from '../../src/editor/ConflictScreen';
import { PageEditor, type EditorApi } from '../../src/editor/PageEditor';
import { VersionConflictError, type RemotePage } from '../../src/services/backend-api';

const A1 = '11111111-1111-4111-8111-111111111111';
const base = `<!--b:${A1}-->\nLinha comum.\n`;
const page = (over: Partial<RemotePage> = {}): RemotePage => ({
  id: 'p1', title: 'Física', slug: 'fisica', content: base, version: 3, folderId: 'f1',
  updatedBy: 'u2', updatedAt: '2026-10-01T14:32:00-03:00', ...over
});
const published = page({ version: 4, content: `${base}\nTexto da Ana.\n` });

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('ConflictScreen', () => {
  const props = () => ({
    mine: { title: 'Física', content: `${base}\nMeu texto.\n` },
    published,
    lastEditor: { name: 'Ana', at: '2026-10-01T14:32:00-03:00' },
    onDiscard: vi.fn(), onContinue: vi.fn(), onReplace: vi.fn()
  });

  test('explains the conflict and shows both versions with the differences marked', () => {
    render(<ConflictScreen {...props()} />);
    expect(screen.getByRole('heading', { name: 'Esta página mudou enquanto você editava' })).toBeTruthy();
    expect(screen.getByText(/Atualizada por Ana às 14:32/)).toBeTruthy();
    const mine = screen.getByRole('region', { name: 'Sua versão' });
    const theirs = screen.getByRole('region', { name: 'Versão publicada' });
    expect(within(mine).getByText('Meu texto.').closest('ins')).toBeTruthy();
    expect(within(theirs).getByText('Texto da Ana.').closest('del')).toBeTruthy();
    expect(within(mine).getByText('Linha comum.').closest('ins, del')).toBeNull();
  });

  test('discard and continue are single actions', async () => {
    const p = props();
    render(<ConflictScreen {...p} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Descartar minhas alterações' }));
    await user.click(screen.getByRole('button', { name: 'Continuar editando sobre a versão publicada' }));
    expect(p.onDiscard).toHaveBeenCalledOnce();
    expect(p.onContinue).toHaveBeenCalledOnce();
  });

  test('replace needs an explicit confirmation naming what will be lost; cancel does nothing', async () => {
    const p = props();
    render(<ConflictScreen {...p} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Substituir pela minha versão' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Substituir a versão publicada?' });
    expect(within(dialog).getByText(/As alterações de Ana \(14:32\) serão perdidas/)).toBeTruthy();
    expect(p.onReplace).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(p.onReplace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Substituir pela minha versão' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Substituir' }));
    expect(p.onReplace).toHaveBeenCalledOnce();
  });

  test('is keyboard operable and has no axe violations', async () => {
    const p = props();
    const { container } = render(<ConflictScreen {...p} />);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement?.textContent).toBe('Descartar minhas alterações');
    await user.keyboard('{Enter}');
    expect(p.onDiscard).toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('an unknown last editor still explains the conflict', () => {
    render(<ConflictScreen {...props()} lastEditor={null} />);
    expect(screen.getByText(/Outra pessoa salvou uma nova versão/)).toBeTruthy();
  });
});

describe('PageEditor conflict flow', () => {
  let editor: { insertBlocks: Function; document: { id: string }[] };

  function api(over: Partial<EditorApi> = {}): EditorApi {
    return {
      getPageForEdit: vi.fn()
        .mockResolvedValueOnce({ page: page(), etag: '"p1-v3"' })
        .mockResolvedValue({ page: published, etag: '"p1-v4"' }),
      savePage: vi.fn()
        .mockRejectedValueOnce(new VersionConflictError('x', 412, 4))
        .mockResolvedValue({ page: page({ version: 5 }), etag: '"p1-v5"' }),
      listPageCommentAnchors: vi.fn(async () => new Map()),
      getPublicProfile: vi.fn(async () => ({ id: 'u2', name: 'Ana', avatarUrl: null, bio: null })),
      ...over
    };
  }

  async function conflict(fake = api()) {
    const onClose = vi.fn();
    render(<PageEditor pageId="p1" currentUser={{ id: 'u1', name: 'Bia' }} api={fake} onClose={onClose}
      onSignedOut={vi.fn()} onEditorReady={e => { editor = e as never; }} />);
    await screen.findByRole('textbox', { name: 'Título da página' });
    act(() => { editor.insertBlocks([{ type: 'paragraph', content: 'Meu texto.' }], editor.document.at(-1)!.id, 'after'); });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));
    await screen.findByRole('heading', { name: 'Esta página mudou enquanto você editava' });
    return { fake, onClose, user };
  }

  test('a rejected save opens the conflict screen with the published version and its editor', async () => {
    const { fake } = await conflict();
    expect(fake.getPageForEdit).toHaveBeenCalledTimes(2);
    expect(fake.getPublicProfile).toHaveBeenCalledWith('u2');
    expect(screen.getByText(/Atualizada por Ana/)).toBeTruthy();
  });

  test('discard loads the published version for editing', async () => {
    const { user } = await conflict();
    await user.click(screen.getByRole('button', { name: 'Descartar minhas alterações' }));
    expect(await screen.findByText('Texto da Ana.')).toBeTruthy();
    expect(screen.queryByText('Meu texto.')).toBeNull();
  });

  test('continue loads the published version, keeps mine aside, and the next save uses the new version', async () => {
    const { fake, user, onClose } = await conflict();
    await user.click(screen.getByRole('button', { name: 'Continuar editando sobre a versão publicada' }));
    expect(await screen.findByText('Texto da Ana.')).toBeTruthy();
    const aside = screen.getByRole('complementary', { name: 'Sua versão anterior' });
    expect(within(aside).getByText(/Meu texto\./)).toBeTruthy();

    act(() => { editor.insertBlocks([{ type: 'paragraph', content: 'Juntando.' }], editor.document.at(-1)!.id, 'after'); });
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ saved: true })));
    expect((fake.savePage as ReturnType<typeof vi.fn>).mock.calls[1][2]).toBe('"p1-v4"');
  });

  test('replace saves my version against the new version only after confirming', async () => {
    const { fake, user, onClose } = await conflict();
    await user.click(screen.getByRole('button', { name: 'Substituir pela minha versão' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Substituir' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ saved: true })));
    const [, changes, etag] = (fake.savePage as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(etag).toBe('"p1-v4"');
    expect(changes.content).toContain('Meu texto.');
    expect(changes.content).not.toContain('Texto da Ana.');
  });
});
