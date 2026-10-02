import './styles.css';
import './course.css';
import './login.css';
import './auth.css';
import './workspace.css';
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

let query = '';
let selectedFolder = 'all';
let selectedPage: RemotePage | null = null;
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
let pageComments: RemoteComment[] = [];
let commentsLoading = false;
let commentsError = '';
let openCommentBlocks = new Set<string>();
let editingCommentId: string | null = null;
let replyingToCommentId: string | null = null;

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const flattenFolders = (nodes: FolderNode[]): FolderNode[] => nodes.flatMap(node => [node, ...flattenFolders(node.children ?? [])]);
const allFolders = () => flattenFolders(folders);
function folderForPage(page: RemotePage) { return allFolders().find(folder => folder.id === page.folderId); }
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
function folderTree(nodes: FolderNode[], depth = 0): string {
  return nodes.map(folder => `<div class="api-folder" style="--depth:${depth}"><span title="${esc(folder.name)}">${esc(folder.name)}</span>${pages.filter(page => page.folderId === folder.id).map(page => `<button class="api-page-link" data-page="${esc(page.id)}" data-active="${page.id === selectedPage?.id}">${esc(page.title)}</button>`).join('')}${folderTree(folder.children ?? [], depth + 1)}</div>`).join('');
}
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
function formatDate(value: string) {
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
    const replies = comment.adminReplies.map(reply => `<article class="admin-reply"><div class="comment-meta"><strong>Equipe GerminaWiki · Admin</strong><time>${esc(formatDate(reply.createdAt))}</time></div><p class="comment-text">${esc(reply.text).replace(/\r?\n/g, '<br>')}</p></article>`).join('');
    const replyForm = isAdmin() && replyingToCommentId === comment.id
      ? `<form class="admin-reply-form" data-admin-reply="${esc(comment.id)}"><label>Resposta administrativa<textarea name="text" maxlength="2000" required></textarea></label><p class="comment-form-error" role="alert"></p><div class="comment-actions"><button class="secondary-button" type="button" data-cancel-admin-reply>Cancelar</button><button class="secondary-button comment-submit" type="submit">Responder</button></div></form>`
      : '';
    return `<article class="comment-card"><div class="comment-meta"><strong>${ownsComment ? 'Você' : 'Membro'}</strong><time>${esc(formatDate(comment.createdAt))}</time></div>${editor}<div class="comment-card-actions">${canManage && editingCommentId !== comment.id ? `<button class="comment-icon-button" type="button" data-edit-comment="${esc(comment.id)}" aria-label="Editar comentário" title="Editar comentário"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg><span>Editar</span></button><button class="comment-icon-button comment-delete-button" type="button" data-delete-comment="${esc(comment.id)}" aria-label="Excluir comentário" title="Excluir comentário"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg><span>Excluir</span></button>` : ''}${isAdmin() && replyingToCommentId !== comment.id ? `<button type="button" data-reply-comment="${esc(comment.id)}">Responder como admin</button>` : ''}</div>${replies}${replyForm}</article>`;
  }).join('');
  return `<section class="comment-thread" aria-label="Comentários do bloco">${toggle}${commentsLoading ? '<p class="comment-state">Carregando comentários…</p>' : ''}${commentsError ? `<p class="comment-state comment-state-error" role="alert">${esc(commentsError)}</p>` : ''}${items || (!commentsLoading ? '<p class="comment-state">Ainda não há comentários neste trecho.</p>' : '')}<form class="comment-create-form" data-create-comment="${esc(blockId)}"><label>Adicionar comentário<textarea name="text" maxlength="2000" placeholder="Escreva uma dúvida ou observação…" required></textarea></label><p class="comment-form-error" role="alert"></p><div class="comment-actions"><span>Até 2.000 caracteres</span><button class="secondary-button comment-submit" type="submit">Comentar</button></div></form></section>`;
}
function render() {
  const items = visiblePages();
  const yearFolders = folders.map(folder => `<option value="${esc(folder.id)}" ${selectedFolder === folder.id ? 'selected' : ''}>${esc(folder.name)}</option>`).join('');
  document.querySelector('#root')!.innerHTML = loginRequired ? renderLogin() : `<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">G</span><span><strong>GerminaWiki</strong><small>Seu espaço de aprendizagem</small></span></div><div class="side-caption">WORKSPACE</div>${folders.length ? `<nav class="api-navigation" aria-label="Pastas e páginas">${folderTree(folders)}</nav>` : '<p class="empty-inline">O backend não retornou pastas.</p>'}<div class="sidebar-footer">Conteúdo do workspace</div></aside><main class="main"><header class="topbar"><div class="breadcrumbs"><button id="go-home" class="breadcrumb-button">← Início</button>${selectedPage ? `<span> / </span><strong>${esc(selectedPage.title)}</strong>` : ''}</div><div class="top-actions"><label class="search"><span>⌕</span><input id="search" placeholder="Buscar no workspace..." value="${esc(query)}" aria-label="Buscar no workspace"/><kbd>/</kbd></label><div class="account-actions"><button id="open-profile" class="account-profile" type="button" aria-label="Editar perfil"><span class="account-avatar">${avatarMarkup()}</span><span>${esc(currentUser?.name ?? 'Minha conta')}</span></button><button id="logout" class="logout-button" type="button">Sair</button></div></div></header>${selectedPage ? renderPage(selectedPage) : renderCatalog(items, yearFolders)}</main></div>${renderContributionDialog()}${renderProfileDialog()}${notice ? `<div class="toast" role="status" aria-live="polite"><span>${esc(notice)}</span><button id="dismiss-notice" type="button" aria-label="Fechar aviso">×</button></div>` : ''}`;
  bind();
}
function renderLogin() {
  const isRegister = authView === 'register';
  const form = isRegister
    ? `<form id="register-form"><label for="register-name">Nome completo</label><input id="register-name" name="name" type="text" maxlength="150" autocomplete="name" placeholder="Como podemos te chamar?" required/><label for="register-email">E-mail</label><input id="register-email" name="email" type="email" maxlength="255" autocomplete="email" placeholder="nome@escola.com.br" required/><label for="register-password">Senha</label><input id="register-password" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Pelo menos 8 caracteres" required/><label for="register-confirm-password">Confirmar senha</label><input id="register-confirm-password" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Digite a senha novamente" required/><div id="register-error" class="login-error" role="alert">${esc(authMessage)}</div><button class="primary-button login-submit" type="submit">Criar conta <span>→</span></button></form><p class="login-switch">Já tem uma conta? <button type="button" data-show-login>Entrar</button></p>`
    : `<form id="login-form"><label for="login-email">E-mail escolar</label><input id="login-email" name="email" type="email" autocomplete="username" placeholder="nome@escola.com.br" required/><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Digite sua senha" required/><div id="login-error" class="login-error" role="alert">${esc(authMessage)}</div>${authSuccessMessage ? `<div class="login-success" role="status">${esc(authSuccessMessage)}</div>` : ''}<button class="primary-button login-submit" type="submit">Entrar <span>→</span></button></form><p class="login-switch">Ainda não tem uma conta? <button type="button" data-show-register>Criar conta</button></p>`;
  return `<main class="login-screen"><div class="login-brand"><span class="brand-mark">G</span><span><strong>GerminaWiki</strong><small>Conhecimento compartilhado</small></span></div><section class="login-card"><div class="login-symbol">G</div><div class="eyebrow">${isRegister ? 'JUNTE-SE À COMUNIDADE' : 'ACESSO DO ALUNO'}</div><h1>${isRegister ? 'Crie sua conta' : 'Bem-vindo de volta'}</h1><p>${isRegister ? 'Preencha seus dados para começar a aprender e contribuir com a comunidade.' : 'Entre com sua conta escolar para acessar os conteúdos e contribuir com a comunidade.'}</p>${form}<small class="login-footnote">${isRegister ? 'Sua conta terá acesso de membro.' : 'Sua senha não fica salva neste navegador.'}</small></section><footer class="login-footer">Instituto Germinare · Ambiente de aprendizagem</footer></main>`;
}
function renderCatalog(items: RemotePage[], folderOptions: string) {
  if (loading) return '<section class="content"><p class="empty">Carregando conteúdo do backend…</p></section>';
  return `<section class="content"><div class="welcome"><div><div class="eyebrow">BIBLIOTECA DE CONTEÚDOS</div><h1>Conhecimento<br/><em>do workspace.</em></h1><p>Matérias, páginas e materiais carregados do backend.</p></div><div class="welcome-art"><span>G</span><i>✳</i></div></div><div class="section-heading"><div><div class="eyebrow">PÁGINAS DO BACKEND</div><h2>Conteúdos <span>${items.length}</span></h2></div><select id="folder-select"><option value="all" ${selectedFolder === 'all' ? 'selected' : ''}>Todas as pastas</option>${folderOptions}</select></div><div class="subject-grid">${items.map((page, index) => `<button class="subject-card" data-page="${esc(page.id)}"><span class="subject-icon">${['✧','◉','⌘','∿','✳','◎'][index % 6]}</span><span class="subject-area">${esc(rootFolder(page.folderId)?.name ?? 'Sem pasta')}</span><strong>${esc(page.title)}</strong><span class="open-label">Abrir conteúdo →</span></button>`).join('') || '<div class="empty">Nenhuma página foi retornada pelo backend.</div>'}</div></section>`;
}
function markdownBody(content: string) {
  return content.split(/\r?\n/).map(line => {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) return `<h${heading[1].length}>${esc(heading[2])}</h${heading[1].length}>`;
    if (/^[-*]\s+/.test(line)) return `<li>${esc(line.replace(/^[-*]\s+/, ''))}</li>`;
    if (!line.trim()) return '';
    return `<p>${esc(line)}</p>`;
  }).join('\n').replace(/(?:<li>.*?<\/li>\n?)+/gs, list => `<ul>${list}</ul>`);
}
function markdown(content: string) {
  const result: string[] = [];
  let lines: string[] = [];
  let blockId: string | null = null;
  const flush = () => {
    const html = markdownBody(lines.join('\n'));
    if (html.trim()) {
      result.push(blockId
        ? `<div class="commentable-block" id="content-block-${esc(blockId)}">${html}</div>${commentPanel(blockId)}`
        : html);
    }
    lines = [];
  };
  for (const line of content.split(/\r?\n/)) {
    const marker = /^\s*<!--b:([0-9a-f-]{36})-->\s*$/i.exec(line);
    if (marker) {
      flush();
      blockId = marker[1];
    } else {
      lines.push(line);
    }
  }
  flush();
  return result.join('\n');
}
function contentSections(page: RemotePage) {
  const headings = [...page.content.matchAll(/^##\s+(.+)$/gm)];
  if (!headings.length) return `<section class="remote-content"><div class="topic-kicker">CONTEÚDO DO BACKEND</div>${markdown(page.content) || '<p class="empty-inline">Esta página ainda não tem conteúdo.</p>'}</section>`;
  const blocks = page.content.split(/(?=^##\s+)/m).filter(Boolean);
  return blocks.map((block, index) => {
    const title = /^##\s+(.+)$/m.exec(block)?.[1] ?? page.title;
    return `<section class="topic-section" id="topic-${index}"><div class="topic-kicker">${index ? `SUBTÓPICO ${String(index).padStart(2, '0')}` : 'CONTEÚDO'}</div><h2>${esc(title)}</h2>${markdown(block.replace(/^##\s+.+\n?/, ''))}</section>`;
  }).join('');
}
function renderPage(page: RemotePage) {
  const sections = contentSections(page);
  const headings = [...page.content.matchAll(/^##\s+(.+)$/gm)];
  const blockIds = commentBlockIds(page.content);
  const folder = folderForPage(page);
  const published = latestContribution?.parentPageId === page.id
    ? `<article class="published-contribution" role="status"><div class="topic-kicker">CONTEÚDO PUBLICADO</div><h3>${esc(latestContribution.page.title)}</h3><button class="published-link" data-page="${esc(latestContribution.page.id)}" type="button">Abrir página publicada →</button></article>`
    : '';
  return `<article class="course-page"><div class="course-heading"><div class="eyebrow">${esc(rootFolder(folder?.id ?? null)?.name ?? folder?.name ?? 'WORKSPACE')} · PÁGINA DO BACKEND</div><h1>${esc(page.title)}</h1><p class="course-summary">Conteúdo carregado diretamente do workspace.</p><button id="go-home-page" class="breadcrumb-button">← Voltar aos conteúdos</button></div><div class="course-layout"><nav class="topic-nav"><div class="panel-title">NESTA PÁGINA</div>${headings.map((heading, index) => `<a href="#topic-${index}">${String(index + 1).padStart(2, '0')} · ${esc(heading[1])}</a>`).join('') || '<span class="empty-inline">Sem subtópicos cadastrados.</span>'}<a href="#contribute">＋ Contribuir com conteúdo</a>${blockIds.length ? `<a href="#comments">💬 Comentários (${pageComments.length})</a>` : ''}</nav><div class="course-content">${sections}${blockIds.length ? `<section id="comments" class="comments-summary"><div class="topic-kicker">DISCUSSÃO</div><p>${pageComments.length ? `${pageComments.length} comentário(s) nesta página, distribuídos nos trechos comentáveis.` : 'Abra “Comentários” em um trecho para iniciar a conversa.'}</p></section>` : '<section class="comments-unavailable"><div class="topic-kicker">DISCUSSÃO</div><p>Esta página ainda não tem blocos preparados para comentários.</p></section>'}<section id="contribute" class="contributions-list"><div class="topic-kicker">CONTRIBUIÇÃO</div><h2>Adicionar conteúdo</h2><p>Sua contribuição será publicada como uma nova página na pasta desta matéria.</p>${published}${page.folderId ? '<button id="open-contribution" class="secondary-button">＋ Contribuir com esta matéria</button>' : '<p class="empty-inline">Esta página não está associada a uma pasta, então não é possível determinar onde salvar uma contribuição.</p>'}</section></div></div></article>`;
}
function renderContributionDialog() {
  return `<dialog id="contribution-dialog" class="contribution-dialog"><form id="contribution-form"><button type="button" class="close-button" data-close-dialog="contribution-dialog">×</button><h2>Contribuir com conteúdo</h2><p>O conteúdo será publicado como uma nova página na pasta desta matéria.</p><label>Título<input name="title" maxlength="255" required></label><label>Conteúdo<textarea name="body" rows="7" required></textarea></label><div id="contribution-error" class="contribution-error" role="alert" aria-live="polite"></div><div class="dialog-actions"><button type="button" class="secondary-button" data-close-dialog="contribution-dialog">Cancelar</button><button type="submit" class="primary-button">Publicar</button></div></form></dialog>`;
}
function renderProfileDialog() {
  if (!currentUser) return '';
  return `<dialog id="profile-dialog" class="profile-dialog"><form id="profile-form"><button type="button" class="close-button" data-close-dialog="profile-dialog" aria-label="Fechar">×</button><div class="eyebrow">MINHA CONTA</div><h2>Meu perfil</h2><p class="profile-email">${esc(currentUser.email)}</p><label for="profile-name">Nome</label><input id="profile-name" name="name" value="${esc(currentUser.name)}" maxlength="150" autocomplete="name" required/><label for="profile-avatar">Foto de perfil</label><input id="profile-avatar" name="avatarUrl" type="url" value="${esc(currentUser.avatarUrl ?? '')}" placeholder="https://..."/><label for="profile-bio">Sobre mim</label><textarea id="profile-bio" name="bio" rows="4">${esc(currentUser.bio ?? '')}</textarea><div id="profile-error" class="profile-error" role="alert"></div><div class="dialog-actions"><button type="button" class="secondary-button" data-close-dialog="profile-dialog">Cancelar</button><button type="submit" class="primary-button">Salvar perfil</button></div></form></dialog>`;
}
function bind() {
  document.querySelector<HTMLButtonElement>('#go-home')?.addEventListener('click', () => { selectedPage = null; render(); });
  document.querySelector<HTMLButtonElement>('#go-home-page')?.addEventListener('click', () => { selectedPage = null; render(); });
  document.querySelector<HTMLSelectElement>('#folder-select')?.addEventListener('change', event => { selectedFolder = (event.target as HTMLSelectElement).value; render(); });
  document.querySelector<HTMLInputElement>('#search')?.addEventListener('input', event => { query = (event.target as HTMLInputElement).value; const position = query.length; render(); const input = document.querySelector<HTMLInputElement>('#search')!; input.focus(); input.setSelectionRange(position, position); });
  document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(button => button.addEventListener('click', () => { void openPage(button.dataset.page!); }));
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
  document.querySelector<HTMLButtonElement>('#logout')?.addEventListener('click', logout);
  document.querySelector<HTMLButtonElement>('#dismiss-notice')?.addEventListener('click', () => { notice = ''; render(); });
}
function expireSession() {
  clearAuthSession();
  currentUser = null;
  pageComments = [];
  commentsLoading = false;
  loginRequired = true;
  authView = 'login';
  selectedPage = null;
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
    if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.innerHTML = 'Entrar <span>→</span>'; }
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
function logout() {
  clearAuthSession();
  currentUser = null;
  folders = [];
  pages = [];
  selectedPage = null;
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
  try {
    selectedPage = await getPage(id);
    notice = '';
    pageComments = [];
    commentsError = '';
    openCommentBlocks = new Set();
    editingCommentId = null;
    replyingToCommentId = null;
    commentsLoading = commentBlockIds(selectedPage.content).length > 0;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (commentsLoading) void loadPageComments(selectedPage.id);
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
document.addEventListener('keydown', event => { if (event.key === '/' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); document.querySelector<HTMLInputElement>('#search')?.focus(); } });
render();
if (!loginRequired) void loadWorkspace();
