# Task: T01 장전 링 강화와 장전 중 조준점 흐림

## Status: done

## Goal
장전 중 조준점 둘레의 게이지 링이 어떤 배경에서도 또렷이 보이고, 조준점이 흐려져 지금 쏠 수 없다는 것을 바로 알 수 있다.

## Decision Summary
- 결정 D01. 링 8px, 검은 외곽선, 색 `#f87171` 유지(HUD 장전 문구 `ArcadeOverlayHUD.tsx:571`과 같은 색). 조준점 45%. 피버 중에는 링도 흐림도 없다.

## Implementation

### I01. 링 스펙 확장
- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `ReloadRingSpec`, `getReloadRingSpec`, `ReloadRing`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface ReloadRingSpec {
    visible: boolean;
    diameterPx: number;
    radiusPx: number;
    durationMs: number;
    color: string;
    strokeWidthPx: number;   // 8
    outlineWidthPx: number;  // 12
    /** 링 바깥 조준점의 투명도. 링이 보일 때 0.45, 아니면 1. */
    reticleOpacity: number;
  }
  ```
- **Execution Flow / Logic**:
  1. `diameterPx = sizePx + 16`은 유지한다.
  2. `radiusPx = diameterPx / 2 - outlineWidthPx / 2` (기존 `- 3`). 외곽선 12px의 절반만큼 안쪽에 그려야 SVG 밖으로 잘리지 않는다. `sizePx` 120이면 62.
  3. `ReloadRing`은 원 세 개를 순서대로 그린다: 외곽선(`rgba(0,0,0,0.85)`, `outlineWidthPx`), 바탕(`rgba(248,113,113,0.35)`, `strokeWidthPx`), 진행(기존 애니메이션, `spec.color`, `strokeWidthPx`).
  4. 진행 원의 `pathLength={1}`, `strokeDasharray={1}`, `animation`, `animationPlayState`는 바꾸지 않는다.

### I02. 조준점만 흐리게 하기
- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairOverlay` 렌더링; modify

#### Details
- 함정: 바깥 `containerRef` div에 `opacity`를 주면 링까지 흐려진다. 또한 이 div의 `transform`은 위치와 반동에 쓰므로 건드리지 않는다.
- 무기별 조준점 블록, 모서리 표시 4개, 배지를 새 div로 감싼다.
  ```tsx
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: ring.reticleOpacity, transition: 'opacity 0.12s linear' }}>
    {/* 무기별 조준점, 모서리 표시, 배지 */}
  </div>
  {ring.visible && <ReloadRing ... />}
  ```
- `<style>` 키프레임 태그는 감싸지 않고 맨 위에 둔다. `ReloadRing`은 새 div의 **형제**로 옮긴다.
- 바깥 div와 같은 flex 정렬을 새 div에 줘야 조준점 위치가 그대로다.

### I03. 테스트
- Related Files:
  - `tests/reload-ring.test.ts` :: `reload progress ring spec`; modify

#### Details
- `radiusPx` 기대값 65 → 62.
- 추가: 장전 중 `strokeWidthPx` 8, `outlineWidthPx` 12, `reticleOpacity` 0.45. 장전 아님과 피버 중에는 `reticleOpacity` 1.
- 추가: 소스에서 `ReloadRing` 위치가 `opacity: ring.reticleOpacity` div 바깥인지 문자열 순서로 확인한다.

## Acceptance Criteria
- [x] 샷건, 리볼버, 개틀링 모두 장전 중 링이 두껍고 외곽선이 있으며 조준점만 흐려진다.
- [x] 장전이 끝나거나 피버 중이면 조준점이 원래 밝기다.
- [x] 조준점 위치와 발사 반동이 변하지 않는다.

## Validation
- `npx vitest run tests/reload-ring.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(crosshair): make the reload ring bold and dim the reticle while reloading

Plan: 2026-11-05-playtest-visual-feedback
Phase: P01-screen-feedback
Task: T01-reload-ring

- Draw the ring at 8px over a black outline so it reads on any background
- Dim only the reticle to 45% while reloading; fever is unchanged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
