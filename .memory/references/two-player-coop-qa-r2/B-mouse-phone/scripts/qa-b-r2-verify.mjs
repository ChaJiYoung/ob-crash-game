// QA-B R2 verification run (value-logged). Usage: node qa-b-r2-verify.mjs <mp|pm>
//   mp = 1P mouse + 2P phone ; pm = 1P phone + 2P mouse
// Judgements are made from snapshot values (window.__BEER_DEBUG__.snapshot) and DOM text;
// screenshots are saved next to the JSON for visual checks. Nothing in src/ server/ tests/ is touched.
import { chromium } from '/Users/bigtree/Git/ob-crash-game/node_modules/playwright/index.mjs';
import WebSocket from '/Users/bigtree/orca/workspaces/ob-crash-game/surgeonfish/node_modules/ws/wrapper.mjs';
import fs from 'node:fs';
import path from 'node:path';

const COMBO = process.argv[2];
if (!['mp', 'pm'].includes(COMBO)) {
  console.error('usage: node qa-b-r2-verify.mjs <mp|pm>');
  process.exit(2);
}
const MOUSE_SLOT = COMBO === 'mp' ? 1 : 2;
const PHONE_SLOT = COMBO === 'mp' ? 2 : 1;
const MOUSE_IDX = MOUSE_SLOT - 1;
const PHONE_IDX = PHONE_SLOT - 1;
const OTHER_SLOT = PHONE_SLOT === 1 ? 2 : 1;

const BASE = path.resolve('.memory/references/two-player-coop-qa-r2/B-mouse-phone');
const DATA = path.join(BASE, 'data');
const RECORDS = path.join(DATA, 'play-records.jsonl');
const PLAYERS = path.join(DATA, 'players.json');
const PFX = `V-${COMBO}`;
const URL = 'https://127.0.0.1:5202/';
const WS_URL = 'ws://localhost:8802';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(now(), `[${COMBO}]`, ...a);

const R = { combo: COMBO, mouseSlot: MOUSE_SLOT, phoneSlot: PHONE_SLOT, startedAt: new Date().toISOString(), checks: [], samples: {}, boundaries: {}, errors: [], consoleWarnings: [], notes: [] };
const check = (id, item, ok, expected, actual, note = '') => {
  const verdict = ok === null ? 'SKIP' : ok ? 'PASS' : 'BUG';
  R.checks.push({ id, item, verdict, expected, actual, note });
  log(`CHECK ${id} ${verdict} | ${item} | expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}${note ? ' | ' + note : ''}`);
  return ok;
};

// ---------- phone (WebSocket fake) ----------
class Phone {
  constructor(deviceId, slot, nickname) {
    this.deviceId = deviceId;
    this.slot = slot;
    this.nickname = nickname;
    this.aim = [0, 0];
    this.flags = {};
    this.pulse = null;
    this.snapOnce = false;
    this.messages = [];
    this.ticker = null;
    this.ws = new WebSocket(WS_URL);
    this.ready = new Promise((res) => this.ws.on('open', res));
    this.ws.on('message', (raw) => {
      try { this.messages.push(JSON.parse(raw.toString())); } catch {}
    });
  }
  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  tick() {
    const payload = {
      aimX: this.aim[0], aimY: this.aim[1], pitchDeg: 0, yawDeg: 0, rollDeg: 0,
      snapFire: false, rapidFireHold: !!this.flags.rapidFireHold, feverTriggered: false,
      skillSnapTriggered: false, isCocked: false, timestamp: Date.now(),
    };
    if (this.snapOnce) { payload.snapFire = true; this.snapOnce = false; }
    if (this.pulse) { Object.assign(payload, this.pulse); this.pulse = null; }
    this.send({ type: 'SENSOR_FRAME', roomId: this.roomId, deviceId: this.deviceId, slot: this.slot, payload });
  }
  startTicker() { if (!this.ticker) this.ticker = setInterval(() => this.tick(), 30); }
  async register(roomId, slot = this.slot) {
    this.roomId = roomId;
    await this.ready;
    this.slot = slot;
    this.send({ type: 'REGISTER_NICKNAME', roomId, deviceId: this.deviceId, nickname: this.nickname, slot });
    this.startTicker();
    await sleep(500);
  }
  async zero() {
    this.send({ type: 'CALIBRATE_ZERO', roomId: this.roomId, deviceId: this.deviceId, slot: this.slot });
    await sleep(400);
  }
  setAim(x, y) { this.aim = [x, y]; }
  async snap(x, y) { this.aim = [x, y]; this.snapOnce = true; await sleep(90); }
  pulseFlag(obj) { this.pulse = obj; }
  errors() { return this.messages.filter((m) => m.type === 'ERROR'); }
  close() { if (this.ticker) clearInterval(this.ticker); this.ticker = null; try { this.ws.close(); } catch {} }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--use-gl=swiftshader', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.errors.push({ type: 'pageerror', msg: e.message, at: now() }));
  page.on('console', (m) => {
    if (m.type() === 'error') R.errors.push({ type: 'console.error', msg: m.text(), at: now() });
    if (m.type() === 'warning') R.consoleWarnings.push({ msg: m.text(), at: now() });
  });

  const S = () => page.evaluate(() => (window.__BEER_DEBUG__ ? window.__BEER_DEBUG__.snapshot() : null));
  const vp = () => page.viewportSize();
  const screenOf = (ax, ay) => { const v = vp(); return [((ax + 1) / 2) * v.width, ((1 - ay) / 2) * v.height]; };
  const bodyText = () => page.evaluate(() => document.body.innerText);
  const shot = async (name) => { await page.screenshot({ path: path.join(BASE, `${name}.png`) }); log('shot', name); };
  const until = async (fn, timeout, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const s = await S();
      if (s && (await fn(s))) return { ok: true, s, ms: Date.now() - t0 };
      await sleep(200);
    }
    return { ok: false, s: await S(), ms: Date.now() - t0, label };
  };
  const mouseShoot = async (ax, ay, holdMs = 60) => {
    const [x, y] = screenOf(ax, ay);
    await page.mouse.move(x, y, { steps: 3 });
    await page.mouse.down();
    await sleep(holdMs);
    await page.mouse.up();
  };
  const mouseAim = async (ax, ay) => { const [x, y] = screenOf(ax, ay); await page.mouse.move(x, y, { steps: 4 }); };

  // boundary: visible interactive elements outside viewport, and document overflow
  const boundary = () => page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    const out = [];
    const cands = Array.from(document.querySelectorAll('button, [data-testid], [data-shootable], input, select, a'));
    const seen = new Set();
    for (const el of cands) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let vis = true;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) { vis = false; break; }
      }
      if (!vis) continue;
      const label = el.getAttribute('data-testid') || el.getAttribute('data-shootable') || (el.innerText || '').trim().slice(0, 30) || el.tagName;
      const inside = r.left >= -0.5 && r.top >= -0.5 && r.right <= W + 0.5 && r.bottom <= H + 0.5;
      if (inside) continue;
      // scrollable ancestor => reachable by scrolling, not clipped
      let scrollable = false;
      for (let n = el.parentElement; n; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) { scrollable = true; break; }
      }
      const key = `${label}|${Math.round(r.left)}|${Math.round(r.top)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label, scrollable, rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) } });
    }
    return { W, H, docScrollW: document.documentElement.scrollWidth, docScrollH: document.documentElement.scrollHeight, outside: out };
  });

  const checkpoint = async (id, name) => {
    await sleep(400);
    await shot(`${PFX}-${id}-${name}`);
    const b1440 = await boundary();
    await page.setViewportSize({ width: 1024, height: 768 });
    await sleep(900);
    await shot(`${PFX}-${id}-${name}-1024`);
    const b1024 = await boundary();
    await page.setViewportSize({ width: 1440, height: 900 });
    await sleep(900);
    R.boundaries[`${id}-${name}`] = { '1440x900': b1440, '1024x768': b1024 };
    log(`boundary ${id}-${name}: 1440 outside=${b1440.outside.filter((o) => !o.scrollable).length} docW=${b1440.docScrollW}; 1024 outside=${b1024.outside.filter((o) => !o.scrollable).length} docW=${b1024.docScrollW}`);
  };

  // ---------- 0. open PC page ----------
  await page.goto(URL, { waitUntil: 'networkidle' });
  await sleep(1200);
  let roomId = null;
  for (let i = 0; i < 40 && !roomId; i++) { roomId = await page.evaluate(() => localStorage.getItem('beer_crusher_pc_room_id')); if (!roomId) await sleep(300); }
  R.roomId = roomId;
  log('room', roomId);
  const countRecords = () => (fs.existsSync(RECORDS) ? fs.readFileSync(RECORDS, 'utf8').trim().split('\n').filter(Boolean).length : 0);
  const recStart = countRecords();
  R.samples.recordsAtStart = recStart;
  const slotCard = (n) => page.locator(`[data-testid="slot-card-${n}"]`);
  await sleep(500);
  await shot(`${PFX}-00-lobby-empty`);
  const s0 = await S();
  check('00', 'lobby initial: both slots empty, phase PAIRING', s0?.phase === 'PAIRING' && (await slotCard(1).innerText()).includes('비어') && (await slotCard(2).innerText()).includes('비어'), { phase: 'PAIRING', both: '비어 있음' }, { phase: s0?.phase });

  // ---------- 1. same device moves slot / other device rejected ----------
  const phoneDev = `qa_b_${COMBO}_phone_${Date.now()}`;
  const phone = new Phone(phoneDev, PHONE_SLOT, '모바일P');
  await phone.register(roomId, PHONE_SLOT);
  await sleep(1200);
  const t1 = await bodyText();
  check('01a', 'phone registers on its slot (nickname on PC)', t1.includes('모바일P'), '모바일P shown', t1.includes('모바일P'));
  // 01b (same device -> other slot) is NOT run here: it breaks the lobby (both mouse buttons disabled).
  // It is recorded separately by diag-slot-move2.mjs, see report.
  // another device tries the occupied slot
  const intruder = new Phone(`qa_b_intruder_${Date.now()}`, PHONE_SLOT, '불청객');
  await intruder.ready;
  intruder.send({ type: 'REGISTER_NICKNAME', roomId, deviceId: intruder.deviceId, nickname: '불청객', slot: PHONE_SLOT });
  await sleep(700);
  const intruderErr = intruder.errors();
  const occupiedAfter = (await slotCard(PHONE_SLOT).innerText()).includes('모바일P');
  check('01c', 'other device on occupied slot is rejected (ERROR to phone) and slot keeps original', intruderErr.length > 0 && occupiedAfter, 'ERROR msg + 모바일P kept', { errors: intruderErr.map((e) => e.code || e.message), occupiedAfter });
  intruder.close();
  await sleep(300);
  // ---------- 2. mouse joins, phone not yet zeroed -> start gate ----------
  await slotCard(MOUSE_SLOT).getByRole('button', { name: '🖱 마우스' }).click();
  await sleep(300);
  await slotCard(MOUSE_SLOT).locator('input[placeholder="닉네임 입력"]').fill(COMBO === 'mp' ? '마우스1P' : '마우스2P');
  await slotCard(MOUSE_SLOT).locator('button[type="submit"]').click();
  await sleep(500);
  // while not ready the start button is not rendered; a start attempt is the phone's centre shot (tryStartFromLobby)
  await phone.snap(0, 0);
  await sleep(350);
  const gateText = await bodyText();
  const gateS = await S();
  const gateNotice = `${PHONE_SLOT}P 준비 중`;
  check('02', `start with one side not ready shows "${gateNotice}" and does not start`, gateText.includes(gateNotice) && gateS.phase === 'PAIRING', { notice: gateNotice, phase: 'PAIRING' }, { notice: gateText.includes(gateNotice), phase: gateS.phase });
  await shot(`${PFX}-02-gate-waiting`);
  await sleep(2200);
  // ---------- 3. phone zeroed -> both ready ----------
  await phone.zero();
  phone.setAim(0, 0);
  await sleep(500);
  const readyText = await bodyText();
  check('03', 'both slots ready (준비 완료) after phone zero', readyText.includes('준비 완료') && !readyText.includes(gateNotice), 'no 준비 중 notice', { hasReady: readyText.includes('준비 완료'), hasNotice: readyText.includes(gateNotice) });
  await checkpoint('03', 'lobby-both-ready');

  // ---------- 4. start ----------
  if (COMBO === 'mp') {
    await page.locator('[data-shootable="start"]').click();
  } else {
    await phone.snap(0, 0);
  }
  const started = await until((s) => s.phase === 'PLAYING', 30000, 'start');
  check('04a', 'game starts after both ready', started.ok, 'phase PLAYING', started.s?.phase);
  // keep phone aimed at centre during countdown
  phone.setAim(0, 0);
  const sel = await until((s) => s.selection.kind === 'weapon', 60000, 'weapon select');
  R.samples.weaponSelectMs = sel.ms;
  check('04b', 'weapon selection appears after countdown', sel.ok, 'selection.kind=weapon', sel.s?.selection);
  await sleep(300);
  let s = await S();
  const wcards = s.targets.filter((t) => t.selectKind === 'weapon');
  const byOwner = [0, 1].map((i) => wcards.filter((t) => t.ownerIndex === i).map((t) => ({ w: t.selectValue, ax: +t.aimX.toFixed(2), ay: +t.aimY.toFixed(2) })));
  R.samples.weaponCards = byOwner;
  check('04c', 'weapon selection shows 6 cards, 3 per player, 1P left (aimX<0) / 2P right (aimX>0)',
    wcards.length === 6 && byOwner[0].length === 3 && byOwner[1].length === 3 && byOwner[0].every((c) => c.ax < 0) && byOwner[1].every((c) => c.ax > 0),
    { total: 6, per: 3, side: 'p1<0,p2>0' }, { total: wcards.length, byOwner });
  await checkpoint('04', 'weapon-select');
  // device helpers by player index
  const shootAt = async (idx, t) => {
    if (idx === MOUSE_IDX) return mouseShoot(t.aimX, t.aimY, 60);
    return phone.snap(t.aimX, t.aimY);
  };
  // 4d: cross-shoot (shooter shoots other player's card) -> must not select
  const shooter = MOUSE_IDX;
  const otherCard = wcards.find((t) => t.ownerIndex !== shooter);
  const ownCard = wcards.find((t) => t.ownerIndex === shooter);
  s = await S();
  const doneBefore = [...s.selection.done];
  await shootAt(shooter, otherCard);
  await sleep(900);
  s = await S();
  check('04d', 'player shooting the other player\'s card does not select it', JSON.stringify(s.selection.done) === JSON.stringify(doneBefore) && s.selection.done[shooter] === false, { doneUnchanged: true, shooterDone: false }, { before: doneBefore, after: s.selection.done });
  // 4e: own card -> partial done
  await shootAt(shooter, ownCard);
  const partial = await until((st) => st.selection.done[shooter] === true, 5000, 'own pick');
  await sleep(400);
  const pText = await bodyText();
  check('04e', 'after one player picks: only that card is gone, banner says waiting for partner', partial.ok && pText.includes('선택 완료') && pText.includes('기다리는 중'), { done: [shooter === 0 ? true : false, shooter === 1 ? true : false] }, { done: partial.s?.selection.done, banner: { done: pText.includes('선택 완료'), wait: pText.includes('기다리는 중') } });
  await checkpoint('04e', 'partial-done');
  // 4f: no time limit: stay 12 s
  await sleep(12000);
  s = await S();
  check('04f', 'waiting selection has no time limit (still waiting after 12 s)', s.selection.kind === 'weapon' && s.selection.done[1 - shooter] === false, { kind: 'weapon', partnerDone: false }, { kind: s.selection.kind, done: s.selection.done });
  // partner picks
  const waitingOwn = wcards.find((t) => t.ownerIndex === 1 - shooter);
  await shootAt(1 - shooter, waitingOwn);
  const both = await until((st) => st.selection.kind === null, 8000, 'both picked');
  check('04g', 'both picked -> game starts (selection cleared, phase PLAYING)', both.ok && both.s.phase === 'PLAYING', { kind: null, phase: 'PLAYING' }, { kind: both.s?.selection.kind, phase: both.s?.phase });
  await sleep(1500);
  s = await S();
  R.samples.weaponKindsAfterPick = s.players.map((p) => p.weaponKind);

  // ---------- 5. combat HUD ----------
  await sleep(1500);
  const hud = await bodyText();
  const names = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="crosshair-nametag"]')).map((e) => e.innerText.trim()));
  R.samples.nametags = names;
  check('05a', 'team HUD text "BAR DEFENSE" and skill hints for both input kinds', hud.includes('BAR DEFENSE') && hud.includes('[우클릭]') && hud.includes('[위로 휙!]'), { bar: true, mouseHint: '[우클릭]', phoneHint: '[위로 휙!]' }, { bar: hud.includes('BAR DEFENSE'), mouse: hud.includes('[우클릭]'), phone: hud.includes('[위로 휙!]') });
  check('05b', 'crosshair nametags "1P · ..." and "2P · ..."', names.some((n) => n.startsWith('1P ·')) && names.some((n) => n.startsWith('2P ·')), ['1P · ..', '2P · ..'], names);
  check('05c', 'engine player index matches slot (weapon kind of player[0] equals 1P nametag)', (() => { const n1 = names.find((n) => n.startsWith('1P ·')) || ''; return n1.toUpperCase().includes(String(s.players[0].weaponKind).toUpperCase().replace('_', ' ')) || n1.toUpperCase().includes(String(s.players[0].weaponKind).toUpperCase()); })(), { p0Weapon: s.players[0].weaponKind }, { names, p0: s.players[0].weaponKind });
  await checkpoint('05', 'combat-hud');

  // 5-2 aim geometry: set aims and read nametag centres
  const aimSet = async (a1, a2) => {
    // a1 -> slot1 player, a2 -> slot2 player
    const mAim = MOUSE_SLOT === 1 ? a1 : a2;
    const pAim = PHONE_SLOT === 1 ? a1 : a2;
    await mouseAim(mAim[0], mAim[1]);
    phone.setAim(pAim[0], pAim[1]);
    await sleep(900);
    const tags = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="crosshair-nametag"]')).map((e) => { const r = e.getBoundingClientRect(); return { t: e.innerText.trim().slice(0, 2), cx: r.x + r.width / 2, cy: r.y + r.height / 2 }; }));
    return tags;
  };
  const geo = [];
  const aimCases = [
    ['6a-aim-corners', [-0.7, 0.4], [0.7, -0.3]],
    ['6b-aim-cross', [0.6, 0.0], [-0.6, 0.0]],
    ['6c-aim-centre', [0, 0], [0, 0]],
  ];
  for (const [name, a1, a2] of aimCases) {
    const tags = await aimSet(a1, a2);
    const v = await vp();
    const exp1 = [((a1[0] + 1) / 2) * v.width, ((1 - a1[1]) / 2) * v.height];
    const exp2 = [((a2[0] + 1) / 2) * v.width, ((1 - a2[1]) / 2) * v.height];
    const t1 = tags.find((t) => t.t === '1P');
    const t2 = tags.find((t) => t.t === '2P');
    geo.push({ case: name, p1Aim: a1, p2Aim: a2, expectedCentre1: exp1.map(Math.round), expectedCentre2: exp2.map(Math.round), nametag1: t1 && [Math.round(t1.cx), Math.round(t1.cy)], nametag2: t2 && [Math.round(t2.cx), Math.round(t2.cy)] });
    await shot(`${PFX}-${name}`);
  }
  R.samples.aimGeometry = geo;
  const offs = geo.flatMap((g) => [g.nametag1 && [g.nametag1[0] - g.expectedCentre1[0], g.nametag1[1] - g.expectedCentre1[1]], g.nametag2 && [g.nametag2[0] - g.expectedCentre2[0], g.nametag2[1] - g.expectedCentre2[1]]]).filter(Boolean);
  const maxAbsDx = Math.max(...offs.map((o) => Math.abs(o[0])));
  const spreadDy = Math.max(...offs.map((o) => o[1])) - Math.min(...offs.map((o) => o[1]));
  check('06', '5-2 nametag (crosshair) tracks each aim: consistent offset from aim centre across 3 aim cases (x-offset<=40px, y-offset spread<=20px)', maxAbsDx <= 40 && spreadDy <= 20, { maxAbsDx: '<=40', ySpread: '<=20' }, { maxAbsDx, ySpread: spreadDy, offsets: offs.map((o) => o.map(Math.round)) }, 'nametag is drawn above crosshair; the offset is taken as the baseline');

  // 5-4a: P01 mouse isolation: phone aim fixed, mouse moves => phone nametag must not move
  const tagPos = async (t) => page.evaluate((tt) => Array.from(document.querySelectorAll('[data-testid="crosshair-nametag"]')).filter((e) => e.innerText.trim().startsWith(tt)).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; })[0], t);
  phone.setAim(-0.5, 0.2);
  await mouseAim(0.2, 0.2);
  await sleep(700);
  const phoneTagA = await tagPos(`${PHONE_SLOT}P`);
  const mouseTagA = await tagPos(`${MOUSE_SLOT}P`);
  await mouseAim(0.7, -0.5);
  await sleep(700);
  const phoneTagB = await tagPos(`${PHONE_SLOT}P`);
  const mouseTagB = await tagPos(`${MOUSE_SLOT}P`);
  await shot(`${PFX}-10-mouse-isolation`);
  const phoneStill = phoneTagA && phoneTagB && Math.abs(phoneTagA[0] - phoneTagB[0]) <= 3 && Math.abs(phoneTagA[1] - phoneTagB[1]) <= 3;
  const mouseMoved = mouseTagA && mouseTagB && Math.abs(mouseTagA[0] - mouseTagB[0]) > 100;
  check('10a', '5-4 mouse movement moves only the mouse player crosshair; phone crosshair stays', !!(phoneStill && mouseMoved), { phoneStill: true, mouseMoved: true }, { phoneA: phoneTagA, phoneB: phoneTagB, mouseA: mouseTagA, mouseB: mouseTagB });

  // ---------- 5-1 & separation: input separation trials ----------
  const nearestMonster = (st) => st.targets.filter((t) => t.landed && !t.isItem && !t.isProjectile && !t.selectKind).sort((a, b) => a.radiusM - b.radiusM)[0];
  const sepTrials = [];
  for (const who of ['mouse', 'phone']) {
    let ok = false;
    for (let k = 0; k < 4 && !ok; k++) {
      const st0 = await S();
      const t = nearestMonster(st0);
      if (!t) { await sleep(500); continue; }
      const b = st0.players.map((p) => p.score);
      if (who === 'mouse') await mouseShoot(t.aimX, t.aimY, 60); else await phone.snap(t.aimX, t.aimY);
      await sleep(450);
      const st1 = await S();
      const d = st1.players.map((p, i) => p.score - b[i]);
      const shooterIdx = who === 'mouse' ? MOUSE_IDX : PHONE_IDX;
      const otherIdx = 1 - shooterIdx;
      ok = d[shooterIdx] > 0;
      sepTrials.push({ who, try: k, deltas: d, shooterIdx, otherIdx, target: t.id });
      if (ok) check(who === 'mouse' ? '12a' : '12b', `input separation: ${who} hit adds score only to ${who} player (no leak to partner)`, d[shooterIdx] > 0 && d[otherIdx] === 0, { shooterGain: '>0', partnerGain: 0 }, { deltas: d, shooterIdx });
    }
    if (!ok) check(who === 'mouse' ? '12a' : '12b', `input separation: ${who} hit`, false, 'shooter score > 0 within 4 tries', sepTrials.filter((x) => x.who === who));
  }
  R.samples.separationTrials = sepTrials;

  // 5-1 rapid fire: mouse hold 1 s and phone hold 1 s, sample ammo
  const holdTarget = nearestMonster(await S()) || (await S()).targets[0];
  const series = (arr) => arr.map((x) => x);
  {
    const st = await S();
    const a0 = st.players[MOUSE_IDX].ammo;
    const [x, y] = screenOf(holdTarget.aimX, holdTarget.aimY);
    await page.mouse.move(x, y, { steps: 3 });
    await page.mouse.down();
    const samples = [];
    for (let i = 0; i < 10; i++) { await sleep(100); samples.push((await S()).players[MOUSE_IDX].ammo); }
    await page.mouse.up();
    const drop = a0 - Math.min(...samples);
    R.samples.mouseHold = { weapon: st.players[MOUSE_IDX].weaponKind, before: a0, samples: series(samples), drop };
    check('51a', '5-1 mouse held 1 s: ammo drops by more than one shot (continuous fire)', drop >= 2, 'drop>=2', { weapon: st.players[MOUSE_IDX].weaponKind, before: a0, drop, samples });
  }
  {
    const st = await S();
    const a0 = st.players[PHONE_IDX].ammo;
    phone.setAim(holdTarget.aimX, holdTarget.aimY);
    phone.flags.rapidFireHold = true;
    const samples = [];
    for (let i = 0; i < 10; i++) { await sleep(100); samples.push((await S()).players[PHONE_IDX].ammo); }
    phone.flags.rapidFireHold = false;
    const drop = a0 - Math.min(...samples);
    R.samples.phoneHold = { weapon: st.players[PHONE_IDX].weaponKind, before: a0, samples: series(samples), drop };
    check('51b', '5-1 phone rapidFireHold 1 s: ammo drops by more than one shot', drop >= 2, 'drop>=2', { weapon: st.players[PHONE_IDX].weaponKind, before: a0, drop, samples });
  }
  await sleep(800);

  // ---------- 7. HUD button clicks do not leak into shooting ----------
  {
    const a0 = (await S()).players[MOUSE_IDX];
    await page.getByRole('button', { name: /가이드/ }).first().click();
    await sleep(500);
    const a1 = (await S()).players[MOUSE_IDX];
    await shot(`${PFX}-07-guide-click`);
    const modalText = await bodyText();
    check('07a', 'HUD 가이드 click does not fire the mouse player (ammo/score unchanged)', a1.ammo === a0.ammo && a1.score === a0.score, { ammoBefore: a0.ammo, scoreBefore: a0.score }, { ammoAfter: a1.ammo, scoreAfter: a1.score, guideOpen: modalText.includes('닫기') });
    const close = page.getByRole('button', { name: '닫기' }).first();
    if (await close.count()) await close.click();
    await sleep(400);
  }
  {
    const a0 = (await S()).players[MOUSE_IDX];
    await page.getByRole('button', { name: /일시정지/ }).first().click();
    await sleep(500);
    const st = await S();
    await shot(`${PFX}-07b-pause-by-hud`);
    const a1 = st.players[MOUSE_IDX];
    check('07b', 'HUD 일시정지 click pauses and does not fire', st.isPaused === true && a1.ammo === a0.ammo, { isPaused: true, ammo: a0.ammo }, { isPaused: st.isPaused, ammo: a1.ammo });
    await page.getByRole('button', { name: /이어하기|계속하기/ }).first().click();
    // sample for 4 s: a resume countdown would keep isPaused true briefly before it clears
    const resumeSeq = [];
    for (let k = 0; k < 16; k++) {
      await sleep(250);
      const q = await S();
      resumeSeq.push({ t: (k + 1) * 250, isPaused: q.isPaused, phase: q.phase });
      if (!q.isPaused) break;
    }
    const resumedAt = resumeSeq.find((x) => x.isPaused === false);
    R.samples.resumeSequence = resumeSeq;
    await shot(`${PFX}-07c-after-resume`);
    check('07c', 'pause 이어하기 resumes (within 4 s)', !!resumedAt, { isPaused: false, withinMs: 4000 }, { resumedAt: resumedAt?.t ?? null, last: resumeSeq[resumeSeq.length - 1] });
  }

  // Esc pause -> 다시시작 (무기 선택부터): same two players, weapon selection again
  await page.keyboard.press('Escape');
  await sleep(500);
  const escS = await S();
  await shot(`${PFX}-08-esc-pause`);
  const pauseText = await bodyText();
  check('08a', 'Esc opens pause menu (isPaused, 이어하기/다시시작/로비로 나가기)', escS.isPaused === true && (pauseText.includes('이어하기') || pauseText.includes('계속하기')) && pauseText.includes('다시시작') && pauseText.includes('로비로 나가기'), { isPaused: true }, { isPaused: escS.isPaused, texts: [pauseText.includes('이어하기'), pauseText.includes('다시시작'), pauseText.includes('로비로 나가기')] });
  const kindsBefore = escS.players.map((p) => p.weaponKind);
  await page.getByRole('button', { name: /다시시작/ }).first().click();
  const reSel = await until((st) => st.selection.kind === 'weapon', 20000, 'restart->weapon select');
  check('08b', '다시시작(무기 선택부터) returns to weapon selection with same 2 players', reSel.ok && (await bodyText()).includes('선택'), 'selection weapon', { ok: reSel.ok, kinds: reSel.s?.players.map((p) => p.weaponKind), before: kindsBefore });
  await sleep(600);
  // re-pick: each own card
  const reCards = (await S()).targets.filter((t) => t.selectKind === 'weapon');
  for (const idx of [MOUSE_IDX, PHONE_IDX]) {
    const c = reCards.find((t) => t.ownerIndex === idx);
    if (c) await shootAt(idx, c);
    await sleep(500);
  }
  const reDone = await until((st) => st.selection.kind === null && st.phase === 'PLAYING', 15000, 're-pick');
  check('08c', 'after 다시시작 both re-pick -> game resumes (PLAYING)', reDone.ok, 'PLAYING', reDone.s?.phase);
  await sleep(600);

  // ---------- 9. play game 1 with bot (mouse + phone firing, fever + skill tests) ----------
  const feverDone = [false, false];
  const skillDone = [false, false];
  const feverLog = [];
  const skillLog = [];
  const autoPick = async (st) => {
    for (let i = 0; i < 2; i++) {
      if (st.selection.done[i]) continue;
      const c = st.targets.find((t) => t.selectKind === st.selection.kind && t.ownerIndex === i);
      if (c) await shootAt(i, c);
    }
  };
  const botTick = async (st, { fire = true } = {}) => {
    if (st.selection.kind) { await autoPick(st); await sleep(200); return; }
    if (st.isPaused || st.phase !== 'PLAYING') { await sleep(200); return; }
    for (let i = 0; i < 2; i++) {
      const p = st.players[i];
      if (p.isFeverReady && !feverDone[i]) {
        feverDone[i] = true;
        const t = nearestMonster(st);
        const b = st.players.map((q) => q.score);
        const aBefore = p.ammo;
        if (t) { if (i === MOUSE_IDX) await mouseAim(t.aimX, t.aimY); else phone.setAim(t.aimX, t.aimY); }
        if (i === MOUSE_IDX) {
          await page.mouse.down(); await sleep(60); await page.mouse.up(); await sleep(80); await page.mouse.down(); await sleep(60); await page.mouse.up();
        } else {
          phone.pulseFlag({ feverTriggered: true });
        }
        const seen = []; let active = false;
        for (let k = 0; k < 10; k++) { await sleep(200); const q = await S(); seen.push({ act: q.players[i].isFeverActive, ammo: q.players[i].ammo, score: q.players[i].score }); if (q.players[i].isFeverActive) active = true; }
        const last = await S();
        const rec = { player: i + 1, device: i === MOUSE_IDX ? 'mouse' : 'phone', ammoBefore: aBefore, scoreDelta: last.players[i].score - b[i], partnerScoreDelta: last.players[1 - i].score - b[1 - i], feverActiveSeen: active, ammoDuring: seen.map((x) => x.ammo) };
        feverLog.push(rec);
        check(i === MOUSE_IDX ? '09a' : '09b', `5-1 fever (${rec.device}, P${i + 1}): active for 2 s, score rises, shots happen, partner unaffected`, active && rec.scoreDelta > 0 && rec.partnerScoreDelta === 0 && Math.min(...rec.ammoDuring) < aBefore, { active: true, scoreUp: true, shotsDuringFever: true, partnerUnchanged: true }, rec);
      }
      if (p.skillStock > 0 && !skillDone[i]) {
        skillDone[i] = true;
        const sb = p.skillStock;
        if (i === MOUSE_IDX) {
          const [x, y] = screenOf(0, 0);
          await page.mouse.click(x, y, { button: 'right' });
        } else {
          phone.pulseFlag({ skillSnapTriggered: true });
        }
        await sleep(500);
        const q = await S();
        skillLog.push({ player: i + 1, stockBefore: sb, stockAfter: q.players[i].skillStock });
        check(i === MOUSE_IDX ? '09c' : '09d', `skill (${i === MOUSE_IDX ? 'right click' : 'phone 휙'}) consumes stock for P${i + 1}`, q.players[i].skillStock < sb, { stockDown: true }, { before: sb, after: q.players[i].skillStock });
      }
      if (!fire) continue;
      const t = nearestMonster(st);
      if (t) await shootAt(i, t);
    }
    await sleep(150);
  };
  const playUntilEnd = async (label, timeout, fire = true) => {
    const t0 = Date.now();
    let lastPhase = null; let stallSince = Date.now(); let lastScore = -1;
    while (Date.now() - t0 < timeout) {
      const st = await S();
      if (st.phase === 'GAMEOVER' || st.phase === 'VICTORY') return { ok: true, s: st, ms: Date.now() - t0 };
      const totalScore = st.players.reduce((a, p) => a + p.score, 0);
      if (totalScore !== lastScore || st.wave !== lastPhase) { lastScore = totalScore; lastPhase = st.wave; stallSince = Date.now(); }
      if (Date.now() - stallSince > 30000 && !st.isPaused && !st.selection.kind) { R.notes.push(`${label}: no score/wave progress for 30 s at wave ${st.wave}`); stallSince = Date.now(); }
      const f = typeof fire === 'function' ? fire() : fire;
      await botTick(st, { fire: f });
    }
    return { ok: false, s: await S(), ms: Date.now() - t0 };
  };
  // game 1: bot fires for the first 4 min (fever/skill checks happen then), then stops firing so the wave-timer/lives end the game
  const g1Start = Date.now();
  const g1 = await playUntilEnd('game1', 480000, () => Date.now() - g1Start < 240000);
  R.samples.game1 = { ms: g1.ms, phase: g1.s?.phase, wave: g1.s?.wave, lives: g1.s?.lives, scores: g1.s?.players.map((p) => p.score), weapons: g1.s?.players.map((p) => p.weaponKind) };
  check('09e', 'game 1 reaches GAMEOVER/VICTORY within 7 min (no stall)', g1.ok, 'GAMEOVER|VICTORY', { phase: g1.s?.phase, ms: g1.ms, wave: g1.s?.wave });
  await sleep(2500);
  R.samples.recordsAfterGame1 = countRecords();
  const resText = await bodyText();
  const resChecks = {
    partnerNote: resText.includes('2인팟 점수는 솔로 랭킹에 오르지 않습니다'),
    teamBest: resText.includes('이 팀 최고'),
    teamTabName: resText.includes('팀 랭킹'),
  };
  R.samples.resultText1 = resText.slice(0, 1500);
  await checkpoint('11', 'result-game1');
  check('11a', 'result: 2인팟 note "2인팟 점수는 솔로 랭킹에 오르지 않습니다" shown', resChecks.partnerNote, 'present', resChecks);
  check('11b', 'result: 이 팀 최고 label present', resChecks.teamBest, 'present', resChecks.teamBest);

  // mouse restart (game 1 -> new game)
  await page.locator('[data-shootable="restart"]').click();
  const rs = await until((st) => st.selection.kind === 'weapon' || (st.phase === 'PLAYING' && st.lives > 0), 25000, 'mouse restart');
  check('11c', 'mouse click on 다시 시작 starts a new game with the same 2 players', rs.ok, 'weapon select or playing', { phase: rs.s?.phase, sel: rs.s?.selection.kind, lives: rs.s?.lives });
  await shot(`${PFX}-11c-restart-mouse`);
  await until((st) => st.selection.kind === 'weapon', 20000, 'g2 select');
  await autoPick(await S());
  await until((st) => st.selection.kind === null && st.phase === 'PLAYING', 20000, 'g2 playing');

  // ---------- game 2: passive (no firing) so it ends quickly; phone presses 다시 시작 ----------
  const g2 = await playUntilEnd('game2', 300000, false);
  R.samples.game2 = { ms: g2.ms, phase: g2.s?.phase, wave: g2.s?.wave };
  check('11d', 'game 2 (passive) reaches GAMEOVER', g2.ok, 'GAMEOVER', { phase: g2.s?.phase, ms: g2.ms });
  await sleep(2500);
  // phone presses restart button at its centre
  const rbox = await page.evaluate(() => { const e = document.querySelector('[data-shootable="restart"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, W: innerWidth, H: innerHeight }; });
  const pAimX = (rbox.cx / rbox.W) * 2 - 1;
  const pAimY = 1 - (rbox.cy / rbox.H) * 2;
  await phone.snap(pAimX, pAimY);
  const rs2 = await until((st) => st.selection.kind === 'weapon' || (st.phase === 'PLAYING' && st.lives > 0), 15000, 'phone restart');
  check('11e', 'phone shot on 다시 시작 button restarts the game', rs2.ok, 'weapon select or playing', { phase: rs2.s?.phase, sel: rs2.s?.selection.kind, aim: [+pAimX.toFixed(2), +pAimY.toFixed(2)] });
  await shot(`${PFX}-11e-restart-phone`);
  check('11f', 'simultaneous mouse+phone press counts once', null, 'one restart', 'not observable: no per-press log in UI/records; not tested', 'SKIP');
  // go to lobby from pause (mouse)
  await until((st) => st.selection.kind === 'weapon', 20000, 'g3 select');
  await autoPick(await S());
  await until((st) => st.selection.kind === null && st.phase === 'PLAYING', 20000, 'g3 playing');
  await page.keyboard.press('Escape');
  await sleep(500);
  await page.getByRole('button', { name: /로비로 나가기/ }).first().click();
  await sleep(500);
  // 로비로 나가기 opens an exit-confirm dialog ("🏠 로비로 나갈까요?"); confirm with the red 나가기 button
  await page.getByRole('button', { name: /^나가기$/ }).first().click();
  await sleep(1500);
  const lobbyT = await bodyText();
  const mouseSlotText = await slotCard(MOUSE_SLOT).innerText();
  const phoneSlotText = await slotCard(PHONE_SLOT).innerText();
  await checkpoint('12', 'lobby-after-return');
  check('12a', 'lobby after returning: mouse slot emptied, phone slot kept (readiness)', mouseSlotText.includes('비어') && phoneSlotText.includes('모바일P'), { mouse: '비어 있음', phone: '모바일P kept' }, { mouse: mouseSlotText.slice(0, 60), phone: phoneSlotText.slice(0, 60) });

  // ---------- 13. play-record file ----------
  const recLines = fs.existsSync(RECORDS) ? fs.readFileSync(RECORDS, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  const newRecs = recLines.slice(recStart);
  const coopNew = newRecs.filter((r) => r.mode === 'coop');
  R.samples.newRecords = newRecs.map((r) => ({ nickname: r.nickname, mode: r.mode, slot: r.coop?.slot, teamScore: r.coop?.teamScore, outcome: r.outcome, weapon: r.weaponKind }));
  check('13a', 'play-records.jsonl: new "mode":"coop" lines written for the finished game (2 per finished game, one per player)', coopNew.length >= 2 && coopNew.every((r) => r.mode === 'coop' && r.coop && r.coop.partnerDeviceId), '>=2 coop lines with coop meta', { newLines: newRecs.length, coop: coopNew.length });
  const pl = JSON.parse(fs.readFileSync(PLAYERS, 'utf8'));
  R.samples.playersRecord = Object.values(pl.players).filter((p) => p.lastPlayedAt).length;

  // ---------- finish ----------
  phone.close();
  intruder.close();
  await browser.close();
  R.finishedAt = new Date().toISOString();
  const outFile = path.join(BASE, `values-${COMBO}.json`);
  fs.writeFileSync(outFile, JSON.stringify(R, null, 2));
  const bugs = R.checks.filter((c) => c.verdict === 'BUG').length;
  log(`DONE. checks=${R.checks.length} bugs=${bugs} errors=${R.errors.length} -> ${outFile}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
