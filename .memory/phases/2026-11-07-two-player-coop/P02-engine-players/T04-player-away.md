# Task: T04 이탈 상태(setPlayerAway)

## Status: done

## Goal
엔진이 "이 플레이어는 지금 나가 있다"를 알 수 있게 한다. 이탈 중인 플레이어는 입력(사격·스킬·피버)이 무시되고, 개인 타이머(스킬 쿨다운·장전·피버 시간·개인 버프)가 멈추며, 선택 라운드는 그 사람을 기다리지 않고 즉시 자동 선택한다. 복귀하면 상태 그대로 이어서 한다(D20). 30초 유예 타이머 자체는 PC 페이지(P04-T06)가 관리하고, 엔진은 상태만 가진다.

## Decision Summary
- D24: 이탈 처리는 인원수와 무관한 같은 로직이다. 1인 판에서는 PC가 이탈 처리를 부르지 않을 뿐이다(`rules.disconnectGraceMs`가 null, P04-T06).
- D20: 이탈자의 패널·점수·무기는 유지, 십자선만 숨김(화면 쪽), 스킬 등 개인 타이머 정지, 복귀 즉시 플레이.
- D19: 이탈해도 난이도 배율은 유지한다(규칙 행 `rules`는 판 시작 때 정해지고 이탈로 바뀌지 않는다, P02-T02).
- 두 명 모두 이탈하는 경우는 PC 페이지가 전체 일시정지로 처리한다(엔진은 그대로 둔다).

## Implementation

### I01. 상태와 API

- Related Files:
  - `src/pc/engine/PlayerCombatState.ts` :: `PlayerCombatState.isAway`; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `setPlayerAway`, `getActivePlayers`, `shootAt`, `triggerWeaponSkill`, `activateFever`, `update`, `openSelectRound`, `spawnWaveRewardCards`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // PlayerCombatState
  public isAway = false;
  /** 이탈 시작 시각(엔진 시계). 복귀 때 그 사이만큼 개인 타이머를 민다. null이면 이탈 아님. */
  public awaySinceMs: number | null = null;

  // BeerCrusherEngine
  public setPlayerAway(playerIndex: PlayerIndex, away: boolean, nowMs: number): void;
  public getActivePlayers(): PlayerCombatState[]; // isAway가 아닌 플레이어
  ```
- **Execution Flow / Logic**:
  1. `setPlayerAway(i, true, now)`: 이미 away면 무시. `p.isAway = true; p.awaySinceMs = now`. 그 플레이어가 선택 라운드 중 아직 안 골랐으면 즉시 `autoPickFor(i, now)`(P02-T03).
  2. `setPlayerAway(i, false, now)`: away가 아니면 무시. `const d = Math.max(0, now - p.awaySinceMs)`. 단, 이탈 기간 중 엔진이 일시정지·카드 대기로 이미 `freezeTimers`로 민 시간이 겹치면 이중으로 밀린다 → 이를 피하려고 **이탈 중에는 update 루프에서 그 플레이어 타이머를 매 프레임 직접 민다**(아래 3). 따라서 복귀 시에는 추가로 밀지 않고 `isAway = false; awaySinceMs = null`만 한다.
  3. `update()` 플레이어 루프(T02에서 만든 `for p of players`): `if (p.isAway) { p.freezeTimers(realElapsedMs); p.weaponSystem` 의 스킬 쿨다운도 멈춰야 하므로 `weaponSystem.update`를 **부르지 않는다**(`update`가 쿨다운과 장전을 진행시키는 유일한 곳). 피버 `updateFeverTimer`도 부르지 않는다. `continue; }`. `realElapsedMs`는 기존 카드 대기 분기와 같은 방식(`prevUpdateNowMs` 기반)으로 계산해 루프 앞에서 한 번 구한다.
  4. 입력 무시: `shootAt`, `triggerWeaponSkill`, `activateFever` 맨 앞에서 `if (this.getPlayer(i).isAway) return {fired:false…}` / `{activated:false…}` / `false`.
  5. 라운드 열기(P01-T04의 `openSelectRound`, 자동 선택은 P02-T03 `autoPickFor`): 표적 생성 후 away 플레이어마다 `autoPickFor(p.index, nowMs)`. 모두 away면 라운드가 바로 끝난다.
  6. `startGame`은 새 `PlayerCombatState`를 만들므로 away가 자연히 풀린다.

### I02. 테스트

- Related Files:
  - `tests/coop-player-away.test.ts`; new

#### Details
- 2인 판, 2P에게 스킬 쿨다운 진행 중 상태(스킬 사용 직후) → `setPlayerAway(1, true, t)` → `update`를 5초 진행 → 2P `skillCooldownRemainingMs` 그대로, 1P는 줄어듦.
- away 중 `shootAt(…, 1)` → `fired: false`, 2P `shotStats` 변화 없음.
- 2P 피버 활성 중 away → 5초 뒤 복귀 → 피버 남은 시간이 away 직전과 같다.
- away 중 보상 카드 라운드가 열리면 2P는 즉시 자동 선택, 1P만 고르면 라운드 종료.
- 복귀 후 `shootAt(…, 1)` 정상 동작.

## Acceptance Criteria
- [x] 이탈자의 스킬 쿨다운·장전·피버·개인 버프가 이탈 기간 동안 멈춘다.
- [x] 이탈자 때문에 선택 라운드가 기다리지 않는다.

## Validation
- `npx vitest run tests/coop-player-away.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(engine): away state freezes a player's timers and skips their picks

Plan: 2026-11-07-two-player-coop
Phase: P02-engine-players
Task: T04-player-away

- setPlayerAway(index, away, now) ignores the player's input while away
- Away players' skill cooldown, reload, fever and buffs stop; state is kept for the return
- Select rounds auto-pick for away players at once

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
