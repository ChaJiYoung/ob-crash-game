# Task: T02 100% 연속 게이지 체력바, 콤보 UI 제거, 3D 카드/개틀링 스킬 시야 개선 및 보스 탭 레버 액션 구현

## Status: done

## Goal
`ArcadeOverlayHUD.tsx`, `JudgmentBanner.tsx`, `TargetModels3D.ts`, `ParticleEffects3D.ts`, `GameCanvas3D.tsx`, `PCGamePage.tsx`를 업데이트하여 ① 모든 몬스터 체력바를 100% 기준의 얇은 연속 게이지 바로 통일(데미지 입은 1HP 캔 포함) 및 보스 체력 정수 표기, ② 좌측 상단 콤보 UI 및 MISS 배너 제거와 킬 카드 게이지 표시, ③ 3D 선택 카드의 원형 링 제거 및 개틀링 스킬(`거품 해일`) 반투명 시야 확보, ④ 냉각기 보스의 상단 황금 탭 레버 당김 & 냉기 폭발 3D 소환 연출을 완성한다.

## Decision Summary
- **D02 & D06**: 좌측 상단 `COMBO` 배지를 제거하고, 몬스터 머리 위 체력바를 칸(Segment) 방식에서 **100% 기준의 매끄럽고 얇은 연속 게이지 바(`width: ${hpRatio * 100}%`)**로 전면 교체한다. 1HP 캔도 데미지를 입어 살아남았을 때(`hp < maxHp`) 즉시 게이지 바를 띄운다.
- **D05 & D06**: 보스 체력은 `Math.ceil(bossEntity.hp)`로 소수점 없이 표기하고, 보스가 부하 미니웨이브를 소환할 때(`isBossSummoning`) 상단 황금 생맥주 탭 레버가 앞으로 당겨지며 몸체가 진동하고 냉기 파티클이 뿜어져 나오는 3D 액션을 연출한다.
- **D06**: 3D 선택 카드 앞면을 가로지르던 원형 링(`borderRing`)을 제거하고, 개틀링 스킬 거품 구체 크기 축소 및 반투명화(`opacity: 0.42`)로 시야 가림을 해소하며, 피버 배지 텍스트 줄바꿈을 수정한다.

## Implementation

### I01. 100% 비율 연속 게이지 체력바, 콤보 UI 제거, 보스 HP 정수 표기 및 배너 정리 (`ArcadeOverlayHUD.tsx`, `JudgmentBanner.tsx`, `PCGamePage.tsx`)

- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `shouldRenderMonsterHpBar`, `formatFeverStatusBadge`, `ArcadeOverlayHUD` — 연속 게이지 바 렌더링, 1HP 피격 캔 체력바 표시, 콤보 배지 제거, 킬 카드 게이지 표시, 보스 HP `Math.ceil` 표기, 피버 배지 줄바꿈 수정; modify
  - `src/pc/components/JudgmentBanner.tsx` :: `getJudgmentBannerSpec` — 판정 배너 서브타이틀에 데미지 배율(`1.5x`, `1.0x`, `0.8x`) 표기 반영; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `MISS` 판정 시 화면 중앙 `JudgmentBanner`를 트리거하지 않도록 변경 및 `maxLives: engine.maxLives`를 `ArcadeOverlayHUD`에 전달; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/components/ArcadeOverlayHUD.tsx
  export function shouldRenderMonsterHpBar(
    maxHp: number,
    isItem?: boolean,
    isProjectile?: boolean,
    currentHp?: number
  ): boolean;
  ```
- **Data & Schema Fields**:
  - `ArcadeOverlayHUDProps`: `maxLives?: number` (기본값 `5`, `bar_repair` 보상 카드로 최대 체력이 늘어났을 때 하단 맥주잔 라이프 아이콘을 `maxLives`개만큼 렌더링)
  - `ProjectedMonsterHpBar`: `hp: number`, `maxHp: number` (`hpRatio = Math.max(0, Math.min(1, bar.hp / bar.maxHp))`)
- **Execution Flow / Logic**:
  1. Precondition & Validation:
     - `shouldRenderMonsterHpBar(maxHp, isItem, isProjectile, currentHp)`: `isItem` 또는 `isProjectile`이면 무조건 `false`. `currentHp !== undefined && currentHp < maxHp && currentHp > 0`이면 1HP 캔이라도 `true`를 반환하고, 그 외에는 `maxHp >= 2`일 때 `true`를 반환한다.
  2. Core Processing:
     - **100% 비율 연속 게이지 바 (`ArcadeOverlayHUD.tsx`)**:
       - 기존의 `Array.from({ length: segments })` 도트 칸 렌더링을 제거하고, 모든 몬스터에 동일한 **얇은 연속 게이지 바(`width: '44px'`, `height: '6px'`, 내부 채움 `width: '${Math.round(hpRatio * 100)}%'`)**를 렌더링한다.
     - **콤보 배지 제거 및 킬 카드 게이지·패시브 배율 표시 (`ArcadeOverlayHUD.tsx`)**:
       - 좌측 상단의 `{combo > 0 && (... COMBO)}` 블록을 제거하고, `waveProgress && waveProgress.luckyDropMultiplier > 1`일 때 `🍀 아이템 드롭 ${waveProgress.luckyDropMultiplier}배` 배지를 표시한다.
       - 상단 중앙 웨이브 진행바에 `🃏 카드 게이지: ${waveProgress.cardKillCount} / ${waveProgress.cardKillTarget} KILL`을 함께 표시한다.
       - 상단 보스 체력 텍스트를 `HP {Math.ceil(bossEntity.hp)} / {bossEntity.maxHp}`로 표기한다.
       - `formatFeverStatusBadge`: `isFeverActive`일 때 라벨을 `'🔥 FEVER ACTIVE (무한 연사·2배 화력)'`으로 간결화하여 우측 하단 320px 박스에서 줄바꿈이 깨지지 않게 한다.
     - **MISS 배너 비활성화 (`PCGamePage.tsx`)**:
       - `handleShootEvent`에서 `result.grade === 'MISS'`일 때 `setLastJudgment`를 호출하지 않도록 제거한다.
  3. Error & Exception Handling:
     - `bar.maxHp <= 0`인 비정상 엔티티에 대해 0 나누기(`NaN`)가 발생하지 않도록 `Math.max(0.001, bar.maxHp)`로 방어한다.
  4. State Transition & Return:
     - HUD가 매 프레임(체력바 투영은 30fps 스로틀) 연속 게이지 바와 정수 보스 체력을 렌더링한다.

### I02. 3D 선택 카드 가독성, 냉각기 보스 탭 레버 소환 액션 및 개틀링 스킬 반투명화 (`TargetModels3D.ts`, `ParticleEffects3D.ts`, `GameCanvas3D.tsx`)

- Related Files:
  - `src/pc/three/TargetModels3D.ts` :: `createTargetMesh3D`, `updateTargetAnimation3D`, `createCardTargetMesh3D`, `TargetAnimationOptions` — 카드 앞면 `borderRing` 제거, 보스 모델 상단 탭 핸들(`bossTapHandles`) 애니메이션 및 소환 경고 이펙트 추가; modify
  - `src/pc/three/ParticleEffects3D.ts` :: `ParticleEffects3D.spawnSkillEffect` — 개틀링 `거품 해일` 구체의 반경(`0.15~0.29`) 및 투명도(`opacity: 0.42`) 조정으로 시야 확보; modify
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3D` — `lucky_drop` 및 상향된 보상 카드 3D 텍스처 문구 연동, `shouldRenderMonsterHpBar`에 `target.hp` 전달, 보스 소환 상태(`isBossSummoning`) 애니메이션 연동; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/three/TargetModels3D.ts
  export interface TargetAnimationOptions {
    isStunned?: boolean;
    isSlowed?: boolean;
    isBossSummoning?: boolean;
  }
  ```
- **Data & Schema Fields**:
  - `bossRoot.userData.bossTapHandles: THREE.Mesh[]` (보스 상단 좌/우 황금 탭 레버 메쉬 2개 참조 배열)
- **Execution Flow / Logic**:
  1. Precondition & Validation:
     - `createCardTargetMesh3D`는 사각 카드 프레임과 앞/뒤 텍스트 평면만 유지하고 `borderRing` 토러스 메쉬를 생성하지 않는다.
  2. Core Processing:
     - `TargetModels3D.ts`:
       - `createTargetMesh3D('boss')`에서 상단 듀얼 탭 핸들(`tapHandle`) 2개를 `bossTapHandles` 배열에 담아 `root.userData.bossTapHandles = bossTapHandles`로 저장한다.
       - `updateTargetAnimation3D`: `kind === 'boss'`일 때 `options?.isBossSummoning === true`이면 `bossTapHandles`의 `rotation.x`를 `+0.65` (앞으로 당겨진 상태)로 회전시키고 몸체(`inner.position.x`)를 `Math.sin(elapsedSec * 38) * 0.08`로 진동시키며 스케일을 `1.06`배로 펄스시킨다. 평상시에는 `rotation.x = -0.22`로 복귀한다.
     - `ParticleEffects3D.ts`:
       - `spawnSkillEffect('gatling', ...)`: `foamCount = 48` (기존 테스트 조건 `>= 45` 충족), 구체 반경을 `0.15 + Math.random() * 0.14`, 투명도를 `opacity: 0.42`, 초기 높이를 `0.75`로 낮춰 전방 조준 시야 가림을 제거한다.
     - `GameCanvas3D.tsx`:
       - `target.rewardCardKind === 'lucky_drop'`에 대해 `title = '행운의 보급품'`, `sub = '아이템 드롭 빈도 ${engine.getNextLuckyDropMultiplier()}배 증가!\n처치 시 보급품 출현 대폭 상승'`, `col = '#a855f7'`, `ico = '🍀'`로 3D 카드를 생성한다.
       - `target.rewardCardKind === 'bar_repair'` 서브타이틀을 `'방어선 체력 100% 전체 회복!\n최대 체력 상한 +1 영구 확장'`으로 업데이트한다.
       - `updateTargetAnimation3D` 호출 시 `isBossSummoning: target.kind === 'boss' && engine.isBossSummoning(time)`을 전달한다.
       - `shouldRenderMonsterHpBar(target.maxHp, target.isItem, target.isProjectile, target.hp)`로 `target.hp`를 전달한다.
  3. Error & Exception Handling:
     - `bossTapHandles`가 없는 타겟 종류에 대해서는 배열 접근을 수행하지 않도록 `Array.isArray(targetGroup.userData?.bossTapHandles)` 가드를 둔다.
  4. State Transition & Return:
     - 3D 씬에서 카드 시야 가림과 개틀링 거품 시야 가림이 해소되고 보스 소환 시 탭 레버 액션이 재생된다.

### I03. HUD 게이지 바 및 3D 모델·파티클 테스트 업데이트 (`tests/pc-hud-and-banner.test.ts`, `tests/three-stage-and-models.test.ts`)

- Related Files:
  - `tests/pc-hud-and-banner.test.ts` :: `PC Fullscreen HUD & Judgment Banner` — `shouldRenderMonsterHpBar`에서 1HP 만땅(`hp=1, maxHp=1`)은 `false`, 데미지 입은 1HP 캔(`hp=0.2, maxHp=1`)은 `true`를 반환하는지 검증; modify
  - `tests/three-stage-and-models.test.ts` :: `3D Brewery Stage & 6 Target Models & 4 Item Meshes` — 보스 모델의 `bossTapHandles` 존재 및 `isBossSummoning: true` 애니메이션 동작, 개틀링 스킬 반투명 파티클 검증; modify

#### Details
- **Signatures & Types**: Vitest 테스트 스위트.
- **Data & Schema Fields**: `createTargetMesh3D('boss')`, `shouldRenderMonsterHpBar`.
- **Execution Flow / Logic**:
  1. Precondition & Validation: Three.js 그룹 및 HUD 헬퍼 함수 임포트.
  2. Core Processing:
     - `shouldRenderMonsterHpBar(1, false, false, 1)` ➔ `false`, `shouldRenderMonsterHpBar(1, false, false, 0.2)` ➔ `true`, `shouldRenderMonsterHpBar(2, false, false, 2)` ➔ `true` 검증.
     - `createTargetMesh3D('boss')`의 `userData.bossTapHandles` 배열 길이(`2`) 및 `updateTargetAnimation3D(bossMesh, 'boss', 1.0, 0.8, { isBossSummoning: true })` 호출 시 탭 레버 회전각(`rotation.x > 0.4`) 변화를 검증한다.
  3. Error & Exception Handling: N/A.
  4. State Transition & Return: 모든 테스트 통과.

## Acceptance Criteria
- [x] 모든 몬스터의 체력바가 칸(Segment)이 아닌 100% 기준의 얇은 연속 게이지 바로 표시되며, 1HP 캔도 `GOOD` 판정 등으로 데미지를 입어 체력이 남았을 때(`hp < maxHp`) 머리 위에 게이지 바가 즉시 나타난다.
- [x] 좌측 상단 HUD에서 `COMBO` 표시가 제거되고, 상단 보스 체력이 소수점 없는 정수로 표시되며, 우측 하단 피버 배지가 줄바꿈 깨짐 없이 한 줄로 표시된다.
- [x] 3D 선택 카드 앞면을 가로지르던 원형 링이 제거되고 카드 높이가 상향되어 1인칭 총기에 가려지지 않는다.
- [x] 개틀링 액티브 스킬 발동 시 구체 크기 축소 및 반투명화로 전방 시야가 가려지지 않으며, 냉각기 보스 소환 액션 시 상단 황금 탭 레버가 앞으로 당겨지는 3D 애니메이션이 작동한다.

## Validation
- `npm test -- tests/pc-hud-and-banner.test.ts tests/three-stage-and-models.test.ts` — 모든 테스트 통과

## Commit Message
```text
feat(ui): add 100% continuous HP bars, boss tap summon animation, and card/skill visual polish

Plan: 2026-11-04-combat-roguelike-boss-overhaul
Phase: P02-autofire-controls-and-3d-hud-polish
Task: T02-hud-gauge-bars-3d-boss-action-and-visual-polish

- Replace segmented dot HP bars with sleek 100% continuous gauge bars and show bar on damaged 1HP cans
- Remove combo HUD badge and MISS banner, format boss HP as integer, and fix fever badge line wrap
- Elevate 3D cards to 1.48m, remove obstructing border torus ring, and make gatling foam tsunami semi-transparent
- Animate boss draft tap handles pulling forward during minion mini-wave summoning
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: ad40017
