import './article.css';
import DOMPurify from 'dompurify';
import { Marked, type Tokens } from 'marked';

/** A page a wikilink may point to: `[[slug]]` resolves by slug only, like the API's WikiLinkParser. */
export type LinkablePage = { id: string; slug: string; title: string };
export type ArticleHeading = { id: string; text: string; level: number };
export type Article = { html: string; headings: ArticleHeading[] };

const ANCHOR = /^<!--b:[0-9a-f-]{36}-->\s*$/i;
const WIKILINK = /^\[\[([^[\]]+)\]\]/;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

/** URL fragment for a heading; repeats get -2, -3… so every one stays reachable. */
function headingId(text: string, used: Map<string, number>) {
  const base = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'secao';
  const count = (used.get(base) ?? 0) + 1;
  used.set(base, count);
  return `secao-${count === 1 ? base : `${base}-${count}`}`;
}

/**
 * Renders a page's Markdown as the reading view's article: comment anchors hidden, `[[slug]]` links to
 * loaded pages (marked as missing otherwise), headings with ids for the page's table of contents, and
 * everything sanitised, since content is written by students and lands in innerHTML.
 *
 * A private Marked instance: the editor's codec relies on the default `marked` staying unextended.
 */
export function renderArticle(content: string, pages: readonly LinkablePage[] = []): Article {
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

  // Wide tables scroll on their own instead of widening the page.
  const html = marked.parse(content, { async: false })
    .replace(/<table>/g, '<div class="article-table"><table>').replace(/<\/table>/g, '</table></div>');
  const clean = DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'data-page', 'aria-disabled', 'loading', 'decoding'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select']
  });
  return { html: clean, headings };
}
