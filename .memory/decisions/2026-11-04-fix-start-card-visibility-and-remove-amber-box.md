# Decisions: Fix Start Card Visibility & Remove Amber Box

- Date: 2026-11-04
- Status: Confirmed

## D01. 펍 배경의 불필요한 주황색 상자(`amberSignMesh`) 제거
- **Chosen**: 상자 메쉬 완전 삭제 (주황색 네온 포인트 라이트 조명만 유지)
- **Rationale**: 
  - `BreweryStage3D.ts`에 글씨나 텍스처 없이 배치되어 있던 민무늬 주황색 직사각형 메쉬(`amberSignMesh`, `BoxGeometry(4.2, 0.8, 0.1)`)가 시각적 버그처럼 느껴지고 불필요하다는 사용자 결정에 따라 씬에서 완전히 제거합니다.
  - 공간의 따뜻한 펍 분위기를 형성하는 포인트 라이트(`amberNeon`)는 유지하여 조명 품질 저하는 방지합니다.

## D02. `GameCanvas3D` 좀비 애니메이션 루프 차단 및 씬-타겟 메쉬 동기화 정상화
- **Chosen**: 클린업 시 `cancelAnimationFrame(animId)` 호출 및 활성 씬 부모 일치 검증(`!mesh || mesh.parent !== scene`) 적용
- **Rationale**: 
  - `GameCanvas3D.tsx`의 언마운트 클린업 함수에서 `animId = 0`만 할당하고 브라우저 rAF를 취소하지 않아, React 18 StrictMode 환경에서 첫 번째 씬의 좀비 루프가 백그라운드에 남아 공용 캐시(`targetMeshMapRef`)에 카드를 선점 등록했습니다.
  - 이로 인해 실제 화면에 출력되는 두 번째 씬은 카드를 추가하지 않아 화면에 카드가 전혀 노출되지 않는 심각한 렌더링 버그가 발생했습니다.
  - 클린업 시 `cancelAnimationFrame(animId)`을 명시적으로 호출하고, 타겟 메쉬를 씬에 등록할 때 `!mesh || mesh.parent !== scene`을 확인하여 활성 씬에 3D 카드 메쉬(맥주관 뚫어뻥, 황금 병따개, 탄산 탭 개틀링) 3장이 무조건 렌더링되도록 복원합니다.
