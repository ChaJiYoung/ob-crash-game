import { createTestEnv, sleep, log } from './helper.mjs';

async function main() {
  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup } = env;

  try {
    // WebSocket 메시지 수신 로깅을 브라우저에 주입
    await page.evaluate(() => {
      const origWebSocket = window.WebSocket;
      window.__capturedRelays = [];
      window.WebSocket = function (...args) {
        const ws = new origWebSocket(...args);
        ws.addEventListener('message', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'SENSOR_RELAY') {
              window.__capturedRelays.push({ slot: data.slot, payloadAimX: data.payload?.aimX, payloadAimY: data.payload?.aimY, time: Date.now() });
              if (window.__capturedRelays.length > 50) window.__capturedRelays.shift();
            }
          } catch {}
        });
        return ws;
      };
    });

    const mobileBtns = page.getByText('📱 모바일');
    await mobileBtns.nth(0).click();
    await sleep(400);
    await mobileBtns.nth(1).click();
    await sleep(400);

    const p1 = fakePhone(1, '폰1P');
    const p2 = fakePhone(2, '폰2P');
    await p1.join();
    await p2.join();
    await p1.zero();
    await p2.zero();

    await p1.aimHold(0, 0, 300);
    await p1.snapFire(0, 0);

    // 무기 선택
    let snap = null;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon') break;
      await sleep(250);
    }
    const wt = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
    await p1.snapFire(wt[0].aimX, wt[0].aimY);
    await p2.snapFire(wt[3].aimX, wt[3].aimY);

    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
      await sleep(250);
    }

    // 2P 끊고 혼자 계속하기
    p2.close();
    const aloneBtn = page.getByText('혼자 계속하기');
    await aloneBtn.waitFor({ state: 'visible', timeout: 15000 });
    await aloneBtn.click();
    await sleep(1500);

    // GAMEOVER 대기
    while (true) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') break;
      await sleep(500);
    }
    await sleep(1000);
    log('GAMEOVER reached.');

    // 결과 화면에서 p1 프레임 전송
    log('Sending p1 frames in GAMEOVER...');
    for (let i = 0; i < 5; i++) {
      await p1.aimHold(-0.5, 0.5, 100);
    }

    // 브라우저에서 수신된 SENSOR_RELAY 확인
    const relays = await page.evaluate(() => window.__capturedRelays || []);
    log('Captured SENSOR_RELAY count:', relays.length);
    if (relays.length > 0) {
      log('Last SENSOR_RELAY:', JSON.stringify(relays.at(-1)));
    }

    p1.close();
  } finally {
    await cleanup();
  }
}

main();
