# Task: T01 chalang 종류 등록

## Status: done

## Goal
`TargetKind`에 `'chalang'`을 추가하고, 스펙·튜닝·도감·테스트 목록을 모두 등록해 타입 검사(`tsc`)가 통과하는 상태를 만든다. 이 Task 완료 후 동작 변화는 없다(행동 로직은 P02).

## Decision Summary
- `TargetKind`는 고정 유니온이며 `Record<TargetKind, …>` 맵이 여러 곳에 있다. 타입만 추가하면 `tsc`가 깨지므로 같은 Task에서 모든 맵을 함께 갱신한다.
- 스펙 수치(speed 2.0, hitRadius 1.0, killBonus 120, 색)는 A8 가정값이다.
- 행동 튜닝 값(잠수 시간, 체류 시간, 최소 반지름, 급발진 조건)은 `GAME_TUNING.monsters.chalang`에 둔다. 기존 `obi`/`bottle` 튜닝과 같은 구조다.

## Implementation

### I01. 타입과 스펙 등록

- Related Files:
  - `src/shared/types.ts` :: `TargetKind` — 유니온에 `'chalang'` 추가; modify
  - `src/shared/constants.ts` :: `TARGET_SPECS` — `chalang` 항목 추가(`bottle` 항목 다음); modify

#### Details
- **Signatures & Types**:
  ```ts
  // src/shared/types.ts line 1
  export type TargetKind = 'pilgood' | 'caslight' | 'obi' | 'hanmac' | 'bottle' | 'boss' | 'chalang';
  ```
- **TARGET_SPECS 추가 항목** (`Record<TargetKind, TargetSpec>`, `TargetSpec`은 `types.ts:81` 필드 그대로 사용, 신규 필드 없음):
  ```ts
  chalang: {
    kind: 'chalang',
    displayName: '찰랑 (Chalang)',
    maxHp: 3,
    speedMps: 2.0,
    hitRadiusM: 1.0,
    killBonusScore: 120,
    brandColorHex: '#38bdf8',
    accentColorHex: '#0c4a6e',
    isAirborne: false,
    modelScale: 1.9,
  },
  ```

### I02. 튜닝 값 추가

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.monsters` — `chalang` 블록 추가(`obi` 줄 다음); modify

#### Details
- **Data & Schema Fields** (모두 number, 필수):
  ```ts
  chalang: {
    submergeMinMs: 1500,     // 물속 최소 시간 (D02)
    submergeMaxMs: 3000,     // 물속 최대 시간 (D02)
    surfacedMs: 1000,        // 수면 위 체류 시간 (A1, 가정, 사용자 확인으로 1초)
    minRadiusM: 8,           // 등장·순간이동 최소 반지름 = 방어선 1.8m + 여유 (A2, D03)
    rushAfterAppearances: 3, // 이 등장 횟수에 급발진 (A3, D05)
    rushSpeedMult: 3,        // 급발진 속도 배율 (D07)
  },
  ```
- 최대 반지름은 `STAGE_CONSTANTS.SPAWN_RADIUS_M`(`constants.ts:185`, 24.0)을 쓰므로 튜닝에 중복 저장하지 않는다.
- 방어선 반지름은 `STAGE_CONSTANTS.DEFENSE_LINE_RADIUS_M`(`constants.ts:186`, 1.8)이다. `minRadiusM`은 이 값에서 계산되지 않고 수동 값이다.

### I03. 도감과 테스트 목록에 등록

- Related Files:
  - `src/pc/components/guide/MonstersTab.tsx` :: `MONSTER_DETAILS` — `chalang` 키 추가; modify
  - `src/pc/components/SensorAndModuleTestLabOverlay.tsx` :: `targetKinds`(line 95) — `'chalang'` 추가; modify
  - `src/pc/three/ShaderWarmup.ts` :: `WARMUP_TARGET_KINDS`(line 14) — `'chalang'` 추가; modify

#### Details
- `MONSTER_DETAILS`는 `Record<…>` 타입이므로 키가 빠지면 `tsc`가 실패한다. 기존 `obi`/`bottle` 항목의 필드 구조를 그대로 따른다.
- 설명 문구에 반드시 포함할 내용: 수면 위에서만 맞힐 수 있음(D01), 여기저기 순간이동함(D02), 3번째 등장 후 급발진(D05), 체력 3(D06).
- `SensorAndModuleTestLabOverlay`의 `targetKinds` 목록에 있어야 샌드박스에서 찰랑을 소환할 수 있다(P04 검증에서 사용).
- `ShaderWarmup`은 첫 프레임 셰이더 컴파일 목록이다. 누락되면 첫 등장 때 끊김이 생긴다.

### I04. 스펙·튜닝 등록 테스트

- Related Files:
  - `tests/chalang-monster.test.ts` — 신규 테스트 파일; new

#### Details
- 테스트 케이스:
  1. `TARGET_SPECS.chalang.maxHp === 3`, `kind === 'chalang'`.
  2. `GAME_TUNING.monsters.chalang`의 6개 필드가 위 I02 값과 같다.
  3. `GAME_TUNING.monsters.chalang.submergeMinMs < submergeMaxMs`.
  4. `minRadiusM > STAGE_CONSTANTS.DEFENSE_LINE_RADIUS_M` and `minRadiusM < STAGE_CONSTANTS.SPAWN_RADIUS_M`.
- 테스트 작성 스타일은 `tests/monster-traits.test.ts`를 따른다(`vitest`의 `describe/it/expect`, `GAME_TUNING`과 `TARGET_SPECS` import).

## Acceptance Criteria
- [ ] `TargetKind`에 `'chalang'`이 있다.
- [ ] `TARGET_SPECS`, `MONSTER_DETAILS`, `targetKinds`, `WARMUP_TARGET_KINDS`에 `chalang`이 있다.
- [ ] `GAME_TUNING.monsters.chalang`의 6개 값이 I02와 같다.
- [ ] 신규 테스트 4개가 통과한다.
- [ ] 기존 동작(찰랑이 등장하지 않는 웨이브)은 바뀌지 않는다.

## Validation
- `npx tsc --noEmit` — 오류 0개(모든 `Record<TargetKind,…>`에 키가 채워짐)
- `npx vitest run tests/chalang-monster.test.ts` — 4개 통과
- `npm test` — 기존 테스트(현재 1054개) 전부 통과

## Commit Message
```text
feat(chalang): 찰랑 몬스터 종류와 스펙·튜닝을 등록

Plan: 2026-11-12-chalang-monster
Phase: P01-data-and-spec
Task: T01-register-chalang-kind

- I01: TargetKind에 chalang 추가, TARGET_SPECS 항목 등록
- I02: GAME_TUNING.monsters.chalang 튜닝 값 추가
- I03: 도감·테스트 랩·셰이더 워밍업 목록에 chalang 등록
- I04: 스펙·튜닝 등록 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
