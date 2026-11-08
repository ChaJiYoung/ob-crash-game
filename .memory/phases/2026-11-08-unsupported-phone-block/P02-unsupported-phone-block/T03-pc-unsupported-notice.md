# Task: T03 PC 미지원 폰 안내

## Status: pending

## Goal
PC가 `CONTROLLER_UNSUPPORTED`를 받으면, 로비에서는 해당 슬롯을 "빈 슬롯"으로 되돌리고 QR 모달에 "지원하지 않는 기기" 안내 칩을 몇 초간 보여 준다.

## Decision Summary
- D03: 슬롯이 "대기 중"으로 돌아가고 PC에 "다른 폰으로 접속해 주세요" 안내가 뜬다.
- 서버는 곧바로 `CONTROLLER_DISCONNECTED`도 보낸다(P02-T02). 그 처리(`PCGamePage.tsx` 약 717행)는 슬롯에 `isConnected: false`를 넣고 판 도중이면 유예·일시정지를 시작한다. 따라서 이 Task의 처리는 **로비(PAIRING/ZEROING)에서만** 하고, 그 외 단계에서는 UNSUPPORTED를 무시해 기존 끊김 처리에 맡긴다.
- 기존 `startNotice`(시작 버튼 자리에 2초간 노란 칩)는 "시작할 수 없음" 용도라 재사용하지 않고, 별도 상태 `unsupportedNotice`를 만든다.

## Implementation

### I01. 슬롯 비우기 순수 함수
- Related Files:
  - `src/pc/coopSlots.ts` :: `applyControllerUnsupported` — new export; modify

#### Details
- **Signatures & Types**:
  ```typescript
  /** CONTROLLER_UNSUPPORTED 반영(로비 전용): 그 슬롯의 입력·프로필·영점 상태를 비운다. */
  export function applyControllerUnsupported(slots: SlotPair, slot: PlayerSlot): SlotPair {
    return chooseSlotInput(slots, slot, null).slots;
  }
  ```
- **Execution Flow / Logic**: `chooseSlotInput(slots, slot, null)`은 입력이 이미 `null`이면 `slots`를 그대로 돌려주고, 아니면 `input: null, player: undefined, isZeroCalibrated: false`로 초기화한다(`coopSlots.ts` 30~55행). `isConnected`와 `isAway`는 건드리지 않는다. 뒤따르는 `CONTROLLER_DISCONNECTED` 처리가 `isConnected`를 맞춘다. 마우스가 선택된 다른 슬롯은 영향받지 않는다.
- 함정: 슬롯만 비우고 입력(`input`)을 `'mobile'`로 남기면 로비가 "폰 대기 중" 카드에 머물러 QR 안내가 사라진다. `input: null`로 완전히 비워야 처음 상태(입력 선택 화면)로 돌아간다.

### I02. PC 수신 처리와 안내 상태
- Related Files:
  - `src/pc/PCGamePage.tsx` :: 서버 메시지 `switch (msg.type)`에 `case 'CONTROLLER_UNSUPPORTED'`; 상태 `unsupportedNotice`/타이머 ref; `<QRPairingModal unsupportedNotice={...} />`; modify
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModalProps.unsupportedNotice?: string | null`, 안내 칩 렌더; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // QRPairingModalProps
  unsupportedNotice?: string | null;
  ```
- **Execution Flow / Logic** (`PCGamePage.tsx`):
  1. `const [unsupportedNotice, setUnsupportedNotice] = useState<string | null>(null);`와 `const unsupportedNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);`를 `startNotice` 근처(약 101행)에 추가한다.
  2. 메시지 처리: `case 'CONTROLLER_UNSUPPORTED':`에서 `const inLobby = gamePhaseRef.current === 'PAIRING' || gamePhaseRef.current === 'ZEROING';` (`CONTROLLER_PAIRED` 케이스와 같은 판정). `inLobby`가 아니면 `break`(아무것도 안 함).
  3. 로비면 `setSlots((prev) => applyControllerUnsupported(prev, msg.slot));` 후 `setUnsupportedNotice(`${msg.slot}P에 연결한 폰은 센서가 지원되지 않아요. 다른 폰으로 접속해 주세요`)`; 기존 타이머가 있으면 `clearTimeout` 하고 `unsupportedNoticeTimerRef.current = setTimeout(() => setUnsupportedNotice(null), 6000)`.
  4. 언마운트 시 타이머를 정리하는 effect cleanup을 추가한다(`useEffect(() => () => { if (ref.current) clearTimeout(ref.current); }, [])`).
  5. 함정: 이 처리를 `CONTROLLER_PAIRED`처럼 `slotsRef`/`gamePhaseRef` 최신값을 읽는 ref로 해야 한다. 소켓 핸들러 클로저 안의 `gamePhase` state를 직접 쓰면 오래된 값을 읽는다.
  6. 함정: 슬롯이 비워진 뒤 `ZEROING` 단계에서 모든 슬롯이 비어도 단계가 `PAIRING`으로 돌아가는 로직은 없다. 이 경로는 폰이 `ZERO_CALIBRATED`를 보내기 전(판별은 영점 자동 전송보다 앞선다, T04)에만 일어나므로 보통 `PAIRING`이다. `ZEROING`에서 일어나는 경우(다른 슬롯이 이미 영점 완료)는 다른 슬롯 때문에 단계가 유지되는 것이 맞다.
- **Execution Flow / Logic** (`QRPairingModal.tsx`): 시작 버튼/대기 칩 행(`{startNotice ? ... }`, 약 535행) **위**에 `{unsupportedNotice && (<div data-testid="unsupported-notice-chip" role="alert" style={...}><span>📵</span><span>{unsupportedNotice}</span></div>)}`를 둔다. 색은 오류 계열(빨강: `border: '2px solid #ef4444'`, 배경 `rgba(239, 68, 68, 0.15)`, 글자 `#fca5a5`), 레이아웃은 `startNotice` 칩과 같은 크기·여백으로 해 모달 높이 변화를 최소화한다. 칩이 없을 때 자리를 차지하지 않는다.

### I03. 테스트
- Related Files:
  - `tests/coop-slots.test.ts` :: `applyControllerUnsupported` 케이스; modify
  - `tests/pc-modals-and-pairing.test.ts` :: 안내 칩 렌더; modify

#### Details
- `applyControllerUnsupported`: (1) 1P가 `mobile` + player + `isZeroCalibrated: true`일 때 → 1P가 `input: null`, `player: undefined`, `isZeroCalibrated: false`; 2P는 그대로 (2) 이미 `input: null`인 슬롯이면 같은 배열 참조를 돌려준다 (3) 2P가 `mouse`로 참여 중이어도 1P를 비운 뒤 2P는 변하지 않는다.
- `QRPairingModal`: `unsupportedNotice="1P에 연결한 폰은 ..."`을 주면 마크업에 `data-testid="unsupported-notice-chip"`과 해당 문구가 있고, 안 주면(`null`/생략) 없다.

## Acceptance Criteria
- [ ] 로비에서 `CONTROLLER_UNSUPPORTED`를 받으면 해당 슬롯이 입력 선택 전 상태로 돌아간다.
- [ ] 안내 칩이 6초 뒤 사라지고, 연달아 받으면 타이머가 새로 시작한다.
- [ ] 인게임(PLAYING) 중에 받으면 슬롯을 임의로 비우지 않고 기존 끊김 처리에 맡긴다.

## Validation
- `npx vitest run tests/coop-slots.test.ts tests/pc-modals-and-pairing.test.ts tests/lobby-slot-cards.test.tsx` — 통과
- `npx vitest run` — 전체 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(pc): 미지원 폰이 나가면 로비 슬롯을 비우고 안내 표시

Plan: 2026-11-08-unsupported-phone-block
Phase: P02-unsupported-phone-block
Task: T03-pc-unsupported-notice

- I01: applyControllerUnsupported로 슬롯을 입력 선택 전 상태로 복구
- I02: CONTROLLER_UNSUPPORTED 수신 처리(로비 전용)와 QR 모달 안내 칩
- I03: 슬롯 함수·안내 칩 테스트
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
