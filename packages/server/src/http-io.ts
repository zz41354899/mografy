import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ApiError, describe } from './errors.js';

export const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.svga': 'application/octet-stream' };

export function allowed(request: IncomingMessage) {
  const host = request.headers.host ?? '';
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) return false;
  const origin = request.headers.origin;
  return (!origin || origin === `http://${host}`) && request.headers['sec-fetch-site'] !== 'cross-site';
}
export function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(value));
}
export async function body<T>(request: IncomingMessage, schema: { parse(input: unknown): T }, code = 'INVALID', limit = 2 * 1024 * 1024): Promise<T> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'CONTENT_TYPE', 'Use application/json');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += (chunk as Buffer).length; if (size > limit) throw new ApiError(413, 'TOO_LARGE', 'Request too large'); chunks.push(chunk as Buffer); }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON'); }
  try { return schema.parse(value); } catch (error) { throw new ApiError(400, code, describe(error)); }
}
export async function rawBody(request: IncomingMessage, limit: number) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += (chunk as Buffer).length; if (size > limit) throw new ApiError(413, 'TOO_LARGE', `File is larger than ${Math.round(limit / 1048576)} MB`); chunks.push(chunk as Buffer); }
  return Buffer.concat(chunks);
}
/** Serve a file with HTTP Range support, so audio and video elements can seek. */
export async function sendFile(request: IncomingMessage, response: ServerResponse, file: string) {
  const { size } = await stat(file);
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(request.headers.range ?? ''));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(size - 1, end);
    if (start > end) { response.writeHead(416, { 'content-range': `bytes */${size}` }); response.end(); return; }
    response.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' });
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(file, { start, end }).pipe(response); return;
  }
  response.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' });
  if (request.method === 'HEAD') { response.end(); return; }
  createReadStream(file).pipe(response);
}
export const num = (value: unknown, name: string) => { const n = Number(value); if (!Number.isFinite(n)) throw new ApiError(400, 'INVALID', `${name} must be a number`); return n; };

