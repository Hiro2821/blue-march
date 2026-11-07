/* ステージ生成: ゲート・強化マーカー・敵軍・ボスを配置する */
(function (BM) {
'use strict';
const C = BM.C, nice = BM.nice;

BM.allyVis = (n) => (n <= 40 ? n : Math.min(C.MAXV, Math.round(40 + (n - 40) * 0.35)));
BM.enemyVis = (n) => (n <= 60 ? n : Math.min(C.MAXE, Math.round(60 + (n - 60) * 0.35)));

// ===================================================================== パネル(ゲート)の種類
// t: add(+N) sub(−N) mul(×N) div(÷N) type(兵種追加) conv(兵種変更) enemy(敵追加%) buff(強化) invul(無敵)
// o.risk = { enemy: % } : 魅力的だが、次の敵部隊が増えるリスク付き
const BUFFS = {
  atk:  { name: '攻撃',   v: 0.15, ic: '⚔️' },
  hp:   { name: '体力',   v: 0.20, ic: '🛡️' },
  aspd: { name: '速度',   v: 0.15, ic: '⚡' },
  coin: { name: 'コイン', v: 0.25, ic: '🪙' },
};
BM.BUFFS = BUFFS;
BM.INVUL_SEC = 6;

// パネルに載せる数は +10 +20 +30 +50 +100 ... のキリのいい値だけ
const PAL = [];
for (let k = 1; k <= 6; k++) for (const b of [1, 2, 3, 5]) PAL.push(b * Math.pow(10, k));
BM.pal = (v) => {
  const lv = Math.log(Math.max(v, 1));
  let best = PAL[0], bd = 1e9;
  for (const p of PAL) { const d = Math.abs(Math.log(p) - lv); if (d < bd) { bd = d; best = p; } }
  return best;
};
const palUp = (v) => { for (const p of PAL) if (p > v) return p; return PAL[PAL.length - 1]; };

BM.optText = (o) => {
  switch (o.t) {
    case 'add': case 'type': return '+' + BM.fmt(o.v);
    case 'sub': return '−' + BM.fmt(o.v);
    case 'div': return '÷' + o.v;
    case 'conv': return '→' + BM.TYPE[o.ty].name;
    case 'enemy': return '敵+' + o.v + '%';
    case 'buff': return BUFFS[o.key].name + '+' + Math.round(o.v * 100) + '%';
    case 'invul': return '無敵';
    default: return '×' + (o.v < 1 ? String(o.v) : BM.fmt(o.v));
  }
};
// パネル下部の補足(小さな文字)
BM.optSub = (o) => {
  if (o.risk && o.risk.enemy) return '⚠ 敵+' + o.risk.enemy + '%';
  switch (o.t) {
    case 'type': return BM.TYPE[o.ty].name + 'が加わる';
    case 'conv': return '半数が' + BM.TYPE[o.ty].name + 'に';
    case 'enemy': return '次の敵が増える';
    case 'buff': return 'このステージ中ずっと';
    case 'invul': return BM.INVUL_SEC + '秒間 ダメージ無効';
    default: return '';
  }
};
// 色分け: good(青) bad(赤) special(紫) / risk は見た目は魅力的だが警告つき
BM.optBad = (o) => o.t === 'sub' || o.t === 'div' || o.t === 'enemy' || (o.t === 'mul' && o.v < 1);
BM.optSpecial = (o) => o.t === 'buff' || o.t === 'invul' || o.t === 'conv';
// 数値上の価値（設計・ボット用）: n 人のときにこのパネルを通った後の「実質兵数」
BM.optValue = (o, n) => {
  let x;
  switch (o.t) {
    case 'add': x = n + o.v; break;
    case 'type': x = n + o.v * 1.12; break;
    case 'sub': x = Math.max(1, n - o.v); break;
    case 'div': x = Math.max(1, n / o.v); break;
    case 'conv': x = n * 1.05; break;
    case 'enemy': x = n / (1 + o.v / 100); break;
    case 'buff': x = n * (o.key === 'coin' ? 1.02 : Math.sqrt(1 + o.v)); break;
    case 'invul': x = n * 1.1; break;
    default: x = Math.max(1, n * o.v);
  }
  if (o.risk && o.risk.enemy) x /= 1 + o.risk.enemy / 100;
  return x;
};
BM.optApplyNum = BM.optValue;

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

// ---- 1段のゲート（左右2択）を作る。戻り値: {opts:[a,b], next: 最良ルートでの人数, pat}
const PATS = [
  // [id, 重み, 登場ステージ]
  ['addadd', 30, 1], ['addmul', 22, 1],
  ['addsub', 14, 2], ['buff', 16, 2], ['type', 18, 1],
  ['mulsub', 10, 3], ['adddiv', 10, 3], ['invul', 9, 3],
  ['greed', 16, 4], ['conv', 9, 4],
  ['enemyvs', 10, 5], ['greedmul', 12, 6],
];
function makeRow(A, stage, rnd, avail, recent) {
  const pats = [];
  for (const [id, w, from] of PATS) {
    if (stage < from) continue;
    if ((id === 'type' || id === 'conv') && !avail.length) continue;
    let ww = w;
    if (recent.includes(id)) ww *= recent[recent.length - 1] === id ? 0.1 : 0.4;   // 同じ組み合わせが続かないように
    if (stage >= 8 && (id === 'greed' || id === 'greedmul' || id === 'enemyvs')) ww *= 1.4;
    pats.push([id, ww]);
  }
  let tot = 0; for (const p of pats) tot += p[1];
  let r = rnd() * tot, pat = pats[0][0];
  for (const p of pats) { if (r < p[1]) { pat = p[0]; break; } r -= p[1]; }

  const add = (v) => ({ t: 'add', v: Math.max(10, v) });
  const goodAdd = (f) => add(BM.pal(A * f));
  // 引かれると壊滅するほど大きい −N は ÷2 に置き換える
  const subOrDiv = (f) => {
    const v = BM.pal(A * f);
    return (A >= 40 && v <= A * 0.6) ? { t: 'sub', v } : { t: 'div', v: 2 };
  };
  const addPair = (fh, fl) => {
    let h = BM.pal(A * fh); const l = BM.pal(A * fl);
    if (l >= h) h = palUp(l);
    return [add(h), add(l)];
  };
  let o0, o1;
  switch (pat) {
    case 'addmul': {
      const m = (stage >= 6 && rnd() < 0.3) ? 3 : 2;
      o0 = { t: 'mul', v: m };
      o1 = goodAdd((m - 1) * (0.6 + rnd() * 0.7));
      break;
    }
    case 'addsub':
      o0 = goodAdd(0.3 + rnd() * 0.3);
      o1 = subOrDiv(0.1 + rnd() * 0.2);
      break;
    case 'mulsub':
      o0 = { t: 'mul', v: (stage >= 6 && rnd() < 0.3) ? 3 : 2 };
      o1 = subOrDiv(0.15 + rnd() * 0.15);
      break;
    case 'adddiv':
      o0 = goodAdd(0.4 + rnd() * 0.3);
      o1 = rnd() < 0.5 ? { t: 'div', v: 2 } : { t: 'mul', v: 0.5 };
      break;
    case 'type': {
      const ty = avail[Math.floor(rnd() * avail.length)];
      o0 = { t: 'type', ty, v: BM.pal(A * (0.3 + rnd() * 0.2)) };
      o1 = goodAdd(0.2 + rnd() * 0.15);
      break;
    }
    case 'conv': {
      const ty = avail[Math.floor(rnd() * avail.length)];
      o0 = { t: 'conv', ty, v: 0.5 };
      o1 = goodAdd(0.2 + rnd() * 0.15);
      break;
    }
    case 'buff': {
      const keys = ['atk', 'hp', 'aspd', 'atk', 'hp', 'coin'];
      const key = keys[Math.floor(rnd() * keys.length)];
      o0 = { t: 'buff', key, v: BUFFS[key].v };
      o1 = rnd() < 0.25 ? subOrDiv(0.1 + rnd() * 0.15) : goodAdd(0.25 + rnd() * 0.2);
      break;
    }
    case 'invul':
      o0 = { t: 'invul', v: BM.INVUL_SEC };
      o1 = goodAdd(0.3 + rnd() * 0.2);
      break;
    case 'enemyvs':           // どちらもイヤな選択: 敵が増える / 兵士が減る
      o0 = { t: 'enemy', v: [20, 30, 40][Math.floor(rnd() * 3)] };
      o1 = subOrDiv(0.15 + rnd() * 0.15);
      break;
    case 'greed': {           // 大量の兵士が手に入るが、敵も増える（罠のときも当たりのときもある）
      const lo = goodAdd(0.25 + rnd() * 0.2);
      const p = [30, 40, 50][Math.floor(rnd() * 3)];
      const target = (A + lo.v) * (0.85 + rnd() * 0.3) * (1 + p / 100);
      let v = BM.pal(Math.max(10, target - A));
      if (v <= lo.v) v = palUp(lo.v);
      o0 = { t: 'add', v, risk: { enemy: p } };
      o1 = lo;
      break;
    }
    case 'greedmul': {
      const lo = goodAdd(0.35 + rnd() * 0.25);
      const p = [40, 50, 60][Math.floor(rnd() * 3)];
      o0 = { t: 'mul', v: 3, risk: { enemy: p } };
      o1 = lo;
      break;
    }
    default: {
      const pr = addPair(0.45 + rnd() * 0.3, 0.1 + rnd() * 0.15);
      o0 = pr[0]; o1 = pr[1];
    }
  }
  const next = Math.max(BM.optValue(o0, A), BM.optValue(o1, A));
  return { opts: rnd() < 0.5 ? [o0, o1] : [o1, o0], next, pat };
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
      const v1 = BM.pal(A * 0.3);
      const v2 = BM.pal((A + v1) * 0.25);
      for (const [dz, v] of [[9, v1], [21, v2]]) {
        gates.push({ z: zf + dz, opts: [{ t: 'add', v }], lane, single: true, used: false, side: 0, flash: 0, skipped: false });
      }
      est = A + v1 + v2;
    } else if (kind === 'coin') {
      const v = 10 + 3 * stage;
      for (let k = 0; k < 6; k++) coins.push({ z: zf + 6 + k * 5, lane, v, got: false });
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

// 間隔(ワールド単位): 以前の約75%に詰めた
const GAP = 12;        // 通常のパネル間隔（旧16）
const CHAIN_GAP = 8;   // 連続パネル（続けて判断させる）
BM.GEN = { GAP, CHAIN_GAP };

BM.genStage = function (stage, seed) {
  const S = BM.S;
  const rnd = BM.rng(seed);
  const rows = Math.min(4 + stage, 11);          // 区切りの数（連続パネルは別に追加される）
  const mids = Math.min(Math.floor((stage + 1) / 3), 3);
  const midAfter = new Set();
  for (let k = 1; k <= mids; k++) midAfter.add(Math.min(rows - 1, Math.floor(k * rows / (mids + 1))));
  const nPick = stage < 3 ? 1 : (stage < 10 ? 2 : 3);
  const pickAfter = new Set();
  for (let p = 1; p <= nPick; p++) pickAfter.add(Math.max(1, Math.min(rows - 1, Math.round(rows * p / (nPick + 1)))));
  const avail = BM.TYPES.filter((t) => t !== 'sword' && S.unlock[t]);
  const chainP = stage < 2 ? 0.2 : Math.min(0.55, 0.3 + 0.03 * stage);

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
  const recent = [];
  let z = 20, lastGateZ = z;
  const pushRow = (zz) => {
    const row = makeRow(A, stage, rnd, avail, recent);
    recent.push(row.pat); if (recent.length > 3) recent.shift();
    gates.push({ z: zz, opts: row.opts, lane: -1, single: false, used: false, side: -1, flash: 0, skipped: false });
    A = row.next;
    lastGateZ = zz;
  };
  for (let i = 1; i <= rows; i++) {
    pushRow(z);
    z += GAP;
    // 連続パネル: 次のパネルがすぐ来るので、続けて判断することになる
    const canChain = !midAfter.has(i) && i !== forkAfter && i < rows;
    if (canChain && rnd() < chainP) {
      z = lastGateZ + CHAIN_GAP;
      pushRow(z);
      z = lastGateZ + GAP;
    }
    if (pickAfter.has(i)) picks.push({ z: lastGateZ + 6, used: false, kind: 'stage' });
    if (midAfter.has(i)) {
      const gz = lastGateZ + 26;
      const r = 0.45 * BM.finalRatio(stage);
      const E = Math.max(4, Math.round(A * r));
      const g = makeGroup(gz, E, rnd);
      groups.push(g);
      A = Math.sqrt(Math.max(1, A * A - (C.DPS_E / C.DPS_A) * E * E));
      z = gz + g.depth0 + 8;
    }
    if (i === forkAfter) {
      const zf = lastGateZ + 17, L = 34;
      const r = buildFork(zf, L, A, stage, rnd, gates, groups, coins);
      fork = r.fork;
      A = r.next;
      z = zf + L + 10;
    }
  }
  // 最後はボス + 取り巻き。ボスのすぐ後ろにゴール
  const fz = lastGateZ + 26;
  groups.sort((p, q) => p.z - q.z);
  const E = Math.max(8, Math.round(A * BM.finalRatio(stage)));
  const esc = Math.round(E * 0.4);
  const kind = BM.bossKind(stage);
  const fg = makeGroup(fz, esc, rnd, { bossHP: E - esc, kind });
  groups.push(fg);
  return {
    gates, groups, picks, coins, fork, endZ: fz + fg.depth0 + 6,
    bossKind: kind, designA: A, bossE: E,
  };
};
})(window.BM = window.BM || {});
