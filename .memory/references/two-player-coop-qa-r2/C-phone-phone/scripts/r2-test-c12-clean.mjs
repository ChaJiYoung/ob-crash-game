import { createTestEnv, OUT, sleep, log } from './test-helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting C-12 Result Screen Test (Away badge, Phone shoot restart)...');
  const env = await createTestEnv();
  const { page, fakePhone, shot, getSnapshot, errors, pageErrors, cleanup } = env;

  // 1. 로비 1P, 2P 모바일 선택
  await page.getByText('📱 모바일').first().click();
  await sleep(400);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(600);

  const p1 = fakePhone(1, '블루폰', 'c12_p1');
  const p2 = fakePhone(2, '오렌지폰', 'c12_p2');

  await p1.join();
  await p2.join();
  await sleep(500);

  await p1.zero();
  await p2.zero();
  await sleep(600);

  await Promise.all([p1.aimHold(-0.2, 0, 800), p2.aimHold(0.2, 0, 800)]);

  // Phone 2 사격으로 게임 시작
  await p2.snap(0, 0);
  await sleep(600);
  await Promise.all([p1.aimHold(-0.3, 0, 3600), p2.aimHold(0.3, 0, 3600)]);
  await sleep(1500);

  // 무기 선택: 1P 개틀링, 2P 샷건
  await p1.aimHold(-0.47, 0, 500);
  await p1.snap(-0.47, 0);
  await p1.aimHold(-0.47, 0, 600);

  await p2.aimHold(0.47, 0, 500);
  await p2.snap(0.47, 0);
  await p2.aimHold(0.47, 0, 1000);

  log('Combat active.');
  await Promise.all([p1.aimHold(-0.2, 0.1, 1500), p2.aimHold(0.2, 0.1, 1500)]);

  // 2P 끊기 후 "혼자 계속하기" 클릭 -> 2P 이탈 상태 만들기
  log('Disconnecting Phone 2 and continuing alone...');
  p2.close();
  const aloneBtn = page.getByText('혼자 계속하기');
  await aloneBtn.waitFor({ timeout: 5000 });
  await aloneBtn.click();
  await sleep(1500);

  // 몬스터 침공으로 게임 오버될 때까지 대기
  log('Waiting for monsters to breach defense line and trigger game over...');
  for (let i = 0; i < 70; i++) {
    // 1P 조준은 유지하되 사격하지 않음
    await p1.aimHold(0, 0, 800);
    const snap = await getSnapshot();
    if (snap?.phase === 'GAMEOVER') {
      log('Game over phase detected in snapshot!');
      break;
    }
    const restartBtnCount = await page.locator('[data-shootable="restart"]').count();
    if (restartBtnCount > 0) {
      log('Game over restart button detected in DOM!');
      break;
    }
  }

  await sleep(1500);

  // C-12: 결과 화면 캡처 (이탈자 칸 "나감", 1P/2P 결과, 팀 랭킹)
  const resultModalInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasAwayBadge = text.includes('나감');
    const hasTeamRanking = text.includes('팀 랭킹');
    return { hasAwayBadge, hasTeamRanking, textSnippet: text.slice(0, 500) };
  });
  log('Result modal check:', resultModalInfo);
  await shot('C-12-result-away-badge');

  // C-12: 1P 폰으로 "다시 도전하기" 버튼 조준
  log('Phone 1 aiming at restart button...');
  const restartBtn = page.locator('[data-shootable="restart"]');
  const btnBox = await restartBtn.boundingBox();
  log('Restart button boundingBox:', btnBox);

  if (btnBox) {
    // 화면 좌표를 폰 aimX, aimY (-1 ~ 1)로 변환
    const btnAimX = ((btnBox.x + btnBox.width / 2) / 1440) * 2 - 1;
    const btnAimY = 1 - ((btnBox.y + btnBox.height / 2) / 900) * 2;
    log('Converted aim coords for restart button:', { btnAimX, btnAimY });

    // 조준 올려놓고 호버 발광 캡처
    await p1.aimHold(btnAimX, btnAimY, 1000);
    await shot('C-12-result-centered-aim');

    // 폰 사격으로 버튼 클릭
    log('Shooting restart button with Phone 1...');
    await p1.snap(btnAimX, btnAimY);
    await sleep(2000);

    // 새 판 무기 선택 화면으로 재시작되었는지 확인
    const snapRestart = await getSnapshot();
    log('Phase after restart shot:', snapRestart?.phase, snapRestart?.selection);
    await shot('C-12-result-shoot-action-result');

    const resultScreenData = {
      resultModalInfo,
      btnAimCoords: { btnAimX, btnAimY },
      restartedPhase: snapRestart?.phase,
      pageErrorsCount: pageErrors.length,
      errorsCount: errors.length,
      errors,
    };
    fs.writeFileSync(path.join(OUT, 'c12-results.json'), JSON.stringify(resultScreenData, null, 2));
  }

  p1.close();
  await cleanup();
  log('C-12 Result Screen Test finished! Total errors:', errors.length);
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
