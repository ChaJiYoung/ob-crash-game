# Task: T05 플레이어별 판 통계와 coop 정보

## Status: pending

## Goal
판이 끝났을 때 `engine.getPlayRunStats(playerIndex)`가 그 플레이어의 점수·콤보·처치·사격·무기·카드 통계를 돌려주고, 2인 판이면 `mode: 'coop'`과 `coop`(내 슬롯, 팀 합계, 파트너 점수, 이탈 여부)를 담는다. 서버(P03-T03)가 이 값으로 2인팟 기록과 `coopBests`를 저장한다(D05, D18).

## Decision Summary
- 팀 값(`waveReached`, `livesLeft`, `durationSec`, `damageTaken`, `healedLives`, `waves[].seconds`, `outcome`)은 두 플레이어 통계에 똑같이 들어간다. `waves[].bonus`는 각자 받은 금액(T02에서 같은 금액).
- 파트너의 기기 ID·닉네임은 엔진이 모르므로 PC 페이지가 제출 직전에 채운다(P04-T05). 엔진은 `teamScore`, `partnerScore`, `slot`, `leftEarly`만 채운다.
- `PlayRunStats` 확장은 선택 필드로만 한다. 옛 기록·1인 기록은 그대로 유효하다.

## Implementation

### I01. 타입

- Related Files:
  - `src/shared/types.ts` :: `PlayerSlot`, `PlayMode`, `CoopRunInfo`, `PlayRunStats`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 서버·프로토콜의 플레이어 자리. 엔진의 PlayerIndex(0|1)와 slot - 1로 변환한다. */
  export type PlayerSlot = 1 | 2;
  export type PlayMode = 'solo' | 'coop';

  export interface CoopRunInfo {
    slot: PlayerSlot;
    /** 1P + 2P 최종 점수 합. */
    teamScore: number;
    partnerScore: number;
    /** PC 페이지가 채운다. 마우스 파트너도 D15 기기 ID가 있다. */
    partnerDeviceId: string;
    partnerNickname: string;
    /** 판이 끝날 때 이 플레이어가 이탈 상태였는가(D20). */
    leftEarly: boolean;
  }

  // PlayRunStats에 추가(둘 다 optional)
  /** 없으면 'solo'. */
  mode?: PlayMode;
  coop?: CoopRunInfo;
  ```

### I02. 엔진

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `getPlayRunStats`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public getPlayRunStats(playerIndex: PlayerIndex = 0): PlayRunStats | null;
  ```
- **Execution Flow / Logic**:
  1. 판이 끝나지 않았으면 `null`(기존).
  2. `const p = this.getPlayer(playerIndex)`; 개인 항목은 `p`에서: `totalScore/baseScore/timeBonus/precisionBonus/levelBonus`(= `getScoreBreakdown(playerIndex)`), `maxCombo`, `kills = p.totalKills`, `itemsCollected`, `waves = p.waveClears`, `shots`, `accuracy`(= `getPrecisionStats(playerIndex).ratio`), `weaponKind/weaponLevel`, `cardStacks`.
  3. 1인·2인 같은 코드: `mode: this.players.length > 1 ? 'coop' : 'solo'`(D24의 허용된 라벨 예외, 이 한 줄에만 둔다). `coop`은 "파트너가 있으면"(= 다른 플레이어가 있으면) 채우고, 없으면 넣지 않는다 — 인원수 분기가 아니라 파트너 데이터 유무다. 기존 `tests/play-run-stats.test.ts`가 키 목록을 정확히 비교하면 `mode: 'solo'`를 기대값에 추가한다.
  4. 파트너가 있을 때 `coop: { slot: (playerIndex + 1) as PlayerSlot, teamScore: 두 플레이어 totalScore 합, partnerScore: 상대 totalScore, partnerDeviceId: '', partnerNickname: '', leftEarly: p.isAway }`.

### I03. 테스트

- Related Files:
  - `tests/coop-run-stats.test.ts`; new

#### Details
- 2인 판에서 1P·2P가 다른 점수를 낸 뒤 `gamePhase = 'GAMEOVER'` → `getPlayRunStats(0).totalScore !== getPlayRunStats(1).totalScore`, 두 `coop.teamScore` 같고 = 합, `coop.slot` 1/2, `waveReached`·`livesLeft` 같음.
- 1인 판 `getPlayRunStats()`는 `mode: 'solo'`, `coop` 키 없음.
- 2P away 상태로 끝나면 `getPlayRunStats(1).coop.leftEarly === true`.

## Acceptance Criteria
- [ ] 1인 통계 객체 모양이 바뀌지 않는다.
- [ ] 2인 통계가 플레이어별로 나온다.

## Validation
- `npx vitest run tests/coop-run-stats.test.ts tests/play-run-stats.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(engine): per-player run stats with coop team info

Plan: 2026-11-07-two-player-coop
Phase: P02-engine-players
Task: T05-coop-run-stats

- getPlayRunStats(playerIndex) reads the player's own score, kills, shots and cards
- Coop runs add mode 'coop' and coop { slot, teamScore, partnerScore, leftEarly }
- Solo stats keep their exact shape

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
