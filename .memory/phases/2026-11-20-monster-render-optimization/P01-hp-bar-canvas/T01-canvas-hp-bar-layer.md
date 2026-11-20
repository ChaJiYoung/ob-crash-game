# Task: T01 Canvas HP Bar Layer

## Status: done

## Goal
`MonsterHpBarLayer`에서 몬스터마다 개별 `<div>` DOM 요소를 생성·수정하던 방식을 화면 전체 크기의 단일 2D `<canvas>` 일괄 드로우로 교체하여, 매 프레임 발생하는 브라우저 레이아웃 재계산(`UpdateLayoutTree`/`ForcedReflow`)을 0회로 제거한다.

## Decision Summary
- D01: `MonsterHpBarLayerHandle.update(projections: MonsterHudProjection[])` 인터페이스를 유지해 `PCGamePage.tsx` 호출부를 변경하지 않고 내부 구현만 2D `<canvas>`로 교체한다.

## Implementation

### I01. `MonsterHpBarLayer` 단일 2D Canvas 렌더링 구현

- Related Files:
  - `src/pc/components/MonsterHpBarLayer.tsx` :: `MonsterHpBarLayer`, `drawMonsterHpBar` — 기존 `BarDom` 맵 및 DOM 생성/갱신 로직을 제거하고 2D Canvas 드로우 함수로 교체; modify
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `MonsterHudProjection`, `shouldRenderMonsterHpBar` — 기존 타입과 필터 헬퍼 재사용; read-only
  - `src/pc/PCGamePage.tsx` :: `hpLayerRef` — 호출부 호환성 유지; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export interface MonsterHpBarLayerHandle {
    update(projections: MonsterHudProjection[]): void;
  }

  export function getHpBarColor(hpRatio: number): '#10b981' | '#f59e0b' | '#ef4444';
  ```
- **Canvas Layout & Scaling**:
  - 루트 컨테이너: `div` (`position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 10`) 안에 `<canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />` 1개만 배치.
  - `ResizeObserver`로 컨테이너의 `clientWidth`/`clientHeight`를 추적(또는 `update()` 시 크기가 달라졌을 때만 `canvas.width`, `canvas.height` 갱신 — `dpr = Math.min(window.devicePixelRatio || 1, 2)` 적용, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`).
  - *주의*: `update()` 호출 시마다 `clientWidth`/`clientHeight`를 매번 읽은 직후 DOM을 쓰지 않도록, `ResizeObserver` 콜백이나 초기 마운트 시 캐싱된 논리 크기(`sizeRef.current = { width, height, dpr }`)만 사용한다.
- **Execution Flow / Logic**:
  1. `update(projections)` 호출 시 `ctx = canvas.getContext('2d')` 획득 (없으면 return).
  2. 이전 프레임 잔상 제거: `ctx.clearRect(0, 0, logicalWidth, logicalHeight)`.
  3. 각 `proj` 순회:
     - `shouldRenderMonsterHpBar(proj.maxHp, proj.isItem, proj.isProjectile, proj.hp)`가 `false`면 skip.
     - `proj.leftPercent < -5 || proj.leftPercent > 105 || proj.topPercent < -5 || proj.topPercent > 105`면 skip.
     - 중심 좌표: `cx = (proj.leftPercent / 100) * logicalWidth`, `bottomY = (proj.topPercent / 100) * logicalHeight`.
     - **트랙(Track) 그리기**: 너비 `46`px, 높이 `8`px(내부 44x6 + 패딩 1px), `x = cx - 23`, `y = bottomY - 8`. 배경 `rgba(15, 23, 42, 0.96)`, 테두리 `rgba(255, 255, 255, 0.3)` (`roundRect` 지원 시 `roundRect(..., 3)`, 미지원 환경 대비 `fillRect` 폴백).
     - **HP 채움(Fill) 그리기**: `safeMaxHp = Math.max(0.001, proj.maxHp)`, `hpRatio = Math.max(0, Math.min(1, proj.hp / safeMaxHp))`, `fillWidth = proj.hp > 0 ? Math.max(1, Math.round(44 * hpRatio)) : 0`. 색상은 `getHpBarColor(hpRatio)` (`> 0.5`: `#10b981`, `> 0.25`: `#f59e0b`, 이하: `#ef4444`).
     - **상태이상 배지 (`isStunned`, `isSlowed`)**: 트랙 위(`y - 3`)에 `⚡STUN`(`#fbbf24`), `❄️SLOW`(`#67e8f9`) 둥근 칩과 텍스트(`9px`, bold, `#111827`)를 중앙 정렬로 그린다.

### I02. `MonsterHpBarLayer` 단위 테스트 작성

- Related Files:
  - `tests/monster-hp-bar-layer.test.tsx` :: `MonsterHpBarLayer` — Canvas 기반 렌더링 및 필터링 검증; new

#### Details
- **Test Cases**:
  1. `update()`로 10개 이상의 `MonsterHudProjection`을 전달해도 컨테이너 내부에 `<canvas>` 1개 외의 추가 `<div>` 자식 노드가 생성되지 않음을 검증.
  2. `HTMLCanvasElement.prototype.getContext`를 스파이(mock 2D context)하여 `clearRect`가 매 `update()`마다 호출되고, `shouldRenderMonsterHpBar` 및 화면 밖(-10%, 110%) 타겟은 스킵되는지 검증.
  3. `isStunned` / `isSlowed`가 켜진 타겟에 대해 `fillText`로 `⚡STUN`, `❄️SLOW`가 그려지는지 검증.
  4. `getHpBarColor` 경계값(`0.51`, `0.5`, `0.26`, `0.25`, `0.1`) 색상 검증.

## Acceptance Criteria
- [ ] `MonsterHpBarLayer`가 DOM에 `<canvas>` 1개만 유지하고, 몬스터 수와 무관하게 추가 DOM 노드를 생성하지 않는다.
- [ ] `update(projections)` 호출 시 기존과 동일한 조건(`shouldRenderMonsterHpBar`, 화면 범위)으로 HP 바·색상·상태 배지가 그려진다.
- [ ] 기존 테스트 및 신규 단위 테스트가 모두 통과한다.

## Validation
- `npx vitest run tests/monster-hp-bar-layer.test.tsx` — 신규 테스트 전체 통과
- `npm test` — 전체 스위트 회귀 없음 확인

## Commit Message
```text
perf(pc): render monster HP bars on a single 2D canvas overlay

Plan: 2026-11-20-monster-render-optimization
Phase: P01-hp-bar-canvas
Task: T01-canvas-hp-bar-layer

- Replace per-monster div DOM updates in MonsterHpBarLayer with a single 2D canvas overlay to eliminate layout thrashing
- Add unit tests verifying zero extra DOM nodes, visibility filtering, and status tag drawing
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
