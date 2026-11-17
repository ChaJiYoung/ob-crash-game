# Task: T03 Result Debug Details

## Status: done

## Goal
디버그 판의 결과 화면에 `DEBUG · 랭킹 미등록` 배지와 피격 총합, 웨이브·DANGER별 피격을 보여주고, NEW RECORD 표시는 띄우지 않는다.

## Decision Summary
- D07: 판마다 결과 화면에서 바로 확인. 디버그 판은 랭킹 미등록이므로 "신기록" 연출은 오해를 부른다.

## Implementation

### I01. `ResultRankingModal` 디버그 영역

- Related Files:
  - `src/pc/components/ResultRankingModal.tsx` :: `ResultRankingModalProps.debugInfo`, `DebugResultInfo`(new export); modify

#### Details
- ```typescript
  export interface DebugResultInfo {
    damageTaken: number;
    waves: { label: string; damageTaken: number }[]; // 'W1'..'W7', 'DANGER 1'..
  }
  // props
  debugInfo?: DebugResultInfo;
  ```
- `debugInfo`가 있으면 점수 요약 위에 배지, 요약 아래에 "피격 총 n" + 칩 목록(`W3 · 2` 형식, 0인 항목도 표시). 랭킹 칸은 그대로 두되(디버그 판은 랭킹에 없다), `isNewRecord`는 PCGamePage에서 false로 넘긴다.

### I02. PCGamePage 연결

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `<ResultRankingModal debugInfo=...>`(2029행), `setIsNewRecord` 호출부; modify

#### Details
- `debugInfo = isDebugMode ? { damageTaken: engine.damageTaken, waves: [...engine.getPlayer(0).waveClears.map(w => ({ label: `W${w.wave}`, damageTaken: w.damageTaken ?? 0 })), ...engine.getExDangerDamage().map(d => ({ label: `DANGER ${d.danger}`, damageTaken: d.damageTaken }))] } : undefined`
  - `engine.damageTaken`이 private이면 `getPlayRunStats(0, { allowExCheckpoint: true })?.damageTaken` 사용(구현 시 접근자 확인).
  - **함정**: 마지막(죽거나 끝난) 웨이브는 `waveClears`에 없을 수 있다(클리어 못한 웨이브). 디버그는 무적이라 GAMEOVER가 없지만, 일시정지 이탈 시엔 결과 화면이 안 뜨므로 영향 없음. W7 → EX 진입 시 W7은 `waveClears`에 있음.
- 신기록 판정 위치에서 `if (isDebugMode) setIsNewRecord(false)`(신기록 계산 자체를 건너뜀).

### I03. 테스트 및 문서

- Related Files:
  - `tests/debug-result.test.tsx` — new (`tests/ex-result.test.tsx` 방식)
  - `README.md` — "디버그 모드" 짧은 절 추가(`?debug=1`, 랭킹 미등록, 기록 조회 SQL 예시 `SELECT * FROM games WHERE is_debug = 1 ORDER BY ended_at DESC;`); modify

#### Details
- `debugInfo` 있음 → 배지·"피격 총 5"·`DANGER 2` 칩 렌더. 없음 → 배지 없음(회귀).
- `tests/docs-sync.test.ts`가 README 구조를 검사하면 통과하도록 형식 맞춤.

### I04. 디버그 판 종료 버튼 (구현 중 추가)
- 무적이라 판이 끝나지 않고, W7 클리어 시 EX로 넘어가 결과 화면에 도달할 수 없음을 구현 중 발견.
- `BeerCrusherEngine.endDebugRun()`(디버그 판일 때만 GAMEOVER로 전환), `PauseMenuOverlay.onEndDebugRun`, `PCGamePage.handleEndDebugRun` 추가. 결과 저장은 기존 GAMEOVER 동기화·EX 갱신 경로를 그대로 탄다.

## Acceptance Criteria
- [x] 디버그 판 결과 화면에 배지와 피격 상세가 보이고 NEW RECORD가 뜨지 않는다.
- [x] 일반 판 결과 화면은 기존과 같다.

## Validation
- `npx vitest run tests/debug-result.test.tsx tests/ex-result.test.tsx tests/coop-result.test.tsx tests/result-breakdown.test.ts tests/docs-sync.test.ts` — 통과
- `npm test && npm run build` — 전체 통과 및 빌드 성공

## Commit Message
```text
feat(result): show debug badge and damage breakdown on debug results

Plan: 2026-11-17-debug-mode
Phase: P03-pc-debug-ui
Task: T03-result-debug-details

- I01: add debugInfo section to ResultRankingModal
- I02: pass wave/danger damage from engine and skip new-record in debug runs
- I03: test debug result rendering and document debug mode in README
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
