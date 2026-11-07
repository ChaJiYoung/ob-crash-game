import { createTestEnv, sleep, log, OUT } from './helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  log('=== Q2 Item 2: Weapon Select Disconnect Test Starting ===');
  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup, errors, pageErrors } = env;

  const results = {
    testName: 'Q2-Item2-WeaponSelectDisconnect',
    timestamp: new Date().toISOString(),
    observations: [],
    errors: [],
  };

  try {
    // 1. 로비에서 모바일 2개 선택
    log('Clicking 1P Mobile & 2P Mobile...');
    const mobileBtns = page.getByText('📱 모바일');
    await mobileBtns.nth(0).click();
    await sleep(400);
    await mobileBtns.nth(1).click();
    await sleep(500);

    const p1 = fakePhone(1, '폰1P');
    const p2 = fakePhone(2, '폰2P');

    await p1.join();
    await p2.join();
    await sleep(400);
    await p1.zero();
    await p2.zero();
    await sleep(400);

    await shot('Q2-02-01-lobby-paired');

    // 2. 사격하여 시작
    log('P1 shooting center to start...');
    await p1.aimHold(0, 0, 500);
    await p1.snapFire(0, 0);

    // 3. 무기 선택 화면 대기
    log('Waiting for weapon selection round...');
    let snap = null;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon') break;
      await sleep(250);
    }

    if (snap?.selection?.kind !== 'weapon') {
      throw new Error(`Failed to reach weapon selection. Current phase: ${snap?.phase}`);
    }

    log('Weapon selection reached! Selection:', JSON.stringify(snap.selection));
    await shot('Q2-02-02-weapon-select-active');

    const snapBeforeDC = await getSnapshot();
    const bodyBeforeDC = await page.evaluate(() => document.body.innerText);
    results.observations.push({
      step: 'before_disconnect',
      phase: snapBeforeDC.phase,
      selectionKind: snapBeforeDC.selection?.kind,
      isPaused: snapBeforeDC.isPaused,
      p2Away: snapBeforeDC.players[1]?.isAway,
      bodyTextSnippet: bodyBeforeDC.slice(0, 300),
    });

    // 4. 2P 폰 연결 종료 (Disconnect)
    log('Disconnecting 2P Phone during weapon select...');
    p2.close();
    await sleep(1000);

    const snapAfter1s = await getSnapshot();
    const bodyAfter1s = await page.evaluate(() => document.body.innerText);
    await shot('Q2-02-03-after-p2-dc-1s');

    results.observations.push({
      step: 'after_p2_dc_1s',
      phase: snapAfter1s.phase,
      selectionKind: snapAfter1s.selection?.kind,
      isPaused: snapAfter1s.isPaused,
      p2Away: snapAfter1s.players[1]?.isAway,
      bodyTextSnippet: bodyAfter1s.slice(0, 400),
      hasGraceText: /재접속 대기 중/.test(bodyAfter1s),
      hasAloneBtn: /혼자 계속하기/.test(bodyAfter1s),
    });

    log('Observation after 1s:', JSON.stringify(results.observations.at(-1)));

    // 3초 추가 대기 관찰
    await sleep(3000);
    const snapAfter4s = await getSnapshot();
    const bodyAfter4s = await page.evaluate(() => document.body.innerText);
    await shot('Q2-02-04-after-p2-dc-4s');

    results.observations.push({
      step: 'after_p2_dc_4s',
      phase: snapAfter4s.phase,
      selectionKind: snapAfter4s.selection?.kind,
      isPaused: snapAfter4s.isPaused,
      p2Away: snapAfter4s.players[1]?.isAway,
      bodyTextSnippet: bodyAfter4s.slice(0, 400),
      hasGraceText: /재접속 대기 중/.test(bodyAfter4s),
      hasAloneBtn: /혼자 계속하기/.test(bodyAfter4s),
    });

    // 만약 "혼자 계속하기" 버튼이 보인다면 클릭해본다
    const aloneBtn = page.getByText('혼자 계속하기');
    const aloneBtnCount = await aloneBtn.count();
    log(`Alone button count: ${aloneBtnCount}`);

    if (aloneBtnCount > 0) {
      log('Clicking "혼자 계속하기"...');
      await aloneBtn.first().click();
      await sleep(1500);

      const snapAfterAlone = await getSnapshot();
      const bodyAfterAlone = await page.evaluate(() => document.body.innerText);
      await shot('Q2-02-05-after-alone-clicked');

      results.observations.push({
        step: 'after_alone_clicked',
        phase: snapAfterAlone.phase,
        selectionKind: snapAfterAlone.selection?.kind,
        isPaused: snapAfterAlone.isPaused,
        p2Away: snapAfterAlone.players[1]?.isAway,
        p2SelectionDone: snapAfterAlone.selection?.done?.[1],
        p1SelectionDone: snapAfterAlone.selection?.done?.[0],
        bodyTextSnippet: bodyAfterAlone.slice(0, 400),
      });

      log('Observation after alone clicked:', JSON.stringify(results.observations.at(-1)));

      // 1P 카드 선택 시도
      const wt = (snapAfterAlone.targets || []).filter((t) => t.selectKind === 'weapon' && (t.ownerIndex === 0 || t.ownerIndex === null));
      log(`Remaining 1P weapon cards: ${wt.length}`);
      if (wt.length > 0) {
        const c = wt[0];
        log(`P1 selecting weapon card at (${c.aimX}, ${c.aimY})...`);
        await p1.aimHold(c.aimX, c.aimY, 300);
        await p1.snapFire(c.aimX, c.aimY);
        await sleep(1500);

        const snapAfterP1Pick = await getSnapshot();
        await shot('Q2-02-06-after-p1-card-picked');
        results.observations.push({
          step: 'after_p1_card_picked',
          phase: snapAfterP1Pick.phase,
          selectionKind: snapAfterP1Pick.selection?.kind,
          isPaused: snapAfterP1Pick.isPaused,
          p2Away: snapAfterP1Pick.players[1]?.isAway,
          p1Weapon: snapAfterP1Pick.players[0]?.weaponKind,
          p2Weapon: snapAfterP1Pick.players[1]?.weaponKind,
        });
        log('Observation after P1 picked:', JSON.stringify(results.observations.at(-1)));
      }
    }

    p1.close();
  } catch (err) {
    log('ERROR in test:', err);
    results.errors.push(err.message);
  } finally {
    results.pageErrors = pageErrors;
    results.consoleErrors = errors;
    fs.writeFileSync(path.join(OUT, 'q2-item2-result.json'), JSON.stringify(results, null, 2));
    await cleanup();
  }
}

main();
