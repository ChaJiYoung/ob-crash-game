# Task: T05 4·6웨이브 중간 카드 복구

## Status: done

## Goal
4웨이브 22킬, 6웨이브 26킬에서 중간 카드가 다시 나오고(보스 웨이브는 없음), 이 구성에 맞게 HUD·문서·테스트·기준 시간이 정리된다.

## Decision Summary
- 결정 D08. 값(`cardKillTarget`) 외에 HUD 진행 바의 카드 카운터, 가이드·문서, `docs-sync`, 몇몇 테스트를 되돌린다.
- 샷건 보스 피해 배율은 이번 Task에 넣지 않는다.

## Implementation
- `src/shared/gameTuning.ts`: 4웨이브 `cardKillTarget: 22`, 6웨이브 `26`. 주석을 "보스 웨이브(3·5·7)는 보스를 안 죽이고 모으는 파밍을 막으려고 null"로 고친다.
- `src/pc/components/ArcadeOverlayHUD.tsx`: 진행 바 안의 `🃏 카드: n/N KILL` 문구(`waveProgress.cardKillTarget !== null`)를 복구한다. `getWaveHudMode(bossCount)`는 그대로(보스가 있으면 진행 바 숨김).
- `src/pc/components/GuideModal.tsx`: `MID_CARD_TEXT`를 표에서 만들어 "웨이브를 클리어할 때, 그리고 {MID_CARD_TEXT} 중간에"로 복구.
- 문서: README 49행, `docs/무기_및_스킬_가이드.md` 146행("한 판에 6장" → 8장 이상), `docs/구동화면_쇼케이스.md` 103행, `docs/몬스터_도감_설명서.md`의 4·6웨이브 표 행; modify.
- 테스트: `boss-encounters`(4웨이브 22, 6웨이브 26, 나머지 null), `boss-concurrent-spawns`(보스 웨이브 3·5·7만 검사), `gameplay-polish`(원래 제목과 직접 지정 제거), `docs-sync`(4·6웨이브 숫자 확인, 보스 웨이브 중간 카드 문구 없음); modify.
- `parTimeSec`: 30판 재측정 후 보스 웨이브 보너스 기울기 검증을 지키는지 확인하고, 깨지면 갱신하지 않고 보고한다.

## Validation
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과

## Commit Message
```text
tune(cards): bring back the wave 4 and 6 mid-wave cards

Plan: 2026-11-06-card-farming-fix
Phase: P02-shell-pressure
Task: T05-restore-mid-cards-4-6

- cardKillTarget 22 for wave 4 and 26 for wave 6, none for boss waves
- Restore the HUD card counter and the guide text, rewrite the tests that pinned "no mid cards"

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (507개 테스트, tsc, build)
- commit: 클리어율 샷건 50%·리볼버 93%·개틀링 95%로 회복. `parTimeSec`는 보스 웨이브 보너스 기울기 검증과 충돌해 갱신 보류(references 5절).
