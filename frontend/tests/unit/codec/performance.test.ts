import { expect, test } from 'vitest';
import { decode } from '../../../src/editor/codec/decode';
import { encode } from '../../../src/editor/codec/encode';
import { testConverter } from './converter';

// SC-005 (a 2,000-line page opens in edit mode in under 2 s) is measured in a real browser (quickstart §7).
// Here, other test files run in parallel and slow everything several times over (0.7 s alone, about 5 s in
// the full suite), so wall-clock bounds would measure the machine. This test catches what does show up
// anyway: a codec change that makes large pages take far longer, e.g. quadratic work per segment.
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

test('a 2,000-line page round-trips byte for byte without pathological slowdowns', { timeout: 30_000 }, () => {
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
  expect(decodedAt - started).toBeLessThan(15_000);
  expect(finished - decodedAt).toBeLessThan(5_000);
});
