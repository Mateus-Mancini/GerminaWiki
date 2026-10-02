// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

// contracts/design-tokens.md: the contrast pairs every screen relies on, checked from the token values
// themselves, so a palette change that hurts projector legibility (SC-002) fails here first.
const css = readFileSync(new URL('../../../src/theme/tokens.css', import.meta.url), 'utf8');
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i').exec(root);
  if (!match) throw new Error(`--${name} is not a six-digit hex colour in tokens.css`);
  return match[1];
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(token(a)), luminance(token(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('design token contrast', () => {
  test.each([
    ['ink', 'paper', 7],
    ['ink-soft', 'paper', 7],
    ['link', 'paper', 7],
    ['link-missing', 'paper', 7],
    ['ink', 'paper-shade', 7],
    ['link', 'paper-shade', 4.5],
    ['ink-faint', 'paper', 4.5],
    ['cover-ink', 'cover', 7],
    ['cover-ink-soft', 'cover', 4.5],
    ['paper', 'ink', 7]
  ])('--%s on --%s reaches %s:1', (fg, bg, minimum) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(minimum);
  });

  test.each([0, 1, 2, 3, 4, 5, 6, 7])('cardstock --divider-%s stands out from the cover (3:1)', n => {
    expect(contrast(`divider-${n}`, 'cover')).toBeGreaterThanOrEqual(3);
  });

  test('neighbouring cardstock colours are distinct', () => {
    const colours = [0, 1, 2, 3, 4, 5, 6, 7].map(n => token(`divider-${n}`).toLowerCase());
    expect(new Set(colours).size).toBe(8);
  });
});
