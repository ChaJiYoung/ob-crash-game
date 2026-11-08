# Task: T01 실기기 검증과 최종 빌드

## Status: pending

## Goal
"보급형은 `rotationRate`가 `null`로 온다"는 가정이 실제 폰에서 맞는지 운영 빌드로 확인하고, 센서 랩 모달 흔들림 수정, 버튼 제거, 마우스 조준 분리, 피버·탄창 분리와 조준경 호 표시를 눈으로 확인한 뒤 최종 빌드를 통과시킨다. 코드 변경은 검증 중 발견된 문제를 고칠 때만 한다.

## Decision Summary
- D10: 계획의 마지막 Phase로 실기기 검증을 둔다. 보급형 폰이 없으면 그 항목만 "미확인"으로 남긴다. 결과가 기대와 다르면 판별 규칙을 고치는 후속 작업을 한다.
- **함정(가장 중요)**: `npm run dev`(Vite 개발 서버)는 `import.meta.env.DEV === true`라서 판별을 건너뛴다(D04). 개발 서버로는 차단이 절대 일어나지 않는다. 반드시 운영 빌드로 확인한다.

## Implementation

### I01. 운영 빌드로 서버·화면 띄우기
- Related Files:
  - `package.json` :: scripts `build`, `preview`, `server`; read-only
  - `vite.config.ts` :: `server.proxy['/ws']`, `basicSsl()`; read-only

#### Details
- **Execution Flow / Logic**:
  1. 터미널 A: `npm run server`(포트 8787).
  2. 터미널 B: `npm run build && npm run preview -- --host`. `vite preview`는 기본 포트 4173이고, `@vitejs/plugin-basic-ssl`이 preview에도 HTTPS를 적용하는지, `server.proxy`(`/ws` → `ws://localhost:8787`)가 preview에도 적용되는지 첫 실행 로그와 폰 접속으로 확인한다. 안 되면 `vite.config.ts`에 `preview: { host: '0.0.0.0', port: 4173, proxy: <같은 proxy> }`를 추가하는 최소 수정을 하고 커밋 메시지에 이유를 적는다.
  3. 터미널 C(폰이 같은 네트워크가 아닐 때): `npx --yes cloudflared tunnel --url https://localhost:4173 --no-tls-verify`(기존 `dev:tunnel`과 같은 방식, 포트만 4173).
  4. PC 브라우저로 위 preview 주소를 열어 방 QR을 띄운다.

### I02. 실기기 체크리스트
- Related Files:
  - `.memory/phases/2026-11-08-unsupported-phone-block/P04-real-device-verify/T01-verify-and-build.md` :: 아래 표 — 결과 기록; modify

#### Details
각 항목을 수행하고 "결과" 칸에 `pass` / `fail(관찰한 현상)` / `미확인(사유)`를 적는다.

| # | 기기·환경 | 절차 | 기대 | 결과 |
|---|---|---|---|---|
| A | 정상 폰(iPhone 13 mini 등) | QR 스캔 → 닉네임 → 센서 권한 허용 | 버튼이 "센서 확인 중..."으로 잠깐 바뀌었다가 PAD 화면, PC에 조준경 표시, 정상 플레이 |  |
| B | 정상 Android 폰(자이로 있음, 있다면) | A와 동일 | A와 동일 |  |
| C | 지난번 문제가 된 보급형 폰(Galaxy A15 등) | A와 동일 | "이 기기는 지원하지 않아요" 차단 화면. PC 1P 슬롯이 입력 선택 전 상태로 돌아가고 빨간 안내 칩이 6초간 표시 |  |
| D | C 직후 다른 정상 폰 | 같은 QR(같은 슬롯) 스캔 | 슬롯 점유 오류 없이 정상 연결 |  |
| E | PC 브라우저(운영 빌드)에서 QR 주소를 직접 열기 | 권한 허용 버튼 | 차단 화면(센서 없음) |  |
| F | `npm run dev` + 폰/PC | 위 E 반복 | 차단되지 않고 기존처럼 PAD로 진행(개발 모드 우회) |  |
| G | PC `/sensor-test` | 폰 연결 후 "📊 센서 랩" 클릭, 1분 관찰 | 모달 높이가 흔들리지 않음(렌더 성능·GPU 메모리 두 줄이 유지) |  |
| H | PC 로비·인게임 HUD | 화면 확인 | "테스트장"·"센서 진단 & 안정화 랩" 버튼 없음 |  |
| I | C에서 차단된 폰을 새로고침 | 허용 버튼 재탭 | 다시 차단됨(서버는 기억하지 않음) |  |
| J | 정상 폰 1대로 혼자 플레이(마우스로 참여하지 않음) | 폰으로 조준하며 PC 마우스를 계속 움직이고 클릭 | 조준경이 폰만 따라가고 마우스 이동·클릭은 조준·사격에 영향 없음. 메뉴·일시정지 버튼은 마우스로 눌림 |  |
| K | 로비에서 마우스로 참여 | 마우스로 조준·사격·우클릭 스킬·더블클릭 피버 | 지금처럼 정상 동작 |  |
| L | 피버 중 탄창 | 탄창을 일부 쓰고 피버 발동 | 탄창이 충전되지 않고 피버 중 쏴도 줄지 않으며, 피버가 끝나면 켜기 전 값에서 이어짐 |  |
| M | 탄창을 다 쓴 직후(장전 중) 피버 발동 | 조준경과 하단 패널 관찰 | 십자선이 흐려지지 않고 선명하며, 장전이 취소되지 않고 하늘색 탄창 호·패널 장전 막대가 계속 채워지며, 동시에 붉은 피버 호는 줄어듦. 장전이 끝나면 탄창이 참(정상 동작) |  |
| N | 피버 충전·발동 | 조준경 오른쪽 아래 호 관찰 | 충전 중 주황색으로 차오르고, 피버 중 붉은색으로 남은 시간만큼 줄어듦. 별도 장전 링이 없음 |  |
| O | 튜토리얼 4단계·`/sensor-test`(폰 연결) | 장전·피버 관찰 | 조준경 호가 보임(장전 표시 포함). `/sensor-test`에서 폰이 없으면 마우스로 조준되지 않음 |  |
| P | 스킬 | 탄창 0·피버 중에 스킬 발동 | 스킬이 탄창·피버와 무관하게 충전·발동 |  |

- 판정 규칙이 틀린 경우의 대응(수정 코드는 이 Task에서 직접 하지 말고 결과를 `.memory/current.md` Status에 기록해 후속 결정으로 올린다):
  - C가 통과해 버림 → 그 폰의 `devicemotion.rotationRate` 값을 확인(PC 개발자 도구 원격 디버깅 또는 임시 로그)한 뒤 판별 기준(예: 값이 거의 변하지 않는지)을 `/edu-grill-me`로 다시 정한다.
  - A/B가 막힘 → `SENSOR_PROBE_MS`를 늘리는 것으로 해결되는지(이벤트 시작이 늦은 기기) 먼저 확인한다.

### I03. 최종 빌드와 정리
- Related Files:
  - 없음(검증 전용)

#### Details
- `npx tsc --noEmit`, `npx vitest run`, `npm run build`를 실행한다. 실패하면 원인을 고치고 결과를 기록한다.
- 임시 로그/디버그 코드를 넣었다면 모두 제거한다(`git diff`로 확인).

## Acceptance Criteria
- [ ] 체크리스트 A~P에 결과가 기록되어 있다(보급형 폰이 없으면 C·D는 "미확인").
- [ ] `tsc`·`vitest`·`build`가 통과한다.
- [ ] 판별 규칙이 틀렸다면 후속 결정 사항이 `.memory/current.md`에 기록되어 있다.

## Validation
- `npx tsc --noEmit && npx vitest run && npm run build` — 모두 성공

## Commit Message
```text
test(verify): 미지원 폰 차단 실기기 검증 결과 기록

Plan: 2026-11-08-unsupported-phone-block
Phase: P04-real-device-verify
Task: T01-verify-and-build

- I01: 운영 빌드(preview)로 서버·화면 구동
- I02: 체크리스트 A~P 결과 기록
- I03: tsc·vitest·build 최종 통과
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
