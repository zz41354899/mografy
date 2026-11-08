// Export benchmark: renders each project once losslessly as the reference, then exports it with each case and
// reports wall, capture, encode and mux seconds, file size, SSIM and VMAF against the reference, and the ffprobe
// summary. Runs against the built packages (`pnpm build` first).
//
//   node --import tsx scripts/bench-export.ts [--project dir[:override=value,...]]... [--case name]... [--out dir]
//
// Without --project it benchmarks examples/mografy-intro and examples/stage-invoices (with glow and grain).
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { validateSceneProject } from '../packages/core/dist/index.js';
import type { SceneProject } from '../packages/core/dist/index.js';
import { SceneHost, buildScene, ffmpegOutput, ffmpegPath, renderVideo, startFfmpeg } from '../packages/render/dist/index.js';

const run = promisify(execFile);
const root = resolve(import.meta.dirname, '..');

/** Each case is render overrides plus a format; unknown keys are ignored by older pipelines. */
const CASES: Record<string, { format: 'mp4' | 'webm' | 'mov'; render: Record<string, unknown> }> = {
  'x265-crf': { format: 'mp4', render: { codec: 'h265', encoding: 'crf', crf: 18, preset: 'medium' } },
  'x264-crf': { format: 'mp4', render: { codec: 'h264', encoding: 'crf', crf: 18, preset: 'medium' } },
  'x265-two-pass': { format: 'mp4', render: { codec: 'h265', encoding: 'two-pass', bitrate: '12M', preset: 'medium' } },
  hardware: { format: 'mp4', render: { codec: 'h265', encoding: 'hardware', hardwareQuality: 65, canvas: 'gpu' } },
  prores: { format: 'mov', render: {} },
  vp9: { format: 'webm', render: { encoding: 'crf', crf: 32, preset: 'medium' } },
};
const COMMON = { fps: 60, samples: 4, scale: 1 };

interface Target { dir: string; overrides: Record<string, unknown> }
function parseArgs(argv: string[]) {
  const targets: Target[] = [], cases: string[] = [];
  let out = join(root, '.tmp', 'bench');
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i], value = argv[++i];
    if (!value) throw new Error(`${flag} needs a value`);
    if (flag === '--project') {
      const [dir, extra] = value.split(/:(?=[a-z])/i) as [string, string | undefined];
      const overrides = Object.fromEntries((extra ?? '').split(',').filter(Boolean).map(pair => {
        const [key, raw] = pair.split('=') as [string, string];
        return [key, raw === 'true' ? true : raw === 'false' ? false : Number.isNaN(Number(raw)) ? raw : Number(raw)];
      }));
      targets.push({ dir: resolve(dir), overrides });
    } else if (flag === '--case') {
      if (!CASES[value]) throw new Error(`Unknown case ${value}; one of ${Object.keys(CASES).join(', ')}`);
      cases.push(value);
    } else if (flag === '--out') out = resolve(value);
    else throw new Error(`Unknown flag ${flag}`);
  }
  if (!targets.length) targets.push(
    { dir: join(root, 'examples/mografy-intro'), overrides: {} },
    { dir: join(root, 'examples/stage-invoices'), overrides: { glow: 0.12, grain: 0.008 } },
  );
  return { targets, cases: cases.length ? cases : ['x265-crf', 'x264-crf', 'hardware'], out };
}

/** Lossless reference with the same samples and post settings, drawn on the CPU canvas with every sample. */
async function reference(host: SceneHost, build: Awaited<ReturnType<typeof buildScene>>, project: SceneProject, file: string) {
  const settings = { ...project.render, adaptiveSamples: false };
  const page = await host.open(build, project, { renderScale: settings.scale, canvas: 'cpu' });
  const { width, height, meta } = page.scene, frames = Math.max(1, Math.ceil(meta.duration * settings.fps - 1e-9));
  const ffmpeg = startFfmpeg(['-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${width}x${height}`, '-framerate', String(settings.fps), '-i', 'pipe:0', '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgr0', '-y', file], true);
  try {
    for (let k = 0; k < frames; k++) await ffmpeg.write(await page.output(k, settings, k + 1 < frames ? k + 1 : undefined));
    await ffmpeg.end();
  } finally { await page.close(); }
}

async function metrics(distorted: string, ref: string) {
  const threads = availableParallelism();
  // Both sides go to 10-bit 4:4:4 in BT.709, so the comparison sees only what encoding changed.
  const prep = 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv444p10le';
  const graph = `[0:v]${prep},split[d1][d2];[1:v]${prep},split[r1][r2];[d1][r1]ssim;[d2][r2]libvmaf=n_threads=${threads}:n_subsample=2`;
  const { stderr } = await run(ffmpegPath(), ['-hide_banner', '-i', distorted, '-i', ref, '-filter_complex', graph, '-f', 'null', '-'], { maxBuffer: 64 * 1024 ** 2 })
    .catch(error => ({ stderr: String((error as { stderr?: string }).stderr ?? error) }));
  const ssim = /SSIM .*All:([\d.]+)/.exec(stderr)?.[1], vmaf = /VMAF score: ([\d.]+)/.exec(stderr)?.[1];
  return { ssim: ssim ? Number(ssim) : undefined, vmaf: vmaf ? Number(vmaf) : undefined };
}

async function probe(file: string) {
  const out = await ffmpegOutput(['-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-']).then(() => '', () => '');
  void out;
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries',
    'stream=codec_type,codec_name,codec_tag_string,profile,pix_fmt,color_range,color_space,color_transfer,color_primaries,r_frame_rate,nb_frames,duration,sample_rate',
    '-of', 'json', file]).catch(() => ({ stdout: '{"streams":[]}' }));
  return (JSON.parse(stdout) as { streams: Record<string, string>[] }).streams;
}

const { targets, cases, out } = parseArgs(process.argv.slice(2));
await mkdir(out, { recursive: true });
const rows: Record<string, unknown>[] = [];
for (const target of targets) {
  const base = validateSceneProject(JSON.parse(await readFile(join(target.dir, 'mografy.json'), 'utf8')));
  const project = { ...base, render: { ...base.render, ...COMMON, ...target.overrides } } as SceneProject;
  const build = await buildScene(target.dir, project);
  const host = await SceneHost.start(target.dir);
  const name = target.dir.split(/[\\/]/).at(-1)!, ref = join(out, `${name}-reference.mkv`);
  try {
    const t0 = performance.now();
    await reference(host, build, project, ref);
    console.log(`${name}: reference in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    for (const id of cases) {
      const spec = CASES[id]!, file = join(out, `${name}-${id}.${spec.format}`);
      const job = { ...project, render: { ...project.render, ...spec.render } } as SceneProject;
      let captured: number | undefined;
      const start = performance.now();
      const result = await renderVideo({ format: spec.format, projectDir: target.dir, project: job, build, host, overwrite: true, output: file,
        onProgress: (_done: number, _total: number, stage: string) => { if (stage !== 'capture') captured ??= performance.now(); } });
      const wall = (performance.now() - start) / 1000;
      const timings = (result as { timings?: Record<string, number> }).timings;
      const size = (await stat(file)).size, quality = await metrics(file, ref), streams = await probe(file);
      const video = streams.find(s => s.codec_type === 'video'), audio = streams.find(s => s.codec_type === 'audio');
      const row = {
        project: name, case: id, encoder: (result as { encoder?: string }).encoder ?? '', wall: +wall.toFixed(1),
        capture: +(timings?.capture ?? ((captured ?? start) - start) / 1000).toFixed(1),
        encode: timings ? +timings.encode!.toFixed(1) : +(wall - ((captured ?? start) - start) / 1000).toFixed(1),
        mux: timings ? +timings.mux!.toFixed(1) : undefined,
        mb: +(size / 1024 ** 2).toFixed(2), ssim: quality.ssim, vmaf: quality.vmaf,
        video: video && `${video.codec_name}/${video.codec_tag_string} ${video.profile} ${video.pix_fmt} ${video.color_range}/${video.color_space}/${video.color_transfer}/${video.color_primaries} ${video.r_frame_rate} ${video.nb_frames}f ${video.duration}s`,
        audio: audio && `${audio.codec_name} ${audio.sample_rate} Hz ${audio.duration}s`,
      };
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  } finally {
    await host.close();
    await rm(ref, { force: true });
  }
}
const columns = ['project', 'case', 'encoder', 'wall', 'capture', 'encode', 'mux', 'mb', 'ssim', 'vmaf', 'video', 'audio'];
const table = [`| ${columns.join(' | ')} |`, `| ${columns.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${columns.map(c => r[c] ?? '').join(' | ')} |`)].join('\n');
await writeFile(join(out, 'results.md'), `${table}\n`);
await writeFile(join(out, 'results.json'), JSON.stringify(rows, null, 2));
console.log(`\n${table}\n\nWritten to ${join(out, 'results.md')}`);
