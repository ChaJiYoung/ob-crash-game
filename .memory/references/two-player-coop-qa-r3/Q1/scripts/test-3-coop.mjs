import { createTestEnv, sleep, log, OUT_DIR } from './test-helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 3 (Coop Result Screen Verification)...');
  const env = await createTestEnv();
  const { page, roomId, shot, fakePhone, getSnapshot, cleanup } = env;

  // 1P: Mouse
  const slot1 = page.locator('[data-testid="slot-card-1"]');
  await slot1.getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(400);
  const nickInput = page.locator('input[placeholder*="닉네임"], input[type="text"]');
  if (await nickInput.isVisible()) {
    await nickInput.fill('마우스1P');
    const confirmBtn = page.getByText('확인');
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  }
  await sleep(400);

  // 2P: Phone
  const phone = fakePhone(2, '폰2P', 'phone_coop_r3_2');
  await phone.join(2);
  await sleep(400);
  await phone.zero(2);
  await sleep(500);

  // Click Start
  await page.locator('button:has-text("게임 시작")').click();
  await sleep(1000);

  // Select weapons
  let snap = null;
  for (let i = 0; i < 30; i++) {
    snap = await getSnapshot();
    if (snap && snap.selection && snap.selection.kind === 'weapon') break;
    await sleep(200);
  }

  const targets = snap.targets.filter((t) => t.selectKind === 'weapon');
  const p1Card = targets.find((t) => t.ownerIndex === 0);
  const p2Card = targets.find((t) => t.ownerIndex === 1);

  // 1P select
  const clickX = ((p1Card.aimX + 1) / 2) * 1440;
  const clickY = ((1 - p1Card.aimY) / 2) * 900;
  await page.mouse.click(clickX, clickY);
  await sleep(400);

  // 2P select: hold aim then snap until done
  log(`2P aiming at (${p2Card.aimX.toFixed(3)}, ${p2Card.aimY.toFixed(3)}) and snapping...`);
  for (let i = 0; i < 5; i++) {
    await phone.aimHold(p2Card.aimX, p2Card.aimY, 300);
    await phone.snap(p2Card.aimX, p2Card.aimY);
    await sleep(300);
    snap = await getSnapshot();
    if (snap.phase === 'PLAYING' && (!snap.selection || snap.selection.done?.every(Boolean))) {
      log('Both weapons selected! Phase:', snap.phase);
      break;
    }
  }

  log('Entered coop combat. Waiting for lives to reach 0...');
  for (let sec = 0; sec < 120; sec++) {
    snap = await getSnapshot();
    const restartVisible = await page.locator('[data-shootable="restart"]').isVisible().catch(() => false);
    if (sec % 5 === 0) log(`[Combat sec ${sec}] lives=${snap?.lives}, phase=${snap?.phase}, restartVisible=${restartVisible}`);
    if (snap?.phase === 'GAMEOVER' || (snap?.lives !== undefined && snap.lives <= 0) || restartVisible) {
      log(`Coop Game over reached at sec ${sec}: phase=${snap?.phase}, lives=${snap?.lives}`);
      break;
    }
    await phone.aimHold(0, 0, 1000);
  }
  await sleep(2000);

  // Check Crosshair in DOM on Result Screen
  const coopCrosshairInfo = await page.evaluate(() => {
    // Result crosshairs container is at z-index 130
    const container = document.querySelector('div[style*="z-index: 130"], div[style*="zIndex: 130"]');
    const crosshairElements = container ? Array.from(container.children) : [];
    const restartBtn = document.querySelector('[data-shootable="restart"]');
    const nametags = Array.from(document.querySelectorAll('[data-testid="crosshair-nametag"]'));
    const modal = document.querySelector('[data-testid="result-ranking-modal"]') || document.querySelector('.bg-slate-900, .bg-gray-900, [class*="modal"]');
    const scoreNum = document.querySelector('[data-testid="result-score-num"]') || document.querySelector('.text-4xl, .text-5xl, .text-6xl, .font-bold');

    return {
      hasContainer: !!container,
      crosshairElementsCount: crosshairElements.length,
      nametagsCount: nametags.length,
      nametags: nametags.map((n) => n.textContent),
      hasRestartBtn: !!restartBtn,
      scoreRect: scoreNum ? scoreNum.getBoundingClientRect() : null,
      restartRect: restartBtn ? restartBtn.getBoundingClientRect() : null,
      crosshairStyles: crosshairElements.map((el) => ({
        style: el.getAttribute('style'),
        opacity: window.getComputedStyle(el).opacity,
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
      })),
    };
  });
  log('Coop Crosshair Info on result screen:', JSON.stringify(coopCrosshairInfo, null, 2));

  // Aim phone over result score numbers
  if (coopCrosshairInfo.scoreRect) {
    const r = coopCrosshairInfo.scoreRect;
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const aimX = (centerX / 1440) * 2 - 1;
    const aimY = 1 - (centerY / 900) * 2;
    log(`Aiming phone over score number at (${aimX.toFixed(3)}, ${aimY.toFixed(3)})...`);
    await phone.aimHold(aimX, aimY, 800);
  }
  await shot('Q1-03-result-crosshair-coop');

  phone.close();
  await cleanup();

  const results = {
    coopCrosshairInfo,
    pass: coopCrosshairInfo.hasContainer && coopCrosshairInfo.crosshairElementsCount > 0 && coopCrosshairInfo.nametagsCount === 0,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'test-3-coop-result.json'), JSON.stringify(results, null, 2));
  log('Test 3 Coop finished. Results:', JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error('Test 3 Coop error:', e);
  process.exit(1);
});
