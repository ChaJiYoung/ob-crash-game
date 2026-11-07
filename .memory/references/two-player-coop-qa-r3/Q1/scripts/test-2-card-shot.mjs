import { createTestEnv, sleep, log, OUT_DIR } from './test-helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 2: Card Shot (Opponent Card & Outside Radius)...');
  const results = {};

  // Part 1: 2-player mode (1P mouse + 2P phone)
  log('--- Part 1: 2-Player Mode ---');
  const env = await createTestEnv();
  const { page, roomId, shot, getSnapshot, fakePhone, cleanup } = env;

  // 1P: Mouse pairing
  log('Pairing 1P mouse...');
  const slot1 = page.locator('[data-testid="slot-card-1"]');
  const mouseBtn = slot1.getByRole('button', { name: '🖱 마우스' });
  await mouseBtn.click();
  await sleep(500);

  // Fill nickname if modal appears or input exists
  const nickInput = page.locator('input[placeholder*="닉네임"], input[type="text"]');
  if (await nickInput.isVisible()) {
    await nickInput.fill('마우스1P');
    const confirmBtn = page.getByText('확인');
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  }
  await sleep(500);

  // 2P: Fake phone pairing
  log('Pairing 2P fake phone...');
  const phone2 = fakePhone(2, '폰2P', 'device_phone_2p_test2');
  await phone2.join(2);
  await sleep(400);
  await phone2.zero(2);
  await sleep(500);

  // Check lobby status
  let snap = await getSnapshot();
  log('Lobby snap before start:', snap.phase, snap.players.length);

  // Click Game Start button
  log('Clicking Game Start...');
  const startBtn = page.locator('button:has-text("게임 시작")');
  await startBtn.click();
  await sleep(1000);

  // Wait for weapon selection
  for (let i = 0; i < 30; i++) {
    snap = await getSnapshot();
    if (snap && snap.selection && snap.selection.kind === 'weapon') break;
    await sleep(200);
  }
  log('Weapon select phase reached:', snap.phase, 'selection:', JSON.stringify(snap.selection));
  await shot('Q1-02-weapon-select-screen');

  const targets = snap.targets.filter((t) => t.selectKind === 'weapon');
  log(`Found ${targets.length} weapon cards:`, targets.map((t) => ({ id: t.id, owner: t.ownerIndex, aimX: t.aimX, aimY: t.aimY, r: t.hitRadius })));

  const p1Cards = targets.filter((t) => t.ownerIndex === 0).sort((a, b) => a.aimX - b.aimX);
  const p2Cards = targets.filter((t) => t.ownerIndex === 1).sort((a, b) => a.aimX - b.aimX);

  if (p1Cards.length === 0 || p2Cards.length === 0) {
    throw new Error('Weapon cards not found for 1P or 2P!');
  }

  // 1P mouse clicks 2P card center
  const target2P = p2Cards[0];
  const clickX_2P = ((target2P.aimX + 1) / 2) * 1440;
  const clickY_2P = ((1 - target2P.aimY) / 2) * 900;
  log(`1P mouse clicking 2P card center at (${clickX_2P.toFixed(1)}, ${clickY_2P.toFixed(1)})...`);
  await page.mouse.click(clickX_2P, clickY_2P);
  await sleep(400);

  snap = await getSnapshot();
  log('After 1P clicked 2P card, selection.done:', JSON.stringify(snap.selection.done));
  results.step1_1pHits2pCard = {
    expected: [false, false],
    actual: snap.selection.done,
    pass: !snap.selection.done[0] && !snap.selection.done[1],
  };
  await shot('Q1-02-1p-hit-2p-card-no-change');

  // 1P mouse clicks 1P card center
  const target1P = p1Cards[0];
  const clickX_1P = ((target1P.aimX + 1) / 2) * 1440;
  const clickY_1P = ((1 - target1P.aimY) / 2) * 900;
  log(`1P mouse clicking 1P card center at (${clickX_1P.toFixed(1)}, ${clickY_1P.toFixed(1)})...`);
  await page.mouse.click(clickX_1P, clickY_1P);
  await sleep(400);

  snap = await getSnapshot();
  log('After 1P clicked 1P card, selection.done:', JSON.stringify(snap.selection.done));
  results.step2_1pHits1pCard = {
    expected: [true, false],
    actual: snap.selection.done,
    pass: snap.selection.done[0] === true && !snap.selection.done[1],
  };
  await shot('Q1-02-1p-hit-1p-card-done');

  // 2P phone snaps 1P card center
  log(`2P phone snapping 1P card center at aim(${target1P.aimX.toFixed(3)}, ${target1P.aimY.toFixed(3)})...`);
  await phone2.snap(target1P.aimX, target1P.aimY);
  await sleep(400);

  snap = await getSnapshot();
  log('After 2P phone snapped 1P card, selection.done:', JSON.stringify(snap.selection.done));
  results.step3_2pHits1pCard = {
    expected: [true, false],
    actual: snap.selection.done,
    pass: snap.selection.done[0] === true && !snap.selection.done[1],
  };
  await shot('Q1-02-2p-hit-1p-card-no-change');

  // 2P phone snaps 2P card center
  log(`2P phone snapping 2P card center at aim(${target2P.aimX.toFixed(3)}, ${target2P.aimY.toFixed(3)})...`);
  await phone2.snap(target2P.aimX, target2P.aimY);
  await sleep(400);

  snap = await getSnapshot();
  log('After 2P phone snapped 2P card, selection.done:', JSON.stringify(snap.selection ? snap.selection.done : 'ALL DONE'));
  // Once both players select, selection might transition to PLAYING or selection.done === [true, true]
  const isDoneOrPlaying = !snap.selection || (snap.selection.done && snap.selection.done[0] && snap.selection.done[1]) || snap.phase === 'PLAYING';
  results.step4_2pHits2pCard = {
    expected: 'all done / playing',
    actual: { selection: snap.selection, phase: snap.phase },
    pass: isDoneOrPlaying,
  };
  await shot('Q1-02-2p-hit-2p-card-all-done');

  phone2.close();
  await cleanup();

  // Part 2: Solo mode outside card radius
  log('--- Part 2: Solo Mode Outside Card Radius ---');
  const envSolo = await createTestEnv();
  const pageSolo = envSolo.page;

  // 1P: Mouse pairing solo
  const soloSlot1 = pageSolo.locator('[data-testid="slot-card-1"]');
  await soloSlot1.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(500);

  const soloNickInput = pageSolo.locator('input[placeholder*="닉네임"], input[type="text"]');
  if (await soloNickInput.isVisible()) {
    await soloNickInput.fill('솔로1P');
    const confirmBtn = pageSolo.getByText('확인');
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  }
  await sleep(500);

  const soloStartBtn = pageSolo.locator('button:has-text("게임 시작")');
  await soloStartBtn.click();
  await sleep(1000);

  let snapSolo = null;
  for (let i = 0; i < 30; i++) {
    snapSolo = await envSolo.getSnapshot();
    if (snapSolo && snapSolo.selection && snapSolo.selection.kind === 'weapon') break;
    await sleep(200);
  }
  log('Solo weapon select reached:', snapSolo.selection);

  const soloTargets = snapSolo.targets.filter((t) => t.selectKind === 'weapon');
  const centerCard = soloTargets[1] || soloTargets[0];
  log('Solo center card:', { id: centerCard.id, aimX: centerCard.aimX, aimY: centerCard.aimY, r: centerCard.hitRadius });

  // Click 1.2x radius outside (e.g. aimY + hitRadius * 1.2)
  const missAimX = centerCard.aimX;
  const missAimY = centerCard.aimY + centerCard.hitRadius * 1.2;
  const missClickX = ((missAimX + 1) / 2) * 1440;
  const missClickY = ((1 - missAimY) / 2) * 900;

  log(`Solo clicking outside at (${missClickX.toFixed(1)}, ${missClickY.toFixed(1)})...`);
  await pageSolo.mouse.click(missClickX, missClickY);
  await sleep(400);

  snapSolo = await envSolo.getSnapshot();
  log('After clicking outside, selection.done:', JSON.stringify(snapSolo.selection.done));
  results.step5_soloOutsideRadius = {
    expected: [false],
    actual: snapSolo.selection.done,
    pass: snapSolo.selection.done[0] === false,
  };
  await envSolo.shot('Q1-02-solo-miss-outside-radius');

  // Click card center
  const hitClickX = ((centerCard.aimX + 1) / 2) * 1440;
  const hitClickY = ((1 - centerCard.aimY) / 2) * 900;
  log(`Solo clicking center at (${hitClickX.toFixed(1)}, ${hitClickY.toFixed(1)})...`);
  await pageSolo.mouse.click(hitClickX, hitClickY);
  await sleep(500);

  snapSolo = await envSolo.getSnapshot();
  log('After clicking center, selection.done/phase:', snapSolo.selection, snapSolo.phase);
  results.step6_soloCenterHit = {
    expected: 'done or PLAYING',
    actual: { selection: snapSolo.selection, phase: snapSolo.phase },
    pass: (snapSolo.selection && snapSolo.selection.done[0]) || snapSolo.phase === 'PLAYING',
  };
  await envSolo.shot('Q1-02-solo-hit-center-selected');

  await envSolo.cleanup();

  fs.writeFileSync(path.join(OUT_DIR, 'test-2-result.json'), JSON.stringify(results, null, 2));
  log('Test 2 finished. Results:', JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('Test 2 error:', e);
  process.exit(1);
});
