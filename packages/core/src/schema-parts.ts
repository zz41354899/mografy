// Small schemas the project and scene contracts share.
import { z } from 'zod';

/** Project-relative path: no absolute paths, drive letters, backslashes or `..` segments. */
export const localPath = z.string().min(1).refine(
  p => !p.startsWith('/') && !p.includes('\\') && !p.split('/').includes('..') && !p.includes(':'),
  'Use a project-relative path',
);
export const color = z.string().regex(/^#[\da-f]{6}$/i);
export const scalar = z.union([z.number().finite(), z.string(), z.boolean()]);
