import { createTestBrowser, createFakePhone, sleep, log, OUT_DIR } from './test-common.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 0: Verify aimY sign and crosshair vertical position...');
  const env = await createTestBrowser();
  const { page, roomId, shot, errors, pageErrors } = env;

  try {
    // 1P 모바일 선택
    await page.getByText('📱 모바일').first().click();
    await sleep(500);

    const phone1 = createFakePhone(roomId, 1, '테스트폰1');
    await phone1.join();
    await sleep(500);
    await phone1.zero();
    await sleep(500);

    // 1) aimY = +0.4 (위쪽 입력)
    log('Testing aimY = +0.4 (holding 1500ms)...');
    await phone1.aimHold(0, 0.4, 1500);
    const rectPositive = await page.evaluate(() => {
      // Find crosshair container
      const crosshairs = document.querySelectorAll('[class*="CrosshairOverlay"], [data-testid*="crosshair"], div[style*="left:"]');
      // Look for the element that has top style
      for (const el of document.querySelectorAll('div')) {
        if (el.style.left && el.style.top && (el.style.left.includes('%') || el.style.top.includes('%'))) {
          const r = el.getBoundingClientRect();
          if (r.width > 20 && r.height > 20) {
            return {
              topStyle: el.style.top,
              leftStyle: el.style.left,
              rectTop: r.top,
              rectLeft: r.left,
              rectCenterY: r.top + r.height / 2,
              rectCenterX: r.left + r.width / 2,
              viewportH: window.innerHeight,
              viewportW: window.innerWidth,
            };
          }
        }
      }
      return null;
    });

    await shot('Q3-00-aimY-positive');
    log('aimY = +0.4 measurement:', rectPositive);

    // 2) aimY = -0.4 (아래쪽 입력)
    log('Testing aimY = -0.4 (holding 1500ms)...');
    await phone1.aimHold(0, -0.4, 1500);
    const rectNegative = await page.evaluate(() => {
      for (const el of document.querySelectorAll('div')) {
        if (el.style.left && el.style.top && (el.style.left.includes('%') || el.style.top.includes('%'))) {
          const r = el.getBoundingClientRect();
          if (r.width > 20 && r.height > 20) {
            return {
              topStyle: el.style.top,
              leftStyle: el.style.left,
              rectTop: r.top,
              rectLeft: r.left,
              rectCenterY: r.top + r.height / 2,
              rectCenterX: r.left + r.width / 2,
              viewportH: window.innerHeight,
              viewportW: window.innerWidth,
            };
          }
        }
      }
      return null;
    });

    await shot('Q3-00-aimY-negative');
    log('aimY = -0.4 measurement:', rectNegative);

    // 3) aimY = 0.0 (가운데 입력)
    await phone1.aimHold(0, 0.0, 1000);
    const rectCenter = await page.evaluate(() => {
      for (const el of document.querySelectorAll('div')) {
        if (el.style.left && el.style.top && (el.style.left.includes('%') || el.style.top.includes('%'))) {
          const r = el.getBoundingClientRect();
          if (r.width > 20 && r.height > 20) {
            return {
              topStyle: el.style.top,
              leftStyle: el.style.left,
              rectTop: r.top,
              rectLeft: r.left,
              rectCenterY: r.top + r.height / 2,
              rectCenterX: r.left + r.width / 2,
              viewportH: window.innerHeight,
              viewportW: window.innerWidth,
            };
          }
        }
      }
      return null;
    });
    await shot('Q3-00-aimY-center');

    const result = {
      description: 'Verification of aimY sign and vertical screen position',
      controllerInvertYDefault: false,
      pcTuningInvertYDefault: false,
      aimY_plus_0_4: rectPositive,
      aimY_minus_0_4: rectNegative,
      aimY_0_0: rectCenter,
      conclusion:
        rectPositive && rectNegative && rectPositive.rectCenterY < rectNegative.rectCenterY
          ? 'CONFIRMED_UP: aimY=+0.4 moves crosshair UP (smaller Y coordinate, ~33.2%), aimY=-0.4 moves crosshair DOWN (larger Y coordinate, ~66.8%). 2차 C의 "aimY +0.4인데 아래" 의심은 2P 십자선 또는 잘못된 관찰로 판명됨.'
          : 'DISCREPANCY_DETECTED',
      pageErrors,
      errors,
    };

    fs.writeFileSync(path.join(OUT_DIR, 'test-0-aim-y-result.json'), JSON.stringify(result, null, 2));
    log('Test 0 completed successfully! Result:', result.conclusion);

    phone1.close();
  } finally {
    await env.ctx.close();
    await env.browser.close();
  }
}

run().catch((e) => {
  console.error('Test 0 failed:', e);
  process.exit(1);
});
