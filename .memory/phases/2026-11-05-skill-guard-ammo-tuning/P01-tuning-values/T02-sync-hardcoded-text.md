# Task: T02 하드코딩된 안내 문구를 새 값에 맞게 정리

## Status: pending

## Goal
장전 시간·탄수·방패 주기·장전 배율이 코드와 문서 여기저기에 숫자로 박혀 있다. 새 값(T01)과 어긋난 문구를 값 참조 또는 값에 독립적인 문장으로 바꿔, 게임 화면과 문서가 거짓말하지 않게 한다. 모바일 `GunGripPad.tsx` 문구 수정은 사용자가 요청한 범위다.

## Decision Summary
- 가능한 곳은 `GAME_TUNING`에서 값을 읽는다. 값을 읽기 어려운 곳(모바일은 무기 정보가 없다)은 숫자를 빼고 "탄창이 비면 자동으로 재장전" 같은 값에 독립적인 문장으로 쓴다.
- 코드 문구와 `docs-sync` 테스트가 검사하는 문서(README 포함)는 테스트로 고정한다.

## Implementation

### I01. 화면 문구(코드)
- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `formatAmmoStatusText` (90행) — `'⚡ 자동 장전 중 (1.2s)...'` → `'⚡ 자동 장전 중...'`; modify
  - `src/pc/components/TutorialGuideOverlay.tsx` (254행) — `'⚡ 자동 재장전 중 (1.2s)...'` → `'⚡ 자동 재장전 중...'`; modify
  - `src/controller/components/GunGripPad.tsx` (313~316행) — `⚡ 10발 소진 시 1.2초 뒤 자동으로 재장전됩니다` → `⚡ 탄창이 비면 자동으로 재장전됩니다`; modify
  - `src/pc/components/GuideModal.tsx` (339행) — `재장전 약 {Math.round(GAME_TUNING.fire.reloadScale)}배` 수정; modify

#### Details
- **함정**: `Math.round(1.2)`는 **1**이라 GuideModal이 "재장전 약 1배"라는 틀린 문구를 낸다. 반올림하지 말고 `{GAME_TUNING.fire.reloadScale.toFixed(1)}배`로 쓴다(1.2배). 같은 모달의 다른 문구(방패 `guardUpMs / 1000`)는 이미 값을 읽으므로 그대로 둔다(0.8초 / 2.4초로 자동 반영).
- `tests/pc-hud-and-banner.test.ts:21`은 `toContain('자동 장전 중')`만 검사하므로 새 문구에서도 통과한다. 같은 파일에 `expect(formatAmmoStatusText(0, 10, true, false)).not.toMatch(/\d\.\ds/)`(초 단위 숫자가 없음)를 추가한다.
- 모바일 문구에 `maxAmmo`나 초를 넣지 않는다(컨트롤러는 무기 탄수를 모른다. 프로토콜 변경은 범위 밖).

### I02. 문서 문구
- Related Files:
  - `README.md` (34, 36행) — "장전(기본의 2배)", "장전은 2배로 깁니다" → "장전(기본의 1.2배)", "장전은 1.2배로 깁니다"; modify
  - `docs/튜토리얼_훈련장_가이드.md` (63, 157행) — "탄창 10발 소진 시 1.2초 후 자동 재장전" → "탄창이 비면 자동 재장전", `RELOADING... (1.2s)` → `RELOADING...`; modify
  - `docs/몬스터_도감_설명서.md` (18, 43, 119행) — 오비 "1.5초 들고 1.5초 내림" → "0.8초 들고 2.4초 내림"; 119행 "자동 재장전(1.2s)" → "자동 재장전"; modify
  - `docs/비어 크러셔 요구사항 분석서.md` (74행 FR-MON-04) — "오비(방패 1.5초/1.5초" → "오비(방패 0.8초/2.4초"; modify
  - `docs/비어 크러셔 상세설계서.md` (344행) — "1.5초 방패 올림 / 1.5초 내림" → "0.8초 방패 올림 / 2.4초 내림"; modify

#### Details
- 먼저 `grep -rnE "1\.5초|1\.2초|1\.2s|10발|장전.{0,6}2배|2배.{0,6}장전|35초|31초|27초|23초" README.md docs src` 로 남은 곳을 확인하고 위 목록에 없는 항목은 문맥을 보고 고친다. "10발"은 샷건·리볼버 시작 탄수와 우연히 일치하는 곳(무기 가이드 표)이 있으니 표 값은 건드리지 않는다.
- 문서 수치는 `GAME_TUNING`과 일치해야 한다: 방패 올림 0.8초·내림 2.4초, 장전 배율 1.2, 쿨타임 21/19/16/14초.

### I03. 문서 일치 테스트 추가
- Related Files:
  - `tests/docs-sync.test.ts` — 오비 방패 주기와 장전 배율 문구 검사; modify

#### Details
- `docs/몬스터_도감_설명서.md`와 `README.md`를 읽어 다음을 검사한다:
  1. 몬스터 도감에 `${guardUpMs / 1000}초 들고 ${guardDownMs / 1000}초 내림`(또는 `내리기`) 문자열이 있다.
  2. 몬스터 도감·튜토리얼·README에 `1.5초 들고 1.5초`, `(1.2s)`, `1.2초 뒤`가 남아 있지 않다.
  3. README에 `기본의 ${GAME_TUNING.fire.reloadScale}배`가 있다.

### I04. 모바일 쿨타임 초기값 (D06-1)
- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `skillState` 초기값 (41행) — `skillCooldownTotalMs: 25000` → `GAME_TUNING.skillCooldownMsByLevel[1]`; modify
  - `tests/controller-ui-and-routing.test.ts` — 소스 검사 추가; modify

#### Details
- 25000은 옛 값(어느 튜닝에도 맞지 않는 임시 값)이다. 서버 메시지가 오기 전 한 순간만 쓰이지만 진행 바 비율 계산에 쓰이므로 새 쿨타임(21000)과 맞춘다.
- `import { GAME_TUNING } from '../shared/gameTuning';`를 추가한다(`gameTuning.ts`는 다른 파일을 import하지 않아 컨트롤러 번들에 들어가도 안전하다). 이미 `../shared/constants`를 import하므로 공유 모듈 import 자체는 관례에 맞다.
- 테스트: 소스에 `skillCooldownTotalMs: 25000`이 남아 있지 않고 `GAME_TUNING.skillCooldownMsByLevel[1]`을 쓴다.

## Acceptance Criteria
- [ ] 화면(HUD·튜토리얼·모바일 컨트롤러·가이드 모달)에 더 이상 "1.2초/1.2s/10발 소진"이 없다.
- [ ] 가이드 모달의 장전 배율이 "약 1.2배"로 나온다(1배로 보이지 않는다).
- [ ] 문서의 오비 방패 수치는 0.8초/2.4초, 장전 배율은 1.2배다.
- [ ] 모바일 컨트롤러 초기 쿨타임이 `GAME_TUNING.skillCooldownMsByLevel[1]`을 참조한다.
- [ ] `npm test` 전체 통과.

## Validation
- `grep -rnE "\(1\.2s\)|1\.2초 뒤|1\.5초 들고|1\.5초/1\.5초" src docs README.md` — 결과 없음
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
docs(game): replace hard-coded reload/shield numbers with the tuned values

Plan: 2026-11-05-skill-guard-ammo-tuning
Phase: P01-tuning-values
Task: T02-sync-hardcoded-text

- remove "1.2s" from the PC HUD, tutorial overlay and mobile controller hint
- guide modal shows the reload multiplier with one decimal (1.2x, not "1x")
- README and docs now describe 0.8s/2.4s obi shields and 1.2x reload
- add docs-sync checks for the obi guard cycle and the reload multiplier
- mobile controller initial skill cooldown reads GAME_TUNING instead of 25000
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
