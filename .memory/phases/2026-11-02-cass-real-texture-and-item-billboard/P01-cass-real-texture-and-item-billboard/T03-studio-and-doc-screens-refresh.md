# Task: T03 몬스터 스튜디오 3D 동기화, 도감·쇼케이스 전체 스크린샷 재캡처 및 무결성 검증

## Status: done

## Goal
`docs/monster-studio.html`에 실사 카스 병맥주 텍스처/넥 라벨과 4종 아이템 상단 3D 네온 빌보드 라벨을 온전히 동기화하고, `scripts/capture-all.mjs`를 실행하여 공식 도감 설명서(`docs/몬스터_도감_설명서.md`)와 인게임 화면 스크린샷을 전면 최신화하며, 전체 단위 테스트(32/32개) 및 TypeScript 컴파일 무결성을 검증한다.

## Decision Summary
- D03 반영: 스튜디오 뷰어(`monster-studio.html`)에서 실사 카스 병맥주 및 4종 아이템 상단 네온 빌보드가 선명하게 보이도록 스튜디오 지오메트리를 동기화한다.
- Playwright 자동 캡처 스크립트(`scripts/capture-all.mjs`)를 실행하여 실사 카스 병맥주 단독 컷, 6종 몬스터 라인업, 네온 빌보드가 부착된 4종 아이템 단독 컷 및 아이템 라인업, 실시간 인게임 전투 화면을 최신 실물 상태로 재캡처하여 저장한다.

## Implementation

### I01. `docs/monster-studio.html` 스튜디오 3D 뷰어 동기화

- Related Files:
  - `docs/monster-studio.html` :: `buildModel('bottle')` — 실사 라벨 텍스처 매핑 및 넥 라벨 실린더 추가; modify
  - `docs/monster-studio.html` :: `buildItemModel` — 아이템 상단에 `itemBillboard` 네온 라벨 스프라이트 추가; modify

#### Details
- **Bottle Model in Studio**:
  - `loadLabelTex('bottle')`를 3D 병 몸통에 곡면 매핑하고, 넥 부분에 실사 미니 넥 밴드 실린더 추가
- **Item Props in Studio**:
  - 4종 아이템 소품 상단(`y = 0.85m`)에 네온 빌보드 카드 스프라이트(`[💥 DAMAGE 2X]`, `[🎯 WIDE 1.6X]`, `[🧊 SLOW 50%]`, `[🍺 LIFE +1]`) 부착

### I02. `scripts/capture-all.mjs` 실행 및 도감 문서 갱신

- Related Files:
  - `scripts/capture-all.mjs` — 스크린샷 캡처 실행; read-only/run
  - `docs/screens/*.png` — 전면 재캡처된 최신 스크린샷 파일들; modify
  - `docs/몬스터_도감_설명서.md` — 네온 빌보드가 부착된 최신 아이템 및 실사 카스 병맥주 스크린샷 반영; modify

#### Details
- Vite 서버 구동 상태에서 `node scripts/capture-all.mjs` 실행
- 다음 스크린샷 파일들이 최신 실물로 갱신됨:
  - `monster-05-cass-bottle.png` (실사 카스 병맥주 단독 컷)
  - `monster-lineup-all.png` (실사 카스 병맥주가 포함된 6종 라인업)
  - `item-01-power-shot.png` ~ `item-04-bar-repair.png` (네온 빌보드가 부착된 아이템 4종)
  - `item-lineup-all.png` (네온 빌보드가 부착된 아이템 4종 라인업)
  - `screen-04-pc-gameplay.png` (네온 빌보드 아이템과 실사 병맥주가 쇄도하는 인게임 화면)

### I03. 전체 테스트 및 타입 검사 무결성 확인

- Related Files:
  - 전체 테스트 스위트 (`npm test`)
  - 전체 프로젝트 타입체크 (`npx tsc --noEmit`)

## Acceptance Criteria
- [ ] `docs/monster-studio.html`에서 실사 카스 병맥주와 네온 빌보드가 부착된 4종 아이템이 에러 없이 렌더링된다.
- [ ] `node scripts/capture-all.mjs` 실행으로 `docs/screens/` 내의 모든 몬스터, 아이템, 인게임 스크린샷이 최신 상태로 갱신된다.
- [ ] `npm test` 실행 시 전체 테스트(32/32개)가 100% 통과한다.
- [ ] `npx tsc --noEmit` 실행 시 타입 에러가 0건이다.

## Validation
- `npm test` — 전체 테스트 통과 확인
- `npx tsc --noEmit` — TypeScript 컴파일 에러 없음 확인

## Commit Message
```text
docs: update monster/item studio and recapture all codex screenshots with real Cass bottle and item billboards

Plan: 2026-11-02-cass-real-texture-and-item-billboard
Phase: P01-cass-real-texture-and-item-billboard
Task: T03-studio-and-doc-screens-refresh

- Update monster-studio.html with photorealistic Cass bottle neck label and persistent 3D item billboards
- Recapture all 6 monster renders, 4 item renders, both lineups, and live in-game battle screenshot
- Update 몬스터_도감_설명서.md with latest high-fidelity screenshots
- Validate 32/32 unit tests pass and zero TypeScript errors
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
