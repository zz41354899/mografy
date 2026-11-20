// Optional files that stay out of a default installation (extras/, templates/, most of examples/) are read from this
// checkout when they are present, and otherwise downloaded from the same repository on GitHub, file by file.
// MOGRAFY_GITHUB_URL points the downloads somewhere else (a fork, a mirror, or a local server in tests).
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const GITHUB_RAW = (process.env.MOGRAFY_GITHUB_URL ?? 'https://raw.githubusercontent.com/zz41354899/mografy/main').replace(/\/$/, '') + '/';

export const exists = (file: string) => access(file).then(() => true, () => false);

/** Download one repository file (a path relative to the repository root, with forward slashes). */
export async function downloadRepoFile(path: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const url = GITHUB_RAW + path.split('/').map(encodeURIComponent).join('/');
  const response = await fetchImpl(url).catch(error => { throw new Error(`Could not download ${path}: ${(error as Error).message}. Check the connection.`); });
  if (!response.ok) throw new Error(`Could not download ${path} (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

/** A repository file from this checkout, or from GitHub when the checkout does not have it. */
export async function repoFile(workspaceRoot: string, path: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const local = join(workspaceRoot, ...path.split('/'));
  if (await exists(local)) return readFile(local);
  return downloadRepoFile(path, fetchImpl);
}
