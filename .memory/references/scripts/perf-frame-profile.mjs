import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/bigtree/Git/ob-crash-game/package.json');
const { chromium } = require('playwright');

const OUT = new URL('./out/', import.meta.url).pathname;
const [,, W='1440', H='900', DSF='2', TAG='retina', MEASURE_MS='5000'] = process.argv;
const MS = +MEASURE_MS;

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--disable-gpu-vsync','--disable-frame-rate-limit','--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport:{width:+W,height:+H}, deviceScaleFactor:+DSF, ignoreHTTPSErrors:true });
const page = await context.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));

await page.addInitScript(() => {
  const P = window.__prof = { frames:[], jsMs:0, draws:0, drawsPerFrame:[], commits:0, last:0, rec:false };
  const raf = window.requestAnimationFrame.bind(window);
  P.longCb = 0; window.requestAnimationFrame = (cb) => raf((t) => { const s = performance.now(); cb(t); const d = performance.now()-s; if (P.rec) { P.jsMs += d; if (d > 50) P.longCb++; } });
  const tick = (t) => { if (P.rec) { if (P.last) P.frames.push(t-P.last); P.last = t; P.drawsPerFrame.push(P.draws); } P.draws = 0; raf(tick); };
  raf(tick);
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    for (const m of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
      const o = proto[m]; if (!o) continue;
      proto[m] = function(...a){ P.draws++; return o.apply(this,a); };
    }
  }
  P.loaf = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (P.rec && e.duration > 100) P.loaf.push({ dur: Math.round(e.duration), blocking: Math.round(e.blockingDuration), scripts: e.scripts.map((sc) => ({ fn: sc.sourceFunctionName, src: (sc.sourceURL || '').split('/').pop().split('?')[0], char: sc.sourceCharPosition, dur: Math.round(sc.duration), kind: sc.invokerType })) }); })).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
  P.tex=0; P.compile=0; P.link=0; P.texBytes=0;
  for (const proto of [WebGL2RenderingContext.prototype]) {
    for (const m of ['texImage2D','texSubImage2D','texStorage2D','compressedTexImage2D']) { const o=proto[m]; if(!o) continue; proto[m]=function(...a){ P.tex++; return o.apply(this,a); }; }
    const c=proto.compileShader; proto.compileShader=function(...a){ P.compile++; return c.apply(this,a); };
    const l=proto.linkProgram; proto.linkProgram=function(...a){ P.link++; return l.apply(this,a); };
  }
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers:new Map(), supportsFiber:true, isDisabled:false, checkDCE(){}, inject(r){ const id=this.renderers.size+1; this.renderers.set(id,r); return id; }, onScheduleFiberRoot(){}, onCommitFiberRoot(){ if (P.rec) P.commits++; }, onCommitFiberUnmount(){}, onPostCommitFiberRoot(){} };
});

await page.route('**/src/pc/components/GameCanvas3D.tsx*', async (route) => {
  const res = await route.fetch(); let b = await res.text();
  const before = b;
  b = b.replace('container.appendChild(renderer.domElement);','container.appendChild(renderer.domElement); window.__renderer=renderer;');
  b = b.replace('scene.add(particles.group);','scene.add(particles.group); window.__particles=particles;');
  if (b === before || !b.includes('window.__renderer') || !b.includes('window.__particles')) console.log('!! canvas inject failed');
  await route.fulfill({ response:res, body:b });
});

const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable',{ timeDomain:'threadTicks' });
const cdpMetrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));

await page.goto('https://localhost:5173',{ waitUntil:'load' });
await page.waitForTimeout(2500);
await page.evaluate(() => { const btn=[...document.querySelectorAll('button')].find(b=>b.textContent&&b.textContent.includes('스마트폰 없이 PC')); if(btn) btn.click(); });
await page.waitForFunction(() => window.__engine && window.__engine.gamePhase==='PLAYING', null, { timeout:20000 });
await page.waitForTimeout(1500);

const gpu = await page.evaluate(() => { const gl=window.__renderer.getContext(); const e=gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'?', drawW:gl.drawingBufferWidth, drawH:gl.drawingBufferHeight, dpr:window.devicePixelRatio, pr:window.__renderer.getPixelRatio() }; });
console.log('GPU', JSON.stringify(gpu));

await page.evaluate(() => {
  const eng = window.__engine;
  eng.waveCardKillTargets = {1:1e9,2:1e9,3:1e9,4:1e9,5:1e9};
  eng.isWeaponSelectPending=false; eng.isRewardCardPending=false;
  eng.lives=eng.maxLives=999;
  const kinds=['pilgood','caslight','obi','hanmac','bottle'];
  window.__benchTargets = (n=12) => {
    const out=[];
    for(let i=0;i<n;i++){ const theta=-0.5+(i/(n-1))*1.0; const r=6+(i%4)*2.2; out.push({ id:`bench_${Date.now()}_${i}`, kind:kinds[i%kinds.length], hp:1e7, maxHp:1e7, radiusM:r, thetaRad:theta, x:r*Math.sin(theta), z:-r*Math.cos(theta), speedMps:0, hitRadiusM:0.8, killBonusScore:0, breached:false }); }
    return out;
  };
  eng.activeTargets = window.__benchTargets(12);
  window.__keep = setInterval(() => {
    const w=eng.getPlayer(0).weaponSystem; w.ammo=w.getMaxAmmo(); w.isReloading=false;
    eng.isRewardCardPending=false; eng.isWeaponSelectPending=false;
    if(!window.__allowNatural) eng.activeTargets = eng.activeTargets.filter(t=>String(t.id).startsWith('bench_'));
    eng.lives=999;
  },25);
  const canvasEl=document.querySelector('canvas'); const container=canvasEl.parentElement;
  window.__aimTick=null;
  window.__holdStart=()=>{
    const send=(type)=>{ const t=eng.activeTargets[Math.min(6,eng.activeTargets.length-1)]; const m=t&&window.__targetMeshMap.get(t.id); if(!m) return; const v=m.position.clone(); v.y+=0.3; v.project(window.__camera); const x=(v.x+1)/2*innerWidth, y=(1-v.y)/2*innerHeight; container.dispatchEvent(new MouseEvent(type,{button:0,bubbles:true,clientX:x,clientY:y})); };
    send('mousemove'); send('mousedown'); window.__aimTick=setInterval(()=>send('mousemove'),50);
  };
  window.__holdStop=()=>{ if(window.__aimTick)clearInterval(window.__aimTick); window.__aimTick=null; window.dispatchEvent(new MouseEvent('mouseup',{button:0})); };
  window.__setWeapon=(k,l)=>eng.getPlayer(0).weaponSystem.selectWeapon(k,l);
  window.__setFever=(on)=>{ const s=eng.getPlayer(0).scoreManager; if(on){ s.forceSetFeverGauge(100); eng.activateFever(performance.now()); s.feverEndTimeMs=performance.now()+1e6; } else { s.feverEndTimeMs=0; } };
});
await page.waitForTimeout(800);

const pct=(a,p)=>{ if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(s.length*p))]; };
const measure = async (name, ms=MS, settle=1200) => {
  await page.evaluate(()=>new Promise(r=>{let n=0; const f=()=>{ if(++n>6) r(); else requestAnimationFrame(f)}; requestAnimationFrame(f);}));
  await page.waitForTimeout(settle);
  const m0=await cdpMetrics();
  await page.evaluate(()=>{ const P=window.__prof; P.frames=[]; P.jsMs=0; P.drawsPerFrame=[]; P.commits=0; P.last=0; P.rec=true; P.peakParticles=0; P.peakTracers=0; P.ptick=setInterval(()=>{ P.peakParticles=Math.max(P.peakParticles,window.__particles.activeParticleCount); P.peakTracers=Math.max(P.peakTracers,window.__particles.tracerBeams.length); },30); });
  await page.waitForTimeout(ms);
  const d=await page.evaluate(()=>{ const P=window.__prof; P.rec=false; clearInterval(P.ptick); const flash=window.__particles.tracerBeams.map(t=>+t.flashMesh.scale.x.toFixed(2)); return { frames:P.frames, jsMs:P.jsMs, draws:P.drawsPerFrame, commits:P.commits, peakParticles:P.peakParticles, peakTracers:P.peakTracers, flash, programs:window.__renderer.info.programs.length }; });
  const m1=await cdpMetrics();
  const sec=ms/1000; const f=d.frames; const sum=f.reduce((a,b)=>a+b,0);
  const r={ name, fps:+(f.length/(sum/1000||1)).toFixed(1), p50:+pct(f,.5).toFixed(1), p95:+pct(f,.95).toFixed(1), p99:+pct(f,.99).toFixed(1), max:+Math.max(0,...f).toFixed(1), over33:f.filter(x=>x>33.4).length, jsPerFrame:+(d.jsMs/Math.max(1,f.length)).toFixed(2), drawCalls:Math.round(d.draws.reduce((a,b)=>a+b,0)/Math.max(1,d.draws.length)), commitsPerSec:+(d.commits/sec).toFixed(1), scriptMsPerSec:+(((m1.ScriptDuration-m0.ScriptDuration)*1000)/sec).toFixed(0), taskMsPerSec:+(((m1.TaskDuration-m0.TaskDuration)*1000)/sec).toFixed(0), styleLayoutMsPerSec:+((((m1.RecalcStyleDuration-m0.RecalcStyleDuration)+(m1.LayoutDuration-m0.LayoutDuration))*1000)/sec).toFixed(0), peakParticles:d.peakParticles, peakTracers:d.peakTracers, programs:d.programs, flashScaleSample:d.flash.slice(0,3) };
  console.log(JSON.stringify(r));
  return r;
};


const results={ gpu, tag:TAG, ab:[], spikes:{}, natural:null };
const spike=async(label,fnStr,wait=1500)=>{
  await page.waitForTimeout(600);
  const out=await page.evaluate(async({fnStr,wait})=>{
    const P=window.__prof; const b=window.__renderer.info.programs.length; const m0=window.__renderer.info.memory.textures;
    const c0=P.compile,l0=P.link,t0=P.tex; P.longCb=0;
    P.frames=[]; P.last=0; P.rec=true;
    (0,eval)(`(${fnStr})()`);
    await new Promise(r=>setTimeout(r,wait));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    P.rec=false;
    return { maxFrameMs:+Math.max(0,...P.frames).toFixed(0), jsBlockedFrames:P.longCb, programs:`${b}->${window.__renderer.info.programs.length}`, linkProgram:P.link-l0, compileShader:P.compile-c0, texUploads:P.tex-t0, texturesMem:`${m0}->${window.__renderer.info.memory.textures}` };
  },{fnStr,wait});
  results.spikes[label]=out; console.log('SPIKE',label,JSON.stringify(out));
};

await page.waitForTimeout(+(process.env.LEAD_IDLE_MS||0));
// --- A. Clean hitch tests, before any toggle
await spike('A1_first_monster_spawn_ever', `()=>{ window.__engine.activeTargets=window.__benchTargets(12); }`,2500);
await spike('A2_kill_one_pilgood(another_remains)', `()=>{ const e=window.__engine; const i=e.activeTargets.findIndex(t=>t.kind==='pilgood'); e.activeTargets.splice(i,1); }`);
await spike('A3_kill_one_obi(another_remains)', `()=>{ const e=window.__engine; const i=e.activeTargets.findIndex(t=>t.kind==='obi'); e.activeTargets.splice(i,1); }`);
await spike('A4_kill_one_hanmac(another_remains)', `()=>{ const e=window.__engine; const i=e.activeTargets.findIndex(t=>t.kind==='hanmac'); e.activeTargets.splice(i,1); }`);
await spike('A5_clear_all_monsters', process.env.NOOP_CONTROL ? `()=>{}` : `()=>{ window.__engine.activeTargets=[]; }`,2500);
await spike('A6_respawn_after_field_empty', `()=>{ window.__engine.activeTargets=window.__benchTargets(12); }`,2500);
await spike('A7_clear_all_again', `()=>{ window.__engine.activeTargets=[]; }`,2500);
await spike('A8_respawn_again', `()=>{ window.__engine.activeTargets=window.__benchTargets(12); }`,2500);
await spike('A9_spawn_one_can_while_others_alive', `()=>{ const e=window.__engine; const b=window.__benchTargets(12)[0]; b.id='bench_x_'+Date.now(); e.activeTargets.push(b); }`);
await page.evaluate(()=>{ clearInterval(window.__keep); window.__engine.isRewardCardPending=false; });
await spike('A10_reward_cards_spawn', `()=>{ window.__engine.spawnWaveRewardCards(performance.now(),false); }`);
await spike('A11_reward_cards_gone', `()=>{ const e=window.__engine; e.activeTargets=e.activeTargets.filter(t=>!t.rewardCardKind); e.isRewardCardPending=false; }`);
await spike('A12_reward_cards_spawn_again', `()=>{ window.__engine.spawnWaveRewardCards(performance.now(),false); }`);
await spike('A13_reward_cards_gone_again', `()=>{ const e=window.__engine; e.activeTargets=e.activeTargets.filter(t=>!t.rewardCardKind); e.isRewardCardPending=false; }`);
const sk=(k)=>`()=>{ window.__particles.spawnSkillEffect('${k}',4,window.__engine.activeTargets.slice(0,12).map(t=>window.__targetMeshMap.get(t.id)?.position.clone()).filter(Boolean)); }`;
for (const k of ['shotgun','revolver','gatling']) await spike(`A14_skill_${k}`, sk(k), 2200);
await spike('A15_wave7_boss_encounter_with_king_shield', `()=>{ const e=window.__engine; e.startWave(7); e.activeTargets=[]; e.spawnedInWave=999; e.spawnBossEncounter(performance.now()); }`, 3000);
await spike('A16_boss_minion_summon', `()=>{ window.__engine.spawnBossMinionWave(performance.now(), 4); }`, 2500);
// Back to a clean wave-1 state with the bench cluster for the sustained-fire and natural-play sections
await page.evaluate(()=>{ const e=window.__engine; e.startWave(1); e.activeTargets=window.__benchTargets(12); e.isBossEncounterActive=false; });
await page.evaluate(()=>{ const eng=window.__engine; window.__keep=setInterval(()=>{ const w=eng.getPlayer(0).weaponSystem; w.ammo=w.getMaxAmmo(); w.isReloading=false; eng.isRewardCardPending=false; eng.isWeaponSelectPending=false; eng.activeTargets=eng.activeTargets.filter(t=>String(t.id).startsWith('bench_')); eng.lives=999; },25); });

// --- B. Sustained fire (gatling Lv.4 / shotgun Lv.4 / fever), mouse-hold on a moving cluster
await page.evaluate(()=>{ window.__holdStart(); });
for (const [name,setup] of [
  ['sustained_gatling_lv4', `()=>{ window.__setFever(false); window.__setWeapon('gatling',4); }`],
  ['sustained_shotgun_lv4', `()=>{ window.__setFever(false); window.__setWeapon('shotgun',4); }`],
  ['sustained_fever_gatling', `()=>{ window.__setWeapon('gatling',4); window.__setFever(true); }`],
]) {
  await page.evaluate((fn)=>(0,eval)(`(${fn})()`), setup);
  const r=await measure(name,MS,1500);
  results.ab.push(r);
}
await page.evaluate(()=>{ window.__setFever(false); window.__holdStop(); });

// --- C. Screenshot right after one shot (muzzle flash must not cover the screen)
await page.evaluate(()=>{ window.__setWeapon('shotgun',2); const eng=window.__engine; const w=eng.getPlayer(0).weaponSystem; w.ammo=w.getMaxAmmo(); });
await page.waitForTimeout(500);
await page.evaluate(()=>{
  const c=document.querySelector('canvas').parentElement; const eng=window.__engine;
  const t=eng.activeTargets[Math.min(6,eng.activeTargets.length-1)]; const m=window.__targetMeshMap.get(t.id);
  const v=m.position.clone(); v.y+=0.3; v.project(window.__camera);
  const x=(v.x+1)/2*innerWidth,y=(1-v.y)/2*innerHeight;
  c.dispatchEvent(new MouseEvent('mousemove',{button:0,bubbles:true,clientX:x,clientY:y}));
  c.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true,clientX:x,clientY:y}));
  window.dispatchEvent(new MouseEvent('mouseup',{button:0}));
  window.__flashSample = window.__particles.getActiveFlashScales();
});
await page.waitForTimeout(40);
await page.screenshot({path:`${OUT}${TAG}-after-shot.png`});
results.afterShotFlashScales = await page.evaluate(()=>window.__flashSample);

// --- D. Natural play, real waves & kills, no cheats except infinite lives
await page.evaluate(()=>{
  const eng=window.__engine; clearInterval(window.__keep);
  eng.waveCardKillTargets={1:10,2:14,3:18,4:20,5:15};
  eng.activeTargets=eng.activeTargets.filter(t=>!String(t.id).startsWith('bench_'));
  eng.startWave ? 0 : 0;
  window.__setWeapon('gatling',2);
  window.__livesKeep=setInterval(()=>{ eng.lives=999; const w=eng.getPlayer(0).weaponSystem; w.ammo=Math.max(w.ammo,1); },200);
  const c=document.querySelector('canvas').parentElement;
  const send=(type)=>{ const ts=[...eng.activeTargets].sort((a,b)=>(a.radiusM??0)-(b.radiusM??0)); const t=ts[0]; const m=t&&window.__targetMeshMap.get(t.id); if(!m) return; const v=m.position.clone(); v.y+=0.3; v.project(window.__camera); const x=(v.x+1)/2*innerWidth,y=(1-v.y)/2*innerHeight; c.dispatchEvent(new MouseEvent(type,{button:0,bubbles:true,clientX:x,clientY:y})); };
  window.__natural=setInterval(()=>send('mousemove'),40);
  c.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true,clientX:innerWidth/2,clientY:innerHeight/2}));
});
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval',{interval:500}); await cdp.send('Profiler.start');
const natural=await page.evaluate(async()=>{
  const P=window.__prof; const eng=window.__engine; const c0=P.compile,l0=P.link,t0=P.tex; const events=[];
  P.frames=[]; P.last=0; P.rec=true; P.jsMs=0; P.commits=0; P.longCb=0;
  const t0ms=performance.now(); let prevN=0; const count=[];
  const raf0=window.requestAnimationFrame;
  while(performance.now()-t0ms<30000){ await new Promise(r=>setTimeout(r,250)); count.push(eng.activeTargets.length); }
  P.rec=false;
  const f=P.frames; const s=[...f].sort((a,b)=>a-b);
  return { durSec:30, frames:f.length, fps:+(f.length/(f.reduce((a,b)=>a+b,0)/1000)).toFixed(1), p50:+s[Math.floor(s.length*.5)].toFixed(1), p95:+s[Math.floor(s.length*.95)].toFixed(1), p99:+s[Math.floor(s.length*.99)].toFixed(1), max:+s[s.length-1].toFixed(0), over50ms:f.filter(x=>x>50).length, over100ms:f.filter(x=>x>100).length, over250ms:f.filter(x=>x>250).length, over1000ms:f.filter(x=>x>1000).length, top5:[...s].slice(-5).map(x=>+x.toFixed(0)), longCallbacks:P.longCb, longFrames:P.loaf.slice(0,5), link:P.link-l0, compile:P.compile-c0, texUploads:P.tex-t0, commitsPerSec:+(P.commits/30).toFixed(1), peakTargets:Math.max(...count), wave:eng.currentWave, phase:eng.gamePhase };
});
const prof=(await cdp.send('Profiler.stop')).profile;
{ const self=new Map(); const byId=new Map(prof.nodes.map(n=>[n.id,n])); const dt=prof.timeDeltas;
  prof.samples.forEach((id,i)=>{ const n=byId.get(id); const k=`${n.callFrame.functionName||'(anon)'} ${(n.callFrame.url||'').split('/').pop().split('?')[0]}:${n.callFrame.lineNumber}`; self.set(k,(self.get(k)||0)+(dt[i]||0)); });
  natural.topSelfMs=[...self.entries()].filter(([k])=>!k.startsWith('(idle)')&&!k.startsWith('(program)')).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>`${(v/1000).toFixed(0)}ms ${k}`);
}
results.natural=natural; console.log('NATURAL',JSON.stringify(natural));
results.verdict = (() => {
  const sp = results.spikes;
  const killSpikes = ['A2_kill_one_pilgood(another_remains)','A3_kill_one_obi(another_remains)','A4_kill_one_hanmac(another_remains)'];
  const gat = results.ab.find(r=>r.name==='sustained_gatling_lv4');
  const refreshHz = Number(process.env.REFRESH_HZ || 60);
  const p95Limit = refreshHz >= 60 ? 16.7 : 20;
  return {
    naturalLinkProgram: { value: natural.link, pass: natural.link === 0 },
    // 이 환경의 헤드리스 Metal은 빈 캔버스에서도 약 13초마다 180~280ms 멈춤이 생긴다(앱과 무관).
    // JS가 50ms 넘게 막은 프레임(longCallbacks)은 0이어야 하고, 250ms 초과 프레임은 환경 멈춤 수(약 초당 1/13) 이내여야 한다.
    // 환경 멈춤은 스크립트 시간이 없다. NOOP_CONTROL=1로 A5를 빈 동작으로 바꿔도 무작위 spike에서 270~850ms 멈춤이 재현된다.
    spikeJsBlockedFrames: { value: Object.entries(sp).filter(([,v])=>v.jsBlockedFrames>0).map(([k])=>k), pass: Object.values(sp).every(v=>v.jsBlockedFrames===0) },
    naturalJsBlockedFrames: { value: natural.longCallbacks, pass: natural.longCallbacks === 0 },
    naturalOver250ms: { value: natural.over250ms, limit: Math.ceil(natural.durSec / 13) + 1, pass: natural.over250ms <= Math.ceil(natural.durSec / 13) + 1 && natural.over1000ms === 0 },
    killTextureUploads: { value: killSpikes.map(k=>sp[k]?.texUploads), pass: killSpikes.every(k=>sp[k]?.texUploads === 0) },
    secondCardSpawnMaxFrameMs: { value: sp['A12_reward_cards_spawn_again']?.maxFrameMs, pass: (sp['A12_reward_cards_spawn_again']?.maxFrameMs ?? 1e9) < 100 },
    gatlingAvgFps: { value: gat?.fps, pass: (gat?.fps ?? 0) >= 90 },
    gatlingP95: { value: gat?.p95, limit: p95Limit, pass: (gat?.p95 ?? 1e9) <= p95Limit },
    naturalCommitsPerSec: { value: natural.commitsPerSec, pass: natural.commitsPerSec <= 15 },
    flashScalesAfterShot: { value: results.afterShotFlashScales, pass: results.afterShotFlashScales.length > 0 && results.afterShotFlashScales.every(v=>v < 0.2) },
  };
})();
fs.writeFileSync(`${OUT}perf-after-P01-${TAG}.json`,JSON.stringify(results,null,2));
console.log('\nVERDICT'); for (const [k,v] of Object.entries(results.verdict)) console.log((v.pass?'PASS':'FAIL').padEnd(5),k.padEnd(28),JSON.stringify(v.value));
await browser.close();
