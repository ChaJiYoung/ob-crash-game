import { createTestEnv, sleep, log, OUT } from './helper.mjs';

async function main() {
  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup } = env;

  try {
    // 콘솔에 디버그 로그 추가
    await page.evaluate(() => {
      window._debugLogs = [];
      const origLog = console.log;
      console.log = (...args) => {
        window._debugLogs.push(args.join(' '));
        origLog(...args);
      };
    });

    const mobileBtns = page.getByText('📱 모바일');
    await mobileBtns.nth(0).click();
    await sleep(400);
    await mobileBtns.nth(1).click();
    await sleep(400);

    const p1 = fakePhone(1, 'P1_Probe');
    const p2 = fakePhone(2, 'P2_Probe');
    await p1.join();
    await p2.join();
    await p1.zero();
    await p2.zero();

    await p1.aimHold(0, 0, 300);
    await p1.snapFire(0, 0);

    // 무기 선택 넘어가기
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

    // 이제 브라우저 내부의 상태를 정밀 조사:
    // WebSocket 메시지가 오는지 가로채기
    const wsProbe = await page.evaluate(() => {
      return new Promise((resolve) => {
        const events = [];
        const originalOnMessage = window.__ws_instance?.onmessage;
        // 또는 document 이벤트
        resolve({
          phase: window.__BEER_DEBUG__?.snapshot()?.phase,
          activeElement: document.activeElement?.tagName,
          buttons: Array.from(document.querySelectorAll('[data-shootable]')).map((b) => ({
            tag: b.getAttribute('data-shootable'),
            text: b.textContent,
            rect: b.getBoundingClientRect(),
          })),
        });
      });
    });

    console.log('WS PROBE RESULT:', JSON.stringify(wsProbe, null, 2));

    // 버튼 클릭이 원래 되는지 테스트: DOM click()
    const clickResult = await page.evaluate(() => {
      const restart = document.querySelector('[data-shootable="restart"]');
      if (!restart) return 'no restart button';
      restart.click();
      return 'clicked restart button';
    });
    console.log('DOM CLICK RESULT:', clickResult);
    await sleep(1000);
    const snapAfterDomClick = await getSnapshot();
    console.log('Phase after DOM click:', snapAfterDomClick?.phase);

    p1.close();
  } finally {
    await cleanup();
  }
}

main();
