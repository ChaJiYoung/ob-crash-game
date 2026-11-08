# Decisions: WebGL 컨텍스트 손실·차단 대응

- Date: 2026-11-08
- Status: Confirmed
- Trigger: 개발 중 시작 화면이 검거나 하얗게 나왔다. 콘솔에 `A WebGL context could not be created. Reason: Web page caused context loss and was blocked`가 찍혔다. Chrome은 컨텍스트 손실이 반복된 사이트의 WebGL 생성을 막는다.

## D01. 정리 때 컨텍스트 즉시 반납 (코드를 읽고 자동 확정)
- **Chosen**: `GameCanvas3D.tsx` 효과 정리(약 930행)에서 `renderer.dispose()` 뒤에 `renderer.forceContextLoss()`를 호출한다. canvas가 container에 없더라도 renderer가 있으면 dispose와 반납을 한다(조건을 분리한다).
- **Rationale**: 지금은 `dispose()`만 호출한다. StrictMode 이중 마운트와 HMR이 반복될 때 컨텍스트가 GC될 때까지 남아, 브라우저 한도를 넘으면 손실과 차단이 생길 수 있다.

## D02. 게임 중 컨텍스트 손실: 자동 복구 대기 후 안내
- **Chosen**: canvas에 `webglcontextlost` 리스너를 단다. 이벤트가 오면 `event.preventDefault()`로 복구를 요청하고, 게임을 일시정지하고, 렌더 루프의 `renderer.render` 호출을 건너뛴다. `webglcontextrestored`가 3초 안에 오면 `window.location.reload()`로 장면을 새로 만든다. 3초가 지나도 오지 않으면 D03의 안내 오버레이를 띄운다(사유: `lost`). 정리 시 리스너와 타이머를 제거한다. 우리가 정리 중에 부른 `forceContextLoss()`로 생긴 lost 이벤트는 무시한다(`disposed` 플래그).
- **Rationale**: 사용자가 1번을 선택. 일시적 손실은 자동으로 넘기고, 장면 전체 재구성(텍스처·셰이더 재업로드)은 범위가 커서 새로고침으로 대신한다.

## D03. 렌더러 생성 실패·복구 실패 시 전체 화면 안내
- **Chosen**: 새 컴포넌트 `WebGLErrorOverlay`(사유 `'blocked' | 'lost'`)를 만든다. 제목, 원인 문구("브라우저가 이 사이트의 그래픽(WebGL)을 차단했습니다" / "그래픽이 중단됐습니다"), 해결 방법(Chrome을 ⌘Q로 완전히 종료 후 재시작, `chrome://gpu`에서 하드웨어 가속 확인), 새로고침 버튼으로 구성한다. `new THREE.WebGLRenderer` 생성이 catch로 떨어지면 `'blocked'`로 띄운다. 상태는 GameCanvas3D 안의 React state로 두고, 캔버스 위에 덮는다.
- **Rationale**: 사용자가 1번을 선택. 지금은 콘솔 경고만 남고 사용자는 이유 없이 빈 화면만 본다.

## 범위 밖 (결정에 포함하지 않음)
- 장면 재구성으로 판을 이어 가는 복구
- WebSocket 연결 실패 안내(`npm run server` 미실행 시)
