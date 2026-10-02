import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  clearDrafts, createDraftWriter, draftKey, newestDraft, removeDraft, saveDraft, tabId, type Draft
} from '../../src/editor/drafts';

const draft = (over: Partial<Draft> = {}): Draft => ({
  title: 'Física', content: 'Rascunho.\n', baseEtag: '"p1-v3"', savedAt: '2026-10-01T14:00:00.000Z', ...over
});

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('keys', () => {
  test('drafts are kept per member, page and tab, so two tabs never overwrite each other', () => {
    const tab = tabId();
    expect(tab).toMatch(/^[0-9a-f-]{36}$/);
    expect(tabId()).toBe(tab);
    expect(draftKey('u1', 'p1')).toBe(`germinawiki.draft.u1.p1.${tab}`);
    expect(draftKey('u1', 'p1', 'other-tab')).toBe('germinawiki.draft.u1.p1.other-tab');
  });
});

describe('saving and finding drafts', () => {
  test('the newest draft for a member and page wins, and the others are counted', () => {
    saveDraft('u1', 'p1', draft({ content: 'Velho.\n', savedAt: '2026-10-01T13:00:00.000Z' }), 'tab-a');
    saveDraft('u1', 'p1', draft({ content: 'Novo.\n', savedAt: '2026-10-01T15:00:00.000Z' }), 'tab-b');
    saveDraft('u1', 'p2', draft(), 'tab-a');
    saveDraft('u2', 'p1', draft({ savedAt: '2026-10-01T16:00:00.000Z' }), 'tab-a');
    const found = newestDraft('u1', 'p1')!;
    expect(found.draft.content).toBe('Novo.\n');
    expect(found.key).toBe('germinawiki.draft.u1.p1.tab-b');
    expect(found.others).toBe(1);
  });

  test('no draft gives null', () => {
    expect(newestDraft('u1', 'p1')).toBeNull();
  });

  test('unreadable or invalid drafts are ignored and removed', () => {
    localStorage.setItem('germinawiki.draft.u1.p1.bad-json', '{');
    localStorage.setItem('germinawiki.draft.u1.p1.bad-shape', JSON.stringify({ title: 1 }));
    expect(newestDraft('u1', 'p1')).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  test('removeDraft removes only that draft', () => {
    saveDraft('u1', 'p1', draft(), 'tab-a');
    saveDraft('u1', 'p1', draft(), 'tab-b');
    removeDraft('germinawiki.draft.u1.p1.tab-a');
    expect(Object.keys(localStorage)).toEqual(['germinawiki.draft.u1.p1.tab-b']);
  });

  test("clearDrafts removes all of one member's drafts and nobody else's", () => {
    saveDraft('u1', 'p1', draft(), 'tab-a');
    saveDraft('u1', 'p2', draft(), 'tab-b');
    saveDraft('u10', 'p1', draft(), 'tab-a');
    localStorage.setItem('germinawiki.other', 'x');
    clearDrafts('u1');
    expect(Object.keys(localStorage).sort()).toEqual(['germinawiki.draft.u10.p1.tab-a', 'germinawiki.other']);
  });

  test('storage failures never break editing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(() => saveDraft('u1', 'p1', draft())).not.toThrow();
    expect(() => newestDraft('u1', 'p1')).not.toThrow();
    expect(() => clearDrafts('u1')).not.toThrow();
  });
});

describe('createDraftWriter', () => {
  test('writes 1 s after the last change, and at once on flush', () => {
    vi.useFakeTimers();
    let current = draft({ content: 'Um.\n' });
    const writer = createDraftWriter('u1', 'p1', () => current);
    writer.schedule();
    current = draft({ content: 'Dois.\n' });
    writer.schedule();
    vi.advanceTimersByTime(999);
    expect(newestDraft('u1', 'p1')).toBeNull();
    vi.advanceTimersByTime(1);
    expect(newestDraft('u1', 'p1')!.draft.content).toBe('Dois.\n');

    current = draft({ content: 'Três.\n' });
    writer.schedule();
    writer.flush();
    expect(newestDraft('u1', 'p1')!.draft.content).toBe('Três.\n');
    writer.stop();
  });

  test('flushes when the page is hidden or closed', () => {
    const writer = createDraftWriter('u1', 'p1', () => draft({ content: 'Fechando.\n' }));
    writer.schedule();
    window.dispatchEvent(new Event('pagehide'));
    expect(newestDraft('u1', 'p1')!.draft.content).toBe('Fechando.\n');
    writer.stop();
  });

  test('a null snapshot (nothing unsaved) removes this tab\'s draft', () => {
    saveDraft('u1', 'p1', draft());
    const writer = createDraftWriter('u1', 'p1', () => null);
    writer.flush();
    expect(newestDraft('u1', 'p1')).toBeNull();
    writer.stop();
  });
});
