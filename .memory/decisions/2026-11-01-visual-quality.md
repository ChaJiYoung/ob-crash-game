# Decisions: Visual Quality Upgrade (실물 제품 라벨, 실사 펍 배경, 아이템 비주얼)

- Date: 2026-11-01
- Status: Confirmed
- Related: `2026-11-01-visual-enhancement.md` (스케일/조준경/탄도), `2026-11-01-gameplay-systems.md` (아이템 4종 규칙)

## D01. 몬스터 라벨 에셋 소스
- **Chosen**: 웹 검색 제품 이미지를 개인 플레이용으로 사용. 에이전트가 실행 단계 첫 Task에서 직접 수집.
- **Rationale**: 공식 디자인 파일 확보 불가. 사용자 1인 개인 플레이 용도로 한정.
- **세부 규칙**:
  - 저장 경로: `public/textures/labels/{pilgood|caslight|obi|hanmac|mug|boss}.jpg`
  - `.gitignore`에 넣지 않고 저장소에 커밋 (사용자 명시 요청)
  - 이미지별 원본 URL을 `public/textures/labels/SOURCES.md`에 기록
  - 수집 실패 / 저해상도 브랜드는 브랜드 컬러 기반 자체 라벨(Canvas 생성)로 폴백. 경로 동일 → 파일 교체만으로 갱신 가능
- **제약(사용자 고지 완료)**: 정면 사진은 라벨이 약 1/3만 보이므로 캔 회전 시 측·후면 왜곡 가능 → 정면이 카메라를 향하도록 회전 범위 제한으로 완화

## D02. 몬스터 3D 모델 고도화 (자동 확정)
- **Chosen**:
  - 캔: `LatheGeometry`로 실제 캔 프로파일(상하단 테이퍼, 림) 재모델링 + 라벨 텍스처 + `MeshPhysicalMaterial` 알루미늄
  - 500ml 생맥주잔: `MeshPhysicalMaterial`의 `transmission`(투과)·`ior`(굴절률)로 실제 유리 표현
  - 보스 냉각기: 기존 절차적 모델 유지 + 전면 패널에 웹 이미지 텍스처 적용
  - 결로(물방울) 노멀/러프니스 디테일 추가
- **Rationale**: 현재 품질 저하의 핵심 원인이 기본 도형 + 글자만 있는 Canvas 라벨 + 환경 반사 부재이므로 셋 모두 해결.

## D03. 배경(펍 무대)
- **Chosen**: 실사 펍 HDRI 배경 + 플레이어 앞 3D 소품(원목 바 카운터, 탭 타워, 바닥 그림자) + Bloom 후처리
- **Rationale**:
  - Poly Haven CC0(상업 이용 가능, 라이선스 무관) 실내 바/펍 HDRI를 `scene.background`와 `scene.environment`에 동시 사용 → 배경 실사화 + 금속·유리 반사 동시 해결
  - `three/examples/jsm`의 `EffectComposer` + `UnrealBloomPass`로 네온·총구 화염·피버 발광 (추가 패키지 불필요)
  - 실시간 그림자(`renderer.shadowMap`) 활성화
- **자동 확정**: HDRI 해상도 2K(`.hdr`), 저장 경로 `public/hdri/`. 사용자 환경이 Mac 단일 PC이므로 품질 단계 선택 UI는 두지 않음.

## D04. 아이템 4종 비주얼
- **Chosen**: 오비 펍 소품형 아이템 + 종류별 색상 오라 + 회전 연출
  - 💥 파워 샷: 황금 병따개 + 붉은 오라
  - 🎯 빅 스코프: 맥주 코스터 표적판 + 하늘색 오라
  - 🧊 아이스 프리즈: 얼음 버킷 + 냉기 파티클 + 흰·파란 오라
  - 🍺 바 수리: 홉 열매 다발 + 초록 오라
- **Rationale**: 몬스터(캔·잔)와 실루엣이 확실히 구분되면서 펍 세계관과 일치. 추가 이미지 수집 없이 절차적 모델로 제작 가능.
