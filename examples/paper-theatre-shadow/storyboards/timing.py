"""Narration timing for 陰影心理學 Shadow Psychology.

The ElevenLabs take (76.04 s, Kuo Yu – Taiwan) is laid on the film timeline unchanged, 1.0 s late, so the bulb
pops on just before the first word. Phrase times were measured with ffmpeg silencedetect (-35 dB / 0.25 s) and
matched to the script by order and character count. Film length 82.0 s (the title holds after the last word).

Run:  python3 storyboards/timing.py   → assets/narration.mp3 and storyboards/cues.json
"""
import json, subprocess, pathlib

HERE = pathlib.Path(__file__).parent
SRC = HERE / "narration-source.mp3"
OUT = HERE.parent / "assets" / "narration.mp3"
OFFSET = 1.0
FILM_END = 82.0

# shot, film start, film end, title
SHOTS = [
    ("S01", 0.0, 7.6, "點燈"), ("S02", 7.6, 15.4, "定義"), ("S03", 15.4, 24.4, "形成"),
    ("S04", 24.4, 30.8, "人格面具"), ("S05", 30.8, 37.3, "投射"), ("S06", 37.3, 43.0, "線索"),
    ("S07", 43.0, 48.3, "轉身"), ("S08", 48.3, 53.2, "覺察"), ("S09", 53.2, 58.1, "接納"),
    ("S10", 58.1, 62.7, "整合"), ("S11", 62.7, 69.0, "金色陰影"), ("S12", 69.0, 74.6, "完整"),
    ("S13", 74.6, 82.0, "片尾"),
]

# phrase cues in source seconds: (start, end, text, role)
# role: "sub" = bottom subtitle, "step" = shown as the step's big title/descriptor, "tag" = the closing tagline
CUES = [
    (0.00, 2.17, "燈亮的地方，就有影子。", "sub"),
    (3.04, 6.20, "榮格說：每個人，都帶著一道陰影。", "sub"),
    (6.92, 9.52, "陰影，是你不願承認的那部分自己——", "sub"),
    (10.18, 13.85, "憤怒、嫉妒、脆弱，和說不出口的渴望。", "sub"),
    (14.93, 15.89, "它不是天生的。", "sub"),
    (16.66, 19.60, "小時候，每一句「不准哭」、「不要生氣」，", "sub"),
    (20.12, 22.36, "都把一部分的我們，推到了身後。", "sub"),
    (24.08, 26.55, "長大以後，我們學會戴上面具，", "sub"),
    (26.85, 29.33, "只把討人喜歡的那一面，留給別人看。", "sub"),
    (30.12, 32.31, "但被藏起來的，並不會消失。", "sub"),
    (33.41, 35.89, "它會投射出去——落在別人身上。", "sub"),
    (36.65, 38.28, "當某個人特別讓你火大，", "sub"),
    (38.69, 41.00, "那份刺痛，常常指向你自己。", "sub"),
    (42.52, 44.53, "要停止投射，只有一個方法：", "sub"),
    (45.13, 46.75, "轉過身……看見它。", "sub"),
    (47.68, 49.04, "第一步，覺察。", "step"),
    (49.66, 51.77, "留意那些讓你反應過度的時刻。", "step"),
    (52.60, 53.84, "第二步，接納。", "step"),
    (54.38, 56.59, "叫出它的名字，不急著趕走它。", "step"),
    (57.40, 58.78, "第三步，整合。", "step"),
    (59.31, 61.33, "把它的力量，收回成自己的。", "step"),
    (62.06, 63.66, "陰影裡，不只有黑暗。", "sub"),
    (64.15, 67.65, "憤怒裡有力量，嫉妒，指向你真正想要的。", "sub"),
    (68.36, 70.24, "目標從來不是消滅影子，", "sub"),
    (70.65, 73.11, "而是讓光和影，屬於同一個人。", "sub"),
    (73.97, 75.69, "與你的影子，和解。", "tag"),
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
