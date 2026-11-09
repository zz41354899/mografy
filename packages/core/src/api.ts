// The HTTP contract between the player's Server and its clients (the CLI and the browser).
export const API_PREFIX = '/__mografy';
/** Names the project a request is meant for; the Server answers 409 when another project is open. */
export const PROJECT_HEADER = 'x-mografy-project';
export const apiPath = (path: string) => `${API_PREFIX}/${path}`;
export const projectHeaders = (dir: string | undefined): Record<string, string> => dir ? { [PROJECT_HEADER]: encodeURIComponent(dir) } : {};

/** One JSON and error contract for every client. */
export async function readApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`);
  return data;
}

/** Send a request; the caller reads the response, which lets it treat a status such as 409 specially. */
export function sendApi(origin: string, path: string, method: string = 'GET', payload?: unknown, projectDir?: string): Promise<Response> {
  return fetch(origin ? new URL(apiPath(path), origin) : apiPath(path), {
    method, headers: { ...projectHeaders(projectDir), ...(payload === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}
export async function callApi<T>(origin: string, path: string, method?: string, payload?: unknown, projectDir?: string): Promise<T> {
  return readApiResponse<T>(await sendApi(origin, path, method, payload, projectDir));
}
