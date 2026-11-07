import { createTestEnv, sleep, log, OUT, toScreenX, toScreenY } from './helper.mjs';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(OUT, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'play-records.jsonl');

async function main() {
  log('=== Q2 Items 5 & 6 Test Starting ===');
  const env = await createTestEnv();
  const { page, shot, getSnapshot, fakePhone, cleanup, errors, pageErrors } = env;

  const results = {
    testName: 'Q2-Items-5-6-Records-and-TeamRanking',
    timestamp: new Date().toISOString(),
    mouseDeviceId: null,
    phoneDeviceId: 'fixed_phone_q2_device_id',
    match1: {},
    match2: {},
    rankingCheck: {},
    errors: [],
  };

  try {
    // 1. 마우스 기기 ID 및 닉네임 설정
    log('1. Setting up 1P Mouse and 2P Phone in Lobby...');
    // 마우스 버튼 클릭
    const mouseBtn = page.getByText('🖱 마우스').first();
    await mouseBtn.click();
    await sleep(400);

    const nickInput = page.locator('input[placeholder="닉네임 입력"]');
    if ((await nickInput.count()) > 0) {
      await nickInput.fill('마우스대장');
      await sleep(200);
      const confirmBtn = page.getByRole('button', { name: '확인' }).or(page.getByText('확인')).first();
      await confirmBtn.click();
      await sleep(500);
    }

    // 마우스 기기 ID 읽기
    const mouseDeviceId = await page.evaluate(() => localStorage.getItem('beer_crusher_device_id'));
    results.mouseDeviceId = mouseDeviceId;
    log('Mouse Device ID:', mouseDeviceId);

    // 2P 폰 모바일 선택 & 페어링
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
    // MATCH 1
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

    // 1P 마우스로 왼쪽 카드 클릭
    const wt1 = (snap.targets || []).filter((t) => t.selectKind === 'weapon');
    const p1Card1 = wt1.filter((t) => t.ownerIndex === 0 || t.aimX < 0)[0];
    const p2Card1 = wt1.filter((t) => t.ownerIndex === 1 || t.aimX > 0)[0];

    const cx1 = toScreenX(p1Card1.aimX);
    const cy1 = toScreenY(p1Card1.aimY);
    log(`1P Mouse clicking weapon card at (${cx1}, ${cy1})`);
    await page.mouse.click(cx1, cy1);

    // 2P 폰으로 오른쪽 카드 사격
    log(`2P Phone shooting weapon card at (${p2Card1.aimX}, ${p2Card1.aimY})`);
    await p2.aimHold(p2Card1.aimX, p2Card1.aimY, 300);
    await p2.snapFire(p2Card1.aimX, p2Card1.aimY);

    // 전투 대기
    for (let i = 0; i < 40; i++) {
      snap = await getSnapshot();
      if (snap?.phase === 'PLAYING' && snap?.selection?.kind === null) break;
      await sleep(250);
    }
    log('Match 1 combat entered.');

    // 몇 개 타겟 사격하여 점수 획득 (약 10초간 사격)
    const tShoot1 = Date.now();
    while (Date.now() - tShoot1 < 10000) {
      snap = await getSnapshot();
      if (snap?.phase !== 'PLAYING') break;
      const targets = (snap.targets || []).filter((t) => t.landed && !t.isItem && !t.selectKind);
      if (targets.length > 0) {
        const t = targets[0];
        // 1P 마우스 클릭 사격
        await page.mouse.click(toScreenX(t.aimX), toScreenY(t.aimY));
        // 2P 폰 사격
        await p2.snapFire(t.aimX, t.aimY);
      }
      await sleep(150);
    }

    // 사격을 멈추고 게임오버 대기
    log('Match 1 waiting for GAMEOVER...');
    while (true) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') break;
      await sleep(500);
    }
    log('Match 1 GAMEOVER reached!');
    await sleep(2000); // 점수 제출 및 파일 쓰기 대기
    await shot('Q2-05-01-match1-result');

    // 1차 파일 검사
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
    };

    // 팀 랭킹 탭 클릭 확인
    const teamRankTab = page.getByRole('button', { name: '👥 팀 랭킹' }).or(page.getByText('팀 랭킹')).first();
    if ((await teamRankTab.count()) > 0) {
      await teamRankTab.click();
      await sleep(500);
      await shot('Q2-06-01-match1-team-ranking-tab');
    }

    // ==========================================
    // MATCH 2 (같은 브라우저 마우스 + 같은 폰 ID)
    // ==========================================
    log('=== Starting Match 2 (Retry) ===');
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

    // 이번엔 더 많은 점수를 위해 약 20초간 적극 사격
    const tShoot2 = Date.now();
    while (Date.now() - tShoot2 < 20000) {
      snap = await getSnapshot();
      if (snap?.phase !== 'PLAYING') break;
      const targets = (snap.targets || []).filter((t) => t.landed && !t.isItem && !t.selectKind);
      if (targets.length > 0) {
        const t = targets[0];
        await page.mouse.click(toScreenX(t.aimX), toScreenY(t.aimY));
        await p2.snapFire(t.aimX, t.aimY);
      }
      await sleep(120);
    }

    // 사격을 멈추고 게임오버 대기
    log('Match 2 waiting for GAMEOVER...');
    while (true) {
      snap = await getSnapshot();
      if (snap?.phase === 'GAMEOVER') break;
      await sleep(500);
    }
    log('Match 2 GAMEOVER reached!');
    await sleep(2000); // 점수 제출 및 파일 쓰기 대기
    await shot('Q2-05-02-match2-result');

    // 2차 파일 검사 (총 2판 -> 총 coop 4줄이어야 함!)
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
    };

    // 결과 화면에서 팀 랭킹 탭 확인 (한 줄만 있는지!)
    const teamRankTab2 = page.getByRole('button', { name: '👥 팀 랭킹' }).or(page.getByText('팀 랭킹')).first();
    if ((await teamRankTab2.count()) > 0) {
      await teamRankTab2.click();
      await sleep(500);
      await shot('Q2-06-02-match2-team-ranking-tab');
    }

    // 팀 랭킹 테이블 내용 검사
    const rankingTableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, [data-testid^="team-rank-row"]'));
      return rows.map((r) => r.innerText);
    });
    log('Ranking table rows snippet:', JSON.stringify(rankingTableData.slice(0, 10)));

    // 로비로 이동
    const lobbyBtn = page.locator('[data-shootable="lobby"]');
    await lobbyBtn.click();
    await sleep(1500);

    // 로비에서 팀 랭킹 탭 클릭
    const lobbyTeamRankTab = page.getByRole('button', { name: '👥 팀 랭킹' }).or(page.getByText('팀 랭킹')).first();
    if ((await lobbyTeamRankTab.count()) > 0) {
      await lobbyTeamRankTab.click();
      await sleep(500);
      await shot('Q2-06-03-lobby-team-ranking-tab');
    }

    const lobbyRankData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, [data-testid^="team-rank-row"]'));
      return rows.map((r) => r.innerText);
    });

    results.rankingCheck = {
      resultRows: rankingTableData,
      lobbyRows: lobbyRankData,
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
