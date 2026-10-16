export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: Record<string, unknown>) { super(message); }
}
type Issue = { path: PropertyKey[]; message: string };
export const describe = (error: unknown) => error instanceof Error && error.name === 'ZodError' && Array.isArray((error as { issues?: unknown }).issues)
  ? ((error as unknown as { issues: Issue[] }).issues).map(i => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`).join('\n')
  : error instanceof Error ? error.message : String(error);
