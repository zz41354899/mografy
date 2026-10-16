"""End-to-end compression checks with real FFmpeg; run via pnpm test:compression."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "compress-video.py"
FFMPEG = os.environ.get("MOGRAFY_FFMPEG") or "ffmpeg"
FFPROBE = os.environ.get("MOGRAFY_FFPROBE") or "ffprobe"


def run(command):
    return subprocess.run(command, capture_output=True, text=True, check=True).stdout


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class CompressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which(FFMPEG) or not shutil.which(FFPROBE):
            raise RuntimeError("Compression tests require FFmpeg and ffprobe on PATH or executable overrides.")
        cls.fixtures = tempfile.TemporaryDirectory(prefix="mografy-video-fixtures-")
        cls.master = Path(cls.fixtures.name) / "master.mkv"
        run([FFMPEG, "-v", "error", "-nostdin", "-f", "lavfi", "-i",
             "testsrc2=size=320x180:rate=24:duration=3", "-f", "lavfi", "-i",
             "sine=frequency=440:duration=3", "-c:v", "ffv1", "-c:a", "pcm_s16le", str(cls.master)])

    @classmethod
    def tearDownClass(cls):
        cls.fixtures.cleanup()

    def setUp(self):
        self.workspace = tempfile.TemporaryDirectory(prefix="mografy-video-test-")
        self.addCleanup(self.workspace.cleanup)
        self.folder = Path(self.workspace.name)
        self.source = self.folder / "輸出 film '$test.mkv"
        shutil.copyfile(self.master, self.source)
        self.before = digest(self.source)

    def invoke(self, *args, success=True):
        result = subprocess.run([sys.executable, "-B", str(SCRIPT), str(self.source),
                                 "--ffmpeg", FFMPEG, "--ffprobe", FFPROBE, *map(str, args)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, success, result.stderr)
        self.assertEqual(digest(self.source), self.before)
        self.assertFalse(list(self.folder.glob(".mografy-compress-*")))
        return json.loads(result.stdout) if success else result

    def inspect(self, path):
        return json.loads(run([FFPROBE, "-v", "error", "-show_streams", "-show_format",
                               "-of", "json", str(path)]))

    def test_quality_mode_preserves_audio_timing_and_dimensions(self):
        result = self.invoke()
        self.assertEqual(result["status"], "compressed")
        self.assertLess(result["compressed_bytes"], result["original_bytes"])
        self.assertTrue(result["audio"])
        self.assertEqual((result["width"], result["height"]), (320, 180))
        data = self.inspect(result["output"])
        video = next(s for s in data["streams"] if s["codec_type"] == "video")
        self.assertEqual(video["codec_name"], "h264")
        self.assertEqual(video["avg_frame_rate"], "24/1")
        self.assertEqual(int(video["nb_frames"]), 72)
        self.assertAlmostEqual(float(data["format"]["duration"]), 3, delta=.1)

    def test_two_pass_respects_actual_size_budget(self):
        result = self.invoke("--target-mb", "0.12")
        self.assertEqual(result["status"], "compressed")
        self.assertLessEqual(Path(result["output"]).stat().st_size, 120_000)
        self.assertTrue(result["audio"])

    def test_resize_and_explicit_audio_removal(self):
        result = self.invoke("--max-width", "160", "--max-height", "90", "--no-audio")
        self.assertEqual((result["width"], result["height"]), (160, 90))
        self.assertFalse(result["audio"])
        larger_caps = self.invoke("--max-width", "1920", "--max-height", "1080", "-o", self.folder / "same.mp4")
        self.assertEqual((larger_caps["width"], larger_caps["height"]), (320, 180))

    def test_silent_portrait_input_and_size_budget(self):
        portrait = self.folder / "portrait.mkv"
        run([FFMPEG, "-v", "error", "-nostdin", "-f", "lavfi", "-i",
             "testsrc2=size=180x320:rate=30:duration=2", "-c:v", "ffv1", str(portrait)])
        self.source = portrait
        self.before = digest(portrait)
        result = self.invoke("--max-width", "90", "--max-height", "160", "--target-mb", ".06")
        self.assertEqual((result["width"], result["height"]), (90, 160))
        self.assertFalse(result["audio"])
        self.assertLessEqual(result["compressed_bytes"], 60_000)

    def test_refuses_existing_output_and_original(self):
        existing = self.folder / "existing.mp4"
        existing.write_bytes(b"keep this file")
        self.invoke("-o", existing, success=False)
        self.assertEqual(existing.read_bytes(), b"keep this file")
        self.invoke("-o", self.source, success=False)

    def test_invalid_budget_and_encoder_failure_leave_no_output(self):
        for options in [("--target-mb", "nan"), ("--target-mb", ".001"),
                        ("--crf", "23", "--target-mb", "1"), ("--max-width", "1"),
                        ("--ffmpeg", "mografy-missing-ffmpeg"), ("--ffmpeg", sys.executable)]:
            with self.subTest(options=options):
                self.invoke(*options, success=False)
                self.assertFalse(list(self.folder.glob("*.mp4")))

    def test_larger_candidate_is_discarded(self):
        first = self.invoke("--crf", "35")
        self.source = Path(first["output"])
        self.before = digest(self.source)
        result = self.invoke("--crf", "0")
        self.assertEqual(result["status"], "skipped")
        self.assertIsNone(result["output"])
        self.assertFalse(self.source.with_stem(self.source.stem + "-compressed").exists())

    @unittest.skipIf(os.name == "nt", "SIGINT delivery differs on Windows")
    def test_cancel_cleans_temporary_output_and_preserves_original(self):
        process = subprocess.Popen([
            sys.executable, "-B", str(SCRIPT), str(self.source), "--preset", "veryslow",
            "--ffmpeg", FFMPEG, "--ffprobe", FFPROBE,
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            self.assertIn("Compressing video", process.stderr.readline())
            process.send_signal(signal.SIGINT)
            stdout, stderr = process.communicate(timeout=10)
            self.assertEqual(process.returncode, 130, stderr)
            self.assertEqual(stdout, "")
            self.assertEqual(digest(self.source), self.before)
            self.assertFalse(list(self.folder.glob("*.mp4")))
            self.assertFalse(list(self.folder.glob(".mografy-compress-*")))
        finally:
            if process.poll() is None:
                process.kill()
                process.communicate()


if __name__ == "__main__":
    unittest.main()
