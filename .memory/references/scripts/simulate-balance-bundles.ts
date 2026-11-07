import { BeerCrusherEngine } from '/Users/bigtree/Git/ob-crash-game/src/pc/engine/BeerCrusherEngine';
import { FEVER_CONSTANTS, JUDGMENT_SPECS, WEAPON_ARCHETYPE_SPECS, TARGET_SPECS } from '/Users/bigtree/Git/ob-crash-game/src/shared/constants';

type Preset = { name:string; kill:number; perfect:number; cd:number[]; cards:Record<number,number>; pool:'old'|'nine' };
const MID={ kill:4, perfect:2, cd:[35,31,27,23], cards:{1:16,2:24,3:28,4:32,5:25}, pool:'nine', goldFever:30, goldSkill:'one' };
const BASE_SPEED:any={}; for(const k of Object.keys(TARGET_SPECS)) BASE_SPEED[k]=(TARGET_SPECS as any)[k].speedMps;
const G0={1:4,2:4,3:4,4:4,5:4}, GA={1:2,2:3,3:3,4:4,5:4}, GB={1:2,2:2,3:3,4:3,5:4};
const Z={k:16/9,rad:0.6,sg:0.806};
const RULES:any[]=[
  {...Z,gd:1.3,name:'A 5웨이브, 웨이브 강화 없음'},
  {...Z,gd:1.3,sp:0.05,name:'B 5웨이브, 속도+5%/웨이브'},
  {...Z,gd:1.3,waves:7,name:'C 7웨이브, 강화 없음'},
  {...Z,gd:1.3,waves:7,sp:0.04,name:'D 7웨이브, 속도+4%/웨이브'},
  {...Z,gd:1.5,waves:7,sp:0.04,name:'E 7웨이브, 속도+4%, 개틀링x1.5'},
  {...Z,gd:1.5,waves:7,sp:0.04,hp:0.08,name:'F 7웨이브, 속도+4%, 체력+8%, 개틀링x1.5'},
];
const PRESETS:any[]=[{...MID,name:'선택안',gate:GA,m:{sp:1,int:1,sim:0}}];
const BOTS:any[] = [
  { name:'조준잘함', mode:'aim', sigma:0.09, react:240 },
  { name:'조준보통', mode:'aim', sigma:0.16, react:380 },
  { name:'대충조준', mode:'aim', sigma:0.32, react:500 },
  { name:'좌우훑기', mode:'sweep' },
  { name:'제자리',   mode:'fixed' },
];
const WEAPONS = ['shotgun','revolver','gatling'] as const;
const gauss=()=>Math.sqrt(-2*Math.log(1-Math.random()))*Math.cos(2*Math.PI*Math.random());

function applyPreset(p:any){
  for(const k of Object.keys(BASE_SPEED)) (TARGET_SPECS as any)[k].speedMps=k==='boss'?BASE_SPEED[k]:BASE_SPEED[k]*p.m.sp;
  (FEVER_CONSTANTS as any).KILL_FEVER_DELTA=p.kill;
  (JUDGMENT_SPECS as any).PERFECT.feverDelta=p.perfect;
  for(const k of WEAPONS) for(const l of [1,2,3,4]) (WEAPON_ARCHETYPE_SPECS as any)[k].levels[l].skillCooldownMs=p.cd[l-1]*1000;
}
function resolveCards(e:any,p:any,st:any,now:number){
  const fs=e.getPlayer(0).scoreManager.getState(), ws=e.getPlayer(0).weaponSystem, lvl=ws.getState().weaponLevel;
  st.cards++;
  let hand:string[];
  if(p.pool==='old'){
    hand=e.activeTargets.filter((t:any)=>t.rewardCardKind).map((t:any)=>t.rewardCardKind);
  } else {
    const pool:string[]=[];
    if(lvl<4&&lvl<(st.rule.waves===7?{1:2,2:3,3:3,4:3,5:4,6:4,7:4}:p.gate)[st.vw]) pool.push('weapon_level_up');
    if(e.getPlayer(0).luckyDropStacks<3) pool.push('lucky_drop');
    if(st.reload<3) pool.push('rapid_reload');
    if(!fs.isFeverReady&&!fs.isFeverActive) pool.push('fever_boost');
    pool.push('bar_repair');
    if(st.dmg<3) pool.push('damage');
    if(st.cdn<3) pool.push('cooldown');
    if(st.fev<3) pool.push('fever_time');
    if(st.hit<2) pool.push('hit');
    for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    hand=pool.slice(0,3);
  }
  // Player preference: weapon first, otherwise random
  const pick=hand.includes('weapon_level_up')?'weapon_level_up':hand[Math.floor(Math.random()*hand.length)];
  if(pick==='weapon_level_up'){ e.applyRewardCard('weapon_level_up',now); if(ws.getState().weaponLevel===4&&st.maxAt===null){ st.maxAt=now/1000; st.maxWave=e.currentWave; } }
  else if(pick==='fever_boost'){ if(p.pool==='old') e.applyRewardCard('fever_boost',now); else e.getPlayer(0).scoreManager.addFeverGauge(50); }
  else if(pick==='rapid_reload'){ st.reload++; e.applyRewardCard(pick,now); }
  else if(pick==='lucky_drop'||pick==='bar_repair'){ e.applyRewardCard(pick,now); }
  else if(pick==='damage'){ st.dmg++; ws.damageBonusMultiplier=+(ws.damageBonusMultiplier+0.10).toFixed(2); }
  else if(pick==='cooldown'){ st.cdn++; }
  else if(pick==='fever_time'){ st.fev++; }
  else if(pick==='hit'){ st.hit++; }
  e.activeTargets=e.activeTargets.filter((t:any)=>!t.rewardCardKind);
  e.isRewardCardPending=false;
  const def=e.waveDefinitions[e.currentWave]||e.waveDefinitions[5];
  const mons=e.activeTargets.filter((t:any)=>!t.isItem&&!t.isProjectile&&!t.isGoldenCan);
  if(e.pendingWaveAdvance||(Math.max(0,def.totalSpawns-e.spawnedInWave)===0&&mons.length===0)){
    if(e.currentWave>=5) e.gamePhase='VICTORY';
    else {
      st.vw++;
      if(st.rule.waves===7){
        if(st.vw===5||st.vw===6){ const d=e.waveDefinitions[4]; e.waveDefinitions[4]={...d,totalSpawns:st.vw===5?52:56,maxSimultaneous:st.vw===5?7:8,spawnIntervalMs:st.vw===5?660:620}; e.waveCardKillTargets[4]=st.vw===5?34:36; e.startWave(4); }
        else if(st.vw===7) e.startWave(5);
        else e.startWave(st.vw);
      } else e.startWave(e.currentWave+1);
    }
  }
}
function play(p:any,kind:string,bot:any,rule:any={}){
  const e:any=new BeerCrusherEngine();
  const K=rule.k||1; { const o=e.computeTargetAimCoords.bind(e); e.computeTargetAimCoords=(t:any,m:any)=>{ const r=o(t,m); const ws0=e.getPlayer(0).weaponSystem.getState().weaponKind; const f=(rule.rad||1)*(ws0==='shotgun'&&rule.sg?rule.sg:1); return {...r,targetNormX:r.targetNormX*K,apparentHitRadius:r.apparentHitRadius*f}; }; }
  let missRun=0, jamUntil=0, tSweep=Math.random()*6;
  const GD=rule.gd||1;
  e.aspect=16/9;
  e.startGame();
  e.getPlayer(0).weaponSystem.selectWeapon(kind,1);
  e.isWeaponSelectPending=false;
  e.waveCardKillTargets={...p.cards};
  for(const w of [1,2,3,4,5]){ const d=e.waveDefinitions[w]; d.spawnIntervalMs=Math.round(d.spawnIntervalMs*p.m.int); d.maxSimultaneous+=p.m.sim; }
  const st:any={rule,vw:1,cards:0,maxAt:null,maxWave:null,reload:0,dmg:0,cdn:0,fev:0,hit:0,firstFever:null,fevers:0,skills:0,grades:{PERFECT:0,GREAT:0,GOOD:0,MISS:0},waveFever:{},lastReadyT:null,gapSum:0,gapN:0,skillReadyWait:[],prevReady:false,wave1End:null,wave1Fevers:0,wave1Skills:0,wave1Cards:0};
  const ws=e.getPlayer(0).weaponSystem; const baseCd=ws.getSkillCooldownTotalMs.bind(ws);
  ws.getSkillCooldownTotalMs=()=>baseCd()*Math.pow(0.9,st.cdn);
  e.getPlayer(0).scoreManager.chargeFeverToMax=function(){ this.addFeverGauge(p.goldFever); };
  const baseRefill=ws.refillSkillInstant.bind(ws);
  ws.refillSkillInstant=function(){ if(p.goldSkill==='full') return baseRefill(); if(p.goldSkill==='one'){ if(ws.skillStock<ws.getMaxSkillStock()) ws.skillStock+=1; } };
  st.breach=0; st.radSum=0; st.radN=0;
  let now=1000; const dt=1000/60; let curId:string|null=null; let aimReadyAt=0; let prevWave=1;
  while((e.gamePhase==='PLAYING')&&now<20*60*1000){
    const u=e.update(now,dt/1000); st.breach+=u.breaches.length;
    if(e.gamePhase!=='PLAYING') break;
    if(e.currentWave===5&&st.lvlAt5===undefined) st.lvlAt5=ws.getState().weaponLevel;
    if(e.currentWave!==prevWave){ if(prevWave===1&&st.wave1End===null) st.wave1End=now/1000; prevWave=e.currentWave; }
    { const spM=1+(rule.sp||0)*(st.vw-1), hpM=1+(rule.hp||0)*(st.vw-1);
      for(const t of e.activeTargets){ if(t.__s) continue; t.__s=1; if(t.isItem||t.isProjectile||t.isGoldenCan||t.rewardCardKind||t.kind==='boss') continue; t.hp*=hpM; t.maxHp*=hpM; t.speedMps*=spM; } }
    if(e.isRewardCardPending){ resolveCards(e,p,st,now); if(e.currentWave===1) st.wave1Cards++; continue; }
    const fs=e.getPlayer(0).scoreManager.getState();
    if(fs.isFeverReady&&!fs.isFeverActive){
      if(!st.prevReady){ const t=now/1000; if(st.firstFever===null) st.firstFever=t; if(st.lastReadyT!==null){ st.gapSum+=t-st.lastReadyT; st.gapN++; } st.lastReadyT=t; st.prevReady=true; }
      if(e.activateFever(now)){ st.fevers++; if(e.currentWave===1) st.wave1Fevers++; if(st.fev) e.getPlayer(0).scoreManager.feverEndTimeMs+=500*st.fev; st.prevReady=false; }
    }
    const mons=e.activeTargets.filter((t:any)=>!t.isItem&&!t.isProjectile&&!t.isGoldenCan);
    if(ws.getState().skillStock>0&&mons.length>=2){ const r=e.triggerWeaponSkill(now); if(r.activated){ st.skills++; if(e.currentWave===1) st.wave1Skills++; } }
    // target selection / aim policy
    tSweep+=dt/1000;
    const shoot=(ax:number,ay:number)=>{
      if(now<jamUntil||!ws.canFire(now,fs.isFeverActive)) return;
      const r=e.shootAt(ax*K,ay,now);
      if(!r.fired) return;
      st.grades[r.grade]=(st.grades[r.grade]||0)+1;
      if(r.grade==='MISS'){
        missRun++;
        if(rule.missFever&&!fs.isFeverActive) e.getPlayer(0).scoreManager.addFeverGauge(-rule.missFever);
        if(rule.jam&&missRun>=rule.jam.n&&!fs.isFeverActive){ jamUntil=now+rule.jam.ms; missRun=0; st.jams=(st.jams||0)+1; }
      } else missRun=0;
    };
    const cands=[...e.activeTargets].filter((t:any)=>!t.isItem);
    if(bot.mode==='aim'){
      if(cands.length){
        cands.sort((a:any,b:any)=>{ if(a.isGoldenCan!==b.isGoldenCan) return a.isGoldenCan?-1:1; if(a.isProjectile!==b.isProjectile) return a.isProjectile?-1:1; return a.radiusM-b.radiusM; });
        const t=cands[0];
        if(t.id!==curId){ curId=t.id; aimReadyAt=now+bot.react; }
        if(now>=aimReadyAt){ const proj=e.computeTargetAimCoords(t,1.0); st.radSum+=proj.apparentHitRadius; st.radN++; shoot(proj.targetNormX/K+gauss()*bot.sigma,proj.targetNormY+gauss()*bot.sigma); }
      }
    } else {
      // No target tracking at all: y follows the rough monster line, x sweeps or stays centered
      let my=0.0; if(cands.length){ my=cands.reduce((a:number,t:any)=>a+e.computeTargetAimCoords(t,1.0).targetNormY,0)/cands.length; }
      const ax=bot.mode==='sweep'?0.75*Math.sin(tSweep*1.6):0;
      shoot(ax,my);
    }
    now+=dt;
  }
  return { ...st, result:e.gamePhase, dur:now/1000, lives:e.lives, maxLives:e.maxLives, wave:e.currentWave };
}
const avg=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const N=+(process.argv[2]||30);
const p=PRESETS[0]; applyPreset(p);
console.log('안 | 무기 | '+BOTS.map((b:any)=>b.name).join(' | ')+' | 보통봇: 시간s, 카드, 피버, 스킬, MAX도달%');
const BASE_DMG:any={}; for(const l of [1,2,3,4]) BASE_DMG[l]=(WEAPON_ARCHETYPE_SPECS as any).gatling.levels[l].damagePerHit;
for(const rule of RULES){ for(const l of [1,2,3,4]) (WEAPON_ARCHETYPE_SPECS as any).gatling.levels[l].damagePerHit=BASE_DMG[l]*(rule.gd||1);
  for(const k of WEAPONS){ let d='';
    const cells=BOTS.map((b:any)=>{ const rs=Array.from({length:N},()=>play(p,k,b,rule)); if(b.name==='조준보통'){ const cl=rs.filter(r=>r.result==='VICTORY'); d=`${avg(rs.map(r=>r.dur)).toFixed(0)}s, ${avg(rs.map(r=>r.cards)).toFixed(1)}, ${avg(rs.map(r=>r.fevers)).toFixed(1)}, ${avg(rs.map(r=>r.skills)).toFixed(1)}, ${(100*rs.filter(r=>r.maxWave!==null).length/N).toFixed(0)}%`; } return (100*rs.filter(r=>r.result==='VICTORY').length/N).toFixed(0); });
    console.log([rule.name,k,...cells,d].join(' | '));
}}
