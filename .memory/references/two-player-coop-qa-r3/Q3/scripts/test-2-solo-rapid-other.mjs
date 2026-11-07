import { createTestBrowser, createFakePhone, sleep, log, OUT_DIR, ensureLoadAndRaf, shootToStart, connectAndZeroPhone } from './test-common.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function testWeaponRapid(weaponKind, expectedEng, shotName) {
  log(`--- Starting 1P Rapid Fire for ${weaponKind} ---`);
  const env = await createTestBrowser();
  const { page, roomId, shot, getSnapshot, errors, pageErrors } = env;

  const phone1 = createFakePhone(roomId, 1, '블루폰1P', `rapid_${weaponKind}`);

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

    const card = snap.targets.find((t) => t.selectValue === weaponKind) || snap.targets[0];
    log(`Selecting ${weaponKind} card:`, card.selectValue);
    await phone1.aimHold(card.aimX, card.aimY, 300);
    await phone1.snap(card.aimX, card.aimY);
    await sleep(500);

    for (let i = 0; i < 60; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
      await sleep(100);
    }
    log(`In combat with ${weaponKind}. Waiting for full ammo...`);

    for (let w = 0; w < 40; w++) {
      const s = await getSnapshot();
      if (!s.players[0].isReloading && s.players[0].ammo >= s.players[0].maxAmmo - 1) break;
      if (!s.players[0].isReloading && s.players[0].ammo < s.players[0].maxAmmo - 1) {
        await phone1.snap(0, 0);
      }
      await sleep(150);
    }

    const load = await ensureLoadAndRaf(page, defenseShoot);
    log(`Load before ${weaponKind} rapid:`, load.ok ? 'OK' : 'SKIP', load);

    if (!load.ok) {
      await shot(`${shotName}-skipped`);
      phone1.close();
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
    const ammoBefore = before.players[0].ammo;
    const target = before.targets[0];
    const aimX = target ? target.aimX : 0;
    const aimY = target ? target.aimY : 0;

    log(`${weaponKind} ammo before rapid: ${ammoBefore}`);
    const start = Date.now();
    let frames = 0;
    while (Date.now() - start < 1000) {
      phone1.frame(aimX, aimY, { rapidFireHold: true });
      frames++;
      await sleep(30);
    }
    phone1.frame(aimX, aimY, { rapidFireHold: false });
    await sleep(100);

    const after = await getSnapshot();
    const ammoAfter = after.players[0].ammo;
    let shotsFired = ammoBefore - ammoAfter;
    if (shotsFired < 0) {
      shotsFired = ammoBefore + (after.players[0].maxAmmo - ammoAfter);
    }

    log(`${weaponKind} rapid result: before=${ammoBefore}, after=${ammoAfter}, spent=${shotsFired}, frames=${frames}`);
    await shot(shotName);

    phone1.close();
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
    if (phone1) phone1.close();
    await env.ctx.close();
    await env.browser.close();
    throw e;
  }
}

async function run() {
  log('Starting Test 2: 1P Rapid Fire for Revolver & Gatling...');
  const results = {};

  results.revolver = await testWeaponRapid('revolver', '~7', 'Q3-1P-02-rapid-revolver');
  await sleep(2000);
  results.gatling = await testWeaponRapid('gatling', '~11', 'Q3-1P-02-rapid-gatling');

  fs.writeFileSync(path.join(OUT_DIR, 'test-2-solo-rapid-other-result.json'), JSON.stringify(results, null, 2));
  log('Test 2 completed! Results:', JSON.stringify({
    revolver: results.revolver.status,
    gatling: results.gatling.status,
  }));
}

run().catch((e) => {
  console.error('Test 2 failed:', e);
  process.exit(1);
});
