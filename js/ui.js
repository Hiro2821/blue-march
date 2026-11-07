/* UI: HUD・各種オーバーレイ */
(function (BM) {
'use strict';
const S = BM.S, G = BM.G, TYPE = BM.TYPE, TYPES = BM.TYPES;
const $ = (id) => document.getElementById(id);
const UI = BM.ui = {};

let el = {};
let sel = 1;

function show(id) {
  for (const k of ['title', 'pick', 'clear', 'over']) el[k].classList.toggle('hidden', k !== id);
}
function hideAll() { show(''); }

// ------------------------------------------------------------------ HUD
let hud = { army: -1, stage: -1, coins: -1, types: '', buffs: '' };
function updateHud() {
  const w = G.world;
  if (!w) return;
  const n = G.count();
  if (n !== hud.army) { hud.army = n; el.armyNum.textContent = BM.fmt(n); }
  if (w.stage !== hud.stage) { hud.stage = w.stage; el.stageNum.textContent = 'STAGE ' + w.stage; }
  if (S.coins !== hud.coins) { hud.coins = S.coins; el.coinNum.textContent = BM.fmt(S.coins); }
  // 兵種ごとの人数
  const a = w.army;
  const pg = Math.round(BM.clamp(a.z / w.endZ, 0, 1) * 100);
  if (pg !== hud.prog) { hud.prog = pg; el.progFill.style.width = pg + '%'; }
  const key = a.n.map((v) => Math.ceil(v - 1e-6)).join(',') + '|' + TYPES.map((t) => (S.unlock[t] ? 1 : 0)).join('');
  if (key !== hud.types) {
    hud.types = key;
    let h = '';
    TYPES.forEach((t, i) => {
      const c = Math.max(0, Math.ceil(a.n[i] - 1e-6));
      if (c <= 0 && !S.unlock[t]) return;
      h += '<div class="tchip' + (c <= 0 ? ' zero' : '') + '"><img alt="" src="' + BM.art.icons[t] + '"><b>' + BM.fmt(c) + '</b></div>';
    });
    el.typeRow.innerHTML = h;
  }
  // 強化の表示
  const run = G.run;
  if (run) {
    const b = run.buff;
    const bk = [b.atk, b.hp, b.aspd, b.coin, b.move].join(',');
    if (bk !== hud.buffs) {
      hud.buffs = bk;
      const items = [['atk', '⚔️'], ['hp', '🛡️'], ['aspd', '⚡'], ['coin', '🪙'], ['move', '👟']];
      let h = '';
      for (const [k, ic] of items) if (b[k] > 0) h += '<span class="bchip">' + ic + '+' + Math.round(b[k] * 100) + '%</span>';
      el.buffRow.innerHTML = h;
    }
  }
  const playing = G.state === 'ready' || G.state === 'playing';
  el.hud.style.visibility = G.state === 'menu' ? 'hidden' : 'visible';
  el.hint.classList.toggle('show', playing && w.hintOn);
}

// ------------------------------------------------------------------ 兵士編成
UI.renderRoster = function (box) {
  let h = '';
  const total = TYPES.reduce((s, t) => s + (S.unlock[t] ? S.roster[t] : 0), 0) || 1;
  for (const t of TYPES) {
    const T = TYPE[t];
    const un = S.unlock[t];
    const share = un ? Math.round(S.roster[t] * 100 / total) : 0;
    h += '<div class="rcard' + (un ? '' : ' locked') + '">' +
      '<img alt="" src="' + BM.art.icons[t] + '">' +
      '<div class="rinfo"><b>' + T.name + '<i>' + T.tag + '</i></b><span>' + T.desc + '</span></div>';
    if (un) {
      h += '<div class="rstep"><button data-t="' + t + '" data-d="-1">−</button><em>' + share + '%</em><button data-t="' + t + '" data-d="1">＋</button></div>';
    } else {
      h += '<button class="btn gold sm' + (S.coins < T.cost ? ' disabled' : '') + '" data-unlock="' + t + '"><span class="coin"></span>' + T.cost + '</button>';
    }
    h += '</div>';
  }
  box.innerHTML = h;
  box.querySelectorAll('button[data-d]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.t, d = +b.dataset.d;
    S.roster[t] = BM.clamp(S.roster[t] + d, 0, 9);
    if (TYPES.every((x) => !S.unlock[x] || S.roster[x] === 0)) S.roster.sword = 1;
    BM.writeSave();
    refreshTitle();
  }));
  box.querySelectorAll('button[data-unlock]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.unlock;
    if (S.coins < TYPE[t].cost) return;
    S.coins -= TYPE[t].cost;
    S.unlock[t] = true;
    S.roster[t] = 1;
    BM.writeSave();
    refreshTitle();
  }));
};

// ------------------------------------------------------------------ タイトル
function refreshTitle() {
  sel = BM.clamp(sel, 1, S.stage);
  el.stName.textContent = 'ステージ ' + sel + '  ' + BM.BOSS[BM.bossKind(sel)].short;
  el.stPrev.disabled = sel <= 1;
  el.stNext.disabled = sel >= S.stage;
  el.titleCoins.textContent = BM.fmt(S.coins);
  UI.renderRoster(el.roster);
  G.preview(sel);
}
function toTitle() {
  G.preview(sel);
  refreshTitle();
  show('title');
}
function play(stage) {
  sel = stage;
  G.start(stage);
  G.world.hintOn = true;
  hideAll();
}

// ------------------------------------------------------------------ 強化選択
BM.hooks.pick = function (opts) {
  let h = '';
  for (const o of opts) {
    h += '<button class="pickcard" data-id="' + o.id + '"><span class="pi">' + o.icon + '</span>' +
      '<span class="pt"><b>' + o.name + '</b><i>' + o.desc + '</i></span></button>';
  }
  el.pickList.innerHTML = h;
  el.pickList.querySelectorAll('.pickcard').forEach((b) => b.addEventListener('click', () => {
    G.choosePick(b.dataset.id);
    hideAll();
  }));
  show('pick');
};

BM.hooks.clear = function (info) {
  el.clArmy.textContent = BM.fmt(info.left);
  el.clReward.textContent = '+' + BM.fmt(info.reward);
  el.clDetail.textContent = 'ボス撃破ボーナス込み';
  show('clear');
};
BM.hooks.over = function (info) {
  el.ovStage.textContent = 'ステージ ' + info.stage;
  show('over');
};

// ------------------------------------------------------------------ 起動
UI.boot = function () {
  for (const id of ['stage', 'c', 'hud', 'hint', 'armyNum', 'coinNum', 'stageNum', 'typeRow', 'buffRow', 'progFill',
    'title', 'pick', 'clear', 'over', 'stName', 'stPrev', 'stNext', 'btnStart', 'titleCoins', 'roster', 'pickList',
    'clArmy', 'clReward', 'clDetail', 'ovStage', 'btnNext', 'btnReplay', 'btnClearTitle', 'btnRetry', 'btnOverTitle']) el[id] = $(id);
  BM.loadSave();
  sel = S.stage;
  G.init(el.c, el.stage);
  BM.hooks.frame = updateHud;
  el.btnStart.addEventListener('click', () => play(sel));
  el.stPrev.addEventListener('click', () => { sel = Math.max(1, sel - 1); refreshTitle(); });
  el.stNext.addEventListener('click', () => { sel = Math.min(S.stage, sel + 1); refreshTitle(); });
  el.btnNext.addEventListener('click', () => play(G.world.stage + 1));
  el.btnReplay.addEventListener('click', () => play(G.world.stage));
  el.btnClearTitle.addEventListener('click', () => { sel = Math.min(S.stage, G.world.stage + 1); toTitle(); });
  el.btnRetry.addEventListener('click', () => play(G.world.stage));
  el.btnOverTitle.addEventListener('click', () => { sel = G.world.stage; toTitle(); });
  toTitle();
};

BM.test = { play, toTitle };
UI.boot();
})(window.BM = window.BM || {});
