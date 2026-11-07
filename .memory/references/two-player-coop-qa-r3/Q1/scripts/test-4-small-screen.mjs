import { createTestEnv, sleep, log, OUT_DIR } from './test-helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 4: 1024x768 Badges and Nametags...');
  const env = await createTestEnv({ width: 1024, height: 768 });
  const { page, shot, fakePhone, getSnapshot, cleanup } = env;

  const results = {};

  // 1P: Mouse
  const slot1 = page.locator('[data-testid="slot-card-1"]');
  await slot1.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(400);
  const nickInput = page.locator('input[placeholder*="닉네임"], input[type="text"]');
  if (await nickInput.isVisible()) {
    await nickInput.fill('마우스1024');
    const confirmBtn = page.getByText('확인');
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  }
  await sleep(400);

  // 2P: Phone
  const phone = fakePhone(2, '폰1024', 'phone_1024_r3');
  await phone.join(2);
  await sleep(400);
  await phone.zero(2);
  await sleep(500);

  // Start game
  await page.locator('button:has-text("게임 시작")').click();
  await sleep(1000);

  // Wait for weapon select
  let snap = null;
  for (let i = 0; i < 30; i++) {
    snap = await getSnapshot();
    if (snap && snap.selection && snap.selection.kind === 'weapon') break;
    await sleep(200);
  }
  log('Reached weapon selection phase');
  await page.waitForSelector('[data-owner-badge]', { timeout: 10000 }).catch((e) => log('Wait for [data-owner-badge] failed:', e.message));
  await sleep(800);

  // Check card badges in 1024x768
  const badgeCheck = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll('[data-owner-badge], [data-testid^="card-owner-badge-"]'));
    const innerWidth = window.innerWidth;
    return badges.map((b) => {
      const rect = b.getBoundingClientRect();
      return {
        id: b.getAttribute('data-testid') || 'owner-badge',
        text: b.textContent,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        inBounds: rect.left >= 0 && rect.right <= innerWidth,
      };
    });
  });
  log('1024x768 Card Badge Check:', JSON.stringify(badgeCheck, null, 2));
  await shot('Q1-04-smallscreen-weapon-select-badges');

  results.weaponSelectBadges = {
    badges: badgeCheck,
    allInBounds: badgeCheck.length > 0 && badgeCheck.every((b) => b.inBounds),
  };

  // Select weapons to enter combat
  const targets = snap.targets.filter((t) => t.selectKind === 'weapon');
  const p1Card = targets.find((t) => t.ownerIndex === 0);
  const p2Card = targets.find((t) => t.ownerIndex === 1);

  const clickX = ((p1Card.aimX + 1) / 2) * 1024;
  const clickY = ((1 - p1Card.aimY) / 2) * 768;
  await page.mouse.click(clickX, clickY);
  await sleep(400);

  for (let i = 0; i < 5; i++) {
    await phone.aimHold(p2Card.aimX, p2Card.aimY, 300);
    await phone.snap(p2Card.aimX, p2Card.aimY);
    await sleep(300);
    snap = await getSnapshot();
    if (snap.phase === 'PLAYING' && (!snap.selection || snap.selection.done?.every(Boolean))) break;
  }
  log('Entered combat phase');
  await sleep(1000);

  // Move 1P mouse to left boundary (aimX ~ -0.98 -> pixel x ~ 10)
  await page.mouse.move(10, 300);
  // Move 2P phone to right boundary (aimX ~ +0.98)
  await phone.aimHold(0.98, 0.1, 500);

  await sleep(300);

  // Check nametag rects
  const nametagCheck = await page.evaluate(() => {
    const tags = Array.from(document.querySelectorAll('[data-testid="crosshair-nametag"]'));
    const innerWidth = window.innerWidth;
    return tags.map((t, idx) => {
      const rect = t.getBoundingClientRect();
      return {
        index: idx,
        text: t.textContent,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        inBounds: rect.left >= 0 && rect.right <= innerWidth,
      };
    });
  });
  log('1024x768 Crosshair Nametag Check:', JSON.stringify(nametagCheck, null, 2));
  await shot('Q1-04-smallscreen-combat-crosshair-tags');

  results.combatNametags = {
    nametags: nametagCheck,
    allInBounds: nametagCheck.length > 0 && nametagCheck.every((t) => t.inBounds),
  };

  phone.close();
  await cleanup();

  fs.writeFileSync(path.join(OUT_DIR, 'test-4-result.json'), JSON.stringify(results, null, 2));
  log('Test 4 finished. Results:', JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('Test 4 error:', e);
  process.exit(1);
});
