import { createTestEnv, sleep, log, OUT } from './helper.mjs';

async function main() {
  log('Starting button test with zero reset...');
  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup } = env;

  try {
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
    log('GAMEOVER reached!');

    // 1. 영점 리셋 전송!
    log('Sending CALIBRATE_ZERO to reset zero offset...');
    await p1.zero(false);
    await sleep(500);

    // 2. 버튼 rect 확인
    const rects = await page.evaluate(() => {
      const r = document.querySelector('[data-shootable="restart"]')?.getBoundingClientRect();
      const l = document.querySelector('[data-shootable="lobby"]')?.getBoundingClientRect();
      return {
        r: r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 } : null,
        l: l ? { left: l.left, right: l.right, top: l.top, bottom: l.bottom, cx: l.left + l.width / 2, cy: l.top + l.height / 2 } : null,
        w: window.innerWidth,
        h: window.innerHeight,
      };
    });
    log('Button rects in GAMEOVER:', JSON.stringify(rects));

    const rAimX = (rects.r.cx / rects.w) * 2 - 1;
    const rAimY = 1 - (rects.r.cy / rects.h) * 2;
    log('Targeting restart button aim:', rAimX, rAimY);

    // 3. 조준 프레임 1초 유지
    await p1.aimHold(rAimX, rAimY, 1000);

    // 4. 호버 텍스트 확인 및 캡처
    await shot('Q2-03-test-restart-hover');
    const hoverText = await page.evaluate(() => document.querySelector('[data-shootable="restart"]')?.textContent);
    log('Restart button text while hovering:', hoverText);

    // 5. 사격!
    log('Shooting restart button...');
    await p1.snapFire(rAimX, rAimY);
    await sleep(1500);

    snap = await getSnapshot();
    log('Phase after snapFire to restart:', snap?.phase, 'Player count:', snap?.players?.length);
    await shot('Q2-03-test-restart-result');

    p1.close();
  } finally {
    await cleanup();
  }
}

main();
