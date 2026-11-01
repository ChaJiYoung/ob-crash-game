# Decisions: Intuitive Item Visuals, 3D Floating Pop Effect & Status VFX

- Date: 2026-11-01
- Status: Confirmed

## D01. 평소 전장 내 아이템 시인성 표시 방식
- **Chosen**: 평소 텍스트 미표시, 3D 소품 + 발광 오라 링 유지 (Clean Prop with Glowing Aura)
- **Rationale**: 평소 전장이 글자로 지저분해지거나 시야가 가려지지 않도록, 날아오는 동안에는 텍스트 없이 3D 소품과 고유 색상 발광 토러스 오라 링만 깔끔하게 유지.

## D02. 아이템 사격 명중·획득 시 피드백 연출
- **Chosen**: 피격 순간 3D 월드 좌표에서 라벨 플로팅 솟구침 & 페이드아웃 (On-Hit Float-Up & Fadeout)
- **Rationale**: 화면 중앙을 가리는 커다란 2D UI 팝업을 전면 배제하고, 아이템을 격추한 바로 그 3D 월드 좌표에서 작고 선명한 영문 숏라벨(`💥 DAMAGE 2X`, `🎯 WIDE 1.6X`, `🧊 SLOW 50%`, `🍺 LIFE +1`)이 위로 0.8초 동안 뿅 솟구치며(Y축 상승 및 투명도 감소) 소멸하는 아케이드 플로팅 텍스트 연출 적용.

## D03. 아이템 4종 실시간 3D 상태 효과 (Visual Status Effects)
- **Chosen**: 4종 풀 3D 상태 효과 세트 (Full In-Game Visual Transformations)
- **Rationale**: 버프가 활성화되어 있는 동안 플레이어가 전황과 능력을 온몸으로 체감할 수 있도록 전장과 총기에 직관적인 3D 비주얼 변화를 부여.
  1. 💥 **파워 샷 (Power Shot)**:
     - 3D 총기(생맥주 탭 건)가 황금빛 '골든 드래프트 캐논'으로 진화 (`DraftTapGun3D`).
     - 총구에 붉은색 타오르는 화염 오라 점등 및 격발 시 굵은 크림슨 레이저 빔 발사.
  2. 🧊 **아이스 프리즈 (Ice Freeze)**:
     - 전장의 모든 몬스터 전신에 푸른색 얼음/서리 코팅(Frost Overlay / Ice Tint) 적용.
     - 몬스터 발밑에서 차가운 냉기 연기 파티클 발생 및 50% 느린 모션.
  3. 🎯 **빅 스코프 (Wide Scope)**:
     - 88px ➔ 140px 조준경 확대와 함께, 총구 전방에 미래형 홀로그램 조준 빔 전개.
     - 시야 내 모든 몬스터 머리 위에 푸른색 록온(Lock-On) 마커 타겟팅 표시.
  4. 🍺 **바 수리 (Bar Repair)**:
     - 획득 즉시 1.8m 원목 바 카운터 방어선에 에메랄드빛 치유 펄스(Green Shield Pulse) 파동이 촤르륵 확산되며 체력 복구 연출.
