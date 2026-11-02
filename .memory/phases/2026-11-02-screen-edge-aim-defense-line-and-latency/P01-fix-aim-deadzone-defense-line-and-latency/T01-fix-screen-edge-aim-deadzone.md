# Task: T01 Fix Screen Edge Aim Deadzone

## Status: pending

## Goal
몬스터 스폰 범위를 화면 가로 80% 안전 구역(`FAN_MARGIN_RATIO = 0.80`)으로 집중시켜 몬스터가 모니터 베젤 바깥으로 삐져나가는 현상을 원천 방지하고, 조준선(`CrosshairOverlay`)의 화면 좌우 도달 범위를 기존 8%~92%에서 3%~97%로 전역 확장하여 화면 가장자리에 있는 적을 100% 명중시킬 수 있도록 개선한다.

## Decision Summary
- **D01**: `STAGE_CONSTANTS.FAN_MARGIN_RATIO`: `0.92` ➔ `0.80`
- `CrosshairOverlay.tsx`:
  - `aimToViewportPercent`: `left = 50 + clamp(aimX) * 47` (범위: [3%, 97%])
  - `aimToNdc`: `ndcX = (leftPercent - 50) / 50` (최대 [-0.94, +0.94])
  - `viewportRatioToAim`: `aimX = clamp(normX / 0.94)`

## Implementation

### I01. 몬스터 스폰 가로 안전 마진 비율 조정
- Related Files:
  - `src/shared/constants.ts` :: `STAGE_CONSTANTS` — modify
  - `tests/shared-protocol.test.ts` — modify

#### Details
- **Signatures & Constants**:
  ```typescript
  export const STAGE_CONSTANTS = {
    SPAWN_RADIUS_M: 24.0,
    DEFENSE_LINE_RADIUS_M: 1.8,
    CAMERA_FOV_DEG: 52,
    FAN_MARGIN_RATIO: 0.80, // 기존 0.92 -> 0.80 안전 구역 집중
    PLAYER_MAX_LIVES: 5,
    TOTAL_WAVES: 5,
    ITEM_DURATION_MS: 8000,
  } as const;
  ```

### I02. 조준선 뷰포트 도달 범위 및 NDC 변환 정합성 확장
- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `aimToViewportPercent`, `aimToNdc`, `viewportRatioToAim` — modify
  - `tests/pc-hud-and-banner.test.ts` — modify

#### Details
- **Signatures & Math Equations**:
  ```typescript
  export function aimToViewportPercent(
    aimX: number,
    aimY: number
  ): { leftPercent: number; topPercent: number } {
    // Clamps within [3%, 97%] horizontally and [8%, 92%] vertically
    const left = 50 + Math.max(-1, Math.min(1, aimX)) * 47;
    const top = 50 - Math.max(-1, Math.min(1, aimY)) * 42;

    return {
      leftPercent: Math.max(3, Math.min(97, left)),
      topPercent: Math.max(8, Math.min(92, top)),
    };
  }

  export function aimToNdc(aimX: number, aimY: number): { ndcX: number; ndcY: number } {
    const { leftPercent, topPercent } = aimToViewportPercent(aimX, aimY);
    return {
      ndcX: (leftPercent - 50) / 50, // [-0.94, +0.94]
      ndcY: (50 - topPercent) / 50,  // [-0.84, +0.84]
    };
  }

  export function viewportRatioToAim(normX: number, normY: number): { aimX: number; aimY: number } {
    return {
      aimX: Math.max(-1, Math.min(1, normX / 0.94)),
      aimY: Math.max(-1, Math.min(1, normY / 0.84)),
    };
  }
  ```

## Acceptance Criteria
- [ ] `STAGE_CONSTANTS.FAN_MARGIN_RATIO`가 `0.80`으로 설정된다.
- [ ] `aimX = 1.0`일 때 조준선 `leftPercent`가 `97%`에 도달하여 화면 모서리 끝까지 조준할 수 있다.
- [ ] `aimX = -1.0`일 때 `leftPercent`가 `3%`에 도달한다.
- [ ] 기존 및 신규 테스트 전체 통과.
- [ ] `npm run build` 성공.

## Validation
- `npx vitest run tests/shared-protocol.test.ts tests/pc-hud-and-banner.test.ts` — 변경된 상수 및 조준선 뷰포트 좌표 검증
- `npm run build` — 빌드 성공 확인

## Commit Message
```text
feat(crosshair): expand viewport coverage to 3%-97% and focus spawn margin ratio to 0.80

Plan: 2026-11-02-screen-edge-aim-defense-line-and-latency
Phase: P01-fix-aim-deadzone-defense-line-and-latency
Task: T01-fix-screen-edge-aim-deadzone

- Update STAGE_CONSTANTS.FAN_MARGIN_RATIO from 0.92 to 0.80 to keep targets inside screen
- Expand CrosshairOverlay horizontal clamp to [3%, 97%] and update NDC factor to 0.94
- Eliminate right-edge aiming deadzone completely
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
