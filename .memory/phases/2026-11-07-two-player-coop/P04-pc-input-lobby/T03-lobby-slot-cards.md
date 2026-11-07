# Task: T03 로비 슬롯 카드 UI와 PC 슬롯 상태

## Status: done

## Goal
PC 로비(`QRPairingModal`)를 1P/2P 슬롯 카드 2개로 바꾼다(D06, UI 시안 1·2). 각 슬롯에서 "📱 모바일"(그 슬롯 전용 QR) 또는 "🖱 마우스"(닉네임 입력 → 서버 등록 → 즉시 준비 완료, D15)를 고른다. PC 페이지는 단일 `pairedPlayer`/`isZeroCalibrated`/`isControllerConnected` 상태 대신 `slots`(P04-T01 `SlotPair`)를 진실의 원천으로 쓴다. 시작 버튼·안내는 `getStartGate`를 따른다(D07).

## Decision Summary
- 시안 1·2 값: 모달 폭 1120px, 제목 "🍺 BEER CRUSHER 3D", 부제 "플레이어마다 입력 방식을 선택하세요. 한 명만 연결하면 1인 플레이, 둘 다 연결하면 2인 협동입니다.", 슬롯 카드 테두리 `PLAYER_COLORS[slot]`, 상태 문구 "비어 있음" / "● 스마트폰 연결 대기 중…" / "● 준비 완료", 세그먼트 "📱 모바일 | 🖱 마우스"(다른 슬롯이 마우스면 마우스 칸 취소선·비활성), 하단 왼쪽 명예의 전당 TOP 5, 하단 오른쪽 안내 칩.
- 마우스 닉네임: localStorage `beer_crusher_mouse_nickname`에 저장, 다음 방문에 자동 채움(D15). 기기 ID는 `getOrCreateDeviceId()`(P03-T02 `src/shared/deviceIdentity.ts`).
- 로비로 돌아오면(D11 "슬롯 선택부터 다시"): 마우스 슬롯은 `input: null`로 비운다(다시 🖱를 눌러야 함, 닉네임은 자동 채움). 연결된 폰 슬롯은 그대로 남는다(폰은 실제로 연결돼 있으므로).

## Implementation

### I01. QRPairingModal 재작성

- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModalProps`, `QRPairingModal`, `SlotCard`(new, 같은 파일), `buildControllerPairingUrl`(P04-T02); modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface QRPairingModalProps {
    roomId: string;
    lanIp?: string;
    slots: SlotPair;
    startGate: StartGate;
    topRankings: RunRankingEntry[];
    /** 마우스 슬롯 닉네임 입력 기본값(저장된 값). */
    savedMouseNickname: string;
    /** 서버가 거절한 닉네임 오류 문구(INVALID_NICKNAME). 해당 슬롯 카드에 표시. */
    mouseNicknameError?: string | null;
    onChooseInput: (slot: PlayerSlot, input: SlotInput | null) => void;
    onSubmitMouseNickname: (slot: PlayerSlot, nickname: string) => void;
    onStart: () => void;
    onOpenGuide?: () => void;
    onStartTutorial?: () => void;
    onStartSandbox?: () => void;
    onRenewRoom?: () => void;
  }
  ```
  `pairedPlayer`, `isZeroCalibrated`, `onStartAsPc`, `onStartWithController` prop은 삭제한다.
- **SlotCard 본문 분기**:
  1. `input === null`: "입력 방식을 선택하세요" + 작은 글씨 "📱 모바일은 QR 스캔, 🖱 마우스는 바로 사용".
  2. `input === 'mobile'`, 페어링 전: QR(186px, `QRCode.toDataURL(buildControllerPairingUrl(origin, roomId, lanIp, slot), { width: 186, margin: 1 })` — 슬롯마다 따로 생성), "ROOM CODE: {roomId}", URL 작은 글씨. 상태 "● 스마트폰 연결 대기 중…"(앰버).
  3. `input === 'mobile'`, 페어링 후: "🔫 {nickname}님 접속 완료" + 영점 전이면 "폰에서 영점을 맞춰 주세요"(앰버), 영점 후면 "🎯 영점 완료"(초록 `#4ade80`, 상태 "● 준비 완료"). `isConnected === false`면 "● 연결 끊김"(빨강).
  4. `input === 'mouse'`, 등록 전: 닉네임 `<input maxLength={10}>`(기본값 `savedMouseNickname`) + "확인" 버튼 → `onSubmitMouseNickname(slot, value.trim())`. Enter 키도 제출. 2~10자 아니면 버튼 비활성. 오류 문구 표시.
  5. `input === 'mouse'`, 등록 후: "🖱" 큰 아이콘, "{nickname} · 마우스로 플레이", "좌클릭 발사 · 우클릭 스킬", 상태 "● 준비 완료".
  - 세그먼트 클릭: 같은 칸을 다시 누르면 `onChooseInput(slot, null)`(슬롯 비우기).
- **하단**: 왼쪽 랭킹(기존 Top5 렌더 재사용), 오른쪽 시작 영역: `startGate.canStart`면 "▶ 게임 시작 (폰은 화면 가운데를 쏘세요)" 버튼(`onStart`), 아니면 `startGate.message`를 비활성 칩으로. 기존 튜토리얼·센서 랩·가이드·방 새로 만들기 버튼은 그대로 유지.
- 모달 안 입력창이 포커스를 가진 동안 다른 키 단축키(Esc 일시정지 등)가 먹지 않게 `onKeyDown`에서 `e.stopPropagation()`.

### I02. PC 페이지 슬롯 상태

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `slots` 상태, 소켓 메시지 처리, 로비 렌더; modify

#### Details
- **Data & Schema Fields**:
  ```typescript
  const [slots, setSlots] = useState<SlotPair>(createInitialSlots);
  const slotsRef = useRef<SlotPair>(slots); // 매 렌더 slotsRef.current = slots
  const [mouseNicknameError, setMouseNicknameError] = useState<string | null>(null);
  const startGate = useMemo(() => getStartGate(slots), [slots]);
  // 호환용 파생값(다음 Task들이 슬롯별로 바꾸기 전까지 결과 화면·RANKING_UPDATED가 쓴다)
  const primarySlot = getJoinedSlots(slots)[0];
  const pairedPlayer = primarySlot?.player;
  ```
  기존 `useState` `pairedPlayer`, `isZeroCalibrated`, `isControllerConnected`(+ ref)는 삭제하고 파생값/`slotsRef`로 대체한다. `grep -n "pairedPlayer\|isZeroCalibrated\|isControllerConnected" src/pc/PCGamePage.tsx`로 모든 사용처를 확인한다. `isControllerConnectedRef.current`를 읽던 곳은 "참여한 폰 슬롯이 모두 연결" 의미로 `getJoinedSlots(slotsRef.current).every(s => s.input !== 'mobile' || s.isConnected)`.
- **Execution Flow / Logic** (소켓 `onmessage`):
  1. `CONTROLLER_PAIRED`: `setSlots(s => updateSlot(chooseSlotInput(s, msg.slot, 'mobile').slots, msg.slot, { player: msg.player, isConnected: true }))`. 그 슬롯이 이미 `mobile`이면 `chooseSlotInput`이 초기화하지 않도록(같은 입력 재선택은 그대로 — P04-T01 규칙).
  2. `ZERO_CALIBRATED`: `updateSlot(…, msg.slot, { isZeroCalibrated: true })`. 기존 `setGamePhase('ZEROING')` 전환은 유지. 영점 오프셋 처리는 T05에서 슬롯별로 바꾼다(이 Task에서는 기존 단일 `zeroOffsetRef` 그대로).
  3. `LOCAL_PLAYER_REGISTERED`: `updateSlot(…, msg.slot, { player: msg.player })`, `setMouseNicknameError(null)`, localStorage `beer_crusher_mouse_nickname` = `msg.player.nickname`(try/catch).
  4. `ERROR INVALID_NICKNAME`: `setMouseNicknameError(msg.message)`.
  5. `ERROR CONTROLLER_DISCONNECTED`: `updateSlot(…, msg.slot ?? 1, { isConnected: false })`. 기존 일시정지 호출은 그대로(T07에서 유예로 교체).
  6. `RANKING_UPDATED`: `msg.updatedPlayer.deviceId`와 같은 슬롯의 `player`를 갱신(`slots` 순회).
- 핸들러:
  - `onChooseInput(slot, input)`: `chooseSlotInput` 결과가 `rejected`면 무시. 입력이 `null`이 되거나 `mobile→mouse`로 바뀐 폰 슬롯은 서버에 알릴 메시지가 없으므로 상태만 바꾼다(폰이 계속 연결돼 있으면 다음 `CONTROLLER_PAIRED`가 와야 다시 표시됨 — 단순화를 위해 연결된 폰 슬롯은 세그먼트를 잠근다: `input === 'mobile' && player`면 "📱 모바일" 칸만 활성).
  - `onSubmitMouseNickname(slot, nickname)`: `ws.send({ type: 'REGISTER_LOCAL_PLAYER', roomId, deviceId: getOrCreateDeviceId(), nickname, slot })`.
  - `onStart`: `startGate.canStart`일 때만 기존 시작 경로 호출(이 Task에서는 기존 `startCountdownAndGame`을 그대로 부른다 — 2인 시작은 P04-T05).
  - `handleReturnToLobby`: 마우스 슬롯이 있으면 `chooseSlotInput(s, mouseSlot, null)`.
- 로비 렌더(현재 1293행 부근): 새 props로 교체. 로비 십자선 표시 조건 `(isZeroCalibrated || pairedPlayer)`는 "폰 슬롯 중 영점 완료가 하나라도 있음"으로.

### I03. 테스트

- Related Files:
  - `tests/pc-modals-and-pairing.test.ts`; modify — 삭제된 props를 쓰는 렌더 테스트는 새 props로 바꾼다
  - `tests/lobby-slot-cards.test.tsx` 또는 `.test.ts`(기존 컴포넌트 테스트가 `react-dom/server`의 `renderToStaticMarkup`을 쓰면 같은 방식); new

#### Details
- 빈 슬롯 두 개 → "비어 있음" 2회, 시작 버튼 없음, "플레이어를 연결하세요".
- 1P 마우스 등록 + 2P 모바일 대기 → 1P "준비 완료", 2P QR 영역과 URL에 `slot=2`, 2P 세그먼트의 마우스 칸 비활성 표시, 안내 칩 "2P 준비 중".
- 1P만 준비 → 시작 버튼 렌더.

## Acceptance Criteria
- [x] 로비가 슬롯 카드 2개로 보이고 슬롯마다 다른 QR이 나온다.
- [x] 마우스 슬롯에서 닉네임을 입력하면 준비 완료가 되고, 새로고침 후 닉네임이 자동으로 채워진다.
- [x] 한쪽 슬롯만 준비돼도 기존 1인 시작이 된다.

## Validation
- `npx vitest run tests/lobby-slot-cards.test.tsx tests/pc-modals-and-pairing.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: `npm run server` + `npm run dev`, PC 로비에서 1P 🖱 등록 → "준비 완료", 2P 📱 QR을 폰으로 스캔 → 닉네임 표시, 폰 영점 → "준비 완료"

## Commit Message
```text
feat(pc): 1P/2P slot cards in the lobby with mouse nickname sign-in

Plan: 2026-11-07-two-player-coop
Phase: P04-pc-input-lobby
Task: T03-lobby-slot-cards

- QRPairingModal shows two slot cards: per-slot QR for phones, nickname sign-in for the mouse
- PCGamePage keeps slots as the source of truth; start button follows the start gate
- Mouse nickname is remembered in localStorage; returning to the lobby clears the mouse slot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: completed
