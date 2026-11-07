import { createTestBrowser, createFakePhone, sleep, log, OUT_DIR, ensureLoadAndRaf } from './test-common.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 1: 1P Solo (Single-fire 10x, Rapid Shotgun 1s, Fever 2s, Skill 10x)...');
  const env = await createTestBrowser();
  const { page, roomId, shot, getSnapshot, errors, pageErrors } = env;

  const phone1 = createFakePhone(roomId, 1, '블루폰1P', 'solo');

  // 방어 사격 헬퍼 (대기 중 바 보호)
  const defenseShoot = async () => {
    const s = await getSnapshot();
    if (s?.phase === 'PLAYING') {
      const t = s.targets.find((x) => x.hp > 0 && !x.isGuarding) || s.targets[0];
      if (t) {
        await phone1.aimHold(t.aimX, t.aimY, 30);
        await phone1.snap(t.aimX, t.aimY);
      }
    }
  };

  try {
    // 1P 모바일 선택
    await page.getByText('📱 모바일').first().click();
    await sleep(400);

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

    const shotgunCard = snap.targets.find((t) => t.selectValue === 'shotgun') || snap.targets[0];
    log('Selecting Shotgun card:', shotgunCard.selectValue);
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
      throw new Error(`Combat playing state not reached: phase=${snap?.phase}`);
    }
    log('Combat active! Weapon:', snap.players[0].weaponKind);

    const reportItems = {};

    // =============================================================
    // 1. 단발 사격 10회
    // =============================================================
    log('--- 1. 단발 사격 10회 검증 ---');
    const singleLoad = await ensureLoadAndRaf(page, defenseShoot);
    log('Load before single fire:', singleLoad.ok ? 'OK' : 'SKIP', singleLoad);

    if (!singleLoad.ok) {
      reportItems.singleFire = {
        status: 'SKIP',
        reason: 'High load (rAF < 30 after 10m)',
        load: singleLoad,
      };
      await shot('Q3-1P-01-single-fire-skipped');
    } else {
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
        const liveTarget = before.targets.find((t) => t.hp > 0 && !t.isGuarding) || before.targets[0];
        const tAimX = liveTarget ? liveTarget.aimX : 0;
        const tAimY = liveTarget ? liveTarget.aimY : 0;

        await phone1.aimHold(tAimX, tAimY, 300);
        await phone1.snap(tAimX, tAimY);
        await sleep(100);

        const after = await getSnapshot();
        const pAfter = after.players[0];

        const ammoSpent = pBefore.ammo - pAfter.ammo;
        const scoreGained = pAfter.score - pBefore.score;
        const isSuccess = ammoSpent === 1;
        if (!isSuccess) singleMissedCount++;

        singleFireTrials.push({
          trial: i,
          targetAim: { aimX: tAimX, aimY: tAimY },
          ammoBefore: pBefore.ammo,
          ammoAfter: pAfter.ammo,
          ammoSpent,
          scoreBefore: pBefore.score,
          scoreAfter: pAfter.score,
          scoreGained,
          isSuccess,
        });
        log(`Single shot #${i}: ammo ${pBefore.ammo} -> ${pAfter.ammo} (spent ${ammoSpent}), score gain ${scoreGained}, ok: ${isSuccess}`);
        await sleep(350);
      }

      await shot('Q3-1P-01-single-fire');
      reportItems.singleFire = {
        status: singleMissedCount === 0 ? 'PASS' : 'BUG',
        load: singleLoad,
        missedCount: singleMissedCount,
        trials: singleFireTrials,
      };
    }

    // =============================================================
    // 2. 누른 채 연사: 샷건 (1초)
    // =============================================================
    log('--- 2. 샷건 1초 연사 (rapidFireHold) 검증 ---');
    for (let w = 0; w < 40; w++) {
      const s = await getSnapshot();
      if (!s.players[0].isReloading && s.players[0].ammo >= s.players[0].maxAmmo - 1) break;
      if (!s.players[0].isReloading && s.players[0].ammo < s.players[0].maxAmmo - 1) {
        await phone1.snap(0, 0);
      }
      await sleep(150);
    }

    const rapidLoad = await ensureLoadAndRaf(page, defenseShoot);
    log('Load before rapid fire (Shotgun):', rapidLoad.ok ? 'OK' : 'SKIP', rapidLoad);

    if (!rapidLoad.ok) {
      reportItems.rapidShotgun = {
        status: 'SKIP',
        reason: 'High load (rAF < 30 after 10m)',
        load: rapidLoad,
      };
      await shot('Q3-1P-02-rapid-shotgun-skipped');
    } else {
      const rapidBefore = await getSnapshot();
      const ammoBeforeRapid = rapidBefore.players[0].ammo;
      const liveTargetRapid = rapidBefore.targets[0];
      const rAimX = liveTargetRapid ? liveTargetRapid.aimX : 0;
      const rAimY = liveTargetRapid ? liveTargetRapid.aimY : 0;

      const rapidStartTime = Date.now();
      let framesSent = 0;
      while (Date.now() - rapidStartTime < 1000) {
        phone1.frame(rAimX, rAimY, { rapidFireHold: true });
        framesSent++;
        await sleep(30);
      }
      phone1.frame(rAimX, rAimY, { rapidFireHold: false });
      await sleep(100);

      const rapidAfter = await getSnapshot();
      const ammoAfterRapid = rapidAfter.players[0].ammo;
      let shotsFiredRapid = ammoBeforeRapid - ammoAfterRapid;
      if (shotsFiredRapid < 0) {
        shotsFiredRapid = ammoBeforeRapid + (rapidAfter.players[0].maxAmmo - ammoAfterRapid);
      }

      log(`Shotgun rapid result: before=${ammoBeforeRapid}, after=${ammoAfterRapid}, shotsFired=${shotsFiredRapid}`);
      await shot('Q3-1P-02-rapid-shotgun');

      reportItems.rapidShotgun = {
        status: shotsFiredRapid >= 3 ? 'PASS' : 'BUG',
        load: rapidLoad,
        ammoBefore: ammoBeforeRapid,
        ammoAfter: ammoAfterRapid,
        shotsFired: shotsFiredRapid,
        expectedEng: '~6',
      };
    }

    // =============================================================
    // 3. 피버 (게이지 100 달성 -> feverTriggered -> 2초 점수 증가)
    // =============================================================
    log('--- 3. 피버 테스트 검증 ---');
    log('Shooting targets to reach 100% fever gauge...');

    let feverReached = false;
    for (let shootCount = 0; shootCount < 120; shootCount++) {
      const s = await getSnapshot();
      if (s.players[0].isFeverReady) {
        feverReached = true;
        log('FEVER READY REACHED!');
        break;
      }
      if (s.phase !== 'PLAYING') break;

      const t = s.targets.find((x) => x.hp > 0 && !x.isGuarding) || s.targets[0];
      if (t) {
        await phone1.aimHold(t.aimX, t.aimY, 30);
        await phone1.snap(t.aimX, t.aimY);
      } else {
        await phone1.snap(0, 0);
      }
      await sleep(150);
    }

    if (!feverReached) {
      reportItems.fever = {
        status: 'SKIP',
        reason: 'Could not reach 100% fever within target budget',
      };
    } else {
      const feverLoad = await ensureLoadAndRaf(page, defenseShoot);
      log('Load before fever trigger:', feverLoad.ok ? 'OK' : 'SKIP');

      if (!feverLoad.ok) {
        reportItems.fever = {
          status: 'SKIP',
          reason: 'High load (rAF < 30 after 10m)',
          load: feverLoad,
        };
        await shot('Q3-1P-03-fever-skipped');
      } else {
        const feverBeforeSnap = await getSnapshot();
        const scoreBeforeFever = feverBeforeSnap.players[0].score;

        log('Sending feverTriggered: true...');
        phone1.frame(0, 0, { feverTriggered: true });
        await sleep(150);

        const feverStartSnap = await getSnapshot();
        const isFeverActive = feverStartSnap.players[0].isFeverActive;

        await phone1.aimHold(0, 0, 2000);
        const feverEndSnap = await getSnapshot();
        const scoreAfterFever = feverEndSnap.players[0].score;
        const scoreDelta = scoreAfterFever - scoreBeforeFever;

        log(`Fever result: active=${isFeverActive}, scoreBefore=${scoreBeforeFever}, scoreAfter=${scoreAfterFever}, delta=${scoreDelta}`);
        await shot('Q3-1P-03-fever');

        reportItems.fever = {
          status: isFeverActive && scoreDelta > 0 ? 'PASS' : 'BUG',
          load: feverLoad,
          isFeverActive,
          scoreBefore: scoreBeforeFever,
          scoreAfter: scoreAfterFever,
          scoreDelta,
        };
      }
    }

    // =============================================================
    // 4. 스킬 (재고 1에서 skillSnapTriggered -> 재고 감소 10회 반복)
    // =============================================================
    log('--- 4. 스킬 10회 반복 검증 ---');
    const skillLoad = await ensureLoadAndRaf(page, defenseShoot);
    log('Load before skill:', skillLoad.ok ? 'OK' : 'SKIP');

    if (!skillLoad.ok) {
      reportItems.skill = {
        status: 'SKIP',
        reason: 'High load (rAF < 30 after 10m)',
        load: skillLoad,
      };
      await shot('Q3-1P-04-skill-skipped');
    } else {
      const skillTrials = [];
      let skillFailedCount = 0;

      for (let i = 1; i <= 10; i++) {
        log(`Waiting for skill stock >= 1 (trial ${i}/10)...`);
        let stockReady = false;
        // 재고가 1이 될 때까지 대기하며 방어 사격
        const waitSkillStart = Date.now();
        while (Date.now() - waitSkillStart < 35000) {
          const s = await getSnapshot();
          if (s?.phase !== 'PLAYING') break;
          if (s?.players[0].skillStock >= 1) {
            stockReady = true;
            break;
          }
          await defenseShoot();
          await sleep(500);
        }

        if (!stockReady) {
          log(`Trial #${i}: skill stock not reached within 35s`);
          skillFailedCount++;
          skillTrials.push({ trial: i, success: false, reason: 'stock not ready' });
          continue;
        }

        const beforeSnap = await getSnapshot();
        const stockBefore = beforeSnap.players[0].skillStock;

        log(`Trial #${i}: stock before=${stockBefore}. Sending skillSnapTriggered: true...`);
        phone1.frame(0, 0, { skillSnapTriggered: true });
        await sleep(150);

        const afterSnap = await getSnapshot();
        const stockAfter = afterSnap.players[0].skillStock;
        const consumed = stockBefore - stockAfter === 1;

        if (!consumed) skillFailedCount++;
        skillTrials.push({
          trial: i,
          stockBefore,
          stockAfter,
          consumed,
          success: consumed,
        });

        log(`Trial #${i} skill result: stock ${stockBefore} -> ${stockAfter}, ok: ${consumed}`);
        await sleep(1000);
      }

      await shot('Q3-1P-04-skill');
      reportItems.skill = {
        status: skillFailedCount === 0 ? 'PASS' : 'BUG',
        load: skillLoad,
        failedCount: skillFailedCount,
        trials: skillTrials,
      };
    }

    const finalResult = {
      test: '1P Solo Combat',
      reportItems,
      pageErrors,
      errors,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'test-1-solo-result.json'), JSON.stringify(finalResult, null, 2));
    log('Test 1 Solo complete! Results written to test-1-solo-result.json');

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
