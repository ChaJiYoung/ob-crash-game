# Task: T02 Remove Bloom and Cap Render Pixels

## Status: pending

## Goal
후처리를 없애고 렌더 버퍼를 300만 픽셀로 제한해 GPU 부담을 줄인다. 3440×1440 기준 37 FPS를 약 93 FPS까지 끌어올리는 가장 큰 개선이다.

## Decision Summary
- D03: `UnrealBloomPass`와 `EffectComposer`를 제거한다. 상한은 DPR이 아니라 총 픽셀 수로 건다. 울트라와이드는 이미 DPR 1이라 DPR 상한으로는 효과가 없다.

## Implementation

### I01. 픽셀 상한 함수

- Related Files:
  - `src/pc/three/renderBudget.ts` :: `MAX_RENDER_PIXELS`, `computeRenderPixelRatio` — 렌더 비율 계산; new
  - `tests/render-budget.test.ts` :: 계산 검증; new

#### Details
- **Signatures & Types**:
  ```typescript
  export const MAX_RENDER_PIXELS = 3_000_000;

  export function computeRenderPixelRatio(
    cssWidth: number,
    cssHeight: number,
    devicePixelRatio: number,
    maxPixels: number = MAX_RENDER_PIXELS
  ): number {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (cssWidth <= 0 || cssHeight <= 0) return dpr;
    return Math.min(dpr, Math.sqrt(maxPixels / (cssWidth * cssHeight)));
  }
  ```
- **테스트 케이스**:
  - 3440×1440, DPR 1 → 약 0.778
  - 1440×900, DPR 2 → 약 1.521
  - 1920×1080, DPR 1 → 1
  - 크기 0 → DPR 그대로
  - DPR 3 → 2를 넘지 않음

### I02. 캔버스에서 후처리 제거

- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: 메인 `useEffect`, `handleResize`, `animate` — 직접 렌더로 전환; modify

#### Details
- **Execution Flow / Logic**:
  1. `EffectComposer`, `RenderPass`, `UnrealBloomPass` import와 `composer` 변수·생성 코드를 지운다.
  2. 초기화 순서:
     ```typescript
     renderer.setPixelRatio(computeRenderPixelRatio(width, height, window.devicePixelRatio));
     renderer.setSize(width, height);
     ```
  3. `handleResize`에서 `camera.aspect`, `engine.aspect` 갱신 후 같은 순서로 `setPixelRatio`, `setSize`를 호출한다. `composer.setSize`는 지운다.
  4. `animate`의 렌더 분기를 `if (renderer) renderer.render(scene, camera);`로 바꾼다.
  5. `toneMapping`, `toneMappingExposure`, `antialias`는 유지한다.
- **주의**: 후처리가 없어지면 톤 매핑과 sRGB 변환이 실제로 적용되어 색이 달라진다. 측정 때 비교한 화면에서 라벨은 더 또렷했다. 예상된 변화이므로 되돌리지 않는다.
- `drawCalls` 지표도 이제 전체 호출 수를 정확히 보여 준다.

### I03. 회귀 방지

- Related Files:
  - `tests/render-budget.test.ts` — 소스 검사 추가; modify

#### Details
- `fs.readFileSync('src/pc/components/GameCanvas3D.tsx', 'utf8')`에 `UnrealBloomPass`, `EffectComposer`가 없고 `computeRenderPixelRatio`가 있는지 확인한다.

## Acceptance Criteria
- [ ] 게임 화면에 후처리 없이 정상 렌더링된다.
- [ ] 창 크기를 바꿔도 비율이 다시 계산되고 화면이 늘어나지 않는다.
- [ ] 3440×1440에서 렌더 버퍼가 약 2677×1120이다.

## Validation
- `npx vitest run tests/render-budget.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npm run dev` 후 브라우저로 화면 확인 — 게임이 정상 표시됨

## Commit Message
```text
perf(render): remove bloom and cap render buffer at 3M pixels

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P01-render-and-stutter
Task: T02-remove-bloom-and-cap-render-pixels

- Render directly without EffectComposer and UnrealBloomPass
- Add computeRenderPixelRatio based on total pixel budget
- Recalculate pixel ratio on resize
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
