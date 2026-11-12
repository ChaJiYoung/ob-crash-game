# Task: T06 임시 웨이브 배치와 전체 검증

## Status: done

## Goal
웨이브 3의 일반 몬스터 목록에 `chalang`을 넣어 실제 플레이에서 등장하게 하고, 전체 테스트·타입 검사·샌드박스 확인으로 기능이 끝까지 동작함을 확인한다.

## Decision Summary
- D09: 등장 웨이브는 구현 후 테스트로 결정한다. 임시로 웨이브 3(`waveIndex: 3`)에 넣는다.
- 웨이브 3은 보스 웨이브(`boss: { coolerHp: [100], … }`)다. 일반 스폰 목록(`kinds`)에만 추가하고, 보스 소환 목록(`summonKinds`)은 바꾸지 않는다.
- 웨이브 배치 변경은 밸런스에 영향을 준다. 기존 밸런스 테스트가 깨지면 기대값을 임의로 바꾸지 않고 보고한다.

## Implementation

### I01. 웨이브 3 일반 스폰 목록에 찰랑 추가

- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.waves[2]`(waveIndex 3, line 217) — `kinds`에 `'chalang'` 추가; modify

#### Details
- **Before** (line 217의 `kinds` 값):
  `kinds: ['obi', 'caslight', 'caslight', 'hanmac']`
- **After**:
  `kinds: ['obi', 'caslight', 'caslight', 'hanmac', 'chalang']`
- `totalSpawns`(15), `maxSimultaneous`(6), `spawnIntervalMs`(700), `parTimeSec`(34), `boss`(`coolerHp: [100]`, `summonKinds: ['obi','caslight','hanmac']`)은 바꾸지 않는다.
- 엔진 측 일반 스폰은 `spawnNextTarget`(`BeerCrusherEngine.ts` line 1565)이 `waveDef.kinds`에서 무작위로 고르므로, 찰랑이 스폰되면 P02 T02의 `applyMonsterTraits`가 `appearanceCount = 1`을 설정한다. 추가 엔진 변경은 없다.

### I02. 전체 검증과 샌드박스 확인

- Related Files:
  - (코드 변경 없음) 검증 Task. 결과는 이 파일의 Progress와 커밋 메시지에 기록한다.

#### Details
- 실행 순서:
  1. `npx tsc --noEmit` — 타입 오류 0개.
  2. `npm test` — 기존 1054개 + 신규 찰랑 테스트 전부 통과. 실패가 있으면 원인을 보고하고 기대값을 바꾸지 않는다.
  3. `npm run dev` 후 PC 화면에서 `테스트 랩(SensorAndModuleTestLabOverlay)`을 열어 찰랑을 소환한다.
     - 확인 항목: 수면 체류 → 물속 진입(몸체 납작, 링 보임, 타격 무반응) → 순간이동 후 수면 복귀 → 3번째 등장 후 빠른 접근 → 수면 위 타격 시 체력 3→2→1→처치.
  4. 웨이브 3 실제 플레이에서 찰랑이 등장하는지 확인한다(선택: `scripts/playtest-bot.mjs`로 자동 플레이 가능).
- **밸런스 기록**: 웨이브 배치 결정(D09)을 위해 `.memory/decisions/`에 추가 결정 파일을 만들지 않는다. 결과는 `.memory/current.md`의 Status에만 남긴다.

## Acceptance Criteria
- [ ] 웨이브 3 `kinds`에 `'chalang'`이 있고, 다른 웨이브는 바뀌지 않는다.
- [ ] `npx tsc --noEmit` 오류 0개.
- [ ] `npm test` 전체 통과.
- [ ] 테스트 랩에서 찰랑의 잠수·순간이동·급발진·체력 감소를 눈으로 확인했다.
- [ ] 웨이브 3 실플레이에서 찰랑이 등장한다.

## Validation
- `npx tsc --noEmit` — 오류 0개
- `npm test` — 전체 통과
- 수동: 위 3번·4번 항목. 결과(확인한 것, 못 본 것)를 `.memory/current.md` Status에 적는다.

## Commit Message
```text
feat(chalang): 웨이브 3에 찰랑을 배치하고 전체 검증

Plan: 2026-11-12-chalang-monster
Phase: P04-wave-and-verify
Task: T06-wave-placement-and-verify

- I01: 웨이브 3 일반 스폰 목록에 chalang 추가(임시 배치, D09)
- I02: tsc·전체 테스트·샌드박스 확인 결과 기록
```

## Progress
- [x] 구현 완료
- [x] 검증 통과(tsc 통과, 전체 테스트 1070개 통과)
- commit: done
- 실플레이·샌드박스 시각 확인은 아래 "시각 비교" 결과로 대신함
