# Task: T04 Final Verification and Playtest

## Status: pending

## Goal
전체 자동 검증을 통과시키고, 사용자가 폰과 마우스로 직접 플레이해 최종 수치를 정한다. 봇으로는 "아슬아슬함"을 판단할 수 없기 때문이다.

## Decision Summary
- D14: 자동 기준 통과 후 사람이 판단한다. 처음 하는 사람이 3판 중 1~2판을 깨고, 이겼을 때 체력이 1~3칸 남는 정도가 목표다.
- D10 후속 판단: 빠른 탭 연타, 개틀링 누른 채 사격, 장전 배율(2~3배), 폰 자이로에서의 판정 범위.

## Implementation

### I01. 자동 검증

#### Details
순서대로 실행하고 모두 통과시킨다.
```bash
npm test
npm run build
npx tsx .memory/references/scripts/simulate-current-decisions.ts 100 > .memory/references/scripts/out/balance-final.txt
node .memory/references/scripts/perf-frame-profile.mjs 3440 1440 1 ultrawide 3000
```
- 기준은 P01-T08의 성능 표와 P04-T06의 밸런스 표를 그대로 쓴다.
- `npm run build`가 실패하면 원인을 고친다. `.memory` 스크립트는 `tsconfig.json`의 `include` 밖이라 영향이 없다.

### I02. 직접 플레이 체크리스트

- Related Files:
  - `.memory/references/playtest-2026-11-04.md` :: 플레이 기록; new
  - `src/shared/gameTuning.ts` :: `GAME_TUNING` — 사용자 피드백 반영; modify

#### Details
- **실행 환경**: `npm run server`와 `npm run dev`를 켠다. 모니터 2종(외장 50Hz, 내장 레티나)에서 각각 확인한다.
- **사용자에게 요청할 항목**(폰 자이로와 마우스 각각):
  | 확인 항목 | 기대 |
  | :--- | :--- |
  | 사격 시 화면 번쩍임 | 없음 |
  | 플레이 중 멈춤과 끊김 | 없음 |
  | 몬스터가 다 죽은 뒤 다시 나올 때, 카드가 뜰 때 | 멈춤 없음 |
  | 누른 채 카드가 뜰 때 | 저절로 선택되지 않음 |
  | 피버 중 카드가 뜰 때 | 고른 뒤 피버가 이어짐 |
  | 바닥선 | 보이고, 카드를 가리지 않음 |
  | 보스 3회 | 움직이고, 대왕 쉴드가 부하로 풀림 |
  | 무기별 3판씩 | 클리어 횟수가 비슷함 |
  | 이겼을 때 남은 체력 | 1~3칸 |
  | 누른 채 막 쏘기, 빠른 탭 연타 | 조준보다 쉽게 깨지지 않음 |
  | 한 판 길이와 지루함 | 약 3~3.5분, 지루하지 않음 |
- 결과를 `.memory/references/playtest-2026-11-04.md`에 무기, 입력 장치, 클리어 여부, 남은 체력, 피드백으로 기록한다.
- 이 체크리스트는 사람이 해야 한다. 실행 주체가 대신 판단하거나 통과로 표시하지 않는다.

### I03. 피드백 반영

#### Details
- 수치 조정은 `gameTuning.ts`에서 한다. 조정할 때마다 `npm test`와 시뮬레이터를 다시 돌려 기준을 벗어나지 않는지 확인한다.
- 자주 쓰는 조정 위치:
  | 피드백 | 먼저 볼 값 |
  | :--- | :--- |
  | 연타가 아직 쉽다 | `fire.reloadScale`을 2.5 쪽으로 |
  | 탭 연타가 쉽다 | 사용자와 "0.35초 미만 연사 처리" 규칙 추가 논의 |
  | 개틀링이 쉽다 | `gatlingMaxAmmoByLevel`, `fire.holdDamageByWeapon.gatling` |
  | 자이로 조준이 빡빡하다 | `hitZone.scale`을 0.8 쪽으로 |
  | 이겼을 때 체력이 많이 남는다 | 웨이브 밀도, `speedPerWave` |
  | 너무 어렵다 | 스폰 간격, 보스 체력 |
- 규칙을 새로 추가해야 하는 피드백은 코드부터 고치지 말고 사용자와 합의한 뒤 결정 문서에 기록한다.

### I04. 마무리

- Related Files:
  - `.memory/plans/2026-11-04-gameplay-polish-and-perf-optimization.md` — 상태 갱신; modify
  - `.memory/decisions/2026-11-04-gameplay-polish-and-perf-optimization.md` — 최종 수치 기록; modify
  - `.memory/current.md` — 완료 표시; modify

#### Details
- 결정 문서의 `[초안]` 수치를 최종값으로 바꾼다.
- Plan의 모든 Phase를 `done`으로 표시하고 `current.md`에 계획 완료를 적는다.

## Acceptance Criteria
- [ ] 자동 검증을 모두 통과했다.
- [ ] 사용자가 직접 플레이한 기록이 있다.
- [ ] 사용자가 최종 수치에 동의했다.
- [ ] 결정 문서에 최종 수치가 기록되어 있다.

## Validation
- `npm test` — 전체 통과
- `npm run build` — 성공
- 사용자의 직접 플레이 확인 — 체크리스트 기록

## Commit Message
```text
chore(game): finalize tuning after verification and playtests

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P05-docs-and-verification
Task: T04-final-verification-and-playtest

- Record final automated verification results
- Apply playtest feedback to GAME_TUNING
- Record final values in the decision document
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
