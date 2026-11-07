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
  await sleep(2500);
  return page;
}

const shot = async (page, name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  log('Saved screenshot:', `${name}.png`);
};

const clickAt = async (page, x, y) => {
  await page.mouse.move(x, y, { steps: 4 });
  await sleep(100);
  await page.mouse.down();
  await sleep(80);
  await page.mouse.up();
};

log('=== Starting Test A-4 (Tutorial & Sensor Lab) ===');

const page = await createPage();

// ───────── 1. 튜토리얼 ─────────
log('Starting Tutorial from lobby...');
const tutBtn = page.getByText('🎓 튜토리얼 시작').first();
await tutBtn.dispatchEvent('click');
await sleep(3000);

// 1단계 화면 캡처: 메인과 같은 개인 패널 확인 (D14), 안내 문구 유지
await shot(page, 'A-4-01-tutorial-step1');

const tutInfo = await page.evaluate(() => {
  return {
    fullText: document.body.innerText.slice(0, 500)
  };
});
log('Tutorial Step 1 Info:', tutInfo);

// 1단계: 사격으로 캔 몬스터 맞히기 (D30 좁아진 판정 체감 관찰)
log('Step 1: Shooting at target cans...');
for (let i = 0; i < 8; i++) {
  await clickAt(page, 720, 380);
  await sleep(250);
}
await sleep(1500);
await shot(page, 'A-4-02-tutorial-step2');

// 2단계: 연사 (누르고 있기)
log('Step 2: Holding fire...');
await page.mouse.move(720, 380);
await page.mouse.down();
await sleep(2500);
await page.mouse.up();
await sleep(1500);
await shot(page, 'A-4-03-tutorial-step3');

// 3단계: 스킬 (우클릭)
log('Step 3: Right click skill...');
await page.mouse.click(720, 380, { button: 'right' });
await sleep(2000);
await shot(page, 'A-4-04-tutorial-step4');

// 4단계: 피버 (더블클릭 후 발사)
log('Step 4: Double click fever...');
await page.mouse.dblclick(720, 380);
await sleep(500);
for (let i = 0; i < 10; i++) {
  await clickAt(page, 720 + ((i % 5) - 2) * 60, 380);
  await sleep(250);
}
await sleep(2500);
await shot(page, 'A-4-05-tutorial-complete');

// ───────── 2. 센서 랩 (샌드박스) ─────────
log('Reloading to return to lobby for Sensor Lab test...');
await page.goto(URL, { waitUntil: 'networkidle' });
await sleep(2500);

const sensorLabBtn = page.getByText('🎯 영점·센서 & 모듈 테스트장').first();
await sensorLabBtn.dispatchEvent('click');
await sleep(2500);

await shot(page, 'A-4-06-sensor-lab-main');

// "테스트 사격" 버튼 클릭 동작 확인 (D29)
log('Testing "테스트 사격" button...');
const testShootBtn = page.getByText('테스트 사격').first();
if (await testShootBtn.count()) {
  await testShootBtn.click();
  await sleep(500);
  await shot(page, 'A-4-07-sensor-lab-test-shot');
}

// "실전 시작" 버튼 클릭 시 시작 조건 거치는지 확인 (D07)
log('Testing "실전 시작" button...');
const startRealBtn = page.getByText('실전 시작').first();
if (await startRealBtn.count()) {
  await startRealBtn.click();
  await sleep(2000);
  await shot(page, 'A-4-08-sensor-lab-start-condition');
}

await browser.close();
log('Errors encountered in A-4:', errors);
log('=== Done Test A-4 ===');
process.exit(0);
