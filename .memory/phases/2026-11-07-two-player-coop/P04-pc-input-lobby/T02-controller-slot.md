# Task: T02 폰 컨트롤러 슬롯

## Status: pending

## Goal
폰이 QR 주소의 `slot`(1 또는 2)을 읽어 저장하고, 서버로 보내는 모든 메시지에 실어 보낸다. 다른 폰이 이미 그 슬롯을 쓰고 있으면(`ERROR SLOT_OCCUPIED`) 폰 화면에 "이미 다른 폰이 2P로 연결돼 있습니다" 안내를 띄운다. 폰 화면 상단에 "1P"/"2P" 배지를 보여 자기 자리를 알 수 있게 한다(D06).

## Decision Summary
- QR URL: `/controller?room=ABCD&slot=2`. `slot`이 없거나 2가 아니면 1(옛 QR 호환).
- 폰은 방 코드와 함께 슬롯도 기억해, QR 없이 다시 열어도 같은 슬롯으로 붙는다.

## Implementation

### I01. 페어링 URL

- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: `buildControllerPairingUrl`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export function buildControllerPairingUrl(origin: string, roomId: string, lanIp?: string, slot: PlayerSlot = 1): string;
  // 결과: `${cleanOrigin}/controller?room=${encodeURIComponent(roomId)}&slot=${slot}`
  ```
  - 기존 테스트(`tests/pc-modals-and-pairing.test.ts`)가 `?room=XXXX`로 끝나는 문자열을 정확히 비교하면 그 기대값을 `&slot=1` 포함으로 고친다(동작 변경에 따른 기대값 수정).

### I02. 컨트롤러 페이지

- Related Files:
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — slot 상태, 메시지 전송부 전부; modify
  - `src/controller/MobileControllerPage.tsx` 또는 그 room 저장 헬퍼(`saveControllerRoomId`/`loadSavedControllerRoomId` 정의 위치를 `grep -rn "saveControllerRoomId" src`로 확인) :: `saveControllerSlot`, `loadSavedControllerSlot`; modify

#### Details
- **Execution Flow / Logic**:
  1. URL 파싱 effect(현재 72행 부근): `const slotParam = params.get('slot'); const slot: PlayerSlot = slotParam === '2' ? 2 : 1;` room이 URL에 있으면 slot도 저장(localStorage 키 `beer_crusher_controller_slot`, try/catch). room을 저장본에서 복원할 때는 slot도 저장본에서.
  2. `const [slot, setSlot] = useState<PlayerSlot>(1)`와 `slotRef`(소켓 effect 의존성에 넣지 말고 ref로 읽어 재연결 루프가 생기지 않게).
  3. 보내는 메시지 전부에 `slot: slotRef.current`: `DEVICE_CHECK`, `REGISTER_NICKNAME`, `CALIBRATE_ZERO`(재접속 resume 포함), `START_GAME_REQUEST`, `SENSOR_FRAME`. `grep -n "type: '" src/controller/MobileControllerPage.tsx src/controller/components/*.tsx`로 전송부를 모두 찾는다.
  4. `ERROR` 처리: `msg.code === 'SLOT_OCCUPIED'`면 `setSlotError(\`이미 다른 폰이 ${slot}P로 연결돼 있습니다. PC 화면의 다른 슬롯 QR을 찍어 주세요.\`)` 하고 **재연결 루프를 돌리지 않는다**(소켓을 닫되 `disposed`처럼 재시도 막기: `blockedRef.current = true` 후 onclose에서 확인).
  5. 화면: 기존 상단 영역에 `{slot}P` 배지(`PLAYER_COLORS[slot]`). `slotError`가 있으면 전체 화면 안내 카드.

### I03. 플레이어 색 상수(이후 Task 공용)

- Related Files:
  - `src/shared/constants.ts` :: `PLAYER_COLORS`, `SOLO_PLAYER_COLOR`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** 2인팟 플레이어 색(D09, UI 시안 값). 1인 판은 SOLO_PLAYER_COLOR(지금의 앰버)를 쓴다. */
  export const PLAYER_COLORS: Record<PlayerSlot, string> = { 1: '#38bdf8', 2: '#ff6b3d' };
  export const SOLO_PLAYER_COLOR = '#f59e0b';
  ```
  - 2P 색은 결정 문서의 "주황"을 시안에서 앰버 UI와 구분되게 붉은 주황으로 그린 값이다.

### I04. 테스트

- Related Files:
  - `tests/controller-ui-and-routing.test.ts` 또는 새 `tests/controller-slot.test.ts`; new

#### Details
- `buildControllerPairingUrl('https://x', 'AB12', undefined, 2)` → `https://x/controller?room=AB12&slot=2`.
- slot 파싱 헬퍼를 `parseControllerSlot(search: string): PlayerSlot`로 export해 단위 테스트: `'?room=A&slot=2'` → 2, `'?room=A'` → 1, `'?slot=3'` → 1.

## Acceptance Criteria
- [ ] 2P QR로 들어온 폰의 센서가 PC에 `slot: 2`로 도착한다(P03-T01 서버와 함께).
- [ ] 옛 QR(슬롯 없음)은 1P로 동작.

## Validation
- `npx vitest run tests/controller-slot.test.ts tests/pc-modals-and-pairing.test.ts tests/controller-reconnect.test.ts` — 통과
- `npm test && npx tsc --noEmit` — 전체 통과

## Commit Message
```text
feat(controller): phones join a lobby slot from the QR link

Plan: 2026-11-07-two-player-coop
Phase: P04-pc-input-lobby
Task: T02-controller-slot

- Pairing URLs carry &slot=; the phone remembers its slot with the room
- Every controller message sends the slot; SLOT_OCCUPIED shows a notice and stops retrying
- 1P/2P badge on the phone screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
