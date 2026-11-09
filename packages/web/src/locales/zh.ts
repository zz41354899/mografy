// 繁體中文. This dictionary's shape is the type every other language must match.
export const zh = {
  video: '影片', present: '簡報', editorMode: '編輯模式', export: '匯出', exporting: '匯出中…', cancelling: '取消中…', lastExport: '上次匯出', exportFailed: '匯出失敗', exportCancelled: '匯出已取消',
  start: '開始簡報', exportHtml: '匯出 HTML', live: '已連線', connecting: '連線中', reconnecting: '重新連線中', reconnectingDots: '重新連線中…', opening: '正在開啟專案…',
  language: '介面語言', langOther: 'EN', langSwitch: 'Switch the interface to English',
  projects: '專案', showProjects: '顯示專案', hideProjects: '隱藏專案', slides: '投影片', showSlides: '顯示投影片', hideSlides: '隱藏投影片',
  scene: '場景', effects: '效果', audio: '音訊', inspector: '檢視器',
  goStart: '到開頭', goStartHelp: '到開頭（Home）', prevFrame: '上一格', prevFrameHelp: '上一格（←）', play: '播放', pause: '暫停', playHelp: '播放或暫停（空白鍵）', nextFrame: '下一格', nextFrameHelp: '下一格（→）', goEnd: '到結尾', goEndHelp: '到結尾（End）',
  loop: '循環', loopHelp: '循環（L）', guides: '安全框', guidesHelp: '顯示安全框（G）', currentTime: '目前時間', timeline: '時間軸', seconds: (s: string) => `${s} 秒`,
  addMusic: '在音訊面板加入音樂，這裡就會顯示節拍。', bpm: (bpm: number, per: number) => `${bpm} BPM，每小節 ${per} 拍`, loadingMusic: '正在載入音樂…', musicFailed: '音樂載入失敗',
  slideMark: (n: number, title: string, at: number) => `投影片 ${n}：${title} · 停在 ${at} 秒`, slideMarkAria: (n: number, at: number) => `投影片 ${n}，停在 ${at} 秒`, transition: '轉場', transitionNamed: (n: string, a: number, b: number) => `${n}：${a}–${b} 秒`, transitionN: (i: number) => `轉場 ${i}`, reviewAt: (t: number) => `檢查影格 ${t} 秒`,
  keyPlay: '播放', keyFrame: '逐格', keyBeat: '節拍', keySecond: '秒', keyLoop: '循環', keyGuides: '安全框', keyProjects: '專案', keyFull: '全螢幕',
  pbSoundLabel: { loading: '載入音樂中', locked: '開啟聲音', on: '靜音', muted: '取消靜音', error: '音樂無法載入' } as Record<string, string>,
  pbSoundText: { loading: '載入中', locked: '聲音關閉', on: '聲音', muted: '已靜音', error: '沒有聲音' } as Record<string, string>,
  pbCompiling: '正在編譯並試算場景…',

  zoomLabel: '預覽縮放', zoomIn: '放大預覽（+）', zoomOut: '縮小預覽（-）', zoomFit: '符合視窗', fullscreen: '全螢幕（F）', exitFullscreen: '離開全螢幕（Esc）', resizeStage: '拖曳調整預覽大小', resizeTimeline: '拖曳調整時間軸高度，往下拖可收起，雙擊還原', resizeProjects: '拖曳調整專案欄寬度，雙擊還原', resizeInspector: '拖曳調整檢視器寬度，雙擊還原',

  apPresentHelp: '全螢幕簡報：→ 下一張、← 上一張、P 講者畫面、F 全螢幕、Esc 回到編輯器',
  apHtmlHelp: '產生一個可以離線簡報的 HTML 檔並下載',
  apLastExport: '查看上次匯出', apActiveExport: '查看進行中的匯出', apPublished: (time: string, reason: string) => `發布於 ${time}（${reason}）`, apUpdated: (v: string) => `已更新到 ${v}`,
  apNotApplied: '最新的修改沒有套用。', apStillPrevious: '播放器還在顯示上一版。', apNoVersion: '目前還沒有可以顯示的版本。', apFixBelow: '修正下面的檔案，或請 Claude 修正。', apStopped: '場景在繪製時停止了。', apSettingsUpdated: '場景設定已更新。', apCleared: '不相容的已存值已清除：',
  apIssue: { removed: '已從場景移除', 'type-changed': '類型改變', 'out-of-range': '超出範圍' } as Record<string, string>,
  apDismissSettings: '關閉設定通知', apDismiss: '知道了', apBlockedShort: '內建元件不能簡報', apBlocked: '內建元件不能簡報。', apBlockedHelp: '它們是現成的參考。請建立自己的專案，或請 Claude 用這個元件做一個，再切換到簡報。',
  batch: '批次', batchExport: '批次匯出', batchHelp: '一部接一部匯出多個專案', batchToGo: (n: number) => `批次 · 剩 ${n} 部`, batchToGoLabel: (n: number) => `批次匯出，剩 ${n} 部`,

  landscape169: '橫式 16:9', portrait916: '直式 9:16', pvSquare: '正方形', pvLandscape: '橫式', pvPortrait: '直式', pvFrame: (f: string) => `${f} 畫面預覽`,
  close: '關閉', cancel: '取消', settings: '設定', retry: '重試', auto: '自動', custom: '自訂', on: '開', off: '關',

  auMusic: '音樂', auAddTitle: '加入配樂', auAddHelp: '音樂會跟動畫一起播放，也會放進 MP4、WebM。', auAdding: '加入中…', auAdd: '加入音樂', auMuted: '已靜音', auUploading: '上傳中…', auReplace: '替換', auRemove: '移除', auVolume: '音量', auLocked: '按播放就能聽到音樂。', auBeat: '節拍對齊', auBeatHelp: '讓時間軸的節拍標記對上音樂。', auFirstBeat: '第一拍（秒）', auPerBar: '每小節拍數',

  fxTitle: '畫面效果', fxClear: '清除效果', fxHelp: '會套用到匯出的檔案。', fxGlow: '光暈', fxGrain: '顆粒', fxGlowHelp: '亮部邊緣的光', fxGrainHelp: '底片質感', fxAmount: (n: string) => `${n}強度`, fxReset: (n: string) => `重設${n}`, fxRemove: (n: string) => `移除${n}`, fxPreview: '畫面預覽', fxOriginal: '原始', fxWith: '套用效果', fxPlaying: '播放時顯示原始畫面，暫停才看得到效果。', fxPaused: '暫停的畫面已套用效果。', fxPreviewOnly: '只是預覽，匯出會用你儲存的效果。', fxPause: '暫停來預覽', fxNotSaved: '未儲存', fxSaving: '儲存中…', fxSaved: '自動儲存',

  frTitle: '影格檢查', frHelp: '產生關鍵影格的總覽圖，用來檢查動畫。', frMaking: '產生中…', frCreate: '產生檢查圖',

  paReset: '重設', paResetHelp: '回到場景的預設值', subtitles: '字幕', autoSave: '自動儲存', askAiText: '其他文字請 AI 修改。', colours: '顏色', controls: '控制項', sceneSettings: '場景設定', sceneEmpty: '這個場景沒有可以調整的設定。請 AI 修改內容。',

  newProject: '新增專案', projectName: '專案名稱', newProjectName: '新專案名稱', create: '建立', creating: '建立中…', openingShort: '開啟中…', savedIn: (p: string) => `會存在 ${p}`, needsFix: 'mografy.json 需要修正', openNow: '目前開啟', readyMade: '即用動畫', justNow: '剛剛', minAgo: (n: number) => `${n} 分鐘前`, hAgo: (n: number) => `${n} 小時前`,
  groups: { component: '內建元件', recent: '最近開啟', library: '專案資料夾', example: '範例' } as Record<string, string>,

  slLoops: '循環', slGuessed: (from: 'storyboard' | 'picture') => `投影片是從${from === 'storyboard' ? '分鏡' : '畫面'}推測的。想精確設定，請 Claude「幫簡報模式標記 shots」。`, slFinding: '正在找這個場景的 shots…', slPlayback: '投影片播放', slPrev: '上一張', slPrevHelp: '上一張（←）', slNext: '下一張', slNextHelp: '下一張（→）', slPlayInto: '照觀眾看到的方式播放進這張（空白鍵）', slMute: '靜音', slNoMusic: '這個專案沒有音樂', slMutedHelp: '已靜音：簡報播放時不會有音樂', slMuteHelp: '簡報音樂靜音',
  prTitle: '簡報 · Mografy', prError: '場景有錯誤，請到編輯器修正。',

  xpTitle: '匯出動畫', xdBatch: '匯出多個專案…', xdClose: '關閉匯出',
  stage: { Exporting: '匯出中', Encoding: '編碼中', Packaging: '封裝中', Capturing: '擷取中', Starting: '開始中' } as Record<string, string>,
  xjReady: '匯出完成', xjCancelling: '取消中', xjVideo: '匯出的影片', xjFramePreview: '匯出畫面預覽', xjFrames: '影格', xjElapsed: '已經過時間', xjUnplayable: '這個瀏覽器無法在這裡播放影片，但檔案沒有問題：可以用 QuickTime、手機或影片播放器開啟，或改用 Share（H.264）編碼匯出。', xjEncoder: (e: string) => `編碼器：${e}。`, xjCancelExport: '取消匯出', xjHideExport: '隱藏匯出', xjHideHelp: '在背景繼續匯出', xjHide: '隱藏', xjDone: '完成', xjDownload: '下載', xjEditSettings: '修改設定', xjRetryExport: '重新匯出', xjStarting: '開始中…', xjProgress: '匯出進度', xjViewExport: '查看匯出', xjView: '查看', xjFinalizing: '正在完成匯出', xjCapture: '擷取影格', xjMascot: '匯出載入動畫',

  xfVideo: '影片', xfVp9: 'VP9 影片', xfProres: 'ProRes 母帶', xfWeb: '網頁動畫', xfApp: 'App 動畫', xfOutput: '輸出格式',
  xsPresets: {
    share: ['分享 · H.264', '到處都能播：所有瀏覽器、Windows 電腦、通訊軟體和社群上傳。8-bit，相同畫質下檔案約為 H.265 的兩倍。'],
    high: ['高畫質 · H.265 10-bit', '相同畫質檔案約小一半，10-bit 漸層。可在 QuickTime、Safari、有硬體解碼的 Chrome 和 Edge、手機與社群上傳使用；Firefox 或舊電腦請選「分享」。'],
    fast: ['快速高畫質 · 硬體', '由顯示卡編碼 H.265 10-bit（Mac 用 VideoToolbox；Windows 用 NVIDIA、Intel 或 AMD），邊繪製邊編碼。快好幾倍，邊緣可能略有差異。沒有可用的硬體編碼器時會改用軟體。'],
  } as Record<string, [string, string]>,
  xsSettings: (f: string) => `${f} 設定`, xpOrientation: '方向', xpOrientationOf: (f: string) => `${f} 方向`, xpResolution: '解析度', xsSizeNames: { Square: '正方形', Landscape: '橫式', Portrait: '直式' } as Record<string, string>,
  xpFit: '畫面放法', xsFitContain: '完整顯示', xsFitCover: '填滿裁切', xsFitReflow: '自動排版', xsReflowNote: '支援的場景會依輸出比例重新排版。內建元件都支援橫式和直式。', xsContainNote: '整個場景置中完整顯示，多出來的地方補場景背景色。', xsCoverNote: '填滿輸出畫面並裁掉邊緣，場景保持置中。',
  xpRate: '影格率', xpQuality: '畫質', xsDraft: '草稿', xsStandard: '標準', xsHigh: '高', xsEncoder: '編碼器', xsTwoPass: (c: string) => `兩階段 · ${c}`, xsBitrateNote: '從無損母帶以目標位元率編碼：比較慢，用於精確控制檔案大小。',
  xsMovNote: 'ProRes 422 HQ、10-bit，音訊不壓縮：用於 Final Cut、Premiere 或 DaVinci Resolve 剪輯的母帶，檔案很大。', xsWebmNote: 'VP9 影片搭配 Opus 音訊。固定畫質讓細節一致，檔案大小隨場景變化。', xsRasterNote: '內嵌圖片影格保留 Canvas 場景，沒有聲音，也沒有可編輯的向量圖層。尺寸越小播放越輕。',
  xpAdvanced: '進階設定', xpSamples: '動態取樣', xpMixing: '色彩混合', xpLinear: '線性光', xpWorkers: '平行處理', xsShutter: '快門', xsLongest: '360° · 拖尾最長', xsFilm: '180° · 電影感', xsDither: '漸層抖色', xpEncoding: '編碼', xsCrfMode: '固定畫質 · 單階段', xsBitrateMode: '目標位元率 · 兩階段', xsHardwareMode: '硬體編碼', xsHwQuality: '硬體畫質', xsHwHelp: '數字越大越清楚、檔案越大。65 約等於 H.265 CRF 14。', xpBitrate: '位元率', xsBitrateHint: '例如 12M 或 8000k', xsCrfH265: '數字越小細節越多。採用 H.264 的量尺：H.265 在較小的檔案裡達到相同觀感。', xsCrf: '數字越小細節越多。', xpSpeed: '編碼速度',
  xsSpeeds: { ultrafast: '最快', veryfast: '很快', fast: '快', medium: '中等', slow: '慢' } as Record<string, string>,
  xsIncludeAudio: '包含聲音', xsNoAudio: '還沒有加入音軌。', xsSummary: (d: string, f: string) => `${d} 秒 · ${f} 影格`, xsExport: (f: string) => `匯出 ${f}`,

  films: (n: number) => `${n} 部影片`, bxSpecs: { Web: '網頁', App: 'App' } as Record<string, string>, bxOwn: '各自設定', bxOwnSize: '原尺寸', bxEncoderShare: '分享 · H.264', bxEncoderHigh: '高畫質 · H.265', bxEncoderFast: '快速 · GPU',
  bxExportingOf: (i: number, n: number) => `匯出中 · 第 ${i} 部，共 ${n} 部`, bxFrame: (d: number, t: number) => `影格 ${d} / ${t}`, bxPercent: (n: number) => `百分之 ${n}`, bxLeft: (t: string) => `約剩 ${t}`, bxWaiting: (f: string) => `${f}等待中`, bxDone: (f: string) => `${f}完成`, bxNothing: '沒有匯出任何影片', bxFailed: (n: number) => `${n} 部失敗。`, bxSaved: '存在各專案的 renders 資料夾', bxQueue: '佇列', bxClose: '關閉批次匯出', bxJobWaiting: '等待中', bxJobCancelled: '已取消', bxJobFailed: '失敗', bxCancelName: (n: string) => `取消 ${n}`, bxEmpty: '佇列裡沒有影片。', bxNote: '可以關閉這個視窗繼續工作。', bxToGo: (f: string) => `剩 ${f}`, bxCancelAll: '全部取消', bxClear: '清除', bxAddFilms: '加入影片', bxBackground: '在背景執行', bxPicker: '要匯出的影片', bxChoose: '選擇影片', bxLoading: '正在載入專案…', bxNoProjects: '還沒有專案，請先建立一個。', bxProjects: (n: number) => `${n} 個專案`, bxSelectNone: '全部取消選取', bxSelectAll: '全選', bxFormat: '格式', bxQueueLink: (n: number) => n ? `佇列 · 剩 ${n} 部` : '佇列', bxLowMemory: '減少記憶體用量', bxIncludeMusic: '包含音樂', bxAdvanced: '進階', bxYoullGet: '輸出內容', bxOutput: (n: number, f: string) => `${n} 個 ${f} · 存在各專案的 renders 資料夾`, bxMore: (n: number) => `還有 ${n} 部`, bxTick: '在左邊勾選影片。', bxOneAfter: (f: string) => `${f}，依序匯出`, bxNone: '沒有選擇影片', bxAdding: '加入中…', bxExportFilms: (f: string | null) => `匯出 ${f ?? '影片'}`, bxProgress: '批次匯出進度', bxOf: (i: number, n: number) => `第 ${i} 部，共 ${n} 部`, bxFrameLc: (d: number, t: number) => `影格 ${d} / ${t}`, bxNext: '下一部：', bxLast: '最後一部', bxOpenQueue: '開啟佇列',
};
export type Dict = typeof zh;
