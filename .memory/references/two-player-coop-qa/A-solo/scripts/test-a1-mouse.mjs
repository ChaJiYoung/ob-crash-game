import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import path from 'node:path';

const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa/A-solo';
const URL = 'https://127.0.0.1:5201/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const errors = [];
const consoleLogs = [];

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

async function createPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => {
    log('PAGE ERROR:', e.message);
    errors.push(`PAGE ERROR: ${e.message}`);
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      log('CONSOLE ERROR:', text);
      errors.push(`CONSOLE ERROR: ${text}`);
    } else {
      consoleLogs.push(`[${msg.type()}] ${text}`);
    }
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(2000);
  return page;
}

const shot = async (page, name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  log('Saved screenshot:', `${name}.png`);
};

// 마우스 클릭 헬퍼
const clickAt = async (page, x, y) => {
  await page.mouse.move(x, y, { steps: 5 });
  await sleep(100);
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
};

log('=== Starting Test A-1 (Mouse Solo) ===');

const page = await createPage();

// 1. 로비 초기 상태 확인
// 슬롯 카드 2개 확인
const slot1Text = await page.locator('text=1P 슬롯').first().isVisible().catch(() => false);
log('Slot 1 visible:', slot1Text);
await shot(page, 'A-1-01-lobby-empty');

// 2. 1P 마우스 선택 -> 닉네임 입력 -> 확인
log('Selecting 1P Mouse...');
const mouseButtons = page.getByText('🖱 마우스');
await mouseButtons.first().click();
await sleep(500);

// 닉네임 입력 모달 확인
const nicknameInput = page.getByPlaceholder('닉네임 입력');
log('Nickname input visible:', await nicknameInput.isVisible());
await nicknameInput.fill('테스터A');
await sleep(200);
await page.getByText('확인', { exact: true }).click();
await sleep(800);

// 1P 준비 완료 확인 및 2P 슬롯 마우스 칸 비활성 확인
const readyText = await page.locator('text=테스터A · 마우스로 플레이').first().isVisible();
log('1P ready with nickname:', readyText);

// 2P 슬롯 마우스 버튼 비활성화 상태 확인
const p2MouseBtn = mouseButtons.nth(1);
const p2MouseDisabled = await p2MouseBtn.isDisabled().catch(() => false);
const p2MouseOpacity = await p2MouseBtn.evaluate((el) => window.getComputedStyle(el).opacity);
const p2MouseCursor = await p2MouseBtn.evaluate((el) => window.getComputedStyle(el).cursor);
log(`2P Mouse button - disabled: ${p2MouseDisabled}, opacity: ${p2MouseOpacity}, cursor: ${p2MouseCursor}`);

await shot(page, 'A-1-02-lobby-mouse-1p-ready');

// 3. 새로고침 후 다시 마우스 선택 시 닉네임 자동 채움 확인
log('Reloading page to test nickname auto-fill (D15)...');
await page.reload({ waitUntil: 'networkidle' });
await sleep(2000);

await page.getByText('🖱 마우스').first().click();
await sleep(500);
const autoFilledNickname = await page.getByPlaceholder('닉네임 입력').inputValue();
log('Auto-filled nickname:', autoFilledNickname);
await shot(page, 'A-1-03-nickname-autofill');

// 등록 완료 진행
await page.getByText('확인', { exact: true }).click();
await sleep(800);

// 4. "게임 시작" 클릭 -> 카운트다운 없이 시작, 무기 카드 3장 가운데 배치 확인
log('Clicking Game Start button...');
const startBtn = page.locator('[data-shootable="start"]');
await startBtn.click();

// 카운트다운(3, 2, 1)이 뜨는지 확인
// 마우스 1인의 경우 D33/D07: 1인은 마우스 클릭 즉시 카운트다운 없이 무기 선택으로 들어가는지 확인
await sleep(1500);
await shot(page, 'A-1-04-weapon-select-solo');

// 카드 선택 중 우클릭 스킬 시도 (D25: 카드 선택 중 우클릭 스킬 막힘)
log('Testing right-click skill during weapon select...');
await page.mouse.click(720, 450, { button: 'right' });
await sleep(300);

// 무기 카드 3장 클릭 선택 (가운데 카드 클릭: 1440 * 0.5, 900 * 0.5)
log('Selecting weapon card by clicking center card...');
await clickAt(page, 720, 450);
await sleep(200);

// 시작 직후 1.5초 안 우클릭 스킬 시도 (D25: 시작 1.5초 유예)
log('Testing right-click skill within 1.5s of start...');
await page.mouse.click(720, 450, { button: 'right' });
await sleep(500);

// 5. 전투 HUD 확인 (시안 5-1)
await sleep(1500); // 1.5초 경과
await shot(page, 'A-1-05-combat-solo-hud');

// HUD 세부 요소 DOM 검사
const hudInfo = await page.evaluate(() => {
  const barDefense = document.body.innerText.includes('BAR DEFENSE');
  const teamDefense = document.body.innerText.includes('TEAM · BAR DEFENSE');
  const has1PBadge = !!document.querySelector('.badge-1p') || document.body.innerText.includes('1P');
  // 스킬 안내 문구 검사
  const skillTexts = Array.from(document.querySelectorAll('*'))
    .map(el => el.textContent)
    .filter(t => t && (t.includes('우클릭') || t.includes('위로 휙')));
  return { barDefense, teamDefense, has1PBadge, skillTexts };
});
log('HUD evaluation:', JSON.stringify(hudInfo, null, 2));

// 6. 조작 동작 확인:
// - 좌클릭 단발
log('Testing single fire (left click)...');
await page.mouse.click(720, 300);
await sleep(300);

// - 누르고 있으면 연사
log('Testing rapid fire hold (mouse down)...');
await page.mouse.move(720, 300);
await page.mouse.down();
await sleep(1500);
await page.mouse.up();
await sleep(500);

// - 우클릭 스킬
log('Testing skill (right click)...');
await page.mouse.click(720, 300, { button: 'right' });
await sleep(1000);

// - 더블클릭 피버
log('Testing fever (double click)...');
await page.mouse.dblclick(720, 300);
await sleep(1000);

await shot(page, 'A-1-06-combat-mouse-actions');

// 7. Esc 일시정지 모달 확인
log('Testing Esc pause...');
await page.keyboard.press('Escape');
await sleep(1000);
await shot(page, 'A-1-07-esc-pause');

// 일시정지 모달 내 재개 / 다시 시작 / 로비로 확인
const pauseTexts = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
  return buttons;
});
log('Pause buttons:', pauseTexts);

// 계속하기 클릭으로 재개
log('Resuming game...');
const resumeBtn = page.getByText('계속하기').or(page.getByText('재개'));
if (await resumeBtn.count()) {
  await resumeBtn.first().click();
} else {
  await page.keyboard.press('Escape');
}
await sleep(1000);

// 8. 보상 카드 및 결과 화면 대기
// 게임이 진행되어 몬스터 처치로 보상 카드가 뜨거나, 또는 라이프 소진으로 결과 화면이 뜰 때까지 관찰
log('Observing gameplay for reward select or game over...');
let rewardCaptured = false;
let resultCaptured = false;

for (let i = 0; i < 60; i++) {
  // 사격하여 적 처치 시도 (킬 게이지 증가 유도)
  await page.mouse.move(720 + (Math.sin(i) * 200), 400 + (Math.cos(i) * 100));
  await page.mouse.down();
  await sleep(300);
  await page.mouse.up();
  await sleep(700);

  // 보상 카드가 떴는지 검사
  const hasRewardCards = await page.evaluate(() => {
    // 보상 카드가 떴는지 확인 (예: 카드 선택 오버레이 등)
    return document.body.innerText.includes('보상') || 
           document.body.innerText.includes('카드 선택') ||
           document.body.innerText.includes('남은 시간');
  });

  if (hasRewardCards && !rewardCaptured) {
    log('Reward cards visible!');
    await shot(page, 'A-1-08-reward-select-solo');
    rewardCaptured = true;
    // 가운데 카드 클릭해서 선택
    await clickAt(page, 720, 450);
    await sleep(1000);
  }

  // 결과 화면 검사
  const hasRestart = await page.locator('[data-shootable="restart"]').count();
  if (hasRestart > 0) {
    log('Result screen reached!');
    await sleep(1500);
    await shot(page, 'A-1-09-result-solo');
    resultCaptured = true;
    break;
  }
}

// 만약 아직 결과 화면이 안 떴다면 라이프가 소진되도록 가만히 대기
if (!resultCaptured) {
  log('Waiting for game over to see result screen...');
  for (let i = 0; i < 40; i++) {
    const hasRestart = await page.locator('[data-shootable="restart"]').count();
    if (hasRestart > 0) {
      log('Result screen reached!');
      await sleep(1500);
      await shot(page, 'A-1-09-result-solo');
      resultCaptured = true;
      break;
    }
    await sleep(1500);
  }
}

// 결과 화면 요소 검사:
if (resultCaptured) {
  const resultInfo = await page.evaluate(() => {
    const restartBtn = !!document.querySelector('[data-shootable="restart"]');
    const lobbyBtn = !!document.querySelector('[data-shootable="lobby"]');
    const rankingTabs = Array.from(document.querySelectorAll('button, [role="tab"]')).map(el => el.textContent?.trim());
    return { restartBtn, lobbyBtn, rankingTabs, text: document.body.innerText.slice(0, 500) };
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
      bodySample: document.body.innerText.slice(0, 300)
    };
  });
  log('Returned lobby info:', returnedInfo);
}

await browser.close();

log('Errors encountered:', errors);
log('=== Done Test A-1 ===');
