import { describe, expect, test, vi } from 'vitest';
import { createImageUploader, type ImageApi } from '../../src/editor/images';
import { ApiRequestError } from '../../src/services/backend-api';

// contracts/pages-api.md, Images: request → direct PUT to R2 → confirm (US5, research R9).
const permission = {
  uploadKey: 'pending/p1/u1/abc', uploadUrl: 'https://r2.example/pending/p1/u1/abc?sig=1', method: 'PUT',
  headers: { 'Content-Type': 'image/png' }, expiresAt: '2026-10-01T15:00:00Z'
};
const record = {
  id: 'img-1', pageId: 'p1', fileName: 'quadro.png', contentType: 'image/png', size: 4, uploadedBy: 'u1',
  createdAt: '2026-10-01T14:50:00Z', url: '/api/images/img-1'
};

function fakes(over: Partial<ImageApi> = {}) {
  const put = vi.fn(async () => new Response(null, { status: 200 }));
  const api: ImageApi = {
    requestImageUpload: vi.fn(async () => permission),
    confirmImageUpload: vi.fn(async () => record),
    apiUrl: (path: string) => `https://api.example${path}`,
    ...over
  };
  return { api, put };
}

const png = (bytes = 4, name = 'quadro.png', type = 'image/png') => new File([new Uint8Array(bytes)], name, { type });

describe('createImageUploader', () => {
  test('requests permission, PUTs the bytes straight to storage with the given headers, then confirms', async () => {
    const { api, put } = fakes();
    const url = await createImageUploader('p1', api, put)(png());

    expect(api.requestImageUpload).toHaveBeenCalledWith('p1', { contentType: 'image/png', size: 4 });
    const [target, init] = put.mock.calls[0] as unknown as [string, RequestInit];
    expect(target).toBe(permission.uploadUrl);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'image/png' });
    expect(init.body).toBeInstanceOf(File);
    expect(api.confirmImageUpload).toHaveBeenCalledWith('p1', { uploadKey: permission.uploadKey, fileName: 'quadro.png' });
    expect(url).toBe('https://api.example/api/images/img-1');
  });

  test.each([
    ['an SVG', png(4, 'x.svg', 'image/svg+xml')],
    ['an empty file', png(0)],
    ['a file over 5 MB', png(5_242_881)]
  ])('refuses %s before any request, naming the allowed types and limit', async (_name, file) => {
    const { api, put } = fakes();
    await expect(createImageUploader('p1', api, put)(file)).rejects.toThrow('Envie uma imagem PNG, JPEG, WebP ou GIF de até 5 MB.');
    expect(api.requestImageUpload).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  test('accepts exactly 5 MB', async () => {
    const { api, put } = fakes();
    await expect(createImageUploader('p1', api, put)(png(5_242_880))).resolves.toContain('/api/images/');
  });

  test('a failed upload to storage is reported and nothing is confirmed', async () => {
    const { api } = fakes();
    const put = vi.fn(async () => new Response(null, { status: 403 }));
    await expect(createImageUploader('p1', api, put)(png())).rejects.toThrow('Não foi possível enviar a imagem. Tente novamente.');
    expect(api.confirmImageUpload).not.toHaveBeenCalled();
  });

  test('a network failure is reported', async () => {
    const { api } = fakes();
    const put = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(createImageUploader('p1', api, put)(png())).rejects.toThrow('Não foi possível enviar a imagem. Tente novamente.');
  });

  test('a stored file that does not match the declared one (409) asks to try again', async () => {
    const { api, put } = fakes({ confirmImageUpload: vi.fn(async () => { throw new ApiRequestError('x', 409); }) });
    await expect(createImageUploader('p1', api, put)(png())).rejects.toThrow('A imagem enviada não confere com o arquivo escolhido. Tente novamente.');
  });

  test('without permission to add images the reason is given', async () => {
    const { api, put } = fakes({ requestImageUpload: vi.fn(async () => { throw new ApiRequestError('x', 403); }) });
    await expect(createImageUploader('p1', api, put)(png())).rejects.toThrow('Você não tem permissão para adicionar imagens a esta página.');
  });
});
