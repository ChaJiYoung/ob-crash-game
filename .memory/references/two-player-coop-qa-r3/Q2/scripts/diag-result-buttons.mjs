import { createTestEnv, sleep, log, OUT } from './helper.mjs';

async function main() {
  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup } = env;

  try {
    const mobileBtns = page.getByText('📱 모바일');
    await mobileBtns.nth(0).click();
    await sleep(400);
    await mobileBtns.nth(1).click();
    await sleep(400);

    const p1 = fakePhone(1, 'P1_Diag');
    const p2 = fakePhone(2, 'P2_Diag');
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

    // 결과 화면 진단
    const diag = await page.evaluate(() => {
      const restart = document.querySelector('[data-shootable="restart"]');
      const lobby = document.querySelector('[data-shootable="lobby"]');
      const rRect = restart?.getBoundingClientRect();
      const lRect = lobby?.getBoundingClientRect();
      const crosshairs = Array.from(document.querySelectorAll('[data-testid^="crosshair-"]')).map((el) => {
        return {
          id: el.getAttribute('data-testid'),
          style: el.getAttribute('style'),
          rect: el.getBoundingClientRect(),
        };
      });

      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        restartRect: rRect ? { left: rRect.left, right: rRect.right, top: rRect.top, bottom: rRect.bottom, x: rRect.x, y: rRect.y, w: rRect.width, h: rRect.height } : null,
        lobbyRect: lRect ? { left: lRect.left, right: lRect.right, top: lRect.top, bottom: lRect.bottom, x: lRect.x, y: lRect.y, w: lRect.width, h: lRect.height } : null,
        crosshairs,
      };
    });

    console.log('DIAG RESULT:', JSON.stringify(diag, null, 2));

    // 버튼의 정확한 중심 좌표를 hitTestButton에 넣어보기
    // hitTestButton:
    // screenX = ((aimX + 1) / 2) * window.innerWidth
    // screenY = ((1 - aimY) / 2) * window.innerHeight
    // 따라서:
    // aimX = (screenX / window.innerWidth) * 2 - 1
    // aimY = 1 - (screenY / window.innerHeight) * 2
    const restartCx = diag.restartRect.left + diag.restartRect.w / 2;
    const restartCy = diag.restartRect.top + diag.restartRect.h / 2;
    const restartAimX = (restartCx / diag.innerWidth) * 2 - 1;
    const restartAimY = 1 - (restartCy / diag.innerHeight) * 2;

    console.log('Calculated restart aimX, aimY:', restartAimX, restartAimY);

    // 이제 p1으로 이 좌표를 계속 쏘면서 브라우저에서 무엇이 일어나는지 확인
    for (let f = 0; f < 10; f++) {
      p1.frame(restartAimX, restartAimY);
      await sleep(30);
    }

    const hoverAfterFrame = await page.evaluate(() => {
      const btn = document.querySelector('[data-shootable="restart"]');
      return btn?.textContent;
    });
    console.log('Hover text after frames:', hoverAfterFrame);

    // 사격 전송
    console.log('Sending snapFire to restart button...');
    await p1.snapFire(restartAimX, restartAimY);
    await sleep(1000);

    const phaseAfterSnap = await getSnapshot();
    console.log('Phase after snapFire:', phaseAfterSnap?.phase);

    p1.close();
  } finally {
    await cleanup();
  }
}

main();
