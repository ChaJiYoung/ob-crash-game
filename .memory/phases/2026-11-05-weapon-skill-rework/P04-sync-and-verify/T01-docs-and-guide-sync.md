# Task: T01 문서와 게임 내 가이드 동기화

## Status: pending

## Goal
게임 내 가이드, `docs/`, README, 캡처 스크립트의 스킬 설명을 실제 동작과 일치시킨다. 사라진 불릿 타임, 부메랑, 160도가 플레이어에게 보이지 않게 한다.

## Decision Summary
- 결정 D07, D12, D14. 게임 내 가이드의 수치는 하드코딩하지 않고 `GAME_TUNING`을 읽어 표시한다.
- 루트의 `weapon-showroom-preview.html`, `weapon-and-skill-blueprints.html`은 시안 자료라 고치지 않는다.

## Implementation

### I01. 게임 내 가이드
- Related Files:
  - `src/pc/components/GuideModal.tsx` :: `levelSeries`(new), 91행, 384행, 408행, 428행, 452행, 472행; modify
  - `src/pc/audio/SoundSynthesizer.ts` :: `playSkillActivation` 리볼버 주석; modify

#### Details
- **Signatures & Types**:
  ```typescript
  function levelSeries(byLevel: Record<1 | 2 | 3 | 4, number>): string {
    return [1, 2, 3, 4].map((l) => byLevel[l as 1 | 2 | 3 | 4]).join(' / ');
  }
  ```
- 문구:
  | 위치 | 바꿀 내용 |
  |---|---|
  | 91행 끝 | `넉백이 통하지 않습니다.` → `넉백·기절·둔화가 통하지 않습니다.` |
  | 384행 끝 | `(빗나간 탄은 바닥에서 통통 튕김)` 뒤에 ` 보스에게는 피해만 줍니다.` |
  | 408행 | `초정밀 일직선 관통탄 & 부채꼴 칼날` |
  | 428행 | `[오프너 참격]:` 총구를 위로 '휙!' 젖히면 황금 칼날이 부채꼴로 곧게 날아가 닿은 몬스터를 베고 날아오는 포탄도 벱니다. 칼날 {levelSeries(GAME_TUNING.skills.blade.countByLevel)}개, 관통 {levelSeries(GAME_TUNING.skills.blade.pierceByLevel)}마리. 칼날 하나의 피해는 평타 한 발과 같습니다. |
  | 452행 | `초고속 탄산 기포 난사 & 거품 해일` |
  | 472행 | `[거품 해일]:` 작은 거품이 필드 전체로 쓸고 나가며 닿은 몬스터를 {levelSeries(GAME_TUNING.skills.foam.knockbackMByLevel)}m 뒤로 밀어내고 둔화시킵니다. 밀어내기 전용이라 피해는 낮고, 레벨이 오를수록 거품이 많아집니다. |
- `SoundSynthesizer.ts`의 `// Bullet Time warp & golden slash`를 `// Opener slash`로 바꾼다.

### I02. 문서
- Related Files:
  - `docs/무기_및_스킬_가이드.md` :: 27·28행, 90행, 93~98행, 104~107행, 124~128행, 130~134행; modify
  - `docs/구동화면_쇼케이스.md` :: 147~153행; modify
  - `docs/비어 크러셔 상세설계서.md` :: 560행; modify
  - `docs/몬스터_도감_설명서.md` :: 68행; modify
  - `README.md` :: 55행; modify

#### Details
- `무기_및_스킬_가이드.md`:
  - 27행 세 번째 칸 `초정밀 일직선 관통 & 부채꼴 칼날`, 마지막 칸 `**오프너 참격** (부채꼴 칼날, 관통, 포탄 베기)`.
  - 28행 마지막 칸 `**거품 해일** (필드 전체 밀어내기 & 둔화)`.
  - 90행 `보스는 넉백 면역입니다.`를 `보스는 넉백·기절·둔화에 면역입니다.`로 바꾼다.
  - 리볼버 표 "스킬 슬로우" 칸을 "스킬 칼날"로 바꾸고 값을 `3개·관통 0`, `3개·관통 1`, `5개·관통 1`, `7개·관통 2`로 바꾼다.
  - 개틀링 표 "스킬 밀쳐내기" 값을 `3m`, `3.5m`, `4m`, `5m`로 바꾼다.
  - ② 절 제목 `### ② 리볼버: [오프너 참격] (부채꼴 칼날)`. 본문: 세로 초승달 칼날이 곧게 날아가고, 닿는 순간 피해가 들어가며, 평타 관통과 별개로 칼날 관통이 있고 포탄을 벤다. 이미지는 `./screens/screen-18-skill-opener-slash.png`.
  - ③ 절 제목 `### ③ 개틀링: [거품 해일] (탄산 파도)`. 본문: 작은 거품이 필드 전체로 퍼지고, 앞면이 닿는 순간 밀리며, 레벨이 오를수록 거품이 많아지고, 피해는 낮다.
- `구동화면_쇼케이스.md`: 147행 제목을 `[오프너 참격] (Opener Slash)`로, 설명을 부채꼴 칼날로, 이미지 경로를 새 파일로 바꾼다. 153행의 `160도 광각 부채꼴 각도로 75개 이상의`를 `필드 전체로 작은`으로 바꾼다.
- `비어 크러셔 상세설계서.md` 560행: `샷건의 8방향 뚫어뻥 포물선 비행을 생성합니다. 리볼버 칼날과 개틀링 거품은 엔진 상태를 따라 syncSkillBlades, syncSkillFoam으로 그립니다.`
- `몬스터_도감_설명서.md` 68행 끝에 `넉백·기절·둔화가 통하지 않습니다.`를 더한다.
- `README.md` 55행: `손목을 위로 빠르게 튕겨 8방향 뚫어뻥 폭풍(기절), 오프너 참격(칼날), 거품 해일(밀어내기) 시전.`
- `grep -rn "슬로우" docs/몬스터_도감_설명서.md`의 119행은 얼음 아이템 설명이므로 그대로 둔다.

### I03. 캡처 스크립트와 스크린샷
- Related Files:
  - `scripts/capture-weapons-and-skills.mjs` :: 리볼버·개틀링 캡처 부분(110~130행 부근); modify
  - `docs/screens/screen-18-skill-opener-slash.png`, `docs/screens/screen-19-skill-foam-tsunami.png`, `docs/screens/play-fever-foam-tsunami.png`; 새로 캡처 또는 교체

#### Details
- 로그 문구의 `Opener Boomerang`을 `Opener Slash`로, 파일명을 `screen-18-skill-opener-slash.png`로 바꾼다.
- 칼날이 날아가는 장면이 찍히도록 리볼버 캡처의 대기를 80ms에서 160ms로, 거품 캡처의 대기를 400ms로 바꾼다.
- `docs/screens/play-fever-foam-tsunami.png`는 옛 거품 장면인데 찍는 스크립트가 없고 README 64행, 가이드 135행, 쇼케이스 156행이 쓴다. 같은 스크립트의 개틀링 캡처 뒤에 한 장을 추가한다. `page.evaluate`에서 `eng.weaponSystem.refillSkillInstant(); eng.scoreManager.addFeverGauge(100); eng.activateFever(performance.now());`를 부르고 `KeyR`을 누른 뒤 400ms 기다려 이 파일명으로 저장한다.
- `npm run dev`만 켜고 `node scripts/capture-weapons-and-skills.mjs`를 실행한다. `npm run server`를 처음 켜면 `data/players.json`의 점수가 백업 후 초기화되므로, 켜야 한다면 사용자에게 먼저 알린다. 옛 `screen-18-skill-opener-boomerang.png`는 `git rm`으로 지운다.

### I04. 문서 동기화 테스트
- Related Files:
  - `tests/docs-sync.test.ts` :: `FORBIDDEN`, 무기 가이드 표 테스트; modify

#### Details
- `FORBIDDEN`에 추가: `{ pattern: /불릿 타임|오프너 부메랑|160도|오버히트/, why: 'the revolver skill is fan blades and the foam wave covers the whole field' }`
- 표 테스트의 `expected`를 무기별로 늘린다.
  ```typescript
  if (kind === 'revolver') expected.push(`${spec.skillBladeCount}개·관통 ${spec.skillBladePierce}`);
  if (kind === 'gatling') expected.push(`| ${spec.skillKnockbackM}m |`);
  ```
  `expected`를 `const` 배열로 만든 뒤 push한다.

## Acceptance Criteria
- [ ] 게임 내 가이드와 문서에 불릿 타임, 오프너 부메랑, 160도, 오버히트가 없다.
- [ ] 가이드의 칼날 수·관통·밀기 값이 `GAME_TUNING`을 읽는다.
- [ ] 새 스크린샷이 칼날과 거품을 실제로 보여 준다.

## Validation
- `npx vitest run tests/docs-sync.test.ts tests/tutorial-and-guide.test.ts` — 통과
- `grep -rn "불릿 타임\|오프너 부메랑\|160도\|오버히트" README.md docs/*.md src` — 결과 없음
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
docs(game): describe the new revolver and gatling skills everywhere

Plan: 2026-11-05-weapon-skill-rework
Phase: P04-sync-and-verify
Task: T01-docs-and-guide-sync

- guide values read GAME_TUNING
- docs, README and screenshots follow the blade and foam skills
- doc-sync test rejects the old skill names and checks the new table values
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
