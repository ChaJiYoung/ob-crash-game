# Task: T01 문서, 가이드, 도감 도구, 스크린샷 갱신

## Status: pending

## Goal
플레이어 안내와 문서가 새 냉각기, 바닥 똥, 경고 띠, 피격 효과를 그대로 설명하고, 옛 설명이 다시 들어오지 못하게 막는다.

## Decision Summary
- 사용자 요청 "문서까지 같이". 결정 D02~D06의 최종 동작을 기준으로 쓴다. 수치는 가능하면 `GAME_TUNING` 값을 참조한다.

## Implementation

### I01. 문구
- Related Files (모두 modify):
  - `src/pc/components/GuideModal.tsx` 95행: "스테인리스 캐비닛과 듀얼 골드 탭을 장착한 보스" → "앞면에 탭이 달린 업소용 냉각기 보스. 소형은 은색 1구, 대왕은 검정 3구에 금색 왕관"
  - `docs/몬스터_도감_설명서.md` 21행(개요 표), 61행 외형 → 은색 스테인리스 몸통, 앞면 탭 1구, 검정 물받이, 옆 통풍구, OB 로고 이름판. 대왕: 검정 몸통, 금색 레버 3구, 왕관. 62행 `⚠️ 보스 등장!` → `WARNING` 경고 띠. 154행 "공중에서 요격" → "바닥을 따라 다가오는 똥을 요격"
  - `docs/구동화면_쇼케이스.md` 189행 "듀얼 탭 레버" → "탭 레버". 202행 똥 설명에 "바닥에 붙어 늘었다 줄었다 하며 다가옵니다" 추가
  - `docs/무기_및_스킬_가이드.md` 186행 "공중에서 사격하여" → "바닥을 따라 다가올 때 사격하여". 장전 설명이 있으면 굵어진 링과 흐려지는 조준점을 한 줄 추가
  - `docs/비어 크러셔 요구사항 분석서.md` 77행 FR-GIM-03에 "바닥에 붙어 위아래로 늘고 줄며 접근" 추가. 보스 경고·피격 효과 요구사항 표기가 있는 곳에 추가
  - `docs/비어 크러셔 상세설계서.md` 569~570행 근처에 똥의 바닥 판정(`customNormY` 제거) 한 줄 추가
  - `README.md` 51행에 경고 띠와 피격 번쩍임 추가

### I02. 도감 도구
- Related Files:
  - `docs/monster-studio.html` :: `buildModel`의 `kind === 'boss'`(205행), `MONSTER_SPECS`, `showMonster`, `showAllLineup`; modify

#### Details
- 함정: 이 페이지는 게임 코드를 가져오지 않고 **보스 모델을 따로** 만든다. 고치지 않으면 도감 사진에 옛 타워 모델이 그대로 찍힌다.
- `kind === 'boss'`는 T02의 소형 치수로, 새 `kind === 'boss-king'`은 대형 치수로 만든다. 로고는 `new THREE.TextureLoader().load('/textures/labels/ob-logo.jpg')`.
- `MONSTER_SPECS['boss-king']`을 추가한다(이름 "대왕 냉각기", HP 200). `showMonster`의 카메라 분기를 `kind === 'boss' || kind === 'boss-king'`으로 넓힌다. 라인업은 `boss`만 유지한다.

### I03. 스크린샷
- Related Files:
  - `scripts/capture-boss-and-shell.mjs`; new
  - `docs/screens/monster-06-boss-dispenser.png`, `docs/screens/monster-06b-boss-king.png`(new), `docs/screens/play-wave5-boss-cooler.png`, `docs/screens/play-poop-shell.png`, `docs/screens/play-boss-warning.png`(new); modify

#### Details
- `capture-all.mjs`, `capture-weapons-and-skills.mjs`는 수십 장을 덮어쓰므로 쓰지 않고, 필요한 장면만 찍는 스크립트를 만든다. 시작 방법은 `capture-weapons-and-skills.mjs`를 따른다(`https://localhost:5173`, `--ignore-certificate-errors --use-gl=angle --use-angle=metal`, 버튼 "스마트폰 없이 PC" 클릭, `window.__engine`).
- 장면:
  1. `/docs/monster-studio.html`에서 `window.showMonster('boss')`, `showMonster('boss-king')`.
  2. `eng.startGame({ withWeaponSelect: false }); eng.startWave(5);` 후 활성 대상을 비우고 보스 등장 메서드를 부른다. 직후 0.3초에 `play-boss-warning.png`, 2.5초 뒤 `play-wave5-boss-cooler.png`. `spawnBossEncounter`가 private이면 `eng['spawnBossEncounter'](performance.now())`로 부른다.
  3. `eng.spawnMonsterProjectile(performance.now(), 'hanmac', { thetaRad: 0.05, radiusM: 7.0 })` 후 0.2초에 `play-poop-shell.png`. 마우스는 `(150, 760)`으로 치워 요격을 막는다.
- 문서에 새 사진을 넣는다: 도감 6번 절에 `monster-06b-boss-king.png`, 쇼케이스 보스 절에 `play-boss-warning.png`.

### I04. 재발 방지
- Related Files:
  - `tests/docs-sync.test.ts` :: `FORBIDDEN`; modify

#### Details
- 추가: `{ pattern: /듀얼 골드 탭|듀얼 탭 레버|크롬 드래프트 타워/, why: 'the coolers have front taps now' }`, `{ pattern: /공중에서 (사격|요격)|⚠️ 보스 등장/, why: 'shells stay on the floor and the warning is a WARNING band' }`.
- 검사 파일에 무기 가이드도 포함되지만 "듀얼 고압관", "듀얼 드럼통"은 패턴에 걸리지 않는다.

## Acceptance Criteria
- [ ] 문서와 가이드에 옛 표현이 없고 `docs-sync` 테스트가 통과한다.
- [ ] 도감 사진에 새 소형·대왕이 나오고, 경고 띠·똥 장면 사진이 실제 화면이다.
- [ ] 다른 스크린샷은 바뀌지 않는다(`git status`로 확인).

## Validation
- `npx vitest run tests/docs-sync.test.ts` — 통과
- 개발 서버를 켠 뒤 `node scripts/capture-boss-and-shell.mjs` — 5장 생성, 눈으로 확인

## Commit Message
```text
docs(game): describe the new coolers, floor shells, warning band and hit flash

Plan: 2026-11-05-playtest-visual-feedback
Phase: P03-docs-and-verify
Task: T01-docs-and-capture

- Sync the guide, docs and monster studio with the final behaviour
- Refresh only the affected screenshots and guard against the old wording

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
