// Connection to the Mografy server: snapshots and seek events over WebSocket, writes over HTTP.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExportRequest, ProjectPatch, RenderStatus, ServerEvent, Snapshot } from '@mografy/core';

export type Connection = 'connecting' | 'connected' | 'offline';
export interface Session {
  snapshot: Snapshot | null;
  connection: Connection;
  clientId: string;
  /** Latest seek requested from outside this window (for example, another player window). */
  seek: { t: number; n: number } | null;
  patchProject(patch: ProjectPatch): Promise<void>;
  reportPlayhead(t: number): void;
  startRender(request?: ExportRequest): Promise<RenderStatus>;
  cancelRender(id?: string): Promise<void>;
  review(): Promise<{ files: string[]; report: string }>;
}

async function call<T>(path: string, method: string, payload?: unknown): Promise<T> {
  const response = await fetch(`/__mografy/${path}`, { method, headers: payload === undefined ? {} : { 'content-type': 'application/json' }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message ?? `HTTP ${response.status}`);
  return data as T;
}

export function useSession(): Session {
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [seek, setSeek] = useState<{ t: number; n: number } | null>(null);
  const sequence = useRef(-1);
  const projectDir = useRef<string | undefined>(undefined);
  const playheadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let socket: WebSocket | undefined, retry: ReturnType<typeof setTimeout> | undefined, delay = 400, stopped = false;
    const connect = () => {
      if (stopped) return;
      setConnection('connecting');
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/__mografy/events`);
      socket.onopen = () => { delay = 400; sequence.current = -1; setConnection('connected'); };
      socket.onmessage = message => {
        const event = JSON.parse(String(message.data)) as ServerEvent;
        if (event.type === 'seek') { if (event.clientId !== clientId) setSeek(s => ({ t: event.t, n: (s?.n ?? 0) + 1 })); return; }
        // Sequence numbers restart when the player switches to another project.
        if (event.snapshot.projectDir !== projectDir.current) { projectDir.current = event.snapshot.projectDir; sequence.current = -1; }
        if (event.snapshot.sequence < sequence.current) return;
        sequence.current = event.snapshot.sequence;
        setSnapshot(event.snapshot);
      };
      socket.onclose = () => { if (stopped) return; setConnection('offline'); retry = setTimeout(connect, delay); delay = Math.min(delay * 2, 4000); };
    };
    connect();
    return () => { stopped = true; clearTimeout(retry); socket?.close(); };
  }, [clientId]);

  return useMemo<Session>(() => ({
    snapshot, connection, clientId, seek,
    async patchProject(patch) { await call('project', 'PATCH', { patch, clientId }); },
    reportPlayhead(t) {
      clearTimeout(playheadTimer.current);
      playheadTimer.current = setTimeout(() => { void call('state', 'PATCH', { playhead: t, clientId }).catch(() => {}); }, 400);
    },
    startRender: (request = {}) => call<RenderStatus>('render', 'POST', request),
    async cancelRender(id) { await call('render/cancel', 'POST', id ? { id } : {}); },
    review: () => call('review', 'POST', {}),
  }), [snapshot, connection, clientId, seek]);
}
