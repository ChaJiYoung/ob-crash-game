import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';

const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa-r2/A-solo';
const URL = 'https://127.0.0.1:5201/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const errors = [];
const consoleErrors = [];
const consoleLogs = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

async function createPage(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    log('PAGE ERROR:', e.message);
    errors.push(`PAGE ERROR: ${e.message}`);
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      log('CONSOLE ERROR:', text);
      consoleErrors.push(text);
      errors.push(`CONSOLE ERROR: ${text}`);
    } else {
      consoleLogs.push(`[${msg.type()}] ${text}`);
    }
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1500);
  return page;
}

const shot = async (page, name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  log('Saved screenshot:', `${name}.png`);
};

const clickAt = async (page, x, y) => {
  await page.mouse.move(x, y, { steps: 5 });
  await sleep(80);
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
};

const normToScreen = (aimX, aimY, width = 1440, height = 900) => {
  return {
    x: ((aimX + 1) / 2) * width,
    y: ((1 - aimY) / 2) * height,
  };
};

log('=== Starting Test A-1 (Mouse Solo R2) ===');

const page = await createPage();

// 1. 로비 초기 상태 확인
log('1. Checking initial lobby empty slots (Mockup 1)...');
const slot1Text = await page.locator('text=1P 슬롯').first().isVisible().catch(() => false);
log('Slot 1 visible:', slot1Text);
await shot(page, 'A-1-01-lobby-empty');

// 2. 1P 마우스 선택 -> 닉네임 입력 -> 확인
log('2. Selecting 1P Mouse...');
const mouseButtons = page.getByText('🖱 마우스');
await mouseButtons.first().click();
await sleep(500);

const nicknameInput = page.getByPlaceholder('닉네임 입력');
log('Nickname input visible:', await nicknameInput.isVisible());
await nicknameInput.fill('테스터A');
await sleep(200);
await page.getByText('확인', { exact: true }).click();
await sleep(800);

// 1P 준비 완료 확인 및 2P 슬롯 마우스 칸 비활성 확인 (시안 2)
const readyText = await page.locator('text=테스터A · 마우스로 플레이').first().isVisible();
log('1P ready with nickname:', readyText);

const p2MouseBtn = mouseButtons.nth(1);
const p2MouseDisabled = await p2MouseBtn.isDisabled().catch(() => false);
const p2MouseOpacity = await p2MouseBtn.evaluate((el) => window.getComputedStyle(el).opacity);
const p2MouseCursor = await p2MouseBtn.evaluate((el) => window.getComputedStyle(el).cursor);
log(`2P Mouse button - disabled: ${p2MouseDisabled}, opacity: ${p2MouseOpacity}, cursor: ${p2MouseCursor}`);
await shot(page, 'A-1-02-lobby-mouse-1p-ready');

// 3. 새로고침 후 다시 마우스 선택 시 닉네임 자동 채움 (D15)
log('3. Reloading page to test nickname auto-fill (D15)...');
await page.reload({ waitUntil: 'networkidle' });
await sleep(1500);

await page.getByText('🖱 마우스').first().click();
await sleep(500);
const autoFilledNickname = await page.getByPlaceholder('닉네임 입력').inputValue();
log('Auto-filled nickname:', autoFilledNickname);
await shot(page, 'A-1-03-nickname-autofill');

await page.getByText('확인', { exact: true }).click();
await sleep(800);

// 4. "게임 시작" 클릭 -> 카운트다운 없이 시작, 무기 카드 3장 가운데 배치 확인 (D23)
log('4. Clicking Game Start button...');
const startBtn = page.locator('[data-shootable="start"]');
await startBtn.click();

await sleep(1200);
await shot(page, 'A-1-04-weapon-select-solo');

// 카드 선택 중 우클릭 스킬 시도 (D25)
log('Testing right-click skill during weapon select (should be blocked)...');
await page.mouse.click(720, 450, { button: 'right' });
await sleep(300);

// 디버그 스냅샷으로 무기 카드 3장 확인
const weaponSnap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
log('Debug snapshot during weapon select:', {
  phase: weaponSnap?.phase,
  selection: weaponSnap?.selection,
  targetCount: weaponSnap?.targets?.length,
});

// 무기 카드 3장 중 가운데 카드(리볼버 or 샷건 등) 클릭 선택
log('Selecting weapon card (center card)...');
await clickAt(page, 720, 450);
await sleep(300);

// 시작 직후 1.5초 안 우클릭 스킬 시도 (D25: 1.5초 유예 동안 스킬 막힘)
log('Testing right-click skill within 1.5s of combat start...');
await page.mouse.click(720, 450, { button: 'right' });
await sleep(600);

// 5. 전투 HUD 확인 (시안 5-1)
await sleep(1200); // 1.5초 경과
await shot(page, 'A-1-05-combat-solo-hud');

const hudInfo = await page.evaluate(() => {
  const barDefense = document.body.innerText.includes('BAR DEFENSE');
  const teamDefense = document.body.innerText.includes('TEAM · BAR DEFENSE');
  const has1PBadge = !!document.querySelector('.badge-1p') || document.body.innerText.includes('1P');
  const skillTexts = Array.from(document.querySelectorAll('*'))
    .map(el => el.textContent)
    .filter(t => t && (t.includes('우클릭') || t.includes('위로 휙')));
  return { barDefense, teamDefense, has1PBadge, skillTexts };
});
log('HUD evaluation:', JSON.stringify(hudInfo, null, 2));

// 6. 조작 동작 확인:
// 6-a. 좌클릭 단발
log('Testing single fire (left click)...');
const ammoBeforeSingle = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot().players[0].ammo);
await page.mouse.click(720, 300);
await sleep(300);
const ammoAfterSingle = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot().players[0].ammo);
log(`Single fire: ammo before=${ammoBeforeSingle}, after=${ammoAfterSingle}`);

// 6-b. 누른 채 연사 (5-1: 마우스 1초 누르기, 탄약 여러 발 감소 확인)
log('Testing rapid fire hold for 1.2s...');
const ammoBeforeHold = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot().players[0].ammo);
await page.mouse.move(720, 300);
await page.mouse.down();
await sleep(1200);
await page.mouse.up();
await sleep(300);
const ammoAfterHold = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot().players[0].ammo);
log(`Hold fire: ammo before=${ammoBeforeHold}, after=${ammoAfterHold}, diff=${ammoBeforeHold - ammoAfterHold}`);

// 6-c. 우클릭 스킬 (시작 1.5초 지났으므로 동작)
log('Testing right-click skill after 1.5s...');
const skillStockBefore = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot().players[0].skillStock);
await page.mouse.click(720, 300, { button: 'right' });
await sleep(600);
const skillStockAfter = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot().players[0].skillStock);
log(`Skill test: stock before=${skillStockBefore}, after=${skillStockAfter}`);

// 6-d. 더블클릭 피버
log('Testing fever double click...');
const snapBeforeFever = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot().players[0]);
await page.mouse.dblclick(720, 300);
await sleep(500);
const snapAfterFever = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot().players[0]);
log(`Fever test: isFeverActive before=${snapBeforeFever?.isFeverActive}, after=${snapAfterFever?.isFeverActive}`);

await shot(page, 'A-1-06-combat-mouse-actions');

// 5-2. 총구 조준(정량): 1인 판 5개 조준 좌표 확인 및 캡처
// 네 모서리(±0.7, ±0.4)와 가운데 (0, 0)
log('Testing 5-2 Gun Aiming Quant (4 corners + center)...');
const aimPoints = [
  { name: 'A-5-2-aim-top-left', normX: -0.7, normY: 0.4 },
  { name: 'A-5-2-aim-top-right', normX: 0.7, normY: 0.4 },
  { name: 'A-5-2-aim-bottom-left', normX: -0.7, normY: -0.4 },
  { name: 'A-5-2-aim-bottom-right', normX: 0.7, normY: -0.4 },
  { name: 'A-5-2-aim-center', normX: 0, normY: 0 },
];

for (const pt of aimPoints) {
  const scr = normToScreen(pt.normX, pt.normY, 1440, 900);
  await page.mouse.move(scr.x, scr.y, { steps: 5 });
  await sleep(150);
  await shot(page, pt.name);
}

// 7. Esc 일시정지 모달 확인
log('Testing Esc pause...');
await page.keyboard.press('Escape');
await sleep(800);
await shot(page, 'A-1-07-esc-pause');

const isPaused = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot().isPaused);
log('isPaused state:', isPaused);

// 계속하기 클릭으로 재개
log('Resuming game...');
const resumeBtn = page.getByText('▶ 이어하기').or(page.getByText('계속하기')).or(page.getByText('재개'));
if (await resumeBtn.count()) {
  await resumeBtn.first().click();
} else {
  await page.keyboard.press('Escape');
}
await sleep(600);

// 8. 보상 카드 선택 화면 확인 (D34: 남은 시간 표시 없음)
// 봇처럼 표적들을 겨눠 쏴서 킬 게이지를 채우거나 웨이브를 클리어
log('Engaging targets to trigger reward select round or wave clear...');
let rewardCaptured = false;
let resultCaptured = false;

for (let round = 0; round < 50; round++) {
  const snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
  if (!snap) break;

  if (snap.selection.kind === 'card' && !rewardCaptured) {
    log('Reward card selection active!');
    await sleep(500);
    await shot(page, 'A-1-08-reward-select-solo');
    rewardCaptured = true;

    // 타이머 문구 여부 확인
    const timerTextVisible = await page.evaluate(() => {
      const txt = document.body.innerText;
      return txt.includes('남은 시간') || txt.includes('자동 선택');
    });
    log('Timer text visible in reward selection:', timerTextVisible);

    // 가운데 카드 선택
    await clickAt(page, 720, 450);
    await sleep(1000);
  }

  if (snap.phase === 'GAME_OVER' || snap.phase === 'VICTORY') {
    log(`Game reached phase: ${snap.phase}`);
    await sleep(1500);
    await shot(page, 'A-1-09-result-solo');
    resultCaptured = true;
    break;
  }

  // 살아있는 타겟 조준 사격
  if (snap.targets && snap.targets.length > 0) {
    const t = snap.targets[0];
    const scr = normToScreen(t.aimX, t.aimY, 1440, 900);
    await page.mouse.move(scr.x, scr.y, { steps: 3 });
    await page.mouse.down();
    await sleep(80);
    await page.mouse.up();
  } else {
    // 적 없으면 화면 중앙 사격
    await page.mouse.click(720, 400);
  }
  await sleep(200);
}

// 만약 결과 화면이 아직 안 떴으면 플레이어 목숨 소진까지 대기
if (!resultCaptured) {
  log('Waiting for game over to reach result screen...');
  for (let i = 0; i < 40; i++) {
    const snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap?.phase === 'GAME_OVER' || snap?.phase === 'VICTORY') {
      log('Result screen reached!');
      await sleep(1500);
      await shot(page, 'A-1-09-result-solo');
      resultCaptured = true;
      break;
    }
    await sleep(1000);
  }
}

// 9. 결과 화면 및 로비 복귀
if (resultCaptured) {
  const resultInfo = await page.evaluate(() => {
    const restartBtn = !!document.querySelector('[data-shootable="restart"]');
    const lobbyBtn = !!document.querySelector('[data-shootable="lobby"]');
    const rankingTabs = Array.from(document.querySelectorAll('button, [role="tab"]')).map(el => el.textContent?.trim());
    return { restartBtn, lobbyBtn, rankingTabs };
  });
  log('Result info:', JSON.stringify(resultInfo, null, 2));

  // "로비로" 클릭
  log('Clicking Lobby button...');
  await page.locator('[data-shootable="lobby"]').first().click();
  await sleep(2000);
  await shot(page, 'A-1-10-lobby-returned-empty');

  // 로비로 돌아온 뒤 마우스 슬롯이 비워졌는지 확인 (D11)
  const returnedInfo = await page.evaluate(() => {
    return {
      hasMousePrompt: document.body.innerText.includes('입력 방식을 선택하세요') || document.body.innerText.includes('🖱 마우스'),
      bodySample: document.body.innerText.slice(0, 300),
    };
  });
  log('Returned lobby info:', returnedInfo);
}

await browser.close();

log('=== Summary ===');
log('Errors:', errors);
log('Console Errors:', consoleErrors);

fs.writeFileSync(
  path.join(OUT, 'a1-test-summary.json'),
  JSON.stringify({ errors, consoleErrors }, null, 2)
);

log('=== Done Test A-1 ===');
