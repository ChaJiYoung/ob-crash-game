# Task: T03 보스 포탄 간격 단축

## Status: done

## Goal
보스가 등장한 뒤 시간이 지날수록 보스 포탄 발사 간격이 3.5초에서 줄어 최소 1.5초가 된다. 일시정지와 카드 선택 정지 중에는 이 시간이 흐르지 않는다.

## Decision Summary
- 결정 D04, D05. 발사 간격만 줄인다. 포탄 속도(3.2 m/s)·피해(1)·요격 점수·냉각기가 번갈아 쏘는 규칙은 그대로다.
- 시간 기준은 `spawnBossEncounter`가 저장하는 보스 등장 시각이다. 샷건 등 무기별 예외는 두지 않는다.

## Implementation

### I00. 압박 전 기준 측정 (구현 전)
- 코드를 바꾸기 **전에** `npx tsx .memory/references/scripts/boss-strategy-compare.ts 30`을 실행하고, 전략별(특히 `stall`) 보스전 지속 시간·보스전 중 잃은 목숨·클리어율을 `.memory/references/playtest-2026-11-06-card-farming-fix.md`에 "압박 전" 표로 기록한다(파일이 없으면 만든다). T04가 같은 표에 "압박 후"를 채운다.

### I01. 튜닝 키
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.boss`; modify

#### Details
- `boss` 객체에 한국어 주석과 함께 추가한다(`summonDropChance` 근처).
  ```typescript
  /** 보스 포탄 발사 간격. 보스 등장 후 everyMs마다 stepMs씩 줄어 minMs에서 멈춘다(오래 끄는 플레이에 압박). */
  shellInterval: { startMs: 3500, stepMs: 500, everyMs: 15000, minMs: 1500 },
  ```
- 결과 표: 경과 0~14.9초 3500ms, 15초 3000, 30초 2500, 45초 2000, 60초 이후 1500(하한).

### I02. 엔진
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: 새 필드 `bossEncounterStartMs`, 새 private 메서드 `getBossShellIntervalMs`, `update()`의 보스 포탄 블록(1432행 부근 `>= 3500`), `spawnBossEncounter`, `freezeTimers`(1165행), `startGame`(409행 부근), `startWave`(456행 부근), 튜토리얼·샌드박스 진입(701·885행 부근); modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 보스가 등장한 시각(게임 시계). 0이면 보스전 아님. 포탄 간격 단축의 기준이다. */
  private bossEncounterStartMs = 0;

  private getBossShellIntervalMs(nowMs: number): number
  ```
- **Execution Flow / Logic**:
  1. `getBossShellIntervalMs`: `const c = GAME_TUNING.boss.shellInterval; const elapsed = Math.max(0, nowMs - this.bossEncounterStartMs); return Math.max(c.minMs, c.startMs - Math.floor(elapsed / c.everyMs) * c.stepMs);`
  2. `update()`의 조건 `nowMs - this.lastBossProjectileMs >= 3500`을 `>= this.getBossShellIntervalMs(nowMs)`로 바꾼다. 나머지 조건(`hasBossShooter`, `countFieldMonsters() < maxSimultaneous + 2`)과 발사 로직은 그대로.
  3. `spawnBossEncounter`에서 `this.lastBossProjectileMs = nowMs;`와 같은 자리에 `this.bossEncounterStartMs = nowMs;`를 넣는다.
  4. `freezeTimers`에 `if (this.bossEncounterStartMs > 0) this.bossEncounterStartMs += deltaMs;`를 `lastBossProjectileMs`를 미루는 줄 바로 아래에 추가한다. 일시정지(`setPaused`)와 카드 선택 정지가 둘 다 이 함수를 지나므로 한 곳이면 충분하다.
  5. `bossEncounterStartMs = 0` 초기화: `startGame`, `startWave`, 튜토리얼 진입, 샌드박스 진입에서 `lastBossProjectileMs = 0`/`bossWarningUntilMs = 0`을 하는 곳에 같이 넣는다. `startBossClearSequence`에서는 0으로 돌릴 필요가 없다(`isBossEncounterActive`가 꺼지면 포탄 블록의 `hasBossShooter`도 거짓이 된다).
- **함정들**:
  - `freezeTimers`에 안 넣으면 카드를 고르거나 일시정지한 시간이 경과에 포함되어 압박이 부당하게 올라간다. 기존 테스트 `a long pause does not make bosses or summons fire on resume`와 같은 방식으로 지킨다.
  - 경과는 보스 등장 시각 기준이라 경고 띠 2초가 포함된다. 의도된 동작이다.
  - 7웨이브처럼 냉각기가 2대 + 대왕이어도 간격은 보스 전체에 하나다. 번갈아 쏘는 순서(`bossShooterIndex`)는 바꾸지 않는다.
  - 기존 테스트 `two coolers fire projectiles in turn…`(`boss-encounters.test.ts`)는 70초를 돌리며 `who.length >= 4`와 번갈아 쏨을 확인한다. 간격이 줄어 발사 수가 늘어도 통과해야 한다(요격 후 보스 외 타깃을 비우는 부분은 그대로).
  - (구현 중 추가) `bossEncounterStartMs`가 0이면(보스를 `spawnBossEncounter` 없이 필드에 올린 테스트·도구) 경과를 0으로 본다. 그렇지 않으면 `nowMs` 전체가 경과가 되어 곧바로 하한 간격이 된다.
  - 간격 계산에 `Math.floor`를 쓰므로 경과가 `everyMs` 경계를 넘는 순간 한 단계 줄어든다. 중간 값(예: 3250ms)은 나오지 않는다.

### I03. 테스트
- Related Files:
  - `tests/boss-concurrent-spawns.test.ts` 또는 새 파일 `tests/boss-shell-ramp.test.ts`; new/modify
  - `tests/boss-encounters.test.ts` :: 포탄 관련 기존 테스트; read-only 확인

#### Details
- 간격 함수(`(engine as any).getBossShellIntervalMs`): 보스 등장 시각을 `t0`로 두고 `t0`, `t0+14_999`, `t0+15_000`, `t0+30_000`, `t0+45_000`, `t0+60_000`, `t0+600_000`에서 각각 3500, 3500, 3000, 2500, 2000, 1500, 1500이다. 값은 `GAME_TUNING.boss.shellInterval`에서 계산한 기대값과 비교한다.
- 동작: 보스전을 시작하고 일반 몬스터·부하를 얼린 채(`speedMps = 0`) 처음 15초 동안 쏜 포탄 수와, 시계를 60초 뒤로 옮긴 뒤 15초 동안 쏜 포탄 수를 비교해 후자가 많다. 포탄은 쏜 직후 `activeTargets`에서 지워 센다.
- 정지: 보스전 중 `setPaused(true)` 후 60초 뒤 `setPaused(false)`하면 `getBossShellIntervalMs`가 정지 전과 같은 값이다. 카드 선택 정지(`spawnWaveRewardCards`로 대기를 만든 뒤 `update`를 부른 경우)도 같다.
- 초기화: `startWave`와 `startGame` 후 `bossEncounterStartMs`가 0이다.

## Acceptance Criteria
- [x] 보스 등장 후 경과에 따라 간격이 3500 → 3000 → 2500 → 2000 → 1500으로 줄고 1500에서 멈춘다.
- [x] 보스를 빨리 잡는 판(처음 15초)의 포탄 빈도는 이전과 같다.
- [x] 일시정지·카드 선택 정지 시간은 경과에 들어가지 않는다.
- [x] 보스 웨이브가 아닌 곳(일반 웨이브, 튜토리얼, 샌드박스)은 영향이 없다.

## Validation
- `npx vitest run tests/boss-shell-ramp.test.ts tests/boss-encounters.test.ts tests/boss-concurrent-spawns.test.ts tests/boss-clear-sequence.test.ts tests/pause-menu.test.ts` — 통과 (새 파일명은 구현 시 정한 이름으로)
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
feat(boss): shorten the boss shell interval the longer the fight lasts

Plan: 2026-11-06-card-farming-fix
Phase: P02-shell-pressure
Task: T03-shell-ramp

- boss.shellInterval: 3500ms, minus 500ms every 15s since the boss appeared, floor 1500ms
- Store bossEncounterStartMs and shift it in freezeTimers so pauses and card picks do not count

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
