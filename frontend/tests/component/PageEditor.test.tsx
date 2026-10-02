import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { EditorApi, PageEditorProps } from '../../src/editor/PageEditor';
import { PageEditor } from '../../src/editor/PageEditor';
import { ApiRequestError, VersionConflictError, type RemotePage } from '../../src/services/backend-api';

const A1 = '11111111-1111-4111-8111-111111111111';
const CONTENT = `<!--b:${A1}-->\nPrimeiro parágrafo.\n`;
const page = (over: Partial<RemotePage> = {}): RemotePage => ({
  id: 'p1', title: 'Física', slug: 'fisica', content: CONTENT, version: 3, folderId: 'f1', ...over
});

function fakeApi(over: Partial<EditorApi> = {}): EditorApi {
  return {
    getPageForEdit: vi.fn(async () => ({ page: page(), etag: '"p1-v3"' })),
    savePage: vi.fn(async (_id, changes) => ({ page: page({ ...changes, version: 4 }), etag: '"p1-v4"' })),
    listPageCommentAnchors: vi.fn(async () => new Map()),
    getPublicProfile: vi.fn(async () => ({ id: 'u2', name: 'Ana', avatarUrl: null, bio: null })),
    ...over
  };
}

let editor: { insertBlocks: Function; document: unknown[] } | null;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

async function open(props: Partial<PageEditorProps> = {}) {
  const api = props.api ?? fakeApi();
  const onClose = vi.fn();
  const view = render(
    <PageEditor pageId="p1" currentUser={{ id: 'u1', name: 'Bia' }} api={api} onClose={onClose}
      onSignedOut={vi.fn()} onEditorReady={e => { editor = e as never; }} {...props} />
  );
  await screen.findByRole('textbox', { name: 'Título da página' });
  return { api, onClose, view, user: userEvent.setup() };
}

function addParagraph(text: string) {
  act(() => {
    editor!.insertBlocks([{ type: 'paragraph', content: text }], (editor!.document as { id: string }[]).at(-1)!.id, 'after');
  });
}

beforeEach(() => {
  editor = null;
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('loading', () => {
  test('shows a loading state, then the title and content', async () => {
    const api = fakeApi();
    render(<PageEditor pageId="p1" currentUser={{ id: 'u1', name: 'Bia' }} api={api} onClose={vi.fn()} onSignedOut={vi.fn()} />);
    expect(screen.getByText('Carregando página…')).toBeTruthy();
    expect(await screen.findByDisplayValue('Física')).toBeTruthy();
    expect(await screen.findByText('Primeiro parágrafo.')).toBeTruthy();
  });

  test('a page that no longer exists says so and offers to go back', async () => {
    const onClose = vi.fn();
    render(<PageEditor pageId="p1" currentUser={{ id: 'u1', name: 'Bia' }} onClose={onClose} onSignedOut={vi.fn()}
      api={fakeApi({ getPageForEdit: vi.fn(async () => { throw new ApiRequestError('x', 404); }) })} />);
    expect(await screen.findByText('Esta página não existe mais.')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onClose).toHaveBeenCalledWith({ saved: false });
  });
});

describe('saving', () => {
  test('nothing to save while unchanged; saving does not create a version', async () => {
    const { api } = await open();
    const save = screen.getByRole('button', { name: /Salvar|Nada para salvar/ });
    expect(save.textContent).toBe('Nada para salvar');
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect(api.savePage).not.toHaveBeenCalled();
  });

  test('saves title and encoded content with the expected version, then closes with the saved page', async () => {
    const { api, onClose, user } = await open();
    const title = screen.getByRole('textbox', { name: 'Título da página' });
    await user.clear(title);
    await user.type(title, 'Física moderna');
    addParagraph('Novo parágrafo.');
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [id, changes, etag] = (api.savePage as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(id).toBe('p1');
    expect(etag).toBe('"p1-v3"');
    expect(changes.title).toBe('Física moderna');
    expect(changes.content.startsWith(CONTENT.trimEnd())).toBe(true);
    expect(changes.content).toMatch(/<!--b:[0-9a-f-]{36}-->\nNovo parágrafo\.\n$/);
    expect(onClose).toHaveBeenCalledWith({ saved: true, page: expect.objectContaining({ version: 4 }) });
  });

  test('Ctrl+S saves', async () => {
    const { api, user } = await open();
    addParagraph('Atalho.');
    await user.keyboard('{Control>}s{/Control}');
    await waitFor(() => expect(api.savePage).toHaveBeenCalledTimes(1));
  });

  test('the title is omitted when unchanged', async () => {
    const { api, user } = await open();
    addParagraph('Só conteúdo.');
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.savePage).toHaveBeenCalled());
    expect((api.savePage as ReturnType<typeof vi.fn>).mock.calls[0][1]).not.toHaveProperty('title');
  });

  test.each([
    ['', 'Informe um título.'],
    ['x'.repeat(256), 'O título pode ter no máximo 255 caracteres.']
  ])('an invalid title (%#) blocks saving with an inline message', async (value, message) => {
    const { api, user } = await open();
    const title = screen.getByRole('textbox', { name: 'Título da página' });
    await user.clear(title);
    if (value) await user.click(title), await user.paste(value);
    expect(await screen.findByText(message)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.savePage).not.toHaveBeenCalled();
  });
});

describe('save failures keep the text', () => {
  test.each([
    [new ApiRequestError('x', 500), 'Não foi possível salvar. Verifique sua conexão e tente novamente.', 'editor.save_failed'],
    [new TypeError('Failed to fetch'), 'Não foi possível salvar. Verifique sua conexão e tente novamente.', 'editor.save_failed'],
    [new ApiRequestError('x', 403), 'Você não tem permissão para editar esta página.', 'editor.forbidden'],
    [new ApiRequestError('x', 404), 'Esta página foi excluída enquanto você editava. Copie seu texto antes de sair.', 'editor.save_failed'],
    [new VersionConflictError('x', 412, 5), 'Esta página foi alterada por outra pessoa enquanto você editava. Seu texto foi mantido.', 'editor.conflict']
  ])('%s', async (failure, message, event) => {
    const { onClose, user } = await open({ api: fakeApi({ savePage: vi.fn(async () => { throw failure; }) }) });
    addParagraph('Texto que não pode se perder.');
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText('Texto que não pode se perder.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    // Reported without content (FR-016).
    const logged = [...warn.mock.calls, ...error.mock.calls].map(c => String(c[1]));
    const entry = logged.find(line => line.includes(event))!;
    expect(entry).toBeTruthy();
    expect(entry).not.toContain('Texto que não pode');
    expect(entry).not.toContain('Física');
  });

  test('a failed save can be retried', async () => {
    const savePage = vi.fn()
      .mockRejectedValueOnce(new ApiRequestError('x', 503))
      .mockResolvedValueOnce({ page: page({ version: 4 }), etag: '"p1-v4"' });
    const { onClose, user } = await open({ api: fakeApi({ savePage }) });
    addParagraph('De novo.');
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));
    await user.click(await screen.findByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ saved: true })));
  });

  test('a slow save (cold start) keeps "Salvando…" and then succeeds', async () => {
    let finish!: () => void;
    const savePage = vi.fn(() => new Promise<{ page: RemotePage; etag: string }>(resolve => {
      finish = () => resolve({ page: page({ version: 4 }), etag: '"p1-v4"' });
    }));
    const { onClose, user } = await open({ api: fakeApi({ savePage }) });
    addParagraph('Devagar.');
    await user.click(await screen.findByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeTruthy();
    act(() => finish());
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ saved: true })));
  });
});

describe('leaving', () => {
  test('cancel without changes closes at once', async () => {
    const { onClose, user } = await open();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledWith({ saved: false });
  });

  test('cancel with changes asks first; staying keeps the text', async () => {
    const { onClose, user } = await open();
    addParagraph('Rascunho.');
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Descartar alterações?' });
    expect(dialog).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Rascunho.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar' }));
    expect(onClose).toHaveBeenCalledWith({ saved: false });
  });

  test('closing the tab with unsaved changes asks the browser to confirm', async () => {
    await open();
    addParagraph('Não feche.');
    await waitFor(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
  });
});

describe('accessibility', () => {
  test('statuses are announced and the editor chrome has no axe violations', async () => {
    const { view } = await open();
    expect(view.container.querySelector('[aria-live="polite"]')).toBeTruthy();
    expect(await axe(view.container.querySelector('.page-editor__bar')!)).toHaveNoViolations();
  });
});
