# Task: T02 체력 감소 때 빨간 번쩍임과 피격음

## Status: done

## Goal
체력이 줄어드는 순간 화면 가장자리가 빨갛게 번쩍이고 피격음이 나서, 맞았다는 것을 바로 알 수 있다.

## Decision Summary
- 결정 D03. 번쩍임과 소리만 넣는다. 화면 흔들림, 폰 진동, 서버·폰 코드 변경은 없다. 모든 피격에 똑같이 나온다.

## Implementation

### I01. 피격 신호 전달
- Related Files:
  - `src/pc/components/GameCanvas3D.tsx` :: `GameCanvas3DProps`, 렌더 루프의 `engine.update` 호출(약 517행); modify

#### Details
- `GameCanvas3DProps`에 `onPlayerHit?: () => void`를 추가한다.
- `const { reloadedJustNow, breaches } = engine.update(time, dtSec);`로 받아 `if (breaches.length > 0) onPlayerHitRef.current?.();`를 호출한다. 한 프레임에 여럿이 넘어도 한 번만 호출한다.
- 렌더 루프는 마운트 때 한 번 만들어지므로 prop을 직접 쓰지 말고 `onMonsterProjectionsUpdateRef`와 같은 방식으로 `onPlayerHitRef`에 담는다.
- `breaches`는 일반 플레이에서 체력이 실제로 줄 때만 채워진다. 샌드박스·튜토리얼은 앞에서 `continue`하고, 아이템·카드도 제외된다(`BeerCrusherEngine.ts` 1299~1332행). 따로 거르지 않는다.

### I02. 번쩍임과 소리
- Related Files:
  - `src/pc/PCGamePage.tsx` :: `PCGamePage`; modify
  - `src/pc/audio/SoundSynthesizer.ts` :: `playPlayerHitSound`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  public playPlayerHitSound(): void // SoundSynthesizer
  const playerHitFlashRef = useRef<HTMLDivElement>(null);
  const handlePlayerHit = useCallback(() => { ... }, [soundSynth]);
  ```
- 소리: `playBossExplosionSound`와 같은 구조로 만든다. 사각파 180Hz → 70Hz, 0.18초, gain 0.35 → 0.001.
- 번쩍임: `GameCanvas3D` 바로 뒤에 항상 마운트된 div를 둔다.
  ```tsx
  <div ref={playerHitFlashRef} data-testid="player-hit-flash" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 110, opacity: 0, boxShadow: 'inset 0 0 120px 40px rgba(220, 38, 38, 0.85)' }} />
  ```
- `handlePlayerHit`:
  ```typescript
  soundSynth.playPlayerHitSound();
  playerHitFlashRef.current?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease-out' });
  ```
- 함정: 상태(`useState`)로 띄우면 페이지 전체가 다시 렌더링되고, `GameCanvas3D`는 `React.memo`라 콜백이 바뀌면 다시 그려진다. 그래서 `ref`와 Web Animations API를 쓰고 `useCallback`으로 고정한다.
- `<GameCanvas3D onPlayerHit={handlePlayerHit} />`로 연결한다.

### I03. 테스트
- Related Files:
  - `tests/player-hit-feedback.test.ts` :: `player hit feedback`; new

#### Details
- 엔진: 방어선을 넘긴 일반 몬스터와 똥은 `update`의 `breaches`에 들어간다(체력 감소).
- 엔진: 아이템은 `breaches`에 없고, `isSandboxMode`에서도 비어 있다.
- 소스: `GameCanvas3D.tsx`에 `onPlayerHitRef`, `PCGamePage.tsx`에 `player-hit-flash`와 `onPlayerHit={handlePlayerHit}`가 있다. 일반 몬스터 생성은 `tests/monster-traits.test.ts`의 `mk` 도우미를 참고한다.

## Acceptance Criteria
- [x] 몬스터나 똥이 방어선을 넘어 체력이 줄 때 0.4초 번쩍임과 소리가 나온다.
- [x] 튜토리얼·샌드박스·아이템 통과 때는 나오지 않는다.
- [x] 번쩍임이 클릭과 조준을 막지 않는다(`pointerEvents: none`).

## Validation
- `npx vitest run tests/player-hit-feedback.test.ts` — 통과
- `npx tsc --noEmit` — 오류 없음

## Commit Message
```text
feat(hud): flash the screen edge and play a sound when the player loses health

Plan: 2026-11-05-playtest-visual-feedback
Phase: P01-screen-feedback
Task: T02-player-hit-flash

- Use the breaches the engine already reports as the hit signal
- Animate through a ref so a hit does not re-render the page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
