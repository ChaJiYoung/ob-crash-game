# Plan: 미지원 폰 차단 + 센서 테스트장 숨기기 + 피버·탄창·조준 수정

- Decisions:
  - [2026-11-08-unsupported-phone-block](../decisions/2026-11-08-unsupported-phone-block.md) (D01~D12)
  - [2026-11-08-fever-ammo-and-aim-source](../decisions/2026-11-08-fever-ammo-and-aim-source.md) (D01~D07, P03)

## Goal
1. 센서가 부실한 폰(자이로 없는 보급형 등)은 권한 허용 직후 센서 실측으로 판별해 "다른 폰으로 접속해 주세요" 화면으로 완전 차단하고, PC 슬롯은 비워 PC에 안내를 띄운다. 개발 모드(`import.meta.env.DEV`)에서는 판별을 건너뛴다.
2. 일반 사용자에게 보이는 센서 테스트장/센서 랩 진입 버튼 3곳을 없애고 `/sensor-test` 주소로만 들어가게 한다.
3. 센서 랩 모달의 높이가 흔들리는 문제(센서 프레임이 렌더 지표를 지움)를 고친다.
4. 폰으로 혼자 할 때 마우스가 조준경을 뺏어 가던 문제를 고친다(마우스는 마우스로 참여한 슬롯만 조종).
5. 피버가 탄창을 충전하던 버그를 고친다(피버는 총알 소모만 면제, 장전은 피버 중에도 진행). 스킬 독립은 테스트로 고정한다.
6. 조준경에서 장전은 탄창 호가 채워지는 모양으로, 피버 남은 시간은 줄어드는 호로 보여 준다.
- 측정 가능한 결과: `tsc`·`vitest`·`build` 통과 + 실기기에서 (a) 정상 폰은 통과, (b) 자이로 없는 폰은 차단 화면 + PC 슬롯 비움 + PC 안내, (c) 센서 랩 모달이 폰을 연결해도 흔들리지 않음, (d) 로비·HUD에 테스트장/랩 버튼이 없고 `/sensor-test`는 열림, (e) 폰 플레이 중 마우스를 움직여도 조준경이 폰만 따라감, (f) 피버를 켜도 탄창이 차지 않고 장전·피버 호가 각자 움직임.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | PC: 테스트장/랩 버튼 3곳 제거(랩 열기는 `/sensor-test`에만 남김) + 센서 랩 모달 흔들림 수정 | [P01](../phases/2026-11-08-unsupported-phone-block/P01-hide-lab-and-fix-flicker/phase.md) |
| P02 | `done` | 미지원 폰 차단: 센서 판별 코어 → 서버 메시지 → PC 안내 → 폰 차단 화면 | [P02](../phases/2026-11-08-unsupported-phone-block/P02-unsupported-phone-block/phase.md) |
| P03 | `in_progress` | 플레이 수정: 마우스 보조 입력 폐기, 피버·탄창 분리, 조준경 장전·피버 호 | [P03](../phases/2026-11-08-unsupported-phone-block/P03-fever-ammo-aim/phase.md) |
| P04 | `pending` | 실기기 검증(운영 빌드)과 최종 빌드 | [P04](../phases/2026-11-08-unsupported-phone-block/P04-real-device-verify/phase.md) |

## 참고
- 이 계획은 안정화 프리셋/필터(`OneEuroFilter`, `PhoneAdapter` 튜닝, 랩 모달 프리셋 UI)를 건드리지 않는다(D06, D09).
- `SensorPermission.ts`는 변경하지 않는다(D12). 판별은 권한 허용 다음 단계로 별도 추가한다.
- 실기기 검증은 개발 서버(`npm run dev`)로는 불가능하다: 개발 모드는 판별을 건너뛴다(D04). 운영 빌드(`npm run build` 후 `npm run preview`)로 확인한다.
- 두 묶음이 같은 파일(`PCGamePage.tsx`, `QRPairingModal.tsx`, `coopSlots.ts`, `SensorAndModuleTestLabOverlay.tsx`)을 건드리므로 한 계획으로 합쳤고, Task는 반드시 순서대로 하나씩 커밋한다(병렬 금지).
- P03은 PC 화면과 엔진만 바꾸고 폰 쪽 코드는 건드리지 않는다. 미지원 폰 차단(P02)과 데이터 흐름이 겹치지 않는다.
