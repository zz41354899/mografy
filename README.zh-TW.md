<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/mografy-logo-inverse.svg">
    <img src="docs/brand/mografy-logo.svg" alt="Mografy" width="460">
  </picture>
</p>

# Mografy

[English](README.md) | [繁體中文](README.zh-TW.md)

Mografy 是為 Claude Code 與 Codex 設計的本機 Canvas 動畫工具。共用的 `mografy` Skill 協助程式代理規劃分鏡、改寫現有範例、編寫場景、審閱影格並匯出成品。瀏覽器播放器提供播放、時間軸拖曳、字幕、顏色、效果及音訊控制。

在程式代理中描述想製作的動畫，再透過 `mografy dev` 觀看結果。代理編輯場景檔案後，Mografy 會先編譯並在 Chromium 中試算圖，成功後才更新播放器，並保留原本的播放位置。

[![觀看 12 秒 Mografy 介紹影片](https://github.com/zz41354899/mografy/blob/main/docs/media/mografy-intro.gif)](https://github.com/zz41354899/mografy/raw/refs/heads/main/docs/media/mografy-intro.mp4)

[觀看含音訊的介紹影片（MP4）](https://github.com/zz41354899/mografy/raw/refs/heads/main/docs/media/mografy-intro.mp4)。

## 最新更新

**2026-10-20** — 新增專案風格檔（`scenes/style.ts` 與 `style.md`），可固定專案的設計與動態決定；修改不會再被卡住的場景或冗長的審閱擋住。

**2026-10-18** — 新增使用 VP9／Opus 與固定品質（CRF）的 WebM 匯出，以及可取得原始碼更新、重新建置並重啟目前播放器的 `mografy update` 指令。詳見[更新紀錄](CHANGELOG.md)。

## 開始使用

需要 [Node.js](https://nodejs.org/) 22.12 或更新版本。接著執行：

```sh
git clone https://github.com/zz41354899/mografy.git
cd mografy
npm install -g pnpm
pnpm install
mografy dev
```

`pnpm install` 會安裝相依套件，並自動建置 Mografy、下載檢查與匯出所需的 Chromium，再將 `mografy` 指令加入 PATH。`mografy dev` 會開啟播放器，顯示 16 種內建動畫。若能看到這些動畫，就代表安裝成功。

執行 `mografy update --check` 可檢查是否有更新。若要安裝目前分支所追蹤上游的最新提交，請在 Mografy 資料夾中執行 `mografy update`。指令會檢查本機修改、等待進行中的匯出完成、停止目前播放器、以快轉方式更新原始碼、執行 `pnpm install`（包含建置、Chromium 設定與啟動器更新）、同步共用 Skill，最後以相同連接埠重啟原本的專案。重啟後請重新整理瀏覽器。若沒有正在執行的播放器，則只更新安裝內容，不會開啟專案。

若安裝的版本尚未提供更新指令，請先按 Ctrl+C 停止播放器，再於原本的 Mografy 工作副本中執行一次：

```sh
git pull --ff-only
pnpm install
mografy dev
```

`--check` 會取得 Git 中繼資料，但不會修改工作檔案、安裝相依套件或重啟播放器。若有本機修改（包含尚未追蹤的檔案）、缺少上游分支、處於 detached HEAD 狀態，或提交歷史已分歧，更新會停止。被 Git 忽略的使用者專案會保留。若原始碼更新後的相依套件設定失敗，播放器會維持停止，錯誤訊息會列出復原指令。不同工作副本會各自更新；若在工作副本以外執行，PATH 啟動器會選用安裝它的那份副本。

`npm install -g pnpm` 用來安裝 pnpm 套件管理工具；若已安裝 pnpm，可略過此步驟。pnpm 會自行切換成 Mografy 在 `package.json` 指定的版本。若 npm 回報權限錯誤，請執行 `sudo npm install -g pnpm`。修改 Mografy 本身的貢獻者還需執行 `pnpm sync:skills`、`pnpm check` 與 `pnpm test:browser`；詳見[開發與架構](#開發與架構)。

### 其他安裝與設定選項

建立動畫，或開啟隨附的介紹影片：

```sh
mografy dev ./projects/my-animation --yes
mografy dev ./examples/mografy-intro
```

新專案會建立在 `projects/` 資料夾。若要放在其他位置，請在執行 `mografy dev` 前設定 `MOGRAFY_HOME`：

```sh
export MOGRAFY_HOME="$HOME/Animations"
```

預設專案、FFmpeg 路徑等其他設定，請參閱[設定指南](docs/configuration.md)。

## 製作第一個動畫

1. 執行 `mografy dev ./projects/my-animation --yes`，建立專案並開啟播放器。
2. 在 Codex 或 Claude Code 中開啟儲存庫，描述想製作的動畫，並指定專案資料夾。共用 Skill 會引導場景編寫與審閱。
3. 每次編譯與 Chromium 試算圖成功後，播放器都會更新。拖曳時間軸檢查節奏，並調整場景提供的控制項。
4. 執行 `mografy check ./projects/my-animation` 與 `mografy review ./projects/my-animation`，檢查產生的圖片。確認完成後，即可從播放器或 CLI 匯出。

例如，將以下英文提示詞交給代理：

> Create an eight-second 9:16 animation in `projects/my-animation`, with a native 1080 × 1920 canvas. Use the Typewriter and Logo reveal components as references. Show “Hello, Mografy.”, then reveal the logo with a teal accent. Review the actual frames and export an MP4.

較長的影片可先請代理規劃分鏡。畫面構圖由場景程式碼決定；播放器則顯示該場景宣告的可調參數。

## Codex 與 Claude 共用一個 Skill

依維護者目前的使用經驗，Claude 的工作流程校調較完整；Codex 可依需求與實際算圖結果自行調整做法，並遵守共用的場景規範。

Skill 位於動畫子專案以外的 [`.agents/skills/mografy/SKILL.md`](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/SKILL.md)。Claude 的 `.claude/skills/mografy` 入口連結到同一個資料夾，[CLAUDE.md](https://github.com/zz41354899/mografy/blob/main/CLAUDE.md) 也會匯入它。兩種代理環境讀取同一份維護中的內容。

英文參考文件涵蓋：

| 參考文件 | 用途 |
| --- | --- |
| [專案開發](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/project.md) | 儲存庫來源、架構與開發檢查 |
| [場景編寫](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/scene-authoring.md) | 場景規範、繪圖 API、驗證、審閱與匯出 |
| [內建元件](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/built-in-components.md) | 全部 16 種可運作的元件場景及改寫方式 |
| [介紹影片](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/intro.md) | 現有 12 秒影片的原始碼、素材、時間安排與審閱時間點 |
| [分鏡](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/storyboard.md) | 鏡頭規劃及各代理環境的視覺分鏡 |
| [動畫原則](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/animation-principles.md) | 將 12 項動畫原則應用於確定性的 Canvas 動態 |
| [鏡頭與轉場](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/camera-transitions.md) | `cinema.ts` 鏡頭運動、櫻花粒子擦拭等轉場與氣氛效果 |
| [中日韓文字排版](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/cjk-typography.md) | 日文／中文直排、CJK 換行與隨附的 OFL 字型 |
| [影片壓縮](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/video-compression.md) | 縮小已匯出 MP4 的 Python 工具、品質控制與上傳大小限制 |

[packages/core/src/guide.ts](https://github.com/zz41354899/mografy/blob/main/packages/core/src/guide.ts) 是產生 Skill 入口與參考文件的單一來源。修改後請執行 `pnpm build` 與 `pnpm sync:skills`。動畫專案會取得 `AGENTS.md` 與 `CLAUDE.md`，指向共用 Skill。

## 可運作的範例

16 種內建動畫既是可播放範例，也是場景編寫的參考：

- **文字與數字：**逐字進場（Stagger text）、打字機（Typewriter）、下三分之一字幕（Lower third）、數字遞增（Count up）。
- **品牌與版面：**彈出卡片（Pop card）、標誌揭幕（Logo reveal）、社群卡片（Social card）、追蹤徽章（Follow badge）。
- **互動：**YouTube 訂閱（YouTube subscribe）、AI 聊天（AI chat）、按讚爆發（Like burst）、通知提示（Notification toast）、切換開關（Toggle switch）。
- **指示器：**進度條（Progress bar）、脈動圓點（Pulse dots）、音訊波形（Audio wave）。

可重用函式位於 [components.ts](https://github.com/zz41354899/mografy/blob/main/packages/server/template/scenes/components.ts) 與 [social-components.ts](https://github.com/zz41354899/mografy/blob/main/packages/server/template/scenes/social-components.ts)。每個範例都有自己的場景入口、控制項、預覽與匯出。原始碼副本位於 `packages/server/template/scenes/`；安裝後可編輯的專案位於專案庫的 `.components/{id}/` 目錄。新專案會包含可重用模組與場景入口。

全部 16 個內建元件專案預設使用置中的 **9:16 直式**預覽。隨附縮圖也會顯示完整直式畫布，因此全新安裝後，不必逐一開啟專案，就能看到全部 16 張預覽。修改場景後，已開啟專案的縮圖會自動更新。維護者修改內建場景原始碼或素材後，需執行 `pnpm thumbnails:generate` 重新產生隨附預覽。

選用的 [extras](https://github.com/zz41354899/mografy/tree/main/extras) 不會隨安裝加入；安裝內容只包含 16 種內建元件。代理會依創作需求將額外工具複製到專案：[cinema.ts](https://github.com/zz41354899/mografy/blob/main/extras/cinema/cinema.ts) 提供靜態圖片上的鏡頭運動、轉場（交叉淡化、淡入指定顏色、閃白、圓形遮罩、斜切、甩鏡、櫻花風格粒子擦拭）與氣氛效果；[cjk.ts](https://github.com/zz41354899/mografy/blob/main/extras/cjk/cjk.ts) 搭配 OFL 授權的 Noto Sans／Serif CJK TC 子集字型，處理日文／中文直排及 CJK 換行。詳見[鏡頭與轉場](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/camera-transitions.md)及[中日韓文字排版](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/cjk-typography.md)參考文件。

[元件參考文件](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/built-in-components.md)連結到各個場景入口，並說明版面、時間安排、本機匯入與審閱方式。請代理依專案自己的素材與風格改寫適合的元件。

[Mografy 介紹影片](https://github.com/zz41354899/mografy/blob/main/examples/mografy-intro/scenes/main.ts)是 1920 × 1080、12 秒、30 fps 的範例：先用程式碼帶出概念，接著播放並拖曳預覽，從外部編輯更新畫面，最後以原始標誌完成影片。它的[參考文件](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/intro.md)記錄了四個段落、字型、音樂、字幕與轉場取樣。

## 分鏡與動態設計

例如：

> Create an English storyboard for a twelve-second product intro. Use the Mografy intro as a sequence reference and adapt the logo reveal and lower third components to this project's assets.

代理會建立 `storyboards/storyboard.md`，記錄各鏡頭的時間範圍、目的、構圖、素材、關鍵姿勢、鏡頭運動、文案／音訊、轉場、動畫原則與審閱時間點。

Codex 會呼叫圖片生成工具製作視覺分鏡。Claude 在可使用 Artifacts 時會透過 Artifacts 製作，否則儲存為獨立的 `storyboards/storyboard.html` 預覽。規劃與提示詞使用英文。若也要求實作，代理會繼續編寫場景模組，並驗證實際影格。

動畫參考文件涵蓋擠壓與伸展、預備動作、演出佈局、連續動作與關鍵姿勢、跟隨與重疊動作、緩入與緩出、弧線、次要動作、時間節奏、誇張、立體繪製與吸引力。請選用能支撐各鏡頭與閱讀停留時間的原則。

### 專案風格

專案可以把自己的設計與動態決定固定下來，讓每個鏡頭和之後的對話都遵守：

- `scenes/style.ts` 用程式碼保存數值：色票、字型與字級、緩動曲線、時長與錯開間隔、節拍、邊界。場景直接 import，修改一次就套用到全部鏡頭，check 與 review 也能驗證。
- `style.md`（專案根目錄）保存判斷：要做與不要做的規則、動態個性、構圖習慣與參考畫面。

當某個決定要長期沿用時（例如「以後都用這個青綠色」、「標題一律從下方進場並帶一點 overshoot」），告訴代理，它會記錄在這兩個檔案中。專案風格優先於 Skill 的預設設計建議，但不會凌駕場景規範，而你當下的要求仍然最優先。要在其他專案沿用同一種風格，複製這兩個檔案即可。

## 場景模型

場景依據絕對 `time`、解析後的參數與已準備好的素材繪製完整畫面。`mografy.json` 儲存專案設定；動畫程式碼則放在場景模組中。

```ts
import { ease, lerp, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';

export const meta = { width: 1920, height: 1080, duration: 4, fps: 30, background: '#17191d' };
export const params = {
  accent: { name: 'Accent', type: 'color' as const, default: '#12b5a5' },
};

export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  const mografy = ctx.draw;
  mografy.fill(String(params.accent));
  mografy.circle(ctx.width / 2, ctx.height / 2, lerp(20, 160, ease.outCubic(pr(time, 0, 0.8))));
}
```

一般繪圖使用 `ctx.draw`，原生 Canvas 操作使用 `ctx.canvas`，需要隔離繪圖狀態的區段則使用 `ctx.withCanvas` 或 `ctx.clip`。場景只在瀏覽器中執行，無論以何種順序跳轉時間，都必須得到確定的算圖結果。播放器與匯出共用相同的 Runtime 及後製處理。完整規範請參閱[場景編寫參考文件](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/scene-authoring.md)。

修改場景後執行：

```sh
mografy check ./projects/my-animation
mografy review ./projects/my-animation
```

`check` 會編譯並在真正的 Chromium 中試算圖。若該專案的播放器正在執行，`check` 會請播放器直接從磁碟重建，終端機與播放器顯示的結果會一致。`review` 會在 `renders/` 產生原始靜態影格、輸出影格與轉場檢視圖。請檢查這些圖片是否有裁切、重疊、辨識不清、視覺層級不當、安全邊界不足、閱讀時間不足或轉場不連續等問題。只有在指定 `--video file.mp4`，或播放器最近一次完成的 MP4／WebM 匯出就是目前版本時，review 才會與影片比較；`renders/` 中較舊的匯出檔會被略過。

場景的 setup 必須在 30 秒內完成、試算圖必須在 20 秒內完成；匯出、靜態影格與審閱的每一格上限為 120 秒。超過上限的場景（例如 `setup` 裡永遠不會完成的 `await`，或 `renderFrame` 裡停不下來的迴圈）會以場景錯誤回報，播放器繼續播放上一個可用版本，後續的修改不會被卡住。

## 播放器與匯出

Scene 檢查器分為 Subtitles（字幕）、Colors（顏色）與 Controls（控制項）。只有標記 `role: 'subtitle'` 的字串會顯示為可編輯字幕；其他文案由代理修改原始碼。Effects 檢查器提供 Glow（光暈）與 Grain（顆粒）的百分比輸入、重設，以及 Original／With effects（原始／套用效果）比較。音訊支援音軌、音量與節拍網格設定。

主預覽依場景編寫的尺寸顯示，不提供方向切換。若要製作新的 **9:16 直式**影片，請要求代理建立原生 1080 × 1920 場景，安排直式版面、文字換行與社群介面安全邊界。共用 Skill 已記錄這項要求。代理與 Runtime 也會讀取選用的已儲存 `aspectRatio` 設定。Portrait Guides 會為社群覆蓋介面預留保守的安全空間。

播放操作支援空白鍵、方向鍵逐格移動、有音訊時以 Shift＋方向鍵逐拍移動，以及 Loop（循環，`L`）、Guides（輔助線，`G`）、Projects（專案，`P`）。

從播放器或 CLI 匯出：

```sh
mografy export ./projects/my-animation --format mp4
mografy export ./projects/my-animation --format webm
mografy export ./projects/my-animation --format mp4 --orientation portrait --resolution 1080p
mografy export ./projects/my-animation --format lottie -o preview.lottie.json
mografy export ./projects/my-animation --format svga -o preview.svga
```

MP4 使用 H.264 視訊與 AAC 音訊。WebM 使用 VP9 視訊與 128 kbps 的 Opus 音訊，預設採用 CRF 32 固定品質，而非 MP4 的目標位元率。兩者都支援音訊、動態取樣、光暈、顆粒與編碼控制。完成的檔案會寫入 `renders/`。

WebM 品質預設：

| 品質 | VP9 CRF | 動態取樣數 | 編碼速度 |
| --- | --- | --- | --- |
| Draft（草稿） | 38 | 1 | 非常快 |
| Standard（標準） | 32 | 4 | 中等 |
| High（高品質） | 26 | 8 | 慢 |

WebM 匯出設定初始會沿用專案的動態取樣與輸出效果；選擇品質預設後，才會套用上表數值。Draft 也會關閉光暈與顆粒。較低的 CRF 保留更多細節，通常產生較大檔案；較高的 CRF 則偏向縮小檔案。固定品質會依場景複雜度調整位元率，不保證固定檔案大小。VP9 的編碼可能比 H.264 慢，節省的檔案大小也取決於場景與設定。CRF 數值因編碼器而異，請比較實際輸出，不要直接對照 MP4 與 WebM 的數值。進階設定也提供雙次編碼的目標位元率模式。在平均位元率與片長相同時，MP4 與 WebM 的檔案大小接近。

一次本機比較使用 12 秒介紹影片，設定為 640 × 360、30 fps 與一次動態取樣，產生 852,445 位元組的 MP4 與 300,321 位元組的 WebM（縮小 64.77%）。完整匯出時間分別為 15.89 與 17.28 秒。這次比較使用兩種格式各自的預設編碼設定，包含不同的音訊位元率；並非相同品質的效能測試，也不能用來預測其他場景。詳見[實測比較](artifacts/webm-export/comparison.json)。

Lottie 與 SVGA 將內嵌的 PNG 影格封裝起來，保留 Canvas 畫面與效果，但不含可編輯的向量圖層或音訊。Lottie 輸出為 `.lottie.json`；SVGA 輸出則為壓縮的 SVGA 2 protobuf。

若完成的影片太大，可請共用 `mografy` Skill 壓縮，或直接執行 Python 工具（需要 Python 3.10 以上，且 PATH 中可找到 FFmpeg 與 ffprobe）：

```sh
python3 .agents/skills/mografy/scripts/compress-video.py ./projects/my-animation/renders/film.mp4
python3 .agents/skills/mografy/scripts/compress-video.py ./projects/my-animation/renders/film.mp4 --target-mb 10 -o ./projects/my-animation/renders/film-share.mp4
```

預設會另外寫入使用 CRF 23 的 `film-compressed.mp4`，並保留音訊。`--target-mb` 會執行雙次編碼，並檢查實際檔案是否符合十進位 MB 限制。既有檔案不會被覆寫；沒有縮小檔案的候選結果會被捨棄。品質、解析度、相依工具覆寫與結果驗證，請參閱[壓縮參考文件](https://github.com/zz41354899/mografy/blob/main/.agents/skills/mografy/references/video-compression.md)。維護中的腳本位於 `scripts/compress-video.py`；`pnpm sync:skills` 會將它複製到共用 Skill，供 Codex 與 Claude 使用。

播放器的 Export 對話框提供以下輸出尺寸：

| 格式 | 尺寸 |
| --- | --- |
| Lottie | 256 × 256 — 正方形；640 × 360 — 橫式 |
| SVGA | 375 × 375 — 正方形；375 × 750 — 直式 |
| MP4／WebM 橫式（16:9） | 1280 × 720 — 720p；1920 × 1080 — 1080p |
| MP4／WebM 直式（9:16） | 720 × 1280 — 720p；1080 × 1920 — 1080p |

MP4 與 WebM 的初始方向會與編寫時的畫布一致；可透過圖示切換輸出方向，同時保留 720p／1080p 品質。暫停影格預覽會顯示所選的輸出效果。對話框開啟期間，各格式會記住自己的尺寸與 Fit 選項。

當輸出比例與場景不同時，四種格式都會出現 **Fit（適配方式）**：

| Fit 選項 | 結果 |
| --- | --- |
| **Fit entire scene（完整顯示場景，預設）** | 將完整畫面置中，多餘空間填入場景背景色 |
| **Fill and crop（填滿並裁切）** | 填滿輸出範圍，從邊緣裁切置中的畫面 |
| **Adapt layout（調整版面）** | 將輸出畫布尺寸交給支援響應式的場景程式碼，讓它重新安排構圖 |

全部 16 種內建元件都支援橫式與直式版面。若要將元件匯出為另一個方向，請選擇 **Adapt layout**。自訂場景必須使用 `ctx.width` 與 `ctx.height` 實作自己的響應式版面；單獨選取這個選項，不會自動重排固定座標的畫面。

輸出選項不會改動主預覽與已儲存的專案設定。直式影片預設命名為 `name-portrait.mp4` 或 `name-portrait.webm`。CLI 的 `--orientation` 與 `--resolution` 預設組合使用 **Fit entire scene**；只有 `--orientation` 時預設為 720p，只有 `--resolution` 時則選用橫式。不使用這些旗標的 CLI 匯出會沿用專案的算圖縮放比例。透過 `-o` 指定的輸出名稱，必須是專案 `renders/` 目錄內的檔名或相對路徑。

Mografy 匯出上限為 **MP4 與 WebM 60 fps**、**Lottie 與 SVGA 30 fps**。SVGA 在此上限內使用其支援的影格率。播放器、API、CLI 與直接算圖函式都會套用相同限制。匯出對話框會將沿用的影片影格率限制在 60 fps，不會修改已儲存設定。

從播放器開始匯出後，同一個對話框會顯示動畫機器人、實際影格擷取進度與經過時間。編碼與封裝階段會使用不定進度指示器。按下 **Hide（隱藏）** 後，匯出會繼續執行，進度則移至含 **View（檢視）** 與 **Cancel（取消）** 的提示訊息；頂端的 **Exporting（匯出中）** 按鈕也能重新開啟對話框。

完成的 MP4 與 WebM 影片可在對話框中播放及下載。**Done（完成）** 會關閉結果；播放器仍保留該工作時，可透過 **Last export（上次匯出）** 重新開啟。**Export（匯出）** 會開啟新的設定。失敗或取消的工作提供 **Settings（設定）**；若工作是從這個對話框開始，也可使用 **Retry（重試）**。

CLI 也會顯示進度。直接從 CLI 啟動的匯出可按 Ctrl+C 取消；播放器啟動的匯出可從介面或透過 `mografy export [project] --cancel` 取消。取消程序會先清理暫存資料，再結束工作。

## 指令與專案結構

| 指令 | 用途 |
| --- | --- |
| `mografy dev [project]` | 開啟播放器 |
| `mografy init [project]` | 建立專案 |
| `mografy check [project]` | 編譯並試算圖 |
| `mografy review [project] [--video file.mp4]` | 產生審閱圖片及選用的影片比較 |
| `mografy export [project] --format mp4\|webm\|lottie\|svga` | 匯出動畫 |
| `mografy update [--check]` | 更新目前的原始碼安裝，或檢查是否有新版本 |
| `mografy stop [project]` | 停止專案的播放器伺服器 |
| `mografy --help` | 顯示指令與支援的選項 |

使用 `mografy dev --yes` 可直接建立不存在的專案，不再詢問；`--no-open` 會啟動播放器但不開啟瀏覽器；`--port <port>` 可指定連接埠（預設為 4173，若被占用則依序尋找下一個可用連接埠）。對於 `dev`、`check`、`review`、`export` 與 `stop`，省略專案路徑時會優先使用已設定的 `MOGRAFY_PROJECT`，否則使用目前專案或原始碼工作副本的預設專案。`mografy init` 未指定路徑時，會在目前資料夾建立專案。

```text
mografy/
  .agents/skills/mografy/       共用 Skill、參考文件與影片壓縮工具
  .claude/skills/mografy       連結至同一個 Skill
  packages/server/template/   元件原始碼庫與專案範本
  examples/mografy-intro/      12 秒參考動畫
  examples/analytics-product/  8 秒數據分析互動示範
  examples/mografy-brand/      8 秒品牌介紹
  examples/follow-interaction/ 8 秒追蹤按鈕互動
  projects/                   可編輯的動畫專案與已安裝元件
  docs/                       架構與開發狀態

animation-project/
  mografy.json                 場景入口、aspectRatio、params、fonts、audio、render、review
  scenes/                     動畫程式碼與專案內可重用元件（可選的 style.ts）
  style.md                    可選的專案風格規則
  assets/                     圖片、字型與音訊
  AGENTS.md / CLAUDE.md        共用 Skill 的指引入口
  storyboards/                文字與視覺規劃產物
  renders/                    匯出檔案與審閱圖片
  .mografy/                   工具管理的建置產物與伺服器狀態
```

## 開發與架構

| 套件 | 職責 |
| --- | --- |
| `core` | 設定結構、共用規範、產生 Skill 指引 |
| `runtime` | 瀏覽器場景執行、繪圖、取樣、效果 |
| `render` | 編譯、Chromium 執行環境、匯出、影格審閱 |
| `server` | 專案寫入佇列、原子寫入、檔案監看、HTTP／WebSocket |
| `web` | 播放器與檢查器 |
| `cli` | 開發、驗證、審閱、匯出、專案建立 |

```sh
pnpm check
pnpm test:browser
pnpm --filter @mografy/web dev
```

請閱讀[架構文件](https://github.com/zz41354899/mografy/blob/main/docs/architecture.md)了解資料流程與必須維持的規則，閱讀[開發狀態](https://github.com/zz41354899/mografy/blob/main/docs/STATUS.md)了解已完成與待辦工作，並在修改儲存庫前閱讀 [AGENTS.md](https://github.com/zz41354899/mografy/blob/main/AGENTS.md)。

## 授權

Mografy 原始碼與文件採用 [MIT 授權](https://github.com/zz41354899/mografy/blob/main/LICENSE)，遵循[標準 MIT 授權文字](https://opensource.org/license/mit)。套件資訊宣告為 `MIT`。第三方相依套件與隨附素材保留各自的原始授權條款；隨附的 ABeeZee 字型採用 [SIL Open Font License](https://github.com/zz41354899/mografy/blob/main/packages/server/template/assets/OFL.txt)。
