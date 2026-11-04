import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('.memory/references/scripts/out');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function runGatlingSimulation() {
  console.log('🔫 [Simulation] 탄산 탭 개틀링 밸런스 실측 시뮬레이션 시작...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('❌ [Browser Console Error]:', msg.text());
    }
  });

  // 1. 게임 접속
  console.log('1️⃣ 게임 클라이언트 접속 중 (https://localhost:5173)...');
  await page.goto('https://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);

  // 2. PC 모드로 시작 클릭
  console.log('2️⃣ PC 플레이 시작...');
  const startBtn = page.locator('button:has-text("PC"), button:has-text("마우스로 플레이"), button:has-text("시작")').first();
  await startBtn.waitFor({ state: 'visible', timeout: 5000 });
  await startBtn.click();

  // 카운트다운(3초) 대기
  await page.waitForTimeout(4000);

  // 3. 브라우저 내부 엔진에서 개틀링 vs 리볼버 실측 테스트
  console.log('3️⃣ 브라우저 내부 엔진에서 개틀링 밸런스 실측 실행...');
  const simulationResults = await page.evaluate(() => {
    const engine = window.__engine;
    if (!engine) {
      return { error: 'engine instance not found on window.__engine' };
    }

    // 카드 선택 단계 해제 및 테스트 타겟 준비
    engine.isWeaponSelectPending = false;
    engine.activeTargets = [];

    // 테스트 1: 개틀링 에임 관용도(Hit Tolerance) 1.05x 검증
    engine.activeTargets.push({
      id: 'target_tolerance_test',
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: 7.0,
      thetaRad: 0,
      x: 0,
      z: -7.0,
      speedMps: 0,
      hitRadiusM: 1.0,
      killBonusScore: 100,
      breached: false,
    });

    const target1 = engine.activeTargets[0];
    const proj1 = engine.computeTargetAimCoords(target1);

    // 개틀링 장착
    engine.weaponSystem.selectWeapon('gatling', 1);

    // A. 1.02x 오프셋 사격 (1.05x 이내 -> HIT)
    const insideShot = engine.shootAt(proj1.targetNormX + proj1.apparentHitRadius * 1.02, proj1.targetNormY, performance.now());

    // 타겟 재생성
    engine.activeTargets = [{
      id: 'target_tolerance_test_2',
      kind: 'pilgood',
      hp: 1,
      maxHp: 1,
      radiusM: 7.0,
      thetaRad: 0,
      x: 0,
      z: -7.0,
      speedMps: 0,
      hitRadiusM: 1.0,
      killBonusScore: 100,
      breached: false,
    }];
    const target2 = engine.activeTargets[0];
    const proj2 = engine.computeTargetAimCoords(target2);

    // B. 1.12x 오프셋 사격 (1.05x 밖 -> MISS)
    const outsideShot = engine.shootAt(proj2.targetNormX + proj2.apparentHitRadius * 1.12, proj2.targetNormY, performance.now() + 200);

    // 테스트 2: 개틀링 vs 리볼버 점수 및 피버 충전율 비교
    engine.scoreManager.reset();
    engine.activeTargets = [{
      id: 'target_score_test',
      kind: 'boss',
      hp: 100,
      maxHp: 100,
      radiusM: 10.0,
      thetaRad: 0,
      x: 0,
      z: -10.0,
      speedMps: 0,
      hitRadiusM: 2.0,
      killBonusScore: 1000,
      breached: false,
    }];
    const bossTarget = engine.activeTargets[0];
    const bossProj = engine.computeTargetAimCoords(bossTarget);

    // 개틀링 5회 사격
    const gatlingShots = [];
    for (let i = 0; i < 5; i++) {
      const shot = engine.shootAt(bossProj.targetNormX, bossProj.targetNormY, performance.now() + i * 200);
      gatlingShots.push({
        earnedScore: shot.earnedScore,
        grade: shot.grade,
      });
    }
    const gatlingState = {
      totalScore: engine.scoreManager.getState().totalScore,
      feverGauge: engine.scoreManager.getState().feverGauge,
      combo: engine.scoreManager.getState().combo,
    };

    // 리볼버 비교 측정
    engine.scoreManager.reset();
    engine.weaponSystem.selectWeapon('revolver', 1);
    const revolverShots = [];
    for (let i = 0; i < 5; i++) {
      const shot = engine.shootAt(bossProj.targetNormX, bossProj.targetNormY, performance.now() + 2000 + i * 300);
      revolverShots.push({
        earnedScore: shot.earnedScore,
        grade: shot.grade,
      });
    }
    const revolverState = {
      totalScore: engine.scoreManager.getState().totalScore,
      feverGauge: engine.scoreManager.getState().feverGauge,
      combo: engine.scoreManager.getState().combo,
    };

    return {
      tolerance: {
        insideShotGrade: insideShot.grade,
        outsideShotGrade: outsideShot.grade,
      },
      gatling: {
        sampleShot: gatlingShots[0],
        stateAfter5Hits: gatlingState,
      },
      revolver: {
        sampleShot: revolverShots[0],
        stateAfter5Hits: revolverState,
      },
    };
  });

  console.log('📊 [실측 결과 데이터]:\n', JSON.stringify(simulationResults, null, 2));

  // 4. 화면 스크린샷 저장
  const screenshotPath = path.join(OUT_DIR, '07-gatling-balance-simulation.png');
  await page.screenshot({ path: screenshotPath });
  console.log(`\n📸 시뮬레이션 스크린샷 저장: ${screenshotPath}`);

  await browser.close();
  console.log('✅ [Simulation] 개틀링 밸런스 실측 검증 완료!');
}

runGatlingSimulation().catch((err) => {
  console.error('❌ 시뮬레이션 중 오류 발생:', err);
  process.exit(1);
});
