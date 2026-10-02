import { describe, expect, test } from 'vitest';
import { anchorLine, isUuid, neutralizeAnchors, parseAnchor } from '../../../src/editor/codec/anchors';

const ID = '1b4e28ba-2fa1-4d2b-883f-0016d3cca427';

describe('parseAnchor', () => {
  test('reads a line that is exactly an anchor', () => {
    expect(parseAnchor(`<!--b:${ID}-->`)).toBe(ID);
    expect(parseAnchor(`<!--b:${ID}-->\n`)).toBe(ID);
  });

  test('rejects anything else', () => {
    expect(parseAnchor(`<!--b:${ID.toUpperCase()}-->`)).toBeNull();
    expect(parseAnchor(`<!--b:not-a-uuid-->`)).toBeNull();
    expect(parseAnchor(`<!-- b:${ID} -->`)).toBeNull();
    expect(parseAnchor(`text <!--b:${ID}-->`)).toBeNull();
    expect(parseAnchor(`<!--b:${ID}--> text`)).toBeNull();
    expect(parseAnchor(`<!--b:${ID}-->\n<!--b:${ID}-->`)).toBeNull();
  });
});

describe('anchorLine', () => {
  test('writes the stored format', () => {
    expect(anchorLine(ID)).toBe(`<!--b:${ID}-->`);
  });
});

describe('neutralizeAnchors', () => {
  test('turns typed or pasted anchor-like text into literal text', () => {
    expect(neutralizeAnchors(`see <!--b:${ID}--> here`)).toBe(`see &lt;!--b:${ID}--> here`);
    expect(neutralizeAnchors(`<!--b:x--><!--b:y-->`)).toBe(`&lt;!--b:x-->&lt;!--b:y-->`);
  });

  test('leaves other text and comments alone', () => {
    expect(neutralizeAnchors('<!-- note --> and <b>bold</b>')).toBe('<!-- note --> and <b>bold</b>');
  });
});

describe('isUuid', () => {
  test('accepts lowercase UUIDs only', () => {
    expect(isUuid(ID)).toBe(true);
    expect(isUuid(ID.toUpperCase())).toBe(false);
    expect(isUuid('abc')).toBe(false);
  });
});
