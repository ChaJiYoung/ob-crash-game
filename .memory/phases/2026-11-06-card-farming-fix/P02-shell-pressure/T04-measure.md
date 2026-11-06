# Task: T04 파밍 시간 측정과 기준 시간 재측정

## Status: pending

## Goal
(1) 포탄 압박이 보스를 안 죽이고 버티는 플레이를 실제로 줄였는지 스톨 봇으로 확인하고, (2) 중간 카드 삭제와 포탄 압박 때문에 달라진 3~7웨이브 `parTimeSec`를 재측정해 반영한다. 결과를 기록으로 남긴다.

## Decision Summary
- 결정 D04, D07의 효과 검증 단계다. 새 기능 코드는 없다. 측정 결과가 모자라면(스톨이 여전히 안전하면) 하한 1.0초나 연발을 후속으로 결정한다(이 Task는 값을 임의로 바꾸지 않고 보고한다).
- 4·6웨이브도 중간 카드가 사라졌으므로 `parTimeSec`를 다시 잰다. 1·2웨이브는 바뀌지 않았다.

## Implementation

### I01. 스톨 봇 측정
- Related Files:
  - `.memory/references/scripts/boss-strategy-compare.ts` :: 스톨 전략(`STALL_UNTIL_MS = 45_000`); read-only (필요 시 최소 수정)
  - `.memory/references/playtest-2026-11-06-card-farming-fix.md` :: 새 기록 파일; new

#### Details
- 실행: `npx tsx .memory/references/scripts/boss-strategy-compare.ts 30` (30판, 세 무기, 세 전략). 출력에서 "stall" 전략의 보스전 지속 시간, 보스전 중 잃은 목숨(`bossLives`), 클리어율을 읽는다.
- 비교 기준: "압박 전" 수치는 T03 구현을 시작하기 전에 T03이 같은 명령으로 측정해 `.memory/references/playtest-2026-11-06-card-farming-fix.md`에 적어 두었다. 이 Task는 T03 이후 값을 같은 표에 나란히 적는다. 압박 전 수치가 기록에 없으면 이 Task에서 `git log`로 T03 직전 커밋을 찾아 임시 작업 폴더(`git worktree add`)에서 측정하고 지운다.
- 기대: 스톨 전략에서 보스전 중 잃은 목숨이 늘고 클리어율이 떨어진다(45초 스톨 동안 포탄 간격이 3.5초 → 2초까지 줄기 때문). 변화가 거의 없으면 숙련 봇이 포탄을 다 요격한다는 뜻이니 결과를 그대로 보고한다.

### I02. 기준 시간 재측정
- Related Files:
  - `src/shared/gameTuning.ts` :: `waves[2|3|4|5|6].parTimeSec`, `score.timeBonus` 위 주석의 측정 문구; modify
  - `.memory/references/scripts/measure-wave-times.ts`; read-only
  - `.memory/references/playtest-2026-11-06-card-farming-fix.md`; modify (측정 기록 추가)

#### Details
- 실행: `npx tsx .memory/references/scripts/measure-wave-times.ts 30`. "정확" 봇의 무기 합산 평균을 정수 초로 반올림해 3·4·5·6·7웨이브 `parTimeSec`에 넣는다(1·2웨이브는 그대로). 현재 값은 14/18/34/23/38/23/45다.
- 주석의 측정 문구를 이번 날짜와 새 값으로 고치고, 직전 값(`14/18/34/23/38/23/45`)을 "직전 값"으로 남긴다.
- 함정 1: `parTimeSec`가 바뀌면 T02에서 묶은 기울기 테스트(par보다 10초 늦으면 1,000점 이상 손실)가 par에 비례해 여전히 통과해야 한다. par가 커지면 기울기(`2800 / (0.6 × par)`)가 작아지므로 par가 약 46초를 넘으면(기울기 100점/초 미만) 테스트가 깨질 수 있다. 깨지면 par를 임의로 줄이지 말고 `bossWaveWeight` 상향을 후속으로 보고한다.
- 함정 2: 측정 봇은 카드를 `weapon_level_up` 우선으로 고른다. 카드가 웨이브 클리어 때만 나오므로 앞 계획의 측정보다 레벨이 더 느리게 오른다. 값이 크게 늘면 정상이다.
- 측정이 비정상이면(예: 보스 웨이브가 일반 웨이브보다 짧음) 값을 반영하지 말고 원인을 먼저 찾는다.

## Acceptance Criteria
- [ ] 스톨 봇 압박 전/후 결과가 `.memory/references/playtest-2026-11-06-card-farming-fix.md`에 기록된다.
- [ ] 3~7웨이브 `parTimeSec`가 30판 측정값으로 갱신되고 주석 날짜가 맞다.
- [ ] 보스 웨이브에서 par보다 10초 늦으면 1,000점 이상 잃는다는 테스트가 통과한다.
- [ ] `RANKING_RULESET_VERSION`은 5 그대로다.

## Validation
- `npx vitest run tests/wave-time-bonus.test.ts tests/game-tuning.test.ts tests/docs-sync.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
tune(boss): re-measure par times after the farming fix

Plan: 2026-11-06-card-farming-fix
Phase: P02-shell-pressure
Task: T04-measure

- Record the stall-bot comparison before and after the shell ramp
- Update wave 3-7 parTimeSec from 30-game bot measurements and keep ruleset v5

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
