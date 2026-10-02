import { BlockNoteEditor } from '@blocknote/core';
import type { BlockLike } from '../../../src/editor/codec/anchors';
import type { Converter } from '../../../src/editor/codec/decode';

/** A headless BlockNote editor (default schema), the same conversion the editor uses at runtime. */
export function testConverter(): Converter & { html(html: string): BlockLike[] } {
  const editor = BlockNoteEditor.create();
  return {
    parse: markdown => editor.tryParseMarkdownToBlocks(markdown),
    serialize: blocks => editor.blocksToMarkdownLossy(blocks as never),
    // Pasting goes through BlockNote's HTML parser.
    html: html => editor.tryParseHTMLToBlocks(html)
  };
}

export const A1 = '11111111-1111-4111-8111-111111111111';
export const A2 = '22222222-2222-4222-8222-222222222222';
export const A3 = '33333333-3333-4333-8333-333333333333';

/** The page from the research spike (R2): BlockNote's own round trip corrupts it. */
export const SPIKE_PAGE = `<!--b:${A1}-->
# Título

<!--b:${A2}-->
Parágrafo com **negrito**, *itálico*, \`code\` e [[outra-pagina]] e [link](https://x.com).

- item 1
- item 2
  - aninhado

1. um
2. dois

> citação

\`\`\`java
int x = 1;
\`\`\`

<!--b:${A3}-->
| a | b |
|---|---|
| 1 | 2 |

![img](https://api.example/api/images/abc)

---

Linha com <span>html</span>.
`;
