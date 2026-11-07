import { createTestEnv, sleep, log, OUT, toScreenX, toScreenY, fromScreenX, fromScreenY } from './helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  log('=== Q2 Items 1, 3, 4 Test Starting ===');
  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup, errors, pageErrors } = env;

  const results = {
    testName: 'Q2-Items-1-3-4',
    timestamp: new Date().toISOString(),
    item1_awayCardRound: {},
    item3_resultScreen: {},
    item4_rosterAndLobby: {},
    errors: [],
  };

  try {
    // ==========================================
    // 1. 로비에서 폰 2대 연결
    // ==========================================
    log('1. Pairing 2 phones in lobby...');
    const mobileBtns = page.getByText('📱 모바일');
    await mobileBtns.nth(0).click();
    await sleep(400);
    await mobileBtns.nth(1).click();
    await sleep(500);

    const p1 = fakePhone(1, '블루폰1P', 'phone_q2_test_p1');
    const p2 = fakePhone(2, '오렌지폰2P', 'phone_q2_test_p2');

    await p1.join();
    await p2.join();
    await sleep(400);
    await p1.zero();
    await p2.zero();
    await sleep(500);

    await shot('Q2-01-00-lobby-ready');

    // ==========================================
    // 2. 시작 사격 & 무기 선택
    // ==========================================
    log('2. Starting game via P1 center shot...');
    await p1.aimHold(0, 0, 500);
    await p1.snapFire(0, 0);

    let snap = null;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon') break;
      await sleep(250);
    }

    if (snap?.selection?.kind !== 'weapon') {
      throw new Error(`Failed to reach weapon select. Phase: ${snap?.phase}`);
    }
    log('Weapon selection reached.');

    // 1P는 샷건 또는 왼쪽 카드, 2P는 오른쪽 카드 선택
    const wt = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
    const p1Cards = wt.filter((t) => t.ownerIndex === 0 || t.aimX < 0);
    const p2Cards = wt.filter((t) => t.ownerIndex === 1 || t.aimX > 0);

    const p1Choice = p1Cards.find((c) => c.selectValue === 'shotgun') || p1Cards[0];
    const p2Choice = p2Cards.find((c) => c.selectValue === 'revolver') || p2Cards[0];

    log(`P1 selecting ${p1Choice.selectValue} at (${p1Choice.aimX}, ${p1Choice.aimY})`);
    await p1.aimHold(p1Choice.aimX, p1Choice.aimY, 300);
    await p1.snapFire(p1Choice.aimX, p1Choice.aimY);

    log(`P2 selecting ${p2Choice.selectValue} at (${p2Choice.aimX}, ${p2Choice.aimY})`);
    await p2.aimHold(p2Choice.aimX, p2Choice.aimY, 300);
    await p2.snapFire(p2Choice.aimX, p2Choice.aimY);

    // 전투 진입 대기
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
      await sleep(250);
    }
    if (snap?.phase !== 'PLAYING' || snap?.selection?.kind !== null) {
      throw new Error('Failed to enter combat phase.');
    }
    log('Combat phase entered. Players:', snap.players.length);
    await shot('Q2-01-01-combat-entered');

    // ==========================================
    // 3. 전투 중 2P 폰 끊기 & "혼자 계속하기"
    // ==========================================
    log('3. Disconnecting 2P Phone during combat...');
    p2.close();
    await sleep(800);

    // "혼자 계속하기" 버튼 대기
    const aloneBtn = page.getByText('혼자 계속하기');
    await aloneBtn.waitFor({ state: 'visible', timeout: 15000 });
    await shot('Q2-01-02-grace-countdown-visible');

    log('Clicking "혼자 계속하기"...');
    await aloneBtn.click();
    await sleep(2000);

    // 재개 대기 (3초 카운트다운)
    for (let i = 0; i < 30; i++) {
      snap = await getSnapshot();
      if (!snap.isPaused && snap.players[1]?.isAway) break;
      await p1.aimHold(-0.1, 0, 150);
      await sleep(150);
    }

    log('Game resumed with 2P away. 2P isAway:', snap.players[1]?.isAway, 'isPaused:', snap.isPaused);
    await shot('Q2-01-03-resumed-2p-away');

    results.item1_awayCardRound.p2AwayAfterAlone = snap.players[1]?.isAway;
    results.item1_awayCardRound.isPausedAfterAlone = snap.isPaused;

    // ==========================================
    // 4. 1P 사격으로 웨이브 1 클리어 -> 보상 카드 라운드 도달
    // ==========================================
    log('4. P1 shooting targets to clear wave 1 and trigger reward cards...');
    const tStartShoot = Date.now();
    let cardRoundTriggered = false;

    while (Date.now() - tStartShoot < 120000) { // 최대 2분
      snap = await getSnapshot();
      if (!snap) {
        await sleep(100);
        continue;
      }

      if (snap.phase !== 'PLAYING') {
        log(`Unexpected phase during shooting: ${snap.phase}`);
        break;
      }

      if (snap.selection?.kind === 'card') {
        log(`Reward card round reached! Wave: ${snap.wave}`);
        cardRoundTriggered = true;
        break;
      }

      // 타겟 조준 사격
      const liveTargets = (snap.targets || []).filter(
        (t) => t.landed && !t.isItem && !t.selectKind && (t.hp === undefined || t.hp > 0)
      );

      if (liveTargets.length > 0) {
        // 가장 아래에 있거나 가까운 타겟 우선
        const target = liveTargets.sort((a, b) => a.aimY - b.aimY)[0];
        await p1.snapFire(target.aimX, target.aimY);
        await sleep(90);
      } else {
        // 타겟이 아직 착지 전이면 가운데 사격
        await p1.snapFire(0, 0);
        await sleep(120);
      }
    }

    if (!cardRoundTriggered) {
      throw new Error('Reward card round was not triggered within time limit.');
    }

    // ==========================================
    // 5. 보상 카드 라운드: 2P 즉시 자동 선택 & 1P 선택 확인 (항목 1)
    // ==========================================
    await sleep(500); // 렌더링 안정화
    const cardSnap = await getSnapshot();
    const cardBody = await page.evaluate(() => document.body.innerText);
    await shot('Q2-01-04-reward-card-round-auto-selected');

    const cardTargets = (cardSnap.targets || []).filter((t) => t.selectKind === 'card');
    log('Reward card targets:', cardTargets.map((c) => ({ val: c.selectValue, owner: c.ownerIndex, x: c.aimX, y: c.aimY })));
    log('Selection done state:', JSON.stringify(cardSnap.selection?.done));

    results.item1_awayCardRound.selectionDone = cardSnap.selection?.done;
    results.item1_awayCardRound.p2AutoSelected = cardSnap.selection?.done?.[1] === true;
    results.item1_awayCardRound.p1DoneBeforePick = cardSnap.selection?.done?.[0] === false;
    results.item1_awayCardRound.p2AwayDuringCards = cardSnap.players[1]?.isAway;
    results.item1_awayCardRound.bodyText = cardBody.slice(0, 400);

    log('Item 1 Result: 2P auto-selected?', results.item1_awayCardRound.p2AutoSelected);

    // 1P 몫 카드 선택
    const p1CardTargets = cardTargets.filter((t) => t.ownerIndex === 0 || t.aimX < 0);
    const chosenCard = p1CardTargets[0] || cardTargets[0];
    if (!chosenCard) {
      throw new Error('No 1P reward card target found.');
    }

    log(`P1 shooting card: ${chosenCard.selectValue} at (${chosenCard.aimX}, ${chosenCard.aimY})`);
    await p1.aimHold(chosenCard.aimX, chosenCard.aimY, 300);
    await p1.snapFire(chosenCard.aimX, chosenCard.aimY);
    await sleep(1000);

    // 1P 선택 후 즉시 진행되는지 확인
    let afterCardSnap = null;
    for (let i = 0; i < 30; i++) {
      afterCardSnap = await getSnapshot();
      if (afterCardSnap?.selection?.kind === null && afterCardSnap?.phase === 'PLAYING') break;
      await sleep(200);
    }

    await shot('Q2-01-05-after-1p-picked-gameplay-resumed');
    results.item1_awayCardRound.proceededToWave = afterCardSnap?.wave;
    results.item1_awayCardRound.selectionAfterPick = afterCardSnap?.selection?.kind;
    results.item1_awayCardRound.phaseAfterPick = afterCardSnap?.phase;
    log('Gameplay resumed to wave:', afterCardSnap?.wave, 'Selection kind:', afterCardSnap?.selection?.kind);

    // ==========================================
    // 6. 결과 화면 도달 (게임오버 유도) (항목 3)
    // ==========================================
    log('6. Inducing Game Over for Result Screen (Item 3)...');
    const tGameOverStart = Date.now();
    let gameOverReached = false;

    while (Date.now() - tGameOverStart < 90000) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') {
        gameOverReached = true;
        break;
      }
      // 사격하지 않고 대기하여 몬스터에게 맞음
      await sleep(500);
    }

    if (!gameOverReached) {
      throw new Error('Failed to reach GAMEOVER phase.');
    }
    log('GAMEOVER reached!');
    await sleep(1200);

    const resultSnap = await getSnapshot();
    const resultBody = await page.evaluate(() => document.body.innerText);
    await shot('Q2-03-01-result-screen');

    // 이탈자 칸 "나감" 표시 확인
    const hasAwayBadge = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('span'));
      return badges.some((b) => b.textContent && b.textContent.trim() === '나감');
    });

    results.item3_resultScreen.phase = resultSnap.phase;
    results.item3_resultScreen.hasAwayBadge = hasAwayBadge;
    results.item3_resultScreen.p2LeftEarly = resultSnap.players[1]?.isAway;
    results.item3_resultScreen.bodySnippet = resultBody.slice(0, 500);

    log('Item 3: Result Screen hasAwayBadge:', hasAwayBadge);

    // 버튼 DOM rect 및 중심 좌표 구하기
    const buttonInfo = await page.evaluate(() => {
      const restartBtn = document.querySelector('[data-shootable="restart"]');
      const lobbyBtn = document.querySelector('[data-shootable="lobby"]');
      const rRect = restartBtn ? restartBtn.getBoundingClientRect() : null;
      const lRect = lobbyBtn ? lobbyBtn.getBoundingClientRect() : null;
      return {
        restart: rRect ? { x: rRect.x + rRect.width / 2, y: rRect.y + rRect.height / 2, width: rRect.width, height: rRect.height } : null,
        lobby: lRect ? { x: lRect.x + lRect.width / 2, y: lRect.y + lRect.height / 2, width: lRect.width, height: lRect.height } : null,
      };
    });

    log('Button screen coordinates:', JSON.stringify(buttonInfo));

    if (!buttonInfo.restart || !buttonInfo.lobby) {
      throw new Error('Restart or Lobby button not found on Result Screen.');
    }

    // ==========================================
    // 7. 폰 조준으로 "다시 도전하기" 사격 동작 (항목 3 & 4)
    // ==========================================
    log('7. Shooting "다시 도전하기" with P1 fakePhone...');
    const restartAimX = fromScreenX(buttonInfo.restart.x);
    const restartAimY = fromScreenY(buttonInfo.restart.y);
    log(`Aiming at Restart Button: aim(${restartAimX.toFixed(3)}, ${restartAimY.toFixed(3)})`);

    await p1.aimHold(restartAimX, restartAimY, 400);
    await shot('Q2-03-02-aiming-restart-button');
    await p1.snapFire(restartAimX, restartAimY);
    await sleep(1500);

    // 다시 도전 후 상태 확인 (무기 선택 화면 또는 PLAYING 진입)
    let snapAfterRestart = null;
    for (let i = 0; i < 30; i++) {
      snapAfterRestart = await getSnapshot();
      if (snapAfterRestart?.phase === 'PLAYING') break;
      await sleep(250);
    }

    await shot('Q2-03-03-after-restart-triggered');
    await shot('Q2-04-01-roster-maintained-after-restart');

    const rosterCount = snapAfterRestart?.players?.length;
    log('Restart triggered! Phase:', snapAfterRestart?.phase, 'Player count:', rosterCount);

    results.item3_resultScreen.restartShotWorked = snapAfterRestart?.phase === 'PLAYING';
    results.item4_rosterAndLobby.rosterCountAfterRestart = rosterCount;
    results.item4_rosterAndLobby.sameRoster = rosterCount === 2;

    // ==========================================
    // 8. 다시 결과 화면 도달 -> 이번엔 "로비로 이동" 폰 사격 (항목 3 & 4)
    // ==========================================
    log('8. Ending this run quickly to test "로비로 이동"...');
    // 무기 선택 화면이면 대충 선택하거나 pass
    if (snapAfterRestart?.selection?.kind === 'weapon') {
      const wtRestart = (snapAfterRestart.targets || []).filter((t) => t.selectKind === 'weapon');
      const p1c = wtRestart[0];
      if (p1c) {
        await p1.aimHold(p1c.aimX, p1c.aimY, 200);
        await p1.snapFire(p1c.aimX, p1c.aimY);
      }
    }

    // 게임오버 유도
    log('Waiting for GAMEOVER in second run...');
    let secondGameOver = false;
    const tG2 = Date.now();
    while (Date.now() - tG2 < 60000) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') {
        secondGameOver = true;
        break;
      }
      await sleep(400);
    }

    if (!secondGameOver) {
      throw new Error('Failed to reach GAMEOVER in second run.');
    }
    log('Second GAMEOVER reached!');
    await sleep(1200);
    await shot('Q2-03-04-second-result-screen');

    // "로비로 이동" 버튼 좌표 다시 구하기
    const lobbyBtnInfo = await page.evaluate(() => {
      const lobbyBtn = document.querySelector('[data-shootable="lobby"]');
      const lRect = lobbyBtn ? lobbyBtn.getBoundingClientRect() : null;
      return lRect ? { x: lRect.x + lRect.width / 2, y: lRect.y + lRect.height / 2 } : null;
    });

    if (!lobbyBtnInfo) {
      throw new Error('Lobby button not found on second Result Screen.');
    }

    const lobbyAimX = fromScreenX(lobbyBtnInfo.x);
    const lobbyAimY = fromScreenY(lobbyBtnInfo.y);
    log(`Aiming at Lobby Button: aim(${lobbyAimX.toFixed(3)}, ${lobbyAimY.toFixed(3)})`);

    await p1.aimHold(lobbyAimX, lobbyAimY, 400);
    await shot('Q2-03-05-aiming-lobby-button');
    await p1.snapFire(lobbyAimX, lobbyAimY);
    await sleep(1500);

    // 로비 복귀 확인 (`snap.phase === 'PAIRING'`)
    let snapAfterLobby = null;
    for (let i = 0; i < 30; i++) {
      snapAfterLobby = await getSnapshot();
      if (snapAfterLobby?.phase === 'PAIRING') break;
      await sleep(250);
    }

    log('Lobby returned! Phase:', snapAfterLobby?.phase);
    await shot('Q2-04-02-returned-to-lobby-slots');

    // 로비 슬롯 확인: 폰 슬롯이 남아있는지!
    const lobbySlots = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid^="slot-card-"], .slot-card'));
      return {
        bodySnippet: document.body.innerText.slice(0, 600),
      };
    });

    results.item3_resultScreen.lobbyShotWorked = snapAfterLobby?.phase === 'PAIRING';
    results.item4_rosterAndLobby.lobbyPhase = snapAfterLobby?.phase;
    results.item4_rosterAndLobby.lobbyBodyText = lobbySlots.bodySnippet;

    p1.close();
  } catch (err) {
    log('ERROR in test:', err);
    results.errors.push(err.message);
  } finally {
    results.pageErrors = pageErrors;
    results.consoleErrors = errors;
    fs.writeFileSync(path.join(OUT, 'q2-items1-3-4-result.json'), JSON.stringify(results, null, 2));
    await cleanup();
  }
}

main();
