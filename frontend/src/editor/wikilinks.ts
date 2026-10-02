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

/** The menu removes the typed query; the trigger may or may not still be there, so complete either way. */
function insertWikilink(editor: Editor, slug: string) {
  const { $from } = editor.prosemirrorState.selection;
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - WIKILINK_TRIGGER.length), $from.parentOffset);
  editor.insertInlineContent(before === WIKILINK_TRIGGER ? `${slug}]] ` : `${WIKILINK_TRIGGER}${slug}]] `);
}
