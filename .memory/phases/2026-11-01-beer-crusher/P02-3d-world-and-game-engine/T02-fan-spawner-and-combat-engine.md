# Task: T02 부채꼴 시야각 방사형 스폰, 3단계 판정(PERFECT/GREAT/GOOD), 피버 100% 잠금 및 웨이브 엔진 구현

## Status: done

## Goal
카메라는 정면(`0°`)에 고정된 채 화면 가시 부채꼴 전방위(`±HF * 0.92`, 반경 `28m` 원호)에서 몬스터가 스폰되어 플레이어 중심(`R = 1.8m`)으로 방사형 수렴하는 스폰 엔진(`D07`), 중심 오차율 기반 3단계 타격 판정(`PERFECT`/`GREAT`/`GOOD`)과 피버 100% 완충 시 빗나가도 절대 차감되지 않는 잠금 규칙(`D06`), 그리고 100% 자동 장전(`1.2초`, `D09`)을 총괄하는 코어 게임 엔진을 구현합니다.

## Decision Summary
- **D06**: `PERFECT`(`<= 0.15`, `150점`, 피버 `+30`), `GREAT`(`<= 0.45`, `100점`, 피버 `+20`), `GOOD`(`<= 1.00`, `50점`, 피버 `+10`), 빗나감 시 피버 `< 100`일 때만 `-5`, **피버 `100` 도달 시 빗나가도 절대 차감 없음(`100` 잠금)**
- **D07**: 부채꼴 반시야각 $HF = \arctan(\tan(\text{vFOV}/2) \times \text{aspect})$, $\theta \in [-HF \times 0.92, +HF \times 0.92]$, $R_{spawn}=28\text{m} \to R_{def}=1.8\text{m}$ 방사형 직진
- **D09**: 10발 소진 시 `1.2초` 100% 자동 장전 (수동/흔들기 장전 없음), `0.25s` 홀드 시 `115ms` 간격 자동 연사

## Implementation

### I01. 부채꼴 방사형 스포너, 3단계 판정기, 피버 100% 잠금 매니저, 무기 시스템 및 엔진 오케스트레이터
- Related Files:
  - `src/pc/engine/FanSpawner.ts` :: `computeHorizontalHalfFovRad`, `sampleFanSpawnPoint`, `advanceRadialTarget` — 부채꼴 시야각 계산, 최소 각도 간격(`0.22 rad`) 보장 스폰 샘플링, 방사형 전진 수학 모듈; new
  - `src/pc/engine/HitJudgment.ts` :: `evaluateHitJudgment`, `selectBestRaycastHit` — 중심 오차율(`errorRatio = d / R_hit`) 기반 `PERFECT`/`GREAT`/`GOOD`/`MISS` 판정 모듈; new
  - `src/pc/engine/ScoreAndFeverManager.ts` :: `ScoreAndFeverManager` — 점수·콤보 배율(`1.0x ~ 2.5x`), 피버 게이지 증가 및 **100% 완충 잠금(Lock)** 상태 머신; new
  - `src/pc/engine/WeaponSystem.ts` :: `WeaponSystem` — 10발 탄창, `1.2초` 100% 자동 장전, `115ms` 연사 쿨다운 및 피버 무한 탄창 제어 클래스; new
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine`, `ActiveTargetEntity`, `EngineSnapshot` — Wave 1 ~ Wave 3 진행, 스폰/이동/사격/방어선 돌파/승패 루프 통합 클래스; new

#### Details
- **Signatures & Types**:
  ```typescript
  export function computeHorizontalHalfFovRad(vFovDeg: number, aspect: number): number;
  export function sampleFanSpawnPoint(options: {
    vFovDeg: number;
    aspect: number;
    spawnRadiusM?: number;
    marginRatio?: number;
    existingAnglesRad?: number[];
    rng?: () => number;
  }): { thetaRad: number; x: number; z: number; radiusM: number };

  export function evaluateHitJudgment(distanceToCenterM: number, hitRadiusM: number, isFeverActive?: boolean): {
    grade: JudgmentGrade;
    errorRatio: number;
    baseScore: number;
    feverDelta: number;
  };

  export class ScoreAndFeverManager {
    registerHit(grade: Exclude<JudgmentGrade, 'MISS'>, killBonusScore?: number): { earnedScore: number; totalScore: number; combo: number; feverGauge: number; isFeverReady: boolean };
    applyMissPenalty(): { combo: number; feverGauge: number; isFeverReady: boolean };
    activateFever(nowMs: number): boolean;
    updateFeverTimer(nowMs: number): void;
  }

  export class WeaponSystem {
    canFire(nowMs: number, isFeverActive: boolean): boolean;
    consumeShot(nowMs: number, isFeverActive: boolean): { fired: boolean; ammo: number; isReloading: boolean };
    update(nowMs: number, isFeverActive: boolean): void;
  }
  ```
- **Execution Flow / Logic**:
  1. **부채꼴 방사형 스폰 (`FanSpawner.ts`)**:
     - $HF = \arctan(\tan(\text{degToRad}(vFovDeg) / 2) \times \text{aspect})$
     - $\theta \in [-HF \times 0.92, +HF \times 0.92]$ 범위에서 샘플링하되, `existingAnglesRad`와 최소 `0.22 rad`(`12.6°`) 이상 떨어진 각도를 선택.
     - 초기 좌표: $x = R \cdot \sin(\theta)$, $z = -R \cdot \cos(\theta)$ ($R = 28\text{m}$).
     - 프레임당 이동: $R_{next} = R - (\text{speedMps} + \Delta v_{wave}) \cdot \Delta t$, 타겟 회전 `yaw = Math.atan2(-x, -z)`로 항상 플레이어를 정면 응시.
     - $R_{next} \le 1.8\text{m}$ 도달 시 `breached: true` 반환 -> 플레이어 라이프 `-1` 차감.
  2. **3단계 판정 및 피버 100% 완충 잠금 (`HitJudgment.ts`, `ScoreAndFeverManager.ts`)**:
     - `errorRatio = distanceToCenterM / hitRadiusM`
     - `isFeverActive === true`일 때는 `errorRatio <= 1.0`이면 무조건 `PERFECT` 판정으로 승격하며 데미지 `2`(일반은 `1`) 적용.
     - `applyMissPenalty()`:
       - `this.combo = 0` 초기화.
       - **핵심 회귀 방지 가드 (`D06`)**: `if (this.feverGauge >= 100 || this.isFeverReady || this.isFeverActive) return;` — 피버 게이지가 `100`에 도달한 상태에서는 빗나가도 절대 차감하지 않고 `100`을 유지! `this.feverGauge < 100`일 때만 `Math.max(0, this.feverGauge - 5)` 적용.
  3. **100% 자동 장전 (`WeaponSystem.ts`)**:
     - `ammo`가 `1`에서 `0`이 되는 순간 즉시 `isReloading = true`, `reloadEndTimeMs = nowMs + 1200` 설정.
     - `nowMs >= reloadEndTimeMs` 도달 시 자동으로 `ammo = 10`, `isReloading = false` 복귀.

### I02. 부채꼴 스폰·3단계 판정·피버 100% 잠금·자동 장전 단위 테스트
- Related Files:
  - `tests/engine-judgment-and-spawn.test.ts` :: `describe('Core Engine: Fan Spawn, 3-Tier Judgment, Fever 100% Lock, Auto Reload')` — 코어 수학 및 게임 규칙 검증; new

#### Details
- `sampleFanSpawnPoint`: 16:9 화면(`aspect = 16/9`, `vFov = 52°`)에서 좌측 끝(`theta < -0.6 rad`), 중앙(`theta ≈ 0`), 우측 끝(`theta > +0.6 rad`) 전 구간에서 $R = 28\text{m}$ 원호 위에 스폰되고 $R = 1.8\text{m}$ 도달 시 `breached === true`가 되는지 검증.
- `evaluateHitJudgment`: `0.10 -> PERFECT(150, +30)`, `0.30 -> GREAT(100, +20)`, `0.80 -> GOOD(50, +10)`, `1.05 -> MISS(0, -5)` 경계값 검증.
- `ScoreAndFeverManager`:
  - 게이지 `50`에서 빗나가면 `45`로 감소하는지 검증.
  - 게이지 `100`(`isFeverReady === true`) 달성 후 5번 연속 빗나가도 게이지가 **`100` 그대로 유지**되는지 검증 (`D06` 핵심 요구사항).
- `WeaponSystem`: 10발 발사 후 즉시 `isReloading === true`가 되고 `1200ms` 경과 후 별도 입력 없이 `ammo === 10`으로 자동 복구되는지 검증.

## Acceptance Criteria
- [ ] 부채꼴 시야각(`±HF * 0.92`) 전 영역에서 몬스터가 스폰되어 플레이어 중심(`1.8m`)으로 직진 수렴함
- [ ] `PERFECT`/`GREAT`/`GOOD` 판정 점수 및 피버 게이지 100% 완충 시 빗나감 차감 면제(Lock)가 정확히 동작함
- [ ] 10발 소진 시 1.2초 뒤 100% 자동 장전되며 Wave 1~3 보스전 흐름이 정상 작동함
- [ ] `npx vitest run tests/engine-judgment-and-spawn.test.ts` 테스트가 100% 통과함

## Validation
- `npx vitest run tests/engine-judgment-and-spawn.test.ts` — 부채꼴 스폰, 3단계 판정, 피버 100% 잠금, 1.2초 자동 장전 및 웨이브 엔진 테스트 통과

## Commit Message
```text
feat(engine): implement fan-angle radial spawner, 3-tier hit judgment, fever 100% lock, and wave engine

Plan: 2026-11-01-beer-crusher
Phase: P02-3d-world-and-game-engine
Task: T02-fan-spawner-and-combat-engine

- Implement FanSpawner using horizontal FOV angle and radial convergence to 1.8m defense arc
- Implement PERFECT/GREAT/GOOD hit judgment and Fever 100% lock on missed shots
- Implement 100% automatic 1.2s reload WeaponSystem and BeerCrusherEngine wave orchestrator
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
