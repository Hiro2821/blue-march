/* ステージ生成: ゲート・強化マーカー・敵軍・ボスを配置する */
(function (BM) {
'use strict';
const C = BM.C, nice = BM.nice;

BM.allyVis = (n) => (n <= 40 ? n : Math.min(C.MAXV, Math.round(40 + (n - 40) * 0.35)));
BM.enemyVis = (n) => (n <= 60 ? n : Math.min(C.MAXE, Math.round(60 + (n - 60) * 0.35)));

// ゲート効果の表示用文字列・判定
BM.optText = (o) => {
  if (o.t === 'add' || o.t === 'type') return '+' + BM.fmt(o.v);
  if (o.t === 'sub') return '−' + BM.fmt(o.v);
  return '×' + (o.v < 1 ? String(o.v) : BM.fmt(o.v));
};
BM.optBad = (o) => o.t === 'sub' || (o.t === 'mul' && o.v < 1);
BM.optApplyNum = (o, n) => {          // 数だけで見たときの結果（設計・ボット用）
  if (o.t === 'add' || o.t === 'type') return n + o.v;
  if (o.t === 'sub') return Math.max(1, n - o.v);
  return Math.max(1, n * o.v);
};

function makeGroup(z, Sv, rnd, o) {
  o = o || {};
  const k = o.k || 1, cols = o.cols || C.ECOLS;
  const vn = BM.enemyVis(Math.ceil(Sv / k));
  return {
    z, x: o.x || 0, S: Sv, S0: Sv, k, cols, vn,
    boss: o.bossHP > 0 ? { hp: o.bossHP, max: o.bossHP, hurt: 0, kind: o.kind || 0, pulseT: 1.5 } : null,
    active: false, dead: false, skipped: false,
    lane: o.lane === undefined ? -1 : o.lane,
    elite: !!o.elite, reward: o.reward || null,
    seed: Math.floor(rnd() * 1000),
    depth0: (Math.ceil(vn / cols) - 1) * C.ESPZ,
  };
}
BM.makeGroup = makeGroup;

// ---- 1段のゲート（左右2択）を作る。戻り値: {opts:[a,b], next: 最良ルートでの人数}
function makeRow(A, stage, rnd, avail) {
  const pats = [['addadd', 28]];
  if (stage >= 2) pats.push(['addmul', 22], ['addsub', 14]);
  if (stage >= 3) pats.push(['mulsub', 10], ['adddiv', 8]);
  if (avail.length) pats.push(['type', 20]);
  let tot = 0; for (const p of pats) tot += p[1];
  let r = rnd() * tot, pat = pats[0][0];
  for (const p of pats) { if (r < p[1]) { pat = p[0]; break; } r -= p[1]; }

  const add = (f) => ({ t: 'add', v: nice(A * f) });
  let o0, o1;
  switch (pat) {
    case 'addmul': {
      const m = (stage >= 8 && rnd() < 0.3) ? 3 : 2;
      o0 = { t: 'mul', v: m };
      o1 = { t: 'add', v: nice(A * (m - 1) * (0.7 + rnd() * 0.6)) };
      break;
    }
    case 'addsub':
      o0 = add(0.3 + rnd() * 0.3);
      o1 = { t: 'sub', v: nice(A * (0.1 + rnd() * 0.2)) };
      break;
    case 'mulsub':
      o0 = { t: 'mul', v: (stage >= 6 && rnd() < 0.3) ? 3 : 2 };
      o1 = { t: 'sub', v: nice(A * (0.15 + rnd() * 0.15)) };
      break;
    case 'adddiv':
      o0 = add(0.4 + rnd() * 0.3);
      o1 = { t: 'mul', v: 0.5 };
      break;
    case 'type': {
      const ty = avail[Math.floor(rnd() * avail.length)];
      o0 = { t: 'type', ty, v: nice(A * (0.3 + rnd() * 0.2)) };
      o1 = add(0.25 + rnd() * 0.15);
      break;
    }
    default: {
      o0 = add(0.35 + rnd() * 0.25);
      o1 = add(0.08 + rnd() * 0.17);
      if (o1.v >= o0.v) o1.v = Math.max(1, o0.v - 1);
    }
  }
  const next = Math.max(BM.optApplyNum(o0, A), BM.optApplyNum(o1, A));
  return { opts: rnd() < 0.5 ? [o0, o1] : [o1, o0], next };
}

// 難易度: 最後に待つ敵の強さ（最良ルートで進んだ場合の兵数に対する比率）
BM.finalRatio = (stage) => (stage <= 4 ? 0.7 + 0.12 * stage : 1.18 * Math.pow(1.13, stage - 4));


// ---- 分岐ルート: 左右の道で得られるものが違う
BM.ROUTE = {
  army:  { name: '兵士ルート',   sub: '兵士がぐんぐん増える', col: '#2f7df0', col2: '#58b8ff', tint: 'rgba(60,140,255,0.20)' },
  coin:  { name: 'コインルート', sub: 'コインがたくさん',     col: '#e29a00', col2: '#ffd23f', tint: 'rgba(255,200,40,0.22)' },
  elite: { name: '強敵ルート',   sub: '倒すと強化＋コイン',   col: '#c42a22', col2: '#ff7a6e', tint: 'rgba(255,70,50,0.18)' },
};
const LANE_X = 3.05;
BM.laneX = (lane) => (lane === 0 ? -LANE_X : LANE_X);

function buildFork(zf, L, A, stage, rnd, gates, groups, coins) {
  const kinds = stage >= 3 ? ['army', 'coin', 'elite'] : ['army', 'coin'];
  const a = kinds.splice(Math.floor(rnd() * kinds.length), 1)[0];
  const b = kinds[Math.floor(rnd() * kinds.length)];
  const routes = rnd() < 0.5 ? [a, b] : [b, a];
  let best = 0;
  routes.forEach((kind, lane) => {
    let est = A;
    if (kind === 'army') {
      const v1 = nice(A * 0.3);
      const v2 = nice((A + v1) * 0.25);
      for (const [dz, v] of [[12, v1], [28, v2]]) {
        gates.push({ z: zf + dz, opts: [{ t: 'add', v }], lane, single: true, used: false, side: 0, flash: 0, skipped: false });
      }
      est = A + v1 + v2;
    } else if (kind === 'coin') {
      const v = 10 + 3 * stage;
      for (let k = 0; k < 6; k++) coins.push({ z: zf + 8 + k * 6, lane, v, got: false });
    } else {
      const nE = Math.max(3, Math.round(A * 0.25));
      const g = makeGroup(zf + 24, nE * 3, rnd, { k: 3, cols: 6, x: BM.laneX(lane), lane, elite: true, reward: { coins: 80 + 25 * stage, pick: true } });
      groups.push(g);
      est = Math.sqrt(Math.max(1, A * A - (C.DPS_E / C.DPS_A) * g.S * g.S));
    }
    best = Math.max(best, est);
  });
  return { fork: { z: zf, zEnd: zf + L, routes, chosen: -1 }, next: best };
}

BM.genStage = function (stage, seed) {
  const S = BM.S;
  const rnd = BM.rng(seed);
  const rows = Math.min(4 + stage, 12);
  const mids = Math.min(Math.floor((stage + 1) / 3), 3);
  const midAfter = new Set();
  for (let k = 1; k <= mids; k++) midAfter.add(Math.min(rows - 1, Math.floor(k * rows / (mids + 1))));
  const nPick = stage < 3 ? 1 : (stage < 10 ? 2 : 3);
  const pickAfter = new Set();
  for (let p = 1; p <= nPick; p++) pickAfter.add(Math.max(1, Math.min(rows - 1, Math.round(rows * p / (nPick + 1)))));
  const avail = BM.TYPES.filter((t) => t !== 'sword' && S.unlock[t]);

  // 分岐は2面目から。敵の中間部隊とは別の段に置く
  let forkAfter = -1;
  if (stage >= 2) {
    let bd = 99;
    for (let i = 2; i < rows; i++) {
      if (midAfter.has(i)) continue;
      const d = Math.abs(i - rows * 0.5);
      if (d < bd) { bd = d; forkAfter = i; }
    }
  }

  let A = 10;
  let fork = null;
  const gates = [], groups = [], picks = [], coins = [];
  let z = 24, lastGateZ = z;
  for (let i = 1; i <= rows; i++) {
    const row = makeRow(A, stage, rnd, avail);
    gates.push({ z, opts: row.opts, lane: -1, single: false, used: false, side: -1, flash: 0, skipped: false });
    lastGateZ = z;
    A = row.next;
    z += 16;
    if (pickAfter.has(i)) picks.push({ z: lastGateZ + 8, used: false, kind: 'stage' });
    if (midAfter.has(i)) {
      const gz = lastGateZ + 32;
      const r = 0.45 * BM.finalRatio(stage);
      const E = Math.max(4, Math.round(A * r));
      const g = makeGroup(gz, E, rnd);
      groups.push(g);
      A = Math.sqrt(Math.max(1, A * A - (C.DPS_E / C.DPS_A) * E * E));
      z = gz + g.depth0 + 10;
    }
    if (i === forkAfter) {
      const zf = lastGateZ + 22, L = 42;
      const r = buildFork(zf, L, A, stage, rnd, gates, groups, coins);
      fork = r.fork;
      A = r.next;
      z = zf + L + 14;
    }
  }
  // 最後はボス + 取り巻き
  const fz = lastGateZ + 32;
  groups.sort((p, q) => p.z - q.z);
  const E = Math.max(8, Math.round(A * BM.finalRatio(stage)));
  const esc = Math.round(E * 0.45);
  const kind = BM.bossKind(stage);
  const fg = makeGroup(fz, esc, rnd, { bossHP: E - esc, kind });
  groups.push(fg);
  return {
    gates, groups, picks, coins, fork, endZ: fz + fg.depth0 + 14,
    bossKind: kind, designA: A, bossE: E,
  };
};
})(window.BM = window.BM || {});
