# QA-A (R2) 1인 보고서 — 마우스 1인 / 폰 1인(1P·2P 슬롯) / 튜토리얼·랩 / 경계

- 담당: QA-A (2차, Claude Haiku 인수) · 포트: 게임 8801 / 개발 5201 · 산출물: 이 폴더
- 판정: PASS / BUG / DIFF / SKIP. 모든 판정은 값(snapshot·DOM·로그) 또는 캡처 근거. 눈대중 PASS 없음.
- 기준 문서: [체크리스트](../../two-player-coop-qa-checklist.md) 1장(A-1~A-4), 5장(5-1~5-5 중 A 해당분).

## 요약

| 구분 | 결과 |
| :--- | :--- |
| 마우스 1인 (A-1) | 대부분 PASS. A-1-05 PASS(재검증). 단발·연사·스킬·피버·일시정지·결과·로비 복귀 PASS |
| 폰 1인 1P (A-2) | **BUG 4건**: 폰 홀드 연사(2발 제한), 폰 단발 누락/지연, 폰 피버 미발동, 폰 판이 결과까지 못 감 |
| 폰 2P 슬롯 단독 (A-3) | 1인 판 시작·배지 없음 PASS. 전투 중 폰 사격 BUG 공통(위 A-2 건과 같은 원인) |
| 튜토리얼·센서 랩 (A-4) | PASS (튜토리얼 수료, 랩 버튼 확인). 영점 리셋 적용 SKIP |
| 총구 조준 (5-2, 1인) | 좌상·우상·좌하·가운데 PASS, 우하 DIFF(경계선) |
| 화면 경계 (5-3) | 1440×900 PASS, 1024×768 PASS(잘린 요소는 모두 스크롤 컨테이너 안) |
| 5-4 P01 | 콘솔 `Illegal invocation` 0건 (전 실행 로그 검색). 마우스-플레이어 묶임은 2인 항목이라 A 범위 밖 |
| 콘솔·페이지 에러 | 전 실행 **0건** (pageerror 0, console.error 0) |

## 체크리스트 항목별 판정

### A-1. 마우스 1인
- [x] A-1-01 로비 슬롯 2개 "비어 있음" — **PASS** `{slotCount:2, emptyCount:2}` · `A-1-01-lobby-empty.png`
- [x] A-1-02 1P 마우스 → 준비 완료, 2P 마우스 disabled — **PASS** `{ready:true, p2:{disabled:true, opacity:0.35, cursor:not-allowed}}` · `A-1-02-lobby-mouse-1p-ready.png`
- [x] A-1-03 새로고침 후 닉네임 자동 채움(D15) — **PASS** `"테스터A"` · `A-1-03-nickname-autofill.png`
- [x] A-1-04 게임 시작: 카운트다운 없이 무기 카드 3장 가운데 — **PASS** 카드 shotgun(-0.44)/revolver(0)/gatling(0.44), 카운트다운 문구 없음 · `A-1-04-weapon-select-solo.png`
- [x] A-1-05 전투 HUD — **PASS(재검증)**. 처음 BUG로 찍은 것은 쿨다운 중에 읽어서다. 스킬 재고 1(준비 상태)일 때 HUD에 "[우클릭]"이 나타나고, 쿨다운 중에는 "쿨다운 14.5s"만 보인다. 값: `qa-a-skill-hint-values.json` (`stockReadyRow: {stock:1, hint:["우클릭]"]}`, 쿨다운 행 `hint:[]`). BAR DEFENSE 1인 표기, 팀 표기 없음, 배지(1P) 없음 · `A-1-05-combat-solo-hud.png`, `A-1-05-skill-ready-hud.png`
- [x] A-1 좌클릭 단발 — **PASS** 재장전 완료 후 `10→9` (재장전 중 측정은 측정 오류로 제외) · `A-1-06-combat-mouse-actions.png`
- [x] 5-1 마우스 누르기 1초(10샘플) — **PASS** `10→0` (샘플 9,8,7,7,6,4,4,2,2,1 등 4회 반복, 매번 9~10발 감소), 콘솔 에러 0
- [x] 우클릭 스킬 — **PASS** 재고 `1→0` (스킬 재고 확보 후)
- [x] 더블클릭 피버 — **PASS** `isFeverActive true`, 2초 동안 점수 `277→296`, `295→314`
- [x] A-1-07 Esc 일시정지 → 재개 — **PASS** 일시정지 `true`, "▶ 이어하기" 후 재개 · `A-1-07-esc-pause.png`
- [x] A-1-08 보상 카드 3장, "남은 시간" 없음 — **PASS** `{cards:3, timerText:false}` · `A-1-08-reward-select-solo.png`
- [x] A-1-09 결과 화면: 다시 시작·로비로, 랭킹 탭(개인/팀) — **PASS** `GAMEOVER`, 결과 문구 "GAME OVER! 바 방어선 함락", 최종 1219점 · `A-1-09-result-solo.png`
- [x] A-1-10 로비 복귀 후 마우스 슬롯 비워짐(D11) — **PASS** `{emptyCount:2, has테스터A:false}` · `A-1-10-lobby-returned-empty.png`

참고(측정 과정에서 있었던 일, 게임 결함 아님):
- 결과 화면의 "🏠 로비로 이동" 버튼은 애니메이션 중이라 일반 클릭이 안정성 판정에서 30초 타임아웃됐다. 강제 클릭으로 바꿔 통과.
- 5-2 총구 캡처 중에는 사격하지 않으므로 그 구간에 목숨이 줄고 점수가 0인 것은 정상(스크립트 순서).

### 5-2. 총구 조준 (1인 5점)
판정 방법: 총신 축을 화면 위로 연장한 선이 자기 십자선 중심에서 바깥 고리 반지름 이내를 지나는지 캡처에서 좌표로 계산.
- [x] 좌상 (-0.7, 0.4) — **PASS** 총신 연장선이 y=270에서 x≈220, 십자선 중심 (215,270) · `A-5-2-aim-top-left.png`
- [x] 우상 (0.7, 0.4) — **PASS** 연장선 x≈1218, 중심 (1223,270) · `A-5-2-aim-top-right.png`
- [x] 좌하 (-0.7, -0.4) — **PASS** 연장선 x≈194, 중심 (216,630), 차이 약 22px · `A-5-2-aim-bottom-left.png`
- [~] 우하 (0.7, -0.4) — **DIFF** 연장선 x≈1186, 중심 (1223,630), 차이 약 37px = 고리 바깥 테두리. 측정 오차(±10px) 안에서 확정 불가이므로 PASS로 하지 않음 · `A-5-2-aim-bottom-right.png`
- [x] 가운데 (0,0) — **PASS** 총신이 거의 수직, 연장선이 (720,450)과 일치 · `A-5-2-aim-center.png`

### A-2. 폰 1인 (1P 슬롯)
- [x] A-2-01 1P 📱 → QR에 slot=1, 방 코드 포함 — **PASS** `{hasSlot1:true, hasSlot2:false, roomInUrl:true}` · `A-2-01-lobby-phone-1p-qr.png`
- [x] A-2-02 가짜 폰 연결 → 닉네임, 영점 안내 — **PASS** `{connected:true, needZero:true}`
- [x] A-2-03 영점 후 "준비 완료" — **PASS** `{ready:true, needZero:false}`
- [~] A-2-04 가운데 사격 → 카운트다운 → 시작(D33) — **DIFF**. 카운트다운 문구 확인, 6.6~7.0초 뒤 무기 선택 진입(sel=weapon). 그런데 snapshot phase 값이 ZEROING. 마우스 경로에서는 같은 무기 선택이 PLAYING. 전투 HUD(A-2-06)에서는 PLAYING. 단계 표기 차이로 기록, 기능 결함은 아님(추정: 폰 시작 경로의 단계 전환 표기)
- [x] A-2-05 무기 선택 폰 사격 — 선택 진입 후 무기 선택 완료(revolver) · `A-2-05-phone-weapon-select.png`
- [~] A-2-06 전투 HUD: "[위로 휙!]" 1개, 우클릭 없음, 배지 없음 — **PASS(재검증)**. 처음 BUG로 찍은 것은 쿨다운 중("쿨다운 20.6s") 읽기다. 재고 1일 때 "위로 휙!]" 표시 확인(폰 실험 `qa-a-phone-probe-values.json`, `cooldownTexts:["위로 휙!]"]`). 배지: 캡처에 1P 배지 없음. 측정의 "1P" 카운트 1은 닉네임 "폰테스터1P"의 글자이므로 판정 아님 · `A-2-06-phone-combat-hud.png`
- [x] A-2-07 단발(snap) — **BUG** 아래 "BUG 목록" 참고
- [x] 5-1 폰 연사(rapidFireHold 1초) — **BUG** 아래 "BUG 목록" 참고
- [x] A-2-07c 폰 스킬(위로 휙) — **PASS(실험)**: 재고 `1→0` (probe). 앞선 1인 판에서는 1회 `1→1`로 발동 안 함 → 간헐 (BUG 목록에 포함)
- [x] A-2-07d 폰 피버 — **BUG** 아래 "BUG 목록" 참고
- [x] A-2-08 폰 끊김 → 일시정지 "폰 재연결 중", 무기한 유지(1인) — **PASS** `{text:true, paused:true}` 35초 뒤에도 · `A-2-08-phone-disconnected-pause.png`
- [x] A-2-10 재접속 → 안내 → 재개 — **PASS**. 안내 문구는 체크리스트의 "다시 연결됨"이 아니라 **"✅ 폰이 다시 연결되었습니다 / 준비되면 이어하기를 눌러 주세요"** (게임 규칙대로 이어하기 필요). 이어하기 후 재개 28.7초 · `A-2-10-phone-reconnected-resume.png`
- [ ] A-2-11 결과 화면 도달 — **BUG** 18분 안에 결과 미도달(`last: PLAYING`). 폰 사격이 표적을 처치하지 못하는 현상과 같은 원인으로 보임(추정)
- [ ] A-2-12 / A-2-13 결과 버튼 폰 조준 — **SKIP** 결과 화면 미도달로 확인 불가

### A-3. 폰 1인 (2P 슬롯만)
- [x] A-3-01 2P 📱 → QR slot=2 — **PASS(실험)**. 2P 📱 버튼을 오른쪽 카드 좌표로 클릭하면 QR에 `slot=2`. 처음 실행은 클릭이 선택되지 않아 QR 없는 캡처였음(그 캡처는 증거로 쓰지 않음) · `A-3-01-probe-lobby-phone-2p-qr.png`
- [x] A-3-02 2P 슬롯만 연결 → 1인 판 시작, 배지 없음, 플레이어 1명 — **PASS(구성·배지)**. 시작 가능(lobbyReady true), `playersLen:1`, 캡처에 배지 없음, 패널 1개 · `A-3-02-phone-2p-only-combat.png`. 전투 사격은 아래 폰 BUG와 같음(탄약 변화 `[0]`)
- [~] A-3 P04 센서 랩 영점 리셋이 2P 폰에 적용 — **SKIP (재시도 완료)**. 재시도(`scripts/probe-p04-zero.mjs`, `qa-a-p04-probe-values.json`): "🎯 정면 영점 리셋" 클릭 후 폰이 받은 새 메시지는 `SKILL_STATE_SYNC`뿐, 영점 관련 메시지 0건. PC 쪽 리셋인지 폰 반영인지 값으로 구분 못 함 → 확인 불가로 둠. 첫 시도에서 "5점 영점 과녁 재배치"를 눌러 잘못된 버튼. 정면 영점 리셋(🎯 정면 영점 리셋)으로 다시 해야 하는데, 폰이 받은 메시지는 `SKILL_STATE_SYNC`뿐이라 적용 여부를 값으로 확정 못 함

### A-4. 튜토리얼·센서 랩
- [x] A-4 튜토리얼 STEP 1→4 → 수료 (마우스) — **PASS** `seq: 1(0.7s) → 2(14.7s) → 3(25.8s) → 4(33.8s) → COMPLETED(86.0s)`, `fin.completed:true` · `A-4-01-tutorial-step1.png` 외
- [x] A-4 센서 랩 버튼 — **PASS**. 테스트 사격("🔫 현재 조준점 시험 사격"), 실전 시작("🚀 실전 배틀 시작!") 버튼 존재. (첫 판정은 검색어 "실전 시작" 불일치로 BUG 표기 → 정정)
- [ ] A-4 "실전 시작"이 시작 조건을 거치는지 — **SKIP** 실전 버튼은 누르지 않음(검증 범위 밖)

### 5-3. 화면 경계
- [x] 1440×900 로비(빈/준비), 선택, 전투, 일시정지 — **PASS** 화면 밖 요소 0 · `A-5-3-1440x900-*.png`
- [x] 1024×768 로비(빈/준비), 선택, 전투, 일시정지 — **PASS** 화면 밖 요소는 있었지만 모두 스크롤 컨테이너 안(`scrollAccessible:true`, 예: 랭킹 패널 y 507~847, "새 방 만들기" y 779~819). 가로 스크롤 없음 · `A-5-3-1024x768-*.png`
- [ ] 결과 화면 5-3 — 이번 실행에서 미수행(결과 화면은 1440×900에서만 확인)

## BUG 목록 (재현 순서 · 기대 · 실제 · 캡처 · 값)

### BUG-1. 폰 1초 홀드 연사가 2발에서 멈춤 (5-1, A-2-07b) — 재현 4회
- 재현 순서: 폰 1인, 전투 중 표적 조준(aim) 유지 → `rapidFireHold:true` 프레임을 30ms 간격으로 1초 → `false`.
- 기대: 1초 동안 연사(마우스는 같은 조건에서 10발 감소).
- 실제: 1초 동안 탄약 2발 감소, 그 뒤 탄약 변화 없음. 값 예: `[9,8,8,8,8,8,8,8,8,8]` (1발), probe 세 번 `5→3`, `3→2`, `2→1` (각 1초 홀드당 2발).
- 근거: `qa-a-phone2.log`, `qa-a-phone-probe-values.json`(`holds`), 캡처 `A-2-07-phone-combat-actions.png`.
- 추정(확인 안 됨): `src/pc/input/PhoneAdapter.ts`는 `rapidFireHold`의 상승 에지에서 `fireDown`, 하강 에지에서 `fireUp`만 보낸다(약 L101–110). 엔진의 연사 루프가 이 상태를 계속 쏘지 않는 것으로 보인다. 원인 확정은 엔진 쪽 확인 필요.

### BUG-2. 폰 단발이 전투 중 누락됨 (A-2-07a, A-3-02 탄약)
- 재현 순서: 폰 전투 중 표적 조준 300ms 유지 → `snapFire:true` 프레임.
- 기대: 탄약 1 감소, 점수 증가.
- 실제: 실험 5회 중 k0 `10→10`, k1 `9→9`(점수 변화 없음), k2 `8→7`(+18), k3 `7→6`(+32), k4 `6→5`. 즉 처음 두 번은 발사 없음, 이후 발사. 1인 본 실행에서도 `10→10` 확인. 시작·무기 선택 단계의 폰 스냅은 정상 동작했음.
- 근거: `qa-a-phone2.log` (`A-2-07a-snap BUG 10→10`), `qa-a-phone-probe-values.json`(`snaps`), `A-2-06`~`A-2-07` 캡처.

### BUG-3. 폰 피버 제스처가 발동하지 않음 (A-2-07d)
- 재현 순서: 피버 게이지 찬 뒤 `feverTriggered:true` 프레임 → 2초 관찰.
- 기대: `isFeverActive=true`, 2초 동안 점수 증가(마우스는 발동됨).
- 실제: `activeAfterGesture:false`, 점수 `274→292`(일반 득점).
- 상태: 1회 시도. 재현 횟수 부족 → "재현 1회" 표기. 추가 반복 확인 필요.

### BUG-4. 폰 1인 판이 결과 화면까지 진행되지 않음 (A-2-11)
- 18분 동안 `PLAYING` 유지. BUG-2·1의 사격 결함이 원인일 가능성이 높음(추정). 결과 버튼 폰 조준(A-2-12/13)은 SKIP.

### BUG-5(스킬 간헐). 폰 스킬 제스처가 1회 무반응
- 1인 본 실행 `1→1`(A-2-07c), probe에서는 `1→0`(정상). 간헐 여부 확인 필요. 재현 조건 기록 부족.

## DIFF
- DIFF-1. 5-2 우하 총구 (위 5-2 참고, 경계선).
- DIFF-2. 폰 시작 후 무기 선택 단계의 `snapshot.phase`가 ZEROING, 마우스 경로는 PLAYING (A-2-04). 표기 차이.

## SKIP
- A-2-12/13 (결과 화면 미도달), A-3 P04(영점 리셋 적용, 잘못된 버튼으로 시도), A-4 실전 시작 조건 검증.

## 실행 중 문제 (QA 스크립트 측 — 게임 결함 아님)
- 제 스크립트의 셀렉터·검사 오류 몇 개를 고치고 다시 돌렸다(결과는 최종 실행 기준). 예: `GAME_OVER`→`GAMEOVER`, 재접속 문구, 이어하기 클릭 누락, 무기 선택 분기 누락, 총구 캡처 구간 사격 중단, 쿨다운 중 HUD 읽기.
- 공유 기기: QA-B/C/D/E 서버·vite가 같은 기기에서 동시에 돌아 타이밍 검사에 영향 가능.
- 중간에 브라우저가 죽은 실행이 1회 있었음(내가 pkill로 중단). 그 실행 로그(`qa-a-mouse2.log`)는 참고용.

## 산출물
- 스크립트: `scripts/` (`lib-a.mjs`, `qa-a-mouse.mjs`, `qa-a-phone.mjs`, `qa-a-tutorial-lab-layout.mjs`, `probe-mouse-hold.mjs`, `probe-phone-combat.mjs`, `probe-mouse-skill-hint.mjs`, 기존 `test-a1-mouse.mjs`, `test-a2-phone-1p.mjs`, `capserver-qa-a.ts`)
- 값: `qa-a-mouse-values.json`, `qa-a-phone-values.json`, `qa-a-tutorial-lab-layout-values.json`, `qa-a-phone-probe-values.json`, `qa-a-skill-hint-values.json`
- 로그: 실행 로그는 scratchpad에 있음(저장소 밖)
- 캡처: 이 폴더의 `A-*.png`

## 재현 명령 (정리 전 기준)
- 게임 서버: `npx tsx A-solo/scripts/capserver-qa-a.ts <A-solo/data>` (8801)
- 개발 서버: `npx vite --config vite.qa-A.config.ts` (5201, 설정은 `_vite-configs/vite.qa-A.config.ts`를 저장소 루트에 복사해 사용, 끝나면 루트 사본 삭제)
- 실행: `node scripts/qa-a-mouse.mjs`, `node scripts/qa-a-phone.mjs`, `node scripts/qa-a-tutorial-lab-layout.mjs`, 폰 재현은 `node scripts/probe-phone-combat.mjs`

## 종료 처리
- 띄운 서버(8801 게임, 5201 개발) 종료, 저장소 루트의 `vite.qa-A.config.ts` 삭제, `touch .memory/.done-R2-A`.
