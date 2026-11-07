# Task: T05 입력 어댑터와 플레이어 동작 처리부

## Status: pending

## Goal
입력을 두 층으로 나눈다(D25).
- **장치 어댑터**(폰·마우스 각각): 장치 특성만 해석해 신호 다섯 가지를 낸다 — `aim(x, y)`, `fireDown`, `fireUp`, `skill`, `fever`.
- **플레이어 동작 처리부**(플레이어마다 하나, 코드는 하나): 신호를 받아 실제 동작을 한다. 단발·연사·피버 자동 연사·스킬·피버 발동, 게임 밖 화면에서 폰 사격으로 버튼 누르기(D26), 그리고 모든 허용 조건.
- **화면 버튼 실행 함수** `pressScreenButton`(하나): 로비 "게임 시작", 결과 "다시 시작/로비로". 마우스는 HTML 클릭으로, 폰은 처리부의 버튼 사격으로 이 함수에 온다.

이 Task는 1인 리팩터다(처리부 1개). 2인(P04-T04)은 처리부를 2개 만들고 어댑터를 묶기만 한다.

지금 갈라진 곳(계획 시점 확인):
| 동작 | 마우스 | 폰 |
| :--- | :--- | :--- |
| 단발 | `GameCanvas3D.tsx` 473행 `executeShot('press')` | `PCGamePage.tsx` 457행 |
| 연사 | 캔버스 478행 5ms 인터벌 | 페이지 465행 5ms 인터벌 |
| 피버 | 캔버스 462행 + 튜토리얼 처리 | 페이지 481행 + 같은 튜토리얼 처리 |
| 스킬 | 페이지 241행(일시정지만 확인) | 페이지 489~494행(단계·카드·유예 확인) |
| 피버 자동 연사 | 페이지 567행 | 같음 |
| 로비 시작 | HTML 버튼 클릭 | 화면 가운데 ±0.65 사격 |
| 결과 버튼 | HTML 버튼 클릭 | 조준점 hover 판정 |
| 폰 알림 | — | 페이지 HUD 틱에서 직접 전송 |

## Decision Summary
- D25: fireDown은 **항상 새로 누른 한 발**(판정 피해 100%, 카드 선택 가능) + fireUp까지 무기 간격대로 연사. 폰 홀드도 시작 순간 한 발이 추가된다(의도된 변화). 스킬 허용 조건은 장치 공통(게임 단계, 일시정지 메뉴, 선택 라운드, 판 시작 1.5초 유예) — 마우스 우클릭도 같은 조건.
- D26: 클릭은 클릭, 사격은 사격. 세 버튼의 실행은 `pressScreenButton` 하나. 마우스는 HTML `onClick`이 그 함수를 부르고(플레이어에 묶이지 않음), 마우스 어댑터는 게임 화면(3D 캔버스 컨테이너)의 마우스 이벤트에만 붙는다 — 버튼·모달 위 클릭은 캔버스에 닿지 않으므로 단계 검사가 필요 없다. 폰은 게임 밖 화면에서 fireDown → 처리부가 조준점 아래 버튼을 찾아 같은 함수를 부른다. 로비에서 폰은 지금처럼 가운데(|x|, |y| < 0.65)를 쏘면 `pressScreenButton('start')`가 된다(D33).
- D27: 처리부는 이 플레이어가 무기·카드를 고른 뒤 0.3초 동안 스킬 신호를 무시한다(폰 처리 코드의 `cardPendingBeforeShot`을 대체).
- D28: 처리부는 상태만 내보내고, 폰 알림(`FEVER_STATUS_SYNC`, `SKILL_STATE_SYNC`, 변경 시·150ms 제한)은 폰 어댑터가 한다.
- D29: 샌드박스 "테스트 사격"은 처리부 0에 fireDown/fireUp. 다른 개발 버튼은 엔진 직접.
- 튜토리얼 피버 적 배치는 P01-T03의 `TutorialDirector`가 `feverStarted` 사건으로 하므로 처리부·어댑터에는 튜토리얼 코드가 없다.

## Implementation

### I01. 신호 타입

- Related Files:
  - `src/pc/input/inputSignals.ts` :: `InputSignal`, `InputSink`; new

#### Details
- **Signatures & Types**:
  ```typescript
  export type InputSignal =
    | { type: 'aim'; aimX: number; aimY: number }
    | { type: 'fireDown' }
    | { type: 'fireUp' }
    | { type: 'skill' }
    | { type: 'fever' };
  /** 어댑터가 신호를 보내는 곳(처리부). */
  export interface InputSink { send(signal: InputSignal): void; }
  ```

### I02. 처리부

- Related Files:
  - `src/pc/input/PlayerActionProcessor.ts` :: `PlayerActionProcessor`, `ProcessorContext`, `ShootableButton`; new

#### Details
- **Signatures & Types**:
  ```typescript
  export type ShootableButton = 'start' | 'restart' | 'lobby';
  export interface ProcessorContext {
    engine: BeerCrusherEngine;
    playerIndex: PlayerIndex;
    getPhase: () => GamePhase;
    isPauseMenuOpen: () => boolean;
    /** 판 시작 직후 스킬 금지 끝 시각. */
    getSkillGraceUntilMs: () => number;
    /** 조준점(−1~1) 아래 쏠 수 있는 버튼. 화면이 DOM 사각형으로 판정해 돌려준다(없으면 null). */
    hitTestButton: (aimX: number, aimY: number) => ShootableButton | null;
    /** = pressScreenButton. HTML onClick도 같은 함수를 부른다. */
    onButton: (button: ShootableButton) => void;
    onShot: (result: EngineShootResult) => void;     // 소리·연출·판정 배너
    onSkill: (result: SkillExecuteResult) => void;
    onFeverStarted: (playerIndex: PlayerIndex) => void;
    onAim: (aimX: number, aimY: number, playerIndex: PlayerIndex) => void; // 십자선·총 조준 표시
    now?: () => number;
    timers?: { setInterval: typeof setInterval; clearInterval: typeof clearInterval };
  }
  export interface PlayerActionState {
    isFeverReady: boolean; isFeverActive: boolean;
    weaponKind: WeaponKind; weaponLevel: WeaponLevel;
    skillStock: number; maxSkillStock: number;
    skillCooldownRemainingMs: number; skillCooldownTotalMs: number;
  }
  export class PlayerActionProcessor implements InputSink {
    public readonly aim = { aimX: 0, aimY: 0 };
    constructor(ctx: ProcessorContext);
    public send(signal: InputSignal): void;
    /** HUD 틱(100ms)마다: 피버 자동 연사 시작/정지. */
    public tick(): void;
    /** 이 플레이어 상태(D28). 어댑터가 읽어 장치에 알린다. */
    public getState(): PlayerActionState;
    /** 판 종료·로비 복귀·일시정지·이탈 때 모든 인터벌 정리. */
    public stopAll(): void;
  }
  ```
- **Execution Flow / Logic** (`send`):
  1. `aim`: `this.aim` 갱신 → `ctx.onAim`.
  2. `fireDown`:
     - 단계가 `PAIRING`/`ZEROING`/`GAMEOVER`/`VICTORY`면: `b = ctx.hitTestButton(aim)`; 있으면 `ctx.onButton(b)`. 없고 단계가 `PAIRING`/`ZEROING`이며 `|aimX| < 0.65 && |aimY| < 0.65`면 `ctx.onButton('start')`(D33, 지금 폰 로비 시작 규칙 그대로; 처리부의 상수 `LOBBY_START_ZONE = 0.65`). 그 외는 빗나감 소리만(지금 폰 결과 화면 동작). 연사 없음. (로비·결과 화면은 모달이 캔버스를 덮어 마우스 클릭이 캔버스에 닿지 않으므로, 이 경로로 오는 것은 사실상 폰이다.)
     - 게임 단계(`PLAYING`/`TUTORIAL`/`SANDBOX`)이고 일시정지 메뉴가 아니면: `r = engine.shootAt(aim, now, 'press', idx)` → `onShot(r)`. `r.selectedWeapon || r.selectedCard`면 `skillLockUntilMs = now + 300`(D27). 그다음 5ms 인터벌로 `shootAt(aim, now, 'hold', idx)`, `fired`면 `onShot`. 인터벌은 하나만.
  3. `fireUp`: 연사 인터벌 정지.
  4. `skill`: 일시정지 메뉴, 단계 ∉ {PLAYING, TUTORIAL}, `engine.isCardSelectPending`, `now < skillGraceUntil`, `now < skillLockUntilMs` 중 하나라도면 무시. 아니면 `engine.triggerWeaponSkill(now, idx)` → `activated`면 `onSkill`.
  5. `fever`: 일시정지 메뉴면 무시. `engine.activateFever(now, idx)` 성공 → `onFeverStarted`.
  - `tick()`: 이 플레이어 피버 활성 && `!engine.isPaused` && `!engine.isCardSelectPending` && 단계 ∈ {PLAYING, SANDBOX, TUTORIAL}면 16ms 인터벌로 `shootAt(aim, now, 'fever', idx)` → `onShot`, 아니면 정지(지금 HUD 틱 규칙).
  - 엔진 호출의 `playerIndex` 인자는 P02-T01에서 생긴다. 이 Task 시점에는 인자 없이 호출하고 P02-T01이 `idx`를 넘기도록 바꾼다(P02-T01 체크리스트에 포함).

### I03. 어댑터

- Related Files:
  - `src/pc/input/MouseAdapter.ts` :: `MouseAdapter`; new
  - `src/pc/input/PhoneAdapter.ts` :: `PhoneAdapter`, `applyZeroAndTuning`; new
  - `src/pc/components/GameCanvas3D.tsx` :: 마우스 핸들러(426~499행); modify

#### Details
- **MouseAdapter**:
  ```typescript
  export class MouseAdapter {
    constructor(sink: () => InputSink | null, windowMs = WEAPON_CONSTANTS.FEVER_DOUBLE_TAP_MS);
    public onMove(aimX: number, aimY: number): void;   // aim
    /** 캔버스 위 왼쪽 누름 → fireDown(+ detectDoubleClick이면 fever). 버튼·모달 클릭은 캔버스에 오지 않아 여기 도달하지 않는다(D26). */
    public onLeftDown(): void;
    public onLeftUp(): void;                           // fireUp (mouseup·mouseleave·window blur)
    public onRightClick(): void;                       // skill
  }
  ```
  `sink()`가 null이면(마우스가 어느 플레이어에도 묶이지 않음, P04-T04) 무시. 알림 출력 없음(D28).
- **PhoneAdapter**:
  ```typescript
  export class PhoneAdapter {
    constructor(opts: { sink: () => InputSink | null; send: (msg: ClientToServerMessage) => void; roomId: () => string; getTuning: () => SensorTuningConfig });
    public zeroOffset = { offsetX: 0, offsetY: 0 };
    public latestAim = { aimX: 0, aimY: 0 };
    /** SENSOR_RELAY payload 해석: 영점·감도 → aim, snapFire → fireDown+fireUp, rapidFireHold 상승 → fireDown / 하강 → fireUp, feverTriggered → fever, skillSnapTriggered → skill. 진단용 원시값을 돌려준다. */
    public onSensorFrame(p: SensorFramePayload): { aimX: number; aimY: number; rawAimX: number; rawAimY: number; isAimLocked: boolean; cockedJustNow: boolean };
    public resetZero(): void;            // ZERO_CALIBRATED(resume 아님)
    public autoZeroFromLatest(): void;   // 카운트다운 끝: zeroOffset = latestAim (지금 식 그대로)
    /** HUD 틱마다: 처리부 상태로 FEVER_STATUS_SYNC(변경 시)·SKILL_STATE_SYNC(스톡 변경 또는 150ms) 전송(D28). 슬롯 필드는 P03에서 추가. */
    public syncFeedback(state: PlayerActionState): void;
  }
  export function applyZeroAndTuning(payload, zero, tuning): { aimX; aimY; rawAimX; rawAimY }; // 지금 SENSOR_RELAY 계산 그대로
  ```
  - 한 패킷 안 신호 순서: aim → (snapFire면 fireDown, fireUp) → (홀드 변화) → fever → skill. 카드 고른 패킷의 스킬은 처리부의 0.3초 잠금이 막는다.
  - 코킹 소리·조준 고정 표시·진단 수치는 반환값으로 페이지가 처리(장치 표시라 처리부와 무관).
- **GameCanvas3D**: `executeShot`, `mouseHoldInterval`, `tryActivateFever`, `lastClickMs`, `engine.shootAt`, `engine.activateFever` 삭제. props `onMouseAim`, `onMouseDown`, `onMouseUp` 추가(기존 `onAimChange`, `onShoot` 삭제). 총 조준 갱신(`targetAimRef`)은 그대로.

### I04. 페이지 연결

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `SENSOR_RELAY`, HUD 틱, `contextmenu`, `handleShootEvent`, 결과·로비 버튼, 타이머 정리부, 샌드박스 테스트 사격; modify
  - `src/pc/components/QRPairingModal.tsx`, `src/pc/components/ResultRankingModal.tsx` :: 세 버튼에 `data-shootable="start|restart|lobby"` 속성 추가, `onClick`은 유지하되 `pressScreenButton`을 부르게; modify

#### Details
- `processorsRef = useRef<PlayerActionProcessor[]>([])`, `phoneAdapterRef`, `mouseAdapterRef`. 엔진 플레이어 수가 정해질 때(`handleStartGame`, 튜토리얼·샌드박스 시작, 로비 진입) `syncProcessors()`가 `engine.players.length`만큼 맞춘다(이 Task에선 1개). 로비에서도 처리부 1개가 있어야 버튼 사격이 된다.
- `hitTestButton`: `document.querySelectorAll('[data-shootable]')`의 사각형과 조준점의 화면 좌표(`((aimX + 1) / 2) * innerWidth`, `((1 - aimY) / 2) * innerHeight`)로 판정(지금 `checkResultButtonHover` 방식). 결과 화면 hover 강조도 이 함수로.
- `pressScreenButton(button)`: `'start'` → 지금 로비 시작 경로(`startCountdownAndGame`), `'restart'` → `handleStartGame`, `'lobby'` → `handleReturnToLobby`. 처리부 `onButton`과 세 버튼의 `onClick`이 모두 이 함수를 부른다.
- 마우스 어댑터는 지금 코드처럼 캔버스 컨테이너의 `mousemove`·`mousedown`과 `window`의 `mouseup`·`blur`에 붙인다(캔버스 밖 HTML 버튼 클릭은 받지 않음).
- `SENSOR_RELAY`: 게임·로비 동작 코드를 삭제하고 `phoneAdapterRef.current.onSensorFrame(p)`의 반환값으로 진단·코킹·조준 고정 표시만 갱신.
- HUD 틱: `processor.tick()`, `phoneAdapter.syncFeedback(processor.getState())`. 기존 피버 자동 연사·동기화 블록 삭제.
- `contextmenu` → `mouseAdapter.onRightClick()`. 캔버스 `onMouseDown/Up/Aim` → `mouseAdapter`.
- `rapidFireTimerRef`·`feverAutoFireTimerRef`·`lastSentFeverReadyRef`·`lastSentSkillStockRef`·`lastSkillSyncTimeRef`·`zeroOffsetRef`·`checkResultButtonHover` 삭제 → 처리부·어댑터로. 정리하던 곳은 `processor.stopAll()`.
- 샌드박스 "테스트 사격"(`onTestFireShot`) → `processorsRef.current[0].send({ type: 'fireDown' }); send({ type: 'fireUp' })`.
- 센서 랩 진단 표시는 폰 어댑터 반환값 사용(D14: 센서 랩 화면 유지).

### I05. 테스트

- Related Files:
  - `tests/player-action-processor.test.ts`, `tests/input-adapters.test.ts`; new
  - `tests/mouse-double-click-fever.test.ts`, `tests/pc-modals-and-pairing.test.ts`; modify(깨지는 것만)

#### Details
가짜 타이머 + 실제 엔진:
- `fireDown`: PLAYING에서 'press' 한 발 후 연사, `fireUp` 후 멈춤. PAIRING에서는 `hitTestButton`이 'start'를 주면 `onButton('start')`, 버튼이 없어도 조준 (0.3, −0.2)이면 `onButton('start')`, (0.8, 0)이면 아무것도 없음. 사격 없음.
- 결과 화면에서 "다시 시작" HTML 버튼 클릭 → `pressScreenButton('restart')` 1회, 사격 신호 0회.
- 카드 선택 사격 직후 같은 틱 `skill` → 무시, 301ms 뒤 → 발동.
- `skill`: 시작 1.5초 안, 선택 라운드 중, 일시정지 메뉴 중 무시.
- `tick()`: 피버 중 16ms 'fever' 연사, 끝나면 멈춤.
- MouseAdapter: 더블클릭 창 안 두 번 누름 → fireDown 2회 + fever 1회. 묶인 처리부 없음(null) → 아무 신호 없음.
- PhoneAdapter: snapFire 패킷 → fireDown·fireUp, 홀드 상승/하강 → fireDown/fireUp 한 번씩, `applyZeroAndTuning`이 지금 계산과 같음(감도 1.2, invertY, 오프셋 손계산), `syncFeedback`이 변경 때와 150ms마다만 전송.

## Acceptance Criteria
- [ ] 캔버스에 `engine.shootAt`·`engine.activateFever`가 없고, 페이지에 사격 인터벌이 없다(처리부 안에만).
- [ ] 마우스·폰 모두 같은 처리부를 지나며, 장치별 차이는 어댑터 안에만 있다.
- [ ] 로비 시작·결과 버튼이 마우스 클릭으로도, 폰 사격으로도 눌리고, 마우스 클릭 한 번에 한 번만 실행된다.

## Validation
- `npx vitest run tests/player-action-processor.test.ts tests/input-adapters.test.ts tests/mouse-double-click-fever.test.ts` — 통과
- `grep -n "engine.shootAt\|engine.activateFever" src/pc/components/GameCanvas3D.tsx src/pc/PCGamePage.tsx | wc -l` — `0`(샌드박스 개발 버튼의 엔진 직접 호출은 `triggerSandboxFever` 등 상태 조작만 남음)
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: 마우스 1인·폰 1인 각 한 웨이브(단발·연사·피버·스킬), 폰 홀드 시작에 한 발이 나가는지, 로비에서 폰으로 가운데를 쏴서 시작·마우스로 "게임 시작" 클릭, 결과 버튼 두 개, 튜토리얼 4단계

## Commit Message
```text
refactor(input): device adapters feed one player action processor

Plan: 2026-11-07-two-player-coop
Phase: P01-solo-foundation
Task: T05-input-processor

- Mouse and phone adapters emit aim, fireDown, fireUp, skill and fever only; the mouse adapter listens on the canvas only, so HTML buttons stay plain clicks
- PlayerActionProcessor owns shots, hold fire, fever auto-fire, skill gates, a 0.3s skill lock after picks and phone button shots; buttons run one pressScreenButton
- Phone sync moves into PhoneAdapter; the canvas no longer fires shots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
