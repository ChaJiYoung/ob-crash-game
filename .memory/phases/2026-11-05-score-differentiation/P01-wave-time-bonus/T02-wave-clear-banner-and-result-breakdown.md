# Task: T02 Wave Clear Banner and Result Breakdown

## Status: todo

## Goal
웨이브를 클리어할 때 시간과 보너스를 보여 주고, 결과 화면에 점수 내역(기본/시간/정밀도)을 표시한다.

## Decision Summary
- D03: 웨이브 클리어 직후 `WAVE CLEAR 23s +N`처럼 시간과 점수를 보여 준다.
- 이전 대화: 정밀도 보너스도 결과 화면에서 따로 보이게 한다.
- 성능 규칙: HUD는 `hudSnapshot` 동일성 비교와 직접 DOM 갱신으로 React 커밋을 줄여 왔다. 새 값도 이 규칙을 따른다.

## Implementation

### I01. HUD 스냅샷

- Related Files:
  - `src/pc/hudSnapshot.ts` :: `HudSnapshot`, `buildHudSnapshot`, `isHudSnapshotEqual` — 배너 키 추가; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `lastWaveClear` — 읽기 전용 사용; (T01에서 추가됨)

#### Details
- **Signatures & Types**:
  ```typescript
  // HudSnapshot에 추가: 배너가 보이는 동안만 문자열, 아니면 ''
  waveClearKey: string; // `${wave}|${seconds.toFixed(1)}|${bonus}`
  ```
- `nowMs - lastWaveClear.atMs < 2500`이면 키를 만들고, 아니면 빈 문자열. 문자열이라 기존 동일성 비교(`a[key] !== b[key]`)가 그대로 동작한다.

### I02. 배너

- Related Files:
  - `src/pc/PCGamePage.tsx` :: 보스 경고 배너(`isBossWarning`, `top: '24%'`) 옆 — 웨이브 클리어 배너; modify
  - `tests/hud-snapshot.test.ts` :: 새 키 검사; modify

#### Details
- 위치는 `top: '16%'`로 보스 경고(24%)와 겹치지 않게 한다. 문구: `WAVE {n} CLEAR  {seconds}초  +{bonus}`. 보너스가 0이면 `+0` 대신 시간만 표시한다.
- `data-testid="wave-clear-banner"`를 붙인다. 카드 선택 화면과 겹쳐도 클릭을 막지 않게 `pointerEvents: 'none'`.

### I03. 결과 화면 점수 내역

- Related Files:
  - `src/pc/components/ResultRankingModal.tsx` :: props `breakdown?` — 내역 표시; modify
  - `src/pc/PCGamePage.tsx` :: 결과 모달 호출부 — `engine.getScoreBreakdown()` 전달; modify

#### Details
- **Signatures & Types**:
  ```typescript
  breakdown?: { base: number; timeBonus: number; precisionBonus: number };
  ```
- 총점(`{score}점`) 아래에 세 줄: `기본 {base}점`, `시간 보너스 +{timeBonus}점`, `정밀도 보너스 +{precisionBonus}점`. 값이 0인 항목은 숨긴다(패배 시 정밀도 보너스는 0).
- 랭킹에 저장되는 점수는 기존대로 총점이다. 서버 변경은 없다.

### I04. 테스트

- Related Files:
  - `tests/wave-clear-banner.test.ts` :: 배너 키와 내역; new

#### Details
- 웨이브를 클리어하면 2.5초 동안 `waveClearKey`가 채워지고 이후 빈 문자열이다.
- 키는 보너스가 같으면 같은 문자열이라 `isHudSnapshotEqual`이 true를 돌려준다.
- 결과 내역 세 항목의 합이 총점과 같다(`getScoreBreakdown`).


## Acceptance Criteria
- [ ] 웨이브를 깰 때마다 시간과 보너스가 표시되고 약 2.5초 뒤 사라진다.
- [ ] 결과 화면에 기본/시간/정밀도 내역이 나온다.
- [ ] 평상시 React 커밋이 늘지 않는다(`hud-render-cost` 테스트 통과).

## Validation
- `npx vitest run tests/wave-clear-banner.test.ts tests/hud-snapshot.test.ts tests/hud-render-cost.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- `npm run build` — 성공

## Commit Message
```text
feat(hud): show wave clear time bonus and score breakdown

Plan: 2026-11-05-score-differentiation
Phase: P01-wave-time-bonus
Task: T02-wave-clear-banner-and-result-breakdown

- Add a wave clear banner driven by the HUD snapshot
- Show base, time, and precision score on the result screen
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit:
