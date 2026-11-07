import { createTestEnv, sleep, log, OUT_DIR } from './test-helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 6: Immediate Phase & First Shot Weapon Selection...');
  const env = await createTestEnv();
  const { page, shot, fakePhone, getSnapshot, cleanup } = env;

  // 1P: Fake Phone pairing
  log('Pairing 1P Fake Phone...');
  const phone = fakePhone(1, '시작단발폰', 'phone_test6_r3');
  await phone.join(1);
  await sleep(400);
  await phone.zero(1);
  await sleep(500);

  // Initial state check
  let initialSnap = await getSnapshot();
  log('Lobby snap before start shoot:', initialSnap.phase);

  // Shoot center to start 3-second countdown
  log('Shooting center (0, 0) to trigger game start countdown...');
  await phone.aimHold(0, 0, 400);
  await phone.snap(0, 0);

  // Monitor countdown ending
  let countdownEndedSnap = null;
  const startShootTime = Date.now();
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    const s = await getSnapshot();
    if (s && s.selection && s.selection.kind === 'weapon') {
      countdownEndedSnap = s;
      log(`Countdown ended in ${Date.now() - startShootTime}ms. Phase at weapon select: ${s.phase}`);
      break;
    }
  }

  if (!countdownEndedSnap) {
    throw new Error('Weapon select not reached after 8s from countdown trigger!');
  }

  await shot('Q1-06-countdown-end-playing-phase');

  const phaseIsPlaying = countdownEndedSnap.phase === 'PLAYING';
  log(`Verification: snapshot().phase === 'PLAYING': ${phaseIsPlaying} (actual: ${countdownEndedSnap.phase})`);

  // Target the first weapon card
  const targets = countdownEndedSnap.targets.filter((t) => t.selectKind === 'weapon');
  const targetCard = targets[1] || targets[0];
  log(`Aiming at target card (${targetCard.selectValue}) at (${targetCard.aimX.toFixed(3)}, ${targetCard.aimY.toFixed(3)})...`);

  // Move aim to card
  await phone.aimHold(targetCard.aimX, targetCard.aimY, 300);

  // Fire EXACTLY ONE single snap shot
  log('Firing SINGLE snap shot from phone...');
  await phone.snap(targetCard.aimX, targetCard.aimY);
  await sleep(400);

  // Check if weapon was selected immediately on that single shot
  const postShotSnap = await getSnapshot();
  log('Post-shot snap selection:', postShotSnap?.selection, 'player weapon:', postShotSnap?.players[0]?.weaponKind);

  const weaponSelected =
    (postShotSnap?.selection?.done && postShotSnap.selection.done[0] === true) ||
    postShotSnap?.players[0]?.weaponKind === targetCard.selectValue ||
    postShotSnap?.selection?.kind === null;

  await shot('Q1-06-phone-snap-weapon-selected');

  phone.close();
  await cleanup();

  const results = {
    countdownEndedPhase: countdownEndedSnap.phase,
    phaseIsPlaying,
    targetCard: {
      id: targetCard.id,
      kind: targetCard.selectValue,
      aimX: targetCard.aimX,
      aimY: targetCard.aimY,
    },
    singleShotSuccess: weaponSelected,
    selectedWeaponKind: postShotSnap?.players[0]?.weaponKind,
    pass: phaseIsPlaying && weaponSelected,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'test-6-result.json'), JSON.stringify(results, null, 2));
  log('Test 6 finished. Results:', JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('Test 6 error:', e);
  process.exit(1);
});
