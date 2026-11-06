/* ブルーマーチ - 軍隊育成・進軍ゲーム
 * Canvas 2D による擬似3D（透視投影）。外部ライブラリ・ビルド不要。
 */
(() => {
'use strict';

// ======================================================================
// ユーティリティ
// ======================================================================
const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const $ = (id) => document.getElementById(id);

// ======================================================================
// 定数
// ======================================================================
const ROAD_HALF = 6;          // 道の半幅
const WALL_W = 0.9;           // 城壁の厚み
const WALL_H = 0.9;           // 城壁の高さ
const CAM_H = 12;             // カメラ高さ
const PITCH = 38 * Math.PI / 180;
const SIN = Math.sin(PITCH), COS = Math.cos(PITCH);
const CAM_BACK = 8.5;         // 軍隊の何ユニット後ろにカメラがあるか
const VIEW_DIST = 80;
const ROW_LEN = 1.6;          // 石畳1列の長さ

const SPEED = 11;             // 進軍速度
const RANGE = 16;             // 射程（これより近づくと立ち止まって攻撃）
const CONTACT = 5;            // 敵が接近して止まる距離
const AGGRO = 24;             // 敵が動き出す距離
const CHARGE = 7;             // 敵の突撃速度
const DPS_A = 0.35;           // 味方1人あたり毎秒ダメージ
const DPS_E = 0.2;            // 敵1体あたり毎秒ダメージ

const MAXV = 150;             // 味方の最大表示数
const ESPX = 0.82, ESPZ = 0.62; // 敵の隊列間隔
const ECOLS = 13;

const FONT_NUM = '"Arial Black","Hiragino Sans",Impact,system-ui,sans-serif';

const SAVE_KEY = 'blueMarch.save.v1';

// ======================================================================
// セーブデータ
// ======================================================================
const save = { coins: 0, stage: 1, bonus: 0 };
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      save.coins = Math.max(0, s.coins | 0);
      save.stage = Math.max(1, s.stage | 0);
      save.bonus = clamp(s.bonus | 0, 0, 60);
    }
  } catch (e) { /* ignore */ }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}
const upgradeCost = () => 40 + save.bonus * 30;

// ======================================================================
// DOM
// ======================================================================
const stageEl = $('stage');
const canvas = $('c');
const ctx = canvas.getContext('2d');
const el = {
  armyNum: $('armyNum'), coinNum: $('coinNum'), stageNum: $('stageNum'),
  hudArmy: $('hudArmy'), hint: $('hint'),
  title: $('title'), clear: $('clear'), over: $('over'),
  stName: $('stName'), stPrev: $('stPrev'), stNext: $('stNext'),
  btnStart: $('btnStart'), btnUpgrade: $('btnUpgrade'), upInfo: $('upInfo'), upCost: $('upCost'),
  clArmy: $('clArmy'), clReward: $('clReward'), ovStage: $('ovStage'),
  btnNext: $('btnNext'), btnReplay: $('btnReplay'), btnClearTitle: $('btnClearTitle'),
  btnRetry: $('btnRetry'), btnOverTitle: $('btnOverTitle'),
};

// ======================================================================
// 画面サイズ・投影
// ======================================================================
let W = 390, H = 844, dpr = 1;
let F = 430, cx = 195, cy = 400;
let pxPerUnit = 20;
const cam = { x: 0, z: 0 };
let PX = 0, PY = 0, PS = 0;

function resize() {
  const r = stageEl.getBoundingClientRect();
  W = Math.max(1, Math.floor(r.width));
  H = Math.max(1, Math.floor(r.height));
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  F = W * 1.12;
  cx = W / 2;
  const depth = CAM_H * SIN + CAM_BACK * COS;
  const up = -CAM_H * COS + CAM_BACK * SIN;
  cy = H * 0.74 + up * F / depth;
  pxPerUnit = (F / depth) * 0.65;
}

// ワールド座標 → 画面座標（結果は PX, PY, PS に入る）
function proj(x, y, z) {
  const dx = x - cam.x, dy = y - CAM_H, dz = z - cam.z;
  const depth = -dy * SIN + dz * COS;
  if (depth < 0.4) return false;
  const up = dy * COS + dz * SIN;
  const s = F / depth;
  PX = cx + dx * s;
  PY = cy - up * s;
  PS = s;
  return true;
}

// ======================================================================
// スプライト生成（味方・敵）
// ======================================================================
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function makeSprite(kind) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 80;
  const g = c.getContext('2d');
  const blue = kind === 'blue';
  const P = blue
    ? { main: '#2f7df0', dark: '#1b4fb8', light: '#9bd0ff', trim: '#ffd36a' }
    : { main: '#e8423b', dark: '#a2231f', light: '#ff9b90', trim: '#3a2a2a' };
  const line = 'rgba(10,20,50,0.6)';
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // 影
  g.fillStyle = 'rgba(30,40,60,0.28)';
  g.beginPath(); g.ellipse(32, 74, 19, 5.5, 0, 0, Math.PI * 2); g.fill();
  // ブーツ
  g.fillStyle = '#5b3a24';
  rrect(g, 19, 64, 11, 9, 3); g.fill();
  rrect(g, 34, 64, 11, 9, 3); g.fill();
  // 胴体（マント）
  g.fillStyle = P.main; g.strokeStyle = line; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(21, 33); g.lineTo(43, 33); g.lineTo(50, 68); g.lineTo(14, 68); g.closePath();
  g.fill(); g.stroke();
  g.globalAlpha = 0.55; g.fillStyle = P.dark;
  g.beginPath(); g.moveTo(33, 33); g.lineTo(43, 33); g.lineTo(50, 68); g.lineTo(33, 68); g.closePath(); g.fill();
  g.globalAlpha = 1;
  // ベルト
  g.fillStyle = P.trim; g.fillRect(19, 52, 26, 4);
  // 腕
  g.fillStyle = P.main; g.strokeStyle = line; g.lineWidth = 2;
  g.beginPath(); g.arc(17, 45, 6.5, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(47, 45, 6.5, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#f1c9a0';
  g.beginPath(); g.arc(14, 55, 3.6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(50, 55, 3.6, 0, Math.PI * 2); g.fill();
  if (blue) {
    // 盾
    g.fillStyle = '#eef6ff'; g.strokeStyle = line; g.lineWidth = 2.2;
    g.beginPath(); g.arc(11, 54, 10, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = P.main;
    g.beginPath(); g.arc(11, 54, 4.5, 0, Math.PI * 2); g.fill();
  } else {
    // 剣
    g.fillStyle = '#cfd5de'; g.strokeStyle = line; g.lineWidth = 1.6;
    g.fillRect(52, 30, 5, 26); g.strokeRect(52, 30, 5, 26);
    g.fillStyle = '#6b4423'; g.fillRect(49, 55, 11, 4);
  }
  // 頭
  g.fillStyle = '#f1c9a0'; g.strokeStyle = line; g.lineWidth = 2.2;
  g.beginPath(); g.arc(32, 26, 11, 0, Math.PI * 2); g.fill(); g.stroke();
  if (blue) {
    // 兜（丸）
    g.fillStyle = P.main; g.strokeStyle = line; g.lineWidth = 2.4;
    g.beginPath(); g.arc(32, 23, 13.5, Math.PI, Math.PI * 2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = P.dark; g.fillRect(18.5, 22, 27, 4);
    g.fillStyle = P.light; g.globalAlpha = 0.8;
    g.beginPath(); g.ellipse(26, 15.5, 4.5, 2.6, -0.5, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = P.trim;
    g.beginPath(); g.moveTo(29, 10); g.lineTo(32, 3); g.lineTo(35, 10); g.closePath(); g.fill();
  } else {
    // とんがりフード
    g.fillStyle = P.main; g.strokeStyle = line; g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(18.5, 27); g.lineTo(32, 0.5); g.lineTo(45.5, 27);
    g.lineTo(40, 21); g.quadraticCurveTo(32, 17, 24, 21);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = P.light; g.globalAlpha = 0.6;
    g.beginPath(); g.moveTo(27, 18); g.lineTo(31, 7); g.lineTo(32, 18); g.closePath(); g.fill();
    g.globalAlpha = 1;
  }
  // 目
  g.fillStyle = '#222';
  g.beginPath(); g.arc(28, 28, 1.7, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(36, 28, 1.7, 0, Math.PI * 2); g.fill();
  if (!blue) {
    g.strokeStyle = '#222'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(25, 24.5); g.lineTo(30, 26); g.moveTo(39, 24.5); g.lineTo(34, 26); g.stroke();
  }
  return c;
}

let SPR_BLUE = null, SPR_RED = null;

// ======================================================================
// ボス（プログラム描画・オリジナルデザイン：角兜の赤い鬼将軍）
// ======================================================================
function drawBoss(px, py, h, t, hurt) {
  const u = h / 140;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(u, u);
  const bob = Math.sin(t * 3.2) * 2;
  const line = 'rgba(30,10,10,0.7)';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = line;

  // 影
  ctx.fillStyle = 'rgba(30,20,30,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 0, 52, 11, 0, 0, Math.PI * 2); ctx.fill();
  // 脚
  ctx.fillStyle = '#4a2f1c';
  rrect(ctx, -32, -36, 25, 36, 7); ctx.fill(); ctx.stroke();
  rrect(ctx, 7, -36, 25, 36, 7); ctx.fill(); ctx.stroke();
  ctx.translate(0, bob * 0.5);
  // 左腕
  ctx.fillStyle = '#e0a67a';
  rrect(ctx, -66, -94, 22, 52, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-55, -40, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 胴体
  ctx.fillStyle = '#c93a2a';
  rrect(ctx, -42, -98, 84, 68, 20); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  rrect(ctx, 0, -98, 42, 68, 20); ctx.fill();
  ctx.fillStyle = '#34262a'; ctx.fillRect(-42, -54, 84, 10);
  ctx.fillStyle = '#e0b84a'; rrect(ctx, -9, -57, 18, 16, 3); ctx.fill(); ctx.stroke();
  // 右腕とこん棒
  ctx.fillStyle = '#e0a67a';
  rrect(ctx, 44, -96, 22, 46, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(56, -50, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6b4423';
  ctx.beginPath();
  ctx.moveTo(50, -54); ctx.lineTo(63, -54); ctx.lineTo(80, -126); ctx.lineTo(60, -132); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a4e2a';
  ctx.beginPath(); ctx.arc(70, -134, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c8ced8';
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.7;
    const bx = 70 + Math.cos(a) * 17, by = -134 + Math.sin(a) * 17;
    ctx.beginPath();
    ctx.moveTo(bx - 4, by + 3); ctx.lineTo(70 + Math.cos(a) * 28, -134 + Math.sin(a) * 28); ctx.lineTo(bx + 4, by - 3);
    ctx.closePath(); ctx.fill();
  }
  // 肩当て
  ctx.fillStyle = '#6b7280';
  ctx.beginPath(); ctx.arc(-44, -90, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(44, -90, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 頭
  ctx.fillStyle = '#e0a67a';
  ctx.beginPath(); ctx.arc(0, -114, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 角つき兜
  ctx.fillStyle = '#59606c';
  ctx.beginPath(); ctx.arc(0, -116, 23, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3d424c'; ctx.fillRect(-23, -118, 46, 7);
  ctx.fillStyle = '#f2e6c8';
  ctx.beginPath(); ctx.moveTo(-18, -128); ctx.lineTo(-34, -152); ctx.lineTo(-8, -136); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(18, -128); ctx.lineTo(34, -152); ctx.lineTo(8, -136); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 顔
  ctx.fillStyle = '#ff3b2b';
  ctx.beginPath(); ctx.ellipse(-8, -109, 3.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8, -109, 3.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a1410'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-15, -117); ctx.lineTo(-4, -112); ctx.moveTo(15, -117); ctx.lineTo(4, -112); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-7, -97); ctx.lineTo(7, -97); ctx.stroke();
  if (hurt > 0) {
    ctx.globalAlpha = Math.min(0.5, hurt);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -70, 70, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ======================================================================
// ステージ生成
// ======================================================================
const NICE = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1500, 2000];
function nice(v) {
  const lv = Math.log(Math.max(1, v));
  let best = NICE[0], bd = 1e9;
  for (let i = 0; i < NICE.length; i++) {
    const d = Math.abs(Math.log(NICE[i]) - lv);
    if (d < bd) { bd = d; best = NICE[i]; }
  }
  return best;
}
const allyVis = (n) => (n <= 40 ? n : Math.min(MAXV, Math.round(40 + (n - 40) * 0.35)));
const enemyVis = (n) => (n <= 60 ? n : Math.min(320, Math.round(60 + (n - 60) * 0.35)));

function makeGroup(z, S, bossHP, rnd) {
  const vn = enemyVis(S);
  return {
    z, x: 0, S, S0: S, vn,
    boss: bossHP > 0 ? { hp: bossHP, max: bossHP, hurt: 0 } : null,
    active: false, dead: false,
    cols: ECOLS,
    seed: Math.floor(rnd() * 1000),
    depth0: (Math.ceil(vn / ECOLS) - 1) * ESPZ,
  };
}

function genStage(stage) {
  const rnd = mulberry32(stage * 7919 + 13);
  const rows = Math.min(4 + stage, 12);
  const mids = Math.min(Math.floor((stage + 1) / 3), 3);
  const hasBoss = stage % 3 === 0;
  const midAfter = new Set();
  for (let k = 1; k <= mids; k++) midAfter.add(Math.min(rows - 1, Math.floor(k * rows / (mids + 1))));

  let A = 10; // 設計上の最良ルートでの兵数
  const gates = [], groups = [];
  let z = 24;
  let lastGateZ = z;
  for (let i = 1; i <= rows; i++) {
    const useMul = stage >= 3 && rnd() < 0.28;
    const goodFrac = 0.4 + rnd() * 0.25;
    const badFrac = 0.06 + rnd() * 0.12;
    let good, bad = { t: 'add', v: Math.max(1, nice(A * badFrac)) };
    if (useMul) good = { t: 'mul', v: 2 };
    else {
      good = { t: 'add', v: nice(A * goodFrac) };
      if (good.v <= bad.v) bad.v = Math.max(1, good.v - 1);
    }
    const goodLeft = rnd() < 0.5;
    gates.push({ z, opts: goodLeft ? [good, bad] : [bad, good], used: false, side: -1, flash: 0 });
    lastGateZ = z;
    A = good.t === 'add' ? A + good.v : A * good.v;
    z += 16;
    if (midAfter.has(i)) {
      const gz = lastGateZ + 32;
      const r = Math.min(0.28 + 0.03 * stage, 0.6);
      const E = Math.max(4, Math.round(A * r));
      const g = makeGroup(gz, E, 0, rnd);
      groups.push(g);
      A = Math.sqrt(Math.max(1, A * A - 0.571 * E * E));
      z = gz + g.depth0 + 10;
    }
  }
  const fz = lastGateZ + 32;
  const rf = Math.min(0.55 + 0.04 * stage, 0.85);
  const E = Math.max(6, Math.round(A * rf));
  let fg;
  if (hasBoss) {
    const S = Math.round(E * 0.7);
    fg = makeGroup(fz, S, E - S, rnd);
  } else {
    fg = makeGroup(fz, E, 0, rnd);
  }
  groups.push(fg);
  return { gates, groups, endZ: fz + fg.depth0 + 14, hasBoss };
}

// ======================================================================
// 状態
// ======================================================================
const FX = new Float32Array(MAXV), FZ = new Float32Array(MAXV);
for (let i = 0; i < MAXV; i++) {
  const r = Math.sqrt(i + 0.5), th = i * 2.39996323;
  FX[i] = r * Math.cos(th);
  FZ[i] = r * Math.sin(th) * 0.85;
}
const spFor = (n) => clamp(3.0 / Math.sqrt(Math.max(n, 1)), 0.26, 0.62);

let world = null;
let state = 'title';   // title / ready / playing / dying / clear / over
let selStage = 1;
const keys = { left: false, right: false };

function startStage(stage, nextState) {
  const S = genStage(stage);
  const A0 = 10 + save.bonus;
  const a = {
    x: 0, tx: 0, z: 0, A: A0, vn: 0, sp: spFor(allyVis(A0)),
    appear: new Float32Array(MAXV).fill(1), order: [], orderN: -1, lim: 3,
  };
  world = {
    stage, gates: S.gates, groups: S.groups, endZ: S.endZ, hasBoss: S.hasBoss,
    army: a, parts: [], arrows: [], arrowAcc: 0,
    t: 0, readyT: 0.6, finishT: 0, dyingT: 0, glow: 0, fightT: 0,
    reward: 0, started: false,
  };
  syncArmy(a, 0);
  for (const g of world.groups) g.vn = enemyVis(Math.ceil(g.S));
  state = nextState;
  el.hint.classList.toggle('show', nextState === 'ready');
  hudStage = -1; hudArmy = -1;
}

// ======================================================================
// パーティクル
// ======================================================================
function addText(x, y, z, str, color, size) {
  world.parts.push({ k: 't', x, y, z, t: 0, life: 1.0, str, color, size });
}
function addSpark(x, y, z, color) {
  if (world.parts.length > 260) return;
  world.parts.push({ k: 's', x, y, z, t: 0, life: 0.32, color });
}
function addPuff(x, z, color, n) {
  for (let i = 0; i < n; i++) {
    if (world.parts.length > 260) return;
    world.parts.push({
      k: 'p', x: x + (Math.random() - 0.5) * 0.6, y: 0.5 + Math.random() * 0.5, z: z + (Math.random() - 0.5) * 0.6,
      vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3,
      t: 0, life: 0.45 + Math.random() * 0.3, color,
    });
  }
}

// ======================================================================
// 更新
// ======================================================================
function syncArmy(a, dt) {
  const n = a.A > 0.0001 ? allyVis(Math.ceil(a.A - 1e-6)) : 0;
  if (n > a.vn) {
    for (let i = a.vn; i < n; i++) a.appear[i] = 0;
  } else if (n < a.vn && world) {
    const cnt = Math.min(3, a.vn - n);
    for (let k = 0; k < cnt; k++) {
      const i = n + Math.floor(Math.random() * (a.vn - n));
      addPuff(a.x + FX[i] * a.sp, a.z + FZ[i] * a.sp, '#9bd0ff', 2);
    }
  }
  if (n !== a.orderN) {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(i);
    arr.sort((p, q) => FZ[q] - FZ[p]);
    a.order = arr;
    a.orderN = n;
  }
  a.vn = n;
  a.sp += (spFor(n) - a.sp) * Math.min(1, dt * 8);
  for (let i = 0; i < n; i++) if (a.appear[i] < 1) a.appear[i] = Math.min(1, a.appear[i] + dt * 4.5);
}

let EX = 0, EZ = 0;
function ePos(g, i, n) {
  const cols = g.cols;
  const r = Math.floor(i / cols), c = i % cols;
  const rowN = Math.min(cols, n - r * cols);
  EX = g.x + (c - (rowN - 1) / 2) * ESPX + ((r & 1) ? 0.2 : -0.2) + (hash(i * 3 + g.seed) - 0.5) * 0.3;
  EZ = g.z + r * ESPZ + (hash(i * 7 + g.seed) - 0.5) * 0.2;
}

function syncGroup(g) {
  const n = g.dead ? 0 : enemyVis(Math.ceil(g.S - 1e-6));
  if (n < g.vn) {
    const cnt = Math.min(4, g.vn - n);
    for (let k = 0; k < cnt; k++) {
      const i = n + Math.floor(Math.random() * (g.vn - n));
      ePos(g, i, g.vn);
      addPuff(EX, EZ, k & 1 ? '#ff8a7a' : '#ffd0c8', 2);
    }
  }
  g.vn = n;
}

function winStage() {
  const w = world, a = w.army;
  state = 'clear';
  const left = Math.max(1, Math.ceil(a.A - 1e-6));
  const reward = 30 + w.stage * 15 + Math.floor(left * 0.5);
  w.reward = reward;
  save.coins += reward;
  save.stage = Math.max(save.stage, w.stage + 1);
  writeSave();
  el.clArmy.textContent = String(left);
  el.clReward.textContent = '+' + reward;
  showOverlay('clear');
  el.hint.classList.remove('show');
}

function loseStage() {
  state = 'over';
  el.ovStage.textContent = 'ステージ ' + world.stage;
  showOverlay('over');
}

function update(dt) {
  const w = world, a = w.army;
  w.t += dt;

  // 入力（キーボード）
  if (state === 'ready' || state === 'playing') {
    const kv = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (kv) a.tx += kv * 9 * dt;
  }
  // 兵数に応じた可動範囲
  const rx = Math.min(Math.sqrt(Math.max(a.vn, 1)) * a.sp, 3.0) + 0.3;
  a.lim = Math.max(0.8, ROAD_HALF - 0.4 - rx);
  a.tx = clamp(a.tx, -a.lim, a.lim);
  a.x += (a.tx - a.x) * Math.min(1, dt * 14);
  a.x = clamp(a.x, -a.lim, a.lim);

  if (state === 'ready') {
    w.readyT -= dt;
    if (w.readyT <= 0) state = 'playing';
  }

  w.glow = Math.max(0, w.glow - dt * 2.5);
  for (const gt of w.gates) if (gt.flash > 0) gt.flash = Math.max(0, gt.flash - dt * 2);

  if (state === 'playing') {
    // 現在の敵軍
    let g = null;
    for (let i = 0; i < w.groups.length; i++) if (!w.groups[i].dead) { g = w.groups[i]; break; }
    let fighting = false;
    if (g) {
      const gap0 = g.z - a.z;
      if (gap0 <= AGGRO) g.active = true;
      if (g.active && gap0 > CONTACT) g.z = Math.max(a.z + CONTACT, g.z - CHARGE * dt);
      if (g.active && g.z - a.z <= RANGE) fighting = true;
    }
    const allDead = !g;
    const atGoal = allDead && a.z >= w.endZ - 1;

    // 進軍
    if (!fighting && !atGoal) {
      a.z += SPEED * dt;
      if (a.z > 8) el.hint.classList.remove('show');
    }

    // ゲート通過
    for (let i = 0; i < w.gates.length; i++) {
      const gt = w.gates[i];
      if (gt.used || a.z < gt.z) continue;
      const side = a.x < 0 ? 0 : 1;
      const opt = gt.opts[side];
      const base = Math.ceil(a.A - 1e-6);
      const next = opt.t === 'add' ? base + opt.v : base * opt.v;
      gt.used = true; gt.side = side; gt.flash = 1;
      a.A = next;
      w.glow = 1;
      addText(a.x, 2.2, a.z, (opt.t === 'add' ? '+' : '×') + opt.v, '#ffe14a', 46);
      for (let k = 0; k < 6; k++) addSpark(a.x + (Math.random() - 0.5) * 4, 0.8 + Math.random() * 1.6, a.z + (Math.random() - 0.5) * 2, '#fff2a0');
      bumpHud();
    }

    // 戦闘
    if (fighting && g) {
      w.fightT += dt;
      let dmg = a.A * DPS_A * dt;
      if (g.S > 0) { const k = Math.min(g.S, dmg); g.S -= k; dmg -= k; }
      if (dmg > 0 && g.boss && g.boss.hp > 0) {
        g.boss.hp = Math.max(0, g.boss.hp - dmg);
        g.boss.hurt = 0.35;
      }
      const gap = g.z - a.z;
      if (gap <= CONTACT + 0.6) {
        const dE = (g.S * DPS_E + (g.boss && g.boss.hp > 0 ? g.boss.hp * DPS_E : 0)) * dt;
        a.A = Math.max(0, a.A - dE);
        if (Math.random() < dt * 40) {
          addPuff(a.x + (Math.random() - 0.5) * 5, (a.z + g.z) / 2, '#ffffff', 1);
        }
      }
      // 矢の発射
      w.arrowAcc += dt * 30 * Math.min(1, a.vn / 30 + 0.3);
      while (w.arrowAcc >= 1) {
        w.arrowAcc -= 1;
        if (w.arrows.length >= 90 || a.vn <= 0) continue;
        const i = Math.floor(Math.random() * a.vn);
        const sx = a.x + FX[i] * a.sp, sz = a.z + FZ[i] * a.sp;
        const tx = g.x + (Math.random() - 0.5) * g.cols * ESPX * 0.9;
        const tz = g.z + Math.random() * 3;
        const dist = Math.max(2, tz - sz);
        w.arrows.push({ sx, sz, tx, tz, t: 0, dur: 0.35 + dist * 0.02, h: 2.2 + dist * 0.12 });
      }
      // 撃破判定
      if (g.S <= 0.0001 && (!g.boss || g.boss.hp <= 0.0001)) {
        g.S = 0; g.dead = true;
        if (g.boss) g.boss.hp = 0;
        for (let k = 0; k < (g.boss ? 26 : 14); k++) {
          addPuff(g.x + (Math.random() - 0.5) * 9, g.z + Math.random() * Math.max(2, g.depth0), k & 1 ? '#ff8a7a' : '#fff0a0', 2);
        }
        addText(g.x, 3, g.z, g.boss ? 'BOSS DOWN!' : 'DOWN!', '#ffffff', 34);
        w.arrows.length = 0;
      }
      if (a.A <= 0.0001) {
        a.A = 0;
        state = 'dying'; w.dyingT = 0;
      }
    }

    // クリア判定
    if (state === 'playing' && atGoal) {
      w.finishT += dt;
      if (w.finishT > 0.5) winStage();
    }
  } else if (state === 'dying') {
    w.dyingT += dt;
    if (w.dyingT > 1.0) loseStage();
  }

  // 演出更新
  for (const gr of w.groups) if (!gr.dead && gr.boss && gr.boss.hurt > 0) gr.boss.hurt -= dt;
  for (let i = w.arrows.length - 1; i >= 0; i--) {
    const ar = w.arrows[i];
    ar.t += dt;
    if (ar.t >= ar.dur) {
      addSpark(ar.tx, 0.8, ar.tz, '#aee0ff');
      w.arrows[i] = w.arrows[w.arrows.length - 1];
      w.arrows.pop();
    }
  }
  for (let i = w.parts.length - 1; i >= 0; i--) {
    const p = w.parts[i];
    p.t += dt;
    if (p.k === 'p') { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 4 * dt; if (p.y < 0.1) p.y = 0.1; }
    if (p.t >= p.life) { w.parts[i] = w.parts[w.parts.length - 1]; w.parts.pop(); }
  }

  syncArmy(a, dt);
  for (const gr of w.groups) if (!gr.dead || gr.vn > 0) syncGroup(gr);
}

// ======================================================================
// 描画
// ======================================================================
const waterGrad = { h: 0, g: null };
function drawBackground() {
  if (!waterGrad.g || waterGrad.h !== H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6fd0f5');
    g.addColorStop(1, '#2b86dc');
    waterGrad.g = g; waterGrad.h = H;
  }
  ctx.fillStyle = waterGrad.g;
  ctx.fillRect(0, 0, W, H);
  // さざ波
  const t = world.t;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 80; i++) {
    const side = (i & 1) ? 1 : -1;
    const wx = side * (7.6 + hash(i * 1.7) * 18);
    const base = hash(i * 3.3) * 160;
    const ahead = (((base - cam.z) % 160) + 160) % 160 - 4;
    if (ahead > VIEW_DIST) continue;
    const z = cam.z + ahead;
    if (!proj(wx, 0, z)) continue;
    const x1 = PX, y1 = PY, s = PS;
    if (!proj(wx + 1.6, 0, z)) continue;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.22 + 0.18 * Math.sin(t * 2 + i)).toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(PX, PY); ctx.stroke();
  }
}

function quad(x0, y0, x1, y1, x2, y2, x3, y3) {
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
  ctx.closePath();
}

function drawGround() {
  const z0 = cam.z - 4, z1 = cam.z + VIEW_DIST;
  // 道の土台
  if (!proj(-ROAD_HALF, 0, z0)) return;
  const a0x = PX, a0y = PY;
  proj(ROAD_HALF, 0, z0); const b0x = PX, b0y = PY;
  proj(ROAD_HALF, 0, z1); const b1x = PX, b1y = PY;
  proj(-ROAD_HALF, 0, z1); const a1x = PX, a1y = PY;
  ctx.fillStyle = '#d8c7a6';
  quad(a0x, a0y, b0x, b0y, b1x, b1y, a1x, a1y);
  ctx.fill();

  const r0 = Math.floor(z0 / ROW_LEN), r1 = Math.ceil(z1 / ROW_LEN);
  // 列ごとの濃淡
  for (let r = r0; r < r1; r++) {
    const h = hash(r * 1.3);
    if (h < 0.35) continue;
    const za = r * ROW_LEN, zb = za + ROW_LEN;
    if (!proj(-ROAD_HALF, 0, za)) continue; const p0x = PX, p0y = PY;
    if (!proj(ROAD_HALF, 0, za)) continue; const p1x = PX, p1y = PY;
    if (!proj(ROAD_HALF, 0, zb)) continue; const p2x = PX, p2y = PY;
    if (!proj(-ROAD_HALF, 0, zb)) continue; const p3x = PX, p3y = PY;
    ctx.fillStyle = h < 0.7 ? 'rgba(255,248,230,0.22)' : 'rgba(150,115,70,0.10)';
    quad(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y);
    ctx.fill();
  }
  // 目地
  ctx.strokeStyle = 'rgba(130,105,72,0.38)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let r = r0; r < r1; r++) {
    const za = r * ROW_LEN, zb = za + ROW_LEN;
    if (!proj(-ROAD_HALF, 0, za)) continue;
    ctx.moveTo(PX, PY);
    if (!proj(ROAD_HALF, 0, za)) continue;
    ctx.lineTo(PX, PY);
    const off = (r & 1) ? 0.95 : 0;
    for (let x = -ROAD_HALF + off + 1.9; x < ROAD_HALF - 0.1; x += 1.9) {
      if (!proj(x, 0, za)) continue;
      ctx.moveTo(PX, PY);
      if (!proj(x, 0, zb)) continue;
      ctx.lineTo(PX, PY);
    }
  }
  ctx.stroke();
}

function drawWalls() {
  const z0 = cam.z - 4, z1 = cam.z + VIEW_DIST;
  for (let side = -1; side <= 1; side += 2) {
    const xi = side * ROAD_HALF, xo = side * (ROAD_HALF + WALL_W);
    // 内側の面
    if (!proj(xi, 0, z0)) continue; const a0x = PX, a0y = PY;
    proj(xi, WALL_H, z0); const t0x = PX, t0y = PY;
    proj(xi, WALL_H, z1); const t1x = PX, t1y = PY;
    proj(xi, 0, z1); const a1x = PX, a1y = PY;
    ctx.fillStyle = '#b7a283';
    quad(a0x, a0y, t0x, t0y, t1x, t1y, a1x, a1y);
    ctx.fill();
    // 天面
    proj(xo, WALL_H, z0); const o0x = PX, o0y = PY;
    proj(xo, WALL_H, z1); const o1x = PX, o1y = PY;
    ctx.fillStyle = '#efe0c0';
    quad(t0x, t0y, o0x, o0y, o1x, o1y, t1x, t1y);
    ctx.fill();
    // ブロックの継ぎ目
    ctx.strokeStyle = 'rgba(110,88,60,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const r0 = Math.floor(z0 / ROW_LEN), r1 = Math.ceil(z1 / ROW_LEN);
    for (let r = r0; r <= r1; r++) {
      const z = r * ROW_LEN;
      if (!proj(xi, 0, z)) continue; ctx.moveTo(PX, PY);
      if (!proj(xi, WALL_H, z)) continue; ctx.lineTo(PX, PY);
    }
    ctx.stroke();
    // 縁
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t0x, t0y); ctx.lineTo(t1x, t1y); ctx.stroke();
  }
}

function outlineText(str, x, y, size, fill, stroke, lw) {
  ctx.font = '900 ' + Math.round(size) + 'px ' + FONT_NUM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

function pill(str, x, y, size, c1, c2) {
  const w = Math.max(size * 1.9, str.length * size * 0.66 + size * 0.9);
  const h = size * 1.35;
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  outlineText(str, x, y + size * 0.04, size, '#fff', 'rgba(0,0,0,0.45)', size * 0.16);
}

function drawGate(gt) {
  const h = 2.6;
  for (let side = 0; side < 2; side++) {
    const xl = side === 0 ? -5.7 : 0.2, xr = side === 0 ? -0.2 : 5.7;
    if (!proj(xl, 0, gt.z)) return;
    const X1 = PX, Yb = PY, s = PS;
    if (!proj(xr, 0, gt.z)) return;
    const X2 = PX;
    if (!proj(xl, h, gt.z)) return;
    const Yt = PY;
    const opt = gt.opts[side];
    const wpx = X2 - X1, hpx = Yb - Yt;
    if (wpx < 4 || hpx < 2) continue;
    const used = gt.used;
    const chosen = used && gt.side === side;
    ctx.globalAlpha = used && !chosen ? 0.45 : 1;
    // 足
    ctx.fillStyle = '#7a7f8a';
    ctx.fillRect(X1 + wpx * 0.06, Yb - hpx * 0.06, wpx * 0.1, hpx * 0.1);
    ctx.fillRect(X2 - wpx * 0.16, Yb - hpx * 0.06, wpx * 0.1, hpx * 0.1);
    // 板
    const g = ctx.createLinearGradient(0, Yt, 0, Yb);
    const mul = opt.t === 'mul';
    g.addColorStop(0, mul ? '#7ad0ff' : '#58b8ff');
    g.addColorStop(1, mul ? '#2a73f0' : '#1f66dc');
    rrect(ctx, X1, Yt, wpx, hpx, Math.min(10, hpx * 0.18));
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.strokeStyle = mul ? '#ffd23f' : '#0f45a8';
    ctx.stroke();
    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rrect(ctx, X1 + wpx * 0.03, Yt + hpx * 0.06, wpx * 0.94, hpx * 0.28, hpx * 0.12);
    ctx.fill();
    // 数字
    const txt = (opt.t === 'add' ? '+' : '×') + opt.v;
    const size = Math.min(hpx * 0.78, wpx / (txt.length * 0.62 + 0.6));
    outlineText(txt, (X1 + X2) / 2, Yt + hpx * 0.54, size, '#fff', '#0b3a8a', Math.max(3, size * 0.16));
    // 通過フラッシュ
    if (chosen && gt.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (gt.flash * 0.7).toFixed(3) + ')';
      rrect(ctx, X1, Yt, wpx, hpx, Math.min(10, hpx * 0.18));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // 支柱
  if (proj(-5.85, 0, gt.z)) {
    const xa = PX, ya = PY, s = PS;
    proj(-5.85, h + 0.3, gt.z);
    drawPost(xa, ya, PY, s);
  }
  if (proj(0, 0, gt.z)) {
    const xa = PX, ya = PY, s = PS;
    proj(0, h + 0.4, gt.z);
    drawPost(xa, ya, PY, s);
  }
  if (proj(5.85, 0, gt.z)) {
    const xa = PX, ya = PY, s = PS;
    proj(5.85, h + 0.3, gt.z);
    drawPost(xa, ya, PY, s);
  }
}
function drawPost(x, yb, yt, s) {
  const w = Math.max(3, s * 0.34);
  ctx.fillStyle = '#9a6a3c';
  ctx.fillRect(x - w / 2, yt, w, yb - yt);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x - w / 2, yt, w * 0.3, yb - yt);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - w * 0.7, yt - w * 0.5, w * 1.4, w * 0.9);
}

function drawGoal(z) {
  const hw = ROAD_HALF + WALL_W;
  const wallH = 6;
  if (!proj(-hw, 0, z)) return;
  const xl = PX, yb = PY, s = PS;
  proj(hw, 0, z); const xr = PX;
  proj(-hw, wallH, z); const yt = PY;
  const wpx = xr - xl, hpx = yb - yt;
  // 壁
  ctx.fillStyle = '#d3bf9b';
  ctx.fillRect(xl, yt, wpx, hpx);
  ctx.fillStyle = 'rgba(110,88,60,0.35)';
  for (let k = 1; k < 6; k++) ctx.fillRect(xl, yt + hpx * k / 6, wpx, 1.4);
  // 塔
  ctx.fillStyle = '#bba482';
  ctx.fillRect(xl, yt - hpx * 0.22, wpx * 0.2, hpx * 1.22);
  ctx.fillRect(xr - wpx * 0.2, yt - hpx * 0.22, wpx * 0.2, hpx * 1.22);
  // 胸壁
  ctx.fillStyle = '#e6d4b0';
  const n = 9;
  for (let k = 0; k < n; k++) {
    if (k % 2) continue;
    ctx.fillRect(xl + wpx * k / n, yt - hpx * 0.12, wpx / n, hpx * 0.12);
  }
  // 扉
  const dw = wpx * 0.36, dh = hpx * 0.68;
  const dx = (xl + xr) / 2 - dw / 2, dy = yb - dh;
  ctx.fillStyle = '#8a5a2e';
  rrect(ctx, dx, dy, dw, dh, dw * 0.35);
  ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#4a2f1c'; ctx.stroke();
  ctx.strokeStyle = 'rgba(40,20,5,0.45)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 1; k < 5; k++) { ctx.moveTo(dx + dw * k / 5, dy + dh * 0.1); ctx.lineTo(dx + dw * k / 5, yb); }
  ctx.stroke();
  ctx.fillStyle = '#5b616d';
  ctx.fillRect(dx, dy + dh * 0.4, dw, dh * 0.07);
  ctx.fillRect(dx, dy + dh * 0.72, dw, dh * 0.07);
  // フラッグ
  ctx.fillStyle = '#2f7df0';
  const fx = xl + wpx * 0.1, fy = yt - hpx * 0.22;
  ctx.fillRect(fx - 1.5, fy - hpx * 0.35, 3, hpx * 0.35);
  ctx.beginPath(); ctx.moveTo(fx + 1.5, fy - hpx * 0.35); ctx.lineTo(fx + hpx * 0.25, fy - hpx * 0.27); ctx.lineTo(fx + 1.5, fy - hpx * 0.19); ctx.closePath(); ctx.fill();
  const fx2 = xr - wpx * 0.1;
  ctx.fillRect(fx2 - 1.5, fy - hpx * 0.35, 3, hpx * 0.35);
  ctx.beginPath(); ctx.moveTo(fx2 - 1.5, fy - hpx * 0.35); ctx.lineTo(fx2 - hpx * 0.25, fy - hpx * 0.27); ctx.lineTo(fx2 - 1.5, fy - hpx * 0.19); ctx.closePath(); ctx.fill();
  outlineText('GOAL', (xl + xr) / 2, yt + hpx * 0.12, Math.min(hpx * 0.2, wpx * 0.12), '#ffe14a', '#8a4a00', 4);
}

function drawArmy() {
  const w = world, a = w.army;
  const n = a.vn;
  const moving = state === 'playing' && !(w.groups.some((g) => !g.dead && g.active && g.z - a.z <= RANGE + 0.5));
  // 足元の光
  if (proj(a.x, 0, a.z)) {
    const rr = (Math.min(Math.sqrt(Math.max(n, 1)) * a.sp, 3.2) + 0.9) * PS;
    ctx.fillStyle = 'rgba(80,160,255,' + (0.16 + w.glow * 0.3).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(PX, PY - rr * 0.1, rr, rr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  }
  const bobSpd = moving ? 11 : 5;
  for (let k = 0; k < a.order.length; k++) {
    const i = a.order[k];
    if (!proj(a.x + FX[i] * a.sp, 0, a.z + FZ[i] * a.sp)) continue;
    const ap = a.appear[i];
    const sc = ap < 1 ? (1 + 2.2 * Math.pow(ap - 1, 3) + 1.2 * Math.pow(ap - 1, 2)) * Math.min(1, ap * 3) : 1;
    const ww = 1.15 * PS * sc, hh = ww * 1.25;
    const bob = Math.abs(Math.sin(w.t * bobSpd + i * 1.7)) * 0.16 * PS * (moving ? 1 : 0.35);
    ctx.drawImage(SPR_BLUE, PX - ww / 2, PY - hh - bob + hh * 0.06, ww, hh);
  }
}

function drawGroup(g) {
  const w = world;
  const n = g.vn;
  if (g.dead && n === 0) return;
  const rows = Math.ceil(n / g.cols);
  const bossOff = Math.min(3.4, g.depth0 * 0.45) + 1.4;
  let bossDrawn = !(g.boss && g.boss.hp > 0);
  const moveBob = g.active && !g.dead && g.z - w.army.z > CONTACT + 0.3;
  const bobSpd = moveBob ? 12 : 4;
  for (let r = rows - 1; r >= 0; r--) {
    const rz = r * ESPZ;
    if (!bossDrawn && rz <= bossOff) { drawBossAt(g); bossDrawn = true; }
    const rowN = Math.min(g.cols, n - r * g.cols);
    for (let c = 0; c < rowN; c++) {
      const i = r * g.cols + c;
      ePos(g, i, n);
      if (!proj(EX, 0, EZ)) continue;
      if (PY < -60 || PY > H + 80) continue;
      const ww = 1.1 * PS, hh = ww * 1.25;
      const bob = Math.abs(Math.sin(w.t * bobSpd + i * 2.3)) * 0.14 * PS * (moveBob ? 1 : 0.3);
      ctx.drawImage(SPR_RED, PX - ww / 2, PY - hh - bob + hh * 0.06, ww, hh);
    }
  }
  if (!bossDrawn) drawBossAt(g);
}
function drawBossAt(g) {
  const bossOff = Math.min(3.4, g.depth0 * 0.45) + 1.4;
  if (!proj(g.x, 0, g.z + bossOff)) return;
  drawBoss(PX, PY, 6.2 * PS, world.t, g.boss.hurt);
}

function drawArrows() {
  const w = world;
  ctx.lineCap = 'round';
  for (let i = 0; i < w.arrows.length; i++) {
    const ar = w.arrows[i];
    const tt = ar.t / ar.dur;
    if (!arrowPoint(ar, tt)) continue;
    const hx = PX, hy = PY;
    if (!arrowPoint(ar, Math.max(0, tt - 0.32))) continue;
    const tx0 = PX, ty0 = PY;
    if (!arrowPoint(ar, Math.max(0, tt - 0.09))) continue;
    const mx = PX, my = PY;
    ctx.strokeStyle = 'rgba(150,215,255,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = '#fff6d2';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill();
  }
}
function arrowPoint(ar, tt) {
  const x = lerp(ar.sx, ar.tx, tt), z = lerp(ar.sz, ar.tz, tt);
  const y = 0.9 + 4 * ar.h * tt * (1 - tt);
  return proj(x, y, z);
}

function drawParts() {
  const w = world;
  for (let i = 0; i < w.parts.length; i++) {
    const p = w.parts[i];
    const f = p.t / p.life;
    if (p.k === 't') {
      if (!proj(p.x, p.y + p.t * 2.4, p.z)) continue;
      ctx.globalAlpha = clamp(1.6 - f * 1.6, 0, 1);
      const sc = 0.8 + Math.min(1, f * 6) * 0.3;
      outlineText(p.str, PX, PY, p.size * sc, p.color, '#7a4a00', p.size * 0.18);
      ctx.globalAlpha = 1;
    } else if (p.k === 's') {
      if (!proj(p.x, p.y, p.z)) continue;
      const sz = PS * (0.25 + f * 0.55);
      ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = p.color; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(PX - sz, PY); ctx.lineTo(PX + sz, PY);
      ctx.moveTo(PX, PY - sz); ctx.lineTo(PX, PY + sz);
      ctx.moveTo(PX - sz * 0.6, PY - sz * 0.6); ctx.lineTo(PX + sz * 0.6, PY + sz * 0.6);
      ctx.moveTo(PX - sz * 0.6, PY + sz * 0.6); ctx.lineTo(PX + sz * 0.6, PY - sz * 0.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      if (!proj(p.x, p.y, p.z)) continue;
      ctx.globalAlpha = (1 - f) * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(PX, PY, PS * (0.18 + f * 0.3), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawLabels() {
  const w = world, a = w.army;
  // 敵軍の人数
  for (let i = 0; i < w.groups.length; i++) {
    const g = w.groups[i];
    if (g.dead) continue;
    if (g.z - a.z > VIEW_DIST - 6) continue;
    const mid = g.z + g.depth0 * 0.45;
    if (!proj(g.x, 2.3, mid)) continue;
    const cnt = Math.max(0, Math.ceil(g.S - 1e-6));
    const size = clamp(PS * 0.62, 17, 30);
    if (cnt > 0) pill(String(cnt), PX, PY, size, '#ff6a5e', '#c42a22');
    if (g.boss && g.boss.hp > 0) {
      const bw = Math.max(56, PS * 4.2), bh = Math.max(9, PS * 0.5);
      const by = PY + (cnt > 0 ? size * 1.3 : 0) + bh;
      rrect(ctx, PX - bw / 2, by - bh / 2, bw, bh, bh / 2);
      ctx.fillStyle = 'rgba(20,10,10,0.7)'; ctx.fill();
      const fr = clamp(g.boss.hp / g.boss.max, 0, 1);
      if (fr > 0) {
        rrect(ctx, PX - bw / 2 + 2, by - bh / 2 + 2, Math.max(bh - 4, (bw - 4) * fr), bh - 4, (bh - 4) / 2);
        ctx.fillStyle = '#ff4a3a'; ctx.fill();
      }
      outlineText('BOSS ' + Math.ceil(g.boss.hp), PX, by + bh * 1.35, clamp(PS * 0.42, 12, 20), '#fff', '#3a0a06', 4);
    }
  }
  // 味方の人数
  if (a.vn > 0 && state !== 'title') {
    const top = Math.min(Math.sqrt(Math.max(a.vn, 1)) * a.sp, 3.2) * 0.8;
    if (proj(a.x, 2.2, a.z + top)) {
      const size = clamp(PS * 0.7, 18, 32);
      pill(String(Math.ceil(a.A - 1e-6)), PX, PY, size, '#4d9bff', '#1c56c9');
    }
  }
}

function render() {
  const w = world, a = w.army;
  cam.z = a.z - CAM_BACK;
  cam.x = a.x * 0.35;
  // タイトル中はゆっくり揺らす
  if (state === 'title') cam.x = Math.sin(w.t * 0.5) * 0.6;

  drawBackground();
  drawGround();
  drawWalls();

  // 奥から手前へ
  const ents = [];
  for (const gt of w.gates) if (gt.z - cam.z < VIEW_DIST && gt.z - cam.z > -4) ents.push({ z: gt.z, k: 0, o: gt });
  for (const g of w.groups) if (!g.dead && g.z - cam.z < VIEW_DIST + 4) ents.push({ z: g.z, k: 1, o: g });
  ents.push({ z: a.z, k: 2, o: a });
  if (w.endZ - cam.z < VIEW_DIST + 4) ents.push({ z: w.endZ, k: 3, o: null });
  ents.sort((p, q) => q.z - p.z);
  for (const e of ents) {
    if (e.k === 0) drawGate(e.o);
    else if (e.k === 1) drawGroup(e.o);
    else if (e.k === 2) drawArmy();
    else drawGoal(e.z);
  }
  drawArrows();
  drawParts();
  drawLabels();
}

// ======================================================================
// HUD・UI
// ======================================================================
let hudArmy = -1, hudStage = -1, hudCoins = -1, dispCoins = 0;
function bumpHud() {
  try {
    el.hudArmy.classList.remove('pop');
    void el.hudArmy.offsetWidth;
    el.hudArmy.classList.add('pop');
  } catch (e) { /* ignore */ }
}
function updateHud() {
  const n = Math.max(0, Math.ceil(world.army.A - 1e-6));
  if (n !== hudArmy) { hudArmy = n; el.armyNum.textContent = String(n); }
  if (world.stage !== hudStage) { hudStage = world.stage; el.stageNum.textContent = 'STAGE ' + world.stage; }
  if (dispCoins < save.coins) dispCoins = Math.min(save.coins, dispCoins + Math.max(1, Math.ceil((save.coins - dispCoins) * 0.12)));
  else if (dispCoins > save.coins) dispCoins = save.coins;
  if (dispCoins !== hudCoins) { hudCoins = dispCoins; el.coinNum.textContent = String(dispCoins); }
}

function showOverlay(id) {
  for (const k of ['title', 'clear', 'over']) el[k].classList.toggle('hidden', k !== id);
}
function hideOverlays() {
  for (const k of ['title', 'clear', 'over']) el[k].classList.add('hidden');
}

function refreshTitle() {
  selStage = clamp(selStage, 1, save.stage);
  el.stName.textContent = 'ステージ ' + selStage + ((selStage % 3 === 0) ? '  (BOSS)' : '');
  el.stPrev.disabled = selStage <= 1;
  el.stNext.disabled = selStage >= save.stage;
  const cost = upgradeCost();
  const now = 10 + save.bonus;
  el.upInfo.textContent = '兵士 ' + now + '人 → ' + (now + 1) + '人';
  el.upCost.textContent = String(cost);
  el.btnUpgrade.classList.toggle('disabled', save.coins < cost || save.bonus >= 60);
}

function toTitle() {
  startStage(selStage, 'title');
  refreshTitle();
  showOverlay('title');
}
function beginPlay(stage) {
  selStage = stage;
  startStage(stage, 'ready');
  hideOverlays();
}

// ======================================================================
// 入力
// ======================================================================
let dragging = false, dragStartX = 0, dragStartTx = 0;
function onDown(e) {
  if (state !== 'ready' && state !== 'playing') return;
  dragging = true;
  dragStartX = e.clientX;
  dragStartTx = world.army.tx;
  el.hint.classList.remove('show');
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  e.preventDefault();
}
function onMove(e) {
  if (!dragging) return;
  const dx = e.clientX - dragStartX;
  const a = world.army;
  a.tx = clamp(dragStartTx + dx / pxPerUnit, -a.lim, a.lim);
  e.preventDefault();
}
function onUp() { dragging = false; }

canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);
stageEl.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
stageEl.addEventListener('gesturestart', (e) => { e.preventDefault(); });

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});
window.addEventListener('blur', () => { keys.left = keys.right = false; dragging = false; });

el.btnStart.addEventListener('click', () => beginPlay(selStage));
el.stPrev.addEventListener('click', () => { selStage = Math.max(1, selStage - 1); toTitle(); });
el.stNext.addEventListener('click', () => { selStage = Math.min(save.stage, selStage + 1); toTitle(); });
el.btnUpgrade.addEventListener('click', () => {
  const cost = upgradeCost();
  if (save.coins < cost || save.bonus >= 60) return;
  save.coins -= cost;
  save.bonus += 1;
  writeSave();
  toTitle();
});
el.btnNext.addEventListener('click', () => beginPlay(Math.max(world.stage + 1, 1)));
el.btnReplay.addEventListener('click', () => beginPlay(world.stage));
el.btnClearTitle.addEventListener('click', () => { selStage = Math.min(save.stage, world.stage + 1); toTitle(); });
el.btnRetry.addEventListener('click', () => beginPlay(world.stage));
el.btnOverTitle.addEventListener('click', () => { selStage = world.stage; toTitle(); });

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => { resize(); setTimeout(resize, 250); });

// ======================================================================
// メインループ
// ======================================================================
let last = 0;
function step(dt) {
  update(dt);
  render();
  updateHud();
}
function frame(ts) {
  requestAnimationFrame(frame);
  let dt = (ts - last) / 1000;
  last = ts;
  if (!(dt > 0)) dt = 0.016;
  step(Math.min(0.05, dt));
}

function boot() {
  loadSave();
  dispCoins = save.coins;
  SPR_BLUE = makeSprite('blue');
  SPR_RED = makeSprite('red');
  resize();
  selStage = save.stage;
  toTitle();
  requestAnimationFrame(frame);
}

// テスト用フック（ゲーム動作には影響しない）
window.BlueMarch = {
  get world() { return world; },
  get state() { return state; },
  get save() { return save; },
  step, startStage, beginPlay, genStage, toTitle, resize,
};

boot();
})();
