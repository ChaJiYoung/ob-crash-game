import { createTestEnv, sleep, log, OUT } from './helper.mjs';

async function main() {
  log('Starting button shoot debug probe...');
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
    log('GAMEOVER reached.');

    // 버튼의 정확한 화면 rect 가져오기
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

    // 버튼 중심을 겨냥하는 aimX, aimY 계산
    const rAimX = (rects.r.cx / rects.w) * 2 - 1;
    const rAimY = 1 - (rects.r.cy / rects.h) * 2;
    log('Targeting restart button aim:', rAimX, rAimY);

    // 1초 동안 프레임 전송
    await p1.aimHold(rAimX, rAimY, 1000);

    // 현재 버튼 텍스트 확인
    const rTextBeforeShoot = await page.evaluate(() => document.querySelector('[data-shootable="restart"]')?.textContent);
    log('Restart button text before shoot:', rTextBeforeShoot);

    // snapFire 전송
    log('Sending snapFire...');
    await p1.snapFire(rAimX, rAimY);
    await sleep(1500);

    let snapAfterRestart = await getSnapshot();
    log('Phase after snapFire to restart:', snapAfterRestart?.phase);

    // 만약 여전히 GAMEOVER라면, 다양한 Y 부호나 좌표로 시도해보자!
    if (snapAfterRestart?.phase === 'GAMEOVER') {
      log('Restart did not trigger with aimY =', rAimY, '. Trying inverted Y: aimY =', -rAimY);
      await p1.aimHold(rAimX, -rAimY, 1000);
      const rTextInverted = await page.evaluate(() => document.querySelector('[data-shootable="restart"]')?.textContent);
      log('Restart button text with inverted Y:', rTextInverted);
      await p1.snapFire(rAimX, -rAimY);
      await sleep(1500);
      snapAfterRestart = await getSnapshot();
      log('Phase after snapFire with inverted Y:', snapAfterRestart?.phase);
    }

    // 만약 여전히 GAMEOVER라면, 0.94 / 0.84 스케일링을 적용한 aimX, aimY로 시도해보자!
    if (snapAfterRestart?.phase === 'GAMEOVER') {
      const scaledAimX = rAimX / 0.94;
      const scaledAimY = rAimY / 0.84;
      log('Trying scaled aim:', scaledAimX, scaledAimY);
      await p1.aimHold(scaledAimX, scaledAimY, 1000);
      const rTextScaled = await page.evaluate(() => document.querySelector('[data-shootable="restart"]')?.textContent);
      log('Restart button text with scaled aim:', rTextScaled);
      await p1.snapFire(scaledAimX, scaledAimY);
      await sleep(1500);
      snapAfterRestart = await getSnapshot();
      log('Phase after snapFire with scaled aim:', snapAfterRestart?.phase);
    }

    // 만약 여전히 GAMEOVER라면, scaled Inverted Y로 시도해보자!
    if (snapAfterRestart?.phase === 'GAMEOVER') {
      const scaledAimX = rAimX / 0.94;
      const scaledAimY = -rAimY / 0.84;
      log('Trying scaled inverted aim:', scaledAimX, scaledAimY);
      await p1.aimHold(scaledAimX, scaledAimY, 1000);
      const rTextScaledInv = await page.evaluate(() => document.querySelector('[data-shootable="restart"]')?.textContent);
      log('Restart button text with scaled inverted aim:', rTextScaledInv);
      await p1.snapFire(scaledAimX, scaledAimY);
      await sleep(1500);
      snapAfterRestart = await getSnapshot();
      log('Phase after snapFire with scaled inverted aim:', snapAfterRestart?.phase);
    }

    p1.close();
  } finally {
    await cleanup();
  }
}

main();
