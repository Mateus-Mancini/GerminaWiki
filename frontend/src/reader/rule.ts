/**
 * Keeps an article's text on the sheet's ruling (specs/003-notebook-design research R2). Paragraphs,
 * lists and quotes already advance in whole rules through their line height and margins; images, code
 * blocks, tables and embedded HTML have heights of their own, so each gets a bottom margin that brings
 * its box to the next whole rule. Re-run whenever those boxes change size (images loading, resizes).
 */
const SNAPPED = ':scope > img, :scope > figure, :scope > pre, :scope > .article-table, :scope > div:not(.article-block):not(.article-table), :scope > hr, :scope > p:has(> img:only-child)';

function ruleOf(root: HTMLElement) {
  return parseFloat(getComputedStyle(root).getPropertyValue('--rule')) || 32;
}

function snapBlocks(root: HTMLElement, rule: number) {
  const containers = [root, ...root.querySelectorAll<HTMLElement>('.article-block')];
  for (const container of containers) {
    for (const element of container.querySelectorAll<HTMLElement>(SNAPPED)) {
      element.style.marginBottom = '';
      const base = parseFloat(getComputedStyle(element).marginBottom) || 0;
      const height = element.getBoundingClientRect().height;
      const remainder = (height + base) % rule;
      const fill = remainder < 0.5 || rule - remainder < 0.5 ? 0 : rule - remainder;
      element.style.marginBottom = `${base + fill}px`;
    }
  }
}

/** Starts keeping `root` on the ruling; returns a function that stops. */
export function snapToRule(root: HTMLElement): () => void {
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => snapBlocks(root, ruleOf(root)));
  };
  schedule();
  const images = [...root.querySelectorAll('img')];
  images.forEach(image => { if (!image.complete) image.addEventListener('load', schedule, { once: true }); });
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  observer?.observe(root);
  return () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    images.forEach(image => image.removeEventListener('load', schedule));
  };
}
