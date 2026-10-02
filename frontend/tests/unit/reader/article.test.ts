import { marked } from 'marked';
import { describe, expect, test } from 'vitest';
import { renderArticle } from '../../../src/reader/article';

const pages = [{ id: 'p-fisica', slug: 'fisica', title: 'Física' }];
const dom = (html: string) => { const host = document.createElement('div'); host.innerHTML = html; return host; };

describe('renderArticle', () => {
  test('hides comment anchors and renders the Markdown around them', () => {
    const { html } = renderArticle('<!--b:3f2a9c1e-0000-4000-8000-000000000001-->\n# Introdução\n\n<!--b:3f2a9c1e-0000-4000-8000-000000000002-->\nTexto com **negrito**.\n', pages);
    expect(html).not.toContain('b:3f2a9c1e');
    expect(html).not.toContain('<!--');
    expect(dom(html).querySelector('strong')?.textContent).toBe('negrito');
  });

  test('renders quotes, code blocks, lists and tables', () => {
    const host = dom(renderArticle('> citação\n\n```ts\nconst a = 1 < 2;\n```\n\n1. um\n2. dois\n\n| a | b |\n|---|---|\n| 1 | 2 |\n').html);
    expect(host.querySelector('blockquote')?.textContent?.trim()).toBe('citação');
    expect(host.querySelector('pre code')?.textContent).toBe('const a = 1 < 2;\n');
    expect(host.querySelectorAll('ol li')).toHaveLength(2);
    expect(host.querySelector('.article-table table td')?.textContent).toBe('1');
  });

  test('renders images lazily, with the title as a caption', () => {
    const host = dom(renderArticle('![quadro](https://api.test/api/images/1)\n\n![mapa](https://api.test/api/images/2 "Mapa do Brasil")\n').html);
    const [first, second] = host.querySelectorAll('img');
    expect(first.getAttribute('src')).toBe('https://api.test/api/images/1');
    expect(first.getAttribute('alt')).toBe('quadro');
    expect(first.getAttribute('loading')).toBe('lazy');
    expect(second.closest('figure')?.querySelector('figcaption')?.textContent).toBe('Mapa do Brasil');
  });

  test('links [[slug]] to the page with that slug, and marks missing pages', () => {
    const host = dom(renderArticle('Veja [[fisica]] e [[quimica]].', pages).html);
    const [found, missing] = host.querySelectorAll('a.wikilink');
    expect(found.textContent).toBe('Física');
    expect(found.getAttribute('data-page')).toBe('p-fisica');
    expect(missing.classList.contains('wikilink--missing')).toBe(true);
    expect(missing.textContent).toBe('quimica');
    expect(missing.hasAttribute('href')).toBe(false);
  });

  test('leaves [[slug]] alone inside code, like the API does', () => {
    const host = dom(renderArticle('`[[fisica]]`\n\n```\n[[fisica]]\n```\n', pages).html);
    expect(host.querySelector('a')).toBeNull();
    expect(host.querySelector('code')?.textContent).toBe('[[fisica]]');
  });

  test('gives headings unique ids and lists them for the table of contents', () => {
    const { html, headings } = renderArticle('## Ondas\n\n### Som & **luz**\n\n## Ondas\n');
    expect(headings).toEqual([
      { id: 'secao-ondas', text: 'Ondas', level: 2 },
      { id: 'secao-som-luz', text: 'Som & luz', level: 3 },
      { id: 'secao-ondas-2', text: 'Ondas', level: 2 }
    ]);
    expect(dom(html).querySelectorAll('h2#secao-ondas, h2#secao-ondas-2')).toHaveLength(2);
  });

  test('marks external links to open in a new tab', () => {
    const link = dom(renderArticle('[site](https://example.com)').html).querySelector('a')!;
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  test('strips scripts, event handlers and javascript: URLs', () => {
    const html = renderArticle('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n[x](javascript:alert(1))\n').html;
    expect(html).not.toMatch(/<script|onerror|javascript:/i);
  });

  test('does not change the default marked instance the editor codec uses', () => {
    renderArticle('[[fisica]]', pages);
    expect(marked.parse('[[fisica]]')).toBe('<p>[[fisica]]</p>\n');
  });
});
