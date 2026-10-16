// Connection to the Mografy server: snapshots and seek events over WebSocket, writes over HTTP.
import { useEffect, useMemo, useRef, useState } from 'react';
import { callApi } from './api.js';
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
        if (event.snapshot.projectDir !== projectDir.current) { clearTimeout(playheadTimer.current); projectDir.current = event.snapshot.projectDir; sequence.current = -1; setSeek(null); }
        if (event.snapshot.sequence < sequence.current) return;
        sequence.current = event.snapshot.sequence;
        setSnapshot(event.snapshot);
      };
      socket.onclose = () => { if (stopped) return; setConnection('offline'); retry = setTimeout(connect, delay); delay = Math.min(delay * 2, 4000); };
    };
    connect();
    return () => { stopped = true; clearTimeout(retry); clearTimeout(playheadTimer.current); socket?.close(); };
  }, [clientId]);

  const scopedDir = snapshot?.projectDir;
  const actions = useMemo<Pick<Session, 'patchProject' | 'reportPlayhead' | 'startRender' | 'cancelRender' | 'review'>>(() => ({
    async patchProject(patch) { await callApi('project', 'PATCH', { patch, clientId }, scopedDir); },
    reportPlayhead(t) {
      clearTimeout(playheadTimer.current);
      const dir = scopedDir;
      playheadTimer.current = setTimeout(() => { if (dir === projectDir.current) void callApi('state', 'PATCH', { playhead: t, clientId }, dir).catch(() => {}); }, 400);
    },
    startRender: (request = {}) => callApi<RenderStatus>('render', 'POST', request, scopedDir),
    async cancelRender(id) { await callApi('render/cancel', 'POST', id ? { id } : {}, scopedDir); },
    review: () => callApi('review', 'POST', {}, scopedDir),
  }), [clientId, scopedDir]);
  return useMemo(() => ({ snapshot, connection, clientId, seek, ...actions }), [snapshot, connection, clientId, seek, actions]);
}
