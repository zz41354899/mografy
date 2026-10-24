# 更新紀錄

[English](CHANGELOG.md) | [繁體中文](CHANGELOG.zh-TW.md)

Mografy 的重要變更。安裝內容仍然只有十六個內建元件；選用的 extras 放在 GitHub 上的 [`extras/`](extras/)，只有專案需要時才會複製進去。

在你的 Mografy checkout 中更新：

```sh
mografy update --check
mografy update
```

還沒有 `update` 指令的舊版安裝：先停止播放器，執行一次 `git pull --ff-only` 與 `pnpm install`，再用 `mografy dev` 重新開啟。

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

- **產品操作影片（選用 extra）** — `extras/walkthrough/walkthrough.ts` 把真實 App 的畫面做成影片：代理看每一步的截圖，把原介面重繪成放大、簡化的卡片（只留被操作的元件和看懂它所需的一點上下文，其餘刪掉或改成骨架條，字放大約 1.5 倍），每鏡只拍一個操作。每張卡片從上一鏡剛按下的元件長出來，每張卡片有自己的鏡頭、只推近要操作的那個元件，由大游標或手指點按完成操作。工具包含卡片、按鈕、會打字的輸入框、逐字模糊浮現的文字、跳數、自己畫出來的勾、提示條、手機框、彈簧曲線、以固定點縮放的鏡頭、會跟著鏡頭移動的游標，以及品牌色流體背景。共用 Skill 新增 `product-walkthrough.md` 參考，說明流程（錄製操作但不更動使用者資料、逐頁列出元件、先確認「原截圖｜重繪」對照表再做動畫），以及如何套用到發表廣告、功能教學、新功能短片、手機 App 預覽、社群短版與網站循環動圖。`walkthrough-demo.ts` 是 12 秒的示範。不會隨安裝加入：只有專案需要時才把檔案複製到 `scenes/`。

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
