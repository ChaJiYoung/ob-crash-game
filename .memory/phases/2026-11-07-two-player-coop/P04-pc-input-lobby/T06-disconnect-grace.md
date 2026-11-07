# Task: T06 끊김 유예 30초와 이탈·복귀

## Status: done

## Goal
2인 판 도중 한 사람의 폰이 끊기면 전체를 일시정지하고 "2P 재접속 대기 중 · 27초"를 보여 준다(D08). 30초 안에 다시 연결되면 3초 카운트다운 뒤 그대로 이어서 한다. 30초가 지나면(또는 PC에서 "혼자 계속하기"를 누르면) 그 플레이어를 이탈 처리(`engine.setPlayerAway`)하고 남은 사람이 계속한다. 이탈자의 패널은 남고 십자선만 사라지며(D20, 화면 표시는 P05-T01·P04-T02), 이탈자가 나중에 다시 연결되면 영점 조정 없이 바로 복귀한다(D20). 1인 판의 기존 "폰 재연결 중" 일시정지는 그대로다.

## Decision Summary
- 1인·2인 같은 로직이고 값만 다르다(D24): 유예 시간은 `engine.rules.disconnectGraceMs`(1인 행 null, 2인 행 30000, P02-T02). null이면 이탈 처리 없이 무기한 기다린다 — 지금 1인 동작이 이 규칙의 null 경우다. 유예는 실제 시간이다(일시정지 중에도 흐름).
- 두 사람 모두 활동 불가(남은 활성 플레이어 0명)면 이탈 처리 후에도 일시정지를 유지하고 기존 `CONTROLLER_LOST` 대기 화면으로 바꾼다(누군가 돌아올 때까지).
- 마우스 플레이어는 끊김이 없다(D08).

## Implementation

### I01. 일시정지 사유와 메뉴

- Related Files:
  - `src/pc/pauseFlow.ts` :: `PauseReason`; modify
  - `src/pc/components/PauseMenuOverlay.tsx` :: `PauseMenuOverlayProps`, `PauseMenuOverlay`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export type PauseReason = 'USER' | 'CONTROLLER_LOST' | 'PLAYER_LOST';

  interface PauseMenuOverlayProps {
    /* 기존 */
    /** PLAYER_LOST일 때 끊긴 슬롯과 남은 초(올림). */
    lostSlot?: PlayerSlot;
    graceRemainingSec?: number;
    /** PLAYER_LOST일 때 "혼자 계속하기". */
    onContinueAlone?: () => void;
  }
  ```
- 문구(PLAYER_LOST): 제목 `📡 {lostSlot}P 재접속 대기 중 · {graceRemainingSec}초`, 설명 `{lostSlot}P 폰 화면을 켜 주세요. 시간이 지나면 {lostSlot}P는 '나감' 처리되고 남은 사람이 계속합니다.`, 버튼 "혼자 계속하기"(`onContinueAlone`), "재개"는 비활성, "다시 시작"·"로비로"는 기존대로.

### I02. 유예 상태 머신

- Related Files:
  - `src/pc/coopDisconnect.ts` :: `GraceState`, `startGrace`, `tickGrace`, `resolveReconnect`; new
  - `src/pc/PCGamePage.tsx` :: `case 'ERROR'`(CONTROLLER_DISCONNECTED), `case 'CONTROLLER_PAIRED'`, `case 'ZERO_CALIBRATED'`(resume), 250ms 유예 타이머 effect; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface GraceState { slot: PlayerSlot; playerIndex: PlayerIndex; deadlineMs: number; }
  export function startGrace(slot: PlayerSlot, playerIndex: PlayerIndex, nowMs: number, graceMs: number): GraceState;
  /** 남은 초(올림, 0 이상)와 만료 여부. */
  export function tickGrace(g: GraceState, nowMs: number): { remainingSec: number; expired: boolean };
  ```
  PC 페이지: `const [grace, setGrace] = useState<GraceState | null>(null); const graceRef = useRef(grace);`
- **Execution Flow / Logic**:
  1. `CONTROLLER_DISCONNECTED(slot)`: 슬롯 `isConnected = false`(P04-T03). 판 중(`PLAYING`)이고 `engine.rules.disconnectGraceMs !== null`이고 `index = slotIndexMapRef[slot]`가 있고 `!engine.getPlayer(index).isAway`면: 그 슬롯 타이머 정리, `setGrace(startGrace(slot, index, performance.now(), engine.rules.disconnectGraceMs))`, 일시정지 메뉴를 `PLAYER_LOST`로 연다(이미 열려 있으면 사유만 교체). `disconnectGraceMs`가 null이면 기존 `CONTROLLER_LOST` 흐름(무기한 대기) 그대로.
  2. 유예가 진행 중인데 다른 슬롯도 끊기면(폰 두 대 모두 끊김): 진행 중 유예를 취소(`setGrace(null)`)하고 메뉴 사유를 기존 `CONTROLLER_LOST`(무기한 대기, 수동 재개)로 바꾼다. 이탈 처리는 하지 않는다. 어느 폰이든 돌아오면 기존 규칙대로 "다시 연결됨" 표시 후 재개할 수 있고, 돌아오지 않은 쪽은 재개 직후 다시 1번 규칙(새 30초 유예)을 탄다 — 재개 시 `isConnected === false`인 맵 슬롯이 있으면 1번을 다시 실행.
  3. 250ms 타이머(effect, `grace`가 있을 때만): `tickGrace` → 남은 초 갱신, `expired`면 `expireGrace()`.
  4. `expireGrace()` / "혼자 계속하기": `engine.setPlayerAway(grace.playerIndex, true, performance.now())`, 슬롯 `isAway = true`, `setGrace(null)`. 활성 플레이어(`engine.getActivePlayers().length`)가 1 이상이면 메뉴 닫고 `startResumeCountdown()`. 0이면 메뉴 사유를 `CONTROLLER_LOST`로.
  5. 재연결(`CONTROLLER_PAIRED(slot)` 또는 `ZERO_CALIBRATED{resume:true, slot}`) 처리:
     - 유예 중인 그 슬롯이면 `setGrace(null)`, 메뉴 닫고 `startResumeCountdown()`.
     - 이미 이탈 처리된 슬롯이면 `engine.setPlayerAway(index, false, now)`, 슬롯 `isAway = false`. 판은 멈추지 않는다(바로 복귀). 일시정지 사유가 `CONTROLLER_LOST`(전원 이탈)였다면 기존처럼 "다시 연결됨" 표시 후 수동 재개.
     - 영점 오프셋은 건드리지 않는다(`resume`이 아닌 `ZERO_CALIBRATED`는 폰이 영점 화면부터 다시 한 경우라 P04-T04 규칙대로 그 슬롯 오프셋만 0).
  6. `handleResumeFromPause`: 사유가 `PLAYER_LOST`면 무시(유예 중 수동 재개 불가).
  7. 판이 끝나거나 로비로 가면 `setGrace(null)`.

### I03. 테스트

- Related Files:
  - `tests/coop-disconnect.test.ts`; new
  - `tests/pause-menu.test.ts`; modify — `PLAYER_LOST` 렌더 케이스 추가

#### Details
- `startGrace(2, 1, 1000, 30000)` → `tickGrace(g, 1000)` = `{ remainingSec: 30, expired: false }`, `(g, 30999)` = 1/false, `(g, 31000)` = 0/true.
- 엔진 통합: 2인 판에서 `setPlayerAway(1, true)` 후 `getActivePlayers().length === 1`, 복귀 후 2.
- `PauseMenuOverlay` `reason='PLAYER_LOST' lostSlot={2} graceRemainingSec={27}` → "2P 재접속 대기 중 · 27초", "혼자 계속하기" 버튼.

## Acceptance Criteria
- [x] 2인 판에서 폰 하나를 끄면 일시정지 + 30초 카운트다운, 30초 안에 켜면 이어서 플레이.
- [x] 30초가 지나면 남은 사람이 계속 플레이하고, 끈 폰을 다시 켜면 영점 없이 바로 복귀.
- [x] 1인 판 끊김 동작은 기존과 같다(`tests/pause-menu.test.ts`, `tests/controller-reconnect.test.ts` 통과).

## Validation
- `npx vitest run tests/coop-disconnect.test.ts tests/pause-menu.test.ts tests/controller-reconnect.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: 폰 2대 2인 판에서 2P 폰 화면 끄기 → 대기 화면 카운트다운 → 10초 뒤 켜기 → 3초 뒤 재개. 다시 끄고 30초 대기 → 1P 혼자 진행 → 2P 폰 켜기 → 2P 십자선 복귀.

## Commit Message
```text
feat(pc): 30s reconnect grace and away players in coop runs

Plan: 2026-11-07-two-player-coop
Phase: P04-pc-input-lobby
Task: T06-disconnect-grace

- A phone drop in a coop run pauses with a "2P 재접속 대기 중" countdown
- After 30s (or "혼자 계속하기") the player is marked away and the other keeps playing
- An away phone that reconnects rejoins at once with its zero offset kept

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
