// QA-A(R2) A-4 튜토리얼·센서 랩, 5-3 경계(1440×900 / 1024×768), 5-4 로비 모달 잘림.
import { launch, newPage, sleep, log, snap, check, collected, saveJson, normToScreen, shot, fakePhone, roomIdOf } from './lib-a.mjs';

const browser = await launch();
const R = {};

// 화면 밖/잘림 측정: 보이는 텍스트 요소가 뷰포트 밖이면 기록, 스크롤 컨테이너 안이면 "스크롤로 접근" 표시
const layout = (page) => page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight;
  const out = [];
  const scrollable = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 2) return true; } return false; };
  for (const el of document.querySelectorAll('button, [data-shootable], h1, h2, h3, span, p, div')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const txt = (el.innerText || el.textContent || '').trim();
    if (!txt || txt.length > 50 || el.children.length > 2) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) out.push({ t: txt.slice(0, 28), rect: [r.left, r.top, r.right, r.bottom].map(Math.round), scrollAccessible: scrollable(el) });
  }
  return { vw, vh, docScrollW: document.documentElement.scrollWidth, docScrollH: document.documentElement.scrollHeight, outside: out.slice(0, 40), outsideCount: out.length, unscrollable: out.filter((o) => !o.scrollAccessible).length };
});

// ---------- A-4-튜토리얼 (마우스, 1440×900) ----------
{
  const { page } = await newPage(browser, { tag: 'tutorial' });
  await page.getByText('🎓 튜토리얼 시작').first().click({ timeout: 60000 }); await sleep(1500);
  const panel = await page.evaluate(() => { const t = document.body.innerText; return { step1: t.includes('STEP 1'), guideBtn: t.includes('가이드'), exitBtn: t.includes('로비') }; });
  await shot(page, 'A-4-01-tutorial-step1');
  const seq = []; let lastStep = null; const t0 = Date.now();
  let step4Done = false;
  while (Date.now() - t0 < 6 * 60 * 1000) {
    const txt = await page.evaluate(() => document.body.innerText);
    const m = txt.match(/STEP (\d)/); const st = m ? m[1] : (/훈련 수료/.test(txt) ? 'COMPLETED' : null);
    if (st !== lastStep) { seq.push({ step: st, tMs: Date.now() - t0 }); log('tutorial step', st); lastStep = st; if (st === '2') await shot(page, 'A-4-02-tutorial-step2'); if (st === '3') await shot(page, 'A-4-03-tutorial-step3'); if (st === '4') await shot(page, 'A-4-04-tutorial-step4'); }
    if (st === 'COMPLETED' || st === null && seq.length > 1) break;
    const s = await snap(page);
    if (!s) { await sleep(300); continue; }
    const tgt = s.targets.filter((t) => t.landed && !t.isItem && !t.selectKind).sort((a, b) => a.radiusM - b.radiusM)[0];
    if (st === '1' && tgt) { const q = normToScreen(tgt.aimX, tgt.aimY); await page.mouse.move(q.x, q.y, { steps: 3 }); await page.mouse.click(q.x, q.y); await sleep(400); }
    else if (st === '2' && tgt) { const q = normToScreen(tgt.aimX, tgt.aimY); await page.mouse.move(q.x, q.y, { steps: 3 }); await page.mouse.down(); await sleep(2000); await page.mouse.up(); await sleep(300); }
    else if (st === '3') { await page.mouse.click(720, 450, { button: 'right' }); await sleep(900); }
    else if (st === '4') { if (!step4Done) { await shot(page, 'A-4-04b-tutorial-fever-ready'); step4Done = true; } await page.mouse.dblclick(720, 300); await sleep(600); }
    else await sleep(300);
  }
  const fin = await page.evaluate(() => ({ completed: document.body.innerText.includes('훈련 수료') }));
  await shot(page, 'A-4-05-tutorial-end');
  const reached = seq.map((x) => x.step);
  check('A-4-tutorial', panel.step1 && reached.includes('1') && reached.includes('2') && reached.includes('3') && reached.includes('4') && fin.completed ? 'PASS' : 'BUG',
    '튜토리얼 STEP 1→4 진행 후 수료, 마우스로 끝까지 가능', { panel, seq, fin });
  R.tutorial = { seq, panel, fin };
  await page.context().close();
}

// ---------- A-4-센서 랩 + A-3 P04 (폰 2P 슬롯 영점 리셋 적용) ----------
{
  const { page } = await newPage(browser, { tag: 'lab' });
  await page.getByText('🎯 영점·센서').first().click({ timeout: 60000 }); await sleep(1500);
  const btnTexts = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim()).filter(Boolean));
  await shot(page, 'A-4-06-sensor-lab-open');
  log('lab buttons', btnTexts);
  const testBtn = btnTexts.find((t) => /테스트 사격|사격/.test(t));
  const realBtn = btnTexts.find((t) => /실전 시작/.test(t));
  const zeroBtn = btnTexts.find((t) => /영점/.test(t) && /리셋|재설정|초기화|맞춤/.test(t));
  // 테스트 사격 버튼 동작
  let testBefore = null, testAfter = null;
  if (testBtn) { await page.getByRole('button', { name: testBtn }).first().click(); await sleep(800); testAfter = await snap(page); }
  await shot(page, 'A-4-07-sensor-lab-after-test');
  // 실전 시작 (시작 조건을 거치는지: 폰/마우스 미연결 상태)
  let realResult = null;
  if (realBtn) { await page.getByRole('button', { name: realBtn }).first().click(); await sleep(1500); const s = await snap(page); const t = await page.evaluate(() => document.body.innerText); realResult = { phase: s?.phase ?? null, noticeText: /연결|준비|영점|슬롯/.test(t) }; }
  await shot(page, 'A-4-08-sensor-lab-real-start-gate');
  check('A-4-lab-buttons', testBtn && realBtn ? 'PASS' : 'BUG', `센서 랩 버튼 존재: 테스트 사격(${!!testBtn}), 실전 시작(${!!realBtn})`, { btnTexts, realResult, testAfterPhase: testAfter?.phase });
  R.lab = { btnTexts, realResult, testPhase: testAfter?.phase, zeroBtn: zeroBtn ?? null };
  await page.context().close();
}
{
  // P04: 폰(2P 슬롯) 연결 → 센서 랩 영점 리셋 → 폰이 CALIBRATE 관련 응답을 받는지
  const { page } = await newPage(browser, { tag: 'lab-phone' });
  await page.locator('text=📱 모바일').nth(1).click({ force: true }); await sleep(1000);
  const roomId = await roomIdOf(page);
  const ph = fakePhone(roomId, 2, '폰테스터2P');
  await ph.join(); await ph.zero(); await ph.aimHold(0, 0, 600);
  await page.getByText('🎯 영점·센서').first().click({ timeout: 60000 }); await sleep(1500);
  const btnTexts = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim()).filter(Boolean));
  const zeroBtn = btnTexts.find((t) => /영점/.test(t) && !/로비|테스트장/.test(t));
  log('lab-phone buttons', btnTexts);
  await shot(page, 'A-4-09-sensor-lab-with-phone');
  const before = ph.received.length;
  if (zeroBtn) { await page.getByRole('button', { name: zeroBtn }).first().click(); }
  await sleep(1200);
  const newMsgs = ph.received.slice(before);
  await ph.aimHold(0.5, 0.5, 300);
  await shot(page, 'A-4-10-sensor-lab-after-zero-reset');
  check('A-3-P04-zero-reset', zeroBtn ? 'SKIP' : 'SKIP', zeroBtn ? `영점 리셋 버튼(${zeroBtn}) 클릭 후 폰 수신 메시지 ${JSON.stringify(newMsgs)} — 영점 적용 여부는 값만으로 확정 불가` : '센서 랩에서 영점 리셋 버튼을 찾지 못함', { btnTexts, newMsgs, phoneErrors: ph.errors });
  R.labPhone = { zeroBtn, newMsgs, btnTexts };
  ph.close();
  await page.context().close();
}

// ---------- 5-3 경계: 1440×900 / 1024×768 로비·선택·전투·일시정지 ----------
for (const [w, h] of [[1440, 900], [1024, 768]]) {
  const tag = `${w}x${h}`;
  const { page, ctx } = await newPage(browser, { width: w, height: h, tag });
  const L = {};
  L.lobbyEmpty = await layout(page); await shot(page, `A-5-3-${tag}-lobby-empty`);
  await page.getByText('🖱 마우스').first().click({ timeout: 60000 }); await sleep(500);
  await page.getByPlaceholder('닉네임 입력').fill('테스터A'); await sleep(200);
  await page.getByText('확인', { exact: true }).click(); await sleep(800);
  L.lobbyModalReady = await layout(page); await shot(page, `A-5-3-${tag}-lobby-ready`);
  await page.locator('[data-shootable="start"]').click(); await sleep(900);
  L.weaponSelect = await layout(page); await shot(page, `A-5-3-${tag}-weapon-select`);
  const s = await snap(page);
  const pick = s.targets.filter((t) => t.selectKind === 'weapon').sort((a, b) => Math.abs(a.aimX) - Math.abs(b.aimX))[0];
  const q = normToScreen(pick.aimX, pick.aimY, w, h);
  await page.mouse.move(q.x, q.y, { steps: 3 }); await page.mouse.down(); await sleep(60); await page.mouse.up();
  await sleep(1500);
  L.combat = await layout(page); await shot(page, `A-5-3-${tag}-combat`);
  await page.keyboard.press('Escape'); await sleep(700);
  L.pause = await layout(page); await shot(page, `A-5-3-${tag}-pause`);
  R[`layout_${tag}`] = L;
  const bad = Object.entries(L).filter(([, v]) => v.unscrollable > 0 || v.docScrollW > v.vw + 1);
  check(`A-5-3-${tag}`, bad.length === 0 ? 'PASS' : 'BUG', `${tag}: 로비·선택·전투·일시정지 화면 밖 요소(스크롤 불가) ${bad.length ? bad.map(([k, v]) => `${k}:${v.unscrollable}`).join(',') : '없음'}`, Object.fromEntries(Object.entries(L).map(([k, v]) => [k, { outsideCount: v.outsideCount, unscrollable: v.unscrollable, docScrollW: v.docScrollW, docScrollH: v.docScrollH, outside: v.outside.slice(0, 8) }])));
  await ctx.close();
}

await browser.close();
saveJson('qa-a-tutorial-lab-layout-values.json', { checks: collected.checks, ...R, errors: { pageErrors: collected.pageErrors, consoleErrors: collected.consoleErrors } });
log('DONE tutorial/lab/layout');
