import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';

const URL = 'https://127.0.0.1:5222/';
const WS = 'ws://127.0.0.1:8822';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });

  // InitScript: 모든 WebSocket 메시지를 로깅
  await ctx.addInitScript(() => {
    const origWS = window.WebSocket;
    window.__ws_messages = [];
    window.WebSocket = function (...args) {
      const ws = new origWS(...args);
      window.__pc_ws = ws;
      ws.addEventListener('message', (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type !== 'SENSOR_RELAY') {
            console.log('[PC WS IN]', d.type, JSON.stringify(d).slice(0, 150));
          } else {
            window.__last_relay = d;
          }
        } catch {}
      });
      return ws;
    };
  });

  const page = await ctx.newPage();
  page.on('console', (m) => console.log('BROWSER:', m.text()));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
  console.log('Room ID:', roomId);

  function fakePhone(slot, nickname) {
    const ws = new WebSocket(WS);
    const deviceId = `test_phone_${slot}_${Date.now()}`;
    const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
    const ready = new Promise((res) => ws.on('open', res));
    return {
      ws,
      async join() {
        await ready;
        send({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot });
        await sleep(300);
      },
      async zero() {
        send({ type: 'CALIBRATE_ZERO', roomId, deviceId, slot });
        await sleep(300);
      },
      async aim(aimX, aimY, extra = {}) {
        send({ type: 'SENSOR_FRAME', roomId, deviceId, slot, payload: { aimX, aimY, timestamp: Date.now(), ...extra } });
      },
      async snap(aimX, aimY) {
        send({ type: 'SENSOR_FRAME', roomId, deviceId, slot, payload: { aimX, aimY, snapFire: true, timestamp: Date.now() } });
        await sleep(50);
        send({ type: 'SENSOR_FRAME', roomId, deviceId, slot, payload: { aimX, aimY, snapFire: false, timestamp: Date.now() } });
      },
      close() {
        ws.close();
      },
    };
  }

  const mobileBtns = page.getByText('📱 모바일');
  await mobileBtns.nth(0).click();
  await sleep(300);
  await mobileBtns.nth(1).click();
  await sleep(400);

  const p1 = fakePhone(1, '폰1P');
  const p2 = fakePhone(2, '폰2P');
  await p1.join();
  await p2.join();
  await p1.zero();
  await p2.zero();

  // 시작 사격
  await p1.snap(0, 0);

  // 무기 선택
  let snap = null;
  for (let i = 0; i < 40; i++) {
    snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap?.selection?.kind === 'weapon') break;
    await sleep(250);
  }
  const wt = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
  await p1.snap(wt[0].aimX, wt[0].aimY);
  await p2.snap(wt[3].aimX, wt[3].aimY);

  for (let i = 0; i < 40; i++) {
    snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
    await sleep(250);
  }

  // 2P 끊기 -> 혼자 계속하기
  p2.close();
  const aloneBtn = page.getByText('혼자 계속하기');
  await aloneBtn.waitFor({ state: 'visible', timeout: 15000 });
  await aloneBtn.click();
  await sleep(1500);

  // GAMEOVER 대기
  while (true) {
    snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap?.phase === 'GAMEOVER') break;
    await sleep(500);
  }
  console.log('GAMEOVER reached in browser!');
  await sleep(1000);

  // 이제 결과 화면에서 P1 조준 전송
  console.log('Sending SENSOR_FRAME from P1 in GAMEOVER...');
  for (let i = 0; i < 5; i++) {
    await p1.aim(0.123, -0.456);
    await sleep(50);
  }

  const lastRelay = await page.evaluate(() => window.__last_relay);
  console.log('Last SENSOR_RELAY received by PC:', JSON.stringify(lastRelay));

  p1.close();
  await browser.close();
}

main().catch(console.error);
