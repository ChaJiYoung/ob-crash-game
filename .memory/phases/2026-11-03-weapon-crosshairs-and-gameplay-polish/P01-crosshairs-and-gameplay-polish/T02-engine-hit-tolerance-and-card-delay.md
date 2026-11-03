# Task: T02 Engine Hit Tolerance, Reward Card Grace Period, 3D Card Upscaling & Fever Ammo Refill

## Status: done

## Goal
`BeerCrusherEngine.ts`에서 무기별 히트 판정 범위를 조준경과 1:1로 일치시켜 억울한 `MISS` 판정을 제거하고, 3D 보상/무기 선택 카드를 1.45배 대형화(`1.8m × 2.4m`, `z = -5.0m`, `hitRadiusM: 1.75`)하여 가독성과 사격 편의성을 극대화하며, 카드 스폰 직후 0.8초 사격 면역 딜레이 및 피버 즉시 탄창 100% 완충을 구현한다.

## Decision Summary
- 무기별 `weaponHitToleranceMult` 적용 (샷건 1.55, 개틀링 1.25, 리볼버 0.95 / 수직 dy 0.70).
- 보상/무기 선택 카드 3D 모델 크기 `1.25m × 1.65m ➔ 1.80m × 2.40m` 대형화, 폰트 확대, 스폰 위치 `z = -5.0m` 전진 배치, `hitRadiusM: 1.15 ➔ 1.75` 상향.
- 보상 카드 엔티티 스폰 시각(`rewardCardSpawnTimeMs`) 기록 후 `nowMs - rewardCardSpawnTimeMs < 800ms`인 경우 사격 타격 무시.
- `WeaponSystem`에 `refillAmmoOnFever()`를 추가하고 피버 발동 시 즉시 탄창 완충 및 재장전 취소.

## Implementation

### I01. Weapon-Specific Hit Tolerance & Miss Judgment Elimination
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `shootAt` — 무기별 판정 허용 반경 적용; modify

#### Details
- **Signatures & Logic**:
  ```typescript
  // Inside shootAt:
  const weaponHitToleranceMult =
    weaponKind === 'shotgun' ? 1.55 :
    weaponKind === 'gatling' ? 1.25 :
    0.95; // revolver

  const verticalScale = weaponKind === 'revolver' ? 0.70 : (target.customNormY !== undefined ? 1.0 : 0.85);

  const dy = target.customNormY !== undefined
    ? (aimY - proj.targetNormY)
    : (aimY - proj.targetNormY) * verticalScale;

  const dist = Math.hypot(dx, dy);
  const effectiveHitRadius = proj.apparentHitRadius * weaponHitToleranceMult;

  if (dist <= effectiveHitRadius) {
    const judgment = evaluateHitJudgment(dist, effectiveHitRadius, {
      isFeverActive: isFever,
      isPowerShotActive: isPowerShot,
      isWideScopeActive: isWideScope,
    });
    ...
  }
  ```

### I02. 3D Card Upscaling & Distance Optimization
- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createCardTargetMesh3D` — 카드 메쉬 및 캔버스 폰트 1.45배 대형화; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnWeaponSelectTargets`, `spawnWaveRewardCards` — 카드 배치 z=-5.0m 및 hitRadiusM 1.75 상향; modify

#### Details
- **Mesh Dimensions in TargetModels3D.ts**:
  - `BoxGeometry(1.80, 2.40, 0.08)`
  - `PlaneGeometry(1.74, 2.34)`
  - Canvas 2D Textures: Title 폰트 `50px`, 아이콘 `100px`, Subtitle `32px`, 버튼 뱃지 높이 `100px`, 폰트 `36px`
- **Engine Placement**:
  - `xPositions = [-2.4, 0, 2.4]`, `z = -5.0`
  - `hitRadiusM: 1.75` (기존 1.15에서 확대)

### I03. Reward Card 0.8s Grace Period (Anti-Misclick)
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnWaveRewardCards`, `shootAt` — 카드 사격 면역 시간 관리; modify

#### Details
- **Field**: `private rewardCardsSpawnTimeMs = 0;`
- **Spawn Logic**:
  ```typescript
  public spawnWaveRewardCards(nowMs: number): void {
    this.isRewardCardPending = true;
    this.rewardCardsSpawnTimeMs = nowMs;
    ...
  }
  ```
- **Shoot Logic**:
  ```typescript
  // If target is reward card, check grace period
  if (target.rewardCardKind) {
    if (nowMs - this.rewardCardsSpawnTimeMs < 800) {
      return { fired: true, grade: 'MISS' };
    }
    selectedCard = target.rewardCardKind;
    ...
  }
  ```

### I04. Instant Ammo Refill & Reload Cancel on Fever
- Related Files:
  - `src/pc/engine/WeaponSystem.ts` :: `refillAmmoOnFever` — 피버 발동 시 즉시 완충; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `triggerFeverBurst` / `update` — 피버 발동 트리거 시 호출; modify

#### Details
- **Method**:
  ```typescript
  public refillAmmoOnFever(): void {
    this.ammo = this.getMaxAmmo();
    this.isReloading = false;
    this.reloadEndTimeMs = 0;
  }
  ```
- 피버가 켜지는 시점(`scoreManager.activateFever()` 또는 `triggerFeverBurst()`)에 `this.weaponSystem.refillAmmoOnFever()`를 호출하여 딜레이 없이 즉시 난사 가능 상태로 전환.

## Acceptance Criteria
- [ ] 3D 보상 카드와 무기 선택 카드가 1.45배 대형화되어 화면에 시원하게 꽉 차고 텍스트가 선명하게 읽힌다.
- [ ] 카드의 피격 반경(`hitRadiusM`)이 1.75로 확장되어 손쉽게 사격 조준 및 선택이 가능하다.
- [ ] 샷건 조준경 원(지름 120px) 내부에 타겟이 위치할 때 100% 명중 판정(MISS 없음)된다.
- [ ] 보상 카드가 스폰된 후 800ms 이내 사격 시 카드가 선택되지 않고 유지되며, 800ms 이후 정상 사격 시 선택된다.
- [ ] 피버 발동 시 잔탄 0발이거나 재장전 중이더라도 즉시 100% 탄창이 완충되어 즉시 사격 가능하다.

## Validation
- `npx tsc --noEmit` — 0 errors
- `npx vitest run src/tests/` — 통과

## Commit Message
```text
feat(engine): upscale 3D cards, synchronize weapon hit tolerance, add reward card grace period and fever refill

Plan: 2026-11-03-weapon-crosshairs-and-gameplay-polish
Phase: P01-crosshairs-and-gameplay-polish
Task: T02-engine-hit-tolerance-and-card-delay

- Upscale 3D selection cards from 1.25x1.65m to 1.8x2.4m, bring forward to z=-5.0m, expand hitRadiusM to 1.75
- Apply weaponHitToleranceMult in BeerCrusherEngine.shootAt for shotgun (1.55x), gatling (1.25x), revolver (0.95x/vertical 0.70x)
- Add 800ms shoot immunity grace period to reward cards
- Add refillAmmoOnFever in WeaponSystem to cancel reload and refill ammo immediately
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
