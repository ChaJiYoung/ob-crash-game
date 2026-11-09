import { chromium } from 'playwright';
import WebSocket from 'ws';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function captureLobbyScreens() {
  console.log('Starting browser for lobby captures...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--use-gl=angle', '--use-angle=metal'],
  });

  const screensDir = path.join(process.cwd(), 'docs/screens');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('1. Navigating to https://127.0.0.1:5173...');
  await page.goto('https://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await sleep(1500);

  // 1. PC Lobby default (1P Mobile default selected, QR visible, Next step banner)
  console.log('Capturing screen-01-pc-lobby.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-01-pc-lobby.png') });
  console.log('Captured screen-01-pc-lobby.png');

  // screen-01-pc-lobby-qr.png
  console.log('Capturing screen-01-pc-lobby-qr.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-01-pc-lobby-qr.png') });
  console.log('Captured screen-01-pc-lobby-qr.png');

  // 2. Pair 1P phone via WebSocket
  const roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id'));
  console.log('Found PC Room ID:', roomId);

  if (roomId) {
    const ws = new WebSocket('ws://localhost:8787');
    await new Promise((res, rej) => {
      ws.on('open', res);
      ws.on('error', rej);
    });

    const deviceId = 'capture-phone-1';
    ws.send(JSON.stringify({
      type: 'REGISTER_NICKNAME',
      roomId,
      deviceId,
      nickname: '황금맥주헌터',
      slot: 1,
    }));
    await sleep(500);

    ws.send(JSON.stringify({
      type: 'CALIBRATE_ZERO',
      roomId,
      deviceId,
      slot: 1,
    }));
    await sleep(1000);

    console.log('Capturing screen-01b-pc-lobby-paired.png...');
    await page.screenshot({ path: path.join(screensDir, 'screen-01b-pc-lobby-paired.png') });
    console.log('Captured screen-01b-pc-lobby-paired.png');

    ws.close();
  } else {
    console.warn('Could not find roomId to pair phone');
  }

  await browser.close();
  console.log('Lobby screens captured successfully!');
}

captureLobbyScreens().catch((err) => {
  console.error(err);
  process.exit(1);
});
