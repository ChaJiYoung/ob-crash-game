// A-3 P04 재확인: 2P 슬롯 폰 연결 → 센서 랩 "🎯 정면 영점 리셋" → 폰이 받은 메시지/영점 상태 변화 기록.
import { launch, newPage, sleep, log, snap, saveJson, shot, fakePhone, roomIdOf, collected } from './lib-a.mjs';
const browser = await launch();
const { page } = await newPage(browser, { tag: 'p04' });
await page.locator('text=📱 모바일').nth(1).click({ force: true }); await sleep(1000);
const roomId = await roomIdOf(page);
const ph = fakePhone(roomId, 2, '폰P04');
await ph.join(); await ph.zero(); await ph.aimHold(0.5, 0.5, 600);
const before = ph.received.length;
const lobbyBefore = await page.evaluate(() => document.body.innerText.includes('준비 완료'));
await page.getByText('🎯 영점·센서').first().click({ timeout: 60000 }); await sleep(1500);
await page.getByRole('button', { name: /정면 영점 리셋/ }).first().click({ force: true }); await sleep(1200);
const newMsgs = ph.received.slice(before);
await shot(page, 'A-3-P04-probe-after-front-zero-reset');
const lab = await page.evaluate(() => document.body.innerText.slice(0, 160));
saveJson('qa-a-p04-probe-values.json', { lobbyBefore, newMsgs, labText: lab, errors: { pageErrors: collected.pageErrors, consoleErrors: collected.consoleErrors } });
ph.close(); await browser.close();
log('DONE p04', JSON.stringify(newMsgs));
