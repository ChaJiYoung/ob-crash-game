import { createTestEnv, sleep, log, OUT } from './helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  log('=== Q2 Items 3 & 4 Final Verification Starting ===');
  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup, errors, pageErrors } = env;

  const results = {
    testName: 'Q2-Items-3-4-Final',
    timestamp: new Date().toISOString(),
    item3: {},
    item4: {},
    errors: [],
  };

  try {
    // 1. 로비에서 폰 2대 연결
    log('1. Connecting 2 phones in lobby...');
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

    // 시작 사격
    log('Starting match 1...');
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
    log('Disconnecting 2P and continuing alone...');
    p2.close();
    const aloneBtn = page.getByText('혼자 계속하기');
    await aloneBtn.waitFor({ state: 'visible', timeout: 15000 });
    await aloneBtn.click();
    await sleep(1500);

    // 게임오버 대기
    log('Waiting for GAMEOVER (first match)...');
    while (true) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') break;
      await sleep(500);
    }
    await sleep(1200);
    log('Match 1 GAMEOVER reached!');

    // 결과 화면 캡처: 이탈자 칸 "나감" 배지 확인
    await shot('Q2-03-01-result-away-badge');
    const hasAwayBadge = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      return spans.some((s) => s.textContent && s.textContent.trim() === '나감');
    });
    log('Item 3: Result Screen hasAwayBadge:', hasAwayBadge);
    results.item3.hasAwayBadge = hasAwayBadge;

    // 1. 영점 리셋 전송
    await p1.zero(false);
    await sleep(400);

    // 2. 버튼 rect 확인
    const rects1 = await page.evaluate(() => {
      const r = document.querySelector('[data-shootable="restart"]')?.getBoundingClientRect();
      const l = document.querySelector('[data-shootable="lobby"]')?.getBoundingClientRect();
      return {
        r: r ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2 } : null,
        l: l ? { cx: l.left + l.width / 2, cy: l.top + l.height / 2 } : null,
        w: window.innerWidth,
        h: window.innerHeight,
      };
    });

    const rAimX = (rects1.r.cx / rects1.w) * 2 - 1;
    const rAimY = 1 - (rects1.r.cy / rects1.h) * 2;
    log('Aiming at restart button:', rAimX, rAimY);

    await p1.aimHold(rAimX, rAimY, 1000);
    const restartHoverText = await page.evaluate(() => document.querySelector('[data-shootable="restart"]')?.textContent);
    log('Restart button hover text:', restartHoverText);
    await shot('Q2-03-02-restart-hover-active');

    // "다시 도전하기" 사격!
    log('Shooting "다시 도전하기"...');
    await p1.snapFire(rAimX, rAimY);
    await sleep(1500);

    snap = await getSnapshot();
    log('Phase after restart:', snap?.phase, 'Players:', snap?.players?.length);
    await shot('Q2-03-03-restart-triggered');
    await shot('Q2-04-01-roster-maintained');

    results.item3.restartShotWorked = snap?.phase === 'PLAYING';
    results.item4.sameRosterMaintained = snap?.players?.length === 2;
    results.item4.playerCountAfterRestart = snap?.players?.length;

    // ==========================================
    // 3. 두 번째 판 -> 결과 화면에서 "로비로 이동" 사격
    // ==========================================
    log('Starting match 2 to reach result screen for lobby button...');
    if (snap?.selection?.kind === 'weapon') {
      const wt2 = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
      if (wt2[0]) await p1.snapFire(wt2[0].aimX, wt2[0].aimY);
    }

    log('Waiting for GAMEOVER (second match)...');
    while (true) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') break;
      await sleep(500);
    }
    await sleep(1200);
    log('Match 2 GAMEOVER reached!');

    // 영점 리셋 전송
    await p1.zero(false);
    await sleep(400);

    const rects2 = await page.evaluate(() => {
      const l = document.querySelector('[data-shootable="lobby"]')?.getBoundingClientRect();
      return {
        l: l ? { cx: l.left + l.width / 2, cy: l.top + l.height / 2 } : null,
        w: window.innerWidth,
        h: window.innerHeight,
      };
    });

    const lAimX = (rects2.l.cx / rects2.w) * 2 - 1;
    const lAimY = 1 - (rects2.l.cy / rects2.h) * 2;
    log('Aiming at lobby button:', lAimX, lAimY);

    await p1.aimHold(lAimX, lAimY, 1000);
    const lobbyHoverText = await page.evaluate(() => document.querySelector('[data-shootable="lobby"]')?.textContent);
    log('Lobby button hover text:', lobbyHoverText);
    await shot('Q2-03-04-lobby-hover-active');

    // "로비로 이동" 사격!
    log('Shooting "로비로 이동"...');
    await p1.snapFire(lAimX, lAimY);
    await sleep(1500);

    let lobbyReturned = false;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PAIRING') {
        lobbyReturned = true;
        break;
      }
      await sleep(250);
    }

    log('Returned to lobby? Phase:', snap?.phase);
    await shot('Q2-03-05-lobby-returned');
    await shot('Q2-04-02-lobby-phone-slot-kept');

    // 로비 슬롯 정보 확인
    const lobbySlotInfo = await page.evaluate(() => {
      return {
        bodyText: document.body.innerText.slice(0, 800),
      };
    });

    results.item3.lobbyShotWorked = snap?.phase === 'PAIRING';
    results.item4.lobbyPhase = snap?.phase;
    results.item4.phoneSlotKept = lobbySlotInfo.bodyText.includes('폰1P') || lobbySlotInfo.bodyText.includes('준비 완료');
    results.item4.lobbyBodySnippet = lobbySlotInfo.bodyText.slice(0, 400);

    p1.close();
  } catch (err) {
    log('ERROR in test:', err);
    results.errors.push(err.message);
  } finally {
    results.pageErrors = pageErrors;
    results.consoleErrors = errors;
    fs.writeFileSync(path.join(OUT, 'q2-items3-4-final-result.json'), JSON.stringify(results, null, 2));
    await cleanup();
  }
}

main();
