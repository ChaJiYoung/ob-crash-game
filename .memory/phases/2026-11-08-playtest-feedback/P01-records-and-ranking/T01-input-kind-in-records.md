# Task: T01 입력 방식·카드 선택 기록 저장과 랭킹·결과 화면 표시

## Status: pending

## Goal
판 기록에 플레이어의 입력 방식(마우스/모바일)과 2인 판 파트너의 무기·입력 방식을 저장한다. 그 정보로 개인 랭킹 줄에 🖱/📱 아이콘을, 팀 랭킹 줄에 1P·2P 각자의 점수·무기·입력 방식을, 결과 화면(클리어·게임 오버)에 플레이어별 무기·입력 방식을 보여 준다. 지금은 입력 방식이 어디에도 저장되지 않는다.

## Decision Summary
- 결정 D02~D05. 새 필드는 모두 **선택 필드**다. 옛 기록(필드 없음)도 유효하고, 화면에서는 아이콘·값을 생략한다. `RANKING_RULESET_VERSION`(5)은 올리지 않는다.
- 입력 방식 타입은 기존 `SlotInput`(`src/pc/coopSlots.ts`, `'mobile' | 'mouse'`)과 같은 값이다. 서버도 쓰므로 `src/shared/types.ts`에 `InputKind`를 새로 선언하고 `SlotInput`은 그 별칭으로 바꾼다(`export type SlotInput = InputKind;`).

## Implementation

### I01. 공유 타입 확장
- Related Files:
  - `src/shared/types.ts` :: `InputKind`(new), `CoopRunInfo`, `PlayRunStats`, `RunRankingEntry`, `TeamRankingEntry` — modify
  - `src/pc/coopSlots.ts` :: `SlotInput` — `InputKind` 별칭으로; modify

#### Details
```ts
export type InputKind = 'mobile' | 'mouse';

export interface CoopRunInfo {
  // 기존 필드 유지 + 아래 추가 (모두 선택)
  partnerWeaponKind?: WeaponKind;
  partnerInputKind?: InputKind;
}
export interface PlayRunStats {
  // 기존 필드 유지 + 추가
  /** 없으면 옛 기록(표시 생략). */
  inputKind?: InputKind;
}
export interface RunRankingEntry {
  // 기존 + 추가
  inputKind?: InputKind;
}
export interface TeamRankingMember {
  deviceId: string;
  nickname: string;
  /** 옛 기록에는 없다. */
  score?: number;
  weaponKind?: WeaponKind;
  inputKind?: InputKind;
}
export interface TeamRankingEntry {
  teamKey: string;
  members: [TeamRankingMember, TeamRankingMember]; // 1P, 2P 순서 유지
  teamScore: number;
  waveReached: number;
  playedAt: string;
}
```

### I02. PC: 제출 메시지에 채우기
- Related Files:
  - `src/pc/scoreSubmission.ts` :: `buildScoreSubmissions` — modify

#### Details
1. 각 플레이어의 슬롯 상태 `const meSlot = slots.find((s) => s.slot === slot)`에서 `meSlot?.input`(null이면 생략)을 `finalStats.inputKind`로 넣는다. 1인 판도 동일.
2. 2인 판(`stats.coop`)이면 파트너 인덱스의 통계를 읽는다: 파트너 슬롯 → `map[partnerSlot]`(PlayerIndex) → `engine.getPlayRunStats(partnerIdx)?.weaponKind`를 `coop.partnerWeaponKind`로, 파트너 슬롯의 `input`을 `coop.partnerInputKind`로 넣는다. 파트너 인덱스를 못 찾으면 두 필드를 생략한다(예외 금지).

### I03. 서버: 검증·저장·랭킹 집계
- Related Files:
  - `server/PlayRecordStore.ts` :: `isValidPlayRunStats`, `pickStats`, `addToTop`, `addToTeamTop`, `getTopTeams`, `append`, `loadTopRuns` — modify

#### Details
1. `isValidPlayRunStats`: `const INPUTS: readonly InputKind[] = ['mobile','mouse']`. `s.inputKind`는 `undefined` 또는 `INPUTS` 포함이어야 한다. coop일 때 `c.partnerWeaponKind`는 undefined 또는 `WEAPONS` 포함, `c.partnerInputKind`는 undefined 또는 `INPUTS` 포함. 틀리면 `false`.
2. `pickStats`: `inputKind`가 있으면 복사한다. coop 블록에 `partnerWeaponKind`, `partnerInputKind`가 있으면 복사한다(없으면 키를 만들지 않는다. `undefined` 값으로 JSON에 쓰지 않음).
3. `addToTop` 호출 두 곳(`loadTopRuns`, `append`)에서 `inputKind: stats.inputKind`(load 쪽은 `r.inputKind`)를 함께 넣는다.
4. `addToTeamTop`: 멤버를 아래처럼 만든다.
   ```ts
   const me: TeamRankingMember = { deviceId, nickname, score: stats.totalScore, weaponKind: stats.weaponKind, inputKind: stats.inputKind };
   const partner: TeamRankingMember = { deviceId: coop.partnerDeviceId, nickname: coop.partnerNickname, score: coop.partnerScore, weaponKind: coop.partnerWeaponKind, inputKind: coop.partnerInputKind };
   ```
   `undefined` 필드는 객체에서 빼 둔다(테스트의 `toEqual` 안정성). 같은 판은 두 사람이 각자 기록을 올려 `addToTeamTop`이 두 번 불리지만, 각 기록이 자기 정보와 파트너 정보를 모두 가지므로 먼저 들어간 한 건만으로 두 멤버가 완성된다. 기존 "점수가 더 높을 때만 교체" 규칙은 그대로 둔다(병합 로직 추가 금지).
5. `getTopTeams`: 멤버 복사를 `{ ...t.members[0] }` 그대로 두면 새 필드도 복사된다(확인만).

### I04. 랭킹 탭 표시
- Related Files:
  - `src/shared/constants.ts` :: `INPUT_KIND_ICON`(new) — `{ mouse: '🖱', mobile: '📱' } as const satisfies Record<InputKind, string>`; modify
  - `src/pc/components/RankingTabs.tsx` :: `RankingTabs` — modify

#### Details
1. 개인 줄: 닉네임 왼쪽(순위 숫자 다음)에 `entry.inputKind`가 있으면 `<span data-testid="rank-input-icon" title={entry.inputKind === 'mouse' ? '마우스' : '모바일'}>{INPUT_KIND_ICON[entry.inputKind]}</span>`. 없으면 아무것도 그리지 않는다.
2. 팀 줄: 지금 `p1 & p2` 닉네임만 있는 왼쪽 영역을 두 줄 멤버 목록으로 바꾼다. 멤버마다 `[아이콘] 닉네임 · 무기라벨 · 점수` (`WEAPON_RANKING_LABEL`, `score.toLocaleString()`). 각 값이 없으면 그 조각만 생략한다. 오른쪽에는 지금처럼 팀 합계와 `W{wave}`.
3. `compact`(로비) 모드에서도 같은 정보를 보여 주되 글자 크기는 지금 compact 값(11px)을 유지하고, 멤버 줄은 `whiteSpace: 'nowrap'`, `overflow: 'hidden'`, `textOverflow: 'ellipsis'`로 넘침을 막는다.

### I05. 결과 화면
- Related Files:
  - `src/pc/components/ResultRankingModal.tsx` :: `CoopResultPlayer`, `ResultRankingModalProps`, 1인 요약 영역 — modify
  - `src/pc/PCGamePage.tsx` :: `setCoopResult(...)` 호출부(약 815~845행), `<ResultRankingModal ... />`(약 1768행) — modify

#### Details
1. `CoopResultPlayer`에 `inputKind?: InputKind` 추가. 2인 카드의 "선택 무기:" 줄 옆에 `입력: 🖱 마우스` / `📱 모바일` 표시.
2. `PCGamePage`에서 각 플레이어 슬롯(`slotsRef.current.find((s) => s.slot === p0Slot)`)의 `input`을 `inputKind`로 채운다.
3. 1인 판: `ResultRankingModalProps`에 `soloWeaponKind?: WeaponKind`, `soloInputKind?: InputKind`를 추가하고, 총점 아래 요약에 `무기 · 입력` 한 줄을 넣는다(값이 없으면 생략). `PCGamePage`는 `engine.getPlayRunStats(0)?.weaponKind`와 1인 슬롯의 `input`을 넘긴다.

### I05-1. 카드 선택 기록 (결정 D09)
- Related Files:
  - `src/shared/types.ts` :: `CardPickRecord`(new), `PlayRunStats.cardPicks?` — modify
  - `src/pc/engine/PlayerCombatState.ts` :: `PlayerCombatState.cardPicks`(new), `reset()` — modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `applySelection`(약 1939행), `getPlayRunStats`(약 2104행) — modify
  - `server/PlayRecordStore.ts` :: `isValidPlayRunStats`, `pickStats` — modify

#### Details
```ts
export interface CardPickRecord {
  wave: number;          // 고른 시점의 engine.currentWave
  kind: RewardCardKind;
  midWave: boolean;      // true면 킬 게이지 중간 카드, false면 웨이브 클리어 카드
  auto: boolean;         // 이탈자 자동 선택(D20) 여부
}
// PlayRunStats에 추가
cardPicks?: CardPickRecord[];
```
1. `PlayerCombatState`에 `public cardPicks: CardPickRecord[] = []`를 두고, `reset()`에서 `[]`로 비운다.
2. `applySelection`의 `else if (target.rewardCardKind)` 분기에서, `applyRewardCard` 바로 뒤에 `player.cardPicks.push({ wave: this.currentWave, kind: target.rewardCardKind, midWave: !(this.selectRound?.isWaveClear ?? false), auto })`를 넣는다. `selectRound`를 닫기 **전에** 읽어야 한다. 이 지점에서 아직 열려 있는지 확인한다. 닫힌 뒤라면 분기 맨 앞에서 `isWaveClear`를 지역 변수에 담아 둔다.
3. `getPlayRunStats`가 `cardPicks: player.cardPicks.map((c) => ({ ...c }))`를 반환한다.
4. 서버 검증: `cardPicks`는 `undefined`이거나 길이 60 이하 배열이어야 한다. 각 항목은 `isCount(wave)`, `REWARD_CARD_KINDS`(9종 상수 배열을 `PlayRecordStore.ts`에 선언)에 포함된 `kind`, boolean인 `midWave`와 `auto`를 가져야 한다. `pickStats`는 있을 때만 필드를 골라 복사한다.
5. 랭킹·화면 표시는 하지 않는다. 분석용 기록이다.

### I06. 테스트·문서
- Related Files:
  - `tests/play-records.test.ts` — 새 필드 저장/검증 케이스 추가; modify
  - `tests/coop-start-flow.test.ts` :: `describe('buildScoreSubmissions')` — inputKind/파트너 필드 케이스; modify
  - `tests/ranking-tabs.test.tsx` — 아이콘·멤버 표시 케이스; modify
  - `tests/coop-result.test.tsx` — 입력 방식 표시; modify
  - `src/pc/components/GuideModal.tsx`, `README.md` — 랭킹 설명에 입력 방식 표시 한 줄(해당 설명이 있을 때만); modify

#### Details
- 잘못된 `inputKind: 'keyboard'` → `isValidPlayRunStats` false.
- `inputKind`가 없는 옛 기록 줄 → 로드 성공, 랭킹 항목에 `inputKind` 키 없음, 화면에 아이콘 없음.
- coop 기록 1건 → `getTopTeams()[0].members`에 양쪽 `score`, `weaponKind`, `inputKind`가 채워짐(1P/2P 순서 유지).
- 1인 마우스 판 제출 메시지 → `stats.inputKind === 'mouse'`.
- 엔진: 중간 카드 1장과 클리어 카드 1장을 고른 뒤 `getPlayRunStats(0).cardPicks`가 `[{midWave:true,...},{midWave:false,...}]`이다. `startGame` 후에는 비어 있다(`tests/play-run-stats.test.ts`).
- 서버: 잘못된 `kind`, 61개짜리 배열 → false. `cardPicks`가 없는 옛 기록 → 유효.

## Acceptance Criteria
- [ ] 새 판 기록 JSONL 줄에 `inputKind`(와 coop이면 `partnerWeaponKind`, `partnerInputKind`)가 저장된다.
- [ ] 로비·결과 화면 개인 랭킹 줄에 🖱/📱가 보이고, 옛 기록은 아이콘 없이 보인다.
- [ ] 팀 랭킹 줄에 1P·2P 각자 아이콘·닉네임·무기·점수가 보인다.
- [ ] 결과 화면에 플레이어별 무기와 입력 방식이 보인다(1인·2인).
- [ ] 새 판 기록에 플레이어별 `cardPicks`(웨이브, 종류, 중간/클리어, 자동 여부)가 저장된다.

## Validation
- `npx tsc --noEmit` — 오류 0
- `npx vitest run tests/play-records.test.ts tests/coop-start-flow.test.ts tests/ranking-tabs.test.tsx tests/coop-result.test.tsx tests/coop-records.test.ts tests/play-run-stats.test.ts` — 통과
- `npm test` — 전체 통과

## Commit Message
```text
feat(records): 입력 방식과 카드 선택 기록을 저장하고 랭킹·결과 화면에 표시

Plan: 2026-11-08-playtest-feedback
Phase: P01-records-and-ranking
Task: T01-input-kind-in-records

- 공유 타입에 InputKind, 파트너 무기·입력 방식, 팀 멤버 점수 필드 추가(모두 선택)
- 점수 제출 메시지에 입력 방식과 파트너 정보 채우기
- 서버 검증·저장·개인/팀 랭킹 집계에 새 필드 반영
- 랭킹 탭에 입력 아이콘, 팀 줄에 멤버별 점수·무기·입력 표시
- 결과 화면에 플레이어별 무기·입력 방식 표시
- 판 기록에 카드 선택 기록(cardPicks) 추가
- 테스트와 가이드 문구 갱신
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
