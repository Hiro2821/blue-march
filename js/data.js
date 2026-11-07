/* データ定義: 定数・兵種・強化・便利関数 */
(function (BM) {
'use strict';

BM.C = {
  ROAD_HALF: 6, WALL_W: 0.9, WALL_H: 0.9,
  CAM_H: 12, CAM_BACK: 8.5, VIEW_DIST: 80, ROW_LEN: 1.6,
  SPEED: 11,        // 進軍速度
  CONTACT: 5,       // 敵が接近して止まる距離
  MELEE: 6.5,       // 近接兵が攻撃を始める距離
  AGGRO: 34,        // 敵が動き出す距離
  CHARGE: 7,        // 敵の突撃速度
  DPS_A: 0.13,      // 味方1人あたり毎秒ダメージ(基準)
  DPS_E: 0.075,       // 敵1体あたり毎秒ダメージ
  MAXV: 150, MAXE: 320,       // 画面に描く兵士の最大数(実人数とは別管理)
  ESPX: 0.82, ESPZ: 0.62, ECOLS: 13,
};

// ---------------------------------------------------------------- 兵種
BM.TYPES = ['sword', 'archer', 'heavy', 'mage'];
BM.TYPE = {
  sword: {
    id: 'sword', idx: 0, name: '剣士', tag: 'バランス型',
    desc: '攻撃・体力ともに標準的。ボスなど大型の敵に特に強い。',
    atk: 1.0, hp: 1.0, range: 6.5, w: 1.5, boss: 1.3, cost: 0, col: '#4d9bff',
  },
  archer: {
    id: 'archer', idx: 1, name: '弓兵', tag: '遠距離型',
    desc: '遠くから矢を放ち、敵が近づく前に削れる。体力は低め。',
    atk: 1.05, hp: 0.55, range: 30, w: 0.8, boss: 1.0, cost: 150, col: '#3fcf8e',
  },
  heavy: {
    id: 'heavy', idx: 2, name: '重装兵', tag: '耐久型',
    desc: '分厚い鎧で敵の攻撃を引き受ける。攻撃力は控えめ。',
    atk: 0.5, hp: 2.6, range: 6.5, w: 2.0, boss: 1.1, cost: 350, col: '#9fb2c8',
  },
  mage: {
    id: 'mage', idx: 3, name: '魔法兵', tag: '範囲攻撃型',
    desc: '範囲魔法で複数の敵をまとめて攻撃。敵が多いほど強いが、ボス単体には弱い。',
    atk: 0.75, hp: 0.7, range: 20, w: 0.9, boss: 0.8, aoe: true, cost: 700, col: '#b07bff',
  },
};

// ---------------------------------------------------------------- 強化選択（ステージ中）
BM.PICKS = [
  { id: 'atk',   name: '攻撃力アップ',   icon: '⚔️', desc: '全兵士の攻撃力 +20%',  key: 'atk',  v: 0.20 },
  { id: 'hp',    name: '兵士の体力アップ', icon: '🛡️', desc: '全兵士の体力 +25%',    key: 'hp',   v: 0.25 },
  { id: 'aspd',  name: '攻撃速度アップ',  icon: '⚡', desc: '攻撃の速さ +20%',      key: 'aspd', v: 0.20 },
  { id: 'army',  name: '兵士数の追加',   icon: '👥', desc: '今すぐ兵士が約20%増える（最低+5）' },
  { id: 'coin',  name: 'コイン獲得量アップ', icon: '🪙', desc: 'このステージのコイン +30%', key: 'coin', v: 0.30 },
  { id: 'move',  name: '移動速度アップ',  icon: '👟', desc: '進軍スピード +20%',    key: 'move', v: 0.20 },
];

// ---------------------------------------------------------------- 便利関数
const NICE = [];
for (let k = 0; k <= 6; k++) {
  for (const b of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
    const v = Math.round(b * Math.pow(10, k));
    if (!NICE.length || NICE[NICE.length - 1] !== v) NICE.push(v);
  }
}
// ゲートに載せる「キリのいい数」に丸める
BM.nice = function (v) {
  if (v <= 1) return 1;
  const lv = Math.log(v);
  let best = NICE[0], bd = 1e9;
  for (let i = 0; i < NICE.length; i++) {
    const d = Math.abs(Math.log(NICE[i]) - lv);
    if (d < bd) { bd = d; best = NICE[i]; }
  }
  return best;
};

BM.fmt = function (n) {
  n = Math.floor(n);
  if (n < 10000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'K';
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace(/\.?0+$/, '') + 'M';
  return (n / 1e9).toFixed(1) + 'B';
};

BM.clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
BM.lerp = (a, b, t) => a + (b - a) * t;
BM.hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
BM.rng = function (a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 合計 n を重み w に従って整数で配分する（最大剰余法）
BM.split = function (n, w) {
  const tot = w.reduce((s, x) => s + x, 0);
  const out = w.map(() => 0);
  if (tot <= 0 || n <= 0) return out;
  const fr = [];
  let used = 0;
  for (let i = 0; i < w.length; i++) {
    const v = n * w[i] / tot;
    out[i] = Math.floor(v);
    fr.push([v - out[i], i]);
    used += out[i];
  }
  fr.sort((p, q) => q[0] - p[0]);
  for (let k = 0; k < n - used; k++) out[fr[k % fr.length][1]]++;
  return out;
};

BM.hooks = {
  pick() {}, clear() {}, over() {}, toast() {}, event() {},
};
})(window.BM = window.BM || {});
