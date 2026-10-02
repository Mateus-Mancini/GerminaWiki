import { expect, test } from 'vitest';
import { decode } from '../../../src/editor/codec/decode';
import { encode } from '../../../src/editor/codec/encode';
import { testConverter } from './converter';

// SC-005: a 2,000-line page opens in edit mode in under 2 s. The codec's share must stay well below that.
function largePage(lines: number) {
  const parts: string[] = [];
  for (let i = 0; parts.join('\n').split('\n').length < lines; i++) {
    const anchor = `<!--b:${crypto.randomUUID()}-->`;
    switch (i % 4) {
      case 0: parts.push(`${anchor}\n## Seção ${i}\n`); break;
      case 1: parts.push(`${anchor}\nParágrafo ${i} com **negrito**, [[pagina-${i}]] e [link](https://x.com/${i}).\n`); break;
      case 2: parts.push(`${anchor}\n- item ${i}\n- item ${i + 1}\n- item ${i + 2}\n`); break;
      default: parts.push(`${anchor}\n\`\`\`ts\nconst x${i} = ${i};\nconsole.log(x${i});\n\`\`\`\n`);
    }
  }
  return parts.join('\n');
}

test('a 2,000-line page decodes and encodes, unchanged and after an edit, quickly enough', () => {
  const converter = testConverter();
  const markdown = largePage(2000);
  expect(markdown.split('\n').length).toBeGreaterThanOrEqual(2000);

  const started = performance.now();
  const decoded = decode(markdown, converter);
  const decodedAt = performance.now();
  expect(encode(decoded, decoded.blocks, converter)).toBe(markdown);
  const doc = structuredClone(decoded.blocks);
  (doc[1].content as { text: string }[])[0].text = 'Editado ';
  const edited = encode(decoded, doc, converter);
  const finished = performance.now();

  expect(edited).toContain('Editado ');
  // Generous bounds for slow CI machines; locally both are a fraction of this.
  expect(decodedAt - started).toBeLessThan(1500);
  expect(finished - decodedAt).toBeLessThan(500);
});
