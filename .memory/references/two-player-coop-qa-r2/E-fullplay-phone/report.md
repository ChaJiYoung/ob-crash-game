# QA-E (R2) 폰 1인 풀플레이 보고서

- 담당: E-fullplay-phone (폰 1인, 가짜 폰 WebSocket으로 조작)
- 근거 지시: [../../two-player-coop-qa-checklist.md](../../two-player-coop-qa-checklist.md) 5-1, 5-5 (인수인계: [../HANDOFF.md](../HANDOFF.md))
- 환경: 게임 서버 8805, 개발 서버 5205, 뷰포트 1440×900, 헤드리스 Chromium(swiftshader)
- 스크립트: `scripts/fullplay-r2.mjs`(본 실행), `scripts/probe-hold.mjs`(연사 탐침), `scripts/server-e.ts`, `scripts/run-fullplay-phone.mjs`(1차, 참고용)
- 원자료: `fullplay-r2-summary.json`(판별·웨이브별 값), `scripts/fullplay-r2.log`(실행 로그), `scripts/probe-hold-gatling.log`, `probe-hold-gatling.json`
- 판정 기준: 값·캡처 근거로만. 애매하면 DIFF/SKIP으로 둠.

## 0. 요약

| 항목 | 결과 | 근거 |
| :--- | :--- | :--- |
| 5-1 누른 채 연사(폰, 판 중 1초 홀드) | **BUG**(판 중 표적 조준 시 0발 3/3). 공중 조준 탐침은 정상 | §1-1 |
| 5-1 피버 2초 점수 증가 | **PASS** 3/3 (샷건 +56, 리볼버 +18, 개틀링 +49) | §1-2 |
| 5-1 콘솔 에러 0 | 샷건·리볼버 0건, **개틀링 24건 BUG**(React 스타일 경고) | §1-3 |
| 5-5 풀플레이 샷건·리볼버·개틀링 각 1판 끝까지 | **완료 3/3**(3판 모두 게임오버로 종료, 멈춤·크래시 없음). 승리 없음 | §2 |
| 판 중 진행 정지(30초 이상) | 없음 3/3 | §2 |
| 판당 시간 제한 20분 | 걸린 판 없음(444.7 / 480.3 / 911.4초) | §2 |
| 결과 화면: 바깥 사격 무반응 / 버튼 사격으로 재시작 | **PASS** 3/3(바깥 무반응), 재시작 PASS(개틀링 캡처 확인; 샷건·리볼버는 재시작 판정 코드 오류로 미확인) | §3 |
| 페이지 오류(pageerror) | 0건 3/3 | §2 |
| 폰 측 ERROR 메시지 | 0건 3/3 | §2 |

## 1. 5-1 값 판정

### 1-1. 누른 채 연사 (BUG)

재현 순서(본 실행, 판 시작 직후 웨이브 1, 표적 조준 중):
1. 1P 폰 연결, 영점, 가운데 사격으로 시작, 무기 카드 선택(각 판 무기).
2. 웨이브 1에서 `landed && !isItem` 표적을 찾아 폰 조준을 그 표적에 맞춤(150ms 대기).
3. `rapidFireHold: true` 프레임 스트림(30ms 주기)을 1초 유지, 100ms 간격으로 `players[0].ammo` 기록.
4. 1초 후 `rapidFireHold: false`.

| 무기 | 탄약 샘플(100ms 간격, 시작→끝) | 발사(탄약 감소 합) | 판정 |
| :--- | :--- | :--- | :--- |
| 샷건 | 14 → 14 (샘플 2개: 시작·끝) | 0 | BUG |
| 리볼버 | 10 → 10 | 0 | BUG |
| 개틀링 | 30 → 30 | 0 | BUG |

- 기대: 1초 홀드 동안 여러 발 감소(PASS 기준 2발 이상). 실제: 3판 모두 0발.
- 같은 판 본 전투에서는 연사가 동작함: 판 전체 탄약 감소 합(발사 근사): 개틀링 313발(웨이브 1~3 합), 리볼버 106발, 샷건 94발. 따라서 "연사가 아예 안 된다"가 아니라 **판 중 표적 조준 상태의 1초 홀드 테스트 시점에만 0발**이다.
- 탐침(`scripts/probe-hold.mjs gatling`, 판 시작 후 허공 조준 (0.9,−0.9)): 1초 홀드 #1 탄약 30→21(약 9발), 홀드 #2 20→11(약 9발), 단발 `snapFire` 3회 각 1발 감소. **공중 조준의 연사 경로는 정상.**
- 원인 추정(확정 아님): 표적을 조준한 상태에서만 홀드가 막히는지, 웨이브 1 시작 직후 특정 구간에서만 막히는지 이번 실험으로는 구분하지 못했다. 같은 조건(표적 조준·웨이브 1 초반)에서 탐침을 돌리지 않았다. 다음 확인 항목: 웨이브 1 초반이 아니라 중반에 표적 조준 상태로 같은 1초 홀드를 돌려 보기.
- 캡처: `E-shotgun-rapidfire-test.png`, `E-revolver-rapidfire-test.png`, `E-gatling-rapidfire-test.png`, `E-rapidfire-test-shotgun.png`(1차 Gemini 캡처)

### 1-2. 피버 2초 (PASS)

| 무기 | 발동 전 점수 | 2초 뒤 점수 | 차이 | 판정 |
| :--- | :--- | :--- | :--- | :--- |
| 샷건 | 263 | 319 | +56 | PASS |
| 리볼버 | 288 | 306 | +18 | PASS |
| 개틀링 | 631 | 680 | +49 | PASS |

- 참고(DIFF 후보, 판정 보류): 세 판 모두 발동 2초 뒤 `isFeverActive`가 false였다. 피버가 2초보다 짧게 끝나는지, 측정 시점 문제인지 확인이 필요하다. 점수 증가 판정 기준(이 체크리스트 5-1)은 충족.
- 캡처: `E-*-fever-trigger.png`, `E-*-fever-after-2s.png`.

### 1-3. 콘솔 에러 (개틀링 BUG)

- 샷건 0건, 리볼버 0건, **개틀링 24건**(웨이브 2·3, 보스전 포함, 15:10~15:20).
- 메시지: `Warning: ... a style property during rerender ... can lead to styling bugs ... Updating border borderBottomColor` / `... borderTopColor` (React 개발 모드 경고).
- 발생 위치: `src/pc/components/CrosshairOverlay.tsx:176` (`<svg style={{ position: 'absolute', transform: ..., pointerEvents: ... }}>` 근처 — 같은 컴포넌트 안에서 `border` 축약 속성과 `borderTopColor`/`borderBottomColor`를 섞어 쓰는 스타일이 리렌더마다 갱신되는 것으로 보인다. 정확한 줄 확인은 코드 리뷰에서).
- 재현 순서: 개틀링 선택 → 웨이브 2 진입 후 보상 카드 라운드 → 웨이브 3 보스전까지 진행하면 경고가 주기적으로 찍힘.
- 샷건·리볼버에서는 같은 구간에도 경고가 없었다. 개틀링 판에서만 나온 이유는 확인하지 못함.
- 기록 로그: `scripts/fullplay-r2.log`의 `CONSOLE ERROR` 줄, `fullplay-r2-summary.json`의 `consoleErrors`.

## 2. 5-5 풀플레이 (폰 1인, 3판)

| 항목 | 샷건 | 리볼버 | 개틀링 |
| :--- | :--- | :--- | :--- |
| 종료 상태 | 게임오버(웨이브 3 보스전) | 게임오버(웨이브 3 보스전) | 게임오버(웨이브 3 보스전) |
| 총 시간 | 444.7초 | 480.3초 | 911.4초 |
| 전투 시작 | 94.7초(판 시작 기준) | 89.5초 | 83.2초 |
| 웨이브 1 | 시작 3.1초 · 104.7초 · 목숨 5→5 | 시작 2.3초 · 123.9초 · 5→5 | 시작 2.6초 · 262.3초 · 5→5 |
| 웨이브 2 | 시작 107.8초 · 139.8초 · 5→5 | 시작 126.2초 · 81.0초 · 5→5 | 시작 264.9초 · 289.5초 · 5→5 |
| 웨이브 3 (보스) | 시작 247.6초 · 보스 등장 264.5초 · 5→0 | 시작 207.2초 · 보스 등장 224.6초 · 5→0 | 시작 554.4초 · 보스 등장 626.8초 · 5→0 |
| 보상 카드 | W1 rapid_reload·damage_up·hit_zone_up / W2 skill_cooldown·weapon_level_up·lucky_drop | W1 skill_cooldown·fever_extend·rapid_reload(선택 skill_cooldown) / W2 fever_extend·hit_zone_up·lucky_drop(선택 fever_extend) | W1 lucky_drop·fever_extend·weapon_level_up(선택 weapon_level_up) / W2 fever_boost·skill_cooldown·hit_zone_up(선택 fever_boost) |
| 최종 점수 / 누적 격파 / 최대 콤보 | 1866 / 57 / 89 | 2402 / 58 / 115 | 2822 / 56 / 234 |
| 콘솔 에러 / 페이지 에러 | 0 / 0 | 0 / 0 | 24 / 0 (§1-3) |

- **완료 판정**: 체크리스트 5-5의 "7웨이브 끝(승리 또는 게임오버)"에 맞춰 3판 모두 게임오버로 끝났다. 다만 웨이브 4~7은 한 번도 도달하지 못했다. 세 판 모두 웨이브 3 보스전에서 목숨 5가 모두 소진되었다. 웨이브 4 이후 화면·보상·보스는 이 실행에서 확인하지 못했다.
- **속도**: 웨이브 1은 104~262초로, 이전 1차 기록(217~262초)보다 짧지만 인수인계의 기준(14~18초)과는 여전히 큰 차이. 봇 조준 정확도 측정(명중 근사)은 이번 실행에서 정량화하지 못했다(점수 증가 샘플과 탄약 감소 합만 기록).
- **엔진 봇 비교(5-5 참고)**: 엔진 직접 봇의 클리어율(샷건 63%·리볼버 77%·개틀링 76%)과 비교하면 폰 봇 3판은 전부 웨이브 3에서 실패. 봇 구현(폰 프레임 주기, 조준 보정, 보스 전략)의 한계로 보이며, 게임 결함인지 봇 결함인지 이 판정으로는 구분할 수 없다. 판정은 SKIP(비교 불가).
- **진행 정지**: 30초 이상 상태 변화가 없던 구간 없음(3판 모두 STALL 기록 없음).
- **카드 선택 기록 주의**: 샷건 판의 카드 라운드는 스크립트가 선택값을 기록하지 못했다(`chosen: null`). 웨이브는 정상 진행했으므로 선택 자체는 됐을 가능성이 높지만 기록은 확인 못 함.
- 캡처(판별 공통): `E-<weapon>-01-lobby-paired.png`, `-02-weapon-select.png`, `-03-combat-start.png`, `w1-start`, `w1-cards`, `w2-start`, `w2-cards`, `w3-start`, `w3-boss`, `-fever-trigger.png`, `-fever-after-2s.png`, `-skill-first.png`, `-result.png`, `-result-aim-restart.png`, `-after-restart-shot.png`. 샷건·리볼버 캡처는 `E-shotgun-*`, `E-revolver-*`, 개틀링은 `E-gatling-*`.
- 1차(Gemini) 캡처는 그대로 둠: `E-01~E-08*`, `E-wave-*`, `fullplay-summary.json`(1차 기록, 참고용).

## 3. 결과 화면 (폰 조준)

- 판 종료 후 3초 뒤 결과 화면 캡처. 결과 텍스트: "GAME OVER! 바 방어선 함락!", 최종 득점·누적 격파·최대 콤보·도달 웨이브·개인/팀 랭킹 탭·"다시 도전하기"·"로비로 이동" 표시.
- 바깥 사격(0.8, −0.8): 3판 모두 결과 화면 유지 → **PASS**.
- 재시작 버튼 사격: 개틀링 판의 `E-gatling-after-restart-shot.png`에서 무기 선택 화면으로 넘어가 있고 탄약이 14/14로 초기화됨 → 재시작 **PASS**.
- 스크립트 판정 필드 `restartTriggered`는 `false`로 기록됐는데, 이는 재시작 뒤 `[data-shootable="restart"]` 개수 확인 로직 오류(캡처와 불일치)다. 판정은 캡처 근거를 따른다.
- 샷건·리볼버의 재시작 후 캡처(`E-shotgun-after-restart-shot.png`, `E-revolver-after-restart-shot.png`)는 찍혀 있으나 이 보고서 작성 시 열어 보지 않았다 → 확인 필요.

## 4. 기타 관찰

- 전투 HUD(개틀링 보스전 캡처 `E-gatling-w3-boss.png`): 목숨("BAR DEFENSE" 5칸), 웨이브 3/7, 보스 바(COOLER 100/100 HP), 1P 패널(점수·콤보·무기·탄창·스킬 준비·피버 게이지), 십자선 "GATLING Lv.2" 표시 정상. 화면 깨짐 없음.
- 결과 화면은 1인 결과 모양(개인 랭킹 기본) 유지.

## 5. 미해결 / 다음에 할 것

1. 연사 0발 재현 조건 확인(§1-1): 웨이브 중반에 표적 조준 상태로 1초 홀드 탐침을 돌리고, 그때도 0발인지 본다.
2. 개틀링 `CrosshairOverlay` 스타일 경고(§1-3)의 정확한 줄과 샷건·리볼버에서 안 나온 이유 확인.
3. 피버가 2초 안에 끝나는지(§1-2 참고).
4. 웨이브 4~7 도달: 봇 개선(명중 근사 측정, 보스전 전략) 후 재실행하거나, 엔진 봇과 같은 조건으로 비교.
5. 샷건·리볼버 재시작 캡처 확인, 카드 선택 기록 보정.

## 6. 정리 상태

- 띄운 서버 종료: 게임 8805, 개발 5205(끝에 확인).
- 저장소 루트의 임시 `vite.qa-E.config.ts` 삭제(끝에 확인). `_vite-configs/` 원본은 Gemini 것이라 건드리지 않음.
- 저장소 코드(src/, server/, tests/) 수정 없음, 커밋 없음.
