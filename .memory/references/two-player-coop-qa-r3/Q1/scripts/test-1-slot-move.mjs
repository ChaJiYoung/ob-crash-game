import { createTestEnv, sleep, log, OUT_DIR } from './test-helper.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  log('Starting Test 1: Slot Move...');
  const env = await createTestEnv();
  const { page, roomId, shot, cleanup } = env;

  const getSlotCardInfo = async () => {
    return page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid^="slot-card-"]'));
      return cards.map((c) => {
        const slotId = c.getAttribute('data-testid');
        const text = c.innerText.replace(/\n/g, ' | ');
        const mouseBtn = Array.from(c.querySelectorAll('button')).find((b) => b.innerText.includes('마우스'));
        return {
          slotId,
          text,
          mouseBtnDisabled: mouseBtn ? mouseBtn.disabled : null,
          hasMouseBtn: !!mouseBtn,
        };
      });
    });
  };

  const results = [];

  // Initial
  await sleep(1000);
  const initialInfo = await getSlotCardInfo();
  log('Initial slot info:', JSON.stringify(initialInfo, null, 2));
  await shot('Q1-01-slot-step0-initial');

  const ws = new WebSocket(env.ws || 'ws://127.0.0.1:8821');
  await new Promise((r) => ws.on('open', r));
  const deviceId = 'device_phone_X';
  const nickname = '폰X';

  // Step 1: Pair X to Slot 2
  log('Step 1: Pairing device X to slot 2...');
  ws.send(JSON.stringify({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot: 2 }));
  await sleep(1000);
  const step1Info = await getSlotCardInfo();
  log('Step 1 slot info:', JSON.stringify(step1Info, null, 2));
  await shot('Q1-01-slot-step1-2p');

  // Step 2: Pair X to Slot 1
  log('Step 2: Pairing same device X to slot 1...');
  ws.send(JSON.stringify({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot: 1 }));
  await sleep(1000);
  const step2Info = await getSlotCardInfo();
  log('Step 2 slot info:', JSON.stringify(step2Info, null, 2));
  await shot('Q1-01-slot-step2-1p');

  // Step 3: Pair X back to Slot 2
  log('Step 3: Pairing same device X back to slot 2...');
  ws.send(JSON.stringify({ type: 'REGISTER_NICKNAME', roomId, deviceId, nickname, slot: 2 }));
  await sleep(1000);
  const step3Info = await getSlotCardInfo();
  log('Step 3 slot info:', JSON.stringify(step3Info, null, 2));
  await shot('Q1-01-slot-step3-back-to-2p');

  ws.close();
  await cleanup();

  const reportData = {
    initialInfo,
    step1Info,
    step2Info,
    step3Info,
    errors: env.errors,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'test-1-result.json'), JSON.stringify(reportData, null, 2));
  log('Test 1 finished.');
}

run().catch((e) => {
  console.error('Test 1 error:', e);
  process.exit(1);
});
