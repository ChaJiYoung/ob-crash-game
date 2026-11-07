# Task: T06 3D 총 두 자루

## Status: done

## Goal
2인 판에서 화면 아래에 3D 총(`DraftTapGun3D`)을 플레이어마다 한 자루씩 띄운다(D21, 시안 3~6: 1P 왼쪽, 2P 오른쪽). 각 총은 자기 플레이어의 조준을 따라 돌고, 자기 무기·레벨 외형과 파워샷·스코프·피버 표시를 하며, 쏘면 자기 총만 반동하고 사격 광선은 자기 총구에서 나간다. 이탈자의 총은 숨긴다(D20). 1인 판은 지금처럼 가운데 한 자루.

## Decision Summary
- 총은 카메라 자식이라 화면 위치가 `basePosition.x`로 정해진다. 2인 오프셋은 시안 비율(1440px 기준 총 중심 x 525 / 915 → 화면 중심 대비 약 ∓0.27 폭)을 카메라 공간으로 옮긴 값 0.32(±)에서 시작하고 캡처로 조정한다. 총 위치는 인원수 분기가 아니라 표시 규칙 데이터다(D24): `PlayerPresentation`(P05-T01)에 `gunOffsetX: number`와 `gunRingColor: string | null`을 추가하고 `getPlayerPresentation`이 1인 `[0]`/null, 2인 `[-0.32, +0.32]`/플레이어 색을 준다. 오프셋 값 자체는 `src/pc/playerPresentation.ts`의 `GUN_OFFSETS_BY_COUNT = { 1: [0], 2: [-0.32, 0.32] }` 상수.
- 총 받침 고리(시안 `.ring`)는 플레이어 색 발광 링으로 표시해 누구 총인지 구분한다.

## Implementation

### I01. 총 클래스

- Related Files:
  - `src/pc/three/DraftTapGun3D.ts` :: `DraftTapGun3D`; modify
  - `src/pc/playerPresentation.ts` :: `PlayerPresentation.gunOffsetX`, `gunRingColor`, `GUN_OFFSETS_BY_COUNT`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // DraftTapGun3D
  /** 화면 좌우 배치. 0이면 가운데(1인). */
  public setSlotOffset(offsetX: number): void;   // basePosition.x = 원래 x + offsetX, group.position.x 즉시 반영
  /** 플레이어 색 받침 링. null이면 숨김(1인). */
  public setPlayerColor(hex: string | null): void;
  public setVisible(visible: boolean): void;      // group.visible
  public dispose(): void;                          // 이 총이 만든 메시·재질 해제(공용 캐시 재질은 해제하지 않음)
  ```
- 받침 링: 생성자에서 `TorusGeometry(0.11, 0.012, 8, 32)`를 총 그립 아래(`grip` 위치 기준 y −0.2)에 만들고 기본 `visible = false`. `setPlayerColor`가 `MeshBasicMaterial` 색을 바꾸고 보이게 한다.
- 조준 회전(`updateAimAndRecoil`)은 그대로 쓴다. 오프셋된 총이 화면 중앙 기준으로 돌면 조준점과 어긋나 보이므로, `targetRotY = -aimX * 0.58 + this.slotOffsetX * GUN_YAW_COMP`처럼 오프셋만큼 안쪽으로 보정하는 항을 **항상** 더한다(가운데 총은 오프셋 0이라 지금과 같다. `GUN_YAW_COMP = 0.35`, 캡처로 조정).

### I02. 캔버스

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `tapGunRef` → `tapGunsRef`, 생성부(391행 부근), 애니메이션 루프의 외형·조준 갱신(705~718행 부근), `playShotFx`, `GameCanvas3DHandle.setAim`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  const tapGunsRef = useRef<DraftTapGun3D[]>([]);
  interface GameCanvas3DHandle {
    setAim: (aimX: number, aimY: number, immediate?: boolean, playerIndex?: PlayerIndex) => void; // 기본 0
    /* 기존 */
  }
  ```
- **Execution Flow / Logic**:
  1. 처음엔 1자루(기존). 매 프레임 `engine.players.length`와 `tapGunsRef.current.length`가 다르면 맞춘다: 늘 때 `new DraftTapGun3D()`를 `camera.add`, 줄 때 `camera.remove` + `dispose()`. 배치·색은 캔버스 prop `gunPresentations: { offsetX: number; ringColor: string | null }[]`(= `presentations.map(…)`)에서 읽는다 — 캔버스는 인원수를 보지 않는다. 총 개수 = 이 배열 길이.
  2. 총별 조준값 `gunAimsRef: { target: {aimX,aimY}; current: {aimX,aimY} }[]`. `setAim(x, y, immediate, i)`가 i번 목표를 바꾼다. 기존 단일 `targetAimRef`/`currentAimRef`는 0번 항목으로 대체(마우스 조준이 0번일 때 갱신하던 P04-T04 로직도 `mousePlayerIndex`번 항목을 갱신하도록).
  3. 애니메이션 루프: 플레이어 i마다 `engine.getPlayer(i)`의 무기 외형(`setWeaponAppearance`), `setPowerMode(engine.isBuffActive('power_shot', time, i))`, `setScopeMode(…'wide_scope'…, i)`, `updateAimAndRecoil(current.aimX, current.aimY, dtSec, 그 플레이어 피버)`, `setVisible(!engine.getPlayer(i).isAway)`.
  4. `playShotFx(result, aim?)`: `const gun = tapGunsRef.current[result.playerIndex] ?? tapGunsRef.current[0]`; 반동은 그 총만, 광선 시작점 `gun.getMuzzleWorldPosition(camera)`.
  5. 스킬 연출(`triggerSkillEffect`)이 총 위치를 쓰면 `playerIndex` 인자를 받아 그 총 기준으로.
  6. PC 페이지(P04-T04 처리부 `onAim`): `index === 0`일 때만 `setAim` 하던 것을 모든 index에 `canvasRef.current?.setAim(x, y, false, index)`로.

### I03. 테스트

- Related Files:
  - `tests/three-stage-and-models.test.ts`; modify(총 단위 테스트 추가)

#### Details
- `new DraftTapGun3D()` → `setSlotOffset(0.32)` 후 `group.position.x`가 기본보다 0.32 큼. `setPlayerColor('#ff6b3d')` → 링 보임, 색 일치. `setPlayerColor(null)` → 링 숨김.
- 오프셋 0일 때 `updateAimAndRecoil` 결과 회전이 기존과 같음(1인 회귀).

## Acceptance Criteria
- [ ] 2인 판: 총 두 자루가 좌우에 있고 각자 조준·무기 외형·반동·광선이 따로 움직인다(시안 5와 비교).
- [ ] 이탈자 총이 사라지고 복귀하면 다시 보인다.
- [ ] 1인 판: 가운데 한 자루, 기존과 동일.

## Validation
- `npx vitest run tests/three-stage-and-models.test.ts tests/render-budget.test.ts` — 통과(그리기 호출 예산 테스트가 총 2자루로 넘치면 2인 판 예산 기준을 따로 둔다 — 1인 기준은 바꾸지 않는다)
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동 캡처: 2인 무기 선택·전투 화면을 시안 3·5와 비교, FPS가 1인 대비 크게 떨어지지 않는지 센서 랩 FPS 표시로 확인

## Commit Message
```text
feat(stage): one 3D gun per player in coop runs

Plan: 2026-11-07-two-player-coop
Phase: P05-hud-screens
Task: T06-two-guns

- Coop runs place 1P's gun on the left and 2P's on the right with a player-color ring
- Each gun follows its player's aim, weapon look, buffs and recoil; tracers start at its muzzle
- Away players' guns hide; solo keeps the single center gun

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 2f85d92
