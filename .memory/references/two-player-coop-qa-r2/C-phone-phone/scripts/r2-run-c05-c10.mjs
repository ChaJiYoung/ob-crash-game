import { createTestEnv, OUT, sleep, log } from './test-helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Flow C-05 to C-10 test...');
  const env = await createTestEnv();
  const { page, roomId, fakePhone, shot, getSnapshot, errors, pageErrors, cleanup } = env;

  // 1. 로비 1P, 2P 모바일 선택
  await page.getByText('📱 모바일').first().click();
  await sleep(400);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(500);

  const p1 = fakePhone(1, '블루폰', 'c5_p1');
  const p2 = fakePhone(2, '오렌지폰', 'c5_p2');

  await p1.join();
  await p2.join();
  await sleep(500);
  await p1.zero();
  await p2.zero();
  await sleep(500);

  // 게임 시작 (1P 가운데 사격)
  await p1.aimHold(0, 0, 300);
  await p1.snap(0, 0);
  await Promise.all([p1.aimHold(-0.3, 0, 3600), p2.aimHold(0.3, 0, 3600)]);
  await sleep(1500);

  // 무기 선택
  await p1.aimHold(-0.47, 0, 300);
  await p1.snap(-0.47, 0);
  await sleep(300);
  await p2.aimHold(0.47, 0, 300);
  await p2.snap(0.47, 0);
  await sleep(1500);

  log('Combat started.');
  await Promise.all([p1.aimHold(-0.2, 0.1, 2000), p2.aimHold(0.2, 0.1, 2000)]);

  // C-04: 스킬 쿨다운 완료 후 "[위로 휙!]" 캡처
  log('Waiting for skill cooldown (20s) to verify SKILL READY [위로 휙!]...');
  for (let s = 0; s < 21; s++) {
    await Promise.all([p1.aimHold(-0.2, 0.1, 1000), p2.aimHold(0.2, 0.1, 1000)]);
  }
  await shot('C-04-combat-hud-skill-ready');

  // --- C-05: 2P 폰 끊김 테스트 ---
  log('Testing C-05: Disconnecting Phone 2 (2P)...');
  p2.close();
  await sleep(1200);

  const graceModalInfo = await page.evaluate(() => {
    const title = document.querySelector('h2')?.innerText;
    const body = document.body.innerText;
    const resumeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('이어하기'));
    const aloneBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('혼자 계속하기'));
    return {
      title,
      resumeDisabled: resumeBtn ? resumeBtn.disabled || resumeBtn.style.cursor === 'not-allowed' : null,
      hasAloneBtn: !!aloneBtn,
      bodyTextSnippet: body.slice(0, 400),
    };
  });
  log('Grace modal check:', graceModalInfo);
  await shot('C-05-disconnect-grace-countdown');

  // --- C-06: 30초 안에 재접속 -> 3초 카운트다운 뒤 재개 ---
  log('Testing C-06: Phone 2 reconnecting within grace period...');
  const reconnectPromise = p2.reconnect(true);
  try {
    await page.locator('text=게임 재개! 조준선을 정렬하세요').waitFor({ timeout: 4000 });
    await shot('C-06-reconnected-3s-countdown');
  } catch (err) {
    log('Countdown overlay catch fallback:', err.message);
  }
  await reconnectPromise;
  // 카운트다운 3.5초 대기
  await Promise.all([p1.aimHold(-0.2, 0.1, 3500), p2.aimHold(0.2, 0.1, 3500)]);
  await shot('C-06-game-resumed');

  // --- C-07: 2P 다시 끊김 후 "혼자 계속하기" 클릭 -> 2P "나감" 표시, 2P 십자선/총 숨김, 1P 진행 ---
  log('Testing C-07: Disconnecting Phone 2 again and clicking 혼자 계속하기...');
  p2.close();
  await sleep(1200);

  const aloneBtn = page.getByText('혼자 계속하기');
  if (await aloneBtn.count()) {
    await aloneBtn.first().click();
    await sleep(1200);
  }

  await p1.aimHold(-0.1, 0.05, 1200);
  const snapAway = await getSnapshot();
  log('P2 away state in snapshot:', snapAway.players[1]?.isAway);
  await shot('C-07-2p-away-status');

  // --- C-08: 나감 상태에서 카드 선택 라운드 -> 2P 몫 자동 선택, 1P만 고르면 진행 ---
  log('Testing C-08: Checking auto pick for away player in select round...');
  // 몬스터 처치하여 카드 라운드 열기
  let cardRoundSeen = false;
  for (let i = 0; i < 50; i++) {
    const s = await getSnapshot();
    if (s.selection?.kind !== null) {
      log('Card select round appeared! Selection status:', s.selection);
      cardRoundSeen = true;
      log('2P auto-pick done check:', s.selection.done[1]);
      await shot('C-08-away-auto-select-round');
      // 1P 선택 (-0.47, 0)
      await p1.snap(-0.47, 0);
      await sleep(1000);
      break;
    }
    if (s.targets && s.targets.length > 0) {
      await p1.snap(s.targets[0].aimX, s.targets[0].aimY);
    } else {
      await p1.snap(0, 0);
    }
    await sleep(150);
  }

  // --- C-09: 나감 뒤 2P 재접속 -> 영점 없이 바로 복귀, 십자선/총 다시 보임, 2P 스킬 쿨다운 정지 확인 ---
  log('Testing C-09: Phone 2 reconnecting after away...');
  const snapBeforeReturn = await getSnapshot();
  log('P2 skill stock/state before return:', snapBeforeReturn.players[1]);

  await p2.reconnect(true);
  await sleep(1000);
  await Promise.all([p1.aimHold(-0.2, 0.1, 1500), p2.aimHold(0.2, 0.1, 1500)]);

  const snapAfterReturn = await getSnapshot();
  log('P2 away after return:', snapAfterReturn.players[1]?.isAway);
  await shot('C-09-reconnect-after-away');

  // --- C-10: 두 폰 동시 끊김 -> 무기한 대기(D40) ---
  log('Testing C-10: Simultaneous disconnect...');
  log('Closing 2P socket...');
  p2.close();
  await sleep(1000);
  log('Closing 1P socket while 2P grace is active...');
  p1.close();
  await sleep(1500);

  const indefiniteInfo = await page.evaluate(() => {
    const title = document.querySelector('h2')?.innerText;
    const body = document.body.innerText;
    return { title, hasCountdown: body.includes('초'), bodySnippet: body.slice(0, 300) };
  });
  log('Indefinite wait modal info:', indefiniteInfo);
  await shot('C-10-both-phones-disconnected-indefinite');

  const c05to10Results = {
    graceModalInfo,
    p2AwayConfirmed: snapAway.players[1]?.isAway,
    cardRoundSeen,
    p2ReturnAwayCleared: snapAfterReturn.players[1]?.isAway === false,
    indefiniteInfo,
    pageErrorsCount: pageErrors.length,
    errorsCount: errors.length,
    errors,
  };
  fs.writeFileSync(path.join(OUT, 'c05-c10-results.json'), JSON.stringify(c05to10Results, null, 2));

  await cleanup();
  log('Flow C-05 to C-10 test finished successfully! Total errors:', errors.length);
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
