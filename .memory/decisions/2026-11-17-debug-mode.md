# Decisions: 디버그 모드 (무적 테스트 플레이, 랭킹 미등록)

- Date: 2026-11-17
- Status: Confirmed

## D01. 진입 방식
- **Chosen**: PC 화면 URL 파라미터 `?debug=1`로 켠다. 운영 배포(VM)에서도 동작한다.
- **Rationale**: 실제 휴대폰 컨트롤러로 배포 환경에서 테스트해야 한다. 디버그 판은 랭킹에 들어가지 않으므로 URL이 알려져도 랭킹은 오염되지 않는다.

## D02. 무적 규칙
- **Chosen**: 몬스터가 방어선에 닿아도 목숨이 줄지 않는다. 몬스터는 평소처럼 사라지고 피격 연출은 나온다. 피격 수(`damageTaken`, 웨이브별 `waves[].damageTaken`)는 평소처럼 센다. EX의 DANGER 구간 피격도 센다. 2인은 공유 목숨이므로 무적 하나로 둘 다 적용된다.
- **Rationale**: 사용자가 자기 실력 기준으로 "실제였다면 어디서 죽었을지"를 보고 난이도를 조절하려 한다.

## D03. 기록 저장과 랭킹 제외
- **Chosen**: 디버그 판도 일반 판과 똑같이 저장한다(GAME_BEGIN, 점수 제출, EX 체크포인트·최종 갱신 포함). `games.is_debug INTEGER NOT NULL DEFAULT 0` 컬럼을 추가해 디버그 판은 1로 저장하고, 모든 랭킹 쿼리(solo·무기별·coop 팀)에 `AND is_debug = 0`을 붙인다.
- **Rationale**: 점수와 피격 데이터는 필요하지만 랭킹에는 보이면 안 된다. `ruleset_version`에 다른 값을 넣는 방식은 의미가 섞여 제외했다.

## D04. 스키마 마이그레이션
- **Chosen**: `SCHEMA_VERSION`을 2로 올리고, `GameDatabase`가 `user_version < 2`일 때만 `ALTER TABLE games ADD COLUMN is_debug INTEGER NOT NULL DEFAULT 0`을 실행한다. schema.ts의 CREATE 문에도 같은 컬럼을 넣는다(새 DB용).
- **Rationale**: `CREATE TABLE IF NOT EXISTS`는 운영 DB의 기존 테이블을 건너뛰므로 컬럼이 생기지 않는다. 기존 행은 DEFAULT 0으로 채워진다. 버전 분기로 앞으로의 마이그레이션도 같은 틀을 쓴다.

## D05. 시작 조건 (디버그 패널에서 선택)
- **Chosen**: 시작 지점 W1 / W6 / EX 바로 진입, 무기 Lv.1~4, 카드별 스택(0~3, `hitZoneUp`은 0~2)을 패널에서 고른다. 처음 값은 시작 지점별 프리셋으로 채운다(W1 → Lv.1·카드 0, W6 → Lv.3·주요 카드 2스택, EX → EX D04 MAX). 마지막 선택은 localStorage에 기억한다(try/catch). 2인은 두 사람 모두 같은 조건을 쓴다. 무기 종류는 기존 로비 선택을 그대로 쓴다.
- **Rationale**: 매번 URL을 고치지 않고 PC 화면에서 바로 바꿀 수 있어야 한다. 사용자가 강화 상태를 직접 정하기를 원했다.

## D06. 로비 배치
- **Chosen**: 기존 로비(`QRPairingModal`)를 그대로 쓰고, 디버그 모드일 때 상단에 `DEBUG MODE · 랭킹 미등록` 배지를 달고 `RankingTabs` 자리를 디버그 패널로 바꾼다. 패널 탭은 [시작 조건]과 [최근 기록]이다. 높이는 기존 고정값(290/350px)을 따른다. QR·슬롯·2P 연결 흐름은 바꾸지 않는다.
- **Rationale**: 2P 연결을 다시 만들 필요가 없고, 디버그 중에는 랭킹이 쓸모없으므로 그 자리를 쓴다.

## D07. 기록 보기
- **Chosen**:
  - 결과 화면: `DEBUG · 랭킹 미등록` 배지, 피격 총합, 웨이브·DANGER별 피격을 추가로 보여준다.
  - 디버그 패널 [최근 기록]: 최근 디버그 판 10개(점수, 피격, 도달 웨이브/DANGER, 1P/2P, 무기, 시작 조건)를 보여준다. 서버에 디버그 기록 조회 WS 메시지를 새로 만든다.
  - 누적 분석은 서버 DB를 직접 조회한다(`WHERE is_debug = 1`).
- **Rationale**: 판마다 바로 보고, 여러 판을 비교해 난이도를 조절한다.

## D08. 인게임 표시
- **Chosen**: 디버그 판 HUD 구석에 작은 `DEBUG · 무적` 표시를 붙인다.
- **Rationale**: 일반 판과 헷갈리지 않게 한다.

## 참고 (계획 단계에서 확인)
- `is_debug`는 GAME_BEGIN에 실어 보내고 서버가 그대로 믿는다. 값이 랭킹에서 빼는 방향으로만 작용하므로 위조해도 위험하지 않다.
- 디버그 판의 시작 조건(시작 지점·레벨·카드)을 [최근 기록]에 보여주려면 저장 위치가 필요하다(예: `games.debug_config` TEXT JSON 또는 클라이언트 표시만). 계획 단계에서 정한다.
- 기존 SANDBOX(`?mode=test`)와 `__BEER_DEBUG__`(DEV 전용 snapshot)는 그대로 둔다.
