import { createTestEnv, sleep, log } from './helper.mjs';

async function main() {
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

    log('GAMEOVER reached!');
    log('P1 ws readyState:', p1.ws.readyState); // 1 = OPEN

    // P1 메시지 이벤트 리스너 추가
    p1.ws.on('message', (data) => {
      log('P1 received WS message:', data.toString().slice(0, 200));
    });

    // P1 frame 전송 시도
    log('Sending P1 frame (aim 0, 0)...');
    p1.frame(0, 0);
    await sleep(500);

    p1.close();
  } finally {
    await cleanup();
  }
}

main();
