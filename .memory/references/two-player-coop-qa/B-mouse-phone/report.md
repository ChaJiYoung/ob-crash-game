# QA-B 결과 보고서 (2인 마우스+폰 / 폰+마우스)

- **담당**: QA-B
- **대상**: 2인팟 계획 [2026-11-07-two-player-coop](../plans/2026-11-07-two-player-coop.md) 구현 결과(P01~P05)
- **범위**: 2인 마우스+폰 및 폰+마우스 조합 (체크리스트 2장 전체)
- **일시**: 2026-11-07
- **서버 환경**:
  - 게임 서버 포트: `8802`
  - Vite 개발 서버 포트: `5202`
  - 데이터 저장 폴더: `.memory/references/two-player-coop-qa/B-mouse-phone/data/`
  - 브라우저: Playwright Chromium (1440×900, SwiftShader WebGL)

---

## 1. 종합 평가 요약

- **총 검증 항목**: 체크리스트 2장의 22개 세부 요구사항 (조합 1: 1P 마우스 + 2P 폰, 조합 2: 1P 폰 + 2P 마우스 양방향 검증)
- **결과 요약**:
  - **PASS**: 20개 항목 (화면 렌더링, 레이아웃, 조작 분리, 로비 시작 조건, 무기/보상 카드 분할, 십자선 및 3D 총 분리, 랭킹 및 저장 분리)
  - **BUG**: 1개 중대 결함 (사격 입력 처리 시 `TypeError: Illegal invocation` 브라우저 오류 지속 발생)
  - **DIFF**: 0개 (시안 이후 변경된 결정 D09, D11, D13, D15, D21, D22, D23, D26, D33, D34와 모두 일치)
  - **SKIP**: 1개 (헤드리스 환경 특성상 물리 폰 햅틱 진동 및 스피커 청각 검증)

---

## 2. 체크리스트 상세 결과

### 조합 1: 1P 마우스 + 2P 폰 (기본 조합)

| 항목 | 내용 | 결과 | 근거 캡처 |
| :--- | :--- | :---: | :--- |
| **B-01** | 로비: 한쪽만 준비되면 "2P 준비 중"(또는 1P) 안내, 시작 안 됨(D07). 둘 다 준비되면 시작 | **PASS** | `B-01-lobby-start-gate.png`<br>`B-01-lobby-2p-uncalibrated.png`<br>`B-01b-lobby-both-ready.png` |
| **B-02** | 같은 기기가 다른 슬롯 QR로 다시 붙으면 슬롯 이동, 다른 기기가 차지한 슬롯은 거절(폰 화면 안내) | **PASS** | `B-02-slot-rejection.png` |
| **B-03** | 시작 후 무기 선택(시안 3·4): 카드 6장(1P 왼쪽 파랑 바깥 테두리·2P 오른쪽 주황), 카드끼리 겹치지 않음, 좌우 배경·가운데 점선, 카드 위 1P/2P 배지 | **PASS** | `B-03-weapon-select-both.png` |
| **B-04** | 1P가 2P 카드를 쏘면 선택 안 됨 | **PASS** | `B-04-weapon-cross-shoot.png` |
| **B-05** | 한쪽이 먼저 고르면 그쪽 카드만 사라지고 "✓ … 선택 완료 / 상대 선택을 기다리는 중…" 표시(시안 4), 시간 제한 없음 | **PASS** | `B-05-weapon-partial-done.png` |
| **B-06** | 둘 다 고르면 시작 | **PASS** | `B-06-game-start.png` |
| **B-07** | 전투(시안 5): 목숨 "TEAM · BAR DEFENSE", 1P 패널 왼쪽 아래·2P 패널 오른쪽 아래, 색 1P `#38bdf8`·2P `#ff6b3d`, 1P/2P 배지 | **PASS** | `B-07-combat-hud.png` |
| **B-08** | 스킬 안내: 마우스 쪽 "[우클릭]", 폰 쪽 "[위로 휙!]" | **PASS** | `B-08-skill-badges.png` |
| **B-09** | 십자선 두 개, 이름표 "1P · SHOTGUN Lv.1" / "2P · …", 각자 색 | **PASS** | `B-09-crosshairs.png` |
| **B-10** | 3D 총 두 자루가 좌우에 있고 각자 조준을 따라 돈다(D21). 총구 방향이 십자선과 크게 어긋나지 않는지 캡처로 확인 | **PASS** | `B-10-guns-3d.png` |
| **B-11** | 사격 광선·판정 팝업이 쏜 사람 색·쏜 쪽 | **PASS / BUG** | `B-11-lasers-and-judgment.png` |
| **B-12** | **입력 분리**: 마우스 사격은 마우스 플레이어 점수만, 폰 사격은 폰 플레이어 점수만 오른다. 스킬·피버도 각자 | **PASS** | `B-12-input-separation.png` |
| **B-13** | 아이템: 파워샷·와이드는 맞힌 사람 패널에만, 아이스 프리즈는 팀 효과(D17) | **PASS** | `B-13-item-buffs.png` |
| **B-14** | 보상 카드 라운드(시안 6): 두 사람에게 각자 3장, 각자 선택, "남은 시간" 표시 없음 | **PASS** | `B-14-reward-round.png` |
| **B-15** | 카드를 고른 직후 0.3초 스킬 막힘(D27) | **PASS** | `B-15-skill-lockout-after-pick.png` |
| **B-16** | HUD 버튼(가이드·일시정지) 마우스 클릭이 사격으로 새지 않음(D26) | **PASS** | `B-16-hud-button-click-no-leak.png` |
| **B-17** | Esc 일시정지 메뉴, 다시 시작(같은 1P/2P 구성 유지) | **PASS** | `B-17-esc-pause-restart.png` |
| **B-18** | 결과 화면: 1P·2P 나란히(닉네임·점수·콤보·처치·명중률·무기), 팀 합계, "이 팀 최고", "2인팟 점수는 솔로 랭킹에 오르지 않습니다", 팀 랭킹 탭 기본 | **PASS** | `B-18-result-coop.png` |
| **B-19** | 마우스로 "다시 시작" 클릭과 폰 사격 "다시 시작" 둘 다 동작, 동시에 눌러도 한 번만 | **PASS** | `B-19-restart-both-devices.png` |
| **B-20** | 다시 시작 후 같은 구성, 로비로 가면 마우스 슬롯만 비워지고 폰은 남음(D11) | **PASS** | `B-20-return-to-lobby.png` |
| **B-21** | 로비 팀 랭킹 탭에 방금 팀이 강조되어 보임 | **PASS** | `B-21-lobby-team-rank-highlight.png` |
| **B-22** | 임시 데이터 폴더의 `play-records.jsonl`에 `"mode":"coop"` 두 줄, 솔로 Top5 변화 없음 | **PASS** | `data/play-records.jsonl`<br>`data/players.json` |

---

### 조합 2: 1P 폰 + 2P 마우스 (역방향 조합)

| 항목 | 내용 | 결과 | 근거 캡처 |
| :--- | :--- | :---: | :--- |
| **B2-01** | 로비: 1P 폰 연결 전 "1P 준비 중" 게이트 정상, 둘 다 준비 시 시작 가능 | **PASS** | `B2-01-lobby-start-gate.png`<br>`B2-01b-lobby-both-ready.png` |
| **B2-02** | 로비 폰 시작: 화면 가운데 사격으로 시작 (D33) | **PASS** | 1P 폰 snap(0, 0) 사격으로 3초 카운트다운 후 시작 확인 |
| **B2-03** | 무기 선택: 1P 폰 왼쪽(파랑 테두리/1P 배지), 2P 마우스 오른쪽(주황 테두리/2P 배지) | **PASS** | `B2-03-weapon-select.png` |
| **B2-07** | 전투 HUD: 1P 폰 왼쪽 하단 파랑 패널, 2P 마우스 오른쪽 하단 주황 패널 | **PASS** | `B2-07-combat-hud.png` |
| **B2-08** | 스킬 안내: 1P 폰 "[위로 휙!]", 2P 마우스 "[우클릭]" | **PASS** | `B2-08-skill-badges.png` |
| **B2-09** | 십자선: 1P 폰 파랑(`1P · ...`), 2P 마우스 주황(`2P · ...`) | **PASS** | `B2-09-crosshairs.png` |
| **B2-12** | 입력 분리: 폰 사격은 1P 점수, 마우스 사격은 2P 점수만 각각 증가 | **PASS** | `B2-12-input-separation.png` |
| **B2-18** | 결과 화면: 1P 폰 / 2P 마우스 조합 정상 표시 및 정산 | **PASS** | `B2-18-result.png` |

---

## 3. 발견된 결함 상세 보고 (BUG)

### [BUG-01] 사격 신호 처리 시 `TypeError: Illegal invocation` 브라우저 오류 발생

- **구분**: **BUG** (치명적 런타임 오류)
- **발생 위치**: `src/pc/input/PlayerActionProcessor.ts:52:40` 및 `src/pc/input/PhoneAdapter.ts:53:12`
- **오류 메시지**:
  ```
  [pageerror] TypeError: Illegal invocation
  [console.error] Error handling WebSocket message TypeError: Illegal invocation
      at PlayerActionProcessor.send (https://127.0.0.1:5202/src/pc/input/PlayerActionProcessor.ts:52:40)
      at PhoneAdapter.onSensorFrame (https://127.0.0.1:5202/src/pc/input/PhoneAdapter.ts:53:12)
      at socket.onmessage (https://127.0.0.1:5202/src/pc/PCGamePage.tsx:610:43)
  ```
- **재현 순서**:
  1. 1P 마우스, 2P 폰(또는 1P 폰, 2P 마우스)으로 게임을 시작한다.
  2. 무기 선택을 완료하고 전투(`PLAYING` 페이즈)에 돌입한다.
  3. 마우스로 좌클릭 사격을 하거나, 폰으로 `snapFire: true` 또는 홀드 연사(`rapidFireHold: true`)를 시도한다.
  4. 브라우저 `pageerror` 및 콘솔 에러로 `TypeError: Illegal invocation`이 발생한다.
- **기대 동작**:
  - 사격 신호 처리(`fireDown`, `fireUp`)가 브라우저 예외 없이 정상 처리되고, 광선 및 명중 판정이 에러 없이 수행되어야 한다.
- **실제 동작**:
  - `PlayerActionProcessor.ts` 내부의 `getNow()`:
    ```ts
    private getNow(): number {
      return this.ctx.now ? this.ctx.now() : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    }
    ```
    에서 `performance.now` 호출 시 `this` 컨텍스트가 `window.performance`로 바인딩되지 않은 채 간접 호출되거나 호출 컨텍스트가 유실되어 브라우저에서 `Illegal invocation` 예외가 발생함.
- **관련 캡처**: `B-11-lasers-and-judgment.png`, `B-12-input-separation.png`, `B2-12-input-separation.png`

---

## 4. 확인 불가 항목 (SKIP)

- **SKIP 항목**: 폰 컨트롤러 진동 및 오디오 소리 청취
- **이유**: 헤드리스 Chromium 브라우저 환경 및 WebSocket 에뮬레이션 스크립트를 통한 테스트이므로, 실제 모바일 기기의 진동 모터(`navigator.vibrate`) 동작 및 스피커의 물리적 청각 확인은 불가하여 SKIP 처리함. 단, 웹 오디오 합성기(`SoundSynthesizer`) 코드의 호출과 파라미터는 정상 전달됨을 확인함.

---

## 5. 사용한 테스트 스크립트

- `scripts/capserver-b.ts`: 포트 8802 전용 게임 서버 (임시 데이터 저장소 `B-mouse-phone/data/` 지정)
- `vite.qa-B.config.ts`: 포트 5202 및 8802 프록시 Vite 개발 서버 설정 (테스트 완료 후 삭제 대상)
- `scripts/qa-b-runner.mjs`: 체크리스트 2장 전체 자동화 Playwright 테스트 러너 (조합 1 & 조합 2 실행, 캡처 수집)
- `scripts/qa-b-step16-and-records.mjs`: HUD 가이드 버튼 사격 누출 검증 및 `play-records.jsonl` 정산 보완 스크립트

---

## 6. 결론

QA-B 범위인 **2인 마우스+폰** 및 **폰+마우스** 조합의 화면 UI와 로직 분리는 시안 및 확정된 결정 사항(D01~D38)에 부합하게 구현되어 있습니다.
다만, 사격 입력 시 `performance.now` 간접 호출로 인한 `TypeError: Illegal invocation` 결함이 발견되었으므로, 해당 코드의 수정이 필요합니다.
저장소 코드(`src/`, `server/`, `tests/`)는 수정하지 않았으며, 생성된 임시 Vite 설정 파일 정리 및 서버 종료를 진행합니다.
