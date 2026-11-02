"""Narration timing for 格式塔心理學 Gestalt Psychology.

The ElevenLabs take (71.71 s, Kuo Yu – Taiwan) is laid on the film timeline unchanged, 1.4 s late, so the bulb
pops on before the first word. Phrase times were measured with ffmpeg silencedetect (-35 dB / 0.22 s) and each
pause-bounded segment was transcribed with an offline recogniser (sherpa-onnx SenseVoice) to match it to the script.
Film length 78.0 s (the title holds after the last word).

Run:  python3 storyboards/timing.py   → assets/narration.mp3 and storyboards/cues.json
"""
import json, subprocess, pathlib

HERE = pathlib.Path(__file__).parent
SRC = HERE / "narration-source.mp3"
OUT = HERE.parent / "assets" / "narration.mp3"
OFFSET = 1.4
FILM_END = 78.0

# shot, film start, film end, title
SHOTS = [
    ("S01", 0.0, 4.6, "點燈"), ("S02", 4.6, 11.9, "整體"), ("S03", 11.9, 18.7, "似動現象"),
    ("S04", 18.7, 25.8, "圖形與背景"), ("S05", 25.8, 32.6, "接近"), ("S06", 32.6, 37.0, "相似"),
    ("S07", 37.0, 44.3, "封閉"), ("S08", 44.3, 49.3, "連續"), ("S09", 49.3, 53.7, "共同命運"),
    ("S10", 53.7, 59.5, "簡潔"), ("S11", 59.5, 66.3, "換個角度"), ("S12", 66.3, 70.5, "完成它"),
    ("S13", 70.5, 78.0, "片尾"),
]

# phrase cues in source seconds: (start, end, text, role)
# role: "sub" = bottom subtitle, "step" = shown as the law's big title / descriptor, "tag" = the closing tagline
CUES = [
    (0.08, 0.92, "這些碎片，", "sub"),
    (1.57, 2.45, "看起來像什麼？", "sub"),
    (3.50, 4.12, "燈一停，", "sub"),
    (4.39, 5.80, "碎片就成了一張臉。", "sub"),
    (6.46, 7.25, "考夫卡說：", "sub"),
    (7.67, 9.83, "整體，不等於部分的總和。", "sub"),
    (10.72, 12.70, "1912 年，魏泰默發現：", "sub"),
    (13.14, 14.70, "兩盞燈輪流亮起，", "sub"),
    (15.00, 16.92, "大腦卻看見一隻鳥在飛。", "sub"),
    (17.61, 18.27, "同一張圖，", "sub"),
    (18.59, 20.44, "你看到花瓶，還是兩張臉？", "sub"),
    (21.33, 23.83, "大腦一次，只能選一個當主角。", "sub"),
    (24.71, 26.89, "大腦拼圖，有幾個常見的習慣。", "sub"),
    (27.64, 28.85, "第一，接近：", "step"),
    (29.30, 30.88, "靠在一起的，就是一組。", "step"),
    (31.57, 32.77, "第二，相似：", "step"),
    (33.19, 35.21, "長得像的，會被看成同一類。", "step"),
    (35.86, 37.01, "第三，封閉：", "step"),
    (37.42, 39.59, "缺了一角，大腦會自己補上。", "step"),
    (40.34, 42.42, "這個三角形，其實不存在。", "sub"),
    (43.16, 44.38, "第四，連續：", "step"),
    (44.85, 47.51, "線條會順著最平滑的方向走下去。", "step"),
    (48.18, 49.66, "第五，共同命運：", "step"),
    (50.07, 51.92, "一起移動的，就是同一群。", "step"),
    (52.50, 54.78, "第六，簡潔，也叫完形：", "step"),
    (55.24, 57.32, "大腦總是選最簡單的解釋。", "step"),
    (58.45, 60.29, "換個角度，臉就散了。", "sub"),
    (60.99, 64.47, "我們對一個人的印象，也常是幾片碎片拼出來的。", "sub"),
    (65.15, 67.22, "所以，你不是在看世界，", "sub"),
    (67.56, 68.71, "你是在完成它。", "sub"),
    (69.26, 71.43, "你看見的，是大腦完成的。", "tag"),
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
    cues = [{"shot": shot_of(a + OFFSET), "start": round(a + OFFSET, 2), "end": round(b + OFFSET, 2), "text": t, "role": r} for a, b, t, r in CUES]
    data = {"duration": FILM_END, "offset": OFFSET, "shots": [{"shot": s, "start": a, "end": b, "title": n} for s, a, b, n in SHOTS], "cues": cues}
    (HERE / "cues.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    for c in cues: print(f'{c["shot"]}  {c["start"]:6.2f}–{c["end"]:6.2f}  {c["text"]}')
