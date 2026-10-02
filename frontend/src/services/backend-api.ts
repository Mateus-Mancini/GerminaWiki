export type RemotePage = {
  id: string;
  title: string;
  slug: string;
  content: string;
  version: number;
  folderId: string | null;
  createdBy?: string;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

/** A page with the version it was read at (`ETag`), which every save must send back as `If-Match`. */
export type EditablePage = {
  page: RemotePage;
  etag: string;
};

export type PublicUserProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
};

export type FolderNode = {
  id: string;
  name: string;
  parentFolderId: string | null;
  children: FolderNode[];
};

export type AuthSession = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
};

export type OwnUserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
};

export type UpdateOwnUserProfile = {
  name?: string;
  avatarUrl?: string | null;
  bio?: string | null;
};

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** The page changed since the version being saved (HTTP 412 from the pages API; 409 in the constitution). */
export class VersionConflictError extends ApiRequestError {
  constructor(message: string, status: number, readonly currentVersion: number | null) {
    super(message, status);
    this.name = 'VersionConflictError';
  }
}

const SESSION_KEY = 'germinawiki.auth-session';
const env = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string; DEV?: boolean } }).env;
const baseUrl = env?.VITE_API_BASE_URL?.replace(/\/$/, '') || (env?.DEV ? 'http://localhost:8080' : '');

export function getAuthSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof session.accessToken !== 'string' ||
      session.tokenType !== 'Bearer' ||
      typeof session.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(session.expiresAt)) ||
      Date.parse(session.expiresAt) <= Date.now()
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session as AuthSession;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // The in-memory UI still logs out if browser storage is unavailable.
  }
}

async function send(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  if (!baseUrl) {
    throw new Error('URL do backend não configurada. Defina VITE_API_BASE_URL no ambiente de build.');
  }

  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');

  if (authenticated) {
    const session = getAuthSession();
    if (!session) throw new ApiRequestError('Sua sessão expirou. Entre novamente.', 401);
    headers.set('authorization', `Bearer ${session.accessToken}`);
  }

  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function errorPayload(response: Response) {
  const payload = await response.json().catch(() => null);
  const message =
    typeof payload?.detail === 'string' ? payload.detail :
    typeof payload?.message === 'string' ? payload.message :
    typeof payload?.error === 'string' ? payload.error :
    typeof payload?.error?.message === 'string' ? payload.error.message :
    `Falha na API (${response.status}).`;
  return { payload, message };
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const response = await send(path, init, authenticated);
  if (!response.ok) {
    throw new ApiRequestError((await errorPayload(response)).message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const session = await request<AuthSession>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false
  );
  const expiresAt = Date.parse(session.expiresAt);
  if (
    !session.accessToken?.trim() ||
    session.tokenType !== 'Bearer' ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    throw new Error('O serviço de autenticação retornou uma sessão inválida.');
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new Error('Não foi possível manter a sessão neste navegador. Habilite o armazenamento da sessão e tente novamente.');
  }
  return session;
}

export function listFolders() {
  return request<FolderNode[]>('/api/folders/tree');
}

export function listPages() {
  return request<RemotePage[]>('/api/pages');
}

export function getPage(id: string) {
  return request<RemotePage>(`/api/pages/${encodeURIComponent(id)}`);
}

export function getOwnUserProfile() {
  return request<OwnUserProfile>('/api/users/me');
}

export function updateOwnUserProfile(profile: UpdateOwnUserProfile) {
  return request<OwnUserProfile>('/api/users/me', { method: 'PATCH', body: JSON.stringify(profile) });
}

export async function findSubjectPage(subject: string): Promise<RemotePage | null> {
  const pages = await request<RemotePage[]>(`/api/search?q=${encodeURIComponent(subject)}`);
  const key = subject.trim().toLocaleLowerCase('pt-BR');
  const match = pages.find(page => page.title.trim().toLocaleLowerCase('pt-BR') === key);
  return match ? request<RemotePage>(`/api/pages/${encodeURIComponent(match.id)}`) : null;
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 300);
}

export function createContributionPage(folderId: string, title: string, content: string) {
  return request<RemotePage>('/api/pages', {
    method: 'POST',
    body: JSON.stringify({ title, slug: slugify(`${title}-${crypto.randomUUID()}`), content, folderId })
  });
}

async function editablePage(response: Response): Promise<EditablePage> {
  const etag = response.headers.get('etag');
  if (!etag) throw new Error('O servidor não informou a versão da página; a edição foi bloqueada para evitar sobrescritas.');
  return { page: await response.json() as RemotePage, etag };
}

/** Loads a page for editing (editor-ui, specs/002-page-editor/contracts/pages-api.md). */
export async function getPageForEdit(id: string): Promise<EditablePage> {
  const response = await send(`/api/pages/${encodeURIComponent(id)}`);
  if (!response.ok) throw new ApiRequestError((await errorPayload(response)).message, response.status);
  return editablePage(response);
}

/** Saves only if the page is still at `etag`; otherwise throws VersionConflictError. */
export async function savePage(id: string, changes: { title?: string; content: string }, etag: string): Promise<EditablePage> {
  const response = await send(`/api/pages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'if-match': etag },
    body: JSON.stringify(changes)
  });
  if (response.ok) return editablePage(response);
  const { payload, message } = await errorPayload(response);
  if (response.status === 409 || response.status === 412) {
    const current = Number(payload?.currentVersion);
    throw new VersionConflictError(
      'Esta página foi alterada por outra pessoa enquanto você editava.',
      response.status,
      Number.isInteger(current) ? current : null
    );
  }
  throw new ApiRequestError(message, response.status);
}

export function getPublicProfile(userId: string) {
  return request<PublicUserProfile>(`/api/users/${encodeURIComponent(userId)}`);
}

export function searchPages(query: string) {
  return request<RemotePage[]>(`/api/search?q=${encodeURIComponent(query)}`);
}

type CommentPage = { items: { anchor: { blockId: string } | null }[]; totalPages: number };

/** How many comments each block anchor of a page has (all pages of comments, 100 at a time). */
export async function listPageCommentAnchors(pageId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (let page = 0, totalPages = 1; page < totalPages; page++) {
    const result = await request<CommentPage>(
      `/api/comments?pageId=${encodeURIComponent(pageId)}&page=${page}&size=100`
    );
    for (const comment of result.items) {
      const blockId = comment.anchor?.blockId;
      if (blockId) counts.set(blockId, (counts.get(blockId) ?? 0) + 1);
    }
    totalPages = result.totalPages;
  }
  return counts;
}
