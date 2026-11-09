# Task: T01 가이드 카드 공통 컴포넌트와 무기 탭 카드화

## Status: done

## Goal
가이드 모달의 줄글 불릿을 "카드"로 바꾸는 공통 부품(`GuideCard`, `StatChip`, `StatBar`, 접기)과 한 줄 요약 데이터(`guideText.ts`)를 만들고, 첫 탭인 무기·스킬 탭을 카드로 바꾼다. 샷건의 새 평타 퍼짐·스킬 설명은 튜닝 값에서 계산해 보여 준다(D11, D12). 나머지 탭은 T02가 같은 부품으로 바꾼다.

## Decision Summary
- 탭 구조(무기·몬스터·카드·아이템·협동)와 `GuideModalProps`(`isOpen`, `onClose`)는 그대로. `GuideModal.tsx`는 점점 **탭 라우터**가 된다. 이번 Task에서는 무기 탭 코드(337~499행)를 `guide/WeaponsTab.tsx`로 옮기고 카드화한다.
- 접기는 React 상태 없이 네이티브 `<details>`/`<summary>`를 쓴다(키보드 접근, 서버 렌더 테스트 용이).
- 수치 칩·막대의 값은 `WEAPON_ARCHETYPE_SPECS`/`GAME_TUNING`에서 계산한다(손으로 숫자를 적지 않음, D12).
- **함정(테스트가 소스 문자열을 검사한다)**: `tests/docs-sync.test.ts`(67~73, 161~166, 199~203행)와 `tests/pc-modals-and-pairing.test.ts`(176, 215행)가 `src/pc/components/GuideModal.tsx` 파일의 **문자열**(`GAME_TUNING.judgment.perfectDamage`, `weaponPerformanceText('gatling')`, `GAME_TUNING.boss.summonCountByStep`, `MID_CARD_TEXT`, `not.toContain('Space')`, `not.toContain('showTutorialButton')` 등)을 찾는다. 내용을 다른 파일로 옮기면 테스트가 깨진다. 그래서 **공용 읽기 도우미**를 만들고 그 테스트들이 `GuideModal.tsx`와 `guide/` 폴더 전체를 합친 소스를 읽게 바꾼다(I04).

## Implementation

### I01. 한 줄 요약 데이터(`guideText.ts`)
- Related Files:
  - `src/shared/guideText.ts` :: `WEAPON_ONE_LINER`, `WEAPON_SKILL_ONE_LINER`, `WEAPON_BADGE_TEXT` — new
  - `src/shared/types.ts` :: `WeaponKind` — read-only
#### Details
- **Signatures & Types**:
  ```ts
  import type { WeaponKind } from './types';
  /** 가이드 카드와 튜토리얼 안내가 같은 문장을 쓴다(D19). 이 파일은 다른 파일에 의존하지 않는다. */
  export const WEAPON_ONE_LINER: Record<WeaponKind, string> = {
    shotgun: '한 발이 강하고 주변까지 퍼져 맞는 근접 산탄',
    revolver: '한 발 한 발이 정확하고 뒤의 몬스터까지 꿰뚫는 관통탄',
    gatling: '한 발은 약해도 탄이 쏟아지는 초고속 연사',
  };
  export const WEAPON_SKILL_ONE_LINER: Record<WeaponKind, string> = {
    shotgun: '뚫어뻥이 몬스터에 박혀 기절시킨 뒤 터집니다',
    revolver: '부채꼴 칼날이 앞쪽 몬스터를 베고 지나갑니다',
    gatling: '거품 파도가 전장을 쓸며 몬스터를 뒤로 밀어냅니다',
  };
  export const WEAPON_BADGE_TEXT: Record<WeaponKind, string> = { shotgun: '근접 산탄', revolver: '일직선 관통', gatling: '초고속 연사' };
  ```
- 문장은 현재 동작과 맞아야 한다(샷건 스킬 = D01, 리볼버 칼날 = `skills.blade`, 게틀링 거품 = `skills.foam`).

### I02. 카드 공통 부품
- Related Files:
  - `src/pc/components/guide/GuideCard.tsx` :: `GuideCard`, `StatChip`, `StatBar` — new
#### Details
- **Signatures & Types**:
  ```ts
  export interface GuideCardProps {
    icon: React.ReactNode;           // 큰 아이콘(이모지 또는 <img>)
    title: string;
    badge?: string;                  // 오른쪽 위 작은 라벨
    oneLiner: string;                // 한 줄 요약(항상 보임)
    accentColor: string;             // 테두리·강조색(예: '#ef4444')
    chips?: { label: string; value: string }[];     // 수치 칩
    bars?: { label: string; valueText: string; ratio: number }[]; // ratio 0..1
    detailTitle?: string;            // 기본 '자세히 보기'
    children?: React.ReactNode;      // 접히는 상세
    testId?: string;
  }
  export const GuideCard: React.FC<GuideCardProps>
  export const StatChip: React.FC<{ label: string; value: string }>
  export const StatBar: React.FC<{ label: string; valueText: string; ratio: number; color: string }>
  ```
- **Execution Flow / Logic**: `GuideCard`는 기존 카드와 같은 톤(`borderRadius: 16px`, 배경 `rgba(accent,0.08)`, 테두리 `1.5px solid rgba(accent,0.4)`)으로 헤더(아이콘 28~36px + 제목 + 배지) → 한 줄 요약(15px, 굵게) → 칩 행(작은 둥근 알약) → 막대 목록(라벨 + 값 텍스트 + 가로 막대, 폭 `Math.round(clamp(ratio,0,1)*100)%`) → `children`이 있으면 `<details>`(`<summary>`에 `detailTitle`, 펼침 화살표) 순서. 모든 요소에 `data-testid`(`testId`, `${testId}-oneliner`, `${testId}-details`)를 붙인다. `ratio`는 0..1로 **클램프**해 NaN·음수·1 초과가 레이아웃을 깨지 않게 한다. 막대가 없으면 영역을 렌더하지 않는다.

### I03. 무기 탭을 카드로(`WeaponsTab`)
- Related Files:
  - `src/pc/components/guide/weaponGuideData.ts` :: `levelSeries`, `weaponPerformanceText`, `weaponStatBars`, `weaponSkillDetailText`, `shotgunSpreadText` — new (`GuideModal.tsx` 20~48행의 `levelSeries`, `weaponPerformanceText`를 이동)
  - `src/pc/components/guide/WeaponsTab.tsx` :: `WeaponsTab` — new
  - `src/pc/components/GuideModal.tsx` :: 무기 탭 블록(337~499행) → `<WeaponsTab />` 호출로 교체, 옮긴 함수 import — modify
#### Details
- **Signatures & Types**:
  ```ts
  // weaponGuideData.ts
  export type WeaponKindKey = 'shotgun' | 'revolver' | 'gatling';
  export function levelSeries(byLevel: Record<1 | 2 | 3 | 4, number>): string; // 기존 그대로
  export function weaponPerformanceText(kind: WeaponKindKey): string;           // 기존 그대로
  /** MAX(Lv.4) 기준 세 무기 비교 막대: 한 발 피해(pelletCount x damagePerHit), 탄창, 초당 발사 수(1000/fireIntervalMs). ratio = 값 / 세 무기 중 최댓값. */
  export function weaponStatBars(kind: WeaponKindKey): { label: string; valueText: string; ratio: number }[];
  /** 스킬 상세 한 줄들: 샷건은 GAME_TUNING.skills.plunger에서, 리볼버·게틀링은 skills.blade/foam에서 계산. */
  export function weaponSkillDetailText(kind: WeaponKindKey): string[];
  /** 샷건 퍼짐 한 줄: "십자선 주변 몬스터 2/2/3/3마리에게도 주 대상 피해의 10/15/20/25%". */
  export function shotgunSpreadText(): string;
  ```
- **Execution Flow / Logic**:
  1. `weaponStatBars`: 각 무기 Lv.4의 `WEAPON_ARCHETYPE_SPECS[kind].levels[4]`로 `damage = pelletCount * damagePerHit`(샷건 3.60, 리볼버 1.21, 게틀링 0.75), `ammo = maxAmmo`(16/12/50), `rate = 1000 / fireIntervalMs`(약 5.5/6.8/17.2)를 구하고, 세 무기 값의 최댓값으로 나눠 `ratio`를 만든다. `valueText`는 `damage.toFixed(2)`, `${ammo}발`, `${rate.toFixed(1)}발/초`.
  2. `weaponSkillDetailText('shotgun')`은 `GAME_TUNING.skills.plunger`로 "방어선에 가까운 몬스터부터 최대 {stickMaxByLevel 4/5/6/8}마리에 박힘", "기절 {2.0/2.2/2.5/3.0}초 뒤 폭발해 {0.7/0.8/0.9/1.0} 피해(박힌 몬스터만)", "보스는 박히지 않고 {4/5/6/6} 피해를 즉시 받음", "기절 중 평타로 마무리하면 폭발 피해는 없고 연출만"을 만든다. 숫자는 모두 튜닝 값(`levelSeries`)이다. `shotgunSpreadText`는 `GAME_TUNING.shotgunSpread`로 만든다.
  3. 리볼버·게틀링 스킬 상세는 **현재 `GuideModal.tsx`에 적힌 문구를 읽고**, 튜닝 값으로 대체할 수 있는 숫자(칼날 `skills.blade.countByLevel`·`pierceByLevel`·`bossDamageByLevel`, 거품 `skills.foam.knockbackMByLevel`·`damageByLevel`)가 문구와 어긋나면 튜닝 값에서 계산해 고친다(어긋남이 없으면 그대로 옮긴다). 어긋난 것을 고친 경우 커밋 본문에 적는다.
  4. `WeaponsTab`은 ① 맨 위 "명중 정밀도 데미지 배율 & 노-미스 판정" 안내 블록을 **기존 내용 그대로**(문자열 포함, `GAME_TUNING.judgment.perfectDamage` 등) `<details>`로 접어(제목 "🎯 판정 배율과 점수 규칙") 옮기고, ② 세 무기 `GuideCard`를 렌더한다. 각 카드: `icon = WEAPON_ARCHETYPE_SPECS[k].badgeIcon`, `title = nameKo`, `badge = WEAPON_BADGE_TEXT[k]`, `oneLiner = WEAPON_ONE_LINER[k]`, `accentColor = accentColorHex`, `bars = weaponStatBars(k)`, `chips = [{ 스킬: skillNameKo }, { 충전: `${skillCooldownMs/1000}초`(Lv1~4 `levelSeries`) }, { 보유: '최대 2회' }]`, 그 아래 스킬 한 줄(`WEAPON_SKILL_ONE_LINER[k]`)을 카드 본문(접히지 않는 부분)에 한 줄 더 보이게 한다. 접히는 상세(`children`)에는 외형 진화(기존 문구 그대로), 성능(`weaponPerformanceText(k)` — **호출 문자열 `weaponPerformanceText('gatling')`이 소스에 남아야 함**), 스킬 상세(`weaponSkillDetailText(k)`), 샷건은 퍼짐 줄(`shotgunSpreadText()`)을 넣는다.
  5. P01-T01에서 `GuideModal`에 임시로 넣은 샷건 "퍼짐" 불릿과 P02-T01의 샷건 스킬 불릿은 이 카드의 상세로 대체되므로 중복되지 않게 제거한다.

### I04. 테스트 읽기 도우미와 카드 테스트
- Related Files:
  - `tests/helpers/guideSource.ts` :: `readGuideSource` — new
  - `tests/docs-sync.test.ts`(67~73, 161~166, 199~203행), `tests/pc-modals-and-pairing.test.ts`(176, 215행) — modify
  - `tests/guide-cards.test.tsx` — new
#### Details
- **Signatures & Types**:
  ```ts
  /** GuideModal.tsx와 src/pc/components/guide/ 아래 모든 .ts/.tsx를 이어 붙인 소스. 문자열 포함 검사용. */
  export function readGuideSource(): string
  ```
  구현: `fs.readFileSync('src/pc/components/GuideModal.tsx')` + `fs.readdirSync('src/pc/components/guide')`의 각 파일 내용을 `'\n'`으로 이어 붙인다(폴더가 없으면 빈 문자열). 위 테스트의 `GuideModal.tsx` 읽기를 `readGuideSource()`로 바꾼다. `not.toContain('showTutorialButton')`·`Space` 부정 검사도 합친 소스로 한다(분산돼도 계속 보장).
- `tests/guide-cards.test.tsx` 케이스(`renderToStaticMarkup`): ① `GuideCard`: 한 줄 요약이 `details` **밖**에 있고, 상세는 `<details>` 안, `open` 속성 없음, `data-testid`들이 있다. ② `ratio`가 `-1`·`2`·`NaN`이어도 막대 폭이 0%~100%로 클램프된다. ③ `WeaponsTab`: 세 무기 카드(`weapon-card-shotgun` 등)에 `WEAPON_ONE_LINER`가 그대로 있고, 샷건 상세에 `GAME_TUNING.skills.plunger.stickMaxByLevel`의 숫자(`4 / 5 / 6 / 8`)·기절 `2 / 2.2 / 2.5 / 3`(표기 규칙은 `levelSeries`와 같음)·퍼짐 `10 / 15 / 20 / 25`가 들어 있다. ④ `weaponStatBars`: 세 무기 중 최댓값 막대의 `ratio === 1`이고 모든 값이 0..1. ⑤ 샷건 상세에 옛 문구 `12~22개`, `1.0~2.0초`가 **없다**.
- `tests/helpers`가 이미 있으므로 같은 폴더 규칙을 따른다.

## Acceptance Criteria
- [ ] 무기 탭이 세 무기 카드(아이콘·한 줄 요약·성능 막대·스킬 칩, 접힌 상세)로 보이고, 상세를 펼치면 기존 정보와 샷건 퍼짐·새 스킬 설명이 나온다.
- [ ] 샷건 스킬·퍼짐 문구의 숫자는 모두 `GAME_TUNING`에서 계산된다(옛 "12~22개", "1.0~2.0초" 없음).
- [ ] 판정 배율·점수 규칙 안내가 접힌 블록에 그대로 남아 있다.
- [ ] 소스 문자열을 검사하던 기존 테스트가 `readGuideSource()`로 계속 통과한다.
- [ ] `npm test`, `npx tsc --noEmit` 통과.

## Validation
- `npx vitest run tests/guide-cards.test.tsx tests/docs-sync.test.ts tests/pc-modals-and-pairing.test.ts` — 통과
- `npm test` — 전체 통과
- `npx tsc --noEmit` — 오류 없음
- (수동) `npm run dev` → 로비의 📖 가이드 → 무기 탭 카드와 "자세히 보기" 펼침 확인

## Commit Message
```text
feat(guide): 가이드 카드 부품과 무기 탭 카드화

Plan: 2026-11-09-playtest-feedback-guide-lobby-shotgun
Phase: P05-guide
Task: T01-guide-cards-weapons

- I01 guideText.ts 한 줄 요약(튜토리얼과 공유)
- I02 GuideCard·StatChip·StatBar(네이티브 details 접기)
- I03 WeaponsTab: 성능 막대, 스킬 칩, 샷건 새 스킬·퍼짐은 튜닝 값에서 계산
- I04 readGuideSource 도우미로 소스 문자열 테스트 유지, 카드 테스트
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: git log --grep "Task: T01-guide-cards-weapons"
