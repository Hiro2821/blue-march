/* ゲームエンジン: Canvas擬似3D描画・戦闘・進行 */
(function (BM) {
'use strict';
const C = BM.C, S = BM.S, TYPE = BM.TYPE, TYPES = BM.TYPES;
const clamp = BM.clamp, lerp = BM.lerp, hash = BM.hash;
const FONT_JP = '"Hiragino Maru Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP",system-ui,sans-serif';
const FONT_NUM = '"Arial Black","Hiragino Sans",Impact,system-ui,sans-serif';
const BOSS_DPS = 0.5;               // ボスの攻撃力係数（体力あたり）
const SCALE = [1.15, 1.1, 1.4, 1.2]; // 兵種ごとの表示サイズ
const FRONT = [2, 0, 3, 1];          // 前列に並べる優先順（重装→剣士→魔法→弓）

const G = BM.G = { state: 'menu', world: null, run: null };
let canvas, ctx, stageEl;
let W = 390, H = 844, dpr = 1, F = 430, cx = 195, cy = 400, pxPerUnit = 20;
const cam = { x: 0, z: 0 };
let PX = 0, PY = 0, PS = 0;
const keys = { left: false, right: false };

// ===================================================================== 投影
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
  const sin = Math.sin(PITCH), cos = Math.cos(PITCH);
  const depth = C.CAM_H * sin + C.CAM_BACK * cos;
  const up = -C.CAM_H * cos + C.CAM_BACK * sin;
  cy = H * 0.74 + up * F / depth;
  pxPerUnit = (F / depth) * 0.65;
  waterGrad.g = null;
}
const PITCH = 38 * Math.PI / 180;
const SIN = Math.sin(PITCH), COS = Math.cos(PITCH);

function proj(x, y, z) {
  const dx = x - cam.x, dy = y - C.CAM_H, dz = z - cam.z;
  const depth = -dy * SIN + dz * COS;
  if (depth < 0.4) return false;
  const up = dy * COS + dz * SIN;
  const s = F / depth;
  PX = cx + dx * s;
  PY = cy - up * s;
  PS = s;
  return true;
}

// ===================================================================== 軍隊
const FX = new Float32Array(C.MAXV), FZ = new Float32Array(C.MAXV);
for (let i = 0; i < C.MAXV; i++) {
  const r = Math.sqrt(i + 0.5), th = i * 2.39996323;
  FX[i] = r * Math.cos(th);
  FZ[i] = r * Math.sin(th) * 0.85;
}
const spFor = (n) => clamp(3.0 / Math.sqrt(Math.max(n, 1)), 0.26, 0.62);

function total(a) { return a.n[0] + a.n[1] + a.n[2] + a.n[3]; }
function count(a) { return Math.max(0, Math.ceil(total(a) - 1e-6)); }
G.count = () => (G.world ? count(G.world.army) : 0);

function normalize(a) {
  let tot = Math.round(total(a));
  if (tot < 1) tot = 1;
  const parts = BM.split(tot, [a.n[0], a.n[1], a.n[2], a.n[3]]);
  if (parts.every((p) => p === 0)) parts[0] = tot;
  for (let i = 0; i < 4; i++) a.n[i] = parts[i];
}
function scaleArmy(a, f) {
  for (let i = 0; i < 4; i++) a.n[i] *= f;
}
function addProp(a, v) {
  const tot = total(a);
  if (tot <= 0) { a.n[0] += v; return; }
  for (let i = 0; i < 4; i++) a.n[i] += v * a.n[i] / tot;
}
function applyOpt(a, o) {
  const tot = total(a);
  if (o.t === 'add') addProp(a, o.v);
  else if (o.t === 'sub') scaleArmy(a, Math.max(1, tot - o.v) / Math.max(tot, 1));
  else if (o.t === 'mul') scaleArmy(a, Math.max(o.v, 1 / Math.max(tot, 1)));
  else if (o.t === 'type') a.n[TYPE[o.ty].idx] += o.v;
  normalize(a);
}
BM.applyOpt = applyOpt;

function initCounts() {
  const tot = 10 + S.upg.init;
  const w = TYPES.map((t) => (S.unlock[t] ? S.roster[t] : 0));
  const out = BM.split(tot, w);
  if (out.every((v) => v === 0)) out[0] = tot;
  return out;
}

// 画面に描く兵士の兵種配分（実人数とは別管理）
function visAlloc(a, vn, out) {
  const present = [];
  for (let i = 0; i < 4; i++) if (a.n[i] > 0.0001) present.push(i);
  for (let i = 0; i < 4; i++) out[i] = 0;
  if (!vn || !present.length) return;
  const tot = total(a);
  let used = 0;
  const fr = [];
  for (const i of present) {
    const v = vn * a.n[i] / tot;
    out[i] = Math.max(vn >= present.length ? 1 : 0, Math.floor(v));
    used += out[i];
    fr.push([v - Math.floor(v), i]);
  }
  fr.sort((p, q) => q[0] - p[0]);
  let k = 0;
  while (used < vn) { out[fr[k % fr.length][1]]++; used++; k++; }
  while (used > vn) {   // 最小1人の確保で超えた分を最大の兵種から減らす
    let mi = present[0];
    for (const i of present) if (out[i] > out[mi]) mi = i;
    out[mi]--; used--;
  }
}

function syncArmy(a, dt) {
  const n = count(a) > 0 ? BM.allyVis(count(a)) : 0;
  if (n > a.vn) for (let i = a.vn; i < n; i++) a.appear[i] = 0;
  else if (n < a.vn) {
    const cnt = Math.min(3, a.vn - n);
    for (let k = 0; k < cnt; k++) {
      const i = n + Math.floor(Math.random() * (a.vn - n));
      addPuff(a.x + FX[i] * a.sp, a.z + FZ[i] * a.sp, '#9bd0ff', 2);
    }
  }
  // 兵種の割り当て: 前列(奥側)から 重装→剣士→魔法→弓
  const al = a.alloc;
  const prev0 = al[0], prev1 = al[1], prev2 = al[2], prev3 = al[3];
  visAlloc(a, n, al);
  if (n !== a.vn || prev0 !== al[0] || prev1 !== al[1] || prev2 !== al[2] || prev3 !== al[3] || a.orderN < 0) {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(i);
    arr.sort((p, q) => FZ[q] - FZ[p]);
    let ti = 0, left = al[FRONT[0]];
    for (let k = 0; k < arr.length; k++) {
      while (left <= 0 && ti < 3) { ti++; left = al[FRONT[ti]]; }
      a.vt[arr[k]] = FRONT[ti];
      left--;
    }
    a.order = arr;
    a.orderN = n;
  }
  a.vn = n;
  a.sp += (spFor(n) - a.sp) * Math.min(1, dt * 8);
  for (let i = 0; i < n; i++) if (a.appear[i] < 1) a.appear[i] = Math.min(1, a.appear[i] + dt * 4.5);
}

// ===================================================================== 倍率
function runBuff() { return G.run ? G.run.buff : { atk: 0, hp: 0, aspd: 0, coin: 0, move: 0 }; }
const atkM = () => (1 + 0.06 * S.upg.atk) * (1 + runBuff().atk);
const hpM = () => (1 + 0.06 * S.upg.hp) * (1 + runBuff().hp);
const aspdM = () => (1 + 0.04 * S.upg.aspd) * (1 + runBuff().aspd);
const coinM = () => (1 + 0.08 * S.upg.coin) * (1 + runBuff().coin);
const moveM = () => 1 + runBuff().move;
BM.mult = { atk: atkM, hp: hpM, aspd: aspdM, coin: coinM, move: moveM };

// ===================================================================== 開始
function newWorld(stage, state, seed) {
  const gen = BM.genStage(stage, seed === undefined ? Math.floor(Math.random() * 1e9) : seed);
  const a = {
    x: 0, tx: 0, z: 0, n: new Float64Array(initCounts()), vn: 0, sp: 0.5,
    appear: new Float32Array(C.MAXV).fill(1), vt: new Uint8Array(C.MAXV),
    alloc: [0, 0, 0, 0], order: [], orderN: -1, lim: 3,
  };
  G.run = {
    stage, coinsRaw: 0, buff: { atk: 0, hp: 0, aspd: 0, coin: 0, move: 0 },
    picked: [], routes: [], kills: 0, gates: 0, startArmy: count(a), maxArmy: count(a), bossKilled: false,
  };
  G.world = {
    stage, ...gen, army: a, parts: [], proj: [], acc: { arrow: 0, orb: 0, slash: 0 },
    t: 0, readyT: 0.6, finishT: 0, dyingT: 0, glow: 0, shake: 0, fightT: 0, hintOn: false, intro: null,
  };
  a.sp = spFor(count(a));
  syncArmy(a, 0);
  G.state = state;
}
G.start = function (stage, seed) {
  newWorld(stage, 'ready', seed);
  S.stats.plays++;
  BM.hooks.event('start', { stage });
};
G.preview = function (stage) {
  newWorld(stage || S.stage, 'menu', 1234);
  G.world.army.z = 0;
};

// ===================================================================== パーティクル
function addText(x, y, z, str, color, size, stroke) {
  G.world.parts.push({ k: 't', x, y, z, t: 0, life: 1.0, str, color, size, stroke: stroke || '#7a4a00' });
}
function addSpark(x, y, z, color) {
  if (G.world.parts.length > 260) return;
  G.world.parts.push({ k: 's', x, y, z, t: 0, life: 0.32, color });
}
function addPuff(x, z, color, n) {
  const w = G.world;
  for (let i = 0; i < n; i++) {
    if (w.parts.length > 260) return;
    w.parts.push({
      k: 'p', x: x + (Math.random() - 0.5) * 0.6, y: 0.5 + Math.random() * 0.5, z: z + (Math.random() - 0.5) * 0.6,
      vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3,
      t: 0, life: 0.45 + Math.random() * 0.3, color,
    });
  }
}
function addCoinBurst(x, z, n) {
  const w = G.world;
  for (let i = 0; i < n; i++) {
    if (w.parts.length > 280) return;
    w.parts.push({
      k: 'c', x: x + (Math.random() - 0.5) * 1.4, y: 1 + Math.random(), z: z + (Math.random() - 0.5) * 1.4,
      vx: (Math.random() - 0.5) * 6, vy: 5 + Math.random() * 5, vz: (Math.random() - 0.5) * 6,
      t: 0, life: 1.1 + Math.random() * 0.4,
    });
  }
}
function addRing(x, z, color, r) {
  if (G.world.parts.length > 260) return;
  G.world.parts.push({ k: 'r', x, y: 0.1, z, t: 0, life: 0.5, color, r });
}

// ===================================================================== 更新
let EX = 0, EZ = 0;
function ePos(g, i, n) {
  const cols = g.cols;
  const r = Math.floor(i / cols), c = i % cols;
  const rowN = Math.min(cols, n - r * cols);
  EX = g.x + (c - (rowN - 1) / 2) * C.ESPX + ((r & 1) ? 0.2 : -0.2) + (hash(i * 3 + g.seed) - 0.5) * 0.3;
  EZ = g.z + r * C.ESPZ + (hash(i * 7 + g.seed) - 0.5) * 0.2;
}
function syncGroup(g) {
  const n = g.dead ? 0 : BM.enemyVis(Math.ceil(g.S / g.k - 1e-6));
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

function curGroup(w) {
  const fk = w.fork;
  for (let i = 0; i < w.groups.length; i++) {
    const g = w.groups[i];
    if (g.dead || g.skipped) continue;
    if (g.lane >= 0 && (!fk || fk.chosen !== g.lane)) continue;   // 選んでいない道の敵は相手にしない
    return g;
  }
  return null;
}

// 分岐の入口を通った位置(左右)で進む道が決まる
function chooseRoute(w, lane) {
  const fk = w.fork, run = G.run;
  fk.chosen = lane;
  const kind = fk.routes[lane];
  for (const gt of w.gates) if (gt.lane >= 0 && gt.lane !== lane) { gt.used = true; gt.skipped = true; }
  for (const g of w.groups) if (g.lane >= 0 && g.lane !== lane) g.skipped = true;
  for (const c of w.coins) if (c.lane !== lane) c.got = true;
  run.routes.push(kind);
  S.stats.routes[kind]++;
  const R = BM.ROUTE[kind];
  addText(w.army.x, 3.2, w.army.z + 2, R.name, '#ffffff', 30, R.col);
  BM.hooks.event('route', { kind });
}

// 敵の攻撃を兵種ごとの被弾しやすさ・体力に応じて配分する
function hurtArmy(a, dE) {
  let Wt = 0;
  for (const t of TYPES) Wt += a.n[TYPE[t].idx] * TYPE[t].w;
  if (Wt <= 0) return;
  const hm = hpM();
  for (const t of TYPES) {
    const T = TYPE[t];
    const share = a.n[T.idx] * T.w / Wt;
    a.n[T.idx] = Math.max(0, a.n[T.idx] - dE * share / (T.hp * hm));
  }
}

function reachRange(a) {
  let r = C.MELEE;
  for (const t of TYPES) if (a.n[TYPE[t].idx] >= 0.5) r = Math.max(r, TYPE[t].range);
  return r;
}

function offerPick(kind) {
  const w = G.world;
  G.state = 'picking';
  const pool = BM.PICKS.slice();
  const opts = [];
  while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  w.pickKind = kind;
  BM.hooks.pick(opts, kind);
}
G.choosePick = function (id) {
  if (G.state !== 'picking') return;
  const w = G.world, a = w.army, run = G.run;
  const p = BM.PICKS.find((q) => q.id === id);
  if (!p) return;
  if (p.key) run.buff[p.key] += p.v;
  else if (p.id === 'army') {
    const add = Math.max(5, Math.ceil(count(a) * 0.2));
    addProp(a, add); normalize(a);
    addText(a.x, 2.2, a.z, '+' + add, '#ffe14a', 46);
    w.glow = 1;
  }
  run.picked.push(p.id);
  S.stats.picks++;
  BM.hooks.event('pick', { id: p.id });
  G.state = 'playing';
};

function winStage() {
  const w = G.world, a = w.army, run = G.run;
  G.state = 'clear';
  const left = Math.max(1, count(a));
  const base = 30 + w.stage * 15;
  const bossBonus = 60 + w.stage * 25;
  const reward = Math.round((base + bossBonus + run.coinsRaw) * coinM());
  const first = w.stage >= S.stage;
  S.coins += reward;
  S.stage = Math.max(S.stage, w.stage + 1);
  S.stats.clears++;
  S.stats.totalCoins += reward;
  S.stats.bestClearArmy = Math.max(S.stats.bestClearArmy, left);
  S.stats.maxStage = Math.max(S.stats.maxStage, S.stage);
  BM.hooks.event('clear', { stage: w.stage, left });
  BM.writeSave();
  BM.hooks.clear({ stage: w.stage, left, reward, first, base, bossBonus, coins: Math.round(run.coinsRaw * coinM()), bossKind: w.bossKind });
}
function loseStage() {
  G.state = 'over';
  S.stats.losses++;
  BM.hooks.event('lose', { stage: G.world.stage });
  BM.writeSave();
  BM.hooks.over({ stage: G.world.stage });
}

function update(dt) {
  const w = G.world, a = w.army, run = G.run;
  w.t += dt;
  w.shake = Math.max(0, w.shake - dt * 2.5);

  if (G.state === 'ready' || G.state === 'playing') {
    const kv = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (kv) a.tx += kv * 9 * dt;
  }
  const rx = Math.min(Math.sqrt(Math.max(a.vn, 1)) * a.sp, 3.0) + 0.3;
  a.lim = Math.max(0.8, C.ROAD_HALF - 0.4 - rx);
  let lo = -a.lim, hi = a.lim;
  const fk = w.fork;
  if (fk && fk.chosen >= 0 && a.z >= fk.z - 1 && a.z <= fk.zEnd + 2) {
    const c = BM.laneX(fk.chosen), hw = Math.max(0.25, 2.3 - 0.45 * rx);
    lo = c - hw; hi = c + hw;
  }
  a.tx = clamp(a.tx, lo, hi);
  a.x += (a.tx - a.x) * Math.min(1, dt * 14);

  if (G.state === 'ready') {
    w.readyT -= dt;
    if (w.readyT <= 0) G.state = 'playing';
  }
  w.glow = Math.max(0, w.glow - dt * 2.5);
  for (const gt of w.gates) if (gt.flash > 0) gt.flash = Math.max(0, gt.flash - dt * 2);

  if (G.state === 'playing') {
    const g = curGroup(w);
    let fighting = false;
    if (g) {
      const gap0 = g.z - a.z;
      if (gap0 <= C.AGGRO) g.active = true;
      if (g.active && gap0 > C.CONTACT) g.z = Math.max(a.z + C.CONTACT, g.z - C.CHARGE * dt);
      if (g.active && g.z - a.z <= reachRange(a)) fighting = true;
    }
    const atGoal = !g && a.z >= w.endZ - 1;

    if (!fighting && !atGoal) {
      a.z += C.SPEED * moveM() * dt;
      if (a.z > 8) w.hintOn = false;
    }

    if (fk && fk.chosen < 0 && a.z >= fk.z) chooseRoute(w, a.x < 0 ? 0 : 1);

    // ボス登場演出
    if (g && g.boss && g.boss.hp > 0 && g.active && !g.introDone) {
      g.introDone = true;
      w.intro = { t: 0, kind: g.boss.kind };
      w.shake = 0.8;
    }

    // ゲート通過
    for (let i = 0; i < w.gates.length; i++) {
      const gt = w.gates[i];
      if (gt.used || a.z < gt.z) continue;
      gt.used = true;
      if (gt.skipped) continue;
      const side = gt.single ? 0 : (a.x < 0 ? 0 : 1);
      const opt = gt.opts[side];
      gt.side = side; gt.flash = 1;
      const before = count(a);
      applyOpt(a, opt);
      const diff = count(a) - before;
      run.gates++;
      S.stats.gates++;
      w.glow = 1;
      const bad = BM.optBad(opt);
      addText(a.x, 2.2, a.z, BM.optText(opt), bad ? '#ff6a5e' : '#ffe14a', 46, bad ? '#6a0f0a' : '#7a4a00');
      if (bad) {
        addRing(a.x, a.z, '#ff6a5e', 3.5);
        for (let k = 0; k < 4; k++) addPuff(a.x + (Math.random() - 0.5) * 4, a.z + (Math.random() - 0.5) * 2, '#ff9b90', 2);
      } else {
        for (let k = 0; k < 6; k++) addSpark(a.x + (Math.random() - 0.5) * 4, 0.8 + Math.random() * 1.6, a.z + (Math.random() - 0.5) * 2, '#fff2a0');
      }
      BM.hooks.event('gate', { opt, diff });
    }

    // コインルートのコイン
    for (const c of w.coins) {
      if (c.got || a.z < c.z) continue;
      c.got = true;
      run.coinsRaw += c.v;
      addText(BM.laneX(c.lane), 2.0, c.z, '+' + Math.round(c.v * coinM()), '#ffe14a', 34);
      addCoinBurst(BM.laneX(c.lane), c.z, 5);
    }

    // 強化選択マーカー
    for (const pk of w.picks) {
      if (!pk.used && a.z >= pk.z) {
        pk.used = true;
        offerPick(pk.kind);
        break;
      }
    }

    // 戦闘
    if (G.state === 'playing' && fighting && g) fight(w, a, g, dt);

    run.maxArmy = Math.max(run.maxArmy, count(a));
    S.stats.maxArmy = Math.max(S.stats.maxArmy, count(a));

    if (G.state === 'playing' && atGoal) {
      w.finishT += dt;
      if (w.finishT > 0.5) winStage();
    }
  } else if (G.state === 'dying') {
    w.dyingT += dt;
    if (w.dyingT > 1.0) loseStage();
  }

  // 演出
  if (w.intro) { w.intro.t += dt; if (w.intro.t > 2.4) w.intro = null; }
  for (const gr of w.groups) if (!gr.dead && gr.boss && gr.boss.hurt > 0) gr.boss.hurt -= dt;
  for (let i = w.proj.length - 1; i >= 0; i--) {
    const p = w.proj[i];
    p.t += dt;
    if (p.t >= p.dur) {
      if (p.k === 'orb') {
        addRing(p.tx, p.tz, '#c79bff', 2.6);
        for (let k = 0; k < 3; k++) addPuff(p.tx + (Math.random() - 0.5) * 2.4, p.tz + (Math.random() - 0.5) * 1.6, '#d9b8ff', 1);
      } else addSpark(p.tx, 0.8, p.tz, '#aee0ff');
      w.proj[i] = w.proj[w.proj.length - 1];
      w.proj.pop();
    }
  }
  for (let i = w.parts.length - 1; i >= 0; i--) {
    const p = w.parts[i];
    p.t += dt;
    if (p.k === 'p') { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 4 * dt; if (p.y < 0.1) p.y = 0.1; }
    else if (p.k === 'c') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 14 * dt;
      if (p.y < 0.3) { p.y = 0.3; p.vy = -p.vy * 0.45; }
    }
    if (p.t >= p.life) { w.parts[i] = w.parts[w.parts.length - 1]; w.parts.pop(); }
  }
  syncArmy(a, dt);
  for (const gr of w.groups) if (!gr.dead || gr.vn > 0) syncGroup(gr);
}

// ボスの種類ごとに違う攻撃演出
function bossPulse(w, a, g) {
  const kind = g.boss.kind, fx = BM.BOSS[kind].fx;
  w.shake = Math.max(w.shake, 0.7);
  hurtArmy(a, g.boss.hp * C.DPS_E * BOSS_DPS * 1.2);
  if (kind === 0) {            // 鬼将軍: 地面を叩いて衝撃波
    addRing(a.x, a.z + 2, fx, 6); addRing(a.x, a.z + 2, '#ffffff', 9);
    addPuff(a.x, a.z + 2, '#ffd0a0', 8);
  } else if (kind === 1) {     // 岩巨人: 岩が降ってくる
    for (let i = 0; i < 12 && w.parts.length < 260; i++) {
      w.parts.push({ k: 'p', x: a.x + (Math.random() - 0.5) * 8, y: 9 + Math.random() * 4, z: a.z + (Math.random() - 0.5) * 6,
        vx: 0, vy: -14, vz: 0, t: 0, life: 0.7, color: i & 1 ? '#8f939c' : '#b9a27a' });
    }
    addRing(a.x, a.z + 1, fx, 7);
  } else if (kind === 2) {     // 魔導士: 魔法弾を乱れ撃ち
    for (let i = 0; i < 5; i++) {
      w.proj.push({ k: 'orb', sx: g.x, sz: g.z + 1, tx: a.x + (Math.random() - 0.5) * 6, tz: a.z + (Math.random() - 0.5) * 3, t: 0, dur: 0.6 + i * 0.08, h: 5 });
    }
  } else if (kind === 3) {     // 炎の巨人: 炎の波
    for (let i = 0; i < 9; i++) addPuff(-5.2 + i * 1.3, a.z + 3 + Math.random() * 2, i & 1 ? '#ffb13a' : '#ff6a2a', 3);
    addRing(a.x, a.z + 2, fx, 8);
  } else {                     // 氷王: 吹雪
    for (let i = 0; i < 10; i++) addPuff(a.x + (Math.random() - 0.5) * 9, a.z + (Math.random() - 0.5) * 5, i & 1 ? '#ffffff' : '#bfeaff', 2);
    addRing(a.x, a.z + 2, fx, 7);
  }
  addText(a.x, 3.4, a.z, '!!', fx, 36, '#3a0a06');
}

// 兵種ごとの戦闘処理
function fight(w, a, g, dt) {
  const gap = g.z - a.z;
  const bossAlive = g.boss && g.boss.hp > 0;
  const ecount = Math.ceil(g.S / g.k) + (bossAlive ? 1 : 0);
  const aoe = clamp(1 + 0.035 * (ecount - 1), 1, 2);    // 魔法兵: 敵が多いほど大きな範囲効果
  const bossPhase = g.S <= 0.0001 && bossAlive;           // 取り巻きを倒した後はボス単体
  const per = atkM() * aspdM() * C.DPS_A;
  let dmg = 0;
  for (const t of TYPES) {
    const T = TYPE[t], n = a.n[T.idx];
    if (n > 0 && gap <= T.range + 0.01) dmg += n * T.atk * (T.aoe ? aoe : 1) * (bossPhase ? T.boss : 1);
  }
  dmg *= per * dt;
  w.fightT += dt;

  if (g.S > 0) { const k = Math.min(g.S, dmg); g.S -= k; dmg -= k; }
  if (dmg > 0 && bossAlive) {
    g.boss.hp = Math.max(0, g.boss.hp - dmg);
    g.boss.hurt = 0.3;
  }

  // 敵の反撃: 重装兵・剣士ほど前に出て被弾する。兵種ごとの体力差で減り方が変わる
  if (gap <= C.CONTACT + 0.6) {
    const bossHp = g.boss ? g.boss.hp : 0;
    const dE = (g.S * C.DPS_E + bossHp * C.DPS_E * BOSS_DPS) * dt;
    hurtArmy(a, dE);
    // 近接の火花
    w.acc.slash += dt * 22;
    while (w.acc.slash >= 1) {
      w.acc.slash -= 1;
      addSpark(a.x + (Math.random() - 0.5) * 5, 0.8 + Math.random(), a.z + C.CONTACT * (0.5 + Math.random() * 0.5), '#ffffff');
    }
  }

  // ボス固有の攻撃演出（ダメージも少し上乗せ）
  if (bossAlive && gap <= 30) {
    g.boss.pulseT -= dt;
    if (g.boss.pulseT <= 0) {
      g.boss.pulseT = 3.2;
      bossPulse(w, a, g);
    }
  }

  // 飛び道具: 弓兵=矢、魔法兵=魔法弾
  const vA = a.alloc[1], vM = a.alloc[3];
  if (a.n[1] >= 0.5 && gap <= TYPE.archer.range && vA > 0) w.acc.arrow += dt * Math.min(30, 6 + vA * 0.7) * Math.min(1.8, aspdM());
  if (a.n[3] >= 0.5 && gap <= TYPE.mage.range && vM > 0) w.acc.orb += dt * Math.min(10, 2 + vM * 0.35) * Math.min(1.8, aspdM());
  for (const kind of ['arrow', 'orb']) {
    const ty = kind === 'arrow' ? 1 : 3;
    while (w.acc[kind] >= 1) {
      w.acc[kind] -= 1;
      if (w.proj.length >= 110) continue;
      // 該当兵種のスロットからランダムに発射
      let i = -1;
      for (let tries = 0; tries < 12; tries++) {
        const j = Math.floor(Math.random() * a.vn);
        if (a.vt[j] === ty) { i = j; break; }
      }
      if (i < 0) continue;
      const sx = a.x + FX[i] * a.sp, sz = a.z + FZ[i] * a.sp;
      const tx = g.x + (Math.random() - 0.5) * g.cols * C.ESPX * 0.9;
      const tz = g.z + Math.random() * Math.max(1, Math.min(3, g.depth0));
      const dist = Math.max(2, tz - sz);
      w.proj.push({ k: kind, sx, sz, tx, tz, t: 0, dur: (kind === 'arrow' ? 0.35 : 0.5) + dist * 0.02, h: 2.2 + dist * 0.12 });
    }
  }

  // 撃破判定
  if (g.S <= 0.0001 && (!g.boss || g.boss.hp <= 0.0001)) {
    g.S = 0; g.dead = true;
    const run = G.run;
    run.kills += g.S0;
    S.stats.kills += g.S0;
    if (g.boss) { g.boss.hp = 0; run.bossKilled = true; S.stats.bossKills++; }
    for (let k = 0; k < (g.boss ? 26 : 14); k++) {
      addPuff(g.x + (Math.random() - 0.5) * 9, g.z + Math.random() * Math.max(2, g.depth0), k & 1 ? '#ff8a7a' : '#fff0a0', 2);
    }
    addText(g.x, 3, g.z, g.boss ? 'BOSS DOWN!' : 'DOWN!', '#ffffff', 34);
    if (g.boss) {
      w.shake = 1;
      addCoinBurst(g.x, g.z + 2, 22);
      addRing(g.x, g.z + 2, BM.BOSS[g.boss.kind].fx, 6);
      addRing(g.x, g.z + 2, '#ffffff', 9);
    }
    if (g.reward) {
      run.coinsRaw += g.reward.coins;
      addText(g.x, 4.4, g.z, '+' + Math.round(g.reward.coins * coinM()), '#ffe14a', 38);
      addCoinBurst(g.x, g.z + 1, 14);
    }
    w.proj.length = 0;
    BM.hooks.event(g.boss ? 'boss' : 'group', { stage: w.stage });
    if (g.reward && g.reward.pick) offerPick('reward');
  }
  if (total(a) <= 0.0001) {
    a.n.fill(0);
    G.state = 'dying'; w.dyingT = 0;
  }
}

// ===================================================================== 描画
const waterGrad = { h: 0, g: null, k: -1 };
function drawBackground() {
  const kind = G.world.bossKind || 0;
  if (!waterGrad.g || waterGrad.h !== H || waterGrad.k !== kind) {
    const th = BM.BOSS[kind];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    waterGrad.g = g; waterGrad.h = H; waterGrad.k = kind;
  }
  ctx.fillStyle = waterGrad.g;
  ctx.fillRect(0, 0, W, H);
  const t = G.world.t;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  const rip = BM.BOSS[kind].rip;
  for (let i = 0; i < 80; i++) {
    const side = (i & 1) ? 1 : -1;
    const wx = side * (7.6 + hash(i * 1.7) * 18);
    const base = hash(i * 3.3) * 160;
    const ahead = (((base - cam.z) % 160) + 160) % 160 - 4;
    if (ahead > C.VIEW_DIST) continue;
    const z = cam.z + ahead;
    if (!proj(wx, 0, z)) continue;
    const x1 = PX, y1 = PY;
    if (!proj(wx + 1.6, 0, z)) continue;
    ctx.globalAlpha = 0.22 + 0.18 * Math.sin(t * 2 + i);
    ctx.strokeStyle = rip;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(PX, PY); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function quad(x0, y0, x1, y1, x2, y2, x3, y3) {
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3);
  ctx.closePath();
}

function drawGround() {
  const R = C.ROAD_HALF, L = C.ROW_LEN;
  const z0 = cam.z - 4, z1 = cam.z + C.VIEW_DIST;
  if (!proj(-R, 0, z0)) return;
  const a0x = PX, a0y = PY;
  proj(R, 0, z0); const b0x = PX, b0y = PY;
  proj(R, 0, z1); const b1x = PX, b1y = PY;
  proj(-R, 0, z1); const a1x = PX, a1y = PY;
  ctx.fillStyle = '#d8c7a6';
  quad(a0x, a0y, b0x, b0y, b1x, b1y, a1x, a1y);
  ctx.fill();
  const r0 = Math.floor(z0 / L), r1 = Math.ceil(z1 / L);
  for (let r = r0; r < r1; r++) {
    const h = hash(r * 1.3);
    if (h < 0.35) continue;
    const za = r * L, zb = za + L;
    if (!proj(-R, 0, za)) continue; const p0x = PX, p0y = PY;
    if (!proj(R, 0, za)) continue; const p1x = PX, p1y = PY;
    if (!proj(R, 0, zb)) continue; const p2x = PX, p2y = PY;
    if (!proj(-R, 0, zb)) continue; const p3x = PX, p3y = PY;
    ctx.fillStyle = h < 0.7 ? 'rgba(255,248,230,0.22)' : 'rgba(150,115,70,0.10)';
    quad(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(130,105,72,0.38)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let r = r0; r < r1; r++) {
    const za = r * L, zb = za + L;
    if (!proj(-R, 0, za)) continue;
    ctx.moveTo(PX, PY);
    if (!proj(R, 0, za)) continue;
    ctx.lineTo(PX, PY);
    const off = (r & 1) ? 0.95 : 0;
    for (let x = -R + off + 1.9; x < R - 0.1; x += 1.9) {
      if (!proj(x, 0, za)) continue;
      ctx.moveTo(PX, PY);
      if (!proj(x, 0, zb)) continue;
      ctx.lineTo(PX, PY);
    }
  }
  ctx.stroke();
}

function drawWalls() {
  const R = C.ROAD_HALF, WW = C.WALL_W, WH = C.WALL_H;
  const z0 = cam.z - 4, z1 = cam.z + C.VIEW_DIST;
  for (let side = -1; side <= 1; side += 2) {
    const xi = side * R, xo = side * (R + WW);
    if (!proj(xi, 0, z0)) continue; const a0x = PX, a0y = PY;
    proj(xi, WH, z0); const t0x = PX, t0y = PY;
    proj(xi, WH, z1); const t1x = PX, t1y = PY;
    proj(xi, 0, z1); const a1x = PX, a1y = PY;
    ctx.fillStyle = '#b7a283';
    quad(a0x, a0y, t0x, t0y, t1x, t1y, a1x, a1y);
    ctx.fill();
    proj(xo, WH, z0); const o0x = PX, o0y = PY;
    proj(xo, WH, z1); const o1x = PX, o1y = PY;
    ctx.fillStyle = '#efe0c0';
    quad(t0x, t0y, o0x, o0y, o1x, o1y, t1x, t1y);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,88,60,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const r0 = Math.floor(z0 / C.ROW_LEN), r1 = Math.ceil(z1 / C.ROW_LEN);
    for (let r = r0; r <= r1; r++) {
      const z = r * C.ROW_LEN;
      if (!proj(xi, 0, z)) continue; ctx.moveTo(PX, PY);
      if (!proj(xi, WH, z)) continue; ctx.lineTo(PX, PY);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t0x, t0y); ctx.lineTo(t1x, t1y); ctx.stroke();
  }
}

function outlineText(str, x, y, size, fill, stroke, lw, font) {
  ctx.font = '900 ' + Math.round(size) + 'px ' + (font || FONT_NUM);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}
BM.outlineText = outlineText;

function pill(str, x, y, size, c1, c2) {
  const w = Math.max(size * 1.9, str.length * size * 0.66 + size * 0.9);
  const h = size * 1.35;
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  BM.rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  outlineText(str, x, y + size * 0.04, size, '#fff', 'rgba(0,0,0,0.45)', size * 0.16);
}

// ゲートの色
function gateColors(o) {
  if (BM.optBad(o)) return ['#ff7a6e', '#c42a22', '#7a120e'];
  if (o.t === 'mul') return ['#7ad0ff', '#2a73f0', '#ffd23f'];
  if (o.t === 'type') {
    const c = TYPE[o.ty].col;
    return ['#6fb8ff', '#2a66d8', c];
  }
  return ['#58b8ff', '#1f66dc', '#0f45a8'];
}

function drawGate(gt) {
  const h = 2.6;
  const nSide = gt.single ? 1 : 2;
  for (let side = 0; side < nSide; side++) {
    let xl, xr;
    if (gt.single) { const c = gt.lane === 0 ? -3.0 : 3.0; xl = c - 2.5; xr = c + 2.5; }
    else { xl = side === 0 ? -5.7 : 0.2; xr = side === 0 ? -0.2 : 5.7; }
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
    // 通過後は軍隊の後ろで薄くなって消える
    const behind = used ? clamp((G.world.army.z - gt.z) / 5, 0, 1) : 0;
    if (behind >= 1) continue;
    ctx.globalAlpha = (used && !chosen ? 0.45 : 1) * (1 - behind);
    ctx.fillStyle = '#7a7f8a';
    ctx.fillRect(X1 + wpx * 0.06, Yb - hpx * 0.06, wpx * 0.1, hpx * 0.1);
    ctx.fillRect(X2 - wpx * 0.16, Yb - hpx * 0.06, wpx * 0.1, hpx * 0.1);
    const col = gateColors(opt);
    const g = ctx.createLinearGradient(0, Yt, 0, Yb);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    BM.rrect(ctx, X1, Yt, wpx, hpx, Math.min(10, hpx * 0.18));
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.strokeStyle = col[2];
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    BM.rrect(ctx, X1 + wpx * 0.03, Yt + hpx * 0.06, wpx * 0.94, hpx * 0.28, hpx * 0.12);
    ctx.fill();
    const txt = BM.optText(opt);
    let size = Math.min(hpx * 0.78, wpx / (txt.length * 0.62 + 0.6));
    let tx = (X1 + X2) / 2;
    if (opt.t === 'type') {
      // 兵種アイコンを添える
      const spr = BM.art.spr[opt.ty];
      const ih = hpx * 0.78, iw = ih * 0.8;
      size = Math.min(hpx * 0.62, (wpx - iw * 1.1) / (txt.length * 0.62 + 0.6));
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(X1 + iw * 0.62, Yt + hpx * 0.54, ih * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(spr, X1 + iw * 0.12, Yt + hpx * 0.54 - ih * 0.5, iw, ih);
      tx = X1 + iw * 1.2 + (wpx - iw * 1.2) / 2;
    }
    outlineText(txt, tx, Yt + hpx * 0.54, size, '#fff', BM.optBad(opt) ? '#5a0d09' : '#0b3a8a', Math.max(3, size * 0.16));
    if (chosen && gt.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (gt.flash * 0.7).toFixed(3) + ')';
      BM.rrect(ctx, X1, Yt, wpx, hpx, Math.min(10, hpx * 0.18));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (!gt.single) {
    for (const [px, hh] of [[-5.85, h + 0.3], [0, h + 0.4], [5.85, h + 0.3]]) {
      if (!proj(px, 0, gt.z)) continue;
      const xa = PX, ya = PY, s = PS;
      proj(px, hh, gt.z);
      drawPost(xa, ya, PY, s);
    }
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

// 分岐ルート: 道の色分け・中央の仕切り壁・案内看板
function drawFork() {
  const w = G.world, fk = w.fork;
  if (!fk) return;
  const z0 = Math.max(fk.z, cam.z - 4), z1 = Math.min(fk.zEnd, cam.z + C.VIEW_DIST);
  if (z1 <= z0) return;
  const R = C.ROAD_HALF;
  for (let lane = 0; lane < 2; lane++) {
    const xa = lane === 0 ? -R + 0.05 : 0.45, xb = lane === 0 ? -0.45 : R - 0.05;
    if (!proj(xa, 0, z0)) continue; const p0x = PX, p0y = PY;
    if (!proj(xb, 0, z0)) continue; const p1x = PX, p1y = PY;
    if (!proj(xb, 0, z1)) continue; const p2x = PX, p2y = PY;
    if (!proj(xa, 0, z1)) continue; const p3x = PX, p3y = PY;
    ctx.fillStyle = BM.ROUTE[fk.routes[lane]].tint;
    quad(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y);
    ctx.fill();
  }
  // 仕切り壁
  const hw = 0.4, wh = 0.9;
  for (const xs of [-hw, hw]) {
    if (!proj(xs, 0, z0)) continue; const a0x = PX, a0y = PY;
    proj(xs, wh, z0); const b0x = PX, b0y = PY;
    proj(xs, wh, z1); const b1x = PX, b1y = PY;
    proj(xs, 0, z1); const a1x = PX, a1y = PY;
    ctx.fillStyle = xs < 0 ? '#b7a283' : '#a8936f';
    quad(a0x, a0y, b0x, b0y, b1x, b1y, a1x, a1y);
    ctx.fill();
  }
  if (proj(-hw, wh, z0)) {
    const t0x = PX, t0y = PY;
    proj(hw, wh, z0); const u0x = PX, u0y = PY;
    proj(hw, wh, z1); const u1x = PX, u1y = PY;
    proj(-hw, wh, z1); const t1x = PX, t1y = PY;
    ctx.fillStyle = '#efe0c0';
    quad(t0x, t0y, u0x, u0y, u1x, u1y, t1x, t1y);
    ctx.fill();
  }
  // 入口の柱
  if (fk.z >= cam.z && proj(-hw, 0, fk.z)) {
    const xa = PX, ya = PY, s2 = PS;
    proj(hw, 0, fk.z); const xb = PX;
    proj(-hw, 1.8, fk.z); const yt = PY;
    ctx.fillStyle = '#d3bf9b';
    ctx.fillRect(xa, yt, xb - xa, ya - yt);
    ctx.strokeStyle = 'rgba(110,88,60,0.6)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(xa, yt, xb - xa, ya - yt);
  }
}

function drawRouteSign(fk, lane) {
  const w = G.world;
  const kind = fk.routes[lane], Rt = BM.ROUTE[kind];
  const c = BM.laneX(lane), xl = c - 2.6, xr = c + 2.6, z = fk.z - 3;
  if (!proj(xl, 2.0, z)) return;
  const X1 = PX, Yb = PY, s = PS;
  proj(xr, 2.0, z); const X2 = PX;
  proj(xl, 4.6, z); const Yt = PY;
  const wpx = X2 - X1, hpx = Yb - Yt;
  if (wpx < 8) return;
  const dim = fk.chosen >= 0 && fk.chosen !== lane;
  ctx.globalAlpha = dim ? 0.4 : 1;
  // 脚
  ctx.fillStyle = '#7a7f8a';
  const pw = Math.max(3, s * 0.3);
  if (proj(xl + 0.25, 0, z)) { const yy = PY; ctx.fillRect(X1 + wpx * 0.06 - pw / 2, Yt + hpx, pw, yy - Yt - hpx); }
  if (proj(xr - 0.25, 0, z)) { const yy = PY; ctx.fillRect(X2 - wpx * 0.06 - pw / 2, Yt + hpx, pw, yy - Yt - hpx); }
  const g = ctx.createLinearGradient(0, Yt, 0, Yb);
  g.addColorStop(0, Rt.col2); g.addColorStop(1, Rt.col);
  BM.rrect(ctx, X1, Yt, wpx, hpx, Math.min(12, hpx * 0.16));
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(2.5, s * 0.1); ctx.strokeStyle = '#ffffff'; ctx.stroke();
  const nm = Math.min(hpx * 0.34, wpx / (Rt.name.length * 1.05));
  outlineText(Rt.name, (X1 + X2) / 2, Yt + hpx * 0.36, nm, '#fff', 'rgba(0,0,0,0.5)', Math.max(3, nm * 0.18), FONT_JP);
  const sb = Math.min(hpx * 0.2, wpx / (Rt.sub.length * 1.1));
  outlineText(Rt.sub, (X1 + X2) / 2, Yt + hpx * 0.74, sb, '#fffbe0', 'rgba(0,0,0,0.5)', Math.max(2, sb * 0.16), FONT_JP);
  ctx.globalAlpha = 1;
}

function drawCoinItem(c) {
  if (c.got) return;
  const t = G.world.t;
  const cxw = BM.laneX(c.lane);
  for (let k = -1; k <= 1; k++) {
    const bob = Math.sin(t * 4 + c.z + k) * 0.12;
    if (!proj(cxw + k * 1.3, 0.7 + bob, c.z)) continue;
    const r = PS * 0.42;
    ctx.fillStyle = 'rgba(40,30,10,0.25)';
    ctx.beginPath(); ctx.ellipse(PX, PY + r * 1.1 + bob * PS, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e59a00';
    ctx.beginPath(); ctx.arc(PX, PY, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd133';
    ctx.beginPath(); ctx.arc(PX, PY, r * 0.82, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(179,107,0,0.6)'; ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.beginPath(); ctx.arc(PX, PY, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(PX - r * 0.3, PY - r * 0.35, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
  }
}

// 強化選択のアーチ（金色）
function drawPickMarker(pk) {
  const R = C.ROAD_HALF;
  if (!proj(-R, 0, pk.z)) return;
  const x1 = PX, yb = PY, s = PS;
  proj(R, 0, pk.z); const x2 = PX;
  proj(-R, 3.6, pk.z); const yt = PY;
  const wpx = x2 - x1, hpx = yb - yt;
  const t = G.world.t;
  ctx.globalAlpha = pk.used ? 0.35 : 1;
  const pw = Math.max(4, s * 0.45);
  const gr = ctx.createLinearGradient(0, yt, 0, yb);
  gr.addColorStop(0, '#fff2a0'); gr.addColorStop(1, '#f0a000');
  ctx.fillStyle = gr;
  ctx.fillRect(x1 - pw / 2, yt, pw, hpx);
  ctx.fillRect(x2 - pw / 2, yt, pw, hpx);
  ctx.fillRect(x1 - pw / 2, yt - pw * 0.3, wpx + pw, pw * 1.3);
  if (!pk.used) {
    ctx.fillStyle = 'rgba(255,230,120,' + (0.16 + 0.1 * Math.sin(t * 5)).toFixed(3) + ')';
    ctx.fillRect(x1, yt, wpx, hpx);
  }
  const size = Math.min(hpx * 0.5, wpx * 0.12);
  outlineText('★ 強化 ★', (x1 + x2) / 2, yt + hpx * 0.28, size, '#fff7c0', '#9a5a00', Math.max(3, size * 0.2));
  ctx.globalAlpha = 1;
}

function drawGoal(z) {
  const hw = C.ROAD_HALF + C.WALL_W;
  const wallH = 6;
  if (!proj(-hw, 0, z)) return;
  const xl = PX, yb = PY;
  proj(hw, 0, z); const xr = PX;
  proj(-hw, wallH, z); const yt = PY;
  const wpx = xr - xl, hpx = yb - yt;
  ctx.fillStyle = '#d3bf9b';
  ctx.fillRect(xl, yt, wpx, hpx);
  ctx.fillStyle = 'rgba(110,88,60,0.35)';
  for (let k = 1; k < 6; k++) ctx.fillRect(xl, yt + hpx * k / 6, wpx, 1.4);
  ctx.fillStyle = '#bba482';
  ctx.fillRect(xl, yt - hpx * 0.22, wpx * 0.2, hpx * 1.22);
  ctx.fillRect(xr - wpx * 0.2, yt - hpx * 0.22, wpx * 0.2, hpx * 1.22);
  ctx.fillStyle = '#e6d4b0';
  const n = 9;
  for (let k = 0; k < n; k++) {
    if (k % 2) continue;
    ctx.fillRect(xl + wpx * k / n, yt - hpx * 0.12, wpx / n, hpx * 0.12);
  }
  const dw = wpx * 0.36, dh = hpx * 0.68;
  const dx = (xl + xr) / 2 - dw / 2, dy = yb - dh;
  ctx.fillStyle = '#8a5a2e';
  BM.rrect(ctx, dx, dy, dw, dh, dw * 0.35);
  ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#4a2f1c'; ctx.stroke();
  ctx.strokeStyle = 'rgba(40,20,5,0.45)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let k = 1; k < 5; k++) { ctx.moveTo(dx + dw * k / 5, dy + dh * 0.1); ctx.lineTo(dx + dw * k / 5, yb); }
  ctx.stroke();
  ctx.fillStyle = '#5b616d';
  ctx.fillRect(dx, dy + dh * 0.4, dw, dh * 0.07);
  ctx.fillRect(dx, dy + dh * 0.72, dw, dh * 0.07);
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
  const w = G.world, a = w.army;
  const n = a.vn;
  const g0 = curGroup(w);
  const moving = G.state === 'playing' && !(g0 && g0.active && g0.z - a.z <= reachRange(a) + 0.5);
  if (proj(a.x, 0, a.z)) {
    const rr = (Math.min(Math.sqrt(Math.max(n, 1)) * a.sp, 3.2) + 0.9) * PS;
    ctx.fillStyle = 'rgba(80,160,255,' + (0.16 + w.glow * 0.3).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(PX, PY - rr * 0.1, rr, rr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  }
  const bobSpd = moving ? 11 : 5;
  const spr = BM.art.spr;
  const names = ['sword', 'archer', 'heavy', 'mage'];
  for (let k = 0; k < a.order.length; k++) {
    const i = a.order[k];
    if (!proj(a.x + FX[i] * a.sp, 0, a.z + FZ[i] * a.sp)) continue;
    const ap = a.appear[i];
    const sc = ap < 1 ? (1 + 2.2 * Math.pow(ap - 1, 3) + 1.2 * Math.pow(ap - 1, 2)) * Math.min(1, ap * 3) : 1;
    const ty = a.vt[i];
    const ww = SCALE[ty] * PS * sc, hh = ww * 1.25;
    const bob = Math.abs(Math.sin(w.t * bobSpd + i * 1.7)) * 0.16 * PS * (moving ? 1 : 0.35);
    ctx.drawImage(spr[names[ty]], PX - ww / 2, PY - hh - bob + hh * 0.06, ww, hh);
  }
}

function drawGroup(g) {
  const w = G.world;
  const n = g.vn;
  if (g.dead && n === 0) return;
  const rows = Math.ceil(n / g.cols);
  const bossOff = Math.min(3.4, g.depth0 * 0.45) + 1.4;
  let bossDrawn = !(g.boss && g.boss.hp > 0);
  const moveBob = g.active && !g.dead && g.z - w.army.z > C.CONTACT + 0.3;
  const bobSpd = moveBob ? 12 : 4;
  const spr = g.elite ? BM.art.spr.elite : BM.art.spr.red;
  const es = g.elite ? 1.35 : 1.1;
  for (let r = rows - 1; r >= 0; r--) {
    const rz = r * C.ESPZ;
    if (!bossDrawn && rz <= bossOff) { drawBossAt(g); bossDrawn = true; }
    const rowN = Math.min(g.cols, n - r * g.cols);
    for (let c = 0; c < rowN; c++) {
      const i = r * g.cols + c;
      ePos(g, i, n);
      if (!proj(EX, 0, EZ)) continue;
      if (PY < -60 || PY > H + 80) continue;
      const ww = es * PS, hh = ww * 1.25;
      const bob = Math.abs(Math.sin(w.t * bobSpd + i * 2.3)) * 0.14 * PS * (moveBob ? 1 : 0.3);
      ctx.drawImage(spr, PX - ww / 2, PY - hh - bob + hh * 0.06, ww, hh);
    }
  }
  if (!bossDrawn) drawBossAt(g);
}
function drawBossAt(g) {
  const bossOff = Math.min(3.4, g.depth0 * 0.45) + 1.4;
  if (!proj(g.x, 0, g.z + bossOff)) return;
  const tier = BM.bossTier(G.world.stage);
  BM.drawBoss(ctx, g.boss.kind, PX, PY, (6.2 + Math.min(tier, 4) * 0.4) * PS, G.world.t, g.boss.hurt);
}

function projPoint(p, tt) {
  const x = lerp(p.sx, p.tx, tt), z = lerp(p.sz, p.tz, tt);
  const y = 0.9 + 4 * p.h * tt * (1 - tt);
  return proj(x, y, z);
}
function drawProj() {
  const w = G.world;
  ctx.lineCap = 'round';
  for (let i = 0; i < w.proj.length; i++) {
    const p = w.proj[i];
    const tt = p.t / p.dur;
    if (!projPoint(p, tt)) continue;
    const hx = PX, hy = PY, hs = PS;
    if (!projPoint(p, Math.max(0, tt - 0.32))) continue;
    const tx0 = PX, ty0 = PY;
    if (p.k === 'orb') {
      ctx.strokeStyle = 'rgba(190,140,255,0.5)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(hx, hy); ctx.stroke();
      const rr = Math.max(4, hs * 0.5);
      const gr = ctx.createRadialGradient(hx, hy, 0, hx, hy, rr * 1.8);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#d9a8ff'); gr.addColorStop(1, 'rgba(150,80,255,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(hx, hy, rr * 1.8, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    if (!projPoint(p, Math.max(0, tt - 0.09))) continue;
    const mx = PX, my = PY;
    ctx.strokeStyle = 'rgba(150,215,255,0.45)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = '#fff6d2'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawParts() {
  const w = G.world;
  for (let i = 0; i < w.parts.length; i++) {
    const p = w.parts[i];
    const f = p.t / p.life;
    if (p.k === 't') {
      if (!proj(p.x, p.y + p.t * 2.4, p.z)) continue;
      ctx.globalAlpha = clamp(1.6 - f * 1.6, 0, 1);
      const sc = 0.8 + Math.min(1, f * 6) * 0.3;
      outlineText(p.str, PX, PY, p.size * sc, p.color, p.stroke, p.size * 0.18);
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
    } else if (p.k === 'c') {
      if (!proj(p.x, p.y, p.z)) continue;
      const r = PS * 0.3;
      ctx.globalAlpha = clamp((1 - f) * 2, 0, 1);
      ctx.fillStyle = '#b36b00'; ctx.beginPath(); ctx.arc(PX, PY, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd133'; ctx.beginPath(); ctx.arc(PX, PY, r * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(PX - r * 0.25, PY - r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (p.k === 'r') {
      if (!proj(p.x, p.y, p.z)) continue;
      const rr = PS * p.r * (0.3 + f * 0.9);
      ctx.globalAlpha = (1 - f) * 0.9;
      ctx.strokeStyle = p.color; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.ellipse(PX, PY, rr, rr * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
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
  const w = G.world, a = w.army;
  for (let i = 0; i < w.groups.length; i++) {
    const g = w.groups[i];
    if (g.dead || g.skipped) continue;
    if (g.z - a.z > C.VIEW_DIST - 6) continue;
    const mid = g.z + g.depth0 * 0.45;
    if (!proj(g.x, 2.3, mid)) continue;
    const cnt = Math.max(0, Math.ceil(g.S / g.k - 1e-6));
    const size = clamp(PS * 0.62, 17, 30);
    if (cnt > 0) pill(BM.fmt(cnt), PX, PY, size, '#ff6a5e', '#c42a22');
    if (g.boss && g.boss.hp > 0) {
      const bw = Math.max(56, PS * 4.2), bh = Math.max(9, PS * 0.5);
      const by = PY + (cnt > 0 ? size * 1.3 : 0) + bh;
      BM.rrect(ctx, PX - bw / 2, by - bh / 2, bw, bh, bh / 2);
      ctx.fillStyle = 'rgba(20,10,10,0.7)'; ctx.fill();
      const fr = clamp(g.boss.hp / g.boss.max, 0, 1);
      if (fr > 0) {
        BM.rrect(ctx, PX - bw / 2 + 2, by - bh / 2 + 2, Math.max(bh - 4, (bw - 4) * fr), bh - 4, (bh - 4) / 2);
        ctx.fillStyle = '#ff4a3a'; ctx.fill();
      }
      outlineText(BM.BOSS[g.boss.kind].short + '  ' + BM.fmt(Math.ceil(g.boss.hp)), PX, by + bh * 1.35, clamp(PS * 0.42, 12, 20), '#fff', '#3a0a06', 4, FONT_JP);
    }
  }
  if (a.vn > 0 && G.state !== 'menu') {
    const top = Math.min(Math.sqrt(Math.max(a.vn, 1)) * a.sp, 3.2) * 0.8;
    if (proj(a.x, 2.2, a.z + top)) {
      const size = clamp(PS * 0.7, 18, 32);
      pill(BM.fmt(count(a)), PX, PY, size, '#4d9bff', '#1c56c9');
    }
  }
}

function render() {
  const w = G.world, a = w.army;
  cam.z = a.z - C.CAM_BACK;
  cam.x = a.x * 0.35;
  if (G.state === 'menu') cam.x = Math.sin(w.t * 0.5) * 0.6;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (w.shake > 0) ctx.translate((Math.random() - 0.5) * w.shake * 14, (Math.random() - 0.5) * w.shake * 14);
  drawBackground();
  drawGround();
  drawWalls();
  drawFork();
  const ents = [];
  for (const gt of w.gates) if (gt.z - cam.z < C.VIEW_DIST && gt.z - cam.z > -4) ents.push({ z: gt.z, k: 0, o: gt });
  for (const pk of w.picks) if (pk.z - cam.z < C.VIEW_DIST && pk.z - cam.z > -4) ents.push({ z: pk.z, k: 4, o: pk });
  for (const c of w.coins) if (!c.got && c.z - cam.z < C.VIEW_DIST && c.z - cam.z > -2) ents.push({ z: c.z, k: 6, o: c });
  if (w.fork && w.fork.z - 3 - cam.z < C.VIEW_DIST && w.fork.z - cam.z > -2) { ents.push({ z: w.fork.z - 3, k: 5, o: 0 }); ents.push({ z: w.fork.z - 3.01, k: 5, o: 1 }); }
  for (const g of w.groups) if (!g.dead && !g.skipped && g.z - cam.z < C.VIEW_DIST + 4) ents.push({ z: g.z, k: 1, o: g });
  ents.push({ z: a.z, k: 2, o: a });
  if (w.endZ - cam.z < C.VIEW_DIST + 4) ents.push({ z: w.endZ, k: 3, o: null });
  ents.sort((p, q) => q.z - p.z);
  for (const e of ents) {
    if (e.k === 0) drawGate(e.o);
    else if (e.k === 1) drawGroup(e.o);
    else if (e.k === 2) drawArmy();
    else if (e.k === 4) drawPickMarker(e.o);
    else if (e.k === 5) drawRouteSign(w.fork, e.o);
    else if (e.k === 6) drawCoinItem(e.o);
    else drawGoal(e.z);
  }
  drawProj();
  drawParts();
  drawLabels();
  if (w.intro) {
    const t = w.intro.t;
    const al = t < 0.25 ? t / 0.25 : (t > 2.0 ? Math.max(0, (2.4 - t) / 0.4) : 1);
    const th = BM.BOSS[w.intro.kind];
    ctx.globalAlpha = al * 0.92;
    const by = H * 0.22, bh = 96;
    const gr = ctx.createLinearGradient(0, by, 0, by + bh);
    gr.addColorStop(0, 'rgba(140,12,12,0)'); gr.addColorStop(0.2, 'rgba(140,12,12,0.9)'); gr.addColorStop(0.8, 'rgba(140,12,12,0.9)'); gr.addColorStop(1, 'rgba(140,12,12,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, by, W, bh);
    ctx.globalAlpha = al;
    const off = (1 - Math.min(1, t / 0.35)) * W * 0.5;
    outlineText('⚠ BOSS 登場 ⚠', W / 2 - off, by + 30, 20, '#ffe14a', '#4a0a06', 5, FONT_JP);
    outlineText(th.name, W / 2 + off, by + 64, Math.min(32, W / (th.name.length * 1.05)), '#ffffff', '#4a0a06', 6, FONT_JP);
    ctx.globalAlpha = 1;
  }
}

// ===================================================================== 入力
let dragging = false, dragStartX = 0, dragStartTx = 0;
function onDown(e) {
  if (G.state !== 'ready' && G.state !== 'playing') return;
  dragging = true;
  dragStartX = e.clientX;
  dragStartTx = G.world.army.tx;
  G.world.hintOn = false;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  e.preventDefault();
}
function onMove(e) {
  if (!dragging) return;
  const a = G.world.army;
  a.tx = clamp(dragStartTx + (e.clientX - dragStartX) / pxPerUnit, -a.lim, a.lim);
  e.preventDefault();
}
function onUp() { dragging = false; }

// ===================================================================== ループ
let last = 0;
G.step = function (dt) {
  update(dt);
  render();
};
G.frame = function (ts) {
  requestAnimationFrame(G.frame);
  let dt = (ts - last) / 1000;
  last = ts;
  if (!(dt > 0)) dt = 0.016;
  if (G.state === 'picking' || G.paused) { render(); return; }
  G.step(Math.min(0.05, dt));
  BM.hooks.frame && BM.hooks.frame();
};

G.init = function (c, st) {
  canvas = c; stageEl = st;
  ctx = canvas.getContext('2d');
  BM.art.make();
  resize();
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
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => { resize(); setTimeout(resize, 250); });
  G.preview(S.stage);
  requestAnimationFrame(G.frame);
};
G.resize = resize;
G.addText = addText;
})(window.BM = window.BM || {});
