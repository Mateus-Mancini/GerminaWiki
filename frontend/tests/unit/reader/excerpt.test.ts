import { describe, expect, test } from 'vitest';
import { excerpt } from '../../../src/reader/excerpt';

const A = '<!--b:3f2a9c1e-0000-4000-8000-00000000000a-->';

describe('excerpt', () => {
  test('takes the first paragraph, skipping anchors, headings, images, code and tables', () => {
    const md = `${A}\n# Ondas\n\n![onda](https://x/y.png)\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n${A}\nUma onda é uma perturbação que se propaga.\n\nSegundo parágrafo.\n`;
    expect(excerpt(md)).toBe('Uma onda é uma perturbação que se propaga.');
  });

  test('reduces inline Markdown to its text', () => {
    expect(excerpt('Texto com **negrito**, _itálico_, `código`, [link](https://x.y) e [[fisica-moderna]].'))
      .toBe('Texto com negrito, itálico, código, link e fisica-moderna.');
  });

  test('joins a paragraph that spans several lines', () => {
    expect(excerpt('Primeira linha\ncontinua aqui.\n\nOutro.')).toBe('Primeira linha continua aqui.');
  });

  test('uses list items and quotes when there is no plain paragraph', () => {
    expect(excerpt('# Título\n\n- item um\n- item dois\n')).toBe('item um');
    expect(excerpt('> Citação famosa.\n')).toBe('Citação famosa.');
  });

  test('cuts long text at a word boundary with an ellipsis', () => {
    const long = 'palavra '.repeat(40).trim();
    const result = excerpt(long, 50);
    expect(result.length).toBeLessThanOrEqual(51);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toMatch(/\s…$/);
    expect(long.startsWith(result.slice(0, -1))).toBe(true);
  });

  test('is empty for a page with no text', () => {
    expect(excerpt('')).toBe('');
    expect(excerpt(`${A}\n# Só um título\n`)).toBe('');
  });

  test('never returns markup, even from raw HTML', () => {
    expect(excerpt('<div onclick="x()">Oi <b>você</b></div>\n\nTexto.')).toBe('Texto.');
    expect(excerpt('Texto <img src=x onerror=alert(1)> limpo.')).toBe('Texto limpo.');
  });
});
