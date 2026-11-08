# Task: T03 조준경 링 게이지 (탄창·스킬·피버)

## Status: pending

## Goal
게임 중 십자선 둘레에 얇은 원호 3개를 그린다. 위쪽은 남은 탄창, 왼쪽 아래는 스킬 충전과 스택 점, 오른쪽 아래는 피버 게이지다. 플레이어가 화면 아래 패널을 보지 않고도 상태를 안다. 시안: https://claude.ai/artifact/UcWFxoPyrcfMGzdagJmvkw (시안 1)

## Decision Summary
- 결정 D08. 2인 판에서는 각자 자기 십자선에 자기 상태만 보인다. 아래쪽 `PlayerPanel`은 그대로 둔다.
- 기존 장전 링(`ReloadRing`, `getReloadRingSpec`)과 겹치지 않게 한다. 장전 중에는 탄창 호 자리에서 장전 진행을 보여 주고, 기존 원형 장전 링은 그대로 둔다. 둘이 겹쳐 보이면 장전 중에는 탄창 호를 숨긴다. 실행할 때 화면을 보고 둘 중 하나를 고른다.
- 메뉴용 십자선(`variant="menu"`), 튜토리얼, 샌드박스에는 그리지 않는다. 게임 중(`variant` 기본값 `'play'`)이고 `gauges` prop이 있을 때만 그린다.

## Implementation

### I01. 링 게이지 계산(순수 함수)
- Related Files:
  - `src/pc/components/scopeGauges.ts` — new

#### Details
```ts
export interface ScopeGaugeInput {
  ammo: number; maxAmmo: number; isReloading: boolean;
  skillStock: number; maxSkillStock: number;
  skillCooldownRemainingMs: number; skillCooldownTotalMs: number;
  feverGauge: number; // 0..100 (PlayerHudSnapshot.feverGauge)
  isFeverReady: boolean; isFeverActive: boolean;
}
export interface ArcSpec { startDeg: number; endDeg: number; fill: number /*0..1*/; flash: boolean; warn: boolean }
export interface ScopeGaugeSpec { ammo: ArcSpec | null; skill: ArcSpec; skillDots: { filled: number; total: number }; fever: ArcSpec }
export function computeScopeGauges(i: ScopeGaugeInput): ScopeGaugeSpec;
```
- 각도는 12시를 0도로 두고 시계 방향으로 잰다. 탄창은 -60~60, 스킬은 190~290, 피버는 70~170이다(시안과 같음).
- 탄창: 장전 중이면 `null`(I03에서 기존 장전 링이 보여 줌), 그 밖에는 `fill = ammo/maxAmmo`이다. `ammo/maxAmmo < 0.2`이면 `warn`. 피버 중이면 탄이 줄지 않으므로 `fill = 1`, `warn = false`이다(`formatAmmoStatusText` 규칙 참고).
- 스킬: `skillStock >= maxSkillStock`이면 `fill = 1`, `flash = true`이다. 그 밖에는 `fill = 1 - skillCooldownRemainingMs / max(1, skillCooldownTotalMs)`(다음 스택 충전 진행)이다. `skillDots = { filled: skillStock, total: maxSkillStock }`이다.
- 피버: `fill = feverGauge / 100`이다. `isFeverReady || isFeverActive`이면 `flash = true`이다.

### I02. 스냅샷에 스킬 총 쿨다운 추가
- Related Files:
  - `src/pc/hudSnapshot.ts` :: `PlayerHudSnapshot`, `buildHudSnapshot` — `skillCooldownTotalMs: number` 추가, 값은 `weaponState.skillCooldownTotalMs`(이미 `WeaponSystem.getState()`에 있음); modify
  - `isHudSnapshotEqual` — 필드 비교에 포함되는지 확인하고 빠져 있으면 추가; modify
  - `tests/hud-snapshot.test.ts` — 기대 객체 갱신; modify

### I03. 십자선에 그리기
- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `CrosshairOverlayProps`(`gauges?: ScopeGaugeSpec`), 렌더 본체 — modify
  - `src/pc/PCGamePage.tsx` :: 게임 중 `CrosshairOverlay` 목록(약 1504~1533행) — `gauges={playerSnap ? computeScopeGauges(playerSnap) : undefined}`; modify

#### Details
1. 십자선 중심 기준 SVG 하나를 쓴다. 지름은 `spec.ringSizePx + 20`이고 `pointerEvents: 'none'`이다. 호 반지름은 `ringSizePx/2 + 6`, 선 굵기는 3px, 끝은 둥글게(`strokeLinecap: round`) 한다. 배경 트랙은 `rgba(255,255,255,0.14)`이다.
2. 색: 탄창은 `#e6edf3`(`warn`이면 `#ffd24d`), 스킬은 `#b98cff`, 피버는 `#ff7a3d`. 플레이어 색은 십자선 본체에만 쓴다.
3. `flash`이면 기존 keyframes 블록(약 405행)에 `scope-gauge-flash`(opacity 0.45↔1, 0.7s alternate)를 추가해 쓴다. `prefers-reduced-motion`이면 애니메이션을 끈다.
4. 스킬 점은 반지름 + 10 위치의 215도부터 22도 간격으로, 반지름 3px 원을 `total`개 그린다. `filled`개는 스킬 색, 나머지는 트랙 색이다.
5. 호의 path는 `describeArc(cx, cy, r, startDeg, endDeg)` 헬퍼를 `scopeGauges.ts`에 함께 둔다(그리는 각도가 0.5도 미만이면 빈 문자열).
6. 성능: `CrosshairOverlay`는 `React.memo`다. `gauges` 객체는 매 렌더 새로 만들어지므로 `PCGamePage`에서 `useMemo`로 `hudState.players[i]` 기준으로 캐시하거나, `gauges` 대신 원시 값 props를 넘긴다. `tests/hud-render-cost.test.ts`가 깨지지 않아야 한다.

### I04. 테스트·문서
- Related Files:
  - `tests/scope-gauges.test.ts` — new: 탄 부족 warn, 장전 중 ammo null, 피버 중 fill 1, 스킬 최대 flash, 쿨다운 진행 비율, totalMs 0 방어
  - `src/pc/components/GuideModal.tsx`, `README.md` — HUD 설명에 "십자선 둘레: 위 탄창, 왼쪽 아래 스킬, 오른쪽 아래 피버" 한 줄; modify
  - `tests/docs-sync.test.ts` — 필요하면 갱신

## Acceptance Criteria
- [ ] 게임 중 십자선 둘레에 탄창·스킬·피버 호가 보이고 값에 따라 찬다.
- [ ] 탄 20% 미만이면 노란색, 스킬 스택이 가득 차거나 피버가 준비되면 반짝인다.
- [ ] 2인 판에서 각자 자기 값만 보인다. 로비, 결과, 튜토리얼, 샌드박스 십자선에는 없다.
- [ ] 기존 장전 링과 겹치지 않는다.

## Validation
- `npx tsc --noEmit` — 오류 0
- `npx vitest run tests/scope-gauges.test.ts tests/hud-snapshot.test.ts tests/hud-render-cost.test.ts tests/reload-ring.test.ts` — 통과
- `npm test`, `npm run build` — 통과
- 수동: `npm run dev`로 1인 마우스 판을 열고 탄 소모, 장전, 스킬, 피버를 확인한다

## Commit Message
```text
feat(hud): 조준경 둘레에 탄창·스킬·피버 링 게이지

Plan: 2026-11-08-playtest-feedback
Phase: P02-play-feel
Task: T03-scope-ring-hud

- 링 게이지 계산 순수 함수(computeScopeGauges)와 호 경로 헬퍼
- HUD 스냅샷에 스킬 총 쿨다운 추가
- 게임 중 십자선에 탄창·스킬·피버 호와 스킬 스택 점 그리기
- 테스트와 가이드 문구 갱신
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
