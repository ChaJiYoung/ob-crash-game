import { chromium } from 'playwright';
import WebSocket from 'ws';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 기본은 vite 기본 포트. 다른 포트면 CAPTURE_URL=https://127.0.0.1:5199 처럼 넘긴다.
const BASE_URL = process.env.CAPTURE_URL ?? 'https://127.0.0.1:5173';

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

  console.log(`1. Navigating to ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await sleep(1500);

  // 1. PC Lobby default (1P·2P 모두 모바일 기본 선택, 두 QR, 플레이어별 배너, 비활성 시작 버튼)
  console.log('Capturing screen-01-pc-lobby.png...');
  await page.screenshot({ path: path.join(screensDir, 'screen-01-pc-lobby.png') });
  console.log('Captured screen-01-pc-lobby.png');

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
    await sleep(800);

    // 1P 접속·영점 대기, 2P는 QR 대기 (1P가 아직 준비 전이라 2P는 "선택"이 아니다)
    console.log('Capturing screen-01-pc-lobby-qr.png...');
    await page.screenshot({ path: path.join(screensDir, 'screen-01-pc-lobby-qr.png') });
    console.log('Captured screen-01-pc-lobby-qr.png');

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

    // 랭킹 패널: 클리어는 CLEAR, 7웨이브에서 죽은 기록은 W7 (서버 DB에 촬영용 기록을 심어 둔 경우)
    const rankingPanel = page.locator('[role="tablist"]').first().locator('xpath=../..');
    if (await rankingPanel.count()) {
      await rankingPanel.screenshot({ path: path.join(screensDir, 'play-ranking-clear-marker.png') });
      console.log('Captured play-ranking-clear-marker.png');
    }

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
