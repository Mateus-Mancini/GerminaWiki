import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { installLinkPreviews, PREVIEW_DELAY_MS } from '../../../src/reader/preview';

// FR-016, research R5: previews of internal links, from pages the app already has.
const pages: Record<string, { title: string; content: string; subject?: string }> = {
  p1: { title: 'Física moderna', content: '# Física moderna\n\nA física do <b>século XX</b> e seus **efeitos**.', subject: 'Física' }
};

let uninstall: () => void;
let link: HTMLAnchorElement;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<article><p>Veja <a class="wikilink" href="#fisica" data-page="p1">Física moderna</a> e <a class="wikilink" href="#x" data-page="unknown">outra</a> e <a href="https://e.com">fora</a>.</p></article>';
  link = document.querySelector<HTMLAnchorElement>('a[data-page="p1"]')!;
  uninstall = installLinkPreviews(document.body, id => pages[id]);
});
afterEach(() => { uninstall(); vi.useRealTimers(); document.body.innerHTML = ''; });

const preview = () => document.querySelector<HTMLElement>('[role="tooltip"]');
const visible = () => Boolean(preview() && !preview()!.hidden);

describe('link previews', () => {
  test('appear after a short hover, with the title and opening text as text', () => {
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(visible()).toBe(false);
    vi.advanceTimersByTime(PREVIEW_DELAY_MS);
    expect(visible()).toBe(true);
    expect(preview()!.textContent).toContain('Física moderna');
    expect(preview()!.textContent).toContain('A física do século XX e seus efeitos.');
    expect(preview()!.querySelector('b')).toBeNull();
    expect(link.getAttribute('aria-describedby')).toBe(preview()!.id);
  });

  test('a quick pass over the link shows nothing', () => {
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    vi.advanceTimersByTime(PREVIEW_DELAY_MS / 2);
    link.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    vi.advanceTimersByTime(PREVIEW_DELAY_MS);
    expect(visible()).toBe(false);
  });

  test('keyboard focus shows it at once; blur and Esc hide it', () => {
    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(visible()).toBe(true);
    link.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(visible()).toBe(false);
    expect(link.hasAttribute('aria-describedby')).toBe(false);

    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(visible()).toBe(false);
  });

  test('leaving the link hides it', () => {
    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    link.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(visible()).toBe(false);
  });

  test('unknown pages and external links get no preview', () => {
    document.querySelector('a[data-page="unknown"]')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    document.querySelector('a[href^="https"]')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(visible()).toBe(false);
  });

  test('uninstalling removes the card and stops listening', () => {
    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    uninstall();
    expect(preview()).toBeNull();
    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(preview()).toBeNull();
    uninstall = () => {};
  });
});
