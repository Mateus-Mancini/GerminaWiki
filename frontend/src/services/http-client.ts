export async function http<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...init.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: { message: 'Falha de comunicação.' } }));
    const error = new Error(payload.error?.message ?? 'Falha de comunicação.');
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}
