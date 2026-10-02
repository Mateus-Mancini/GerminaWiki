import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// contracts/pages-api.md: statuses verified against production on 2026-10-01.
const PAGE = '5f0c1a7e-0000-4000-8000-000000000001';
const ETAG = `"${PAGE}-v3"`;
const page = (version: number) => ({
  id: PAGE, title: 'Física', slug: 'fisica', content: 'Texto', version, folderId: null,
  createdBy: 'u1', updatedBy: 'u2', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T11:00:00Z'
});

type Call = { url: string; init: RequestInit };
// The base URL comes from the build environment (the shell's concern); the contract is the path.
const path = (url: string) => { const u = new URL(url); return u.pathname + u.search; };
let calls: Call[];

function respond(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status, headers: { 'content-type': 'application/json', ...headers }
    });
  });
}

async function client() {
  vi.resetModules();
  sessionStorage.setItem('germinawiki.auth-session', JSON.stringify({
    accessToken: 'token', tokenType: 'Bearer', expiresAt: new Date(Date.now() + 600_000).toISOString()
  }));
  return import('../../src/services/backend-api');
}

beforeEach(() => { calls = []; });
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('getPageForEdit', () => {
  test('returns the page with the ETag header as its expected version', async () => {
    vi.stubGlobal('fetch', respond(200, page(3), { etag: ETAG }));
    const api = await client();
    await expect(api.getPageForEdit(PAGE)).resolves.toEqual({ page: page(3), etag: ETAG });
    expect(path(calls[0].url)).toBe(`/api/pages/${PAGE}`);
    expect(new Headers(calls[0].init.headers).get('authorization')).toBe('Bearer token');
  });

  test('a response without an ETag is an error, never an edit without version checks', async () => {
    vi.stubGlobal('fetch', respond(200, page(3)));
    const api = await client();
    await expect(api.getPageForEdit(PAGE)).rejects.toThrow();
  });

  test('404 is reported with its status', async () => {
    vi.stubGlobal('fetch', respond(404, { error: 'Page not found' }));
    const api = await client();
    await expect(api.getPageForEdit(PAGE)).rejects.toMatchObject({ status: 404 });
  });
});

describe('savePage', () => {
  test('sends If-Match and returns the new ETag', async () => {
    const next = `"${PAGE}-v4"`;
    vi.stubGlobal('fetch', respond(200, page(4), { etag: next }));
    const api = await client();
    await expect(api.savePage(PAGE, { title: 'Física', content: 'Novo' }, ETAG))
      .resolves.toEqual({ page: page(4), etag: next });
    const { init } = calls[0];
    expect(init.method).toBe('PATCH');
    expect(new Headers(init.headers).get('if-match')).toBe(ETAG);
    expect(JSON.parse(String(init.body))).toEqual({ title: 'Física', content: 'Novo' });
  });

  test.each([412, 409])('%i is a version conflict carrying the current version', async status => {
    vi.stubGlobal('fetch', respond(status, { error: 'The page was modified by another request', currentVersion: '5' }));
    const api = await client();
    const error = await api.savePage(PAGE, { content: 'x' }, ETAG).catch(e => e);
    expect(error).toBeInstanceOf(api.VersionConflictError);
    expect(error).toMatchObject({ status, currentVersion: 5 });
  });

  test.each([400, 401, 403, 404, 428, 500])('%i is an ApiRequestError with that status', async status => {
    vi.stubGlobal('fetch', respond(status, { error: 'x' }));
    const api = await client();
    const error = await api.savePage(PAGE, { content: 'x' }, ETAG).catch(e => e);
    expect(error).toBeInstanceOf(api.ApiRequestError);
    expect(error).not.toBeInstanceOf(api.VersionConflictError);
    expect(error.status).toBe(status);
  });

  test('an expired session fails with 401 before any request', async () => {
    vi.stubGlobal('fetch', respond(200, page(4), { etag: ETAG }));
    const api = await client();
    sessionStorage.clear();
    await expect(api.savePage(PAGE, { content: 'x' }, ETAG)).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(0);
  });
});

describe('editor lookups', () => {
  test('listPageCommentAnchors follows every page of comments', async () => {
    const pages = [
      { items: [{ anchor: { blockId: 'a' } }, { anchor: { blockId: 'b' } }], page: 0, size: 100, totalItems: 3, totalPages: 2 },
      { items: [{ anchor: { blockId: 'a' } }], page: 1, size: 100, totalItems: 3, totalPages: 2 }
    ];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push({ url, init: {} });
      return new Response(JSON.stringify(pages[calls.length - 1]), { status: 200 });
    }));
    const api = await client();
    await expect(api.listPageCommentAnchors(PAGE)).resolves.toEqual(new Map([['a', 2], ['b', 1]]));
    expect(calls.map(c => new URL(c.url).searchParams.get('page'))).toEqual(['0', '1']);
    expect(new URL(calls[0].url).searchParams.get('size')).toBe('100');
  });

  test('searchPages encodes the query', async () => {
    vi.stubGlobal('fetch', respond(200, [page(1)]));
    const api = await client();
    await expect(api.searchPages('física & química')).resolves.toEqual([page(1)]);
    expect(path(calls[0].url)).toBe('/api/search?q=f%C3%ADsica%20%26%20qu%C3%ADmica');
  });

  test('getPublicProfile reads a member by id', async () => {
    vi.stubGlobal('fetch', respond(200, { id: 'u2', name: 'Ana', avatarUrl: null, bio: null }));
    const api = await client();
    await expect(api.getPublicProfile('u2')).resolves.toMatchObject({ name: 'Ana' });
    expect(path(calls[0].url)).toBe('/api/users/u2');
  });
});
