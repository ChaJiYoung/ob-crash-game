# Task: T01 엔진 통계 수집

## Status: done

## Goal
판이 끝났을 때 저장할 값을 엔진 함수 하나로 얻는다.

## Decision Summary
- 결정 D03. 판 전체 처치 수, 플레이 시간, 웨이브별 기록은 엔진에 없어 새로 모은다.

## Implementation

### I01. 타입과 수집
- Related Files:
  - `src/shared/types.ts` :: `PlayRunStats`; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `getPlayRunStats`, `totalKills`, `playTimeSec`, `waveClears`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface PlayRunStats {
    outcome: 'GAMEOVER' | 'VICTORY';
    waveReached: number;
    livesLeft: number;
    durationSec: number;
    totalScore: number;
    baseScore: number;
    timeBonus: number;
    precisionBonus: number;
    maxCombo: number;
    kills: number;
    waves: { wave: number; seconds: number; bonus: number }[];
    shots: { PERFECT: number; GREAT: number; GOOD: number; MISS: number };
    accuracy: number; // 0..1
    weaponKind: WeaponKind;
    weaponLevel: WeaponLevel;
    cardStacks: { damage_up: number; skill_cooldown: number; fever_extend: number; hit_zone_up: number };
  }
  public getPlayRunStats(): PlayRunStats | null; // GAMEOVER·VICTORY가 아니면 null
  ```
- `totalKills`: `this.killedInWave += 1` 하는 **모든 지점**(`grep`으로 확인)에 함께 더한다. `killedInWave`는 웨이브마다 초기화되므로 재사용할 수 없다. `startGame`에서만 0으로 한다.
- `playTimeSec`: `update`에서 일시정지와 카드 정지의 조기 반환 뒤, `processHanmacBlasts` 호출 바로 앞에 `dtSec`를 더한다. 그래서 정지 시간이 빠진다. `startGame`에서 0.
- `waveClears`: `awardWaveTimeBonus`에서 `lastWaveClear`를 정한 뒤 `{wave, seconds, bonus}`를 push. `startGame`에서 비운다.
- 점수는 `getScoreBreakdown()`, 판정과 정확도는 `shotStats`, `getPrecisionStats().ratio`, 콤보는 `scoreManager.getState().maxCombo`, 무기는 `weaponSystem.getState()`, `shots`와 `waves`, `cardStacks`는 복사본을 돌려준다.
- 함정: 7웨이브 정밀 보너스는 `declareVictory` 때 정산되므로 phase가 VICTORY가 된 뒤 호출해야 총점이 맞다.

### I02. 테스트
- Related Files:
  - `tests/play-run-stats.test.ts`; new

#### Details
- 진행 중 `null`. 게임오버에서 outcome, 체력, 처치 수(웨이브를 넘어 누적), 판정 수. 일시정지 시간 제외. 새 게임에서 초기화. 반환값 수정이 엔진에 영향 없음. 웨이브 클리어 후 `waves` 항목.

## Acceptance Criteria
- [x] 끝난 판의 모든 항목을 함수 하나로 얻는다.

## Validation
- `npx vitest run tests/play-run-stats.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(stats): collect per-run stats in the engine

Plan: 2026-11-05-play-records-and-result-ranking
Phase: P02-play-records
Task: T01-engine-stats

- Track total kills, play time and wave clears and expose them with getPlayRunStats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
