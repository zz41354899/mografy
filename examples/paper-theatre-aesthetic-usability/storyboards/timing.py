"""Narration timing for 美即好用效應 Aesthetic-Usability Effect.

The ElevenLabs take (69.64 s, Kuo Yu – Taiwan) is laid on the film timeline unchanged, 1.2 s late, so the bulb
pops on before the first word. Phrase times were measured with ffmpeg silencedetect (-35 dB / 0.22 s); each
pause-bounded segment was transcribed with an offline recogniser (sherpa-onnx SenseVoice) to match it to the script,
and its edges trimmed by energy. Film length 74.0 s (the tagline holds about 3.5 s after the last word).

Run:  python3 storyboards/timing.py   → assets/narration-aesthetic-usability.mp3 and storyboards/cues.json
"""
import json, subprocess, pathlib

HERE = pathlib.Path(__file__).parent
SRC = HERE / "narration-source.mp3"
OUT = HERE.parent / "assets" / "narration-aesthetic-usability.mp3"
OFFSET = 1.2
FILM_END = 74.0

# shot, film start, film end, title
SHOTS = [
    ("S01", 0.0, 4.1, "兩台機器"), ("S02", 4.1, 7.0, "只差一張臉"), ("S03", 7.0, 13.4, "同樣的骨架"),
    ("S04", 13.4, 23.5, "1995 年的 ATM"), ("S05", 23.5, 26.6, "命名"), ("S06", 26.6, 32.8, "醜的出錯"),
    ("S07", 32.8, 36.3, "美的出錯"), ("S08", 36.3, 44.3, "心情放寬視野"), ("S09", 44.3, 49.3, "光環"),
    ("S10", 49.3, 56.1, "光環撐不住"), ("S11", 56.1, 61.2, "好看會藏住問題"), ("S12", 61.2, 67.1, "兩層對齊"),
    ("S13", 67.1, 74.0, "片尾"),
]

# phrase cues in source seconds: (start, end, text, role)
# role: "sub" = bottom subtitle, "title" = shown as the gold title card (no subtitle), "tag" = the closing tagline
CUES = [
    (0.09, 1.27, "這兩台機器，", "sub"), (1.52, 2.48, "功能一模一樣。", "sub"),
    (3.05, 4.17, "唯一的差別是：", "sub"), (4.50, 5.35, "一台比較好看。", "sub"),
    (6.10, 7.96, "同樣的按鈕，同樣的步驟，", "sub"), (8.46, 9.77, "可是大多數人會說，", "sub"), (10.08, 11.54, "右邊那台比較好用。", "sub"),
    (12.64, 13.52, "1995 年，", "sub"), (13.76, 18.28, "日立的研究者請 252 個人評比 26 種 ATM 畫面。", "sub"),
    (18.94, 20.38, "結果，看起來越美，", "sub"), (20.69, 21.98, "大家就越覺得好用。", "sub"),
    (22.63, 24.64, "這叫做「美即好用效應」。", "title"),
    (25.86, 27.57, "更有趣的是出錯的時候。", "sub"), (28.25, 31.28, "同一個小錯誤，在醜的介面上讓人火大；", "sub"),
    (31.88, 34.56, "在好看的介面上，人卻比較願意原諒。", "sub"),
    (35.34, 36.04, "諾曼說，", "sub"), (36.37, 38.42, "好看的東西讓人心情變好；", "sub"), (38.92, 42.59, "心情好，就更有耐心，也更願意自己找出解法。", "sub"),
    (43.49, 45.22, "第一眼的好感就像光環，", "sub"), (45.58, 47.22, "會一路影響後面的判斷。", "sub"),
    (48.71, 50.49, "但光環只撐得住小問題。", "sub"), (51.37, 52.20, "真的不好用，", "sub"), (52.56, 54.32, "再好看，人也會離開。", "sub"),
    (55.21, 56.65, "好看還有一個副作用：", "sub"), (57.20, 59.39, "它會讓測試的人，看不見問題。", "sub"),
    (60.37, 62.85, "所以，美不是用來遮住問題，", "sub"), (63.19, 65.42, "而是讓人願意，多給一次機會。", "sub"),
    (66.25, 67.47, "好看讓人留步，", "tag"), (67.93, 69.27, "好用讓人留下。", "tag"),
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
