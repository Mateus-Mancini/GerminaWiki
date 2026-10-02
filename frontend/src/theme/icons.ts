/**
 * The interface's icons, drawn for the notebook: one 24px grid, 1.6 stroke, round caps, currentColor.
 * Decorative by default (aria-hidden); the control around an icon carries its name.
 */
const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  pen: '<path d="M4 20l1.2-4.6L15.8 4.8a1.9 1.9 0 0 1 2.7 0l.7.7a1.9 1.9 0 0 1 0 2.7L8.6 18.8 4 20Z"/><path d="m14 6.6 3.4 3.4"/>',
  binder: '<path d="M7 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H7z"/><path d="M4.5 7h4M4.5 12h4M4.5 17h4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  leave: '<path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  comment: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7"/><path d="m6.5 7 .9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>'
} as const;

export type IconName = keyof typeof paths;

export function icon(name: IconName, className = 'icon'): string {
  return `<svg class="${className}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
