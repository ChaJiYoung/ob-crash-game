// 폰 전투 사격 재현 실험 (A-2 단발/홀드/스킬/피버 + A-3-01 2P QR 확인). 값으로만 판정.
import { launch, newPage, sleep, log, snap, collected, saveJson, shot, fakePhone, roomIdOf } from './lib-a.mjs';

const browser = await launch();
const out = { qr2p: null, weapon: null, snaps: [], holds: [], skill: [], fever: [], serverMsgs: null, errors: null };
const { page } = await newPage(browser, { tag: 'phone-probe' });

// A-3-01: 2P 📱 버튼을 오른쪽 카드 좌표로 클릭
const btn2 = await page.evaluate(() => {
  const bs = Array.from(document.querySelectorAll('button, div, span')).filter((e) => (e.textContent || '').trim() === '📱 모바일');
  const right = bs.map((e) => e.getBoundingClientRect()).filter((r) => r.x > 720);
  return right.length ? { x: right[0].x + right[0].width / 2, y: right[0].y + right[0].height / 2, count: bs.length } : null;
});
log('2P mobile button', btn2);
if (btn2) await page.mouse.click(btn2.x, btn2.y);
await sleep(1200);
const html2 = await page.content();
out.qr2p = { slot2: /slot=2/.test(html2), slot1: /slot=1/.test(html2) };
await shot(page, 'A-3-01-probe-lobby-phone-2p-qr');
log('qr2p', out.qr2p);

const roomId = await roomIdOf(page);
const ph = fakePhone(roomId, 2, '폰프로브2P');
await ph.join(); await ph.zero(); await ph.aimHold(0, 0, 800);
await ph.aimHold(0, 0, 300); await ph.snap(0, 0);
let s = null;
for (let i = 0; i < 80; i++) { s = await snap(page); if (s && (s.phase === 'PLAYING' || s.selection.kind)) break; await ph.aimHold(0, 0, 100); }
// 무기 선택: 가운데 무기 카드 스냅
for (let i = 0; i < 20; i++) {
  s = await snap(page);
  if (s.selection.kind !== 'weapon') break;
  const w = s.targets.filter((t) => t.selectKind === 'weapon').sort((a, b) => Math.abs(a.aimX) - Math.abs(b.aimX))[0];
  await ph.aimHold(w.aimX, w.aimY, 300); await ph.snap(w.aimX, w.aimY); await sleep(800);
}
out.weapon = { phase: s.phase, sel: s.selection.kind, weapon: s.players[0].weaponKind };
log('combat?', JSON.stringify(out.weapon));

// 전투 중: 가장 가까운 표적에 조준 후 단발 스냅 5회 (스냅 간 800ms)
for (let k = 0; k < 5; k++) {
  s = await snap(page);
  const t = s.targets.filter((x) => x.landed && !x.isItem && !x.selectKind).sort((a, b) => a.radiusM - b.radiusM)[0] || { aimX: 0, aimY: 0 };
  await ph.aimHold(t.aimX, t.aimY, 300);
  const b = (await snap(page)).players[0];
  await ph.snap(t.aimX, t.aimY); await sleep(400);
  const a = (await snap(page)).players[0];
  out.snaps.push({ k, ammoBefore: b.ammo, ammoAfter: a.ammo, scoreBefore: b.score, scoreAfter: a.score, reloading: a.isReloading, phase: (await snap(page)).phase });
  await sleep(800);
}
log('snaps', JSON.stringify(out.snaps));

// 홀드 3회: 1초 holdFire, 100ms 샘플
for (let k = 0; k < 3; k++) {
  s = await snap(page);
  const t = s.targets.filter((x) => x.landed && !x.isItem && !x.selectKind).sort((a, b) => a.radiusM - b.radiusM)[0] || { aimX: 0, aimY: 0 };
  await ph.aimHold(t.aimX, t.aimY, 300);
  const before = (await snap(page)).players[0].ammo;
  const samples = []; const hp = ph.holdFire(t.aimX, t.aimY, 1000);
  for (let i = 0; i < 10; i++) { await sleep(100); samples.push((await snap(page)).players[0].ammo); }
  await hp; await sleep(500);
  out.holds.push({ k, before, samples, after: (await snap(page)).players[0].ammo });
  await sleep(1500);
}
log('holds', JSON.stringify(out.holds));

// 스킬 재고와 쿨다운 텍스트
s = await snap(page);
const cd = await page.evaluate(() => (document.body.innerText.match(/쿨다운[^\n]{0,12}|위로 휙[^\n]{0,6}/g) || []));
out.skill.push({ stock: s.players[0].skillStock, cooldownTexts: cd });
if (s.players[0].skillStock > 0) { await ph.aimHold(0, 0, 200); await ph.skill(0, 0); await sleep(500); out.skill.push({ after: (await snap(page)).players[0].skillStock }); }
await shot(page, 'A-2-probe-combat-phone');

out.serverMsgs = ph.received.slice(-40);
out.errors = { phone: ph.errors, pageErrors: collected.pageErrors, consoleErrors: collected.consoleErrors };
ph.close();
saveJson('qa-a-phone-probe-values.json', out);
await browser.close();
log('DONE probe');
