import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';

const URL = 'https://127.0.0.1:5203/';
const WS = 'ws://localhost:8803';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
page.on('console', (m) => console.log('PAGE LOG:', m.type(), m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded' });

const roomId = await page.waitForFunction(() => localStorage.getItem('beer_crusher_pc_room_id')).then((h) => h.jsonValue());
await page.getByText('📱 모바일').first().click();
await sleep(400);
await page.getByText('📱 모바일').nth(1).click();
await sleep(400);

function fakePhone(slot) {
  const ws = new WebSocket(WS);
  const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
  return {
    ws,
    async join() {
      await new Promise((r) => ws.on('open', r));
      send({ type: 'REGISTER_NICKNAME', roomId, deviceId: `dbg_${slot}`, nickname: `P${slot}`, slot });
      await sleep(300);
      send({ type: 'CALIBRATE_ZERO', roomId, deviceId: `dbg_${slot}`, slot });
      await sleep(300);
    },
    frame(aimX, aimY, extra = {}) {
      send({
        type: 'SENSOR_FRAME',
        roomId,
        deviceId: `dbg_${slot}`,
        slot,
        payload: {
          aimX,
          aimY,
          pitchDeg: 0,
          yawDeg: 0,
          rollDeg: 0,
          snapFire: false,
          rapidFireHold: false,
          feverTriggered: false,
          skillSnapTriggered: false,
          isCocked: false,
          timestamp: Date.now(),
          ...extra,
        },
      });
    },
  };
}

const p1 = fakePhone(1);
const p2 = fakePhone(2);
await p1.join();
await p2.join();
p1.frame(0, 0);
p2.frame(0, 0, { snapFire: true });
await sleep(4500); // countdown

// Weapon select: p1 selects left, p2 selects right
p1.frame(-0.47, 0, { snapFire: true });
await sleep(500);
p2.frame(0.47, 0, { snapFire: true });
await sleep(1500);

console.log('Combat entered. Snapshot:');
console.log(await page.evaluate(() => window.__BEER_DEBUG__?.snapshot()));

// Now test hold on player 0
await page.evaluate(() => {
  const engine = window.__BEER_DEBUG__.snapshot();
  console.log('Players:', JSON.stringify(engine.players));
});

console.log('Holding rapidFireHold for 1.5s on P1...');
const start = Date.now();
while (Date.now() - start < 1500) {
  p1.frame(0, 0, { rapidFireHold: true });
  await sleep(30);
}
console.log('Hold finished. Snapshot:');
console.log(await page.evaluate(() => window.__BEER_DEBUG__?.snapshot()?.players));

p1.ws.close();
p2.ws.close();
await browser.close();
