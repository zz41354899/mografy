import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATE_DIR } from '@mografy/server';
import { ffmpegOutput } from '@mografy/render';
import { browserFixture } from './helpers/browser-fixture.js';
import type { BrowserFixture } from './helpers/browser-fixture.js';

const BIN = resolve(fileURLToPath(import.meta.url), '../../bin/mografy.js');
let fixture: BrowserFixture | undefined;
let dir: BrowserFixture['dir'], sandbox: BrowserFixture['sandbox'], server: BrowserFixture['server'], page: BrowserFixture['page'];
let api: BrowserFixture['api'], stage: BrowserFixture['stage'];
beforeEach(async () => {
  fixture = undefined;
  fixture = await browserFixture();
  ({ dir, sandbox, server, page, api, stage } = fixture);
});
afterEach(async () => { await fixture?.close(); });

test('export dialog: four usable formats, keyboard choices, advanced controls and unchanged project defaults', { timeout: 120_000 }, async () => {
  await page.getByRole('tab',{name:'Scene',exact:true}).click();
  assert.equal(await page.locator('[data-param=name]').count(),0);
  assert.equal(await page.locator('[data-param=subtitle]').count(),1);
  assert.equal(await page.getByText('Final frame',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Loop',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Guides',exact:true}).click();
  assert.equal(await page.locator('.guides').count(),1);
  await page.getByRole('button',{name:'Guides',exact:true}).click();
  const changed=await api('source','POST',{files:{'scenes/main.ts':await readFile(join(TEMPLATE_DIR,'scenes/progress-bar.ts'),'utf8')}});
  assert.equal(changed.status,200);
  await page.waitForFunction(v=>document.querySelector<HTMLElement>('[data-testid=stage]')!.dataset.version===v,changed.data.version);
  await api('project','PATCH',{patch:{render:{scale:.1,fps:10,samples:1,workers:1}}});
  const manifest=await readFile(join(dir,'mografy.json'),'utf8');
  await page.getByRole('button',{name:'Export',exact:true}).click();
  const modal = page.getByRole('dialog');
  const expectedSizes = {
    WebM: ['1280 × 720 — 720p', '1920 × 1080 — 1080p'],
    MP4: ['1280 × 720 — 720p', '1920 × 1080 — 1080p'],
    Lottie: ['256 × 256 — Square', '640 × 360 — Landscape'],
    SVGA: ['375 × 375 — Square', '375 × 750 — Portrait'],
  };
  for (const [format, sizes] of Object.entries(expectedSizes)) {
    await modal.getByRole('button', { name: new RegExp('^' + format) }).click();
    const resolution = modal.getByRole('combobox', { name: 'Resolution', exact: true });
    await resolution.click();
    assert.deepEqual(await modal.getByRole('option').allTextContents(), sizes);
    await resolution.press('End'); await resolution.press('Enter');
    assert.equal(await resolution.innerText(), sizes[1]);
  }
  await modal.getByRole('button', { name: /^Lottie/ }).click();
  assert.equal(await modal.getByRole('combobox', { name: 'Resolution', exact: true }).innerText(), expectedSizes.Lottie[1], 'format switches preserve selections');
  assert.equal(await modal.getByRole('combobox', { name: 'Fit', exact: true }).count(), 0, 'matching landscape aspect ratio does not need fitting');
  const lottieResolution = modal.getByRole('combobox', { name: 'Resolution', exact: true });
  await lottieResolution.click(); await lottieResolution.press('Home'); await lottieResolution.press('Enter');
  const fit = modal.getByRole('combobox', { name: 'Fit', exact: true });
  await fit.click(); await fit.press('Home'); await fit.press('ArrowDown'); await fit.press('Enter');
  assert.equal(await fit.innerText(), 'Fill and crop');
  await page.getByRole('dialog').getByRole('combobox',{name:'Resolution',exact:true}).click();
  await page.getByRole('dialog').getByRole('combobox',{name:'Resolution',exact:true}).press('Escape');
  assert.equal(await page.getByRole('dialog').count(),1,'Escape closes the choice before the dialog');
  await page.getByRole('dialog').getByRole('button',{name:'Close export'}).press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  for(const format of ['MP4','WebM','Lottie','SVGA']) {
    await page.getByRole('button',{name:'Export',exact:true}).click();
    const modal=page.getByRole('dialog',{name:'Export animation'});
    await modal.getByRole('button',{name:new RegExp('^'+format)}).click();
    const fps=modal.getByRole('combobox',{name:'Frame rate',exact:true});
    await fps.click();
    const availableRates = await modal.getByRole('option').allTextContents();
    const maximum = (format === 'MP4' || format === 'WebM') ? 60 : 30;
    assert.equal(availableRates.at(-1), `${maximum} fps`);
    assert.ok(availableRates.every(rate => Number.parseInt(rate) <= maximum));
    await fps.press('Home'); await fps.press('Enter');
    await modal.getByText('Advanced settings',{exact:true}).click();
    const encoding=modal.getByRole('combobox',{name:'Encoding',exact:true});
    if(format==='MP4' || format==='WebM') {
      if (format === 'WebM') {
        assert.equal(await encoding.innerText(), 'Constant quality · one-pass');
        assert.equal(await modal.getByRole('slider', { name: 'CRF', exact: true }).inputValue(), '32');
        assert.equal(await modal.getByRole('textbox', { name: 'Bitrate', exact: true }).count(), 0);
        await mkdir(resolve('../../artifacts/webm-export'), { recursive: true });
        await page.screenshot({ path: resolve('../../artifacts/webm-export/settings-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await modal.evaluate(element => element.scrollWidth > element.clientWidth), false, 'four formats fit the mobile dialog');
        await page.screenshot({ path: resolve('../../artifacts/webm-export/settings-mobile.png') });
        await page.setViewportSize({ width: 1280, height: 800 });
      }
      await encoding.click(); await encoding.press('End'); await encoding.press('Enter');
      await modal.getByRole('slider',{name:'CRF'}).fill('20');
    } else {
      assert.equal(await encoding.count(),0);
      assert.match(await modal.locator('.export-note').filter({ hasText: 'Embedded image frames' }).innerText(),/Embedded image frames/);
    }
    await modal.getByRole('button',{name:'Export '+format,exact:true}).click();
    await modal.getByTestId('export-job').waitFor();
    assert.equal(await modal.getByRole('combobox',{name:'Resolution',exact:true}).count(),0);
    for(let i=0;i<1200&&(await api('snapshot')).data.render.state==='running';i++) await new Promise(r=>setTimeout(r,50));
    const render=(await api('snapshot')).data.render;
    assert.equal(render.state,'done',render.error); assert.equal(render.format,format.toLowerCase());
    await modal.locator('[data-testid=export-job][data-state=done]').waitFor();
    assert.equal(await modal.getByRole('link',{name:'Download',exact:true}).count(),1);
    if(format==='MP4' || format==='WebM') {
      // MP4 is H.265: a browser without HEVC (Chromium on Linux) shows the frame preview and a note instead of a player
      const hevc = format === 'MP4' && await page.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') === '');
      if (hevc) await modal.getByText('This browser cannot play the video here', { exact: false }).waitFor();
      else {
        const video = modal.getByLabel('Exported video');
        await video.evaluate((element: HTMLVideoElement) => new Promise<void>((done, fail) => {
          if (element.readyState >= 2) return done();
          element.addEventListener('loadeddata', () => done(), { once: true });
          element.addEventListener('error', () => fail(new Error('Exported video cannot play')), { once: true });
          element.preload = 'auto'; element.load();
        }));
      }
    }
    await modal.getByRole('button',{name:'Done',exact:true}).click();
    await modal.waitFor({state:'hidden'});
    assert.equal(await page.locator('.export-complete').count(),0,'completed dialog does not trigger a second success toast');
    assert.equal(await readFile(join(dir,'mografy.json'),'utf8'),manifest,'single-export settings do not change project defaults');
    const downloaded=await fetch(new URL('/__mografy/files/'+render.output.slice(dir.length+1),server.url));
    assert.equal(downloaded.status,200);
    const bytes=Buffer.from(await downloaded.arrayBuffer());
    if(format==='MP4') assert.equal(bytes.subarray(4,8).toString(),'ftyp');
    else if(format==='WebM') { assert.match(downloaded.headers.get('content-type')!, /video\/webm/); assert.equal(bytes.subarray(0,4).toString('hex'),'1a45dfa3'); }
    else if(format==='Lottie') { const movie = JSON.parse(bytes.toString()); assert.equal(movie.layers.length,render.total); assert.equal(movie.w,256); assert.equal(movie.h,256); }
    else assert.equal(bytes[0],0x78,'zlib-compressed SVGA 2');
  }
  assert.equal((await api('render','POST',{format:'svga',render:{fps:24}})).status,400);
  assert.equal((await api('render','POST',{format:'mp4',render:{fps:61}})).status,400);
  assert.equal((await api('render','POST',{format:'webm',render:{fps:61}})).status,400);
  assert.equal((await api('render','POST',{format:'webm',size:{width:101,height:100,fit:'contain'}})).status,400);
  assert.equal((await api('render','POST',{format:'lottie',render:{fps:31}})).status,400);
  assert.equal((await api('render','POST',{format:'svga',render:{fps:31}})).status,400);
  assert.equal((await api('render','POST',{format:'svga',render:{fps:60}})).status,400);
  await api('project', 'PATCH', { patch: { render: { fps: 120 } } });
  for (const format of ['mp4', 'webm', 'lottie', 'svga']) assert.equal((await api('render', 'POST', { format })).status, 400, 'inherited project frame rates also obey the format cap');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByRole('combobox', { name: 'Frame rate', exact: true }).innerText(), '60 fps', 'dialog clamps legacy project defaults');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await api('project', 'PATCH', { patch: { render: { fps: 10 } } });
  assert.equal((await api('render','POST',{format:'lottie',output:'mografy.json'})).status,400);
  const uiOutput='renders/cancel-from-player.lottie.json';
  assert.equal((await api('render','POST',{format:'lottie',output:uiOutput,render:{scale:.25,fps:30,samples:8}})).status,202);
  assert.equal((await api('shutdown?onlyIfIdle=1', 'POST')).status, 409, 'updates cannot interrupt an active export');
  assert.equal((await api('health')).status, 200);
  await page.getByRole('button',{name:'Cancel export',exact:true}).click();
  for(let i=0;i<200&&(await api('snapshot')).data.render.state==='running';i++) await new Promise(r=>setTimeout(r,25));
  assert.equal((await api('snapshot')).data.render.state,'cancelled');
  await assert.rejects(access(join(dir,uiOutput)),'cancelled player export does not commit a partial file');

  const cliOutput='renders/cancel-from-cli.webm';
  assert.equal((await api('render','POST',{format:'webm',output:cliOutput,render:{scale:.25,fps:30,samples:8}})).status,202);
  const child=spawn(process.execPath,[BIN,'export',dir,'--cancel'],{env:{...process.env,MOGRAFY_NO_OPEN:'1'}});
  let stdout='',stderr=''; child.stdout.on('data',c=>{stdout+=c;}); child.stderr.on('data',c=>{stderr+=c;});
  const code=await new Promise<number|null>(done=>child.once('close',done));
  assert.equal(code,0,stderr); assert.match(stdout,/Cancelling WebM export/); assert.match(stdout,/Export cancelled/);
  assert.equal((await api('snapshot')).data.render.state,'cancelled');
  await assert.rejects(access(join(dir,cliOutput)),'cancelled CLI export does not commit a partial file');
});

test('portrait canvas persists, reopens, previews and exports both MP4 orientations', { timeout: 120_000 }, async () => {
  const source = (await readFile(join(TEMPLATE_DIR,'scenes/progress-bar.ts'),'utf8'))
    .replace("export { meta, params, setup } from './component-frame.js';", "export { params, setup } from './component-frame.js';\nexport const meta = { width: 1920, height: 1080, duration: .2, fps: 30, background: '#17191d' };");
  assert.equal((await api('source','POST',{files:{'scenes/main.ts':source}})).status,200);
  await api('project','PATCH',{patch:{render:{fps:1,samples:1,glow:0,grain:0,workers:1,encoding:'crf',preset:'veryfast'}}});
  assert.equal(await page.getByRole('group',{name:'Canvas orientation'}).count(),0);
  await api('project','PATCH',{patch:{aspectRatio:'9:16'}});
  await page.waitForFunction(() => { const c = [...document.querySelectorAll<HTMLIFrameElement>('iframe.stage-frame:not([style*=hidden])')].at(-1)?.contentDocument?.querySelector<HTMLCanvasElement>('canvas.stage-canvas'); return c && c.height / c.width === 16/9; });
  assert.equal((await api('snapshot')).data.scene.meta.width,1080);
  assert.equal(JSON.parse(await readFile(join(dir,'mografy.json'),'utf8')).aspectRatio,'9:16');
  // Rebuild with exactly the same source version must retain the effective canvas.
  await api('source','POST',{files:{'scenes/main.ts':source}});
  assert.equal((await api('snapshot')).data.scene.meta.height,1920);
  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLIFrameElement>('iframe.stage-frame:not([style*=hidden])')].at(-1)?.contentDocument?.querySelector<HTMLCanvasElement>('canvas.stage-canvas')?.height! > [...document.querySelectorAll<HTMLIFrameElement>('iframe.stage-frame:not([style*=hidden])')].at(-1)?.contentDocument?.querySelector<HTMLCanvasElement>('canvas.stage-canvas')?.width!);
  const still = await fetch(new URL('/__mografy/still?t=0&kind=raw',server.url));
  const png = Buffer.from(await still.arrayBuffer());
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1080,1920]);
  assert.equal((await api('project','PATCH',{patch:{aspectRatio:'1:1'}})).status,422);
  const manifest = await readFile(join(dir,'mografy.json'),'utf8');
  const qa = fileURLToPath(new URL('../../../artifacts/portrait-video', import.meta.url)); await mkdir(qa,{recursive:true});
  await page.screenshot({path:join(qa,'portrait-player.png')});
  await page.getByRole('button',{name:'Export',exact:true}).click();
  const modal = page.getByRole('dialog'), toggle = modal.getByRole('group',{name:'MP4 orientation'});
  assert.equal(await toggle.getByRole('button',{name:'Portrait 9:16'}).getAttribute('aria-pressed'),'true');
  const resolution = modal.getByRole('combobox',{name:'Resolution',exact:true});
  await resolution.click();
  assert.deepEqual(await modal.getByRole('option').allTextContents(),['720 × 1280 — 720p','1080 × 1920 — 1080p']);
  await resolution.press('End'); await resolution.press('Enter');
  await toggle.getByRole('button',{name:'Landscape 16:9'}).focus();
  await toggle.getByRole('button',{name:'Landscape 16:9'}).press('Enter');
  assert.equal(await resolution.innerText(),'1920 × 1080 — 1080p');
  const fit = modal.getByRole('combobox',{name:'Fit',exact:true});
  assert.equal(await fit.innerText(),'Fit entire scene');
  await fit.click(); assert.deepEqual(await modal.getByRole('option').allTextContents(),['Fit entire scene','Fill and crop','Adapt layout']);
  await fit.press('End'); await fit.press('Enter');
  assert.equal(await fit.innerText(),'Adapt layout');
  assert.equal((await api('snapshot')).data.project.aspectRatio,'9:16');
  assert.equal((await api('snapshot')).data.scene.meta.width,1080,'export switch keeps authored canvas');
  await toggle.getByRole('button',{name:'Portrait 9:16'}).click();
  assert.equal(await resolution.innerText(),'1080 × 1920 — 1080p');
  assert.equal(await fit.count(),0,'matching scene aspect does not show Fit');
  await modal.getByRole('button',{name:/^Lottie/}).click(); await modal.getByRole('button',{name:/^MP4/}).click();
  assert.equal(await resolution.innerText(),'1080 × 1920 — 1080p');
  await modal.locator('.export-preview canvas').waitFor();
  assert.deepEqual(await modal.locator('.export-preview canvas').evaluate((c:HTMLCanvasElement)=>[c.width,c.height]),[216,384]);
  await toggle.getByRole('button',{name:'Landscape 16:9'}).click();
  assert.equal(await fit.innerText(),'Adapt layout','responsive Fit choice survives orientation changes');
  await modal.locator('.export-preview canvas').waitFor();
  await page.waitForFunction(() => { const c=document.querySelector<HTMLCanvasElement>('.export-preview canvas'); return c?.width === 384 && c.height === 216; });
  await modal.locator('.export-preview canvas').evaluate(c=>{(c as HTMLCanvasElement).dataset.retained='yes';});
  await api('project','PATCH',{patch:{render:{workers:1}}});
  assert.equal(await modal.locator('.export-preview canvas').getAttribute('data-retained'),'yes','unchanged project snapshots keep the export preview');
  await page.screenshot({path:join(qa,'portrait-export-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(qa,'portrait-export-mobile.png')});
  assert.ok(await modal.evaluate(e=>e.scrollWidth <= e.clientWidth),'mobile dialog has no horizontal overflow');
  await page.setViewportSize({width:1280,height:800});
  await toggle.getByRole('button',{name:'Portrait 9:16'}).click();
  await resolution.click(); await resolution.press('Home'); await resolution.press('Enter');
  await modal.getByRole('button',{name:'Export MP4',exact:true}).click();
  for(let i=0;i<1000 && (await api('snapshot')).data.render.state==='running';i++) await page.waitForTimeout(50);
  const render = (await api('snapshot')).data.render; assert.equal(render.state,'done',render.error);
  assert.match(render.output,/-portrait\.mp4$/);
  await modal.locator('[data-testid=export-job][data-state=done]').waitFor();
  await modal.getByRole('button',{name:'Done',exact:true}).click();
  await modal.waitFor({state:'hidden'});
  const pixels = await ffmpegOutput(['-i',render.output,'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1']);
  assert.equal(pixels.length,720*1280*4);
  assert.equal(await readFile(join(dir,'mografy.json'),'utf8'),manifest);
  // CLI's export path fits the same authored scene into the selected output viewport.
  const child = spawn(process.execPath,[BIN,'export',dir,'--orientation','landscape','--resolution','720p','-o','cli-landscape.mp4']);
  let stderr=''; child.stderr.on('data',c=>{stderr+=c;}); child.stdout.resume();
  assert.equal(await new Promise<number|null>(done=>child.once('close',done)),0,stderr);
  const horizontal = await ffmpegOutput(['-i',join(dir,'renders/cli-landscape.mp4'),'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1']);
  assert.equal(horizontal.length,1280*720*4);
  assert.equal(await readFile(join(dir,'mografy.json'),'utf8'),manifest);
  await api('project','PATCH',{patch:{aspectRatio:'16:9'}});
  await page.waitForFunction(() => { const c=[...document.querySelectorAll<HTMLIFrameElement>('iframe.stage-frame:not([style*=hidden])')].at(-1)?.contentDocument?.querySelector<HTMLCanvasElement>('canvas.stage-canvas');return c && c.width/c.height===16/9; });
  assert.equal((await api('snapshot')).data.scene.meta.width,1920);
  // Disk-edited aspect ratio is watched even if the compiled scene hash stays unchanged.
  const disk = JSON.parse(await readFile(join(dir,'mografy.json'),'utf8'));disk.aspectRatio='9:16';
  await writeFile(join(dir,'mografy.json'),JSON.stringify(disk));
  await page.waitForFunction(() => {const c=[...document.querySelectorAll<HTMLIFrameElement>('iframe.stage-frame:not([style*=hidden])')].at(-1)?.contentDocument?.querySelector<HTMLCanvasElement>('canvas.stage-canvas');return c && c.height/c.width===16/9;});
});

test('export dialog continues through progress, background work, cancellation, failure, retry and download', { timeout: 120_000 }, async () => {
  const created = await api('projects/new','POST',{name:'Export experience'});
  assert.equal(created.status,200);
  const projectDir = (await api('snapshot')).data.projectDir;
  await page.waitForFunction(() => document.querySelector('.topbar .project')?.textContent === 'Export experience');
  const source = await readFile(join(TEMPLATE_DIR,'scenes/progress-bar.ts'),'utf8');
  const published = await api('source','POST',{files:{'scenes/main.ts':source}});
  assert.equal(published.status,200);
  await page.waitForFunction(v=>document.querySelector<HTMLElement>('[data-testid=stage]')?.dataset.version===v,published.data.version);
  const qa = fileURLToPath(new URL('../../../artifacts/export-dialog', import.meta.url)); await mkdir(qa,{recursive:true});
  await page.getByRole('button',{name:'Export',exact:true}).click();
  const modal = page.getByRole('dialog',{name:'Export animation'});
  await modal.getByRole('group',{name:'MP4 orientation'}).getByRole('button',{name:'Portrait 9:16'}).click();
  // H.264 so the finished file plays in this test browser whatever its HEVC support; choosing the codec keeps the Quality preset
  const codec = modal.getByRole('combobox',{name:'Codec',exact:true}), qualityChoice = modal.getByRole('combobox',{name:'Quality',exact:true});
  const presetBefore = await qualityChoice.innerText();
  await codec.click(); await codec.press('End'); await codec.press('Enter');
  assert.equal(await codec.innerText(), 'H.264 · plays everywhere');
  assert.equal(await qualityChoice.innerText(), presetBefore);
  const quality = modal.getByRole('combobox',{name:'Quality',exact:true});
  await quality.click(); await quality.press('Home'); await quality.press('Enter');
  await page.screenshot({path:join(qa,'settings.png')});
  const originalManifest = await readFile(join(projectDir,'mografy.json'),'utf8');
  await modal.getByRole('button',{name:'Export MP4',exact:true}).click();
  const progress = modal.getByTestId('export-job');
  await progress.waitFor();
  const loader = modal.getByLabel('Export loading animation');
  await loader.waitFor();
  await loader.locator('img').evaluate(async image => { await (image as HTMLImageElement).decode(); });
  assert.notEqual(await loader.locator('.export-mascot-character').evaluate(e=>getComputedStyle(e).animationName),'none');
  const transform = await loader.locator('.export-mascot-character').evaluate(e=>getComputedStyle(e).transform);
  await page.waitForTimeout(150);
  assert.notEqual(await loader.locator('.export-mascot-character').evaluate(e=>getComputedStyle(e).transform),transform,'mascot loading animation moves');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await loader.locator('.export-mascot-character').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(() => {const e=document.querySelector('[data-testid=export-job][data-state=running] [role=progressbar]');return Number(e?.getAttribute('aria-valuenow')) > 0;});
  const first = (await api('snapshot')).data.render;
  assert.equal(first.state,'running');
  assert.equal(await modal.getByRole('combobox').count(),0,'settings are replaced with progress');
  await page.screenshot({path:join(qa,'progress-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(qa,'progress-mobile.png')});
  assert.ok(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth),'progress dialog fits phone width');
  await page.setViewportSize({width:1280,height:800});
  await modal.getByRole('button',{name:'Hide export',exact:true}).click();
  await modal.waitFor({state:'hidden'});
  assert.equal((await api('snapshot')).data.render.id,first.id);
  assert.equal((await api('snapshot')).data.render.state,'running','dismissal does not cancel');
  const toast = page.getByRole('complementary',{name:'Export progress'});
  await toast.waitFor();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.inspector-footer .job').count(),0,'background progress has one clear surface');
  assert.equal(await toast.getByRole('progressbar').count(),1);
  await page.screenshot({path:join(qa,'toast-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  await page.screenshot({path:join(qa,'toast-mobile.png')});
  assert.ok(await page.getByRole('button',{name:'View active export'}).evaluate(e=>e.getBoundingClientRect().right<=innerWidth),'active export remains reachable on phones');
  assert.ok(await toast.evaluate(e=>e.getBoundingClientRect().right<=innerWidth),'background toast fits phone width');
  await page.setViewportSize({width:1280,height:800});
  await toast.getByRole('button',{name:'View export',exact:true}).click();
  await progress.waitFor();
  assert.equal(await toast.count(),0,'opening progress hides the toast');
  await modal.getByRole('button',{name:'Cancel export',exact:true}).click();
  await modal.locator('[data-testid=export-job][data-state=cancelled]').waitFor();
  await page.screenshot({path:join(qa,'cancelled.png')});
  await assert.rejects(access(first.output),'cancellation does not publish a partial file');
  await modal.getByRole('button',{name:'Edit settings',exact:true}).click();
  const failedSource = source.replace('  componentFrame(ctx, time, params,', "  if (time > .005 && time < .06) throw new Error('Export frame could not be drawn');\n  componentFrame(ctx, time, params,");
  assert.equal((await api('source','POST',{files:{'scenes/main.ts':failedSource}})).status,200,'trial poses are valid');
  await modal.getByRole('button',{name:'Export MP4',exact:true}).click();
  await modal.locator('[data-testid=export-job][data-state=failed]').waitFor();
  assert.match(await modal.getByRole('alert').innerText(),/Export frame could not be drawn/);
  await page.screenshot({path:join(qa,'failed.png')});
  const short = source.replace("export { meta, params, setup } from './component-frame.js';", "export { params, setup } from './component-frame.js';\nexport const meta = { width: 1920, height: 1080, duration: 1.2, fps: 30, background: '#17191d' };");
  const fixed = await api('source','POST',{files:{'scenes/main.ts':short}});
  assert.equal(fixed.status,200);
  await page.waitForFunction(v=>document.querySelector<HTMLElement>('[data-testid=stage]')?.dataset.version===v,fixed.data.version);
  await modal.getByRole('button',{name:'Retry export',exact:true}).click();
  await modal.locator('[data-testid=export-job][data-state=done]').waitFor();
  const video = modal.getByLabel('Exported video');
  await video.evaluate((v:HTMLVideoElement)=>v.readyState>=1 ? Promise.resolve() : new Promise<void>(r=>v.addEventListener('loadedmetadata',()=>r(),{once:true})));
  await video.evaluate(async (v:HTMLVideoElement)=>{await v.play();v.pause();});
  assert.deepEqual(await video.evaluate((v:HTMLVideoElement)=>[v.videoWidth,v.videoHeight]),[720,1280]);
  await page.screenshot({path:join(qa,'complete-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:join(qa,'complete-mobile.png')});
  assert.ok(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth),'completion dialog fits phone width');
  const downloadEvent = page.waitForEvent('download');
  await modal.getByRole('link',{name:'Download',exact:true}).click();
  const download = await downloadEvent; await download.saveAs(join(qa,'verified-export.mp4'));
  assert.equal((await readFile(join(qa,'verified-export.mp4'))).subarray(4,8).toString(),'ftyp');
  assert.equal(await readFile(join(projectDir,'mografy.json'),'utf8'),originalManifest,'full export flow keeps project settings');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await modal.getByTestId('export-job').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await modal.getByRole('button',{name:'Done',exact:true}).click();
  await modal.waitFor({state:'hidden'});
  assert.equal(await page.locator('.export-complete').count(),0,'returning to work does not repeat completion');
  assert.equal(await page.locator('.export-progress-toast').count(),0,'Done does not show a progress or success toast');
  await page.getByRole('button',{name:'View last export',exact:true}).click();
  await modal.locator('[data-testid=export-job][data-state=done]').waitFor();
  await modal.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal(await page.locator('.export-complete').count(),0);
  await page.getByRole('button',{name:'Export',exact:true}).click();
  await modal.getByRole('button',{name:'Export MP4',exact:true}).waitFor();
  assert.equal(await modal.getByTestId('export-job').count(),0,'new export opens settings after Done');
  await modal.getByRole('button',{name:'Export MP4',exact:true}).click();
  await modal.getByRole('button',{name:'Hide export',exact:true}).click();
  await page.getByRole('button',{name:'View last export',exact:true}).waitFor();
  assert.equal(await page.locator('.export-progress-toast').count(),0,'background completion clears the progress toast');
  await page.getByRole('button',{name:'Export',exact:true}).click();
  await modal.getByRole('button',{name:'Export MP4',exact:true}).waitFor();
  assert.equal(await modal.getByTestId('export-job').count(),0,'a hidden completed job does not replace fresh settings');
  await modal.getByRole('button',{name:'Close export'}).click();
  await page.setViewportSize({width:1280,height:800});
  await page.screenshot({path:join(qa,'workspace-after-done.png')});
});
