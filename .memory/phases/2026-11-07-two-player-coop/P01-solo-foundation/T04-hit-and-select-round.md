# Task: T04 명중 판정 하나, 선택 라운드 하나

## Status: done

## Goal
기존 1인 코드의 두 가지 중복을 합친다.
1. **명중 판정**: `shootCardSelect`(엔진 1783행)와 `shootAtInner`(2028행)가 "조준점에 가장 가까운 표적 찾기"를 따로 갖고 있고, 기준도 세 가지로 다르다(몬스터: 화면 비율 보정 + 판정 축소 0.75 + 판정 강화 카드 / 카드: 보정·축소·강화 없음 / 튜토리얼·샌드박스: 보정·축소 없음). 함수 하나(`findBestTarget`)와 실전 기준 하나로 통일한다(D30).
2. **선택 라운드**: `spawnWeaponSelectTargets`(474행)와 `spawnWaveRewardCards`(553행)가 같은 배치 코드를 각자 갖고, 고른 뒤 처리도 무기·카드가 따로다. `openSelectRound` / `applySelection` / `finishSelectRound` 하나의 흐름으로 합친다. 선택 표적에는 항상 주인(`ownerIndex`, 지금은 0)이 있다.

1인 체감: 카드 선택은 그대로(계산상 판정 반지름이 화면 대부분을 덮어 가장 가까운 카드가 골라진다). 튜토리얼·샌드박스 몬스터는 실전처럼 좁아진다(D30, 의도된 변화).

## Decision Summary
- D30: 모든 표적이 실전 판정 하나. `computeTargetAimCoords`의 `isCard || isTutorialMode || isSandboxMode` 분기와 `shootAtInner`의 `aspectFactor` 분기를 없앤다. 보스 판정 축소(`boss.hitZoneScale`)는 "보스라는 종류의 규칙"이라 유지.
- 카드 계산 근거(16:9, 계획 시점): 카드 `hitRadiusM 1.75`, 거리 약 5.7m → `apparentHitRadius` 약 2.10(조준 좌표 −1~+1 기준). 실전 기준(×0.75, 가로 ÷1.78) 적용 후 가로 약 0.88. 카드 중심 x는 약 −0.40 / 0 / +0.40이라 화면 대부분에서 가장 가까운 카드가 맞는다. 화면 끝(|x| > 1.28)은 빗나갈 수 있으나 탄약은 쓰지 않는다(기존 규칙).
- 선택 배치 값은 이 Task에서 `GAME_TUNING.selectLayout`(1인 값)에 두고, P02-T02가 인원수 표로 옮긴다.

## Implementation

### I01. 판정 통일

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `computeTargetAimCoords`, `findBestTarget`(new), `shootAtInner`, `shootCardSelect`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 조준점에서 가장 오차가 작은 명중 표적. 판정 규칙은 모든 표적·모드에서 같다(D30). */
  private findBestTarget(
    aimX: number, aimY: number, nowMs: number,
    accept: (t: ActiveTargetEntity) => boolean
  ): { target: ActiveTargetEntity; result: HitJudgmentResult; index: number } | undefined;
  ```
- `computeTargetAimCoords`: `zoneScale = GAME_TUNING.hitZone.scale * (1 + hitZoneUp.amount * cardStacks.hit_zone_up)`를 **항상**, `bossScale = target.kind === 'boss' ? boss.hitZoneScale : 1`. `isCard` 변수 삭제.
- `findBestTarget` 본문 = 지금 `shootAtInner` 반복문(2028행~)에서 `aspectFactor`를 항상 `this.aspect`로, `requireLanded`는 항상(선택 표적은 처음부터 착지 상태라 영향 없음). 피버·파워샷·와이드 상태, 무기별 허용 배율, 세로 배율(리볼버 0.70 / 그 외 0.85, `customNormY`가 있으면 1)은 지금 그대로.
- `shootAtInner`: `findBestTarget(…, () => true)`. `shootCardSelect`: `findBestTarget(…, isSelectTarget)`(`isSelectTarget = t => !!t.weaponSelectKind || !!t.rewardCardKind`).

### I02. 선택 라운드 하나

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.selectLayout`; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity.ownerIndex`, `SelectRoundKind`, `selectRound`, `openSelectRound`, `computeSelectLayout`, `applySelection`, `finishSelectRound`, `spawnWeaponSelectTargets`, `spawnWaveRewardCards`, `shootCardSelect`; modify
  - `src/pc/engine/PlayerCombatState.ts` :: `selectionDone`; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  // gameTuning: 지금 코드 값. 플레이어 p의 k번째(0~2) 카드 x = groupCentersX[p] + (k - 1) * spacingM, z = depthZ.
  selectLayout: { depthZ: -3.5, groupCentersX: [0], spacingM: 1.85, hitRadiusM: 1.75 },
  ```
- **Signatures & Types**:
  ```typescript
  // ActiveTargetEntity
  /** 선택 표적(무기·보상 카드)의 주인. 선택 표적이면 항상 있다. */
  ownerIndex?: PlayerIndex;

  export type SelectRoundKind = 'weapon' | 'card';
  interface SelectRoundState { kind: SelectRoundKind; openedAtMs: number; isWaveClear: boolean; }
  public selectRound: SelectRoundState | null = null;

  public openSelectRound(kind: SelectRoundKind, nowMs: number, isWaveClear = false): void;
  private computeSelectLayout(): { ownerIndex: PlayerIndex; slotInGroup: 0 | 1 | 2; x: number; z: number; hitRadiusM: number; modelScaleMult: number }[];
  private applySelection(target: ActiveTargetEntity, playerIndex: PlayerIndex, nowMs: number): void;
  private finishSelectRound(nowMs: number): void;
  // 기존 이름은 얇은 래퍼(호출부·테스트 호환)
  public spawnWeaponSelectTargets(nowMs = 0): void { this.openSelectRound('weapon', nowMs); }
  public spawnWaveRewardCards(nowMs: number, isWaveClear = true): void { this.openSelectRound('card', nowMs, isWaveClear); }
  ```
- 호환 getter: `isWeaponSelectPending`(= `selectRound?.kind === 'weapon'`), `isRewardCardPending`, `isCardSelectPending`, `rewardCardsSpawnTimeMs`(= `openedAtMs`), `pendingWaveAdvance`(= `isWaveClear`). 이 값에 **대입**하는 곳(`grep -rn "isWeaponSelectPending =\|isRewardCardPending =\|pendingWaveAdvance =" src tests scripts .memory/references/scripts`)은 setter를 두어 `selectRound`를 만들거나 지우게 한다.
- **Execution Flow / Logic**:
  1. `computeSelectLayout()`: `L = GAME_TUNING.selectLayout`. 플레이어마다(지금은 1명) k=0..2: `x = L.groupCentersX[p] + (k - 1) * L.spacingM`, `z = L.depthZ`. 화면 맞춤: `depth = 2.2 - z`, `halfW = depth * tan(vFov/2) * aspect`, `edge = max|x| + 0.9`, `fit = min(1, (halfW - 0.1) / edge)`; `x *= fit`, `modelScaleMult = fit`, `hitRadiusM = L.hitRadiusM * fit`. 1인 16:9은 fit 1(지금과 같음).
  2. `openSelectRound`: 선택 표적 제거 → 모든 플레이어 `selectionDone = false` → 자리마다 표적(무기: `['shotgun','revolver','gatling'][k]`, 카드: `drawRewardCards(3, p)[k]`), 공통 필드는 지금 값(`kind 'obi'`, hp 1, 속도 0, `customBaseY 1.50`, 점수 무기 50/카드 100), `ownerIndex: p`, `fit < 1`일 때만 `modelScaleMult`. id `weapon_select_${kind}_p${p}` / `reward_card_${counter}_${kind}_p${p}`(옛 id를 고정한 테스트는 기대값 수정). `selectRound = { kind, openedAtMs: nowMs, isWaveClear }`.
  3. `shootCardSelect(aimX, aimY, nowMs, playerIndex = 0)`: 열린 지 800ms 안이거나 그 플레이어 `selectionDone`이면 `fired: false`. `findBestTarget(…, t => isSelectTarget(t) && t.ownerIndex === playerIndex)` → `applySelection` → 지금과 같은 결과 객체.
  4. `applySelection`: 무기 → `selectWeapon(kind, 1)`, 카드 → `applyRewardCard`. 그 플레이어 선택 표적 제거, `selectionDone = true`, 모든 플레이어 완료면 `finishSelectRound`.
  5. `finishSelectRound`: 남은 선택 표적 제거, `selectRound = null`. 카드 라운드였으면 지금 `shootCardSelect`의 웨이브 진행 블록(웨이브 클리어거나 남은 스폰·몬스터 0 → 마지막 웨이브면 시간 보너스+승리, 아니면 시간 보너스+다음 웨이브)을 그대로.

### I03. 테스트

- Related Files:
  - `tests/hit-and-select-round.test.ts`; new
  - 튜토리얼·샌드박스 판정 범위를 숫자로 고정한 테스트(`grep -rln "apparentHitRadius\|computeTargetAimCoords" tests`)는 새 기준으로 기대값 수정

#### Details
- 카드: 16:9에서 x = −0.9, −0.2, 0.2, 0.9 조준이 각각 가장 가까운 카드를 고른다(선택 체감 유지).
- 튜토리얼 몬스터 판정 반지름 = 같은 거리의 실전 몬스터와 같다.
- 판정 반복문이 하나: `grep -c "for (let i = 0; i < this.activeTargets.length; i++)\|for (const target of this.activeTargets)" src/pc/engine/BeerCrusherEngine.ts`가 판정용으로는 1곳(다른 용도의 반복문은 제외하고 확인).
- 선택 라운드: 무기 라운드 표적 3개 모두 `ownerIndex 0`, 고르면 라운드 종료. 카드 라운드(웨이브 클리어)에서 고르면 다음 웨이브.
- 회귀: `tests/card-select-gate.test.ts`, `tests/reward-card-pool.test.ts`, `tests/weapon-crosshair-hit-detection.test.ts` 통과(판정 숫자를 고정한 곳은 새 기준으로 수정하고 그 이유를 테스트 주석에 적는다).

## Acceptance Criteria
- [ ] 명중 판정 함수와 기준이 하나다(`isCard`·`aspectFactor` 분기 없음).
- [ ] 선택 표적 생성·고르기·종료가 무기·카드 공통 한 흐름이다(`grep -c "const xPositions" src/pc/engine/BeerCrusherEngine.ts` → 0).

## Validation
- `npx vitest run tests/hit-and-select-round.test.ts tests/card-select-gate.test.ts tests/reward-card-pool.test.ts tests/weapon-crosshair-hit-detection.test.ts` — 통과
- `grep -c "const xPositions\|aspectFactor\|isCard" src/pc/engine/BeerCrusherEngine.ts` — `0`
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: 튜토리얼 1·2단계를 폰으로 진행해 판정이 실전과 같은 느낌인지, 카드 선택이 전과 같은지

## Commit Message
```text
refactor(engine): one hit judgment and one select round

Plan: 2026-11-07-two-player-coop
Phase: P01-solo-foundation
Task: T04-hit-and-select-round

- findBestTarget replaces the two hit searches; cards, tutorial and sandbox use the real-game hit rule
- openSelectRound/applySelection/finishSelectRound replace the separate weapon and card paths
- Select targets always carry ownerIndex; layout comes from GAME_TUNING.selectLayout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
