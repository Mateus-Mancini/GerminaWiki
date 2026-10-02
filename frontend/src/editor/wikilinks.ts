import type { DefaultReactSuggestionItem } from '@blocknote/react';
import type { RemotePage } from '../services/backend-api';

/** Typing this opens the page picker (spec FR-010, research R8). */
export const WIKILINK_TRIGGER = '[[';

type Editor = {
  insertInlineContent(content: string): void;
  prosemirrorState: { selection: { $from: { parent: { textBetween(from: number, to: number): string }; parentOffset: number } } };
};

/**
 * Suggestion items for the picker: pages matching the typed text, searched after a short pause.
 * Choosing one stores `[[slug]]`, the form the wikilinks API resolves (it doesn't resolve titles).
 */
export function wikilinkItems(editor: Editor, search: (query: string) => Promise<RemotePage[]>, delayMs = 200) {
  let latest = 0;
  return async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    const text = query.trim();
    const call = ++latest;
    if (!text) return [];
    await new Promise(resolve => setTimeout(resolve, delayMs));
    if (call !== latest) return [];
    const pages = await search(text).catch(() => []);
    return pages.slice(0, 8).map(page => ({
      title: page.title,
      subtext: page.slug,
      onItemClick: () => insertWikilink(editor, page.slug)
    }));
  };
}

const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

/**
 * The picker's page search. The API's full-text search only matches whole words ("Fís" finds nothing
 * until "Física" is typed), so pages whose title or slug contains the typed text, ignoring accents and
 * case, come first; the API's matches in page content follow. The page list is loaded once per editor.
 */
export function findPages(listPages: () => Promise<RemotePage[]>, searchPages: (query: string) => Promise<RemotePage[]>) {
  let all: Promise<RemotePage[]> | null = null;
  return async (query: string): Promise<RemotePage[]> => {
    all ??= listPages().catch(() => { all = null; return []; });
    const needle = fold(query.trim());
    const [pages, found] = await Promise.all([all, searchPages(query).catch(() => [] as RemotePage[])]);
    const byTitle = pages.filter(page => fold(page.title).includes(needle) || fold(page.slug).includes(needle))
      .sort((a, b) => Number(!fold(a.title).startsWith(needle)) - Number(!fold(b.title).startsWith(needle)));
    const seen = new Set(byTitle.map(page => page.id));
    return [...byTitle, ...found.filter(page => !seen.has(page.id))];
  };
}

/** The menu removes the typed query; the trigger may or may not still be there, so complete either way. */
function insertWikilink(editor: Editor, slug: string) {
  const { $from } = editor.prosemirrorState.selection;
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - WIKILINK_TRIGGER.length), $from.parentOffset);
  editor.insertInlineContent(before === WIKILINK_TRIGGER ? `${slug}]] ` : `${WIKILINK_TRIGGER}${slug}]] `);
}
