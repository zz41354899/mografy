import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1918, height: 978 } }); const errs = [];
p.on('pageerror', e => errs.push(e.stack || e.message)); p.on('console', m => m.type() === 'error' && errs.push('console: ' + m.text()));
await p.goto('file://' + process.env.HOME + '/mnt/mografy/prototypes/timeline-editor/index.html'); await p.waitForTimeout(1500);
console.log(errs, await p.textContent('.badge'));
await b.close();
