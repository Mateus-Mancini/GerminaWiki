import './theme/fonts.js';
import './theme/tokens.css';
import './theme/base.css';
import './theme/notebook.css';
import {
  ApiRequestError,
  clearAuthSession,
  createAdminReply,
  createComment,
  createContributionPage,
  deleteComment,
  getAuthSession,
  getOwnUserProfile,
  getPage,
  listComments,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  listPages,
  login,
  registerAccount,
  updateComment,
  updateOwnUserProfile,
  type RemoteComment,
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
import { buildBinder, dividerById, dividerForPage, UNFILED, type Binder, type BinderPage, type Divider } from './shell/binder.js';
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
let authSuccessMessage = '';
let authView: 'login' | 'register' = 'login';
let currentUser: OwnUserProfile | null = null;
let latestContribution: { parentPageId: string; page: RemotePage } | null = null;
let editorHandle: EditorHandle | null = null;
let stopRuling: (() => void) | null = null;
let pageComments: RemoteComment[] = [];
let commentsLoading = false;
let commentsError = '';
let openCommentBlocks = new Set<string>();
let editingCommentId: string | null = null;
let replyingToCommentId: string | null = null;

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
function commentBlockIds(content: string) {
  return [...new Set([...content.matchAll(/<!--b:([0-9a-f-]{36})-->/gi)].map(match => match[1]))];
}
function currentRole() {
  const payload = getAuthSession()?.accessToken.split('.')[1];
  if (!payload) return '';
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return String(JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))).role ?? '');
  } catch {
    return '';
  }
}
function isAdmin() {
  // This only controls which controls are shown. The API remains authoritative for permissions.
  return currentRole() === 'admin';
}
function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function commentPanel(blockId: string) {
  const comments = pageComments.filter(comment => comment.anchor.blockId === blockId);
  const expanded = openCommentBlocks.has(blockId);
  const count = comments.length;
  const toggle = `<button class="comment-toggle" type="button" data-comment-toggle="${esc(blockId)}" aria-expanded="${expanded}">💬 ${expanded ? 'Ocultar' : 'Comentários'} (${count})</button>`;
  if (!expanded) return `<div class="comment-toolbar">${toggle}</div>`;

  const items = comments.map(comment => {
    const ownsComment = comment.userId === currentUser?.id;
    const canManage = ownsComment || isAdmin();
    const editor = editingCommentId === comment.id
      ? `<form class="comment-edit-form" data-comment-edit="${esc(comment.id)}"><label>Editar comentário<textarea name="text" maxlength="2000" required>${esc(comment.text)}</textarea></label><p class="comment-form-error" role="alert"></p><div class="comment-actions"><button class="secondary-button" type="button" data-cancel-comment-edit>Cancelar</button><button class="secondary-button comment-submit" type="submit">Salvar</button></div></form>`
      : `<p class="comment-text">${esc(comment.text).replace(/\r?\n/g, '<br>')}</p>`;
    const replies = comment.adminReplies.map(reply => `<article class="admin-reply"><div class="comment-meta"><strong>Equipe GerminaWiki · Admin</strong><time>${esc(formatDateTime(reply.createdAt))}</time></div><p class="comment-text">${esc(reply.text).replace(/\r?\n/g, '<br>')}</p></article>`).join('');
    const replyForm = isAdmin() && replyingToCommentId === comment.id
      ? `<form class="admin-reply-form" data-admin-reply="${esc(comment.id)}"><label>Resposta administrativa<textarea name="text" maxlength="2000" required></textarea></label><p class="comment-form-error" role="alert"></p><div class="comment-actions"><button class="secondary-button" type="button" data-cancel-admin-reply>Cancelar</button><button class="secondary-button comment-submit" type="submit">Responder</button></div></form>`
      : '';
    return `<article class="comment-card"><div class="comment-meta"><strong>${ownsComment ? 'Você' : 'Membro'}</strong><time>${esc(formatDateTime(comment.createdAt))}</time></div>${editor}<div class="comment-card-actions">${canManage && editingCommentId !== comment.id ? `<button class="comment-icon-button" type="button" data-edit-comment="${esc(comment.id)}" aria-label="Editar comentário" title="Editar comentário"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg><span>Editar</span></button><button class="comment-icon-button comment-delete-button" type="button" data-delete-comment="${esc(comment.id)}" aria-label="Excluir comentário" title="Excluir comentário"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg><span>Excluir</span></button>` : ''}${isAdmin() && replyingToCommentId !== comment.id ? `<button type="button" data-reply-comment="${esc(comment.id)}">Responder como admin</button>` : ''}</div>${replies}${replyForm}</article>`;
  }).join('');
  return `<section class="comment-thread" aria-label="Comentários do bloco">${toggle}${commentsLoading ? '<p class="comment-state">Carregando comentários…</p>' : ''}${commentsError ? `<p class="comment-state comment-state-error" role="alert">${esc(commentsError)}</p>` : ''}${items || (!commentsLoading ? '<p class="comment-state">Ainda não há comentários neste trecho.</p>' : '')}<form class="comment-create-form" data-create-comment="${esc(blockId)}"><label>Adicionar comentário<textarea name="text" maxlength="2000" placeholder="Escreva uma dúvida ou observação…" required></textarea></label><p class="comment-form-error" role="alert"></p><div class="comment-actions"><span>Até 2.000 caracteres</span><button class="secondary-button comment-submit" type="submit">Comentar</button></div></form></section>`;
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
      const list = open ? `<ul class="tab__pages">${divider.pages.map(binderPage).join('')}${divider.groups.map(group => `<li class="tab__group" style="--depth:${group.depth}">${esc(group.name)}</li>${group.pages.map(binderPage).join('')}`).join('')}${divider.pageCount ? '' : '<li class="tab__empty">Nenhuma página ainda</li>'}${divider.id === UNFILED.id ? '' : folderTools(divider.id, divider.name)}</ul>` : '';
      return `<li class="tab${open ? ' tab--open' : ''}" data-colour="${divider.colour}"><button class="tab__button" type="button" data-subject="${esc(divider.id)}" ${open && !selectedPage ? 'aria-current="true"' : ''} title="${esc(divider.name)}"><span class="tab__name">${esc(divider.name)}</span><span class="tab__count">${divider.pageCount}</span></button>${list}</li>`;
    }).join('');
    return `<section class="binder__section" aria-labelledby="section-${esc(section.id)}"><div class="binder__labelrow"><h2 class="binder__label" id="section-${esc(section.id)}">${esc(section.name)}</h2>${section.id === UNFILED.id ? '' : `<button class="binder__tool" type="button" data-folder-new="${esc(section.id)}" aria-label="Nova matéria em ${esc(section.name)}" title="Nova matéria">${icon('plus')}</button><button class="binder__tool" type="button" data-folder-rename="${esc(section.id)}" data-name="${esc(section.name)}" aria-label="Renomear seção ${esc(section.name)}" title="Renomear seção">${icon('pen')}</button><button class="binder__tool" type="button" data-folder-delete="${esc(section.id)}" data-name="${esc(section.name)}" aria-label="Excluir seção ${esc(section.name)}" title="Excluir seção">${icon('close')}</button>`}</div>${tabs ? `<ul class="binder__tabs">${tabs}</ul>` : '<p class="binder__empty">Nenhuma matéria nesta seção</p>'}</section>`;
  }).join('');
  const nav = loading ? '<p class="binder__empty">Abrindo o caderno…</p>' : sections || '<p class="binder__empty">Nenhuma pasta foi criada ainda.</p>';
  return `<aside class="binder" id="binder" aria-label="Caderno"><div class="binder__head"><button id="go-home" class="wordmark" type="button" data-home><span class="wordmark__name">GerminaWiki</span><span class="wordmark__tag">caderno da turma</span></button><label class="binder__search">${icon('search')}<span class="visually-hidden">Buscar páginas</span><input id="search" type="search" placeholder="Buscar páginas" value="${esc(query)}" autocomplete="off"/><kbd aria-hidden="true">/</kbd></label></div><nav class="binder__nav" aria-label="Matérias e páginas">${nav}${loading ? '' : `<button class="binder__add" type="button" data-folder-new="">${icon('plus')}Nova seção</button>`}</nav><div class="binder__foot"><button id="open-profile" class="account" type="button" aria-label="Editar perfil"><span class="account__avatar">${avatarMarkup()}</span><span class="account__name">${esc(currentUser?.name ?? 'Minha conta')}</span></button><button id="logout" class="button button--quiet account__leave" type="button">${icon('leave')}<span>Sair</span></button></div></aside>`;
}
function folderTools(id: string, name: string) {
  return `<li class="tab__tools"><button type="button" data-folder-new="${esc(id)}">Nova subpasta</button><button type="button" data-folder-rename="${esc(id)}" data-name="${esc(name)}">Renomear</button><button type="button" data-folder-move="${esc(id)}" data-name="${esc(name)}">Mover</button><button type="button" data-folder-delete="${esc(id)}" data-name="${esc(name)}">Excluir</button></li>`;
}
/** Folder editing from the binder: create, rename, move and delete, then reload the tree. */
async function folderAction(run: () => Promise<unknown>, done: string) {
  try {
    await run();
    folders = await listFolders();
    notice = done;
  } catch (error) {
    if (handleUnauthorized(error)) return;
    notice = error instanceof ApiRequestError && error.status === 409
      ? 'Não foi possível: já existe uma pasta com esse nome aqui, ou a pasta ainda tem conteúdo.'
      : `Não foi possível alterar a pasta: ${error instanceof Error ? error.message : 'erro desconhecido'}.`;
  }
  render();
}
function bindFolderTools() {
  document.querySelectorAll<HTMLButtonElement>('[data-folder-new]').forEach(button => button.addEventListener('click', () => {
    const parent = button.dataset.folderNew || null;
    const name = window.prompt(parent ? 'Nome da nova pasta:' : 'Nome da nova seção:')?.trim();
    if (name) void folderAction(() => createFolder(name, parent), parent ? 'Pasta criada.' : 'Seção criada.');
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-folder-rename]').forEach(button => button.addEventListener('click', () => {
    const name = window.prompt('Novo nome:', button.dataset.name ?? '')?.trim();
    if (name && name !== button.dataset.name) void folderAction(() => updateFolder(button.dataset.folderRename!, { name }), 'Pasta renomeada.');
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-folder-move]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.folderMove!;
    const targets = allFolders().filter(folder => folder.id !== id);
    const answer = window.prompt(`Mover "${button.dataset.name}" para qual pasta? Deixe vazio para virar uma seção.\n\n${targets.map(folder => folder.name).join(', ')}`);
    if (answer === null || answer === undefined) return;
    const key = answer.trim().toLocaleLowerCase('pt-BR');
    const target = key ? targets.find(folder => folder.name.trim().toLocaleLowerCase('pt-BR') === key) : null;
    if (key && !target) { notice = `Não foi possível: nenhuma pasta se chama "${answer.trim()}".`; render(); return; }
    void folderAction(() => updateFolder(id, { parentFolderId: target?.id ?? null }), 'Pasta movida.');
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-folder-delete]').forEach(button => button.addEventListener('click', () => {
    if (!window.confirm(`Excluir a pasta "${button.dataset.name}"? Esta ação não pode ser desfeita.`)) return;
    const id = button.dataset.folderDelete!;
    void folderAction(async () => {
      await deleteFolder(id);
      if (selectedSubject === id) selectedSubject = null;
    }, 'Pasta excluída.');
  }));
}
function binderPage(page: BinderPage) {
  const here = page.id === selectedPage?.id;
  return `<li><button class="tab__page" type="button" data-page="${esc(page.id)}" ${here ? 'aria-current="page"' : ''} title="${esc(page.title)}">${esc(page.title)}</button></li>`;
}
function renderLogin() {
  const form = authView === 'register'
    ? `<form id="register-form" class="cover__form"><div class="field"><label for="register-name">Nome completo</label><input id="register-name" name="name" type="text" maxlength="150" autocomplete="name" required/></div><div class="field"><label for="register-email">E-mail</label><input id="register-email" name="email" type="email" maxlength="255" autocomplete="email" placeholder="nome@escola.com.br" required/></div><div class="field"><label for="register-password">Senha</label><input id="register-password" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Pelo menos 8 caracteres" required/></div><div class="field"><label for="register-confirm-password">Confirmar senha</label><input id="register-confirm-password" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required/></div><p id="register-error" class="form-error" role="alert">${esc(authMessage)}</p><button class="button button--primary cover__submit" type="submit">Criar conta</button></form><p class="cover__note">Já tem uma conta? <button class="link-button" type="button" data-show-login>Entrar</button></p>`
    : `<form id="login-form" class="cover__form"><div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="username" placeholder="nome@escola.com.br" required/></div><div class="field"><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" required/></div><p id="login-error" class="form-error" role="alert">${esc(authMessage)}</p>${authSuccessMessage ? `<p class="form-success" role="status">${esc(authSuccessMessage)}</p>` : ''}<button class="button button--primary cover__submit" type="submit">Entrar</button></form><p class="cover__note">Ainda não tem uma conta? <button class="link-button" type="button" data-show-register>Criar conta</button></p>`;
  return `<main class="cover"><div class="cover__tabs" aria-hidden="true">${[0, 1, 2, 3, 4].map(n => `<span data-colour="${n}"></span>`).join('')}</div><div class="cover__board"><section class="cover__label" aria-labelledby="cover-title"><h1 id="cover-title" class="cover__title">GerminaWiki</h1><p class="cover__subtitle">O caderno compartilhado da turma: anotações, resumos e dicas de cada matéria, escritos por quem faz as aulas.</p>${form}</section></div></main>`;
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
  const article = renderArticle(page.content, pages, { omitTitle: page.title, wrapBlock: (blockId, html) => `<div class="commentable-block" id="content-block-${esc(blockId)}">${html}</div>${commentPanel(blockId)}` });
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
  bindFolderTools();
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
  document.querySelectorAll<HTMLButtonElement>('[data-comment-toggle]').forEach(button => button.addEventListener('click', () => {
    const blockId = button.dataset.commentToggle!;
    if (openCommentBlocks.has(blockId)) openCommentBlocks.delete(blockId);
    else openCommentBlocks.add(blockId);
    render();
  }));
  document.querySelectorAll<HTMLFormElement>('[data-create-comment]').forEach(form => form.addEventListener('submit', event => { void submitComment(event); }));
  document.querySelectorAll<HTMLFormElement>('[data-comment-edit]').forEach(form => form.addEventListener('submit', event => { void saveCommentEdit(event); }));
  document.querySelectorAll<HTMLFormElement>('[data-admin-reply]').forEach(form => form.addEventListener('submit', event => { void submitAdminReply(event); }));
  document.querySelectorAll<HTMLButtonElement>('[data-edit-comment]').forEach(button => button.addEventListener('click', () => { editingCommentId = button.dataset.editComment!; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-cancel-comment-edit]').forEach(button => button.addEventListener('click', () => { editingCommentId = null; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-delete-comment]').forEach(button => button.addEventListener('click', () => { void removeComment(button.dataset.deleteComment!); }));
  document.querySelectorAll<HTMLButtonElement>('[data-reply-comment]').forEach(button => button.addEventListener('click', () => { replyingToCommentId = button.dataset.replyComment!; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-cancel-admin-reply]').forEach(button => button.addEventListener('click', () => { replyingToCommentId = null; render(); }));
  document.querySelector<HTMLFormElement>('#login-form')?.addEventListener('submit', event => { void signIn(event); });
  document.querySelector<HTMLFormElement>('#register-form')?.addEventListener('submit', event => { void signUp(event); });
  document.querySelector<HTMLButtonElement>('[data-show-register]')?.addEventListener('click', () => { authView = 'register'; authMessage = ''; authSuccessMessage = ''; render(); });
  document.querySelector<HTMLButtonElement>('[data-show-login]')?.addEventListener('click', () => { authView = 'login'; authMessage = ''; render(); });
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
  pageComments = [];
  commentsLoading = false;
  loginRequired = true;
  authView = 'login';
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
  authSuccessMessage = '';
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
async function signUp(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const errorElement = document.querySelector<HTMLElement>('#register-error');
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const data = new FormData(form);
  const name = String(data.get('name') ?? '').trim();
  const email = String(data.get('email') ?? '').trim();
  const password = String(data.get('password') ?? '');
  const confirmation = String(data.get('confirmPassword') ?? '');
  if (errorElement) errorElement.textContent = '';
  if (password !== confirmation) {
    if (errorElement) errorElement.textContent = 'As senhas não coincidem.';
    return;
  }
  if (new TextEncoder().encode(password).length > 72) {
    if (errorElement) errorElement.textContent = 'A senha deve ter no máximo 72 bytes.';
    return;
  }
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Criando conta…'; }
  try {
    await registerAccount({ name, email, password });
    authView = 'login';
    authMessage = '';
    authSuccessMessage = 'Conta criada com sucesso. Entre com seu e-mail e sua senha.';
    render();
  } catch (error) {
    if (errorElement) {
      errorElement.textContent = error instanceof ApiRequestError && error.status === 409
        ? 'Este e-mail já está cadastrado.'
        : error instanceof ApiRequestError && error.status === 400
          ? 'Confira o nome, o e-mail e os requisitos da senha.'
          : error instanceof Error ? error.message : 'Não foi possível criar a conta. Tente novamente.';
    }
  } finally {
    if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.innerHTML = 'Criar conta <span>→</span>'; }
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
  pageComments = [];
  commentsLoading = false;
  commentsError = '';
  openCommentBlocks = new Set();
  editingCommentId = null;
  replyingToCommentId = null;
  loginRequired = true;
  authView = 'login';
  authMessage = '';
  authSuccessMessage = '';
  notice = '';
  render();
}
async function openPage(id: string) {
  if (!(await leaveEditor())) return;
  try {
    const page = await getPage(id);
    navigate(() => {
      selectedPage = page;
      selectedSubject = null;
      pageComments = [];
      commentsError = '';
      openCommentBlocks = new Set();
      editingCommentId = null;
      replyingToCommentId = null;
      commentsLoading = commentBlockIds(page.content).length > 0;
    });
    if (commentsLoading) void loadPageComments(page.id);
  }
  catch (error) {
    if (!handleUnauthorized(error)) notice = error instanceof Error ? error.message : 'Não foi possível abrir a página.';
    render();
  }
}
async function loadPageComments(pageId: string) {
  const comments: RemoteComment[] = [];
  try {
    let page = 0;
    let totalPages = 1;
    while (page < totalPages) {
      const result = await listComments(pageId, page, 100);
      comments.push(...result.items);
      totalPages = result.totalPages;
      page += 1;
    }
    if (selectedPage?.id === pageId) pageComments = comments;
  } catch (error) {
    if (handleUnauthorized(error)) {
      render();
      return;
    }
    if (selectedPage?.id === pageId) commentsError = error instanceof Error ? error.message : 'Não foi possível carregar os comentários.';
  } finally {
    if (selectedPage?.id === pageId && loginRequired === false) {
      commentsLoading = false;
      render();
    }
  }
}
function showCommentFormError(form: HTMLFormElement, error: unknown) {
  if (handleUnauthorized(error)) {
    render();
    return;
  }
  const errorElement = form.querySelector<HTMLElement>('.comment-form-error');
  if (errorElement) errorElement.textContent = error instanceof Error ? error.message : 'Não foi possível salvar o comentário.';
}
async function submitComment(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const pageId = selectedPage?.id;
  const blockId = form.dataset.createComment;
  const data = new FormData(form);
  const text = String(data.get('text') ?? '').trim();
  if (!pageId || !blockId || !text) return;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = 'Enviando…'; }
  const errorElement = form.querySelector<HTMLElement>('.comment-form-error');
  if (errorElement) errorElement.textContent = '';
  try {
    const created = await createComment(pageId, blockId, text);
    if (selectedPage?.id === pageId) {
      pageComments = [...pageComments, created];
      openCommentBlocks.add(blockId);
      editingCommentId = null;
      form.reset();
      render();
    }
  } catch (error) {
    showCommentFormError(form, error);
  } finally {
    if (button?.isConnected) { button.disabled = false; button.textContent = 'Comentar'; }
  }
}
async function saveCommentEdit(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const commentId = form.dataset.commentEdit;
  const text = String(new FormData(form).get('text') ?? '').trim();
  if (!commentId || !text) return;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
  const errorElement = form.querySelector<HTMLElement>('.comment-form-error');
  if (errorElement) errorElement.textContent = '';
  try {
    const updated = await updateComment(commentId, text);
    pageComments = pageComments.map(comment => comment.id === commentId ? updated : comment);
    editingCommentId = null;
    render();
  } catch (error) {
    showCommentFormError(form, error);
  } finally {
    if (button?.isConnected) { button.disabled = false; button.textContent = 'Salvar'; }
  }
}
async function removeComment(commentId: string) {
  const comment = pageComments.find(item => item.id === commentId);
  if (!comment || !window.confirm('Excluir este comentário? Ele deixará de aparecer na conversa.')) return;
  try {
    await deleteComment(commentId);
    pageComments = pageComments.filter(item => item.id !== commentId);
    editingCommentId = null;
    replyingToCommentId = null;
    render();
  } catch (error) {
    if (handleUnauthorized(error)) render();
    else {
      commentsError = error instanceof Error ? error.message : 'Não foi possível excluir o comentário.';
      render();
    }
  }
}
async function submitAdminReply(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const commentId = form.dataset.adminReply;
  const text = String(new FormData(form).get('text') ?? '').trim();
  if (!commentId || !text) return;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = 'Enviando…'; }
  const errorElement = form.querySelector<HTMLElement>('.comment-form-error');
  if (errorElement) errorElement.textContent = '';
  try {
    const reply = await createAdminReply(commentId, text);
    pageComments = pageComments.map(comment => comment.id === commentId
      ? { ...comment, adminReplies: [...comment.adminReplies, reply] }
      : comment);
    replyingToCommentId = null;
    render();
  } catch (error) {
    showCommentFormError(form, error);
  } finally {
    if (button?.isConnected) { button.disabled = false; button.textContent = 'Responder'; }
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
