# Task: T01 RankingTabs Weapon Filter & Top 10 Scroll

## Status: done

## Goal
`RankingTabs`에 개인 랭킹용 무기 필터 칩(`종합` · `샷건` · `리볼버` · `개틀링`)과 개인/팀 10위 내부 스크롤을 구현하고, `PCGamePage` 및 `ResultRankingModal`과 연결한다.

## Decision Summary
- D02: `개인 랭킹` 탭 내부에 무기 필터 칩을 배치하고 로비(`QRPairingModal`)와 결과 모달(`ResultRankingModal`) 양쪽에 동일하게 적용.
- D04: 개인·팀 랭킹 모두 최대 10위까지 표시하고 고정 최대 높이 안에서 내부 스크롤 적용.
- D06: 기존 `Tab` 키 개인/팀 전환, `compact` prop 분기 등 기존 동작 및 테스트 호환성 유지.

## Implementation

### I01. `RankingTabs.tsx` 무기 필터 칩 및 10위 내부 스크롤 구현

- Related Files:
  - `src/pc/components/RankingTabs.tsx` :: `RankingTabsProps`, `RankingTabs` — 무기 필터 상태/칩 UI 추가, `.slice(0, 10)` 확장, 목록 컨테이너 스크롤 스타일 적용; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface RankingTabsProps {
    soloRankings: RunRankingEntry[];
    weaponRankings?: Partial<WeaponRankingsMap>;
    teamRankings: TeamRankingEntry[];
    activeTab: RankingTab;
    onChangeTab: (tab: RankingTab) => void;
    highlightTeamKey?: string;
    highlightDeviceIds?: string[];
    compact?: boolean;
  }
  ```
- **Execution Flow / Logic**:
  1. `useState<WeaponRankingFilter>('all')`로 현재 선택된 무기 필터(`weaponFilter`)를 관리한다.
  2. `WEAPON_FILTERS: { key: WeaponRankingFilter; label: string }[]` 상수를 정의한다:
     - `{ key: 'all', label: '종합' }`
     - `{ key: 'shotgun', label: WEAPON_RANKING_LABEL.shotgun }`
     - `{ key: 'revolver', label: WEAPON_RANKING_LABEL.revolver }`
     - `{ key: 'gatling', label: WEAPON_RANKING_LABEL.gatling }`
  3. `activeTab === 'solo'`일 때 탭 헤더 아래에 필터 칩 바(`data-testid="weapon-filter-bar"`)를 렌더링한다. 각 버튼에는 `data-testid={`weapon-filter-${f.key}`}` 및 `aria-pressed={weaponFilter === f.key}`를 부여한다.
  4. 표시할 개인 랭킹 목록 `visibleSoloRankings`:
     - `weaponFilter === 'all'`이면 `soloRankings`
     - 그 외(`'shotgun' | 'revolver' | 'gatling'`)이면 `weaponRankings?.[weaponFilter] ?? []`
  5. 개인 랭킹과 팀 랭킹 모두 `.slice(0, 10)`으로 최대 10위까지 렌더링한다. (빈 목록일 때 무기별 필터가 선택되어 있으면 `'아직 해당 무기 기록이 없습니다.'` 또는 기존 빈 안내 문구 표시 — `compact` 기존 빈 문구 테스트 호환 확인)
  6. 개인 랭킹과 팀 랭킹 목록 컨테이너에 `maxHeight: compact ? '210px' : '270px'`, `overflowY: 'auto'`, `paddingRight: '4px'`를 적용해 10위까지 내부 스크롤로 탐색할 수 있게 한다.

### I02. `PCGamePage.tsx`, `QRPairingModal.tsx`, `ResultRankingModal.tsx` 상태 및 Props 연결

- Related Files:
  - `src/pc/PCGamePage.tsx` :: `weaponRankings` state, `ROOM_CREATED`, `RANKING_UPDATED` — 서버에서 받은 `weaponRankings` 저장 및 모달 전달; modify
  - `src/pc/components/QRPairingModal.tsx` :: `QRPairingModalProps`, `QRPairingModal` — `weaponRankings` prop 받아 `RankingTabs`에 전달; modify
  - `src/pc/components/ResultRankingModal.tsx` :: `ResultRankingModalProps`, `ResultRankingModal` — `weaponRankings` prop 받아 `RankingTabs`에 전달; modify

#### Details
- **Execution Flow / Logic**:
  1. `PCGamePage.tsx`:
     - `const [weaponRankings, setWeaponRankings] = useState<Partial<WeaponRankingsMap>>({});` 추가.
     - `ROOM_CREATED`, `RANKING_UPDATED` 케이스에서 `if (msg.weaponRankings) setWeaponRankings(msg.weaponRankings);` 추가.
     - `<QRPairingModal ... weaponRankings={weaponRankings} />`, `<ResultRankingModal ... weaponRankings={weaponRankings} />` 전달.
  2. `QRPairingModal.tsx`와 `ResultRankingModal.tsx`:
     - 각각의 Props 인터페이스에 `weaponRankings?: Partial<WeaponRankingsMap>;` 추가하고 `<RankingTabs ... weaponRankings={weaponRankings} />`로 전달.

### I03. `RankingTabs` 단위 테스트 확장

- Related Files:
  - `tests/ranking-tabs.test.tsx` :: `RankingTabs` 테스트 — 10위 렌더링, 무기 필터 칩 렌더링, 팀 랭킹 10위 렌더링 검증; modify

#### Details
- 11개의 개인 랭킹 / 팀 랭킹 데이터를 넘겼을 때 1~10위까지 렌더링되고 11위는 렌더링되지 않음을 검증.
- `activeTab: 'solo'`일 때 무기 필터 칩(`종합`, `샷건`, `리볼버`, `개틀링`)이 렌더링되고, `activeTab: 'team'`일 때는 무기 필터 칩이 숨겨짐을 검증.

## Acceptance Criteria
- [ ] 로비와 결과 모달의 개인 랭킹에서 `종합`, `샷건`, `리볼버`, `개틀링` 필터 칩을 전환하며 각 무기별 Top 10을 볼 수 있다.
- [ ] 팀 랭킹에서도 최대 10위까지 표시된다.
- [ ] 개인·팀 랭킹 목록 영역이 고정 최대 높이 안에서 내부 스크롤된다.
- [ ] `tests/ranking-tabs.test.tsx`, `tests/ex-result.test.tsx` 및 `npm run build`가 통과한다.

## Validation
- `npx vitest run tests/ranking-tabs.test.tsx tests/ex-result.test.tsx` — 모든 테스트 통과
- `npm run build` — TypeScript 컴파일 및 Vite 빌드 통과

## Commit Message
```text
feat(ui): add weapon ranking filters and top-10 scrollable lists to RankingTabs

Plan: 2026-11-17-lobby-compact-weapon-ranking
Phase: P02-frontend-lobby-ranking-ui
Task: T01-ranking-tabs-weapon-filter

- Add weapon filter chips (all, shotgun, revolver, gatling) and top-10 scrollable list to RankingTabs
- Wire weaponRankings state from PCGamePage to QRPairingModal and ResultRankingModal
- Add unit tests for top-10 rendering and weapon filter chips
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
