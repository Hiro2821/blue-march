/* セーブデータ（localStorage）。旧バージョン(v1)のデータも引き継ぐ */
(function (BM) {
'use strict';

const KEY2 = 'blueMarch.save.v2';
const KEY1 = 'blueMarch.save.v1';   // 初期バージョン: {coins, stage, bonus}

function defaults() {
  const now = Date.now();
  return {
    v: 2,
    coins: 0,
    stage: 1,                                     // 到達（挑戦可能）ステージ = 現在のステージ
    upg: { init: 0, atk: 0, hp: 0, aspd: 0, coin: 0 },   // 恒久強化レベル
    unlock: { sword: true, archer: false, heavy: false, mage: false },  // 兵士の解放状況
    roster: { sword: 1, archer: 0, heavy: 0, mage: 0 },  // 出撃時の編成比率
    missions: {},                                 // 受取済みミッション id -> true
    ach: {},                                      // 解除済み実績 id -> 日時
    stats: {                                      // 最高記録・累計
      totalCoins: 0, bossKills: 0, clears: 0, plays: 0, losses: 0,
      maxArmy: 0, bestClearArmy: 0, maxStage: 1, gates: 0, picks: 0,
      routes: { army: 0, coin: 0, elite: 0 }, kills: 0,
      perfect: 0, comeback: 0, idleClaims: 0,
    },
    idleStart: now,                               // 放置報酬の起点
    lastSeen: now,
    firstPlayed: now,
  };
}

// 既知のキーだけを型を確かめながら取り込む（古い/壊れたデータでも落ちない）
function merge(def, src) {
  if (!src || typeof src !== 'object') return def;
  for (const k of Object.keys(def)) {
    const d = def[k], s = src[k];
    if (s === undefined || s === null) continue;
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      def[k] = merge(d, s);
    } else if (typeof d === typeof s && (typeof s !== 'number' || isFinite(s))) {
      def[k] = s;
    }
  }
  // マップ型（キーが可変）のデータ
  if (def.missions !== undefined && src.missions && typeof src.missions === 'object') {
    for (const id of Object.keys(src.missions)) if (src.missions[id]) def.missions[id] = true;
  }
  if (def.ach !== undefined && src.ach && typeof src.ach === 'object') {
    for (const id of Object.keys(src.ach)) if (src.ach[id]) def.ach[id] = +src.ach[id] || 1;
  }
  return def;
}

const S = BM.S = defaults();

function sanitize() {
  S.coins = Math.max(0, Math.floor(S.coins));
  S.stage = Math.max(1, Math.floor(S.stage));
  for (const k of Object.keys(S.upg)) S.upg[k] = BM.clamp(Math.floor(S.upg[k]), 0, 999);
  S.unlock.sword = true;
  // 編成: 解放済みの兵種だけ。全部0なら剣士にする
  let sum = 0;
  for (const t of BM.TYPES) {
    S.roster[t] = BM.clamp(Math.floor(S.roster[t]), 0, 9);
    if (!S.unlock[t]) S.roster[t] = 0;
    sum += S.roster[t];
  }
  if (sum <= 0) S.roster.sword = 1;
  S.stats.maxStage = Math.max(S.stats.maxStage, S.stage);
  if (S.idleStart > Date.now()) S.idleStart = Date.now();   // 時計が戻った場合
}

BM.loadSave = function () {
  let loaded = false;
  try {
    const raw = localStorage.getItem(KEY2);
    if (raw) { merge(S, JSON.parse(raw)); loaded = true; }
  } catch (e) { /* 壊れていたら初期値 */ }
  if (!loaded) {
    // v1 からの引き継ぎ
    try {
      const old = JSON.parse(localStorage.getItem(KEY1));
      if (old && typeof old === 'object') {
        S.coins = Math.max(0, old.coins | 0);
        S.stage = Math.max(1, old.stage | 0);
        S.upg.init = BM.clamp(old.bonus | 0, 0, 999);
        S.stats.totalCoins = S.coins;
        S.stats.clears = Math.max(0, S.stage - 1);
        S.stats.maxStage = S.stage;
      }
    } catch (e) { /* ignore */ }
  }
  sanitize();
  return loaded;
};

BM.writeSave = function () {
  try {
    S.lastSeen = Date.now();
    localStorage.setItem(KEY2, JSON.stringify(S));
  } catch (e) { /* 容量不足・プライベートモードなど */ }
};

BM.resetSave = function () {
  const d = defaults();
  for (const k of Object.keys(d)) S[k] = d[k];
  BM.writeSave();
};

BM.sanitizeSave = sanitize;
})(window.BM = window.BM || {});
