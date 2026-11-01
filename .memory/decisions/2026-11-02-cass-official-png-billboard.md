# Decisions: 카스 병맥주 공식 정품 투명 PNG 기반 실사 3D 빌보드 타겟 구현 (Cass Official PNG Billboard)

- Date: 2026-11-02
- Status: Confirmed

## D01. 카스 병맥주 3D 타겟 모델 비주얼 방식
- **Chosen**: 정품 투명 배경 700×700 RGBA PNG 에셋([`public/textures/cass_official_veluga.png`](file:///Users/bigtree/Git/ob-crash-game/public/textures/cass_official_veluga.png))을 활용한 3D 실사 빌보드 타겟
- **Rationale**:
  - 3D 폴리곤 회전체 방식은 단색 액체 셰이더와 라벨 매핑의 한계로 인해 아무리 다듬어도 플라스틱 페트병이나 환타/탄산음료 병 느낌이 남을 수밖에 없었음.
  - 사용자가 확인한 벨루가 공식 DB 정품 투명 PNG는 맑은 투명 유리목 굴절, 은색 톱니 주름 뚜껑, 정품 V-컷 CASS FRESH 라벨, 하단 크리스탈 양각 조각, 깊고 맑은 황금빛 호박색 맥주가 100% 실물 그대로 담겨 있어 시각적 완성도와 타겟 식별력이 압도적임.

## D02. 피격·사망·상태이상 3D 전투 VFX 연동
- **Chosen**: 기존의 모든 3D 물리 파티클 연출과 상태이상 이펙트를 100% 온전히 유지 및 결합
- **Rationale**:
  - 타겟 몸체는 정면 카메라를 바라보는 고화질 실사 빌보드로 렌더링하되,
  - 피격 시 0.15초간 하얗게 번쩍이는 타격 플래시(`Hit Flash`) 및 스쿼시 물리 연동,
  - 3타 격파 시 병이 사라지는 3D 월드 좌표에서 은색 3D 왕관 뚜껑 솟구침 + 16개 3D 유리 파편 비산 + 24개 황금빛 맥주 분수 파티클 뿜어짐("뻥!" 오픈 사운드) 연동,
  - 아이스 프리즈 발밑 3D 회전 얼음 링(`frostRing`) + 몸체 서리 틴트(`0x93c5fd`),
  - 빅 스코프 머리 위 회전 홀로그램 록온 마커(`lockOnMarker`),
  - 지상 접지 바운스 물리 및 바닥 고정 원형 그림자(`DropShadow`)를 완벽히 연동함.

## D03. 도감 스튜디오 동기화 및 공식 도감 스크린샷 갱신
- **Chosen**: `docs/monster-studio.html`에 공식 정품 PNG 빌보드를 동기화하고 Playwright 자동 캡처로 도감 설명서 및 인게임 화면 전면 갱신
- **Rationale**: 도감 단독 컷(`monster-05-cass-bottle.png`), 6종 풀 라인업(`monster-lineup-all.png`), 그리고 인게임 전투 화면(`screen-04-pc-gameplay.png`)을 최신 실물 퀄리티로 일치시킴.
