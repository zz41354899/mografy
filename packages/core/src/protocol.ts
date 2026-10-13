// Shapes shared by the server, player, and CLI (types only).
import type { ExportFormat, ParameterDefinitions, ParameterIssue, ParameterValue, SceneMeta, SceneProject } from './index.js';

export interface SceneInfo {
  version: string; meta: SceneMeta; params: ParameterDefinitions;
  /** Project-relative source files in this build. */
  sources: string[]; publishedAt: string;
  /** What published it: startup, a file change, or a verified HTTP source update. */
  reason: 'startup' | 'watch' | 'update';
}
export interface SceneError { message: string; reason: 'startup' | 'watch'; at: string }
export interface RenderStatus {
  id: string; format: ExportFormat; state: 'running' | 'done' | 'failed' | 'cancelled'; stage: 'capture' | 'encode' | 'package' | 'done';
  done: number; total: number; version: string; output: string; error?: string | undefined;
  /** The job is still cleaning up and cannot be replaced yet. */
  cancelling?: boolean | undefined;
  startedAt: string; finishedAt?: string | undefined;
}
export interface PlayerState { playhead: number }
export interface Snapshot {
  sequence: number; url: string; projectDir: string;
  /** Hash of mografy.json as last read or written. */
  revision: string;
  project: SceneProject | null;
  scene: SceneInfo | null;
  /** Latest failed build; the player keeps showing `scene` meanwhile. */
  error: SceneError | null;
  /** Saved values dropped by the latest scene update. */
  issues: ParameterIssue[];
  state: PlayerState;
  render: RenderStatus | null;
  /** Content hash of the latest thumbnail; changes after the image is actually saved. */
  thumbnail?: string | null;
}
export type ServerEvent =
  | { type: 'snapshot'; reason: string; clientId?: string | undefined; snapshot: Snapshot }
  | { type: 'seek'; t: number; clientId?: string | undefined };
export interface ProjectPatch {
  name?: string;
  /** null removes a saved value (back to the scene default). */
  params?: Record<string, ParameterValue | null>;
  seed?: number;
  audio?: SceneProject['audio'] | null;
  render?: Partial<SceneProject['render']>;
  review?: Partial<SceneProject['review']>;
}
export interface ApiErrorBody { error: { code: string; message: string } }
export interface ProjectSummary {
  dir: string; name: string;
  /** component: bundled showcase; recent: opened before; library: user folder; example: bundled example. */
  kind: 'component' | 'recent' | 'library' | 'example';
  valid: boolean; updatedAt: string;
  /** mtime of .mografy/thumb.png, or null when there is no thumbnail yet. */
  thumb: number | null;
}
export interface ProjectList { current: string | null; library: string; projects: ProjectSummary[] }
