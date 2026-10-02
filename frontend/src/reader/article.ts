import './article.css';
import DOMPurify from 'dompurify';
import { Marked, type Token, type Tokens } from 'marked';

/** A page a wikilink may point to: `[[slug]]` resolves by slug only, like the API's WikiLinkParser. */
export type LinkablePage = { id: string; slug: string; title: string };
export type ArticleHeading = { id: string; text: string; level: number };
export type Article = { html: string; headings: ArticleHeading[] };
export type ArticleOptions = {
  /**
   * Wraps each anchored block's sanitised HTML, e.g. to add its comment thread. Its output is not
   * sanitised again, so it must escape what it adds. By default a block becomes
   * `<div class="article-block" data-block="<uuid>">`.
   */
  wrapBlock?: (blockId: string, html: string) => string;
  /**
   * The page's title. Many pages open with a `# Title` line that repeats it; the sheet already shows the
   * title as its headword, so that first heading is left out (and out of the table of contents).
   */
  omitTitle?: string;
};

const ANCHOR = /^<!--b:([0-9a-f-]{36})-->\s*$/i;
const WIKILINK = /^\[\[([^[\]]+)\]\]/;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

/** URL fragment for a heading; repeats get -2, -3… so every one stays reachable. */
function headingId(text: string, used: Map<string, number>) {
  const base = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'secao';
  const count = (used.get(base) ?? 0) + 1;
  used.set(base, count);
  return `secao-${count === 1 ? base : `${base}-${count}`}`;
}

/**
 * Renders a page's Markdown as the reading view's article: comment anchors hidden, `[[slug]]` links to
 * loaded pages (marked as missing otherwise), headings with ids for the page's table of contents, and
 * everything sanitised, since content is written by students and lands in innerHTML. Each block that
 * follows a `<!--b:uuid-->` anchor is rendered on its own, so comments can attach to it.
 *
 * A private Marked instance: the editor's codec relies on the default `marked` staying unextended.
 */
export function renderArticle(content: string, pages: readonly LinkablePage[] = [], options: ArticleOptions = {}): Article {
  const bySlug = new Map(pages.map(page => [page.slug, page]));
  const headings: ArticleHeading[] = [];
  const used = new Map<string, number>();
  const marked = new Marked({ gfm: true, breaks: false });

  marked.use({
    extensions: [{
      name: 'wikilink',
      level: 'inline',
      start: source => source.indexOf('[['),
      tokenizer(source) {
        const match = WIKILINK.exec(source);
        if (match) return { type: 'wikilink', raw: match[0], slug: match[1].trim() };
        return undefined;
      },
      renderer(token) {
        const target = bySlug.get(token.slug as string);
        if (target) {
          return `<a class="wikilink" href="#${escapeHtml(target.slug)}" data-page="${escapeHtml(target.id)}">${escapeHtml(target.title)}</a>`;
        }
        return `<a class="wikilink wikilink--missing" title="Esta página ainda não existe" aria-disabled="true">${escapeHtml(token.slug as string)}</a>`;
      }
    }],
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return ANCHOR.test(text) ? '' : text;
      },
      heading({ tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        const text = inner.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
        const id = headingId(text, used);
        headings.push({ id, text, level: depth });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//i.test(href);
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inner}</a>`;
      },
      image({ href, title, text }: Tokens.Image) {
        const caption = title || '';
        const img = `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async"/>`;
        return caption ? `<figure>${img}<figcaption>${escapeHtml(caption)}</figcaption></figure>` : img;
      }
    }
  });

  const wrapBlock = options.wrapBlock
    ?? ((blockId: string, html: string) => `<div class="article-block" data-block="${escapeHtml(blockId)}">${html}</div>`);
  // One lexing pass keeps reference links and the page's structure intact; the tokens are then rendered
  // in groups, one per anchor (the text before the first anchor has none).
  const tokens = marked.lexer(content);
  const groups: { blockId: string | null; tokens: Token[] }[] = [{ blockId: null, tokens: [] }];
  const echo = options.omitTitle?.trim().toLocaleLowerCase('pt-BR');
  let seenContent = false;
  for (const token of tokens) {
    const anchor = token.type === 'html' ? ANCHOR.exec(token.raw.trim()) : null;
    if (!anchor && token.type !== 'space' && !seenContent) {
      seenContent = true;
      if (echo && token.type === 'heading' && token.depth === 1 && token.text.trim().toLocaleLowerCase('pt-BR') === echo) continue;
    }
    if (anchor) groups.push({ blockId: anchor[1], tokens: [] });
    else groups.at(-1)!.tokens.push(token);
  }
  const html = groups.map(group => {
    const list = Object.assign(group.tokens, { links: tokens.links });
    const body = sanitize(marked.parser(list));
    if (!body.trim()) return '';
    return group.blockId ? wrapBlock(group.blockId, body) : body;
  }).join('');
  return { html, headings };
}

function sanitize(html: string) {
  // Wide tables scroll on their own instead of widening the page.
  const wrapped = html.replace(/<table>/g, '<div class="article-table"><table>').replace(/<\/table>/g, '</table></div>');
  return DOMPurify.sanitize(wrapped, {
    ADD_ATTR: ['target', 'data-page', 'aria-disabled', 'loading', 'decoding'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select']
  });
}
