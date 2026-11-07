# Task: T04 2인팟 결과 화면

## Status: done

## Goal
2인 판이 끝나면 결과 화면(`ResultRankingModal`)이 1P와 2P를 나란히 비교한다: 각자 닉네임·점수·최대 콤보·처치 수·명중률·무기, 이탈했으면 "나감", 그리고 팀 합계와 "이 팀 최고 기록"(D11, D18). 솔로 랭킹 Top5는 그대로 보여 주되 "2인팟 점수는 솔로 랭킹에 오르지 않습니다" 안내를 붙인다(D05). 1인 결과 화면은 그대로.

## Decision Summary
- 팀 최고 기록은 서버가 점수 제출 후 보내는 `RANKING_UPDATED.updatedPlayer.coopBests[파트너 deviceId]`(P03-T03)로 표시한다. 응답이 오기 전에는 "기록 확인 중…".
- 팀 신기록 판단: 응답의 `coopBests[partner].teamScore === 이번 teamScore`이고 `playedAt`이 이번 제출 이후면 "🏆 팀 신기록!".

## Implementation

### I01. 결과 모달

- Related Files:
  - `src/pc/components/ResultRankingModal.tsx` :: `ResultRankingModalProps`, `CoopResultInfo`(new), `CoopResultSection`(new, 같은 파일); modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface CoopResultPlayer {
    slotLabel: '1P' | '2P';
    color: string;
    nickname: string;
    score: number;
    maxCombo: number;
    kills: number;
    /** 0..1 */
    accuracy: number;
    weaponKind: WeaponKind;
    leftEarly: boolean;
  }
  export interface CoopResultInfo {
    players: [CoopResultPlayer, CoopResultPlayer];
    teamScore: number;
    /** undefined: 서버 응답 대기, null: 이 팀 첫 기록 없음(응답 실패 등). */
    teamBest?: CoopBestEntry | null;
    isNewTeamBest: boolean;
  }
  interface ResultRankingModalProps { /* 기존 */ coop?: CoopResultInfo; }
  ```
- `coop`가 있으면 기존 개인 점수 블록(점수·breakdown·신기록 배지) 자리에 `CoopResultSection`: 두 칸 그리드(각 칸 테두리 플레이어 색, 배지, 닉네임, 점수 크게, 콤보·처치·명중률 `Math.round(acc*100)%`·무기 `WEAPON_RANKING_LABEL`), 이탈자 칸은 opacity .5 + "나감". 아래 줄에 `팀 합계 {teamScore}` / `이 팀 최고 {teamBest.teamScore}`(또는 "기록 확인 중…") / `isNewTeamBest`면 "🏆 팀 신기록!".
- 랭킹 목록 아래 작은 글씨 "2인팟 점수는 솔로 랭킹에 오르지 않습니다".
- "다시 시작"/"로비로" 버튼과 ref·hover 처리는 기존 그대로(T05의 두 십자선 hover가 이 버튼을 가리킴).

### I02. PC 페이지 연결

- Related Files:
  - `src/pc/PCGamePage.tsx` :: 결과 렌더, `case 'RANKING_UPDATED'`, `coopResult` 상태(new); modify

#### Details
- 판 종료 감지 시(점수 제출과 같은 지점) 플레이어 통계에 파트너 정보(`stats.coop`)가 있으면 `setCoopResult({ players: [0,1].map(i => …engine.getPlayRunStats(i)와 슬롯 player…), teamScore, teamBest: undefined, isNewTeamBest: false })`.
- `RANKING_UPDATED`: `coopResult`가 있고 `updatedPlayer.deviceId`가 1P 또는 2P의 deviceId면 `const best = updatedPlayer.coopBests?.[partnerDeviceId] ?? null; setCoopResult(r => ({ ...r, teamBest: best, isNewTeamBest: !!best && best.teamScore === r.teamScore && best.playedAt >= submittedAtIso }))`(두 응답 중 먼저 온 것으로 충분).
- 다시 시작·로비로 가면 `setCoopResult(null)`.

### I03. 테스트

- Related Files:
  - `tests/result-breakdown.test.ts` 또는 새 `tests/coop-result.test.tsx`; new

#### Details
- `coop` 없음 → 기존 출력 그대로(기존 테스트 통과로 확인).
- `coop` 있음 → 두 닉네임, 두 점수, "팀 합계", "2인팟 점수는 솔로 랭킹에 오르지 않습니다".
- `teamBest: undefined` → "기록 확인 중…", `isNewTeamBest` → "팀 신기록".
- 2P `leftEarly` → "나감".

## Acceptance Criteria
- [x] 2인 판 결과 화면에서 1P·2P 점수와 팀 최고가 보인다.
- [x] 1인 결과 화면은 바뀌지 않는다.

## Validation
- `npx vitest run tests/coop-result.test.tsx tests/result-breakdown.test.ts` — 통과
- `npm test && npx tsc --noEmit && npm run build` — 전체 통과
- 수동: 같은 두 사람이 두 판 연속 → 두 번째 판 결과에 첫 판 팀 기록이 "이 팀 최고"로 표시(더 높으면 팀 신기록)

## Commit Message
```text
feat(result): side-by-side 1P/2P results with the team best

Plan: 2026-11-07-two-player-coop
Phase: P05-hud-screens
Task: T04-coop-result-screen

- Coop results compare score, combo, kills, accuracy and weapon per player; away players show "나감"
- Team total and this team's best come from the server's coopBests
- Solo board gets a note that coop scores stay off it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
