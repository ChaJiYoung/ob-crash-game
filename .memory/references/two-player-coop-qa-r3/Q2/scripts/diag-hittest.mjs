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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));

  function phone(slot) {
    const ws = new WebSocket(WS);
    const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
    const ready = new Promise((res) => ws.on('open', res));
    return {
      async join() { await ready; send({ type: 'REGISTER_NICKNAME', roomId, deviceId: `p_${slot}`, nickname: `폰${slot}`, slot }); await sleep(250); },
      async zero() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId: `p_${slot}`, slot }); await sleep(250); },
      async snap(x, y) {
        send({ type: 'SENSOR_FRAME', roomId, deviceId: `p_${slot}`, slot, payload: { aimX: x, aimY: y, snapFire: true, timestamp: Date.now() } });
        await sleep(50);
        send({ type: 'SENSOR_FRAME', roomId, deviceId: `p_${slot}`, slot, payload: { aimX: x, aimY: y, snapFire: false, timestamp: Date.now() } });
      },
      close() { ws.close(); }
    };
  }

  await page.getByText('📱 모바일').nth(0).click();
  await sleep(200);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(300);

  const p1 = phone(1);
  const p2 = phone(2);
  await p1.join();
  await p2.join();
  await p1.zero();
  await p2.zero();

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

  p2.close();
  const aloneBtn = page.getByText('혼자 계속하기');
  await aloneBtn.waitFor({ state: 'visible', timeout: 15000 });
  await aloneBtn.click();
  await sleep(1500);

  while (true) {
    snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap?.phase === 'GAMEOVER') break;
    await sleep(500);
  }
  console.log('GAMEOVER reached!');
  await sleep(1000);

  // 브라우저에서 직접 테스트!
  const evalResult = await page.evaluate(() => {
    // restart 버튼 찾기
    const restart = document.querySelector('[data-shootable="restart"]');
    const lobby = document.querySelector('[data-shootable="lobby"]');
    const rRect = restart?.getBoundingClientRect();
    const lRect = lobby?.getBoundingClientRect();

    // hitTestButton 로직 재현:
    function hitTest(aimX, aimY) {
      const screenX = ((aimX + 1) / 2) * window.innerWidth;
      const screenY = ((1 - aimY) / 2) * window.innerHeight;
      const elements = document.querySelectorAll('[data-shootable]');
      for (const el of Array.from(elements)) {
        const rect = el.getBoundingClientRect();
        if (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
          return el.getAttribute('data-shootable');
        }
      }
      return null;
    }

    const cx = rRect.left + rRect.width / 2;
    const cy = rRect.top + rRect.height / 2;
    const aimX = (cx / window.innerWidth) * 2 - 1;
    const aimY = 1 - (cy / window.innerHeight) * 2;

    const hit = hitTest(aimX, aimY);

    return {
      rRect: { left: rRect.left, right: rRect.right, top: rRect.top, bottom: rRect.bottom },
      cx,
      cy,
      aimX,
      aimY,
      hitTestWithTheseCoords: hit,
    };
  });

  console.log('EVAL RESULT:', JSON.stringify(evalResult, null, 2));

  p1.close();
  await browser.close();
}

main().catch(console.error);
