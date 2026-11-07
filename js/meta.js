/* メタ進行: 恒久強化・ミッション・実績・放置報酬 */
(function (BM) {
'use strict';
const S = BM.S;

// ------------------------------------------------------------------ 恒久強化
// per: 1レベルあたりの効果 / base,grow: 必要コイン = base × grow^レベル
BM.UPG = [
  { id: 'init', name: '初期兵士数',   icon: '👥', max: 80, base: 40, grow: 1.19, per: 1,
    now: (lv) => '出撃時 ' + (10 + lv) + '人', step: '+1人 / Lv' },
  { id: 'atk',  name: '攻撃力',       icon: '⚔️', max: 60, base: 60, grow: 1.23, per: BM.UPGV.atk,
    now: (lv) => '攻撃力 ×' + (1 + BM.UPGV.atk * lv).toFixed(2), step: '+6% / Lv' },
  { id: 'hp',   name: '体力',         icon: '🛡️', max: 60, base: 60, grow: 1.23, per: BM.UPGV.hp,
    now: (lv) => '体力 ×' + (1 + BM.UPGV.hp * lv).toFixed(2), step: '+6% / Lv' },
  { id: 'aspd', name: '攻撃速度',     icon: '⚡', max: 40, base: 80, grow: 1.25, per: BM.UPGV.aspd,
    now: (lv) => '攻撃速度 ×' + (1 + BM.UPGV.aspd * lv).toFixed(2), step: '+4% / Lv' },
  { id: 'coin', name: 'コイン獲得量', icon: '🪙', max: 40, base: 50, grow: 1.26, per: BM.UPGV.coin,
    now: (lv) => 'コイン ×' + (1 + BM.UPGV.coin * lv).toFixed(2), step: '+8% / Lv' },
];
BM.UPG_BY = {};
for (const u of BM.UPG) BM.UPG_BY[u.id] = u;

BM.upgMax = (id) => S.upg[id] >= BM.UPG_BY[id].max;
BM.upgCost = (id) => {
  const u = BM.UPG_BY[id];
  return Math.max(5, Math.round(u.base * Math.pow(u.grow, S.upg[id]) / 5) * 5);
};
BM.upgTotal = () => BM.UPG.reduce((s, u) => s + S.upg[u.id], 0);
BM.buyUpgrade = (id) => {
  if (BM.upgMax(id)) return false;
  const c = BM.upgCost(id);
  if (S.coins < c) return false;
  S.coins -= c;
  S.upg[id]++;
  BM.writeSave();
  BM.hooks.event('upgrade', { id });
  return true;
};
BM.unlockType = (t) => {
  const T = BM.TYPE[t];
  if (S.unlock[t] || S.coins < T.cost) return false;
  S.coins -= T.cost;
  S.unlock[t] = true;
  S.roster[t] = 1;
  BM.writeSave();
  BM.hooks.event('unlock', { t });
  return true;
};
BM.unlockedCount = () => BM.TYPES.filter((t) => S.unlock[t]).length;

// ------------------------------------------------------------------ ミッション
const st = () => S.stats;
BM.MISSIONS = [
  { id: 'army100',  icon: '👥', name: '兵士を100人以上にする',     get: () => st().maxArmy,     target: 100,   reward: 100 },
  { id: 'boss1',    icon: '👹', name: 'ボスを1体倒す',             get: () => st().bossKills,   target: 1,     reward: 80 },
  { id: 'clear5',   icon: '🏁', name: 'ステージを5回クリアする',   get: () => st().clears,      target: 5,     reward: 150 },
  { id: 'coin1000', icon: '🪙', name: 'コインを1000枚獲得する',    get: () => st().totalCoins,  target: 1000,  reward: 200 },
  { id: 'gate50',   icon: '🚪', name: 'ゲートを50回通過する',      get: () => st().gates,       target: 50,    reward: 100 },
  { id: 'pick10',   icon: '⭐', name: '強化選択を10回行う',        get: () => st().picks,       target: 10,    reward: 120 },
  { id: 'route3',   icon: '🧭', name: '3種類の分岐ルートを全て通る', get: () => Object.keys(st().routes).filter((k) => st().routes[k] > 0).length, target: 3, reward: 250 },
  { id: 'stage10',  icon: '🏰', name: 'ステージ10に到達する',      get: () => S.stage,          target: 10,    reward: 400 },
  { id: 'upg20',    icon: '🔨', name: '強化を合計20レベルにする',  get: () => BM.upgTotal(),    target: 20,    reward: 300 },
  { id: 'unlock4',  icon: '📘', name: '全ての兵種を解放する',      get: () => BM.unlockedCount(), target: 4,   reward: 500 },
  { id: 'army1000', icon: '🌊', name: '兵士を1000人以上にする',    get: () => st().maxArmy,     target: 1000,  reward: 400 },
  { id: 'boss10',   icon: '💀', name: 'ボスを10体倒す',            get: () => st().bossKills,   target: 10,    reward: 500 },
  { id: 'clear25',  icon: '🏆', name: 'ステージを25回クリアする',  get: () => st().clears,      target: 25,    reward: 700 },
  { id: 'coin10000', icon: '💰', name: 'コインを10000枚獲得する',  get: () => st().totalCoins,  target: 10000, reward: 1500 },
  { id: 'stage25',  icon: '👑', name: 'ステージ25に到達する',      get: () => S.stage,          target: 25,    reward: 1500 },
];
BM.missionProg = (m) => Math.min(m.target, Math.floor(m.get()));
BM.missionDone = (m) => m.get() >= m.target;
BM.missionClaimed = (m) => !!S.missions[m.id];
BM.claimableCount = () => BM.MISSIONS.filter((m) => BM.missionDone(m) && !BM.missionClaimed(m)).length;
BM.claimMission = (id) => {
  const m = BM.MISSIONS.find((x) => x.id === id);
  if (!m || !BM.missionDone(m) || S.missions[id]) return false;
  S.missions[id] = true;
  S.coins += m.reward;
  S.stats.totalCoins += m.reward;
  BM.writeSave();
  BM.hooks.event('claim', { id });
  return true;
};

// ------------------------------------------------------------------ 実績
BM.ACH = [
  { id: 'first',   icon: '🏁', name: '初陣',           desc: '初めてステージをクリア',            cond: () => st().clears >= 1 },
  { id: 'boss5',   icon: '👹', name: 'ボスハンター',   desc: 'ボスを5体倒す',                    cond: () => st().bossKills >= 5 },
  { id: 'army500', icon: '👥', name: '大軍勢',         desc: '兵士が500人を超える',               cond: () => st().maxArmy >= 500 },
  { id: 'army5k',  icon: '🌊', name: '数の暴力',       desc: '兵士が5000人を超える',              cond: () => st().maxArmy >= 5000 },
  { id: 'stage10', icon: '🎖️', name: 'ベテラン',       desc: 'ステージ10に到達',                  cond: () => S.stage >= 10 },
  { id: 'stage25', icon: '👑', name: '歴戦の将軍',     desc: 'ステージ25に到達',                  cond: () => S.stage >= 25 },
  { id: 'rich',    icon: '💰', name: '大富豪',         desc: 'コインを累計5000枚獲得',            cond: () => st().totalCoins >= 5000 },
  { id: 'collect', icon: '📘', name: 'コレクター',     desc: '全ての兵種を解放',                  cond: () => BM.unlockedCount() >= 4 },
  { id: 'router',  icon: '🧭', name: 'ルート開拓者',   desc: '3種類の分岐ルートを全て通る',       cond: () => ['army', 'coin', 'elite'].every((k) => st().routes[k] > 0) },
  { id: 'picker',  icon: '⭐', name: '選択の達人',     desc: '強化選択を30回行う',                cond: () => st().picks >= 30 },
  { id: 'smith',   icon: '🔨', name: '鍛冶屋の常連',   desc: '強化を合計50レベルにする',          cond: () => BM.upgTotal() >= 50 },
  { id: 'gates',   icon: '🚪', name: 'ゲートマスター', desc: 'ゲートを300回通過',                 cond: () => st().gates >= 300 },
  { id: 'perfect', icon: '🛡️', name: '無傷の勝利',     desc: '兵士をほとんど失わずにクリア',      cond: () => st().perfect >= 1 },
  { id: 'comeback', icon: '🔥', name: '逆転勝利',      desc: '兵士が1割以下になりながらクリア',   cond: () => st().comeback >= 1 },
  { id: 'idle',    icon: '⏰', name: '放置の達人',     desc: '放置報酬を受け取る',                cond: () => st().idleClaims >= 1 },
];
BM.achCount = () => BM.ACH.filter((a) => S.ach[a.id]).length;

const notified = new Set();
function checkAll(silent) {
  for (const m of BM.MISSIONS) {
    if (BM.missionDone(m) && !BM.missionClaimed(m) && !notified.has(m.id)) {
      notified.add(m.id);
      if (!silent) BM.hooks.toast('📋 ミッション達成！ ' + m.name);
    }
  }
  for (const a of BM.ACH) {
    if (!S.ach[a.id] && a.cond()) {
      S.ach[a.id] = Date.now();
      if (!silent) BM.hooks.toast(a.icon + ' 実績解除！ ' + a.name);
    }
  }
}
BM.checkMeta = checkAll;

// 特殊な実績（クリア内容に依存）をイベントから判定
BM.hooks.event = function (name, d) {
  if (name === 'clear') {
    const max = BM.G.run ? BM.G.run.maxArmy : 0;
    if (max > 0 && d.left >= max * 0.95 && BM.G.world.stage >= 3) S.stats.perfect++;
    if (max >= 20 && d.left <= max * 0.1) S.stats.comeback++;
  }
  if (name === 'idle') S.stats.idleClaims++;
  checkAll(false);
  if (name !== 'gate' && name !== 'start') BM.writeSave();
};

// ------------------------------------------------------------------ 放置報酬
const IDLE_CAP_MIN = 480;     // 上限8時間
BM.idle = {
  capMin: IDLE_CAP_MIN,
  // 最高到達ステージの1クリア報酬の約5回分を上限時間でためられる
  clearReward() { const st = Math.max(1, S.stage - 1); return BM.stageBase(st) + BM.stageBoss(st); },
  perMin() { return 5 * this.clearReward() * BM.mult.coin() / IDLE_CAP_MIN; },
  elapsedMin(now) {
    now = now || Date.now();
    if (S.idleStart > now) S.idleStart = now;
    return Math.min(IDLE_CAP_MIN, Math.max(0, (now - S.idleStart) / 60000));
  },
  rawMin(now) { now = now || Date.now(); return Math.max(0, (now - S.idleStart) / 60000); },
  pending(now) { return Math.floor(this.elapsedMin(now) * this.perMin()); },
  full(now) { return this.rawMin(now) >= IDLE_CAP_MIN; },
  claim(now) {
    now = now || Date.now();
    const c = this.pending(now);
    S.coins += c;
    S.stats.totalCoins += c;
    S.idleStart = now;
    BM.writeSave();
    BM.hooks.event('idle', { coins: c });
    return c;
  },
  text(min) {
    const h = Math.floor(min / 60), m = Math.floor(min % 60);
    return h > 0 ? h + '時間' + m + '分' : m + '分';
  },
};

BM.metaInit = function () { checkAll(true); for (const m of BM.MISSIONS) if (BM.missionDone(m)) notified.add(m.id); };
})(window.BM = window.BM || {});
