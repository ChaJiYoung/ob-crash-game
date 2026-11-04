# Task 02: PC 조준경 rAF Lerp 보간, 3D 카드 네온 테두리 시인성 복원, 시작 카드 안내 배너 및 60Hz 진단 상태 게이트 구현

- **Status**: done
- **Phase**: `P01-aim-sync-and-start-flow`
- **Plan**: `.memory/plans/2026-11-04-aim-sync-and-render-optimization.md`

## Goal
PC 화면의 `CrosshairOverlay`에 `requestAnimationFrame` 기반 Lerp 보간을 도입하여 60Hz 웹소켓 패킷 지터로 인한 조준경 순간이동을 제거하고, 어두운 배경에 묻히던 3D 무기/보상 선택 카드의 자체 발광 네온 테두리와 상단 안내 배너를 복원하며, 평상시 게임 플레이 중 60Hz React 진단 상태 업데이트를 차단한다.

## Decision Summary
- **D01 (`2026-11-04-aim-sync-and-start-flow-fix.md`)**: `CrosshairOverlayHandle.updatePosition(aimX, aimY, immediate?)`에서 모바일 센서 패킷 수신 시(`immediate = false`) 목표 좌표를 저장하고 `requestAnimationFrame` 루프(`lerpFactor = Math.min(1, dtSec * 28)`)로 현재 조준경 DOM 좌표를 매 프레임 부드럽게 보간한다. (단, 마우스 이동 및 기존 동기식 단위 테스트 호환을 위해 `immediate` 기본값은 `true`로 유지하고 `PCGamePage.tsx`의 `SENSOR_RELAY` 핸들러에서 `updatePosition(calX, calY, false)`를 호출한다.)
- **D02 (`2026-11-04-aim-sync-and-start-flow-fix.md`)**: `TargetModels3D.ts`의 `createCardTargetMesh3D`에서 `emissiveIntensity`를 `0.85`로 높이고, 카드 외곽을 감싸는 고휘도 `MeshBasicMaterial` 네온 보더 프레임 메쉬를 추가해 어두운 HDRI 배경에서도 선명하게 빛나도록 복원한다. 또한 `PCGamePage.tsx`에서 `gamePhase === 'PLAYING'`이고 `engine.isWeaponSelectPending || engine.isRewardCardPending`일 때 화면 상단 중앙에 네온 안내 배너(`🎯 원하는 무기를 사격하여 선택하세요! (SHOOT TO SELECT)` / `🃏 보상 카드를 사격하여 선택하세요!`)를 렌더링한다.
- **D03 (`2026-11-04-aim-sync-and-start-flow-fix.md`)**: `PCGamePage.tsx`의 `SENSOR_RELAY` 핸들러 내부에서 `recentRawSamplesRef` 표준편차 연산과 `setDiagnostics`, `setSensorLiveMetrics` 호출을 `isSensorLabOpenRef.current || gamePhaseRef.current === 'SANDBOX'` 조건문 내부로 격리한다.
- **D04 (`2026-11-04-aim-sync-and-start-flow-fix.md`)**: `PCGamePage.tsx`에서도 게임 시작(`PLAYING` 진입) 후 `1500ms` 유예 시간(`skillGraceUntilRef`) 및 카드 선택 대기 중(`engine.isWeaponSelectPending || engine.isRewardCardPending`)에는 `p.skillSnapTriggered`가 수신되어도 `executeSkill()`을 실행하지 않도록 이중 가드를 건다.

## Implementation
- [x] **I01**: `src/pc/components/CrosshairOverlay.tsx`의 `CrosshairOverlayHandle.updatePosition(aimX: number, aimY: number, immediate?: boolean)`에 목표 좌표 `targetPosRef`와 현재 좌표 `currentPosRef` 및 `requestAnimationFrame` 보간 루프(`lerpFactor = Math.min(1, dtSec * 28)`)를 구현한다.
- [x] **I02**: `src/pc/three/TargetModels3D.ts`의 `createCardTargetMesh3D`에서 카드 앞/뒤 `emissiveIntensity`를 `0.85`로 상향하고, 카드 테두리를 감싸는 고휘도 네온 프레임(`THREE.MeshBasicMaterial({ color: accentHex })`) 및 배면 글로우 플레이트를 추가해 시인성을 대폭 강화한다.
- [x] **I03**: `src/pc/PCGamePage.tsx`에서:
  1. `SENSOR_RELAY` 수신 시 `crosshairRef.current?.updatePosition(calX, calY, false)`로 부드러운 보간 모드를 호출한다.
  2. `isSensorLabOpenRef.current || gamePhaseRef.current === 'SANDBOX'`일 때만 `recentRawSamplesRef` 지터 계산 및 `setDiagnostics` / `setSensorLiveMetrics`를 실행한다.
  3. `skillGraceUntilRef`를 두어 `PLAYING` 전환 직후 `1500ms` 동안 및 `engine.isWeaponSelectPending || engine.isRewardCardPending` 동안 `p.skillSnapTriggered`를 무시한다.
  4. `gamePhase === 'PLAYING' && (engine.isWeaponSelectPending || engine.isRewardCardPending)`일 때 상단 중앙에 고시인성 카드 사격 안내 배너(`data-testid="card-select-guide-banner"`)를 표시한다.
- [x] **I04**: `tests/pc-hud-and-banner.test.ts` 및 `tests/three-stage-and-models.test.ts`에서 조준경 보간 인터페이스와 3D 카드 네온 프레임/발광 강도를 검증한다.

## Related Files
- `src/pc/components/CrosshairOverlay.tsx` (modify)
- `src/pc/three/TargetModels3D.ts` (modify)
- `src/pc/PCGamePage.tsx` (modify)
- `tests/pc-hud-and-banner.test.ts` (modify)
- `tests/three-stage-and-models.test.ts` (modify)

## Signatures & Types
```typescript
// src/pc/components/CrosshairOverlay.tsx
export interface CrosshairOverlayHandle {
  updatePosition: (aimX: number, aimY: number, immediate?: boolean) => void;
  triggerRecoil: () => void;
}
```

## Data & Schema Fields
- `CrosshairOverlayHandle.updatePosition`:
  - `aimX`: `number` (`-1` ~ `1`)
  - `aimY`: `number` (`-1` ~ `1`)
  - `immediate`: `boolean` (기본값 `true`, 모바일 센서 릴레이 시 `false` 전달하여 rAF Lerp 수행)
- `cardMesh.userData.hasNeonFrame`: `true` (`boolean`) - 3D 카드 외곽 자체 발광 네온 테두리 포함 여부 플래그

## Execution Flow / Logic
1. `CrosshairOverlay.tsx`:
   - `targetPosRef = useRef({ x: 0, y: 0 })`, `currentPosRef = useRef({ x: 0, y: 0 })`, `hasInitialPosRef = useRef(false)`를 유지한다.
   - `applyDomPosition(x, y)` 헬퍼가 `containerRef.current.style.left = `${((x + 1) / 2) * 100}%`` 및 `style.top = `${((1 - y) / 2) * 100}%``를 직접 갱신한다.
   - `updatePosition(aimX, aimY, immediate = true)` 호출 시:
     - `targetPosRef.current = { x: aimX, y: aimY };`
     - `if (immediate || !hasInitialPosRef.current || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function')`이면 `currentPosRef.current = { x: aimX, y: aimY }; hasInitialPosRef.current = true; applyDomPosition(aimX, aimY);`를 즉시 실행한다.
     - `immediate === false`이면 rAF 루프가 매 프레임 `dtSec`를 계산해 `alpha = Math.min(1, dtSec * 28)`로 `currentPosRef`를 `targetPosRef`로 보간하고 `applyDomPosition`을 호출한다. 목표와 거리가 `0.0005` 미만으로 수렴하면 `currentPosRef`를 스냅한다.
2. `TargetModels3D.ts` (`createCardTargetMesh3D`):
   - `frontMaterial`의 `emissive: new THREE.Color(accentHex)`, `emissiveIntensity: 0.85`로 설정하여 어두운 공간에서도 캔버스 카드 면이 선명하게 발광하도록 한다.
   - 카드 테두리 상·하·좌·우에 `THREE.MeshBasicMaterial({ color: accentHex })`로 구성된 네온 프레임 바(`borderGroup`)를 부착하고 `group.userData.hasNeonFrame = true`를 기록한다.
3. `PCGamePage.tsx`:
   - `SENSOR_RELAY`에서 `crosshairRef.current?.updatePosition(calX, calY, false)` 호출.
   - 진단 상태(`setDiagnostics`, `setSensorLiveMetrics`)는 `if (isSensorLabOpenRef.current || gamePhaseRef.current === 'SANDBOX')` 내부에서만 갱신.
   - `gamePhase === 'PLAYING' && (engine.isWeaponSelectPending || engine.isRewardCardPending)`일 때 상단 중앙에 `🎯 원하는 무기를 사격하여 선택하세요! (SHOOT TO SELECT)` 또는 `🃏 보상 카드를 사격하여 선택하세요! (SHOOT TO SELECT)` 배너를 표시한다.

## Acceptance Criteria
- `CrosshairOverlay`가 `updatePosition(x, y)`(기본 `immediate = true`)에서는 즉시 DOM 좌표를 갱신하고, `updatePosition(x, y, false)`에서는 목표 좌표를 향해 부드럽게 보간한다.
- `createCardTargetMesh3D`가 생성한 카드 메쉬에 `userData.hasNeonFrame === true`가 설정되고 앞면 머티리얼의 `emissiveIntensity`가 `0.8` 이상이다.
- 평상시 `PLAYING` 상태에서 `isSensorLabOpen === false`일 때 `SENSOR_RELAY`가 `setDiagnostics` / `setSensorLiveMetrics`를 호출하지 않는다.
- 기존 테스트 및 신규 검증 테스트가 모두 통과한다.

## Validation
```bash
npx vitest run tests/pc-hud-and-banner.test.ts tests/three-stage-and-models.test.ts
```

## Commit Message
```text
fix(pc): add rAF crosshair lerp, neon card frame, guide banner, and diag state gate

Plan: 2026-11-04-aim-sync-and-render-optimization
Phase: P01
Task: T02
```

## Progress
- 2026-11-04: I01~I04 구현 완료. CrosshairOverlay rAF Lerp 보간 추가, 3D 카드 emissive 0.85 및 네온 테두리 메쉬 복원, PCGamePage 상단 카드 사격 안내 배너 및 60Hz 진단 상태 게이트 격리, 스킬 유예 시간 가드 적용. Vitest 24개 테스트 통과.
