import './styles.css';
import './course.css';
import { createContributionPage, getPage, listFolders, listPages, type FolderNode, type RemotePage } from './services/backend-api.js';

let query = '';
let selectedFolder = 'all';
let selectedPage: RemotePage | null = null;
let pages: RemotePage[] = [];
let folders: FolderNode[] = [];
let notice = '';
let loading = true;

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
  return nodes.map(folder => `<div class="api-folder" style="--depth:${depth}"><span>${esc(folder.name)}</span>${pages.filter(page => page.folderId === folder.id).map(page => `<button class="api-page-link" data-page="${esc(page.id)}">${esc(page.title)}</button>`).join('')}${folderTree(folder.children ?? [], depth + 1)}</div>`).join('');
}
function render() {
  const items = visiblePages();
  const yearFolders = folders.map(folder => `<option value="${esc(folder.id)}" ${selectedFolder === folder.id ? 'selected' : ''}>${esc(folder.name)}</option>`).join('');
  document.querySelector('#root')!.innerHTML = `<div class="app-shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">G</span><span><strong>GerminaWiki</strong><small>Seu espaço de aprendizagem</small></span></div><div class="side-caption">WORKSPACE</div>${folders.length ? `<nav class="api-navigation">${folderTree(folders)}</nav>` : '<p class="empty-inline">O backend não retornou pastas.</p>'}<div class="sidebar-footer">Conteúdo do workspace</div></aside><main class="main"><header class="topbar"><div class="breadcrumbs"><button id="go-home" class="breadcrumb-button">Início</button>${selectedPage ? `<span> / </span><strong>${esc(selectedPage.title)}</strong>` : ''}</div><div class="top-actions"><label class="search"><span>⌕</span><input id="search" placeholder="Buscar no workspace..." value="${esc(query)}" aria-label="Buscar no workspace"/><kbd>/</kbd></label></div></header>${selectedPage ? renderPage(selectedPage) : renderCatalog(items, yearFolders)}</main></div>${renderContributionDialog()}${notice ? `<div class="toast" role="status">${esc(notice)}</div>` : ''}`;
  bind();
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
  return `<article class="course-page"><div class="course-heading"><div class="eyebrow">${esc(rootFolder(folder?.id ?? null)?.name ?? folder?.name ?? 'WORKSPACE')} · PÁGINA DO BACKEND</div><h1>${esc(page.title)}</h1><p class="course-summary">Conteúdo carregado diretamente do workspace.</p><button id="go-home-page" class="breadcrumb-button">← Voltar aos conteúdos</button></div><div class="course-layout"><nav class="topic-nav"><div class="panel-title">NESTA PÁGINA</div>${headings.map((heading, index) => `<a href="#topic-${index}">${String(index + 1).padStart(2, '0')} · ${esc(heading[1])}</a>`).join('') || '<span class="empty-inline">Sem subtópicos cadastrados.</span>'}<a href="#contribute">＋ Contribuir com conteúdo</a></nav><div class="course-content">${sections}<section id="contribute" class="contributions-list"><div class="topic-kicker">CONTRIBUIÇÃO</div><h2>Adicionar conteúdo</h2><p>Sua contribuição será enviada ao backend como uma nova página nesta pasta.</p>${page.folderId ? '<button id="open-contribution" class="secondary-button">＋ Contribuir com esta matéria</button>' : '<p class="empty-inline">Esta página não está associada a uma pasta, então não é possível determinar onde salvar uma contribuição.</p>'}</section></div></div></article>`;
}
function renderContributionDialog() {
  return `<dialog id="contribution-dialog" class="contribution-dialog"><form id="contribution-form"><button type="button" class="close-button" data-close-dialog="contribution-dialog">×</button><h2>Contribuir com conteúdo</h2><label>Título<input name="title" maxlength="255" required></label><label>Conteúdo<textarea name="body" rows="7" required></textarea></label><small>A contribuição será salva no backend, dentro da pasta desta matéria.</small><div class="dialog-actions"><button type="button" class="secondary-button" data-close-dialog="contribution-dialog">Cancelar</button><button type="submit" class="primary-button">Publicar</button></div></form></dialog>`;
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
}
async function openPage(id: string) {
  try { selectedPage = await getPage(id); notice = ''; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  catch (error) { notice = error instanceof Error ? error.message : 'Não foi possível abrir a página.'; render(); }
}
async function contribute(event: SubmitEvent) {
  event.preventDefault();
  if (!selectedPage?.folderId) return;
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const title = String(data.get('title') ?? '').trim();
  const body = String(data.get('body') ?? '').trim();
  if (!title || !body) return;
  try {
    const created = await createContributionPage(selectedPage.folderId, title, `# ${title}\n\n${body}`);
    pages = [created, ...pages];
    document.querySelector<HTMLDialogElement>('#contribution-dialog')?.close();
    selectedPage = created;
    notice = 'Contribuição publicada no backend.';
    render();
  } catch (error) { notice = error instanceof Error ? error.message : 'Não foi possível publicar a contribuição.'; render(); }
}
async function loadWorkspace() {
  try { [folders, pages] = await Promise.all([listFolders(), listPages()]); }
  catch (error) { notice = error instanceof Error ? `Não foi possível carregar o workspace: ${error.message}` : 'Não foi possível carregar o workspace.'; }
  finally { loading = false; render(); }
}
document.addEventListener('keydown', event => { if (event.key === '/' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); document.querySelector<HTMLInputElement>('#search')?.focus(); } });
render();
void loadWorkspace();
