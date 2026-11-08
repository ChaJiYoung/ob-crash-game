# Task: T02 카드 빈도 시뮬레이션 회귀 테스트

## Status: pending

## Goal
1인·2인 판의 4·6웨이브에서 처치 수와 웨이브 중간 카드 횟수를 측정하는 시뮬레이션을 테스트로 남긴다. 나중에 웨이브 표나 배율을 바꿔 2인 판의 카드 횟수가 1인 판과 어긋나면 테스트가 잡아낸다. 배율 값(`cardKillTargetMult` = 2)은 바꾸지 않는다.

## Decision Summary
- 결정 D07-1: 시뮬레이션(2026-11-08)에서 2배일 때 2인 판의 중간 카드 횟수가 1인 판과 같았다(4웨이브 2.0 대 2.0, 6웨이브 1.8 대 1.8). 배율 조정은 카드 선택 기록(D09)이 쌓인 뒤 별도로 결정한다.
- 검증된 초안: `/private/tmp/claude-501/-Users-bigtree-orca-workspaces-ob-crash-game-surgeonfish/e6a1a4e4-13ad-432a-9a73-761dd05a5fd0/scratchpad/card-sim.test.ts`(scratch라 사라질 수 있다. 아래 명세만으로도 다시 쓸 수 있다).

## Implementation

### I01. 시뮬레이션 테스트
- Related Files:
  - `tests/card-rate-simulation.test.ts` — new
  - `src/pc/engine/BeerCrusherEngine.ts` :: `startGame`, `startWave`, `update`, `shootAt(aimX, aimY, nowMs, source, playerIndex)`, `computeTargetAimCoords`, `isRewardCardPending`, `spawnWaveRewardCards(nowMs, isWaveClear)`, `dropRng`, `waveCardKillTargets`(private), `handleMonsterKilled`(private) — read-only

#### Details
`simulate(playerCount: 1|2, wave: 4|6, seed: number): { kills: number; midCards: number }`
1. 선형 합동 RNG `s = (s*1664525 + 1013904223) % 2**32`. 테스트 동안 `Math.random`과 `engine.dropRng`를 이 RNG로 바꾸고, `finally`에서 `Math.random`을 되돌린다.
2. `startGame({ withWeaponSelect: false, playerCount })`를 호출하고, 모든 플레이어의 `weaponSystem.infiniteAmmo = true`, `startWave(wave)`.
3. 계측: `(engine as any).handleMonsterKilled`를 감싸 일반 몬스터 처치(아이템, 투사체, 황금캔, 무기 선택 표적, 카드가 아닌 것)를 센다. `spawnWaveRewardCards`를 감싸 `isWaveClear === false`이면 `midCards++`, `true`이면 종료 신호로 쓴다.
4. 루프: `now`를 1000부터 16ms씩 올리며 `update(now, 0.016)`를 부른다. 종료 조건은 클리어 카드가 뜨거나, `currentWave`가 바뀌거나, `gamePhase !== 'PLAYING'`이거나, 300초가 지난 경우다.
   - 카드가 떠 있으면 연 지 900ms 뒤 플레이어마다 자기 카드(`ownerIndex === pi`, 없으면 아무 카드)를 `'press'`로 쏜다.
   - 그 밖에는 **틱 카운터**로 10틱마다, 플레이어 `pi`가 일반 몬스터 `mons[pi]`의 `hp`를 0.01로 낮추고 쏜다. `now % 160` 같은 시간 나머지 판정은 쓰지 않는다. `now`가 1000에서 16씩 오르면 160의 배수에 영원히 닿지 않아 봇이 한 번도 쏘지 않는다(실제로 초안에서 겪은 버그).
5. 시드 1~5의 평균을 낸다. `console.table`로 웨이브, 인원, 평균 처치 수, 평균 중간 카드 횟수를 출력한다.
6. 단언:
   - 웨이브별 `|avgMid(2인) - avgMid(1인)| <= 0.5`.
   - `avgKills(2인) / avgKills(1인)`이 1.6~2.4 사이(스폰 2배 확인).
   - 테스트 타임아웃은 120초.

## Acceptance Criteria
- [ ] 테스트가 1인·2인의 처치 수와 중간 카드 횟수를 출력하고 통과한다(기준 값: 4웨이브 56/114킬·2.0/2.0회, 6웨이브 57/109킬·1.8/1.8회).
- [ ] `gameTuning.ts`는 바뀌지 않는다.

## Validation
- `npx vitest run tests/card-rate-simulation.test.ts` — 통과, 표 출력
- `npm test` — 전체 통과

## Commit Message
```text
test(coop): 1인·2인 카드 빈도 시뮬레이션 회귀 테스트

Plan: 2026-11-08-playtest-feedback
Phase: P02-play-feel
Task: T02-coop-card-rate

- 웨이브 4·6에서 1인·2인 처치 수와 중간 카드 횟수를 시드 5개로 측정
- 2인 중간 카드 횟수가 1인과 0.5회 이내인지 확인
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
