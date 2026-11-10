import { describe, it, expect } from 'vitest';
import { DraftTapGun3D } from '../src/pc/three/DraftTapGun3D';

/** private 링 메쉬를 테스트에서만 읽는다. */
const ring = (g: DraftTapGun3D) => (g as unknown as { ringMesh: { visible: boolean } }).ringMesh;

/** 렌더 루프(syncGuns → updateAim)를 흉내 낸다. 마지막 60프레임의 x 위치를 돌려준다. */
function simulate(aimX: number, dtFn: (i: number) => number): number[] {
  const gun = new DraftTapGun3D();
  const xs: number[] = [];
  for (let i = 0; i < 120; i++) {
    gun.setSlotOffset(0); // 매 프레임 호출된다
    gun.updateAim({ yaw: 0, pitch: 0 }, { aimX, aimY: 0 }, dtFn(i), false);
    xs.push(gun.group.position.x);
  }
  return xs.slice(60);
}

describe('DraftTapGun3D slot offset', () => {
  it('프레임 간격이 흔들려도 x 위치가 떨리지 않고 목표에 수렴한다', () => {
    const xs = simulate(1, (i) => (i % 2 ? 1 / 90 : 1 / 40));
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1e-6);
    expect(xs[xs.length - 1]).toBeCloseTo(0.04, 3);
  });

  it('프레임 간격이 일정해도 목표 위치까지 도달한다', () => {
    const xs = simulate(1, () => 1 / 60);
    expect(xs[xs.length - 1]).toBeCloseTo(0.04, 3);
  });

  it('다른 오프셋은 정상 적용된다', () => {
    const gun = new DraftTapGun3D();
    gun.setSlotOffset(0.5);
    expect(gun.group.position.x).toBe(0.5);
  });

  it('같은 색을 반복 적용해도 링이 유지되고 null이면 숨는다', () => {
    const gun = new DraftTapGun3D();
    gun.setPlayerColor('#ff0000');
    gun.setPlayerColor('#ff0000');
    expect(ring(gun).visible).toBe(true);
    gun.setPlayerColor(null);
    expect(ring(gun).visible).toBe(false);
    gun.setPlayerColor('#ff0000');
    expect(ring(gun).visible).toBe(true);
  });
});
