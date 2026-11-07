import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import path from 'node:path';

const OUT = '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/.memory/references/two-player-coop-qa/A-solo';
const URL = 'https://127.0.0.1:5201/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => {
  log('PAGE ERROR:', e.message);
  errors.push(`PAGE ERROR: ${e.message}`);
});

await page.goto(URL, { waitUntil: 'networkidle' });
await sleep(2500);

const shot = async (name) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  log('Saved screenshot:', `${name}.png`);
};

log('=== Starting Test Sensor Lab Buttons ===');
// 로비에서 센서 랩 진입
const sensorLabBtn = page.getByText('🎯 영점·센서 & 모듈 테스트장').first();
await sensorLabBtn.dispatchEvent('click');
await sleep(2000);

// "🔫 현재 조준점 시험 사격 (반동/궤적 확인)" 버튼 클릭 동작 (D29)
log('Testing test shoot button...');
const testShootBtn = page.getByText('현재 조준점 시험 사격').first();
if (await testShootBtn.count()) {
  await testShootBtn.click();
  await sleep(600);
  await shot('A-4-07-sensor-lab-test-shot');
}

// "🚀 실전 배틀 시작!" 버튼 동작 확인 (D07 시작 조건 거침)
// 플레이어가 연결/준비되지 않은 상태에서 실전 시작 클릭 시
log('Testing "🚀 실전 배틀 시작!" button...');
const startRealBtn = page.getByText('실전 배틀 시작').first();
if (await startRealBtn.count()) {
  await startRealBtn.click();
  await sleep(1500);
  await shot('A-4-08-sensor-lab-start-condition');
}

await browser.close();
log('Errors:', errors);
log('=== Done Sensor Lab Buttons ===');
process.exit(0);
