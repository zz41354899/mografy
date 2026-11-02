# 來自月亮的偶像 — 3D × 2D paper puppet theatre (storyboard v2)

A 3D re-staging of the 60 s story film (`paper-theatre-moon-rabbit-story`): the paper toy theatre becomes a real lit 3D model (Three.js), the puppet stays a flat printed card, and emotional beats cut to flat 2D illustration inserts. Reference for visual language: YOASOBI 「群青」 MV (dir. 牧野惇) — ultramarine night, paper cut-outs photographed in real space with real light and shallow focus, stage drapes and hanging gold stars, tiny figures in big sets cut against full-frame face close-ups. Language only; no shots copied.

- **Format:** 16:9, 1920 × 1080, 30 fps, 60 s, 13 shots. Puppet, props and 2D inserts on 2s (12 poses/s); camera and light smooth.
- **Music:** reuse the story film score `assets/music.mp3` (120 BPM, bar 2 s); every cut lands on its bar grid (8, 16, 24, 32, 40, 46, 54, 60 s kept).
- **3D:** theatre, drapes (ultramarine velvet), seats, paper town (3 layers), washi screen + lamp, kamishibai box, room/desk for the final pull-out. Fake depth of field by layered render + blur.
- **2D:** S04 eyes, S06 cloud sea, S08 deep breath, S11 idol poster, the chapter cards inside S12. Story cards are always a 2D hanging-card overlay.
- **Assets (v2 adds kirameki-catch/public/images):** Momo poses as replacement puppet cards (mooncake, practice-sad, moonlight, hero-happy, arrival, lantern-dance, rhythm), star-map / night-sky / stage-v2 painted backdrops, the neon rabbit mark, lantern-garden bokeh, paper texture. Original assets: character.webp (puppet front = idol, back = lavender duotone moon rabbit), portrait-turnaround.png (2D close-ups, chapter cards), end-stage.png (backdrop from 40 s).

## Shots

| Shot | Time (s) | Layer | Story card | Action | Stop-motion | Camera | Handoff | Audio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 開場・跑馬燈 | 0–4.5 | 3D | — | 全暗，只看得見台頂的「LUNAR POP CLUB」招牌：26 顆跑馬燈泡一顆顆亮起。鏡頭往後拉、往上仰，露出歌劇院：四層包廂、彩繪圓頂、水晶吊燈；接著往下回到舞台，觀眾席燈光暗下、2.6 s 群青幕布拉開。 | 燈泡、星星、幕布逐格（每秒 12 張）；鏡頭與燈光順滑 | Pull back + tilt up → tilt down：招牌特寫 → 圓頂吊燈 → 舞台全景，再 dolly in 推向舞台口。 | 推到舞台口時接 S02 | 音樂盒；燈泡每顆一聲「叮」、幕布拉開 |
| S02 月上的兔子 | 4.5–8 | 3D | 很久很久以前，／月亮上住著一隻兔子。 | 紙月亮用兩條線從上方垂降，停穩後微晃。月亮頂端，薰衣草色的小兔子紙偶捧著月餅，旁邊的木杵每拍搗一下。前景一顆金星星失焦掠過，字卡掛在右側。 | 木杵每拍 3 格；月亮落定 0.55 → 1.18 → 1 | Rack focus 拉焦：85 mm 淺景深：焦點從前景金星星拉到月亮上的兔子（0.6 s）。 | 7.6 s 月亮被吊高出畫，城鎮從台板下升起 | 音樂盒；每次搗麻糬一聲輕「咚」 |
| S03 地上的紙城鎮 | 8–12 | 3D | — | 紙城鎮分前、中、後三層從台板下升起：深藍大樓、塔、圓形月門，後面是彩繪的夜空遠山和一排紙雲地排。窗戶是真的小光源，一盞一盞亮成暖黃。月亮掛在城鎮後面，兔子坐在月亮下緣往下看。 | 城鎮分 6 步升起；窗戶每格亮一盞 | Crane down 升降俯衝：從月亮高度降到街道高度，穿過三層紙景片，看出前後層次（視差）。 | 鏡頭停在一扇亮著的窗前，直接切到她的眼睛（S04） | 撥弦；每亮一窗一聲叮 |
| S04 她的眼睛 | 12–16 | 2D | 每一盞燈下，／都有睡不著的人。 | 平面插畫特寫：她的側臉（薰衣草雙色印刷），往下看。眼睛裡映著城鎮的小燈，畫面下緣一排窗光的散景。像《群青》那種貼滿畫面的大臉特寫。 | 眨眼 3 格；窗光散景逐格閃 | 平面特寫・緩推：2D 插畫層，鏡頭 1.00 → 1.06 慢推向眼睛。 | 15.6 s 她閉眼，畫面被紙屏從左滑入蓋過 | 撥弦變慢；一聲長音 |
| S05 紙屏與拉門 | 16–20 | 3D | — | 月藍色的紙屏亮起：她撐紙傘的影子沿著月光斜斜飄下。鏡頭慢慢推近紙屏，19.05 s 紙屏從中間裂成兩扇障子拉門往左右滑開，門縫透出光，門後就是 S06 的平面雲海。 | 影子下降 on 2s；紙傘左右晃 ±4°；拉門兩格加速滑開 | Push in：紙屏填滿畫面 → 拉門滑開（19.05–20 s），不再繞到幕後。 | 拉門打開直接露出 S06 雲海（同一張畫） | 弦樂漸強；拉門「唰」兩聲 + 豎琴滑奏 |
| S06 穿過雲海 | 20–24 | 2D | 於是她決定，／親自去陪他們。 | 平面剪紙層：群青色夜空、米白紙雲、浮世繪捲浪。她撐著紙傘從右上飄到左下，雲層分前中後三層反向滑動。23.5 s 落地。 | 雲層逐格錯開；她 on 2s 下降 | 平面視差 Truck：2D 多層視差：前景雲快、後景慢，鏡頭跟著她往左下。 | 23.5 s 落地瞬間切回 3D 舞台（S07） | 弦樂、豎琴下行；輕輕落地 |
| S07 空蕩的舞台 | 24–28.6 | 3D | 第一次站上舞台，／台下，空無一人。 | 全暗。一道看得見光束的聚光燈打在小小的她身上，光束裡飄著灰塵。紙偶換成緊張的那張卡（雙手握在胸前，薰衣草色），背後一道紫色逆光勾出輪廓。鏡頭壓低，從一排排空座位後面看。 | 發抖 = boil × 3；座位完全不動 | 低角度・極慢推：座位後方 0.6 m 高，前景椅背失焦；1.00 → 1.04。 | 28.6 s 燈閃一下，閃白切到 S08 | 很空，只有一個長音 |
| S08 深呼吸 | 28.6–32 | 2D | — | 平面特寫：雙手握在胸前的她，在聚光燈圈裡，四周全黑。燈閃一下之後，她穩住呼吸，抬頭。畫面只留一圈光。 | 呼吸起伏 2 格一次；燈閃 2 格 | 平面特寫・靜止：2D 插畫層，完全不動，只有光圈慢慢變亮。 | 32 s 第一個音落下，切回 3D | 稀疏的鋼琴（C 小調），最後吸一口氣 |
| S09 第一首歌 | 32–40 | 3D | 她還是開口唱了。／一盞、兩盞…… | 紙偶換成抱著發光小兔的那張，她開口唱，紙音符綁在線上往上飄。座位上的觀眾剪影每拍冒出一位，舉起會發光的應援棒（粉、黃、薰衣草，都是真的點光源）。鏡頭繞到側面時，她變成一條細細的紙邊。 | 觀眾 0.3 → 0.8 → 1.15 → 1；音符一步一步升 | Orbit 繞她到側面：從她正面三分之四繞到側面（約 100°）並升高，最後看向坐滿的台下。 | 39.5 s 應援棒全部舉起，舞台開始變亮 | 漸強；拍手在 2、4 拍，每位觀眾一聲 |
| S10 翻面・月亮偶像 | 40–43 | 3D | — | 40 s 重拍：紙偶在 3D 裡真的轉 180°，從薰衣草背面翻到彩色正面（眨眼比耶的那張）。腳燈由下往上爆亮，彩繪月亮佈景從上方降下，花瓣落下。 | 翻面 背 → 側 → 正 共 3 格 | 仰角 Crane up：鏡頭從腳燈高度往上升，仰看她，0.8 s 停。 | 42.8 s 花瓣蓋滿畫面，切到 S11 海報 | 副歌下來 |
| S11 月亮偶像海報 | 43–46 | 2D | 月亮偶像 | 平面海報：提著燈籠跳舞的她、直書大字「月亮偶像」、金色星星，背景是失焦的紅色燈籠舞台，前景應援棒散景。 | 星星 2 格閃一次；字蓋章感彈入 | 平面・快推：1.00 → 1.08，最後 0.3 s 停在字上。 | 45.8 s 海報像紙芝居卡一樣被往左抽走 | 副歌；抽卡「唰」 |
| S12 她的每一夜 | 46–54 | 3D＋2D | 登場／魅力／節拍 | 舞台中央的木頭紙芝居箱（3D），鏡頭推進箱框，直到裡面的平面卡片（2D）填滿畫面。三張章節卡：01 登場（揮手）、02 魅力（捧月餅）、03 節拍（跳起來唱），每張被往左抽走換下一張；箱子後面換成紅色燈籠舞台佈景。 | 卡片抽出 4 格；卡上道具逐格彈出 | Push in 推進畫框：3D 推進到箱框完全出畫，畫面變成純 2D 卡片；48.8、51.5 s 抽卡。 | 53.6 s 鏡頭從箱框退出，幕布快速闔上再拉開 | 副歌；每次抽卡「唰」 |
| S13 謝幕 | 54–60 | 3D | 今晚，陪伴著你。 | 幕布在 54.1 s 重新拉開，她換成揮手的那張卡鞠躬，跑馬燈泡追逐閃爍，57.9 s 紙彩帶落下。鏡頭往後拉到觀眾席後方（不出歌劇院），兩側包廂和吊燈都在畫面裡。58.3 s 幕布闔上，觀眾席燈亮起，淡出。不放片名。 | 鞠躬 8° 共 2 格；燈泡追逐每格跳一顆；彩帶逐格 | Pull back：舞台口 → 觀眾席後方廣角，停在闔上的幕布。 | 結束在闔上的幕布 | 終止和弦在 58 s；彩帶閃音；音樂盒琶音 |

## Files

- `storyboards/storyboard.html` (self-contained) and `storyboard-3d-v2-page-1..3.png`.
- (not included in this reference copy) `storyboards/board-src/`: `world.js` (3D + 2D frame renderer), `shots.js` (shot data), `render.mjs` (key frames via headless Chromium), `board.mjs` (board + this file). Needs `three.module.js` next to `frames.html` (copy from `projects/shadow-psychology/assets`), the Lunar Pop Club assets, and the kirameki-catch images in `k/`.

## Open questions

- Keep S09 turning her edge-on (the flat card showing its thinness)?
- S12: three chapter cards, or one card and more time for the pull-out curtain call?

## Build notes (v2 → scene)

- Built as `scenes/main.ts` (beat table, camera keys, poses per shot, handoffs, story cards), `scenes/world3d.ts` (the 3D theatre) and `scenes/paper.ts` (2D layer: textures, puppet cards, inserts). `scenes/three.ts` is the Mografy three extra.
- Changes from the board while building: S05 opens with the washi screen filling the frame (so the 2D wipe lands on it), pushes in, and the screen splits into two shoji doors that slide open onto S06 (the walk behind the screen was cut at the user's request); S08 irises open into S09; S12's 3D card fills the frame exactly at 48.0 and the 2D cards take over until 53.3; the curtain call starts with the drapes reopening at 54.05.
- Music: `music-src/compose.py` (new arrangement, key lift at 46 s), timeline `storyboards/music-timeline.png`.

- Polish pass (user notes 「破綻太多」, 「開場更精緻、結尾更完美」, 「2D 補質感」, 「不像 AI 做的」): marquee bulbs as real 3D emissive meshes with a chase; neon flicker; pull-back opening; shoji doors replace the behind-screen walk; confetti, drapes closing and a vertical end title at 58.75; 2D FX layer (foreground sakura branches, dust motes, glints, god rays in S10, light leaks, film specks, grain, soft-light grade, vignette, halation); micro camera shake; the 40 s flip ramps its lights in instead of blowing out; moon-free star map, cropped sad duo, rounded clouds.
- Richness pass (user note 「更美、劇場更豐富、更有質感、橋段更好」): the room became the maker's desk (cutting mat and offcuts, design and storyboard sheets, desk lamp, books and tea, tape, scissors, fairy lights, pinned poster); velvet swags with tassels over the opening; opera boxes either side of the house that light up as the fans arrive; aisle step lights; a hand-painted paper moon with the moon rabbit in it; S03 gains a toy train crossing an arched viaduct between the town layers (with chugs and a toy whistle in the score); the washi screen shows kozo fibres, a soft-edged shadow and a wooden kumiko lattice; the S12 cards are framed by the kamishibai box; the S09 orbit no longer brushes the drape.
- Opera-house pass (user notes: 「舞台像歌劇院」「攝影機不要破綻」「結尾關起來閉幕就好，不用文字」「照到觀眾那邊不要有背景」「兔子改成網頁讀取機器兔子」): the desk and room are gone; the stage now sits in an enclosed opera house (proscenium wall with lunette, four tiers of boxes on three walls, painted dome, chandelier, carpet, pit rail), so the audience shots show boxes instead of the room; every camera stays inside the hall; the ending is only the drapes closing (end title removed); the crown's neon rabbit is now the robot rabbit head from the site's loading screen (24-frame turnaround); the S10/S12 backdrops were upside down (ImageBitmap textures ignore flipY) and are fixed.
- The robot rabbit head was tried on the crown and removed at the user's request (「刪掉好了不搭」); the crown has no sign now.
- S03 town redrawn as a city at the user's request (「房子要像都市一樣」): three skyline layers (towers, a radio tower, offices with billboards, streets with shop fronts), dense instanced windows, an elevated railway between the near and middle layers; the robot head is removed.
- S03 floor fixed with a continuous street row in front of the city (low wall, trees, street lamps); S04 redrawn over the night city: a hazy skyline behind her with the train continuing along an elevated line, dark blocks in front whose windows come on as she watches (the light band above the old town strip was grain on transparent pixels, now masked); the score gains a real train pass in S03 (steam chuffs, rail clacks, a two-tone whistle, right → left) fading into the distance under S04.
- S04 → S05 handoff rebuilt (「關門後銜接怪怪的」): instead of a flat washi panel wiping in from the left, two shoji doors slide shut from both sides, each carrying its half of the real 3D screen of 16.0, so they meet on S05's first frame; it mirrors the doors opening at 19.
