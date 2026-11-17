# Task: T02 EX 결과 화면·랭킹 표기와 최종 QA

## Status: done

## Goal
EX에서 죽은 판이 결과 화면에서 "패배"가 아니라 `CLEAR · DANGER n 도달`로 보이고, 랭킹 목록에서도 `CLEAR+D{n}`으로 구분되게 한다. 서버가 EX 기록(VICTORY, waveReached 8 이상)을 그대로 저장하는지 테스트로 고정하고, 빌드와 실제 플레이(Playwright 봇)로 전체를 검증한다.

## Decision Summary
- 결정 D02(EX에서 죽어도 클리어 기록 + DANGER 덧붙임), D03(랭킹은 점수만, `wave_reached = 7 + n`, 스키마 변경 없음), D09(시즌 초기화 없음 → `RANKING_RULESET_VERSION` 유지).
- 엔진 `gamePhase`는 EX에서 죽으면 `'GAMEOVER'`다. 화면이 클리어로 보여야 하는지는 `engine.mainCleared`로 판단한다(`gamePhase`만 보면 GAME OVER 화면이 뜬다).

## Implementation

### I01. 결과 화면

- Related Files:
  - `src/pc/components/ResultRankingModal.tsx` :: `ResultRankingModalProps`(약 43행), 제목(약 264행), 설명문(약 267행), "도달 웨이브" 칸(약 380행); modify
  - `src/pc/PCGamePage.tsx` :: `<ResultRankingModal ... />`(약 1919행); modify

#### Details
- Props 추가: `exDangerReached?: number`(기본 0). 0보다 크면 EX 클리어 판.
- `const isVictory = gamePhase === 'VICTORY' || exDangerReached > 0;`(기존 `isVictory` 정의 교체 — 금색 테두리·그림자 스타일이 같이 따라온다).
- 제목: `exDangerReached > 0`이면 `🎉 CLEAR! · DANGER {exDangerReached} 도달`, 아니면 기존 문구.
- 설명문: `exDangerReached > 0`이면 `브루어리를 지켜내고 무한 러시에서 DANGER {n}까지 버텼습니다!`.
- "도달 웨이브" 칸: `exDangerReached > 0`이면 라벨 `도달 단계`, 값 `CLEAR · DANGER {n}`; 아니면 기존 `WAVE {waveReached}`.
- `lastWaveClear` 표시(약 316행, `isVictory && lastWaveClear`)는 EX 판에서 W7 기록이 보이는 게 맞으므로 그대로 둔다.
- PCGamePage: `exDangerReached={engine.mainCleared ? engine.exDanger : 0}` 전달. `waveReached={engine.currentWave}`는 그대로(7).

### I02. 랭킹 목록 표기

- Related Files:
  - `src/pc/components/RankingTabs.tsx` :: `WaveLabel`(약 14행); modify

#### Details
- `outcome === 'VICTORY' && waveReached > STAGE_CONSTANTS.TOTAL_WAVES`이면 텍스트를 `CLEAR+D{waveReached - TOTAL_WAVES}`로(같은 금색 스타일·같은 `data-testid="ranking-wave-clear"`). 그 외는 기존 그대로(`CLEAR` / `W{n}`). `STAGE_CONSTANTS`는 `src/shared/constants`에서 import.
- 랭킹 정렬은 건드리지 않는다(점수만, D03).

### I03. 서버 기록 테스트

- Related Files:
  - `tests/play-records.test.ts` — EX 기록 저장 케이스; modify
  - `server/PlayRecordStore.ts` :: `isValidPlayRunStats` — read-only(확인만: `waveReached`는 `isCount`만 검사, 상한 없음. `waves` 배열 ≤ 20이며 EX는 waveClears를 늘리지 않음)

#### Details
- 기존 VICTORY 저장 테스트(약 36행)와 같은 픽스처로 `outcome: 'VICTORY', waveReached: 10` 판을 저장하고 `games.wave_reached === 10`, `outcome === 'VICTORY'`, 랭킹 조회(`getTopTeams` 또는 개인 랭킹 조회 함수)에 그 판이 점수 순으로 들어가는지 확인한다.
- EX 체크포인트·최종 갱신(`isExUpdate`) 검증은 아래 I07 및 D12를 따른다.

### I04. 렌더 테스트

- Related Files:
  - `tests/ex-result.test.tsx` — 결과 화면·랭킹 라벨; new

#### Details
1. `ResultRankingModal`을 `gamePhase="GAMEOVER" exDangerReached={3}`로 렌더 → `CLEAR! · DANGER 3 도달` 문구가 있고 `GAME OVER` 문구가 없다. 기존 `tests/coop-result.test.tsx`의 렌더·필수 props 구성을 그대로 따른다.
2. `exDangerReached` 없이 `gamePhase="GAMEOVER"` → 기존 GAME OVER 문구(회귀).
3. `WaveLabel waveReached={10} outcome="VICTORY"` → `CLEAR+D3`; `waveReached={7}` → `CLEAR`; `outcome="GAMEOVER" waveReached={4}` → `W4`. 기존 `tests/ranking-tabs.test.tsx`와 충돌하면 그 기대도 같이 확인한다.

### I05. 플레이 봇과 실제 QA

- Related Files:
  - `scripts/playtest-bot.mjs` — W7 클리어 후 VICTORY를 기대하던 부분(약 214·226행); modify

#### Details
- 봇의 성공 조건을 "W7 보스 클리어 후 `window.__engine.mainCleared === true && window.__engine.isExActive === true`"로 바꾸고, 이어서 EX를 최대 120초 플레이한 뒤 `exDanger`, `exBossCount`(private이면 `activeTargets` 중 boss 수), 필드 몬스터 수 최댓값, 마지막 `gamePhase`를 metrics로 출력한다. 120초 안에 GAMEOVER가 되면 정상 종료로 본다.
- 브라우저 실행 인자는 기존대로 `--use-gl=angle --use-angle=metal`(swiftshader는 부하에서 프레임이 굶는다 — 메모리 노트).
- 수동 확인(스크린샷 3장, `/private/tmp/...scratchpad` 또는 `docs/screens` 아님 — 커밋하지 않음): ① EX 진입 직후 `⚠ DANGER 1` 배지 + `▶ 잠수 RUSH!` 배너, ② 60초 보스 WARNING, ③ 결과 화면 `CLEAR · DANGER n`.
- 2인 성능(결정 참고 항목): 봇을 `playerCount: 2`로 한 번 더 돌려 필드 몬스터 최댓값과 체감 프레임을 기록하고 사용자에게 보고한다(상한을 추가하지는 않는다 — D05).

### I06. 몬스터 가이드 문구 정리

- Related Files:
  - `src/pc/components/guide/MonstersTab.tsx` :: `chalang.role`(39행), `chalang.speedText`(40행), `chalang.description`(41행), 보스 `tip`(63행); modify
  - `tests/docs-sync.test.ts` — 금지 문구 목록; modify

#### Details
- 찰랑 급발진 횟수: 세 곳의 하드코딩 "세 번째 등장"을 상수로 바꾼다. `${GAME_TUNING.monsters.chalang.rushAfterAppearances}번째 등장 후 급발진`(role은 문자열 리터럴이므로 템플릿 문자열로 변경). 현재 상수 값은 5. 숫자를 문구에 직접 쓰지 않아 다음 튜닝 때 어긋나지 않게 한다.
- 찰랑 HP 표기 `(3HP)`도 `(${TARGET_SPECS.chalang.maxHp}HP)`로 상수화(이미 import되어 있지 않으면 `src/shared/constants`에서 import).
- 보스 tip 마지막 문장 "7웨이브는 냉각기와 대왕을 모두 잡아야 승리합니다." → "7웨이브는 냉각기와 대왕을 모두 잡으면 클리어! 이어서 EX 무한 러시가 시작됩니다."
- `tests/docs-sync.test.ts`의 `FORBIDDEN`에 추가: `{ pattern: /세 번째 등장/, why: '찰랑 급발진 횟수는 rushAfterAppearances를 따른다' }`, `{ pattern: /모두 잡아야 승리/, why: '7웨이브 클리어 후 EX 무한 러시로 이어진다' }`.

### I07. EX 이탈 시 클리어 기록 보호 (D12)

- Related Files:
  - `src/shared/types.ts`, `src/pc/scoreSubmission.ts`, `src/pc/engine/BeerCrusherEngine.ts`, `src/pc/PCGamePage.tsx`, `server/PlayRecordStore.ts`, `server/wsServer.ts`; modify

#### Details
- EX 진입 직후(`mainCleared === true` & WS OPEN) 1차 체크포인트(`outcome: 'VICTORY', waveReached: 8`)를 저장하고, EX 종료·일시정지 이탈·`pagehide`(`!e.persisted`) 시 `isExUpdate: true`로 최종 점수·단계를 갱신한다.
- 서버는 기존 `games.wave_reached >= 8`인 `VICTORY` 기록에 한해 점수·`waveReached` 비감소 조건으로 갱신을 허용하고, 그 외 중복 제출은 `ALREADY_SUBMITTED`로 거절한다.
- `PCGamePage`는 `preRunBestScoreRef`에 시작 전 최고점을 보존해 체크포인트 응답이 `isNewRecord` 비교 기준을 오염시키지 않게 한다.

## Acceptance Criteria
- [x] EX에서 죽으면 결과 화면이 금색 `CLEAR! · DANGER n 도달`로 나온다.
- [x] 랭킹 목록에서 EX 판이 `CLEAR+D{n}`으로 보인다.
- [x] 서버가 `VICTORY` + `wave_reached ≥ 8` 기록을 저장하고 점수 순 랭킹에 넣는다.
- [x] 몬스터 가이드의 찰랑 급발진 횟수·HP가 상수를 따르고, 보스 팁이 EX로 이어짐을 안내한다.
- [x] `npm run build` 성공, 플레이 봇이 W7 → EX → GAMEOVER까지 오류 없이 진행.

## Validation
- `npx vitest run tests/ex-result.test.tsx tests/play-records.test.ts tests/ranking-tabs.test.tsx tests/coop-result.test.tsx tests/docs-sync.test.ts` — 통과
- `npm test` — 전체 통과
- `npm run build` — 성공
- `npm run dev:vite` 실행 후 `node scripts/playtest-bot.mjs` — EX 진입·GAMEOVER까지 출력, pageerror 없음

## Commit Message
```text
feat(ex-rush): 결과 화면 CLEAR·DANGER 표기와 랭킹 라벨, 플레이 봇 EX 대응

Plan: 2026-11-17-ex-endless-waves
Phase: P02-ex-ui-and-result
Task: T02-ex-result-and-qa

- ResultRankingModal: EX 판을 CLEAR · DANGER n 도달로 표시
- RankingTabs WaveLabel: EX 기록을 CLEAR+D{n}으로 표시
- play-records 테스트에 EX 기록(VICTORY, wave_reached 8+) 저장 케이스
- playtest-bot: W7 클리어 후 EX 진입·진행 지표 수집
- 몬스터 가이드: 찰랑 급발진 횟수·HP 상수화, 보스 팁을 EX 안내로 변경
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: b3c91a4
