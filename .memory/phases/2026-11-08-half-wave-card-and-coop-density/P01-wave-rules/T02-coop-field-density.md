# Task: T02 2P 필드 밀도(동시 수 ×1.8, 스폰 간격 ×0.6)

## Status: pending

## Goal
2P에서 필드에 동시에 나오는 일반 몬스터 수와 보충 속도를 늘려 화면 밀도를 높인다. 1P 동작은 바뀌지 않는다.

## Decision Summary
- decisions D03(1.8, 올림), D04(0.6, 반올림). 보스 포탄 혼잡 상한(`maxSimultaneous + 2`)은 늘어난 값을 그대로 쓴다.

## Implementation

### I01. 튜닝 + 엔진
- Related Files:
  - `src/shared/gameTuning.ts` :: `playerCountRules` — 1P `maxSimultaneousMult: 1, spawnIntervalMult: 1`, 2P `maxSimultaneousMult: 1.8, spawnIntervalMult: 0.6` 추가. 주석에 결정 문서명을 남긴다.
  - `src/pc/engine/BeerCrusherEngine.ts` :: `buildWaveDefinitions` —
    ```ts
    maxSimultaneous: Math.ceil(w.maxSimultaneous * this.rules.maxSimultaneousMult),
    spawnIntervalMs: Math.round(w.spawnIntervalMs * this.rules.spawnIntervalMult),
    ```
#### Details
- 2P 결과: 동시 수 5/6/6/6/7/7/8 → 9/11/11/11/13/13/15, 간격 700/650/700/600/600/550/600 → 420/390/420/360/360/330/360.

### I02. 테스트
- Related Files:
  - `tests/game-tuning.test.ts` — 1P/2P 새 필드 값 확인.
  - `tests/player-count-rules.test.ts` — `engine.waveDefinitions[7].maxSimultaneous`가 1P 8, 2P 15이고 `spawnIntervalMs`가 1P 600, 2P 360인지 확인.
  - `tests/boss-concurrent-spawns.test.ts` — 1P 기준이므로 변경 불필요(실행으로 확인).

### I03. 봇 측정
- `npx tsx .memory/references/scripts/coop-bot-compare.ts 40 coop`와 `... 40 all`을 실행하고, 클리어율을 결정 문서 하단 "측정" 절에 기록한다(수치 조정은 하지 않는다).

## Acceptance Criteria
- [ ] 2P 7웨이브 `maxSimultaneous` 15, `spawnIntervalMs` 360
- [ ] 1P 값은 변화 없음

## Validation
- `npx tsc --noEmit` — 0 오류
- `npx vitest run` — 전부 통과

## Commit Message
```text
feat(coop): 2인 판 필드 동시 몬스터 수 1.8배·스폰 간격 0.6배

Plan: 2026-11-08-half-wave-card-and-coop-density
Phase: P01-wave-rules
Task: T02-coop-field-density

- playerCountRules에 maxSimultaneousMult·spawnIntervalMult 추가, 웨이브 정의에 적용
- 인원수 규칙 테스트 추가
- 1P/2P 봇 클리어율 측정 기록
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
