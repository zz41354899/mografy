#!/usr/bin/env python3
"""Compress an exported video to a separate H.264 MP4 using FFmpeg (Python 3.10+)."""

import argparse
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


class CompressionError(Exception):
    pass


def positive_number(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError("must be a positive, finite number")
    return number


def dimension(value):
    number = int(value)
    if number < 2:
        raise argparse.ArgumentTypeError("must be at least 2 pixels")
    return number


def executable(value, name):
    found = shutil.which(value)
    if not found:
        raise CompressionError(
            f"Cannot find {name}: {value}. Install FFmpeg with ffprobe, "
            f"or pass --{name} /path/to/{name}."
        )
    return found


def run(command):
    result = subprocess.run(command, stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if result.returncode:
        raise CompressionError(f"{Path(command[0]).name} failed:\n{result.stderr[-6000:].strip()}")
    return result.stdout


def probe(ffprobe, path):
    data = json.loads(run([
        ffprobe, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path),
    ]))
    video = next((stream for stream in data.get("streams", [])
                  if stream.get("codec_type") == "video"
                  and not stream.get("disposition", {}).get("attached_pic")), None)
    if video is None:
        raise CompressionError(f"No video stream: {path}")
    try:
        duration = float(data.get("format", {}).get("duration", video.get("duration", 0)))
    except (ValueError, TypeError):
        duration = 0
    if not math.isfinite(duration) or duration <= 0:
        raise CompressionError(f"Video has no valid duration: {path}")
    audio = any(stream.get("codec_type") == "audio" for stream in data.get("streams", []))
    return video, duration, audio


def compress(args):
    source = args.input.expanduser().resolve()
    output = (args.output.expanduser().absolute() if args.output else
              source.with_name(source.stem + "-compressed.mp4"))
    if not source.is_file():
        raise CompressionError(f"Input file does not exist: {source}")
    if source == output.resolve():
        raise CompressionError("Input and output must be different files; the original is preserved.")
    if os.path.lexists(output):
        raise CompressionError(f"Output already exists; choose another -o path: {output}")
    if output.suffix.lower() != ".mp4":
        raise CompressionError("Output must have the .mp4 extension.")

    ffmpeg = executable(args.ffmpeg, "ffmpeg")
    ffprobe = executable(args.ffprobe, "ffprobe")
    video, duration, has_audio = probe(ffprobe, source)
    include_audio = has_audio and not args.no_audio
    original_bytes = source.stat().st_size
    target_bytes = int(args.target_mb * 1_000_000) if args.target_mb else None
    video_bitrate = None
    if target_bytes is not None:
        # Reserve 5% for MP4 overhead and two-pass rate-control variation.
        video_bitrate = int(target_bytes * 8 * .95 / duration) - (
            args.audio_kbps * 1000 if include_audio else 0
        )
        if video_bitrate < 32_000:
            raise CompressionError(
                "Target is too small for the duration/audio budget. Increase --target-mb, "
                "reduce --audio-kbps, or use --no-audio if sound is unnecessary."
            )

    width = f"min(iw,{args.max_width})" if args.max_width else "iw"
    height = f"min(ih,{args.max_height})" if args.max_height else "ih"
    scale = (f"scale=w='{width}':h='{height}':"
             "force_original_aspect_ratio=decrease:force_divisible_by=2")
    common = [ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
              "-i", str(source), "-map", f"0:{video['index']}",
              "-c:v", "libx264", "-preset", args.preset, "-pix_fmt", "yuv420p", "-vf", scale]
    audio = (["-map", "0:a:0", "-c:a", "aac", "-b:a", f"{args.audio_kbps}k"]
             if include_audio else ["-an"])

    output.parent.mkdir(parents=True, exist_ok=True)
    # Same filesystem as output; publish only a complete, validated file.
    with tempfile.TemporaryDirectory(prefix=".mografy-compress-", dir=output.parent) as folder:
        temporary = Path(folder) / "compressed.mp4"
        if video_bitrate is not None:
            rate = ["-b:v", str(video_bitrate), "-passlogfile", str(Path(folder) / "pass")]
            print("Compressing video (two passes)…", file=sys.stderr, flush=True)
            run(common + rate + ["-pass", "1", "-an", "-f", "null", os.devnull])
            run(common + rate + ["-pass", "2"] + audio +
                ["-movflags", "+faststart", str(temporary)])
        else:
            print("Compressing video…", file=sys.stderr, flush=True)
            run(common + ["-crf", str(args.crf if args.crf is not None else 23)] + audio +
                ["-movflags", "+faststart", str(temporary)])

        encoded_video, encoded_duration, encoded_audio = probe(ffprobe, temporary)
        if abs(encoded_duration - duration) > max(.25, duration * .01):
            raise CompressionError("Encoded duration differs from the original; no output was published.")
        if include_audio != encoded_audio:
            raise CompressionError("Encoded audio does not match the requested output.")
        run([ffmpeg, "-v", "error", "-xerror", "-nostdin", "-i", str(temporary),
             "-map", "0:v:0", "-map", "0:a:0?", "-f", "null", os.devnull])
        compressed_bytes = temporary.stat().st_size
        if target_bytes is not None and compressed_bytes > target_bytes:
            raise CompressionError(
                f"Encoded file is {compressed_bytes / 1_000_000:.3f} MB, exceeding "
                f"--target-mb {args.target_mb}. No output was published. Try a lower "
                "target budget or lower audio bitrate to leave more overhead headroom."
            )
        result = {
            "status": "compressed" if compressed_bytes < original_bytes else "skipped",
            "input": str(source), "output": None,
            "original_bytes": original_bytes, "compressed_bytes": compressed_bytes,
            "saved_percent": round((1 - compressed_bytes / original_bytes) * 100, 2),
            "width": encoded_video["width"], "height": encoded_video["height"],
            "duration_seconds": encoded_duration, "audio": encoded_audio,
        }
        if compressed_bytes >= original_bytes:
            result["reason"] = "Re-encoding did not reduce file size; original preserved, candidate discarded."
        else:
            # Hard link gives atomic no-clobber publication, including concurrent invocations.
            os.link(temporary, output)
            result["output"] = str(output)
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="exported video, e.g. project/renders/film.mp4")
    parser.add_argument("-o", "--output", type=Path, help="new MP4 (default: INPUT-compressed.mp4)")
    quality = parser.add_mutually_exclusive_group()
    quality.add_argument("--crf", type=int, choices=range(0, 52), metavar="0..51",
                         help="quality mode (default: 23); lower values retain more detail")
    quality.add_argument("--target-mb", type=positive_number,
                         help="maximum decimal MB; two-pass encoding, fails if the result exceeds it")
    parser.add_argument("--preset", default="medium", choices=[
        "ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow",
    ])
    parser.add_argument("--max-width", type=dimension, help="limit width without upscaling or cropping")
    parser.add_argument("--max-height", type=dimension, help="limit height without upscaling or cropping")
    parser.add_argument("--audio-kbps", type=int, choices=[64, 96, 128, 160, 192, 256, 320], default=128)
    parser.add_argument("--no-audio", action="store_true", help="explicitly remove audio")
    parser.add_argument("--ffmpeg", default=os.environ.get("MOGRAFY_FFMPEG") or "ffmpeg")
    parser.add_argument("--ffprobe", default=os.environ.get("MOGRAFY_FFPROBE") or "ffprobe")
    args = parser.parse_args()
    try:
        print(json.dumps(compress(args), indent=2, ensure_ascii=False))
    except KeyboardInterrupt:
        print("Cancelled; no new output was published.", file=sys.stderr)
        return 130
    except (CompressionError, OSError, ValueError, KeyError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
