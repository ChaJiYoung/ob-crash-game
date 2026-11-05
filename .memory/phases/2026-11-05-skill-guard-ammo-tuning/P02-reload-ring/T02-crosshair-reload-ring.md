# Task: T02 조준점 장전 게이지 링

## Status: pending

## Goal
장전 중에 PC 조준점 둘레에 링이 장전 시간(`reloadDurationMs`) 동안 시계 방향으로 차오르게 한다. 장전이 끝나거나 피버가 시작되면 사라진다. 플레이어가 "왜 안 쏴지지?"를 조준점에서 바로 알게 하려는 것이다.

## Decision Summary
- 결정 D05: PC 조준점 게이지 링만. 모바일·프로토콜 변경 없음. 피버(무한 탄약) 중에는 표시하지 않는다.
- **함정 1**: 프로젝트 어디에도 `@keyframes`가 정의돼 있지 않다(`CrosshairOverlay`의 `animation: 'spin 2s linear infinite'`는 정의가 없어 실제로는 동작하지 않는다). 그래서 링은 컴포넌트 안에 `<style>`로 keyframes를 직접 넣는다. 전역 CSS에 의존하지 않는다.
- **함정 2**: `CrosshairOverlay`는 `React.memo`이고 컨테이너 `style`의 `left/top/transform`을 DOM으로 직접 바꾼다. 링은 컨테이너의 **자식**으로만 추가해 위치·반동 갱신 경로를 건드리지 않는다.
- **함정 3**: 장전 시작 시 애니메이션을 처음부터 돌리려면 링 요소가 `isReloading`이 true가 될 때 새로 마운트돼야 한다. 조건부 렌더(`{showRing && <svg .../>}`)로 쓰고, 항상 렌더한 채 클래스만 바꾸지 않는다.

## Implementation

### I01. 링 표시 조건과 스펙 함수
- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `getReloadRingSpec`(new), `CrosshairOverlayProps`, `CrosshairOverlay` — 링 추가; modify
  - `src/pc/PCGamePage.tsx` :: 세 곳의 `<CrosshairOverlay ... />` (대략 930행 PLAYING, 959행 튜토리얼, 1042행 훈련장/샌드박스) — props 전달; modify

#### Details
- **Signatures & Types**:
  ```ts
  export interface CrosshairOverlayProps {
    // 기존 props ...
    /** 장전 중이면 true. 피버 중에는 링을 그리지 않는다. */
    isReloading?: boolean;
    /** 링이 차오르는 시간(ms). HudSnapshot.reloadDurationMs. */
    reloadDurationMs?: number;
    /** 일시정지·카드 선택 중이면 true: 링 애니메이션을 멈춘다. */
    isPaused?: boolean;
  }

  /** 순수 함수: 링을 그릴지, 크기와 색을 정한다. 테스트하기 쉽게 컴포넌트 밖에 둔다. */
  export function getReloadRingSpec(options: {
    isReloading?: boolean;
    isFeverActive?: boolean;
    reloadDurationMs?: number;
    sizePx: number;
  }): { visible: boolean; diameterPx: number; radiusPx: number; circumferencePx: number; durationMs: number; color: string };
  ```
- `getReloadRingSpec` 규칙: `visible = Boolean(isReloading) && !isFeverActive && (reloadDurationMs ?? 0) > 0`. `diameterPx = sizePx + 16`(조준점보다 8px 바깥), `radiusPx = diameterPx / 2 - 3`, `circumferencePx = 2π × radiusPx`, `durationMs = reloadDurationMs ?? 0`, `color = '#f87171'`(HUD의 장전 글자색과 동일한 빨강; 다 찬 순간 구분은 필요 없음).
- 렌더(컨테이너 `div` 안, 기존 무기별 조준점 그림 뒤에 추가):
  ```tsx
  {ring.visible && (
    <>
      <style>{`@keyframes reload-ring-fill { from { stroke-dashoffset: ${ring.circumferencePx}; } to { stroke-dashoffset: 0; } }`}</style>
      <svg width={ring.diameterPx} height={ring.diameterPx} style={{ position: 'absolute', transform: 'rotate(-90deg)', pointerEvents: 'none' }} aria-hidden>
        <circle cx={ring.diameterPx/2} cy={ring.diameterPx/2} r={ring.radiusPx} fill="none" stroke="rgba(248,113,113,0.25)" strokeWidth={4} />
        <circle cx={ring.diameterPx/2} cy={ring.diameterPx/2} r={ring.radiusPx} fill="none" stroke={ring.color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={ring.circumferencePx}
          style={{ animation: `reload-ring-fill ${ring.durationMs}ms linear forwards`, animationPlayState: isPaused ? 'paused' : 'running', filter: 'drop-shadow(0 0 6px rgba(248,113,113,0.8))' }} />
      </svg>
    </>
  )}
  ```
  `rotate(-90deg)`는 12시 방향에서 시작하게 한다. 컨테이너의 `scale(...)` 반동과 함께 커졌다 작아져도 괜찮다.
- `PCGamePage.tsx` 세 곳 모두에 `isReloading={hudState.isReloading}`, `reloadDurationMs={hudState.reloadDurationMs}`, `isPaused={hudState.isPaused || hudState.isRewardCardPending || hudState.isWeaponSelectPending}`를 추가한다. 튜토리얼 곳도 포함한다(튜토리얼도 장전한다).
- 알려진 한계(허용): 장전 도중 카드로 rapid_reload를 받으면 이미 도는 애니메이션 길이는 바뀌지 않는다. 카드 선택 중에는 전장이 멈춰 있고 `shiftReloadTimer`로 종료 시각이 밀리므로 오차는 작다.

### I02. 테스트
- Related Files:
  - `tests/weapon-crosshair-hit-detection.test.ts` 또는 새 `tests/reload-ring.test.ts` — `getReloadRingSpec` 단위 테스트; new/modify

#### Details
- `getReloadRingSpec({ isReloading: true, isFeverActive: false, reloadDurationMs: 1680, sizePx: 120 })` → `visible true`, `diameterPx 136`, `durationMs 1680`, `circumferencePx ≈ 2π × 65`.
- `isReloading: false` → `visible false`. `isFeverActive: true` → `visible false`. `reloadDurationMs: 0` 또는 미지정 → `visible false`.
- 소스 문자열 검사: `CrosshairOverlay.tsx`가 `reload-ring-fill` keyframes를 `<style>`로 직접 포함한다(전역 CSS 의존 회귀 방지), `PCGamePage.tsx`의 `<CrosshairOverlay` 세 곳 모두 `reloadDurationMs=`를 전달한다(`(src.match(/<CrosshairOverlay/g) || []).length`와 `(src.match(/reloadDurationMs=\{hudState\.reloadDurationMs\}/g) || []).length`가 같다).

## Acceptance Criteria
- [ ] 장전 중에만 조준점 둘레에 링이 보이고, 장전 시간 동안 시계 방향으로 차오른다.
- [ ] 장전이 끝나거나 피버가 시작되면 링이 즉시 사라진다.
- [ ] 연속 두 번 장전해도 매번 링이 처음부터 다시 채워진다.
- [ ] 조준점 이동·반동·무기별 모양이 그대로이다.
- [ ] `npx tsc --noEmit`, `npm test`, `npm run build` 통과.

## Validation
- `npx vitest run tests/reload-ring.test.ts` — 통과
- `npx tsc --noEmit && npm test && npm run build` — 모두 통과
- 눈으로 확인(선택, 에이전트 실행 가능): `node scripts/playtest-bot.mjs`가 있다면 장전 순간 스크린샷에서 링 확인. 하지 못하면 "시각 확인 보류"로 기록하고 P03-T02 직접 플레이에서 확인한다.

## Commit Message
```text
feat(hud): reload progress ring around the crosshair

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P02-reload-ring
Task: T02-crosshair-reload-ring

- getReloadRingSpec decides visibility/size (hidden during fever)
- SVG ring fills over reloadDurationMs with in-component keyframes
- pass isReloading/reloadDurationMs/isPaused from all three PCGamePage crosshairs
- unit tests for the ring spec and the wiring
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
