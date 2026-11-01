# Blueprint: T02 - 몬스터 스튜디오 실사 빌보드 동기화 및 도감/인게임 스크린샷 전면 재캡처

## Status
`planned`

## Description
`docs/monster-studio.html`에 새로 구현된 `cass_official_veluga.png` 기반 실사 3D 빌보드 병맥주 모델을 동기화하고,
Vite 로컬 개발 서버 구동 상태에서 Playwright 스크립트(`node scripts/capture-all.mjs`)를 실행하여
공식 도감 단독 컷(`docs/screens/monster-05-cass-bottle.png`), 6종 전체 라인업(`docs/screens/monster-lineup-all.png`), 그리고 인게임 전투 화면(`docs/screens/screen-04-pc-gameplay.png`)을 전면 재캡처 및 시각 검수한다.
또한 `docs/몬스터_도감_설명서.md`의 카스 병맥주 항목 설명을 공식 정품 실사 빌보드 사양으로 최신화한다.

## Target Files & Symbols
- `docs/monster-studio.html`:
  - `createBottleTarget()` 함수를 `cass_official_veluga.png` 실사 빌보드 렌더링으로 동기화.
- `docs/screens/`:
  - `monster-05-cass-bottle.png`
  - `monster-lineup-all.png`
  - `screen-04-pc-gameplay.png`
- `docs/몬스터_도감_설명서.md`:
  - 5번 몬스터 '카스 병맥주 (All New Cass 500ml)' 그래픽 설명 동기화.

## Verification Command
```bash
node scripts/capture-all.mjs && npm test
```

## Commit Message
```text
docs(studio): sync official PNG bottle to monster studio and refresh all screen assets

Plan: 2026-11-02-cass-official-png-billboard
Phase: P01
Task: T02

- Synchronize official transparent Cass bottle billboard to docs/monster-studio.html
- Re-capture monster-05-cass-bottle.png, monster-lineup-all.png, and screen-04-pc-gameplay.png
- Update docs/몬스터_도감_설명서.md with official authentic bottle billboard specs
- Visually verify crisp transparent glass, golden beer, and intact 3D combat particles
```
