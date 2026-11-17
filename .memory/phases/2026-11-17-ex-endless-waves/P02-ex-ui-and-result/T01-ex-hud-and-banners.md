# Task: T01 EX HUD와 배너

## Status: done

## Goal
EX 중에 플레이어가 지금 상태를 바로 읽을 수 있게 한다. 상단 HUD의 `WAVE 7 / 7` 자리에 `⚠ DANGER n`을 띄우고(진행 바 숨김), 러시가 바뀔 때 `▶ {테마} RUSH!`, DANGER가 오를 때 `⚠ DANGER n` 배너와 효과음을 낸다. 보스 난입은 기존 WARNING 밴드가 그대로 뜬다(P01-T02).

## Decision Summary
- 결정 D03(HUD 표기 DANGER), D05(러시 배너). "레벨"은 플레이어 강화로 오해되므로 쓰지 않는다.
- `isHudSnapshotEqual`은 최상위 키를 `===`로 비교하므로 EX 정보는 **원시값(number/string)** 필드로만 넣는다(객체를 넣으면 매 프레임 다른 값으로 판정되어 HUD가 100ms마다 다시 그려진다).

## Implementation

### I01. 엔진: 배너 시각 기록

- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `updateExRush`, 필드 `exRushStartedAtMs`, `exDangerStartedAtMs`; modify

#### Details
- 필드: `public exRushStartedAtMs = 0; public exDangerStartedAtMs = 0;` — `startGame`/`enterExRush`에서 0으로 초기화.
- `updateExRush`의 러시 변경 분기에서: `this.exRushStartedAtMs = nowMs;` 그리고 DANGER가 바뀌었거나(`danger !== 이전 exDanger`) 첫 러시(`rushIndex === 0`)이면 `this.exDangerStartedAtMs = nowMs;`. (`nowMs`는 실제 시계라 hudSnapshot의 nowMs와 같은 축이다.)

### I02. HUD 스냅샷

- Related Files:
  - `src/pc/hudSnapshot.ts` :: `HudSnapshot`, `buildHudSnapshot`, 상수 `EX_RUSH_BANNER_MS`, `EX_DANGER_BANNER_MS`; modify

#### Details
- **Signatures & Types**:
  ```ts
  export const EX_RUSH_BANNER_MS = 1800;
  export const EX_DANGER_BANNER_MS = 2200;
  // HudSnapshot에 추가
  /** EX 진행 중이면 현재 DANGER(1부터), 아니면 0. */
  exDanger: number;
  /** 러시 배너: `${rushIndex}|${themeLabelKo}` (EX_RUSH_BANNER_MS 동안), 아니면 ''. */
  exRushBannerKey: string;
  /** DANGER 배너: `${danger}` (EX_DANGER_BANNER_MS 동안), 아니면 ''. */
  exDangerBannerKey: string;
  ```
- **Logic**:
  - `exDanger: engine.isExActive ? engine.exDanger : 0`
  - `exRushBannerKey`: `engine.isExActive && engine.exRushTheme && nowMs - engine.exRushStartedAtMs < EX_RUSH_BANNER_MS ? \`${engine.exRushIndex}|${GAME_TUNING.exRush.themes[engine.exRushTheme].labelKo}\` : ''`
  - `exDangerBannerKey`: `engine.isExActive && nowMs - engine.exDangerStartedAtMs < EX_DANGER_BANNER_MS ? String(engine.exDanger) : ''`
  - 러시 배너와 DANGER 배너가 같은 순간에 시작하면(30초 경계) 둘 다 뜬다. 위치를 다르게 둬서(I03) 겹치지 않게 한다.

### I03. 화면

- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUDProps.exDanger`, 상단 WAVE 배지; modify
  - `src/pc/PCGamePage.tsx` :: HUD props 전달(약 1647행), 배너 렌더(웨이브 클리어 배너 약 1608행 뒤), 효과음(약 968행 보스 경고음 옆); modify

#### Details
- `ArcadeOverlayHUDProps`에 `exDanger?: number`(기본 0). `exDanger > 0`이면:
  - `WAVE {wave} / {totalWaves}` 배지 대신 같은 자리에 `⚠ DANGER {exDanger}` (border·color `#ef4444`, 배경 동일, `data-testid="ex-danger-badge"`).
  - 웨이브 진행 바(`waveProgress && getWaveHudMode(...).showProgressBar`)를 그리지 않는다.
- `PCGamePage`의 `<ArcadeOverlayHUD ... exDanger={hudState.exDanger} />`.
- 배너 2개(`gamePhase === 'PLAYING'` 조건, `pointerEvents: 'none'`, 웨이브 클리어 배너와 같은 인라인 스타일 방식):
  - `data-testid="ex-rush-banner"`: `top: '16%'`, 중앙, 배경 `rgba(8, 47, 73, 0.94)`, 테두리 `#38bdf8`, 텍스트 `▶ {themeLabel} RUSH!` (키를 `split('|')[1]`로 읽음).
  - `data-testid="ex-danger-banner"`: `top: '25%'`, 중앙, 빨강 계열(`#fecaca` 글자, `rgba(69,10,10,0.93)` 배경, `#ef4444` 테두리), 큰 글씨(`clamp(36px, 5vw, 72px)`), 텍스트 `⚠ DANGER {n}`. 보스 WARNING 밴드(top 21.5%, zIndex 125)와 동시에 뜰 수 있으므로 zIndex 124로 아래에 둔다.
- 효과음: 100ms 인터벌의 보스 경고음 처리 옆에 `lastExDangerKeyRef`를 두고, `nextHud.exDangerBannerKey !== '' && 이전 값 === ''`일 때 `soundSynth.playBossWarningSound()`(새 사운드 함수는 만들지 않는다). 러시 배너에는 소리를 넣지 않는다(10초마다 울리면 시끄럽다).

### I04. 테스트

- Related Files:
  - `tests/ex-hud.test.ts` — 스냅샷·배지; new

#### Details
1. EX가 아니면 `exDanger === 0`, 두 배너 키 `''`.
2. EX 진입 후 첫 러시 시작 시각 기준: `exRushBannerKey === '0|잠수'`, `EX_RUSH_BANNER_MS` 지나면 `''`. `exDangerBannerKey === '1'`.
3. 같은 상태에서 100ms 간격 두 스냅샷이 `isHudSnapshotEqual === true`(원시값 확인).
4. 30초 경계 다음 러시: `exDanger === 2`, `exDangerBannerKey === '2'`.
5. `ArcadeOverlayHUD`를 `exDanger={3}`으로 렌더하면(기존 `tests/passive-card-hud.test.ts`의 렌더 방식 참고) `ex-danger-badge` 텍스트에 `DANGER 3`이 있고 `WAVE` 문구가 없다.

## Acceptance Criteria
- [x] EX 중 상단 배지가 `⚠ DANGER n`으로 바뀌고 진행 바가 사라진다.
- [x] 러시가 바뀔 때 `▶ {테마} RUSH!`, DANGER가 오를 때 `⚠ DANGER n` 배너와 경고음.
- [x] 본편 HUD는 그대로다.

## Validation
- `npx vitest run tests/ex-hud.test.ts tests/hud-snapshot.test.ts tests/wave-clear-banner.test.ts tests/hud-render-cost.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 타입 오류 없음

## Commit Message
```text
feat(ex-rush): HUD DANGER 배지와 RUSH·DANGER 배너

Plan: 2026-11-17-ex-endless-waves
Phase: P02-ex-ui-and-result
Task: T01-ex-hud-and-banners

- 엔진: 러시·DANGER 시작 시각 기록
- hudSnapshot: exDanger·exRushBannerKey·exDangerBannerKey 원시값 필드
- ArcadeOverlayHUD DANGER 배지, PCGamePage 배너와 DANGER 경고음
- ex-hud 테스트 추가
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
