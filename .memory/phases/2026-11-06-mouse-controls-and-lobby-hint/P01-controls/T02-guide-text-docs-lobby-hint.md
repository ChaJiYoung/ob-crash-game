# Task: T02 안내 문구·문서·로비 조작법

## Status: pending

## Goal
키가 사라진 안내를 모두 고치고, 로비 `QRPairingModal` 에 폰·마우스 조작법 두 줄을 넣는다.

## Decision Summary
- 로비 문구는 정적 텍스트(props 변경 없음). 마우스: `클릭 발사(누르고 있으면 연사) · 더블클릭 피버 · 우클릭 스킬 · Esc 일시정지`. 폰: `기울여 조준 · 탭 발사(꾹 누르면 연사) · 더블탭 피버 · 총구를 위로 휙 젖혀 스킬`.

## Implementation

### I01. 화면 문구
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` (129행 `더블탭/Space로 발동` → `더블클릭/더블탭으로 발동`) — modify
  - `src/pc/components/TutorialGuideOverlay.tsx` (109행 `[Space] 키` 문장 → `마우스는 따닥! 더블클릭`, 275행 `[Space / 모바일 더블탭]` → `[더블클릭 / 모바일 더블탭]`) — modify
  - `src/pc/components/GuideModal.tsx` (653행 `R 키 또는 마우스 우클릭` → `마우스 우클릭`, 654행 `Space 키 누르기` → `마우스 더블클릭`) — modify
  - `src/pc/components/QRPairingModal.tsx` — 가이드 버튼 아래, 사운드 안내 위에 조작법 박스 — modify
#### Details
- 로비 박스: `<div>` 작은 글씨(12px, `#94a3b8`, 어두운 반투명 배경, 라운드 10px), 제목 `🎮 조작법`, 두 줄 `📱 폰: …` / `🖱️ 마우스: …`.

### I02. 문서
- Related Files:
  - `docs/튜토리얼_훈련장_가이드.md` — 63행 스킬 `R` 키 삭제, 65행 피버 `Space` 바→`더블클릭`, 101행, 170·173행, 표의 스킬·피버 행(`R` 키 입력 → 삭제, `Space` 바 → `마우스 더블클릭`) — modify
  - `docs/무기_및_스킬_가이드.md` (150행 `` `R`/'휙!' `` → `'휙!'`) — modify
  - `docs/구동화면_쇼케이스.md` (95행 `` PC `R` 키/우클릭 `` → `PC 우클릭`) — modify
  - `docs/비어 크러셔 요구사항 분석서.md` (87행 키보드 `R`,`Space`,`C`,`1/2/3` → `Esc`만) — modify
  - `README.md` 에 조작 관련 문구가 있으면 맞춘다 — modify(필요 시)

### I03. 테스트
- Related Files:
  - `tests/pc-modals-and-pairing.test.ts` — modify: `renderToStaticMarkup(React.createElement(QRPairingModal, {roomId:'AB12', topRankings:[], onStartAsPc(){}, onStartWithController(){}}))` 가 `조작법`, `더블클릭`, `우클릭`, `더블탭` 을 포함하고 `Space` 와 `R 키` 를 포함하지 않는다. `.test.ts` 에서 JSX 불가이므로 `React.createElement` 사용(기존 pause-menu 테스트 방식).
  - `tests/docs-sync.test.ts` — 필요 시 갱신. 추가로 소스 파일들에 `Space 키`/`[Space` 가 남지 않았는지 검사.

## Acceptance Criteria
- [ ] 화면·문서 어디에도 Space·R 키 안내가 남지 않는다
- [ ] 로비에 폰·마우스 조작법 두 줄이 보인다

## Validation
- `npx tsc --noEmit && npx vitest run` — 전체 통과
- `grep -rnE "Space 키|\[Space|Space바|R 키|\`R\`" src docs README.md` (stage-concepts-preview.html 제외) — 결과 없음

## Commit Message
```text
feat(lobby): show controls in the lobby and update key hints

Plan: 2026-11-06-mouse-controls-and-lobby-hint
Phase: P01-controls
Task: T02-guide-text-docs-lobby-hint

- add a phone and mouse controls hint to the lobby
- replace Space and R guidance with double-click and right-click
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
