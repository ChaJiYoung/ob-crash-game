# QA-A 보고서: 1인 플레이 (마우스 단독, 폰 단독 1P·2P 슬롯, 튜토리얼·센서 랩)

- 대상: 2인팟 계획 [2026-11-07-two-player-coop](../../plans/2026-11-07-two-player-coop.md) 구현 결과 (P01~P05)
- 기준 시안: [two-player-coop-mockups.md](../two-player-coop-mockups.md)
- 결정 문서: [decisions/2026-11-07-two-player-coop.md](../../decisions/2026-11-07-two-player-coop.md)
- QA 환경:
  - Vite 개발 서버: `https://127.0.0.1:5201/` (임시 설정: `vite.qa-A.config.ts`)
  - WebSocket 게임 서버: `ws://localhost:8801` (임시 데이터: `.memory/references/two-player-coop-qa/A-solo/data/`)
  - 브라우저: Playwright Chromium (1440×900, `--use-gl=swiftshader --enable-webgl`)
  - 일시: 2026-11-07
  - 담당: QA-A

---

## 1. 총평 및 핵심 발견 사항

- **전체 요약**: 1인 플레이의 전반적인 UI 구성, D06/D09/D14/D15/D23/D25/D30/D33/D34 등의 주요 설계 결정은 화면 및 흐름에 충실하게 반영되어 있습니다. 슬롯 닉네임 자동 채움, 1P/2P 배지 숨김 및 앰버 색상 단일 패널 적용, 무기 및 보상 카드 선택 무제한 타이머, 폰 가운데 사격 시작, 결과 화면 버튼 사격 및 2P 슬롯 단독 1인 시작 등 대다수 기능이 정상 동작(PASS)합니다.
- **핵심 버그 (CRITICAL BUG - 브라우저 콘솔 / PAGE ERROR)**:
  - `PlayerActionProcessor.ts` 내부의 `setIntervalFn` getter에서 `window` 컨텍스트 바인딩 없이 `setInterval` 함수 레퍼런스를 반환하여, 사격(`fireDown`), 홀드 연사, 피버 발동 시 크로미움 브라우저에서 `TypeError: Illegal invocation`이 발생합니다.
  - 이로 인해 모든 플레이 모드(1인 마우스, 1인 폰, 튜토리얼, 센서 랩)에서 사격 시 연사 타이머 설정 실패 및 브라우저 콘솔 에러가 다수 발생합니다.

---

## 2. 체크리스트 결과

### A-1. 마우스 1인

| 항목 | 판정 | 근거 캡처 | 비고 |
| :--- | :---: | :--- | :--- |
| 로비: 슬롯 카드 2개, 둘 다 "비어 있음"(시안 1) | **PASS** | `A-1-01-lobby-empty.png` | 1P, 2P 카드 모두 초기 상태 "비어 있음" 표시 |
| 1P 🖱 마우스 선택 → 닉네임 입력 → 확인 → "준비 완료", 2P 슬롯 마우스 칸 비활성(시안 2) | **PASS** | `A-1-02-lobby-mouse-1p-ready.png` | 1P "테스터A · 마우스로 플레이", 2P 마우스 버튼 `disabled=true`, `opacity=0.35` 비활성화 |
| 새로고침 후 다시 🖱 선택 시 닉네임 자동 채움(D15) | **PASS** | `A-1-03-nickname-autofill.png` | 로비 새로고침 후 마우스 선택 시 저장된 닉네임 '테스터A' 자동 채움 |
| "게임 시작" 클릭 → 카운트다운 없이 시작, 무기 카드 3장 가운데 배치(1인 배치 그대로), 카드 종류 색 테두리, 바깥 주인 테두리·1P 배지 없음(D23) | **PASS** | `A-1-04-weapon-select-solo.png` | 카운트다운(3초) 없이 즉시 시작, 카드 3장 중앙 배치, 바깥 주인 테두리 및 1P 배지 없음 |
| 카드 클릭으로 선택 → 게임 시작 | **PASS** | `A-1-05-combat-solo-hud.png` | 가운데 카드 클릭 시 인게임 전투 시작 |
| 전투 HUD(시안 5-1): 왼쪽 위 목숨만("BAR DEFENSE"), 왼쪽 아래 개인 패널 하나(점수·콤보·무기·탄창·스킬·피버·카드), 1P 배지 없음, 앰버 색, 오른쪽 아래 피버 패널 없음 | **PASS** | `A-1-05-combat-solo-hud.png` | 시안 5-1과 동일: 상단은 BAR DEFENSE만 유지, 좌하단 단일 앰버 패널로 통합, 우하단 피버 패널 제거됨 |
| 스킬 안내 "[우클릭]" 하나만(D09) | **PASS** | `A-1-05-combat-solo-hud.png` | 마우스 플레이어에 맞춰 "[우클릭]" 안내만 패널 내 표시 |
| 십자선 이름표 "SHOTGUN Lv.1"처럼 접두어 없음 | **PASS** | `A-1-05-combat-solo-hud.png` | "1P · " 접두어 없이 무기명/레벨만 표시 |
| 좌클릭 단발, 누르고 있으면 연사, 더블클릭 피버, 우클릭 스킬(시작 1.5초 뒤) | **BUG** | `A-1-06-combat-mouse-actions.png` | **[BUG-01]** 사격 및 피버 동작 시 `PAGE ERROR: Illegal invocation` 발생 (상세 결함 보고 참조) |
| 우클릭 스킬이 판 시작 직후 1.5초 안·카드 선택 중에는 안 나감(D25) | **PASS** | `A-1-04-weapon-select-solo.png`<br>`A-1-05-combat-solo-hud.png` | 무기 선택 중 및 전투 시작 직후 1.5초 동안 우클릭 스킬 발동 무시 확인 |
| 보상 카드 선택 화면(4웨이브 킬 게이지 또는 웨이브 클리어): 3장, "남은 시간" 표시 없음(D34) | **PASS** | `A-1-08-reward-select-solo.png` | 카드 3장 표시, D34 결정에 따라 상단 '남은 시간 N초' 타이머 표시 제거됨 |
| Esc 일시정지·재개·다시 시작·로비로 | **PASS** | `A-1-07-esc-pause.png` | '▶ 이어하기', '🔁 다시시작', '🏠 로비로 나가기' 모달 정상 표시 및 재개 동작 |
| 결과 화면: 기존 1인 결과(점수 내역·랭킹), "다시 시작"·"로비로" 클릭 동작, 랭킹 탭(개인 기본) | **PASS** | `A-1-09-result-solo.png` | 기존 1인 결과 레이아웃, 개인 랭킹 탭 기본 선택, 버튼 클릭 동작 확인 |
| 로비로 → 마우스 슬롯이 비워짐(D11), 닉네임은 다시 선택 시 자동 채움 | **PASS** | `A-1-10-lobby-returned-empty.png` | 결과 모달에서 '로비로 이동' 클릭 시 마우스 슬롯이 초기화되어 비워짐 |

---

### A-2. 폰 1인 (1P 슬롯)

| 항목 | 판정 | 근거 캡처 | 비고 |
| :--- | :---: | :--- | :--- |
| 1P 📱 선택 → QR·방 코드·URL에 `slot=1` | **PASS** | `A-2-01-lobby-phone-1p-qr.png` | URL `/controller?room=...&slot=1` 확인 |
| 가짜 폰 연결 → 닉네임 표시, 영점 전 "영점을 맞춰 주세요", 영점 후 "준비 완료" | **PASS** | `A-2-02-phone-joined-need-zero.png`<br>`A-2-03-phone-ready.png` | 폰 연결 시 영점 대기 문구 → `CALIBRATE_ZERO` 전송 후 '준비 완료' 전환 |
| 폰으로 화면 가운데 사격 → 카운트다운 3초 → 시작(D33) | **PASS** | `A-2-04-phone-start-countdown.png` | 중앙 영역(`aimX=0, aimY=0`) `snapFire` 시 3초 카운트다운 진입 후 시작 |
| 무기 카드 폰 사격으로 선택 | **PASS** | `A-2-05-phone-weapon-select.png` | 폰 조준 사격으로 무기 카드 선택 및 전투 진입 |
| 스킬 안내 "[위로 휙!]" 하나만 | **PASS** | `A-2-06-phone-combat-hud.png` | 모바일 플레이어에 맞춰 "[위로 휙!]" 안내만 표시 |
| 단발(snap), 홀드 연사(시작 순간 강한 첫 발 포함, D25), 피버, 스킬 | **BUG** | `A-2-07-phone-combat-actions.png` | **[BUG-01]** 폰 사격 및 연사 시 웹소켓 핸들러에서 `TypeError: Illegal invocation` 콘솔 에러 발생 |
| 결과 화면: 폰 조준으로 "다시 시작" 버튼을 쏴서 누름, 버튼 밖을 쏘면 아무 일 없음 | **PASS** | `A-2-11-phone-result-screen.png`<br>`A-2-12-phone-aiming-restart-button.png`<br>`A-2-13-phone-restart-action.png` | 허공(`aimX=0.8, aimY=-0.8`) 사격 시 무반응, `data-shootable="restart"` 버튼 조준 사격 시 다시 시작 성공 |
| 폰 끊김(1인) → 일시정지 "폰 재연결 중"이 무기한 유지(1인 규칙), 재접속 시 "다시 연결됨" | **PASS** | `A-2-08-phone-disconnected-pause.png`<br>`A-2-09-phone-disconnect-indefinite.png`<br>`A-2-10-phone-reconnected-resume.png` | 1인 판 폰 끊김 시 30초 카운트다운 없이 무기한 대기 확인, 재접속 시 정상 게임 재개 |

---

### A-3. 폰 1인 (2P 슬롯만 사용)

| 항목 | 판정 | 근거 캡처 | 비고 |
| :--- | :---: | :--- | :--- |
| 2P 📱만 연결해도 1인 판으로 시작(D06), 화면은 1인 모양(배지 없음, 앰버) | **PASS** | `A-3-01-lobby-2p-phone-only.png`<br>`A-3-02-combat-2p-phone-solo.png` | 1P 슬롯 비워두고 2P 폰만 연결 시 1인 모드로 시작, 상단 `BAR DEFENSE` 목숨, 1P/2P 배지 없음, 앰버 개인 패널 1개 |
| 센서 랩(샌드박스) 영점 리셋이 이 폰에 적용됨(P04 수정 사항) | **PASS** | `A-3-03-sensor-lab-overlay.png` | `getSoloSlot`이 slot 2를 반환하여 2P 폰 어댑터의 `autoZeroFromLatest()`가 정상 호출됨 |

---

### A-4. 튜토리얼·센서 랩

| 항목 | 판정 | 근거 캡처 | 비고 |
| :--- | :---: | :--- | :--- |
| 튜토리얼: 메인과 같은 개인 패널(D14), 단계 안내 문구 유지, 1~4단계 진행(마우스로 끝까지) | **PASS** | `A-4-01-tutorial-step1.png`<br>`A-4-02-tutorial-step2.png`<br>`A-4-03-tutorial-step3.png`<br>`A-4-04-tutorial-step4.png`<br>`A-4-05-tutorial-complete.png` | 메인 게임과 동일한 개인 패널 형태 적용, 상단 `TutorialGuideOverlay` 단계별 안내 유지, 1~4단계 진행 및 완료 |
| 튜토리얼 판정이 실전처럼 좁아짐(D30) — 너무 어렵지 않은지 체감 메모 | **PASS** | `A-4-01-tutorial-step1.png` | **[체감 메모]** D30에 따라 `hitZone.scale=0.75` 축소 판정이 적용되었으나, 마우스 조준 사격 시 연습 캔 몬스터를 안정적으로 명중·격파할 수 있었으며 과도하게 빗나가지 않아 적절한 난이도임. |
| 센서 랩: 기존 화면 유지, "테스트 사격" 버튼 동작, "실전 시작"이 시작 조건을 거침 | **PASS** | `A-4-06-sensor-lab-main.png`<br>`A-4-07-sensor-lab-test-shot.png`<br>`A-4-08-sensor-lab-start-condition.png` | 기존 샌드박스 UI 정상 표시, "현재 조준점 시험 사격" 클릭 시 사격 발동, "실전 배틀 시작!" 클릭 시 시작 조건 검증 수행 |

---

## 3. 발견된 결함 상세 보고 (BUG)

### [BUG-01] 사격 및 피버 동작 시 `TypeError: Illegal invocation` 발생 (CRITICAL)

- **심각도**: HIGH (브라우저 Uncaught TypeError / `pageerror` 유발)
- **대상 파일**: `src/pc/input/PlayerActionProcessor.ts` 라인 54-60, 105, 158
- **원인 분석**:
  ```ts
  // PlayerActionProcessor.ts
  private get setIntervalFn(): typeof setInterval {
    return this.ctx.timers?.setInterval ?? setInterval;
  }
  private get clearIntervalFn(): typeof clearInterval {
    return this.ctx.timers?.clearInterval ?? clearInterval;
  }
  ```
  - 브라우저 환경에서 `window.setInterval`을 컨텍스트 바인딩 없이 `this.setIntervalFn(...)`으로 단독 호출하면 `this` 컨텍스트가 상실되어 크로미움 브라우저에서 `TypeError: Illegal invocation`이 발생합니다.
  - 마우스 클릭 발사(`fireDown`), 폰의 `snapFire`/`rapidFireHold`, 샌드박스 "시험 사격", 피버 발동 시 `this.holdFireInterval = this.setIntervalFn(...)` 및 `this.feverAutoFireInterval = this.setIntervalFn(...)`이 호출될 때마다 예외가 던져집니다.
- **재현 순서**:
  1. `https://127.0.0.1:5201/` 접속
  2. 1P 마우스 선택 후 닉네임 입력 및 확인
  3. "게임 시작" 클릭 후 무기 카드 선택
  4. 인게임 화면에서 좌클릭 사격을 하거나 우클릭/더블클릭/연사 시도
  5. 브라우저 콘솔 및 Playwright `pageerror`에 `PAGE ERROR: Illegal invocation` 다수 발생
- **기대 동작**:
  - 발사 및 연사 타이머가 정상 등록되어 예외 없이 동작해야 함 (`window.setInterval.bind(window)` 등 바인딩 필요).
- **실제 동작**:
  - 발사 시마다 `TypeError: Illegal invocation`이 발생하여 브라우저 에러 로그가 누적되고 홀드 연사 인터벌 생성이 실패함.
- **관련 근거 캡처**:
  - `A-1-06-combat-mouse-actions.png`
  - `A-2-07-phone-combat-actions.png`
  - `A-4-01-tutorial-step1.png`
  - `A-4-07-sensor-lab-test-shot.png`
- **수집된 에러 로그**:
  ```
  PAGE ERROR: Illegal invocation
  CONSOLE ERROR: Error handling WebSocket message TypeError: Illegal invocation
      at PlayerActionProcessor.send (https://127.0.0.1:5201/src/pc/input/PlayerActionProcessor.ts:52:40)
      at PhoneAdapter.onSensorFrame (https://127.0.0.1:5201/src/pc/input/PhoneAdapter.ts:53:12)
      at socket.onmessage (https://127.0.0.1:5201/src/pc/PCGamePage.tsx:576:43)
  ```

---

## 4. 시안 및 결정 차이점 (DIFF)

- **DIFF 없음**:
  - 시안(Mockups)과 결정 문서(Decisions) 사이의 변경 사항(D09 1인 개인 패널 통일, D23 카드 테두리 및 1P 배지 숨김, D33 폰 가운데 사격 시작, D34 카드 선택 시간 제한 없음 등)이 실제 화면과 정확히 일치하게 구현되어 있습니다.

---

## 5. 확인 불가 항목 (SKIP)

- **사운드 및 햅틱 효과**:
  - 헤드리스 브라우저(Playwright Headless) 환경 특성상 실제 오디오 출력음 및 모바일 기기 진동(`navigator.vibrate`)은 물리적으로 청취/체감할 수 없어 코드 호출 여부 및 브라우저 콘솔 오류 유무로만 검증하였습니다.

---

## 6. 테스트에 사용된 스크립트 목록

산출물 폴더 내 `scripts/`에 저장되어 언제든 재실행 가능합니다:
1. `capserver-qa-a.ts`: QA-A 전용 게임 서버 (포트 8801, 격리 데이터 저장)
2. `test-a1-mouse.mjs`: 마우스 1인 전체 시나리오 (로비 빈 상태, 닉네임 입력/자동채움, 무기/보상 카드 선택, 전투 조작, Esc 메뉴, 결과 화면, 로비 복귀)
3. `test-a2-phone-1p.mjs`: 폰 1인 (1P 슬롯) 전체 시나리오 (QR slot=1, 영점 전/후, 가운데 사격 시작, 스킬 안내, 사격/피버/스킬, 폰 끊김 무기한 대기 및 재접속)
4. `test-a2-phone-result-shot.mjs`: 폰 1인 결과 화면 사격 테스트 (허공 사격 무반응, "다시 시작" 버튼 조준 사격 및 재시작)
5. `test-a3-phone-2p-slot.mjs`: 폰 1인 (2P 슬롯만 사용) 시나리오 (2P만 연결 시 1인 시작, 앰버 단일 패널 확인, 센서 랩 영점 리셋 slot 2 적용 확인)
6. `test-a4-tutorial-sandbox.mjs`: 튜토리얼 1~4단계 및 완료, 센서 랩 진입 테스트
7. `test-a4-sensor-lab-buttons.mjs`: 센서 랩 시험 사격 및 실전 시작 조건 검증 테스트
