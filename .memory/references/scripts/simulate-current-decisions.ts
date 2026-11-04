// Full simulation of decisions D07~D12 via runtime patches only (no source changes).
import { BeerCrusherEngine } from '/Users/bigtree/Git/ob-crash-game/src/pc/engine/BeerCrusherEngine';
import { FEVER_CONSTANTS, JUDGMENT_SPECS, WEAPON_ARCHETYPE_SPECS, STAGE_CONSTANTS } from '/Users/bigtree/Git/ob-crash-game/src/shared/constants';

process.env.WEAK_REPAIR??='1'; process.env.EASE_MID??='1'; process.env.HIT??='0.75'; process.env.GD??='2.0'; process.env.BOSS_HP??='40,35,45,110';
const CFG = {
  hitZone: +(process.env.HIT||0.6), shotgunZone: 0.806, aspect: 16/9, bossZone: +(process.env.BOSS_ZONE||0.6),
  gatlingDmg: +(process.env.GD||1.5), speedPerWave: 0.04,
  kill: 4, perfect: 2, cd: [35,31,27,23], goldFever: 30,
  bossRadiusStart: 16, summonEveryMs: +(process.env.SUMMON||8000), summonDropMult: 5,
  bossHp: (process.env.BOSS_HP||'25,25,30,60').split(',').map(Number),
  gate: {1:2,2:3,3:3,4:3,5:4,6:4,7:4} as Record<number,number>,
};
const ALL=['pilgood','caslight','obi','hanmac','bottle'];
const [H1,H2,H3,HK]=CFG.bossHp;
const WAVES:any[]=[
  {n:1,total:20,sim:5,int:700,kinds:['pilgood','caslight'],card:1e9},
  {n:2,total:26,sim:6,int:650,kinds:['obi','hanmac','pilgood'],card:1e9},
  {n:3,total:15,sim:6,int:700,kinds:['bottle','caslight','obi','hanmac'],card:1e9,boss:{coolers:[H1]}},
  {n:4,total:34,sim:7,int:550,kinds:ALL,card:22},
  {n:5,total:20,sim:7,int:600,kinds:ALL,card:1e9,boss:{coolers:[H2,H2]}},
  {n:6,total:40,sim:8,int:500,kinds:ALL,card:26},
  {n:7,total:25,sim:8,int:600,kinds:['hanmac','bottle','pilgood','caslight'],card:1e9,boss:{coolers:[H3,H3],king:HK}},
];
if(process.env.EASE_MID){ WAVES[3].sim=6; WAVES[3].int=600; WAVES[5].sim=7; WAVES[5].int=550; }
(STAGE_CONSTANTS as any).TOTAL_WAVES=8;
(FEVER_CONSTANTS as any).KILL_FEVER_DELTA=CFG.kill;
(JUDGMENT_SPECS as any).PERFECT.feverDelta=CFG.perfect;
const WEAPONS=['shotgun','revolver','gatling'] as const;
for(const k of WEAPONS) for(const l of [1,2,3,4]) (WEAPON_ARCHETYPE_SPECS as any)[k].levels[l].skillCooldownMs=CFG.cd[l-1]*1000;
for(const l of [1,2,3,4]) (WEAPON_ARCHETYPE_SPECS as any).gatling.levels[l].damagePerHit*=CFG.gatlingDmg;

const BOTS:any[]=[
  {name:'정확(탭)',mode:'chase',tap:150,k:6,w:0.02},
  {name:'보통(탭)',mode:'chase',tap:150,k:3,w:0.06},
  {name:'부정확(탭)',mode:'chase',tap:150,k:2,w:0.14},
  {name:'아주부정확(탭)',mode:'chase',tap:150,k:1.5,w:0.25},
  {name:'따라가며(누름)',mode:'chase',hold:true},
  {name:'몬스터쪽훑기(누름)',mode:'sweepMon',hold:true},
  {name:'화면전체훑기(누름)',mode:'sweep',hold:true},
];
const gauss=()=>Math.sqrt(-2*Math.log(1-Math.random()))*Math.cos(2*Math.PI*Math.random());

let RULE:any={};
function play(kind:string,bot:any){
  const e:any=new BeerCrusherEngine(); e.aspect=16/9; e.startGame();
  e.weaponSystem.selectWeapon(kind,1); e.isWeaponSelectPending=false;
  const defs:any={}; const cards:any={};
  for(const w of WAVES){ defs[w.n]={waveIndex:w.n,totalSpawns:w.total,maxSimultaneous:w.sim+(RULE.sim||0),spawnIntervalMs:Math.round(w.int*(RULE.int||1)),kinds:w.kinds,allowedItems:[],includesBoss:false}; cards[w.n]=w.card; }
  e.waveDefinitions=defs; e.waveCardKillTargets=cards;
  const ws=e.weaponSystem, sm=e.scoreManager;
  const st:any={vw:1,cards:0,fevers:0,skills:0,reload:0,dmg:0,cdn:0,fev:0,hit:0,maxWave:null,breach:0,bossPhase:'none',lastSummon:0,shield:false,kingHp:0,shieldKills:0,thr:[],king:null,bossDur:{},bossStart:0,bossBuffDmg:0,bossDmg:0,items:0,bossItems:0,grades:{PERFECT:0,GREAT:0,GOOD:0,MISS:0},gapSum:0,gapN:0,lastReady:null,prevReady:false,summons:0};

  const oAim=e.computeTargetAimCoords.bind(e);
  e.computeTargetAimCoords=(t:any,m:any)=>{ const r=oAim(t,m); let f=(RULE.zone??CFG.hitZone)*(1+0.05*st.hit); if(ws.getState().weaponKind==='shotgun') f*=(RULE.sgZone??CFG.shotgunZone); if(ws.getState().weaponKind==='revolver') f*=(RULE.rvZone??1); if(t.kind==='boss') f*=CFG.bossZone; return {...r,targetNormX:r.targetNormX*CFG.aspect,apparentHitRadius:r.apparentHitRadius*f}; };
  sm.chargeFeverToMax=function(){ this.addFeverGauge(CFG.goldFever); };
  ws.refillSkillInstant=function(){ if(ws.skillStock<ws.getMaxSkillStock()) ws.skillStock+=1; };
  const oBonus=ws.getDamageBonusMultiplier.bind(ws); ws.getDamageBonusMultiplier=()=>{ const k=ws.getState().weaponKind; const m=st.holdShot?(k==='gatling'?(RULE.gatHold??RULE.hold??1):(RULE.hold??1)):1; return oBonus()*m; };
  const oFi=ws.getFireIntervalMs.bind(ws); ws.getFireIntervalMs=()=>{ const k=ws.getState().weaponKind; return oFi()*(bot.hold?(k==='gatling'?(RULE.gatHoldFire??1):(RULE.holdFire??1)):1); };
  const oCd=ws.getSkillCooldownTotalMs.bind(ws); ws.getSkillCooldownTotalMs=()=>oCd()*Math.pow(0.9,st.cdn);
  const oLuck=e.getLuckyDropMultiplier.bind(e); e.getLuckyDropMultiplier=()=>oLuck()*(st.bossPhase==='on'?CFG.summonDropMult:1);

  const startBoss=(now:number)=>{
    const w=WAVES[st.vw-1]; st.bossPhase='on'; st.bossStart=now; st.lastSummon=now-CFG.summonEveryMs+2500;
    const mk=(hp:number,role:string,i:number)=>{ e.spawnBoss(now); e.bossSpawned=false; const t=e.activeTargets[e.activeTargets.length-1]; t.hp=t.maxHp=hp; t.role=role; t.idx=i; t.radiusM=CFG.bossRadiusStart; t.__s=1; return t; };
    w.boss.coolers.forEach((hp:number,i:number)=>mk(hp,'cooler',i));
    if(w.boss.king){ const k=mk(w.boss.king,'king',0); k.hitRadiusM*=1.5; st.king=k; st.kingHp=k.hp; k.hp=1e9; st.shield=true; st.shieldKills=0; st.thr=[w.boss.king*2/3,w.boss.king/3]; }
  };
  const oCards=e.spawnWaveRewardCards.bind(e);
  e.spawnWaveRewardCards=(now:number,clear=true)=>{ const w=WAVES[st.vw-1]; if(clear&&w.boss&&st.bossPhase==='none'){ startBoss(now); return; } return oCards(now,clear); };
  const dropShield=()=>{ if(st.shield&&st.king){ st.king.hp=st.kingHp; st.shield=false; } };
  const oKill=e.handleMonsterKilled.bind(e);
  e.handleMonsterKilled=(t:any,n:number)=>{
    if(t.kind==='boss'){
      if(t.role==='cooler') dropShield();
      const alive=e.activeTargets.filter((x:any)=>x.kind==='boss'&&x!==t);
      if(alive.length===0){ st.bossDur[st.vw]=(n-st.bossStart)/1000; st.bossPhase='done'; e.activeTargets=[]; if(st.vw>=WAVES.length) e.gamePhase='VICTORY'; }
      return;
    }
    if(st.bossPhase==='on'&&!t.isItem&&!t.isProjectile){ st.shieldKills++; if(st.shield&&st.shieldKills>=6) dropShield(); }
    return oKill(t,n);
  };
  const oShoot=e.shootAt.bind(e);
  e.shootAt=(x:number,y:number,n:number)=>{ const g=sm.feverGauge,rd=sm.isFeverReady; const r=oShoot(x,y,n); if(r.target?.kind==='boss'&&!sm.isFeverActive){ sm.feverGauge=g; sm.isFeverReady=rd; } if(r.activatedItem){ st.items++; if(st.bossPhase==='on') st.bossItems++; } return r; };

  const resolve=(now:number)=>{
    const fs=sm.getState(), lvl=ws.getState().weaponLevel; st.cards++;
    const pool:string[]=[];
    if(lvl<4&&lvl<CFG.gate[st.vw]) pool.push('weapon');
    if(e.luckyDropStacks<3) pool.push('lucky');
    if(st.reload<3) pool.push('reload');
    if(!fs.isFeverReady&&!fs.isFeverActive) pool.push('feverboost');
    if(!process.env.WEAK_REPAIR||e.lives<e.maxLives) pool.push('repair');
    if(st.dmg<3) pool.push('dmg'); if(st.cdn<3) pool.push('cdn'); if(st.fev<3) pool.push('fev'); if(st.hit<2) pool.push('hit');
    for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    const hand=pool.slice(0,3); const pick=hand.includes('weapon')?'weapon':hand[Math.floor(Math.random()*hand.length)];
    if(pick==='weapon'){ e.applyRewardCard('weapon_level_up',now); if(ws.getState().weaponLevel===4&&st.maxWave===null) st.maxWave=st.vw; }
    else if(pick==='lucky') e.applyRewardCard('lucky_drop',now);
    else if(pick==='reload'){ st.reload++; e.applyRewardCard('rapid_reload',now); }
    else if(pick==='feverboost') sm.addFeverGauge(50);
    else if(pick==='repair'){ if(process.env.WEAK_REPAIR) e.lives=Math.min(e.maxLives,e.lives+2); else e.applyRewardCard('bar_repair',now); }
    else if(pick==='dmg'){ st.dmg++; ws.damageBonusMultiplier=+(ws.damageBonusMultiplier+0.10).toFixed(2); }
    else if(pick==='cdn') st.cdn++; else if(pick==='fev') st.fev++; else if(pick==='hit') st.hit++;
    e.activeTargets=e.activeTargets.filter((t:any)=>!t.rewardCardKind); e.isRewardCardPending=false;
    if(e.pendingWaveAdvance){ st.vw++; st.bossPhase='none'; st.king=null; st.shield=false; e.startWave(st.vw); }
  };

  let now=1000; const dt=1000/60; let curId:any=null, ready=0, tS=Math.random()*6;
  const bossHpSum=()=>e.activeTargets.filter((t:any)=>t.kind==='boss').reduce((a:number,t:any)=>a+(t===st.king&&st.shield?st.kingHp:t.hp),0);
  while(e.gamePhase==='PLAYING'&&now<5*60*1000){
    const before=st.bossPhase==='on'?bossHpSum():0; const buff=sm.getState().isFeverActive||e.isBuffActive('power_shot',now);
    if(st.bossPhase==='on'){
      const ts=now/1000; const bs=e.activeTargets.filter((t:any)=>t.kind==='boss');
      const coolers=bs.filter((b:any)=>b.role==='cooler');
      bs.forEach((b:any)=>{ b.__minR=Math.min(b.__minR??b.radiusM,b.radiusM); b.radiusM=b.__minR; });
      coolers.forEach((b:any)=>{ const king=!!st.king; const dir=b.idx===0?1:-1; b.thetaRad = coolers.length===1&&!king&&WAVES[st.vw-1].boss.coolers.length===1 ? 0.32*Math.sin(ts*0.9) : king ? dir*(0.34+0.1*Math.sin(ts*0.8)) : dir*0.34*Math.sin(ts*0.8); });
      if(st.king) st.king.thetaRad=0.12*Math.sin(ts*0.5);
      if(st.king&&!st.shield&&st.thr.length&&st.king.hp<=st.thr[0]){ st.thr.shift(); st.kingHp=st.king.hp; st.king.hp=1e9; st.shield=true; st.shieldKills=0; }
      const minions=e.activeTargets.filter((t:any)=>t.kind!=='boss'&&!t.isItem&&!t.isProjectile&&!t.isGoldenCan).length;
      if(now-st.lastSummon>=CFG.summonEveryMs&&minions<7&&bs.some((b:any)=>b.radiusM<=12.5)){ e.spawnBossMinionWave(now,4); st.lastSummon=now; st.summons++; }
    }
    const u=e.update(now,dt/1000); st.breach+=u.breaches.length;
    if(e.gamePhase!=='PLAYING') break;
    const spM=1+CFG.speedPerWave*(st.vw-1);
    for(const t of e.activeTargets){ if(t.__s) continue; t.__s=1; if(t.isItem||t.isProjectile||t.isGoldenCan||t.rewardCardKind||t.kind==='boss') continue; t.speedMps*=spM; const hpM=1+(RULE.hp||0)*(st.vw-1); t.hp*=hpM; t.maxHp*=hpM; }
    if(e.isRewardCardPending){ resolve(now); continue; }
    const fs=sm.getState();
    if(fs.isFeverReady&&!fs.isFeverActive){
      if(!st.prevReady){ const t=now/1000; if(st.lastReady!==null){ st.gapSum+=t-st.lastReady; st.gapN++; } st.lastReady=t; st.prevReady=true; }
      if(e.activateFever(now)){ st.fevers++; if(st.fev) sm.feverEndTimeMs+=500*st.fev; st.prevReady=false; }
    }
    const mons=e.activeTargets.filter((t:any)=>!t.isItem&&!t.isProjectile&&!t.isGoldenCan);
    if(ws.getState().skillStock>0&&mons.length>=2){ const r=e.triggerWeaponSkill(now); if(r.activated) st.skills++; }
    tS+=dt/1000;
    const shoot=(ax:number,ay:number)=>{ if(now<(st.jam||0)||!ws.canFire(now,fs.isFeverActive)) return; if(bot.tap&&!fs.isFeverActive){ if(now-(st.lastTap||0)<bot.tap) return; st.lastTap=now; } st.holdShot=!!bot.hold&&!fs.isFeverActive; const r=e.shootAt(ax*CFG.aspect,ay,now); st.holdShot=false; if(!r.fired) return; st.grades[r.grade]=(st.grades[r.grade]||0)+1;
      if(!fs.isFeverActive){
        if(RULE.heat){ st.heat=Math.max(0,(st.heat||0)+(r.grade==='MISS'?1:-1)); if(st.heat>=RULE.heat){ st.jam=now+1500; st.heat=0; st.jams=(st.jams||0)+1; } }
        if(RULE.ammoBurn&&r.grade==='MISS'&&ws.ammo>0){ ws.ammo-=1; if(ws.ammo<=0){ ws.ammo=0; ws.isReloading=true; ws.reloadEndTimeMs=now+ws.getReloadDurationMs(); } }
      } };
    const cands=e.activeTargets.filter((t:any)=>!(t===st.king&&st.shield));
    if(bot.mode==='aim'){
      const score=(t:any)=>t.isGoldenCan?0:t.isProjectile?1:t.isItem?2:(t.kind!=='boss'&&t.radiusM<7)?3:t.kind==='boss'?4:5;
      const sorted=[...cands].sort((a:any,b:any)=>score(a)-score(b)||a.radiusM-b.radiusM);
      if(sorted.length){ const t=sorted[0]; if(t.id!==curId){ curId=t.id; ready=now+bot.react; } if(now>=ready){ const p=e.computeTargetAimCoords(t,1.0); shoot(p.targetNormX/CFG.aspect+gauss()*bot.sigma,p.targetNormY+gauss()*bot.sigma); } }
    } else {
      const vis=e.activeTargets.filter((t:any)=>!t.isItem);
      const ps=vis.map((t:any)=>{ const p=e.computeTargetAimCoords(t,1.0); return {x:p.targetNormX/CFG.aspect,y:p.targetNormY,r:t.radiusM}; });
      const my=ps.length?ps.reduce((a:number,p:any)=>a+p.y,0)/ps.length:0;
      if(bot.mode==='sweep') shoot(0.75*Math.sin(tS*1.6),my);
      else if(bot.mode==='fixed') shoot(0,my);
      else if(bot.mode==='sweepMon'){
        st.sx=st.sx??0; st.sd=st.sd??1;
        if(ps.length){ const lo=Math.min(...ps.map((p:any)=>p.x))-0.08, hi=Math.max(...ps.map((p:any)=>p.x))+0.08; st.sx+=st.sd*1.6*dt/1000; if(st.sx>hi){st.sx=hi;st.sd=-1;} if(st.sx<lo){st.sx=lo;st.sd=1;} }
        shoot(st.sx,my);
      } else {
        st.cx=st.cx??0; st.cy=st.cy??0;
        if(ps.length){ const n=[...ps].sort((a:any,b:any)=>a.r-b.r)[0]; const k=Math.min(1,dt/1000*(bot.k||3)); st.cx+=(n.x-st.cx)*k; st.cy+=(n.y-st.cy)*k; }
        if(bot.mode==='careful'){
          const ax=st.cx+0.05*Math.sin(tS*5), ay=st.cy+0.04*Math.sin(tS*7.3);
          const n=vis.length?[...vis].sort((a:any,b:any)=>a.radiusM-b.radiusM)[0]:null;
          if(n){ const q=e.computeTargetAimCoords(n,1.0); const d=Math.hypot(ax*CFG.aspect-q.targetNormX,ay-q.targetNormY); if(d<=q.apparentHitRadius*0.55) shoot(ax,ay); }
        } else shoot(st.cx+(bot.w??0.10)*Math.sin(tS*5),st.cy+(bot.w??0.10)*0.8*Math.sin(tS*7.3));
      }
    }
    if(st.bossPhase==='on'||before>0){ const after=bossHpSum(); const d=Math.max(0,before-after); st.bossDmg+=d; if(buff) st.bossBuffDmg+=d; }
    now+=dt;
  }
  return {...st,result:e.gamePhase,dur:now/1000,lives:e.lives,maxLives:e.maxLives,timedOut:now>=5*60*1000};
}
const avg=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const f=(x:number,d=0)=>Number.isNaN(x)?'-':x.toFixed(d);
const N=+(process.argv[2]||40);
const BASE:any={}; for(const k of WEAPONS){ BASE[k]={}; for(const l of [1,2,3,4]){ const L=(WEAPON_ARCHETYPE_SPECS as any)[k].levels[l]; BASE[k][l]={fi:L.fireIntervalMs,dm:L.damagePerHit,re:L.reloadDurationMs,am:L.maxAmmo}; } }
const applyWeapons=(R:any)=>{ for(const k of WEAPONS) for(const l of [1,2,3,4]){ const L=(WEAPON_ARCHETYPE_SPECS as any)[k].levels[l]; const fi=k==='gatling'?(R.gatFire||1):(R.fire||1); const dm=k==='gatling'?1:(R.dmg||1); L.fireIntervalMs=Math.round(BASE[k][l].fi*fi); L.damagePerHit=BASE[k][l].dm*dm; L.reloadDurationMs=Math.round(BASE[k][l].re*(R.reload||1)); if(k==='shotgun') L.damagePerHit=BASE[k][l].dm*(R.sgDmg||1); if(k==='revolver') L.damagePerHit=BASE[k][l].dm*(R.rvDmg||1); if(k==='gatling'){ L.maxAmmo=Math.max(4,Math.round(BASE[k][l].am*(R.mag||1))); L.damagePerHit=BASE[k][l].dm*(R.gdRel||1); } } };
const R1={fire:0.7,gatFire:0.7,reload:2,mag:0.7};
const FINAL_RULE:any={fire:0.7,gatFire:0.7,reload:2,mag:0.7,sgZone:0.9,sgDmg:1.2,hold:0.6,gatHold:0.85,holdFire:0.7,gatHoldFire:0.85};
RULE=FINAL_RULE; applyWeapons(FINAL_RULE);
const sp=(JUDGMENT_SPECS as any); sp.PERFECT.damageMultiplier=2.0; sp.GREAT.damageMultiplier=1.0; sp.GOOD.damageMultiplier=0.5;
for(const k of WEAPONS) for(const b of BOTS){
  const rs=Array.from({length:N},()=>play(k,b)); const w=rs.filter(r=>r.result==='VICTORY'); const to=rs.filter(r=>r.timedOut).length;
  const m=(fn:(r:any)=>number,d=0)=>f(avg(rs.map(fn)),d);
  console.log(`${k.padEnd(9)}${b.name.padEnd(16)} 클리어 ${f(100*w.length/N).padStart(3)}%${to?`(초과${f(100*to/N)})`:''} | 승리체력 ${w.length?f(avg(w.map(r=>r.lives)),1):'-'} | ${m(r=>r.dur)}s | 피버 ${f(avg(rs.filter(r=>r.gapN).map(r=>r.gapSum/r.gapN)))}s간격 | 스킬 ${m(r=>r.skills,1)} | 카드 ${m(r=>r.cards,1)} | MAX ${f(100*rs.filter(r=>r.maxWave!==null).length/N)}% | 보스 ${f(avg(rs.filter(r=>r.bossDur[3]).map(r=>r.bossDur[3])))}/${f(avg(rs.filter(r=>r.bossDur[5]).map(r=>r.bossDur[5])))}/${f(avg(rs.filter(r=>r.bossDur[7]).map(r=>r.bossDur[7])))}s`);
}
