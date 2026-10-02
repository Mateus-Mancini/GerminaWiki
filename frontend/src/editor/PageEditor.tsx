import '@blocknote/ariakit/style.css';
import './editor.css';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { pt } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/ariakit';
import { useCreateBlockNote } from '@blocknote/react';
import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import * as backend from '../services/backend-api';
import { ApiRequestError, VersionConflictError, type RemotePage } from '../services/backend-api';
import { rawMarkdownBlock } from './blocks/rawMarkdown';
import type { BlockLike } from './codec/anchors';
import { decode, syncSnapshots, type Converter, type Decoded } from './codec/decode';
import { encode } from './codec/encode';
import { report } from './report';

export type EditorApi = Pick<typeof backend, 'getPageForEdit' | 'savePage' | 'listPageCommentAnchors' | 'getPublicProfile'>;
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

export function PageEditor({ pageId, onClose, api = backend, handleRef, onEditorReady }: PageEditorProps) {
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
  const decoded = useRef<Decoded | null>(null);
  const etag = useRef('');
  const loading = useRef(true);
  const titleId = useId();

  const titleChanged = page !== null && title.trim() !== page.title;
  const dirty = contentChanged || titleChanged;
  const titleError = page ? titleProblem(title) : null;

  useEffect(() => { onEditorReady?.(editor); }, [editor, onEditorReady]);

  // Load the page, decode it and hand the blocks to the editor.
  const load = useCallback(() => {
    let cancelled = false;
    setStatus({ kind: 'loading' });
    loading.current = true;
    api.getPageForEdit(pageId).then(result => {
      if (cancelled) return;
      const next = decode(result.page.content, converter);
      if (next.blocks.length) editor.replaceBlocks(editor.document, next.blocks as never);
      syncSnapshots(next, editor.document as BlockLike[]);
      decoded.current = next;
      etag.current = result.etag;
      setPage(result.page);
      setTitle(result.page.title);
      setContentChanged(false);
      setStatus({ kind: 'editing' });
      loading.current = false;
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
  }, [api, converter, editor, pageId]);

  useEffect(load, [load]);

  // Content change detection, debounced so large pages stay responsive while typing.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onContentChange = useCallback(() => {
    if (loading.current || !decoded.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = decoded.current;
      if (current) setContentChanged(encode(current, editor.document as BlockLike[], converter) !== current.original);
    }, 150);
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
      || encode(current, editor.document as BlockLike[], converter) !== current.original;
  }, [converter, editor]);

  const close = useCallback((result: CloseResult) => onClose(result), [onClose]);

  const save = useCallback(async () => {
    const current = decoded.current;
    if (!current || !page || titleProblem(title) || status.kind === 'saving') return;
    const content = encode(current, editor.document as BlockLike[], converter);
    if (content === current.original && title.trim() === page.title) return;
    const changes = title.trim() === page.title ? { content } : { title: title.trim(), content };
    setStatus({ kind: 'saving' });
    try {
      const result = await api.savePage(pageId, changes, etag.current);
      etag.current = result.etag;
      close({ saved: true, page: result.page });
    } catch (error) {
      if (error instanceof VersionConflictError) {
        report('editor.conflict', { pageId, status: error.status, version: error.currentVersion ?? undefined });
        setStatus({ kind: 'conflict' });
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
    }
  }, [api, close, converter, editor, page, pageId, status.kind, title]);

  const requestClose = useCallback((): Promise<boolean> => {
    if (!hasUnsavedChanges()) {
      close({ saved: false });
      return Promise.resolve(true);
    }
    return new Promise(resolve => setConfirming(() => (leave: boolean) => {
      setConfirming(null);
      if (leave) close({ saved: false });
      resolve(leave);
    }));
  }, [close, hasUnsavedChanges]);

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

      <div className="page-editor__sheet" hidden={status.kind === 'loading'}>
        {page && (
          <>
            <input
              className="page-editor__title"
              aria-label="Título da página"
              aria-invalid={titleError !== null}
              aria-describedby={titleError ? titleId : undefined}
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
            {titleError && <p id={titleId} className="page-editor__field-error">{titleError}</p>}
          </>
        )}
        <BlockNoteView editor={editor} theme="light" onChange={onContentChange} />
      </div>

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
