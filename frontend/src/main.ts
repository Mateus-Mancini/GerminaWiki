import './theme/fonts.js';
import './theme/tokens.css';
import './theme/base.css';
import './theme/notebook.css';
import {
  ApiRequestError,
  clearAuthSession,
  createContributionPage,
  getAuthSession,
  getOwnUserProfile,
  getPage,
  listFolders,
  listPages,
  login,
  updateOwnUserProfile,
  type FolderNode,
  type OwnUserProfile,
  type RemotePage
} from './services/backend-api.js';
import { openPageEditor, preloadPageEditor, type EditorHandle } from './editor/index.js';
import { clearDrafts } from './editor/drafts.js';
import { renderArticle } from './reader/article.js';
import { excerpt } from './reader/excerpt.js';
import { installLinkPreviews } from './reader/preview.js';
import { snapToRule } from './reader/rule.js';
import { buildBinder, dividerById, dividerForPage, type Binder, type BinderPage, type Divider } from './shell/binder.js';
import { icon } from './theme/icons.js';
import { turnSheet } from './theme/motion.js';

let query = '';
let selectedFolder = 'all';
let selectedPage: RemotePage | null = null;
/** The subject (divider) whose contents sheet is shown; null on the home sheet and on pages. */
let selectedSubject: string | null = null;
/** The binder drawer, below 900px wide. */
let binderOpen = false;
let pages: RemotePage[] = [];
let folders: FolderNode[] = [];
let notice = '';
let loading = true;
let loginRequired = !getAuthSession();
let authMessage = '';
let currentUser: OwnUserProfile | null = null;
let latestContribution: { parentPageId: string; page: RemotePage } | null = null;
let editorHandle: EditorHandle | null = null;
let stopRuling: (() => void) | null = null;

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const flattenFolders = (nodes: FolderNode[]): FolderNode[] => nodes.flatMap(node => [node, ...flattenFolders(node.children ?? [])]);
const allFolders = () => flattenFolders(folders);
function rootFolder(folderId: string | null) {
  let folder = allFolders().find(item => item.id === folderId);
  while (folder?.parentFolderId) folder = allFolders().find(item => item.id === folder!.parentFolderId);
  return folder;
}
function visiblePages() {
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  return pages.filter(page => {
    const root = rootFolder(page.folderId);
    return (selectedFolder === 'all' || root?.id === selectedFolder) &&
      (!normalizedQuery || `${page.title} ${page.content}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  });
}
const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
function formatDate(value?: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? longDate.format(date) : '';
}
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
function avatarMarkup() {
  const avatarUrl = currentUser?.avatarUrl?.trim();
  if (avatarUrl) {
    try {
      const url = new URL(avatarUrl, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return `<img src="${esc(url.href)}" alt=""/>`;
      }
    } catch {
      // An invalid avatar URL falls back to the user's initials.
    }
  }
  return esc(currentUser?.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'G');
}
/** The divider pulled out of the binder: the open page's subject, or the subject whose contents are shown. */
function currentDivider(binder: Binder) {
  if (selectedPage) return dividerForPage(binder, selectedPage.id);
  return selectedSubject ? dividerById(binder, selectedSubject) : undefined;
}
function render() {
  stopRuling?.();
  stopRuling = null;
  if (loginRequired) {
    document.querySelector('#root')!.innerHTML = renderLogin();
    bind();
    return;
  }
  const binder = buildBinder(folders, pages);
  const divider = currentDivider(binder);
  const sheet = loading ? renderLoading() : selectedPage ? renderPage(selectedPage, binder) : divider ? renderSubject(divider) : renderCatalog(binder);
  document.querySelector('#root')!.innerHTML = `<div class="notebook" data-binder-open="${binderOpen}">${renderBinder(binder, divider)}<div class="binder-scrim" data-close-binder></div><main class="desk" id="main">${renderTopbar()}${sheet}</main></div>${renderContributionDialog()}${renderProfileDialog()}${renderNotice()}`;
  bind();
  const article = document.querySelector<HTMLElement>('.article-body');
  if (article) stopRuling = snapToRule(article);
}
function renderNotice() {
  if (!notice) return '';
  const failed = /^Não /.test(notice);
  return `<div class="notice${failed ? ' notice--error' : ''}" role="status" aria-live="polite">${icon(failed ? 'close' : 'check')}<span>${esc(notice)}</span><button id="dismiss-notice" class="button button--quiet" type="button" aria-label="Fechar aviso">${icon('close')}</button></div>`;
}
function renderTopbar() {
  return `<header class="topbar"><button id="binder-toggle" class="button button--quiet binder-toggle" type="button" aria-controls="binder" aria-expanded="${binderOpen}">${icon('binder')}<span>Matérias</span></button><span class="topbar__brand">GerminaWiki</span></header>`;
}
function renderBinder(binder: Binder, current: Divider | undefined) {
  const sections = binder.sections.map(section => {
    const tabs = section.dividers.map(divider => {
      const open = divider.id === current?.id;
      const list = open ? `<ul class="tab__pages">${divider.pages.map(binderPage).join('')}${divider.groups.map(group => `<li class="tab__group" style="--depth:${group.depth}">${esc(group.name)}</li>${group.pages.map(binderPage).join('')}`).join('')}${divider.pageCount ? '' : '<li class="tab__empty">Nenhuma página ainda</li>'}</ul>` : '';
      return `<li class="tab${open ? ' tab--open' : ''}" data-colour="${divider.colour}"><button class="tab__button" type="button" data-subject="${esc(divider.id)}" ${open && !selectedPage ? 'aria-current="true"' : ''} title="${esc(divider.name)}"><span class="tab__name">${esc(divider.name)}</span><span class="tab__count">${divider.pageCount}</span></button>${list}</li>`;
    }).join('');
    return `<section class="binder__section" aria-labelledby="section-${esc(section.id)}"><h2 class="binder__label" id="section-${esc(section.id)}">${esc(section.name)}</h2>${tabs ? `<ul class="binder__tabs">${tabs}</ul>` : '<p class="binder__empty">Nenhuma matéria nesta seção</p>'}</section>`;
  }).join('');
  const nav = loading ? '<p class="binder__empty">Abrindo o caderno…</p>' : sections || '<p class="binder__empty">Nenhuma pasta foi criada ainda.</p>';
  return `<aside class="binder" id="binder" aria-label="Caderno"><div class="binder__head"><button id="go-home" class="wordmark" type="button" data-home><span class="wordmark__name">GerminaWiki</span><span class="wordmark__tag">caderno da turma</span></button><label class="binder__search">${icon('search')}<span class="visually-hidden">Buscar páginas</span><input id="search" type="search" placeholder="Buscar páginas" value="${esc(query)}" autocomplete="off"/><kbd aria-hidden="true">/</kbd></label></div><nav class="binder__nav" aria-label="Matérias e páginas">${nav}</nav><div class="binder__foot"><button id="open-profile" class="account" type="button" aria-label="Editar perfil"><span class="account__avatar">${avatarMarkup()}</span><span class="account__name">${esc(currentUser?.name ?? 'Minha conta')}</span></button><button id="logout" class="button button--quiet account__leave" type="button">${icon('leave')}<span>Sair</span></button></div></aside>`;
}
function binderPage(page: BinderPage) {
  const here = page.id === selectedPage?.id;
  return `<li><button class="tab__page" type="button" data-page="${esc(page.id)}" ${here ? 'aria-current="page"' : ''} title="${esc(page.title)}">${esc(page.title)}</button></li>`;
}
function renderLogin() {
  return `<main class="cover"><div class="cover__tabs" aria-hidden="true">${[0, 1, 2, 3, 4].map(n => `<span data-colour="${n}"></span>`).join('')}</div><div class="cover__board"><section class="cover__label" aria-labelledby="cover-title"><h1 id="cover-title" class="cover__title">GerminaWiki</h1><p class="cover__subtitle">O caderno compartilhado da turma: anotações, resumos e dicas de cada matéria, escritos por quem faz as aulas.</p><form id="login-form" class="cover__form"><div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="username" placeholder="nome@escola.com.br" required/></div><div class="field"><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" required/></div><p id="login-error" class="form-error" role="alert">${esc(authMessage)}</p><button class="button button--primary cover__submit" type="submit">Entrar</button></form><p class="cover__note">Sua senha não fica salva neste navegador.</p></section></div></main>`;
}
function renderLoading() {
  return '<article class="sheet sheet--loading" aria-busy="true"><div class="sheet__inner"><p class="sheet__state">Abrindo o caderno…</p></div></article>';
}
function entry(page: Pick<RemotePage, 'id' | 'title' | 'content'>, where = '') {
  const text = excerpt(page.content, 140);
  return `<li class="entry"><button class="entry__link" type="button" data-page="${esc(page.id)}"><span class="entry__title">${esc(page.title)}</span>${where ? `<span class="entry__where">${esc(where)}</span>` : ''}${text ? `<span class="entry__text">${esc(text)}</span>` : ''}</button></li>`;
}
function renderCatalog(binder: Binder) {
  const subjects = binder.sections.reduce((sum, section) => sum + section.dividers.length, 0);
  const head = `<header class="sheet__head"><h1 class="headword">Sumário</h1><p class="meta">${plural(subjects, 'matéria', 'matérias')} · ${plural(pages.length, 'página', 'páginas')}</p></header>`;
  const filter = binder.sections.length > 1 ? `<label class="index-filter"><span>Mostrar</span><select id="folder-select" class="input"><option value="all" ${selectedFolder === 'all' ? 'selected' : ''}>Todas as seções</option>${binder.sections.map(section => `<option value="${esc(section.id)}" ${selectedFolder === section.id ? 'selected' : ''}>${esc(section.name)}</option>`).join('')}</select></label>` : '';
  if (query.trim()) {
    const found = visiblePages();
    const results = found.map(page => {
      const divider = dividerForPage(binder, page.id);
      return entry(page, divider ? `${divider.sectionName} › ${divider.name}` : '');
    }).join('');
    return `<article class="sheet"><div class="sheet__inner">${head}<section class="sheet__body" aria-live="polite"><h2 class="sheet__subhead">${plural(found.length, 'página encontrada', 'páginas encontradas')} para “${esc(query.trim())}”</h2>${results ? `<ol class="entries">${results}</ol>` : '<p class="sheet__state">Nenhuma página fala disso ainda. Tente outra palavra.</p>'}</section></div></article>`;
  }
  const sections = binder.sections.filter(section => selectedFolder === 'all' || section.id === selectedFolder).map(section => `<section class="index-section"><h2>${esc(section.name)}</h2>${section.dividers.length ? `<ol class="index">${section.dividers.map(divider => `<li class="index__item" data-colour="${divider.colour}"><button class="index__link" type="button" data-subject="${esc(divider.id)}"><span class="index__name">${esc(divider.name)}</span><span class="index__leader" aria-hidden="true"></span><span class="index__count">${plural(divider.pageCount, 'página', 'páginas')}</span></button></li>`).join('')}</ol>` : '<p class="sheet__state">Nenhuma matéria nesta seção ainda.</p>'}</section>`).join('');
  return `<article class="sheet sheet--index"><div class="sheet__inner">${head}<div class="sheet__body">${filter}${sections || '<p class="sheet__state">O caderno ainda está vazio. Quando houver pastas e páginas, elas aparecem aqui.</p>'}</div></div></article>`;
}
function renderSubject(divider: Divider) {
  const entries = `${divider.pages.map(page => entry(page)).join('')}${divider.groups.map(group => `<li class="entries__group"><h2 class="sheet__subhead">${esc(group.name)}</h2>${group.pages.length ? `<ol class="entries">${group.pages.map(page => entry(page)).join('')}</ol>` : '<p class="sheet__state">Nenhuma página aqui ainda.</p>'}</li>`).join('')}`;
  return `<article class="sheet" data-colour="${divider.colour}"><div class="sheet__inner"><nav class="crumbs" aria-label="Você está em"><button type="button" data-home>Sumário</button><span aria-hidden="true">›</span><span>${esc(divider.sectionName)}</span></nav><header class="sheet__head"><h1 class="headword">${esc(divider.name)}</h1><p class="meta">${esc(divider.sectionName)} · ${plural(divider.pageCount, 'página', 'páginas')}</p></header><div class="sheet__body">${divider.pageCount ? `<ol class="entries">${entries}</ol>` : '<p class="sheet__state">Esta matéria ainda não tem páginas.</p>'}</div></div></article>`;
}
function renderPage(page: RemotePage, binder: Binder) {
  const divider = dividerForPage(binder, page.id);
  const article = renderArticle(page.content, pages, { omitTitle: page.title });
  const headings = article.headings.filter(heading => heading.level <= 3);
  const updated = formatDate(page.updatedAt ?? page.createdAt);
  const meta = [divider?.name, updated && `Atualizada em ${updated}`].filter(Boolean).join(' · ');
  const published = latestContribution?.parentPageId === page.id
    ? `<p class="sheet__published" role="status">Página publicada: <button class="link-button" data-page="${esc(latestContribution.page.id)}" type="button">${esc(latestContribution.page.title)}</button></p>`
    : '';
  const crumbs = `<nav class="crumbs" aria-label="Você está em"><button type="button" data-home>Sumário</button>${divider ? `<span aria-hidden="true">›</span><span>${esc(divider.sectionName)}</span><span aria-hidden="true">›</span><button type="button" data-subject="${esc(divider.id)}">${esc(divider.name)}</button>` : ''}</nav>`;
  const sections = headings.length > 1 ? `<nav class="sections" aria-labelledby="sections-title"><h2 id="sections-title">Nesta página</h2><ol>${headings.map(heading => `<li data-level="${heading.level}"><a href="#${heading.id}">${esc(heading.text)}</a></li>`).join('')}</ol></nav>` : '';
  const contribute = page.folderId
    ? `<footer class="sheet__foot"><p>Falta algo nesta matéria?</p><button id="open-contribution" class="button" type="button">${icon('plus')}Escrever uma página nova${divider ? ` em ${esc(divider.name)}` : ''}</button>${published}</footer>`
    : '';
  return `<article class="sheet sheet--page" data-colour="${divider?.colour ?? 0}"><div class="sheet__inner">${crumbs}<header class="sheet__head"><h1 class="headword">${esc(page.title)}</h1>${meta ? `<p class="meta">${esc(meta)}</p>` : ''}<div class="sheet__actions"><button id="edit-page" class="button pen-button" type="button">${icon('pen')}Editar</button></div></header><div class="sheet__layout">${sections}<section class="article-body" aria-label="Conteúdo">${article.html || '<p class="sheet__state">Esta página ainda não tem conteúdo. Que tal escrever o começo?</p>'}</section></div>${contribute}</div></article>`;
}
function renderContributionDialog() {
  return `<dialog id="contribution-dialog" class="sheet-dialog" aria-labelledby="contribution-title"><form id="contribution-form"><button type="button" class="button button--quiet dialog-close" data-close-dialog="contribution-dialog" aria-label="Fechar">${icon('close')}</button><h2 id="contribution-title">Escrever uma página nova</h2><p>Ela será publicada na mesma matéria desta página, e você poderá editá-la depois.</p><div class="field"><label for="contribution-title-input">Título</label><input id="contribution-title-input" name="title" maxlength="255" required/></div><div class="field"><label for="contribution-body">Primeiro parágrafo</label><textarea id="contribution-body" name="body" rows="5" required></textarea></div><p id="contribution-error" class="form-error" role="alert" aria-live="polite"></p><div class="dialog-actions"><button type="button" class="button" data-close-dialog="contribution-dialog">Cancelar</button><button type="submit" class="button button--primary">Publicar</button></div></form></dialog>`;
}
function renderProfileDialog() {
  if (!currentUser) return '';
  return `<dialog id="profile-dialog" class="sheet-dialog" aria-labelledby="profile-title"><form id="profile-form"><button type="button" class="button button--quiet dialog-close" data-close-dialog="profile-dialog" aria-label="Fechar">${icon('close')}</button><h2 id="profile-title">Meu perfil</h2><p class="profile-email">${esc(currentUser.email)}</p><div class="field"><label for="profile-name">Nome</label><input id="profile-name" name="name" value="${esc(currentUser.name)}" maxlength="150" autocomplete="name" required/></div><div class="field"><label for="profile-avatar">Foto de perfil (endereço da imagem)</label><input id="profile-avatar" name="avatarUrl" type="url" value="${esc(currentUser.avatarUrl ?? '')}" placeholder="https://..."/></div><div class="field"><label for="profile-bio">Sobre mim</label><textarea id="profile-bio" name="bio" rows="4">${esc(currentUser.bio ?? '')}</textarea></div><p id="profile-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button" data-close-dialog="profile-dialog">Cancelar</button><button type="submit" class="button button--primary">Salvar perfil</button></div></form></dialog>`;
}
/** Moves to another sheet (home, a subject, a page) with the page turn. */
function navigate(update: () => void) {
  turnSheet(() => {
    update();
    binderOpen = false;
    notice = '';
    render();
    window.scrollTo({ top: 0 });
  });
}
async function goHome() {
  if (!(await leaveEditor())) return;
  navigate(() => { selectedPage = null; selectedSubject = null; });
}
async function openSubject(id: string) {
  if (!(await leaveEditor())) return;
  navigate(() => { selectedPage = null; selectedSubject = id; });
}
function setBinderOpen(open: boolean) {
  binderOpen = open;
  document.querySelector('.notebook')?.setAttribute('data-binder-open', String(open));
  document.querySelector('#binder-toggle')?.setAttribute('aria-expanded', String(open));
  // Below 900px the binder is a modal drawer over the sheet (notebook.css); the sheet behind the
  // scrim must not be reachable by keyboard or a screen reader while the drawer is open.
  document.querySelector('#main')?.toggleAttribute('inert', open);
  if (open) document.querySelector<HTMLElement>('#binder .tab--open .tab__button, #binder .tab__button, #search')?.focus();
  else document.querySelector<HTMLElement>('#binder-toggle')?.focus();
}
function bind() {
  document.querySelectorAll<HTMLElement>('[data-home]').forEach(button => button.addEventListener('click', () => { void goHome(); }));
  document.querySelectorAll<HTMLElement>('[data-subject]').forEach(button => button.addEventListener('click', () => { void openSubject(button.dataset.subject!); }));
  document.querySelector<HTMLButtonElement>('#binder-toggle')?.addEventListener('click', () => setBinderOpen(!binderOpen));
  document.querySelector<HTMLElement>('[data-close-binder]')?.addEventListener('click', () => setBinderOpen(false));
  document.querySelector<HTMLSelectElement>('#folder-select')?.addEventListener('change', event => { selectedFolder = (event.target as HTMLSelectElement).value; render(); });
  document.querySelector<HTMLInputElement>('#search')?.addEventListener('input', event => {
    query = (event.target as HTMLInputElement).value;
    // Results are listed on the home sheet (research R8), so searching from a page goes back there.
    if (query.trim() && (selectedPage || selectedSubject) && !editorHandle) { selectedPage = null; selectedSubject = null; }
    const position = query.length;
    render();
    const input = document.querySelector<HTMLInputElement>('#search')!;
    input.focus();
    input.setSelectionRange(position, position);
  });
  document.querySelectorAll<HTMLButtonElement>('button[data-page], a.wikilink[data-page]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); void openPage(button.dataset.page!); }));
  document.querySelector('#open-contribution')?.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#contribution-dialog')?.showModal());
  document.querySelectorAll<HTMLElement>('[data-close-dialog]').forEach(button => button.addEventListener('click', () => document.querySelector<HTMLDialogElement>(`#${button.dataset.closeDialog}`)?.close()));
  document.querySelector<HTMLFormElement>('#contribution-form')?.addEventListener('submit', event => { void contribute(event); });
  document.querySelector<HTMLFormElement>('#login-form')?.addEventListener('submit', event => { void signIn(event); });
  document.querySelector<HTMLButtonElement>('#open-profile')?.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#profile-dialog')?.showModal());
  document.querySelector<HTMLFormElement>('#profile-form')?.addEventListener('submit', event => { void saveProfile(event); });
  document.querySelector<HTMLButtonElement>('#logout')?.addEventListener('click', () => { void logout(); });
  document.querySelector<HTMLButtonElement>('#dismiss-notice')?.addEventListener('click', () => { notice = ''; render(); });
  document.querySelector<HTMLButtonElement>('#edit-page')?.addEventListener('click', () => { void editPage(); });
  // Fetch the editor in the background while a page is being read (specs/002-page-editor research R10).
  if (selectedPage) window.requestIdleCallback?.(() => preloadPageEditor());
}
/** The page editor (editor-ui, specs/002-page-editor/contracts/editor-mount.md). */
async function editPage() {
  const page = selectedPage;
  if (!page || !currentUser || editorHandle) return;
  const button = document.querySelector<HTMLButtonElement>('#edit-page');
  if (button) button.disabled = true;
  try {
    editorHandle = await openPageEditor({
      pageId: page.id,
      host: document.querySelector<HTMLElement>('#editor-root')!,
      currentUser: { id: currentUser.id, name: currentUser.name },
      onClose: result => {
        editorHandle = null;
        if (result.saved && result.page) {
          const saved = result.page;
          selectedPage = saved;
          pages = pages.map(item => item.id === saved.id ? saved : item);
          notice = 'Página salva.';
        }
        render();
        document.querySelector<HTMLButtonElement>('#edit-page')?.focus();
      },
      onSignedOut: () => { editorHandle = null; expireSession(); render(); }
    });
  } catch {
    editorHandle = null;
    notice = 'Não foi possível abrir o editor. Tente novamente.';
    render();
  }
}
/** Asks the editor to close first (it confirms unsaved changes); false means the member stayed. */
async function leaveEditor() {
  return editorHandle ? editorHandle.requestClose() : true;
}
function expireSession() {
  clearAuthSession();
  currentUser = null;
  loginRequired = true;
  selectedPage = null;
  selectedSubject = null;
  binderOpen = false;
  authMessage = 'Sua sessão expirou. Entre novamente para continuar.';
}
function handleUnauthorized(error: unknown) {
  if (!(error instanceof ApiRequestError) || error.status !== 401) return false;
  expireSession();
  return true;
}
async function signIn(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const errorElement = document.querySelector<HTMLElement>('#login-error');
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const data = new FormData(form);
  const email = String(data.get('email') ?? '').trim();
  const password = String(data.get('password') ?? '');
  if (errorElement) errorElement.textContent = '';
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Entrando…'; }
  try {
    await login(email, password);
    authMessage = '';
    notice = '';
    loading = true;
    loginRequired = false;
    render();
    await loadWorkspace();
  } catch (error) {
    if (errorElement) {
      errorElement.textContent = error instanceof ApiRequestError && error.status === 401
        ? 'E-mail ou senha inválidos.'
        : error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.';
    }
  } finally {
    if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.textContent = 'Entrar'; }
  }
}
async function logout() {
  if (!(await leaveEditor())) return;
  // Unsaved drafts stay on the device; remove them so the next person on a shared computer can't read them.
  if (currentUser) clearDrafts(currentUser.id);
  clearAuthSession();
  currentUser = null;
  folders = [];
  pages = [];
  selectedPage = null;
  selectedSubject = null;
  binderOpen = false;
  latestContribution = null;
  loginRequired = true;
  authMessage = '';
  notice = '';
  render();
}
async function openPage(id: string) {
  if (!(await leaveEditor())) return;
  try {
    const page = await getPage(id);
    navigate(() => { selectedPage = page; selectedSubject = null; });
  }
  catch (error) {
    if (!handleUnauthorized(error)) notice = error instanceof Error ? error.message : 'Não foi possível abrir a página.';
    render();
  }
}
async function contribute(event: SubmitEvent) {
  event.preventDefault();
  const parentPage = selectedPage;
  if (!parentPage?.folderId) return;
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const title = String(data.get('title') ?? '').trim();
  const body = String(data.get('body') ?? '').trim();
  if (!title || !body) return;
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const errorElement = document.querySelector<HTMLElement>('#contribution-error');
  if (errorElement) errorElement.textContent = '';
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Publicando…'; }
  try {
    const created = await createContributionPage(parentPage.folderId, title, `# ${title}\n\n${body}`);
    pages = [created, ...pages.filter(page => page.id !== created.id)];
    latestContribution = { parentPageId: parentPage.id, page: created };
    document.querySelector<HTMLDialogElement>('#contribution-dialog')?.close();
    notice = 'Conteúdo publicado. Ele também está na lista da pasta na barra lateral.';
    render();
  } catch (error) {
    if (handleUnauthorized(error)) render();
    else if (errorElement) errorElement.textContent = error instanceof Error ? error.message : 'Não foi possível publicar o conteúdo. Tente novamente.';
  } finally {
    if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.textContent = 'Publicar'; }
  }
}
async function saveProfile(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const errorElement = document.querySelector<HTMLElement>('#profile-error');
  const name = String(data.get('name') ?? '').trim();
  const avatarUrl = String(data.get('avatarUrl') ?? '').trim();
  const bio = String(data.get('bio') ?? '').trim();
  if (!name) return;
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Salvando…'; }
  if (errorElement) errorElement.textContent = '';
  try {
    currentUser = await updateOwnUserProfile({ name, avatarUrl: avatarUrl || null, bio: bio || null });
    notice = 'Perfil atualizado.';
    render();
  } catch (error) {
    if (handleUnauthorized(error)) render();
    else if (errorElement) errorElement.textContent = error instanceof Error ? error.message : 'Não foi possível salvar o perfil.';
  } finally {
    if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.textContent = 'Salvar perfil'; }
  }
}
async function loadWorkspace() {
  if (!getAuthSession()) {
    loginRequired = true;
    loading = false;
    render();
    return;
  }
  try {
    [folders, pages, currentUser] = await Promise.all([listFolders(), listPages(), getOwnUserProfile()]);
    loginRequired = false;
    authMessage = '';
  }
  catch (error) {
    if (!handleUnauthorized(error)) notice = error instanceof Error ? `Não foi possível carregar o workspace: ${error.message}` : 'Não foi possível carregar o workspace.';
  }
  finally { loading = false; render(); }
}
// "/" jumps to search, except while typing: inputs, text areas and the page editor (contenteditable), whose slash menu needs it.
const isTyping = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
document.addEventListener('keydown', event => {
  if (event.key === '/' && !isTyping(event.target)) { event.preventDefault(); document.querySelector<HTMLInputElement>('#search')?.focus(); }
  if (event.key === 'Escape' && binderOpen && !document.querySelector('dialog[open]')) setBinderOpen(false);
});
// Previews of internal links, from the pages already loaded (specs/003-notebook-design FR-016).
installLinkPreviews(document.body, id => {
  const page = pages.find(item => item.id === id);
  if (!page) return undefined;
  const divider = dividerForPage(buildBinder(folders, pages), id);
  return { title: page.title, content: page.content, subject: divider?.name, colour: divider?.colour };
});
render();
if (!loginRequired) void loadWorkspace();
