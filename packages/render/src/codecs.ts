// Video codec plans: which encoder each format and setting uses, its FFmpeg arguments, and whether frames stream
// straight into it during capture or go through a lossless FFV1 master first (two-pass only).
// Every argument here is free of file paths, except two-pass log names, which are relative to the work folder
// FFmpeg runs in: a Windows drive letter's colon would split `-x265-params` and filter option lists.
import { hevcQuality } from '@mografy/core';
import type { RenderSettings, VideoFormat } from '@mografy/core';
import { runFfmpeg } from './ffmpeg.js';

/** Every encoder writes BT.709 limited range, tagged, so players do not guess. */
export const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
/** RGB → Y'CbCr with exact rounding and full chroma, then the encoder's pixel format. */
export const convert = (pixelFormat: string) => `scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=${pixelFormat}`;

export type Platform = NodeJS.Platform;
export interface CodecPlan {
  /** Shown in results and logs, e.g. `hevc_videotoolbox`. */
  encoder: string;
  /**
   * `stream`: each capture segment encodes directly, then segments join by stream copy.
   * `master`: segments are lossless FFV1, joined into one master that is encoded twice (two-pass).
   */
  mode: 'stream' | 'master';
  /** Container of each encoded segment and the joined video before audio is added. */
  extension: 'mp4' | 'webm' | 'mov';
  /** Arguments before `-i` (hardware device setup). */
  input: string[];
  /**
   * Encoder arguments after `-i`, including the conversion filter; `pass` gives two-pass arguments. `threads` is the
   * share of the CPU one encoder may use when several capture segments encode at once (libx265 only).
   */
  video(pass?: 1 | 2, threads?: number): string[];
  /** Fallback note when the requested encoder was unavailable. */
  note?: string | undefined;
  audio: string[];
}

const SPEED_TO_CPU_USED = { ultrafast: 8, veryfast: 6, fast: 4, medium: 2, slow: 1 } as const;
/** Audio: 48 kHz, what video platforms and editors expect. */
const AAC = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'];

/**
 * Hardware quality 1–100 (higher is better) as an encoder quantizer 1–51 (lower is better): 65 → 14, the
 * VideoToolbox setting measured to look like libx265 CRF 14. Only VideoToolbox was measured; NVENC, Quick Sync,
 * AMF and VA-API use this mapping as a starting point.
 */
export const hardwareQp = (quality: number) => Math.min(51, Math.max(1, Math.round((100 - quality) * 0.4)));

/**
 * libx265 sizes its thread pool and frame threads from every core on the machine, so N segments encoding at once start
 * N full pools that fight over the CPU (and each frame thread holds its own reconstructed frames in memory). One
 * segment's share: a pool of `threads`, frame threads as x265 itself picks them for that many cores.
 */
export const x265Threads = (threads: number) => [`pools=${threads}`, `frame-threads=${threads >= 8 ? 3 : threads >= 4 ? 2 : 1}`,
  // Half of the medium preset's 20-frame lookahead: about 150 MB less per 1080p encoder, the same look (SSIM 0.99939 →
  // 0.99935 on mografy-intro) and a slightly smaller file.
  'rc-lookahead=10'];

function software(settings: RenderSettings, twoPass: boolean): CodecPlan {
  const hevc = settings.codec === 'h265';
  // crf and bitrate are on the H.264 scale; H.265 gets the values that keep the same look (HEVC_EQUIVALENT).
  const quality = hevc ? hevcQuality(settings) : { crf: settings.crf, bitrate: settings.bitrate };
  const rate = twoPass ? ['-b:v', quality.bitrate] : ['-crf', String(quality.crf)];
  // Fixed GOP and no scene-cut keyframes inside a segment are not needed: each segment starts with a keyframe and the
  // joined stream only needs identical parameter sets, which the same arguments always produce.
  if (hevc) return {
    encoder: 'libx265', mode: twoPass ? 'master' : 'stream', extension: 'mp4', input: [],
    // x265 `medium` takes about as long as x264 `slow` and already compresses better; x265 `slow` took 2.4× as long
    // for a slightly larger, marginally sharper file, so `slow` encodes with `medium`.
    video: (pass, threads) => ['-c:v', 'libx265', '-preset', settings.preset === 'slow' ? 'medium' : settings.preset, ...rate, '-profile:v', 'main10',
      // libx265 ignores -pass / -passlogfile, so its passes go through -x265-params with a stats file named relative to
      // the work folder: the option list is colon-separated, so a Windows drive letter would split it.
      '-x265-params', ['log-level=error', ...(pass ? [`pass=${pass}`, 'stats=x265.log'] : []), ...(threads ? x265Threads(threads) : [])].join(':'),
      '-vf', convert('yuv420p10le'), '-tag:v', 'hvc1', ...BT709],
    audio: AAC,
  };
  return {
    encoder: 'libx264', mode: twoPass ? 'master' : 'stream', extension: 'mp4', input: [],
    video: pass => ['-c:v', 'libx264', '-preset', settings.preset, ...rate, '-profile:v', 'high', ...(pass ? ['-pass', String(pass), '-passlogfile', 'x264'] : []),
      '-vf', convert('yuv420p'), '-tag:v', 'avc1', ...BT709],
    audio: AAC,
  };
}

function vp9(settings: RenderSettings): CodecPlan {
  const twoPass = settings.encoding === 'two-pass';
  return {
    encoder: 'libvpx-vp9', mode: twoPass ? 'master' : 'stream', extension: 'webm', input: [],
    video: pass => ['-c:v', 'libvpx-vp9', '-deadline', 'good', '-cpu-used', String(SPEED_TO_CPU_USED[settings.preset]), '-row-mt', '1',
      ...(twoPass ? ['-b:v', settings.bitrate] : ['-b:v', '0', '-crf', String(settings.crf)]),
      ...(pass ? ['-pass', String(pass), '-passlogfile', 'vp9'] : []), '-vf', convert('yuv420p'), ...BT709],
    audio: ['-c:a', 'libopus', '-b:a', '128k'],
  };
}

/** One hardware encoder: how to probe it and its encode arguments. */
interface HardwareEncoder {
  name: string;
  /** Arguments before `-i`. */
  input: string[];
  /** Pixel format the frames reach the encoder in (the probe uses it too). */
  pixelFormat: string;
  /** Filter after the conversion (VA-API uploads to the device). */
  upload?: string;
  args(settings: RenderSettings): string[];
}
const VAAPI_DEVICE = '/dev/dri/renderD128';
/** Hardware encoders worth trying on each platform, best first. */
export function hardwareEncoders(platform: Platform, codec: RenderSettings['codec']): HardwareEncoder[] {
  const hevc = codec === 'h265', ten = hevc ? 'p010le' : 'nv12', profile = hevc ? ['-profile:v', 'main10'] : ['-profile:v', 'high'];
  const tag = hevc ? ['-tag:v', 'hvc1'] : ['-tag:v', 'avc1'], kind = hevc ? 'hevc' : 'h264';
  const qp = (s: RenderSettings) => String(hardwareQp(s.hardwareQuality));
  const videotoolbox: HardwareEncoder = { name: `${kind}_videotoolbox`, input: [], pixelFormat: ten,
    args: s => ['-c:v', `${kind}_videotoolbox`, ...profile, '-q:v', String(s.hardwareQuality), ...tag] };
  const nvenc: HardwareEncoder = { name: `${kind}_nvenc`, input: [], pixelFormat: ten,
    args: s => ['-c:v', `${kind}_nvenc`, '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-cq', qp(s), '-b:v', '0', ...profile, ...tag] };
  const qsv: HardwareEncoder = { name: `${kind}_qsv`, input: [], pixelFormat: ten,
    args: s => ['-c:v', `${kind}_qsv`, '-preset', 'slower', '-global_quality', qp(s), ...profile, ...tag] };
  const amf: HardwareEncoder = { name: `${kind}_amf`, input: [], pixelFormat: ten,
    args: s => ['-c:v', `${kind}_amf`, '-quality', 'quality', '-rc', 'cqp', '-qp_i', qp(s), '-qp_p', qp(s), ...(hevc ? [] : ['-qp_b', qp(s)]), ...profile, ...tag] };
  const vaapi: HardwareEncoder = { name: `${kind}_vaapi`, input: ['-vaapi_device', VAAPI_DEVICE], pixelFormat: ten, upload: 'hwupload',
    args: s => ['-c:v', `${kind}_vaapi`, '-qp', qp(s), ...profile, ...tag] };
  if (platform === 'darwin') return [videotoolbox];
  if (platform === 'win32') return [nvenc, qsv, amf];
  if (platform === 'linux') return [nvenc, vaapi, qsv];
  return [];
}

const available = new Map<string, Promise<boolean>>();
/** Whether this FFmpeg can open an encoder on this machine: one tiny real encode, cached per process. */
export function encoderWorks(args: string[], input: string[] = [], filter = 'format=yuv420p') {
  const key = [...input, filter, ...args].join(' ');
  let probe = available.get(key);
  if (!probe) {
    // 256 × 144: above every hardware encoder's minimum frame size.
    // A broken graphics driver can hang the encoder instead of failing it: give up after 20 s and use software.
    probe = runFfmpeg([...input, '-f', 'lavfi', '-i', 'testsrc2=size=256x144:rate=30', '-frames:v', '3', '-vf', filter, ...args, '-f', 'null', '-'], AbortSignal.timeout(20_000))
      .then(() => true, () => false);
    available.set(key, probe);
  }
  return probe;
}
/** Forget probe results (tests). */
export function resetEncoderProbes() { available.clear(); }

/** The software encoder each plan needs, for a clear error when this FFmpeg lacks it. */
async function requireEncoder(name: string) {
  if (await encoderWorks(['-c:v', name, ...(name === 'libx265' ? ['-x265-params', 'log-level=error'] : [])], [], name === 'prores_ks' ? 'format=yuv422p10le' : 'format=yuv420p')) return;
  throw new Error(`This FFmpeg has no working ${name} encoder. Install an FFmpeg build that includes it, or set MOGRAFY_FFMPEG to one.`);
}

/**
 * The plan for one export.
 * - MP4: H.265 10-bit (libx265) or H.264 (libx264) at constant quality, streamed; two-pass from a lossless master; or
 *   the platform's hardware encoder (VideoToolbox, NVENC, Quick Sync, AMF, VA-API), streamed. Without a working
 *   hardware encoder, `hardware` falls back to software constant quality at the fast preset; without libx265, H.265
 *   falls back to libx264. Each fallback is reported in `note`.
 * - MOV: ProRes 422 HQ (10-bit), VideoToolbox when available, else prores_ks; always streamed.
 * - WebM: VP9 (`hardware` means constant quality).
 */
export async function planCodec(format: VideoFormat, settings: RenderSettings, platform: Platform = process.platform): Promise<CodecPlan> {
  if (format === 'webm') {
    await requireEncoder('libvpx-vp9');
    return vp9(settings.encoding === 'hardware' ? { ...settings, encoding: 'crf' } : settings);
  }
  if (format === 'mov') {
    const hardware = platform === 'darwin' && await encoderWorks(['-c:v', 'prores_videotoolbox', '-profile:v', 'hq'], [], 'format=p210le');
    if (!hardware) await requireEncoder('prores_ks');
    return {
      encoder: hardware ? 'prores_videotoolbox' : 'prores_ks', mode: 'stream', extension: 'mov', input: [],
      video: () => hardware
        ? ['-c:v', 'prores_videotoolbox', '-profile:v', 'hq', '-vf', convert('p210le'), ...BT709]
        : ['-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0', '-vf', convert('yuv422p10le'), ...BT709],
      audio: ['-c:a', 'pcm_s16le', '-ar', '48000'],
    };
  }
  let note: string | undefined;
  if (settings.encoding === 'hardware') {
    for (const encoder of hardwareEncoders(platform, settings.codec)) {
      const filter = `format=${encoder.pixelFormat}${encoder.upload ? `,${encoder.upload}` : ''}`;
      if (!await encoderWorks(encoder.args(settings), encoder.input, filter)) continue;
      return {
        encoder: encoder.name, mode: 'stream', extension: 'mp4', input: encoder.input,
        video: () => {
          const args = encoder.args(settings);
          return [...args, '-vf', `${convert(encoder.pixelFormat)}${encoder.upload ? `,${encoder.upload}` : ''}`, ...BT709];
        },
        audio: AAC,
      };
    }
    note = 'No hardware encoder works on this machine; encoded in software at the fast preset.';
    settings = { ...settings, encoding: 'crf', preset: 'fast' };
  }
  if (settings.codec === 'h265' && !await encoderWorks(['-c:v', 'libx265', '-x265-params', 'log-level=error'])) {
    note = 'This FFmpeg has no libx265; encoded H.264 instead.';
    settings = { ...settings, codec: 'h264' };
  }
  await requireEncoder(settings.codec === 'h265' ? 'libx265' : 'libx264');
  return { ...software(settings, settings.encoding === 'two-pass'), note };
}

/** FFmpeg arguments that read raw RGBA frames from stdin and write one capture segment. */
export function segmentArgs(width: number, height: number, fps: number, plan: Pick<CodecPlan, 'input'>, video: string[], file: string) {
  return [...plan.input, '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', 'pipe:0', ...video, '-an', '-y', file];
}

/** Lossless segment arguments for `master` plans. */
export const LOSSLESS = ['-c:v', 'ffv1', '-level', '3', '-g', '1', '-pix_fmt', 'bgr0'];

/** Concat demuxer list naming segment files relative to the list (which sits beside them): no drive letters or escapes. */
export const concatList = (names: string[]) => names.map(name => {
  if (/[\\/:']/.test(name)) throw new Error(`Segment names must be plain file names: ${name}`);
  return `file '${name}'`;
}).join('\n') + '\n';
