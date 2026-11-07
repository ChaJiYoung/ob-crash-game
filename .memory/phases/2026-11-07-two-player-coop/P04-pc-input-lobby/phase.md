# Phase: P04 PC 로비·연결

PC 화면이 1P/2P 슬롯을 관리하고(로비 슬롯 카드, 마우스 닉네임), 폰 두 대·마우스를 각 플레이어 처리부에 묶으며, 시작·다시 시작·로비 복귀·끊김 유예를 처리한다. 끝나면 두 사람이 2인팟 한 판을 끝까지 할 수 있다(화면은 P05에서 다듬음). 시안: [two-player-coop-mockups.md](../../../references/two-player-coop-mockups.md).

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `pending` | 슬롯 상태 순수 모델 `coopSlots.ts`(입력 선택·준비 판정·시작 게이트) | [T01](./T01-coop-slot-model.md) |
| T02 | `pending` | 폰 컨트롤러 슬롯: QR `?slot=`, 모든 메시지에 slot, 자리 있음 안내 | [T02](./T02-controller-slot.md) |
| T03 | `pending` | 로비 슬롯 카드 UI(QR / 마우스+닉네임)와 PC 슬롯 상태 | [T03](./T03-lobby-slot-cards.md) |
| T04 | `pending` | 슬롯별 폰 어댑터·마우스 어댑터를 플레이어 처리부에 묶기, 플레이어 수만큼 십자선 | [T04](./T04-per-slot-input.md) |
| T05 | `pending` | 시작 게이트·같은 구성 재시작·로비 복귀·점수 제출(같은 반복문)·튜토리얼 1P 고정 | [T05](./T05-start-and-result-flow.md) |
| T06 | `pending` | 끊김 유예(규칙 표 값), 이탈 처리, 복귀 | [T06](./T06-disconnect-grace.md) |

## Progress
- done: 0/6 (active: -)
