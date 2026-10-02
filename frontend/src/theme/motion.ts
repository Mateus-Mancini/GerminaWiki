/**
 * The page turn (specs/003-notebook-design research R4): the next sheet slides over the current one.
 * The shell re-renders with innerHTML, so the browser's View Transitions snapshot old and new markup;
 * `::view-transition-*(sheet)` in notebook.css draws the turn. Without support, or when reduced motion
 * is requested, the update simply happens.
 */
type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

export function turnSheet(update: () => void): void {
  const doc = document as ViewTransitionDocument;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (!doc.startViewTransition || reduced) {
    update();
    return;
  }
  doc.startViewTransition(update);
}
