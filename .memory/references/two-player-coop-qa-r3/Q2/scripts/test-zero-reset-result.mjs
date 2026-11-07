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

    const p1 = fakePhone(1, 'P1_ZeroResetTest');
    const p2 = fakePhone(2, 'P2_ZeroResetTest');
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
    log('GAMEOVER reached. Now calling p1.zero() to reset zero offset...');

    // 1. 영점 리셋 전송!
    await p1.zero(false);
    await sleep(500);

    // 2. 버튼 rect 확인
    const restartAim = await page.evaluate(() => {
      const btn = document.querySelector('[data-shootable="restart"]');
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return {
        aimX: (cx / window.innerWidth) * 2 - 1,
        aimY: 1 - (cy / window.innerHeight) * 2,
      };
    });
    log('Restart button aim:', JSON.stringify(restartAim));

    // 3. 조준 프레임 1초 유지
    log('Holding aim on restart button...');
    await p1.aimHold(restartAim.aimX, restartAim.aimY, 1000);

    // 4. 호버 텍스트 확인
    const hoverText = await page.evaluate(() => document.querySelector('[data-shootable="restart"]')?.textContent);
    log('Restart button hover text:', hoverText);

    // 5. 사격!
    log('Shooting restart button...');
    await p1.snapFire(restartAim.aimX, restartAim.aimY);
    await sleep(1500);

    snap = await getSnapshot();
    log('Phase after snapFire:', snap?.phase, 'Player count:', snap?.players?.length);

    p1.close();
  } finally {
    await cleanup();
  }
}

main();
