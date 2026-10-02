import { SuggestionMenu } from '@blocknote/core/extensions';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PageEditor, type EditorApi } from '../../src/editor/PageEditor';
import type { RemotePage } from '../../src/services/backend-api';

// FR-010: "[[" opens a page picker that stores [[slug]].
const page: RemotePage = { id: 'p1', title: 'Física', slug: 'fisica', version: 1, folderId: 'f1', content: 'Veja \n' };
const target: RemotePage = { id: 'p2', title: 'Óptica geométrica', slug: 'optica-geometrica', version: 1, folderId: 'f1', content: '' };

type Editor = {
  getExtension: (ext: unknown) => { openSuggestionMenu(trigger: string): void } | undefined;
  insertInlineContent: (content: string) => void;
  setTextCursorPosition: (block: unknown, at: 'end') => void;
  focus: () => void;
  document: { id: string }[];
};
let editor: Editor;

function api(): EditorApi {
  return {
    getPageForEdit: vi.fn(async () => ({ page, etag: '"p1-v1"' })),
    savePage: vi.fn(async (_id, changes) => ({ page: { ...page, ...changes, version: 2 }, etag: '"p1-v2"' })),
    listPageCommentAnchors: vi.fn(async () => new Map()),
    getPublicProfile: vi.fn(),
    searchPages: vi.fn(async () => [target])
  };
}

async function openPicker(fake: EditorApi, query: string) {
  render(<PageEditor pageId="p1" currentUser={{ id: 'u1', name: 'Bia' }} api={fake} onClose={vi.fn()}
    onSignedOut={vi.fn()} onEditorReady={e => { editor = e as never; }} />);
  await screen.findByText(/Veja/);
  act(() => {
    editor.setTextCursorPosition(editor.document[0], 'end');
    editor.focus();
    editor.getExtension(SuggestionMenu)!.openSuggestionMenu('[[');
  });
  act(() => editor.insertInlineContent(query));
}

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

test('typing after [[ searches pages and shows their titles', async () => {
  const fake = api();
  await openPicker(fake, 'ópt');
  expect(await screen.findByText('Óptica geométrica')).toBeTruthy();
  await waitFor(() => expect(fake.searchPages).toHaveBeenCalledWith('ópt'));
});

test('choosing a page stores [[slug]]', async () => {
  const fake = api();
  await openPicker(fake, 'ópt');
  await userEvent.setup().click(await screen.findByText('Óptica geométrica'));
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(fake.savePage).toHaveBeenCalled());
  const content: string = (fake.savePage as ReturnType<typeof vi.fn>).mock.calls[0][1].content;
  expect(content).toContain('Veja [[optica-geometrica]]');
  expect(content).not.toContain('[[[[');
});

test('Escape closes the picker and leaves the typed text', async () => {
  const fake = api();
  await openPicker(fake, 'ópt');
  await screen.findByText('Óptica geométrica');
  await userEvent.setup().keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByText('Óptica geométrica')).toBeNull());
  expect(screen.getByText(/Veja \[\[ópt/)).toBeTruthy();
});
