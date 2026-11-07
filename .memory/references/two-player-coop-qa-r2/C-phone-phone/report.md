# R2 QA-C 보고서 — 2인 폰+폰 (끊김·재접속·나감·결과)

- 담당: QA-C (2차). 기준: [체크리스트 1~5장](../../two-player-coop-qa-checklist.md)
- 서버: 게임 8803 / 개발 5203 (사용 후 종료, 임시 `vite.qa-C.config.ts` 삭제)
- 환경: 헤드리스 Chromium + 소프트웨어 WebGL, 가짜 폰 WebSocket. 판정은 `window.__BEER_DEBUG__.snapshot()` 값, 화면 텍스트, 캡처로만 했다.
- **결론 요약: BUG 확정 0건. 연사(5-1)는 측정 환경 한계로 판정 불가. 결과 화면과 몇 개 항목은 시간·부하 때문에 미완료.** 상세는 항목별 표 참고.

## 0. 이전 기록(Gemini) 처리

- `c05-c10-results.json`, C-05~C-10·C-12 캡처: 무기 선택 **중**에 끊김을 시작한 기록이었다(인수인계 신호 2의 원인). 유효하지 않아 `_superseded-gemini-selection-state/`로 옮겼다(삭제 아님).
- `flow1-results.json`(1초 홀드 탄약 1발)도 같은 선택 대기 시점에 측정돼 근거로 쓰지 않는다.

## 1. 측정 중 발견한 주의점 (테스트 방법의 함정)

1. **무기 선택 대기 중 사격은 카드 선택으로 처리된다.** 카드(`selection.kind === 'weapon'`)가 뜨기 전에 쏘면 선택이 안 되고 `PLAYING`으로 넘어가며, 이후 홀드 사격은 탄약을 쓰지 않는다. 측정 전에 `selection.kind === null`과 `PLAYING`을 확인하도록 스크립트를 고쳤다.
2. **헤드리스 부하로 메인 스레드가 굶는다 (5-1 판정을 막는 원인).**
   - 전투 화면을 입력 없이 1초 둘 때: 5ms 타이머 **1회/초**, rAF **3회/초**.
   - 같은 브라우저에서 빈 페이지: 5ms 타이머 **181회/초**, rAF **46회/초**.
   - 게임 로비(1440×900, 1024×768 모두): 타이머 **0회/초**, rAF **2회/초**.
   - 머신 로드 평균 50~75 (코어 16), 다른 QA 에이전트의 swiftshader GPU 프로세스가 원인으로 보인다. 프로세스는 건드리지 않았다.

## 2. 항목별 판정

표기: PASS / BUG / DIFF / SKIP(이유). 근거 파일은 이 폴더 안에 있다.

### §1 공통: 누른 채 연사 (의심 신호 1, 5-1)

| 항목 | 판정 | 근거 |
|---|---|---|
| 폰 `rapidFireHold` 1초 홀드 시 탄약 여러 발 감소 | **SKIP (측정 무효, 환경)** | `rapid-trials-results.json` (선택 완료 후 전투, 로드 높음): 샷건 1발씩 3회(14→13, 12→11, 10→9), 개틀링 1·2·2발. 1초 홀드 동안 샘플이 첫 발 뒤 변하지 않음. 같은 시점 메인 스레드 측정(§1-2)상 5ms 연사 인터벌이 거의 돌지 않아, 이 값은 제품 판정 근거가 될 수 없다. 엔진 직접 호출 정상(인수인계 기록)과 함께 재측정 필요 |
| 연사 인터벌 생성·정지 추적 | 참고 | `rapid-trials-results.json` 진단 모드: 홀드마다 5ms 인터벌 생성→정지가 한 쌍씩 맞고, 인터벌이 살아 있는 동안 틱은 1회 |
| 피버 자동 연사 2초 점수·처치 | **SKIP** | 미측정 (시간) |
| `pageerror`·콘솔 에러 0 | PASS | 이번 C 폴더 모든 실행(`combat-run`, `away-cardround`, `lobby-aim-hp`, `rapid-trials`)에서 0건 |

재측정 방법: 로드 평균이 코어 수 근처로 내려갔을 때 `node scripts/r2c-rapid-trials.mjs` (먼저 `scripts/r2c-control-timer.mjs`로 게임 로비 타이머 틱이 수백 회/초인지 확인). 틱이 안 나오면 측정하지 말 것.

### §2 (체크리스트 3장) 2인 폰+폰

| 항목 | 판정 | 근거 |
|---|---|---|
| 폰 2대 로비 연결·영점·가운데 사격으로 시작 | PASS | `lobby-aim-results.json` combat `PLAYING`, `C-01-lobby-both-phones-ready.png`(두 슬롯 "준비 완료", "영점 완료") |
| 마우스 클릭 사격 안 됨, HUD 클릭은 동작 | **SKIP** | 이전 `flow1` 값은 선택 중 측정이라 무효. `C-02-mouse-click-hud-works.png`는 미확인 |
| 무기 선택 분할·대기 상자 | PASS (데이터) | `combat-run-results.json` `steps.weaponCards`: 왼쪽 3장 owner 0, 오른쪽 3장 owner 1. 1P 선택 후 `C-03-weapon-select-after-1p-pick.png` |
| 전투 HUD 두 패널 "[위로 휙!]" | **SKIP** | `C04.has위로휙Count = 0`. 캡처 시점이 스킬 쿨다운 중(패널 "쿨다운 18.8s"). 안내 문구 확인 못함 |
| 2P 끊김 → 전체 일시정지, "2P 재접속 대기 중 · N초", 재개 비활성, 혼자 계속하기 | **PASS** | `C-05-disconnect-grace-countdown.png`: "2P 재접속 대기 중 · 16초", 이어하기 비활성, 혼자 계속하기 있음. 수치 `combat-run` C05: 30초→23초, 2P away false, paused true |
| 30초 안 재접속 → 3초 카운트다운 뒤 재개 | PASS | `C-06-reconnected-countdown.png`(게임 재개 문구 관측), `C-06-game-resumed.png`. C06: `isPaused false`, `p2Away false` |
| 혼자 계속하기 → 2P "나감", 2P 십자선·총 숨김, 1P 진행 | PASS | `C-07-2p-away-after-alone-click.png`·`C-07-2p-away-status.png`: 2P 패널 "나감" 배지·흐림, 2P 십자선·총 없음, 1P 십자선 있음. 1P 진행: `away-cardround` C08에서 웨이브 진행도 0→23/26, 1P 점수 0→500 (2P away true, isPaused false) |
| 클릭 직후 `isPaused: true` | PASS (재개 카운트다운) | `away-cardround` timeline: 3.4초 `게임 재개` 문구, 6.8초 `isPaused false`. 혼자 계속하기 뒤 3초 재개 카운트다운 |
| 나감 상태 보상 카드 라운드 → 2P 몫 자동 선택 | **SKIP (미도달)** | 1P 단독 사격 541초, 웨이브 1 진행도 23/26에서 시간 제한. `selectionAtStop.kind null`. 카드 라운드를 못 봄 |
| 나감 뒤 2P 재접속 → 영점 없이 복귀, 십자선·총 복귀 | PASS (상태), 캡처 확인은 SKIP | `away-cardround` C09: 재접속 직후 `isAway false`, 영점 재전송 없이 복귀. `C-09-reconnect-after-away.png`는 미확인. 2P 스킬 쿨다운 정지 여부 미확인 |
| 두 폰 동시 끊김 → 무기한 대기 | **PASS** | `C-10-both-phones-disconnected-indefinite.png`: "폰 재연결 중...", 카운트다운 없음, 혼자 계속하기 없음. `combat-run` C10: 35초 대기 후에도 `isPaused true`, 카운트다운 텍스트 없음 |
| 난이도: 2인 몬스터 체력 vs 1인 | **SKIP (1인 대조 없음)** | 2인 `maxHpByKind`: 카스/필굿 계열 모두 `maxHp 1.6`. 1인 대조 판 미실행 |
| 결과 화면: 이탈자 "나감", 폰 사격 결과 버튼 | **SKIP (미도달)** | 게임오버까지 도달하지 못함(lives 5 유지) |

### §3 (체크리스트 5장) 2차 추가

| 항목 | 판정 | 근거 |
|---|---|---|
| 5-1 연사·피버 | 연사 SKIP(§1 참고), 피버 SKIP | 위 표 |
| 5-1 콘솔·pageerror 0 | PASS | 위 |
| 5-2 총구 조합 3가지 캡처 | **DIFF (판정 보류)** | `C-5-2-aim-opposite.png`, `C-5-2-aim-cross.png`, `C-5-2-aim-center.png` (입력 1.8초 유지 후). 1P 십자선이 aimY=+0.4(위쪽) 입력인데 화면 세로 위치가 아래쪽(약 y=600/900)에 그려져 보인다. 기대 좌표 매핑과 맞는지 확인 필요. 총신 축 연장선이 고리 안을 지나는지는 눈으로 확정 불가, 애매하므로 DIFF로 둔다 |
| 5-3 경계 전투 화면 1440×900 | PASS | `combat-run` boundary: 화면 밖 요소 0건 |
| 5-3 경계 전투 화면 1024×768 | PASS | 같은 결과 0건, `C-5-3-combat-1024x768.png` |
| 5-3 로비 1440×900 | PASS | `lobby-aim-results` lobbyBoundary1440: 0건 |
| 5-3 로비 1024×768 | PASS (스크롤) | 화면 밖 3건(랭킹 패널 하단, "새 방 만들기", 사운드 안내). 캡처 `C-5-3-lobby-1024x768.png`에서 잘림 확인. 안쪽 `div`가 스크롤됨(scrollHeight 861 / clientHeight 732), "새 방 만들기" 버튼은 스크롤 후 y 650~690에 나옴. `scripts/r2c-lobby-scroll.mjs` |
| 5-4 처리부 타이머 `Illegal invocation` 0건 | PASS | 모든 실행 pageerror 0건 |
| 5-4 마우스 이동이 폰 판의 총·십자선을 움직이지 않음 | **SKIP (판정 불가)** | `C-02-mouse-before/after-move.png`를 찍었지만 마우스 이동 시점에 게임이 "폰이 다시 연결되었습니다" 일시정지(이어하기 대기) 상태였다. 조준이 움직이는지 판정할 수 없음. 재실행 필요 |

## 4. BUG 후보

없음. 확정된 BUG는 0건이다.

- 연사 1발 현상: 환경 측정 무효로 BUG로 적지 않는다. 재측정 전까지 미해결.
- 5-2 십자선 세로 위치: DIFF. 재현 확인 필요.

## 5. 남은 것 (다음 세션용)

1. 5-1 연사·피버: 로드 낮을 때 재측정(§2 재측정 방법).
2. 나감 카드 라운드(C-08 자동 선택): 웨이브 클리어까지 더 길게 사격.
3. 결과 화면 (나감 칸, 폰 사격으로 다시 시작 버튼): 게임오버까지 진행한 뒤 확인.
4. 5-2 십자선 매핑 확인 및 총신 축 판정(캡처 기준).
5. 5-4 마우스 이동 검증: 일시정지가 풀린 전투 중에 다시 실행.
6. 난이도: 1인 판 maxHp와 비교.
7. C-04 "[위로 휙!]": 쿨다운 종료 뒤 캡처.

## 6. 산출물

- 캡처(이 폴더): `C-01-lobby-both-phones-ready.png`, `C-03-weapon-select-after-1p-pick.png`, `C-04-combat-hud-two-phones.png`, `C-05-disconnect-grace-countdown.png`, `C-06-reconnected-countdown.png`, `C-06-game-resumed.png`, `C-07-2p-away-after-alone-click.png`, `C-07-2p-away-status.png`, `C-09-reconnect-after-away.png`, `C-10-both-phones-disconnected-indefinite.png`, `C-02-mouse-before-move.png`, `C-02-mouse-after-move.png`, `C-5-2-aim-opposite.png`, `C-5-2-aim-cross.png`, `C-5-2-aim-center.png`, `C-5-3-lobby-1024x768.png`, `C-5-3-combat-1024x768.png`, `C-08-away-card-round.png` 없음(미도달)
- 결과 JSON: `combat-run-results.json`, `away-cardround-results.json`, `lobby-aim-results.json`, `rapid-trials-results.json`, `rapid-mainthread-diag-results.json`
- 스크립트 (`scripts/`): `r2c-combat-run.mjs`, `r2c-away-cardround.mjs`, `r2c-lobby-aim-hp.mjs`, `r2c-rapid-trials.mjs`, `r2c-control-timer.mjs`, `r2c-probe-flow.mjs`, `r2c-lobby-scroll.mjs`, 로그 `r2c-rapid-run.log`, `r2c-rapid-diag-run.log`. 기존 Gemini 스크립트(`r2-*.mjs`, `debug-rapid.mjs`, `capserver.ts`)는 그대로 둠
- 이전 기록 보관: `_superseded-gemini-selection-state/`
