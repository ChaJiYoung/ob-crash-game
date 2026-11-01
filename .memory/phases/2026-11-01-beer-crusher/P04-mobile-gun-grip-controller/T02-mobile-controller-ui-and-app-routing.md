# Task: T02 모바일 권총 그립 UI(로그인·영점·85:15 패드) 및 App.tsx 전체 라우팅 연결

## Status: done

## Goal
스마트폰 화면을 권총처럼 쥐었을 때(화면이 좌측을 향함) 엄지나 반대손 시선에 똑바로 읽히도록 배치된 **로그인/센서 권한 게이트(`LoginAndPermissionGate`)**, **정면 영점 가이드(`ZeroingGuide`)**, **85:15 분할 통합 터치패드(`GunGripPad`)**, **`MobileControllerPage`**를 구현하고, `App.tsx`, `main.tsx`, `index.html`에서 PC 화면(`/`)과 모바일 컨트롤러(`/controller`) 라우팅을 완성합니다.

## Decision Summary
- **D08**: QR 스캔 접속 시 `DEVICE_CHECK` 자동 실행 → 기존 유저는 닉네임 입력 생략 후 즉시 센서 권한 단계로 이동, 신규 유저는 `2~10자` 닉네임 등록
- **D09**: 전면(모니터 쪽) 15% `[🎯 정면 영점 재설정]` 버튼 + 몸통 쪽 85% 단일 통합 터치패드(꾹 누르기 = 연사, 더블탭 = 피버), 100% 자동 장전 상태 표시(수동 장전 버튼 없음)

## Implementation

### I01. 모바일 컨트롤러 UI 컴포넌트 3종, `MobileControllerPage` 및 `App.tsx` 엔트리 연결
- Related Files:
  - `src/controller/components/LoginAndPermissionGate.tsx` :: `LoginAndPermissionGate`, `validateNicknameInput` — 신규/기존 회원 로그인 분기 및 iOS/Android 센서 권한 요청 게이트; new
  - `src/controller/components/ZeroingGuide.tsx` :: `ZeroingGuide` — 권총 그립(`+Y` 총구 모니터 지향, 화면 좌측 지향) 파지 안내 및 정면 영점 고정 화면; new
  - `src/controller/components/GunGripPad.tsx` :: `GunGripPad` — 전면 15% 영점 재조절 스트립 + 하단 85% 통합 액션 터치패드(가로 방향 가독성 레이아웃); new
  - `src/controller/MobileControllerPage.tsx` :: `MobileControllerPage` — `?room=XXXX` WebSocket 연결 및 `60Hz`(`16ms`) `SENSOR_FRAME` 송신 루프; new
  - `src/App.tsx` :: `App`, `resolveRouteMode` — URL 경로/쿼리에 따른 `'PC'` vs `'CONTROLLER'` 라우팅 분기 컴포넌트; new
  - `src/main.tsx` :: `root.render` — React 18 루트 마운트; new
  - `index.html` :: `html` — 타이틀, 모바일 터치 줌 방지 뷰포트 메타태그 및 루트 `#root` 엘리먼트; new

#### Details
- **Signatures & Types**:
  ```typescript
  export function validateNicknameInput(rawNickname: string): { valid: boolean; trimmed: string; error?: string };
  export function resolveRouteMode(pathname: string, search: string): 'PC' | 'CONTROLLER';
  ```
- **Execution Flow / Logic**:
  1. **`LoginAndPermissionGate.tsx` (`D08`)**:
     - `isNewUser === false`: `"🔫 반갑습니다, [닉네임]님! (최고 기록: N점)"` 표시 후 `[센서 권한 허용 및 총기 그립 준비]` 버튼만 노출.
     - `isNewUser === true`: `validateNicknameInput`으로 `2~10자` 검증 후 `{ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname }` 전송.
  2. **`GunGripPad.tsx` (`D09` 85:15 분할)**:
     - 상단 15% 영역(`height: 15%`): `[🎯 정면 영점 재설정]` 버튼.
     - 하단 85% 영역(`height: 85%`): 단일 **통합 액션 터치패드** (`UnifiedTouchPadController` 바인딩).
       - `isRapidFiring === true` 시 시안 네온 펄스(`"🔫 AUTO RAPID FIRE!"`), `isFeverReady === true` 시 황금 네온 테두리(`"🔥 따닥 더블탭하여 FEVER 발동!"`) 표시.
       - 탄창 상태바에 `10 / 10` 또는 `"⚡ 자동 장전 중 (1.2s)..."` 표시 (수동 장전 버튼이나 흔들기 안내 문구 일절 없음).
  3. **`App.tsx` 라우팅 (`resolveRouteMode`)**:
     - `pathname.startsWith('/controller')` 이거나 `new URLSearchParams(search).has('room')`이면 `'CONTROLLER'` 반환 -> `<MobileControllerPage />` 렌더링, 아니면 `'PC'` 반환 -> `<PCGamePage />` 렌더링.

### I02. 닉네임 검증기·라우트 리졸버 및 전체 빌드 검증 테스트
- Related Files:
  - `tests/controller-ui-and-routing.test.ts` :: `describe('Controller Login Validation & App Route Resolution')` — 닉네임 유효성, 라우팅 분기 및 E2E 모듈 결합 검증; new

#### Details
- `validateNicknameInput`: `'  '` / `'A'` -> `valid: false`, `'맥주헌터'` -> `valid: true, trimmed: '맥주헌터'`, 11자 이상 -> `valid: false` 검증.
- `resolveRouteMode`: `('/', '') -> 'PC'`, `('/controller', '?room=AB12') -> 'CONTROLLER'`, `('/', '?room=AB12') -> 'CONTROLLER'` 검증.
- 전체 테스트 스위트(`npm test`) 및 프로덕션 번들 빌드(`npm run build`) 무결성 검증.

## Acceptance Criteria
- [ ] 스마트폰 QR 접속 시 기존 회원은 즉시 자동 로그인되고 신규 회원은 2~10자 닉네임 입력 후 로그인됨
- [ ] 권총 그립 85:15 터치패드 UI와 PC 풀스크린 화면이 `App.tsx`에서 정상 라우팅되며 전체 빌드가 성공함
- [ ] `npx vitest run tests/controller-ui-and-routing.test.ts` 및 `npm test`, `npm run build`가 100% 통과함

## Validation
- `npx vitest run tests/controller-ui-and-routing.test.ts && npm test && npm run build` — 전체 단위/통합 테스트 및 프로덕션 TypeScript/Vite 빌드 통과

## Commit Message
```text
feat(controller-ui): implement gun-grip 85:15 controller UI, deviceId login gate, and app routing

Plan: 2026-11-01-beer-crusher
Phase: P04-mobile-gun-grip-controller
Task: T02-mobile-controller-ui-and-app-routing

- Implement LoginAndPermissionGate, ZeroingGuide, and 85:15 GunGripPad components
- Implement MobileControllerPage 60Hz sensor streaming and App.tsx PC/Controller routing
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: done
