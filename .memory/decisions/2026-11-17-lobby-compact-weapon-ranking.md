# Decisions: Lobby Compact Layout & Weapon-Filtered Top 10 Ranking

- Date: 2026-11-17
- Status: Confirmed

## D01. 로비 레이아웃 및 세로 높이 축소 방식
- **Chosen**: 상하 구조 유지 + 전반적 컴팩트화 + 랭킹 목록 내부 스크롤
- **Rationale**: 기존 로비(`QRPairingModal.tsx`)의 위(1P/2P 슬롯 카드) - 아래(좌측 랭킹 + 우측 시작/액션 버튼) 구조를 그대로 유지하여 사용자 익숙함을 해치지 않으면서, 모달 전체의 여백·패딩·폰트 크기·QR 코드 크기·슬롯 카드 최소 높이(`minHeight: 340px`)·조작법 영역 등을 줄여 노트북 화면(768px 전후 높이)에서도 모달 외곽 스크롤이 생기지 않도록 한다. 10위까지 늘어난 랭킹 리스트는 고정 높이(`maxHeight` + `overflowY: 'auto'`) 안에서 내부 스크롤로 탐색한다.

## D02. 무기별 및 무기종합 랭킹 UI 구조와 적용 범위
- **Chosen**: `개인 랭킹` 탭 내부에 무기 필터 칩(`종합` · `샷건` · `리볼버` · `개틀링`)을 배치하고, 로비(`QRPairingModal`)와 게임 종료 결과 모달(`ResultRankingModal`) 모두에 동일하게 적용
- **Rationale**: 최상위 탭은 기존처럼 `🏆 개인 랭킹` / `👥 팀 랭킹` 2개를 유지하여 `Tab` 키 전환 등 기존 UX를 보존하고, `개인 랭킹` 탭을 선택했을 때만 하단에 무기 필터 칩을 노출해 UI 복잡도를 낮춘다. 두 모달이 `RankingTabs` 컴포넌트를 공유하므로 일관된 경험을 제공한다.

## D03. 개인 랭킹 10위 집계 기준 (플레이어별 최고 기록)
- **Chosen**: 플레이어별 최고 기록 1개씩만 표시 (종합은 전체 무기 중 최고 점수 1개, 무기별은 해당 무기로 세운 최고 점수 1개)
- **Rationale**: 기존 `PlayRecordStore.getTopRuns`는 판(run) 단위로 단순 정렬해 한 플레이어가 여러 번 높은 점수를 기록하면 상위권을 독점할 수 있었다. 10위까지 확장할 때 동일 닉네임 도배를 방지하고 이미 팀 랭킹(`getTopTeams`)에서 사용 중인 `ROW_NUMBER() OVER (PARTITION BY ...)` 방식과 일관성을 맞추기 위해 `player_id` 기준으로 파티셔닝한다.

## D04. 팀 랭킹 표시 개수
- **Chosen**: 팀 랭킹도 개인 랭킹과 동일하게 10위까지 확장 (내부 스크롤 동일 적용)
- **Rationale**: 개인 랭킹과 팀 랭킹의 UI/데이터 대칭성을 맞추어 두 탭 모두 10위까지 조회·스크롤할 수 있도록 한다.

## D05. 서버-클라이언트 무기별 Top 10 데이터 전달 방식 (코드 기반 확정)
- **Chosen**: 서버(`PlayRecordStore` → `wsServer`)가 `overall` 및 무기별(`shotgun`, `revolver`, `gatling`) Top 10 데이터를 함께 계산해 기존 랭킹 페이로드(`ROOM_CREATED`, `AUTH_RESULT`, `RANKING_UPDATED`)에 포함해 전달
- **Rationale**: DB(`game_players.weapon_kind`)에 이미 무기 정보가 저장되어 있다. 전체 종합 Top 10만 내려받아 클라이언트에서 필터링하면 특정 무기 기록이 종합 Top 10에 적게 들었을 때 무기별 10위를 채울 수 없다. 반면 각 카테고리당 최대 10개씩 총 40개 내외로 데이터 크기가 작아 탭 전환 시 별도 요청 없이 즉시 응답하도록 한 번에 내려주는 것이 WebSocket 구조에 가장 단순하고 빠르다.

## D06. 로비에서 랭킹 컴포넌트와 연결된 기존 상태 유지 (코드 기반 확정)
- **Chosen**: 기존 `compact` prop 분기, `Tab` 키로 개인/팀 전환, `localStorage('beer_crusher_lobby_rank_tab')` 저장 및 참여 인원수(1P/2P)에 따른 기본 탭 자동 전환(`getDefaultRankTab`)은 그대로 유지
- **Rationale**: 이미 테스트(`tests/ranking-tabs.test.tsx`, `tests/lobby-slot-cards.test.tsx`)로 검증된 기존 접근성 및 편의 동작을 깨뜨리지 않기 위함이다.
