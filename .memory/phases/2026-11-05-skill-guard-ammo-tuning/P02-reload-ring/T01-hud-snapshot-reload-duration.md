# Task: T01 HUD 스냅샷에 장전 시간 추가

## Status: pending

## Goal
게이지 링이 "얼마 동안 채울지" 알도록 HUD 스냅샷에 현재 무기의 장전 시간(`reloadDurationMs`)을 넣는다. 링을 그리는 컴포넌트가 엔진을 직접 읽지 않고 스냅샷만 보게 하려는 것이다.

## Decision Summary
- 결정 D05. 링 애니메이션은 CSS가 시간을 계산하므로(프레임마다 React가 렌더링하지 않는다) 시작 시점은 `isReloading`이 false→true가 되는 순간이면 충분하고, 길이만 필요하다.
- `isHudSnapshotEqual`은 모든 스칼라 키를 순회해 비교하므로 새 필드는 자동으로 비교 대상이 된다. 장전 시간은 무기·레벨·rapid_reload 카드가 바뀔 때만 변하므로 렌더 폭증은 없다.

## Implementation

### I01. 스냅샷 필드 추가
- Related Files:
  - `src/pc/engine/WeaponSystem.ts` :: `getReloadDurationMs()` — 이미 있음; read-only
  - `src/pc/hudSnapshot.ts` :: `HudSnapshot`, `buildHudSnapshot` — 필드 추가; modify

#### Details
- **Signatures & Types**:
  ```ts
  export interface HudSnapshot {
    // ...
    isReloading: boolean;
    /** 현재 무기·레벨·카드 보정이 반영된 장전 시간(ms). 장전 게이지 링의 애니메이션 길이. */
    reloadDurationMs: number;
    // ...
  }
  ```
- `buildHudSnapshot`에서 `isReloading: weaponState.isReloading,` 다음 줄에 `reloadDurationMs: engine.weaponSystem.getReloadDurationMs(),`를 넣는다(`WeaponState`에는 없으므로 `engine.weaponSystem`에서 직접 읽는다. `WeaponState`를 바꾸지 않는다).
- 이 인터페이스를 구현·모사하는 곳(테스트의 가짜 스냅샷, `PCGamePage.tsx`의 초기 상태 등)이 있으면 `tsc`가 알려 준다. 필수 필드이므로 모두 채운다.

### I02. 테스트
- Related Files:
  - `tests/hud-snapshot.test.ts` — 새 케이스 추가; modify

#### Details
- `startGame({ withWeaponSelect: false })` 직후 `buildHudSnapshot(engine, 1000).reloadDurationMs`가 `engine.weaponSystem.getReloadDurationMs()`(샷건 Lv.1 = 1680)와 같다.
- rapid_reload 카드 적용 후(`engine.weaponSystem.applyRapidReloadBuff()`) 스냅샷 값이 줄어들고(`1680 × 0.8 = 1344`), `isHudSnapshotEqual(before, after)`가 false다.

## Acceptance Criteria
- [ ] `HudSnapshot.reloadDurationMs`가 있고 샷건 Lv.1에서 1680이다.
- [ ] rapid_reload 적용 시 값이 1344로 바뀌고 스냅샷 비교가 변경을 감지한다.
- [ ] `npx tsc --noEmit`, `npm test` 통과.

## Validation
- `npx vitest run tests/hud-snapshot.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음
- `npm test` — 전체 통과

## Commit Message
```text
feat(hud): expose the reload duration in the HUD snapshot

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P02-reload-ring
Task: T01-hud-snapshot-reload-duration

- HudSnapshot.reloadDurationMs from WeaponSystem.getReloadDurationMs()
- tests for the default value and the rapid_reload change
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
