# Task: T04 3D 스튜디오 몬스터 6종·아이템 4종 재캡처 및 몬스터·아이템 통합 도감 문서 완성

## Status: done

## Goal
고도화된 실물 라벨 몬스터 6종과 신규 오비 펍 소품형 아이템 4종을 `docs/monster-studio.html`에서 렌더링하여 고해상도 스튜디오 이미지(`docs/screens/`)로 캡처하고, `docs/몬스터_도감_설명서.md`에 몬스터 6종·아이템 4종·5웨이브 공략을 총망라한 통합 도감 및 설명서를 작성한다.

## Decision Summary
- 사용자 요청 반영: "3개 같이 계획짜주고 도감이랑 아이템설명도 추가해줘"
- 업그레이드된 몬스터 모델(실물 라벨, Lathe 캔, 유리 투과 머그, 보스 HP 40)과 신규 아이템 4종(황금 병따개, 맥주 코스터, 얼음 버킷, 홉 열매 다발)을 모두 시각적 캡처와 함께 문서화.

## Implementation

### I01. 3D 스튜디오 뷰어(`docs/monster-studio.html`) 업그레이드 및 Playwright 일괄 캡처

- Related Files:
  - `docs/monster-studio.html` :: `window.showMonster`, `window.showAllLineup`, `window.showItem`, `window.showAllItemsLineup` — 실물 라벨 텍스처·Lathe 캔·유리 투과 머그 및 아이템 4종 3D 모델 스튜디오 뷰어 구현; modify
  - `docs/screens/monster-01-pilgood.png` ~ `docs/screens/monster-06-boss-dispenser.png`, `docs/screens/monster-lineup-all.png` — 업그레이드된 6종 몬스터 스튜디오 캡처 갱신; modify
  - `docs/screens/item-01-power-shot.png`, `docs/screens/item-02-wide-scope.png`, `docs/screens/item-03-ice-freeze.png`, `docs/screens/item-04-bar-repair.png`, `docs/screens/item-lineup-all.png` — 신규 4종 아이템 개별 및 풀 라인업 캡처; new
  - `docs/screens/screen-04-pc-gameplay.png` — HDRI·Bloom·88px 조준경·1.85배 몬스터·5목숨이 적용된 최신 인게임 화면 재캡처; modify

#### Details
- `docs/monster-studio.html`을 Vite 서버(`https://localhost:5173/docs/monster-studio.html` 또는 정적 경로)에서 열었을 때 `/textures/labels/{kind}.jpg`와 `LatheGeometry` 캔 곡선, 유리잔 투과 재질이 그대로 적용되도록 업데이트한다.
- `window.showItem(itemKind: 'power_shot' | 'wide_scope' | 'ice_freeze' | 'bar_repair')` 및 `window.showAllItemsLineup()` 함수를 추가하여 아이템 4종의 3D 소품과 회전 네온 오라, 하단 스펙 카드를 렌더링한다.
- Playwright 캡처 스크립트로 몬스터 7장(개별 6 + 라인업 1), 아이템 5장(개별 4 + 라인업 1), 인게임 플레이 화면(`screen-04-pc-gameplay.png`)을 캡처하여 `docs/screens/`에 저장한다.

### I02. 몬스터 & 아이템 통합 도감 및 5웨이브 공략 설명서(`docs/몬스터_도감_설명서.md`, `README.md`) 작성

- Related Files:
  - `docs/몬스터_도감_설명서.md` — 몬스터 6종(실물 라벨·지상/공중 특성) + 아이템 4종 도감 및 상세 설명 + 5단계 웨이브 공략 매뉴얼; modify
  - `README.md` — 5목숨, 5웨이브, 아이템 4종 요약 및 도감 링크 업데이트; modify

#### Details
- `docs/몬스터_도감_설명서.md` 구성:
  1. **몬스터 6종 전체 라인업 & 스펙 비교표**:
     - 지상형(`obi`, `hanmac`, `mug`, `boss`) vs 공중형(`pilgood`, `caslight`) 구분, 18m 스폰 거리, 보스 HP 40 반영.
     - 몬스터 6종 개별 고해상도 스튜디오 이미지 및 공략 포인트.
  2. **신규 섹션 — 🎁 오비 펍 아이템 4종 도감 및 활용 설명서**:
     - 아이템 4종 풀 라인업 이미지(`./screens/item-lineup-all.png`) 및 요약 비교표(아이콘, 이름, 외형 소품, 지속 시간, 효과, 등장 웨이브).
     - 개별 아이템 상세 설명 및 스튜디오 이미지:
       - 💥 **파워 샷 (`item-01-power-shot.png`)**: 황금 병따개 소품 + 붉은 오라 / 8초간 데미지 2배 (오비라거·한맥 원샷 원킬, 보스 극딜).
       - 🎯 **빅 스코프 (`item-02-wide-scope.png`)**: 오비 맥주 코스터 표적판 + 하늘색 오라 / 8초간 조준경 140px 확대 및 판정 반경 1.6배.
       - 🧊 **아이스 프리즈 (`item-03-ice-freeze.png`)**: 실버 얼음 버킷 + 파란 냉기 오라 / 8초간 전체 몬스터 이동 속도 50% 감속.
       - 🍺 **바 수리 (`item-04-bar-repair.png`)**: 초록 홉 열매 다발 + 에메랄드 오라 / 바 방어선 체력 즉시 +1 회복 (최대 5개).
  3. **신규 섹션 — 🌊 5단계 아케이드 웨이브(Wave 1~5) 구성 및 공략**:
     - Wave 1(워밍업 16마리) ➔ Wave 2(라거 더블탭 22마리) ➔ Wave 3(생맥주잔 러시 26마리) ➔ Wave 4(피버 아수라장 32마리) ➔ Wave 5(HP 40 냉각기 보스 레이드) 단계별 출현 몬스터와 추천 아이템 연계 공략.

## Acceptance Criteria
- [ ] `docs/screens/` 하위에 갱신된 몬스터 7장, 신규 아이템 5장(`item-01`~`04`, `item-lineup-all.png`), 갱신된 `screen-04-pc-gameplay.png`가 모두 생성된다.
- [ ] `docs/몬스터_도감_설명서.md`에 몬스터 6종 도감, 아이템 4종 도감 및 설명, 5단계 웨이브 공략이 이미지 링크와 함께 수록된다.
- [ ] 전체 테스트 스위트(`npm test`) 및 프로덕션 빌드(`npm run build`)가 에러 없이 성공한다.

## Validation
- `npm test && npm run build` — 전체 테스트 통과 및 프로덕션 번들 빌드 성공.

## Commit Message
```text
docs(codex): update 3D monster renders and add 4 pub item manual and 5-wave guide

Plan: 2026-11-01-arcade-v2-upgrade
Phase: P01-arcade-v2-upgrade
Task: T04-codex-studio-and-item-manual

- Upgrade monster-studio.html with real label textures and 4 pub item 3D models
- Capture studio renders for all 6 monsters, 4 items, and updated in-game play screen
- Expand docs/몬스터_도감_설명서.md with full item encyclopedia and 5-wave strategy guide
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
