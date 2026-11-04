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
  window.requestAnimationFrame = (cb) => raf((t) => { const s = performance.now(); cb(t); if (P.rec) P.jsMs += performance.now()-s; });
  const tick = (t) => { if (P.rec) { if (P.last) P.frames.push(t-P.last); P.last = t; P.drawsPerFrame.push(P.draws); } P.draws = 0; raf(tick); };
  raf(tick);
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    for (const m of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
      const o = proto[m]; if (!o) continue;
      proto[m] = function(...a){ P.draws++; return o.apply(this,a); };
    }
  }
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
  const a = b.length;
  b = b.replace('composer.addPass(bloomPass);','composer.addPass(bloomPass); window.__renderer=renderer; window.__composer=composer; window.__bloom=bloomPass;');
  b = b.replace('scene.add(particles.group);','scene.add(particles.group); window.__particles=particles;');
  if (b.length===a) console.log('!! canvas inject failed');
  await route.fulfill({ response:res, body:b });
});
await page.route('**/src/pc/PCGamePage.tsx*', async (route) => {
  const res = await route.fetch(); let b = await res.text();
  const a = b.length;
  b = b.replace('onMonsterProjectionsUpdate: setMonsterProjections','onMonsterProjectionsUpdate: (p)=>{ if(!window.__noReact) setMonsterProjections(p); }');
  b = b.replace('setHudState({','window.__noReact || setHudState({');
  if (b.length===a) console.log('!! page inject failed');
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
    const w=eng.weaponSystem; w.ammo=w.getMaxAmmo(); w.isReloading=false;
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
  window.__css=document.createElement('style');
  window.__toggles=(t)=>{
    const pr=window.__particles;
    if(t.noMuzzleFlash){ const proto=Object.getPrototypeOf(pr).spawnTracerBeam; pr.spawnTracerBeam=function(...a){ proto.apply(this,a); const it=this.tracerBeams[this.tracerBeams.length-1]; if(it) it.flashMesh.visible=false; }; } else { delete pr.spawnTracerBeam; }
    window.__bloom.enabled=!t.noBloom;
    const px=t.dpr1?1:window.devicePixelRatio; if(window.__renderer.getPixelRatio()!==Math.min(px,2)){ window.__renderer.setPixelRatio(Math.min(px,2)); window.__composer.setPixelRatio(Math.min(px,2)); }
    if(t.noCss){ window.__css.textContent='*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important;box-shadow:none!important;text-shadow:none!important;}'; document.head.appendChild(window.__css);} else { window.__css.remove(); }
    window.__noReact=!!t.noReact;
    window.__scene.traverse(o=>{ if(o.isPointLight) o.visible=!t.noPointLights; });
  };
  window.__setWeapon=(k,l)=>eng.weaponSystem.selectWeapon(k,l);
  window.__setFever=(on)=>{ const s=eng.scoreManager; if(on){ s.forceSetFeverGauge(100); eng.activateFever(performance.now()); s.feverEndTimeMs=performance.now()+1e6; } else { s.feverEndTimeMs=0; } };
});
await page.waitForTimeout(800);

const pct=(a,p)=>{ if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(s.length*p))]; };
const measure = async (name, ms=MS, settle=1200) => {
  await page.evaluate(()=>new Promise(r=>{let n=0; const f=()=>{ if(++n>6) r(); else requestAnimationFrame(f)}; requestAnimationFrame(f);}));
  await page.waitForTimeout(settle);
  const m0=await cdpMetrics();
  await page.evaluate(()=>{ const P=window.__prof; P.frames=[]; P.jsMs=0; P.drawsPerFrame=[]; P.commits=0; P.last=0; P.rec=true; P.peakParticles=0; P.peakTracers=0; P.ptick=setInterval(()=>{ P.peakParticles=Math.max(P.peakParticles,window.__particles.particles.length); P.peakTracers=Math.max(P.peakTracers,window.__particles.tracerBeams.length); },30); });
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
    const c0=P.compile,l0=P.link,t0=P.tex;
    P.frames=[]; P.last=0; P.rec=true;
    (0,eval)(`(${fnStr})()`);
    await new Promise(r=>setTimeout(r,wait));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    P.rec=false;
    return { maxFrameMs:+Math.max(0,...P.frames).toFixed(0), programs:`${b}->${window.__renderer.info.programs.length}`, linkProgram:P.link-l0, compileShader:P.compile-c0, texUploads:P.tex-t0, texturesMem:`${m0}->${window.__renderer.info.memory.textures}` };
  },{fnStr,wait});
  results.spikes[label]=out; console.log('SPIKE',label,JSON.stringify(out));
};

// --- A. Clean hitch tests, before any toggle
await spike('A1_first_monster_spawn_ever', `()=>{ window.__engine.activeTargets=window.__benchTargets(12); }`,2500);
await spike('A2_kill_one_pilgood(another_remains)', `()=>{ const e=window.__engine; const i=e.activeTargets.findIndex(t=>t.kind==='pilgood'); e.activeTargets.splice(i,1); }`);
await spike('A3_kill_one_obi(another_remains)', `()=>{ const e=window.__engine; const i=e.activeTargets.findIndex(t=>t.kind==='obi'); e.activeTargets.splice(i,1); }`);
await spike('A4_kill_one_hanmac(another_remains)', `()=>{ const e=window.__engine; const i=e.activeTargets.findIndex(t=>t.kind==='hanmac'); e.activeTargets.splice(i,1); }`);
await spike('A5_clear_all_monsters', `()=>{ window.__engine.activeTargets=[]; }`,2500);
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
await page.evaluate(()=>{ const eng=window.__engine; window.__keep=setInterval(()=>{ const w=eng.weaponSystem; w.ammo=w.getMaxAmmo(); w.isReloading=false; eng.isRewardCardPending=false; eng.isWeaponSelectPending=false; eng.activeTargets=eng.activeTargets.filter(t=>String(t.id).startsWith('bench_')); eng.lives=999; },25); });

// --- B. ABAB (baseline re-measured between every toggle, so thermal drift is visible)
await page.evaluate(()=>{ window.__setWeapon('gatling',4); window.__holdStart(); });
for (const [name,t] of [
  ['noMuzzleFlash',{noMuzzleFlash:true}],
  ['noBloom',{noBloom:true}],
  ['dpr1',{dpr1:true}],
  ['noCssEffects',{noCss:true}],
  ['noReactHudTicks',{noReact:true}],
  ['noPointLights',{noPointLights:true}],
  ['ALL_OFF',{noMuzzleFlash:true,noBloom:true,dpr1:true,noCss:true,noReact:true,noPointLights:true}],
]) {
  await page.evaluate(()=>window.__toggles({}));
  const base=await measure(`base_before_${name}`,MS,1500);
  await page.evaluate((t)=>window.__toggles(t),t);
  const tr=await measure(name,MS,1500);
  results.ab.push({name,base:{fps:base.fps,p95:base.p95,p99:base.p99,task:base.taskMsPerSec},toggled:{fps:tr.fps,p95:tr.p95,p99:tr.p99,task:tr.taskMsPerSec},draw:tr.drawCalls,commits:tr.commitsPerSec});
}
await page.evaluate(()=>{ window.__toggles({}); window.__holdStop(); });

// --- C. Look comparison stills (paused, no firing)
await page.evaluate(()=>{ window.__engine.isPaused=true; });
const still=async(n,t)=>{ await page.evaluate((t)=>window.__toggles(t),t); await page.evaluate(()=>new Promise(r=>{let n=0;const f=()=>{ if(++n>6) r(); else requestAnimationFrame(f)};requestAnimationFrame(f);})); await page.waitForTimeout(500); await page.screenshot({path:`${OUT}${TAG}-look-${n}.png`}); };
await still('baseline',{});
await still('noBloom',{noBloom:true});
await still('dpr1',{dpr1:true});
await page.evaluate(()=>{ window.__toggles({}); window.__engine.isPaused=false; });

// --- D. Natural play, real waves & kills, no cheats except infinite lives
await page.evaluate(()=>{
  const eng=window.__engine; clearInterval(window.__keep);
  eng.waveCardKillTargets={1:10,2:14,3:18,4:20,5:15};
  eng.activeTargets=eng.activeTargets.filter(t=>!String(t.id).startsWith('bench_'));
  eng.startWave ? 0 : 0;
  window.__setWeapon('gatling',2);
  window.__livesKeep=setInterval(()=>{ eng.lives=999; const w=eng.weaponSystem; w.ammo=Math.max(w.ammo,1); },200);
  const c=document.querySelector('canvas').parentElement;
  const send=(type)=>{ const ts=[...eng.activeTargets].sort((a,b)=>(a.radiusM??0)-(b.radiusM??0)); const t=ts[0]; const m=t&&window.__targetMeshMap.get(t.id); if(!m) return; const v=m.position.clone(); v.y+=0.3; v.project(window.__camera); const x=(v.x+1)/2*innerWidth,y=(1-v.y)/2*innerHeight; c.dispatchEvent(new MouseEvent(type,{button:0,bubbles:true,clientX:x,clientY:y})); };
  window.__natural=setInterval(()=>send('mousemove'),40);
  c.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true,clientX:innerWidth/2,clientY:innerHeight/2}));
});
const natural=await page.evaluate(async()=>{
  const P=window.__prof; const eng=window.__engine; const c0=P.compile,l0=P.link,t0=P.tex; const events=[];
  P.frames=[]; P.last=0; P.rec=true; P.jsMs=0; P.commits=0;
  const t0ms=performance.now(); let prevN=0; const count=[];
  const raf0=window.requestAnimationFrame;
  while(performance.now()-t0ms<30000){ await new Promise(r=>setTimeout(r,250)); count.push(eng.activeTargets.length); }
  P.rec=false;
  const f=P.frames; const s=[...f].sort((a,b)=>a-b);
  return { durSec:30, frames:f.length, fps:+(f.length/(f.reduce((a,b)=>a+b,0)/1000)).toFixed(1), p50:+s[Math.floor(s.length*.5)].toFixed(1), p95:+s[Math.floor(s.length*.95)].toFixed(1), p99:+s[Math.floor(s.length*.99)].toFixed(1), max:+s[s.length-1].toFixed(0), over50ms:f.filter(x=>x>50).length, over100ms:f.filter(x=>x>100).length, over250ms:f.filter(x=>x>250).length, over1000ms:f.filter(x=>x>1000).length, top5:[...s].slice(-5).map(x=>+x.toFixed(0)), link:P.link-l0, compile:P.compile-c0, texUploads:P.tex-t0, commitsPerSec:+(P.commits/30).toFixed(1), peakTargets:Math.max(...count), wave:eng.currentWave, phase:eng.gamePhase };
});
results.natural=natural; console.log('NATURAL',JSON.stringify(natural));
fs.writeFileSync(`${OUT}results2-${TAG}.json`,JSON.stringify(results,null,2));
console.log('\nAB SUMMARY'); for(const a of results.ab) console.log(a.name.padEnd(18),'base fps',String(a.base.fps).padEnd(6),'→',String(a.toggled.fps).padEnd(6),'| p95',a.base.p95,'→',a.toggled.p95,'| mainthread ms/s',a.base.task,'→',a.toggled.task,'| commits/s',a.commits,'| draws',a.draw);
await browser.close();
