import { describe, expect, test } from 'vitest';
import { RAW_BLOCK_TYPE, type BlockLike } from '../../../src/editor/codec/anchors';
import { decode } from '../../../src/editor/codec/decode';
import { encode } from '../../../src/editor/codec/encode';
import { A1, A2, A3, SPIKE_PAGE, testConverter } from './converter';

const converter = testConverter();
const clone = <T>(value: T): T => structuredClone(value);
const anchors = (markdown: string) => [...markdown.matchAll(/<!--b:([0-9a-f-]{36})-->/g)].map(m => m[1]);
const paragraph = (id: string, text: string): BlockLike => ({
  id, type: 'paragraph', props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
  content: [{ type: 'text', text, styles: {} }], children: []
});

describe('encode without edits', () => {
  test.each([
    ['the spike page', SPIKE_PAGE],
    ['content without anchors', 'Primeiro.\n\nSegundo.\n'],
    ['no trailing newline', `<!--b:${A1}-->\nÚnico parágrafo.`],
    ['extra blank lines', `<!--b:${A1}-->\nUm.\n\n\n\n<!--b:${A2}-->\nDois.\n\n`],
    ['empty page', '']
  ])('%s is byte-identical (SC-007)', (_name, markdown) => {
    const decoded = decode(markdown, converter);
    expect(encode(decoded, clone(decoded.blocks), converter)).toBe(markdown);
  });
});

describe('encode with edits', () => {
  test('re-serializes only the edited segment', () => {
    const decoded = decode(SPIKE_PAGE, converter);
    const doc = clone(decoded.blocks);
    const edited = doc.find(b => b.id === A2)!;
    (edited.content as { text: string }[]).push({ type: 'text', text: ' EDITADO', styles: {} } as never);
    const out = encode(decoded, doc, converter);

    expect(out).toContain('[[outra-pagina]] e [link](https://x.com). EDITADO');
    // Untouched segments keep their exact syntax.
    expect(out).toContain('- item 1\n- item 2\n  - aninhado');
    expect(out).toContain('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(out).toContain('---\n\nLinha com <span>html</span>.');
    expect(anchors(out)).toEqual([A1, A2, A3]);
  });

  test('editing the text of an anchored block keeps its anchor right before it', () => {
    const decoded = decode(`<!--b:${A1}-->\nAntes.\n`, converter);
    const out = encode(decoded, [paragraph(A1, 'Depois.')], converter);
    expect(out).toBe(`<!--b:${A1}-->\nDepois.\n`);
  });

  test('new blocks get fresh anchors; a run of list items stays one list', () => {
    const decoded = decode(`<!--b:${A1}-->\nUm.\n`, converter);
    const list = converter.parse('- a\n- b\n');
    const doc = [...clone(decoded.blocks), paragraph('new-1', 'Novo.'), ...list];
    const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
    const out = encode(decoded, doc, converter, () => ids.shift()!);
    expect(out).toBe(
      `<!--b:${A1}-->\nUm.\n\n<!--b:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-->\nNovo.\n\n` +
      `<!--b:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb-->\n- a\n- b\n`
    );
  });

  test('an edited segment without an anchor gains one', () => {
    const decoded = decode('Sem âncora.\n', converter);
    const out = encode(decoded, [paragraph(decoded.blocks[0].id, 'Editado.')], converter,
      () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(out).toBe('<!--b:cccccccc-cccc-4ccc-8ccc-cccccccccccc-->\nEditado.\n');
  });

  test('deleting a block drops its anchor and keeps the others', () => {
    const decoded = decode(SPIKE_PAGE, converter);
    const doc = clone(decoded.blocks).filter(b => b.id !== A2);
    const out = encode(decoded, doc, converter);
    expect(anchors(out)).toEqual([A1, A3]);
    expect(out).not.toContain('Parágrafo');
  });

  test('moving a block moves its anchor with it', () => {
    const decoded = decode(`<!--b:${A1}-->\nUm.\n\n<!--b:${A2}-->\nDois.\n`, converter);
    const out = encode(decoded, clone(decoded.blocks).reverse(), converter);
    expect(out).toBe(`<!--b:${A2}-->\nDois.\n\n<!--b:${A1}-->\nUm.\n`);
  });

  test('a duplicated id keeps the anchor only at its first occurrence', () => {
    const decoded = decode(`<!--b:${A1}-->\nUm.\n`, converter);
    const out = encode(decoded, [paragraph(A1, 'Um.'), paragraph(A1, 'Cópia.')], converter,
      () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    expect(anchors(out)).toEqual([A1, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd']);
  });

  test('raw Markdown blocks are written back exactly as edited', () => {
    const decoded = decode('Linha com <span>html</span>.\n', converter);
    const doc = clone(decoded.blocks);
    doc[0].props = { markdown: 'Linha com <kbd>Ctrl</kbd>.' };
    const out = encode(decoded, doc, converter, () => 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    expect(out).toBe('<!--b:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee-->\nLinha com <kbd>Ctrl</kbd>.\n');
    expect(doc[0].type).toBe(RAW_BLOCK_TYPE);
  });

  test('anchor-like text typed into a block cannot create or steal an anchor (FR-008)', () => {
    const decoded = decode(`<!--b:${A1}-->\nUm.\n\n<!--b:${A2}-->\nDois.\n`, converter);
    const doc = clone(decoded.blocks);
    doc[1] = paragraph(A2, `roubo <!--b:${A1}-->`);
    const out = encode(decoded, doc, converter);
    expect(anchors(out)).toEqual([A1, A2]);
    expect(out).toContain(`roubo &lt;!--b:${A1}-->`);
  });

  test('pasted scripts, styles, handlers and iframes never reach the stored Markdown (FR-013)', () => {
    const decoded = decode('', converter);
    const pasted = converter.html(
      '<p onclick="x()">Oi<script>alert(1)</script><style>p{}</style><iframe src="https://x"></iframe></p>'
    );
    const out = encode(decoded, pasted, converter);
    expect(out).toContain('Oi');
    expect(out).not.toMatch(/<script|<style|onclick|<iframe|alert\(1\)/i);
  });
});
