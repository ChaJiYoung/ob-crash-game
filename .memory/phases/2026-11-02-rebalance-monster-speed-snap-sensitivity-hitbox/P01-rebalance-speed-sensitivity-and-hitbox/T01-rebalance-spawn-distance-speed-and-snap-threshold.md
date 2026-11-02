# Task: T01 몬스터 스폰 거리 24m 확장, 이동 속도 35% 감속 및 발사 스냅 감도(4.8 m/s²) 완화

## Status: done

## Goal
몬스터가 스폰되는 반경을 기존 18m에서 24m로 확장하고 일반/보스 몬스터의 전진 속도를 약 35% 감속하여 플레이어가 몬스터를 침착하게 조준할 수 있는 여유 시간(약 7.5~9초)을 확보한다. 또한 손목을 위로 휙 채어 발사하는 가속도 인식 역치(`SNAP_ACCEL_THRESHOLD_MPS2`)를 기존 8.0 m/s²에서 4.8 m/s²로 완화하여 가벼운 손목 스냅만으로도 불발 없이 즉각 "탕!" 격발되도록 조작 편의성을 극대화한다.

## Decision Summary
- [D01](../../decisions/2026-11-02-rebalance-monster-speed-snap-sensitivity-hitbox.md): 몬스터 스폰 거리 24m 확장 및 이동 속도 35% 감속
- [D02](../../decisions/2026-11-02-rebalance-monster-speed-snap-sensitivity-hitbox.md): 발사 스냅(Snap Fire) 가속도 인식 역치 4.8 m/s²로 대폭 완화

## Implementation

### I01. STAGE_CONSTANTS 스폰 반경 및 TARGET_SPECS 이동 속도 35% 감속

- Related Files:
  - `src/shared/constants.ts` :: `STAGE_CONSTANTS`, `TARGET_SPECS` — `SPAWN_RADIUS_M = 24.0`, 각 몬스터 `speedMps` 약 35% 감속; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `BeerCrusherEngine.advanceTutorialStep` — 튜토리얼 2단계 병맥주 속도 동기화(1.6 ➔ 1.1 m/s); modify
  - `tests/engine-judgment-and-spawn.test.ts` :: `Core Engine` — 변경된 스폰 반경 및 이동 속도 테스트 업데이트; modify

#### Details
- **Data & Schema Fields (`src/shared/constants.ts`)**:
  ```typescript
  export const STAGE_CONSTANTS = {
    SPAWN_RADIUS_M: 24.0, // 기존 18.0 -> 24.0 (1.33배 확장)
    DEFENSE_LINE_RADIUS_M: 1.8,
    ...
  };

  export const TARGET_SPECS: Record<TargetKind, TargetSpec> = {
    pilgood: { ... speedMps: 2.6 }, // 기존 4.2 -> 2.6 (38% 감속)
    caslight: { ... speedMps: 2.2 }, // 기존 3.6 -> 2.2 (39% 감속)
    obi: { ... speedMps: 1.9 }, // 기존 3.0 -> 1.9 (37% 감속)
    hanmac: { ... speedMps: 2.0 }, // 기존 3.2 -> 2.0 (37% 감속)
    bottle: { ... speedMps: 1.5 }, // 기존 2.3 -> 1.5 (35% 감속)
    boss: { ... speedMps: 0.85 }, // 기존 1.10 -> 0.85 (23% 감속)
  };
  ```

### I02. WEAPON_CONSTANTS 발사 스냅 가속도 역치 완화 (4.8 m/s²)

- Related Files:
  - `src/shared/constants.ts` :: `WEAPON_CONSTANTS` — `SNAP_ACCEL_THRESHOLD_MPS2: 4.8`; modify
  - `tests/controller-sensors.test.ts` :: `GunGripTracker` — 5.0 m/s² 수준의 가벼운 스냅에서도 즉각 격발되는지 테스트 케이스 검증; modify

#### Details
- **Signatures & Constants**:
  ```typescript
  export const WEAPON_CONSTANTS = {
    ...
    SNAP_ACCEL_THRESHOLD_MPS2: 4.8, // 기존 8.0 -> 4.8 m/s^2 (40% 완화)
    ...
  };
  ```
- **Execution Flow / Logic**:
  - `GunGripTracker.detectSnapFire`:
    `const norm = Math.hypot(sample.x, sample.y, sample.z);`
    `if (norm >= this.snapThreshold)` (4.8 m/s²)
  - 가벼운 손목 튕김(가속도 5.0~6.5 m/s²)에서도 즉각 `snapFire: true`가 반환되어 불발 없이 탕! 격발됨.

## Acceptance Criteria
- [ ] 몬스터가 24m 지점에서 스폰되며, 가장 빠른 필굿 기준으로도 방어선까지 도달하는 시간이 약 7.5초 이상 확보된다.
- [ ] 가속도 5.0 m/s² 수준의 가벼운 손목 스냅 동작으로도 발사 제스처가 씹히지 않고 즉시 격발된다.
- [ ] `tests/controller-sensors.test.ts` 및 `tests/engine-judgment-and-spawn.test.ts` 통과.

## Validation
- `npx vitest run tests/controller-sensors.test.ts` — 4.8 m/s² 완화된 스냅 인식 검증 통과
- `npx vitest run tests/engine-judgment-and-spawn.test.ts` — 24m 스폰 및 감속 이동 검증 통과

## Commit Message
```text
feat(balance): extend monster spawn distance to 24m, reduce speed by 35%, and relax snap fire threshold to 4.8 m/s2

Plan: 2026-11-02-rebalance-monster-speed-snap-sensitivity-hitbox
Phase: P01-rebalance-speed-sensitivity-and-hitbox
Task: T01-rebalance-spawn-distance-speed-and-snap-threshold

- Extend SPAWN_RADIUS_M from 18.0m to 24.0m for double aim reaction time
- Reduce monster movement speeds by ~35% (pilgood 4.2 -> 2.6 m/s, caslight 3.6 -> 2.2 m/s)
- Relax SNAP_ACCEL_THRESHOLD_MPS2 from 8.0 to 4.8 m/s2 for effortless snap shooting
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
