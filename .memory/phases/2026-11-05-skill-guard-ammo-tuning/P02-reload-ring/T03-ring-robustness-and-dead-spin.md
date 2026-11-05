# Task: T03 링 보강(rapid_reload 연속 처리)과 죽은 spin 애니메이션 수정

## Status: pending

## Goal
(1) 장전 도중 `rapid_reload` 카드로 장전 시간이 바뀌어도 링이 실제 장전 종료 시각과 맞게 이어지게 한다. (2) `CrosshairOverlay`의 피버 중 회전 링(`animation: 'spin 2s linear infinite'`)이 keyframes가 없어 실제로는 멈춰 있는 문제를 고친다. 둘 다 같은 컴포넌트의 애니메이션 정의 문제라 한 Task로 묶는다(결정 D06-3, D06-4).

## Decision Summary
- T02에서 만든 `<style>` 인라인 keyframes 방식을 재사용한다. 전역 CSS를 새로 만들지 않는다.
- 카드 선택 중에는 전장이 멈추고 `shiftReloadTimer`가 종료 시각을 뒤로 밀며, 카드로 장전 시간이 줄 때(`getReloadDurationMs` 변화) 현재 진행 중인 장전의 `reloadEndTimeMs`는 바뀌지 않는다. 즉 **실제 장전은 처음 시간 그대로 끝난다**. 링만 새 길이로 돌면 거짓말이 된다.

## Implementation

### I01. 장전 링을 "남은 시간"으로 구동
- Related Files:
  - `src/pc/engine/WeaponSystem.ts` :: `getState()`의 `reloadEndTimeMs` — 읽기 전용(이미 있음); read-only
  - `src/pc/hudSnapshot.ts` :: `HudSnapshot`, `buildHudSnapshot` — `reloadRemainingMs` 추가; modify
  - `src/pc/components/CrosshairOverlay.tsx` :: `getReloadRingSpec`, 링 렌더 — 남은 시간으로 애니메이션 시작 위치 계산; modify
  - `src/pc/PCGamePage.tsx` — `reloadRemainingMs` 전달(3곳); modify

#### Details
- **Signatures & Types**:
  ```ts
  // HudSnapshot
  /** 장전 중일 때 종료까지 남은 시간(ms, 100ms 단위 반올림 아님). 장전 중이 아니면 0. */
  reloadRemainingMs: number;

  // getReloadRingSpec 반환에 추가
  { ..., delayMs: number }   // 음수 animation-delay: 이미 지난 만큼 건너뛴다
  ```
- **함정**: `reloadRemainingMs`는 장전이 진행되는 동안 매 프레임 변하므로 그대로 스냅샷 비교(`isHudSnapshotEqual`)에 넣으면 장전 내내 React 리렌더가 폭증한다(`hud-render-cost.test.ts`가 막으려는 문제). 따라서 `reloadRemainingMs`는 **장전이 시작되는 순간 한 번만** 의미가 있게 한다: 스냅샷에는 `reloadRemainingMs`를 넣지 않고, 대신 링 컴포넌트가 마운트 시 `performance.now()`를 `useRef`에 기록해 `elapsed`를 스스로 계산한다.
  - 즉 `HudSnapshot`에는 T01의 `reloadDurationMs`만 둔다(이 항목 취소). 위 시그니처 중 `reloadRemainingMs`는 **추가하지 않는다**.
- 링 컴포넌트 처리:
  1. 링 내부 `useRef<number>`에 `reloadStartMs`(링이 처음 `visible`이 된 시각)와 `startDurationMs`(그때의 `reloadDurationMs`)를 기록한다. 링이 사라지면 초기화한다.
  2. 장전 중 `reloadDurationMs` prop이 `startDurationMs`와 달라지면(카드 효과) **실제 장전은 처음 길이로 끝나므로** 링의 애니메이션 길이는 `startDurationMs`로 고정한다. 즉 prop이 바뀌어도 링 요소를 다시 마운트하지 않고 `animation-duration`도 바꾸지 않는다.
  3. 결과적으로 링은 항상 "처음 장전 시작 시점의 길이"로 채워진다. 이 동작을 `getReloadRingSpec`이 아니라 컴포넌트에서 `useRef`로 고정한다.
- 정리: 이 Task의 (1)번은 "prop이 바뀌어도 링을 그대로 둔다"는 **고정 동작과 그 테스트**로 해결한다. 복잡한 남은 시간 계산은 하지 않는다.

### I02. 죽은 spin 애니메이션 수정
- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` — 샷건 외곽 링 등 `animation: isFeverActive ? 'spin 2s linear infinite' : undefined` 사용처; modify

#### Details
- 사용처는 두 곳이다(`CrosshairOverlay.tsx`):
  - 샷건 외곽 링(280행 근처): `animation: isFeverActive ? 'spin 2s linear infinite' : undefined`
  - 개틀링 터빈 링(377행 근처): `animation: isFeverActive ? 'spin 0.6s linear infinite' : 'spin 4s linear infinite'`
- 컴포넌트 안에 `<style>{'@keyframes crosshair-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>`를 한 번 렌더하고(샷건·개틀링일 때), 두 곳의 `spin`을 `crosshair-spin`으로 바꾼다.
- **동작 변화 주의**: 개틀링 링은 원래 설계가 "평소 4초에 한 바퀴, 피버 0.6초"인데 지금까지 keyframes가 없어 계속 멈춰 있었다. 고치면 개틀링 조준점이 평소에도 천천히 돈다. 의도된 원래 설계이므로 그대로 두되 P03-T02 직접 플레이 체크리스트에 "개틀링 조준점이 도는 것이 거슬리지 않는가"를 추가한다.
- **함정**: 회전하는 요소가 `transform: translate(...)`로 위치를 잡고 있으면 `rotate` keyframes가 `translate`를 덮어써서 요소가 중앙으로 몰린다. 위 두 요소는 `border`만 있는 원형 div(translate 없음)라 안전하다. 8방향 점처럼 translate를 쓰는 요소에는 적용하지 않는다.
- 피버가 아닐 때는 `animation: undefined`를 유지한다(기존과 같음).

### I03. 테스트
- Related Files:
  - `tests/reload-ring.test.ts` — 케이스 추가; modify

#### Details
- 소스 검사: `CrosshairOverlay.tsx`에 `crosshair-spin` keyframes가 있고 `'spin 2s'` 문자열이 남아 있지 않다.
- `getReloadRingSpec`가 같은 입력에서 항상 같은 결과를 낸다(순수성), `durationMs`는 입력 `reloadDurationMs`와 같다.
- 컴포넌트 고정 동작은 소스 검사로 확인한다: 링 컴포넌트가 `startDurationMs` ref를 사용한다(문자열 `startDurationMs` 포함).

## Acceptance Criteria
- [ ] 장전 중 카드로 장전 시간이 바뀌어도 링은 처음 길이대로 채워져 실제 장전 종료 시각과 맞는다.
- [ ] 피버 중 샷건 외곽 링이 실제로 회전한다(점이 중앙으로 몰리지 않는다).
- [ ] `HudSnapshot`에 매 프레임 변하는 값이 추가되지 않았다(`tests/hud-render-cost.test.ts` 통과).
- [ ] `npx tsc --noEmit`, `npm test`, `npm run build` 통과.

## Validation
- `npx vitest run tests/reload-ring.test.ts tests/hud-render-cost.test.ts` — 통과
- `npx tsc --noEmit && npm test && npm run build` — 모두 통과

## Commit Message
```text
fix(hud): keep the reload ring in step with the real reload and make the fever spin work

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P02-reload-ring
Task: T03-ring-robustness-and-dead-spin

- ring keeps the duration it started with when rapid_reload changes the reload time mid-reload
- define crosshair-spin keyframes (the old "spin" had none) without breaking translated dots
- tests for both behaviours
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
