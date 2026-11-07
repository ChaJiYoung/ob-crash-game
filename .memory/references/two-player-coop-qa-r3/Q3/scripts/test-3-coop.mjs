import { createTestBrowser, createFakePhone, sleep, log, OUT_DIR, ensureLoadAndRaf } from './test-common.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 3: 2P Coop (Single-fire 10x, Rapid Shotgun 1s, Fever 2s, Skill 10x)...');
  const env = await createTestBrowser();
  const { page, roomId, shot, getSnapshot, errors, pageErrors } = env;

  const phone1 = createFakePhone(roomId, 1, '블루폰1P', 'coop1');
  const phone2 = createFakePhone(roomId, 2, '오렌지폰2P', 'coop2');

  const defenseShoot = async () => {
    const s = await getSnapshot();
    if (!s) return;
    if (s.selection?.kind === 'card') {
      const p1Card = s.targets.find((t) => t.selectKind === 'card' && (t.ownerIndex === 0 || t.aimX < 0)) || s.targets[0];
      const p2Card = s.targets.find((t) => t.selectKind === 'card' && (t.ownerIndex === 1 || t.aimX > 0)) || s.targets[1] || s.targets[0];
      if (p1Card) {
        await phone1.aimHold(p1Card.aimX, p1Card.aimY, 80);
        await phone1.snap(p1Card.aimX, p1Card.aimY);
      }
      if (p2Card) {
        await phone2.aimHold(p2Card.aimX, p2Card.aimY, 80);
        await phone2.snap(p2Card.aimX, p2Card.aimY);
      }
      return;
    }
    if (s.phase === 'PLAYING') {
      let pool = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isGuarding && t.landed && t.hp > 0);
      if (pool.length === 0) {
        pool = s.targets.filter((t) => !t.isItem && !t.selectKind && !t.isGuarding && t.hp > 0);
      }
      pool.sort((a, b) => (a.radiusM ?? 10) - (b.radiusM ?? 10));
      const target = pool[0];
      if (target) {
        await phone1.aimHold(target.aimX, target.aimY, 30);
        await phone1.snap(target.aimX, target.aimY);
        await phone2.aimHold(target.aimX, target.aimY, 30);
        await phone2.snap(target.aimX, target.aimY);
      }
    }
  };

  try {
    // 1P, 2P 모바일 선택
    await page.getByText('📱 모바일').first().click();
    await sleep(400);
    await page.getByText('📱 모바일').nth(1).click();
    await sleep(500);

    await phone1.join();
    await phone2.join();
    await sleep(400);

    await phone1.zero();
    await phone2.zero();
    await sleep(600);

    // 두 슬롯 모두 준비 완료가 될 때까지 확인
    log('Waiting for both slots to be READY...');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      const readyMatches = text.match(/준비 완료/g) || [];
      return readyMatches.length >= 2;
    }, null, { timeout: 10000 });
    log('Both slots are READY (2P coop confirmed)!');

    // 로비 가운데 사격
    log('Shooting center to start coop...');
    await phone1.aimHold(0, 0, 300);
    await phone1.snap(0, 0);

    // 카운트다운 3.5초 대기 (둘 다 중앙 0, 0 조준하여 autoZero가 0,0 유지되도록 함)
    await Promise.all([phone1.aimHold(0, 0, 3500), phone2.aimHold(0, 0, 3500)]);
    await sleep(1000);

    // 무기 선택 대기
    let snap = null;
    for (let i = 0; i < 80; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon' && snap?.targets?.some((t) => t.selectKind === 'weapon')) break;
      await sleep(150);
    }

    if (snap?.selection?.kind !== 'weapon') {
      throw new Error(`Coop weapon selection not reached: ${JSON.stringify(snap?.selection)}`);
    }

    // 1P 카드(왼쪽: 개틀링 우선), 2P 카드(오른쪽: 샷건) 선택 루프 (확실히 양쪽 모두 선택될 때까지 반복 사격)
    for (let attempt = 0; attempt < 30; attempt++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) {
        log('Weapon selection complete! Both players selected.');
        break;
      }
      const p1Cards = snap?.targets?.filter((t) => t.selectKind === 'weapon' && (t.ownerIndex === 0 || t.aimX < 0)) || [];
      const p1Card = p1Cards.find((t) => t.selectValue === 'gatling') || p1Cards[0];
      const p2Cards = snap?.targets?.filter((t) => t.selectKind === 'weapon' && (t.ownerIndex === 1 || t.aimX > 0)) || [];
      const p2ShotgunCard = p2Cards.find((t) => t.selectValue === 'shotgun') || p2Cards[0];

      if (p1Card) {
        log(`1P shooting weapon card: ${p1Card.selectValue} at (${p1Card.aimX}, ${p1Card.aimY})`);
        await phone1.aimHold(p1Card.aimX, p1Card.aimY, 150);
        await phone1.snap(p1Card.aimX, p1Card.aimY);
      }
      await sleep(150);
      if (p2ShotgunCard) {
        log(`2P shooting weapon card: ${p2ShotgunCard.selectValue} at (${p2ShotgunCard.aimX}, ${p2ShotgunCard.aimY})`);
        await phone2.aimHold(p2ShotgunCard.aimX, p2ShotgunCard.aimY, 150);
        await phone2.snap(p2ShotgunCard.aimX, p2ShotgunCard.aimY);
      }
      await sleep(300);
    }

    snap = await getSnapshot();
    if (snap?.phase !== 'PLAYING' || snap?.selection?.kind !== null) {
      throw new Error(`Coop weapon selection failed to complete: phase=${snap?.phase}, selection=${JSON.stringify(snap?.selection)}`);
    }

    if (snap.players.length < 2) {
      throw new Error(`Expected 2 players for coop, got ${snap.players.length}`);
    }
    log('Coop combat active! 1P weapon:', snap.players[0].weaponKind, '2P weapon:', snap.players[1].weaponKind);

    const reportItems = {};

    // =============================================================
    // 1. 2P 단발 사격 10회
    // =============================================================
    log('--- 1. 2P 단발 사격 10회 검증 ---');
    const singleLoad = await ensureLoadAndRaf(page, defenseShoot);
    log('Load before 2P single fire:', singleLoad.ok ? 'OK' : 'SKIP', singleLoad);

    if (!singleLoad.ok) {
      reportItems.singleFire = {
        status: 'SKIP',
        reason: 'High load (rAF < 30 after 10m)',
        load: singleLoad,
      };
      await shot('Q3-2P-01-single-fire-skipped');
    } else {
      const singleFireTrials = [];
      let singleMissedCount = 0;

      for (let i = 1; i <= 10; i++) {
        for (let w = 0; w < 30; w++) {
          const s = await getSnapshot();
          if (!s.players[1].isReloading && s.players[1].ammo > 0) break;
          await sleep(150);
        }

        const before = await getSnapshot();
        const pBefore = before.players[1];
        const liveTarget = before.targets.find((t) => t.hp > 0 && !t.isGuarding) || before.targets[0];
        const tAimX = liveTarget ? liveTarget.aimX : 0.3;
        const tAimY = liveTarget ? liveTarget.aimY : 0;

        await phone2.aimHold(tAimX, tAimY, 300);
        await phone2.snap(tAimX, tAimY);
        await sleep(100);

        const after = await getSnapshot();
        const pAfter = after.players[1];

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
        log(`2P Single shot #${i}: ammo ${pBefore.ammo} -> ${pAfter.ammo} (spent ${ammoSpent}), score gain ${scoreGained}, ok: ${isSuccess}`);
        await sleep(350);
      }

      await shot('Q3-2P-01-single-fire');
      reportItems.singleFire = {
        status: singleMissedCount === 0 ? 'PASS' : 'BUG',
        load: singleLoad,
        missedCount: singleMissedCount,
        trials: singleFireTrials,
      };
    }

    // =============================================================
    // 2. 2P 누른 채 연사: 샷건 (1초)
    // =============================================================
    log('--- 2. 2P 샷건 1초 연사 (rapidFireHold) 검증 ---');
    for (let w = 0; w < 40; w++) {
      const s = await getSnapshot();
      if (!s.players[1].isReloading && s.players[1].ammo >= s.players[1].maxAmmo - 1) break;
      if (!s.players[1].isReloading && s.players[1].ammo < s.players[1].maxAmmo - 1) {
        await phone2.snap(0.3, 0);
      }
      await sleep(150);
    }

    const rapidLoad = await ensureLoadAndRaf(page, defenseShoot);
    log('Load before 2P rapid fire (Shotgun):', rapidLoad.ok ? 'OK' : 'SKIP', rapidLoad);

    if (!rapidLoad.ok) {
      reportItems.rapidShotgun = {
        status: 'SKIP',
        reason: 'High load (rAF < 30 after 10m)',
        load: rapidLoad,
      };
      await shot('Q3-2P-02-rapid-shotgun-skipped');
    } else {
      const rapidBefore = await getSnapshot();
      const ammoBeforeRapid = rapidBefore.players[1].ammo;
      const liveTargetRapid = rapidBefore.targets[0];
      const rAimX = liveTargetRapid ? liveTargetRapid.aimX : 0.3;
      const rAimY = liveTargetRapid ? liveTargetRapid.aimY : 0;

      const rapidStartTime = Date.now();
      let framesSent = 0;
      while (Date.now() - rapidStartTime < 1000) {
        phone2.frame(rAimX, rAimY, { rapidFireHold: true });
        framesSent++;
        await sleep(30);
      }
      phone2.frame(rAimX, rAimY, { rapidFireHold: false });
      await sleep(100);

      const rapidAfter = await getSnapshot();
      const ammoAfterRapid = rapidAfter.players[1].ammo;
      let shotsFiredRapid = ammoBeforeRapid - ammoAfterRapid;
      if (shotsFiredRapid < 0) {
        shotsFiredRapid = ammoBeforeRapid + (rapidAfter.players[1].maxAmmo - ammoAfterRapid);
      }

      log(`2P Shotgun rapid result: before=${ammoBeforeRapid}, after=${ammoAfterRapid}, shotsFired=${shotsFiredRapid}`);
      await shot('Q3-2P-02-rapid-shotgun');

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
    // 3. 2P 피버 (게이지 100 달성 -> feverTriggered -> 2초 점수 증가)
    // =============================================================
    log('--- 3. 2P 피버 테스트 검증 ---');
    log('Shooting targets with 2P to reach 100% fever gauge...');

    let feverReached = false;
    for (let shootCount = 0; shootCount < 140; shootCount++) {
      const s = await getSnapshot();
      if (s.players[1].isFeverReady) {
        feverReached = true;
        log('2P FEVER READY REACHED!');
        break;
      }
      if (s.phase !== 'PLAYING') break;

      const t = s.targets.find((x) => x.hp > 0 && !x.isGuarding) || s.targets[0];
      if (t) {
        await phone2.aimHold(t.aimX, t.aimY, 30);
        await phone2.snap(t.aimX, t.aimY);
      } else {
        await phone2.snap(0.3, 0);
      }
      await sleep(150);
    }

    if (!feverReached) {
      reportItems.fever = {
        status: 'SKIP',
        reason: 'Could not reach 100% fever for 2P within budget',
      };
    } else {
      const feverLoad = await ensureLoadAndRaf(page, defenseShoot);
      log('Load before 2P fever trigger:', feverLoad.ok ? 'OK' : 'SKIP');

      if (!feverLoad.ok) {
        reportItems.fever = {
          status: 'SKIP',
          reason: 'High load (rAF < 30 after 10m)',
          load: feverLoad,
        };
        await shot('Q3-2P-03-fever-skipped');
      } else {
        const feverBeforeSnap = await getSnapshot();
        const scoreBeforeFever = feverBeforeSnap.players[1].score;

        log('Sending 2P feverTriggered: true...');
        phone2.frame(0.3, 0, { feverTriggered: true });
        await sleep(150);
        phone2.frame(0.3, 0, { feverTriggered: false });

        const feverStartSnap = await getSnapshot();
        const isFeverActive = feverStartSnap.players[1].isFeverActive;

        // 2초 동안 타겟 사격하여 점수 증가 확인
        const feverEndWait = Date.now() + 2000;
        while (Date.now() < feverEndWait) {
          const s = await getSnapshot();
          const t = s.targets.find((x) => x.hp > 0 && !x.isGuarding) || s.targets[0];
          if (t) {
            await phone2.aimHold(t.aimX, t.aimY, 30);
            await phone2.snap(t.aimX, t.aimY);
          } else {
            await phone2.snap(0.3, 0);
          }
          await sleep(100);
        }

        const feverEndSnap = await getSnapshot();
        const scoreAfterFever = feverEndSnap.players[1].score;
        const scoreDelta = scoreAfterFever - scoreBeforeFever;

        log(`2P Fever result: active=${isFeverActive}, scoreBefore=${scoreBeforeFever}, scoreAfter=${scoreAfterFever}, delta=${scoreDelta}`);
        await shot('Q3-2P-03-fever');

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
    // 4. 2P 스킬 (재고 1에서 skillSnapTriggered -> 재고 감소 10회 반복)
    // =============================================================
    log('--- 4. 2P 스킬 10회 반복 검증 ---');
    const skillLoad = await ensureLoadAndRaf(page, defenseShoot);
    log('Load before 2P skill:', skillLoad.ok ? 'OK' : 'SKIP');

    if (!skillLoad.ok) {
      reportItems.skill = {
        status: 'SKIP',
        reason: 'High load (rAF < 30 after 10m)',
        load: skillLoad,
      };
      await shot('Q3-2P-04-skill-skipped');
    } else {
      const skillTrials = [];
      let skillFailedCount = 0;

      for (let i = 1; i <= 10; i++) {
        log(`Waiting for 2P skill stock >= 1 (trial ${i}/10)...`);
        let stockReady = false;
        const waitSkillStart = Date.now();
        while (Date.now() - waitSkillStart < 45000) {
          const s = await getSnapshot();
          if (s?.phase === 'GAMEOVER' || s?.phase === 'VICTORY') {
            log('2P Game ended with phase:', s?.phase);
            break;
          }
          if (s?.selection?.kind === 'card') {
            await defenseShoot();
            await sleep(100);
            continue;
          }
          if (s?.players[1].skillStock >= 1 && s?.selection?.kind === null) {
            stockReady = true;
            break;
          }
          await defenseShoot();
          await sleep(80);
        }

        if (!stockReady) {
          log(`2P Trial #${i}: skill stock not reached within 45s`);
          skillFailedCount++;
          skillTrials.push({ trial: i, success: false, reason: 'stock not ready' });
          continue;
        }

        const beforeSnap = await getSnapshot();
        const stockBefore = beforeSnap.players[1].skillStock;

        log(`2P Trial #${i}: stock before=${stockBefore}. Sending skillSnapTriggered: true...`);
        phone2.frame(0.3, 0, { skillSnapTriggered: true });
        await sleep(150);
        phone2.frame(0.3, 0, { skillSnapTriggered: false });
        await sleep(100);

        const afterSnap = await getSnapshot();
        const stockAfter = afterSnap.players[1].skillStock;
        const consumed = stockBefore - stockAfter === 1;

        if (!consumed) skillFailedCount++;
        skillTrials.push({
          trial: i,
          stockBefore,
          stockAfter,
          consumed,
          success: consumed,
        });

        log(`2P Trial #${i} skill result: stock ${stockBefore} -> ${stockAfter}, ok: ${consumed}`);
        await sleep(1000);
      }

      await shot('Q3-2P-04-skill');
      reportItems.skill = {
        status: skillFailedCount === 0 ? 'PASS' : 'BUG',
        load: skillLoad,
        failedCount: skillFailedCount,
        trials: skillTrials,
      };
    }

    const finalResult = {
      test: '2P Coop Combat',
      reportItems,
      pageErrors,
      errors,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'test-3-coop-result.json'), JSON.stringify(finalResult, null, 2));
    log('Test 3 Coop complete! Results written to test-3-coop-result.json');

    phone1.close();
    phone2.close();
  } finally {
    await env.ctx.close();
    await env.browser.close();
  }
}

run().catch((e) => {
  console.error('Test 3 failed:', e);
  process.exit(1);
});
