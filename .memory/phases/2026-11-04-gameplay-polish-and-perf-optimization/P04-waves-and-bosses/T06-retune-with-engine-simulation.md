# Task: T06 Retune with Engine Simulation

## Status: pending

## Goal
시뮬레이터를 실제 구현된 엔진 기반으로 바꾸고, 보스전 시간과 무기 균형을 D14 기준에 맞춘다. 샷건의 첫 보스전이 3~5초로 너무 짧은 문제를 해결한다.

## Decision Summary
- D12 재조정 필요: 보스전 시간이 3웨이브 3~12초, 5웨이브 9~18초, 7웨이브 29~51초로 나왔다.
- D14: 세 무기 보통 봇 약 70~85%, 무기 간 차이 15%p 이내. 수치는 `gameTuning.ts`에서만 고친다.

## Implementation

### I01. 시뮬레이터 교체

- Related Files:
  - `.memory/references/scripts/simulate-current-decisions.ts` — 런타임 패치 제거; modify
  - `.memory/references/scripts/README.md` — 사용법 갱신; modify

#### Details
- **제거할 패치**(이제 엔진에 구현됨): `computeTargetAimCoords` 판정 계산, `chargeFeverToMax`, `refillSkillInstant`, `getSkillCooldownTotalMs`, `getLuckyDropMultiplier`, `spawnWaveRewardCards`, `handleMonsterKilled`, `shootAt` 피버 복원, 보스 이동·소환·쉴드, 무기 표 수정, `STAGE_CONSTANTS`, `JUDGMENT_SPECS` 변경.
- **유지할 것**: 봇 7종(정확, 보통, 부정확, 아주 부정확, 따라가며 누름, 몬스터 쪽 훑기, 화면 전체 훑기)과 조준 동작, 집계 출력.
- **Execution Flow / Logic**:
  1. 사격은 실제 `e.shootAt(aimX, aimY, now, source)`로 한다. 봇의 `tap`은 `'press'`, `hold`는 `'hold'`다. 탭 봇은 150ms 간격을 지킨다.
  2. 조준 좌표는 `computeTargetAimCoords`의 값을 그대로 쓴다. 화면비 보정이 엔진에 들어갔으므로 스크립트의 `K` 스케일을 지운다.
  3. 카드는 0.8초 뒤 실제 `'press'` 사격으로 고른다. 무기 카드가 손패에 있으면 우선 고르고, 없으면 무작위다.
  4. 피버는 준비되면 바로 켜고, 스킬은 스톡이 있고 몬스터가 2마리 이상이면 쓴다.
  5. 출력: 클리어율, 시간 초과 비율, 승리 시 체력, 한 판 시간, 피버 간격, 카드 수, 스킬 수, MAX 도달률, 보스전별 시간.

### I02. 수치 조정

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING` — 수치 조정; modify
  - `tests/boss-encounters.test.ts` 등 — 조정된 수치 반영; modify

#### Details
- **목표**(보통 봇 기준):
  | 항목 | 목표 |
  | :--- | :--- |
  | 3웨이브 보스전 | 15~25초 |
  | 5웨이브 보스전 | 20~30초 |
  | 7웨이브 보스전 | 40~60초 |
  | 클리어율 | 세 무기 약 70~85%, 무기 간 차이 15%p 이내 |
  | 정확 봇 | 90% 이상 |
  | 아주 부정확 봇 | 40% 이하 |
  | 화면 전체 훑기 | 거의 0% |
  | 샷건·리볼버 누른 채 사격 | 보통 봇보다 낮음 |
  | 시간 초과 | 0건 |
  | 한 판 | 약 3~3.5분 |
- **조정 순서**(한 번에 하나씩, 판당 60회 이상으로 측정):
  1. 보스 체력(`coolerHp`, `kingHp`)
  2. 무기별 보스 피해: 샷건의 보스 피해가 과하면 `GAME_TUNING.boss.damageScaleByWeapon`(기본 전부 1.0)을 추가하고 `shootAt`의 보스 피해에 곱한다.
  3. `hitZoneScale`
  4. `GAME_TUNING.monsters`의 특색 수치(돌격 거리, 회피 폭, 방패 시간, 포격 주기, 작은 병 속도)
  5. 웨이브 스폰 간격과 동시 등장 수
  6. 무기 표는 위 항목으로 안 맞을 때만 조정한다.
- **주의**: 몬스터 특색은 이전 시뮬레이션에 없었다. 클리어율이 크게 달라질 수 있으니, 먼저 현재 수치로 전체를 측정한 뒤 조정을 시작한다. 방패가 있어 오비가 많은 2웨이브가 개틀링·샷건에 지나치게 어렵지 않은지, 한맥이 멈춰 있어 판이 늘어지지 않는지 확인한다.
- **제약**: 사용자가 정한 규칙(판정 범위 x0.75, 연사·장전, 누른 채 사격 배율, 판정 피해)은 기본값을 유지한다. 바꿔야 맞출 수 있다면 변경 전에 사용자에게 수치와 함께 묻는다.
- 시간 초과가 있으면 원인을 찾아 고친다. 쉴드와 소환이 동시에 막히는 경우를 먼저 본다. 이전 측정의 개틀링 시간 초과 약 3%도 여기서 확인한다.

### I03. 렌더 회귀 확인

- Related Files:
  - `.memory/references/scripts/perf-frame-profile.mjs` — 재측정; read-only

#### Details
- `node .memory/references/scripts/perf-frame-profile.mjs 3440 1440 1 ultrawide 3000`을 실행한다. P04에서 쉴드 재질과 큰 보스가 추가되었으므로 `linkProgram` 0회와 p95 기준을 다시 확인한다.
- 스크립트의 벤치 대상 생성이 새 엔티티 구조와 맞는지 확인한다. 7웨이브 보스전 시나리오를 추가한다.

## Acceptance Criteria
- [ ] I02 목표를 모두 만족하거나, 못 맞춘 항목을 수치와 함께 사용자에게 보고했다.
- [ ] 시뮬레이터가 패치 없이 실제 엔진으로 동작한다.
- [ ] 결과가 `out/balance-final.txt`에 저장되어 있다.
- [ ] 보스전과 대왕 쉴드 상태에서도 렌더 기준을 만족한다.

## Validation
- `npx tsx .memory/references/scripts/simulate-current-decisions.ts 60 > .memory/references/scripts/out/balance-final.txt` — 목표 충족
- `node .memory/references/scripts/perf-frame-profile.mjs 3440 1440 1 ultrawide 3000` — 기준 충족
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
balance(game): retune bosses and weapons against the real engine

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P04-waves-and-bosses
Task: T06-retune-with-engine-simulation

- Run the balance simulator on the implemented engine
- Adjust boss health and encounter values to the target ranges
- Record final balance and render measurements
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
