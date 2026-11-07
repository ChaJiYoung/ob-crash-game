# Task: T05 튜토리얼 패널 통일

## Status: done

## Goal
튜토리얼 화면이 자체 탄약·피버 표시 대신 메인 전투와 같은 `PlayerPanel`(1인 형태: 배지 없음, 앰버, 입력별 스킬 안내)을 왼쪽 아래에 쓰게 한다. 단계 안내 문구(`TutorialGuideOverlay`의 단계 카드·버튼)는 튜토리얼 전용으로 남긴다. 센서 랩(`SensorAndModuleTestLabOverlay`)은 바꾸지 않는다(D14). 튜토리얼은 여전히 1인 전용(D12).

## Decision Summary
- 튜토리얼은 `ArcadeOverlayHUD`를 쓰지 않으므로 `PlayerPanel`을 직접 렌더한다. 목숨 패널은 튜토리얼에 의미가 없어 넣지 않는다.
- `TutorialGuideOverlay`의 하단 "Bottom Bar: Ammo & Fever Status"(현재 249행 부근)와 단계 카드 안의 탄창 숫자(101행 부근)를 제거한다. 피버 설명 문구(126행)는 단계 안내라 유지.

## Implementation

### I01. 튜토리얼 오버레이 정리

- Related Files:
  - `src/pc/components/TutorialGuideOverlay.tsx` :: `TutorialGuideOverlayProps`, `TutorialGuideOverlay`; modify

#### Details
- props에서 `ammo`, `maxAmmo`, `isReloading` 삭제(피버 단계 진행 표시에 `isFeverReady`/`isFeverActive`가 쓰이면 유지). 하단 바 블록 삭제. 단계 카드의 탄창 숫자 줄 삭제.
- 스킬 단계 안내 문구가 "위로 휙! / 우클릭"을 함께 적고 있으면 `inputKind` prop(`'mobile' | 'mouse'`)을 추가해 하나만 보여 준다(`tests/tutorial-skill-step.test.ts:91`이 `'우클릭'`을 기대 → 그 테스트에서 `inputKind='mouse'`로 렌더하도록 수정).

### I02. PC 페이지

- Related Files:
  - `src/pc/PCGamePage.tsx` :: TUTORIAL 렌더(현재 1173행 부근); modify

#### Details
- `hudState.players.map((s, i) => <PlayerPanel snapshot={s} presentation={presentations[i]} />)`를(메인 HUD와 같은 코드, 튜토리얼은 1인 모드라 1개. 배지·색·입력 방식은 `getPlayerPresentation`이 정한다) `TutorialGuideOverlay`와 함께 렌더. 위치가 단계 카드와 겹치지 않는지 캡처로 확인(겹치면 단계 카드를 오른쪽/위로 옮기지 말고 패널은 고정, 단계 카드 `bottom` 여백만 조정).

### I03. 테스트

- Related Files:
  - `tests/tutorial-and-guide.test.ts`, `tests/tutorial-skill-step.test.ts`; modify(깨지는 것만)

#### Details
- 튜토리얼 오버레이 렌더에 "탄창:" 문구가 없음.
- 마우스 입력 → 스킬 안내 "우클릭"만, 폰 → "위로 휙!"만.

## Acceptance Criteria
- [ ] 튜토리얼 화면 왼쪽 아래 패널이 메인 1인 전투 패널과 같다.
- [ ] 센서 랩 화면은 바뀌지 않는다.

## Validation
- `npx vitest run tests/tutorial-and-guide.test.ts tests/tutorial-skill-step.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: `node scripts/capture-tutorial.mjs`(dev 서버 실행 중)로 튜토리얼 단계별 캡처 확인

## Commit Message
```text
feat(tutorial): use the main player panel in the tutorial

Plan: 2026-11-07-two-player-coop
Phase: P05-hud-screens
Task: T05-tutorial-panel

- Tutorial renders PlayerPanel instead of its own ammo and fever bar
- Step guide stays tutorial-only; skill hint follows the input
- Sensor lab is unchanged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 09357de
