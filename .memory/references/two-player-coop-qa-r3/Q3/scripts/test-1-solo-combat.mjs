import { createTestBrowser, createFakePhone, sleep, log, OUT_DIR, ensureLoadAndRaf } from './test-common.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 1: 1P Solo Combat (Single-fire 10x, Rapid Shotgun 1s, Fever 2s)...');
  const env = await createTestBrowser();
  const { page, roomId, shot, getSnapshot, errors, pageErrors } = env;

  try {
    // 1P 모바일 선택
    await page.getByText('📱 모바일').first().click();
    await sleep(400);

    const phone1 = createFakePhone(roomId, 1, '블루폰1P', 'solo');
    await phone1.join();
    await sleep(400);
    await phone1.zero();
    await sleep(500);

    // 로비 가운데 사격으로 시작
    log('Shooting center to start...');
    await phone1.aimHold(0, 0, 300);
    await phone1.snap(0, 0);

    // 카운트다운 3.5초 대기
    await phone1.aimHold(0, 0, 3500);
    await sleep(1000);

    // 무기 선택 대기
    let snap = null;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon') break;
      await sleep(100);
    }

    if (snap?.selection?.kind !== 'weapon') {
      throw new Error(`Weapon selection phase not reached: ${JSON.stringify(snap?.selection)}`);
    }

    log('Weapon selection targets:', snap.targets.map((t) => `${t.selectValue}@(${t.aimX},${t.aimY})`));
    const shotgunCard = snap.targets.find((t) => t.selectValue === 'shotgun') || snap.targets[0];
    log('Selecting Shotgun card:', shotgunCard);

    await phone1.aimHold(shotgunCard.aimX, shotgunCard.aimY, 300);
    await phone1.snap(shotgunCard.aimX, shotgunCard.aimY);
    await sleep(500);

    // 전투 진입 대기
    for (let i = 0; i < 60; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
      await sleep(100);
    }
    if (snap?.phase !== 'PLAYING' || snap?.selection?.kind !== null) {
      throw new Error(`Combat playing state not reached: phase=${snap?.phase}, selection=${JSON.stringify(snap?.selection)}`);
    }
    log('Combat active! Weapon:', snap.players[0].weaponKind, 'Level:', snap.players[0].weaponLevel);

    // -------------------------------------------------------------
    // 1. 단발 테스트 (10회)
    // -------------------------------------------------------------
    log('--- 1. 단발 사격 10회 테스트 시작 ---');
    const singleLoad = await ensureLoadAndRaf(page);
    log('Load before single fire:', singleLoad);

    const singleFireTrials = [];
    let singleMissedCount = 0;

    for (let i = 1; i <= 10; i++) {
      // 재장전 중이면 대기
      for (let w = 0; w < 30; w++) {
        const s = await getSnapshot();
        if (!s.players[0].isReloading && s.players[0].ammo > 0) break;
        await sleep(150);
      }

      const before = await getSnapshot();
      const pBefore = before.players[0];

      // 활성 표적 확인
      const liveTarget = before.targets.find((t) => t.hp > 0 && !t.isGuarding) || before.targets[0];
      const targetAimX = liveTarget ? liveTarget.aimX : 0;
      const targetAimY = liveTarget ? liveTarget.aimY : 0;

      // 표적 조준 300ms 유지
      await phone1.aimHold(targetAimX, targetAimY, 300);
      // snapFire 전송
      await phone1.snap(targetAimX, targetAimY);
      await sleep(100);

      const after = await getSnapshot();
      const pAfter = after.players[0];

      const ammoSpent = pBefore.ammo - pAfter.ammo;
      const scoreGained = pAfter.score - pBefore.score;
      const isSuccess = ammoSpent === 1;

      if (!isSuccess) singleMissedCount++;

      singleFireTrials.push({
        trial: i,
        targetAim: { aimX: targetAimX, aimY: targetAimY },
        ammoBefore: pBefore.ammo,
        ammoAfter: pAfter.ammo,
        ammoSpent,
        scoreBefore: pBefore.score,
        scoreAfter: pAfter.score,
        scoreGained,
        isSuccess,
      });

      log(`Single shot #${i}: ammo ${pBefore.ammo} -> ${pAfter.ammo} (spent ${ammoSpent}), score gain ${scoreGained}, ok: ${isSuccess}`);
      await sleep(400); // 총기 쿨다운 대기
    }

    await shot('Q3-1P-01-single-fire');

    // -------------------------------------------------------------
    // 2. 누른 채 연사: 샷건 (1초)
    // -------------------------------------------------------------
    log('--- 2. 샷건 1초 연사 (rapidFireHold) 테스트 시작 ---');
    // 탄약 재장전 완료 대기
    for (let w = 0; w < 40; w++) {
      const s = await getSnapshot();
      if (!s.players[0].isReloading && s.players[0].ammo >= s.players[0].maxAmmo - 1) break;
      // 탄약이 애매하면 비워서 재장전 유도
      if (!s.players[0].isReloading && s.players[0].ammo < s.players[0].maxAmmo - 1) {
        await phone1.snap(0, 0);
      }
      await sleep(150);
    }

    const rapidLoad = await ensureLoadAndRaf(page);
    log('Load before rapid fire (Shotgun):', rapidLoad);

    const rapidBefore = await getSnapshot();
    const ammoBeforeRapid = rapidBefore.players[0].ammo;

    const liveTargetRapid = rapidBefore.targets[0];
    const rAimX = liveTargetRapid ? liveTargetRapid.aimX : 0;
    const rAimY = liveTargetRapid ? liveTargetRapid.aimY : 0;

    log(`Shotgun ammo before rapid hold: ${ammoBeforeRapid}, aiming at (${rAimX}, ${rAimY})`);

    const rapidStartTime = Date.now();
    let framesSent = 0;
    while (Date.now() - rapidStartTime < 1000) {
      phone1.frame(rAimX, rAimY, { rapidFireHold: true });
      framesSent++;
      await sleep(30);
    }
    // Release hold
    phone1.frame(rAimX, rAimY, { rapidFireHold: false });
    await sleep(100);

    const rapidAfter = await getSnapshot();
    const ammoAfterRapid = rapidAfter.players[0].ammo;
    // 샷건은 탄창이 작아서 연사 도중 재장전(isReloading)이 걸릴 수 있음
    let shotsFiredRapid = ammoBeforeRapid - ammoAfterRapid;
    if (shotsFiredRapid < 0) {
      // 재장전이 일어난 경우
      shotsFiredRapid = ammoBeforeRapid + (rapidAfter.players[0].maxAmmo - ammoAfterRapid);
    }

    log(`Shotgun rapid fire result: before=${ammoBeforeRapid}, after=${ammoAfterRapid}, shotsFired=${shotsFiredRapid}, framesSent=${framesSent}`);
    await shot('Q3-1P-02-rapid-shotgun');

    // -------------------------------------------------------------
    // 3. 피버 테스트 (게이지 100 달성 -> feverTriggered -> 2초 점수 증가)
    // -------------------------------------------------------------
    log('--- 3. 피버 테스트 시작 (게이지 100 충전 및 발동) ---');
    log('Shooting targets to reach 100% fever gauge...');

    let feverReached = false;
    for (let shootCount = 0; shootCount < 100; shootCount++) {
      const s = await getSnapshot();
      if (s.players[0].isFeverReady) {
        feverReached = true;
        log('FEVER READY REACHED! (isFeverReady: true)');
        break;
      }
      if (s.phase !== 'PLAYING') {
        log('Phase changed during fever charging:', s.phase);
        break;
      }

      // 조준 및 사격
      const t = s.targets.find((x) => x.hp > 0 && !x.isGuarding) || s.targets[0];
      if (t) {
        await phone1.aimHold(t.aimX, t.aimY, 50);
        await phone1.snap(t.aimX, t.aimY);
      } else {
        await phone1.snap(0, 0);
      }
      await sleep(150);
    }

    let feverResult = null;
    if (feverReached) {
      const feverLoad = await ensureLoadAndRaf(page);
      log('Load before fever trigger:', feverLoad);

      const feverBeforeSnap = await getSnapshot();
      const scoreBeforeFever = feverBeforeSnap.players[0].score;

      log('Sending feverTriggered: true...');
      phone1.frame(0, 0, { feverTriggered: true });
      await sleep(150);

      const feverStartSnap = await getSnapshot();
      const isFeverActive = feverStartSnap.players[0].isFeverActive;
      log('Fever active status immediately after trigger:', isFeverActive);

      // 2초 동안 점수 모니터링
      await phone1.aimHold(0, 0, 2000);
      const feverEndSnap = await getSnapshot();
      const scoreAfterFever = feverEndSnap.players[0].score;
      const scoreDelta = scoreAfterFever - scoreBeforeFever;

      log(`Fever 2s result: isFeverActive=${isFeverActive}, scoreBefore=${scoreBeforeFever}, scoreAfter=${scoreAfterFever}, delta=${scoreDelta}`);
      await shot('Q3-1P-03-fever');

      feverResult = {
        load: feverLoad,
        feverReached: true,
        isFeverActive,
        scoreBefore: scoreBeforeFever,
        scoreAfter: scoreAfterFever,
        scoreDelta,
        pass: isFeverActive && scoreDelta > 0,
      };
    } else {
      log('Warning: Fever ready not reached within budget');
      feverResult = { feverReached: false, pass: false };
    }

    const test1Summary = {
      singleFire: {
        load: singleLoad,
        totalTrials: 10,
        missedCount: singleMissedCount,
        pass: singleMissedCount === 0,
        trials: singleFireTrials,
      },
      rapidShotgun: {
        load: rapidLoad,
        ammoBefore: ammoBeforeRapid,
        ammoAfter: ammoAfterRapid,
        shotsFired: shotsFiredRapid,
        expectedEng: '~6',
        pass: shotsFiredRapid >= 3, // 엔진 기준 약 6발, 3발 이상 감축이면 통과
      },
      fever: feverResult,
      pageErrors,
      errors,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'test-1-solo-combat-result.json'), JSON.stringify(test1Summary, null, 2));
    log('Test 1 finished successfully! Summary:', JSON.stringify({
      singleMissed: singleMissedCount,
      rapidShotgunShots: shotsFiredRapid,
      feverPass: feverResult?.pass,
    }));

    phone1.close();
  } finally {
    await env.ctx.close();
    await env.browser.close();
  }
}

run().catch((e) => {
  console.error('Test 1 failed:', e);
  process.exit(1);
});
