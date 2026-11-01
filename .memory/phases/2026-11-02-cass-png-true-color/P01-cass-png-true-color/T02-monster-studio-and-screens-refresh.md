# Task: T02 몬스터 스튜디오 MeshBasicMaterial 동기화 및 도감 스크린샷 갱신

## Status: done ✅

## Goal
`docs/monster-studio.html`에 `MeshBasicMaterial`을 동기화하여 스튜디오 뷰에서도 과도한 조명(KeyLight 1.8, PointLight 2.0)으로 인한 쨍함을 완전히 제거하고, Playwright 자동 캡처로 도감 단독 컷(`monster-05-cass-bottle.png`), 6종 라인업(`monster-lineup-all.png`), 인게임 화면(`screen-04-pc-gameplay.png`)을 재캡처하여 시각적으로 검수한다.

## Decision Summary
- `.memory/decisions/2026-11-02-cass-png-true-color.md`의 D03 결정 반영.
- `docs/monster-studio.html`의 `bottle` 빌보드를 `MeshBasicMaterial`로 수정.
- 개발 서버 구동 후 `node scripts/capture-all.mjs` 실행하여 공식 이미지 에셋 최신화.

## Implementation

### I01. monster-studio.html bottle 빌보드 머티리얼 교체

- Related Files:
  - `docs/monster-studio.html` :: `buildModel` — 카스 병맥주 메쉬 생성 시 `MeshBasicMaterial` 적용; modify

#### Details
- **Signatures & Types**:
  ```javascript
  const billboardMat = new THREE.MeshBasicMaterial({
    map: cassTex,
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
  });
  ```

### I02. 스크린샷 전면 재캡처 및 시각 검수

- Related Files:
  - `docs/screens/monster-05-cass-bottle.png`
  - `docs/screens/monster-lineup-all.png`
  - `docs/screens/screen-04-pc-gameplay.png`
  - `docs/몬스터_도감_설명서.md`

## Acceptance Criteria
- [ ] `docs/monster-studio.html`의 카스 병맥주가 3D 광원 중복 없이 원본 PNG 픽셀 색상으로 깨끗하게 렌더링됨.
- [ ] 도감 단독 컷 및 라인업 스크린샷이 쨍함 없는 자연스러운 실물 색상으로 갱신됨.
- [ ] 단위 테스트 32개 전체 통과 유지.

## Validation
- `node scripts/capture-all.mjs && npm test` — 스크린샷 정상 캡처 및 테스트 통과

## Commit Message
```text
docs(studio): apply true-color MeshBasicMaterial to Cass bottle and refresh screenshots

Plan: 2026-11-02-cass-png-true-color
Phase: P01-cass-png-true-color
Task: T02-monster-studio-and-screens-refresh

- Update docs/monster-studio.html to use MeshBasicMaterial for authentic color reproduction
- Re-capture monster-05-cass-bottle.png and monster-lineup-all.png with zero lighting blowouts
- Update docs/몬스터_도감_설명서.md with true-color specifications
- Visually verify crisp natural glass and amber beer in official docs
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
