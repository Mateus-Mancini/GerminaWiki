import type { CloseResult, EditorApi, EditorHandle } from './PageEditor';

export type { CloseResult, EditorHandle } from './PageEditor';

/** contracts/editor-mount.md */
export type OpenPageEditorOptions = {
  pageId: string;
  /** `#editor-root`, a sibling of the shell's `#root`. */
  host: HTMLElement;
  currentUser: { id: string; name: string };
  onClose: (result: CloseResult) => void;
  onSignedOut: () => void;
  /** Defaults to the shared API client; tests inject fakes. */
  api?: EditorApi;
};

// The editor (BlockNote, React) is a separate chunk: reading pages never downloads it (research R10).
let editorModule: Promise<typeof import('./PageEditor')> | null = null;

export function preloadPageEditor(): void {
  editorModule ??= import('./PageEditor');
}

export async function openPageEditor(options: OpenPageEditorOptions): Promise<EditorHandle> {
  preloadPageEditor();
  const { mountPageEditor } = await editorModule!;
  const { host } = options;
  host.hidden = false;
  document.body.dataset.editing = 'true';

  return new Promise(resolve => {
    let resolved = false;
    const unmount = () => {
      mounted.unmount();
      host.hidden = true;
      delete document.body.dataset.editing;
    };
    const mounted = mountPageEditor(host, {
      pageId: options.pageId,
      currentUser: options.currentUser,
      api: options.api,
      onSignedOut: () => {
        unmount();
        options.onSignedOut();
      },
      handleRef: handle => {
        if (!resolved) {
          resolved = true;
          resolve(handle);
        }
      },
      onClose: result => {
        unmount();
        options.onClose(result);
      }
    });
  });
}
