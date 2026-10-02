import { marked, type Token, type Tokens } from 'marked';

/**
 * A page's opening text, for the contents sheet and link previews (specs/003-notebook-design
 * data-model.md): the first paragraph, list item or quote, as plain text. Never markup, since callers
 * insert it as text.
 */
export function excerpt(markdown: string, max = 180): string {
  for (const token of marked.lexer(markdown)) {
    const text = blockText(token);
    if (text) return cut(text, max);
  }
  return '';
}

function blockText(token: Token): string {
  switch (token.type) {
    case 'paragraph':
      return plain((token as Tokens.Paragraph).tokens);
    case 'list': {
      const [first] = (token as Tokens.List).items;
      return first ? first.tokens.map(blockText).find(Boolean) ?? plain(first.tokens) : '';
    }
    case 'blockquote':
      return (token as Tokens.Blockquote).tokens.map(blockText).find(Boolean) ?? '';
    case 'text':
      return 'tokens' in token && token.tokens ? plain(token.tokens) : clean(token.text);
    default:
      return '';
  }
}

function plain(tokens: Token[] | undefined): string {
  const text = (tokens ?? []).map(token => {
    switch (token.type) {
      case 'image':
      case 'html':
      case 'br':
        return ' ';
      case 'codespan':
        return (token as Tokens.Codespan).text;
      case 'text':
      case 'escape':
        return 'tokens' in token && token.tokens ? plain(token.tokens) : token.text;
      default:
        return 'tokens' in token && Array.isArray(token.tokens) ? plain(token.tokens) : ('text' in token ? String(token.text) : '');
    }
  }).join('');
  return clean(text);
}

const clean = (text: string) => text
  .replace(/\[\[([^[\]]+)\]\]/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .replace(/ ([.,;:!?])/g, '$1')
  .trim();

function cut(text: string, max: number) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const space = slice.lastIndexOf(' ');
  return `${(space > max * 0.6 ? slice.slice(0, space) : slice).replace(/[\s,;:.!?-]+$/, '')}…`;
}
