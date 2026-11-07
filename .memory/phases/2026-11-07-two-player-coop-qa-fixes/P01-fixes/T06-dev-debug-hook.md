# Task: T06 개발용 읽기 전용 디버그 창구

## Status: done

## Goal
브라우저 QA 봇이 실제 화면에서 7웨이브 끝까지 플레이할 수 있도록, **개발 서버에서만** 엔진 상태와 표적의 조준 좌표를 읽을 수 있는 창구(`window.__BEER_DEBUG__`)를 연다. 봇은 이 좌표로 마우스를 움직이거나 가짜 폰 조준을 보내 쏜다. 게임 동작은 바꾸지 않는다(읽기 전용).

## Decision Summary
- 프로덕션 빌드에는 들어가지 않는다: `import.meta.env.DEV`일 때만 등록한다.
- 쓰기 기능(무적, 표적 삭제 등)은 넣지 않는다. 봇이 실제 입력 경로(마우스·폰 신호 → 처리부)로만 플레이해야 브라우저 QA 의미가 있다.
- 위치: 페이지 조립부(`PCGamePage`)에서 등록하고, 데이터를 만드는 순수 함수는 `src/pc/debug/debugSnapshot.ts`에 둔다(엔진을 읽어 평범한 객체로 바꾸기만 함, React·three import 없음).

## Implementation

### I01. 스냅샷 함수

- Related Files:
  - `src/pc/debug/debugSnapshot.ts` :: `BeerDebugSnapshot`, `buildDebugSnapshot`; new

#### Details
- **Signatures & Types**:
  ```typescript
  export interface BeerDebugTarget {
    id: string; kind: TargetKind; hp: number; maxHp: number; radiusM: number;
    aimX: number; aimY: number;         // engine.computeTargetAimCoords(t, 1, ownerIndex ?? 0)의 targetNormX/Y
    hitRadius: number;                   // apparentHitRadius
    isItem: boolean; isProjectile: boolean; isGoldenCan: boolean; isGuarding: boolean; landed: boolean;
    selectKind: 'weapon' | 'card' | null; selectValue: string | null; ownerIndex: number | null;
  }
  export interface BeerDebugSnapshot {
    phase: GamePhase; wave: number; lives: number; isPaused: boolean;
    selection: { kind: 'weapon' | 'card' | null; done: boolean[] };
    players: { index: number; score: number; ammo: number; maxAmmo: number; isReloading: boolean;
               isFeverReady: boolean; isFeverActive: boolean; skillStock: number; weaponKind: WeaponKind; weaponLevel: WeaponLevel; isAway: boolean }[];
    targets: BeerDebugTarget[];
  }
  export function buildDebugSnapshot(engine: BeerCrusherEngine, phase: GamePhase, nowMs: number): BeerDebugSnapshot;
  ```

### I02. 등록

- Related Files:
  - `src/pc/PCGamePage.tsx` :: effect 하나; modify

#### Details
```typescript
useEffect(() => {
  if (!import.meta.env.DEV) return;
  (window as any).__BEER_DEBUG__ = { snapshot: () => buildDebugSnapshot(engine, gamePhaseRef.current, performance.now()) };
  return () => { delete (window as any).__BEER_DEBUG__; };
}, [engine]);
```

### I03. 테스트

- Related Files:
  - `tests/debug-snapshot.test.ts`; new

#### Details
- 1인·2인 엔진에서 판 시작 → 무기 라운드 스냅샷: 표적 수 3×n, `selectKind 'weapon'`, `ownerIndex` 채워짐, `aimX/aimY`가 `computeTargetAimCoords`와 같음.
- 스냅샷이 엔진을 바꾸지 않음(호출 전후 `activeTargets` 길이·hp 동일).
- 소스 검사: `PCGamePage.tsx`에서 `__BEER_DEBUG__` 등록 줄이 `import.meta.env.DEV` 검사 안에 있음.

## Acceptance Criteria
- [ ] 개발 서버에서 `window.__BEER_DEBUG__.snapshot()`이 표적 조준 좌표를 돌려준다.
- [ ] `npm run build` 결과물(`dist/`)에 `__BEER_DEBUG__` 문자열이 없다.

## Validation
- `npx vitest run tests/debug-snapshot.test.ts` — 통과
- `npm run build && ! grep -rq "__BEER_DEBUG__" dist && echo OK` — `OK`
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(dev): read-only debug snapshot for browser QA bots

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P01-fixes
Task: T06-dev-debug-hook

- buildDebugSnapshot exposes phase, wave, lives, players and target aim coordinates
- Registered on window.__BEER_DEBUG__ only in the dev server; absent from production builds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
