import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { WIKILINK_TRIGGER, wikilinkItems } from '../../src/editor/wikilinks';
import type { RemotePage } from '../../src/services/backend-api';

// FR-010: "[[" opens a page picker that stores [[slug]].
// jsdom can't drive ProseMirror's text input and selection reliably, so typing "[[" into the real editor is
// covered manually (quickstart §5.4); these tests pin the picker's behaviour behind BlockNote's menu.
const target: RemotePage = { id: 'p2', title: 'Óptica geométrica', slug: 'optica-geometrica', version: 1, folderId: 'f1', content: '' };

function fakeEditor(textBeforeCursor: string) {
  const inserted: string[] = [];
  return {
    inserted,
    insertInlineContent: (content: string) => { inserted.push(content); },
    prosemirrorState: {
      selection: {
        $from: {
          parentOffset: textBeforeCursor.length,
          parent: { textBetween: (from: number, to: number) => textBeforeCursor.slice(from, to) }
        }
      }
    }
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

async function items(getItems: (query: string) => Promise<unknown>, query: string) {
  const result = getItems(query);
  await vi.advanceTimersByTimeAsync(200);
  return result as Promise<{ title: string; subtext?: string; onItemClick: () => void }[]>;
}

test('the trigger is [[', () => {
  expect(WIKILINK_TRIGGER).toBe('[[');
});

test('typing after [[ searches pages and lists their titles', async () => {
  const search = vi.fn(async () => [target]);
  const list = await items(wikilinkItems(fakeEditor('Veja [['), search), ' ópt ');
  expect(search).toHaveBeenCalledWith('ópt');
  expect(list.map(item => [item.title, item.subtext])).toEqual([['Óptica geométrica', 'optica-geometrica']]);
});

test('nothing is searched until something is typed', async () => {
  const search = vi.fn(async () => [target]);
  await expect(items(wikilinkItems(fakeEditor('[['), search), '  ')).resolves.toEqual([]);
  expect(search).not.toHaveBeenCalled();
});

test('searches wait for a pause in typing; superseded queries are dropped', async () => {
  const search = vi.fn(async () => [target]);
  const getItems = wikilinkItems(fakeEditor('[['), search);
  const first = getItems('ó');
  const second = getItems('óp');
  await vi.advanceTimersByTimeAsync(200);
  await expect(first).resolves.toEqual([]);
  expect((await second).length).toBe(1);
  expect(search).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledWith('óp');
});

test('choosing a page completes the [[ already typed with slug]]', async () => {
  const editor = fakeEditor('Veja [[');
  const [item] = await items(wikilinkItems(editor, async () => [target]), 'ópt');
  item.onItemClick();
  expect(editor.inserted).toEqual(['optica-geometrica]] ']);
});

test('if the menu removed the trigger, the whole [[slug]] is inserted (never doubled)', async () => {
  const editor = fakeEditor('Veja ');
  const [item] = await items(wikilinkItems(editor, async () => [target]), 'ópt');
  item.onItemClick();
  expect(editor.inserted).toEqual(['[[optica-geometrica]] ']);
});

test('a failed search shows no items instead of breaking the editor', async () => {
  const search = vi.fn(async () => { throw new Error('offline'); });
  await expect(items(wikilinkItems(fakeEditor('[['), search), 'x')).resolves.toEqual([]);
});
