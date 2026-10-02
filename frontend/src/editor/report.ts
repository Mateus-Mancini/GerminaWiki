/**
 * Structured, content-free diagnostics for the editor (constitution V, spec FR-016, research R14).
 * The project has no error-reporting service yet; when one exists, only this function changes.
 */
export type EditorEvent =
  | 'editor.load_failed'
  | 'editor.save_failed'
  | 'editor.conflict'
  | 'editor.auth_expired'
  | 'editor.forbidden';

export type ReportDetails = { pageId: string; status?: number; version?: number };

export function report(event: EditorEvent, details: ReportDetails): void {
  // Copy only the allowed fields, so page text or tokens can never be logged by mistake.
  const entry = { event, pageId: details.pageId, status: details.status, version: details.version };
  const log = event === 'editor.save_failed' || event === 'editor.load_failed' ? console.error : console.warn;
  log('[germinawiki]', JSON.stringify(entry));
}
