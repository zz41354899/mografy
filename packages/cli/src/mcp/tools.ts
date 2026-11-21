// The tools `mografy mcp` offers. Each does what the matching CLI command does, through the same Project or player,
// and answers with text for the model plus structured content for clients that read it.
import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import {
  EXPORT_PRESETS, EXPORT_SIZES, aspectRatioSchema, MP4_PORTRAIT_SIZES, exportFormatSchema, exportPresetSchema, frameCostReport, isVideoFormat,
  sharedSkillFiles, shotIssues, smoothnessReport, tempoIssues,
} from '@mografy/core';
import type { ExportRequest, Snapshot } from '@mografy/core';
import { createInLibrary, findServer, installation, listProjects } from '@mografy/server';
import { switchActive } from '../commands/dev.js';
import type { CheckResult, Hosts } from './hosts.js';
import type { CallContext, Content, ToolResult } from './rpc.js';

type Args = Record<string, unknown>;
interface Tool {
  name: string; title: string; description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run(args: Args, context: CallContext): Promise<ToolResult>;
}

const PROJECT = { type: 'string', description: 'Project folder: an absolute path, or a folder name from list_projects. Defaults to MOGRAFY_PROJECT or the current folder.' };
const text = (value: string): Content => ({ type: 'text', text: value });
const png = (data: Buffer): Content => ({ type: 'image', data: data.toString('base64'), mimeType: 'image/png' });
const done = (lines: string[], structured?: Record<string, unknown>, images: Content[] = []): ToolResult =>
  ({ content: [text(lines.join('\n')), ...images], ...(structured ? { structuredContent: structured } : {}) });

const str = (args: Args, key: string) => typeof args[key] === 'string' && (args[key] as string).trim() ? (args[key] as string).trim() : undefined;
const num = (args: Args, key: string) => {
  const value = args[key];
  if (value === undefined) return undefined;
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${key} must be a number`);
  return n;
};
const oneOf = <T extends string>(args: Args, key: string, values: readonly T[]) => {
  const value = str(args, key);
  if (value === undefined) return undefined;
  if (!values.includes(value as T)) throw new Error(`${key} must be one of ${values.join(', ')}`);
  return value as T;
};

/** The parts of a snapshot a model needs: what the film is, and whether it currently builds. */
function describeSnapshot(snapshot: Snapshot) {
  const meta = snapshot.scene?.meta;
  return {
    dir: snapshot.projectDir,
    name: snapshot.project?.name,
    scene: snapshot.project?.scene ?? 'scenes/main.ts',
    version: snapshot.scene?.version,
    size: meta ? { width: meta.width, height: meta.height } : undefined,
    duration: meta?.duration,
    loop: meta?.loop,
    shots: meta?.shots,
    tempo: meta?.tempo,
    sources: snapshot.scene?.sources,
    params: snapshot.scene?.params,
    settings: snapshot.project ? {
      aspectRatio: snapshot.project.aspectRatio, seed: snapshot.project.seed, params: snapshot.project.params,
      audio: snapshot.project.audio, render: snapshot.project.render, review: snapshot.project.review,
    } : undefined,
    error: snapshot.error?.message,
    issues: snapshot.issues.length ? snapshot.issues : undefined,
    export: snapshot.render ?? undefined,
  };
}

function checkLines(snapshot: CheckResult, hasStyle: boolean) {
  const lines: string[] = [], warnings: string[] = [];
  if (!snapshot.scene || snapshot.error) throw new Error(snapshot.error?.message ?? 'The scene did not publish.');
  const { meta } = snapshot.scene;
  lines.push(`✓ Compiled and trial-rendered in Chromium: ${meta.width}×${meta.height}, ${meta.duration}s, version ${snapshot.scene.version}`);
  if (meta.shots) {
    const issues = shotIssues(meta);
    if (issues.length) throw new Error(issues.join('\n'));
    lines.push(`✓ ${meta.shots.length} shot${meta.shots.length === 1 ? '' : 's'}`);
  }
  if (meta.tempo) {
    const issues = tempoIssues(meta, snapshot.project?.audio);
    if (issues.length) warnings.push(...issues);
    else lines.push(`✓ Timed to ${meta.tempo.bpm} BPM`);
  }
  if (snapshot.cost) {
    const report = frameCostReport(snapshot.cost);
    lines.push(`${report.warnings.length ? '!' : '✓'} ${report.summary}`);
    warnings.push(...report.warnings);
  }
  if (!hasStyle) warnings.push("No style.md: write the film's idea, design system and motion decisions to style.md, so later changes keep this look.");
  return { lines, warnings };
}

function exportRequest(args: Args): ExportRequest {
  const preset = oneOf(args, 'preset', exportPresetSchema.options);
  const formatArg = oneOf(args, 'format', exportFormatSchema.options);
  const presetSettings = preset ? EXPORT_PRESETS[preset] : undefined;
  if (presetSettings && formatArg && formatArg !== presetSettings.format) throw new Error(`preset ${preset} exports ${presetSettings.format}; leave out format or choose another preset`);
  const format = presetSettings?.format ?? formatArg ?? 'mp4';
  const orientation = oneOf(args, 'orientation', ['landscape', 'portrait'] as const);
  const resolution = oneOf(args, 'resolution', ['720p', '1080p'] as const);
  const codec = oneOf(args, 'codec', ['h265', 'h264'] as const);
  if ((orientation || resolution) && !isVideoFormat(format)) throw new Error('orientation and resolution are MP4, WebM and MOV options');
  if (codec && format !== 'mp4') throw new Error('codec is an MP4 option');
  const sized = (orientation === 'portrait' ? MP4_PORTRAIT_SIZES : EXPORT_SIZES.mp4)[resolution === '1080p' ? 1 : 0]!;
  let output = str(args, 'output')?.replaceAll('\\', '/');
  if (output) {
    if (output.startsWith('/') || output.split('/').includes('..') || output.includes(':')) throw new Error('output must be a file inside renders/');
    if (!output.startsWith('renders/')) output = `renders/${output}`;
  }
  return {
    format,
    ...(orientation || resolution ? { size: { width: sized.width, height: sized.height, fit: 'contain' as const } } : {}),
    ...(output ? { output } : {}),
    ...(presetSettings || codec ? { render: { ...presetSettings?.render, ...(codec ? { codec } : {}) } } : {}),
  };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const guideFiles = () => sharedSkillFiles().mografy as Record<string, string>;

export function tools(hosts: Hosts): Tool[] {
  return [
    {
      name: 'list_projects', title: 'List projects',
      description: 'List Mografy projects: recently opened ones, the projects library and the bundled examples. Use a project\'s dir (or its folder name) as the `project` argument of the other tools.',
      inputSchema: { type: 'object', properties: { include_builtin: { type: 'boolean', description: 'Also list the sixteen bundled component projects (default false).' } } },
      annotations: { readOnlyHint: true },
      async run(args) {
        const list = await listProjects();
        const projects = list.projects.filter(p => args.include_builtin === true || p.kind !== 'component')
          .map(({ dir, name, kind, valid, updatedAt }) => ({ dir, name, kind, valid, updatedAt }));
        return done([`Library: ${list.library}`, ...projects.map(p => `- ${p.name} (${p.kind}${p.valid ? '' : ', invalid mografy.json'}): ${p.dir}`)], { library: list.library, projects });
      },
    },
    {
      name: 'project_info', title: 'Project info',
      description: 'Describe a project: size, duration, shots (beat table), tempo, source files, parameters, mografy.json settings, the last build error, and whether a player is serving it. Builds the current files first.',
      inputSchema: { type: 'object', properties: { project: PROJECT } },
      annotations: { readOnlyHint: true },
      async run(args) {
        const dir = await hosts.resolve(args.project);
        return hosts.with(dir, async host => {
          const info = { ...describeSnapshot(await host.snapshot()), player: host.via === 'player' ? host.url : undefined };
          return done([JSON.stringify(info, null, 2)], info);
        });
      },
    },
    {
      name: 'check', title: 'Check',
      description: 'Compile the scene and trial-render it in Chromium (mografy check): shot table, tempo, frame cost and style.md. With motion: true, also scan every frame for jumps, hard starts and hard stops (slower). Run after every scene change and fix every warning.',
      inputSchema: { type: 'object', properties: { project: PROJECT, motion: { type: 'boolean', description: 'Also run the motion scan (mografy check --motion).' } } },
      annotations: { readOnlyHint: true },
      async run(args) {
        const dir = await hosts.resolve(args.project);
        const hasStyle = dir.split(sep).includes('.components') || await access(join(dir, 'style.md')).then(() => true, () => false);
        return hosts.with(dir, async host => {
          const { lines, warnings } = checkLines(await host.check(), hasStyle);
          let motion;
          if (args.motion === true) {
            const result = await host.motion();
            const report = smoothnessReport(result);
            lines.push(`${report.warnings.length ? '!' : '✓'} ${report.summary}`);
            warnings.push(...report.warnings);
            motion = result;
          }
          return done([...lines, ...warnings.map(w => `! ${w}`)], { passed: true, warnings, ...(motion ? { motion } : {}) });
        });
      },
    },
    {
      name: 'render_frame', title: 'Render a frame',
      description: 'Render one frame of the current scene in Chromium and return it as a PNG, to look at a moment of the film. `time` is in seconds. kind "output" gives the exported frame (post-processing, output frame grid); "raw" the scene at exactly that time.',
      inputSchema: { type: 'object', properties: { project: PROJECT, time: { type: 'number', description: 'Time in seconds.' }, kind: { type: 'string', enum: ['output', 'raw'], description: 'Default output.' } }, required: ['time'] },
      annotations: { readOnlyHint: true },
      async run(args) {
        const dir = await hosts.resolve(args.project);
        const time = num(args, 'time') ?? 0;
        const kind = oneOf(args, 'kind', ['output', 'raw'] as const) ?? 'output';
        return hosts.with(dir, async host => done([`Frame at ${time}s (${kind})`], undefined, [png(await host.still(time, kind))]));
      },
    },
    {
      name: 'review', title: 'Visual review',
      description: 'Create the visual-review sheets in renders/ (mografy review): stop frames for review.times and a strip for each review.transitions handoff. Returns the file paths and, by default, the sheet images. Look at every sheet before delivering.',
      inputSchema: { type: 'object', properties: { project: PROJECT, images: { type: 'boolean', description: 'Return the sheet PNGs inline (default true).' } } },
      async run(args) {
        const dir = await hosts.resolve(args.project);
        return hosts.with(dir, async host => {
          const result = await host.review();
          const sheets = result.files.filter(file => file.endsWith('.png'));
          const images = args.images === false ? [] : await Promise.all(sheets.slice(0, 12).map(async file => png(await readFile(file))));
          const lines = ['✓ Visual review created', ...result.files.map(f => `  ${relative(dir, f)}`), `  ${relative(dir, result.report)}`];
          if (result.comparisons.length) lines.push(`  PSNR: ${result.comparisons.map(c => `#${c.frame} ${c.psnr}dB`).join(', ')}`);
          return done(lines, { ...result }, images);
        });
      },
    },
    {
      name: 'read_source', title: 'Read scene source',
      description: 'Read the scene entry and every source file of its current build (project-relative paths). Agents with file access can read the files directly instead.',
      inputSchema: { type: 'object', properties: { project: PROJECT } },
      annotations: { readOnlyHint: true },
      async run(args) {
        const dir = await hosts.resolve(args.project);
        return hosts.with(dir, async host => {
          const source = await host.readSource();
          return done(Object.entries(source.files).map(([path, contents]) => `// ${path}\n${contents}`), { ...source });
        });
      },
    },
    {
      name: 'write_source', title: 'Write scene source',
      description: 'Replace scene source files (project-relative paths under scenes/ or other source folders). The files are compiled and trial-rendered in Chromium first and written only if that passes; a failure returns the error and leaves the files unchanged. Animation belongs only in scene modules, never in mografy.json.',
      inputSchema: { type: 'object', properties: { project: PROJECT, files: { type: 'object', additionalProperties: { type: 'string' }, description: 'Map of project-relative path to the complete new file contents.' } }, required: ['files'] },
      annotations: { destructiveHint: true },
      async run(args) {
        const dir = await hosts.resolve(args.project);
        const files = args.files;
        if (!files || typeof files !== 'object' || Array.isArray(files) || Object.values(files).some(v => typeof v !== 'string')) throw new Error('files must map paths to file contents');
        return hosts.with(dir, async host => {
          const result = await host.writeSource(files as Record<string, string>);
          return done([`✓ Wrote ${Object.keys(files).join(', ')}: version ${result.version}${result.changed ? '' : ' (build unchanged)'}`, ...(result.issues.length ? [`! Parameter issues: ${JSON.stringify(result.issues)}`] : [])], { ...result });
        });
      },
    },
    {
      name: 'create_project', title: 'Create project',
      description: 'Create a new animation project with the starter scene in the projects library (a free folder name is picked from `name`). Returns its dir. Then write style.md and the scene, and check it.',
      inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Project name.' }, aspect_ratio: { type: 'string', enum: aspectRatioSchema.options, description: 'Default 16:9; 9:16 for a native portrait film.' } }, required: ['name'] },
      async run(args) {
        const name = str(args, 'name');
        if (!name) throw new Error('name is required');
        const dir = await createInLibrary(name, oneOf(args, 'aspect_ratio', aspectRatioSchema.options));
        return done([`Created ${dir}`], { dir });
      },
    },
    {
      name: 'open_player', title: 'Open player',
      description: 'Show a project in the Mografy player (mografy dev): switches the player that is already open, or starts one in the background. Returns the player URL. While a player serves a project, the other tools work through it.',
      inputSchema: { type: 'object', properties: { project: PROJECT, browser: { type: 'boolean', description: 'Open the URL in the default browser (default true).' } } },
      annotations: { openWorldHint: false },
      async run(args) {
        const dir = await hosts.resolve(args.project);
        const existing = await findServer(dir);
        if (existing) return done([`The player is serving this project: ${existing.url}`], { url: existing.url });
        await hosts.release(dir);
        const switched = await switchActive(dir).catch(() => undefined);
        if (switched) return done([`Opened the project in the current player: ${switched}`], { url: switched });
        const child = spawn(process.execPath, [installation.cliBin, 'dev', dir, ...(args.browser === false ? ['--no-open'] : [])], { detached: true, stdio: 'ignore', env: { ...process.env, MOGRAFY_CHECKOUT_CHECKED: '1' } });
        child.on('error', () => {}); child.unref();
        for (let i = 0; i < 60; i++) {
          await delay(500);
          const server = await findServer(dir);
          if (server) return done([`Started the player: ${server.url}`], { url: server.url });
        }
        throw new Error('The player did not start within 30 seconds. Run `mografy dev` in a terminal to see why.');
      },
    },
    {
      name: 'export', title: 'Export',
      description: 'Export the film to a file in renders/ (mografy export) and wait for it. Only when the user asks for a file: exports take time and may replace a file in renders/. Reports progress when the client asks for it; cancelling the call cancels the export.',
      inputSchema: {
        type: 'object', properties: {
          project: PROJECT,
          format: { type: 'string', enum: exportFormatSchema.options, description: 'Default mp4; mov is ProRes.' },
          preset: { type: 'string', enum: exportPresetSchema.options, description: 'share: H.264 · high: H.265 10-bit · fast: hardware H.265 · master: ProRes MOV.' },
          output: { type: 'string', description: 'File name, or a path inside renders/.' },
          orientation: { type: 'string', enum: ['landscape', 'portrait'], description: 'Video at 16:9 or 9:16, fitting the whole scene.' },
          resolution: { type: 'string', enum: ['720p', '1080p'] },
          codec: { type: 'string', enum: ['h265', 'h264'], description: 'MP4 codec.' },
        },
      },
      annotations: { destructiveHint: true },
      async run(args, context) {
        const dir = await hosts.resolve(args.project);
        const request = exportRequest(args);
        return hosts.with(dir, async host => {
          const started = await host.startRender(request);
          const cancel = () => { void host.cancelRender(started.id).catch(() => {}); };
          context.signal.addEventListener('abort', cancel, { once: true });
          try {
            for (;;) {
              const current = await host.render();
              if (!current || current.id !== started.id) throw new Error('The export job disappeared.');
              if (current.state === 'done') return done([`✓ ${current.format.toUpperCase()} export complete: ${current.output}${current.encoder ? ` (${current.encoder})` : ''}`, ...(current.note ? [current.note] : [])], { ...current });
              if (current.state === 'failed') throw new Error(current.error ?? 'Export failed.');
              if (current.state === 'cancelled') return done(['Export cancelled.'], { ...current });
              context.progress(current.done, current.total || undefined, current.stage);
              await delay(300);
            }
          } finally { context.signal.removeEventListener('abort', cancel); }
        });
      },
    },
    {
      name: 'read_guide', title: 'Read the Mografy guide',
      description: 'Read the Mografy Skill (hard rules, quality floor, which reference to read for which job) or one of its references, such as references/scene-authoring.md. Read SKILL.md before writing or changing a scene when the Skill is not installed.',
      inputSchema: { type: 'object', properties: { topic: { type: 'string', description: 'SKILL.md (default) or a reference path such as references/scene-authoring.md.' } } },
      annotations: { readOnlyHint: true },
      async run(args) {
        const files = guideFiles();
        const topic = str(args, 'topic') ?? 'SKILL.md';
        const key = files[topic] !== undefined ? topic : files[`references/${topic}`] !== undefined ? `references/${topic}` : files[`references/${topic}.md`] !== undefined ? `references/${topic}.md` : undefined;
        if (!key) throw new Error(`Unknown topic ${topic}. Topics: ${Object.keys(files).join(', ')}`);
        const others = key === 'SKILL.md' ? `\n\n---\nReferences (read with read_guide): ${Object.keys(files).filter(f => f !== 'SKILL.md').join(', ')}` : '';
        return done([files[key]! + others]);
      },
    },
  ];
}
