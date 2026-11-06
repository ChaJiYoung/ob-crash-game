# Decisions: 튜토리얼 스킬 단계 추가

- Date: 2026-11-06
- Status: Confirmed

## D01. 스킬을 새 3단계로 넣고 피버를 4단계로 미룬다
- **Chosen**: 튜토리얼 순서를 1 정밀 조준 → 2 홀드 연사 → **3 스킬** → **4 피버** → 수료로 바꾼다. `TutorialStep`을 `1 | 2 | 3 | 4 | 'COMPLETED'`로 확장한다.
- **Rationale**: 사용자가 "새 단계로 2단계와 피버 사이"를 선택했다. 쏘기 → 연사 → 스킬 → 피버의 학습 순서가 자연스럽다.

## D02. 기존 피버 관련 `=== 3` 비교를 모두 4로 옮긴다
- **Chosen**: 엔진의 피버 단계 판정(`BeerCrusherEngine.ts`의 `tutorialStep === 3` 5곳 안팎: 전멸 시 COMPLETED, 피버 종료 시 COMPLETED, 돌파 처리, 킬 처리), `advanceTutorialStep(3)`의 게이지 100 주입, `GameCanvas3D`의 `tryActivateFever`(`spawnTutorialStep3Enemies`), `TutorialGuideOverlay`의 `step === 3` 안내를 4단계 기준으로 바꾼다. 함수 이름 `spawnTutorialStep3Enemies`는 `spawnTutorialFeverEnemies`로 바꿔 숫자 의존을 없앤다.
- **Rationale**: 번호만 밀리고 로직이 안 따라가면 피버 단계가 3단계 스킬 화면에서 켜지거나 수료가 3단계에서 끝난다. 이름의 숫자가 번호와 어긋나는 것도 방지한다. (코드 확인으로 자동 확정)

## D03. 스킬 통과 조건은 "스킬 1회 발동"이다
- **Chosen**: 3단계에서 `triggerWeaponSkill`이 `activated: true`를 돌려주면 즉시 4단계로 넘어간다. 3단계 시작(`advanceTutorialStep(3)`) 때 `weaponSystem.addSkillStock`로 스킬 재고를 채워 항상 쓸 수 있게 한다. 남은 표적은 4단계 진입 시 정리한다.
- **Rationale**: 사용자가 "스킬 1회 발동 통과"를 선택했다. 튜토리얼 무기는 샷건 Lv.1이고 스킬 재고는 1개라, 전멸까지 요구하면 막힐 수 있다.

## D04. 3단계 표적은 정지한 몬스터 편대를 세운다
- **Chosen**: 전방 약 12~14m에 정지(`speedMps: 0`) 상태의 `pilgood`·`caslight` 등 5~6마리를 배치해 스킬의 광역 기절·피해가 보이게 한다. 돌파로 목숨이 줄지 않게 한다(2단계처럼 돌파 시 제자리로 되돌림).
- **Rationale**: 1~2단계 표적도 정지 또는 고정 위치다. 스킬 효과를 관찰하기 쉽고 실패가 없다. (자동 확정, 세부 배치는 청사진에서)

## D05. 폰 "휙" 스킬도 튜토리얼에서 동작하게 한다
- **Chosen**: `PCGamePage.tsx`의 `skillSnapTriggered` 처리 조건 `gamePhaseRef.current === 'PLAYING'`을 `TUTORIAL`도 허용하도록 넓힌다. 튜토리얼 3단계가 아니어도 스킬 자체는 쓸 수 있다.
- **Rationale**: 지금은 폰 제스처가 `PLAYING`에서만 처리돼, PC 우클릭으로만 스킬 단계를 통과할 수 있다. 폰 사용자가 막히지 않게 한다. (자동 확정)

## D06. 안내 문구·문서·테스트를 함께 갱신한다
- **Chosen**: `TutorialGuideOverlay`에 3단계 스킬 안내(PC 우클릭 / 폰 휙)와 제목 `⚡ STEP 3. 액티브 스킬`을 추가하고 피버를 STEP 4로 바꾼다. `docs/튜토리얼_훈련장_가이드.md`를 4단계 구성으로 고치고, `tests/tutorial-and-guide.test.ts`와 `docs-sync` 계열 테스트를 갱신한다. 새 테스트는 단계 전진(2→3→4→COMPLETED), 스킬 발동 시 4단계 이동, 피버가 4단계에서만 켜지는지를 검증한다.
- **Rationale**: 단계 수가 바뀌면 안내와 문서, 테스트의 "3단계" 기준이 전부 틀어진다. (자동 확정)
