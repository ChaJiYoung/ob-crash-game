# Task: T01 인게임 가이드 모달(3탭), 3단계 인터랙티브 튜토리얼, 샌드박스 모듈 제어판, 결과 모달 및 공식 마크다운 문서(6종) 전면 개편

## Status: done

## Goal
`GuideModal.tsx`, `TutorialGuideOverlay.tsx`, `ResultRankingModal.tsx`, `SensorAndModuleTestLabOverlay.tsx`, `PCGamePage.tsx` 및 6종의 공식 가이드 문서(`README.md`, `docs/무기_및_스킬_가이드.md`, `docs/몬스터_도감_설명서.md`, `docs/튜토리얼_훈련장_가이드.md`, `docs/비어 크러셔 요구사항 분석서.md`, `docs/비어 크러셔 상세설계서.md`)를 전면 개편하여, 변경된 전투 판정(0.8x/1.0x/1.5x 데미지 배율 & MISS 페널티 폐지), 콤보 제거 및 피버 규칙(PERFECT·처치 충전 & 2배 화력), 킬 게이지 보상 카드(전장 일시정지 & 행운의 보급품 패시브 카드), 보스 10m 정지 & 탭 레버 미니웨이브 소환, 모바일·PC 공통 홀드 자동 연발(`투두두두`), 100% 연속 게이지 체력바가 인게임 가이드·튜토리얼·샌드박스 테스트 랩·공식 문서 전체에 100% 일치하도록 완성한다.

## Decision Summary
- **D07 & D08**:
  1. `GuideModal.tsx`의 3개 탭(`weapons`, `monsters`, `cards_controls`)에 최신 무기 데미지 수치, 명중 정밀도 데미지 배율(`PERFECT 1.5x / GREAT 1.0x / GOOD 0.8x`), 100% 연속 게이지 체력바, 냉각기 보스 10m 정지 & 탭 레버 미니웨이브 소환, 킬 게이지 보상 카드 5종(신규 `🍀 행운의 보급품` 및 `🍺 바리케이드 완전 복구` 100% 회복 + 최대 체력 +1 확장), 적 처치 아이템 드롭, 홀드 자동 연발(`투두두두`), `PERFECT`/`처치` 기반 피버 충전을 상세히 반영한다.
  2. `TutorialGuideOverlay.tsx`의 3단계 인터랙티브 사격 훈련장 안내를 개편하여, Step 1에서 정밀도 데미지 배율(`1.5x/1.0x/0.8x`)과 `GREAT` 이상 1HP 원샷을 배우고, Step 2에서 **모바일 화면 홀드 / PC 마우스 좌클릭 홀드 자동 연발(`투두두두`)**과 **100% 연속 체력 게이지 바**를 체감하며, Step 3에서 구버전 콤보 보존 문구를 제거하고 **`PERFECT(+8%)`·`처치(+12%)` 피버 충전 & 4초 무한 연사·2배 데미지** 및 **킬 게이지 카드·액티브 스킬**을 익히도록 한다.
  3. `SensorAndModuleTestLabOverlay.tsx` 및 `PCGamePage.tsx`에 **3종 무기 전환/레벨업**, **3D 보상 카드 3장 즉시 스폰**, **보스 미니웨이브 소환 테스트** 버튼을 추가하고, `ResultRankingModal.tsx`에서 구버전 `'최대 콤보'` 라벨을 `'누적 격파 (KILL)'` (`{maxCombo} KILL`)로 개편한다.
  4. `README.md` 및 `docs/*.md` 공식 문서 6종의 모든 구버전 설명과 수치표를 최신 v2.2 사양으로 일괄 동기화한다.

## Implementation

### I01. 인게임 가이드 모달 3탭·인터랙티브 튜토리얼·샌드박스 테스트 랩·결과 모달 개편 (`GuideModal.tsx`, `TutorialGuideOverlay.tsx`, `SensorAndModuleTestLabOverlay.tsx`, `PCGamePage.tsx`, `ResultRankingModal.tsx`)

- Related Files:
  - `src/pc/components/GuideModal.tsx` :: `GuideModal` — 3개 탭(`weapons`, `monsters`, `cards_controls`)의 무기 스펙, 정밀도 배율 안내, 몬스터 연속 게이지 체력바 및 보스 미니웨이브 소환, 킬 게이지 카드 5종 및 홀드 연사·피버 규칙 전면 개편; modify
  - `src/pc/components/TutorialGuideOverlay.tsx` :: `TutorialGuideOverlay` — Step 1(정밀도 배율 1.5x/1.0x/0.8x & 원샷), Step 2(홀드 자동 연발 `투두두두` & 100% 연속 체력 게이지), Step 3(PERFECT/처치 피버 충전 & 2배 데미지 난사) 안내 문구 전면 개편; modify
  - `src/pc/components/SensorAndModuleTestLabOverlay.tsx` :: `SensorAndModuleTestLabOverlayProps`, `SensorAndModuleTestLabOverlay` — 무기 아키타입 전환(`shotgun`/`revolver`/`gatling`) 및 레벨업 버튼, 3D 보상 카드 스폰 버튼, 보스 미니웨이브 소환 버튼 추가; modify
  - `src/pc/PCGamePage.tsx` :: `PCGamePage` — `SensorAndModuleTestLabOverlay`에 신규 샌드박스 제어 콜백(`onSelectWeapon`, `onUpgradeWeapon`, `onSpawnRewardCards`, `onSummonBossMinions`) 연결; modify
  - `src/pc/components/ResultRankingModal.tsx` :: `ResultRankingModal` — 중앙 통계 카드를 `'최대 콤보'`에서 `'누적 격파 (KILL)'` (`{maxCombo} KILL`)로 변경; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/pc/components/SensorAndModuleTestLabOverlay.tsx
  export interface SensorAndModuleTestLabOverlayProps {
    // ...기존 props 유지
    weaponKind?: WeaponKind;
    weaponLevel?: WeaponLevel;
    onSelectWeapon?: (kind: WeaponKind) => void;
    onUpgradeWeapon?: () => void;
    onSpawnRewardCards?: () => void;
    onSummonBossMinions?: () => void;
  }
  ```
- **Data & Schema Fields**:
  - `GuideModal`: `GuideTab = 'weapons' | 'monsters' | 'cards_controls'`
  - `TutorialGuideOverlay`: `step: TutorialStep` (`1 | 2 | 3 | 'COMPLETED'`)
  - `SensorAndModuleTestLabOverlayProps`: 신규 선택적(Optional) 프로퍼티 `weaponKind`, `weaponLevel`, `onSelectWeapon`, `onUpgradeWeapon`, `onSpawnRewardCards`, `onSummonBossMinions`
  - `ResultRankingModal`: `maxCombo: number` (엔진/서버 호환용 프로퍼티 명칭은 유지하되 UI 라벨을 `'누적 격파 (KILL)'`로 렌더링)
- **Execution Flow / Logic**:
  1. Precondition & Validation:
     - `GuideModal`, `TutorialGuideOverlay`, `ResultRankingModal`, `SensorAndModuleTestLabOverlay`의 기존 필수 Props 시그니처를 100% 하위 호환 유지한다.
  2. Core Processing:
     - **`GuideModal.tsx` 개편**:
       - **탭 1 (`weapons` — `🔫 3종 무기 & 스킬`)**:
         - 상단에 **`🎯 명중 정밀도 데미지 배율 & 노-미스(No-Miss) 아케이드 판정`** 하이라이트 박스 추가 (`PERFECT 1.5배 & 피버 +8%`, `GREAT 1.0배 정타 — 1레벨 전 무기 기본 캔 원샷!`, `GOOD 0.8배 외곽 스침`, `MISS 페널티 및 배너 완전 폐지`).
         - 무기 3종 데미지 표기 업데이트: 샷건(`0.35×3=1.05 ~ 0.60×6=3.60 DMG`), 리볼버(`1.00 ~ 2.20 DMG`), 개틀링(`0.25 ~ 0.50 DMG`).
       - **탭 2 (`monsters` — `👾 몬스터 6종 도감`)**:
         - 상단 팁을 **`💡 전 몬스터 100% 비례 슬림 게이지 체력바 적용 (피격된 1HP 캔 포함)`**으로 변경.
         - `업소용 냉각기 보스 (HP 60)` 설명을 **전방 10m 정지(방어선 접촉 즉사 폐지) + 상단 황금 생맥주 탭 레버를 당겨 부하 맥주 미니웨이브(4~5마리) 소환 + 보스 격파 시 잔여 부하 연쇄 폭발 및 즉시 VICTORY**로 교체.
       - **탭 3 (`cards_controls` — `🃏 보상 카드 & 조작법`)**:
         - 킬 게이지(`10/14/18/20/15킬`) 달성 시마다 **전투가 즉시 일시정지(Freeze)**되며 3D 보상 카드가 출현함을 명시.
         - 보상 카드 5종(`⬆️ 무기 레벨업`, `⚡ 초고속 장전`, `🍺 바리케이드 완전 복구: 100% 전체 회복 + 최대 체력 +1 영구 확장`, `🔥 피버 부스터`, `🍀 행운의 보급품: 아이템 드롭 빈도 2배/3배/4배 영구 증가`) 및 적 처치 시 드롭되는 필드 아이템 4종(`💥 파워 샷`, `🎯 빅 스코프`, `🧊 아이스 프리즈`, `🍺 바 수리: +1 회복`) 구분 안내.
         - 모바일/PC 조작법에 **화면을 꾸욱 누르고 있거나 마우스 좌클릭 홀드 시 무기별 속도로 `투두두두` 자동 연발**됨을 명시하고, 피버 충전 조건(`PERFECT +8%` / `몬스터 처치 +12%`, 발동 시 4초 무한 연사 & 2.0배 화력)을 반영.
     - **`TutorialGuideOverlay.tsx` 개편**:
       - **Step 1**: `"🎯 [1단계] 정밀 조준 배율(1.5x / 1.0x / 0.8x) & 원샷 실습!"` — 중심 `PERFECT(1.5배)`·`GREAT(1.0배)` 명중 시 1HP 캔 한 방 격파, 외곽 `GOOD(0.8배)` 스침 시 잔여 체력 게이지 표시, `MISS` 페널티 없음 안내.
       - **Step 2**: `"🔫 [2단계] 홀드 자동 연발(투두두두) & 100% 체력 게이지 실습!"` — 스마트폰 화면 홀드 또는 PC 마우스 좌클릭 홀드로 다가오는 4HP 카스 병맥주의 100% 연속 게이지 체력바를 깎아 격파하고 자동 재장전 체험 안내.
       - **Step 3**: `"🔥 [3단계] 피버 타임(PERFECT·처치 충전) & 2배 화력 난사!"` — 구버전 콤보 보존 문구 제거, `PERFECT(+8%)`·`몬스터 처치(+12%)` 피버 충전 및 발동 시 4초 무한 탄창 + 2.0배 데미지 폭딜과 킬 게이지 성장 카드 안내.
     - **`SensorAndModuleTestLabOverlay.tsx` & `PCGamePage.tsx` 개편**:
       - 우측 제어판의 `'무기 및 피버 시험'` 섹션에 3종 무기 전환 버튼(`🪠 샷건`, `🍾 리볼버`, `🍺 개틀링`), `⬆️ 무기 레벨업 (현재 Lv.${weaponLevel})`, `🃏 3D 보상 카드 스폰`, `👑 보스 미니웨이브 소환` 버튼을 추가하고 `PCGamePage.tsx`에서 `engine.weaponSystem.selectWeapon`, `engine.weaponSystem.upgradeWeaponLevel`, `engine.spawnWaveRewardCards`, `engine.spawnBossMinionWave`와 연결한다.
     - **`ResultRankingModal.tsx` 개편**:
       - 중앙 통계 카드의 라벨을 `'최대 콤보'`에서 `'누적 격파 (KILL)'`로, 표시 값을 `{maxCombo} KILL`로 업데이트.
  3. Error & Exception Handling: N/A.
  4. State Transition & Return: 업데이트된 가이드 모달·튜토리얼 오버레이·샌드박스 제어판·결과 모달 JSX 반환.

### I02. 공식 마크다운 가이드 문서 6종 일괄 최신화 (`README.md`, `docs/*.md`)

- Related Files:
  - `README.md` — Arcade v2.2 핵심 하이라이트(정밀도 데미지 배율, 킬 게이지 보상 카드 & 전장 프리즈, 적 처치 아이템 드롭 & 행운의 보급품 카드, 보스 10m 정지 & 탭 레버 미니웨이브 소환, 모바일·PC 홀드 자동 연발, 100% 연속 게이지 체력바) 업데이트; modify
  - `docs/무기_및_스킬_가이드.md` — 무기 3종 Lv.1~4 상향 데미지 수치표(`리볼버 1.00~2.20`, `개틀링 0.25~0.50`, `샷건 1.05~3.60`), 명중 정밀도 데미지 배율(`1.5x/1.0x/0.8x`), 킬 게이지 보상 카드 5종(`행운의 보급품`, `바리케이드 완전 복구` 포함) 및 전장 일시정지 규칙 업데이트; modify
  - `docs/몬스터_도감_설명서.md` — 몬스터 6종 체력바를 100% 연속 게이지 바로 업데이트, 냉각기 보스(60HP)의 10m 안전 정지 & 황금 탭 레버 부하 미니웨이브 소환 메커니즘, 적 처치 시 아이템 드롭(기본 4% + 행운의 보급품 2x/3x/4x) 반영; modify
  - `docs/튜토리얼_훈련장_가이드.md` — 가이드 모달 3탭 설명, 3단계 인터랙티브 사격 훈련장(Step 1 정밀도 배율, Step 2 홀드 자동 연발 & 4HP 병맥주 연속 게이지, Step 3 피버 4초 2배 화력), PC/모바일 홀드 연사 조작 매핑표 및 실전 공략 팁 전면 업데이트; modify
  - `docs/비어 크러셔 요구사항 분석서.md` — FR-WPN, FR-MON, FR-GIM 요구사항 매트릭스를 최신 v2.2 사양으로 동기화; modify
  - `docs/비어 크러셔 상세설계서.md` — 판정 데미지 공식, 피버 충전 수식(`PERFECT +8%`, `Kill +12%`), 킬 게이지 카드 및 보스 미니웨이브 소환 루프 명세 동기화; modify

#### Details
- **Signatures & Types**: 공식 마크다운 문서(SSOT).
- **Data & Schema Fields**: 무기 밸런스 표, 몬스터 도감 스펙 표, 보상 카드 5종 명세, 조작 매핑 표.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 각 문서의 기존 섹션 구조와 이미지 링크(`./screens/...`)를 훼손하지 않고 보존한다.
  2. Core Processing: 문서 내 모든 구버전 표현(`네온 도트 체력바 [■][■]`, `보스 방어선 도달 시 즉시 패배`, `홀드 연사 없음`, `빗나가면 콤보 초기화`, `리볼버 Lv.1 0.75`, `개틀링 Lv.1 0.15`)을 개편된 v2.2 사양으로 교체한다.
  3. Error & Exception Handling: 마크다운 테이블 파이프(`|`) 및 상대 경로 링크 깨짐이 없는지 확인한다.
  4. State Transition & Return: 6종의 공식 문서가 인게임 코드 및 가이드 모달과 100% 일치한다.

### I03. 튜토리얼 및 가이드 통합 검증 (`tests/tutorial-and-guide.test.ts`)

- Related Files:
  - `tests/tutorial-and-guide.test.ts` :: `BeerCrusher 3-Step Interactive Tutorial & Shooting Range` — Step 1에서 `GREAT`/`PERFECT` 사격 시 1HP 캔 원샷 처치 및 `GOOD` 사격 시 `0.8` 데미지(잔여 HP `0.2`) 검증, Step 2/3 진행 무결성 확인; modify

#### Details
- **Signatures & Types**: Vitest 테스트 케이스.
- **Data & Schema Fields**: `BeerCrusherEngine`, `shouldRenderMonsterHpBar`.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `engine.startTutorialMode()`로 Step 1 진입.
  2. Core Processing:
     - Step 1 튜토리얼 표적에 대해 `PERFECT(1.5x)` 또는 `GREAT(1.0x)` 사격 시 1발에 파괴되고, 가장자리 `GOOD(0.8x)` 사격 시 체력이 남으며 `shouldRenderMonsterHpBar(1, false, false, target.hp)`가 `true`가 되는 시나리오를 검증한다.
  3. Error & Exception Handling: N/A.
  4. State Transition & Return: 전체 테스트 스위트(`npm test`) 및 프로덕션 빌드(`npm run build`) 통과.

## Acceptance Criteria
- [ ] `GuideModal.tsx`의 3개 탭 모두에 정밀도 데미지 배율(`1.5x/1.0x/0.8x`), 상향된 무기 스펙, 100% 연속 게이지 체력바, 보스 10m 정지 & 탭 레버 미니웨이브 소환, 킬 게이지 보상 카드 5종(`행운의 보급품`, `바리케이드 완전 복구` 등), 적 처치 아이템 드롭, 모바일/PC 홀드 자동 연발이 정확히 안내된다.
- [ ] `TutorialGuideOverlay.tsx`의 Step 1~3 안내 문구가 개편된 판정 배율, 홀드 자동 연발(`투두두두`), 100% 연속 게이지 체력바, `PERFECT`·`처치` 기반 피버 충전 및 2배 데미지 규칙과 100% 일치한다.
- [ ] `ResultRankingModal.tsx`에서 구버전 `'최대 콤보'` 표기가 `'누적 격파 (KILL)'`로 교체된다.
- [ ] `README.md` 및 `docs/*.md` 6개 공식 문서에 구버전 규칙(콤보 초기화, 보스 접촉 즉사, 도트 체력바, 홀드 연사 불가, 구버전 Lv.1 데미지)이 남아 있지 않고 최신 사양으로 동기화된다.

## Validation
- `npx vitest run tests/tutorial-and-guide.test.ts` — 튜토리얼 및 가이드 테스트 통과
- `npm test && npm run build` — 전체 테스트 스위트 및 프로덕션 빌드 통과

## Commit Message
```text
docs(guide): overhaul in-game guide modal, 3-step tutorial, and official documentation

Plan: 2026-11-04-combat-roguelike-boss-overhaul
Phase: P03-guide-tutorial-and-docs-sync
Task: T01-guide-docs-and-tutorial-overhaul

- Update GuideModal 3 tabs with accuracy damage multipliers, Lv.1~4 weapon buffs, kill-gauge cards, lucky_drop passive, and boss summon mechanics
- Overhaul TutorialGuideOverlay Steps 1-3 for accuracy one-shot, hold auto-fire, 100% HP gauge bar, and PERFECT/kill fever charging
- Replace obsolete combo label in ResultRankingModal with total kills
- Synchronize README.md and all 5 docs/*.md manuals with the v2.2 combat and roguelike overhaul
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
