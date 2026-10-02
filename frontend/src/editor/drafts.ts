/**
 * Unsaved drafts, kept on this device only (spec US3, research R7, data-model.md Draft).
 * Every storage call is guarded: when storage is unavailable, editing still works, without recovery.
 */
export type Draft = {
  title: string;
  /** Encoded Markdown, not editor JSON, so it stays readable across editor versions. */
  content: string;
  /** The version the draft started from; saving it against a newer page leads to the conflict screen. */
  baseEtag: string;
  savedAt: string;
};

const PREFIX = 'germinawiki.draft.';
const TAB_KEY = 'germinawiki.tab-id';
let fallbackTab: string | null = null;

/** A random id for this tab, so two tabs editing the same page keep separate drafts. */
export function tabId(): string {
  try {
    let id = sessionStorage.getItem(TAB_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(TAB_KEY, id);
    }
    return id;
  } catch {
    fallbackTab ??= crypto.randomUUID();
    return fallbackTab;
  }
}

export function draftKey(userId: string, pageId: string, tab = tabId()): string {
  return `${PREFIX}${userId}.${pageId}.${tab}`;
}

export function saveDraft(userId: string, pageId: string, draft: Draft, tab = tabId()): void {
  try {
    localStorage.setItem(draftKey(userId, pageId, tab), JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the draft is simply not kept.
  }
}

export function removeDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

function keys(prefix: string): string[] {
  try {
    return Object.keys(localStorage).filter(key => key.startsWith(prefix));
  } catch {
    return [];
  }
}

function read(key: string): Draft | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Draft> | null;
    const valid = value !== null && typeof value === 'object'
      && typeof value.title === 'string' && typeof value.content === 'string'
      && typeof value.baseEtag === 'string' && typeof value.savedAt === 'string'
      && Number.isFinite(Date.parse(value.savedAt));
    if (valid) return value as Draft;
  } catch {
    // Unreadable: dropped below.
  }
  removeDraft(key);
  return null;
}

/** The most recent draft of this member for this page across all tabs, and how many others exist. */
export function newestDraft(userId: string, pageId: string): { key: string; draft: Draft; others: number } | null {
  const found = keys(`${PREFIX}${userId}.${pageId}.`)
    .map(key => ({ key, draft: read(key) }))
    .filter((entry): entry is { key: string; draft: Draft } => entry.draft !== null)
    .sort((a, b) => Date.parse(b.draft.savedAt) - Date.parse(a.draft.savedAt));
  return found.length ? { ...found[0], others: found.length - 1 } : null;
}

/** Removes every draft of a member (on logout, so the next person on a shared computer can't read them). */
export function clearDrafts(userId: string): void {
  keys(`${PREFIX}${userId}.`).forEach(removeDraft);
}

/**
 * Writes this tab's draft 1 s after the last change, and at once when the page is hidden or closed.
 * `snapshot` returns the current draft, or null when there is nothing unsaved (the draft is removed).
 */
export function createDraftWriter(userId: string, pageId: string, snapshot: () => Draft | null, delayMs = 1000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    const draft = snapshot();
    if (draft) saveDraft(userId, pageId, draft);
    else removeDraft(draftKey(userId, pageId));
  };
  const onHidden = () => { if (document.visibilityState === 'hidden') flush(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', onHidden);
  return {
    schedule() {
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    flush,
    stop() {
      clearTimeout(timer);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
    }
  };
}
