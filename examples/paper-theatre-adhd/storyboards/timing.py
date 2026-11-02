"""Narration timing for 不聽使喚的燈 (ADHD).

The ElevenLabs take (80.35 s, Kuo Yu – Taiwan) is laid on the film timeline unchanged, 1.4 s late, so the lamp snaps on
before the first word. Phrase times were measured with ffmpeg silencedetect (-34 dB / 0.16 s); each pause-bounded segment
was transcribed offline (sherpa-onnx SenseVoice) to match it to the script. Film length 85.0 s.

Run:  python3 storyboards/timing.py   → assets/narration-adhd.mp3 and storyboards/cues.json
"""
import json, subprocess, pathlib

HERE = pathlib.Path(__file__).parent
SRC = HERE / "narration-source.mp3"
OUT = HERE.parent / "assets" / "narration-adhd.mp3"
OFFSET = 1.4
FILM_END = 85.0

# shot, film start, film end, title
SHOTS = [
    ("S01", 0.0, 7.2, "亮燈"), ("S02", 7.2, 13.2, "光滑走"), ("S03", 13.2, 17.7, "標籤"), ("S04", 17.7, 22.9, "忽快忽慢"),
    ("S05", 22.9, 28.3, "後台"), ("S06", 28.3, 35.8, "漏光"), ("S07", 35.8, 42.6, "遠處的獎勵"), ("S08", 42.6, 49.5, "鎖燈"),
    ("S09", 49.5, 56.9, "坐好"), ("S10", 56.9, 62.8, "舞台底下"), ("S11", 62.8, 69.5, "工具箱"), ("S12", 69.5, 76.5, "三張清單"),
    ("S13", 76.5, 85.0, "片名"),
]

# phrase cues in source seconds: (start, end, text)
CUES = [
    (0.20, 1.86, "舞台上有一盞聚光燈。"), (2.35, 3.35, "它照到哪裡，"), (3.57, 4.54, "你就看見哪裡。"),
    (6.04, 7.16, "報告明天要交，"), (7.48, 8.45, "燈一直滑走。"), (9.22, 10.33, "影集看到天亮，"), (10.51, 11.50, "它卻動也不動。"),
    (12.00, 13.35, "很多人說這是懶。"), (14.07, 16.03, "研究看到的，不太一樣。"),
    (16.55, 18.15, "三百多項研究整理出："), (18.54, 21.19, "ADHD 的反應，更容易忽快忽慢。"),
    (21.80, 22.81, "大腦有個後台，"), (23.09, 24.12, "發呆時最亮。"), (24.63, 26.61, "開始做事，它本該暗下來。"),
    (27.19, 28.38, "兒少腦造影看到，"), (28.71, 31.54, "ADHD 的前後台平均分得較不開。"), (31.86, 32.70, "差異很小，"), (32.97, 34.08, "只是線索之一。"),
    (34.79, 36.17, "獎勵也有距離。"), (36.72, 38.71, "對不少有 ADHD 的人來說，"), (38.92, 40.92, "遠處的大獎，縮得特別快。"),
    (41.53, 42.83, "有時燈鎖住不動，"), (43.16, 44.48, "一抬頭，天亮了。"), (44.96, 46.08, "這叫過度專注，"), (46.35, 47.73, "不是 ADHD 獨有。"),
    (48.39, 49.73, "至於那句「坐好」："), (50.30, 51.44, "一項小型研究裡，"), (51.62, 53.78, "有 ADHD 的男孩動得多時，"), (53.96, 55.25, "記憶題答得更好。"),
    (55.72, 58.56, "基因、環境、大腦發展一起作用。"), (58.96, 61.03, "一句「不夠努力」解釋不了。"),
    (61.68, 65.15, "藥物、心理治療、環境調整，都是選項。"), (65.64, 67.84, "怎麼搭配，找專業人員一起看。"),
    (68.40, 70.49, "偶爾分心，不等於 ADHD。"), (70.99, 72.49, "要看是否從小就有、"), (72.72, 74.77, "跨場合，而且影響生活。"),
    (75.99, 77.47, "這盞燈不是不亮。"), (77.91, 78.67, "只是，"), (79.15, 79.98, "比較難調度。"),
]

def shot_of(t):
    for s, a, b, _ in SHOTS:
        if a <= t < b: return s
    return SHOTS[-1][0]

def build_audio():
    ms = int(OFFSET * 1000)
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(SRC),
                    "-af", f"adelay={ms}|{ms},apad=whole_dur={FILM_END},atrim=0:{FILM_END}",
                    "-ac", "2", "-ar", "44100", "-b:a", "192k", str(OUT)], check=True)

if __name__ == "__main__":
    build_audio()
    cues = [{"shot": shot_of(a + OFFSET), "start": round(a + OFFSET, 2), "end": round(b + OFFSET, 2), "text": t} for a, b, t in CUES]
    (HERE / "cues.json").write_text(json.dumps({"offset": OFFSET, "duration": FILM_END, "shots": [{"id": s, "title": n, "start": a, "end": b} for s, a, b, n in SHOTS], "cues": cues}, ensure_ascii=False, indent=1), "utf8")
    print(len(cues), "cues;", OUT.name)
