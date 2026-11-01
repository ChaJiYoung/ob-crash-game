# Decisions: 카스 병맥주 공식 PNG 트루 컬러 1:1 복원 (Cass PNG True Color)

- Date: 2026-11-02
- Status: Confirmed

## D01. 카스 병맥주 빌보드 렌더링 머티리얼 방식
- **Chosen**: `THREE.MeshBasicMaterial` 적용을 통한 원본 PNG 무보정 1:1 본래 색상(트루 컬러) 출력
- **Rationale**:
  - 공식 실사 사진 PNG는 이미 촬영 조명, 유리 반사광, 하이라이트, 액체 음영이 픽셀에 모두 구워져(Bake) 있습니다.
  - 기존의 `MeshStandardMaterial`은 씬의 강한 3D 직사광(KeyLight 1.8), 황금빛 포인트 라이트(TopGoldLight 2.0), 톤매핑 노출(1.35x)을 중복으로 받으면서 맥주와 라벨이 과포화(Overexposed)되어 샛노랗고 쨍하게 타버리는 문제가 있었습니다.
  - 외부 광원의 영향을 받지 않는 `MeshBasicMaterial`로 전환하여 사용자가 제공한 벨루가 공식 원본 PNG 그대로의 맑고 자연스러운 투명 유리목과 카스 블루 라벨, 맥주 색상을 왜곡 없이 표시합니다.

## D02. 피격·상태이상·격파 3D 전투 VFX 호환성
- **Chosen**: `MeshBasicMaterial`의 `color` 속성을 활용한 피격/상태이상 효과 100% 유지
- **Rationale**:
  - `MeshBasicMaterial` 역시 `color` 속성(`THREE.Color`)을 보유하고 있으므로, 아이스 프리즈 시 푸른빛 서리 틴트(`0x93c5fd`) 및 피격 플래시(`applyTargetHitFlash3D`)를 그대로 적용할 수 있습니다.
  - 3타 격파 시 은색 크라운 뚜껑 솟구침 + 16개 유리 파편 비산 + 24개 맥주 분수 파티클은 내부 투명 앵커 메쉬(`crownCap`, `neckLabel`)를 통해 완벽히 작동합니다.

## D03. 몬스터 스튜디오 및 공식 스크린샷 전면 동기화
- **Chosen**: `docs/monster-studio.html`에 `MeshBasicMaterial`을 동기화하고 Playwright 자동 캡처로 도감 단독 컷(`monster-05-cass-bottle.png`), 라인업(`monster-lineup-all.png`), 인게임 화면(`screen-04-pc-gameplay.png`)을 전면 재캡처
- **Rationale**: 몬스터 스튜디오와 인게임 전반에서 쨍함 없는 편안하고 선명한 실물 카스 맥주병 화면을 공식 문서에 일치시킵니다.
