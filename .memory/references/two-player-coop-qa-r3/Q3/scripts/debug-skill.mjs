import { createTestBrowser, createFakePhone, sleep, log } from './test-common.mjs';

async function debugSkill() {
  const env = await createTestBrowser();
  const { page, roomId, shot, getSnapshot } = env;

  page.on('console', (m) => console.log('PAGE LOG:', m.type(), m.text()));

  await page.getByText('📱 모바일').first().click();
  await sleep(400);

  const phone = createFakePhone(roomId, 1, '디버그폰');
  await phone.join();
  await phone.zero();
  await sleep(400);

  // 로비 사격 시작
  await phone.aimHold(0, 0, 300);
  await phone.snap(0, 0);
  await phone.aimHold(0, 0, 3500);
  await sleep(1000);

  // 무기 카드 선택
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
  log('Combat active. Phase:', s.phase, 'Selection:', s.selection);

  // 시작 1.5초 쿨다운(graceUntil) 대기
  await sleep(2000);

  // 현재 엔진 및 프로세서 상태 진단
  const diag = await page.evaluate(() => {
    const p = window.__BEER_DEBUG__?.snapshot();
    return {
      phase: p?.phase,
      selection: p?.selection,
      player0: p?.players[0],
    };
  });
  log('Engine diagnostics before skill:', diag);

  log('Sending skillSnapTriggered: true via fakePhone...');
  phone.frame(0, 0, { skillSnapTriggered: true });
  await sleep(300);

  const diagAfter = await page.evaluate(() => {
    const p = window.__BEER_DEBUG__?.snapshot();
    return {
      phase: p?.phase,
      selection: p?.selection,
      player0: p?.players[0],
    };
  });
  log('Engine diagnostics after skill:', diagAfter);

  phone.close();
  await env.ctx.close();
  await env.browser.close();
}

debugSkill().catch(console.error);
