# Task: T02 보스전 중간 카드와 HUD 정리

## Status: pending

## Goal
3·5·7웨이브에서도 처치 수 24 / 40 / 44에 도달하면 중간 카드가 나오고(상한 없이 반복), 보스전 중에는 웨이브 진행 바가 사라지고 보스 체력 바와 카드 처치 카운터만 보인다.

## Decision Summary
- 결정 D06, D07. 보스 체력이 늘어 보스전이 길어졌으므로 카드로 보상 균형을 맞춘다.
- 기존 중간 카드 구조(`cardKillTarget`)를 재사용한다. 새 트리거나 카드 상한은 만들지 않는다. 카드를 받으면 `cardKillCount`가 0으로 돌아가 다음 목표까지 다시 센다(4·6웨이브와 같은 동작).
- 3·5웨이브는 보스 처치 후 카드(웨이브 종료 카드)가 그대로 남는다.

## Implementation

### I01. 웨이브 표 카드 목표
- Related Files:
  - `src/shared/gameTuning.ts` :: `waves[2|4|6].cardKillTarget`, `waves` 위 주석; modify

#### Details
- 3웨이브 `cardKillTarget: null` → `24`, 5웨이브 `null` → `40`, 7웨이브 `null` → `44`. 4·6웨이브(22, 26)는 그대로.
- 엔진의 `waveCardKillTargets`는 이 표에서 만들어지므로(`BeerCrusherEngine.ts:252`) 엔진 코드는 바꾸지 않는다.
- 주석 "cardKillTarget이 null이면 중간 카드가 없다"는 그대로 맞다. 보스 웨이브도 이제 값이 있다는 한 줄을 덧붙인다.
- 함정: 처치 수는 일반 몬스터·부하·작은 병 조각만 센다. 보스 본체는 세지 않는다(`handleMonsterKilled`에서 보스는 일찍 반환). 보스를 잡는 순간 웨이브가 끝나므로 목표 직전에 보스가 죽으면 그 카드는 나오지 않는다. 의도된 동작이다.

### I02. 카드와 보스 처치의 상호작용 확인
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnWaveRewardCards(nowMs, false)`, 카드 선택 후 웨이브 진행(1764~1780행), `startBossClearSequence`; read-only (필요 시 최소 수정)

#### Details
- 카드 대기 중(`isRewardCardPending`)에는 `update`가 시계를 멈추고 `shootAt`은 카드만 선택하므로 보스가 죽을 수 없다. 코드로 한 번 더 확인한다.
- 카드 선택 후 `pendingWaveAdvance || (remainingSpawns === 0 && remainingMonsters === 0)`가 거짓이어야 웨이브가 넘어가지 않는다. 보스가 필드에 있으므로 `remainingMonsters > 0`이고 중간 카드는 `pendingWaveAdvance = false`이므로 정상이다. 이 전제가 깨지는 상황(보스가 없는데 카드가 뜨는 경우: 보스 등장 전 처치 수가 24에 도달)이 있는지 본다. 3웨이브는 보스 등장(8킬) 전에 24킬에 못 미치므로 불가능하지만, 5·7웨이브도 보스가 10·13킬에 등장해 문제없다.
- 7웨이브에서 중간 카드를 고른 뒤 `currentWave >= TOTAL_WAVES` 분기가 `declareVictory()`를 부르지 않는지 본다. 이 분기는 `pendingWaveAdvance`가 참이거나 스폰이 끝나고 필드가 비었을 때만 실행되므로 보스가 살아 있으면 실행되지 않는다. 테스트로 고정한다.

### I03. HUD
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: 상단 중앙 블록(`waveProgress && (...)`, 356행 부근, `bosses.length > 0` 블록); modify

#### Details
- 보스가 있을 때(`bosses.length > 0`)는 웨이브 진행 바(`🎯 웨이브 토벌 n/N`, 퍼센트, 막대)를 그리지 않는다. 보스 체력 바(이미 존재)는 그대로 둔다.
- 카드 카운터는 남긴다. `bosses.length > 0 && waveProgress?.cardKillTarget !== null`이면 진행 바 자리에 작은 한 줄 배지만 그린다:
  ```tsx
  <span>🃏 카드: {waveProgress.cardKillCount}/{waveProgress.cardKillTarget} KILL</span>
  ```
  스타일은 진행 바의 텍스트 줄(`fontSize: 11px`, `fontWeight: 800`, `color: #fbbf24`)과 같게 한다.
- 보스가 없는 구간(보스 등장 전, 일반 웨이브)은 지금과 똑같이 그린다. `waveProgress` 계산(`getWaveProgress`)과 `hudSnapshot`은 바꾸지 않는다.
- 함정: `bosses` 목록은 HUD 스냅샷의 보스 엔티티 배열이다. 보스 경고 띠(`warningMs` 2초) 동안은 보스가 아직 없을 수 있으니 조건은 `bosses.length`만 쓴다.

### I04. 테스트
- Related Files:
  - `tests/boss-encounters.test.ts` :: 238~243행 `getCardKillTarget` 기대값; modify
  - `tests/boss-concurrent-spawns.test.ts` (T01에서 만든 파일); 케이스 추가
  - `tests/pc-hud-and-banner.test.ts` 또는 `tests/hud-render-cost.test.ts`; HUD 렌더 검증이 있으면 modify

#### Details
- `boss-encounters.test.ts`: `[1, 2].forEach(null)`, `getCardKillTarget(3)` 24, `(4)` 22, `(5)` 40, `(6)` 26, `(7)` 44. `startWave(1)`의 `cardKillTarget`은 null 유지.
- 새 케이스: (a) 3웨이브에서 보스가 있는 상태에서 `cardKillCount`가 24가 되는 처치로 `isRewardCardPending`이 참이 되고 카드 선택 후에도 보스와 웨이브가 유지된다. (b) 카드 선택 후 `cardKillCount`가 0이 되고 다시 24킬에서 두 번째 카드가 나온다. (c) 7웨이브 카드 선택 후 `VICTORY`가 아니다. (d) 보스 처치 후 3·5웨이브의 웨이브 종료 카드는 기존대로 나온다.
- HUD: 보스 있음/없음에 따라 진행 바와 카드 카운터가 그려지는지 기존 HUD 테스트 방식(React 렌더 또는 스냅샷)을 따라 확인한다. 기존 방식으로 렌더 검증이 어려우면 조건 로직을 작은 순수 함수로 빼서 테스트한다.

## Acceptance Criteria
- [ ] 3·5·7웨이브 `getCardKillTarget`이 24·40·44이고 4·6웨이브는 22·26이다.
- [ ] 보스전 중 목표 처치 수마다 카드가 나오고, 카드 선택으로 보스전이 끝나거나 승리하지 않는다.
- [ ] 보스가 있을 때 웨이브 진행 바가 없고 보스 체력 바와 카드 카운터만 보인다. 보스가 없을 때 HUD는 그대로다.

## Validation
- `npx vitest run tests/boss-encounters.test.ts tests/boss-concurrent-spawns.test.ts tests/pc-hud-and-banner.test.ts tests/hud-render-cost.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
feat(boss): drop mid-fight cards and tidy the boss HUD

Plan: 2026-11-06-boss-hp-and-bottle-speed
Phase: P02-boss-concurrent-spawns
Task: T02-boss-cards-and-hud

- Boss waves now give mid-wave cards at 24, 40 and 44 kills
- Hide the wave progress bar during a boss fight and keep the card kill counter

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
