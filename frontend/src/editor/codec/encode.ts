import { RAW_BLOCK_TYPE, anchorLine, neutralizeAnchors, type BlockLike } from './anchors';
import type { Converter, Decoded, Segment } from './decode';

const LIST_TYPES = new Set(['bulletListItem', 'numberedListItem', 'checkListItem']);

type Group = { segment: number; blocks: BlockLike[] };

/**
 * Writes the editor's blocks back as Markdown (research R3, data-model.md encode rule): untouched
 * segments as their original text, edited and new ones through the converter, every edited or new
 * segment with an anchor line, and each anchor at most once, before the block whose id it is.
 */
export function encode(
  decoded: Decoded,
  document: BlockLike[],
  converter: Converter,
  newId: () => string = () => crypto.randomUUID()
): string {
  const groups = group(decoded, document);
  if (isUntouched(decoded, groups)) return decoded.original;

  const knownAnchors = new Set(decoded.segments.flatMap(s => (s.anchor ? [s.anchor] : [])));
  const usedAnchors = new Set<string>();
  const occurrences = countBy(groups.map(g => g.segment));
  let out = '';

  groups.forEach((group, index) => {
    const segment: Segment | undefined = decoded.segments[group.segment];
    const anchor = group.blocks.map(b => b.id).find(id => knownAnchors.has(id) && !usedAnchors.has(id));
    if (anchor) usedAnchors.add(anchor);

    const unchanged = segment !== undefined && occurrences.get(group.segment) === 1 && anchor === (segment.anchor ?? undefined)
      && sameIds(group.blocks, segment.blockIds) && JSON.stringify(group.blocks) === segment.snapshot;

    if (unchanged) {
      out += index === 0 ? segment.prefix.replace(/^\n+/, '') : segment.prefix.startsWith('\n') ? segment.prefix : `\n\n${segment.prefix}`;
      out += segment.source;
    } else {
      out += index === 0 ? '' : '\n\n';
      out += `${anchorLine(anchor ?? newId())}\n${serialize(group.blocks, converter)}`;
    }
  });

  const last = groups.at(-1);
  const lastUntouched = last !== undefined && last.segment >= 0 && last.segment === decoded.segments.length - 1
    && out.endsWith(decoded.segments[last.segment].source);
  return out + (lastUntouched ? decoded.suffix : '\n');
}

/** Consecutive blocks of the same original segment, or runs of new blocks (one per block, lists kept whole). */
function group(decoded: Decoded, document: BlockLike[]): Group[] {
  const segmentOf = new Map<string, number>();
  decoded.segments.forEach((segment, index) => segment.blockIds.forEach(id => segmentOf.set(id, index)));
  const seen = new Set<string>();
  const groups: Group[] = [];

  for (const block of document) {
    // A repeated id (duplicated block) counts as a new block.
    const segment = seen.has(block.id) ? -1 : (segmentOf.get(block.id) ?? -1);
    seen.add(block.id);
    const previous = groups.at(-1);
    const joins = previous !== undefined && previous.segment === segment
      && (segment >= 0 || sameList(previous.blocks.at(-1)!, block));
    if (joins) previous.blocks.push(block);
    else groups.push({ segment, blocks: [block] });
  }
  return groups;
}

function isUntouched(decoded: Decoded, groups: Group[]): boolean {
  return groups.length === decoded.segments.length && groups.every((group, index) => {
    const segment = decoded.segments[index];
    return group.segment === index && sameIds(group.blocks, segment.blockIds)
      && JSON.stringify(group.blocks) === segment.snapshot;
  });
}

function serialize(blocks: BlockLike[], converter: Converter): string {
  const parts: string[] = [];
  let run: BlockLike[] = [];
  const flush = () => {
    if (run.length) parts.push(converter.serialize(run).replace(/\n+$/, ''));
    run = [];
  };
  for (const block of blocks) {
    if (block.type === RAW_BLOCK_TYPE) {
      flush();
      parts.push(String(block.props?.markdown ?? '').replace(/\n+$/, ''));
    } else {
      run.push(block);
    }
  }
  flush();
  return neutralizeAnchors(parts.filter(Boolean).join('\n\n'));
}

function sameList(a: BlockLike, b: BlockLike): boolean {
  return a.type === b.type && LIST_TYPES.has(a.type);
}

function sameIds(blocks: BlockLike[], ids: string[]): boolean {
  return blocks.length === ids.length && blocks.every((block, index) => block.id === ids[index]);
}

function countBy(values: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}
