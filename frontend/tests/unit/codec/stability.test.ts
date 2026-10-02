import { expect, test } from 'vitest';
import type { BlockLike } from '../../../src/editor/codec/anchors';
import { decode } from '../../../src/editor/codec/decode';
import { encode } from '../../../src/editor/codec/encode';
import { testConverter } from './converter';

const converter = testConverter();

/** Small seeded PRNG (mulberry32), so a failure is reproducible. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const paragraph = (id: string, text: string): BlockLike => ({
  id, type: 'paragraph', props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
  content: [{ type: 'text', text, styles: {} }], children: []
});
const textOf = (block: BlockLike) => (block.content as { text?: string }[] | undefined)?.map(c => c.text ?? '').join('') ?? '';
const anchorsOf = (markdown: string) => [...markdown.matchAll(/<!--b:([0-9a-f-]{36})-->/g)].map(m => m[1]);

test.each([1, 2, 3])('20 edit-and-save cycles keep every surviving block anchored to itself (SC-003, seed %i)', seed => {
  const next = random(seed);
  const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)];
  let markdown = Array.from({ length: 8 }, (_, i) => `<!--b:${crypto.randomUUID()}-->\nBloco ${i}.`).join('\n\n') + '\n';
  let counter = 0;

  for (let cycle = 0; cycle < 20; cycle++) {
    const decoded = decode(markdown, converter);
    const doc = structuredClone(decoded.blocks);
    const anchored = new Map(decoded.segments.filter(s => s.anchor).map(s => [s.anchor!, s]));

    switch (pick(['edit', 'insert', 'delete', 'move'])) {
      case 'edit': {
        const block = pick(doc);
        doc[doc.indexOf(block)] = paragraph(block.id, `${textOf(block)} editado ${cycle}`);
        break;
      }
      case 'insert':
        doc.splice(Math.floor(next() * (doc.length + 1)), 0, paragraph(`new-${counter++}`, `Novo ${cycle}.`));
        break;
      case 'delete':
        if (doc.length > 2) doc.splice(Math.floor(next() * doc.length), 1);
        break;
      case 'move': {
        const [block] = doc.splice(Math.floor(next() * doc.length), 1);
        doc.splice(Math.floor(next() * (doc.length + 1)), 0, block);
        break;
      }
    }

    const expected = doc.map(block => ({ id: block.id, text: textOf(block) }));
    markdown = encode(decoded, doc, converter);
    const anchors = anchorsOf(markdown);

    expect(new Set(anchors).size).toBe(anchors.length);
    for (const { id, text } of expected.filter(e => anchored.has(e.id))) {
      // The anchor survives and still sits directly before its own block's text.
      expect(markdown).toContain(`<!--b:${id}-->\n${text}`);
    }
    // Every block now has an anchor, so every block can receive comments.
    expect(anchors).toHaveLength(expected.length);
  }
});
