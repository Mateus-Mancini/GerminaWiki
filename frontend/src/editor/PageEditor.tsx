import '@blocknote/ariakit/style.css';
import './editor.css';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { pt } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/ariakit';
import { SuggestionMenuController, useCreateBlockNote } from '@blocknote/react';
import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as backend from '../services/backend-api';
import { ApiRequestError, VersionConflictError, type EditablePage, type RemotePage } from '../services/backend-api';
import { ConflictScreen } from './ConflictScreen';
import { DraftBanner } from './DraftBanner';
import { createDraftWriter, draftKey, newestDraft, removeDraft, type Draft } from './drafts';
import { rawMarkdownBlock } from './blocks/rawMarkdown';
import { parseAnchor, type BlockLike } from './codec/anchors';
import { decode, syncSnapshots, type Converter, type Decoded } from './codec/decode';
import { encode } from './codec/encode';
import { report } from './report';
import { WIKILINK_TRIGGER, wikilinkItems } from './wikilinks';

export type EditorApi = Pick<
  typeof backend, 'getPageForEdit' | 'savePage' | 'listPageCommentAnchors' | 'getPublicProfile' | 'searchPages' | 'login'
>;
export type CloseResult = { saved: boolean; page?: RemotePage };
export type EditorHandle = { hasUnsavedChanges(): boolean; requestClose(): Promise<boolean> };

export type PageEditorProps = {
  pageId: string;
  currentUser: { id: string; name: string };
  onClose: (result: CloseResult) => void;
  onSignedOut: () => void;
  api?: EditorApi;
  handleRef?: (handle: EditorHandle) => void;
  /** Gives tests and extensions the BlockNote editor instance once it exists. */
  onEditorReady?: (editor: unknown) => void;
};

type Mine = { title: string; content: string };
type Conflict = { mine: Mine; latest: EditablePage; lastEditor: { name: string; at: string } | null };

type Status =
  | { kind: 'loading' }
  | { kind: 'load_failed'; status?: number }
  | { kind: 'editing' }
  | { kind: 'saving' }
  | { kind: 'failed' }
  | { kind: 'forbidden' }
  | { kind: 'deleted' }
  | { kind: 'conflict' }
  | { kind: 'reauth' };

const MESSAGES = {
  failed: 'Não foi possível salvar. Verifique sua conexão e tente novamente.',
  forbidden: 'Você não tem permissão para editar esta página.',
  deleted: 'Esta página foi excluída enquanto você editava. Copie seu texto antes de sair.',
  conflict: 'Esta página foi alterada por outra pessoa enquanto você editava. Seu texto foi mantido.',
  reauth: 'Sua sessão expirou. Entre novamente para salvar; seu texto foi mantido.'
} as const;

const TITLE_MAX = 255;
const schema = BlockNoteSchema.create({ blockSpecs: { ...defaultBlockSpecs, rawMarkdown: rawMarkdownBlock() } });

function loadFailureMessage(status?: number) {
  if (status === 404) return 'Esta página não existe mais.';
  if (status === 403) return MESSAGES.forbidden;
  if (status === 401) return 'Sua sessão expirou. Entre novamente para editar.';
  return 'Não foi possível abrir a página. Verifique sua conexão e tente novamente.';
}

function titleProblem(title: string) {
  const trimmed = title.trim();
  if (trimmed.length === 0) return 'Informe um título.';
  if (trimmed.length > TITLE_MAX) return `O título pode ter no máximo ${TITLE_MAX} caracteres.`;
  return null;
}

export function PageEditor({ pageId, currentUser, onClose, api = backend, handleRef, onEditorReady }: PageEditorProps) {
  const editor = useCreateBlockNote({ schema, dictionary: pt });
  const converter = useMemo<Converter>(() => ({
    parse: markdown => editor.tryParseMarkdownToBlocks(markdown) as BlockLike[],
    serialize: blocks => editor.blocksToMarkdownLossy(blocks as never)
  }), [editor]);

  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [page, setPage] = useState<RemotePage | null>(null);
  const [title, setTitle] = useState('');
  const [contentChanged, setContentChanged] = useState(false);
  const [confirming, setConfirming] = useState<((leave: boolean) => void) | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [aside, setAside] = useState<Mine | null>(null);
  // Comments per block anchor, for the FR-009 warning; undefined while loading, null if unavailable.
  const [commentCounts, setCommentCounts] = useState<Map<string, number> | null | undefined>(undefined);
  const [pendingDeletion, setPendingDeletion] = useState<{ mine: Mine; affected: number | null } | null>(null);
  const [offeredDraft, setOfferedDraft] = useState<ReturnType<typeof newestDraft>>(null);
  const decoded = useRef<Decoded | null>(null);
  // The published content being edited: what "unsaved changes" and removed anchors are measured against.
  // `decoded` may instead come from a restored draft, so untouched draft text is also kept byte for byte.
  const baseline = useRef({ content: '', anchors: new Set<string>() });
  const restoredDraftKey = useRef<string | null>(null);
  const draftWriter = useRef<ReturnType<typeof createDraftWriter> | null>(null);
  const etag = useRef('');
  const loading = useRef(true);
  const titleId = useId();

  const titleChanged = page !== null && title.trim() !== page.title;
  const dirty = contentChanged || titleChanged;
  const titleError = page ? titleProblem(title) : null;

  useEffect(() => { onEditorReady?.(editor); }, [editor, onEditorReady]);

  /** Puts a page version in the editor as the new starting point (load, discard, continue). */
  const applyVersion = useCallback((version: EditablePage) => {
    loading.current = true;
    const next = decode(version.page.content, converter);
    editor.replaceBlocks(editor.document, (next.blocks.length ? next.blocks : [{ type: 'paragraph' }]) as never);
    syncSnapshots(next, editor.document as BlockLike[]);
    decoded.current = next;
    baseline.current = { content: version.page.content, anchors: new Set(next.segments.flatMap(s => (s.anchor ? [s.anchor] : []))) };
    etag.current = version.etag;
    setPage(version.page);
    setTitle(version.page.title);
    setContentChanged(false);
    loading.current = false;
  }, [converter, editor]);

  // Load the page, decode it and hand the blocks to the editor.
  const load = useCallback(() => {
    let cancelled = false;
    setStatus({ kind: 'loading' });
    loading.current = true;
    api.getPageForEdit(pageId).then(result => {
      if (cancelled) return;
      applyVersion(result);
      const kept = newestDraft(currentUser.id, pageId);
      const differs = kept && (kept.draft.content !== result.page.content || kept.draft.title !== result.page.title);
      setOfferedDraft(differs ? kept : null);
      setStatus({ kind: 'editing' });
      requestAnimationFrame(() => {
        try {
          editor.setTextCursorPosition(editor.document[0], 'start');
          editor.focus();
        } catch {
          // Focus is a convenience; jsdom and hidden hosts may refuse it.
        }
      });
    }).catch(error => {
      if (cancelled) return;
      const httpStatus = error instanceof ApiRequestError ? error.status : undefined;
      report('editor.load_failed', { pageId, status: httpStatus });
      setStatus({ kind: 'load_failed', status: httpStatus });
    });
    return () => { cancelled = true; };
  }, [api, applyVersion, currentUser.id, editor, pageId]);

  useEffect(load, [load]);

  useEffect(() => {
    let cancelled = false;
    api.listPageCommentAnchors(pageId)
      .then(counts => { if (!cancelled) setCommentCounts(counts); })
      .catch(() => { if (!cancelled) setCommentCounts(null); });
    return () => { cancelled = true; };
  }, [api, pageId]);

  const getWikilinkItems = useMemo(() => wikilinkItems(editor as never, api.searchPages), [api, editor]);

  // Content change detection, debounced so large pages stay responsive while typing.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onContentChange = useCallback(() => {
    if (loading.current || !decoded.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = decoded.current;
      if (current) setContentChanged(encode(current, editor.document as BlockLike[], converter) !== baseline.current.content);
    }, 150);
    draftWriter.current?.schedule();
  }, [converter, editor]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Leaving must not depend on the debounce: check the content right now.
  const titleRef = useRef({ title, page });
  titleRef.current = { title, page };
  const hasUnsavedChanges = useCallback(() => {
    const current = decoded.current;
    const { title: currentTitle, page: currentPage } = titleRef.current;
    if (!current || !currentPage) return false;
    return currentTitle.trim() !== currentPage.title
      || encode(current, editor.document as BlockLike[], converter) !== baseline.current.content;
  }, [converter, editor]);

  // Drafts (US3): this tab's draft follows the editor; it disappears when there is nothing unsaved.
  const pageLoaded = page !== null;
  useEffect(() => {
    if (!pageLoaded) return;
    const writer = createDraftWriter(currentUser.id, pageId, (): Draft | null => {
      const current = decoded.current;
      const { title: currentTitle, page: currentPage } = titleRef.current;
      if (!current || !currentPage) return null;
      const content = encode(current, editor.document as BlockLike[], converter);
      if (content === baseline.current.content && currentTitle.trim() === currentPage.title) return null;
      return { title: currentTitle.trim(), content, baseEtag: etag.current, savedAt: new Date().toISOString() };
    });
    draftWriter.current = writer;
    return () => { writer.stop(); draftWriter.current = null; };
  }, [converter, currentUser.id, editor, pageId, pageLoaded]);

  /** After a save or an explicit discard, no draft of this edit remains. */
  const forgetDrafts = useCallback(() => {
    draftWriter.current?.cancel();
    removeDraft(draftKey(currentUser.id, pageId));
    if (restoredDraftKey.current) removeDraft(restoredDraftKey.current);
    restoredDraftKey.current = null;
  }, [currentUser.id, pageId]);

  const restoreDraft = useCallback(() => {
    if (!offeredDraft) return;
    const { draft, key } = offeredDraft;
    loading.current = true;
    const next = decode(draft.content, converter);
    editor.replaceBlocks(editor.document, (next.blocks.length ? next.blocks : [{ type: 'paragraph' }]) as never);
    syncSnapshots(next, editor.document as BlockLike[]);
    decoded.current = next;
    // Saved against the version the draft started from: if the page changed since, the conflict screen opens.
    etag.current = draft.baseEtag;
    restoredDraftKey.current = key;
    setTitle(draft.title);
    setContentChanged(draft.content !== baseline.current.content);
    setOfferedDraft(null);
    loading.current = false;
  }, [converter, editor, offeredDraft]);

  const discardOfferedDraft = useCallback(() => {
    if (offeredDraft) removeDraft(offeredDraft.key);
    setOfferedDraft(null);
  }, [offeredDraft]);

  const close = useCallback((result: CloseResult) => onClose(result), [onClose]);

  const onSaveFailure = useCallback(async (error: unknown, mine: Mine) => {
    if (error instanceof VersionConflictError) {
      report('editor.conflict', { pageId, status: error.status, version: error.currentVersion ?? undefined });
      setStatus({ kind: 'conflict' });
      try {
        const latest = await api.getPageForEdit(pageId);
        const lastEditor = latest.page.updatedBy
          ? await api.getPublicProfile(latest.page.updatedBy)
            .then(profile => ({ name: profile.name, at: latest.page.updatedAt ?? '' }))
            .catch(() => null)
          : null;
        setConflict({ mine, latest, lastEditor });
      } catch (loadError) {
        if (loadError instanceof ApiRequestError && loadError.status === 404) setStatus({ kind: 'deleted' });
      }
    } else if (error instanceof ApiRequestError && error.status === 401) {
      report('editor.auth_expired', { pageId, status: 401 });
      setStatus({ kind: 'reauth' });
    } else if (error instanceof ApiRequestError && error.status === 403) {
      report('editor.forbidden', { pageId, status: 403 });
      setStatus({ kind: 'forbidden' });
    } else if (error instanceof ApiRequestError && error.status === 404) {
      report('editor.save_failed', { pageId, status: 404 });
      setStatus({ kind: 'deleted' });
    } else {
      report('editor.save_failed', { pageId, status: error instanceof ApiRequestError ? error.status : undefined });
      setStatus({ kind: 'failed' });
    }
  }, [api, pageId]);

  /** Saves `mine` if the page is still at `expected`; the title is sent only when it changed. */
  const submit = useCallback(async (mine: Mine, savedTitle: string, expected: string) => {
    setStatus({ kind: 'saving' });
    const changes = mine.title === savedTitle ? { content: mine.content } : { title: mine.title, content: mine.content };
    try {
      const result = await api.savePage(pageId, changes, expected);
      etag.current = result.etag;
      forgetDrafts();
      close({ saved: true, page: result.page });
    } catch (error) {
      await onSaveFailure(error, mine);
    }
  }, [api, close, forgetDrafts, onSaveFailure, pageId]);

  const save = useCallback(async () => {
    const current = decoded.current;
    if (!current || !page || titleProblem(title) || status.kind === 'saving') return;
    const mine = { title: title.trim(), content: encode(current, editor.document as BlockLike[], converter) };
    if (mine.content === baseline.current.content && mine.title === page.title) return;

    // FR-009: anchors that disappear take their comments' place with them; ask first.
    const kept = new Set(mine.content.match(/<!--b:[0-9a-f-]{36}-->/g)?.map(line => line.slice(6, -3)));
    const removed = [...baseline.current.anchors].filter(anchor => !kept.has(anchor));
    if (removed.length) {
      const affected = commentCounts ? removed.reduce((sum, anchor) => sum + (commentCounts.get(anchor) ?? 0), 0) : null;
      if (affected !== 0) {
        setPendingDeletion({ mine, affected });
        return;
      }
    }
    await submit(mine, page.title, etag.current);
  }, [commentCounts, converter, editor, page, status.kind, submit, title]);

  const resolveConflict = useCallback((choice: 'discard' | 'continue' | 'replace') => {
    if (!conflict) return;
    setConflict(null);
    if (choice === 'replace') {
      void submit(conflict.mine, conflict.latest.page.title, conflict.latest.etag);
      return;
    }
    if (choice === 'discard') forgetDrafts();
    applyVersion(conflict.latest);
    setAside(choice === 'continue' ? conflict.mine : null);
    setStatus({ kind: 'editing' });
  }, [applyVersion, conflict, forgetDrafts, submit]);



  const requestClose = useCallback((): Promise<boolean> => {
    if (!hasUnsavedChanges()) {
      close({ saved: false });
      return Promise.resolve(true);
    }
    return new Promise(resolve => setConfirming(() => (leave: boolean) => {
      setConfirming(null);
      if (leave) {
        forgetDrafts();
        close({ saved: false });
      }
      resolve(leave);
    }));
  }, [close, forgetDrafts, hasUnsavedChanges]);

  useEffect(() => { handleRef?.({ hasUnsavedChanges, requestClose }); }, [handleRef, hasUnsavedChanges, requestClose]);

  // Ctrl/Cmd+S saves; closing the tab with unsaved changes asks the browser to confirm.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  if (status.kind === 'load_failed') {
    return (
      <section className="page-editor page-editor--failed" aria-label="Edição de página">
        <p role="alert" className="page-editor__alert">{loadFailureMessage(status.status)}</p>
        <div className="page-editor__actions">
          {status.status !== 404 && status.status !== 403 && <button type="button" onClick={load}>Tentar novamente</button>}
          <button type="button" onClick={() => close({ saved: false })}>Voltar</button>
        </div>
      </section>
    );
  }

  const alert = status.kind in MESSAGES ? MESSAGES[status.kind as keyof typeof MESSAGES] : null;
  const saveLabel = status.kind === 'saving' ? 'Salvando…' : dirty ? 'Salvar' : 'Nada para salvar';
  const statusText = status.kind === 'loading' ? 'Carregando página…' : status.kind === 'saving' ? 'Salvando…' : '';

  return (
    <section className="page-editor" aria-label={page ? `Editando: ${page.title}` : 'Edição de página'}>
      <header className="page-editor__bar">
        <span className="page-editor__mode">Editando</span>
        <p className="page-editor__status" aria-live="polite">{statusText}</p>
        <div className="page-editor__actions">
          <button type="button" className="page-editor__cancel" onClick={() => void requestClose()}>Cancelar</button>
          <button
            type="button"
            className="page-editor__save"
            disabled={!dirty || titleError !== null || status.kind === 'saving'}
            aria-keyshortcuts="Control+S Meta+S"
            onClick={() => void save()}
          >
            {saveLabel}
          </button>
        </div>
      </header>

      {alert && (
        <div role="alert" className="page-editor__alert">
          <p>{alert}</p>
          {status.kind === 'failed' && <button type="button" onClick={() => void save()}>Tentar novamente</button>}
        </div>
      )}

      {offeredDraft && (
        <DraftBanner draft={offeredDraft.draft} others={offeredDraft.others} onRestore={restoreDraft} onDiscard={discardOfferedDraft} />
      )}

      {conflict && (
        <ConflictScreen
          mine={conflict.mine}
          published={conflict.latest.page}
          lastEditor={conflict.lastEditor}
          onDiscard={() => resolveConflict('discard')}
          onContinue={() => resolveConflict('continue')}
          onReplace={() => resolveConflict('replace')}
        />
      )}

      {aside && (
        <aside className="page-editor__aside" aria-label="Sua versão anterior">
          <h2>Sua versão anterior{aside.title !== title.trim() ? `: ${aside.title}` : ''}</h2>
          <pre>{aside.content.split('\n').filter(line => !parseAnchor(line)).join('\n')}</pre>
          <button type="button" onClick={() => setAside(null)}>Fechar</button>
        </aside>
      )}

      <div className="page-editor__sheet" hidden={status.kind === 'loading' || conflict !== null}>
        {page && (
          <>
            <input
              className="page-editor__title"
              aria-label="Título da página"
              aria-invalid={titleError !== null}
              aria-describedby={titleError ? titleId : undefined}
              value={title}
              onChange={event => { setTitle(event.target.value); draftWriter.current?.schedule(); }}
            />
            {titleError && <p id={titleId} className="page-editor__field-error">{titleError}</p>}
          </>
        )}
        <BlockNoteView editor={editor} theme="light" onChange={onContentChange}>
          <SuggestionMenuController triggerCharacter={WIKILINK_TRIGGER} getItems={getWikilinkItems} />
        </BlockNoteView>
      </div>

      {pendingDeletion && page && (
        <div className="page-editor__backdrop">
          <div role="alertdialog" aria-modal="true" aria-labelledby={`${titleId}-comments`} aria-describedby={`${titleId}-comments-text`} className="page-editor__dialog">
            <h2 id={`${titleId}-comments`}>Remover blocos com comentários?</h2>
            <p id={`${titleId}-comments-text`}>
              {pendingDeletion.affected === null
                ? 'Alguns blocos removidos podem ter comentários, que perderão o lugar na página.'
                : `${pendingDeletion.affected} ${pendingDeletion.affected === 1 ? 'comentário perderá' : 'comentários perderão'} o lugar porque os blocos onde estavam foram removidos.`}
            </p>
            <div className="page-editor__actions">
              <button type="button" autoFocus onClick={() => setPendingDeletion(null)}>Voltar</button>
              <button type="button" className="page-editor__danger" onClick={() => {
                const { mine } = pendingDeletion;
                setPendingDeletion(null);
                void submit(mine, page.title, etag.current);
              }}>Salvar mesmo assim</button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="page-editor__backdrop">
          <div role="alertdialog" aria-modal="true" aria-labelledby={`${titleId}-confirm`} aria-describedby={`${titleId}-confirm-text`} className="page-editor__dialog">
            <h2 id={`${titleId}-confirm`}>Descartar alterações?</h2>
            <p id={`${titleId}-confirm-text`}>As alterações que você não salvou serão perdidas.</p>
            <div className="page-editor__actions">
              <button type="button" autoFocus onClick={() => confirming(false)}>Continuar editando</button>
              <button type="button" className="page-editor__danger" onClick={() => confirming(true)}>Descartar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Mounts the editor in the shell's host (contracts/editor-mount.md); used by `openPageEditor`. */
export function mountPageEditor(host: HTMLElement, props: PageEditorProps): { unmount(): void } {
  const root = createRoot(host);
  root.render(<PageEditor {...props} />);
  return { unmount: () => root.unmount() };
}
