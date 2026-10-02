import { ApiRequestError, type PageImage, type UploadPermission } from '../services/backend-api';

/** The backend's limits (ms-germina-wiki spec 005): checked here first so bad files never upload. */
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 5_242_880;

export type ImageApi = {
  requestImageUpload(pageId: string, file: { contentType: string; size: number }): Promise<UploadPermission>;
  confirmImageUpload(pageId: string, upload: { uploadKey: string; fileName: string }): Promise<PageImage>;
  apiUrl(path: string): string;
};

const FAILED = 'Não foi possível enviar a imagem. Tente novamente.';

/**
 * BlockNote's `uploadFile`: permission from the API, the bytes straight to storage (never through the
 * API), then confirmation (research R9). Returns the absolute, public image address stored in the page;
 * it redirects to a short-lived signed URL, so every reader's <img> works.
 */
export function createImageUploader(pageId: string, api: ImageApi, put: typeof fetch = fetch) {
  return async (file: File): Promise<string> => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size < 1 || file.size > MAX_IMAGE_BYTES) {
      throw new Error('Envie uma imagem PNG, JPEG, WebP ou GIF de até 5 MB.');
    }
    try {
      const permission = await api.requestImageUpload(pageId, { contentType: file.type, size: file.size });
      const stored = await put(permission.uploadUrl, { method: 'PUT', headers: permission.headers, body: file });
      if (!stored.ok) throw new Error(FAILED);
      const image = await api.confirmImageUpload(pageId, { uploadKey: permission.uploadKey, fileName: file.name || 'imagem' });
      return api.apiUrl(image.url);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        throw new Error('A imagem enviada não confere com o arquivo escolhido. Tente novamente.');
      }
      if (error instanceof ApiRequestError && error.status === 403) {
        throw new Error('Você não tem permissão para adicionar imagens a esta página.');
      }
      throw new Error(FAILED);
    }
  };
}
