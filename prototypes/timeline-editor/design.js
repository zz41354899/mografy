// Mografy design system page: edits the project's design.json (kept by physics.js) and previews it live.
// The timeline editor reads the same file, so every change here shows up in its stage and solids.
'use strict';

const M = window.MotionPhysics;
const EDITOR_STORE = 'mografy-timeline-prototype-v5';
const SPEEDS = ['fast', 'default', 'slow'], KINDS = ['spatial', 'effects'];

const TEXT = {
  zh: {
    back: '回到編輯器', reset: '全部還原成預設', resetConfirm: '再按一次確認還原', saved: '已儲存到 design.json', copied: '已複製 design.json', copyFail: '無法複製，已選取文字，請手動複製', resetDone: '已還原成預設',
    eyebrow: '專案設計系統 · lunar-pop-club', lede: '這部片的顏色、字體、間距和動畫手感，都寫在這一份 design.json。AI 寫場景時讀它，編輯器的圖層也用它，改一次整部片一起更新。',
    heroAria: '用目前設計系統渲染的畫面預覽', heroCap: '用目前的 token 即時渲染，動畫風格',
    facts: { scheme: '動畫風格', timeScale: '影片時間縮放', components: '動畫元件', colors: '顏色', type: '字級', layers: '使用中的圖層' },
    toc: { overview: '總覽', physics: '動畫物理', components: '動畫元件', color: '色彩', type: '字體', space: '間距與圓角', json: 'design.json' },
    physicsH: '動畫物理', physicsLede: '所有動畫都用彈簧描述。彈簧只有兩個數字：阻尼越低越會回彈，剛度越高越快。動畫多長，由彈簧自己停下來的時間決定。',
    schemeH: '動畫風格', schemes: { expressive: ['Expressive', '有個性、會回彈，適合品牌片'], standard: ['Standard', '俐落、幾乎不回彈，適合操作示範'] },
    timeScale: '影片時間縮放', timeScaleNote: '數值取自 Material 3 的 motion physics system，那是為 UI 調的速度。影片通常要放慢一些，這個倍率會套在每一顆彈簧上。',
    kinds: { spatial: ['空間', '位置、大小、旋轉，可以回彈'], effects: ['效果', '透明度、顏色、模糊，不回彈'] },
    speeds: { fast: ['快', '按鈕、標籤、icon'], default: ['一般', '標題、卡片'], slow: ['慢', '全畫面、轉場、背景'] },
    damping: '阻尼', stiffness: '剛度', settle: '停下', overshoot: '回彈', length: '長度',
    compH: '動畫元件', compLede: '每個 solid 的進場和出場就是一個元件。元件只決定「從什麼狀態開始」和「用哪個速度」，彈簧由上面的動畫物理決定。出場是同一個元件倒著播。',
    used: n => n ? `時間軸上有 ${n} 個圖層使用` : '目前沒有圖層使用', fixed: '固定時長', enter: '進場', hold: '停留', exit: '出場',
    presets: { fade: '淡入', 'fade-up': '上浮', pop: '彈出', 'blur-in': '模糊', wipe: '擦入' },
    colorH: '色彩', colorLede: '點色塊可以換顏色。對比值是跟紙色與墨色比較的 WCAG 對比，4.5 以上適合放文字。',
    roles: { paper: '背景紙色', ink: '主要文字與剪影', moon: '月亮與重點', rose: '花瓣與色塊', lilac: '章節卡與轉場', night: '夜景背景' },
    vsPaper: '對紙', vsInk: '對墨',
    typeH: '字體', typeLede: '字級以 1920 × 1080 畫面的像素為單位，下面的樣本按比例縮小。字距也是像素。',
    typeRoles: { display: '大標', title: '標題', body: '內文', caption: '註記' },
    samples: { display: 'LUNAR POP CLUB', title: '今晚，陪伴著你', body: '月亮升起的時候，我們一起唱。', caption: 'NO.01 — CIRCLE' },
    size: '字級', weight: '字重', tracking: '字距',
    spaceH: '間距與圓角', spaceLede: '間距用 8 的倍數，最外圈的 160 px 是標題安全區，所有文字都留在框內。',
    spaceScale: '間距', safeArea: '安全區', safeNote: '1920 × 1080 畫面，左右各留 160 px，上下各留 160 px。', radiusH: '圓角', distanceH: '動畫位移距離',
    jsonH: '原始檔', jsonLede: '這就是寫進專案的檔案。場景程式 import 它，所以改動會跟程式一起編譯、試渲染。'
  },
  en: {
    back: 'Back to editor', reset: 'Reset everything to the defaults', resetConfirm: 'Click again to reset', saved: 'Saved to design.json', copied: 'Copied design.json', copyFail: 'Could not copy. The text is selected; copy it manually.', resetDone: 'Reset to the defaults',
    eyebrow: 'Project design system · lunar-pop-club', lede: 'This film’s colours, type, spacing and motion live in one design.json. AI reads it when writing scenes and the editor’s layers use it, so one change updates the whole film.',
    heroAria: 'Frame rendered with the current design system', heroCap: 'Rendered live from the current tokens, motion scheme',
    facts: { scheme: 'Motion scheme', timeScale: 'Film time scale', components: 'Motion components', colors: 'Colours', type: 'Type styles', layers: 'Layers in use' },
    toc: { overview: 'Overview', physics: 'Motion physics', components: 'Motion components', color: 'Colour', type: 'Type', space: 'Space and radius', json: 'design.json' },
    physicsH: 'Motion physics', physicsLede: 'Every animation is a spring. A spring has two numbers: lower damping bounces more, higher stiffness moves faster. How long a motion lasts is how long its spring takes to come to rest.',
    schemeH: 'Motion scheme', schemes: { expressive: ['Expressive', 'Characterful, with bounce. For brand films'], standard: ['Standard', 'Crisp, barely any bounce. For product demos'] },
    timeScale: 'Film time scale', timeScaleNote: 'The values come from Material 3’s motion physics system, which is tuned for UI. Films usually want a slower pace; this factor applies to every spring.',
    kinds: { spatial: ['Spatial', 'Position, size and rotation. May bounce'], effects: ['Effects', 'Opacity, colour and blur. Never bounces'] },
    speeds: { fast: ['Fast', 'Buttons, labels, icons'], default: ['Default', 'Titles, cards'], slow: ['Slow', 'Full frame, transitions, backgrounds'] },
    damping: 'Damping', stiffness: 'Stiffness', settle: 'Settles', overshoot: 'Bounce', length: 'Length',
    compH: 'Motion components', compLede: 'Each solid’s enter and exit is one component. A component only says which state it starts from and which speed it uses; the springs come from motion physics above. Exit plays the same component backwards.',
    used: n => n ? `${n} layers on the timeline use this` : 'No layers use this yet', fixed: 'Fixed length', enter: 'Enter', hold: 'Hold', exit: 'Exit',
    presets: { fade: 'Fade', 'fade-up': 'Fade up', pop: 'Pop', 'blur-in': 'Blur', wipe: 'Wipe' },
    colorH: 'Colour', colorLede: 'Click a swatch to change it. The ratios are WCAG contrast against paper and ink; 4.5 or more is right for text.',
    roles: { paper: 'Paper background', ink: 'Main text and silhouettes', moon: 'Moon and highlights', rose: 'Petals and colour blocks', lilac: 'Chapter cards and transitions', night: 'Night sky' },
    vsPaper: 'on paper', vsInk: 'on ink',
    typeH: 'Type', typeLede: 'Sizes are pixels on a 1920 × 1080 frame; the samples below are scaled down. Tracking is in pixels too.',
    typeRoles: { display: 'Display', title: 'Title', body: 'Body', caption: 'Caption' },
    samples: { display: 'LUNAR POP CLUB', title: 'Tonight, with you', body: 'When the moon rises, we sing together.', caption: 'NO.01 — CIRCLE' },
    size: 'Size', weight: 'Weight', tracking: 'Tracking',
    spaceH: 'Space and radius', spaceLede: 'Spacing steps are multiples of 8. The outer 160 px is title safe: all text stays inside it.',
    spaceScale: 'Spacing', safeArea: 'Safe area', safeNote: 'On a 1920 × 1080 frame, 160 px on every side.', radiusH: 'Radius', distanceH: 'Motion distances',
    jsonH: 'Source file', jsonLede: 'This is the file written into the project. Scenes import it, so changes compile and trial-render with the code.'
  }
};

// ------------------------------------------------------------------ state
let ds = M.load();
let lang = 'zh';
try {
  const ed = JSON.parse(localStorage.getItem(EDITOR_STORE) || 'null');
  lang = ed && ed.lang === 'en' ? 'en' : (!ed && (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'zh');
} catch { /* storage unavailable */ }
const T = () => TEXT[lang];
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = v => Math.round(v * 100) / 100;
const ms = s => Math.round(s * 1000) + ' ms';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function editorLayers() {
  try { const ed = JSON.parse(localStorage.getItem(EDITOR_STORE) || 'null'); return ed && Array.isArray(ed.layers) ? ed.layers : null; } catch { return null; }
}
const usage = name => (editorLayers() || []).filter(l => !l.hidden && (l.enter === name || l.exit === name)).length;

let savedTimer;
function commit(fn, { rerender = true } = {}) {
  fn(); M.save(ds);
  const el = $('saved'); el.textContent = T().saved; el.classList.add('on');
  clearTimeout(savedTimer); savedTimer = setTimeout(() => el.classList.remove('on'), 1400);
  if (rerender) render(); else { renderFacts(); renderJson(); }
}
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200);
}

// ------------------------------------------------------------------ colour maths
function lum(hex) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const isHex = v => /^#[0-9a-f]{6}$/i.test(v);

// ------------------------------------------------------------------ render
function renderStatic() {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = T()[el.dataset.t]; });
  document.querySelectorAll('[data-t-aria]').forEach(el => el.setAttribute('aria-label', T()[el.dataset.tAria]));
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
  $('langSwitch').dataset.pos = lang === 'en' ? '1' : '0';
  $('projName').textContent = ds.project;
  const ids = ['overview', 'physics', 'components', 'color', 'type', 'space', 'json'];
  const keys = { overview: '', physics: 'motion.springs', components: 'motion.components', color: 'color', type: 'type', space: 'space · radius', json: '' };
  $('toc').innerHTML = ids.map(id => `<li><a href="#${id}" data-sec="${id}">${esc(T().toc[id])}${keys[id] ? `<small>${keys[id]}</small>` : ''}</a></li>`).join('');
  markToc();
}
function renderFacts() {
  const t = T(), used = editorLayers();
  const facts = [
    [t.facts.scheme, t.schemes[ds.scheme][0]], [t.facts.timeScale, '×' + ds.timeScale.toFixed(1)], [t.facts.components, Object.keys(ds.motion).length],
    [t.facts.colors, Object.keys(ds.color).length], [t.facts.type, Object.keys(ds.type).length],
    [t.facts.layers, used ? used.filter(l => !l.hidden && (l.enter !== 'none' || l.exit !== 'none')).length : '–']
  ];
  $('facts').innerHTML = facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('heroScheme').textContent = `${ds.scheme} · ×${ds.timeScale.toFixed(1)}`;
}

function renderPhysics() {
  const t = T();
  $('scheme').innerHTML = ['expressive', 'standard'].map(k => `<button role="radio" aria-checked="${ds.scheme === k}" data-scheme="${k}"><strong>${esc(t.schemes[k][0])}</strong><small>${esc(t.schemes[k][1])}</small></button>`).join('');
  $('timeScale').value = ds.timeScale; $('timeScaleOut').textContent = '×' + ds.timeScale.toFixed(1);
  let html = '';
  for (const kind of KINDS) {
    html += `<div class="row-h ${kind}"><strong>${esc(t.kinds[kind][0])}</strong><small>${esc(t.kinds[kind][1])}</small></div>`;
    for (const speed of SPEEDS) {
      const s = M.springFor(ds, kind, speed), id = `${kind}-${speed}`;
      html += `<div class="cell ${kind}" data-kind="${kind}" data-speed="${speed}">
        <div class="stats"><span><b>${esc(t.speeds[speed][0])}</b> · ${esc(t.speeds[speed][1])}</span></div>
        <canvas data-plot="${id}" aria-hidden="true"></canvas>
        <div class="demo" aria-hidden="true">${kind === 'spatial' ? '<i class="dot"></i>' : '<i class="fill"></i>'}</div>
        <div class="stats"><span>${esc(t.settle)} <b>${ms(M.settle(s) * ds.timeScale)}</b></span><span>${esc(t.overshoot)} <b>${Math.round(M.overshoot(s) * 100)}%</b></span></div>
        <div class="knobs">
          <label class="knob" for="d-${id}"><span>${esc(t.damping)}</span><input type="number" id="d-${id}" data-k="damping" step="0.05" min="0.1" max="2" value="${s.damping}"></label>
          <label class="knob" for="s-${id}"><span>${esc(t.stiffness)}</span><input type="number" id="s-${id}" data-k="stiffness" step="10" min="10" max="10000" value="${s.stiffness}"></label>
        </div></div>`;
    }
  }
  $('matrix').innerHTML = html;
  sizeCanvases();
}

function renderComponents() {
  const t = T();
  $('comps').innerHTML = Object.entries(ds.motion).map(([name, c]) => {
    const chips = Object.entries(c.from).map(([p, v]) => `<span class="chip ${M.kindOf(p)}">${p}: ${typeof v === 'string' ? 'distance.' + v : v}</span>`).join('');
    const speed = c.duration
      ? `<div class="chips"><span class="chip">${esc(t.fixed)} ${c.duration}s · ${esc(c.easing)}</span></div>`
      : `<div class="speed" role="radiogroup" aria-label="${esc(t.presets[name] || name)}">${SPEEDS.map(s => `<button role="radio" aria-checked="${c.speed === s}" data-comp="${name}" data-speed="${s}">${esc(t.speeds[s][0])}</button>`).join('')}</div>`;
    return `<article class="comp">
      <div class="tile" data-tile="${name}"><span class="word">${lang === 'zh' ? '今晚' : 'Tonight'}</span><span class="phase"></span></div>
      <div class="comp-body">
        <div class="comp-title"><strong>${esc(t.presets[name] || name)}</strong><code>${name}</code><span class="len">${r2(M.length(ds, c))}s</span></div>
        <div class="chips">${chips}</div>
        ${speed}
        <span class="used">${esc(t.used(usage(name)))}</span>
      </div></article>`;
  }).join('');
}

function renderColors() {
  const t = T();
  $('swatches').innerHTML = Object.entries(ds.color).map(([name, hex]) => {
    const cp = contrast(hex, ds.color.paper), ci = contrast(hex, ds.color.ink), onDark = lum(hex) < .35;
    const tag = v => `<b class="${v >= 4.5 ? 'pass' : 'fail'}">${v.toFixed(1)}</b>`;
    return `<article class="sw">
      <label class="sw-chip" style="background:${hex};color:${onDark ? '#f4efe6' : '#2b2440'}">
        <span>color.${name}</span><span class="aa">${(onDark ? contrast(hex, '#f4efe6') : contrast(hex, '#2b2440')).toFixed(1)}</span>
        <input type="color" value="${hex}" data-color="${name}" aria-label="color.${name}">
      </label>
      <div class="sw-body"><strong>${esc(t.roles[name] || name)}</strong>
        <div class="sw-hex"><input id="hex-${name}" value="${hex}" data-hex="${name}" spellcheck="false" aria-label="color.${name} hex"></div>
        <div class="contrast">${name !== 'paper' ? `<span>${esc(t.vsPaper)} ${tag(cp)}</span>` : ''}${name !== 'ink' ? `<span>${esc(t.vsInk)} ${tag(ci)}</span>` : ''}</div>
      </div></article>`;
  }).join('');
}

function renderType() {
  const t = T(), wrap = $('types').clientWidth || 800, k = Math.min(.5, Math.max(.22, (wrap - 280) / 1920));
  $('types').innerHTML = Object.entries(ds.type).map(([role, s]) => `<div class="trow">
      <div class="tmeta"><strong>${esc(t.typeRoles[role])} <code>type.${role}</code></strong><span class="fam">${esc(s.family)}</span>
        <div class="nums">
          <label for="ty-${role}-size">${esc(t.size)}<input type="number" id="ty-${role}-size" data-type="${role}" data-k="size" value="${s.size}" min="12" max="400" step="2"></label>
          <label for="ty-${role}-weight">${esc(t.weight)}<input type="number" id="ty-${role}-weight" data-type="${role}" data-k="weight" value="${s.weight}" min="100" max="900" step="100"></label>
          <label for="ty-${role}-tracking">${esc(t.tracking)}<input type="number" id="ty-${role}-tracking" data-type="${role}" data-k="tracking" value="${s.tracking}" min="-20" max="60" step="1"></label>
        </div></div>
      <div class="tspec" style="font-family:'${s.family}', 'Noto Sans TC', sans-serif;font-size:${(s.size * k).toFixed(1)}px;font-weight:${s.weight};letter-spacing:${(s.tracking * k).toFixed(2)}px">${esc(t.samples[role])}</div>
    </div>`).join('');
}

function renderSpace() {
  const bar = (label, v, max) => `<div class="sp"><span>${label}</span><i style="width:${Math.min(100, v / max * 100)}%"></i><b>${v} px</b></div>`;
  $('spaceList').innerHTML = Object.entries(ds.space).map(([k, v]) => bar(k, v, ds.space.safe)).join('');
  $('distList').innerHTML = Object.entries(ds.distance).map(([k, v]) => bar(k, v, ds.distance.lg)).join('');
  $('radii').innerHTML = Object.entries(ds.radius).map(([k, v]) => `<div class="rad"><i style="border-radius:${Math.min(v, 999) / 2.2}px"></i><span>${k} <b>${v === 999 ? '∞' : v + ' px'}</b></span></div>`).join('');
}

function renderJson() {
  const json = esc(JSON.stringify(ds, null, 2))
    .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="k">$1</span>$2')
    .replace(/(:\s*)(&quot;.*?&quot;)/g, '$1<span class="s">$2</span>')
    .replace(/(:\s*)(-?\d+\.?\d*)/g, '$1<span class="n">$2</span>');
  $('jsonOut').innerHTML = json;
}

function render() {
  renderStatic(); renderFacts(); renderPhysics(); renderComponents(); renderColors(); renderType(); renderSpace(); renderJson();
  if (reduced) requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ canvases
function sizeCanvases() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  document.querySelectorAll('canvas[data-plot], #heroCanvas').forEach(c => {
    const w = Math.max(10, Math.round(c.clientWidth * dpr)), h = Math.max(10, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  });
}
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
/** Longest settle among all six springs of the scheme, so every plot shares one time axis. */
const axisSeconds = () => Math.max(...KINDS.flatMap(k => SPEEDS.map(s => M.settle(M.springFor(ds, k, s))))) * ds.timeScale * 1.08;

function drawPlot(c, s, kind, now) {
  const g = c.getContext('2d'), W = c.width, H = c.height, dpr = W / Math.max(1, c.clientWidth);
  const pad = 6 * dpr, top = 18 * dpr, bot = H - 14 * dpr, span = axisSeconds(), len = M.settle(s) * ds.timeScale;
  const X = t => pad + t / span * (W - 2 * pad), Y = v => bot - v * (bot - top);
  g.clearRect(0, 0, W, H);
  g.lineWidth = 1 * dpr; g.strokeStyle = css('--plot-grid');
  for (let t = 0; t <= span; t += .1) { g.beginPath(); g.moveTo(X(t), top - 8 * dpr); g.lineTo(X(t), bot); g.stroke(); }
  g.setLineDash([3 * dpr, 4 * dpr]); g.strokeStyle = css('--faint');
  g.beginPath(); g.moveTo(pad, Y(1)); g.lineTo(W - pad, Y(1)); g.stroke();
  g.beginPath(); g.moveTo(X(len), top - 10 * dpr); g.lineTo(X(len), bot); g.stroke(); g.setLineDash([]);
  g.beginPath(); g.moveTo(pad, bot); g.lineTo(W - pad, bot); g.stroke();
  const col = css(kind === 'spatial' ? '--spatial' : '--effects');
  g.strokeStyle = col; g.lineWidth = 2 * dpr; g.lineCap = 'round'; g.beginPath();
  for (let i = 0; i <= 120; i++) { const t = i / 120 * span; const v = M.spring(s, t / ds.timeScale); i ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v)); }
  g.stroke();
  g.fillStyle = css('--muted'); g.font = `${10 * dpr}px ${css('--mono')}`; g.textBaseline = 'top';
  g.fillText(ms(len), Math.min(X(len) + 4 * dpr, W - 48 * dpr), 2 * dpr);
  if (now !== null) { const v = M.spring(s, now / ds.timeScale); g.fillStyle = col; g.beginPath(); g.arc(X(Math.min(now, span)), Y(v), 3.5 * dpr, 0, Math.PI * 2); g.fill(); }
}

function drawHero(g, W, H, time) {
  // A 1920 × 1080 frame drawn at canvas size: moon pops in, the title fades up, the caption fades.
  const k = W / 1920, C = ds.color, ty = ds.type;
  const pop = ds.motion.pop, up = ds.motion['fade-up'], fade = ds.motion.fade;
  const enterLen = Math.max(M.length(ds, pop), .5 + M.length(ds, up), .9 + M.length(ds, fade));
  const cycle = enterLen + 1.8 + M.length(ds, fade) + .5, t = reduced ? enterLen + .2 : time % cycle;
  const out = t > enterLen + 1.8 ? 1 - M.progress(ds, fade, 'opacity', t - enterLen - 1.8) : 1;
  const at = (c, p, delay) => M.progress(ds, c, p, Math.max(0, t - delay));
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
  g.scale(k, k); g.globalAlpha = out;
  // moon
  const ms2 = .6 + .4 * at(pop, 'scale', 0);
  g.save(); g.globalAlpha = out * at(pop, 'opacity', 0); g.translate(960, 400); g.scale(ms2, ms2);
  const gr = g.createRadialGradient(-60, -70, 20, 0, 0, 230); gr.addColorStop(0, '#fbecc8'); gr.addColorStop(1, C.moon);
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 230, 0, Math.PI * 2); g.fill(); g.restore();
  // title
  const dy = (ds.distance[up.from.y] || 60) * (1 - at(up, 'y', .5));
  g.save(); g.globalAlpha = out * at(up, 'opacity', .5); g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${ty.display.weight} ${ty.display.size}px "${ty.display.family}", serif`; if ('letterSpacing' in g) g.letterSpacing = ty.display.tracking + 'px';
  g.fillText('LUNAR POP CLUB', 960, 760 + dy); g.restore();
  g.save(); g.globalAlpha = out * at(fade, 'opacity', .9); g.fillStyle = C.lilac; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `${ty.caption.weight} ${ty.caption.size}px "${ty.caption.family}", sans-serif`; if ('letterSpacing' in g) g.letterSpacing = ty.caption.tracking + 'px';
  g.fillText('NO.01 — CIRCLE', 960, 880); g.restore();
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

function styleTile(el, word, c, tau) {
  const f = c.from, dist = v => typeof v === 'string' ? ds.distance[v] || 0 : v, px = el.clientWidth / 1920;
  const at = p => M.progress(ds, c, p, tau);
  let op = 1, y = 0, sc = 1, bl = 0, rv = 1;
  if (f.opacity !== undefined) op = f.opacity + (1 - f.opacity) * at('opacity');
  if (f.y !== undefined) y = dist(f.y) * (1 - at('y')) * px * 2.2;
  if (f.scale !== undefined) sc = f.scale + (1 - f.scale) * at('scale');
  if (f.blur !== undefined) bl = f.blur * (1 - at('blur')) * px * 2.2;
  if (f.reveal !== undefined) rv = f.reveal + (1 - f.reveal) * at('reveal');
  word.style.opacity = Math.max(0, Math.min(1, op)).toFixed(3);
  word.style.transform = `translateY(${y.toFixed(2)}px) scale(${sc.toFixed(4)})`;
  word.style.filter = bl > .05 ? `blur(${bl.toFixed(2)}px)` : 'none';
  word.style.clipPath = rv < 1 ? `inset(0 ${((1 - rv) * 100).toFixed(2)}% 0 0)` : 'none';
}

const t0 = performance.now();
function frame(nowMs) {
  const now = (nowMs - t0) / 1000;
  // spring cells: each replays its spring, holds, then restarts
  document.querySelectorAll('.cell').forEach(cell => {
    const kind = cell.dataset.kind, s = M.springFor(ds, kind, cell.dataset.speed), len = M.settle(s) * ds.timeScale;
    const cycle = axisSeconds() + .9, tt = reduced ? len : now % cycle;
    const v = M.spring(s, tt / ds.timeScale), demo = cell.querySelector('.demo');
    if (kind === 'spatial') { const dot = demo.firstElementChild; dot.style.transform = `translateX(${(v * (demo.clientWidth - 26)).toFixed(2)}px)`; }
    else demo.firstElementChild.style.opacity = Math.max(0, Math.min(1, v)).toFixed(3);
    drawPlot(cell.querySelector('canvas'), s, kind, Math.min(tt, axisSeconds()));
  });
  // component tiles: enter, hold, exit (the same component backwards), rest
  document.querySelectorAll('[data-tile]').forEach(tile => {
    const c = ds.motion[tile.dataset.tile], len = M.length(ds, c), hold = 1, cycle = len * 2 + hold + .6;
    const t = reduced ? len : now % cycle, word = tile.firstElementChild, ph = tile.lastElementChild, tx = T();
    let tau, label;
    if (t < len) { tau = t; label = tx.enter; } else if (t < len + hold) { tau = len; label = tx.hold; } else if (t < len * 2 + hold) { tau = len * 2 + hold - t; label = tx.exit; } else { tau = 0; label = ''; }
    styleTile(tile, word, c, tau); ph.textContent = label;
  });
  const hc = $('heroCanvas'); drawHero(hc.getContext('2d'), hc.width, hc.height, now);
  if (!reduced) requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ table of contents
function markToc() {
  const secs = [...document.querySelectorAll('.hero, .sec')];
  let cur = secs[0].id;
  for (const s of secs) if (s.getBoundingClientRect().top < 160) cur = s.id;
  document.querySelectorAll('.toc a').forEach(a => a.setAttribute('aria-current', String(a.dataset.sec === cur)));
}
addEventListener('scroll', markToc, { passive: true });

// ------------------------------------------------------------------ events
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.lang) {
    lang = b.dataset.lang;
    try { const ed = JSON.parse(localStorage.getItem(EDITOR_STORE) || 'null') || {}; ed.lang = lang; localStorage.setItem(EDITOR_STORE, JSON.stringify(ed)); } catch { /* ignore */ }
    render();
  }
  if (b.dataset.scheme) commit(() => { ds.scheme = b.dataset.scheme; });
  if (b.dataset.comp) commit(() => { ds.motion[b.dataset.comp].speed = b.dataset.speed; });
  if (b.id === 'copy') {
    const text = JSON.stringify(ds, null, 2);
    navigator.clipboard.writeText(text).then(() => toast(T().copied), () => {
      const r = document.createRange(); r.selectNodeContents($('jsonOut')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast(T().copyFail);
    });
  }
  if (b.id === 'reset') {
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = T().resetConfirm; setTimeout(() => { b.classList.remove('armed'); b.textContent = T().reset; }, 3000); return; }
    b.classList.remove('armed'); commit(() => { ds = M.clone(M.DEFAULT); }); toast(T().resetDone);
  }
  if (b.id === 'back') {
    if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) history.back();
    else location.href = 'index.html';
  }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'timeScale') { $('timeScaleOut').textContent = '×' + Number(el.value).toFixed(1); commit(() => { ds.timeScale = Number(el.value); }, { rerender: false }); refreshNumbers(); }
  if (el.dataset.color) { commit(() => { ds.color[el.dataset.color] = el.value; }, { rerender: false }); renderColors(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'timeScale') render();
  if (el.dataset.k && el.closest('.cell')) {
    const cell = el.closest('.cell'), v = Number(el.value);
    if (!Number.isFinite(v) || v <= 0) return render();
    commit(() => { ds.springs[ds.scheme][cell.dataset.kind][cell.dataset.speed][el.dataset.k] = el.dataset.k === 'damping' ? Math.min(2, Math.max(.1, v)) : Math.min(10000, Math.max(10, v)); });
  }
  if (el.dataset.hex) { const v = el.value.trim().toLowerCase(); if (isHex(v)) commit(() => { ds.color[el.dataset.hex] = v; }); else renderColors(); }
  if (el.dataset.type) { const v = Number(el.value); if (Number.isFinite(v)) commit(() => { ds.type[el.dataset.type][el.dataset.k] = v; }); }
});
/** Update the numbers that depend on time scale without rebuilding the inputs being dragged. */
function refreshNumbers() {
  document.querySelectorAll('.cell').forEach(cell => {
    const s = M.springFor(ds, cell.dataset.kind, cell.dataset.speed);
    cell.querySelectorAll('.stats')[1].firstElementChild.lastElementChild.textContent = ms(M.settle(s) * ds.timeScale);
  });
  document.querySelectorAll('[data-tile]').forEach(tile => { tile.parentElement.querySelector('.len').textContent = r2(M.length(ds, ds.motion[tile.dataset.tile])) + 's'; });
}
addEventListener('storage', e => { if (e.key === M.KEY) { ds = M.load(); render(); } });
new ResizeObserver(() => { sizeCanvases(); renderType(); }).observe($('main'));

render();
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
requestAnimationFrame(frame);
document.fonts?.ready.then(() => { renderType(); });
