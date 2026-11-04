# Task: T02 Monster Movement and Artillery

## Status: done

## Goal
필굿, 카스 라이트, 한맥의 행동을 서로 다르게 만든다. 지금은 필굿과 카스 라이트가 사실상 같고, 한맥의 투사체도 한맥과 무관한 곳에서 나온다.

## Decision Summary
- D18:
  - 필굿: 지상으로 내림. 12m 안에서 속도 2배.
  - 카스 라이트: 유일한 비행 몬스터. 좌우로 크게 흔들림.
  - 한맥: 11m에 멈춰 3초마다 자기 위치에서 투사체 발사. "맞으면 가속"은 제거.
- 튜토리얼과 샌드박스의 동작은 바꾸지 않는다.

## Implementation

### I01. 상수

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.monsters` — 특색 수치; modify
  - `src/shared/constants.ts` :: `TARGET_SPECS.pilgood` — 지상으로 변경; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  monsters: {
    pilgood: { chargeRadiusM: 12, chargeSpeedMult: 2 },
    caslight: { swayAmplitudeRad: 0.25, swayFrequency: 0.004 },
    hanmac: { stopRadiusM: 11, fireIntervalMs: 3000, firstShotDelayMs: 1000 },
  },
  ```
- `TARGET_SPECS.pilgood.isAirborne = false`. 체력과 속도는 유지한다.

### I02. 필굿 지상 돌격

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `getTargetBaseY`, `updateTargetAnimation3D`, `createTargetMesh3D` — 높이와 애니메이션; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `update`, `spawnMonsterProjectile`, `spawnGoldenCanTarget` — 돌격과 높이 고정; modify

#### Details
- **Execution Flow / Logic**:
  1. `getTargetBaseY`: 1.45를 반환하는 조건을 `kind === 'caslight'`만으로 바꾼다.
  2. `updateTargetAnimation3D`: `isGround`에 `pilgood`을 추가한다.
  3. 제트 분사구: 필굿은 땅에 박히지 않게 뒤쪽을 향하게 한다.
     ```typescript
     if (kind === 'pilgood') {
       jetPlume.rotation.x = Math.PI / 2;
       jetPlume.position.set(0, -h * 0.2, -r * 1.2);
     }
     ```
     어느 쪽이 뒤인지는 화면에서 확인하고, 플레이어 반대쪽으로 나오게 부호를 맞춘다.
  4. `update`의 S자 비행 조건(`:906-911`)에서 `pilgood`을 지운다.
  5. 속도 계산에 돌격을 넣는다. 튜토리얼과 샌드박스는 제외한다.
     ```typescript
     if (
       target.kind === 'pilgood' && !target.isItem && !target.isProjectile && !target.isGoldenCan &&
       !this.isTutorialMode && !this.isSandboxMode &&
       target.radiusM <= GAME_TUNING.monsters.pilgood.chargeRadiusM
     ) {
       effectiveSpeed *= GAME_TUNING.monsters.pilgood.chargeSpeedMult;
     }
     ```
- **함정**: 아이템과 투사체의 `kind`가 `'pilgood'`이다. 위 조건에서 제외해야 하고, 높이도 바뀌면 안 된다.
  - 투사체: `customBaseY: 1.45`를 지정한다. 조준 좌표는 `customNormY`를 쓰는데 메시만 바닥으로 내려가면 보이는 위치와 판정이 어긋난다.
  - 금색 캔(`spawnGoldenCanTarget`): `kind`를 확인하고 `pilgood`이면 `customBaseY: 1.45`를 지정한다.
  - 아이템: `getTargetBaseY(kind, true)`가 1.15를 반환하므로 영향이 없다.

### I03. 카스 라이트 회피 비행

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `update` — 흔들림 확대; modify

#### Details
```typescript
target.thetaRad = target.initialThetaRad +
  Math.sin(nowMs * swayFrequency + target.radiusM * 0.7) * swayAmplitudeRad;
```
기존 진폭 0.06을 0.25로 키운다. 화면 밖으로 나가지 않는지 확인한다. 나가면 `initialThetaRad`를 팬 범위 안쪽으로 줄이는 처리를 한다.

### I04. 한맥 포격

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity`, `update`, `spawnMonsterProjectile`, `shootAt`, `freezeTimers` — 포격과 분노 제거; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // ActiveTargetEntity: isEnraged 제거, 추가
  hanmacArrivedAtMs?: number;
  lastFireMs?: number;

  public spawnMonsterProjectile(
    nowMs: number,
    sourceKind: 'hanmac' | 'boss',
    origin?: { thetaRad: number; radiusM: number }
  ): ActiveTargetEntity;
  ```
- **Execution Flow / Logic**:
  1. 분노 제거: 속도 계산(`:900`), 피격 처리(`:1448-1450`), 엔티티 필드(`:44`), `SandboxSpawnOptions.isEnraged`(`:105`, `:682`)를 지운다.
  2. 이동 처리에서 보스처럼 정지 분기를 추가한다. 튜토리얼과 샌드박스는 제외한다.
     ```typescript
     if (target.kind === 'hanmac' && isRegularPlay && next.radiusM <= stopRadiusM) {
       target.radiusM = stopRadiusM;
       target.x = Math.sin(target.thetaRad) * stopRadiusM;
       target.z = -Math.cos(target.thetaRad) * stopRadiusM;
       target.breached = false;
     }
     ```
  3. 발사: 도착 시 `lastFireMs = nowMs - fireIntervalMs + firstShotDelayMs`로 설정하고, 매 프레임 간격이 지났으면 쏜다. 기절 중에는 쏘지 않는다. 기존의 필드 수 제한(`activeTargets.length < maxSimultaneous + 2`)은 유지한다.
     ```typescript
     this.spawnMonsterProjectile(nowMs, 'hanmac', { thetaRad: target.thetaRad, radiusM: target.radiusM });
     ```
  4. `spawnMonsterProjectile`: `origin`이 있으면 `thetaRad`, `initialThetaRad`, `radiusM`(`Math.min(14.0, ...)` 유지), `x`, `z`를 그 값으로 계산한다. 없으면 기존처럼 샘플링한다.
  5. 기존 공용 투사체 블록(`:1015-1019`)은 `kind === 'boss'`만 대상으로 바꾼다.
  6. `freezeTimers`: 모든 대상의 `lastFireMs`도 함께 민다. 안 그러면 카드를 고른 직후 한맥이 일제히 쏜다.

### I05. 테스트

- Related Files:
  - `tests/monster-traits.test.ts` :: 특색 검증; new
  - `tests/three-stage-and-models.test.ts` :: `:98` — 필굿 높이; modify
  - `tests/engine-judgment-and-spawn.test.ts` :: 비행 대상 테스트 — 대상 변경; modify

#### Details
- `tests/three-stage-and-models.test.ts:98`: `getTargetBaseY('pilgood')`는 0.55.
- `tests/engine-judgment-and-spawn.test.ts`의 `airTarget`(`:343` 근처)을 `caslight`로 바꾼다. 비행과 지상의 조준 높이 차이 검사를 유지한다.
- **새 테스트 시나리오**:
  - 필굿은 13m에서 기본 속도, 11m에서 2배이고, 튜토리얼과 샌드박스에서는 2배가 아니다.
  - `kind`가 `pilgood`인 아이템과 투사체는 돌격하지 않고 높이도 그대로다.
  - 카스 라이트의 `thetaRad`가 초기값에서 0.1 넘게 벗어난다.
  - 한맥은 11m에서 멈추고 방어선을 넘지 않으며, 3초 간격으로 자기 theta에서 투사체를 쏜다.
  - 기절한 한맥은 쏘지 않는다.
  - 카드 대기 뒤 한맥이 바로 쏘지 않는다.
  - 튜토리얼과 샌드박스의 한맥은 멈추지 않는다.

## Acceptance Criteria
- [x] 필굿이 땅에서 달려오다 가까워지면 빨라진다.
- [x] 공중에 뜬 몬스터는 카스 라이트뿐이고 크게 흔들린다.
- [x] 한맥이 멈춰 서서 자기 위치에서 투사체를 쏜다.
- [x] 아이템, 투사체, 금색 캔의 높이와 판정이 그대로다.
- [x] 튜토리얼이 정상 진행된다.

## Validation
- `npx vitest run tests/monster-traits.test.ts tests/three-stage-and-models.test.ts tests/engine-judgment-and-spawn.test.ts tests/tutorial-and-guide.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npm run dev`로 필굿 분사구 방향, 카스 라이트가 화면 안에 있는지 확인

## Commit Message
```text
feat(monsters): add charging pilgood, evasive caslight, and hanmac artillery

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P04-waves-and-bosses
Task: T02-monster-movement-and-artillery

- Move pilgood to the ground and charge it near the defense line
- Widen caslight flight sway
- Stop hanmac at range and fire projectiles from its position
- Remove hanmac enrage
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: feat(monsters): add charging pilgood, evasive caslight, and hanmac artillery
