import { createTestBrowser, createFakePhone, sleep, log } from './test-common.mjs';

async function testSkillDeep() {
  const env = await createTestBrowser();
  const { page, roomId, shot, getSnapshot } = env;

  await page.getByText('📱 모바일').first().click();
  await sleep(400);

  const phone = createFakePhone(roomId, 1, '디버그폰');
  await phone.join();
  await phone.zero();
  await sleep(400);

  await phone.aimHold(0, 0, 300);
  await phone.snap(0, 0);
  await phone.aimHold(0, 0, 3500);
  await sleep(1000);

  let s = null;
  for (let i = 0; i < 40; i++) {
    s = await getSnapshot();
    if (s?.selection?.kind === 'weapon') break;
    await sleep(100);
  }
  const card = s.targets.find((t) => t.selectValue === 'shotgun') || s.targets[0];
  await phone.aimHold(card.aimX, card.aimY, 300);
  await phone.snap(card.aimX, card.aimY);
  await sleep(600);

  for (let i = 0; i < 60; i++) {
    s = await getSnapshot();
    if (s?.phase === 'PLAYING' && s?.selection?.kind === null) break;
    await sleep(100);
  }
  log('Combat active. Waiting 22 seconds for first skill stock...');

  // 22초 동안 타겟 처치하며 대기 (첫 스킬 스톡 충전)
  const waitStart = Date.now();
  while (Date.now() - waitStart < 25000) {
    const snap = await getSnapshot();
    if (snap.players[0].skillStock >= 1) {
      log('SKILL STOCK REACHED 1! Current stock:', snap.players[0].skillStock);
      break;
    }
    const t = snap.targets.find((x) => x.hp > 0 && !x.isGuarding) || snap.targets[0];
    if (t) {
      await phone.aimHold(t.aimX, t.aimY, 30);
      await phone.snap(t.aimX, t.aimY);
    }
    await sleep(500);
  }

  const beforeSnap = await getSnapshot();
  log('Status before skillTriggered:', {
    phase: beforeSnap.phase,
    selection: beforeSnap.selection,
    stock: beforeSnap.players[0].skillStock,
    ammo: beforeSnap.players[0].ammo,
  });

  log('Sending skillSnapTriggered: true frame...');
  phone.frame(0, 0, { skillSnapTriggered: true });
  await sleep(300);

  const afterSnap = await getSnapshot();
  log('Status after skillTriggered:', {
    phase: afterSnap.phase,
    selection: afterSnap.selection,
    stock: afterSnap.players[0].skillStock,
    ammo: afterSnap.players[0].ammo,
  });

  phone.close();
  await env.ctx.close();
  await env.browser.close();
}

testSkillDeep().catch(console.error);
