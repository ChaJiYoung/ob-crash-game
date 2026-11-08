import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

/** GameCanvas3D는 WebGL이 없는 테스트 환경에서 마운트할 수 없어 소스로 연결을 확인한다(webgl-context-loss D01~D03). */
describe('GameCanvas3D WebGL context handling', () => {
  const src = fs.readFileSync('src/pc/components/GameCanvas3D.tsx', 'utf8');

  it('releases the context on cleanup, after detaching the guard', () => {
    expect(src).toContain('renderer.forceContextLoss();');
    expect(src.indexOf('contextGuard?.detach();')).toBeLessThan(src.indexOf('renderer.forceContextLoss();'));
  });

  it('wires the loss guard, skips rendering while lost and shows the overlay', () => {
    expect(src).toContain('attachContextLossGuard(renderer.domElement');
    expect(src).toContain("setGlError('blocked')");
    expect(src).toContain("onGiveUp: () => setGlError('lost')");
    expect(src).toContain('!contextGuard?.isLost()) renderer.render(scene, camera)');
    expect(src).toContain('<WebGLErrorOverlay reason={glError} />');
  });
});
