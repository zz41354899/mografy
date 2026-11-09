# 更新紀錄

[English](CHANGELOG.md) | [繁體中文](CHANGELOG.zh-TW.md)

Mografy 的重要變更。安裝內容仍然只有十六個內建元件；選用的 extras 放在 GitHub 上的 [`extras/`](extras/)，只有專案需要時才會複製進去。

在你的 Mografy checkout 中更新：

```sh
mografy update --check
mografy update
```

還沒有 `update` 指令的舊版安裝：先停止播放器，執行一次 `git pull --ff-only` 與 `pnpm install`，再用 `mografy dev` 重新開啟。

## 2026-11-09

### 新增

- **播放器支援繁體中文與英文** — 播放器和編輯器的所有文字會跟著瀏覽器語言；上方列的地球按鈕可以切換，並記住你的選擇。
- **全螢幕與可調整的預覽** — 按 `F` 或角落按鈕只顯示影片，播放時控制列會自動讓開。可用 − / + 按鈕、縮放選單、`+` `-` `0` `1`，或 ⌘ 滾輪與雙指縮放；放大後可拖曳平移；拖曳預覽的角落可調整大小。兩側面板和時間軸都有分隔線可拖曳，時間軸往下拖到底會收起。

### 修正

- **Windows 上 `mografy update` 每次更新後都被擋住** — 生成器用不同換行重寫檔案，Git 會回報有修改但 diff 是空的。現在只有換行不同的檔案不會重寫，生成檔的換行固定，`update` 也會自動清掉這個狀態。**如果你的更新已經停在 `Local changes found`**，請在 Mografy 資料夾執行一次這行，再更新：

  ```sh
  git add .agents/skills/mografy packages/core/src/skill-text.ts
  ```

- **`mografy update` 可能還在跑舊的 build** — 只改原始碼時 pnpm 會略過 `postinstall`，所以沒有重新 build。`update` 現在一定會執行。
- **Windows 上的 `mografy update` 其他修正** — 不再限定 `pnpm.cmd`，動到任何東西之前就會回報缺少 pnpm，會忽略關掉終端機後留下的 lock，改寫正在執行的 `mografy.cmd` 也安全。
- **Windows 的 `mografy` 指令** 在安裝來源的資料夾被刪除後，會改用目前資料夾所在的 Mografy，和 macOS、Linux 一致。
- `mografy review` 與 `mografy export --cancel` 現在會指明專案，不會作用到播放器剛切換過去的另一個專案。

## 2026-11-08

### 新增

- **Mografy Stage（介面舞台）**——做短的產品介面動畫：看起來像真的產品、簡化到觀眾需要的程度、構圖有意圖，每個動作都有起因。`mografy add stage <project>` 會複製 [`extras/stage/stage.ts`](extras/stage/stage.ts)：
  - **用劇本驅動狀態。** `play(initial, [wait, click, tap, drag, type, set, focus, mark…], { layout })` 一次編譯成時間軸：游標移動時間依距離計算、走一條淺弧線，點擊的變化發生在按下那一刻，`focus` 讓鏡頭推近再拉遠。`show.at(time)` 取樣，所以畫面仍是時間的純函式；`s.on()`、`s.is()`、`s.num()` 讓元件進出場有過渡，不會「啪」一下出現。
  - **一組 look 驅動的元件。** 視窗（`app`、`browser`、`tabs`、新版 macOS 的 `tahoe`、安靜的 `card`）、手機（鎖定畫面、通知）、`pin()` 讓視窗從兩個邊出血、側欄、按鈕、徽章、輸入框、選單、帶動作的 toast、只滾動變動位數的數字、飛進欄位的物件、分層陰影、會依指向元素換形狀的游標。四種風格（`light`、`dark`、`blueprint`、`minimal`）；`words` 決定保留多少真實文字，其餘變成 placeholder 線條。
  - **會直接報錯的檢查。** 結尾沒有回到初始狀態、游標或鏡頭位置的 loop 會被拒絕並列出原因；超出框的文字會報錯並附上兩個寬度。
  - 十部參考影片：`stage-invoices`（16:9，四種風格）、`stage-phone`（9:16，觸控）、`stage-dashboard`（深色、新版 macOS 視窗）、`stage-bento`（把 bento 當成一張畫來規劃）、`stage-calendar`（拖曳，目標格子一格一格跳）、`stage-upload`（藍圖風格的 API 圖解與標註）、`stage-command`（只用鍵盤）、`stage-checkout`（有分頁的瀏覽器）、`stage-request`（網頁和手機同框）、`stage-snooze`（功能卡片）。`mografy add stage-invoices <folder>`。
  - **好壞並排對照：**`stage-invoices` 新增 **Variant** 參數，可以把同一個故事畫成假介面的五種失敗（`too-much`、`too-little`、`boxed`、`flat`、`bland`）。
  - 為這些範例補的元件：`ui.key`（鍵帽）、`ui.callout`（標註）、`ui.card`；拖曳時的 `s.cursor.dragging`／`lift`；同時有游標和觸控的影片中，點擊不再讓游標跳過去；沒有游標的影片用 `play(..., { pointer: false })`；`words: 'none'`。
  - Skill 新增 [`ui-stage.md`](.agents/skills/mografy/references/ui-stage.md)：假介面常見的五種失敗、七步工作流程、劇本與元件、review 檢查清單。
- **Loop 接縫檢查**——在場景的 `meta` 設 `loop: true`，`mografy check --motion` 會再比對最後一幀和第一幀（顯示 `loop seam clean`，或 *Loop seam* 警告）。

### 變更

- **預設只安裝 Stage 與介紹影片。**`examples/` 現在只有十部 `stage-*` 和 `mografy-intro`。較長的參考影片搬到官網 [Showcase](https://www.mografy.app/zh-TW/showcase)：`film-starter`、`mografy-montage`、`mografy-triangulum`、`mografy-story`、`analytics-product`、`follow-interaction`、`mografy-brand` 和紙劇場系列（`paper-theatre-shadow`、`-gestalt`、`-aesthetic-usability`、`-ringelmann`、`-adhd`、`-moon-rabbit-opera`、`-sea-moon`）。它們不再隨 repository 下載；`mografy add <名稱> [資料夾]` 會從 Showcase 下載到你的專案庫，`mografy add` 會在「Showcase films」下列出。兩部 2D 的 Lunar Pop Club（`paper-theatre-moon-rabbit`、`paper-theatre-moon-rabbit-story`）已移除，3D 歌劇院版保留在 Showcase。
- Skill 在安裝內容裡沒有合適的參考影片時，會讀取 [Showcase 清單](https://www.mografy.app/showcase/films.json)；`film-starter` 也用同樣方式下載。

## 2026-11-07

### 新增

- **批次匯出**——一次輸出很多部影片，不必一部一部按。
  - CLI：`mografy export <專案> <專案>...`，或 `mografy export --all [資料夾]` 匯出資料夾裡的每個專案（預設是你的專案資料夾；`_` 開頭的資料夾如 `_to_delete` 會略過）。每部用同樣的選項（`--preset`、`--format`、`--resolution`…）。某部失敗會回報並繼續下一部；按 Ctrl+C 取消目前這部、停止整批並列出結果。
  - 播放器：上方工具列 **Export** 旁的 **Batch**（或匯出視窗裡的 *Export several projects…*）會開啟批次匯出視窗。左邊從電腦上所有專案勾選影片，右邊選格式（MP4、WebM、MOV、Lottie、SVGA）、編碼方式（每個專案自己的、Share、High 或 Fast）、解析度（每個專案自己的，或依短邊 720p、1080p，16:9 與 9:16 影片各自保持比例）與影格率，*Use less memory* 與 *Include music* 是開關；*You'll get* 預覽會產出的檔案。影片會在背景一部接一部匯出：視窗左邊顯示正在擷取的畫面（掃描線 + 已擷取影格條），右邊是佇列。關掉視窗後左下角有一張小卡繼續顯示進度，切換專案不會中斷。可以取消單部或全部。

### 改進

- **匯出記憶體**——`workers: auto` 現在也看電腦的記憶體：共用的 Chromium 與 Node 約 0.9 GB，每個錄製段在 1080p 約 1.3 GB，auto 最多只規劃 40% 的記憶體（8 GB：1 段；16 GB：4 段）。在 4 核心上實測：段數從 2 加到 4 多用 3 GB，速度沒有變快。
- **省記憶體**——CLI 加 `--workers 1`，或打開批次匯出視窗的 *Use less memory* 開關：每部片只開一段。實測記憶體高峰 4.0 GB → 2.4 GB，慢約 20%。
- H.265 每段的編碼器只用自己那份核心、前瞻 10 幀而不是 20 幀：每段少約 250 MB，畫面相同（與先前輸出 SSIM 0.9999），檔案略小。
- 批次匯出所有專案共用一個 Chromium，不再每部重開。
- CLI 匯出時按 Ctrl+C 會乾淨地取消並顯示結果，不再先被 Chromium 中斷。

### 修正（Windows）

- 批次匯出時按 Ctrl+C：Windows 會把它也送給 FFmpeg 與 Chromium，以前目前這部會被記成失敗，接著用已關閉的 Chromium 繼續下一部。現在會記成已取消並停止整批。
- 匯出不會再於最後一步失敗：FFmpeg 剛結束時 Windows 仍鎖住暫存資料夾，現在刪除會重試，刪不掉也不影響結果。
- 硬體編碼器測試 20 秒沒回應就改用軟體編碼，不會因顯示卡驅動異常而卡住匯出。
- FFmpeg 執行時不會跳出命令列視窗。

## 2026-11-02

影片匯出重新打造，提升速度、畫質與 Windows 支援。更新後要做的事，見[升級後要做的事](#升級後要做的事)。

### 新增

- **匯出預設**——依檔案用途選擇，不必再自己調編碼設定。匯出視窗的 Encoder 欄，或 `mografy export <專案> --preset …`：

  | 預設 | 輸出 | 適用 |
  | --- | --- | --- |
  | `share`（分享） | MP4，H.264 | 所有瀏覽器、Windows 電腦、聊天軟體、社群上傳 |
  | `high`（高畫質，預設） | MP4，H.265 10-bit | 同樣畫質下檔案最小；Apple 裝置、Chrome、Edge |
  | `fast`（快速高畫質） | MP4，硬體 H.265 10-bit | 最快的匯出，由顯示卡繪製與編碼 |
  | `master`（母帶） | MOV，ProRes 422 HQ | 在 Final Cut、Premiere 或 DaVinci Resolve 中剪輯 |

- **MOV（ProRes）格式**——`--format mov`，或在匯出視窗選 MOV。10-bit 4:2:2，附無壓縮 48 kHz 音訊；檔案很大。
- **各平台的硬體編碼**——macOS 用 VideoToolbox；Windows 用 NVIDIA NVENC、Intel Quick Sync、AMD AMF；Linux 用 NVENC、VA-API、Quick Sync。Mografy 會先用極小的試編碼逐一確認，採用第一個能用的；都不能用時改用軟體編碼並註明。完成時，匯出視窗與終端機都會顯示實際使用的編碼器。VideoToolbox 已實測；Windows 與 Linux 的編碼器是新加入的，品質設定是初步校準，歡迎回報 `fast` 在你的顯示卡上的畫質與耗時。
- **Windows 也能用 GPU 繪製影格**（Direct3D 11），與 macOS（Metal）相同。其他平台以 CPU 繪製。
- **進階設定**——快門角度（預設 360°；180° 的動態模糊較短，有電影感）、漸層抖動（消除柔和漸層與光暈中的色階）、硬體品質（1–100），以及 Auto 平行數。在 `mografy.json` 設定 `render.sampleWindow: "centred"`，還能讓每格的動態取樣以該格自己的時間為中心，與音訊同步。所有設定見[設定說明](docs/configuration.md#export-settings)。
- **`scripts/bench-export.ts`**——量測匯出時間，並與無損參考比較檔案大小、SSIM、VMAF。本次結果見 [docs/STATUS.md](docs/STATUS.md)。

### 變更

- **匯出更快**——預設改為固定品質，並在繪製影格的同時編碼，不再先寫無損中間檔；靜止影格只畫一次，不再每個動態取樣各畫一次；每格只有變動的部分會離開瀏覽器。12 秒的 intro 在 1080p60 下，H.265 從 26.2 秒降到 21.5 秒、H.264 從 21.9 秒降到 17.7 秒，畫質相同；用 `fast` 只要 14.9 秒。光暈很重的場景用軟體編碼時提升較少，建議改用 `fast`。
- **H.265 改為 10-bit**（Main 10）：同樣檔案大小下漸層更平滑。
- **音訊改為 48 kHz**，這是影音平台與剪輯軟體預期的取樣率。
- **自適應取樣**（預設關閉）改看變動擴散的範圍，小而快的物件會保留完整的動態模糊，不會變成兩個殘影。
- **色彩轉換**改用精確捨入與完整色度，細的彩色文字邊緣更乾淨。
- **雙次編碼的目標位元率**移到進階設定。因為 H.265 改為 10-bit，這個模式會比以前慢。

### 修正

- **Windows 匯出**——傳給 FFmpeg 的只剩相對於工作資料夾的檔名，專案路徑中的磁碟代號（`C:`）、空白、撇號與反斜線不會再讓匯出失敗。完成的檔案若被防毒軟體暫時鎖住，會自動重試而不是失敗。
- **奇數尺寸的影片**會在開始匯出前就被擋下，不再到編碼時才失敗。
- 匯出改在專案的 `.mografy/tmp/` 進行，不再使用系統暫存資料夾，完成的影片可直接移進 `renders/` 不必複製；雙次編碼會先檢查剩餘磁碟空間。

### 不變

- **既有作品的畫面不變。** 預設維持快門 360°、原本的取樣時間、不抖動、不使用自適應取樣，影格的繪製結果與以前完全相同。專案 `mografy.json` 中已儲存的設定（例如 `"encoding": "two-pass"` 或 `"workers": 2`）會保留；只有從未設定過的專案才會套用新預設（固定品質、Auto 平行數）。
- WebM、Lottie、SVGA 匯出、影片 60 fps 上限，以及所有既有的 CLI 參數（`--codec h264` 仍可使用）。

### 升級後要做的事

1. 更新：`mografy update` 會更新 checkout、重新建置，並重新啟動使用中的播放器。沒有 `update` 的舊安裝，請先停止播放器，執行 `git pull --ff-only` 與 `pnpm install`，再用 `mografy dev` 重新開啟。
2. 如果 `mografy dev` 是你自己啟動的，請停止後再啟動一次，播放器才會使用新的匯出。
3. 選用：在匯出視窗選一個預設，或在終端機試試 `mografy export <專案> --preset fast`。已在專案中儲存 `"encoding": "two-pass"` 或固定 `"workers"` 的專案會保留原設定；要使用新預設，請選擇預設，或修改 `mografy.json`。
4. 使用 NVIDIA、Intel 或 AMD 顯示卡的 Windows：請保持顯示卡驅動程式為最新。如果 `fast` 顯示改用軟體編碼，請將 `MOGRAFY_FFMPEG` 指向包含該顯示卡編碼器的 FFmpeg。

## 2026-11-01

### 新增

- **`mografy check --motion`** 找出 frame cost 看不到的「動作卡」。它以 30 fps、四分之一尺寸畫完整部片，逐格比較前後兩格，列出跳格（某一格的變化遠大於前後：突然出現、兩條軌跡沒接上、硬切）、急起步（從靜止直接全速出發）與急停（全速中突然停住：分段緩動接在一起、淡出停在 0 以上）的時間點。刻意的硬切可以保留。在雲端 CPU 上，60 秒的片大約 15 秒。
- **Skill 的效能參考**現在分開「掉幀」與「動作卡」，各有 checklist，列出每種卡頓的原因與修法、更多昂貴寫法（每格重畫靜態 UI 卡片、逐像素顆粒）和三個 Canvas 陷阱。Skill 交付前會執行 `mografy check --motion`。

## 2026-10-31

### 變更

- **MP4 預設改用 H.265（HEVC）** — 畫質相同，檔案大約小一半（在 3D 紙張材質片與 2D 動態片的實測中，同樣 CRF 下是 H.264 的 50–58%）。檔案標記為 `hvc1`，可以在 QuickTime、Safari、iOS 與 Android、Chrome、Edge 播放，也能直接上傳 YouTube、Instagram、TikTok。Firefox 與部分 Windows 電腦要有硬體支援或安裝「HEVC 視訊延伸模組」才能播；要放在網站 `<video>` 或寄給不確定用什麼播放的人時，在匯出視窗選 **Codec → H.264**、執行 `mografy export --codec h264`，或在 `mografy.json` 的 `render` 加上 `"codec": "h264"`。CRF 與位元率維持 H.264 的意義，既有專案的品質設定不用改。內建的 FFmpeg 已含編碼器；編碼時間跟以前差不多：編碼速度選 `slow` 時會用 x265 的 `medium`，速度與 x264 的 `slow` 相當，壓縮率還更好。
- **壓縮小工具也預設輸出 H.265**（要舊的輸出就加 `--codec h264`）。
- **開專案不再等試算圖。** 開啟時只讀 scene 的 meta 與參數，畫面立刻出來；完整的試算圖在幾秒後於背景執行，scene 有錯一樣會回報。結果存在 `.mografy/verified.json`，沒有改過的 scene 再開時完全不用動到 Chromium。編輯仍會等試算圖通過才換上，壞掉的修改不會蓋掉能用的版本。在測試環境中，74 秒的 3D 影片 *aesthetic-usability* 開啟時間從 45.8 秒降到 0.5 秒。
- **切換專案** — 播放器會保留最近兩個專案（隱藏中），切回去幾乎立刻完成（約 1 秒，不用重新 setup）；還在載入的專案會先顯示它的縮圖，不再停在上一支影片。縮圖改成稍晚才擷取，不會跟播放器搶資源。

### 新增

- **`extras/cjk/subset-film-fonts.py <專案>`** 把專案字型裁成影片實際用到的字（中文字型組從約 9.5 MB 降到 300 KB），並把 `mografy.json` 指向新檔，原始字型保留。改文案後再跑一次。Skill 的效能、CJK、3D 參考文件新增開啟速度的說明：字型裁切、快取程式產生的貼圖、Three.js 燈光數量保持不變。

### 修正

- **切換專案後播錯配音** — 兩個專案的音檔同名時，會播出第一個專案的音軌，因為播放器只用路徑快取解碼後的音訊。現在音訊依專案分開快取。

## 2026-10-29

### 變更

- **Mografy Skill 改寫。** `SKILL.md` 開頭先列硬規則、詞彙表，以及「什麼工作讀哪份參考」的對照表，接著是每一步的產出和交片前檢查清單；description 列出會觸發它的中英文說法。新增 [`taste.md`](.agents/skills/mografy/references/taste.md)，把預設品味寫成數字並附原因：字卡與結果停留、順暢的節奏、字級與安全邊距，以及設計系統（四種字級角色、五種配色角色、重複鏡頭共用版面、約 40% 留白）。新作品先想一個貫穿每個鏡頭的視覺點子。
- **每個專案都有 `style.md`。** Skill 規劃新作品時會寫；沒有的專案在修改前先依 scene 補上。缺少時 `mografy check` 會警告。

## 2026-10-27

### 新增

- **Mografy Templates 模板庫** — [`templates/`](templates/) 收錄 43 個免費的產品影片現成模板，文案全部為英文：22 個 9:16 原生短影音模板（開場、字幕、手機與桌面畫面、點擊放大、輸入、AI 對話、功能標註、前後對比、步驟、數據、使用者評價、Logo、片尾卡、轉場），以及 21 個給官網、YouTube 與簡報用的 16:9 模板（id 以 `-wide` 結尾）。9:16 共用編輯風（白頁、黑色 Anton 大標、一個橘色強調色；`light`／`dark` 主題），16:9 沿用 montage 影片的風格（`night`／`light`／`neon` 背景、光譜光軌與動態文字）。兩種比例都有的模板以 `pair` 互相指向。文案、主題與強調色都是參數，`safeGuide` 會在預覽中顯示社群安全區。
- **`mografy add <template...> [folder]`** — 把模板連同共用的 `kit.ts`、`editorial.ts`、`montage.ts` 與 Inter（500–800）、Anton 字型複製進專案並登記字型；模板和 helper 可以在同一行指令加入。資料夾還不是專案時會直接建立，依模板的畫面比例，附上依序播放模板的 `scenes/main.ts`，並關閉輸出的 glow 與 grain。沒有 `tsconfig.json` 的專案會自動加上一份給編輯器用，所有模板都通過 strict 型別檢查、沒有隱含的 `any`。在影片裡用 `play(ctx, time, start, template, params)` 播放模板；`backdrop: false` 讓疊加類模板畫在影片畫面上。
- **安裝與更新** — `pnpm install` 結束時會多建議一個模板指令（`mografy add hook-impact cta-endcard projects/my-post`），排在參考影片與輔助工具前面。`mografy update` 會連同模板一起更新並重新同步 Skill，不需要額外步驟。
- **Skill 新增 templates 參考** — `references/templates.md` 說明何時從模板開始、如何加入與修改，並列出完整目錄。
- **維護腳本** — `pnpm templates:preview <id> [--theme=<name>]`、`pnpm templates:sync`、`pnpm templates:media <dir>`、`pnpm templates:web <dir>`（官網即時播放用的瀏覽器套件）與 `pnpm templates:typecheck`。

### 修正

- **`mografy add` 找不到專案** — 把模板加到新資料夾（`mografy add hook-impact projects/my-film`）會出現「has no mografy.json」；在專案以外執行時，錯誤訊息提示的指令是錯的；在 Mografy 資料夾裡沒指定專案時，會悄悄加進上一次開過的專案。現在加模板會自動建立需要的專案，`add` 不再回退到上一次的專案，沒有專案時加 helper 會清楚報錯並給出正確指令。

## 2026-10-25

### 新增

- **影片用 runtime 工具** — `@mografy/runtime` 新增 `keys`（單調三次曲線關鍵格）、`cameraPath` 與 `withCamera`（全片一顆鏡頭）、`beats`（一張鏡頭表，產生 `meta.shots`、審閱時間與交接）、共用的 `buffer`、`bloom`，以及 `layer`、`blurLayer` 的 `bounds` 選項。`blurText` 以字形陰影做文字模糊，不再使用 filter。這些工具都能接受場景 context 或一般 2D 畫布，分鏡頁面可以直接畫出真正的影片。
- **`mografy check` 量測每格成本** — 顯示中位數與最慢一格的時間，並在單格超過 100 ms、單格設定超過八個 filter、每格都建立畫布時提出警告。
- **`film-starter` 範例** — `mografy add film-starter <資料夾>` 會複製一部 20 秒的範本影片和它用的 Inter 字型子集，用來開始一部新影片：視線跟著一道光，從一個點畫成一條線，線長成一張畫出 ease 曲線的卡片，再變成光環，最後成為結尾句的句號；全片一顆鏡頭、一張鏡頭表。
- **參考影片** — `examples/` 新增三部完整影片：mografy-montage（60 秒）、mografy-triangulum（42 秒）、mografy-story（71 秒）。它們改用新的 runtime 工具，各自只有一張鏡頭表；與改寫前逐格比對畫面相同，montage 每格的繪製速度約快四倍。`mografy add <名稱> [資料夾]` 會複製一部來修改。Skill 新增的 `examples.md` 說明每部影片可以學什麼。
- **`mografy add` 同時處理影片與輔助工具** — `mografy add` 會一起列出參考影片與輔助工具。`mografy add <影片> [資料夾]` 把影片複製到你的專案庫；`mografy add <工具...> [專案]` 可一次加入一個或多個工具（`mografy add film music`）。安裝完成時會建議其中幾個。
- **圖層使用影片單位** — 在 `layer`、`blurLayer`、`bloom` 裡，陰影與模糊的長度現在和畫面上一樣使用影片單位，卡片與光暈在 Retina 預覽和 4K 匯出時不會變小。`TextStyle.family` 可以寫成 CSS 字型串。

### 變更

- **Skill** — `SKILL.md` 開頭新增連貫與效能的品質底線。新增參考文件：影片架構、效能、輸出（畫面比例與匯出，從場景編寫移出）。原本只給 Codex 的動態補充改為共用的 `motion-design.md`，並加入預設品味（節奏從容、停留時不漂移、大字、Logo 只出現一次、持續型配樂）。產品操作影片改為全片一顆鏡頭，每張卡片用局部縮放。
- **場景** — `setup` 改為選用。
- **cinema** — `crossfade` 重複使用同一個緩衝，不再每格建立畫布。

## 2026-10-24

### 修正

- **Windows 安裝** — 在 Windows 上 `pnpm install` 會出現 `No projects matched the filters`，套件完全沒被 build，接著 `sync:skills` 因為找不到 `@mografy/core/dist/index.js` 而中斷。原因是 pnpm 在 Windows 上一律用 `cmd` 執行 scripts，而 `cmd` 不認得單引號。根目錄 `package.json` 的 scripts（`build`、`typecheck`、`test`、`test:browser`、`test:compression`、`install:tool`）改用跳脫的雙引號，macOS、Linux 與 Windows 都能用。遇過這個問題的 Windows 使用者：執行 `mografy update`（或 `git pull --ff-only`），再執行 `pnpm install`。
- **Windows 安裝（第二部分）** — 接著 `sync:skills` 會出現 `Preserving an existing custom Claude entry: .claude\skills\mografy` 而中斷。Windows 上的 Git 在沒有開啟 symlink 支援時，會把 repo 裡的 `.claude/skills/mografy` symlink 取出成一個小文字檔。`sync:skills` 現在會辨認這種佔位檔並保持原樣，讓 checkout 維持乾淨、`mografy update` 照常可用；Claude 仍然透過根目錄的 `CLAUDE.md` 讀到 Skill。如果 Windows 上這個項目不見了，會改建成不需要系統管理員權限的 junction。
- **Windows 的 `mografy` 指令** — 以前 `install-command` 在 Windows 上只會印出一段 PowerShell 函式，裝完後開新視窗會找不到 `mografy`。現在會把 `mografy.cmd` 寫進一個已經在 `PATH` 上、而且可寫入的資料夾（`%APPDATA%\npm`、`PNPM_HOME` 或 `%LOCALAPPDATA%\Microsoft\WindowsApps`），cmd 和 PowerShell 都能用；找不到合適資料夾時，才退回顯示 PowerShell 函式。
- **Windows 上的 `mografy update`** — 新版 Node 不允許不透過 shell 直接執行 `.cmd` 檔，所以執行 `pnpm.cmd` 時會出現 `spawn EINVAL`。現在在 Windows 上改成透過 shell 執行。
- **Windows 上 build 後 checkout 保持乾淨** — Windows 的 Git 取出文字檔時會用 CRLF 換行，所以 `pnpm build` 重新產生的 `packages/core/src/skill-text.ts` 換行不同，檔案顯示為已修改，之後 `mografy update` 會拒絕執行（「Local changes found」）。產生器現在會把 Skill 的 Markdown 統一成 LF。
- **Windows 存檔** — 防毒軟體或搜尋索引有時會短暫鎖住剛寫好的檔案；專案存檔現在會短暫重試，不會直接以 `EPERM` 失敗。
- **Windows 專案名稱** — 專案名稱如果是 Windows 的裝置名稱（`CON`、`NUL`、`COM1`…）或以句點結尾，現在會改用 Windows 能建立的資料夾名稱。

## 2026-10-23

### 新增

- **`@mografy/runtime` 內建動態工具** — 基本動作不再需要複製 kit。新增緩動曲線 `ease.outQuart`、`outQuint`、`inOutQuart`、`inOutSine`；時間窗 `at()` 與 `win()`；在指定時間剛好停在 1 的彈簧 `spring(time, start, duration, bounce)`，以及彈簧緩動曲線 `springEase()` 與預設 `springs.out / pop / camera / cursor`；餘震回彈 `settle()`、按壓與閃光用的 `pulse()`、`stagger()`。walkthrough extra 改用這些函式，畫面逐格相同。
- **畫面與音樂共用一個速度** — 場景可以宣告 `meta.tempo = { bpm, beatsPerBar, offset }`，並用 `tempoGrid(tempo).onBar(n, k)` 算出時間點。專案還沒有音訊時，`ctx.beat(time)` 會改用 `meta.tempo`；`mografy check` 會指出與 `mografy.json` `audio` 不一致的速度。
- **圖層工具** — `roundRect()`、`surface()`（兩層柔和陰影）、可設字距與透明度的 `text()` / `measure()`、`riseWords()`（逐字從遮罩升起）與 `blurWords()`（逐字由模糊對焦），中文可用 `separator: ''` 逐字動畫。`ctx.draw` 新增 `linearGradient()`、`radialGradient()`、`conicGradient()`。
- **`mografy add <extra> [project]`** — 把選用 extra（cinema、cjk、three、music、walkthrough）從這個 checkout 複製到專案，`extras/` 不在時改從 GitHub 下載；會自動在 `mografy.json` 註冊 CJK 字型，你改過的檔案除非加 `--force` 否則保留，並印出 import 寫法。`mografy add` 會列出所有 extras。安裝內容仍然只有十六個內建元件。

### 文件

- 場景撰寫參考新增 **Randomness**（在 `setup` 用 `ctx.random()` 決定，`ctx.noise()` 只用於每格變化）、**Tempo and music**、**Time and motion helpers**、**Layer helpers** 段落；各 extra 參考改用 `mografy add`。

- **產品操作影片（選用 extra）** — `extras/walkthrough/walkthrough.ts` 把 App 的畫面做成影片：代理看每一步的截圖，把原介面重繪成放大、簡化的卡片（只留被操作的元件和看懂它所需的一點上下文，其餘刪掉或改成骨架條，字放大約 1.5 倍），每鏡只拍一個操作。每張卡片從上一鏡剛按下的元件長出來，每張卡片有自己的鏡頭、只推近要操作的那個元件，由大游標或手指點按完成操作。工具包含卡片、按鈕、會打字的輸入框、逐字模糊浮現的文字、跳數、自己畫出來的勾、提示條、手機框、彈簧曲線、以固定點縮放的鏡頭、會跟著鏡頭移動的游標，以及品牌色流體背景。共用 Skill 新增 `product-walkthrough.md` 參考，說明流程（收集每一步的截圖、逐頁列出元件、先確認「原截圖｜重繪」對照表再做動畫），以及如何套用到產品示範、功能教學、新功能短片、手機 App 預覽、社群短版與網站循環動圖。`walkthrough-demo.ts` 是 12 秒的示範。不會隨安裝加入：只有專案需要時才把檔案複製到 `scenes/`。

### 變更

- **輸出更快，也不再耗盡記憶體** — 畫面改以 Blob 從無頭瀏覽器傳回，去掉 Playwright 每格都保留到輸出結束的一份複本（長的 1080p 輸出會因此記憶體不足），每次上傳也快了約十倍。樣本混合、光暈與顆粒改在頁面內的兩個 worker 執行，同時主執行緒已在繪製下一格，緩衝區也會重複使用。測試中 1080p、4 個樣本、線性混合加光暈與顆粒的每格時間從約 1.4 秒降到約 0.35 秒，長時間輸出記憶體維持平穩。輸出像素與之前完全相同。
- **`MOGRAFY_CANVAS=gpu`** — 選用開關，用 GPU 加速繪製，方便在自己的電腦上比較速度。預設的 `cpu` canvas 讀回畫面成本低，而且每台電腦像素都相同；`gpu` 在大量模糊與陰影的場景可能較快，但邊緣可能有些微差異。
- **Skill 說明改用 Markdown** — Skill 入口與參考文件改放在 `packages/core/skill/` 的 Markdown 檔，core 建置時打包進去，`guide.ts` 只負責組合。修改 Markdown 後執行 `pnpm build`。

## 2026-10-22

### 變更

- **`mografy update` 卡住時會告訴你怎麼辦** — `main` 失去 GitHub upstream 時，更新程式會自動接上 `origin/main` 並繼續更新。其他會停下來的情況，現在都直接印出要執行的指令：有本地修改時列出改過的檔案並附上 `git stash -u`；在其他分支或 detached HEAD 時附上 `git checkout main` 和 `git branch --set-upstream-to=origin/main main`；資料夾沒連到 GitHub 時附上 `git remote add origin …`。

### 修正

- **安全性強化**：`mografy` 指令只會使用「在這台電腦上安裝過」的 Mografy checkout（`pnpm install` 會把它記錄在 `~/.mografy/trusted-checkouts`）；只是外觀像 checkout 的資料夾會被略過並顯示提示。輸出用的無頭場景伺服器會拒絕其他主機與跨站請求，Vite 熱更新連線只接受同源的播放器，播放器的靜態檔也會檢查資料夾邊界。README 新增提醒：只開啟你信任的專案，因為場景程式碼擁有和編輯器相同的權限。
- **編輯更省記憶體、簡報檔更小**：播放器把每個場景版本放在各自的 iframe 裡，新版本就緒後移除舊的，長時間編輯不再把每一版的程式碼、圖片和字型都留在記憶體；runtime 關閉版本時也會移除它加入的字型。簡報 HTML 只嵌入場景實際載入的檔案（加上字型與音樂），不再塞入整個 `assets/`。檔案監看改以檔案系統事件為主，每 10 秒才補掃一次（原本每秒），`.mografy/builds/` 只保留最新 16 版，播放器缺少的檔案改回 404 而不是播放器頁面，輸出用的場景伺服器拒絕超過 512 MB 的上傳。

## 2026-10-21

### 新增

- **動態簡報** — 專案可以現場逐頁簡報，而不只是播成一支影片。投影片來自場景的鏡頭：場景在 `meta.shots` 列出鏡頭（`{ end, stop?, title? }`，依分鏡表），每個鏡頭就是一頁，停在穩定的畫面上；沒有標鏡頭的場景就是一頁，Video 模式的時間軸會用三角形標出每頁停在哪裡。編輯器頂部新增 **Video / Present** 切換，切到 Present 就是同一個場景的投影片檢視：左邊是投影片縮圖（左上角面板按鈕可收起），中間是舞台，滑鼠移上去會出現播放選單（上一頁、**播放**：照觀眾看到的方式播進這一頁、**靜音**：關掉簡報配樂、下一頁），用 ← / → 換頁。標題、講者備註和到站方式（停住畫面，或反覆播放停點前幾秒讓小動態持續）寫在 `mografy.json` 的 `slides`；投影片不會手動新增，只能由標出鏡頭產生。十六個內建元件不能簡報：切換時會說明原因並停在 Video。**Start** 開啟簡報頁：播到下一個停點就停下來等你。上方列（返回編輯器、這頁標題、講者視窗、全螢幕）和下方選單（上一頁、下一頁、靜音、進度條）在滑鼠不動時自動淡出。→ / 空白鍵 / 點擊前進，← 或輸入數字再按 Enter 直接跳頁，M 靜音，F 全螢幕，B 黑屏，P 開啟講者視窗（備註、下一頁、計時），Esc 返回編輯器。配樂在停點淡出、下一段轉場時淡入。排練時視窗會跟著即時修改更新，正式簡報時按 K 鎖定目前版本。**Export HTML** 會寫出並下載一個檔案 `renders/<名稱>-presentation.html`，場景、字型、圖片和配樂都包在裡面：用任何瀏覽器打開就能離線簡報，操作完全一樣（終端機用 `mografy export --format html`）。匯出影片會忽略鏡頭和 `slides`。`mografy check` 會驗證鏡頭，`mografy review` 會多產生一張每頁停格畫面的檢查圖。Skill 新增簡報說明，教 Claude 和 Codex 怎麼讀專案並標出鏡頭。
- **播放器熱更新** — 在原始碼 checkout 裡，`mografy dev` 會透過 Vite 從原始碼提供播放器，改播放器本身的程式時，開著的瀏覽器會立刻更新並保留狀態。`pnpm install` 會把 Vite 裝成播放器的開發相依套件；沒有 Vite（或設定 `MOGRAFY_HMR=0`）時，播放器照舊使用建置好的 `dist/`。
- **情境配樂（選用 extra）** — `extras/music/score.py` 依影片的情境生成配樂，而不是找一首現成的歌再把動畫剪成配合它。agent 寫完分鏡後寫一份 `music.json`：每個段落有情緒（calm、warm、hopeful、playful、tech、tense、cosmic、epic）和能量（固定值或漸強漸弱），並在畫面發生事件的確切秒數標上 hit（爆開、撞擊、粒子聚集或流動、光掃過、打字、結尾和弦）。生成器用 Python 與 numpy 合成對應的音樂，結果可重現，並輸出一張時間線圖，用來確認漸強與撞擊有對到畫面。`rhythm: "flowing"` 讓配樂更連貫、更延展，`texture: "particles"` 為粒子作品加上一層閃爍質感。動畫時間改了，就改標註再生成一次。不會安裝任何東西：只有專案需要音樂時才把腳本複製到該專案的 `music-src/`，共用 Skill 新增的 `music.md` 參考文件說明整個流程。`music-example.json` 是替十二秒 intro 配樂的範例。
- **Three.js 3D 圖層（選用 extra）** — `extras/three/three.ts` 把 Three.js 場景當成一般畫格中的一個圖層來渲染：2D 背景畫在它之前，文字畫在它之後。在 `setup` 中用 `prepareStage` 一次建好網格、燈光、材質與 glTF / GLB 模型，再在 `renderFrame` 中用 `stage` 依 `time` 擺好姿勢；輔助函式涵蓋環繞攝影機、攝影棚反射、模型載入與用 canvas 繪製的貼圖。播放器與所有匯出格式都以 WebGL 渲染。Three.js r186 套件（約 0.8 MB，MIT）只有在專案需要 3D 時才會複製到 `assets/`，因此安裝內容與既有專案都不受影響。`three-demo.ts` 是八秒的導覽，共用 Skill 新增的 `three-d.md` 參考文件說明何時使用 3D，以及如何保持結果可重現。
- **專案風格檔** — 專案現在可以在根目錄的 `style.md` 固定設計與動態上的決定：該做與不該做的規則、動態性格、配色、字體與節奏選擇、構圖，以及參考截圖。數值仍然留在場景程式碼中，只定義一次並在那裡修改。共用 Skill 與分鏡指引在規劃或編輯前都會先讀它。它優先於 Skill 預設的設計指引，但永遠不會凌駕場景合約，而當下的要求仍然優先。只有在你說明或同意某個決定要長期沿用時，agent 才會記錄進去。這個檔案是選用的，安裝內容與新專案都不受影響。

### 變更

- **沒標鏡頭的專案也有投影片** — `pnpm install` 和 `mografy update` 現在會把投影片寫進每個場景沒有 `meta.shots` 的專案：寫在 `mografy.json` 的 `slides.shots`，並以 `"guessedFrom"` 標示是自動判斷（也可以用 `pnpm sync:slides` 手動執行；內建元件和範例不會被改）。鏡頭也可以直接寫在這裡而不寫在 `meta`，但場景自己的 `meta.shots` 仍然優先。Present 模式、簡報頁和匯出的 HTML 都會使用，還沒寫入的專案播放器也會即時判斷：`storyboards/storyboard.md` 的鏡頭表涵蓋整支影片時照它切，否則依畫面變化切，每頁停在鏡頭結束前最穩定的畫面。舊專案不用手動修改；投影片列表會標示是自動判斷，`mografy check` 會回報，`mografy review` 一律產生投影片停格圖。Claude 或 Codex 標好的鏡頭仍然優先。
- **專案打開時停在 0s 並保持暫停** — 打開專案、切換到其他專案或重新整理播放器都不會自動開始播放，Video 和 Present 模式都一樣：Video 從 0s 開始而不是上次的播放位置，Present 停在選取投影片的停格畫面，按播放或空白鍵才會播放。即時修改目前專案時，播放位置仍維持不動。
- **共用 Skill 會自動保持最新** — `pnpm build` 最後會執行 `pnpm sync:skills`，所以 `pnpm install`、`mografy update` 和每次 build 都會依 `guide.ts` 重新產生 `.agents/skills/mografy`（以及 Claude 連結與各專案的指引檔），包括 `music.md` 這類新的參考文件。`mografy dev` 啟動時也會檢查 Skill 的來源在上次同步後是否有變動，例如 `git pull` 後沒有執行 `pnpm install`，有變動就重新產生並輸出一行提示。專案指引中的自訂內容照樣保留，不需要手動執行任何指令。

## 2026-10-20

### 修正

- **checkout 被移動或刪除後 `mografy` 指令仍可使用** — `install-command` 放到 PATH 的啟動器原本寫死安裝時的資料夾，所以刪除或移動那份 checkout（例如舊的 `~/Documents/mografy`）後，每個 `mografy` 指令都會以 Node 的 `MODULE_NOT_FOUND` 錯誤失敗。現在它每次執行時都會尋找 Mografy：在任何 checkout 內就使用該 checkout；在 checkout 外則使用已安裝的副本，若副本已不存在，會印出唯一需要的修復指令。它使用 PATH 上的 `node`，所以升級 Node 也不會讓它失效。既有的啟動器會在下次執行 `pnpm install`、`mografy update` 或 `node packages/cli/bin/mografy.js install-command` 時被取代。
- **`mografy dev` 只開啟專案，舊的起始專案已移除** — `dev` 不再提議建立不存在的專案，所以打錯路徑，或在其他 repository（例如官網的）的終端機中執行，都不會留下空的起始專案。不存在的資料夾現在會直接失敗，並指向 `mografy dev`（內建動畫的播放器，`pnpm install` 後即可使用）。若相對路徑不在目前資料夾中，但在 Mografy 安裝目錄裡是一個專案（`mografy dev projects/<name>`），就會開啟該專案。`--yes` 已棄用並被忽略。開始使用不需要任何起始專案。內部的 `mografy init`（只供 agent 建立新動畫使用，已從 `--help` 與 README 移除）與播放器的「新專案」現在會建立空白專案（只有一個呼吸中的點的空舞台），取代原本八秒的「MOGRAFY」標題場景。元件模組仍會複製進去，讓場景可以匯入。內建元件專案不受影響。`mografy help` 依工作流程重新設計（開始、檢查與匯出、管理），在互動式終端機中顯示目前的產品線與青綠色品牌標誌（`NO_COLOR` 可關閉顏色）。
- **場景卡住時不再擋住後續編輯** — Chromium 內的工作現在有時間限制：setup 30 秒、試算渲染 20 秒，每個匯出、靜態畫面或檢查畫格 120 秒。過去如果 `setup` 中的 `await` 永遠不會完成（例如一張永遠載入不了的圖片），或 `renderFrame` 中的迴圈永遠不會結束，專案就會永遠卡住：之後的每次編輯都默默等待，播放器一直顯示舊版本，`mografy check` 也會卡住直到重新啟動播放器。現在場景錯誤會指出可能的原因，最後一個可用的版本會繼續播放，下一次存檔也會正常生效。
- **檢查不再擋住即時更新** — `mografy review` 在專案的寫入佇列之外渲染，所以產生檢查圖時編輯仍會持續發布。只有在你傳入 `--video`，或播放器最後一次完成的 MP4/WebM 匯出就是目前版本時，檢查才會與影片比對。過去任何較舊的 `renders/<name>.mp4` 都會被拿來比對，而且每個取樣都從頭解碼影片，得到沒有意義的 PSNR，還可能讓更新卡住一分鐘以上。
- **連續存檔合併為一次重建** — 重建進行中若有多個檔案變動（多檔編輯、解壓縮的更新封包），Mografy 只會用最新的檔案再重建一次，而不是為每個中間存檔都完整編譯並在 Chromium 試算一次。
- **大型素材的重建更快** — 字型、圖片與音訊只會計算一次雜湊並重複使用，直到檔案變動為止，不再於每次儲存場景時重新讀取。
- **修正後自動恢復播放** — 播放時若 `renderFrame` 拋出錯誤，播放器仍會停在那一格，現在修正後的版本載入時會自動恢復播放。播放器端永遠不會完成的 setup 也限制在 30 秒內，讓之後的版本仍能出現。
- **`mografy check` 使用執行中的播放器** — 播放器正在服務該專案時，`check` 會請它從磁碟重建（新的 `POST /__mografy/check`），而不是再啟動第二個 Chromium，播放器也會顯示相同的結果。
- **Chromium 當機後自動恢復** — 當機或被關閉的無頭 Chromium 會在下一個頁面重新啟動，而不是讓之後的每次試算渲染都失敗。

## 2026-10-19

### 新增

- **Codex 動態設計指引** — 既有的共用 `mografy` Skill 現在連結到一份只給 Codex 的參考文件，內容涵蓋視覺概念、字體層級、關鍵姿勢、因果編排、節奏、連貫性，以及實際渲染結果的檢查。小幅修改只套用相關的部分。Claude 維持原本的工作流程。
- **動態設計範例** — [`extras/motion-design.ts`](extras/motion-design.ts) 與[渲染出的關鍵姿勢](docs/motion-design/poses.png)示範連續的圖形交接與清楚易讀的結尾停留。撰寫指引仍由 `packages/core/src/guide.ts` 產生。

### 變更

- **本機視覺參考流程** — 私人參考會把實際畫格與特定時間片段，連結到具體的設計決定、對照比較與重建練習。人工回饋會針對相關的需求記錄下來，並保存在本機的參考 Skill 中。保留有用的指引與靜態參考圖後，已移除用完即丟的評估專案、比較頁面與測試影片。

## 2026-10-18

### 新增

- **WebM 匯出** — VP9 影片與選用的 Opus 音訊，可從播放器或 CLI 以 `--format webm` 匯出。固定品質預設為 CRF 32，草稿／標準／高品質預設分別為 38／32／26。兩種影片格式都支援橫向／直向尺寸、Fit、效果、取消，以及完成檔案的播放。檔案大小會隨場景複雜度變化；CRF 不保證符合特定的檔案大小。
- **原始碼更新** — `mografy update --check` 檢查追蹤的上游；`mografy update` 將乾淨的安裝快轉更新、安裝並建置、同步 Skill 指引，並在原本的專案與連接埠上重新啟動執行中的播放器。它會等待匯出完成，並拒絕本機變更、同時進行的更新與分歧的歷史。舊版安裝需要先執行上面的一次性手動更新。

## 2026-10-17

### 新增

- **攝影機與轉場 extra** — [`extras/cinema/cinema.ts`](extras/cinema/cinema.ts)
  - 在照片或主視覺上做攝影機運動：推、拉、橫搖與直搖，永遠不會露出圖片邊緣（`plate`、`move`）。
  - 轉場：交叉淡化、淡入顏色、閃光、光圈、光線斜切、甩鏡，以及櫻花花瓣、星星、圓點或愛心的粒子擦除（`crossfade`、`dipTo`、`flash`、`iris`、`slash`、`whip`、`particleWipe`）。
  - 氛圍：光暈、飄落的花瓣或雪、閃爍的星星與光線掃過（`glow`、`drift`、`twinkle`、`lightSweep`）。
  - [`cinema-demo.ts`](extras/cinema/cinema-demo.ts) 是十四秒的導覽，展示每一種轉場。
- **中文與日文排版 extra** — [`extras/cjk/cjk.ts`](extras/cjk/cjk.ts)
  - 直排（tategaki），包括直排標點與括號、旋轉的長音符號、小假名位置、橫向排列的兩位數字（10月17日），以及遵循禁則的換行。
  - 橫排 CJK 字幕換行時，行首不會出現標點，也不會拆開英文單字。
  - [`cjk-demo.ts`](extras/cjk/cjk-demo.ts) 同時展示兩者。
- **CJK 字型** — [`extras/cjk/fonts/`](extras/cjk/fonts/)：以 OFL 授權的 Noto Sans CJK TC Medium 與 Noto Serif CJK TC Bold 子集，涵蓋假名、常用繁體中文、日文漢字與常用簡體字。
- **Skill 指引** — 新增[攝影機與轉場](.agents/skills/mografy/references/camera-transitions.md)與 [CJK 排版](.agents/skills/mografy/references/cjk-typography.md)參考文件。需求用得到某個 extra 時，agent 會自己去取得，例如「做一支有櫻花轉場的影片」或「加上直排的日文文案」。

### 未變更

- 專案範本、十六個內建元件與它們的縮圖，以及安裝與檢查指令。
