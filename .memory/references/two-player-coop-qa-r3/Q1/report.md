# 3차 QA Q1 항목 검증 결과 보고서 (2차 수정 확인)

- **작성 일시**: 2026-11-08
- **담당자**: 3차 QA Q1 담당
- **검증 환경**:
  - Node.js: v22.19.0 / npm: 10.9.3
  - Vitest: v3.2.4
  - 브라우저: Playwright (Chromium Headless, SwiftShader WebGL)
  - 게임 서버: Port 8821
  - Vite 클라이언트: Port 5221 (`https://127.0.0.1:5221/`)
- **전체 판정 결과**: **7 / 7 항목 모두 PASS (100% 통과)**

---

## 1. 검증 결과 요약표

| 번호 | 검증 항목 | 판정 | 주요 측정치 / 근거 | 관련 증거 캡처 |
| :--- | :--- | :---: | :--- | :--- |
| **Q1-1** | 슬롯 이동 | **PASS** | 동일 폰 다른 슬롯 진입 시 이전 슬롯 즉시 EMPTY 및 마우스 버튼 활성화 (`disabled: false`) | `Q1-01-slot-step0-initial.png`<br>`Q1-01-slot-step1-2p.png`<br>`Q1-01-slot-step2-1p.png`<br>`Q1-01-slot-step3-back-to-2p.png` |
| **Q1-2** | 남의 카드 사격 & 카드 바깥 클릭 | **PASS** | 남의 카드 및 반폭 바깥(1.2배) 클릭 시 무반응(`selection.done` 불변), 자기 카드 중심 클릭 시에만 선택 완료 | `Q1-02-weapon-select-screen.png`<br>`Q1-02-1p-hit-2p-card-no-change.png`<br>`Q1-02-1p-hit-1p-card-done.png`<br>`Q1-02-2p-hit-1p-card-no-change.png`<br>`Q1-02-2p-hit-2p-card-all-done.png`<br>`Q1-02-solo-miss-outside-radius.png`<br>`Q1-02-solo-hit-center-selected.png` |
| **Q1-3** | 결과 화면 십자선 & 재도전 사격 | **PASS** | 결과 모달(`z-index: 120`) 위에 십자선(`z-index: 130`, `opacity: 0.55`, 이름표 숨김) 렌더링 확인, 결과 숫자 식별 가능, 버튼 사격 시 재시작(`PLAYING`) | `Q1-03-result-crosshair-solo.png`<br>`Q1-03-result-after-restart-solo.png`<br>`Q1-03-result-crosshair-coop.png` |
| **Q1-4** | 1024×768 배지·이름표 화면 경계 | **PASS** | 1024×768 해상도에서 6개 배지(X: 63.2~960.7px) 및 전투 이름표(1P Left: 8.12px, 2P Right: 691.5px) 모두 뷰포트 내 안착 (`allInBounds: true`) | `Q1-04-smallscreen-weapon-select-badges.png`<br>`Q1-04-smallscreen-combat-crosshair-tags.png` |
| **Q1-5** | 개틀링 콘솔 무결성 | **PASS** | 1인 개틀링 60초 연속 사격 및 전투 진행 중 `pageerror: 0건`, `console.error: 0건` | `Q1-05-gatling-combat-0s.png`<br>`Q1-05-gatling-combat-45s.png`<br>`Q1-05-gatling-combat-final.png` |
| **Q1-6** | 시작 직후 단계 | **PASS** | 카운트다운 직후 무기 선택 진입 시 `phase === 'PLAYING'` 확인, 폰 단발 1회 사격으로 즉시 무기 확정 | `Q1-06-countdown-end-playing-phase.png`<br>`Q1-06-phone-snap-weapon-selected.png` |
| **Q1-7** | 2인 난이도 적용 (D41) | **PASS** | Wave 1 분모 40, 일반 몬스터 HP 1인과 동일(배율 1.0), Wave 3 쿨러 보스 maxHp 200(1인 100의 2배), 첫 소환 미니언 8마리(1인 4마리의 2배) | `Q1-07-coop-wave1-spawns40-monsterhp.png`<br>`Q1-07-coop-wave3-boss-cooler-hp200.png`<br>`Q1-07-coop-wave3-boss-first-summon-8.png` |

---

## 2. 항목별 상세 검증 내역

### [Q1-1] 슬롯 이동
- **검증 시나리오**:
  1. 1P에 마우스를 배정한 상태에서 가짜 폰 X(`phone_slot_x`)를 2P 슬롯에 연결.
  2. 2P 슬롯에 폰 X가 정상 연결된 상태에서, 동일한 폰 X를 1P 슬롯으로 연결 시도.
  3. **검증**: 1P 슬롯으로 폰 X가 이동하고, 2P 슬롯은 즉시 `EMPTY`로 비워짐 확인.
  4. **검증**: 2P 슬롯의 마우스 버튼이 활성화되어(`disabled: false`), 마우스 점유가 가능함을 확인.
  5. 폰 X를 다시 2P 슬롯으로 이동시켜 동일하게 1P 슬롯이 비워지고 마우스 버튼이 재활성화됨을 확인.
- **측정 데이터**:
  - `step1_2p`: 1P `mouse`, 2P `phone_slot_x` (1P 마우스 활성: false, 2P 마우스 활성: false)
  - `step2_1p`: 1P `phone_slot_x`, 2P `EMPTY` (1P 마우스 활성: false, 2P 마우스 활성: true)
  - `step3_back_to_2p`: 1P `EMPTY`, 2P `phone_slot_x` (1P 마우스 활성: true, 2P 마우스 활성: false)
- **판정**: **PASS**

---

### [Q1-2] 남의 카드 사격 & 카드 바깥 클릭
- **검증 시나리오**:
  1. 2인 모드 무기 선택 진입 (1P 마우스, 2P 폰).
  2. 1P 마우스로 2P 카드 중심 클릭 -> `selection.done` 상태 변화 없음 (`[false, false]`).
  3. 1P 마우스로 1P 카드 중심 클릭 -> 1P만 선택 완료 (`[true, false]`).
  4. 2P 폰으로 1P 카드 snap 사격 -> `selection.done` 상태 변화 없음 (`[true, false]`).
  5. 2P 폰으로 2P 카드 snap 사격 -> 2P도 선택 완료 (`[true, true]`), 게임 플레이 단계 진입.
  6. 1인 모드에서 카드 반폭 바깥(`aimX + hitRadius * 1.2`) 클릭 -> 미선택(`selection.done: [false]`).
  7. 카드 중심부 클릭 -> 선택 완료(`selection.done: [true]`).
- **측정 데이터**:
  - `step1_1pHits2pCard`: `[false, false]` (변화 없음)
  - `step2_1pHits1pCard`: `[true, false]` (1P 정상 선택)
  - `step3_2pHits1pCard`: `[true, false]` (변화 없음)
  - `step4_2pHits2pCard`: `[true, true]` 및 `phase === 'PLAYING'` (2P 정상 선택 및 게임 시작)
  - `solo_outside`: `[false]` (반폭 바깥 무시)
  - `solo_center`: `[true]` (중심 클릭 선택)
- **판정**: **PASS**

---

### [Q1-3] 결과 화면 십자선 & 재도전 사격
- **검증 시나리오**:
  1. 게임 오버 후 결과 모달이 뜬 상태에서 십자선 DOM, 투명도, 이름표 유무 확인.
  2. `CrosshairOverlay`의 `variant="menu"` 적용에 따라 `data-testid="crosshair-nametag"`는 렌더링되지 않으며, `opacity: 0.55`의 반투명 링으로 `zIndex: 130` 레이어(결과 모달 `zIndex: 120` 위)에 렌더링됨을 확인.
  3. 반투명 링으로 렌더링되어 결과 모달의 점수 숫자가 가려지지 않고 온전히 식별 가능함을 육안 및 캡처로 확인.
  4. 폰 조준으로 "다시 도전하기" 버튼 사격 시 `phase === 'PLAYING'`으로 즉시 재시작됨을 확인.
  5. 2인 모드 결과 화면에서도 1P, 2P 2개의 십자선이 정상 표시되고 이름표는 노출되지 않음을 확인.
- **측정 데이터**:
  - `solo.crosshairCount`: 1, `solo.nametagsCount`: 0, `solo.containerZIndex`: "130", `solo.opacity`: "0.55", `solo.restartPhase`: "PLAYING"
  - `coop.crosshairCount`: 2, `coop.nametagsCount`: 0
- **판정**: **PASS**

---

### [Q1-4] 1024×768 배지·이름표 화면 경계
- **검증 시나리오**:
  1. 1024×768 해상도에서 2인 무기 선택 화면 진입.
  2. 카드 상단 1P/2P 배지 6개(`data-owner-badge`)의 바운딩 박스 측정.
  3. 전투 화면에서 1P 마우스 좌측 끝(`aimX = -0.95`), 2P 폰 우측 끝(`aimX = 0.60`) 조준 시 이름표(`data-testid="crosshair-nametag"`) 바운딩 박스 측정.
- **측정 데이터**:
  - 무기 선택 배지 6개:
    - Card 0: left 63.2px, right 101.0px
    - Card 1: left 232.8px, right 270.6px
    - Card 2: left 402.3px, right 440.1px
    - Card 3: left 583.9px, right 621.7px
    - Card 4: left 753.4px, right 791.2px
    - Card 5: left 922.8px, right 960.7px
    - 전원 `left >= 0` 및 `right <= 1024` 만족 (`allInBounds: true`)
  - 전투 이름표:
    - 1P (좌측 극단 조준): `left: 8.12px`, `right: 172.12px` (화면 좌측 경계 내부 클램프)
    - 2P (우측 조준): `left: 527.53px`, `right: 691.53px`
    - 전원 `allInBounds: true`
- **판정**: **PASS**

---

### [Q1-5] 개틀링 콘솔 무결성
- **검증 시나리오**:
  1. 1인 모드에서 개틀링건을 선택하고 전투 진입.
  2. 60초간 연사 및 단발 사격을 혼합하며 전투 진행.
  3. 브라우저 콘솔 에러 및 페이지 런타임 에러 수집.
- **측정 데이터**:
  - `pageerror`: 0건
  - `console.error`: 0건
  - 총 측정 시간: 60.1초
- **판정**: **PASS**

---

### [Q1-6] 시작 직후 단계
- **검증 시나리오**:
  1. 폰 1인 페어링 후 로비 과녁 사격으로 게임 시작.
  2. 카운트다운(3초) 종료 직후 단계 검증.
  3. 무기 선택 화면에서 폰 단발(`snap`) 1회 사격 시 무기 선택 완료 여부 확인.
- **측정 데이터**:
  - 카운트다운 직후 phase: `"PLAYING"`
  - 무기 선택 상태: `selection.kind === 'weapon'`
  - 단발(`snap`) 1회 사격 후: `singleShotSuccess: true`, 선택된 무기 `"revolver"`
- **판정**: **PASS**

---

### [Q1-7] 2인 난이도 적용 (D41)
- **검증 시나리오 및 기준**:
  1. 1웨이브 스폰 수(WAVE 진행도 분모) 40 검증.
  2. 일반 몬스터 `maxHp`가 1인과 동일한지 검증 (배율 1.0).
  3. 3웨이브 보스 `maxHp`가 200(cooler)인지 검증 (1인 100 대비 2배).
  4. 보스 첫 소환 마릿수가 8마리인지 검증 (1인 4마리 대비 2배).
- **측정 데이터**:
  - 1웨이브 진행도 HUD 텍스트: `"WAVE 진행도0 / 40"` (분모 40 확인)
  - 일반 몬스터 maxHp:
    - 1인 플레이 1웨이브: `caslight: 1`, `pilgood: 1`
    - 2인 플레이 1웨이브: `pilgood: 1`, `caslight: 1`
    - 동일 체력 (배율 1.0) 확인
  - 3웨이브 보스 cooler:
    - ID: `boss_136`, 종류: `boss`, role: `cooler`
    - `maxHp = 200`, `hp = 200` 확인 (1인 100 대비 2배)
  - 보스 첫 소환 마릿수:
    - 첫 소환 임계치: `summonHpThresholds[0] = 0.99` (보스 HP <= 198)
    - 보스 1회 피격 후 소환된 미니언 수: `boss_minion_*` 8마리 확인 (1인 4마리 대비 2배)
- **판정**: **PASS**

---

## 3. 발견된 버그 및 특이사항

- **BUG**: 없음 (전 항목 정상 동작 확인)
- **DIFF**: 없음
- **SKIP**: 없음

---

## 4. 증거 자료 디렉토리

- 산출물 경로: `.memory/references/two-player-coop-qa-r3/Q1/`
- 테스트 스크립트: `.memory/references/two-player-coop-qa-r3/Q1/scripts/`
- 캡처 이미지: `.memory/references/two-player-coop-qa-r3/Q1/captures/`
  - `Q1-01-slot-step0-initial.png` ~ `Q1-01-slot-step3-back-to-2p.png`
  - `Q1-02-weapon-select-screen.png` ~ `Q1-02-solo-hit-center-selected.png`
  - `Q1-03-result-crosshair-solo.png` ~ `Q1-03-result-crosshair-coop.png`
  - `Q1-04-smallscreen-weapon-select-badges.png`, `Q1-04-smallscreen-combat-crosshair-tags.png`
  - `Q1-05-gatling-combat-0s.png` ~ `Q1-05-gatling-combat-final.png`
  - `Q1-06-countdown-end-playing-phase.png`, `Q1-06-phone-snap-weapon-selected.png`
  - `Q1-07-coop-wave1-spawns40-monsterhp.png`, `Q1-07-coop-wave3-boss-cooler-hp200.png`, `Q1-07-coop-wave3-boss-first-summon-8.png`
- 테스트 결과 JSON: `.memory/references/two-player-coop-qa-r3/Q1/test-*-result.json`
