import { createTestEnv, sleep, log } from './test-helper.mjs';

async function run() {
  const env = await createTestEnv();
  const { page, fakePhone, getSnapshot, cleanup } = env;

  await page.getByText('📱 모바일').first().click();
  await sleep(400);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(500);

  const p1 = fakePhone(1, '블루폰', 'test_p1');
  const p2 = fakePhone(2, '오렌지폰', 'test_p2');

  await p1.join();
  await p2.join();
  await p1.zero();
  await p2.zero();

  // 시작
  await p1.aimHold(0, 0, 500);
  await p1.snap(0, 0);
  await Promise.all([p1.aimHold(-0.3, 0, 3600), p2.aimHold(0.3, 0, 3600)]);
  await sleep(1500);

  let snap = await getSnapshot();
  log('Weapon targets available:', snap.targets?.map((t) => ({ id: t.id, aimX: t.aimX, aimY: t.aimY, owner: t.ownerIndex, val: t.selectValue })));

  const t1 = snap.targets.find((t) => t.ownerIndex === 0);
  const t2 = snap.targets.find((t) => t.ownerIndex === 1);

  if (t1) {
    log('1P aiming at:', t1.aimX, t1.aimY);
    await p1.aimHold(t1.aimX, t1.aimY, 500);
    await p1.snap(t1.aimX, t1.aimY);
    await p1.aimHold(t1.aimX, t1.aimY, 500);
  }
  snap = await getSnapshot();
  log('Selection after 1P pick:', snap.selection);

  if (t2) {
    log('2P aiming at:', t2.aimX, t2.aimY);
    await p2.aimHold(t2.aimX, t2.aimY, 500);
    await p2.snap(t2.aimX, t2.aimY);
    await p2.aimHold(t2.aimX, t2.aimY, 500);
  }
  snap = await getSnapshot();
  log('Selection after 2P pick:', snap.selection);

  await sleep(1500);
  snap = await getSnapshot();
  log('Combat state:', { phase: snap.phase, isSelectPending: snap.selection.kind !== null, players: snap.players });

  p1.close();
  p2.close();
  await cleanup();
}

run().catch((e) => {
  console.error('Run failed:', e);
  process.exit(1);
});
