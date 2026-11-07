// QA-A(R2) 폰 1인(1P 슬롯, A-2)과 폰 1인(2P 슬롯만, A-3). 가짜 폰은 WebSocket으로 조준·사격.
import { launch, newPage, sleep, log, snap, check, collected, saveJson, normToScreen, shot, fakePhone, roomIdOf } from './lib-a.mjs';

const browser = await launch();
const R = {};

// ====================== A-2: 1P 슬롯 폰 ======================
{
  const { page } = await newPage(browser, { tag: 'phone1p' });
  await page.locator('text=📱 모바일').first().click({ force: true }); await sleep(1000);
  const roomId = await roomIdOf(page);
  const html = await page.content();
  const qr = { roomId, hasSlot1: /slot=1/.test(html), hasSlot2: /slot=2/.test(html), roomInUrl: roomId ? html.includes(roomId) : false };
  await shot(page, 'A-2-01-lobby-phone-1p-qr');
  check('A-2-01', qr.hasSlot1 && !qr.hasSlot2 && qr.roomInUrl ? 'PASS' : 'BUG', 'QR/URL에 slot=1, 방 코드 포함', qr);

  const phone = fakePhone(roomId, 1, '폰테스터1P');
  await phone.join(); await sleep(800);
  const j = await page.evaluate(() => { const t = document.body.innerText; return { connected: t.includes('폰테스터1P'), needZero: t.includes('영점을 맞춰') }; });
  await shot(page, 'A-2-02-phone-joined-need-zero');
  check('A-2-02', j.connected && j.needZero ? 'PASS' : 'BUG', '가짜 폰 연결 → 닉네임 표시, 영점 안내', j);

  await phone.zero(); await phone.aimHold(0, 0, 900);
  const z = await page.evaluate(() => ({ ready: document.body.innerText.includes('준비 완료'), needZero: document.body.innerText.includes('영점을 맞춰') }));
  await shot(page, 'A-2-03-phone-ready');
  check('A-2-03', z.ready && !z.needZero ? 'PASS' : 'BUG', '영점 후 "준비 완료", 영점 안내 사라짐', z);

  // 가운데 사격 → 3초 카운트다운 → 시작 (D33)
  const tStart = Date.now();
  await phone.aimHold(0, 0, 300); await phone.snap(0, 0);
  await sleep(700);
  const cd = await page.evaluate(() => document.body.innerText);
  await shot(page, 'A-2-04-phone-start-countdown');
  const cdHas = /3|2|1/.test(cd) && /시작|카운트|곧/.test(cd);
  let sel = null, phase = null;
  for (let i = 0; i < 80; i++) { const s = await snap(page); if (s && (s.phase === 'PLAYING' || s.selection.kind)) { phase = s.phase; sel = s.selection.kind; break; } await phone.aimHold(0, 0, 100); }
  const tPlaying = Date.now() - tStart;
  check('A-2-04', phase === 'PLAYING' && cdHas ? 'PASS' : 'BUG', `폰 가운데 사격으로 카운트다운 후 시작(전환 ${tPlaying}ms, 카운트다운 문구 ${cdHas})`, { phase, sel, tPlaying });

  // 무기 선택: 폰 사격으로 가장 가까운 무기 카드 선택
  await phone.aimHold(0, 0, 200);
  let s = await snap(page);
  R.weaponCards = s.targets.filter((t) => t.selectKind === 'weapon').map((t) => ({ k: t.selectValue, x: +t.aimX.toFixed(2), y: +t.aimY.toFixed(2) }));
  await shot(page, 'A-2-05-phone-weapon-select');
  const pick = s.targets.filter((t) => t.selectKind === 'weapon').sort((a, b) => Math.abs(a.aimX) - Math.abs(b.aimX))[0];
  if (pick) { await phone.aimHold(pick.aimX, pick.aimY, 400); await phone.snap(pick.aimX, pick.aimY); }
  await sleep(1200);
  s = await snap(page);
  log('after phone weapon pick', s.phase, s.selection, s.players[0].weaponKind);

  // HUD
  const hud = await page.evaluate(() => { const t = document.body.innerText; return { upFlick: (t.match(/위로 휙/g) || []).length, rightClick: (t.match(/우클릭/g) || []).length, oneP: (t.match(/1P/g) || []).length, bar: t.includes('BAR DEFENSE') }; });
  await shot(page, 'A-2-06-phone-combat-hud');
  check('A-2-06', s.phase === 'PLAYING' && hud.upFlick === 1 && hud.rightClick === 0 && hud.oneP === 0 ? 'PASS' : 'BUG', '전투 HUD: 스킬 안내 "[위로 휙!]" 1개, 우클릭 안내 없음, 배지 없음', { hud, phase: s.phase, weapon: s.players[0].weaponKind });

  // 조작: 단발
  await phone.aimHold(0.1, 0.1, 500);
  const b1 = (await snap(page)).players[0].ammo;
  await phone.snap(0.1, 0.1); await sleep(300);
  const a1 = (await snap(page)).players[0].ammo;
  check('A-2-07a-snap', a1 === b1 - 1 ? 'PASS' : 'BUG', `폰 단발 탄약 ${b1}→${a1}`, { b1, a1 });

  // 5-1 홀드 연사: rapidFireHold 1초, 100ms 샘플
  await phone.aimHold(0.1, 0.1, 200);
  const hb = (await snap(page)).players[0].ammo;
  const samples = []; const hp = phone.holdFire(0.1, 0.1, 1000);
  for (let i = 0; i < 10; i++) { await sleep(100); samples.push((await snap(page)).players[0].ammo); }
  await hp; await sleep(300);
  const ha = (await snap(page)).players[0].ammo;
  check('5-1-phone-hold', hb - ha >= 2 ? 'PASS' : 'BUG', `폰 rapidFireHold 1초 탄약 감소 ${hb - ha}발(샘플 ${samples.join(',')})`, { hb, samples, ha, drop: hb - ha, consoleErrors: collected.consoleErrors.length });
  await shot(page, 'A-2-07-phone-combat-actions');

  // 피버/스킬은 게이지 조건이 찼을 때 판정 (아래 봇 루프)
  let feverDone = false, skillDone = false;

  // 끊김 (전투 중, 1인은 무기한 일시정지)
  phone.close(); await sleep(2000);
  const dc1 = await page.evaluate(() => ({ text: document.body.innerText.includes('폰 재연결 중'), paused: null }));
  dc1.paused = (await snap(page)).isPaused;
  await shot(page, 'A-2-08-phone-disconnected-pause');
  await sleep(35000);
  const dc2 = await page.evaluate(() => ({ text: document.body.innerText.includes('폰 재연결 중') }));
  dc2.paused = (await snap(page)).isPaused;
  await shot(page, 'A-2-09-phone-disconnect-indefinite');
  check('A-2-08', dc1.paused && dc2.paused && dc2.text ? 'PASS' : 'BUG', '폰 끊김 → 일시정지 + "폰 재연결 중", 35초 뒤에도 유지(1인 무기한)', { dc1, dc2 });

  // 재접속
  await phone.reconnect();
  let reconnectMsg = false, resumedAt = null;
  const tRe = Date.now();
  for (let i = 0; i < 30; i++) {
    await phone.aimHold(0, 0, 150);
    const t = await page.evaluate(() => document.body.innerText);
    if (/다시 연결/.test(t)) reconnectMsg = true;
    const sp = await snap(page);
    if (sp.isPaused && reconnectMsg && i >= 3) {
      await page.getByRole('button', { name: /이어하기/ }).first().click({ force: true, timeout: 15000 }).catch(() => {});
    }
    if (!sp.isPaused) { resumedAt = Date.now() - tRe; break; }
  }
  await shot(page, 'A-2-10-phone-reconnected-resume');
  check('A-2-10', reconnectMsg && resumedAt !== null ? 'PASS' : 'BUG', `재접속 → "다시 연결됨" ${reconnectMsg}, 재개 ${resumedAt}ms`, { reconnectMsg, resumedAt });

  // 봇 플레이 (폰 조준): 가까운 표적 조준 후 snap, 피버·스킬 조건 시 발동
  const tPlay = Date.now(); let result = null; let last = '';
  const feverV = [], skillV = [];
  let rewardDone = false;
  while (Date.now() - tPlay < 18 * 60 * 1000) {
    const s2 = await snap(page);
    if (!s2) { await sleep(300); continue; }
    if (s2.phase !== last) { log('phase ->', s2.phase, 'wave', s2.wave, 'lives', s2.lives); last = s2.phase; }
    if (s2.phase === 'GAMEOVER' || s2.phase === 'VICTORY') { result = s2.phase; break; }
    if (s2.selection.kind === 'card') {
      if (!rewardDone) { await sleep(300); await shot(page, 'A-2-rew-phone-card-select'); rewardDone = true; }
      const c = s2.targets.filter((t) => t.selectKind === 'card').sort((a, b) => Math.abs(a.aimX) - Math.abs(b.aimX))[0];
      await phone.aimHold(c.aimX, c.aimY, 300); await phone.snap(c.aimX, c.aimY); await sleep(900); continue;
    }
    if (s2.selection.kind === 'weapon' || s2.isPaused) { await sleep(300); continue; }
    if (!feverDone && s2.players[0].isFeverReady && !s2.players[0].isFeverActive) {
      const sc0 = s2.players[0].score;
      const t = s2.targets.find((x) => x.landed && !x.isItem && !x.selectKind) || { aimX: 0, aimY: 0.2 };
      await phone.aimHold(t.aimX, t.aimY, 150); await phone.fever(t.aimX, t.aimY); await sleep(200);
      const f1 = (await snap(page)).players[0].isFeverActive;
      await phone.aimHold(t.aimX, t.aimY, 2000);
      const f2 = await snap(page);
      feverDone = true;
      feverV.push({ activeAfterGesture: f1, scoreStart: sc0, scoreAfter2s: f2.players[0].score });
      check('A-2-07d-fever', f1 && f2.players[0].score > sc0 ? 'PASS' : 'BUG', '폰 피버 제스처 → 피버 발동, 2초 동안 점수 증가', feverV[0]);
    }
    if (!skillDone && s2.players[0].skillStock > 0) {
      const st0 = s2.players[0].skillStock;
      await phone.skill(0.1, 0.1); await sleep(500);
      const st1 = (await snap(page)).players[0].skillStock;
      skillDone = true; skillV.push({ st0, st1 });
      check('A-2-07c-skill', st1 < st0 ? 'PASS' : 'BUG', `폰 스킬(위로 휙) 재고 ${st0}→${st1}`, skillV[0]);
    }
    const tg = s2.targets.filter((t) => t.landed && !t.isItem && !t.selectKind).sort((a, b) => a.radiusM - b.radiusM)[0];
    if (tg) { await phone.aimHold(tg.aimX, tg.aimY, 120); await phone.snap(tg.aimX, tg.aimY); } else { await phone.aimHold(0, 0, 200); }
    await sleep(60);
  }
  log('phone play loop ended', result);

  // 결과 화면 & 폰 사격으로 다시 시작 (A-2-11~13)
  if (result) {
    let restartOk = false, outsideStill = false;
    for (let i = 0; i < 40; i++) { if (await page.locator('[data-shootable="restart"]').count()) break; await phone.aimHold(0, 0, 500); }
    await sleep(1500);
    await shot(page, 'A-2-11-phone-result-screen');
    const rb = await page.locator('[data-shootable="restart"]').first().boundingBox();
    const cx = rb.x + rb.width / 2, cy = rb.y + rb.height / 2;
    const bn = { x: (cx - 720) / 720, y: (450 - cy) / 450 };
    await phone.aimHold(0.8, -0.8, 500); await phone.snap(0.8, -0.8); await sleep(900);
    outsideStill = (await page.locator('[data-shootable="restart"]').count()) > 0;
    await shot(page, 'A-2-12-phone-aiming-restart-button');
    await phone.aimHold(bn.x, bn.y, 600); await phone.snap(bn.x, bn.y); await sleep(2500);
    restartOk = (await page.locator('[data-shootable="restart"]').count()) === 0;
    await shot(page, 'A-2-13-phone-restart-action');
    check('A-2-11', result && rb ? 'PASS' : 'BUG', `결과 화면 도달(${result})`, { result });
    check('A-2-12', outsideStill ? 'PASS' : 'BUG', '버튼 밖 사격 → 결과 화면 유지', { outsideStill, aimedAt: bn });
    check('A-2-13', restartOk ? 'PASS' : 'BUG', '폰 조준으로 "다시 시작" 버튼 실행', { restartOk, aimedAt: bn, restartRect: [rb.x, rb.y, rb.width, rb.height].map(Math.round) });
  } else check('A-2-11', 'BUG', '18분 안에 결과 화면 미도달', { last });
  R.phone1p = { weaponCards: R.weaponCards, feverV, skillV, phone1Errors: phone.errors };
  phone.close();
  await page.context().close();
}

// ====================== A-3: 2P 슬롯에만 폰 ======================
{
  const { page } = await newPage(browser, { tag: 'phone2only' });
  await page.locator('text=📱 모바일').nth(1).click({ force: true }); await sleep(1000);
  const roomId = await roomIdOf(page);
  const html = await page.content();
  const q2 = { hasSlot2: /slot=2/.test(html), hasSlot1: /slot=1/.test(html) };
  await shot(page, 'A-3-01-lobby-phone-2p-qr');
  const ph = fakePhone(roomId, 2, '폰테스터2P');
  await ph.join(); await ph.zero(); await ph.aimHold(0, 0, 800);
  const lobby = await page.evaluate(() => ({ ready: document.body.innerText.includes('준비 완료') }));
  await ph.aimHold(0, 0, 300); await ph.snap(0, 0);
  let phase = null, sel = null;
  for (let i = 0; i < 80; i++) { const s = await snap(page); if (s && (s.phase === 'PLAYING' || s.selection.kind)) { phase = s.phase; sel = s.selection.kind; break; } await ph.aimHold(0, 0, 100); }
  await sleep(300);
  const s = await snap(page);
  const hud = await page.evaluate(() => { const t = document.body.innerText; return { oneP: (t.match(/1P/g) || []).length, twoP: (t.match(/2P/g) || []).length, bar: t.includes('BAR DEFENSE'), team: t.includes('TEAM') }; });
  const weaponPick = s.targets.filter((t) => t.selectKind === 'weapon').sort((a, b) => Math.abs(a.aimX) - Math.abs(b.aimX))[0];
  if (weaponPick) { await ph.aimHold(weaponPick.aimX, weaponPick.aimY, 400); await ph.snap(weaponPick.aimX, weaponPick.aimY); }
  await sleep(1200);
  const s2 = await snap(page);
  await shot(page, 'A-3-02-phone-2p-only-combat');
  // 2P 슬롯 폰의 사격이 어느 플레이어 탄약을 줄이는지 확인
  await ph.aimHold(0.1, 0.1, 300);
  const before = s2.players.map((p) => p.ammo);
  await ph.snap(0.1, 0.1); await sleep(300);
  const after = (await snap(page)).players.map((p) => p.ammo);
  const playersLen = s2.players.length;
  const who = before.map((b, i) => b - after[i]);
  check('A-3-02', lobby.ready && phase === 'PLAYING' && hud.oneP === 0 && hud.twoP === 0 && playersLen === 1 ? 'PASS' : 'BUG',
    '2P 슬롯 폰만 연결 → 1인 판 시작, 배지(1P/2P) 없음, 플레이어 1명', { lobbyReady: lobby.ready, phase, sel, hud, playersLen, ammoDropPerPlayer: who, q2 });
  R.phone2only = { hud, playersLen, who };
  ph.close();
  await page.context().close();
}

await browser.close();
saveJson('qa-a-phone-values.json', { checks: collected.checks, ...R, errors: { pageErrors: collected.pageErrors, consoleErrors: collected.consoleErrors } });
log('DONE phone');
