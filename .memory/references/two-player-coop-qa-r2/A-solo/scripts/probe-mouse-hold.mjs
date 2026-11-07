// 5-1 확인: 마우스 1인, 버튼을 1초 누르고 있을 때 탄약이 몇 발 줄었는지 100ms 간격으로 기록.
import { launch, newPage, sleep, log, snap, check, collected, saveJson, normToScreen } from './lib-a.mjs';

const browser = await launch();
const { page } = await newPage(browser, { tag: 'probe-hold' });

await page.getByText('🖱 마우스').first().click({ timeout: 60000 }); await sleep(500);
await page.getByPlaceholder('닉네임 입력').fill('테스터A'); await sleep(200);
await page.getByText('확인', { exact: true }).click(); await sleep(800);
await page.locator('[data-shootable="start"]').click(); await sleep(1200);

// 무기 선택: 무기 후보 중 aimX가 0에 가장 가까운 것을 클릭
for (let i = 0; i < 20; i++) {
  const s = await snap(page);
  if (!s) break;
  log('phase', s.phase, 'selection', s.selection.kind, 'wave', s.wave);
  if (s.selection.kind === 'weapon') {
    const ws = s.targets.filter((t) => t.selectKind === 'weapon');
    const pick = ws.sort((a, b) => Math.abs(a.aimX) - Math.abs(b.aimX))[0];
    const p = normToScreen(pick.aimX, pick.aimY);
    log('weapon candidates', ws.map((t) => `${t.selectValue}@${t.aimX.toFixed(2)},${t.aimY.toFixed(2)}`).join(' | '));
    await page.mouse.move(p.x, p.y, { steps: 4 }); await sleep(100); await page.mouse.down(); await sleep(60); await page.mouse.up();
    await sleep(800);
  } else if (s.phase === 'PLAYING' || s.selection.kind === null) break;
  else await sleep(500);
}
let s = await snap(page);
log('combat state', JSON.stringify({ phase: s.phase, sel: s.selection, p0: s.players[0] }));

// 1초 누르기 측정 (10샘플, 100ms 간격)
const samples = [];
await page.mouse.move(720, 300, { steps: 3 });
const before = (await snap(page)).players[0].ammo;
await page.mouse.down();
for (let i = 0; i < 10; i++) { await sleep(100); samples.push((await snap(page)).players[0].ammo); }
await page.mouse.up();
await sleep(300);
const after = (await snap(page)).players[0].ammo;
log('hold samples', samples, 'before', before, 'after', after);
// 짧게 한 번 클릭
const b2 = (await snap(page)).players[0].ammo;
await page.mouse.click(720, 300); await sleep(300);
const a2 = (await snap(page)).players[0].ammo;
log('single click ammo', b2, '->', a2);
const weaponKind = (await snap(page)).players[0].weaponKind;
saveJson('probe-hold-mouse.json', { weaponKind, before, samples, after, singleBefore: b2, singleAfter: a2, errors: collected });
await page.screenshot({ path: '/private/tmp/claude-501/-Users-bigtree-orca-workspaces-ob-crash-game-surgeonfish/b8f7d260-884e-44d5-bb01-7c9862702077/scratchpad/probe/hold.png' });
await browser.close();
