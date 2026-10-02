export type RemotePage = {
  id: string;
  title: string;
  slug: string;
  content: string;
  version: number;
  folderId: string | null;
  createdAt?: string;
  updatedAt?: string;
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

export type RegisterAccount = {
  name: string;
  email: string;
  password: string;
};

export type AdminReply = {
  id: string;
  commentId: string;
  adminId: string;
  text: string;
  createdAt: string;
};

export type RemoteComment = {
  id: string;
  pageId: string;
  userId: string;
  anchor: { blockId: string };
  text: string;
  status: 'OPEN';
  createdAt: string;
  updatedAt: string;
  adminReplies: AdminReply[];
};

export type CommentPage = {
  items: RemoteComment[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const SESSION_KEY = 'germinawiki.auth-session';
const baseUrl = 'https://ih744ae7njca2on6vmsuutp7p40yosgh.lambda-url.sa-east-1.on.aws';

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

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');

  if (authenticated) {
    const session = getAuthSession();
    if (!session) throw new ApiRequestError('Sua sessão expirou. Entre novamente.', 401);
    headers.set('authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      typeof payload?.detail === 'string' ? payload.detail :
      typeof payload?.message === 'string' ? payload.message :
      typeof payload?.error === 'string' ? payload.error :
      typeof payload?.error?.message === 'string' ? payload.error.message :
      `Falha na API (${response.status}).`;
    throw new ApiRequestError(message, response.status);
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

export function registerAccount(account: RegisterAccount) {
  return request<OwnUserProfile>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(account)
  }, false);
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

export function listComments(pageId: string, page = 0, size = 100) {
  const params = new URLSearchParams({ pageId, page: String(page), size: String(size) });
  return request<CommentPage>(`/api/comments?${params.toString()}`);
}

export function createComment(pageId: string, blockId: string, text: string) {
  return request<RemoteComment>('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ pageId, anchor: { blockId }, text })
  });
}

export function updateComment(commentId: string, text: string) {
  return request<RemoteComment>(`/api/comments/${encodeURIComponent(commentId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ text })
  });
}

export function deleteComment(commentId: string) {
  return request<void>(`/api/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
}

export function createAdminReply(commentId: string, text: string) {
  return request<AdminReply>(`/api/comments/${encodeURIComponent(commentId)}/admin-replies`, {
    method: 'POST',
    body: JSON.stringify({ text })
  });
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
