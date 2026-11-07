# Task: T03 선택 화면(무기·보상 카드)

## Status: done

## Goal
2인 판의 무기·카드 선택 화면을 시안 3·4·6대로 만든다: 화면 좌우 절반 배경(왼쪽 파랑, 오른쪽 주황 그라데이션)과 가운데 점선, 카드 테두리를 주인 색으로 칠하고 카드 위에 `1P`/`2P` 소유 배지, 상단 안내 문구, 먼저 고른 쪽 절반에는 "✓ 황금 병따개 선택 완료 / 1P 선택을 기다리는 중…" 상자(D13, 시간 제한 없음 D34). 1인 선택 화면은 그대로.

## Decision Summary
- 카드 표적 배치·크기 배율·타임아웃은 엔진(P02-T03)이 정했다. 이 Task는 그리기와, 고른 항목 이름을 화면에 보여 주기 위한 엔진 필드 하나(`lastPick`)만 더한다.
- 시안 문구: 무기 "각자 시작 무기를 쏴서 고르세요 / 내 색 십자선으로 내 카드만 맞힐 수 있어요", 한쪽 완료 후 "1P 선택 중 · 2P 선택 완료 / 1P가 고르면 게임이 시작됩니다", 카드 "보상 카드를 쏴서 고르세요 / 둘 다 고르면 게임이 다시 시작됩니다".

## Implementation

### I01. 엔진: 고른 항목 기록

- Related Files:
  - `src/pc/engine/PlayerCombatState.ts` :: `lastPick`; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `applySelection`(P02-T03 헬퍼), 라운드 열기; modify

#### Details
- `public lastPick: { weapon?: WeaponKind; card?: RewardCardKind; auto: boolean } | null = null;` — 라운드 열 때 null, 고를 때(자동 포함) 기록.

### I02. 스냅샷

- Related Files:
  - `src/pc/hudSnapshot.ts` :: `HudSnapshot.selection`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  selection: {
    kind: 'weapon' | 'card' | null;
    done: boolean[];
    /** 플레이어별 고른 항목 표시 이름(WEAPON_ARCHETYPE_SPECS[k].nameKo / REWARD_CARD_SPECS[k].nameKo), 없으면 null. */
    pickedLabels: (string | null)[];
  };
  ```
  `engine.getSelectionStatus()` + 각 `p.lastPick`. 비교 함수에 `JSON.stringify(selection)` 추가.

### I03. 3D 카드

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: 카드 메시 생성 분기(현재 601~629행), 카드 애니메이션 분기(669행 부근); modify
  - `src/pc/three/TargetModels3D.ts` :: `createCardTargetMesh3D` — 시그니처 확인용; read-only

#### Details
- 카드 종류 색은 그대로 둔다(D23): `col`은 지금처럼 무기 색/`REWARD_CARD_SPECS[kind].colorHex`.
- 주인 테두리 색은 `GameCanvas3DProps.ownerOutlineColors: (string | null)[]`(= `presentations.map(p => p.ownerOutlineColor)`)로 받는다. 값이 있으면: `src/pc/three/TargetModels3D.ts`에 `addCardOwnerOutline3D(card: THREE.Group, ownerColorHex: string): void`를 새로 만들어 카드 바깥에 플레이어 색 테두리 한 겹을 덧씌운다. 기존 테두리(`card-border-h-geo` 1.82×두께0.04)보다 바깥: 가로 막대 `BoxGeometry(1.98, 0.07, 0.1)` 위·아래(y ±1.235), 세로 막대 `BoxGeometry(0.07, 2.54, 0.1)` 좌·우(x ±0.955), z는 기존 테두리와 같은 면, 재질 `MeshBasicMaterial({ color: ownerColorHex })`를 `getCachedMaterial(\`card-owner-outline-${ownerColorHex}\`)`로 캐시, 형상도 `getCachedGeometry`로 캐시. 결과: 안쪽 줄은 카드 종류 색(예: 공격력 빨강), 바깥 줄은 1P 파랑/2P 주황.
- 값이 null(1인)이면 붙이지 않는다 — 분기가 아니라 색 데이터 유무.
- `target.modelScaleMult`가 있으면 카드 메시에도 `mesh.scale.setScalar(target.modelScaleMult)`(현재는 일반 몬스터 분기에서만 적용).
- 행운 카드 문구: `engine.getNextLuckyDropMultiplier(target.ownerIndex ?? 0)`.
- 소유 배지는 3D가 아니라 HTML 오버레이(I04)로 그린다.

### I04. HTML 오버레이

- Related Files:
  - `src/pc/components/SelectRoundOverlay.tsx` :: `SelectRoundOverlay`; new
  - `src/pc/PCGamePage.tsx` :: PLAYING 렌더, 기존 카드 안내 배너 위치; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface SelectRoundOverlayProps {
    selection: HudSnapshot['selection'];
    presentations: PlayerPresentation[]; // P05-T01
    /** 카드 소유 배지를 카드 위에 띄우려고 엔진 표적의 화면 좌표를 받는다(MonsterHpBarLayer와 같은 투영 데이터). */
    cardAnchors: { ownerIndex: PlayerIndex; leftPercent: number; topPercent: number }[];
  }
  ```
- 인원수를 보지 않고 데이터로만 그린다(D24):
  - `selection.kind === null` → 렌더 없음.
  - 좌우 배경·가운데 점선: `presentations`에 `panelSide`가 서로 다른 항목이 2개 이상일 때만(1인은 1개라 자연히 없음 → 지금 1인 화면 유지).
  - 완료/대기 상자: 고른 사람과 아직 안 고른 사람이 둘 다 있을 때만(1인은 생길 수 없음).
  - 소유 배지: `presentation.slotLabel`이 있을 때만.
  - 상단 배너 문구: 플레이어가 여러 명이면 시안 문구, 아니면 지금 1인 안내 문구(기존 배너를 이 컴포넌트로 옮겨 한 곳에서).
- 배경: 왼쪽 절반 `linear-gradient(90deg, rgba(56,189,248,.14), transparent)`, 오른쪽 `linear-gradient(270deg, rgba(255,107,61,.14), transparent)`, 가운데 `2px dashed rgba(255,255,255,.35)` 세로선(위 140px~아래 300px, 시안).
- 상단 배너(22px 800, 가운데): I의 문구. 한쪽 완료면 `{대기쪽}P 선택 중 · {완료쪽}P 선택 완료`.
- 시안 6의 "남은 시간 7초 · 시간이 지나면 자동 선택" 칩은 그리지 않는다(D34: 시간 제한 없음).
- 완료한 쪽 절반 가운데: 테두리 플레이어 색 상자 `[배지] ✓ {pickedLabel} 선택 완료` + 작은 글씨 `{상대}P 선택을 기다리는 중…`.
- 소유 배지: `cardAnchors`마다 카드 위 22px에 `1P`/`2P` 칩(배경 플레이어 색, 글자 `#111`).
- `cardAnchors`는 `GameCanvas3D`의 `onMonsterProjectionsUpdate`(현재 `MonsterHudProjection`)에 `ownerIndex` 필드를 추가해 카드 표적도 투영 목록에 넣어 얻는다(275행의 필터가 카드를 빼고 있으므로, 카드용 투영을 별도 배열로 같이 넘기거나 필터를 조정).

### I05. 테스트

- Related Files:
  - `tests/coop-select-overlay.test.tsx`; new

#### Details
- 1인 presentations(1개) + selection → 좌우 배경·대기 상자·배지 없음, 1인 안내 문구만.
- 2인, done `[false, true]`, picked `[null, '황금 병따개']`, → "1P 선택 중 · 2P 선택 완료", "✓ 황금 병따개 선택 완료", "1P 선택을 기다리는 중", 남은 시간 문구 없음.
- 스냅샷: 2인 엔진 무기 라운드에서 2P가 고르면 `selection.pickedLabels[1] === WEAPON_ARCHETYPE_SPECS.revolver.nameKo`.

## Acceptance Criteria
- [x] 2인 무기·카드 선택 화면이 시안 3·4·6과 같은 배치로 보인다(카드 6장이 화면 안에 겹치지 않음, 16:9).
- [x] 카드 안쪽 테두리는 카드 종류 색, 바깥 테두리는 주인 색이다(D23).
- [x] 1인 선택 화면은 그대로다.

## Validation
- `npx vitest run tests/coop-select-overlay.test.tsx` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동 캡처: 1440×900 창에서 2인 무기 선택 시작 직후 / 2P 선택 후 / 보상 카드 화면을 시안 3·4·6과 비교. 4:3 창에서도 카드가 화면 밖으로 나가지 않는지 확인.

## Commit Message
```text
feat(hud): split-screen select view with owner badges and pick status

Plan: 2026-11-07-two-player-coop
Phase: P05-hud-screens
Task: T03-select-screen

- Coop cards keep their type color and get an outer outline in the owner's color; 1P/2P badges float above them
- Overlay shows the halves and the "선택 완료 / 기다리는 중" status (no timer)
- Engine records each player's last pick for the status box

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
