# Task: T03 몬스터 스튜디오(`monster-studio.html`) 슬림 롱넥 병맥주 동기화, 스크린샷 전면 재캡처 및 시각 검수

## Status: done

## Goal
`docs/monster-studio.html`의 `buildModel('bottle')`을 인게임(`TargetModels3D.ts`)과 동일한 **슬림 롱넥 `LatheGeometry` 카스 프레시 유리병 + 황금빛 앰버 액체(상단 투명 유리목) + 정품 V-컷 바디 라벨(`bottle.jpg`) & 전용 넥 라벨(`bottle-neck.jpg`)**로 동기화하고, `scripts/capture-all.mjs`를 실행해 도감 및 인게임 스크린샷을 갱신한 뒤 캡처된 이미지를 직접 시각 검수하여 완료한다.

## Decision Summary
- D02 반영: 스튜디오 3D 뷰어의 병맥주 모델을 단상 중앙(`y = -0.78 ~ +0.98`)에 날씬한 롱넥 비율로 배치하고, 바디 라벨(`bottle.jpg`)과 넥 라벨(`bottle-neck.jpg`)을 각각 `openEnded: true` 실린더 쉘로 매핑한다.
- 캡처 완료 후 `docs/screens/monster-05-cass-bottle.png`와 `docs/screens/monster-lineup-all.png`를 직접 읽어 사용자 참조 이미지(`scripts/assets/cass_fresh_ref.jpg`)와 비주얼이 일치하는지 최종 확인한다.

## Implementation

### I01. `docs/monster-studio.html` 슬림 롱넥 병맥주 지오메트리 및 분리형 라벨 동기화

- Related Files:
  - `docs/monster-studio.html` :: `buildModel('bottle')` — 슬림 롱넥 `LatheGeometry`, 황금빛 앰버 액체(투명 목 공간), 하단 크리스탈 패싯, `bottle` 및 `bottle-neck` 분리 매핑; modify

#### Details
- 스튜디오 스케일(캔 높이 `1.18` 기준, 병맥주는 롱넥이므로 전체 높이 약 `1.70`, `y = -0.75` 바닥 ~ `y = +0.95` 뚜껑)로 `LatheGeometry` 프로파일을 구성한다:
  - 바디 반경 `0.285`, 숄더 곡선(`y = 0.22 ~ 0.56`), 슬림 롱넥 반경 `0.105` (`y = 0.56 ~ 0.92`).
  - 내부 황금빛 앰버 액체는 `y = -0.72 ~ +0.52`까지만 채우고, `y = 0.52 ~ 0.92` 목 상단은 투명한 빈 유리로 비워둔다.
  - 바디 라벨(`loadLabelTex('bottle')`)은 `y = -0.15`, 반경 `0.288`, 높이 `0.54` (`openEnded: true`).
  - 넥 라벨(`loadLabelTex('bottle-neck')`)은 `y = +0.62`, 상단 반경 `0.108`, 하단 반경 `0.118`, 높이 `0.16` (`openEnded: true`).

### I02. 전체 스크린샷 재캡처 및 시각 검수

- Related Files:
  - `scripts/capture-all.mjs` — Playwright 자동 캡처 실행; read-only
  - `docs/screens/monster-05-cass-bottle.png` — 슬림 롱넥 카스 프레시 단독 컷; modify
  - `docs/screens/monster-05-draft-mug.png` — 하위 호환 파일 동기화; modify
  - `docs/screens/monster-lineup-all.png` — 6종 몬스터 풀 라인업; modify
  - `docs/screens/screen-04-pc-gameplay.png` — 인게임 플레이 화면; modify

#### Details
- Vite 서버 구동 상태에서 `node scripts/capture-all.mjs` 실행.
- 캡처된 `docs/screens/monster-05-cass-bottle.png`를 읽어들여 체커보드 아티팩트가 없고 참조 사진(`cass_fresh_ref.jpg`)과 동일한 슬림 롱넥 실루엣과 대각선 `Cass Fresh` V-컷 블루/골드 라벨, `COLD BREWED` 넥 라벨이 선명하게 렌더링되었는지 확인한다.
- `npm test && npx tsc --noEmit` 실행으로 전체 테스트 및 타입 무결성을 검증한다.

## Acceptance Criteria
- [ ] `docs/screens/monster-05-cass-bottle.png`에서 슬림 롱넥 투명 유리병, 황금빛 앰버 맥주 액체, 투명한 상단 유리목, 대각선 `Cass Fresh` V-컷 바디 라벨, `COLD BREWED` 넥 라벨이 왜곡 없이 선명하게 보인다.
- [ ] `docs/screens/monster-lineup-all.png` 및 `docs/screens/screen-04-pc-gameplay.png`가 최신 모델로 갱신되었다.
- [ ] `npm test` (32/32 통과) 및 `npx tsc --noEmit` (에러 0건)이 통과한다.

## Validation
- `npm test && npx tsc --noEmit` — 전체 테스트 및 타입체크 통과

## Commit Message
```text
docs: synchronize slim long-neck Cass Fresh bottle in studio and refresh all codex screenshots

Plan: 2026-11-02-real-cass-fresh-longneck-bottle
Phase: P01-real-cass-fresh-longneck-bottle
Task: T03-studio-sync-and-visual-verification

- Update monster-studio.html bottle builder with slim long-neck LatheGeometry, amber liquid headspace, and dedicated bottle-neck label
- Recapture monster-05-cass-bottle.png, monster-lineup-all.png, and screen-04-pc-gameplay.png
- Visually verify captured renders against reference Cass Fresh bottle image
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
