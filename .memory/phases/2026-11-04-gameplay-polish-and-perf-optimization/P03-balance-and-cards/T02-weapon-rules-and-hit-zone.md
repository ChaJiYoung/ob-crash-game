# Task: T02 Weapon Rules and Hit Zone

## Status: done

## Goal
조준 없이 연타로 깨는 것을 어렵게 하고, 세 무기의 클리어 확률을 비슷하게 맞춘다.

## Decision Summary
- D10 수치:
  - 판정 범위 x0.75, 화면비 보정
  - 전 무기 발사 간격 x0.7, 장전 x2
  - 누른 채 사격: 피해 x0.6, 발사 간격 x0.7 추가. 개틀링은 피해 x0.85, 발사 간격 x0.85 추가. 탭과 피버 자동 발사는 감소 없음.
  - 샷건: 판정 배율 1.40, 피해 x1.2. 리볼버: 변경 없음. 개틀링: 탄창 13 / 15 / 20 / 25, 피해 x2.
- MISS 페널티는 다시 넣지 않는다.

## Implementation

### I01. 상수 추가

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING` — 무기 규칙 추가; modify
  - `src/shared/constants.ts` :: `applyWeaponTuning` — 실제 무기 표 계산; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  hitZone: {
    scale: 0.75,
    toleranceByWeapon: { shotgun: 1.40, revolver: 0.95, gatling: 1.05 },
  },
  fire: {
    intervalScale: 0.7,
    reloadScale: 2.0,
    holdDamageByWeapon: { shotgun: 0.6, revolver: 0.6, gatling: 0.85 },
    holdIntervalScaleByWeapon: { shotgun: 0.7, revolver: 0.7, gatling: 0.85 },
  },
  weaponDamageScale: { shotgun: 1.2, revolver: 1.0, gatling: 2.0 },
  gatlingMaxAmmoByLevel: { 1: 13, 2: 15, 3: 20, 4: 25 },
  ```
- **Execution Flow / Logic**: `applyWeaponTuning`이 각 레벨에 적용한다.
  - `fireIntervalMs = Math.round(base * intervalScale)`
  - `reloadDurationMs = Math.round(base * reloadScale)`
  - `damagePerHit = Number((base * weaponDamageScale[kind]).toFixed(3))`
  - 개틀링 `maxAmmo = gatlingMaxAmmoByLevel[level]`
  - 기존 `skillCooldownMs` 처리 유지

### I02. 판정 범위와 화면비

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `computeTargetAimCoords`, `shootAt`, `shootCardSelect` — 판정 계산; modify

#### Details
- **Execution Flow / Logic**:
  1. `computeTargetAimCoords`의 `apparentHitRadius`:
     ```typescript
     const scaled = baseHitRadius * GAME_TUNING.hitZone.scale;
     const apparentHitRadius = Math.max(0.14, scaled / 0.84);
     ```
     단, 카드(`weaponSelectKind`, `rewardCardKind`)와 튜토리얼·샌드박스 대상에는 `hitZone.scale`을 적용하지 않는다. 카드 선택이 어려워지면 안 되고, 튜토리얼 안내도 기존 판정을 전제로 한다.
  2. `shootAt`의 무기 배율을 표에서 읽는다.
     ```typescript
     const weaponHitToleranceMult = GAME_TUNING.hitZone.toleranceByWeapon[weaponKind];
     ```
  3. 화면비 보정: 가로 차이에 `this.aspect`를 곱한다.
     ```typescript
     const dx = (aimX - proj.targetNormX) * this.aspect;
     ```
     aim 좌표의 가로 1.0은 화면 폭 절반이라, 세로 기준으로 환산해야 원형 판정이 된다. 이 값은 16:9에서 약 1.78이고 울트라와이드에서 더 크다. `shootCardSelect`에는 적용하지 않는다.

### I03. 입력 종류별 연사 규칙

- Related Files:
  - `src/pc/engine/WeaponSystem.ts` :: `getFireIntervalMs`, `canFire`, `consumeShot` — 누른 채 사격 속도; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `shootAt` 피해 계산 — 누른 채 사격 피해; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public getFireIntervalMs(source: ShotSource = 'press'): number;
  public canFire(nowMs: number, isFeverActive: boolean, source: ShotSource = 'press'): boolean;
  public consumeShot(nowMs: number, isFeverActive: boolean, source: ShotSource = 'press'): { fired: boolean; ammo: number; isReloading: boolean };
  ```
- `ShotSource`를 `src/shared/types.ts`로 옮겨 엔진과 무기 시스템이 함께 쓴다.
- **Execution Flow / Logic**:
  1. `getFireIntervalMs`: `source === 'hold'`이면 `기본값 * holdIntervalScaleByWeapon[weaponKind]`를 반환한다.
  2. `canFire`: 피버 분기는 기존 `FEVER_AUTO_FIRE_INTERVAL_MS`를 유지하고, 아니면 `getFireIntervalMs(source)`를 쓴다.
  3. `shootAt`: `consumeShot(nowMs, isFever, source)`로 호출한다.
  4. 피해 계산:
     ```typescript
     const holdMult = source === 'hold' && !isFever
       ? GAME_TUNING.fire.holdDamageByWeapon[weaponKind]
       : 1.0;
     const totalMult = powerMult * feverMult * judgmentMult * weaponBonusMult * holdMult;
     ```
  5. 샷건 피해 계산은 `levelSpec.damagePerHit`을 쓰므로 무기 표에 이미 x1.2가 반영된다.

### I04. 테스트 갱신

- Related Files:
  - `tests/shared-protocol.test.ts`, `tests/engine-judgment-and-spawn.test.ts`, `tests/weapon-crosshair-hit-detection.test.ts`, `tests/gatling-balance.test.ts` — 수치 갱신; modify
  - `tests/weapon-rules.test.ts` :: 새 규칙 검증; new

#### Details
- **함정**: 기존 테스트는 `proj.targetNormX + proj.apparentHitRadius * 비율`로 조준한다. 화면비 보정 뒤에는 가로 차이가 약 1.78배가 되어 판정 등급이 달라진다. 가로 오프셋을 `(apparentHitRadius * 비율) / engine.aspect`로 바꾼다. 해당 위치: `tests/engine-judgment-and-spawn.test.ts:748`, `:772`, `:796`, `:818`, `tests/weapon-crosshair-hit-detection.test.ts:50`, `:86`, `:95`.
- `tests/weapon-crosshair-hit-detection.test.ts:49-63`: 샷건 배율 1.40에 맞춰 오프셋을 1.35배로 유지하되 주석을 고친다.
- `tests/shared-protocol.test.ts`:
  - `:128` 개틀링 Lv.1 탄창 13, `:130` Lv.4 25, `:131` Lv.4 발사 간격 `Math.round(83 * 0.7) = 58`
  - `:196` 장전: 1100 × 2 = 2200, × 0.8 = 1760
  - `:201` 개틀링 탄창 13 + 2 = 15
- `tests/engine-judgment-and-spawn.test.ts`:
  - `:511` 샷건 Lv.2: 4 × (0.40 × 1.2) × 2.0 = 3.84 → hp 0.16
  - `:574` 개틀링 Lv.1: (0.25 × 2.0) × 2.0 = 1.0 → hp 1.0
  - 연사 간격을 전제로 한 시각(`nowMs`) 간격이 새 값보다 큰지 확인한다.
- **`tests/weapon-rules.test.ts` 시나리오**:
  - 같은 조준에서 `'hold'` 피해가 `'press'`의 0.6배다(개틀링 0.85배).
  - 피버 중 `'hold'`는 감소가 없다.
  - `'fever'`는 감소가 없다.
  - `'hold'`는 `'press'`보다 짧은 간격으로 발사된다.
  - `aspect`를 16/9에서 2.39로 바꾸면 같은 aim 오프셋이 빗나갈 수 있다.
  - 카드 판정은 `hitZone.scale`의 영향을 받지 않는다.

## Acceptance Criteria
- [x] 연사가 더 빠르고, 탄창을 비우면 장전이 길게 느껴진다.
- [x] 누른 채 쏠 때와 탭할 때 피해 차이가 있다.
- [x] 카드 선택은 전처럼 쉽게 맞는다.
- [x] 튜토리얼이 정상 진행된다.

## Validation
- `npx vitest run tests/weapon-rules.test.ts tests/shared-protocol.test.ts tests/engine-judgment-and-spawn.test.ts tests/weapon-crosshair-hit-detection.test.ts tests/gatling-balance.test.ts tests/tutorial-and-guide.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(balance): narrow hit zones and penalize held rapid fire

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P03-balance-and-cards
Task: T02-weapon-rules-and-hit-zone

- Scale hit zones and correct horizontal aim by aspect ratio
- Speed up fire and double reload time
- Lower held fire damage while exempting taps and fever
- Tune shotgun and gatling to match weapon clear rates
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: feat(balance): narrow hit zones and penalize held rapid fire
