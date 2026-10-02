import { marked, type TokensList } from 'marked';
import { RAW_BLOCK_TYPE, parseAnchor, type BlockLike } from './anchors';

type Links = TokensList['links'];

/** Markdown ⇄ blocks conversion, provided by the BlockNote editor (synchronous in 0.55). */
export type Converter = {
  parse(markdown: string): BlockLike[];
  serialize(blocks: BlockLike[]): string;
};

/** One top-level Markdown block of the stored content (data-model.md, Segment). */
export type Segment = {
  anchor: string | null;
  /** Exact original text between the previous segment and this one, anchor line included. */
  prefix: string;
  /** Exact original Markdown of the segment, without trailing newlines. */
  source: string;
  blockIds: string[];
  /** The segment's blocks as loaded, for change detection. */
  snapshot: string;
  faithful: boolean;
};

export type Decoded = {
  original: string;
  blocks: BlockLike[];
  segments: Segment[];
  /** Exact original text after the last segment. */
  suffix: string;
};

/**
 * Splits stored Markdown into top-level segments (research R3). Untouched segments are later written
 * back from `source`, so BlockNote's lossy Markdown conversion only ever touches edited content.
 */
export function decode(markdown: string, converter: Converter): Decoded {
  const tokens = marked.lexer(markdown);
  // Reference links and footnotes resolve against definitions elsewhere on the page.
  const links = tokens.links;
  const segments: Segment[] = [];
  const blocks: BlockLike[] = [];
  let gap = '';
  let anchor: string | null = null;

  for (const token of tokens) {
    if (token.type === 'space') {
      gap += token.raw;
      continue;
    }
    const tokenAnchor = token.type === 'html' ? parseAnchor(token.raw) : null;
    if (tokenAnchor) {
      gap += token.raw;
      anchor = tokenAnchor;
      continue;
    }
    const source = token.raw.replace(/\n+$/, '');
    const segmentBlocks = toBlocks(source, anchor, converter, links);
    segments.push({
      anchor,
      prefix: gap,
      source,
      blockIds: segmentBlocks.blocks.map(b => b.id),
      snapshot: JSON.stringify(segmentBlocks.blocks),
      faithful: segmentBlocks.faithful
    });
    blocks.push(...segmentBlocks.blocks);
    gap = token.raw.slice(source.length);
    anchor = null;
  }
  return { original: markdown, blocks, segments, suffix: gap };
}

/** Re-takes the snapshots from the editor's own document, which may normalise blocks on load. */
export function syncSnapshots(decoded: Decoded, document: BlockLike[]): void {
  const byId = new Map(document.map(block => [block.id, block]));
  for (const segment of decoded.segments) {
    const loaded = segment.blockIds.map(id => byId.get(id));
    if (loaded.every(Boolean)) segment.snapshot = JSON.stringify(loaded);
  }
}

function toBlocks(source: string, anchor: string | null, converter: Converter, links: Links) {
  const parsed = faithfulBlocks(source, converter, links);
  const blocks = parsed ?? [rawBlock(source)];
  if (anchor) blocks[0].id = anchor;
  return { blocks, faithful: parsed !== null };
}

/** The parsed blocks if converting them back renders the same HTML as the source, otherwise null (R4). */
function faithfulBlocks(source: string, converter: Converter, links: Links): BlockLike[] | null {
  const parsed = converter.parse(source);
  if (parsed.length === 0) return null;
  return html(converter.serialize(structuredClone(parsed)), links) === html(source, links) ? parsed : null;
}

/** Rendered HTML of a segment in the context of the page's link definitions, whitespace-normalised. */
function html(markdown: string, links: Links): string {
  const lexer = new marked.Lexer();
  Object.assign(lexer.tokens.links, links);
  const rendered = marked.parser(lexer.lex(markdown));
  return rendered.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
}

function rawBlock(markdown: string): BlockLike {
  return { id: crypto.randomUUID(), type: RAW_BLOCK_TYPE, props: { markdown }, children: [] };
}
