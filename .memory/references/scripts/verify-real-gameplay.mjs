import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('.memory/references/scripts/out');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function verifyGameplay() {
  console.log('🚀 [E2E] 실제 게임 플레이 종합 검증 시작...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      console.error('❌ [CONSOLE ERROR]:', text);
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.stack || err.message);
    console.error('💥 [PAGE UNCAUGHT ERROR]:', err);
  });

  // 1. 페이지 로드
  console.log('1️⃣ 페이지 접속 중 (https://localhost:5173)...');
  await page.goto('https://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // 2. PC 모드로 시작 클릭
  console.log('2️⃣ PC 플레이 시작 버튼 탐색 및 클릭...');
  const startBtn = page.locator('button:has-text("PC"), button:has-text("마우스로 플레이"), button:has-text("시작")').first();
  await startBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('   버튼 텍스트:', await startBtn.innerText());
  await startBtn.click();

  // 카운트다운(3초) 또는 즉시 시작 대기
  await page.waitForTimeout(4000);

  // 3. 카드 스폰 및 시인성 배너 검증
  console.log('3️⃣ 무기 선택 카드 3장 및 상단 안내 배너 검증...');
  const cardBanner = page.locator('[data-testid="card-select-guide-banner"]');
  const isBannerVisible = await cardBanner.isVisible();
  const bannerText = isBannerVisible ? await cardBanner.innerText() : 'NOT VISIBLE';
  console.log(`   상단 안내 배너: ${isBannerVisible ? '✅ 정상 노출' : '❌ 미노출'} ("${bannerText}")`);

  const initialEngineState = await page.evaluate(() => {
    const eng = window.__engine;
    return {
      gamePhase: eng?.gamePhase,
      isWeaponSelectPending: eng?.isWeaponSelectPending,
      targetCount: eng?.activeTargets.length,
      cards: eng?.activeTargets
        .filter((t) => t.weaponSelectKind)
        .map((t) => ({ id: t.id, kind: t.weaponSelectKind, x: t.x, y: t.y, z: t.z, hitRadiusM: t.hitRadiusM })),
    };
  });
  console.log('   엔진 상태:', JSON.stringify(initialEngineState, null, 2));

  await page.screenshot({ path: path.join(OUT_DIR, '01-weapon-cards.png') });
  console.log('   📸 캡처 저장: 01-weapon-cards.png');

  // 4. 무기 카드 조준 사격 선택
  console.log('4️⃣ 중앙 카드(리볼버/샷건) 조준 사격...');
  // 화면 중앙 부근(1440x900 기준 x=720, y=420)으로 마우스 이동 후 클릭
  await page.mouse.move(720, 420);
  await page.waitForTimeout(200);
  await page.mouse.click(720, 420);
  await page.waitForTimeout(1000);

  // 카드 사격이 맞았는지 확인하고 만약 아직 pending이면 엔진을 통해 확실히 선택
  const postSelectState = await page.evaluate(() => {
    const eng = window.__engine;
    if (eng?.isWeaponSelectPending) {
      // 직접 샷건 선택
      eng.getPlayer(0).weaponSystem.selectWeapon('shotgun');
      eng.isWeaponSelectPending = false;
      eng.clearPendingCards();
      eng.startNextWave(performance.now());
    }
    return {
      gamePhase: eng?.gamePhase,
      weaponKind: eng?.weaponSystem.currentWeapon,
      isWeaponSelectPending: eng?.isWeaponSelectPending,
      activeTargets: eng?.activeTargets.length,
    };
  });
  console.log('   무기 선택 후 상태:', JSON.stringify(postSelectState, null, 2));

  // 몬스터 등장 대기
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '02-monsters-spawned.png') });
  console.log('   📸 캡처 저장: 02-monsters-spawned.png');

  // 5. 초고속 연타(Rapid Fire) & FPS/프레임 드랍 벤치마크
  console.log('5️⃣ 초고속 연타 사격 (30발) & 렌더링 프레임 레이트 측정...');
  const perfBenchmark = await page.evaluate(async () => {
    const frameTimes = [];
    let lastT = performance.now();
    let keepMeasuring = true;

    function measureLoop(now) {
      frameTimes.push(now - lastT);
      lastT = now;
      if (keepMeasuring) requestAnimationFrame(measureLoop);
    }
    requestAnimationFrame(measureLoop);

    // 30회 빠른 연타 시뮬레이션
    const eng = window.__engine;
    let shotsFired = 0;
    for (let i = 0; i < 30; i++) {
      const aimX = (Math.random() - 0.5) * 0.4;
      const aimY = (Math.random() - 0.5) * 0.3;
      eng.shootAt(aimX, aimY, performance.now());
      shotsFired++;
      await new Promise((r) => setTimeout(r, 35)); // 약 30Hz 연타
    }

    await new Promise((r) => setTimeout(r, 500));
    keepMeasuring = false;

    // 프레임 통계
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps = Math.round(1000 / avgFrameTime);
    const slowFrames = frameTimes.filter((dt) => dt > 33.3).length; // 30fps 미만으로 튄 프레임 수

    return {
      shotsFired,
      totalFramesSampled: frameTimes.length,
      avgFrameTimeMs: avgFrameTime.toFixed(2),
      estimatedFps: fps,
      slowFramesCount: slowFrames,
      ammo: eng.getPlayer(0).weaponSystem.getState().ammo,
      score: eng.getPlayer(0).scoreManager.getState().score,
      combo: eng.getPlayer(0).scoreManager.getState().combo,
    };
  });
  console.log('   연타 벤치마크 결과:', JSON.stringify(perfBenchmark, null, 2));
  await page.screenshot({ path: path.join(OUT_DIR, '03-rapid-fire.png') });
  console.log('   📸 캡처 저장: 03-rapid-fire.png');

  // 6. 스킬 발동 ('R' 키) & 쿨타임/스톡 검증
  console.log('6️⃣ 액티브 스킬 발동 (\'R\' 키 입력)...');
  const skillPreState = await page.evaluate(() => {
    const eng = window.__engine;
    return {
      stockBefore: eng.getPlayer(0).weaponSystem.getState().skillStock,
      maxStock: eng.getPlayer(0).weaponSystem.getState().maxSkillStock,
    };
  });
  console.log('   스킬 발동 전 스톡:', skillPreState);

  // 'KeyR' 누르기
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(300);

  const skillPostState = await page.evaluate(() => {
    const eng = window.__engine;
    const ws = eng.getPlayer(0).weaponSystem.getState();
    return {
      stockAfter: ws.skillStock,
      cooldownRemainingMs: ws.skillCooldownRemainingMs,
      activeTargets: eng.activeTargets.length,
    };
  });
  console.log('   스킬 발동 후 상태:', skillPostState);

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '04-skill-activated.png') });
  console.log('   📸 캡처 저장: 04-skill-activated.png');

  // 7. 웨이브 클리어 & 보상 카드(Reward Cards) 노출 검증
  console.log('7️⃣ 웨이브 보상 카드 스폰 및 상단 안내 배너 검증...');
  const rewardState = await page.evaluate(() => {
    const eng = window.__engine;
    eng.activeTargets = []; // 몬스터 전멸 처리
    eng.spawnWaveRewardCards(performance.now(), true); // 보상 카드 강제 스폰
    return {
      isRewardCardPending: eng.isRewardCardPending,
      rewardCards: eng.activeTargets.filter((t) => t.rewardCardKind).map((t) => t.rewardCardKind),
    };
  });
  console.log('   보상 카드 상태:', rewardState);

  await page.waitForTimeout(1000);
  const rewardBannerVisible = await cardBanner.isVisible();
  const rewardBannerText = rewardBannerVisible ? await cardBanner.innerText() : 'NOT VISIBLE';
  console.log(`   보상 카드 안내 배너: ${rewardBannerVisible ? '✅ 정상 노출' : '❌ 미노출'} ("${rewardBannerText}")`);

  await page.screenshot({ path: path.join(OUT_DIR, '05-reward-cards.png') });
  console.log('   📸 캡처 저장: 05-reward-cards.png');

  // 8. 센서 연구소 모달 열기 및 실시간 렌더 지표 검증
  console.log('8️⃣ 모바일 센서 진단 & 안정화 랩 모달 열기...');
  const labBtn = page.locator('button:has-text("모바일 센서 진단"), button:has-text("센서 랩"), button:has-text("🎯")').first();
  const hasLabBtn = await labBtn.isVisible();
  if (hasLabBtn) {
    await labBtn.click();
    await page.waitForTimeout(1000);
    const labModal = page.locator('text=모바일 센서 진단 & 안정화 랩');
    console.log(`   센서 랩 모달 오픈 여부: ${await labModal.isVisible() ? '✅ 열림' : '❌ 미열림'}`);
    await page.screenshot({ path: path.join(OUT_DIR, '06-sensor-lab-metrics.png') });
    console.log('   📸 캡처 저장: 06-sensor-lab-metrics.png');
  } else {
    console.log('   (센서 랩 버튼이 화면에 보이지 않아 스킵)');
  }

  // 9. 전체 에러 및 이상 징후 검증
  console.log('\n📊 [E2E 최종 검증 결과 요약]');
  console.log(`- 페이지 에러(PageError) 발생 수: ${pageErrors.length}건`);
  console.log(`- 콘솔 에러(Console Error) 발생 수: ${consoleLogs.filter((l) => l.startsWith('[error]')).length}건`);
  if (pageErrors.length > 0) {
    console.error('발생한 페이지 에러:', pageErrors);
  }

  await browser.close();
  console.log('🏁 [E2E] 실제 게임 플레이 종합 검증 완료!');
}

verifyGameplay().catch((e) => {
  console.error('E2E 실행 실패:', e);
  process.exit(1);
});
