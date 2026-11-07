# Task: T07 2인 난이도 배율 조정(D41)

## Status: pending

## Goal
2인 판 배율을 D41대로 바꾼다: 보스 체력 2배, 보스 부하 소환 수 2배, 웨이브 몬스터 수 2배, 카드 킬 게이지 목표 2배, 일반 몬스터·부하·분열 병 체력은 1배. 1인 값은 바뀌지 않는다.

## Decision Summary
- 규칙 표(`GAME_TUNING.playerCountRules`)의 `hpMult` 하나를 쪼갠다. 엔진은 지금처럼 `this.rules.<값>`을 곱하기만 한다(D24, 인원수 분기 없음).

## Implementation

### I01. 규칙 표
- Related Files: `src/shared/gameTuning.ts` :: `playerCountRules`; modify
```typescript
1: { monsterHpMult: 1, bossHpMult: 1, summonCountMult: 1, spawnCountMult: 1, cardKillTargetMult: 1, disconnectGraceMs: null, selectLayout: {...} },
2: { monsterHpMult: 1, bossHpMult: 2, summonCountMult: 2, spawnCountMult: 2, cardKillTargetMult: 2, disconnectGraceMs: 30000, selectLayout: {...} },
```
(`hpMult` 삭제. `selectLayout`는 P03-T02 결과를 따른다.)

### I02. 엔진
- Related Files: `src/pc/engine/BeerCrusherEngine.ts`; modify
- `hpMult`를 쓰던 다섯 곳: `spawnNextTarget`(1192행 부근)·`spawnBossMinionWave`(1568행 부근)·`splitBottle`(1646행 부근) → `monsterHpMult`, `spawnBossEncounter`의 쿨러·킹 체력(1719·1723행 부근) → `bossHpMult`.
- 보스 소환: `checkBossHpSummons`의 `GAME_TUNING.boss.summonCountByStep[crossed]`(1142행 부근)에 `Math.round(… * this.rules.summonCountMult)`.
- `buildWaveDefinitions`(338행 부근): `totalSpawns`는 `spawnCountMult`, `cardKillTarget`은 `cardKillTargetMult`로(지금은 둘 다 `spawnCountMult`).
- 보스 웨이브의 "일반 몬스터를 totalSpawns × encounterStartRatio만큼 소환하면 보스 등장"은 늘어난 `totalSpawns` 기준 그대로 둔다(비율이라 자동으로 따라감).

### I03. 테스트
- Related Files: `tests/game-tuning.test.ts`, `tests/player-count-rules.test.ts`; modify
- `describe.each([1, 2])` 그대로 두고 기대값을 새 키로: 첫 일반 몬스터 `maxHp === spec.maxHp`(두 인원 모두), 3웨이브 쿨러 `100 × bossHpMult`, 1웨이브 스폰 `ceil(20 × spawnCountMult)`(2인 40), 4웨이브 카드 목표 `ceil(22 × cardKillTargetMult)`(2인 44), 보스 소환 첫 단계 마릿수 `round(4 × summonCountMult)`(2인 8).
- 봇 비교: `npx tsx .memory/references/scripts/coop-bot-compare.ts 30 coop` 결과(2인 다섯 조합 클리어율)를 커밋 메시지 본문에 붙인다. `coop-bot-compare.ts`의 `COOP_HP`/`COOP_SPAWN` 환경 변수는 새 키에 맞게 `COOP_BOSS_HP`·`COOP_SUMMON`·`COOP_SPAWN`·`COOP_CARD`로 바꾼다.

## Acceptance Criteria
- [ ] 1인 수치 불변, 2인은 D41 값.
- [ ] `hpMult` 문자열이 src·tests에 없다.

## Validation
- `grep -rn "hpMult\b" src tests | grep -v "monsterHpMult\|bossHpMult" | wc -l` — `0`
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
tune(coop): boss HP, summons, spawns and card target x2; monster HP x1

Plan: 2026-11-07-two-player-coop-qa-fixes
Phase: P03-fixes-r2
Task: T07-coop-difficulty-v2

- Split the coop hpMult into monsterHpMult/bossHpMult and add summonCountMult and cardKillTargetMult (D41)
- Solo values unchanged
- <coop-bot-compare 30판 결과>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
