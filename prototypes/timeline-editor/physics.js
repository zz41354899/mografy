// Mografy motion physics: the design.json both the editor and the design system page read.
// Motion is described by springs (damping + stiffness), as in Material 3's motion physics system.
// Spatial springs move position, size and rotation and may overshoot; effects springs fade
// opacity, colour and blur and never overshoot. A spring has a closed form, so any frame can be
// computed directly from time, which keeps Mografy scenes pure functions of time.
'use strict';
(function (root) {
  const KEY = 'mografy-design-v1';
  const clone = o => JSON.parse(JSON.stringify(o));
  const sp = (damping, stiffness) => ({ damping, stiffness });
  const EFFECTS = { fast: sp(1, 3800), default: sp(1, 1600), slow: sp(1, 800) };

  const DEFAULT = {
    project: 'lunar-pop-club',
    scheme: 'expressive',
    timeScale: 1.5,
    springs: {
      expressive: { spatial: { fast: sp(0.6, 800), default: sp(0.8, 380), slow: sp(0.8, 200) }, effects: clone(EFFECTS) },
      standard: { spatial: { fast: sp(0.9, 1400), default: sp(0.9, 700), slow: sp(0.9, 300) }, effects: clone(EFFECTS) }
    },
    color: { paper: '#f4efe6', ink: '#2b2440', moon: '#e9c17a', rose: '#e8a7bf', lilac: '#9a7bd0', night: '#1d1a33' },
    type: {
      display: { family: 'Instrument Serif', size: 150, weight: 400, tracking: 10 },
      title: { family: 'Noto Sans TC', size: 96, weight: 500, tracking: 12 },
      body: { family: 'Noto Sans TC', size: 44, weight: 400, tracking: 2 },
      caption: { family: 'Inter', size: 34, weight: 500, tracking: 14 }
    },
    space: { xs: 8, sm: 16, md: 32, lg: 64, xl: 104, safe: 160 },
    radius: { sm: 8, md: 24, lg: 40, pill: 999 },
    distance: { sm: 24, md: 60, lg: 160 },
    motion: {
      fade: { speed: 'default', from: { opacity: 0 } },
      'fade-up': { speed: 'default', from: { opacity: 0, y: 'md' } },
      pop: { speed: 'fast', from: { opacity: 0, scale: 0.6 } },
      'blur-in': { speed: 'slow', from: { opacity: 0, blur: 24 } },
      wipe: { duration: 0.6, easing: 'outQuint', from: { reveal: 0 } }
    }
  };

  const EASE = {
    linear: x => x,
    outQuint: x => 1 - (1 - x) ** 5,
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2
  };
  const SPATIAL = new Set(['y', 'x', 'scale', 'rotate']);
  const kindOf = prop => SPATIAL.has(prop) ? 'spatial' : 'effects';

  /** Position of a unit spring released from 0 towards 1, at t seconds. */
  function spring(s, t) {
    if (t <= 0) return 0;
    const w = Math.sqrt(s.stiffness), z = s.damping;
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
    }
    if (z === 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const r = Math.sqrt(z * z - 1), a = -w * (z - r), b = -w * (z + r);
    return 1 - (b * Math.exp(a * t) - a * Math.exp(b * t)) / (b - a);
  }
  /** Seconds until the spring stays within 0.1% of rest. */
  const settleCache = new Map();
  function settle(s) {
    const id = s.damping + '/' + s.stiffness;
    if (settleCache.has(id)) return settleCache.get(id);
    let last = 0;
    for (let t = 0; t < 10; t += 1 / 600) if (Math.abs(1 - spring(s, t)) > 0.001) last = t;
    const v = last + 1 / 600;
    settleCache.set(id, v);
    return v;
  }
  /** Peak overshoot past rest, as a fraction (0 for effects springs). */
  function overshoot(s) {
    let peak = 0;
    for (let t = 0; t < settle(s); t += 1 / 600) peak = Math.max(peak, spring(s, t) - 1);
    return peak;
  }

  const springFor = (ds, kind, speed) => ds.springs[ds.scheme][kind][speed];
  const propsOf = comp => Object.keys(comp.from || {});
  /** Length in seconds of a motion component (the time its slowest spring takes to settle). */
  function length(ds, comp) {
    if (!comp) return 0;
    if (comp.duration) return comp.duration;
    const kinds = new Set(propsOf(comp).map(kindOf));
    let len = 0;
    for (const k of kinds) len = Math.max(len, settle(springFor(ds, k, comp.speed)) * ds.timeScale);
    return len;
  }
  /** Progress (0 = the "from" state, 1 = at rest) of one property at t seconds into the motion. */
  function progress(ds, comp, prop, t) {
    if (comp.duration) return (EASE[comp.easing] || EASE.linear)(Math.min(1, Math.max(0, t / comp.duration)));
    const k = spring(springFor(ds, kindOf(prop), comp.speed), t / ds.timeScale);
    return kindOf(prop) === 'effects' ? Math.min(1, Math.max(0, k)) : k;
  }

  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && o.springs && o.motion && o.color) return o;
    } catch { /* storage unavailable: use the defaults */ }
    return clone(DEFAULT);
  }
  function save(ds) { try { localStorage.setItem(KEY, JSON.stringify(ds)); } catch { /* ignore */ } }

  root.MotionPhysics = { KEY, DEFAULT, EASE, spring, settle, overshoot, length, progress, kindOf, springFor, load, save, clone };
})(window);
