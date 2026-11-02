"""Narration timing for 林格曼效應 Ringelmann Effect.

The ElevenLabs take (70.61 s, Kuo Yu – Taiwan) is laid on the film timeline unchanged, 1.2 s late, so the bulb
pops on before the first word. Phrase times were measured with ffmpeg silencedetect (-35 dB / 0.22 s); each
pause-bounded segment was transcribed with an offline recogniser (sherpa-onnx SenseVoice) to match it to the script,
and its edges trimmed by energy. Film length 75.0 s (the tagline holds about 3.6 s after the last word).

Run:  python3 storyboards/timing.py   → assets/narration-ringelmann.mp3 and storyboards/cues.json
"""
import json, subprocess, pathlib

HERE = pathlib.Path(__file__).parent
SRC = HERE / "narration-source.mp3"
OUT = HERE.parent / "assets" / "narration-ringelmann.mp3"
OFFSET = 1.2
FILM_END = 75.0

# shot, film start, film end, title
SHOTS = [
    ("S01", 0.0, 5.0, "一條繩子"), ("S02", 5.0, 12.6, "一個人"), ("S03", 12.6, 17.4, "兩個、三個"),
    ("S04", 17.4, 21.6, "八個人"), ("S05", 21.6, 27.6, "命名"), ("S06", 27.6, 31.6, "拉不齊？"),
    ("S07", 31.6, 40.8, "蒙眼實驗"), ("S08", 40.8, 49.6, "大喊"), ("S09", 49.6, 55.3, "一個數字"),
    ("S10", 55.3, 65.0, "四股繩"), ("S11", 65.0, 67.1, "看得見"), ("S12", 67.1, 75.0, "片尾"),
]

# phrase cues in source seconds: (start, end, text, role)
# role: "sub" = bottom subtitle, "title" = shown as the gold title card (no subtitle), "tag" = the closing tagline
CUES = [
    (0.14, 2.52, "一個人拉繩子，能出多少力？", "sub"),
    (3.98, 6.89, "一百多年前，法國農業工程師林格曼，", "sub"), (7.19, 8.86, "量過人拉繩子的力氣。", "sub"),
    (9.60, 11.10, "一個人出一百分的力。", "sub"),
    (11.72, 13.99, "兩個人一起，每人只剩 93；", "sub"), (14.44, 15.75, "三個人，85。", "sub"),
    (16.32, 17.13, "到了八個人，", "sub"), (17.37, 19.17, "每個人平均只出了 49，", "sub"), (19.45, 20.00, "不到一半。", "sub"),
    (20.76, 22.97, "人越多，每個人出的力越少。", "sub"), (23.54, 25.33, "這就叫「林格曼效應」。", "title"),
    (26.97, 29.89, "林格曼猜，是大家用力的時間對不上。", "sub"),
    (30.75, 33.70, "但 1974 年的實驗讓人蒙眼拉繩，", "sub"), (34.08, 35.88, "後面的人只是假裝在拉。", "sub"),
    (36.33, 37.41, "不用配合任何人，", "sub"), (37.68, 38.90, "他還是少出了力。", "sub"),
    (39.91, 42.93, "1979 年，研究者讓人戴上耳機大喊。", "sub"), (43.57, 46.10, "只要以為有人一起喊，聲音就變小。", "sub"),
    (46.56, 47.89, "這叫「社會懈怠」。", "sub"),
    (48.72, 51.40, "人一多，沒人看得出你出了多少力；", "sub"), (51.88, 53.63, "你也覺得，少你一個沒差。", "sub"),
    (54.56, 58.07, "1993 年，一份整理 78 篇研究的分析發現：", "sub"),
    (58.61, 60.28, "當每個人的貢獻看得見、", "sub"), (60.60, 61.54, "任務有意義、", "sub"), (61.80, 62.66, "團隊小一點、", "sub"),
    (62.96, 63.71, "彼此在乎，", "sub"), (64.02, 65.45, "偷懶就會少很多。", "sub"),
    (66.12, 67.80, "人多，不一定力量大；", "tag"), (68.23, 68.78, "看得見，", "tag"), (69.09, 70.19, "大家才會用力。", "tag"),
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
