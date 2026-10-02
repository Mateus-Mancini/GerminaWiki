import { excerpt } from './excerpt';

/**
 * Link previews (specs/003-notebook-design FR-016, research R5), the nod to Wikipedia's page previews:
 * resting on an internal link, or focusing it, shows a small card with the target's title and opening
 * text. Built from pages the app already holds, so a hover never costs a request. Text only.
 */
export type PreviewPage = { title: string; content: string; subject?: string; colour?: number };
export const PREVIEW_DELAY_MS = 350;
const LINK = 'a.wikilink[data-page]';

export function installLinkPreviews(root: HTMLElement, lookup: (pageId: string) => PreviewPage | undefined): () => void {
  const card = document.createElement('div');
  card.id = 'link-preview';
  card.className = 'link-preview';
  card.setAttribute('role', 'tooltip');
  card.hidden = true;
  document.body.append(card);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: HTMLElement | null = null;

  const hide = () => {
    clearTimeout(timer);
    card.hidden = true;
    current?.removeAttribute('aria-describedby');
    current = null;
  };

  const show = (link: HTMLElement) => {
    const page = lookup(link.dataset.page!);
    if (!page) return;
    current?.removeAttribute('aria-describedby');
    current = link;
    card.replaceChildren();
    if (page.subject) {
      const subject = document.createElement('span');
      subject.className = 'link-preview__subject';
      if (page.colour !== undefined) subject.dataset.colour = String(page.colour);
      subject.textContent = page.subject;
      card.append(subject);
    }
    const title = document.createElement('strong');
    title.className = 'link-preview__title';
    title.textContent = page.title;
    const text = document.createElement('span');
    text.className = 'link-preview__text';
    text.textContent = excerpt(page.content, 220) || 'Esta página ainda não tem texto.';
    card.append(title, text);
    card.hidden = false;
    link.setAttribute('aria-describedby', card.id);
    place(link);
  };

  const place = (link: HTMLElement) => {
    const box = link.getBoundingClientRect();
    const width = card.offsetWidth || 320;
    const left = Math.min(Math.max(8, box.left), window.innerWidth - width - 8);
    const below = box.bottom + 8;
    const top = below + (card.offsetHeight || 0) > window.innerHeight ? box.top - (card.offsetHeight || 0) - 8 : below;
    card.style.left = `${left + window.scrollX}px`;
    card.style.top = `${Math.max(8, top) + window.scrollY}px`;
  };

  const linkFrom = (event: Event) => (event.target instanceof Element ? event.target.closest<HTMLElement>(LINK) : null);

  const onOver = (event: Event) => {
    const link = linkFrom(event);
    if (!link || link === current) return;
    clearTimeout(timer);
    timer = setTimeout(() => show(link), PREVIEW_DELAY_MS);
  };
  const onOut = (event: Event) => {
    const link = linkFrom(event);
    if (!link) return;
    const to = (event as MouseEvent).relatedTarget;
    if (to instanceof Node && link.contains(to)) return;
    hide();
  };
  const onFocus = (event: Event) => { const link = linkFrom(event); if (link) { clearTimeout(timer); show(link); } };
  const onBlur = (event: Event) => { if (linkFrom(event)) hide(); };
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !card.hidden) hide(); };

  root.addEventListener('mouseover', onOver);
  root.addEventListener('mouseout', onOut);
  root.addEventListener('focusin', onFocus);
  root.addEventListener('focusout', onBlur);
  document.addEventListener('keydown', onKey);

  return () => {
    hide();
    card.remove();
    root.removeEventListener('mouseover', onOver);
    root.removeEventListener('mouseout', onOut);
    root.removeEventListener('focusin', onFocus);
    root.removeEventListener('focusout', onBlur);
    document.removeEventListener('keydown', onKey);
  };
}
