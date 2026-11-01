# Decisions: 실제 '올 뉴 카스 프레시' 슬림 롱넥 3D 유리병 및 정품 V-컷 라벨/넥라벨 정밀 재구현 (Real Cass Fresh Long-neck Bottle)

- Date: 2026-11-02
- Status: Confirmed

## D01. 카스 병맥주 3D 지오메트리 및 라벨 매핑 방식
- **Chosen**: 슬림 롱넥 3D 유리병(`LatheGeometry` 곡선 실루엣) 체형 교정 + 사용자 제공 실제 `Cass Fresh` V-컷 바디 라벨 & `COLD BREWED` 넥 라벨 분리 정밀 매핑 (Option 1)
- **Rationale**:
  - 기존 3D 병 모델은 반지름이 넓고 짧은 원기둥 조합에 불투명한 노란 액체가 병목 끝까지 차 있어 맥주병다운 실루엣이 나오지 않았고, 잘못 다운로드된 체커보드 흑백 로고가 합성되어 있었음.
  - 사용자가 제시한 실제 '올 뉴 카스 프레시(All New Cass Fresh)' 투명병 사진과 동일한 **날씬한 롱넥 곡선 비율(`LatheGeometry`)**, **목 상단 투명 유리 공간(Headspace)**, **깊은 황금빛 앰버 맥주 액체**, **하단 크리스탈 엠보싱 디테일**을 구현함.
  - 바디 라벨(상단 V-컷 블루 메탈릭, 대각선 `Cass` + `Fresh`, 육각형 눈꽃 온도 센서, `COLD BREWED` 골드 밴드)과 넥 라벨(육각형 눈꽃 아이콘 + `COLD BREWED` 골드 하단 밴드)을 **각각 전용 텍스처로 분리 제작·매핑**하여 목 부분에 바디 라벨이 중복해서 감기는 왜곡을 원천 해결함.

## D02. 스튜디오 동기화 및 시각적 검증(Visual Verification)
- **Chosen**: `TargetModels3D.ts`와 `docs/monster-studio.html` 양쪽에 동일한 슬림 롱넥 카스 프레시 3D 모델 및 분리형 라벨을 적용하고, 스크린샷 캡처 후 실제 이미지 파일을 시각적으로 검수함.
- **Rationale**: 코드와 수치만 확인하고 넘어갈 경우 텍스처 불량이나 비율 왜곡을 놓칠 수 있으므로, 캡처된 `monster-05-cass-bottle.png`와 `monster-lineup-all.png`를 직접 열어 참조 이미지와의 일치 여부를 검증함.
