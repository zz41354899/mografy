// Mografy timeline prototype, v5: every solid is a motion component driven by springs.
// A layer has an in point, an out point, and an enter and exit motion picked from design.json.
// Lengthening a solid only lengthens its hold; enter and exit keep the length their springs settle in.
// design.json lives in physics.js and is edited on its own page, design.html.
// Every frame of the stage is drawn from (time, layers, tokens) alone, like a real Mografy scene.
'use strict';

const D = 25, FPS = 30, BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4, FRAME = 1 / FPS;
const STORE = 'mografy-timeline-prototype-v5';
const M = window.MotionPhysics;

// ------------------------------------------------------------------ text
const TEXT = {
  zh: {
    prototype: '原型 · 不會改到你的專案', shortcuts: '鍵盤快捷鍵', close: '關閉', keysFoot: '隨時按 ? 打開，Esc 關閉。', overrides: '項已覆寫', hidden: '已隱藏', language: '介面語言', stage: '畫面預覽',
    start: '到開頭', prevFrame: '上一格', nextFrame: '下一格', play: '播放', pause: '暫停', end: '到結尾', loop: '循環', undo: '復原', density: '軌道密度', compact: '精簡', standard: '標準', fit: '整片', zoom: '時間軸縮放', inspector: '檢視器',
    tabLayer: '屬性', tabDesign: '設計系統', tabScene: '場景', tabEffects: '效果', tabAudio: '音訊', layer: '圖層', sceneSettings: '場景設定', sceneEmpty: '這個場景沒有可以調整的設定。請 AI 修改內容。', effectsH: '效果', audioH: '音訊', untouched: '原型沒有改動這一頁，沿用目前編輯器的內容。', frameReview: '畫格檢查', frameHelp: '產生關鍵畫格的總覽圖，檢查動畫。', frameBtn: '產生檢查圖', jsonH: '寫入的檔案', projects: '專案', projectsKey: '專案清單（P）', subs: '字幕', subsCount: n => `${n} 則 · 自動儲存`, subsHelp: '每則字幕綁在時間軸的一個圖層上。點一列展開編輯，其他文字請 AI 修改。', expandAll: '全部展開', collapseAll: '全部收合', subsNow: '目前畫面', subsSearch: '搜尋字幕', subsNone: '沒有符合的字幕。', jump: '跳到這裡', selectLayer: '選取圖層', reset: '還原', subOf: '這個圖層的字幕', collapse: '收合', expand: '展開', layers: '個圖層', music: '音樂節拍', hide: '隱藏圖層', show: '顯示圖層', locked: '已鎖定',
    timing: '時間', in: '入點', out: '出點', length: '長度', hold: '停留', motion: '動畫', enter: '進場', exit: '出場', none: '無',
    fromCode: '圖層宣告在', revert: '還原', revertAll: '全部還原成預設',
    motionNote: '動畫元件來自 design.json 的彈簧。拉長 solid 只會延長停留，進場和出場維持彈簧算出的長度。',
    usedBy: '個圖層使用', noDelete: '圖層由場景程式宣告，不能刪除；按 H 可以隱藏。', noLayer: '點一個圖層來看它的屬性。',
    jsonIntro: '編輯器只寫這兩個檔：timeline.json 存每個圖層的時間和選用的動畫，design.json 存 token。場景程式 import 它們，所以會跟程式一起編譯和試渲染。',
    jsonEmpty: '還沒有覆寫。拖一個圖層試試看。', copyEmpty: '還沒有改過字幕。',
    dsIntro: '這裡是快速調整。顏色、字體、間距和每顆彈簧的細節，在獨立的設計系統頁面編輯。', components: '動畫元件', physics: '動畫物理', colours: '顏色', timeScaleShort: '時間縮放', exportBtn: '匯出', toastExportVideo: '原型不會真的匯出：這裡會打開匯出視窗（1080p · 60 fps · 動態模糊）',
    from: '起始', openDs: '開啟設計系統', scheme: '風格', timeScale: '影片時間縮放', speed: '速度', fixed: '固定時長',
    speeds: { fast: '快', default: '一般', slow: '慢' }, schemes: { expressive: 'Expressive', standard: 'Standard' }, kinds: { spatial: '空間', effects: '效果' },
    toastNoDelete: '圖層不能刪除，可以按 H 隱藏', toastLocked: '這個圖層已鎖定', toastUndo: '已復原', toastRedo: '已重做', toastNothing: '沒有可以復原的動作', toastSel: '先選一個圖層', toastReset: '已還原成預設',
    toastShort: '太短了，進場和出場一起壓縮',
    editorMode: '編輯模式', modeVideo: '影片', modePresent: '簡報', slides: '投影片', startShow: '開始簡報', exportHtml: '匯出 HTML', prevSlide: '上一張（←）', nextSlide: '下一張（→）', playSlide: '播放這張（Space）', pauseSlide: '暫停', mute: '簡報時音樂靜音', unmute: '簡報時播放音樂', slidesKey: '投影片（P）',
    railHint: '這些停點是從圖層猜的。請 AI 在場景標記 shots，停點會更準。', railHintReal: '停點來自場景的 meta.shots，和正式編輯器一樣。', viewReal: '真實畫面', viewMock: '圖層示意', viewLabel: '畫面來源', realLoading: '正在載入真實場景…', realTag: '真實畫面 · scenes/main.ts', realNote: '真實畫面跑的是專案原本的場景程式，拖曳圖層不會改變它。切到「圖層示意」看圖層編輯的效果。', realFail: '真實場景載入失敗，改用圖層示意', stopsAt: s => `停在 ${s} 秒`, slideN: (i, n) => `第 ${i} 張，共 ${n} 張`, showHint: '→ 下一張　← 上一張　Esc 回到編輯器', toastExport: '原型不會真的匯出：會寫出一個離線可播的 HTML 檔', toastPresent: '簡報模式：時間軸和檢視器先收起來', toastVideo: '回到影片模式',
    snapBar: '小節', snapBeat: '拍', snapHead: '播放頭', snapEdge: '圖層邊緣', snapStart: '開頭', snapEnd: '結尾',
    presets: { none: '無', fade: '淡入', 'fade-up': '上浮', pop: '彈出', 'blur-in': '模糊', wipe: '擦入' },
    roles: { standard: '標準', gentle: '柔和', pop: '彈性', snappy: '俐落', linear: '線性' },
    groups: [
      ['時間軸', [['拖曳色塊', '整段移動'], ['拖曳兩端', '調整長度（只改停留）'], ['⌘ 拖曳', '暫時不吸附'], ['- =', '縮放，也可以 ⌘ + 滾輪']]],
      ['圖層', [[', .', '移動 1 格'], ['⇧ , .', '移動 1 拍'], ['[ ]', '入點或出點對齊播放頭'], ['⌥ [ ]', '裁掉播放頭前或後'], ['H', '隱藏或顯示'], ['Delete', '圖層不能刪除']]],
      ['動畫', [['1–6', '換進場動畫'], ['⇧ 1–6', '換出場動畫']]],
      ['播放與編輯', [['Space', '播放或暫停'], ['← →', '移 1 格，加 ⇧ 移 1 拍'], ['⇧L', '循環播放'], ['⌘Z ⇧⌘Z', '復原與重做'], ['?', '打開這個視窗']]]
    ]
  },
  en: {
    prototype: 'Prototype · does not touch your project', shortcuts: 'Keyboard shortcuts', close: 'Close', keysFoot: 'Press ? any time to open this, Esc to close.', overrides: 'overridden', hidden: 'Hidden', language: 'Interface language', stage: 'Stage preview',
    start: 'Go to start', prevFrame: 'Previous frame', nextFrame: 'Next frame', play: 'Play', pause: 'Pause', end: 'Go to end', loop: 'Loop', undo: 'Undo', density: 'Track density', compact: 'Compact', standard: 'Standard', fit: 'Fit', zoom: 'Timeline zoom', inspector: 'Inspector',
    tabLayer: 'Properties', tabDesign: 'Design system', tabScene: 'Scene', tabEffects: 'Effects', tabAudio: 'Audio', layer: 'Layer', sceneSettings: 'Scene settings', sceneEmpty: 'This scene has no adjustable settings. Ask AI to change its content.', effectsH: 'Effects', audioH: 'Audio', untouched: 'The prototype leaves this tab as it is in the current editor.', frameReview: 'Frame review', frameHelp: 'Create sheets of key frames to check the animation.', frameBtn: 'Create review sheets', jsonH: 'Files written', projects: 'Projects', projectsKey: 'Projects (P)', subs: 'Subtitles', subsCount: n => `${n} lines · auto-save`, subsHelp: 'Each subtitle belongs to a layer on the timeline. Click a row to edit it; ask AI to change other text.', expandAll: 'Expand all', collapseAll: 'Collapse all', subsNow: 'On screen', subsSearch: 'Search subtitles', subsNone: 'No subtitles match.', jump: 'Go to', selectLayer: 'Select layer', reset: 'Reset', subOf: 'This layer’s subtitle', collapse: 'Collapse', expand: 'Expand', layers: 'layers', music: 'Music beats', hide: 'Hide layer', show: 'Show layer', locked: 'Locked',
    timing: 'Timing', in: 'In', out: 'Out', length: 'Length', hold: 'Hold', motion: 'Motion', enter: 'Enter', exit: 'Exit', none: 'None',
    fromCode: 'Declared in', revert: 'Revert', revertAll: 'Revert everything to the defaults',
    motionNote: 'Motion components come from the springs in design.json. Lengthening a solid only lengthens its hold; enter and exit keep the length their springs settle in.',
    usedBy: 'layers use this', noDelete: 'Layers come from the scene code and cannot be deleted. Press H to hide one.', noLayer: 'Click a layer to see its properties.',
    jsonIntro: 'The editor writes only these two files: timeline.json holds each layer’s timing and chosen motion, design.json holds the tokens. The scene imports both, so they compile and trial-render with the code.',
    jsonEmpty: 'No overrides yet. Try dragging a layer.', copyEmpty: 'No subtitle edits yet.',
    dsIntro: 'Quick adjustments. Colours, type, spacing and every spring in detail are edited on the design system page.', components: 'Motion components', physics: 'Motion physics', colours: 'Colours', timeScaleShort: 'Time scale', exportBtn: 'Export', toastExportVideo: 'The prototype does not export: this opens the export dialog (1080p · 60 fps · motion blur)',
    from: 'From', openDs: 'Open design system', scheme: 'Scheme', timeScale: 'Film time scale', speed: 'Speed', fixed: 'Fixed length',
    speeds: { fast: 'Fast', default: 'Default', slow: 'Slow' }, schemes: { expressive: 'Expressive', standard: 'Standard' }, kinds: { spatial: 'Spatial', effects: 'Effects' },
    toastNoDelete: 'Layers cannot be deleted. Press H to hide it', toastLocked: 'This layer is locked', toastUndo: 'Undone', toastRedo: 'Redone', toastNothing: 'Nothing to undo', toastSel: 'Select a layer first', toastReset: 'Reverted to the defaults',
    toastShort: 'Too short: enter and exit are compressed together',
    editorMode: 'Editor mode', modeVideo: 'Video', modePresent: 'Present', slides: 'Slides', startShow: 'Start', exportHtml: 'Export HTML', prevSlide: 'Previous slide (←)', nextSlide: 'Next slide (→)', playSlide: 'Play this slide (Space)', pauseSlide: 'Pause', mute: 'Mute music while presenting', unmute: 'Play music while presenting', slidesKey: 'Slides (P)',
    railHint: 'These stops are guessed from the layers. Ask AI to mark shots in the scene for exact stops.', railHintReal: 'Stops come from the scene’s meta.shots, as in the real editor.', viewReal: 'Real frames', viewMock: 'Layer mock', viewLabel: 'Stage source', realLoading: 'Loading the real scene…', realTag: 'Real frames · scenes/main.ts', realNote: 'Real frames run the project’s own scene code, so dragging a layer does not change them. Switch to Layer mock to see layer edits.', realFail: 'The real scene failed to load; showing the layer mock', stopsAt: s => `stops at ${s}s`, slideN: (i, n) => `Slide ${i} of ${n}`, showHint: '→ next   ← back   Esc back to the editor', toastExport: 'The prototype does not export: this writes one HTML file that presents offline', toastPresent: 'Present: the timeline and inspector step aside', toastVideo: 'Back to Video',
    snapBar: 'bar', snapBeat: 'beat', snapHead: 'playhead', snapEdge: 'layer edge', snapStart: 'start', snapEnd: 'end',
    presets: { none: 'None', fade: 'Fade', 'fade-up': 'Fade up', pop: 'Pop', 'blur-in': 'Blur', wipe: 'Wipe' },
    roles: { standard: 'Standard', gentle: 'Gentle', pop: 'Pop', snappy: 'Snappy', linear: 'Linear' },
    groups: [
      ['Timeline', [['Drag a solid', 'move the layer'], ['Drag an end', 'change the length (hold only)'], ['⌘ drag', 'no snapping'], ['- =', 'zoom, or ⌘ + scroll']]],
      ['Layers', [[', .', 'nudge 1 frame'], ['⇧ , .', 'nudge 1 beat'], ['[ ]', 'in or out point to the playhead'], ['⌥ [ ]', 'trim before or after the playhead'], ['H', 'hide or show'], ['Delete', 'layers cannot be deleted']]],
      ['Motion', [['1–6', 'change the enter motion'], ['⇧ 1–6', 'change the exit motion']]],
      ['Playback and editing', [['Space', 'play or pause'], ['← →', '1 frame, ⇧ for 1 beat'], ['⇧L', 'loop'], ['⌘Z ⇧⌘Z', 'undo and redo'], ['?', 'open this window']]]
    ]
  }
};

// ------------------------------------------------------------------ design.json (physics.js)
const EASE = M.EASE;
const PRESETS = ['none', 'fade', 'fade-up', 'pop', 'blur-in', 'wipe'];

// ------------------------------------------------------------------ the "scene": layer declarations (defaults)
function declare() {
  const L = (id, zh, en, color, a, b, src, enter, exit, extra = {}) => ({ id, zh, en, color, in: a, out: b, src, enter, exit, hidden: false, locked: false, ...extra });
  return [
    L('logo', 'Logo LUNAR POP CLUB', 'Logo LUNAR POP CLUB', '#d4a24c', 21.9, 25, 'scenes/ending.ts', 'pop', 'none'),
    L('ch3', '章節 03 節拍', 'Chapter 03 Beat', '#9a7bd0', 20, 22, 'scenes/chapters.ts', 'pop', 'fade'),
    L('ch2', '章節 02 魅力', 'Chapter 02 Charm', '#9a7bd0', 18, 20, 'scenes/chapters.ts', 'pop', 'fade'),
    L('ch1', '章節 01 登場', 'Chapter 01 Debut', '#9a7bd0', 16, 18, 'scenes/chapters.ts', 'pop', 'fade'),
    L('iris', '月亮 Iris 轉場', 'Moon iris', '#5b9bd5', 15.6, 16.25, 'scenes/main.ts', 'none', 'none'),
    L('rise', '月出', 'Moonrise', '#5b9bd5', 10, 16, 'scenes/opening.ts', 'fade-up', 'none'),
    L('blocks', '色塊 A BRIGHTER NIGHT', 'Colour blocks', '#c2668a', 6, 10, 'scenes/opening.ts', 'wipe', 'fade'),
    L('title', '標題 今晚，陪伴著你', 'Title “Tonight, with you”', '#5fa37a', 1.2, 6, 'scenes/opening.ts', 'fade-up', 'fade'),
    L('rabbit', '兔子剪影', 'Rabbit silhouette', '#5fa37a', 0, 8, 'scenes/opening.ts', 'blur-in', 'fade'),
    L('petals', '花瓣（環境）', 'Petals (ambient)', '#c98aa6', 0, 25, 'scenes/lib.ts', 'fade', 'fade', { hidden: true }),
    L('stage', '舞台月亮', 'Stage moon', '#8a8f98', 0, 25, 'scenes/lib.ts', 'none', 'none', { locked: true })
  ];
}
const DEFAULTS = declare();
/** Subtitles the scene declares, each tied to the layer that shows it (copy.json holds the edits). */
const SUBS = [
  { id: 'S01', layer: 'title', zh: '標題', en: 'Title', text: '今晚，陪伴著你' },
  { id: 'S02', layer: 'blocks', zh: '色塊標語', en: 'Block slogan', text: 'A BRIGHTER NIGHT' },
  { id: 'S03', layer: 'ch1', zh: '章節 01', en: 'Chapter 01', text: '登場' },
  { id: 'S04', layer: 'ch2', zh: '章節 02', en: 'Chapter 02', text: '魅力' },
  { id: 'S05', layer: 'ch3', zh: '章節 03', en: 'Chapter 03', text: '節拍' },
  { id: 'S06', layer: 'logo', zh: '片尾標誌', en: 'End title', text: 'LUNAR POP CLUB' },
  { id: 'S07', layer: 'logo', zh: '片尾副標', en: 'End subtitle', text: 'NO.01 — CIRCLE' }
];
const clone = o => JSON.parse(JSON.stringify(o));

// ------------------------------------------------------------------ state
const S = {
  lang: 'zh', zoom: 1, density: 'std', t: 22.1, playing: false, loop: true, tab: 'scene',
  layers: clone(DEFAULTS), tokens: M.load(), sel: 'title', guide: null,
  copy: {}, subOpen: new Set(), subQuery: '', subNow: false, folded: new Set(),
  mode: 'video', slide: 0, rail: true, muted: false, stopAt: null, view: window.MografyReal ? 'real' : 'mock'
};
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
  if (saved && Array.isArray(saved.layers) && saved.layers.length === DEFAULTS.length) {
    S.layers = saved.layers; S.copy = saved.copy || {}; S.folded = new Set(saved.folded || []); S.lang = saved.lang === 'en' ? 'en' : 'zh'; S.density = saved.density === 'compact' ? 'compact' : 'std';
    S.mode = saved.mode === 'present' ? 'present' : 'video'; S.slide = Number(saved.slide) || 0; S.muted = !!saved.muted; if (saved.view === 'mock') S.view = 'mock';
  } else if (!saved && (navigator.language || '').toLowerCase().startsWith('en')) S.lang = 'en';
} catch { /* storage unavailable: start from the defaults */ }
function save() {
  try { localStorage.setItem(STORE, JSON.stringify({ layers: S.layers, copy: S.copy, folded: [...S.folded], lang: S.lang, density: S.density, mode: S.mode, slide: S.slide, muted: S.muted, view: S.view })); } catch { /* ignore */ }
  M.save(S.tokens);
}
const tx = () => TEXT[S.lang];
const sub = id => S.copy[id] ?? SUBS.find(x => x.id === id).text;
const subsOf = layerId => SUBS.filter(x => x.layer === layerId);
const layer = id => S.layers.find(l => l.id === id);
const def = id => DEFAULTS.find(l => l.id === id);
const nameOf = l => S.lang === 'zh' ? l.zh : l.en;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const qf = t => Math.round(t * FPS) / FPS;
const r3 = v => Math.round(v * 1000) / 1000;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const presetName = p => tx().presets[p] || p;

// ------------------------------------------------------------------ motion components
const motionOf = name => name && name !== 'none' ? S.tokens.motion[name] : null;
const durOf = name => M.length(S.tokens, motionOf(name));
/** Enter and exit lengths for a layer; when the solid is too short both springs speed up by the same factor. */
function phases(l) {
  const len = l.out - l.in;
  let a = durOf(l.enter), b = durOf(l.exit), k = 1;
  if (a + b > len) { k = len / (a + b); a *= k; b *= k; }
  return { enter: a, exit: b, hold: Math.max(0, len - a - b), k };
}
/** The look a motion component gives tau seconds into its motion (tau 0 = its "from" state). */
function apply(look, m, tau) {
  if (!m) return;
  const f = m.from, dist = v => typeof v === 'string' ? S.tokens.distance[v] ?? 0 : v, at = prop => M.progress(S.tokens, m, prop, tau);
  if (f.opacity !== undefined) look.opacity *= f.opacity + (1 - f.opacity) * at('opacity');
  if (f.y !== undefined) look.y += dist(f.y) * (1 - at('y'));
  if (f.scale !== undefined) look.scale *= f.scale + (1 - f.scale) * at('scale');
  if (f.blur !== undefined) look.blur += f.blur * (1 - at('blur'));
  if (f.reveal !== undefined) look.reveal = Math.min(look.reveal, f.reveal + (1 - f.reveal) * at('reveal'));
}
function lookAt(l, t) {
  const look = { opacity: 1, y: 0, scale: 1, blur: 0, reveal: 1 }, ph = phases(l);
  const me = motionOf(l.enter), mx = motionOf(l.exit);
  if (me && ph.enter > 0 && t < l.in + ph.enter) apply(look, me, (t - l.in) / ph.k);
  if (mx && ph.exit > 0 && t > l.out - ph.exit) apply(look, mx, (l.out - t) / ph.k);
  return look;
}

// ------------------------------------------------------------------ history
const past = [], future = [];
const snap = () => JSON.stringify({ layers: S.layers, tokens: S.tokens });
function restore(json) { const o = JSON.parse(json); S.layers = o.layers; S.tokens = o.tokens; }
function commit(fn) { const before = snap(); fn(); if (snap() !== before) { past.push(before); if (past.length > 200) past.shift(); future.length = 0; save(); } render(); }
function undo() { if (!past.length) return toast(tx().toastNothing); future.push(snap()); restore(past.pop()); save(); render(); toast(tx().toastUndo); }
function redo() { if (!future.length) return; past.push(snap()); restore(future.pop()); save(); render(); toast(tx().toastRedo); }

// ------------------------------------------------------------------ stage (a pure function of time, layers and tokens)
const cv = document.getElementById('stage'), g = cv.getContext('2d');
const ANCHOR = { rabbit: [520, 700], rise: [1300, 380], stage: [960, 430] };
// The real lunar-pop-club scene (real.js: Mografy's compiled build + runtime). Layer edits don't reach it.
const REAL = window.MografyReal, realCanvas = document.createElement('canvas');
let realRT = null;
const realOn = () => S.view === 'real' && !!realRT;
function drawScene(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none';
  if (realOn()) { realRT.render(clamp(t, 0, D - FRAME)); g.globalAlpha = 1; g.drawImage(realCanvas, 0, 0, 1920, 1080); return; }
  if (S.view === 'real' && REAL) { g.fillStyle = '#FFF7EB'; g.fillRect(0, 0, 1920, 1080); return; }
  g.fillStyle = '#f4efe6'; g.fillRect(0, 0, 1920, 1080);
  for (let i = S.layers.length - 1; i >= 0; i--) {
    const l = S.layers[i];
    if (l.hidden || t < l.in || t >= l.out) continue;
    const p = (t - l.in) / Math.max(FRAME, l.out - l.in), look = lookAt(l, t);
    if (look.opacity <= .001 || look.reveal <= .001) continue;
    const [ax, ay] = ANCHOR[l.id] || [960, 540];
    g.save();
    g.globalAlpha = look.opacity;
    if (look.blur > .2) g.filter = `blur(${look.blur.toFixed(1)}px)`;
    if (look.reveal < 1) { g.beginPath(); g.rect(0, 0, 1920 * look.reveal, 1080); g.clip(); }
    g.translate(ax, ay + look.y); g.scale(look.scale, look.scale); g.translate(-ax, -ay);
    (DRAW[l.id] || (() => {}))(p, t, l);
    g.restore();
  }
}
function moon(x, y, r) {
  const gr = g.createRadialGradient(x - r * .25, y - r * .3, r * .1, x, y, r);
  gr.addColorStop(0, '#fbecc8'); gr.addColorStop(.7, '#efcf8f'); gr.addColorStop(1, '#e2b86e');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
function centerText(str, y, size, font, color, track = 0) {
  g.fillStyle = color; g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = track + 'px';
  g.fillText(str, 960, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}
function card(num, sub) {
  g.fillStyle = 'rgba(43,36,64,.92)';
  g.beginPath(); g.roundRect(560, 300, 800, 480, 40); g.fill();
  centerText(num, 470, 200, '"Instrument Serif", serif', '#f3d9a4');
  centerText(sub, 640, 64, '"Noto Sans TC", sans-serif', '#f4efe6', 8);
}
const DRAW = {
  stage: () => moon(960, 430, 230),
  petals: (p, t) => {
    g.fillStyle = '#e8a7bf';
    for (let i = 0; i < 46; i++) {
      const sp = .6 + (i % 5) / 10, x = (i * 397 + Math.sin(t * .8 + i) * 40) % 1920, y = ((i * 233 + t * 140 * sp) % 1200) - 60;
      g.beginPath(); g.ellipse(x, y, 9, 5, t + i, 0, Math.PI * 2); g.fill();
    }
  },
  rabbit: (p) => {
    const s = 1 + .08 * EASE.inOutSine(p);
    g.translate(520, 700); g.scale(s, s); g.translate(-520, -700);
    g.fillStyle = '#2b2440';
    g.beginPath(); g.ellipse(520, 760, 150, 190, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(520, 520, 105, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(470, 340, 30, 120, -.18, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(575, 345, 30, 120, .2, 0, Math.PI * 2); g.fill();
  },
  title: () => centerText(sub('S01'), 880, 96, '"Noto Sans TC", sans-serif', '#2b2440', 12),
  blocks: p => {
    ['#f2a5c0', '#b9a3e6', '#f3d38a'].forEach((c, i) => {
      const k = EASE.outQuint(clamp(p * 1.8 - i * .18, 0, 1));
      g.fillStyle = c; g.fillRect(-1920 + k * 1920, i * 360, 1920, 360);
    });
    g.globalAlpha *= clamp((p - .3) / .12, 0, 1);
    centerText(sub('S02'), 540, 150, '"Instrument Serif", serif', '#2b2440', 10);
  },
  rise: () => { g.fillStyle = '#1d1a33'; g.fillRect(0, -400, 1920, 1880); moon(1300, 380, 260); },
  iris: p => {
    const r = 60 + 1400 * EASE.inOutSine(p);
    g.fillStyle = '#2b2440'; g.beginPath(); g.arc(960, 540, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f3d9a4'; g.lineWidth = 6; g.stroke();
  },
  ch1: () => card('01', sub('S03')), ch2: () => card('02', sub('S04')), ch3: () => card('03', sub('S05')),
  logo: () => {
    centerText(sub('S06'), 520, 150, '"Instrument Serif", serif', '#2b2440', 10);
    centerText(sub('S07'), 650, 34, 'Inter, sans-serif', '#6d6280', 14);
  }
};
const surround = document.getElementById('surround');
function fitStage() {
  const w = surround.clientWidth - 40, h = surround.clientHeight - 40;
  const k = Math.max(.05, Math.min(w / 1920, h / 1080));
  cv.style.width = Math.floor(1920 * k) + 'px'; cv.style.height = Math.floor(1080 * k) + 'px';
}

// ------------------------------------------------------------------ timeline
const scroller = document.getElementById('tlScroll'), inner = document.getElementById('tlInner');
const nameW = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--name-w')) || 240;
const baseW = () => Math.max(220, scroller.clientWidth - nameW() - 14);
const trackW = () => Math.round(baseW() * S.zoom);
const X = t => t / D * trackW();
const timeAtClient = cx => clamp((cx - inner.getBoundingClientRect().left - nameW()) / trackW() * D, 0, D);

const ICON = {
  eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  eyeOff: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 9 6 9 6a17 17 0 01-2.6 3.2M6.5 7.6C4.3 9.2 3 12 3 12s4 6 9 6c1.3 0 2.5-.3 3.6-.8"/></svg>',
  lock: '<svg class="lock" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  layers: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4"/></svg>',
  file: '<svg class="file-ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></svg>',
  music: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>'
};
/** Small glyph per motion component, drawn inside the solid's enter and exit zones. */
const GLYPH = { fade: '◐', 'fade-up': '↑', pop: '✦', 'blur-in': '◌', wipe: '▸' };

function renderTimeline() {
  const T = tx(), tw = trackW(), rowH = S.density === 'compact' ? 24 : 34;
  const gridVars = `--bar:${BAR / D * tw}px;--beat:${BEAT / D * tw}px`;
  const step = S.zoom >= 5 ? .25 : S.zoom >= 2.6 ? .5 : S.zoom >= 1.5 ? 1 : 2;
  let ticks = '';
  for (let t = 0; t <= D + 1e-6; t += step) ticks += `<span style="left:${X(t)}px">${r3(t)}s</span>`;
  let html = `<div class="ruler-row"><div class="cell-name">${ICON.layers}<span>${S.layers.length} ${esc(T.layers)}</span></div>
    <div class="cell-track ruler" data-act="seek" style="width:${tw}px">${ticks}<b class="ph-bubble" id="phTime"></b></div></div>`;
  for (const l of S.layers) {
    const sel = S.sel === l.id, x0 = X(l.in), w = Math.max(3, X(l.out) - x0), nm = esc(nameOf(l)), ph = phases(l);
    const ew = X(ph.enter), xw = X(ph.exit);
    const zone = (side, name, width) => width > 1 ? `<span class="zone ${side}" style="width:${width}px" title="${esc(side === 'enter' ? T.enter : T.exit)} · ${esc(presetName(name))} · ${r3(side === 'enter' ? ph.enter : ph.exit)}s">${width > 16 ? (GLYPH[name] || '') : ''}</span>` : '';
    html += `<div class="row ${sel ? 'sel' : ''} ${l.hidden ? 'is-hidden' : ''}" style="height:${rowH}px;--c:${l.color}">
      <div class="cell-name" data-act="select" data-layer="${l.id}">
        <i class="swatch" style="background:${l.color}"></i>
        <span class="lname">${nm}</span>
        ${l.locked ? `<span title="${esc(T.locked)}">${ICON.lock}</span>` : ''}
        <button class="eye" data-act="eye" data-layer="${l.id}" aria-pressed="${!l.hidden}" aria-label="${esc(l.hidden ? T.show : T.hide)}: ${nm}">${l.hidden ? ICON.eyeOff : ICON.eye}</button>
      </div>
      <div class="cell-track grid" data-act="seek" style="width:${tw}px;${gridVars}">
        <div class="solid ${l.locked ? 'locked' : ''}" data-act="move" data-layer="${l.id}" style="left:${x0}px;width:${w}px">
          ${zone('enter', l.enter, ew)}${zone('exit', l.exit, xw)}
          <span class="h h-in" data-act="trim-in" data-layer="${l.id}"></span>
          <span class="slabel" style="padding-left:${Math.max(10, ew + 6)}px;max-width:${Math.max(0, w - xw - 2)}px">${w - ew - xw > 70 ? `${subsOf(l.id).length ? `<b class="sub-tag">${subsOf(l.id).map(x => x.id).join(' ')}</b>` : ''}${nm}` : ''}</span>
          <span class="h h-out" data-act="trim-out" data-layer="${l.id}"></span>
        </div>
      </div></div>`;
  }
  let beats = '';
  for (let t = 0; t <= D + 1e-6; t += BEAT) beats += `<i class="beatmark ${Math.abs(t / BAR - Math.round(t / BAR)) < 1e-6 ? 'bar' : ''}" style="left:${X(t) - 1}px"></i>`;
  html += `<div class="row music" style="height:36px"><div class="cell-name">${ICON.music}<span>${esc(T.music)} · ${BPM} BPM</span></div>
    <div class="cell-track" data-act="seek" style="width:${tw}px">${beats}</div></div>`;
  html += `<div class="playhead" id="playhead"></div>`;
  if (S.guide) html += `<div class="guide" style="left:${nameW() + X(S.guide.t)}px"><span>${esc(S.guide.label)} ${r3(S.guide.t)}s</span></div>`;
  inner.style.width = (nameW() + tw) + 'px';
  inner.className = 'tl-inner ' + (S.density === 'compact' ? 'compact' : '');
  inner.innerHTML = html;
  placePlayhead();
}
function placePlayhead() {
  const ph = document.getElementById('playhead');
  if (!ph) return;
  ph.style.left = (nameW() + X(S.t)) + 'px';
  const b = document.getElementById('phTime'); b.textContent = S.t.toFixed(2); b.style.left = X(S.t) + 'px';
}

// ------------------------------------------------------------------ inspector
const panel = document.getElementById('panel');
function overrides() {
  const out = {};
  for (const l of S.layers) {
    const d = def(l.id), o = {};
    for (const k of ['in', 'out']) if (Math.abs(l[k] - d[k]) > 1e-6) o[k] = r3(l[k]);
    for (const k of ['enter', 'exit', 'hidden']) if (l[k] !== d[k]) o[k] = l[k];
    if (Object.keys(o).length) out[l.id] = o;
  }
  return out;
}
/** Small plot of a component's spring(s) over its length. */
function springSvg(m, w = 120, h = 44) {
  const len = Math.max(.05, M.length(S.tokens, m)), x0 = 4, x1 = w - 4, yb = h - 8, yt = 12;
  const props = m.duration ? ['reveal'] : [...new Set(Object.keys(m.from).map(p => M.kindOf(p) === 'spatial' ? 'y' : 'opacity'))];
  const paths = props.map(p => {
    let d = '';
    for (let i = 0; i <= 60; i++) { const tt = i / 60 * len, v = M.progress(S.tokens, m, p, tt); d += `${i ? 'L' : 'M'}${(x0 + i / 60 * (x1 - x0)).toFixed(1)} ${(yb - v * (yb - yt)).toFixed(1)}`; }
    return `<path d="${d}" fill="none" stroke="${p === 'y' ? '#e9c17a' : '#1bbfae'}" stroke-width="2" stroke-linecap="round"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M${x0} ${yt}H${x1}" stroke="#3a3c42" stroke-dasharray="3 4"/>${paths}</svg>`;
}
const compMeta = m => m.duration ? `${tx().fixed} ${r3(m.duration)}s · ${m.easing}` : `${tx().speeds[m.speed]} · ${r3(M.length(S.tokens, m))}s`;
/** JSON with keys, strings and numbers wrapped for colouring. */
const hl = o => esc(JSON.stringify(o, null, 2))
  .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="jk">$1</span>$2')
  .replace(/(:\s*)(&quot;.*?&quot;)/g, '$1<span class="js">$2</span>')
  .replace(/(:\s*)(-?\d+\.?\d*)/g, '$1<span class="jn">$2</span>');
const usage = name => S.layers.filter(l => l.enter === name || l.exit === name).length;
function presetPicker(l, side) {
  const T = tx(), cur = l[side], m = motionOf(cur);
  const meta = m ? `${presetName(cur)} · ${compMeta(m)}` : T.none;
  return `<div class="motion-row">
    <div class="motion-head"><span>${esc(side === 'enter' ? T.enter : T.exit)}</span><span class="at">${esc(meta)}</span></div>
    <div class="preset-grid" role="radiogroup" aria-label="${esc(side === 'enter' ? T.enter : T.exit)}">
      ${PRESETS.map((p, i) => `<button role="radio" aria-checked="${cur === p}" data-preset="${p}" data-side="${side}" ${l.locked ? 'disabled' : ''} title="${side === 'exit' ? '⇧' : ''}${i + 1}"><span class="glyph" aria-hidden="true">${GLYPH[p] || '–'}</span>${esc(presetName(p))}</button>`).join('')}
    </div></div>`;
}
/** The way into the design system page: a small cover of this project's tokens. */
function dsCard(T) {
  const tk = S.tokens, c = tk.color, comps = Object.keys(tk.motion);
  const sp = tk.springs[tk.scheme].spatial.default;
  let d = '';
  for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.min(1.2, M.settle(sp) * 1.15), v = M.spring(sp, t); d += `${i ? 'L' : 'M'}${(i / 48 * 100).toFixed(1)} ${(34 - v * 24).toFixed(1)}`; }
  return `<button class="ds-card" id="openDs" aria-label="${esc(T.openDs)}">
    <span class="ds-cover" style="--paper:${c.paper};--ink:${c.ink};--night:${c.night}">
      <span class="ds-cover-type"><b>Aa</b><span>${esc(tk.type.display.family)}</span></span>
      <svg class="ds-curve" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10H100" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/><path d="${d}" fill="none" stroke="${c.moon}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>
      <span class="ds-chips">${Object.entries(c).map(([k, v]) => `<i style="background:${v}" title="${k} ${v}"></i>`).join('')}</span>
    </span>
    <span class="ds-meta">
      <span><em>${esc(T.scheme)}</em><strong>${esc(T.schemes[tk.scheme])}</strong></span>
      <span><em>${esc(T.timeScaleShort)}</em><strong>×${tk.timeScale}</strong></span>
      <span><em>${esc(T.components)}</em><strong>${comps.length}</strong></span>
    </span>
    <span class="ds-go">${esc(T.openDs)}<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
  </button>`;
}
/** Enter or exit as one compact row: a menu of the motion components and the length it plays for. */
function motionSelect(l, side, len) {
  const T = tx(), label = side === 'enter' ? T.enter : T.exit;
  return `<label class="motion-sel"><span>${esc(label)} <i>${r3(len)}s</i></span>
    <select data-side="${side}" aria-label="${esc(label)}" ${l.locked ? 'disabled' : ''}>${PRESETS.map(p => `<option value="${p}" ${l[side] === p ? 'selected' : ''}>${GLYPH[p] || '–'}  ${esc(presetName(p))}</option>`).join('')}</select></label>`;
}
/** An inspector section; its title folds it, like a disclosure. */
const sec = (key, title, body, aside = '') => {
  const folded = S.folded.has(key);
  return `<section class="section ${folded ? 'folded' : ''}"><header><button class="fold" data-fold="${key}" aria-expanded="${!folded}"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 2l4 3-4 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><h2>${title}</h2></button>${aside}</header>${folded ? '' : body}</section>`;
};
const fmtT = t => r3(t).toFixed(1);
function subRow(x, T) {
  const l = layer(x.layer), open = S.subOpen.has(x.id), changed = S.copy[x.id] !== undefined && S.copy[x.id] !== x.text;
  const live = l && S.t >= l.in && S.t < l.out, sel = S.sel === x.layer;
  return `<div class="sub ${open ? 'open' : ''} ${sel ? 'sel' : ''}" style="--c:${l ? l.color : 'var(--muted)'}">
    <button class="sub-head" data-sub="${x.id}" aria-expanded="${open}">
      <span class="sub-id">${x.id}</span><span class="sub-label">${esc(S.lang === 'zh' ? x.zh : x.en)}${changed ? '<i class="dot-edit" title="edited"></i>' : ''}</span>
      <span class="sub-time ${live ? 'live' : ''}">${l ? `${fmtT(l.in)}–${fmtT(l.out)}s` : ''}</span>
      ${open ? '' : `<span class="sub-preview">${esc(sub(x.id))}</span>`}
    </button>
    ${open ? `<div class="sub-body"><textarea id="sub-${x.id}" data-subtext="${x.id}" rows="2" aria-label="${x.id}">${esc(sub(x.id))}</textarea>
      <div class="sub-actions"><button data-subjump="${x.id}">${esc(T.jump)}</button><button data-subsel="${x.id}">${esc(T.selectLayer)}</button>${changed ? `<button data-subreset="${x.id}">${esc(T.reset)}</button>` : ''}</div></div>` : ''}
  </div>`;
}
function subsSection(T) {
  const q = S.subQuery.trim().toLowerCase();
  const list = SUBS.filter(x => {
    const l = layer(x.layer);
    if (S.subNow && !(l && S.t >= l.in && S.t < l.out)) return false;
    return !q || (x.id + ' ' + x.zh + ' ' + x.en + ' ' + sub(x.id)).toLowerCase().includes(q);
  });
  const allOpen = SUBS.every(x => S.subOpen.has(x.id));
  return sec('subs', esc(T.subs), `
    <p class="panel-help">${esc(T.subsHelp)}</p>
    <div class="sub-tools">
      <input type="search" id="subSearch" placeholder="${esc(T.subsSearch)}" value="${esc(S.subQuery)}" aria-label="${esc(T.subsSearch)}">
      <button class="chip-btn" id="subNow" aria-pressed="${S.subNow}">${esc(T.subsNow)}</button>
      <button class="chip-btn" id="subAll">${esc(allOpen ? T.collapseAll : T.expandAll)}</button>
    </div>
    <div class="sub-list" id="subList">${list.length ? list.map(x => subRow(x, T)).join('') : `<p class="empty">${esc(T.subsNone)}</p>`}</div>`,
    `<span class="aside">${esc(T.subsCount(SUBS.length))}</span>`);
}
const footer = document.getElementById('insFooter');
function renderInspector() { renderInspectorBody(); panel.querySelectorAll('textarea').forEach(autoGrow); }
function renderInspectorBody() {
  const T = tx();
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  renderFooter();
  if (S.tab !== 'scene') {
    panel.innerHTML = sec(S.tab, esc(S.tab === 'effects' ? T.effectsH : T.audioH), `<p class="empty">${esc(T.untouched)}</p>`);
    return;
  }
  const l = layer(S.sel), tk = S.tokens;
  const physics = sec('design', esc(T.tabDesign), dsCard(T), '<span class="aside">design.json</span>');
  const subs = subsSection(T);
  if (!l) { panel.innerHTML = sec('layer', esc(T.layer), `<p class="empty">${esc(T.noLayer)}</p>`) + subs + physics; return; }
  const ov = overrides()[l.id], nOv = ov ? Object.keys(ov).length : 0, ph = phases(l), len = l.out - l.in;
  const pct = t => (t / D * 100).toFixed(3) + '%';
  const field = (id, label, v) => `<label class="field"><span>${esc(label)}</span><span class="num"><input type="number" id="${id}" step="0.0333" min="0" max="${D}" value="${r3(v)}" ${l.locked ? 'disabled' : ''}><i>s</i></span></label>`;
  panel.innerHTML = sec('layer', esc(T.layer), `
    <div class="ins-head" style="--c:${l.color}">
      <span class="ins-swatch"></span>
      <div class="ins-title"><strong>${esc(nameOf(l))}</strong><code>${l.src}</code></div>
    </div>
    ${nOv || l.locked || l.hidden ? `<div class="pills">
      ${nOv ? `<span class="pill warn">${nOv} ${esc(T.overrides)}<button class="pill-btn" id="revertLayer">${esc(T.revert)}</button></span>` : ''}
      ${l.hidden ? `<span class="pill">${esc(T.hidden)}</span>` : ''}${l.locked ? `<span class="pill">${esc(T.locked)}</span>` : ''}</div>` : ''}
    <div class="lay-block">
      <div class="phase-bar" style="--c:${l.color}" aria-hidden="true">
        <i class="pz enter" style="flex:${ph.enter}"></i><i class="pz hold" style="flex:${ph.hold}"></i><i class="pz exit" style="flex:${ph.exit}"></i>
      </div>
      <div class="trio">${field('f-in', T.in, l.in)}${field('f-out', T.out, l.out)}${field('f-len', T.length, len)}</div>
    </div>
    <div class="motion-pair">${motionSelect(l, 'enter', ph.enter)}${motionSelect(l, 'exit', ph.exit)}</div>`,
    `<button class="icon-btn" data-act="eye" aria-pressed="${!l.hidden}" aria-label="${esc(l.hidden ? T.show : T.hide)}" title="${esc(l.hidden ? T.show : T.hide)} (H)">${l.hidden ? ICON.eyeOff : ICON.eye}</button>`)
  + subs + physics;
}
/** Bottom of the inspector, like the editor's Frame review: the files the editor writes, then frame review. */
const copyOverrides = () => Object.fromEntries(Object.entries(S.copy).filter(([k, v]) => v !== SUBS.find(x => x.id === k)?.text));
function renderFooter() {
  const T = tx(), o = overrides(), n = Object.keys(o).length;
  const sig = JSON.stringify([S.lang, o, copyOverrides(), S.tokens.scheme, S.tokens.timeScale, S.tokens.motion]);
  if (footer.dataset.sig === sig) return;
  footer.dataset.sig = sig;
  const openJson = footer.querySelector('#jsonDetails')?.open ?? false, openReview = footer.querySelector('#reviewDetails')?.open ?? false;
  footer.innerHTML = `
    <details id="jsonDetails" ${openJson ? 'open' : ''}><summary>${esc(T.jsonH)}<span class="aside">${n} ${esc(T.overrides)}</span></summary>
      <p class="panel-help">${esc(T.jsonIntro)}</p>
      <div class="file-h">${ICON.file}scenes/timeline.json</div>${n ? `<pre class="json">${hl(o)}</pre>` : `<p class="empty">${esc(T.jsonEmpty)}</p>`}
      <div class="file-h">${ICON.file}copy.json</div>${Object.keys(copyOverrides()).length ? `<pre class="json">${hl(copyOverrides())}</pre>` : `<p class="empty">${esc(T.copyEmpty)}</p>`}
      <div class="file-h">${ICON.file}design.json · motion</div><pre class="json">${hl({ scheme: S.tokens.scheme, timeScale: S.tokens.timeScale, motion: S.tokens.motion })}</pre>
      <button id="resetAll">${esc(T.revertAll)}</button>
    </details>
    <details id="reviewDetails" ${openReview ? 'open' : ''}><summary>${esc(T.frameReview)}</summary><p class="panel-help">${esc(T.frameHelp)}</p><button class="review-button" disabled>${esc(T.frameBtn)}</button></details>`;
}
panel.addEventListener('change', e => {
  const el = e.target, l = layer(S.sel);
  if (el.id === 'tk-ts') return commit(() => { S.tokens.timeScale = clamp(Number(el.value) || 1, .5, 4); });
  if (el.dataset.mo) return commit(() => { S.tokens.motion[el.dataset.mo].speed = el.value; });
  if (!l) return;
  if (el.dataset.side) return setPreset(l, el.dataset.side, el.value);
  const v = Number(el.value);
  if (!Number.isFinite(v)) return render();
  if (el.id === 'f-in') return commit(() => { l.in = clamp(qf(v), 0, l.out - FRAME); });
  if (el.id === 'f-out') return commit(() => { l.out = clamp(qf(v), l.in + FRAME, D); });
  if (el.id === 'f-len') return commit(() => { l.out = clamp(qf(l.in + Math.max(FRAME, v)), l.in + FRAME, D); });
});
const onPanelClick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  const l = layer(S.sel);
  if (b.id === 'revertLayer') commit(() => { Object.assign(l, clone(def(S.sel))); });
  if (b.id === 'resetAll') { commit(() => { S.layers = clone(DEFAULTS); S.tokens = M.clone(M.DEFAULT); }); toast(tx().toastReset); }
  if (b.dataset.act === 'eye') commit(() => { l.hidden = !l.hidden; });
  if (b.dataset.preset) setPreset(l, b.dataset.side, b.dataset.preset);
  if (b.dataset.scheme) commit(() => { S.tokens.scheme = b.dataset.scheme; });
  if (b.dataset.mo && b.dataset.speed) commit(() => { S.tokens.motion[b.dataset.mo].speed = b.dataset.speed; });
  if (b.id === 'openDs') openDesign();
  if (b.dataset.fold) { const k = b.dataset.fold; S.folded.has(k) ? S.folded.delete(k) : S.folded.add(k); save(); renderInspector(); }
  if (b.dataset.sub) { const k = b.dataset.sub; S.subOpen.has(k) ? S.subOpen.delete(k) : S.subOpen.add(k); renderInspector(); if (S.subOpen.has(k)) { const ta = document.getElementById('sub-' + k); ta?.focus(); ta?.setSelectionRange(ta.value.length, ta.value.length); } }
  if (b.id === 'subAll') { const all = SUBS.every(x => S.subOpen.has(x.id)); S.subOpen = all ? new Set() : new Set(SUBS.map(x => x.id)); renderInspector(); }
  if (b.id === 'subNow') { S.subNow = !S.subNow; renderInspector(); }
  if (b.dataset.subjump) { const x = SUBS.find(y => y.id === b.dataset.subjump), ly = layer(x.layer); pause(); seek(ly.in + phases(ly).enter); renderInspector(); renderTimeline(); }
  if (b.dataset.subsel) { const x = SUBS.find(y => y.id === b.dataset.subsel); select(x.layer); render(); }
  if (b.dataset.subreset) { delete S.copy[b.dataset.subreset]; save(); frame(); renderInspector(); }
};
panel.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.subtext) { S.copy[el.dataset.subtext] = el.value; save(); frame(); renderFooter(); autoGrow(el); }
  if (el.id === 'subSearch') { S.subQuery = el.value; const pos = el.selectionStart; renderInspector(); const n = document.getElementById('subSearch'); n.focus(); n.setSelectionRange(pos, pos); }
});
panel.addEventListener('focusout', e => { if (e.target.dataset?.subtext && !e.relatedTarget?.closest?.('#panel')) renderTimeline(); });
const autoGrow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
panel.addEventListener('click', onPanelClick);
footer.addEventListener('click', onPanelClick);

// ------------------------------------------------------------------ actions
function openDesign() { save(); location.href = 'design.html'; }
window.addEventListener('storage', e => { if (e.key === M.KEY) { S.tokens = M.load(); render(); } });
function select(id) { S.sel = id; subsOf(id).forEach(x => S.subOpen.add(x.id)); }
function setPreset(l, side, name) {
  if (!l) return toast(tx().toastSel);
  if (l.locked) return toast(tx().toastLocked);
  commit(() => { l[side] = name; });
  if (durOf(l.enter) + durOf(l.exit) > l.out - l.in) toast(tx().toastShort);
}
function moveLayer(l, dt) { l.in += dt; l.out += dt; }
function nudge(dt) {
  const l = layer(S.sel);
  if (!l) return toast(tx().toastSel);
  if (l.locked) return toast(tx().toastLocked);
  commit(() => moveLayer(l, clamp(dt, -l.in, D - l.out)));
}
function seek(t) { S.t = clamp(qf(t), 0, D - FRAME); frame(); }
function setZoom(z, anchorClientX) {
  const rect = scroller.getBoundingClientRect();
  const cx = anchorClientX ?? (rect.left + nameW() + X(S.t) - scroller.scrollLeft);
  const tAnchor = timeAtClient(cx);
  S.zoom = clamp(z, 1, 8);
  render();
  scroller.scrollLeft = nameW() + X(tAnchor) - (cx - rect.left);
}

// ------------------------------------------------------------------ snapping
function snapTime(t, e, skip) {
  if (e.metaKey || e.ctrlKey) return { t: qf(t), guide: null };
  const T = tx(), thr = 8 / trackW() * D;
  const cands = [[0, T.snapStart], [D, T.snapEnd], [S.t, T.snapHead]];
  for (let b = 0; b <= D + 1e-6; b += BEAT) cands.push([b, Math.abs(b / BAR - Math.round(b / BAR)) < 1e-6 ? T.snapBar : T.snapBeat]);
  for (const l of S.layers) if (l.id !== skip) cands.push([l.in, T.snapEdge], [l.out, T.snapEdge]);
  let best = null;
  for (const [c, label] of cands) { const d = Math.abs(c - t); if (d <= thr && (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && label === T.snapBar))) best = { d, t: c, label }; }
  return best ? { t: best.t, guide: { t: best.t, label: best.label } } : { t: qf(t), guide: null };
}

// ------------------------------------------------------------------ pointer: drag solids, ends, playhead
let drag = null;
inner.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, l = el.dataset.layer && layer(el.dataset.layer);
  if (act === 'seek') {
    pause(); seek(timeAtClient(e.clientX));
    drag = { move: ev => seek(timeAtClient(ev.clientX)) };
  } else if (act === 'move' || act === 'trim-in' || act === 'trim-out') {
    select(l.id); pause();
    if (l.locked) { render(); return toast(tx().toastLocked); }
    const before = snap(), x0 = e.clientX, a = l.in, b = l.out;
    drag = {
      move: ev => {
        const dt = (ev.clientX - x0) / trackW() * D;
        let guide = null;
        if (act === 'move') {
          const sIn = snapTime(a + dt, ev, l.id), sOut = snapTime(b + dt, ev, l.id);
          let ndt;
          if (sIn.guide && (!sOut.guide || Math.abs(sIn.t - (a + dt)) <= Math.abs(sOut.t - (b + dt)))) { ndt = sIn.t - a; guide = sIn.guide; }
          else if (sOut.guide) { ndt = sOut.t - b; guide = sOut.guide; }
          else ndt = qf(a + dt) - a;
          ndt = clamp(ndt, -a, D - b);
          l.in = a + ndt; l.out = b + ndt;
        } else if (act === 'trim-in') {
          const s = snapTime(a + dt, ev, l.id); guide = s.guide; l.in = clamp(s.t, 0, b - FRAME);
        } else {
          const s = snapTime(b + dt, ev, l.id); guide = s.guide; l.out = clamp(s.t, a + FRAME, D);
        }
        S.guide = guide; render();
      },
      end: () => { if (snap() !== before) { past.push(before); future.length = 0; save(); } }
    };
    render();
  } else return;
  e.preventDefault();
});
window.addEventListener('pointermove', e => { if (drag) drag.move(e); });
window.addEventListener('pointerup', () => { if (!drag) return; drag.end && drag.end(); drag = null; S.guide = null; render(); });
inner.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.layer, l = id && layer(id);
  if (act === 'eye') { select(id); commit(() => { l.hidden = !l.hidden; }); }
  else if (act === 'select') { select(id); S.tab = 'scene'; render(); }
});
scroller.addEventListener('wheel', e => {
  if (!(e.metaKey || e.ctrlKey)) return;
  e.preventDefault();
  setZoom(S.zoom * Math.exp(-e.deltaY * .002), e.clientX);
}, { passive: false });

// ------------------------------------------------------------------ keyboard
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (keysDlg.open || tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if (S.mode === 'present') return presentKey(e);
  if (e.key === '?') { e.preventDefault(); return openKeys(); }
  const mod = e.metaKey || e.ctrlKey, l = layer(S.sel), c = e.code;
  if (mod && c === 'KeyZ') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (mod) return;
  const hit = () => e.preventDefault();
  const digit = /^Digit([1-6])$/.exec(c);
  if (digit) { hit(); return setPreset(l, e.shiftKey ? 'exit' : 'enter', PRESETS[Number(digit[1]) - 1]); }
  switch (c) {
    case 'Space': hit(); return toggle();
    case 'ArrowLeft': hit(); pause(); return seek(S.t - (e.shiftKey ? BEAT : FRAME));
    case 'ArrowRight': hit(); pause(); return seek(S.t + (e.shiftKey ? BEAT : FRAME));
    case 'Home': hit(); pause(); return seek(0);
    case 'End': hit(); pause(); return seek(D);
    case 'Comma': hit(); return nudge(-(e.shiftKey ? BEAT : FRAME));
    case 'Period': hit(); return nudge(e.shiftKey ? BEAT : FRAME);
    case 'BracketLeft': case 'BracketRight': {
      hit();
      if (!l) return toast(tx().toastSel);
      if (l.locked) return toast(tx().toastLocked);
      const left = c === 'BracketLeft', t = qf(S.t);
      if (e.altKey) return commit(() => { if (left) l.in = clamp(t, 0, l.out - FRAME); else l.out = clamp(t, l.in + FRAME, D); });
      return commit(() => moveLayer(l, clamp(left ? t - l.in : t - l.out, -l.in, D - l.out)));
    }
    case 'KeyL': if (e.shiftKey) { hit(); S.loop = !S.loop; renderChrome(); } return;
    case 'KeyH': hit(); if (!l) return toast(tx().toastSel); return commit(() => { l.hidden = !l.hidden; });
    case 'Delete': case 'Backspace': hit(); return toast(tx().toastNoDelete);
    case 'Minus': hit(); return setZoom(S.zoom / 1.25);
    case 'Equal': hit(); return setZoom(S.zoom * 1.25);
  }
});

// ------------------------------------------------------------------ playback
let raf = 0, lastTs = 0;
function play() { if (S.playing) return; if (S.t >= D - FRAME) S.t = 0; S.playing = true; lastTs = performance.now(); raf = requestAnimationFrame(tick); renderChrome(); }
function pause() { S.stopAt = null; if (!S.playing) return; S.playing = false; cancelAnimationFrame(raf); S.t = qf(S.t); renderChrome(); renderInspector(); }
function toggle() { S.playing ? pause() : play(); }
function tick(now) {
  S.t += (now - lastTs) / 1000; lastTs = now;
  if (S.stopAt !== null && S.t >= S.stopAt) { S.t = S.stopAt; S.stopAt = null; frame(); return pause(); }
  if (S.t >= D) { if (S.loop) S.t = S.t % D; else { S.t = D - FRAME; frame(); return pause(); } }
  frame();
  const x = nameW() + X(S.t) - scroller.scrollLeft;
  if (x > scroller.clientWidth - 40 || x < nameW()) scroller.scrollLeft = X(S.t) - 40;
  raf = requestAnimationFrame(tick);
}
const pad = n => String(n).padStart(2, '0');
function frame() {
  drawScene(S.t); placePlayhead();
  const f = Math.round(S.t * FPS), s = Math.floor(f / FPS);
  document.getElementById('tc').textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(f % FPS)}`;
  document.getElementById('secs').textContent = S.t.toFixed(2) + ' s';
  if (S.mode === 'present') frameStrip();
}

// ------------------------------------------------------------------ chrome + i18n
function renderChrome() {
  const T = tx();
  document.documentElement.lang = S.lang === 'zh' ? 'zh-Hant' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', T[el.dataset.i18nAria]));
  document.querySelectorAll('[data-i18n-title]').forEach(el => el.setAttribute('title', T[el.dataset.i18nTitle]));
  document.getElementById('keysGrid').innerHTML = T.groups.map(([title, items]) => `<section><h3>${esc(title)}</h3><dl>${items.map(([k, v]) => `<div><dt>${k.split(' ').map(x => `<kbd>${esc(x)}</kbd>`).join('')}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`).join('');
  const pb = document.getElementById('btn-projects'), present = S.mode === 'present';
  pb.setAttribute('aria-label', present ? T.slides : T.projects); pb.setAttribute('title', present ? T.slidesKey : T.projectsKey);
  document.getElementById('lang-zh').setAttribute('aria-checked', String(S.lang === 'zh'));
  document.getElementById('lang-en').setAttribute('aria-checked', String(S.lang === 'en'));
  document.getElementById('langSwitch').dataset.pos = S.lang === 'en' ? '1' : '0';
  document.getElementById('den-compact').setAttribute('aria-checked', String(S.density === 'compact'));
  document.getElementById('den-std').setAttribute('aria-checked', String(S.density !== 'compact'));
  document.getElementById('btn-loop').setAttribute('aria-pressed', String(S.loop));
  document.getElementById('btn-play').setAttribute('aria-label', S.playing ? T.pause : T.play);
  document.getElementById('playIcon').innerHTML = S.playing ? '<path d="M7.5 5v14M16.5 5v14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' : '<path fill="currentColor" d="M7 4.5v15l12.5-7.5z"/>';
  document.getElementById('zoom').value = S.zoom;
  document.getElementById('zoomOut').textContent = Math.round(S.zoom * 100) + '%';
  const l = layer(S.sel);
  document.getElementById('stageTag').textContent = S.view === 'real' && REAL ? (realRT ? T.realTag : T.realLoading) : l ? `${nameOf(l)} · ${presetName(l.enter)} → ${presetName(l.exit)}` : '';
  const vs = document.getElementById('viewSeg');
  if (vs) { vs.hidden = !REAL; vs.setAttribute('aria-label', T.viewLabel); vs.querySelectorAll('[data-view]').forEach(b => { b.textContent = b.dataset.view === 'real' ? T.viewReal : T.viewMock; b.setAttribute('aria-checked', String(S.view === b.dataset.view)); b.title = b.dataset.view === 'real' ? T.realNote : ''; }); }
}
function render() { renderChrome(); renderTimeline(); renderInspector(); frame(); }

let toastTimer = 0;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

// ------------------------------------------------------------------ shortcuts window
const keysDlg = document.getElementById('keysDlg');
function openKeys() { pause(); if (!keysDlg.open) keysDlg.showModal(); }
document.getElementById('btn-keys').addEventListener('click', openKeys);
document.getElementById('keysClose').addEventListener('click', () => keysDlg.close());
keysDlg.addEventListener('click', e => { if (e.target === keysDlg) keysDlg.close(); });

// ------------------------------------------------------------------ inspector drawer (narrow windows)
const app = document.getElementById('app'), panelBtn = document.getElementById('btn-panel');
function setDrawer(open) { app.classList.toggle('panel-open', open); panelBtn.setAttribute('aria-expanded', String(open)); }
panelBtn.addEventListener('click', () => setDrawer(!app.classList.contains('panel-open')));
document.getElementById('scrim').addEventListener('click', () => setDrawer(false));

// ------------------------------------------------------------------ wiring
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { S.lang = b.dataset.lang; save(); render(); }));
document.querySelectorAll('[data-den]').forEach(b => b.addEventListener('click', () => { S.density = b.dataset.den; save(); render(); }));
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { S.tab = b.dataset.tab; renderInspector(); }));
document.getElementById('zoom').addEventListener('input', e => setZoom(Number(e.target.value)));
document.getElementById('btn-fit').addEventListener('click', () => { setZoom(1); scroller.scrollLeft = 0; });
document.getElementById('btn-play').addEventListener('click', toggle);
document.getElementById('btn-start').addEventListener('click', () => { pause(); seek(0); });
document.getElementById('btn-end').addEventListener('click', () => { pause(); seek(D); });
document.getElementById('btn-prev').addEventListener('click', () => { pause(); seek(S.t - FRAME); });
document.getElementById('btn-next').addEventListener('click', () => { pause(); seek(S.t + FRAME); });
document.getElementById('btn-loop').addEventListener('click', () => { S.loop = !S.loop; renderChrome(); });
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-export').addEventListener('click', () => toast(tx().toastExportVideo));
window.addEventListener('pointerup', e => { if (!S.playing && S.mode === 'video' && S.tab === 'scene' && !e.target.closest?.('#inspector')) renderInspector(); });
new ResizeObserver(() => { fitStage(); render(); }).observe(document.getElementById('app'));
fitStage(); render();
if (document.fonts) document.fonts.ready.then(() => { frame(); if (S.mode === 'present') renderRail(); });
requestAnimationFrame(() => { scroller.scrollLeft = 0; });

// ------------------------------------------------------------------ projects panel (left), with search
const PTEXT = {
  zh: { title: '專案', search: '搜尋專案', newBtn: '新專案', create: q => `建立「${q}」`, none: q => `沒有符合「${q}」的專案。`, results: n => `${n} 個結果`,
    groups: { component: '內建元件', recent: '最近', library: '專案資料夾', example: '範例' }, now: '目前開啟', ready: '即用動畫', opening: n => `原型：會切換到 ${n}`, creating: n => `原型：會建立專案 ${n}`,
    ago: m => m < 60 ? `${m} 分鐘前` : m < 1440 ? `${Math.floor(m / 60)} 小時前` : `${Math.floor(m / 1440)} 天前`, keyHint: '/ 搜尋 · ↑↓ 選擇 · Enter 開啟' },
  en: { title: 'Projects', search: 'Search projects', newBtn: 'New project', create: q => `Create “${q}”`, none: q => `No projects match “${q}”.`, results: n => `${n} results`,
    groups: { component: 'Built-in components', recent: 'Recent', library: 'Projects folder', example: 'Examples' }, now: 'Open now', ready: 'Ready-to-use animation', opening: n => `Prototype: would switch to ${n}`, creating: n => `Prototype: would create ${n}`,
    ago: m => m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`, keyHint: '/ search · ↑↓ move · Enter open' }
};
const COMPONENTS = ['Stagger text', 'Typewriter', 'Pop card', 'Progress bar', 'Pulse dots', 'Logo reveal', 'Social card', 'YouTube subscribe', 'AI chat', 'Like burst', 'Follow badge', 'Notification toast', 'Lower third', 'Count up', 'Toggle switch', 'Audio wave'];
const LIBRARY = ['apple-film', 'arduino-film', 'chatgpt-dot', 'claude-film', 'cursor-film', 'duopurse', 'etf-ipo', 'figma-film', 'filmbatch-promo', 'google-film', 'google-motion', 'grok-promo', 'hopbite-promo', 'kyron-film', 'lohas-app-demo', 'lohas-care', 'lunar-pop-club', 'mascot-walk', 'mografy-discord', 'mografy-launch', 'mografy-promo', 'mografy-story', 'mografy-tutorial', 'mografy-update', 'momo-moonlight-pv', 'notion-film', 'nvidia-film', 'qlite-brand', 'qlite-promo', 'qto-brand', 'superhunter', 'three-demo', 'trig-derivative', 'umbrella-film', 'veldra-film'];
const RECENT = [['lunar-pop-club', 0], ['superhunter', 95], ['qlite-promo', 610], ['mografy-story', 1500], ['duopurse', 2900]];
const PROJECTS = [
  ...COMPONENTS.map(n => ({ kind: 'component', name: n, id: 'c:' + n })),
  ...RECENT.map(([n, m]) => ({ kind: 'recent', name: n, id: 'r:' + n, mins: m })),
  ...LIBRARY.filter(n => !RECENT.some(r => r[0] === n)).map((n, i) => ({ kind: 'library', name: n, id: 'l:' + n, mins: 3000 + i * 1440 })),
  ...['analytics-product', 'follow-interaction', 'mografy-brand', 'mografy-intro'].map(n => ({ kind: 'example', name: n, id: 'e:' + n }))
];
const CURRENT = 'lunar-pop-club';
const P = { q: '', active: 0 };
const projectsEl = document.getElementById('projects');
/** Keep an item visible inside the projects list without scrolling the page. */
function keepInList(el) {
  const box = projectsEl.querySelector('.p-list');
  if (!el || !box || !box.clientHeight) return;
  const r = el.getBoundingClientRect(), o = box.getBoundingClientRect();
  if (r.top < o.top) box.scrollTop += r.top - o.top - 6; else if (r.bottom > o.bottom) box.scrollTop += r.bottom - o.bottom + 6;
}
const hue = n => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const mark = (name, q) => {
  if (!q) return esc(name);
  const i = name.toLowerCase().indexOf(q);
  return i < 0 ? esc(name) : esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
};
/** Loose match: every typed character appears in order, so "lpc" finds lunar-pop-club. */
function score(name, q) {
  const n = name.toLowerCase();
  if (!q) return 1;
  if (n.includes(q)) return 3 - n.indexOf(q) / 100;
  let i = 0;
  for (const c of n) if (c === q[i]) i++;
  return i === q.length ? 1 : 0;
}
function matches() {
  const q = P.q.trim().toLowerCase();
  return PROJECTS.map(p => ({ p, s: score(p.name, q) })).filter(x => x.s > 0);
}
function renderProjects() {
  const PT = PTEXT[S.lang], q = P.q.trim().toLowerCase(), found = matches();
  const flat = q ? [...found].sort((a, b) => b.s - a.s).map(x => x.p) : found.map(x => x.p);
  P.active = clamp(P.active, 0, Math.max(0, flat.length - 1));
  const item = (p, i) => `<li><button class="project-item ${p.kind === 'component' ? 'component-item' : ''} ${p.name === CURRENT ? 'current' : ''} ${q && i === P.active ? 'active' : ''}" data-project="${p.id}" ${p.name === CURRENT ? 'aria-current="true"' : ''}>
      <span class="thumb" style="--h:${hue(p.name)}"><i></i></span>
      <span class="project-text"><span class="project-name">${mark(p.name, q)}</span>
      <span class="project-meta">${p.name === CURRENT ? PT.now : p.kind === 'component' ? PT.ready : p.mins !== undefined ? PT.ago(p.mins) : PT.groups[p.kind]}</span></span>
    </button></li>`;
  let body;
  if (!flat.length) body = `<div class="p-empty"><p>${esc(PT.none(P.q.trim()))}</p><button class="new-button" data-create>${esc(PT.create(P.q.trim()))}</button></div>`;
  else if (q) body = `<section><h3>${esc(PT.results(flat.length))}</h3><ul>${flat.map((p, i) => item(p, i)).join('')}</ul></section>`;
  else body = Object.keys(PT.groups).map(k => { const items = flat.filter(p => p.kind === k); return items.length ? `<section><h3>${esc(PT.groups[k])}<span>${items.length}</span></h3><ul>${items.map(p => item(p, -1)).join('')}</ul></section>` : ''; }).join('');
  const had = document.activeElement?.id === 'pSearch', pos = had ? document.activeElement.selectionStart : 0;
  projectsEl.innerHTML = `<header><h2>${esc(PT.title)}</h2><button class="p-new" data-create title="${esc(PT.newBtn)}" aria-label="${esc(PT.newBtn)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></header>
    <div class="p-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
      <input type="search" id="pSearch" placeholder="${esc(PT.search)}" value="${esc(P.q)}" aria-label="${esc(PT.search)}" autocomplete="off" spellcheck="false"><kbd>/</kbd></div>
    <div class="p-list">${body}</div>
    <p class="p-hint">${esc(PT.keyHint)}</p>`;
  if (had) { const el = document.getElementById('pSearch'); el.focus(); el.setSelectionRange(pos, pos); }
  keepInList(projectsEl.querySelector('.project-item.active'));
}
function openProject(p) { toast(PTEXT[S.lang].opening(p.name)); }
projectsEl.addEventListener('input', e => { if (e.target.id === 'pSearch') { P.q = e.target.value; P.active = 0; renderProjects(); } });
projectsEl.addEventListener('keydown', e => {
  if (e.target.id !== 'pSearch') return;
  const list = [...projectsEl.querySelectorAll('.project-item')];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); P.active = clamp(P.active + (e.key === 'ArrowDown' ? 1 : -1), 0, list.length - 1); if (!P.q) P.q = ''; renderProjectsActive(list); }
  if (e.key === 'Enter') { e.preventDefault(); const b = list[P.q.trim() ? P.active : 0]; if (b) openProject(PROJECTS.find(p => p.id === b.dataset.project)); else if (P.q.trim()) toast(PTEXT[S.lang].creating(P.q.trim())); }
  if (e.key === 'Escape') { if (P.q) { P.q = ''; renderProjects(); } else e.target.blur(); }
});
function renderProjectsActive(list) {
  list.forEach((b, i) => b.classList.toggle('active', i === P.active));
  keepInList(list[P.active]);
}
projectsEl.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.project) openProject(PROJECTS.find(p => p.id === b.dataset.project));
  if (b.hasAttribute('data-create')) toast(PTEXT[S.lang].creating(P.q.trim() || 'untitled'));
});
const projBtn = document.getElementById('btn-projects');
function setProjects(open) { app.classList.toggle('projects-open', open); app.classList.toggle('projects-closed', !open); projBtn.setAttribute('aria-pressed', String(open)); }
projBtn.addEventListener('click', () => S.mode === 'present' ? setRail(!S.rail) : setProjects(!app.classList.contains('projects-open')));
setProjects(innerWidth >= 1280);
document.getElementById('scrim').addEventListener('click', () => { if (innerWidth < 1280) setProjects(false); });
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || keysDlg.open || e.metaKey || e.ctrlKey || S.mode === 'present') return;
  if (e.key === '/') { e.preventDefault(); setProjects(true); document.getElementById('pSearch').focus(); }
  if (e.code === 'KeyP' && !e.shiftKey) { e.preventDefault(); setProjects(!app.classList.contains('projects-open')); }
}, true);
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', renderProjects));
renderProjects();

// ------------------------------------------------------------------ Video / Present (same scene, two modes)
// Present builds slides on the same scene. Each slide is a shot: it plays from the previous stop and
// holds still at its own stop. The editor never autoplays; picking a slide shows its stop frame.
// Without meta.shots the stops are guessed from the layers, so moving a layer moves its slide.
const SHOTS = [
  { layer: 'title', title: () => sub('S01') },
  { layer: 'blocks', title: () => sub('S02') },
  { layer: 'rise', title: () => S.lang === 'zh' ? '月出' : 'Moonrise' },
  { layer: 'ch1', title: () => '01 ' + sub('S03') },
  { layer: 'ch2', title: () => '02 ' + sub('S04') },
  { layer: 'ch3', title: () => '03 ' + sub('S05') },
  { layer: 'logo', title: () => sub('S06') }
];
/** Slides with their stop: the frame where the layer's enter motion has settled, plus half a second. */
function slides() {
  if (REAL && S.view === 'real' && REAL.meta.shots?.length) {
    let prev = 0;
    return REAL.meta.shots.map(x => { const s = { from: prev, at: qf(x.stop), title: x.title }; prev = s.at; return s; });
  }
  let from = 0;
  return SHOTS.map(x => {
    const l = layer(x.layer), ph = phases(l);
    const at = qf(clamp(Math.min(l.in + ph.enter + .5, l.out - ph.exit - FRAME), 0, D - FRAME));
    const s = { from: Math.min(from, at), at, title: x.title() };
    from = at;
    return s;
  });
}
const modeSwitch = document.getElementById('modeSwitch'), railEl = document.getElementById('rail'), stripTrack = document.getElementById('stripTrack');
const fmtS = t => Number(t.toFixed(2));
function setMode(mode, quiet) {
  if (mode === S.mode && !quiet) return;
  pause(); exitShow();
  S.mode = mode; save();
  app.classList.toggle('mode-present', mode === 'present');
  modeSwitch.dataset.mode = mode;
  modeSwitch.querySelectorAll('button').forEach(b => { const on = b.dataset.mode === mode; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  setDrawer(false);
  if (mode === 'present') { S.slide = clamp(S.slide, 0, slides().length - 1); showSlide(S.slide); setRail(S.rail); }
  else { projBtn.setAttribute('aria-pressed', String(app.classList.contains('projects-open'))); }
  renderPresentChrome();
  requestAnimationFrame(() => { fitStage(); render(); });
  if (!quiet) toast(mode === 'present' ? tx().toastPresent : tx().toastVideo);
}
function setRail(open) { S.rail = open; app.classList.toggle('rail-off', !open); projBtn.setAttribute('aria-pressed', String(open)); requestAnimationFrame(fitStage); }
/** Show a slide's stop frame (no playback). */
function showSlide(i) { const list = slides(); S.slide = clamp(i, 0, list.length - 1); pause(); seek(list[S.slide].at); save(); renderRailState(); }
/** Preview a slide: play from the previous stop and hold at this one. */
function playSlide(i) {
  const list = slides(); S.slide = clamp(i, 0, list.length - 1); save(); renderRailState();
  const s = list[S.slide];
  pause(); S.t = s.from; play(); S.stopAt = s.at;
}
function renderRail() {
  const T = tx(), list = slides();
  railEl.innerHTML = `<header><h2>${esc(T.slides)}</h2><span class="rail-count">${list.length}</span></header>
    <ol>${list.map((s, i) => `<li><button class="rail-slide" data-slide="${i}" title="${esc(T.stopsAt(fmtS(s.at)))}" aria-label="${esc(T.slideN(i + 1, list.length) + ' · ' + s.title)}">
      <span class="rail-number">${i + 1}</span><span class="rail-thumb"><canvas width="320" height="180"></canvas></span><span class="rail-title">${esc(s.title)}</span></button></li>`).join('')}</ol>
    <p class="rail-hint"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg><span>${esc(REAL && S.view === 'real' ? T.railHintReal : T.railHint)}</span></p>`;
  paintThumbs(list);
  renderRailState();
}
/** Thumbnails are the stage itself, drawn at each stop and copied down. */
function paintThumbs(list) {
  const canvases = railEl.querySelectorAll('.rail-thumb canvas');
  list.forEach((s, i) => { drawScene(s.at); const c = canvases[i].getContext('2d'); c.drawImage(cv, 0, 0, 320, 180); });
  drawScene(S.t);
}
function renderRailState() {
  railEl.querySelectorAll('.rail-slide').forEach(b => { const on = Number(b.dataset.slide) === S.slide; b.classList.toggle('current', on); b.setAttribute('aria-current', on ? 'true' : 'false'); });
  const cur = railEl.querySelector('.rail-slide.current');
  // Scroll only the rail's own list, never the page.
  const ol = railEl.querySelector('ol');
  if (cur && ol && S.mode === 'present') {
    const r = cur.getBoundingClientRect(), o = ol.getBoundingClientRect();
    if (r.top < o.top) ol.scrollTop += r.top - o.top - 8; else if (r.bottom > o.bottom) ol.scrollTop += r.bottom - o.bottom + 8;
    if (r.left < o.left) ol.scrollLeft += r.left - o.left - 8; else if (r.right > o.right) ol.scrollLeft += r.right - o.right + 8;
  }
  renderStrip();
}
function renderStrip() {
  const list = slides(), T = tx();
  stripTrack.innerHTML = `<div class="strip-fill" id="stripFill"></div>${list.map((s, i) => `<button class="stop-mark ${i === S.slide ? 'on' : ''}" data-stop="${i}" style="left:${s.at / D * 100}%" title="${esc(T.slideN(i + 1, list.length) + ' · ' + T.stopsAt(fmtS(s.at)))}" aria-label="${esc(T.slideN(i + 1, list.length))}"></button>`).join('')}<div class="strip-head" id="stripHead"></div>`;
  document.getElementById('stripCount').textContent = `${S.slide + 1} / ${list.length}`;
  document.getElementById('showCount').textContent = `${S.slide + 1} / ${list.length}`;
  document.getElementById('sl-prev').disabled = S.slide <= 0;
  document.getElementById('sl-next').disabled = S.slide >= list.length - 1;
  frameStrip();
}
function frameStrip() {
  const head = document.getElementById('stripHead'); if (!head) return;
  const pct = S.t / D * 100 + '%';
  head.style.left = pct; document.getElementById('stripFill').style.width = pct;
  document.getElementById('stripTc').textContent = document.getElementById('tc').textContent;
  const T = tx(), btn = document.getElementById('sl-play');
  document.getElementById('slPlayIcon').innerHTML = S.playing ? '<path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' : '<path fill="currentColor" d="M7 4.5v15l12.5-7.5z"/>';
  btn.setAttribute('aria-label', S.playing ? T.pauseSlide : T.playSlide);
  document.getElementById('slideCtl').classList.toggle('playing', S.playing);
}
function renderPresentChrome() {
  const T = tx(), present = S.mode === 'present';
  const mute = document.getElementById('sl-mute');
  mute.setAttribute('aria-pressed', String(S.muted)); mute.classList.toggle('on', S.muted);
  mute.setAttribute('aria-label', S.muted ? T.unmute : T.mute); mute.setAttribute('title', S.muted ? T.unmute : T.mute);
  if (present) renderRail();
}
// Full-screen show: the stage fills the window, → plays the next slide, ← steps back, Esc returns.
function startShow() {
  if (S.mode !== 'present') return;
  app.classList.add('showing'); fitStage();
  document.documentElement.requestFullscreen?.().catch(() => {});
  showSlide(S.slide);
}
function exitShow() {
  if (!app.classList.contains('showing')) return;
  app.classList.remove('showing');
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  requestAnimationFrame(fitStage);
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) exitShow(); });
function presentKey(e) {
  const showing = app.classList.contains('showing'), n = slides().length, hit = () => e.preventDefault();
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.code) {
    case 'ArrowRight': case 'PageDown': hit(); return showing ? (S.slide < n - 1 ? playSlide(S.slide + 1) : null) : showSlide(S.slide + 1);
    case 'ArrowLeft': case 'PageUp': hit(); return showSlide(S.slide - 1);
    case 'Space': hit(); return S.playing ? pause() : playSlide(S.slide);
    case 'Home': hit(); return showSlide(0);
    case 'End': hit(); return showSlide(n - 1);
    case 'Escape': if (showing) { hit(); exitShow(); } return;
    case 'KeyP': if (!showing && !e.shiftKey) { hit(); setRail(!S.rail); } return;
    case 'KeyF': hit(); return showing ? exitShow() : startShow();
  }
}
modeSwitch.addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
modeSwitch.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault(); e.stopPropagation();
  const next = e.key === 'Home' ? 'video' : e.key === 'End' ? 'present' : S.mode === 'video' ? 'present' : 'video';
  setMode(next); modeSwitch.querySelector(`[data-mode="${next}"]`).focus();
});
railEl.addEventListener('click', e => { const b = e.target.closest('[data-slide]'); if (b) showSlide(Number(b.dataset.slide)); });
stripTrack.addEventListener('pointerdown', e => {
  const stop = e.target.closest('[data-stop]');
  if (stop) return showSlide(Number(stop.dataset.stop));
  const seekAt = ev => { const r = stripTrack.getBoundingClientRect(); seek(clamp((ev.clientX - r.left) / r.width, 0, 1) * D); };
  pause(); seekAt(e); stripTrack.setPointerCapture(e.pointerId);
  const move = ev => seekAt(ev), up = () => { stripTrack.removeEventListener('pointermove', move); stripTrack.removeEventListener('pointerup', up);
    const list = slides(); let i = 0; list.forEach((s, k) => { if (S.t >= s.from) i = k; }); S.slide = i; save(); renderRailState(); };
  stripTrack.addEventListener('pointermove', move); stripTrack.addEventListener('pointerup', up);
});
document.getElementById('sl-prev').addEventListener('click', () => showSlide(S.slide - 1));
document.getElementById('sl-next').addEventListener('click', () => showSlide(S.slide + 1));
document.getElementById('sl-play').addEventListener('click', () => S.playing ? pause() : playSlide(S.slide));
document.getElementById('sl-mute').addEventListener('click', () => { S.muted = !S.muted; save(); renderPresentChrome(); });
document.getElementById('btn-show').addEventListener('click', startShow);
document.getElementById('btn-export-html').addEventListener('click', () => toast(tx().toastExport));
surround.addEventListener('click', e => {
  if (!app.classList.contains('showing') || e.target.closest('.slide-controls')) return;
  if (S.slide < slides().length - 1) playSlide(S.slide + 1);
});
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', renderPresentChrome));
new ResizeObserver(fitStage).observe(surround);
setMode(S.mode, true);
// The page itself never scrolls on wide screens; undo any scroll the browser restored.
if (innerWidth > 560) { scrollTo(0, 0); document.body.scrollTop = 0; }
window.__mografyBooted = true;
// Real frames: start the scene runtime (half resolution keeps playback smooth), then redraw what shows it.
document.getElementById('viewSeg').addEventListener('click', e => {
  const b = e.target.closest('[data-view]'); if (!b || b.dataset.view === S.view) return;
  S.view = b.dataset.view; save(); renderChrome(); frame();
  if (S.mode === 'present') { S.slide = clamp(S.slide, 0, slides().length - 1); renderRail(); showSlide(S.slide); }
});
if (REAL) {
  (async () => {
    try {
      realRT = await REAL.start(realCanvas, 0.5);
      renderChrome(); frame();
      if (S.mode === 'present') { S.slide = clamp(S.slide, 0, slides().length - 1); renderRail(); showSlide(S.slide); }
    } catch (err) { console.error(err); S.view = 'mock'; renderChrome(); frame(); toast(`${tx().realFail} (${err && err.message || err})`); }
  })();
}
