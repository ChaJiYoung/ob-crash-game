// 구현된 2인팟 화면을 캡처한다. PC는 Playwright, 2P 폰은 WebSocket 스크립트로 흉내 낸다.
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import path from 'node:path';

const OUT = process.argv[2];
const URL = 'https://127.0.0.1:5199/';
const WS = 'ws://localhost:8799';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGE ERROR', e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(2500);
  return page;
}
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); log('saved', name); };

function fakePhone(roomId, slot, nickname) {
  const ws = new WebSocket(WS);
  const deviceId = `capture_phone_${slot}`;
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  const ready = new Promise((res) => ws.on('open', res));
  ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.type === 'ERROR') log('phone ERROR', m.code); });
  const frame = (aimX, aimY, extra = {}) => send({ type: 'SENSOR_FRAME', roomId, deviceId, slot, payload: {
    aimX, aimY, pitchDeg: 0, yawDeg: 0, rollDeg: 0, snapFire: false, rapidFireHold: false, feverTriggered: false, isCocked: false, timestamp: Date.now(), ...extra } });
  return {
    ws, ready, deviceId, frame,
    async join() { await ready; send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot }); await sleep(400); },
    async zero() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot }); await sleep(400); },
    async aimHold(aimX, aimY, ms) { const end = Date.now() + ms; while (Date.now() < end) { frame(aimX, aimY); await sleep(33); } },
    async snap(aimX, aimY) { frame(aimX, aimY, { snapFire: true }); await sleep(60); frame(aimX, aimY); },
  };
}

// 화면 좌표(픽셀) -> 마우스 이동·클릭
const click = async (page, x, y) => { await page.mouse.move(x, y, { steps: 4 }); await sleep(150); await page.mouse.down(); await sleep(80); await page.mouse.up(); };

// ───────── 2인 흐름 (1P 마우스 + 2P 폰) ─────────
{
  const page = await newPage();
  await shot(page, '01-lobby-empty');
  const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
  log('room', roomId);

  // 1P 마우스 등록
  await page.getByText('🖱 마우스').first().click();
  await sleep(300);
  await page.getByPlaceholder('닉네임 입력').fill('마우스왕');
  await page.getByText('확인', { exact: true }).click();
  await sleep(800);
  // 2P 모바일 선택
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(800);
  await shot(page, '02-lobby-mouse-and-phone-waiting');

  const phone = fakePhone(roomId, 2, '폰짱');
  await phone.join();
  await sleep(600);
  await shot(page, '02b-lobby-phone-paired-not-zeroed');
  await phone.zero();
  await phone.aimHold(0, 0, 600);
  await shot(page, '02c-lobby-both-ready');

  // 시작(마우스로 게임 시작 버튼 클릭)
  await page.locator('[data-shootable="start"]').first().click();
  await phone.aimHold(0, 0, 4200); // 카운트다운 동안 폰 조준 0 유지(자동 영점)
  await sleep(1200);
  await shot(page, '03-weapon-select-both');

  // 2P(폰)가 오른쪽 가운데 카드를 고른다: 조준을 오른쪽 그룹 가운데 근처로
  await phone.aimHold(0.47, -0.05, 500);
  await phone.snap(0.47, -0.05);
  await phone.aimHold(0.47, -0.05, 400);
  await shot(page, '04-weapon-select-2p-done');

  // 1P(마우스)가 왼쪽 가운데 카드를 고른다
  await click(page, 1440 * 0.265, 900 * 0.5);
  await phone.aimHold(0.2, 0.0, 3500);
  await shot(page, '05-combat-coop');
  await page.mouse.move(1440 * 0.35, 900 * 0.45);
  await phone.aimHold(-0.1, 0.05, 6000);
  await shot(page, '05b-combat-coop-later');

  // 2P 폰 끊김 → 재접속 대기
  phone.ws.close();
  await sleep(2500);
  await shot(page, '06-player-lost-grace');
  const alone = page.getByText('혼자 계속하기');
  if (await alone.count()) { await alone.first().click(); await sleep(4500); await shot(page, '07-combat-2p-away'); }

  // 판이 끝날 때까지 기다린다(몬스터가 방어선을 넘어 목숨이 다 닳을 때까지)
  for (let i = 0; i < 90; i++) {
    const done = await page.locator('[data-shootable="restart"]').count();
    if (done) break;
    await sleep(2000);
  }
  await sleep(2500);
  await shot(page, '08-result-coop');
  await page.context().close();
}

// ───────── 1인 흐름 (마우스만) ─────────
{
  const page = await newPage();
  await page.getByText('🖱 마우스').first().click();
  await sleep(300);
  await page.getByPlaceholder('닉네임 입력').fill('혼자왕');
  await page.getByText('확인', { exact: true }).click();
  await sleep(800);
  await page.locator('[data-shootable="start"]').first().click();
  await sleep(2500);
  await shot(page, '09-weapon-select-solo');
  await click(page, 1440 * 0.5, 900 * 0.5);
  await sleep(4000);
  await page.mouse.move(1440 * 0.45, 900 * 0.45);
  await shot(page, '10-combat-solo');
  await page.context().close();
}

// ───────── 튜토리얼 ─────────
{
  const page = await newPage();
  const tut = page.getByText('🎓 튜토리얼 시작');
  if (await tut.count()) { await tut.first().click(); await sleep(3000); await shot(page, '11-tutorial'); }
  await page.context().close();
}

await browser.close();
log('done');
