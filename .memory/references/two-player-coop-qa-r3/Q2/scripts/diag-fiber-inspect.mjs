import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';

const URL = 'https://127.0.0.1:5222/';
const WS = 'ws://127.0.0.1:8822';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(1500);

  const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));

  function phone(slot) {
    const ws = new WebSocket(WS);
    const send = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
    const ready = new Promise((res) => ws.on('open', res));
    return {
      async join() { await ready; send({ type: 'REGISTER_NICKNAME', roomId, deviceId: `p_${slot}`, nickname: `폰${slot}`, slot }); await sleep(250); },
      async zero() { send({ type: 'CALIBRATE_ZERO', roomId, deviceId: `p_${slot}`, slot }); await sleep(250); },
      async snap(x, y) {
        send({ type: 'SENSOR_FRAME', roomId, deviceId: `p_${slot}`, slot, payload: { aimX: x, aimY: y, snapFire: true, timestamp: Date.now() } });
        await sleep(50);
        send({ type: 'SENSOR_FRAME', roomId, deviceId: `p_${slot}`, slot, payload: { aimX: x, aimY: y, snapFire: false, timestamp: Date.now() } });
      },
      close() { ws.close(); }
    };
  }

  await page.getByText('📱 모바일').nth(0).click();
  await sleep(200);
  await page.getByText('📱 모바일').nth(1).click();
  await sleep(300);

  const p1 = phone(1);
  const p2 = phone(2);
  await p1.join();
  await p2.join();
  await p1.zero();
  await p2.zero();

  await p1.snap(0, 0);

  // 무기 선택
  let snap = null;
  for (let i = 0; i < 40; i++) {
    snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap?.selection?.kind === 'weapon') break;
    await sleep(250);
  }
  const wt = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
  await p1.snap(wt[0].aimX, wt[0].aimY);
  await p2.snap(wt[3].aimX, wt[3].aimY);

  for (let i = 0; i < 40; i++) {
    snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
    await sleep(250);
  }

  p2.close();
  const aloneBtn = page.getByText('혼자 계속하기');
  await aloneBtn.waitFor({ state: 'visible', timeout: 15000 });
  await aloneBtn.click();
  await sleep(1500);

  while (true) {
    snap = await page.evaluate(() => window.__BEER_DEBUG__?.snapshot());
    if (snap?.phase === 'GAMEOVER') break;
    await sleep(500);
  }
  console.log('GAMEOVER reached!');
  await sleep(1000);

  // React Fiber를 통해 내부 state/refs 분석
  const fiberAnalysis = await page.evaluate(() => {
    const rootEl = document.getElementById('root');
    const fiberKey = Object.keys(rootEl || {}).find((k) => k.startsWith('__reactFiber$'));
    let fiber = rootEl ? rootEl[fiberKey] : null;

    // PCGamePage fiber 찾기
    let targetFiber = null;
    function walk(f) {
      if (!f) return;
      if (f.type && typeof f.type === 'function' && f.type.name === 'PCGamePage') {
        targetFiber = f;
        return;
      }
      walk(f.child);
      walk(f.sibling);
    }
    walk(fiber);

    if (!targetFiber) {
      // name이 없을 수 있으므로 hooks를 가진 컴포넌트 탐색
      function findWithHooks(f) {
        if (!f) return;
        if (f.memoizedState && f.memoizedState.next && f.memoizedState.next.next) {
          targetFiber = f;
          return;
        }
        findWithHooks(f.child);
        findWithHooks(f.sibling);
      }
      findWithHooks(fiber);
    }

    const hooks = [];
    if (targetFiber) {
      let h = targetFiber.memoizedState;
      let idx = 0;
      while (h) {
        const val = h.memoizedState;
        if (val && typeof val === 'object' && 'current' in val) {
          hooks.push({ idx, type: 'ref', val: val.current });
        } else {
          hooks.push({ idx, type: 'state', val: typeof val === 'object' ? JSON.stringify(val).slice(0, 50) : String(val) });
        }
        h = h.next;
        idx++;
      }
    }

    return {
      foundPCGamePage: Boolean(targetFiber),
      componentName: targetFiber?.type?.name,
      hooksCount: hooks.length,
      hooksSummary: hooks.map((hk) => {
        if (hk.type === 'ref') {
          const cur = hk.val;
          if (Array.isArray(cur)) return `ref(array[${cur.length}])`;
          if (cur && typeof cur === 'object') {
            if (cur.aim) return `ref(Processor: aim=${JSON.stringify(cur.aim)})`;
            if (cur[1] && cur[1].onSensorFrame) return `ref(PhoneAdapters)`;
            return `ref(object keys: ${Object.keys(cur).join(',')})`;
          }
          return `ref(${typeof cur})`;
        }
        return `state(${hk.val})`;
      }),
      // 구체적 ref들 조사
      detailedRefs: hooks.filter((hk) => hk.type === 'ref').map((hk) => {
        const cur = hk.val;
        if (cur && cur[1] && cur[1].onSensorFrame) {
          const a1 = cur[1];
          return {
            isPhoneAdapters: true,
            slot1Zero: a1.zeroOffset,
            slot1LatestAim: a1.latestAim,
            slot1SinkResult: a1.opts?.sink ? (a1.opts.sink() ? 'has sink' : 'sink is null/undefined') : 'no sink opt',
          };
        }
        if (Array.isArray(cur) && cur.length > 0 && cur[0]?.aim) {
          return {
            isProcessors: true,
            count: cur.length,
            p0Aim: cur[0].aim,
          };
        }
        return null;
      }).filter(Boolean),
    };
  });

  console.log('FIBER ANALYSIS:', JSON.stringify(fiberAnalysis, null, 2));

  p1.close();
  await browser.close();
}

main().catch(console.error);
