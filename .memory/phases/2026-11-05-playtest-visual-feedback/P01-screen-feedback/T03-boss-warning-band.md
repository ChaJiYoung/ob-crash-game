# Task: T03 보스 경고 가로 띠, 빛줄, 경고음

## Status: pending

## Goal
보스가 나올 때 가로 띠에 `WARNING`이 뜨고 빛줄이 글자 위를 훑으며 경고음이 나고, 2초 안에 서서히 사라진다.

## Decision Summary
- 결정 D04. 시안: `.memory/references/screens/mockup-boss-warning-2026-11-05.png` 1안. 게임은 멈추지 않는다. 7웨이브 체력바와 잠깐 겹쳐도 위치를 따로 조정하지 않고 빨리 사라지게 한다(사용자 결정).

## Implementation

### I01. 표시 시간 상수
- Related Files:
  - `src/shared/gameTuning.ts` :: `GAME_TUNING.boss.warningMs`; modify
  - `src/pc/engine/BeerCrusherEngine.ts` :: `spawnBossEncounter`; modify

#### Details
- `boss`에 `warningMs: 2000`을 추가하고 `this.bossWarningUntilMs = nowMs + GAME_TUNING.boss.warningMs;`로 바꾼다. 값이 그대로라 `tests/boss-encounters.test.ts:383`의 기대값은 유지된다.

### I02. 띠 렌더링
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `boss-warning-banner` 블록(약 822행); modify

#### Details
- 조건 `gamePhase === 'PLAYING' && hudState.isBossWarning`과 `data-testid="boss-warning-banner"`는 유지한다.
- 구조:
  ```tsx
  <div data-testid="boss-warning-banner" style={{ position: 'absolute', left: 0, right: 0, top: '21.5%', height: '17%', zIndex: 125, overflow: 'hidden', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(69, 10, 10, 0.93)', borderTop: '4px solid #ef4444', borderBottom: '4px solid #ef4444', animation: `boss-warning-band ${GAME_TUNING.boss.warningMs}ms ease-out forwards` }}>
    <style>{`@keyframes boss-warning-band { 0% { opacity: 0; } 8% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } } @keyframes boss-warning-sweep { from { left: -25%; } to { left: 110%; } }`}</style>
    <div style={{ color: '#fecaca', fontSize: 'clamp(40px, 6.4vw, 92px)', fontWeight: 900, letterSpacing: '0.14em', lineHeight: 1.05 }}>⚠ WARNING ⚠</div>
    <div style={{ color: '#fca5a5', fontSize: 'clamp(16px, 2.2vw, 30px)', fontWeight: 700 }}>보스 등장</div>
    <div style={{ position: 'absolute', top: 0, bottom: 0, width: '13%', transform: 'skewX(-18deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)', animation: 'boss-warning-sweep 0.7s linear infinite' }} />
  </div>
  ```
- 끝에 `opacity: 0`이 되고 `isBossWarning`이 false가 되면 언마운트되어 아무것도 남지 않는다. HUD는 100ms 주기라 최대 100ms 늦게 마운트된다. 이 오차는 무시한다.
- `PCGamePage.tsx`에 `GAME_TUNING` import가 없으면 추가한다.

### I03. 경고음
- Related Files:
  - `src/pc/audio/SoundSynthesizer.ts` :: `playBossWarningSound`; modify
  - `src/pc/PCGamePage.tsx` :: HUD 주기 `useEffect`(약 489행), `lastBossWarningRef`; modify

#### Details
- 소리: 사각파로 `880Hz → 660Hz`를 0.18초씩 두 번(`now`, `now + 0.24`), gain 0.22 → 0.001.
- 황금 캔 알림(약 499~505행)과 같은 방식으로 상승 시점에 한 번만 낸다.
  ```typescript
  if (nextHud.isBossWarning && !lastBossWarningRef.current) soundSynth.playBossWarningSound();
  lastBossWarningRef.current = nextHud.isBossWarning;
  ```

### I04. 테스트
- Related Files:
  - `tests/boss-encounters.test.ts` :: 보스 경고 테스트(약 383행); modify

#### Details
- `engine.bossWarningUntilMs`가 `nowMs + GAME_TUNING.boss.warningMs`인지 확인한다.
- 소스 검사: `PCGamePage.tsx`에 `boss-warning-sweep`, `WARNING`, `playBossWarningSound`가 있고 옛 문구 `⚠️ 보스 등장!`이 없다.

## Acceptance Criteria
- [ ] 3·5·7웨이브 보스 등장 때 띠, 빛줄, 소리가 한 번씩 나오고 2초 뒤 사라진다.
- [ ] 띠가 맥주잔과 1·2개 보스 체력바를 가리지 않는다.
- [ ] 게임은 멈추지 않고 띠가 클릭을 막지 않는다.

## Validation
- `npx vitest run tests/boss-encounters.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(boss): show a sweeping WARNING band with an alarm when a boss appears

Plan: 2026-11-05-playtest-visual-feedback
Phase: P01-screen-feedback
Task: T03-boss-warning-band

- Replace the small pill with a full-width band that fades out within 2s
- Move the duration into GAME_TUNING.boss.warningMs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
