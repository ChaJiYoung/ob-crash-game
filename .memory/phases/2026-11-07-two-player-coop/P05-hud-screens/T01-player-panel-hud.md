# Task: T01 개인 패널 HUD

## Status: done

## Goal
전투 HUD를 D09·시안 5/5-1대로 바꾼다. 왼쪽 위에는 목숨 패널만 남고(2인은 "TEAM · BAR DEFENSE", 1인은 "BAR DEFENSE"), 점수·콤보·무기·탄창·스킬·피버·패시브 카드·개인 버프는 플레이어마다 하나의 개인 패널(`PlayerPanel`)로 합쳐 1P는 왼쪽 아래, 2P는 오른쪽 아래에 둔다. 1인도 같은 패널을 쓰되 "1P" 배지는 숨기고 색은 앰버. 스킬 안내는 그 플레이어 입력 방식에 맞는 문구 하나(폰 "위로 휙!", 마우스 "우클릭"). 이탈자 패널에는 "나감" 표시(D20). 웨이브·진행 바·보스 체력·아이스 프리즈(팀 버프)·가이드 버튼은 지금 자리.

## Decision Summary
- 시안 5 패널 값: 폭 292px, 패딩 16px 20px, 배경 `rgba(17,24,39,.96)`, 테두리 1px 플레이어 색, radius 16px, 하단 24px, 좌/우 24px. 첫 줄 배지 + 점수(28px, 800) + 콤보 칩, 둘째 줄 `Lv.N 무기명` + `탄수/최대`, 탄창 핍(최대 12개, 그 이상은 게이지 — 기존 규칙), 스킬 칩, 피버 바(`FEVER GAUGE n%`), 패시브 칩 줄.
- HUD 스냅샷의 개인 값은 `players[]`에만 둔다. 지금 최상위에 있는 개인 필드(`score`, `combo`, `ammo`, `weaponKind`, `feverGauge` …)는 **삭제**하고 그 필드를 읽던 화면·테스트를 `players[i]`로 옮긴다(D24: 플레이어 0 지름길 금지). 최상위에는 팀 값(목숨·웨이브·보스·팀 버프·선택 상태)만 남는다.
- 1인/2인의 표시 차이(배지 유무, 색, 패널 좌우, 목숨 머리글, 스킬 안내 입력 방식)는 새 함수 `getPlayerPresentation` 한 곳에서만 정한다. 컴포넌트는 그 결과만 받아 그린다(인원수를 직접 보지 않는다).

## Implementation

### I01. 스냅샷

- Related Files:
  - `src/pc/hudSnapshot.ts` :: `PlayerHudSnapshot`(new), `HudSnapshot.players`, `buildHudSnapshot`, `isHudSnapshotEqual`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface PlayerHudSnapshot {
    index: PlayerIndex;
    score: number; combo: number; comboMultiplier: number; maxCombo: number;
    ammo: number; maxAmmo: number; isReloading: boolean; reloadDurationMs: number;
    feverGauge: number; isFeverReady: boolean; isFeverActive: boolean;
    weaponKind: WeaponKind; weaponLevel: WeaponLevel;
    skillStock: number; maxSkillStock: number; skillCooldownRemainingMs: number;
    /** 개인 버프(파워샷·와이드). 아이스 프리즈는 팀이라 HudSnapshot.activeBuffs에 남는다. */
    personalBuffs: ActiveBuffState[];
    isWideScopeActive: boolean; isPowerShotActive: boolean;
    passiveCards: PassiveCardStack[];
    isAway: boolean;
  }
  /** 팀 값 + players. 기존 최상위 개인 필드는 삭제. */
  export interface HudSnapshot { /* 기존 팀 필드: lives, maxLives, wave, waveProgress, bosses, bossHpKey, isBossWarning, bossDown, waveClearKey, isWeaponSelectPending, isRewardCardPending, isPaused, tutorialStep, targetsCount, activeBuffs(팀 버프만) */ players: PlayerHudSnapshot[]; }
  ```
- `buildHudSnapshot`: `players = engine.players.map((p) => …)` — 값은 `p.scoreManager.getState()`, `p.weaponSystem.getState()`, `engine.getActiveBuffs(nowMs, p.index)`에서 `ice_freeze`를 뺀 것, `engine.getPassiveCardStacks(p.index)`, `p.isAway`. 최상위 `activeBuffs`는 팀 버프(`ice_freeze`)만.
- 영향받는 곳 찾기: `grep -rn "hudState\.\(score\|combo\|comboMultiplier\|ammo\|maxAmmo\|isReloading\|reloadDurationMs\|feverGauge\|isFeverReady\|isFeverActive\|weaponKind\|weaponLevel\|skillStock\|maxSkillStock\|skillCooldownRemainingMs\|isWideScopeActive\|isPowerShotActive\|passiveCards\|maxCombo\)" src` 와 `tests/hud-snapshot.test.ts`, `tests/hud-render-cost.test.ts`, `tests/passive-card-hud.test.ts`. 모두 `players[i]`로 옮긴다(1인 화면은 `players[0]`이 유일한 플레이어라서이지 지름길이 아니다).
- `isHudSnapshotEqual`: `players`는 `JSON.stringify` 비교(시간값은 이미 100ms 반올림).

### I01-b. 표시 규칙 함수(인원수를 보는 유일한 화면 코드)

- Related Files:
  - `src/pc/playerPresentation.ts` :: `PlayerPresentation`, `getPlayerPresentation`, `getTeamPresentation`; new

#### Details
- **Signatures & Types**:
  ```typescript
  export type PanelInputKind = 'mobile' | 'mouse';
  export interface PlayerPresentation {
    index: PlayerIndex;
    slot: PlayerSlot;
    /** 2인 이상이면 '1P'/'2P', 1인이면 null(배지·접두어 숨김, D09). */
    slotLabel: '1P' | '2P' | null;
    /** 패널 테두리·이름표·카드 바깥 테두리 등 플레이어 구분 색. 1인은 SOLO_PLAYER_COLOR. */
    color: string;
    /** 'state': 십자선 링이 피버·파워 등 상태 색(1인, 지금 동작). 'player': 링은 플레이어 색, 상태는 배지·glow로(2인). */
    ringColorMode: 'state' | 'player';
    /** 카드 바깥 주인 테두리 색(D23). 1인은 null. */
    ownerOutlineColor: string | null;
    panelSide: 'left' | 'right';
    /** 판정 팝업 위치. 1인 'center'(지금), 2인은 패널 쪽. */
    popupSide: 'left' | 'right' | 'center';
    inputKind: PanelInputKind;
    nickname?: string;
  }
  export function getPlayerPresentation(input: {
    playerCount: number;
    slotIndexMap: Partial<Record<PlayerSlot, PlayerIndex>>;
    slots: SlotPair;
  }): PlayerPresentation[];
  export function getTeamPresentation(playerCount: number): { livesTitle: string }; // 1: 'BAR DEFENSE', 2: 'TEAM · BAR DEFENSE'
  ```
- 규칙: `multi = playerCount > 1`. `slotLabel = multi ? \`${slot}P\` : null`, `color = multi ? PLAYER_COLORS[slot] : SOLO_PLAYER_COLOR`, `ringColorMode = multi ? 'player' : 'state'`, `ownerOutlineColor = multi ? PLAYER_COLORS[slot] : null`, `panelSide = index === 0 ? 'left' : 'right'`, `popupSide = multi ? panelSide : 'center'`, `inputKind = 그 슬롯 input === 'mouse' ? 'mouse' : 'mobile'`(튜토리얼에서 슬롯이 없으면 'mouse').
- 이 파일 밖의 화면 코드(`src/pc/components/**`)에서 `players.length`·`isCoop`·`playerCount` 비교를 쓰지 않는다(리뷰 체크).

### I02. PlayerPanel

- Related Files:
  - `src/pc/components/PlayerPanel.tsx` :: `PlayerPanel`, `PlayerPanelProps`; new
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `formatWeaponSkillBadge`, `formatAmmoStatusText`, `formatFeverStatusBadge`, `PassiveCardBar` — 재사용; modify(스킬 문구만)

#### Details
- **Signatures & Types**:
  ```typescript
  export interface PlayerPanelProps {
    snapshot: PlayerHudSnapshot;
    presentation: PlayerPresentation; // 배지·색·좌우·입력 방식은 전부 여기서 읽는다
  }
  // formatWeaponSkillBadge에 마지막 인자 추가
  export function formatWeaponSkillBadge(kind, level, stock, maxStock, cooldownMs, inputKind: PanelInputKind = 'mobile'): {...};
  // READY 문구: `⚡ SKILL READY!${stockBadge} [${inputKind === 'mouse' ? '우클릭' : '위로 휙!'}]`
  ```
- 렌더: 시안 값대로. `snapshot.isAway`면 패널 `opacity: 0.45`, 첫 줄 오른쪽에 회색 칩 "나감", 스킬 칩 문구 "⏸ 정지됨". 개인 버프는 패시브 줄 위에 작은 칩(`ITEM_BUFF_SPECS[kind].icon` + 남은 초).
- 기존 테스트 `tests/pc-modals-and-pairing.test.ts:160`, `tests/tutorial-skill-step.test.ts:91`이 `'우클릭'`을 기대하면 그 테스트가 렌더하는 맥락의 입력 방식을 `'mouse'`로 넘기거나 기대값을 입력별로 나눠 고친다.

### I03. ArcadeOverlayHUD 배치

- Related Files:
  - `src/pc/components/ArcadeOverlayHUD.tsx` :: `ArcadeOverlayHUDProps`, `ArcadeOverlayHUD`; modify
  - `src/pc/PCGamePage.tsx` :: `<ArcadeOverlayHUD …>` 호출부; modify

#### Details
- props: 개인 값 props(`score`, `combo`, `ammo` …)를 모두 지우고 `players: PlayerHudSnapshot[]; presentations: PlayerPresentation[]; team: { livesTitle: string }`. PC 페이지가 `getPlayerPresentation`/`getTeamPresentation`으로 만든다.
- 왼쪽 위(현재 267행 "Player Badge, Score, Combo, Lives"): 점수·콤보·플레이어 배지를 제거하고 목숨 패널만. 머리글 `team.livesTitle`.
- 오른쪽 위 버프 스택(470행): `activeBuffs.filter(b => b.kind === 'ice_freeze')`만.
- 아래(595행 BOTTOM BAR): 기존 왼쪽 무기 패널과 오른쪽 피버 패널(715행)을 삭제하고 `players.map((s, i) => <PlayerPanel snapshot={s} presentation={presentations[i]} />)` — 1인도 같은 map(길이 1).
- 삭제된 props(`score`, `combo`, `ammo` …)는 호출부와 함께 정리하되, 다른 테스트가 `ArcadeOverlayHUD`를 개인 필드 props로 렌더하면(`grep -rn "ArcadeOverlayHUD" tests`) 새 props로 고친다.

### I04. 테스트

- Related Files:
  - `tests/player-panel.test.tsx`; new
  - `tests/hud-snapshot.test.ts`, `tests/pc-hud-and-banner.test.ts`, `tests/passive-card-hud.test.ts`; modify(깨지는 것만)

#### Details
- 1인 패널: 배지 "1P" 없음, 테두리 `#f59e0b`. 2인 2P 패널: "2P" 배지, `#ff6b3d`.
- 폰 입력 → "위로 휙!"만, 마우스 → "우클릭"만, 두 문구 동시 없음.
- `isAway` → "나감".
- 스냅샷: 2인 엔진에서 `players.length === 2`, 2P 점수 반영. 스냅샷 객체에 최상위 `score`·`ammo` 키가 없음.
- `getPlayerPresentation`: 1인 → `slotLabel null`, `#f59e0b`, `ringColorMode 'state'`, `popupSide 'center'`; 2인 → 1P `#38bdf8` left, 2P `#ff6b3d` right, `'player'`.
- 리뷰 체크: `grep -rn "players.length\|isCoop\|playerCount" src/pc/components | wc -l` → 0.

## Acceptance Criteria
- [x] 1인 화면: 왼쪽 위 목숨만, 왼쪽 아래 개인 패널 하나, 오른쪽 아래 피버 패널 없음(시안 5-1).
- [x] 2인 화면: 좌·우 아래 개인 패널 두 개(시안 5).
- [x] "[위로 휙! / 우클릭]" 병기 문구가 소스에서 사라진다.

## Validation
- `npx vitest run tests/player-panel.test.tsx tests/hud-snapshot.test.ts tests/pc-hud-and-banner.test.ts tests/passive-card-hud.test.ts tests/hud-render-cost.test.ts` — 통과
- `grep -rn "위로 휙! / 우클릭" src | wc -l` — `0`
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동 캡처: 1인·2인 전투 화면을 시안 5-1·5와 나란히 비교

## Commit Message
```text
feat(hud): per-player panels with lives alone at the top left

Plan: 2026-11-07-two-player-coop
Phase: P05-hud-screens
Task: T01-player-panel-hud

- HudSnapshot gains players[]; PlayerPanel shows score, combo, weapon, ammo, skill, fever, cards and buffs
- 1P bottom-left, 2P bottom-right; solo uses the same panel without the 1P badge
- Skill hint matches the player's input (phone flick or right click); away players show "나감"

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
