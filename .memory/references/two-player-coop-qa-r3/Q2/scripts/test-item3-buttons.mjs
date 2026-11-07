import { createTestEnv, sleep, log, OUT } from './helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  log('=== Q2 Items 3 & 4: Result Screen Button Shoot Verification Starting ===');
  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup, errors, pageErrors } = env;

  const results = {
    testName: 'Q2-Items3-4-ResultButtons',
    timestamp: new Date().toISOString(),
    restartTest: {},
    lobbyTest: {},
    lobbySlotCheck: {},
    errors: [],
  };

  try {
    // 1. 로비에서 폰 2대 연결
    log('1. Connecting 2 phones in lobby...');
    const mobileBtns = page.getByText('📱 모바일');
    await mobileBtns.nth(0).click();
    await sleep(400);
    await mobileBtns.nth(1).click();
    await sleep(500);

    const p1 = fakePhone(1, '폰1P_버튼검증');
    const p2 = fakePhone(2, '폰2P_버튼검증');

    await p1.join();
    await p2.join();
    await sleep(400);
    await p1.zero();
    await p2.zero();
    await sleep(400);

    // 시작 사격
    log('Starting game...');
    await p1.aimHold(0, 0, 400);
    await p1.snapFire(0, 0);

    // 무기 선택 대기
    let snap = null;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon') break;
      await sleep(250);
    }

    // 1P, 2P 무기 카드 선택
    const wt = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
    const p1Card = wt.filter((t) => t.ownerIndex === 0 || t.aimX < 0)[0];
    const p2Card = wt.filter((t) => t.ownerIndex === 1 || t.aimX > 0)[0];

    await p1.aimHold(p1Card.aimX, p1Card.aimY, 300);
    await p1.snapFire(p1Card.aimX, p1Card.aimY);
    await p2.aimHold(p2Card.aimX, p2Card.aimY, 300);
    await p2.snapFire(p2Card.aimX, p2Card.aimY);

    // 전투 진입
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
      await sleep(250);
    }
    log('Combat entered.');

    // 2P 끊기 -> 혼자 계속하기
    log('Disconnecting 2P and continuing alone...');
    p2.close();
    const aloneBtn = page.getByText('혼자 계속하기');
    await aloneBtn.waitFor({ state: 'visible', timeout: 15000 });
    await aloneBtn.click();
    await sleep(1500);

    // 게임오버 유도 (사격하지 않고 대기)
    log('Waiting for GAMEOVER (first run)...');
    while (true) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') break;
      await sleep(500);
    }
    log('GAMEOVER reached!');
    await sleep(1200);

    // 결과 화면 캡처: 이탈자 "나감" 확인
    await shot('Q2-03-01-result-screen-away-badge');
    const awayBadgeFound = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      return spans.some((s) => s.textContent && s.textContent.trim() === '나감');
    });
    log('Away badge found on result screen:', awayBadgeFound);

    // ==========================================
    // "다시 도전하기" 버튼 사격 테스트
    // ==========================================
    log('Testing "다시 도전하기" (restart) shootable button...');
    const restartAim = await page.evaluate(() => {
      const btn = document.querySelector('[data-shootable="restart"]');
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return {
        screenX: cx,
        screenY: cy,
        aimX: (cx / window.innerWidth) * 2 - 1,
        aimY: 1 - (cy / window.innerHeight) * 2,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
      };
    });

    log('Restart button coordinates:', JSON.stringify(restartAim));

    // 버튼 조준 800ms 유지 (호버 상태 캡처)
    await p1.aimHold(restartAim.aimX, restartAim.aimY, 800);
    const restartBtnText = await page.evaluate(() => document.querySelector('[data-shootable="restart"]')?.textContent);
    log('Restart button text while hovering:', restartBtnText);
    await shot('Q2-03-02-aiming-restart-hover');

    // 사격 실행!
    log('P1 shooting Restart Button...');
    await p1.snapFire(restartAim.aimX, restartAim.aimY);
    await sleep(1500);

    // 재시작 확인 (PLAYING 단계 또는 무기 선택 화면 도달)
    let restarted = false;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING') {
        restarted = true;
        break;
      }
      await sleep(250);
    }

    log('Restart succeeded? Phase:', snap?.phase, 'Players:', snap?.players?.length);
    await shot('Q2-03-03-restarted-game-screen');
    await shot('Q2-04-01-same-roster-maintained');

    results.restartTest = {
      buttonAim: restartAim,
      hoverText: restartBtnText,
      restarted,
      phaseAfterRestart: snap?.phase,
      playerCount: snap?.players?.length,
      sameRoster: snap?.players?.length === 2,
    };

    // ==========================================
    // 두 번째 판 게임오버 -> "로비로 이동" 버튼 사격 테스트
    // ==========================================
    log('Inducing second GAMEOVER for Lobby Button test...');
    // 무기 선택 중이면 선택 넘어가기
    if (snap?.selection?.kind === 'weapon') {
      const wt2 = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
      const c = wt2[0];
      if (c) {
        await p1.aimHold(c.aimX, c.aimY, 200);
        await p1.snapFire(c.aimX, c.aimY);
      }
    }

    while (true) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') break;
      await sleep(500);
    }
    log('Second GAMEOVER reached!');
    await sleep(1200);

    const lobbyAim = await page.evaluate(() => {
      const btn = document.querySelector('[data-shootable="lobby"]');
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return {
        screenX: cx,
        screenY: cy,
        aimX: (cx / window.innerWidth) * 2 - 1,
        aimY: 1 - (cy / window.innerHeight) * 2,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
      };
    });

    log('Lobby button coordinates:', JSON.stringify(lobbyAim));

    // 버튼 조준 800ms 유지 (호버 상태 캡처)
    await p1.aimHold(lobbyAim.aimX, lobbyAim.aimY, 800);
    const lobbyBtnText = await page.evaluate(() => document.querySelector('[data-shootable="lobby"]')?.textContent);
    log('Lobby button text while hovering:', lobbyBtnText);
    await shot('Q2-03-04-aiming-lobby-hover');

    // 사격 실행!
    log('P1 shooting Lobby Button...');
    await p1.snapFire(lobbyAim.aimX, lobbyAim.aimY);
    await sleep(1500);

    // 로비 복귀 확인 (PAIRING)
    let lobbyReturned = false;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PAIRING') {
        lobbyReturned = true;
        break;
      }
      await sleep(250);
    }

    log('Lobby returned? Phase:', snap?.phase);
    await shot('Q2-03-05-returned-to-lobby');
    await shot('Q2-04-02-lobby-slots-kept');

    // 로비 슬롯 정보 확인
    const lobbySlotsInfo = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid^="slot-card-"]'));
      return {
        bodySnippet: document.body.innerText.slice(0, 600),
        cardCount: cards.length,
      };
    });

    results.lobbyTest = {
      buttonAim: lobbyAim,
      hoverText: lobbyBtnText,
      lobbyReturned,
      phaseAfterLobby: snap?.phase,
    };

    results.lobbySlotCheck = {
      bodySnippet: lobbySlotsInfo.bodySnippet,
      phoneSlotKept: lobbySlotsInfo.bodySnippet.includes('폰1P') || lobbySlotsInfo.bodySnippet.includes('준비 완료'),
    };

    p1.close();
  } catch (err) {
    log('ERROR in test:', err);
    results.errors.push(err.message);
  } finally {
    results.pageErrors = pageErrors;
    results.consoleErrors = errors;
    fs.writeFileSync(path.join(OUT, 'q2-item3-buttons-result.json'), JSON.stringify(results, null, 2));
    await cleanup();
  }
}

main();
