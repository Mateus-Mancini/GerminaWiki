import './styles.css';
import './course.css';
import './login.css';
import './auth.css';
import './workspace.css';
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

let query = '';
let selectedFolder = 'all';
let selectedPage: RemotePage | null = null;
let pages: RemotePage[] = [];
let folders: FolderNode[] = [];
let notice = '';
let loading = true;
let loginRequired = !getAuthSession();
let authMessage = '';
let currentUser: OwnUserProfile | null = null;
let latestContribution: { parentPageId: string; page: RemotePage } | null = null;
let editorHandle: EditorHandle | null = null;

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
function render() {
  const items = visiblePages();
  const yearFolders = folders.map(folder => `<option value="${esc(folder.id)}" ${selectedFolder === folder.id ? 'selected' : ''}>${esc(folder.name)}</option>`).join('');
  document.querySelector('#root')!.innerHTML = loginRequired ? renderLogin() : `<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">G</span><span><strong>GerminaWiki</strong><small>Seu espaço de aprendizagem</small></span></div><div class="side-caption">WORKSPACE</div>${folders.length ? `<nav class="api-navigation" aria-label="Pastas e páginas">${folderTree(folders)}</nav>` : '<p class="empty-inline">O backend não retornou pastas.</p>'}<div class="sidebar-footer">Conteúdo do workspace</div></aside><main class="main"><header class="topbar"><div class="breadcrumbs"><button id="go-home" class="breadcrumb-button">← Início</button>${selectedPage ? `<span> / </span><strong>${esc(selectedPage.title)}</strong>` : ''}</div><div class="top-actions"><label class="search"><span>⌕</span><input id="search" placeholder="Buscar no workspace..." value="${esc(query)}" aria-label="Buscar no workspace"/><kbd>/</kbd></label><div class="account-actions"><button id="open-profile" class="account-profile" type="button" aria-label="Editar perfil"><span class="account-avatar">${avatarMarkup()}</span><span>${esc(currentUser?.name ?? 'Minha conta')}</span></button><button id="logout" class="logout-button" type="button">Sair</button></div></div></header>${selectedPage ? renderPage(selectedPage) : renderCatalog(items, yearFolders)}</main></div>${renderContributionDialog()}${renderProfileDialog()}${notice ? `<div class="toast" role="status" aria-live="polite"><span>${esc(notice)}</span><button id="dismiss-notice" type="button" aria-label="Fechar aviso">×</button></div>` : ''}`;
  bind();
}
function renderLogin() {
  return `<main class="login-screen"><div class="login-brand"><span class="brand-mark">G</span><span><strong>GerminaWiki</strong><small>Conhecimento compartilhado</small></span></div><section class="login-card"><div class="login-symbol">G</div><div class="eyebrow">ACESSO DO ALUNO</div><h1>Bem-vindo de volta</h1><p>Entre com sua conta escolar para acessar os conteúdos e contribuir com a comunidade.</p><form id="login-form"><label for="login-email">E-mail escolar</label><input id="login-email" name="email" type="email" autocomplete="username" placeholder="nome@escola.com.br" required/><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Digite sua senha" required/><div id="login-error" class="login-error" role="alert">${esc(authMessage)}</div><button class="primary-button login-submit" type="submit">Entrar <span>→</span></button></form><small class="login-footnote">Sua senha não fica salva neste navegador.</small></section><footer class="login-footer">Instituto Germinare · Ambiente de aprendizagem</footer></main>`;
}
function renderCatalog(items: RemotePage[], folderOptions: string) {
  if (loading) return '<section class="content"><p class="empty">Carregando conteúdo do backend…</p></section>';
  return `<section class="content"><div class="welcome"><div><div class="eyebrow">BIBLIOTECA DE CONTEÚDOS</div><h1>Conhecimento<br/><em>do workspace.</em></h1><p>Matérias, páginas e materiais carregados do backend.</p></div><div class="welcome-art"><span>G</span><i>✳</i></div></div><div class="section-heading"><div><div class="eyebrow">PÁGINAS DO BACKEND</div><h2>Conteúdos <span>${items.length}</span></h2></div><select id="folder-select"><option value="all" ${selectedFolder === 'all' ? 'selected' : ''}>Todas as pastas</option>${folderOptions}</select></div><div class="subject-grid">${items.map((page, index) => `<button class="subject-card" data-page="${esc(page.id)}"><span class="subject-icon">${['✧','◉','⌘','∿','✳','◎'][index % 6]}</span><span class="subject-area">${esc(rootFolder(page.folderId)?.name ?? 'Sem pasta')}</span><strong>${esc(page.title)}</strong><span class="open-label">Abrir conteúdo →</span></button>`).join('') || '<div class="empty">Nenhuma página foi retornada pelo backend.</div>'}</div></section>`;
}
function markdown(content: string) {
  return content.split(/\r?\n/).map(line => {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) return `<h${heading[1].length}>${esc(heading[2])}</h${heading[1].length}>`;
    if (/^[-*]\s+/.test(line)) return `<li>${esc(line.replace(/^[-*]\s+/, ''))}</li>`;
    if (!line.trim()) return '';
    return `<p>${esc(line)}</p>`;
  }).join('\n').replace(/(?:<li>.*?<\/li>\n?)+/gs, list => `<ul>${list}</ul>`);
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
  const folder = folderForPage(page);
  const published = latestContribution?.parentPageId === page.id
    ? `<article class="published-contribution" role="status"><div class="topic-kicker">CONTEÚDO PUBLICADO</div><h3>${esc(latestContribution.page.title)}</h3><button class="published-link" data-page="${esc(latestContribution.page.id)}" type="button">Abrir página publicada →</button></article>`
    : '';
  return `<article class="course-page"><div class="course-heading"><div class="eyebrow">${esc(rootFolder(folder?.id ?? null)?.name ?? folder?.name ?? 'WORKSPACE')} · PÁGINA DO BACKEND</div><h1>${esc(page.title)}</h1><p class="course-summary">Conteúdo carregado diretamente do workspace.</p><div class="page-actions"><button id="go-home-page" class="breadcrumb-button">← Voltar aos conteúdos</button><button id="edit-page" class="secondary-button" type="button">Editar página</button></div></div><div class="course-layout"><nav class="topic-nav"><div class="panel-title">NESTA PÁGINA</div>${headings.map((heading, index) => `<a href="#topic-${index}">${String(index + 1).padStart(2, '0')} · ${esc(heading[1])}</a>`).join('') || '<span class="empty-inline">Sem subtópicos cadastrados.</span>'}<a href="#contribute">＋ Contribuir com conteúdo</a></nav><div class="course-content">${sections}<section id="contribute" class="contributions-list"><div class="topic-kicker">CONTRIBUIÇÃO</div><h2>Adicionar conteúdo</h2><p>Sua contribuição será publicada como uma nova página na pasta desta matéria.</p>${published}${page.folderId ? '<button id="open-contribution" class="secondary-button">＋ Contribuir com esta matéria</button>' : '<p class="empty-inline">Esta página não está associada a uma pasta, então não é possível determinar onde salvar uma contribuição.</p>'}</section></div></div></article>`;
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
    if (submitButton?.isConnected) { submitButton.disabled = false; submitButton.innerHTML = 'Entrar <span>→</span>'; }
  }
}
async function logout() {
  if (!(await leaveEditor())) return;
  clearAuthSession();
  currentUser = null;
  folders = [];
  pages = [];
  selectedPage = null;
  latestContribution = null;
  loginRequired = true;
  authMessage = '';
  notice = '';
  render();
}
async function openPage(id: string) {
  if (!(await leaveEditor())) return;
  try { selectedPage = await getPage(id); notice = ''; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
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
document.addEventListener('keydown', event => { if (event.key === '/' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); document.querySelector<HTMLInputElement>('#search')?.focus(); } });
render();
if (!loginRequired) void loadWorkspace();
