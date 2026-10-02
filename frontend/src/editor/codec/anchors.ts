/**
 * Comment anchors, as stored in page content (backend data model; comments API):
 * a line `<!--b:<uuid>-->` immediately before the top-level block it belongs to.
 */

/** Minimal shape of a BlockNote block, so the codec doesn't depend on the editor's schema types. */
export type BlockLike = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: BlockLike[];
};

/** Custom block holding Markdown the editor can't represent faithfully (research R4). */
export const RAW_BLOCK_TYPE = 'rawMarkdown';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_ONLY = new RegExp(`^${UUID}$`);
const ANCHOR_ONLY = new RegExp(`^<!--b:(${UUID})-->\\n*$`);

export function isUuid(value: string): boolean {
  return UUID_ONLY.test(value);
}

/** The anchor id if `raw` is exactly one anchor line, otherwise null. */
export function parseAnchor(raw: string): string | null {
  return ANCHOR_ONLY.exec(raw)?.[1] ?? null;
}

export function anchorLine(id: string): string {
  return `<!--b:${id}-->`;
}

/** Only the codec writes anchors: anchor-like text inside a block is stored as literal text. */
export function neutralizeAnchors(markdown: string): string {
  return markdown.replaceAll('<!--b:', '&lt;!--b:');
}
