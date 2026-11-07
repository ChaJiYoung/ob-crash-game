// QA-A(R2) 마우스 1인: A-1 전 항목, 5-1(연사·피버 값), 5-2(총구 1인 5점) 캡처, 결과·로비 복귀.
import { launch, newPage, sleep, log, snap, check, collected, saveJson, normToScreen, shot } from './lib-a.mjs';

const browser = await launch();
const V = { w: 1440, h: 900 };
const { page, ctx } = await newPage(browser, { tag: 'mouse' });
const R = {};

// ---------- A-1-01 로비 초기 ----------
const lobby0 = await page.evaluate(() => {
  const t = document.body.innerText;
  return { slotCount: (t.match(/1P 슬롯|2P 슬롯/g) || []).length, emptyCount: (t.match(/비어 있음/g) || []).length };
});
await shot(page, 'A-1-01-lobby-empty');
check('A-1-01', lobby0.slotCount === 2 && lobby0.emptyCount === 2 ? 'PASS' : 'BUG', '로비 슬롯 2개 모두 "비어 있음"', lobby0);

// ---------- A-1-02 1P 마우스 선택 → 준비 완료, 2P 마우스 칸 비활성 ----------
await page.getByText('🖱 마우스').first().click({ timeout: 60000 }); await sleep(500);
await page.getByPlaceholder('닉네임 입력').fill('테스터A'); await sleep(200);
await page.getByText('확인', { exact: true }).click(); await sleep(800);
const ready = await page.locator('text=테스터A · 마우스로 플레이').first().isVisible().catch(() => false);
const p2 = await page.getByText('🖱 마우스').nth(1).evaluate((el) => ({ disabled: el.disabled, opacity: getComputedStyle(el).opacity, cursor: getComputedStyle(el).cursor }));
await shot(page, 'A-1-02-lobby-mouse-1p-ready');
check('A-1-02', ready && p2.disabled ? 'PASS' : 'BUG', '1P 마우스 준비 문구 표시, 2P 마우스 버튼 disabled', { ready, p2 });

// ---------- A-1-03 새로고침 후 닉네임 자동 채움 (D15) ----------
await page.reload({ waitUntil: 'networkidle' }); await sleep(1500);
await page.getByText('🖱 마우스').first().click({ timeout: 60000 }); await sleep(500);
const autofill = await page.getByPlaceholder('닉네임 입력').inputValue();
await shot(page, 'A-1-03-nickname-autofill');
check('A-1-03', autofill === '테스터A' ? 'PASS' : 'BUG', '새로고침 후 닉네임 자동 채움', { autofill });
await page.getByText('확인', { exact: true }).click(); await sleep(800);

// ---------- A-1-04 게임 시작: 카운트다운 없이 무기 카드 3장 ----------
const tStart = Date.now();
await page.locator('[data-shootable="start"]').click(); await sleep(700);
const s04 = await snap(page);
const bodyAt04 = await page.evaluate(() => document.body.innerText);
await shot(page, 'A-1-04-weapon-select-solo');
const weaponCards = (s04?.targets || []).filter((t) => t.selectKind === 'weapon').map((t) => ({ kind: t.selectValue, aimX: +t.aimX.toFixed(2), aimY: +t.aimY.toFixed(2) }));
check('A-1-04', s04?.selection?.kind === 'weapon' && weaponCards.length === 3 && !/카운트다운|3\s*2\s*1/.test(bodyAt04) ? 'PASS' : 'BUG',
  '카운트다운 없이 무기 선택 진입, 카드 3장 가운데 배치', { phase: s04?.phase, selection: s04?.selection, weaponCards, elapsedMs: Date.now() - tStart });

// 무기 선택 중 우클릭 (D25: 막혀야 함) — 재고 0이라 스킬 실발동 여부는 아래 캡처로 판단
await page.mouse.click(720, 450, { button: 'right' }); await sleep(300);
const s04b = await snap(page);
R.rightClickDuringSelect = { selection: s04b?.selection?.kind, skillStock: s04b?.players[0].skillStock };

// 가운데 카드(리볼버, aimX 0) 선택 — 가장 가까운 무기 카드 클릭
const pickClosestToZero = (s, kind) => (s.targets.filter((t) => t.selectKind === kind).sort((a, b) => Math.abs(a.aimX) - Math.abs(b.aimX))[0]);
let pick = pickClosestToZero(s04b, 'weapon');
let p = normToScreen(pick.aimX, pick.aimY);
await page.mouse.move(p.x, p.y, { steps: 4 }); await sleep(100); await page.mouse.down(); await sleep(60); await page.mouse.up();
const tPicked = Date.now();
await sleep(400);
const s05a = await snap(page);
log('after weapon pick: phase', s05a?.phase, 'sel', JSON.stringify(s05a?.selection), 'weapon', s05a?.players[0].weaponKind);

// 시작 직후 1.5초 안 우클릭 (D25)
await page.mouse.click(720, 450, { button: 'right' }); await sleep(200);
const earlyStock = (await snap(page)).players[0].skillStock;
await sleep(Math.max(0, 1800 - (Date.now() - tPicked)));

// ---------- A-1-05 전투 HUD ----------
const hud = await page.evaluate(() => {
  const t = document.body.innerText;
  const count = (re) => (t.match(re) || []).length;
  return {
    barDefense: t.includes('BAR DEFENSE'), teamDefense: t.includes('TEAM · BAR DEFENSE'),
    rightClickHints: count(/우클릭/g), upFlickHints: count(/위로 휙/g), oneP: count(/1P/g), twoP: count(/2P/g),
    feverPanelText: count(/피버/g),
    crosshairLabels: (t.match(/(SHOTGUN|REVOLVER|GATLING)[^\n]{0,12}/g) || []).slice(0, 5),
  };
});
const s05 = await snap(page);
await shot(page, 'A-1-05-combat-solo-hud');
R.hud = { hud, phase: s05.phase, weapon: s05.players[0].weaponKind, skillStock: s05.players[0].skillStock };
check('A-1-05', hud.barDefense && !hud.teamDefense && hud.rightClickHints === 1 && hud.upFlickHints === 0 && hud.oneP === 0 ? 'PASS' : 'BUG',
  'HUD: BAR DEFENSE 1인 표기, 우클릭 안내 1개, 위로 휙 없음, 1P 배지 없음 (값으로 판정, 피버 패널은 캡처로 추가 확인)', hud);

// ---------- A-1 조작: 5-1 연사 1초 누르기 (10샘플) ----------
await page.mouse.move(720, 300, { steps: 3 });
let before = (await snap(page)).players[0].ammo;
const holdSamples = [];
await page.mouse.down();
for (let i = 0; i < 10; i++) { await sleep(100); holdSamples.push((await snap(page)).players[0].ammo); }
await page.mouse.up(); await sleep(300);
const holdAfter = (await snap(page)).players[0].ammo;
const holdDrop = before - holdAfter;
check('5-1-mouse-hold', holdDrop >= 2 ? 'PASS' : 'BUG', `마우스 1초 누르기 탄약 감소 ${holdDrop}발(샘플 ${holdSamples.join(',')})`, { before, holdSamples, holdAfter, holdDrop, weapon: (await snap(page)).players[0].weaponKind, consoleErrorsSoFar: collected.consoleErrors.length });

// 단발: 연사 뒤 재장전이 끝날 때까지 대기 (재장전 중 단발은 측정 오류)
for (let i = 0; i < 40; i++) { const q = await snap(page); if (!q.players[0].isReloading && q.players[0].ammo > 0) break; await sleep(150); }
const b1 = (await snap(page)).players[0].ammo;
await page.mouse.click(720, 300); await sleep(300);
const a1 = (await snap(page)).players[0].ammo;
check('A-1-06a-single', a1 === b1 - 1 ? 'PASS' : 'BUG', `좌클릭 단발 탄약 ${b1}→${a1}`, { b1, a1 });

// 피버: 게이지가 찰 때까지 봇 사격으로 기다렸다가 더블클릭 (아래 루프에서 처리)
// 스킬: 재고가 생기면 우클릭 (아래 루프에서 처리)

// ---------- A-1-07 Esc 일시정지 ----------
await page.keyboard.press('Escape'); await sleep(800);
const pausedSnap = await snap(page);
const pauseButtons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim()).filter(Boolean));
await shot(page, 'A-1-07-esc-pause');
log('pause buttons', pauseButtons);
const resumeLabel = pauseButtons.find((t) => /이어|계속|재개|▶/.test(t));
if (resumeLabel) await page.getByRole('button', { name: resumeLabel }).first().click(); else await page.keyboard.press('Escape');
await sleep(600);
let resumed = false;
for (let i = 0; i < 30; i++) { await sleep(200); if (!(await snap(page)).isPaused) { resumed = true; break; } }
check('A-1-07', pausedSnap?.isPaused === true && resumed ? 'PASS' : 'BUG', 'Esc 일시정지 → 재개', { paused: pausedSnap?.isPaused, resumed, resumeLabel, pauseButtons });

// ---------- 봇 플레이: 피버·스킬·보상 카드·5-2 캡처 ----------
const rewardCapture = { done: false };
let feverTested = false, skillTested = false, aimDone = false;
const feverLog = [], skillLog = [];
const tPlay = Date.now();
let lastPhase = '';
let result = null;
while (Date.now() - tPlay < 18 * 60 * 1000) {
  const s = await snap(page);
  if (!s) { await sleep(500); continue; }
  // 진행 진단: 20초마다 상태를 기록해 멈춤(진행 없음) 여부를 값으로 남긴다
  if (Date.now() - (globalThis.__lastDiag || 0) > 20000) {
    globalThis.__lastDiag = Date.now();
    log('DIAG', JSON.stringify({ phase: s.phase, wave: s.wave, lives: s.lives, paused: s.isPaused, sel: s.selection.kind, targets: s.targets.length, landedNormal: s.targets.filter((t) => t.landed && !t.isItem && !t.selectKind).length, ammo: s.players[0].ammo, reloading: s.players[0].isReloading, score: s.players[0].score }));
  }
  if (s.phase !== lastPhase) { log('phase ->', s.phase, 'wave', s.wave, 'lives', s.lives); lastPhase = s.phase; }
  if (s.phase === 'GAMEOVER' || s.phase === 'VICTORY') { result = s.phase; break; }
  // 목숨 0 진단: 클릭을 멈추고 화면·phase를 15초 기록 (게임오버 전환 지연/재시작 여부 판정용)
  if (s.lives === 0 && !globalThis.__zeroDiag) {
    globalThis.__zeroDiag = true;
    log('ZERO-LIVES reached, pausing bot clicks to observe phase');
    await shot(page, 'A-1-09-zero-lives-observed');
    for (let i = 0; i < 15; i++) { await sleep(1000); const z = await snap(page); log('ZERO-OBS', i, JSON.stringify({ phase: z?.phase, lives: z?.lives, sel: z?.selection?.kind, wave: z?.wave })); if (z && (z.phase === 'GAMEOVER' || z.phase === 'VICTORY')) break; }
    const zt = await page.evaluate(() => document.body.innerText.slice(0, 200));
    log('ZERO-TEXT', JSON.stringify(zt));
    await shot(page, 'A-1-09-zero-lives-after-15s');
    result = (await snap(page))?.phase; break;
  }

  if (s.selection.kind === 'card') {
    if (!rewardCapture.done) {
      await sleep(400);
      const txt = await page.evaluate(() => document.body.innerText);
      await shot(page, 'A-1-08-reward-select-solo');
      rewardCapture.done = true;
      rewardCapture.timerText = /남은 시간|자동 선택/.test(txt);
      rewardCapture.cards = (await snap(page)).targets.filter((t) => t.selectKind === 'card').length;
      log('reward cards', rewardCapture);
    }
    const c = pickClosestToZero(s, 'card');
    const q = normToScreen(c.aimX, c.aimY);
    await page.mouse.move(q.x, q.y, { steps: 3 }); await page.mouse.down(); await sleep(60); await page.mouse.up();
    await sleep(900);
    continue;
  }
  // 무기 선택(판 재시작 포함): 가운데에 가까운 무기 카드를 클릭
  if (s.selection.kind === 'weapon') {
    const wc = s.targets.filter((t) => t.selectKind === 'weapon').sort((a, b) => Math.abs(a.aimX) - Math.abs(b.aimX))[0];
    if (wc) { const q = normToScreen(wc.aimX, wc.aimY); await page.mouse.move(q.x, q.y, { steps: 3 }); await page.mouse.down(); await sleep(60); await page.mouse.up(); }
    await sleep(800); continue;
  }
  if (s.isPaused) { await sleep(300); continue; }

  // 5-2 총구 1인 5점 캡처 (한 번만, 전투 중)
  if (!aimDone && s.phase === 'PLAYING') {
    aimDone = true;
    const pts = [
      ['A-5-2-aim-top-left', -0.7, 0.4], ['A-5-2-aim-top-right', 0.7, 0.4],
      ['A-5-2-aim-bottom-left', -0.7, -0.4], ['A-5-2-aim-bottom-right', 0.7, -0.4], ['A-5-2-aim-center', 0, 0],
    ];
    for (const [name, nx, ny] of pts) {
      const q = normToScreen(nx, ny, V.w, V.h);
      await page.mouse.move(q.x, q.y, { steps: 5 }); await sleep(250);
      await shot(page, name);
    }
    continue;
  }

  // 피버: 게이지 찼을 때 더블클릭
  if (!feverTested && s.players[0].isFeverReady && !s.players[0].isFeverActive) {
    const sc0 = s.players[0].score;
    const ks0 = s.targets.length;
    const t = s.targets.find((x) => x.landed && !x.isItem && !x.selectKind) || { aimX: 0, aimY: 0.2 };
    const q = normToScreen(t.aimX, t.aimY);
    await page.mouse.move(q.x, q.y, { steps: 2 }); await page.mouse.dblclick(q.x, q.y); await sleep(300);
    const f1 = await snap(page);
    await sleep(2000);
    const f2 = await snap(page);
    feverTested = true;
    const v = { isFeverActiveAfterDbl: f1.players[0].isFeverActive, scoreStart: sc0, scoreAfter2s: f2.players[0].score, fevAfter: f2.players[0].isFeverActive };
    check('A-1-06d-fever', f1.players[0].isFeverActive && f2.players[0].score > sc0 ? 'PASS' : 'BUG', '피버 게이지 찬 뒤 더블클릭 → 피버 발동, 2초 동안 점수 증가', v);
    await shot(page, 'A-1-06-combat-mouse-actions');
    feverLog.push(v);
  }
  // 스킬: 재고가 생기면 우클릭
  if (!skillTested && s.players[0].skillStock > 0) {
    const st0 = s.players[0].skillStock;
    await page.mouse.click(720, 300, { button: 'right' }); await sleep(500);
    const st1 = (await snap(page)).players[0].skillStock;
    skillTested = true;
    check('A-1-06c-skill', st1 < st0 ? 'PASS' : 'BUG', `우클릭 스킬 재고 ${st0}→${st1}`, { st0, st1 });
  }

  // 봇 사격: 랜딩된 가장 가까운 일반 표적을 조준 클릭
  const targets = s.targets.filter((t) => t.landed && !t.isItem && !t.selectKind).sort((a, b) => a.radiusM - b.radiusM);
  const aim = targets[0];
  if (aim) {
    const q = normToScreen(aim.aimX, aim.aimY);
    await page.mouse.move(q.x, q.y, { steps: 2 });
    await page.mouse.down(); await sleep(70); await page.mouse.up();
  } else {
    await page.mouse.click(720, 450);
  }
  await sleep(120);
}
log('play loop ended', { result, elapsedS: ((Date.now() - tPlay) / 1000).toFixed(0) });

// ---------- A-1-09 결과 화면 ----------
let resultInfo = null;
if (result) {
  await sleep(2000);
  resultInfo = await page.evaluate(() => ({
    restart: !!document.querySelector('[data-shootable="restart"]'),
    lobby: !!document.querySelector('[data-shootable="lobby"]'),
    tabs: Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim()).filter((t) => /랭킹|개인|팀/.test(t)),
    text: document.body.innerText.slice(0, 400),
  }));
  await shot(page, 'A-1-09-result-solo');
  check('A-1-09', resultInfo.restart && resultInfo.lobby ? 'PASS' : 'BUG', `결과 화면 도달(${result}), 다시 시작·로비로 버튼 존재`, { result, restart: resultInfo.restart, lobby: resultInfo.lobby, tabs: resultInfo.tabs });
  // 로비로 복귀 (D11)
  // 결과 화면 애니메이션 중 안정성 판정이 멈추는 것을 피하려고 강제 클릭, 실패 시 DOM 클릭
  try { await page.locator('[data-shootable="lobby"]').first().click({ force: true, timeout: 15000 }); }
  catch (e) { log('lobby force-click failed, DOM click fallback', e.message.split('\n')[0]); await page.evaluate(() => document.querySelector('[data-shootable="lobby"]')?.click()); }
  await sleep(2000);
  const lobby2 = await page.evaluate(() => {
    const t = document.body.innerText;
    return { emptyCount: (t.match(/비어 있음/g) || []).length, has테스터A: t.includes('테스터A · 마우스로 플레이') };
  });
  await shot(page, 'A-1-10-lobby-returned-empty');
  check('A-1-10', lobby2.emptyCount === 2 && !lobby2.has테스터A ? 'PASS' : 'BUG', '로비 복귀 후 마우스 슬롯 비워짐', lobby2);
} else {
  check('A-1-09', 'BUG', '18분 안에 결과 화면 미도달', { phase: lastPhase });
}

R.reward = rewardCapture; R.fever = feverLog; R.skill = skillLog; R.holdSamples = holdSamples;
R.errors = { pageErrors: collected.pageErrors, consoleErrors: collected.consoleErrors };
saveJson('qa-a-mouse-values.json', { checks: collected.checks, ...R, earlyStockAt1_5s: earlyStock });
await browser.close();
log('DONE mouse');
