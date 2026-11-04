# Task: T05 Recapture Doc Screenshots

## Status: pending

## Goal
문서 이미지가 최종 게임 화면과 같게 한다. 바 카운터, INTERCEPTED 배너, 블룸, 5웨이브 보스가 담긴 이전 화면을 교체한다.

## Decision Summary
- 사용자가 계획 포함을 요청했다.
- 직접 플레이 조정(P05-T04)이 끝난 뒤 찍어야 다시 찍는 일이 없다.
- `play-*.png`를 만드는 스크립트가 지금 없어 새로 만든다.

## Implementation

### I01. 게임 플레이 캡처 스크립트

- Related Files:
  - `scripts/capture-gameplay-docs.mjs` :: 플레이 화면 캡처; new

#### Details
- `scripts/capture-weapons-and-skills.mjs`의 접속·시작 방식을 따른다(Playwright, `https://localhost:5173`, `ignoreHTTPSErrors`, 1440×900).
- **만들 이미지**(`docs/screens/`):
  | 파일 | 장면 | 준비 방법 |
  | :--- | :--- | :--- |
  | `play-starting-weapon-select.png` | 무기 선택 | 게임 시작 직후 |
  | `play-wave1-shotgun-combat.png` | 샷건 전투 | 1웨이브 진행 중 사격 |
  | `play-golden-can-detected.png` | 금색 캔 | `eng.spawnGoldenCanTarget(now)` |
  | `play-kill-gauge-reward-cards.png` | 보상 카드 | `eng.spawnWaveRewardCards(now, false)` |
  | `play-fever-foam-tsunami.png` | 피버 + 스킬 | `eng.triggerSandboxFever(now)` 후 스킬 |
  | `play-boss-cooler.png` | 냉각기 1대 | `eng.startWave(3)` 뒤 미니웨이브 정리 |
  | `play-boss-king-shield.png` | 2대 + 대왕 쉴드 | `eng.startWave(7)` 뒤 미니웨이브 정리 |
- 화면 확인을 위해 3D가 그려질 시간을 기다린 뒤(최소 500ms) 찍는다.

### I02. 재촬영

#### Details
`npm run dev`를 켠 상태에서 실행한다.
```bash
node scripts/capture-gameplay-docs.mjs
node scripts/capture-weapons-and-skills.mjs
node scripts/capture-tutorial.mjs
node scripts/capture-all.mjs
```
- 몬스터·아이템 스튜디오 이미지(`monster-*`, `item-*`)는 `docs/monster-studio.html`에서 만들어진다. 물방울 제거와 몬스터 특색 변경이 반영되는지 확인하고, 스튜디오가 게임 모델을 쓰지 않으면 해당 HTML도 맞춘다.
- 모바일 이미지(`screen-02`, `screen-03*`)와 로비 이미지(`screen-01*`)는 화면이 바뀌지 않았으면 그대로 둔다.
- 찍은 이미지를 **직접 열어 확인한다.** 빈 화면, 카드가 가려진 화면, 낡은 UI가 있으면 다시 찍는다.

### I03. 문서 연결

- Related Files:
  - `README.md`, `docs/몬스터_도감_설명서.md`, `docs/구동화면_쇼케이스.md` — 이미지 경로와 캡션; modify

#### Details
- `play-wave5-boss-cooler.png` 참조(3곳)를 `play-boss-cooler.png`로 바꾸고, 대왕 쉴드 이미지를 보스 설명에 추가한다.
- 옛 파일 `docs/screens/play-wave5-boss-cooler.png`는 참조가 없는 것을 확인한 뒤 `git rm`한다.
- 링크 확인:
  ```bash
  grep -rhoE "screens/[^)\" ]+" README.md docs/*.md | sort -u | while read -r p; do [ -f "docs/$p" ] || echo "MISSING $p"; done
  ```

## Acceptance Criteria
- [ ] 문서 이미지에 바 카운터, INTERCEPTED 배너, 블룸 효과가 없다.
- [ ] 7웨이브 보스와 대왕 쉴드 이미지가 있다.
- [ ] 끊어진 이미지 링크가 없다.

## Validation
- I02 명령 — 모두 종료 코드 0
- I03 링크 확인 — `MISSING` 없음
- 사람이 이미지 확인 — 최종 화면과 일치
- `npm test` — 전체 통과

## Commit Message
```text
docs(screens): recapture screenshots for the final game

Plan: 2026-11-04-gameplay-polish-and-perf-optimization
Phase: P05-docs-and-verification
Task: T05-recapture-doc-screenshots

- Add a gameplay screenshot capture script
- Replace outdated combat, card, guide, and boss images
- Update document image links
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
