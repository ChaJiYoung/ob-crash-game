# Task: T03 조준경 장전·피버 호와 하단 패널 탄창 줄

## Status: pending

## Goal
조준경에서 (1) 별도 장전 링을 없애고 탄창 호가 장전 중에 0%→100%로 다른 색으로 채워지게 하고, (2) 피버 호가 피버 중에 남은 시간만큼 100%→0%로 줄어들며 충전 때와 다른 색을 쓰게 한다. 하단 패널의 탄창 줄은 피버 중 "전부 채움" 표시를 없애고 장전 중에는 같은 색으로 채워지게 한다.

## Decision Summary
- 결정 문서 [2026-11-08-fever-ammo-and-aim-source](../../../decisions/2026-11-08-fever-ammo-and-aim-source.md) D03(장전 링 제거, 탄창 호가 채워지는 형태·색만 변경), D04(피버 호가 줄어듦·색 변경, 하단 패널 피버 막대는 이미 줄어들므로 그대로, 남은 초 텍스트 추가하지 않음), D07(가이드 문구).
- 장전 호 채움은 기존 `ReloadRing`이 쓰던 방식을 재사용한다: SVG `pathLength={1}` + `stroke-dashoffset` CSS 애니메이션(`reload-ring-fill`)을 장전 중에만 마운트하고, 마운트 시점에 `computeReloadRingTiming(duration, remaining)`으로 이미 지난 만큼을 음수 지연으로 건너뛴다. HUD 스냅샷은 100ms마다 갱신되므로 호가 장전 시작 뒤 최대 100ms 늦게 마운트된다.
- 장전 종료 시각은 새 스냅샷 필드 `reloadEndTimeMs`로 전달한다. 이 값은 한 번의 장전 동안 변하지 않아(일시정지 중에만 `shiftReloadTimer`가 민다) 스냅샷이 매 프레임 바뀌지 않는다(memo 유지). 그래서 PC 쪽 `getReloadRemainingMs` 콜백(`PCGamePage.tsx` 약 202행)은 필요 없어져 삭제한다. 기존 콜백은 항상 플레이어 0의 장전만 읽어서 2인 플레이 시 2P 링이 틀린 시간을 썼으므로, 플레이어별 스냅샷 값으로 바꾸면 그 문제도 함께 사라진다.
- 색(구현 시 정확히 이 값 사용): 장전 호 `#4cc9f0`(하늘색), 피버 진행 중 호 `#ef4444`(붉은색, 하단 패널 피버 진행색과 같다). 기존 값은 그대로: 탄창 `#e6edf3`, 경고 `#ffd24d`, 스킬 `#b98cff`, 피버 충전 `#ff7a3d`.
- 함정(가장 중요): 튜토리얼·샌드박스용 `CrosshairOverlay` 두 곳(`PCGamePage.tsx` 약 1559행, 약 1639행)은 지금 `gaugeSource`를 넘기지 않아 링 게이지가 없고 **장전 링만** 있었다. 장전 링을 지우면 두 화면에서 장전 표시가 사라진다. 두 곳에도 `gaugeSource={hudState.players[0]}`를 넘겨야 한다.
- 함정: 장전 호는 `variant="menu"`(로비·결과) 십자선에는 그려지지 않는다. `ScopeGauges`는 `!isMenu && gaugeSource`일 때만 렌더되는 기존 규칙을 유지한다.
- 함정: 지금 십자선 본체를 흐리게 하는 `reticleOpacity`(장전 중 0.45)는 `getReloadRingSpec`이 계산했고 **피버 중에는 1(선명)**이었다. 링을 지우면서 이 흐림이 같이 사라지지 않게 `isReloading && !isFeverActive`일 때만 0.45로 유지한다. 피버 중에는 장전 중이어도 십자선을 선명하게 둔다(사용자 지시: "피버일 때는 제대로 보여줘"). 피버 중 장전 진행은 탄창 호와 패널 막대로만 보인다.

## Implementation

### I01. 호 계산: 장전 호와 줄어드는 피버 호
- Related Files:
  - `src/pc/components/scopeGauges.ts` :: `ScopeGaugeInput`, `ArcSpec`, `ScopeGaugeSpec`, `SCOPE_GAUGE_COLORS`, `computeScopeGauges`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface ScopeGaugeInput {
    // ...기존 필드 유지
    /** 한 번의 장전 전체 시간(ms). PlayerHudSnapshot.reloadDurationMs. */
    reloadDurationMs: number;
    /** 장전이 끝나는 시각(performance.now 기준 ms). 장전 중에만 의미가 있다. PlayerHudSnapshot.reloadEndTimeMs. */
    reloadEndTimeMs: number;
  }

  export interface ArcSpec {
    startDeg: number;
    endDeg: number;
    /** 0..1 */
    fill: number;
    flash: boolean;
    warn: boolean;
    /** true면 채움을 CSS 애니메이션(장전)이 그린다. fill은 0이다. */
    reloading?: boolean;
    /** true면 피버 진행 중 색(줄어드는 호)으로 그린다. */
    active?: boolean;
  }

  export interface ScopeGaugeSpec {
    /** 장전 중에도 그려진다(reloading: true). */
    ammo: ArcSpec;
    skill: ArcSpec;
    skillDots: { filled: number; total: number };
    fever: ArcSpec;
  }

  export const SCOPE_GAUGE_COLORS = {
    track: 'rgba(255,255,255,0.14)',
    ammo: '#e6edf3',
    warn: '#ffd24d',
    skill: '#b98cff',
    fever: '#ff7a3d',
    reload: '#4cc9f0',
    feverActive: '#ef4444',
  } as const;
  ```
- **Execution Flow / Logic** (`computeScopeGauges`):
  1. `ammo`: `isReloading`이면 `{ ...SCOPE_GAUGE_ARCS.ammo, fill: 0, flash: false, warn: false, reloading: true }`. 아니면 `ratio = clamp01(i.ammo / Math.max(1, i.maxAmmo))`, `{ ...SCOPE_GAUGE_ARCS.ammo, fill: ratio, flash: false, warn: !i.isFeverActive && ratio < LOW_AMMO_RATIO }`. 피버 중에도 실제 탄창 비율을 보여 준다(`isFeverActive ? 1` 삭제). 피버 중에는 총알이 줄지 않으므로 경고(`warn`)는 끈다.
  2. `fever`: `isFeverActive`이면 `{ ...SCOPE_GAUGE_ARCS.fever, fill: clamp01(i.feverGauge / 100), flash: false, warn: false, active: true }`(피버 중 `feverGauge`는 남은 시간 비율이다: `ScoreAndFeverManager.updateFeverTimer`). 아니면 `fill: i.isFeverReady ? 1 : clamp01(i.feverGauge / 100)`, `flash: i.isFeverReady`, `warn: false`.
  3. 파일 맨 위 주석의 "장전 중이면 null: 기존 장전 링이 진행을 보여 준다"를 지우고 위 규칙으로 갱신한다.

### I02. 십자선: 장전 링 제거, 호 렌더 확장
- Related Files:
  - `src/pc/components/CrosshairOverlay.tsx` :: `ReloadRingSpec`, `getReloadRingSpec`, `ReloadRing`(삭제), `ScopeGauges`, `GaugeArc`, `CrosshairOverlayProps`, `CrosshairOverlay` 본문(약 453행 `const ring = ...`, 약 486행 `opacity: ring.reticleOpacity`, 약 747행 `{ring.visible && <ReloadRing .../>}`); modify

#### Details
- **Signatures & Types**:
  ```typescript
  // 삭제: ReloadRingSpec, getReloadRingSpec, ReloadRing 컴포넌트, props.reloadDurationMs, props.getReloadRemainingMs
  // 유지(이름 그대로, 호 채움이 재사용): computeReloadRingTiming, 키프레임 reload-ring-fill
  // 유지: props.isReloading(십자선 흐림용), props.isPaused(호 애니메이션 정지용)

  const ScopeGauges: React.FC<{ input: ScopeGaugeInput; sizePx: number; isPaused: boolean }>;

  const ReloadArcFill: React.FC<{
    c: number; r: number; arc: ArcSpec; durationMs: number; endTimeMs: number; isPaused: boolean;
  }> = ({ c, r, arc, durationMs, endTimeMs, isPaused }) => {
    // 장전 중에만 마운트되므로 마운트 시점의 남은 시간을 한 번 고정한다(기존 ReloadRing과 같은 방식).
    const [timing] = useState(() =>
      computeReloadRingTiming(durationMs, endTimeMs - performance.now())
    );
    return (
      <path
        d={describeArc(c, c, r, arc.startDeg, arc.endDeg)}
        stroke={SCOPE_GAUGE_COLORS.reload}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        data-testid="scope-reload-fill"
        style={{
          animation: `reload-ring-fill ${timing.durationMs}ms linear ${timing.delayMs}ms forwards`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      />
    );
  };
  ```
- **Execution Flow / Logic**:
  1. `ScopeGauges`: 탄창 호는 항상 그린다. 트랙(`SCOPE_GAUGE_COLORS.track`)을 먼저 그리고, `g.ammo.reloading`이면 `<ReloadArcFill ... durationMs={input.reloadDurationMs} endTimeMs={input.reloadEndTimeMs} />`를, 아니면 기존 `GaugeArc`(색: `warn`이면 경고색, 아니면 `ammo`색)를 그린다. 피버 호는 `g.fever.active`이면 색 `SCOPE_GAUGE_COLORS.feverActive`, 아니면 `fever`. `GaugeArc`의 트랙 그리기를 장전 호도 재사용하도록 `GaugeArc`에서 트랙 렌더를 분리하거나, `reloading`일 때 `fill: 0`의 `GaugeArc`(트랙만 그려짐)를 먼저 렌더한 뒤 `ReloadArcFill`을 겹친다.
  2. `CrosshairOverlay` 본문: `const ring = getReloadRingSpec(...)` 삭제. 십자선 본체 흐림은 `opacity: isReloading && !isFeverActive ? 0.45 : 1`로 바꾼다(`ring.reticleOpacity` 대체; 피버 중에는 항상 선명). `{ring.visible && <ReloadRing .../>}` 한 줄 삭제. `<ScopeGauges input={gaugeSource} sizePx={spec.sizePx} isPaused={isPaused} />`로 `isPaused`를 넘긴다.
  3. 함정: `ScopeGauges`를 감싸는 SVG는 `ScopeGauge` 반지름 `getScopeGaugeRadius(sizePx)`(= `sizePx / 2 + 14`)를 쓴다. 이 반지름의 주석 "장전 링 바깥에 그린다"는 사실과 달라지므로 지운다. 반지름 값 자체는 바꾸지 않는다.
  4. 함정: 키프레임 `reload-ring-fill`은 항상 마운트된 `<style>` 안에 이미 있다(`crosshair-spin`, `scope-gauge-flash`와 함께). 새 `<style>`을 만들지 않는다(기존 테스트 `tests/reload-ring.test.ts`가 "키프레임은 한 번만" 단언).

### I03. 스냅샷 필드와 PC 연결
- Related Files:
  - `src/pc/hudSnapshot.ts` :: `PlayerHudSnapshot`, `buildHudSnapshot`의 `players` map — `reloadEndTimeMs` 추가; modify
  - `src/pc/PCGamePage.tsx` :: `getReloadRemainingMs`(삭제), `CrosshairOverlay` 3곳, `PlayerPanel` 호출(약 1556행); modify
  - `src/pc/components/PlayerPanel.tsx` :: `PlayerPanelProps.isPaused?`; modify (I04에서 사용)

#### Details
- **Signatures & Types**:
  ```typescript
  // PlayerHudSnapshot (reloadDurationMs 아래)
  /** 장전이 끝나는 시각(performance.now 기준 ms). 장전 중에만 의미가 있고, 한 장전 동안은 일시정지가 아니면 변하지 않는다. */
  reloadEndTimeMs: number;

  // buildHudSnapshot
  reloadEndTimeMs: weaponState.reloadEndTimeMs,
  ```
- **Execution Flow / Logic**:
  1. `PCGamePage.tsx`에서 `getReloadRemainingMs` `useCallback`과 세 `CrosshairOverlay`의 `reloadDurationMs={...}`·`getReloadRemainingMs={...}` 프롭을 삭제한다. `isReloading`, `isPaused`는 유지한다.
  2. 튜토리얼 십자선(약 1559행)과 샌드박스 십자선(약 1639행)에 `gaugeSource={hudState.players[0]}`를 추가한다(없으면 장전 표시가 사라진다, 위 함정 참고). 실전 십자선은 이미 `gaugeSource={playerSnap}`이다.
  3. `gaugeSource` 타입이 `ScopeGaugeInput`이므로 `PlayerHudSnapshot`이 `reloadDurationMs`와 `reloadEndTimeMs`를 가진 객체로 그대로 넘어간다(필드 이름이 같아 구조적으로 호환).
  4. `hudSnapshot`을 만드는 테스트 헬퍼(`tests/player-panel.test.tsx`의 스냅샷 객체 등)는 새 필드가 없으면 `tsc`가 실패하므로 `reloadEndTimeMs: 0`을 추가한다.

### I04. 하단 패널 탄창 줄
- Related Files:
  - `src/pc/components/PlayerPanel.tsx` :: 3rd row "Dynamic Magazine"(약 168~213행), 컴포넌트 상단의 `<style>`; modify

#### Details
- **Execution Flow / Logic**:
  1. 칸 표시 `const filled = snapshot.isFeverActive || idx < snapshot.ammo;`를 `const filled = idx < snapshot.ammo;`로 바꾼다. 피버 중 색 분기(`snapshot.isFeverActive ? '#fbbf24' : skillBadge.accentColor`)는 지우고 항상 `skillBadge.accentColor`. 막대형(`maxAmmo > 12`)도 같은 규칙: 너비는 항상 `ammo / maxAmmo`, 피버 색 그라데이션 분기 삭제.
  2. `snapshot.isReloading`일 때는 칸 줄(또는 막대) 대신 같은 높이의 장전 막대를 그린다: 배경 트랙 `rgba(255,255,255,0.12)`, 안쪽은 `SCOPE_GAUGE_COLORS.reload` 색, `transform: scaleX(0→1)`을 CSS 애니메이션 `panel-reload-fill`로 `computeReloadRingTiming(snapshot.reloadDurationMs, snapshot.reloadEndTimeMs - performance.now())`의 길이·지연으로 돌린다(`transformOrigin: 'left'`, `animation-fill-mode: forwards`, `animationPlayState: isPaused ? 'paused' : 'running'`). 장전 중에만 마운트되는 하위 컴포넌트 `PanelReloadBar`로 만들어 마운트 시점에 타이밍을 한 번 고정한다(조준경 호와 같은 방식).
  3. `PlayerPanel`의 최상위에 `<style>{'@keyframes panel-reload-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }'}</style>`를 한 번 둔다. 칸 줄의 높이가 `18px`(칸), `10px`(막대)로 다른 점은 장전 막대 높이를 현재 줄 형태와 같게(`maxAmmo <= 12`이면 18px, 아니면 10px) 해서 패널 높이가 장전 때 흔들리지 않게 한다.
  4. `ammoText`(`formatAmmoStatusText`)는 바꾸지 않는다: 피버 중 "🔥 FEVER UNLIMITED AMMO", 장전 중 "⚡ 자동 장전 중...". 단, 우선순위가 `isFeverActive` → `isReloading` 순이라 피버 중 장전은 "FEVER UNLIMITED AMMO"가 보이고 줄에서만 장전이 진행된다(의도: 무한 탄창은 유지).
  5. `PCGamePage.tsx`의 `<PlayerPanel snapshot={s} presentation={...} isPaused={hudState.isPaused || hudState.isRewardCardPending || hudState.isWeaponSelectPending} />`로 `isPaused`를 넘긴다(십자선과 같은 조건).

### I05. 가이드·문서
- Related Files:
  - `src/pc/components/GuideModal.tsx` :: 약 670행 "🎯 조준경 링 게이지" 문단; modify
  - `README.md` :: 링 게이지를 설명한 줄이 있으면(`grep -n "링 게이지\|원호" README.md`); modify
  - `docs/튜토리얼_훈련장_가이드.md` :: 동일 표현이 있으면; modify

#### Details
- 문구 요지: "**위**는 남은 탄창입니다(장전 중에는 하늘색으로 채워지며, 피버 중에도 장전은 계속 진행됩니다). **왼쪽 아래**는 스킬 충전(점은 스택), **오른쪽 아래**는 피버입니다. 피버 게이지는 충전될 때 주황색으로 차오르고, 피버가 켜지면 붉은색으로 남은 시간만큼 줄어듭니다." 피버 설명 문장(`GuideModal.tsx` 659·666행의 "무한 탄창")은 그대로 둔다("총알이 줄지 않는다"는 의미 유지).
- `README.md`는 `tests/docs-sync.test.ts`가 읽으므로 먼저 이 테스트가 요구하는 규칙(필수/금지 문구, 가이드 모달과의 동기화)을 읽고 어기지 않는다. `docs/` 아래 발표용 HTML은 건드리지 않는다.
- `tests/tutorial-and-guide.test.ts`가 가이드 문구를 단언하면 새 문구에 맞게 고친다.

### I06. 테스트
- Related Files:
  - `tests/scope-gauges.test.tsx` :: `input()` 헬퍼에 `reloadDurationMs`·`reloadEndTimeMs` 추가, 기존 케이스 3개 수정, 신규 케이스; modify
  - `tests/reload-ring.test.ts` :: `getReloadRingSpec` 테스트(7~31행)와 "reload ring wiring" 중 링/프롭 단언 삭제·교체, `computeReloadRingTiming` 테스트(32~56행)는 유지; modify
  - `tests/player-panel.test.tsx` :: 스냅샷 헬퍼에 `reloadEndTimeMs`, 탄창 줄 케이스; modify

#### Details
- `computeScopeGauges`: (1) 장전 중 `ammo.reloading === true`, `fill === 0`, `warn === false`(이전에는 `null`) (2) 피버 중 탄창 호는 실제 비율(예: 18/30 → 0.6)이고 `warn`이 `false` (3) 피버 중 탄창 12/30(0.4)도 `warn === false` (4) 피버 호: 피버 진행 중 `feverGauge: 40`이면 `fill ≈ 0.4`, `active === true`, `flash === false`; `feverGauge: 100`(방금 켠 순간)이면 `fill === 1`; 충전 중 `feverGauge: 55`면 `fill ≈ 0.55`, `active` 없음; 준비 완료면 `fill === 1`, `flash === true`.
- 렌더(`renderToStaticMarkup`): (1) `isReloading` 입력이면 `data-testid="scope-reload-fill"`이 있고 `reload-ring-fill` 애니메이션 문자열과 색 `#4cc9f0`이 포함된다 (2) 장전 중이 아니면 없다 (3) 피버 진행 중이면 피버 호가 `#ef4444`, 충전 중이면 `#ff7a3d` (4) `variant="menu"`에는 호가 없다(기존 단언 유지) (5) 마크업에 옛 장전 링용 `rotate(-90deg)` SVG(별도 링)가 없다.
- 십자선 흐림: `isReloading`이고 피버가 아닐 때만 본체 래퍼 `opacity`가 0.45, 장전 중이어도 `isFeverActive`면 1(`renderToStaticMarkup`에서 해당 래퍼의 `opacity` 스타일 확인).
- `computeReloadRingTiming`: 기존 4개 케이스 유지.
- 소스 단언(`reload-ring.test.ts`의 wiring 중 일부): `PCGamePage.tsx`에 `getReloadRemainingMs`와 `reloadDurationMs={` 프롭 전달이 남지 않았고, 튜토리얼·샌드박스 `CrosshairOverlay`에도 `gaugeSource=`가 전달된다.
- `PlayerPanel`: (1) 피버 중이고 `ammo: 5, maxAmmo: 12`면 채워진 칸이 5개(전부 채움이 아님) (2) `isReloading`이면 `panel-reload-fill` 막대가 있고 칸 줄이 없다 (3) 장전 중이 아니면 장전 막대가 없다.

## Acceptance Criteria
- [ ] 별도 장전 링이 사라졌고, 장전 중 조준경 위쪽 탄창 호가 하늘색으로 0%→100% 채워진다(피버 중에도).
- [ ] 피버 중 조준경 오른쪽 아래 호가 붉은색으로 줄어든다. 충전 중에는 주황색으로 차오른다.
- [ ] 튜토리얼·샌드박스 십자선에도 조준경 호(장전 표시 포함)가 보인다.
- [ ] 피버 중에는 장전 중이어도 십자선이 흐려지지 않는다.
- [ ] 하단 패널 탄창 줄이 피버 중에도 실제 탄창을 보여 주고, 장전 중에는 막대가 채워진다. 패널 높이가 흔들리지 않는다.
- [ ] 가이드 문구가 새 동작과 일치한다. `getReloadRemainingMs`/`reloadDurationMs` 프롭이 코드에 남지 않았다.

## Validation
- `npx vitest run tests/scope-gauges.test.tsx tests/reload-ring.test.ts tests/player-panel.test.tsx tests/player-panel-fever.test.ts tests/tutorial-and-guide.test.ts tests/docs-sync.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음
- `npx vitest run` — 전체 통과
- `npm run build` — 성공

## Commit Message
```text
feat(hud): 장전을 탄창 호로, 피버 남은 시간을 줄어드는 호로 표시

Plan: 2026-11-08-unsupported-phone-block
Phase: P03-fever-ammo-aim
Task: T03-scope-reload-and-fever-arcs

- I01: 장전 중 탄창 호(reloading)와 피버 진행 중 줄어드는 호(active), 장전·피버 진행 색 추가
- I02: 별도 장전 링 제거, 장전 호 채움 애니메이션, 십자선 흐림은 피버가 아닐 때만 유지
- I03: reloadEndTimeMs 스냅샷 필드, getReloadRemainingMs 삭제, 튜토리얼·샌드박스 십자선에 gaugeSource 전달
- I04: 하단 패널 탄창 줄에서 피버 전부 채움 제거, 장전 막대 추가
- I05: 가이드 문구 갱신
- I06: 호 계산·렌더·패널 테스트 갱신
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
