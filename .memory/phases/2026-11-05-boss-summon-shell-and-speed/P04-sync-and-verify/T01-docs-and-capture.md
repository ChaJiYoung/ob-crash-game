# Task: T01 문서와 캡처 동기화

## Status: done

## Goal
게임 내 가이드, `docs/`, README를 최종 동작에 맞추고 새 연출 스크린샷을 찍는다.

## Decision Summary
- 결정 D01~D10. 수치는 가이드 안에서 `GAME_TUNING`을 읽어 표시한다. 방패·시간 소환·옛 속도 문구가 남지 않게 문서 동기화 테스트로 막는다.

## Implementation

### I01. 문구
- Related Files:
  - `src/pc/components/GuideModal.tsx` :: 보스 설명, 요격 설명, 몬스터 속도; modify
  - `README.md` 45~46행, `docs/비어 크러셔 요구사항 분석서.md` 73행, `docs/비어 크러셔 상세설계서.md` 333행 부근, `docs/몬스터_도감_설명서.md` 보스 절, `docs/무기_및_스킬_가이드.md`; modify

#### Details
- 보스 설명: "보스는 체력이 99 / 66 / 33% 아래로 내려갈 때마다 몬스터 {summonCount}마리를 필드 6~14m에 위에서 떨어뜨립니다(일정 시간이 아니라 체력 기준이라 빨리 잡아도 소환을 봅니다). 마지막 보스를 잡으면 남은 몬스터가 연쇄로 터지고 BOSS DOWN! 뒤에 카드가 나옵니다." 수치는 `GAME_TUNING.boss.summonHpThresholds`, `summonCount`, `waves`의 체력을 읽는다.
- 요격 설명(`GuideModal.tsx` 499행 부근과 `docs/무기_및_스킬_가이드.md`): 포탄을 "갈색 똥 덩어리"로 쓴다. "빛나는 구"·"붉은" 표현이 있으면 바꾼다. 포탄은 아이템과 달리 맞히지 않으면 체력이 깎인다는 점을 덧붙인다.
- 칼날·거품이 보스 소환 몬스터도 맞힌다는 설명은 이미 있다.
- 속도 문구(오비 2.2, 병맥주 2.0, 웨이브당 증가 8%)를 확인한다.
- `tests/docs-sync.test.ts`의 `FORBIDDEN`에 `{ pattern: /붉은 포탄|빛나는 구/, why: 'enemy shells are brown poop now' }` 추가(오탐이 나면 패턴을 좁힌다).

### I02. 캡처
- Related Files:
  - `scripts/capture-weapons-and-skills.mjs`; modify
  - `docs/screens/play-boss-down.png`(new), `docs/screens/play-poop-shell.png`(new)

#### Details
- 개발 서버만 켠다(`npx vite --port 5173`). `npm run server`는 켜지 않는다(랭킹 데이터가 백업 후 초기화된다).
- 보스 처치 장면: 샌드박스에서 `eng.spawnSandboxTarget('boss', ...)`는 시퀀스를 타지 않는다(샌드박스 보스는 연출 없음). 실제 게임 시작 → `eng.startWave(3)` → `eng.spawnedInWave = 999` → 필드를 비워 보스 등장(`update` 1~2회) → 보스 체력을 0.1로 → 사격으로 처치 → 400ms 대기 → 스크린샷(`play-boss-down.png`). 배너와 연쇄 폭발이 보이는지 눈으로 확인한다.
- 포탄 장면: 한맥을 9m에 두고 발사를 기다려(`firstShotDelayMs` 1000ms 뒤) 포탄이 날아오는 장면을 찍는다(`play-poop-shell.png`). 실패하면 `eng.spawnMonsterProjectile(performance.now(), 'hanmac', { thetaRad: 0, radiusM: 9 })`로 직접 만든다.
- 가이드·README에 그림을 넣을 필요는 없지만, `docs/구동화면_쇼케이스.md`에 한 줄씩 추가한다.

## Acceptance Criteria
- [ ] 방패·시간 소환·옛 포탄 설명이 문서와 가이드에 남지 않는다.
- [ ] 보스 처치와 똥 포탄 스크린샷이 의도대로 보인다.

## Validation
- `grep -rn "쉴드\|방패를 두른\|8초에서 시작\|5초까지\|빛나는 구" README.md docs/*.md src` — 오비 방패 문구 외 결과 없음
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
docs(game): describe the boss summon, clear sequence and poop shell

Plan: 2026-11-05-boss-summon-shell-and-speed
Phase: P04-sync-and-verify
Task: T01-docs-and-capture

- guide and docs follow HP-threshold summons, no king shield and the clear sequence
- shells are described as brown poop
- new screenshots for the boss clear and the shell
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
