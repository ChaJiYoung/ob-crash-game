# Task: T01 웨이브 절반 1회 중간 카드

## Status: pending

## Goal
4·6웨이브에서 처치 수(`killedInWave`)가 `ceil(totalSpawns/2)`에 닿는 순간 보상 카드 3장을 한 번만 띄운다. 처치 수로 반복해서 주던 카드를 대체한다. 2P는 `totalSpawns`가 이미 2배이므로 별도 배율 없이 맞춰진다.

## Decision Summary
- decisions `2026-11-08-half-wave-card-and-coop-density` D01, D02, D06.
- `killedInWave`에는 분열 병맥주도 포함되므로 실제 처치 수가 `totalSpawns`보다 커질 수 있다. 기준 비교는 clamp하지 않은 원값 `this.killedInWave`로 한다.
- 주의: 기존 반복 방식에서는 분열 때문에 4·6웨이브 중간 카드가 평균 약 2회 나왔다. 이번 변경 후에는 정확히 1회다(의도된 변경).

## Implementation

### I01. 튜닝 표
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.waves`, `GAME_TUNING.playerCountRules` — modify
#### Details
- 각 웨이브 행의 `cardKillTarget: number | null`을 `midWaveCard: boolean`으로 바꾼다. 4·6웨이브만 `true`, 나머지는 `false`.
- `playerCountRules[1|2].cardKillTargetMult`를 삭제한다.
- 표 위 JSDoc 주석을 고친다: "midWaveCard가 true면 처치 수가 ceil(totalSpawns/2)에 닿을 때 중간 카드를 1번 준다. 보스 웨이브(3·5·7)는 false(파밍 방지)."

### I02. 엔진
- Related Files:
  - `src/pc/engine/BeerCrusherEngine.ts` :: `buildWaveDefinitions`, `getCardKillTarget`, `getWaveProgress`, `WaveProgressInfo`, 처치 처리부(약 1819행 "킬 게이지 누적 및 중도 카드 스폰"), `cardKillCount` 리셋 지점(약 521, 559, 2534행) — modify
#### Details
- 필드 변경:
  - `private waveCardKillTargets` 삭제 → `private waveMidCardTargets: Record<number, number | null>`. 값은 `w.midWaveCard ? Math.ceil(totalSpawns(배율 적용 후) / 2) : null`.
  - `public cardKillCount` 삭제 → `public midCardGranted = false`. 기존에 `cardKillCount = 0`으로 리셋하던 모든 곳(startWave·startGame·보스 클리어 처리)에서 `midCardGranted = false`로 바꾼다.
- `getCardKillTarget(waveIndex = this.currentWave): number | null`은 이름을 유지하고 `waveMidCardTargets`를 반환한다(GuideModal·테스트가 쓰는 공개 API).
- 처치 처리:
  ```ts
  const cardTarget = this.getCardKillTarget();
  if (cardTarget !== null && !this.midCardGranted && this.killedInWave >= cardTarget) {
    this.midCardGranted = true;
    if (!this.isRewardCardPending) this.spawnWaveRewardCards(nowMs, false);
  }
  ```
  (`killedInWave`는 이 블록 전에 이미 +1 되어 있다. 호출 순서를 확인한다.)
- `WaveProgressInfo`: `cardKillCount: number` → `midCardGranted: boolean`. `cardKillTarget`은 유지한다(절반 목표 수).

### I03. HUD 진행 바의 절반 표시
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: 진행 바(“WAVE 진행도”) — modify
#### Details
- `waveProgress.cardKillTarget !== null`이면 진행 바 위 `left: ${cardKillTarget/totalSpawns*100}%` 위치에 세로 눈금(2px, `#a78bfa`)과 `🃏` 라벨을 그린다. `midCardGranted`가 true면 눈금의 투명도를 0.35로 낮춘다. 진행 바 컨테이너에 `position: relative`를 준다.

### I04. 가이드·문서·테스트 동기화
- Related Files:
  - `src/pc/components/GuideModal.tsx` :: `MID_CARD_TEXT` — `filter(w => w.midWaveCard).map(w => \`${w.waveIndex}웨이브\`).join('·')` 형태로 바꾸고, 609행 문구를 "{MID_CARD_TEXT} 처치 진행도가 절반에 닿을 때"로 고친다.
  - `README.md:61`, `docs/구동화면_쇼케이스.md:103`: "4·6웨이브 중간(22킬/26킬)" → "4·6웨이브 진행도 절반".
  - `docs/무기_및_스킬_가이드.md:151`: "4웨이브(22킬)·6웨이브(26킬) 중간" → "4·6웨이브 진행도 절반(처치 수가 웨이브 몬스터 수의 절반)"
  - `docs/몬스터_도감_설명서.md:146,148`: "22킬에 중간 카드가 나옵니다." → "17킬(절반)에 중간 카드가 나옵니다." / "26킬에 중간 카드." → "20킬(절반)에 중간 카드."
  - `tests/docs-sync.test.ts:178-185`: `midWaveCard` 배열 `[false,false,false,true,false,true,false]`과 바뀐 문구로 기대값 교체.
  - `tests/game-tuning.test.ts:144,160`: `cardKillTargetMult` 기대 삭제, `'cardKillTargetMult' in row`가 false인지 확인.
  - `tests/player-count-rules.test.ts:59`: `expect(engine.getCardKillTarget(4)).toBe(Math.ceil(Math.ceil(34 * rules.spawnCountMult) / 2))`.
  - `tests/boss-encounters.test.ts:242-249`: 4 → 17, 6 → 20, 테스트 이름 갱신.
  - `tests/wave-time-bonus.test.ts:150`: `engine.cardKillCount = 0` → `engine.midCardGranted = false`.
  - `tests/card-rate-simulation.test.ts`: 기대를 "1P와 2P 모두 웨이브당 중간 카드 정확히 1회"로 바꾸고 주석의 기준 값을 갱신한다.
  - 새 테스트 `tests/half-wave-card.test.ts`: (a) 4웨이브 1P에서 killedInWave 16까지는 카드 없음, 17에서 `isRewardCardPending` true; (b) 카드 선택 후 더 처치해도 두 번째 카드 없음; (c) 3웨이브(보스)는 절반을 넘어도 카드 없음; (d) 2P 4웨이브 목표 34.
  - `.memory/references/scripts/coop-bot-compare.ts`: `COOP_CARD` 환경변수 줄 삭제, 로그의 `cardKillTargetMult`를 `cardTarget(4) ${e.getCardKillTarget(4)}`로 교체.

## Acceptance Criteria
- [ ] `grep -rn "cardKillCount\|cardKillTargetMult\|waveCardKillTargets\|cardKillTarget:" src tests`가 결과 없음(`WaveProgressInfo.cardKillTarget` 필드 제외)
- [ ] 4·6웨이브에서 중간 카드가 정확히 한 번, 절반 처치에서 나온다

## Validation
- `npx tsc --noEmit` — 0 오류
- `npx vitest run` — 전부 통과

## Commit Message
```text
feat(wave): 처치 수 반복 중간 카드를 웨이브 절반 1회 지급으로 변경

Plan: 2026-11-08-half-wave-card-and-coop-density
Phase: P01-wave-rules
Task: T01-half-wave-card

- 웨이브 표 cardKillTarget → midWaveCard, cardKillTargetMult 삭제
- 엔진: killedInWave >= ceil(totalSpawns/2)에서 1회 지급(midCardGranted)
- HUD 진행 바에 절반 눈금 표시
- 가이드·README·문서·테스트 문구 동기화
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
