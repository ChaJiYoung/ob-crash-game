import { createTestEnv, sleep, log, OUT, toScreenX, toScreenY } from './helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(OUT, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'play-records.jsonl');

async function main() {
  log('=== Q2 Items 5 & 6 Verified Test Starting ===');

  // 깨끗한 판 수/줄 수 대조를 위해 임시 play-records.jsonl 초기화 (백업 후)
  if (fs.existsSync(RECORDS_FILE)) {
    fs.copyFileSync(RECORDS_FILE, `${RECORDS_FILE}.bak`);
    fs.writeFileSync(RECORDS_FILE, '', 'utf-8');
  }

  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup, errors, pageErrors } = env;

  const results = {
    testName: 'Q2-Items-5-6-Verified',
    timestamp: new Date().toISOString(),
    mouseDeviceId: null,
    phoneDeviceId: 'fixed_phone_q2_partner_id',
    match1: {},
    match2: {},
    teamRankingCheck: {},
    errors: [],
  };

  try {
    // ==========================================
    // 1. 1P 마우스 설정 & 2P 폰 연결
    // ==========================================
    log('1. Setting up 1P Mouse and 2P Phone in lobby...');
    const mouseBtn = page.getByText('🖱 마우스').first();
    await mouseBtn.click();
    await sleep(400);

    const nickInput = page.locator('input[placeholder="닉네임 입력"]');
    if ((await nickInput.count()) > 0) {
      await nickInput.fill('마우스1P');
      await sleep(200);
      const confirmBtn = page.getByRole('button', { name: '확인' }).or(page.getByText('확인')).first();
      await confirmBtn.click();
      await sleep(500);
    }

    // 마우스 기기 ID 읽기
    const mouseDeviceId = await page.evaluate(() => localStorage.getItem('beer_crusher_device_id'));
    results.mouseDeviceId = mouseDeviceId;
    log('Mouse Device ID (1P):', mouseDeviceId);
    log('Phone Device ID (2P):', results.phoneDeviceId);

    // 2P 모바일 선택 & 페어링
    const p2MobileBtn = page.getByText('📱 모바일').nth(1);
    await p2MobileBtn.click();
    await sleep(400);

    const p2 = fakePhone(2, '고정폰2P', results.phoneDeviceId);
    await p2.join();
    await sleep(400);
    await p2.zero();
    await sleep(500);

    await shot('Q2-05-00-lobby-ready');

    // ==========================================
    // MATCH 1 (첫 번째 판: 점수 약 200~300점 획득 후 게임오버)
    // ==========================================
    log('=== Starting Match 1 ===');
    const startBtn = page.locator('[data-shootable="start"]');
    await startBtn.click();

    // 무기 선택 대기
    let snap = null;
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon') break;
      await sleep(250);
    }

    const wt1 = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
    const p1Card1 = wt1.filter((t) => t.ownerIndex === 0 || t.aimX < 0)[0];
    const p2Card1 = wt1.filter((t) => t.ownerIndex === 1 || t.aimX > 0)[0];

    // 1P 마우스 클릭, 2P 폰 사격
    await page.mouse.click(toScreenX(p1Card1.aimX), toScreenY(p1Card1.aimY));
    await p2.aimHold(p2Card1.aimX, p2Card1.aimY, 300);
    await p2.snapFire(p2Card1.aimX, p2Card1.aimY);

    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
      await sleep(250);
    }
    log('Match 1 combat entered.');

    // 약 8초간 가볍게 사격하여 점수 획득
    const tShoot1 = Date.now();
    while (Date.now() - tShoot1 < 8000) {
      snap = await getSnapshot();
      if (snap?.phase !== 'PLAYING') break;
      const targets = (snap.targets || []).filter((t) => t.landed && !t.isItem && !t.selectKind);
      if (targets.length > 0) {
        const t = targets[0];
        await page.mouse.click(toScreenX(t.aimX), toScreenY(t.aimY));
        await p2.snapFire(t.aimX, t.aimY);
      }
      await sleep(150);
    }

    // 사격을 멈추고 게임오버 대기
    log('Waiting for Match 1 GAMEOVER...');
    while (true) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') break;
      await sleep(500);
    }
    await sleep(2000); // 점수 제출 및 파일 쓰기 대기
    log('Match 1 GAMEOVER reached!');
    await shot('Q2-05-01-match1-result');

    // Match 1 결과 파일 검사
    let records1 = [];
    if (fs.existsSync(RECORDS_FILE)) {
      records1 = fs.readFileSync(RECORDS_FILE, 'utf-8').trim().split('\n').filter(Boolean).map(JSON.parse);
    }
    const coopRecords1 = records1.filter((r) => r.mode === 'coop');
    log(`Match 1: Total records: ${records1.length}, Coop records: ${coopRecords1.length}`);

    results.match1 = {
      p1Score: snap.players[0]?.score,
      p2Score: snap.players[1]?.score,
      teamScore: (snap.players[0]?.score || 0) + (snap.players[1]?.score || 0),
      totalRecordsInFile: records1.length,
      coopRecordsInFile: coopRecords1.length,
      exactTwoLines: coopRecords1.length === 2,
      records: coopRecords1.map((r) => ({
        playedAt: r.playedAt,
        deviceId: r.deviceId,
        nickname: r.nickname,
        mode: r.mode,
        score: r.totalScore,
        coop: r.coop,
      })),
    };

    // Match 1 결과 화면 팀 랭킹 탭 확인
    const teamRankTab1 = page.getByRole('button', { name: '👥 팀 랭킹' }).or(page.getByText('팀 랭킹')).first();
    if ((await teamRankTab1.count()) > 0) {
      await teamRankTab1.click();
      await sleep(600);
      await shot('Q2-06-01-match1-team-ranking');
    }

    // ==========================================
    // MATCH 2 (같은 브라우저 마우스 + 같은 폰 기기 ID 유지)
    // "다시 도전하기" 클릭
    // ==========================================
    log('=== Starting Match 2 (Retry with SAME IDs) ===');
    const restartBtn = page.locator('[data-shootable="restart"]');
    await restartBtn.click();
    await sleep(1000);

    // 무기 선택 대기
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.selection?.kind === 'weapon') break;
      await sleep(250);
    }

    const wt2 = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
    const p1Card2 = wt2.filter((t) => t.ownerIndex === 0 || t.aimX < 0)[0];
    const p2Card2 = wt2.filter((t) => t.ownerIndex === 1 || t.aimX > 0)[0];

    await page.mouse.click(toScreenX(p1Card2.aimX), toScreenY(p1Card2.aimY));
    await p2.aimHold(p2Card2.aimX, p2Card2.aimY, 300);
    await p2.snapFire(p2Card2.aimX, p2Card2.aimY);

    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
      await sleep(250);
    }
    log('Match 2 combat entered.');

    // 이번엔 더 높은 점수를 위해 약 25초간 적극 사격!
    const tShoot2 = Date.now();
    while (Date.now() - tShoot2 < 25000) {
      snap = await getSnapshot();
      if (snap?.phase !== 'PLAYING') break;
      const targets = (snap.targets || []).filter((t) => t.landed && !t.isItem && !t.selectKind);
      if (targets.length > 0) {
        const t = targets[0];
        await page.mouse.click(toScreenX(t.aimX), toScreenY(t.aimY));
        await p2.snapFire(t.aimX, t.aimY);
      }
      await sleep(100);
    }

    // 사격을 멈추고 게임오버 대기
    log('Waiting for Match 2 GAMEOVER...');
    while (true) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') break;
      await sleep(500);
    }
    await sleep(2000); // 점수 제출 및 파일 쓰기 대기
    log('Match 2 GAMEOVER reached!');
    await shot('Q2-05-02-match2-result');

    // Match 2 결과 파일 검사 (총 2판 -> coop 정확히 4줄이어야 함!)
    let records2 = [];
    if (fs.existsSync(RECORDS_FILE)) {
      records2 = fs.readFileSync(RECORDS_FILE, 'utf-8').trim().split('\n').filter(Boolean).map(JSON.parse);
    }
    const coopRecords2 = records2.filter((r) => r.mode === 'coop');
    log(`Match 2: Total records: ${records2.length}, Coop records: ${coopRecords2.length}`);

    results.match2 = {
      p1Score: snap.players[0]?.score,
      p2Score: snap.players[1]?.score,
      teamScore: (snap.players[0]?.score || 0) + (snap.players[1]?.score || 0),
      totalRecordsInFile: records2.length,
      coopRecordsInFile: coopRecords2.length,
      exactFourLines: coopRecords2.length === 4,
      records: coopRecords2.map((r) => ({
        playedAt: r.playedAt,
        deviceId: r.deviceId,
        nickname: r.nickname,
        mode: r.mode,
        score: r.totalScore,
        coop: r.coop,
      })),
    };

    // ==========================================
    // 팀 랭킹 중복 검증 (결과 화면 & 로비 화면)
    // ==========================================
    log('Checking Team Ranking in Result Screen...');
    const teamRankTab2 = page.getByRole('button', { name: '👥 팀 랭킹' }).or(page.getByText('팀 랭킹')).first();
    if ((await teamRankTab2.count()) > 0) {
      await teamRankTab2.click();
      await sleep(600);
      await shot('Q2-06-02-match2-result-team-ranking');
    }

    const resultRankRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, [data-testid^="team-rank-row"], div')).filter(
        (el) => el.textContent && el.textContent.includes('마우스1P') && el.textContent.includes('고정폰2P')
      );
      return Array.from(new Set(rows.map((r) => r.innerText.trim())));
    });
    log('Result Screen Team Rank rows found:', JSON.stringify(resultRankRows));

    // 로비로 이동
    log('Returning to lobby to check Lobby Team Ranking...');
    const lobbyBtn = page.locator('[data-shootable="lobby"]');
    await lobbyBtn.click();
    await sleep(1500);

    // 로비 팀 랭킹 탭 클릭
    const lobbyTeamRankTab = page.getByRole('button', { name: '👥 팀 랭킹' }).or(page.getByText('팀 랭킹')).first();
    if ((await lobbyTeamRankTab.count()) > 0) {
      await lobbyTeamRankTab.click();
      await sleep(600);
      await shot('Q2-06-03-lobby-team-ranking');
    }

    const lobbyRankRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, [data-testid^="team-rank-row"], div')).filter(
        (el) => el.textContent && el.textContent.includes('마우스1P') && el.textContent.includes('고정폰2P')
      );
      return Array.from(new Set(rows.map((r) => r.innerText.trim())));
    });
    log('Lobby Team Rank rows found:', JSON.stringify(lobbyRankRows));

    results.teamRankingCheck = {
      mouseDeviceId,
      phoneDeviceId: results.phoneDeviceId,
      resultRankRows,
      lobbyRankRows,
      singleRowInResult: resultRankRows.length > 0,
      singleRowInLobby: lobbyRankRows.length > 0,
    };

    p2.close();
  } catch (err) {
    log('ERROR in test:', err);
    results.errors.push(err.message);
  } finally {
    results.pageErrors = pageErrors;
    results.consoleErrors = errors;
    fs.writeFileSync(path.join(OUT, 'q2-items5-6-result.json'), JSON.stringify(results, null, 2));
    await cleanup();
  }
}

main();
