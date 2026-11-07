# Task: T07 로비 랭킹 탭(개인 / 팀)

## Status: pending

## Goal
로비 하단 명예의 전당을 탭 두 개로 바꾼다(D22): "개인 랭킹"(지금의 솔로 Top5)과 "팀 랭킹"(P03-T04 `teamRankings`, `닉네임A & 닉네임B · 팀 합계 · 도달 웨이브`). 지금 로비에 참여한 두 사람의 팀 기록이 목록에 있으면 강조한다. 결과 화면 랭킹 영역도 2인 판이면 팀 랭킹 탭을 기본으로 연다.

## Decision Summary
- D38: 탭은 **마우스 클릭과 키보드 `Tab`**으로만 바꾼다(로비 폰 사격은 가운데 시작과 겹침, D33). 폰만 있는 경우는 기본 탭 규칙으로 해결: 참여 인원 2명이면 "팀 랭킹", 아니면 "개인 랭킹".
- 선택한 탭은 `localStorage`(`beer_crusher_lobby_rank_tab`, try/catch)에 기억하되, 위 기본 규칙이 바뀌는 순간(참여 인원 1↔2)에는 기본값으로 다시 맞춘다.

## Implementation

### I01. 랭킹 탭 컴포넌트

- Related Files:
  - `src/pc/components/RankingTabs.tsx` :: `RankingTabs`, `RankingTabsProps`, `RankingTab`; new

#### Details
- **Signatures & Types**:
  ```typescript
  export type RankingTab = 'solo' | 'team';
  export interface RankingTabsProps {
    soloRankings: RunRankingEntry[];
    teamRankings: TeamRankingEntry[];
    activeTab: RankingTab;
    onChangeTab: (tab: RankingTab) => void;
    /** 강조할 팀 키(지금 참여한 두 사람). 없으면 강조 없음. */
    highlightTeamKey?: string;
    /** 강조할 개인 deviceId 목록(참여자). */
    highlightDeviceIds?: string[];
    compact?: boolean; // 로비 하단 한 줄형(시안) vs 결과 화면 목록형
  }
  ```
- 탭 머리: `🏆 개인 랭킹 | 👥 팀 랭킹`, 활성 탭은 앰버 밑줄, 비활성은 `#94a3b8`. 키보드 `Tab`(로비 입력창에 포커스가 없을 때)로 전환.
- 개인 목록: 기존 로비 Top5 렌더를 그대로 옮긴다(순위·닉네임·점수·무기 라벨). 팀 목록: `{순위}. {members[0].nickname} & {members[1].nickname} {teamScore.toLocaleString()} · W{waveReached}`. 비어 있으면 "아직 팀 기록이 없습니다".
- 강조: 해당 줄 배경 `rgba(245,158,11,.15)`.

### I02. 연결

- Related Files:
  - `src/pc/components/QRPairingModal.tsx` :: 하단 랭킹 영역, props `teamRankings`; modify
  - `src/pc/components/ResultRankingModal.tsx` :: 랭킹 목록 영역, props `teamRankings`; modify
  - `src/pc/PCGamePage.tsx` :: `teamRankings` 상태(`ROOM_CREATED`·`RANKING_UPDATED`에서 갱신), `rankTab` 상태; modify

#### Details
- PC 페이지: `const [teamRankings, setTeamRankings] = useState<TeamRankingEntry[]>([])`; 두 메시지에서 `msg.teamRankings`가 있으면 저장.
- `highlightTeamKey` = 참여 슬롯 두 개의 `player.deviceId`를 정렬해 `'|'`로 합친 값(둘 다 있을 때). `highlightDeviceIds` = 참여자 deviceId.
- 결과 화면: 2인 판이면 `activeTab` 기본 `'team'`, 1인 판이면 `'solo'`. P04-T04의 "2인팟 점수는 솔로 랭킹에 오르지 않습니다" 문구는 개인 탭 아래에만.

### I03. 테스트

- Related Files:
  - `tests/ranking-tabs.test.tsx`; new
  - `tests/pc-modals-and-pairing.test.ts`; modify(로비 랭킹 문구 기대값이 바뀌면)

#### Details
- `activeTab='team'` + 팀 2개 → "카스왕 & 오비맨" 형식 2줄, 개인 목록 없음.
- 팀 0개 → "아직 팀 기록이 없습니다".
- `highlightTeamKey` 일치 줄에 강조 스타일.
- 기본 탭 규칙 순수 함수 `getDefaultRankTab(joinedCount: number): RankingTab` 테스트(2 → team, 그 외 → solo).

## Acceptance Criteria
- [ ] 로비에서 개인/팀 랭킹 탭을 오갈 수 있고 팀 랭킹에 2인팟 팀 최고 기록이 보인다.
- [ ] 두 사람이 로비에 있으면 팀 탭이 기본이고 그 팀 줄이 강조된다.

## Validation
- `npx vitest run tests/ranking-tabs.test.tsx tests/pc-modals-and-pairing.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: 2인 판 한 번 → 로비로 → 팀 탭에 방금 팀이 1위로 강조

## Commit Message
```text
feat(lobby): solo and team ranking tabs

Plan: 2026-11-07-two-player-coop
Phase: P05-hud-screens
Task: T07-lobby-ranking-tabs

- RankingTabs switches between the solo Top 5 and the team Top 5 in the lobby and on the result screen
- Team tab is the default when both slots are joined and highlights the current pair

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
