export type User = { id: string; displayName: string; email: string; role: string };
export type ApiError = { error: { code: string; message: string; details?: unknown } };
