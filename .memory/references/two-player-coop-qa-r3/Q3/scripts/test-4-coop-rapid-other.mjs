import { createTestBrowser, createFakePhone, sleep, log, OUT_DIR, ensureLoadAndRaf } from './test-common.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function testCoopWeaponRapid(weaponKind, expectedEng, shotName) {
  log(`--- Starting 2P Coop Rapid Fire for ${weaponKind} ---`);
  const env = await createTestBrowser();
  const { page, roomId, shot, getSnapshot, errors, pageErrors } = env;

  let phone1 = null;
  let phone2 = null;

  const defenseShoot = async () => {
    const s = await getSnapshot();
    if (s?.phase === 'PLAYING') {
      const t = s.targets.find((x) => x.hp > 0 && !x.isGuarding) || s.targets[0];
      if (t && phone1) {
        await phone1.aimHold(t.aimX, t.aimY, 30);
        await phone1.snap(t.aimX, t.aimY);
      }
    }
  };

  try {
    await page.getByText('📱 모바일').first().click();
    await sleep(400);
    await page.getByText('📱 모바일').nth(1).click();
    await sleep(500);

    phone1 = createFakePhone(roomId, 1, '블루폰1P', `c1_${weaponKind}`);
    phone2 = createFakePhone(roomId, 2, '오렌지폰2P', `c2_${weaponKind}`);

    await phone1.join();
    await phone2.join();
    await sleep(400);

    await phone1.zero();
    await phone2.zero();
    await sleep(600);

    log('Waiting for both slots to be READY...');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      const readyMatches = text.match(/준비 완료/g) || [];
      return readyMatches.length >= 2;
    }, null, { timeout: 10000 });
    log('Both slots are READY (2P confirmed)!');

    await phone1.aimHold(0, 0, 300);
    await phone1.snap(0, 0);
    await Promise.all([phone1.aimHold(0, 0, 3500), phone2.aimHold(0, 0, 3500)]);
    await sleep(1000);

    let snap = null;
    for (let i = 0; i < 80; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon' && snap?.targets?.some((t) => t.selectKind === 'weapon')) break;
      await sleep(150);
    }

    if (snap?.selection?.kind !== 'weapon') {
      throw new Error(`Coop weapon selection not reached: ${JSON.stringify(snap?.selection)}`);
    }

    // 1P 카드(아무거나), 2P 카드(목표 무기) 선택 루프
    for (let attempt = 0; attempt < 30; attempt++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) {
        log(`Weapon selection complete for ${weaponKind}! Both players selected.`);
        break;
      }
      const p1Card = snap?.targets?.find((t) => t.selectKind === 'weapon' && (t.ownerIndex === 0 || t.aimX < 0));
      const p2Cards = snap?.targets?.filter((t) => t.selectKind === 'weapon' && (t.ownerIndex === 1 || t.aimX > 0)) || [];
      const p2TargetCard = p2Cards.find((t) => t.selectValue === weaponKind) || p2Cards[0];

      if (p1Card) {
        await phone1.aimHold(p1Card.aimX, p1Card.aimY, 150);
        await phone1.snap(p1Card.aimX, p1Card.aimY);
      }
      await sleep(150);
      if (p2TargetCard) {
        await phone2.aimHold(p2TargetCard.aimX, p2TargetCard.aimY, 150);
        await phone2.snap(p2TargetCard.aimX, p2TargetCard.aimY);
      }
      await sleep(300);
    }

    snap = await getSnapshot();
    if (snap?.phase !== 'PLAYING' || snap?.selection?.kind !== null) {
      throw new Error(`Coop weapon selection failed to complete for ${weaponKind}`);
    }
    log(`In combat. 2P weapon: ${snap.players[1].weaponKind}. Waiting for full ammo...`);

    for (let w = 0; w < 40; w++) {
      const s = await getSnapshot();
      if (!s.players[1].isReloading && s.players[1].ammo >= s.players[1].maxAmmo - 1) break;
      if (!s.players[1].isReloading && s.players[1].ammo < s.players[1].maxAmmo - 1) {
        await phone2.snap(0.3, 0);
      }
      await sleep(150);
    }

    const load = await ensureLoadAndRaf(page, defenseShoot);
    log(`Load before 2P ${weaponKind} rapid:`, load.ok ? 'OK' : 'SKIP', load);

    if (!load.ok) {
      await shot(`${shotName}-skipped`);
      phone1.close();
      phone2.close();
      await env.ctx.close();
      await env.browser.close();
      return {
        weaponKind,
        status: 'SKIP',
        reason: 'High load (rAF < 30 after 10m)',
        load,
        expectedEng,
        pageErrors,
        errors,
      };
    }

    const before = await getSnapshot();
    const ammoBefore = before.players[1].ammo;
    const target = before.targets[0];
    const aimX = target ? target.aimX : 0.3;
    const aimY = target ? target.aimY : 0;

    log(`2P ${weaponKind} ammo before rapid: ${ammoBefore}`);
    const start = Date.now();
    let frames = 0;
    while (Date.now() - start < 1000) {
      phone2.frame(aimX, aimY, { rapidFireHold: true });
      frames++;
      await sleep(30);
    }
    phone2.frame(aimX, aimY, { rapidFireHold: false });
    await sleep(100);

    const after = await getSnapshot();
    const ammoAfter = after.players[1].ammo;
    let shotsFired = ammoBefore - ammoAfter;
    if (shotsFired < 0) {
      shotsFired = ammoBefore + (after.players[1].maxAmmo - ammoAfter);
    }

    log(`2P ${weaponKind} rapid result: before=${ammoBefore}, after=${ammoAfter}, spent=${shotsFired}, frames=${frames}`);
    await shot(shotName);

    phone1?.close();
    phone2?.close();
    await env.ctx.close();
    await env.browser.close();

    return {
      weaponKind,
      status: shotsFired >= 3 ? 'PASS' : 'BUG',
      load,
      ammoBefore,
      ammoAfter,
      shotsFired,
      expectedEng,
      pageErrors,
      errors,
    };
  } catch (e) {
    phone1?.close();
    phone2?.close();
    await env.ctx.close();
    await env.browser.close();
    throw e;
  }
}

async function run() {
  log('Starting Test 4: 2P Coop Rapid Fire for Revolver & Gatling...');
  const results = {};

  results.revolver = await testCoopWeaponRapid('revolver', '~7', 'Q3-2P-02-rapid-revolver');
  await sleep(2000);
  results.gatling = await testCoopWeaponRapid('gatling', '~11', 'Q3-2P-02-rapid-gatling');

  fs.writeFileSync(path.join(OUT_DIR, 'test-4-coop-rapid-other-result.json'), JSON.stringify(results, null, 2));
  log('Test 4 completed! Results:', JSON.stringify({
    revolver: results.revolver.status,
    gatling: results.gatling.status,
  }));
}

run().catch((e) => {
  console.error('Test 4 failed:', e);
  process.exit(1);
});
