import { chromium } from 'playwright';

async function testGame() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const errors = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => errors.push(err.message));

  console.log('Navigating to https://localhost:5173 ...');
  await page.goto('https://localhost:5173', { waitUntil: 'networkidle' });

  // 1. Check if canvas exists
  const canvas = page.locator('canvas');
  await canvas.waitFor({ timeout: 5000 });
  console.log('Canvas found!');

  // Check initial canvas element identity
  const canvasHandle = await canvas.elementHandle();

  // 2. Move mouse rapidly 20 times across the screen to test stutter / re-creation
  console.log('Simulating rapid mouse movement across canvas...');
  for (let i = 0; i < 20; i++) {
    const x = 200 + (i % 5) * 150;
    const y = 150 + (i % 4) * 100;
    await page.mouse.move(x, y);
    await page.waitForTimeout(30);
  }

  // Verify canvas element was NOT re-created or destroyed
  const canvasHandleAfter = await canvas.elementHandle();
  const isSameCanvas = await page.evaluate(
    ([c1, c2]) => c1 === c2,
    [canvasHandle, canvasHandleAfter]
  );
  console.log('Canvas maintained same instance across 20 mouse movements:', isSameCanvas);

  // 3. Start game as PC (the lobby button text contains '스마트폰 없이 PC')
  console.log('Looking for PC start button...');
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.includes('스마트폰 없이 PC')
    );
    if (btn) btn.click();
    return Boolean(btn);
  });
  const problems = [];
  if (!clicked) problems.push('PC start button not found');
  if (!isSameCanvas) problems.push('canvas was re-created during mouse movement');
  await page.waitForFunction(() => window.__engine && window.__engine.gamePhase === 'PLAYING', null, { timeout: 15000 }).catch(() => {
    problems.push('game did not reach PLAYING');
  });
  await page.waitForTimeout(1500);

  // 4. Pick the starting weapon with a real fresh press (after the 0.8s input lock), then check live combat
  const pick = await page.evaluate(() => {
    const eng = window.__engine;
    const card = eng.activeTargets.find((t) => t.weaponSelectKind);
    if (!card) return { found: false };
    const p = eng.computeTargetAimCoords(card);
    const res = eng.shootAt(p.targetNormX, p.targetNormY, performance.now(), 'press');
    return { found: true, selected: res.selectedWeapon ?? null, pending: eng.isWeaponSelectPending };
  });
  console.log('Weapon pick:', JSON.stringify(pick));
  if (!pick.found || !pick.selected || pick.pending) problems.push('starting weapon was not selected');

  await page.waitForTimeout(2500);
  const snapshot = () =>
    page.evaluate(() => {
      const engine = window.__engine;
      return {
        phase: engine.gamePhase,
        wave: engine.currentWave,
        targets: engine.activeTargets
          .filter((t) => !t.rewardCardKind && !t.weaponSelectKind)
          .map((t) => ({ id: t.id, kind: t.kind, radiusM: Number(t.radiusM.toFixed(2)) })),
      };
    });
  const before = await snapshot();
  console.log('Targets state:', JSON.stringify(before));
  await page.waitForTimeout(1500);
  const after = await snapshot();
  console.log('After 1.5s:', JSON.stringify(after));
  if (before.targets.length === 0) problems.push('no targets in play');
  const moved = before.targets.some((t) => {
    const later = after.targets.find((x) => x.id === t.id);
    return later && later.radiusM < t.radiusM;
  });
  if (before.targets.length > 0 && !moved) problems.push('targets did not approach the player');

  // 5. A real shot at the nearest target must register and spend ammo
  const shot = await page.evaluate(() => {
    const eng = window.__engine;
    const ammoBefore = eng.weaponSystem.getState().ammo;
    const t = [...eng.activeTargets]
      .filter((x) => !x.isItem && !x.isProjectile && !x.rewardCardKind && !x.weaponSelectKind && !x.isGuarding)
      .sort((a, b) => a.radiusM - b.radiusM)[0];
    if (!t) return { fired: false, reason: 'no target' };
    const p = eng.computeTargetAimCoords(t);
    const res = eng.shootAt(p.targetNormX, p.targetNormY, performance.now(), 'press');
    return {
      fired: res.fired,
      grade: res.grade,
      ammoBefore,
      ammoAfter: eng.weaponSystem.getState().ammo,
      totalScore: eng.scoreManager.getState().totalScore,
    };
  });
  console.log('Shot result:', JSON.stringify(shot));
  if (!shot.fired) problems.push(`shot did not fire (${shot.reason ?? 'engine refused'})`);
  else if (shot.ammoAfter >= shot.ammoBefore) problems.push('ammo was not spent');

  await page.screenshot({ path: 'docs/screens/screen-live-verification.png' });
  console.log('Screenshot saved to docs/screens/screen-live-verification.png');

  console.log('Page Errors count:', errors.length);
  if (errors.length > 0) {
    console.error('Errors:', errors);
    problems.push(`${errors.length} page error(s)`);
  }

  await browser.close();

  if (problems.length) {
    console.error('❌ verify-live failed:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
  console.log('✅ verify-live passed');
}

testGame().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});
