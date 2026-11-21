// The MCP stdio transport: newline-delimited JSON-RPC 2.0 on stdin/stdout.
// Hand-written (no SDK) so the slim install stays small; MCP over stdio needs only these messages.
import { createInterface } from 'node:readline';

export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

export type Content =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };
export interface ToolResult { content: Content[]; structuredContent?: Record<string, unknown>; isError?: boolean }

export interface CallContext {
  signal: AbortSignal;
  /** Reports progress when the client asked for it (a `progressToken` in `_meta`); otherwise does nothing. */
  progress(progress: number, total?: number, message?: string): void;
}

export interface Handlers {
  initialize(params: { protocolVersion?: string }): unknown;
  listTools(): unknown;
  callTool(name: string, args: Record<string, unknown>, context: CallContext): Promise<ToolResult>;
  close(): Promise<void>;
}

type Id = string | number;
interface Message { jsonrpc?: string; id?: Id | null; method?: string; params?: Record<string, unknown> }

/** Serve MCP on this process's stdin/stdout until stdin closes. Logs must go to stderr. */
export function serveStdio(handlers: Handlers, out: (line: string) => void) {
  const send = (message: unknown) => out(JSON.stringify(message) + '\n');
  const reply = (id: Id, result: unknown) => send({ jsonrpc: '2.0', id, result });
  const fail = (id: Id | null, code: number, message: string) => send({ jsonrpc: '2.0', id, error: { code, message } });
  const running = new Map<Id, AbortController>();

  const handle = async (message: Message) => {
    const { id, method, params = {} } = message;
    const isRequest = id !== undefined && id !== null;
    if (!method) { if (isRequest) fail(id, -32600, 'Invalid request'); return; }
    if (!isRequest) {
      // Notifications: initialized, cancelled; others are ignored, as the protocol requires.
      if (method === 'notifications/cancelled') running.get(params.requestId as Id)?.abort();
      return;
    }
    try {
      switch (method) {
        case 'initialize': return reply(id, handlers.initialize(params as { protocolVersion?: string }));
        case 'ping': return reply(id, {});
        case 'tools/list': return reply(id, handlers.listTools());
        case 'resources/list': return reply(id, { resources: [] });
        case 'prompts/list': return reply(id, { prompts: [] });
        case 'tools/call': {
          const name = typeof params.name === 'string' ? params.name : '';
          const args = params.arguments && typeof params.arguments === 'object' ? params.arguments as Record<string, unknown> : {};
          const token = (params._meta as { progressToken?: Id } | undefined)?.progressToken;
          const controller = new AbortController();
          running.set(id, controller);
          try {
            const result = await handlers.callTool(name, args, {
              signal: controller.signal,
              progress: (progress, total, text) => {
                if (token !== undefined) send({ jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: token, progress, ...(total ? { total } : {}), ...(text ? { message: text } : {}) } });
              },
            });
            if (!controller.signal.aborted) reply(id, result);
          } finally { running.delete(id); }
          return;
        }
        default: return fail(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      fail(id, -32603, error instanceof Error ? error.message : String(error));
    }
  };

  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  lines.on('line', line => {
    if (!line.trim()) return;
    let message: Message | Message[];
    try { message = JSON.parse(line) as Message | Message[]; }
    catch { fail(null, -32700, 'Parse error'); return; }
    for (const one of Array.isArray(message) ? message : [message]) void handle(one);
  });
  return new Promise<void>(resolve => {
    lines.on('close', () => {
      for (const controller of running.values()) controller.abort();
      void handlers.close().finally(resolve);
    });
  });
}
