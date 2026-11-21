// Optional files that stay out of a default installation (extras/, templates/, most of examples/) are read from this
// checkout when they are present, and otherwise downloaded from the same repository on GitHub, file by file.
// MOGRAFY_GITHUB_URL points the downloads somewhere else (a fork, a mirror, or a local server in tests).
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { installation } from '@mografy/server';
import { VERSION } from './commands/help.js';

const REPOSITORY = 'https://raw.githubusercontent.com/mografy/mografy';
export const GITHUB_RAW = (process.env.MOGRAFY_GITHUB_URL ?? `${REPOSITORY}/main`).replace(/\/$/, '') + '/';
/**
 * Where downloads come from, in order. The npm package first asks for its own release tag (v<version>), so its
 * templates, helpers and films match the code that uses them; a checkout, or a release without a tag, uses main.
 */
export function downloadBases(): string[] {
  if (process.env.MOGRAFY_GITHUB_URL || installation.kind !== 'package') return [GITHUB_RAW];
  return [`${REPOSITORY}/v${VERSION}/`, GITHUB_RAW];
}

export const exists = (file: string) => access(file).then(() => true, () => false);

/** Download one repository file (a path relative to the repository root, with forward slashes). */
export async function downloadRepoFile(path: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  let status = 0;
  for (const base of downloadBases()) {
    const response = await fetchImpl(base + encoded).catch(error => { throw new Error(`Could not download ${path}: ${(error as Error).message}. Check the connection.`); });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    status = response.status;
    if (status !== 404) break;
  }
  throw new Error(`Could not download ${path} (${status}).`);
}

/** A repository file from this checkout, or from GitHub when the checkout does not have it. */
export async function repoFile(workspaceRoot: string, path: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const local = join(workspaceRoot, ...path.split('/'));
  if (await exists(local)) return readFile(local);
  return downloadRepoFile(path, fetchImpl);
}
