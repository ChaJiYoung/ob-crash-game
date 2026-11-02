# Task: T02 PC 화면 조준경(CrosshairOverlay) 에메랄드 그린 락온 시각 효과 및 로비/인게임 사격 연동

## Status: done

## Goal
PC 화면의 조준경(`CrosshairOverlay`)에 모바일 컨트롤러의 코킹 상태(`isCocked`)를 실시간으로 반영하여, 플레이어가 화면을 터치해 조준을 고정했을 때 조준경이 선명한 에메랄드 그린 컬러(`#10b981`)로 빛나고 모서리 락온(Lock-on) 괄호 프레임이 나타나도록 시각 피드백을 강화한다. 또한 로비 대기실(`PAIRING`, `ZEROING`) 화면에서도 인게임과 완전히 동일하게 "터치 다운으로 조준 고정 ➔ 휙 채어 시작 과녁 사격"이 일관되게 작동하도록 연동한다.

## Decision Summary
- [D04](../../decisions/2026-11-02-cocking-aim-lock-and-snap-fire.md): PC 조준경(Crosshair) 조준 고정 시 선명한 에메랄드 그린(`#10b981`) 및 락온 프레임 시각 피드백 적용
- [D05](../../decisions/2026-11-02-cocking-aim-lock-and-snap-fire.md): 로비 대기실(시작 과녁)에서도 동일한 코킹 조준 고정 및 스냅 사격 메커니즘 일관 적용

## Implementation

### I01. CrosshairOverlay 조준 고정(Aim Lock) 비주얼 스펙 및 락온 괄호 UI 확장

- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairVisualSpecOptions`, `getCrosshairVisualSpec`, `CrosshairOverlay` — `isAimLocked` prop 및 에메랄드 그린 락온 괄호 프레임 렌더링; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 모바일 `SENSOR_RELAY`의 `isCocked` 플래그 수신하여 조준 고정 상태 관리 및 `CrosshairOverlay`에 전달; modify
  - `tests/pc-hud-and-banner.test.ts` :: `CrosshairVisualSpec` — 락온 상태 시각 스펙 유닛 테스트 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/components/CrosshairOverlay.tsx
  export interface CrosshairVisualSpecOptions {
    isFeverActive?: boolean;
    isWideScopeActive?: boolean;
    isPowerShotActive?: boolean;
    isAimLocked?: boolean; // 새 프로퍼티
  }

  export interface CrosshairOverlayProps {
    aimX: number;
    aimY: number;
    isFeverActive?: boolean;
    isWideScopeActive?: boolean;
    isPowerShotActive?: boolean;
    isAimLocked?: boolean; // 새 프로퍼티
    shotTriggerKey?: number;
  }
  ```
- **Visual Spec Priority & Styling**:
  1. `getCrosshairVisualSpec(options)` 우선순위:
     - `isFeverActive`: 골드 `#fbbf24` (최우선)
     - `isPowerShotActive`: 레드 `#ef4444`
     - `isAimLocked`: 에메랄드 그린 `#10b981`, 글로우 `rgba(16, 185, 129, 0.65)`, 뱃지 `AIM LOCKED`
     - 일반 기본: 시안 블루 `#38bdf8`
  2. 락온 프레임 렌더링:
     - `isAimLocked === true`일 때 조준점 둘레에 4방향 모서리 괄호(`┌ ┐ └ ┘`) 프레임 표시 및 미세한 스케일 펄스 애니메이션 적용.

### I02. PCGamePage 로비 및 인게임 조준 고정 플래그 바인딩

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — 로비 및 인게임 모든 단계에서 `isCocked` 상태를 받아 `CrosshairOverlay`에 전달; modify
  - `tests/pc-modals-and-pairing.test.ts` :: `Lobby & InGame Crosshair` — 조준 고정 상태 전파 검증; modify

#### Details
- **Execution Flow / Logic**:
  1. `PCGamePage` 내부 상태:
     - `const [isAimLocked, setIsAimLocked] = useState(false);`
  2. `socket.onmessage` 수신부 (`case 'SENSOR_RELAY'`):
     - `const isLocked = Boolean(p.isCocked && !feverState.isFeverActive);`
     - `setIsAimLocked(isLocked);`
  3. 로비 및 인게임 렌더부:
     - `<CrosshairOverlay ... isAimLocked={isAimLocked} />` 전달.
  4. 로비 시작 과녁 사격 (`p.snapFire`):
     - 로비에서도 `p.snapFire` 시점에 고정되어 전달된 `p.aimX, p.aimY`를 기준으로 중앙 시작 과녁 범위 판정 수행하여 일관된 사격 반응 보장.

## Acceptance Criteria
- [ ] 모바일에서 화면을 터치하고 있는 동안 PC 화면 조준경이 에메랄드 그린(`#10b981`)으로 빛나며 `AIM LOCKED` 뱃지와 모서리 락온 프레임이 나타난다.
- [ ] 휙 채어 1발 발사되거나 터치를 떼면 락온 효과가 즉시 해제되어 일반 조준선으로 돌아온다.
- [ ] 로비 대기실 화면에서도 시작 과녁을 향해 터치하여 조준을 고정한 뒤 휙 채어 게임을 시작할 수 있다.
- [ ] `tests/pc-hud-and-banner.test.ts` 및 전체 테스트 통과.

## Validation
- `npx vitest run tests/pc-hud-and-banner.test.ts` — 조준경 락온 시각 스펙 테스트 통과
- `npx vitest run` — 전체 테스트 통과
- `npm run build` — 프로덕션 빌드 성공

## Commit Message
```text
feat(pc): add emerald-green lock-on visual feedback to crosshair and unify lobby snap-fire

Plan: 2026-11-02-cocking-aim-lock-and-snap-fire
Phase: P01-cocking-aim-lock-and-snap-fire
Task: T02-crosshair-lock-visual-fx-and-lobby-integration

- Render emerald-green glow and corner bracket lock-on frame when isAimLocked is true
- Bind isCocked sensor frame flag to PC crosshair across lobby and in-game phases
- Ensure lobby start-target hit detection honors stabilized locked aim coordinates
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
