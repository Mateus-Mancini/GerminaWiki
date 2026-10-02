import { describe, expect, test } from 'vitest';
import { RAW_BLOCK_TYPE } from '../../../src/editor/codec/anchors';
import { decode } from '../../../src/editor/codec/decode';
import { A1, A2, A3, SPIKE_PAGE, testConverter } from './converter';

const converter = testConverter();

describe('decode', () => {
  test('an anchor belongs to the next segment and becomes its first block id', () => {
    const { segments, blocks } = decode(SPIKE_PAGE, converter);
    expect(segments[0]).toMatchObject({ anchor: A1, source: '# Título' });
    expect(segments[1].anchor).toBe(A2);
    expect(segments[1].source.startsWith('Parágrafo')).toBe(true);
    expect(blocks[0]).toMatchObject({ id: A1, type: 'heading' });
    expect(blocks.find(b => b.id === A2)?.type).toBe('paragraph');
  });

  test('keeps the heading and the paragraph after an anchor apart (the spike merged them)', () => {
    const { blocks } = decode(SPIKE_PAGE, converter);
    expect(blocks.slice(0, 2).map(b => b.type)).toEqual(['heading', 'paragraph']);
  });

  test('lists, code fences and tables form one segment each', () => {
    const { segments } = decode(SPIKE_PAGE, converter);
    const list = segments.find(s => s.source.startsWith('- item 1'))!;
    expect(list.blockIds).toHaveLength(2);
    expect(segments.find(s => s.source.startsWith('```java'))?.blockIds).toHaveLength(1);
    expect(segments.find(s => s.anchor === A3)?.source.startsWith('| a | b |')).toBe(true);
  });

  test('content without anchors decodes, with no anchors invented', () => {
    const { segments } = decode('Primeiro.\n\nSegundo.\n', converter);
    expect(segments.map(s => s.anchor)).toEqual([null, null]);
    expect(segments.map(s => s.source)).toEqual(['Primeiro.', 'Segundo.']);
  });

  test('content the editor cannot represent becomes one raw Markdown block', () => {
    const { segments, blocks } = decode(SPIKE_PAGE, converter);
    const html = segments.find(s => s.source.includes('<span>'))!;
    expect(html.faithful).toBe(false);
    const raw = blocks.find(b => b.id === html.blockIds[0])!;
    expect(raw).toMatchObject({ type: RAW_BLOCK_TYPE, props: { markdown: 'Linha com <span>html</span>.' } });
  });

  test.each([
    ['footnote', 'Texto[^1].\n\n[^1]: Nota.\n'],
    ['reference link', 'Veja [o site][ref].\n\n[ref]: https://x.com\n'],
    ['html block', '<details><summary>Mais</summary>\n\nOculto\n</details>\n']
  ])('%s is kept as raw Markdown', (_name, markdown) => {
    const { segments, blocks } = decode(markdown, converter);
    expect(segments.some(s => !s.faithful)).toBe(true);
    expect(blocks.some(b => b.type === RAW_BLOCK_TYPE)).toBe(true);
  });

  test('faithful syntax variants (bullets, rules, padded tables) are not raw', () => {
    const { segments } = decode('* a\n* b\n\n***\n\n| x | y |\n| - | - |\n| 1 | 2 |\n', converter);
    expect(segments.every(s => s.faithful)).toBe(true);
  });

  test('every block id is unique', () => {
    const { blocks } = decode(SPIKE_PAGE, converter);
    const ids = blocks.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
