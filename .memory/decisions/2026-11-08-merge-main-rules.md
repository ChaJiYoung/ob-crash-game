# Decisions: Merge main (rules, skill double-trigger, fever display)

- Date: 2026-11-08
- Status: Confirmed

## D01. 병합 방식
- **Chosen**: 실제 `git merge main`을 한다. 충돌은 이 브랜치(feature/1p-2p)의 구조(플레이어별 상태, `PlayerActionProcessor`, 리팩터링된 `BeerCrusherEngine`/컨트롤러)를 기준으로 해결하고, main의 규칙 수치·버그 수정 로직은 새 구조에 맞게 직접 이식한다.
- **Rationale**: 병합 이력이 남아야 나중에 이 브랜치를 main에 합칠 때 같은 충돌이 다시 나지 않는다. main의 엔진/컨트롤러 코드는 구조가 달라 그대로 가져올 수 없다.

## D02. 스킬 중복 발동 방지 (엔진 잠금, 플레이어별)
- **Chosen**: 스킬 발동 후 `GAME_TUNING.skillInput.reuseLockMs`(500ms) 동안 같은 플레이어의 스킬 재발동을 거부한다. `PlayerCombatState`에 `lastSkillActivatedMs`를 두고 `BeerCrusherEngine.triggerWeaponSkill(nowMs, playerIndex)` 안에서 검사한다. 게임 시작 시 초기화한다. 일반 사격·피버 발동에는 적용하지 않는다.
- **Rationale**: 버그는 스킬 2개 보유 중 폰을 한 번 휙 올리면 신호가 연달아 들어와 2개가 한꺼번에 나가는 것이다. 엔진 한 곳에서 막으면 마우스·폰 모든 입력 경로가 막히고, main의 엔진 테스트를 playerIndex만 맞춰 재사용할 수 있다. 전역 변수 하나면 1P 스킬이 2P를 막으므로 플레이어별로 둔다. 기존 `PlayerActionProcessor.skillLockUntilMs`(선택 직후 300ms)는 용도가 달라 그대로 둔다.

## D03. 폰 쪽 디바운스는 넣지 않음
- **Chosen**: `GunGripTracker`/`MobileControllerPage`의 스킬 신호 400ms 디바운스(`shouldSendSkillSnap`, `snapDebounceMs`)는 이식하지 않는다. 엔진 잠금만 사용한다. (충전 시간 표시 때문에 병합으로 들어오는 `GunGripPad.tsx` 변경은 제외)
- **Rationale**: 중복 신호가 와도 엔진이 거부하므로 버그는 해결된다. 컨트롤러가 이 브랜치에서 크게 바뀌어 충돌·신규 버그 위험이 크다. `snapDebounceMs`는 쓰지 않으므로 튜닝에 추가하지 않는다.

## D04. 피버 화면 개선 3종 모두 이식
- **Chosen**: (1) `JudgmentBanner`: 피버 중 명중은 "FEVER!" + `${feverDamage}x 데미지 (피버)` 표시(`getJudgmentBannerSpec(grade, isFever)`), (2) `ArcadeOverlayHUD.formatFeverStatusBadge` 문구에 점수/대미지 배율 표시, (3) `TutorialGuideOverlay`/`GuideModal` 피버 안내에 대미지 배율 추가. 배율은 모두 `GAME_TUNING`에서 읽는다. 이 브랜치의 `hudSnapshot`, 플레이어별 표시, `TutorialDirector` 구조에 맞게 연결한다.
- **Rationale**: 실제 대미지는 이미 2배인데 판정이 GREAT로 고정이라 화면이 1.0x로 보이는 문제를 고친다. 값을 튜닝에서 읽으면 수치 변경 시 화면이 자동으로 맞는다.

## D05. 규칙 수치는 main 값 그대로
- **Chosen**: `GAME_TUNING.judgment.feverDamage = 2.0`(`HitJudgment` 피버 분기에서 사용), `GAME_TUNING.boss.damageScaleByWeapon = { shotgun: 1, revolver: 1, gatling: 1 }`. 피버 `durationMs: 4000`, `scoreMult: 1.5`는 값 변화 없이 튜닝 상수로 이동(`FEVER_CONSTANTS.DURATION_MS`, `ScoreAndFeverManager`가 참조). 협동 모드 보스 체력 등은 이 브랜치 값(x2)을 유지하고 필요하면 플레이 후 따로 조정한다.
- **Rationale**: main의 의도는 피버 배율과 보스 배율이 곱해져 개틀링이 3배 넘게 나오는 것을 없애는 것이다.

## D06. 요청 외 main 변경도 그대로 수용
- **Chosen**: 다음 스킬 충전 시간 표시(폰 `formatControllerSkillStatus`, PC `formatWeaponSkillBadge`), cloudflared 터널링 dev 스크립트(`package.json`, `package-lock.json`), README 안내를 모두 가져온다. 폰 충전 시간 표시는 이 브랜치의 `skillState`(스톡·쿨다운) 구조에 맞춘다.
- **Rationale**: 병합이라 어차피 들어오며, 충전 시간 표시는 같은 작업(스킬 UX)의 일부다. 개발 환경만 따로 빼면 나중에 충돌한다.

## D07. 랭킹 규칙 버전
- **Chosen**: `RANKING_RULESET_VERSION`은 5 그대로 둔다.
- **Rationale**: main도 올리지 않았고 충돌이 없다. 이 브랜치는 아직 출시 전이다.

## D08. `.memory` 문서 충돌 처리
- **Chosen**: main의 `decisions/`, `plans/`, `phases/` 신규 문서는 그대로 받는다. `.memory/current.md`는 이 브랜치 것을 유지한다(main의 포인터로 덮어쓰지 않는다).
- **Rationale**: main의 포인터는 이미 끝난 main 쪽 작업을 가리키는 것이고, 이 브랜치의 진행 상황을 잃지 않아야 한다.

## D09. 검증
- **Chosen**: 병합 후 `npm test`(전체)와 타입체크/빌드를 통과시킨다. main에서 추가된 테스트(`fever-tuning-sync`, `game-tuning`, `pc-hud-and-banner`, `skill-charge-timer`, `skill-double-trigger`, `engine-judgment-and-spawn` 변경분)는 이 브랜치 구조(playerIndex)에 맞게 고쳐서 통과시킨다.
- **Rationale**: 구조가 달라 main 테스트가 그대로는 안 돌 수 있으므로, 테스트를 새 구조에 맞춰 수정하는 것까지 작업 범위로 본다.
