/** One JSON/error contract for player requests; uploads use the same response reader. */
export async function readApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message ?? `HTTP ${response.status}`);
  return data as T;
}

export const projectHeaders = (dir: string | undefined): Record<string, string> => dir ? { 'x-mografy-project': encodeURIComponent(dir) } : {};

export async function callApi<T>(path: string, method = 'GET', payload?: unknown, projectDir?: string): Promise<T> {
  const response = await fetch(`/__mografy/${path}`, {
    method, headers: { ...projectHeaders(projectDir), ...(payload === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  return readApiResponse<T>(response);
}
