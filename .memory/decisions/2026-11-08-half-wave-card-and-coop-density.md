# Decisions: 웨이브 절반 카드와 2P 필드 밀도

- Date: 2026-11-08
- Status: Confirmed
- 수정 대상: `2026-11-06-card-farming-fix` D08(4·6웨이브 처치 수 중간 카드)의 지급 방식을 이 문서가 대체한다.

## D01. 중간 카드 지급 기준: 처치 수가 웨이브 절반에 도달할 때 1회
- **Chosen**: `killedInWave >= ceil(totalSpawns / 2)`가 되는 순간 카드 1장을 준다. 웨이브당 정확히 1번이고 반복 지급(카운터 리셋)은 없다. 2P는 `totalSpawns`가 이미 `spawnCountMult`(2배)로 늘어나 있으므로 별도 배율 없이 자동으로 맞춰진다.
- **Rationale**: 사용자가 1번을 선택. HUD 진행 바(`처치 / totalSpawns`)와 같은 값이라 바가 50%를 넘는 순간 카드가 나와 직관적이다. 스폰 기준이나 시간 기준은 진행 바와 어긋난다.

## D02. 절반 카드 대상 웨이브: 4·6웨이브만
- **Chosen**: 지금처럼 4·6웨이브만 준다. 웨이브 표의 `cardKillTarget: number | null`을 `midWaveCard: boolean`으로 바꾸고(4·6만 true), `playerCountRules`의 `cardKillTargetMult`는 삭제한다.
- **Rationale**: 사용자가 1번을 선택. 봇 클리어율을 측정한 구성(카드 수)을 유지하고 지급 방식만 바꾼다. 1P 지급 시점은 4웨이브 22킬 → 17킬, 6웨이브 26킬 → 20킬로 앞당겨진다.

## D03. 2P 동시 필드 몬스터 수 배율 1.8
- **Chosen**: `playerCountRules`에 `maxSimultaneousMult`를 추가한다(1P 1, 2P 1.8). 엔진의 `waveDefinitions` 생성부에서 `Math.ceil(maxSimultaneous * mult)`로 적용한다. 2P 결과는 5→9, 6→11, 7→13, 8→15다.
- **Rationale**: 사용자가 1.8을 지정. 총 수만 2배이고 화면 밀도는 1P와 같던 문제를 고친다. 2배(최대 16)보다 렌더링 부하와 겹침이 조금 적다.
- **영향**: 보스 포탄은 시간 간격(`getBossShellIntervalMs`)으로 나가고, `countFieldMonsters() < maxSimultaneous + 2`는 필드가 꽉 찼을 때 발사를 건너뛰는 혼잡 상한일 뿐이다. 상한이 함께 올라가지만(2P 7웨이브 10→17) 실제 필드가 거기에 닿는 일이 드물어 포탄 빈도는 사실상 그대로다. 별도 조정은 하지 않는다.

## D04. 2P 스폰 간격 배율 0.6
- **Chosen**: `playerCountRules`에 `spawnIntervalMult`를 추가한다(1P 1, 2P 0.6). `Math.round(spawnIntervalMs * mult)`로 계산하며 600ms는 360ms가 된다.
- **Rationale**: 사용자가 2번을 선택. 동시 수만 늘리면 빈 자리를 채우는 속도가 같아 체감 밀도가 덜 오르기 때문이다.

## D05. 랭킹 규칙 버전 유지
- **Chosen**: `RANKING_RULESET_VERSION`은 올리지 않는다.
- **Rationale**: 사용자가 2번을 선택. 기존 기록을 유지하고 2P 난이도 변화로 생기는 비교 불공정을 감수한다.

## D06. HUD·문서·검증 (코드를 읽고 자동 확정)
- **Chosen**: HUD의 `🃏 카드 n/N KILL` 카운터는 `midWaveCard` 웨이브에서 지급 전까지 `killedInWave / ceil(totalSpawns/2)`를 보여 주고, 지급 후에는 숨긴다. `WaveProgressInfo`의 `cardKillCount`·`cardKillTarget`은 이 값으로 재정의하거나 `midCardTarget`·`midCardGranted`로 바꾼다. `GuideModal.tsx`(현재 `cardKillTarget`로 "4웨이브(22킬)" 생성), README, 가이드·도감 문서, `docs-sync` 테스트의 "N킬마다" 설명을 "웨이브 절반 처치 시 1장"으로 맞춘다. 밸런스는 `.memory/references/scripts/coop-bot-compare.ts`(현재 `COOP_CARD` 환경변수 사용 → 대체 필요)로 1P와 2P를 측정해 기록한다.
- **Rationale**: 필드를 바꾸면 이 참조처가 모두 컴파일·테스트에서 깨지므로 같은 작업에서 함께 정리해야 한다.

## 범위 밖 (결정에 포함하지 않음)
- 보스 웨이브(3·5·7) 중간 카드, 초기 버스트 스폰, 2P `monsterHpMult` 조정
- 측정 결과에 따른 1.8·0.6 수치 재조정(측정 후 사용자 결정)
