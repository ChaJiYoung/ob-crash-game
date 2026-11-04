# Task: T05 Boss Rewards, Model, and HUD

## Status: done

## Goal
부하를 잡아 피버와 아이템을 모아야 보스를 쉽게 깨는 구조를 완성하고, 여러 보스와 쉴드가 화면에 보이게 한다.

## Decision Summary
- D12: 보스 몸통 타격으로는 피버가 차지 않는다. 소환 부하의 아이템 드롭률은 20%로 시작한다(일반 처치 4%).
- 대왕은 같은 모델을 1.5배로 키운다. 경고 연출과 함께 보스가 나온다.
- 지금 보스 정보는 첫 번째 1대만 읽는다(`:580`, `PCGamePage.tsx:776`).

## Implementation

### I01. 피버와 드롭

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.boss.summonDropChance`, `GAME_TUNING.itemDropChance` — 수치; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `ActiveTargetEntity.isSummonedMinion`, `spawnBossMinionWave`, `shootAt`, `handleMonsterKilled` — 규칙 적용; modify

#### Details
- **Execution Flow / Logic**:
  1. `summonDropChance: 0.20`, `itemDropChance: 0.04`를 추가한다.
  2. `spawnBossMinionWave`의 엔티티에 `isSummonedMinion: true`.
  3. `shootAt`:
     ```typescript
     const feverMultiplier = target.kind === 'boss' ? 0 : weaponKind === 'gatling' ? 0.33 : 1.0;
     ```
     `ScoreAndFeverManager.registerHit`의 `Math.round(x * 0)`은 0이다.
  4. `handleMonsterKilled`:
     ```typescript
     const baseChance = target.isSummonedMinion ? GAME_TUNING.boss.summonDropChance : GAME_TUNING.itemDropChance;
     const dropProb = baseChance * this.getLuckyDropMultiplier();
     ```
     필드 아이템 2개 제한은 유지한다.
  5. 보스 스킬 처치 경로의 `registerHit('PERFECT', ...)`는 다음 웨이브로 넘어가는 처치이므로 그대로 둔다.
- **함정**: `tests/gatling-balance.test.ts`의 피버 배율 테스트는 `kind: 'boss'` 대상을 쓴다(`:57`). 이제 보스는 피버가 0이므로 대상을 `bottle`로 바꾼다.

### I02. 대왕 모델과 쉴드 표시

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D`, `updateTargetAnimation3D`, `TargetAnimationOptions` — 쉴드 메시; modify
  - `src/pc/components/GameCanvas3D.tsx` :: 메시 생성, 애니메이션 호출, `playShotFx` — 대왕 크기와 쉴드; modify
  - `src/pc/three/ShaderWarmup.ts` :: `buildShaderAnchorGroup` — 쉴드 재질 포함 확인; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export interface TargetAnimationOptions {
    // 기존 필드
    isShielded?: boolean;
  }
  ```
- **Execution Flow / Logic**:
  1. `kind === 'boss'` 모델에 `shieldMesh`를 추가한다. `SphereGeometry(2.2, 16, 12)`, `MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.22, depthWrite: false })`, 둘 다 `getCachedGeometry`, `getCachedMaterial`로 공유한다. 기본 `visible = false`, `userData.shieldMesh`에 저장한다.
  2. `updateTargetAnimation3D`: `shieldMesh.visible = Boolean(options?.isShielded)`.
  3. `spawnBossEncounter`에서 대왕에 `modelScaleMult = GAME_TUNING.boss.kingScale`을 지정한다. 크기 적용은 P04-T03의 메시 생성 코드가 처리한다. 애니메이션이 `baseScale`로 크기를 되돌려도 유지되는지 확인한다.
  4. 애니메이션 옵션에 `isShielded: target.isShielded`를 넘긴다.
  5. 쉴드에 막힌 사격의 소리와 파티클은 P04-T03의 `shieldBlocked` 처리를 그대로 쓴다.
  6. 앵커 그룹은 모든 자식을 보이게 해서 컴파일하므로 쉴드 재질도 포함된다. 재질을 새로 추가했으니 T08 스크립트로 `linkProgram`이 0인지 다시 확인한다(P04-T06에서 수행).

### I03. 보스 HUD와 경고

- Related Files:
  - `src/pc/hudSnapshot.ts` :: `HudSnapshot.bosses`, `buildHudSnapshot` — 보스 요약; modify
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `bossEntity` prop과 JSX — 여러 보스 표시; modify
  - `src/pc/PCGamePage.tsx` :: `bossEntity`, 보스 경고 — 스냅샷 사용; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `bossWarningUntilMs` — 경고 시간; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface BossHudInfo {
    id: string;
    role: 'cooler' | 'king';
    hp: number;
    maxHp: number;
    isShielded: boolean;
  }
  // HudSnapshot 추가: bosses: BossHudInfo[]; isBossWarning: boolean;
  // ArcadeOverlayHUDProps: bossEntity 제거, bosses?: BossHudInfo[] 추가
  public bossWarningUntilMs = 0;
  ```
- **Execution Flow / Logic**:
  1. `buildHudSnapshot`: `engine.getBossEntities()`를 요약한다. `hp`는 `Math.ceil`로 정수화해 불필요한 갱신을 줄인다.
  2. HUD: 기존 패널(`:467-510`)을 `bosses.map`으로 바꾼다. 패널 너비 420px를 보스 수에 맞춰 줄인다(1대 420, 2대 각 240, 3대 각 200). 문구: `🧊 냉각기`, `👑 대왕 냉각기`, 쉴드 중 `🛡️ 쉴드`.
  3. `spawnBossEncounter`에서 `bossWarningUntilMs = nowMs + 2000`. 스냅샷의 `isBossWarning = nowMs < bossWarningUntilMs`.
  4. `PCGamePage`: `isBossWarning`이면 화면 위쪽에 `⚠️ 보스 등장!` 배너를 표시한다. 그림자 없이 테두리와 불투명 배경만 쓴다. 금색 캔 알림과 같은 위치에 겹치지 않게 `top: 72px`로 둔다.
  5. `const bossEntity = engine.getBossEntity();`(`:776`)를 지우고 `bosses={hudState.bosses}`를 넘긴다.

### I04. 테스트

- Related Files:
  - `tests/boss-encounters.test.ts`, `tests/hud-snapshot.test.ts`, `tests/gatling-balance.test.ts`, `tests/three-stage-and-models.test.ts` — 시나리오 추가; modify

#### Details
- 보스를 쏴도 피버 게이지가 그대로이고, 부하를 잡으면 오른다.
- `dropRng`를 0.1로 고정하면 소환 부하는 아이템을 떨어뜨리고, 일반 몬스터는 떨어뜨리지 않는다.
- 대왕 모델 크기가 냉각기의 1.5배이고 애니메이션 뒤에도 유지된다.
- `isShielded` 옵션에 따라 `shieldMesh.visible`이 바뀐다.
- `buildHudSnapshot`이 보스 3대를 역할, 체력, 쉴드 상태와 함께 반환한다.
- 쉴드 중 `hp`가 표시용으로 정상 값이다.

## Acceptance Criteria
- [x] 보스를 쏘기만 해서는 피버가 차지 않는다.
- [x] 부하를 잡으면 피버가 차고 아이템이 자주 나온다.
- [x] 대왕이 눈에 띄게 크고, 쉴드 상태가 보인다.
- [x] 여러 보스의 체력이 각각 표시된다.
- [x] 보스 등장 전에 경고가 보인다.

## Validation
- `npx vitest run tests/boss-encounters.test.ts tests/hud-snapshot.test.ts tests/gatling-balance.test.ts tests/three-stage-and-models.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npm run dev`로 샌드박스에서 보스 표시 확인

## Commit Message
```text
feat(boss): reward minion kills and show multiple bosses

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P04-waves-and-bosses
Task: T05-boss-rewards-model-and-hud

- Grant no fever from boss body hits
- Raise item drops from summoned minions
- Scale the king model and show shield state
- Add multi-boss HUD panels and an encounter warning
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: feat(boss): reward minion kills and show multiple bosses
