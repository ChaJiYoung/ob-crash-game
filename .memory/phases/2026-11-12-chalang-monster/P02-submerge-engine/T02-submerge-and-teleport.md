# Task: T02 잠수·순간이동·타격 불가

## Status: pending

## Goal
찰랑이 수면 위 체류 후 물속(1.5~3초)에 들어가 타격 불가 상태가 되고, 물속 시간이 끝나면 `minRadiusM` 이상 떨어진 화면 안 무작위 위치에 순간이동해 수면 위로 나온다. 물속에서는 전진하지 않으며, 모든 타격·스킬 명중 경로에서 제외된다.

## Decision Summary
- D01: 물속에서는 타격 불가. 수면 위에서만 맞는다.
- D02: 물속 시간은 매번 1.5~3초 무작위. 나올 때 화면 안 무작위 위치로 즉시 순간이동.
- D03: 방어선 가까이(`minRadiusM`=8 미만)는 등장 위치 후보에서 제외.
- D04(잠정): 물속에서는 전진하지 않고, 수면 위에서만 전진한다.
- A6: 스킬(뚫어뻥, 거품 해일, 칼날, 폭발)도 물속에서는 명중하지 않는다. 명중 판정 함수를 하나로 통일해 누락을 막는다.
- 물속 여부는 `isTargetable`이라는 단일 판정 함수로 묶는다. 기존 `isTargetLanded` 호출부(명중 후보 선택)를 모두 이 함수로 바꾼다.

## Implementation

### I01. ActiveTargetEntity에 찰랑 상태 필드 추가

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity`(line 33) — 찰랑 상태 필드 4개 추가(`swayPhaseOffsetRad` 근처); modify

#### Details
- **Signatures & Types**:
  ```ts
  // ActiveTargetEntity 내부에 추가 (모두 optional)
  /** 찰랑: 이 시각까지 물속이다(타격 불가, 전진 없음). */
  submergedUntilMs?: number;
  /** 찰랑: 수면 위 체류가 끝나는 시각. 처음 undefined이면 첫 틱에 nowMs + surfacedMs로 설정한다. */
  surfacedUntilMs?: number;
  /** 찰랑: 등장 횟수. 스폰이 1회, 순간이동마다 +1. */
  appearanceCount?: number;
  /** 찰랑: 급발진 중. true이면 다시 잠수하지 않는다(T03에서 설정). */
  isRushing?: boolean;
  ```

### I02. 잠수 상태 기계와 순간이동 구현

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `applyMonsterTraits`(line 1601) — `chalang` 분기 추가; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `updateChalangSubmerge`(신규 private 메서드); new
  - `src/pc/engine/BeerCrusherEngine.ts` :: `sampleChalangPosition`(신규 private 메서드); new
  - `src/pc/engine/BeerCrusherEngine.ts` :: `isTargetSubmerged`, `isTargetable`(신규 public 메서드); new
  - `src/pc/engine/BeerCrusherEngine.ts` :: 이동 루프 `for (let i = this.activeTargets.length - 1; …)`(line 1337) — 착지 검사 블록(1340~1346) 바로 뒤에 호출 삽입; modify

#### Details
- **Signatures & Types**:
  ```ts
  public isTargetSubmerged(t: ActiveTargetEntity, nowMs: number): boolean {
    return t.kind === 'chalang' && t.submergedUntilMs !== undefined && nowMs < t.submergedUntilMs;
  }
  public isTargetable(t: ActiveTargetEntity, nowMs: number): boolean {
    return this.isTargetLanded(t, nowMs) && !this.isTargetSubmerged(t, nowMs);
  }
  private updateChalangSubmerge(t: ActiveTargetEntity, nowMs: number): boolean; // true = 이번 틱은 움직이지 않는다
  private sampleChalangPosition(t: ActiveTargetEntity): void;
  ```
- **Data & Schema Fields**: 새 필드는 I01에서 정의. 튜닝 값은 `GAME_TUNING.monsters.chalang`(P01 I02).
- **Execution Flow / Logic**:
  1. `applyMonsterTraits(entity)` (line 1601): `else if (entity.kind === 'chalang') { entity.appearanceCount = 1; }`. 스폰은 수면 위에서 시작한다(A4). `surfacedUntilMs`는 비워 둔다.
  2. 이동 루프의 착지 검사(`if (!this.isTargetLanded(target, nowMs)) { … continue; }`) 바로 뒤에 다음을 삽입한다:
     ```ts
     if (this.updateChalangSubmerge(target, nowMs)) continue;
     ```
     `continue`는 전진 계산(line 1404 `advanceRadialTarget`)을 건너뛰므로 물속에서 전진하지 않는다(D04).
  3. `updateChalangSubmerge(t, nowMs)` 로직 (`t.kind !== 'chalang'`이면 `false` 반환):
     - a. `t.isRushing`이면 `false` 반환(A7: 급발진 중에는 잠수하지 않음).
     - b. `t.submergedUntilMs !== undefined`이면(물속):
        - `nowMs < t.submergedUntilMs`이면 `true` 반환(계속 물속).
        - 아니면(물속 시간 종료): `this.sampleChalangPosition(t)`로 순간이동, `t.appearanceCount = (t.appearanceCount ?? 1) + 1`, `t.submergedUntilMs = undefined`, `t.surfacedUntilMs = nowMs + GAME_TUNING.monsters.chalang.surfacedMs`, `false` 반환.
        - (T03이 이 자리에 급발진 판정을 추가한다.)
     - c. 수면 위인 경우:
        - `t.surfacedUntilMs === undefined`이면 `t.surfacedUntilMs = nowMs + surfacedMs`로 초기화.
        - `nowMs >= t.surfacedUntilMs`이면 물속 진입: `dive = GAME_TUNING.monsters.chalang.submergeMinMs + Math.random() * (submergeMaxMs - submergeMinMs)`, `t.submergedUntilMs = nowMs + dive`, `t.surfacedUntilMs = undefined`, `true` 반환.
        - 아니면 `false` 반환(수면 위 이동).
  4. `sampleChalangPosition(t)`: 
     - 각도 범위는 `pickMinionDropSpot`(line 1198 부근)과 같은 방식으로 `computeHorizontalHalfFovRad(STAGE_CONSTANTS.CAMERA_FOV_DEG, this.aspect) * STAGE_CONSTANTS.FAN_MARGIN_RATIO`를 쓴다. `theta = (Math.random() * 2 - 1) * visibleHalfRad`.
     - 반지름은 `minRadiusM + Math.random() * (STAGE_CONSTANTS.SPAWN_RADIUS_M - minRadiusM)`.
     - 설정: `t.thetaRad = theta; t.initialThetaRad = theta; t.radiusM = r; t.x = Math.sin(theta) * r; t.z = -Math.cos(theta) * r; t.breached = false;`
  5. 명중 후보 선택을 `isTargetable`로 바꾼다(아래 Related Files의 목록). `isTargetLanded` 조건은 `isTargetable`이 이미 포함하므로 의미가 유지된다.
     - 이동 루프(line 1340)와 보스 전용 착지 검사(line 1870 직전 `findBestTarget` 본문)는 구분한다. 1340은 그대로 둔다(잠수 중에도 이동 로직은 돌아야 하므로).
- **Call-site replacement list** (`isTargetLanded(…)` → `isTargetable(…)`, 같은 `nowMs` 인자):
  - `findBestTarget`(line 1870) — 기본 명중 선택
  - 라인 2355 부근 — 샷건 관통(rear) 후보
  - 라인 2483 부근 — 관통/후방 후보
  - 라인 2577 부근 — 폭발(hanmac blast) 대상
  - 라인 2687 부근 — 뚫어뻥 후보(`candidates`)
  - 라인 2748 부근 — 칼날 후보(`candidates`)
  - 라인 2822 부근 — 거품/해일 대상 필터
  - `src/pc/components/GameCanvas3D.tsx` line 323 — 조준 잠금 후보 필터: `engine.isTargetLanded(t, performance.now())`를 `engine.isTargetable(t, performance.now())`로 교체
- **Error & Exception Handling**: `chalang`이 아니면 모든 분기가 즉시 `false`/`true`가 아니라 무시되므로 기존 몬스터 동작은 바뀌지 않는다. `GAME_TUNING.monsters.chalang`은 P01에 있어야 한다.
- **State Transition & Return**: 수면 → (surfacedMs 경과) → 물속 → (submergeMs 경과) → 순간이동 → 수면. 한 사이클마다 `appearanceCount`가 1 증가.

### I03. 단위 테스트

- Related Files:
  - `tests/chalang-monster.test.ts` :: 신규 describe 블록 `chalang submerge`; modify(P01 I04 파일에 추가)

#### Details
- 테스트 헬퍼는 `tests/monster-traits.test.ts`의 `mk`/`step` 패턴을 따른다. `spawnedInWave = 999`로 새 스폰을 막는다(기존 테스트와 같은 방식).
- 케이스:
  1. 물속(`submergedUntilMs = now + 1000`)인 찰랑은 `isTargetable === false`이고, 그 위치를 향한 `shootAt`이 `MISS`(명중 없음)를 반환한다.
  2. 물속 동안 `radiusM`이 변하지 않는다(전진 없음, D04).
  3. 물속 시간이 끝나면 `appearanceCount`가 2가 되고, `radiusM`이 `minRadiusM` 이상 `SPAWN_RADIUS_M` 이하다.
  4. 순간이동 후 `x`, `z`가 이전과 다르다(최소 한 번은 확인. 같은 값이 나올 확률은 무시할 수준이므로 `Math.random`을 고정하지 않는다).
  5. 수면 위 체류(`surfacedMs`) 동안에는 `radiusM`이 줄어든다(전진).
  6. 물속 진입 후 `submergedUntilMs - now`가 `[submergeMinMs, submergeMaxMs]` 범위다(무작위 스텁: `vi.spyOn(Math, 'random').mockReturnValue(0)` → `submergeMinMs`).

## Acceptance Criteria
- [ ] 찰랑은 `surfacedMs` 수면 체류 → `submergeMinMs~Max` 물속 → 순간이동 → 수면 순서로 움직인다.
- [ ] 물속에서는 `isTargetable`이 false이고, 모든 명중 후보 필터에서 빠진다.
- [ ] 물속에서는 반지름이 변하지 않는다.
- [ ] 순간이동 반지름은 `[minRadiusM, SPAWN_RADIUS_M]` 안이다.
- [ ] 기존 몬스터(`pilgood`, `caslight`, `obi`, `hanmac`, `bottle`, `boss`)의 명중·이동 테스트가 그대로 통과한다.

## Validation
- `npx vitest run tests/chalang-monster.test.ts` — 신규 케이스 6개 통과
- `npx vitest run tests/monster-traits.test.ts tests/engine-judgment-and-spawn.test.ts tests/engine-wave-damage-and-weapon-hook.test.ts` — 기존 엔진 테스트 통과
- `npx tsc --noEmit` — 오류 0개

## Commit Message
```text
feat(chalang): 찰랑의 잠수·순간이동과 물속 타격 불가를 구현

Plan: 2026-11-12-chalang-monster
Phase: P02-submerge-engine
Task: T02-submerge-and-teleport

- I01: ActiveTargetEntity에 찰랑 잠수 상태 필드 추가
- I02: 잠수 상태 기계, 순간이동, isTargetable 판정으로 명중 후보 통일
- I03: 잠수·순간이동 단위 테스트 추가
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
