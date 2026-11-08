# Decisions: SQLite DB 전환 (게임-플레이어 중심 스키마)

- Date: 2026-11-08
- Status: Confirmed
- 대상: `data/players.json`, `data/play-records.jsonl` 파일 저장소 → SQLite(`data/game.db`, `better-sqlite3`)

---

## D01. 기존 데이터 마이그레이션
- **Chosen**: 하지 않는다. 새 DB는 빈 상태로 시작한다. 기존 JSON/JSONL 파일은 지우지 않고 그대로 두되, 코드에서 읽기/쓰기는 제거한다.
- **Rationale**: 사용자 결정. 레거시 협동 기록(플레이어당 1줄)을 한 판으로 묶는 휴리스틱, 마이그레이터, `.bak` 백업이 모두 불필요해진다.

## D02. 판(game) 생성 시점 — 시작 시 생성, 종료 시 갱신
- **Chosen**: 카운트다운이 끝나 실제 플레이가 시작될 때(`PCGamePage.handleStartGame`, 무기 선택 화면이 뜨는 순간) PC가 `GAME_BEGIN`을 보낸다. 서버는 한 트랜잭션으로 `games`(`status='playing'`)와 참가자별 `game_players`를 만들고 `gameId`를 응답한다. 종료 시 `GAME_SCORE_SUBMIT`에 `gameId`를 붙여 기존 행을 UPDATE한다.
- **Rationale**: 엔진은 PC에서 돌고 두 플레이어 통계를 모두 가진다(`buildScoreSubmissions`). 참가자는 시작 시점에 이미 확정이므로 그때 행을 만들면 협동 판 묶기, 제출 유실, 재접속 문제가 한 번에 사라진다. `START_GAME_REQUEST`는 PC와 컨트롤러가 중복으로 보낼 수 있고 카운트다운 중 취소될 수 있어 시작 신호로 쓰지 않는다. 판 식별은 별도 UUID 없이 서버가 발급한 `games.id`로 한다.
- **프로토콜**
  - C→S `GAME_BEGIN { roomId, mode, players: [{ slot, deviceId, inputKind }] }`
  - S→C `GAME_STARTED { roomId, gameId }` (현재 정의만 있고 쓰이지 않는 타입을 확장해 재활용)
  - "다시하기"(`sameRoster`)도 `handleStartGame`을 지나므로 판마다 새 `games` 행이 생긴다.

## D03. 무기 기록 시점
- **Chosen**: 무기를 고르는 순간 PC가 `WEAPON_CHOSEN { gameId, slot, weaponKind }`를 보내 `game_players.weapon_kind`를 즉시 UPDATE한다. 최종 `weapon_level`은 종료 제출 때 갱신한다. `weapon_kind`와 `weapon_level`은 시작 시 NULL이다.
- **Rationale**: 무기 선택은 `PLAYING` 단계 안의 첫 select round라서 `GAME_BEGIN` 시점에는 무기가 없다. 사용자 선택.

## D04. 끝나지 않은 판 정리 (`abandoned`)
- **Chosen**: **명시적 신호로만** `status='playing'`인 판을 `abandoned`로 바꾼다(삭제하지 않는다).
  1. 같은 `roomId`로 새 `GAME_BEGIN`이 올 때 그 방의 `playing` 판
  2. 일시정지 메뉴의 "로비로"와 "다시시작"에서 PC가 보내는 `GAME_ABANDON { gameId }`
  - PC 소켓 끊김이나 서버 기동 때는 정리하지 **않는다**. 방이 다시 쓰이지 않아 `playing`으로 남는 판이 생길 수 있지만, 랭킹과 집계는 `finished`만 보므로 영향이 없다.
- **Rationale**: PC는 소켓이 끊기면 저장된 방 코드로 자동 재접속하고(`PCGamePage.tsx` `socket.onclose` 백오프, `tests/pc-reconnect.test.ts`), 엔진은 브라우저에서 계속 돈다. `tsx watch` 재시작도 같다. 끊김이나 기동 시점에 정리하면 재접속 뒤 제출이 거절되어 점수를 잃는다. (계획 단계에서 발견해 수정, 2026-11-08 사용자 확인.) 일시정지 메뉴의 "로비로"는 현재 서버에 아무것도 보내지 않아(`PCGamePage.tsx:1310`) 명시적 메시지가 필요하다. 이탈 통계를 위해 행은 남긴다.

## D05. 판 종료 판정과 행 채우기 (코드 근거로 확정)
- **Chosen**:
  - 해당 판의 첫 유효 `GAME_SCORE_SUBMIT`이 오면 `games`를 `finished`로 바꾸고, 판 단위 값(`outcome`, `total_score`, `wave_reached`, `lives_left`, `duration_sec`, `ended_at`)을 채운다. 협동이면 `total_score`는 `coop.teamScore`이다.
  - 각 `game_players` 행은 자기 제출이 올 때 상세 통계를 채우고 `submitted_at`을 기록한다. 아직 오지 않은 플레이어의 상세 컬럼은 NULL이다("측정 안 됨"과 0을 구분한다).
  - 서버 검증: `gameId`의 `room_id`가 메시지의 `roomId`와 같은지, `deviceId`가 그 판의 `game_players`에 있는지, 같은 행이 이미 제출되지 않았는지를 확인한다. 기존 `isValidPlayRunStats`와 `RULESET_MISMATCH` 검사는 유지한다.
- **Rationale**: PC가 두 제출을 연달아 보내므로, 한쪽이 유실돼도 판 결과는 남아야 한다.

## D06. 웨이브별 피격 횟수
- **Chosen**: 엔진에 웨이브별 피격 집계를 추가한다(`waveClears`의 각 항목에 `damageTaken`). 결과는 판 단위 `game_waves.damage_taken`에 저장한다. `PlayRunStats.waves[].damageTaken`은 optional로 추가한다.
- **Rationale**: 현재는 `this.damageTaken`(판 전체, 엔진 전역)만 있고 웨이브별 원본이 없다. 사용자 선택. 엔진 값이 플레이어별이 아니므로 판 단위 테이블에 둔다.

## D07. 프로필 `bestScore`와 `totalGames` 의미
- **Chosen**: 지금 의미를 유지하고 쿼리로 산출한다.
  - `bestScore` = `MAX(game_players.score)`, 조건: `games.mode='solo'`, `status='finished'`, `ruleset_version = 현재`
  - `totalGames` = `COUNT(*)`, 조건: `status='finished'`, `ruleset_version = 현재` (모드 무관)
  - `lastPlayedAt` = `players.last_seen_at`
  - `coopBests` = 현재 규칙 버전의 협동 `finished` 판 중 파트너별 `total_score` 최고 판에서 산출
- **Rationale**: 협동 점수는 지금도 `bestScore`에 반영되지 않는다(`recordCoopResult`). 규칙 버전 초기화(`migrateRuleset`)는 쿼리 조건만으로 대체된다.

## D08. 닉네임
- **Chosen**: `game_players`에 닉네임을 저장하지 않는다. 랭킹과 결과는 항상 `players.nickname`을 조인해 현재 닉네임을 보여준다.
- **Rationale**: 단일 원본 원칙. 기록 당시 닉네임을 보여준 지금 동작은 JSONL에 통째로 쓰던 구조의 부산물이었다. 사용자 선택.

## D09. 플레이어 식별자와 인증 컬럼
- **Chosen**: `players.id` = deviceId(`dev_...`) 또는 Entra `oid`(TEXT PK). `auth_provider`(`'device' | 'entra'`)와 `email`(NULL 허용)을 미리 둔다. `avatar_url`은 두지 않는다. 기기 계정과 Entra 계정은 별개의 플레이어이고, 연결하거나 합치지 않는다.
- **Rationale**: 사용자는 접속 시 "기기+닉네임" 또는 "Entra" 중 하나를 고르는 구조를 원한다. 두 ID 형식은 겹치지 않는다.
- `GAME_BEGIN`의 참가자 중 `players` 행이 없는 `deviceId`가 있으면 `GAME_BEGIN_REJECTED`로 거절한다. 자동 생성 닉네임(`맥주고수_xxxx`)은 없앤다. 근거: 폰(`CONTROLLER_PAIRED`)과 마우스(`LOCAL_PLAYER_REGISTERED`) 모두 서버에 등록돼야 슬롯에 앉고, PC는 확인된 프로필 없이 `GAME_BEGIN`을 보내지 않는다. 자동 닉네임은 옛 제출 경로가 미등록 기기를 받던 시절의 대비책이었다. (계획 단계 2026-11-08 사용자 질문으로 정리)

## D10. 스토어 구조
- **Chosen**: `server/db/GameDatabase.ts`가 연결을 하나 갖고 PRAGMA(`journal_mode=WAL`, `foreign_keys=ON`), 스키마 생성, 트랜잭션을 담당한다. `PlayerStore(db)`와 `PlayRecordStore(db)`에 주입한다. 테스트는 `new GameDatabase(':memory:')`를 쓴다. 기존 공개 메서드 시그니처는 유지하고, 새 메서드(`beginGame`, `chooseWeapon`, `abandonGame`, `abandonPlayingInRoom`, `abandonAllPlaying`)를 추가한다.
- **Rationale**: 한 파일에 연결 두 개를 두거나 스키마 책임이 흩어지는 것을 막는다. 생성자 변경은 불가피하므로 테스트의 생성 부분만 일괄 수정한다. 사용자 선택.

## D11. 타입과 무결성 (코드 근거로 확정)
- **Chosen**:
  - `duration_sec`, `game_waves.seconds`는 `REAL`이다. 실데이터가 `329.95`, `33.67`이다.
  - `accuracy`는 `REAL`, 0~1 비율이다(%가 아니다. `types.ts`의 `/** 0..1 */`).
  - `weapon_level`은 `CHECK(weapon_level BETWEEN 1 AND 4)`이다(`WeaponLevel = 1|2|3|4`).
  - 유니크: `game_players(game_id, slot)`, `(game_id, player_id)`, `game_waves(game_id, wave_num)`, `game_player_card_picks(game_player_id, pick_order)`
  - 협동 팀 랭킹용으로 `games.team_key`(정렬한 두 player id를 `|`로 연결, 솔로는 NULL)를 `GAME_BEGIN` 때 채운다. 지금 `TeamRankingEntry.teamKey`와 같은 규칙이다.
  - FK의 `ON DELETE`: `games` 삭제는 하위 행까지 CASCADE. `players` 삭제는 RESTRICT(기본값). 한 플레이어를 지워 협동 판의 절반이 사라지는 것을 막는다.
  - 시각은 ISO 8601 TEXT(`new Date().toISOString()`)로 서버가 넣는다. 기존 `playedAt` 정렬 규칙과 같다.

## D12. 마우스 플레이어 닉네임 고정 및 슬롯 ID 기록
- **Chosen**:
  - 마우스 슬롯을 고르면 PC가 자기 `deviceId`(PC 브라우저 localStorage)로 서버에 조회한다. 폰의 `DEVICE_CHECK`/`AUTH_RESULT`와 같은 방식이다. 등록된 플레이어면 입력 없이 그 닉네임으로 슬롯에 앉고, 처음이면 입력 폼을 띄운다. 기존 사용자는 "닉네임 변경"으로 바꿀 수 있다.
  - 브라우저 localStorage의 `beer_crusher_mouse_nickname`은 제거한다. 닉네임 원본은 DB `players.nickname` 하나다.
  - 서버는 `REGISTER_LOCAL_PLAYER`(또는 조회 성공) 때 `session.localPlayers[slot] = deviceId`를 기록한다. `GAME_BEGIN`의 참가자는 서버가 아는 값(폰은 `session.controllers[slot].deviceId`, 마우스는 `session.localPlayers[slot]`)과 대조하고, 다르면 거절한다.
- **Rationale**: 지금 마우스는 매번 닉네임을 다시 제출해야 하고(`QRPairingModal`), 서버는 마우스 슬롯의 `deviceId`를 기억하지 않아 검증 기준이 없다. 식별 단위는 당분간 브라우저(`deviceId`)일 수밖에 없다. 사람 단위 식별은 Entra 연동 후 PC와 폰 각각의 MS 로그인으로 해결한다. 사용자 선택.
- **폰 닉네임 변경**(2026-11-08 추가): 이미 등록된 폰의 환영 화면(`LoginAndPermissionGate`)에도 "닉네임 변경"을 둔다. 서버는 기존 `REGISTER_NICKNAME`(upsert)을 그대로 쓴다.
- **알려진 한계**: 공용 PC에서는 여러 사람이 하나의 `players` 행을 공유한다(닉네임 변경 시 과거 기록 표시도 바뀐다, D08). Entra 연동 전까지 감수한다.

---

## 최종 스키마 DDL

```sql
CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,                -- deviceId 또는 Entra oid
  nickname      TEXT NOT NULL CHECK(length(nickname) BETWEEN 2 AND 10),
  auth_provider TEXT NOT NULL DEFAULT 'device' CHECK(auth_provider IN ('device', 'entra')),
  email         TEXT,
  last_seen_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id         TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK(mode IN ('solo', 'coop')),
  player_count    INTEGER NOT NULL CHECK(player_count IN (1, 2)),
  team_key        TEXT,                          -- coop만. 정렬한 player id 2개를 '|'로 연결
  ruleset_version INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'playing' CHECK(status IN ('playing', 'finished', 'abandoned')),
  -- 종료 시 채움
  outcome         TEXT CHECK(outcome IS NULL OR outcome IN ('VICTORY', 'GAMEOVER')),
  total_score     INTEGER,                       -- solo: 개인 점수, coop: teamScore
  wave_reached    INTEGER,
  lives_left      INTEGER,
  duration_sec    REAL,
  started_at      TEXT NOT NULL,
  ended_at        TEXT,                          -- finished/abandoned 시각
  CHECK (status <> 'finished' OR (outcome IS NOT NULL AND total_score IS NOT NULL
         AND wave_reached IS NOT NULL AND duration_sec IS NOT NULL AND ended_at IS NOT NULL)),
  CHECK ((mode = 'coop') = (team_key IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS game_players (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id         INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id       TEXT NOT NULL REFERENCES players(id),
  slot            INTEGER NOT NULL CHECK(slot IN (1, 2)),
  input_kind      TEXT CHECK(input_kind IS NULL OR input_kind IN ('mobile', 'mouse')),
  weapon_kind     TEXT CHECK(weapon_kind IS NULL OR weapon_kind IN ('shotgun', 'revolver', 'gatling')), -- WEAPON_CHOSEN
  weapon_level    INTEGER CHECK(weapon_level IS NULL OR weapon_level BETWEEN 1 AND 4),
  -- 아래는 본인 제출 시 채움 (NULL = 미제출)
  submitted_at    TEXT,
  score           INTEGER,
  base_score      INTEGER,
  time_bonus      INTEGER,
  precision_bonus INTEGER,
  level_bonus     INTEGER,
  kills           INTEGER,
  accuracy        REAL CHECK(accuracy IS NULL OR accuracy BETWEEN 0 AND 1),
  max_combo       INTEGER,
  damage_taken    INTEGER,
  healed_lives    INTEGER,
  items_collected INTEGER,
  left_early      INTEGER NOT NULL DEFAULT 0 CHECK(left_early IN (0, 1)),
  shots_perfect   INTEGER,
  shots_great     INTEGER,
  shots_good      INTEGER,
  shots_miss      INTEGER,
  cards_damage_up      INTEGER,
  cards_skill_cooldown INTEGER,
  cards_fever_extend   INTEGER,
  cards_hit_zone_up    INTEGER,
  CHECK (submitted_at IS NULL OR (score IS NOT NULL AND kills IS NOT NULL AND accuracy IS NOT NULL)),
  UNIQUE (game_id, slot),
  UNIQUE (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS game_waves (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id      INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  wave_num     INTEGER NOT NULL,
  seconds      REAL NOT NULL,
  bonus        INTEGER NOT NULL,
  damage_taken INTEGER,                        -- D06, 판 단위
  UNIQUE (game_id, wave_num)
);

CREATE TABLE IF NOT EXISTS game_player_card_picks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  game_player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  pick_order     INTEGER NOT NULL,             -- cardPicks 배열 인덱스
  wave_num       INTEGER NOT NULL,
  card_kind      TEXT NOT NULL CHECK(card_kind IN (
    'weapon_level_up', 'rapid_reload', 'bar_repair', 'fever_boost', 'lucky_drop',
    'damage_up', 'skill_cooldown', 'fever_extend', 'hit_zone_up')),
  mid_wave       INTEGER NOT NULL CHECK(mid_wave IN (0, 1)),
  auto_picked    INTEGER NOT NULL CHECK(auto_picked IN (0, 1)),
  UNIQUE (game_player_id, pick_order)
);

CREATE INDEX IF NOT EXISTS idx_games_rank ON games(ruleset_version, mode, status, total_score DESC, ended_at);
CREATE INDEX IF NOT EXISTS idx_games_team ON games(ruleset_version, team_key) WHERE mode = 'coop';
CREATE INDEX IF NOT EXISTS idx_games_room_playing ON games(room_id) WHERE status = 'playing';
CREATE INDEX IF NOT EXISTS idx_game_players_player ON game_players(player_id);
```

## 랭킹 쿼리 규칙 (기존 동작 유지)
- `getTopRuns(5)`: 솔로, `finished`, 현재 규칙 버전. 판 단위로 `total_score DESC`, 동점이면 `ended_at ASC`. 같은 플레이어가 여러 번 올라갈 수 있다(현재와 같다).
- `getTopTeams(5)`: 협동, `finished`, 현재 규칙 버전, `team_key`별 최고 `total_score` 판 하나. 동점이면 `ended_at ASC`. 멤버는 slot 1, 2 순서로 `players.nickname` 조인, `score`/`weapon_kind`/`input_kind`는 미제출이면 생략한다.
- `getTopRankings` (`PlayerStore`): D07의 `bestScore > 0`인 플레이어. 동점이면 `last_seen_at ASC`.

## 범위 밖 (이번에 하지 않음)
- 레거시 JSON/JSONL 이관 (D01)
- 기기 계정과 Entra 계정 연결/병합, Entra 로그인 자체 (D09). 연동 시 PC 마우스 플레이어는 PC에서, 폰 플레이어는 폰에서 MS 로그인한다.
- 클라이언트 조작에 대한 근본적인 신원 검증 (브라우저 `deviceId`의 한계, Entra 연동 때 해결)
- 판 이어하기
