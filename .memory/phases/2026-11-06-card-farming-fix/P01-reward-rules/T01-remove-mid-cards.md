# Task: T01 중간 카드 삭제와 수리 카드 +2

## Status: done

## Goal
카드가 웨이브를 클리어할 때만 나온다(3·5웨이브는 보스 처치 후). 처치 수 중간 카드는 어느 웨이브에도 없다. 수리 카드는 체력 2를 회복한다. 보스전 HUD에서 카드 카운터가 사라지고 문서가 이를 설명한다.

## Decision Summary
- 결정 D01, D02, D06. 엔진의 중간 카드 코드(`getCardKillTarget`, `cardKillCount`, `spawnWaveRewardCards(…, false)`)는 **지우지 않는다.** 값이 `null`이면 동작하지 않으므로 값만 바꾼다(되돌리기 쉽다). 앞 계획에서 고친 `startBossClearSequence`의 카드 대기 해제도 그대로 둔다(방어 코드).
- 처치 드롭에서 바 수리 제외(`itemDropKinds`)는 유지한다.

## Implementation

### I01. 값
- Related Files:
  - `src/shared/gameTuning.ts` :: `waves[].cardKillTarget`(3·4·5·6·7웨이브 모두 `null`), `repairCard.healAmount` 1 → 2, 웨이브 표 위 주석(144행 부근); modify
  - `src/shared/constants.ts` :: `REWARD_CARD_SPECS.bar_repair`의 `descriptionKo`('바 방어선 체력 +1 회복' → '+2'), `cardSubtitleKo`('방어선 체력 +1 회복' → '+2'); modify

#### Details
- 3웨이브 24, 4웨이브 22, 5웨이브 40, 6웨이브 26, 7웨이브 44 → 전부 `null`. 1·2웨이브는 이미 `null`이다.
- 주석: "cardKillTarget이 null이면 중간 카드가 없다. 현재 모든 웨이브가 null이다(보스를 안 죽이고 처치 수로 카드를 모으는 파밍을 막으려고 뺐다). 값을 넣으면 그 처치 수마다 카드가 나온다(상한 없음)."
- 함정: `waveCardKillTargets`는 `GAME_TUNING.waves`에서 만들어지므로(`BeerCrusherEngine.ts:252`) 엔진은 건드리지 않는다. `getCardKillTarget()`이 `null`이면 `handleMonsterKilled`의 `cardTarget !== null` 조건이 거짓이라 카드가 나오지 않는다.

### I02. HUD
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `getWaveHudMode`(43행 부근), 보스전 카드 카운터 배지(371~387행), 진행 바 안의 `🃏 카드: n/N KILL`(413~415행); modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function getWaveHudMode(bossCount: number): { showProgressBar: boolean }
  ```
  보스가 있으면(`bossCount > 0`) `showProgressBar: false`, 없으면 `true`. `showCardCounterOnly`와 `cardKillTarget` 인자는 삭제한다.
- 보스전 카드 카운터 배지 블록(`getWaveHudMode(...).showCardCounterOnly && (...)`)을 통째로 지우고, 진행 바 조건은 `getWaveHudMode(bosses.length).showProgressBar`로 바꾼다.
- 진행 바 안의 `waveProgress.cardKillTarget !== null && (<span>🃏 카드 …</span>)`도 지운다(모든 웨이브가 `null`이라 영원히 안 그려지는 죽은 UI). `WaveProgressInfo`의 `cardKillCount`/`cardKillTarget` 필드와 `getWaveProgress()`는 엔진 API라서 그대로 둔다.
- 함정: 두 군데를 모두 지워야 한다. 하나만 지우면 사용하지 않는 import나 변수가 남아 `tsc`가 경고할 수 있다.

### I03. 가이드와 문서
- Related Files:
  - `src/pc/components/GuideModal.tsx` :: 모듈 상단 `MID_CARD_TEXT`(6~10행)와 카드 설명(593행 부근 "웨이브를 클리어할 때, 그리고 {MID_CARD_TEXT} 중간에 전장이"); modify
  - `README.md` 49행과 50행(`바리케이드 수리`(체력 +1) → +2); modify
  - `docs/무기_및_스킬_가이드.md` 146행("그리고 **3웨이브(24킬)…7웨이브(44킬) 중간**에" 제거, "한 판에 약 8장이"처럼 카드 장수를 말하는 문장이 있으면 실제 장수로 고침); modify
  - `docs/구동화면_쇼케이스.md` 103행; modify
  - `docs/몬스터_도감_설명서.md` 73행(진행: 보스전 도중 처치 수 카드 문장 삭제), 145~149행(웨이브 표의 "24킬에 중간 카드", "22킬에…", "40킬에…", "26킬에…", "44킬에…" 문구 삭제), 바 수리 항목의 "보상 카드 `바리케이드 수리`(+1)" → +2; modify
  - `docs/비어 크러셔 요구사항 분석서.md` FR-MON-03(73행)의 "처치 수(24·40·44킬)마다 중간 카드가 나오며," 구절 삭제; modify

#### Details
- 카드 문장은 "웨이브를 클리어할 때(3·5웨이브는 보스를 처치한 뒤) 전장이 즉시 일시정지되며 …"로 통일한다. 중간 카드 설명이 남아 있는지 `grep -rnE "중간 카드|중간\(|22킬|26킬|24킬|40킬|44킬|MID_CARD" README.md docs/*.md src`로 찾아 전부 지운다(이미지 폴더 `docs/screens` 제외).
- 수리 카드 회복량은 문서에 `체력 +2`로 적는다. 수리 *아이템*은 "처치 드롭에서는 나오지 않음"이 그대로 맞다.

### I04. 테스트
- Related Files:
  - `tests/boss-encounters.test.ts` :: `has no mid-wave card in waves 1-2 and cards at 24 / 22 / 40 / 26 / 44 kills in waves 3-7`(236행 부근); modify
  - `tests/boss-concurrent-spawns.test.ts` :: `describe('mid-fight cards')`(177행 부근); modify
  - `tests/pc-hud-and-banner.test.ts` :: `getWaveHudMode` 테스트(217행 부근); modify
  - `tests/gameplay-polish.test.ts` :: `should heal bar_repair reward card by 1 …`(168행 부근)과 `should spawn 3D cards at 22 kills in Wave 4 …`(97행 부근, 구현 중 추가: 엔진의 처치 수 카드 기능은 남겨 두므로 `waveCardKillTargets[4] = 22`를 직접 지정해 계속 검증); modify
  - `tests/docs-sync.test.ts` :: `documents the boss HP, the bottle speed and the mid-fight cards …`(165행 부근); modify

#### Details
- `boss-encounters`: 제목을 "has no mid-wave card in any wave"로 바꾸고 1~7웨이브 `getCardKillTarget`이 모두 `null`임을 확인한다.
- `boss-concurrent-spawns`: `deals a card at the wave target…`, `keeps dealing cards every target kills with no cap`, `does not end the game when a wave-7 mid-fight card is picked` 세 개를 지우고 새 테스트 하나로 대체한다: "3·4·7웨이브에서 일반 몬스터를 200마리 처치(`handleMonsterKilled`)해도 `isRewardCardPending`이 거짓이다." 헬퍼 `kill(n)`은 이 테스트에 쓴다. `does not soft-lock …`(수동으로 `spawnWaveRewardCards(now, false)`를 호출)과 `still deals the after-boss card in waves 3 and 5 …`는 **그대로 둔다**(엔진의 방어 코드와 보스 처치 후 카드 경로를 지키는 회귀 테스트).
- `pc-hud-and-banner`: `getWaveHudMode(0)` → `{ showProgressBar: true }`, `getWaveHudMode(1)`, `(3)` → `{ showProgressBar: false }`.
- `gameplay-polish`: 카드 회복을 2로 되돌린다: `lives = 2` → 카드 적용 후 4, `lives = 5`에서 적용해도 5(최대 초과 없음), `lives = 3` → 5. 수리 *아이템* 회복 1은 그대로 확인한다. 같은 파일의 `never drops bar_repair …` 테스트는 유지한다.
- `docs-sync`: 중간 카드 숫자(`kills(x)` 등)를 검증하던 블록을 "`GAME_TUNING.waves`의 `cardKillTarget`이 모두 `null`"과 "README·무기 가이드·쇼케이스·도감에 `킬에 중간 카드`, `중간 카드`가 없다"로 바꾼다. 보스 체력·병 속도 검증은 유지한다. `expect(guide).toContain('MID_CARD_TEXT')`는 지운다. 수리 카드 문구 검증(`바리케이드 수리\`(체력 +${heal})`)은 `healAmount`가 2라 그대로 통과해야 한다.

## Acceptance Criteria
- [x] 모든 웨이브의 `cardKillTarget`이 `null`이고, 몬스터를 아무리 많이 잡아도 도중에 카드가 나오지 않는다.
- [x] 수리 카드가 체력 2를 회복하고 최대 체력을 넘기지 않는다. 수리 아이템은 드롭되지 않는다.
- [x] 보스전 HUD에 카드 카운터가 없고, 보스가 있으면 진행 바만 숨는다.
- [x] 문서·가이드에 중간 카드 설명과 옛 숫자가 남아 있지 않다.
- [x] 3·5웨이브 보스 처치 후 카드, 7웨이브 승리 흐름은 그대로 동작한다.

## Validation
- `npx vitest run tests/boss-encounters.test.ts tests/boss-concurrent-spawns.test.ts tests/pc-hud-and-banner.test.ts tests/gameplay-polish.test.ts tests/docs-sync.test.ts tests/monster-traits.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
tune(cards): cards only on wave clear and the repair card heals 2 again

Plan: 2026-11-06-card-farming-fix
Phase: P01-reward-rules
Task: T01-remove-mid-cards

- Remove every kill-count mid-wave card (cardKillTarget is null for all waves)
- Repair card heals 2 again; bar repair stays out of kill drops
- Drop the boss fight card counter from the HUD and the mid-card text from the guides
- Rewrite the tests and docs-sync checks that pinned the 24/40/44 targets

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
