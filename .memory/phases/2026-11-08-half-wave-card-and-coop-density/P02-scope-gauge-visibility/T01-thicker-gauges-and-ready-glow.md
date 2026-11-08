# Task: T01 게이지 굵기와 가득 참 글로우 펄스

## Status: done

## Goal
조준경 호 게이지(탄창·스킬·피버)를 6px로 굵히고, 스킬 가득·피버 준비 때 글로우 펄스로 눈에 띄게 한다.

## Decision Summary
- decisions `2026-11-08-scope-gauge-visibility` D01~D03.

## Implementation

### I01. 상수와 렌더
- Related Files:
  - `src/pc/components/scopeGauges.ts` — 상수 추가:
    ```ts
    export const SCOPE_GAUGE_STROKE = { base: 6, ready: 9 } as const;
    export const SCOPE_SKILL_DOT = { radius: 4.5, orbitOffset: 11 } as const;
    ```
  - `src/pc/components/CrosshairOverlay.tsx` :: `GaugeArc`, `ReloadArcFill`, `ScopeGauges`, 전역 `<style>`(약 429행) — modify
#### Details
- `GaugeArc`: 트랙과 채움 `strokeWidth={SCOPE_GAUGE_STROKE.base}`. `className = arc.flash ? 'scope-gauge-ready' : arc.warn ? 'scope-gauge-warn' : undefined`. ready일 때 `style={{ ['--glow' as any]: color }}`.
- `ReloadArcFill`: `strokeWidth` 6.
- 스킬 점: `polarPoint(c, c, r + SCOPE_SKILL_DOT.orbitOffset, ...)`, `r={SCOPE_SKILL_DOT.radius}`. SVG `size = r * 2 + 36`(점과 글로우가 잘리지 않게)로 늘린다.
- CSS(기존 `scope-gauge-flash` 대체):
  ```css
  @keyframes scope-gauge-ready { from { stroke-width: 6px; filter: drop-shadow(0 0 2px var(--glow)) brightness(1); } to { stroke-width: 9px; filter: drop-shadow(0 0 7px var(--glow)) brightness(1.5); } }
  .scope-gauge-ready { animation: scope-gauge-ready 0.6s ease-in-out infinite alternate; }
  @keyframes scope-gauge-warn { from { opacity: 0.45; } to { opacity: 1; } }
  .scope-gauge-warn { animation: scope-gauge-warn 0.7s ease-in-out infinite alternate; }
  @media (prefers-reduced-motion: reduce) { .scope-gauge-ready { animation: none; stroke-width: 9px; filter: drop-shadow(0 0 5px var(--glow)); } .scope-gauge-warn { animation: none; } }
  ```

### I02. 테스트
- `tests/scope-gauges.test.tsx` — 렌더 테스트 추가: 스킬 가득 입력이면 `.scope-gauge-ready` 경로가 2개(스킬+피버 준비 시), 탄 10%면 `.scope-gauge-warn` 1개, 보통 호의 `stroke-width`가 "6". 기존 `scope-gauge-flash`를 찾는 기대가 있으면 갱신한다.

## Acceptance Criteria
- [ ] 호 굵기 6px, 가득 차면 펄스와 글로우

## Validation
- `npx tsc --noEmit`, `npx vitest run` — 통과

## Commit Message
```text
feat(scope): 조준경 게이지를 굵히고 스킬·피버 가득 참에 글로우 펄스

Plan: 2026-11-08-half-wave-card-and-coop-density
Phase: P02-scope-gauge-visibility
Task: T01-thicker-gauges-and-ready-glow

- 호 굵기 3→6px, 스킬 점 반지름 3→4.5
- 가득 참은 글로우 펄스, 탄 부족은 기존 깜빡임으로 분리
- 렌더 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## 구현 메모
- 계획의 `drop-shadow`·`brightness` 필터는 `tests/hud-render-cost.test.ts`(조준경 CSS filter 금지, 성능 가드)에 걸린다. 그래서 가득 참일 때 같은 색의 16px 반투명 호(`scope-gauge-halo`, 투명도 0.12↔0.5)를 뒤에 까는 방식으로 대체했다.
