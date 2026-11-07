/* UI: HUD・タブ式メニュー・各種オーバーレイ */
(function (BM) {
'use strict';
const S = BM.S, G = BM.G, TYPE = BM.TYPE, TYPES = BM.TYPES;
const $ = (id) => document.getElementById(id);
const UI = BM.ui = {};
const el = {};
let tab = 'home';
let sel = 1;
const TITLES = { home: 'ホーム', stages: 'ステージ選択', soldiers: '兵士一覧', upgrade: '強化', missions: 'ミッション', records: '実績・記録' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const coinHtml = (n) => '<span class="coin"></span><b>' + BM.fmt(n) + '</b>';

// ===================================================================== オーバーレイ
const OVERLAYS = ['pick', 'clear', 'over', 'idle', 'pause'];
function overlay(id) {
  for (const k of OVERLAYS) el[k].classList.toggle('hidden', k !== id);
}

// ===================================================================== トースト
const toastQ = [];
let toastBusy = false;
BM.hooks.toast = function (msg) {
  toastQ.push(msg);
  if (!toastBusy) nextToast();
};
function nextToast() {
  const m = toastQ.shift();
  if (!m) { toastBusy = false; return; }
  toastBusy = true;
  el.toast.textContent = m;
  el.toast.classList.add('on');
  setTimeout(() => { el.toast.classList.remove('on'); setTimeout(nextToast, 250); }, 2300);
}

// ===================================================================== HUD（ゲーム中）
const hud = { army: -1, stage: -1, coins: -1, types: '', buffs: '', prog: -1 };
function updateHud() {
  const w = G.world;
  if (!w) return;
  const inGame = G.state !== 'menu';
  el.hud.style.visibility = inGame ? 'visible' : 'hidden';
  el.btnPause.classList.toggle('hidden', !(G.state === 'ready' || G.state === 'playing'));
  el.hint.classList.toggle('show', (G.state === 'ready' || G.state === 'playing') && w.hintOn);
  if (!inGame) return;
  const n = G.count();
  if (n !== hud.army) { hud.army = n; el.armyNum.textContent = BM.fmt(n); }
  if (w.stage !== hud.stage) { hud.stage = w.stage; el.stageNum.textContent = 'STAGE ' + w.stage; }
  if (S.coins !== hud.coins) { hud.coins = S.coins; el.coinNum.textContent = BM.fmt(S.coins); }
  const pg = Math.round(BM.clamp(w.army.z / w.goalZ, 0, 1) * 100);
  if (pg !== hud.prog) { hud.prog = pg; el.progFill.style.width = pg + '%'; }
  const a = w.army;
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
  const run = G.run;
  if (run) {
    const b = run.buff;
    const bk = [b.atk, b.hp, b.aspd, b.coin, b.move, Math.ceil(w.invul || 0)].join(',');
    if (bk !== hud.buffs) {
      hud.buffs = bk;
      let h = '';
      for (const [k, ic] of [['atk', '⚔️'], ['hp', '🛡️'], ['aspd', '⚡'], ['coin', '🪙'], ['move', '👟']]) {
        if (b[k] > 0) h += '<span class="bchip">' + ic + '+' + Math.round(b[k] * 100) + '%</span>';
      }
      if (w.invul > 0) h = '<span class="bchip inv">🛡 無敵 ' + Math.ceil(w.invul) + '秒</span>' + h;
      el.buffRow.innerHTML = h;
    }
  }
}

// ===================================================================== メニュー描画
function initialCounts() {
  const w = TYPES.map((t) => (S.unlock[t] ? S.roster[t] : 0));
  const out = BM.split(10 + S.upg.init, w);
  if (out.every((v) => v === 0)) out[0] = 10 + S.upg.init;
  return out;
}

function homeHtml() {
  const bk = BM.bossKind(S.stage);
  const cnt = initialCounts();
  let chips = '';
  TYPES.forEach((t, i) => { if (cnt[i] > 0) chips += '<div class="tchip"><img alt="" src="' + BM.art.icons[t] + '"><b>' + cnt[i] + '</b></div>'; });
  return '<div class="home">' +
    '<div class="htop"><div class="logo">ブルー<span>マーチ</span></div>' +
    '<div class="hstage"><b>STAGE ' + S.stage + '</b><span>BOSS: ' + esc(BM.BOSS[bk].name) + '</span></div></div>' +
    '<div class="hbottom">' +
    '<div class="hchips">' + chips + '</div>' +
    '<div class="idlecard" id="idleBox"></div>' +
    '<button class="btn green big" data-act="start" data-stage="' + S.stage + '">出撃！ ステージ ' + S.stage + '</button>' +
    '</div></div>';
}

function idleBoxHtml() {
  const I = BM.idle, now = Date.now();
  const raw = I.rawMin(now), el2 = I.elapsedMin(now), p = I.pending(now);
  const full = I.full(now);
  return '<div class="idrow"><div class="idt"><b>⏰ 放置報酬</b><span>' + I.text(el2) + ' / 最大 ' + (I.capMin / 60) + '時間' + (full ? '（満タン）' : '') + '</span></div>' +
    '<button class="btn gold sm' + (p < 1 ? ' disabled' : '') + '" data-act="idleClaim"><span class="coin"></span>' + BM.fmt(p) + ' 受取</button></div>' +
    '<div class="bar"><i style="width:' + Math.round(BM.clamp(raw / I.capMin, 0, 1) * 100) + '%"></i></div>';
}

function stagesHtml() {
  let h = '<div class="list">';
  const top = S.stage + 2;
  for (let s = top; s >= 1; s--) {
    const locked = s > S.stage;
    const bk = BM.bossKind(s), B = BM.BOSS[bk];
    const tier = BM.bossTier(s);
    const state = locked ? '<em class="st lock">🔒</em>' : (s === S.stage ? '<em class="st new">NEW</em>' : '<em class="st ok">CLEAR</em>');
    h += '<div class="scard' + (locked ? ' locked' : '') + (s === S.stage ? ' cur' : '') + '">' +
      '<div class="snum">' + s + '</div>' +
      '<img alt="" src="' + BM.art.boss[bk] + '">' +
      '<div class="sinfo"><b>ステージ ' + s + '</b><span>' + esc(B.name) + (tier > 0 ? ' ★' + (tier + 1) : '') + '</span><span class="sw">' + esc(B.wall) + '</span></div>' +
      state +
      (locked ? '' : '<button class="btn green sm" data-act="start" data-stage="' + s + '">出撃</button>') +
      '</div>';
  }
  return h + '</div>';
}

function statBar(label, v, max) {
  return '<div class="sb"><span>' + label + '</span><div class="bar mini"><i style="width:' + Math.round(BM.clamp(v / max, 0, 1) * 100) + '%"></i></div></div>';
}
const RANGE_TXT = { sword: '近距離', archer: '遠距離', heavy: '近距離', mage: '中距離' };

function soldiersHtml() {
  const cnt = initialCounts();
  const total = 10 + S.upg.init;
  const wsum = TYPES.reduce((s, t) => s + (S.unlock[t] ? S.roster[t] : 0), 0) || 1;
  let h = '<div class="note">出撃時の兵士 <b>' + total + '人</b> を、下の編成比率で分けます。ゲートで増える兵士も同じ比率で増えます。</div>';
  h += '<div class="hchips center">';
  TYPES.forEach((t, i) => { if (cnt[i] > 0) h += '<div class="tchip big"><img alt="" src="' + BM.art.icons[t] + '"><b>' + cnt[i] + '</b></div>'; });
  h += '</div><div class="list">';
  for (const t of TYPES) {
    const T = TYPE[t], un = S.unlock[t];
    const share = un ? Math.round(S.roster[t] * 100 / wsum) : 0;
    h += '<div class="rcard big' + (un ? '' : ' locked') + '">' +
      '<img alt="" src="' + BM.art.icons[t] + '">' +
      '<div class="rinfo"><b>' + T.name + '<i>' + T.tag + '</i></b><span>' + T.desc + '</span>' +
      '<div class="sbs">' + statBar('攻撃', T.atk * (T.aoe ? 1.5 : 1), 1.3) + statBar('体力', T.hp, 3) + statBar('射程', T.range, 30) + '</div>' +
      '<span class="rng">' + RANGE_TXT[t] + '攻撃' + (T.aoe ? '・範囲' : '') + '</span></div>';
    if (un) {
      h += '<div class="rstep"><button data-act="roster" data-t="' + t + '" data-d="1">＋</button><em>' + share + '%</em><button data-act="roster" data-t="' + t + '" data-d="-1">−</button></div>';
    } else {
      h += '<button class="btn gold sm' + (S.coins < T.cost ? ' disabled' : '') + '" data-act="unlock" data-t="' + t + '"><span class="coin"></span>' + T.cost + '<br><small>解放</small></button>';
    }
    h += '</div>';
  }
  return h + '</div>';
}

function upgradeHtml() {
  let h = '<div class="note">コインで兵士を強化しよう。強化はステージをまたいで残ります。</div><div class="list">';
  for (const u of BM.UPG) {
    const lv = S.upg[u.id], maxed = BM.upgMax(u.id), cost = BM.upgCost(u.id);
    h += '<div class="ucard"><div class="ui">' + u.icon + '</div>' +
      '<div class="uinfo"><b>' + u.name + ' <i>Lv ' + lv + '/' + u.max + '</i></b>' +
      '<span>' + u.now(lv) + (maxed ? '' : ' → ' + u.now(lv + 1)) + '</span>' +
      '<div class="bar mini"><i style="width:' + Math.round(lv / u.max * 100) + '%"></i></div></div>' +
      (maxed ? '<div class="btn plain sm static">MAX</div>' :
        '<button class="btn gold sm' + (S.coins < cost ? ' disabled' : '') + '" data-act="buy" data-id="' + u.id + '"><span class="coin"></span>' + BM.fmt(cost) + '</button>') +
      '</div>';
  }
  return h + '</div>';
}

function missionsHtml() {
  const rank = (m) => (BM.missionClaimed(m) ? 2 : (BM.missionDone(m) ? 0 : 1));
  const list = BM.MISSIONS.slice().sort((a, b) => rank(a) - rank(b));
  let h = '<div class="list">';
  for (const m of list) {
    const done = BM.missionDone(m), claimed = BM.missionClaimed(m);
    const pv = BM.missionProg(m);
    h += '<div class="mcard' + (claimed ? ' claimed' : '') + '"><div class="ui">' + m.icon + '</div>' +
      '<div class="uinfo"><b>' + esc(m.name) + '</b>' +
      '<div class="bar mini"><i style="width:' + Math.round(pv / m.target * 100) + '%"></i></div>' +
      '<span>' + BM.fmt(pv) + ' / ' + BM.fmt(m.target) + '</span></div>' +
      (claimed ? '<div class="btn plain sm static">受取済</div>' :
        done ? '<button class="btn green sm" data-act="claim" data-id="' + m.id + '"><span class="coin"></span>' + BM.fmt(m.reward) + '<br><small>受け取る</small></button>' :
          '<div class="mrew"><span class="coin"></span>' + BM.fmt(m.reward) + '</div>') +
      '</div>';
  }
  return h + '</div>';
}

function recordsHtml() {
  const st = S.stats;
  const rec = [
    ['🏰', '到達ステージ', S.stage], ['👥', '最大の兵士数', BM.fmt(st.maxArmy)], ['🛡️', 'クリア時の最大残存', BM.fmt(st.bestClearArmy)],
    ['🪙', '累計コイン', BM.fmt(st.totalCoins)], ['👹', 'ボス撃破', st.bossKills], ['🏁', 'クリア回数', st.clears],
    ['⚔️', '出撃回数', st.plays], ['🚪', 'ゲート通過', BM.fmt(st.gates)],
  ];
  let h = '<div class="recgrid">';
  for (const [ic, nm, v] of rec) h += '<div class="rec"><i>' + ic + '</i><span>' + nm + '</span><b>' + v + '</b></div>';
  h += '</div><div class="sect">実績 ' + BM.achCount() + ' / ' + BM.ACH.length + '</div><div class="achgrid">';
  for (const a of BM.ACH) {
    const ok = !!S.ach[a.id];
    h += '<div class="ach' + (ok ? ' got' : '') + '"><i>' + (ok ? a.icon : '🔒') + '</i><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + '</span></div>';
  }
  h += '</div><button class="btn plain sm dangerbtn" data-act="reset">データをリセット</button>';
  return h;
}

const RENDER = { home: homeHtml, stages: stagesHtml, soldiers: soldiersHtml, upgrade: upgradeHtml, missions: missionsHtml, records: recordsHtml };

function renderMenu() {
  el.mbody.innerHTML = RENDER[tab]();
  el.mtitle.textContent = TITLES[tab];
  el.mCoin.textContent = BM.fmt(S.coins);
  el.menu.classList.toggle('home', tab === 'home');
  el.tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab === 'home') refreshIdle();
  updateBadges();
}
function refreshIdle() {
  const b = $('idleBox');
  if (b) b.innerHTML = idleBoxHtml();
}
function updateBadges() {
  const cl = BM.claimableCount();
  const idle = BM.idle.pending() >= 1;
  const upg = BM.UPG.some((u) => !BM.upgMax(u.id) && S.coins >= BM.upgCost(u.id));
  const dots = { home: idle, upgrade: upg, missions: cl > 0 };
  el.tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('dot', !!dots[b.dataset.tab]));
}

UI.go = function (t) {
  tab = t;
  showMenu(true);
  G.hold = t !== 'home';
  if (t === 'home') { G.hold = false; G.preview(S.stage); }
  renderMenu();
  el.mbody.scrollTop = 0;
};
function showMenu(on) {
  el.menu.classList.toggle('hidden', !on);
  if (!on) return;
  overlay('');
}
UI.toMenu = function (t) {
  G.paused = false;
  G.state = 'menu';
  UI.go(t || 'home');
};

function play(stage) {
  stage = BM.clamp(stage | 0, 1, S.stage);
  sel = stage;
  showMenu(false);
  overlay('');
  G.hold = false; G.paused = false;
  G.start(stage);
  G.world.hintOn = true;
  hud.types = ''; hud.buffs = '';
}
UI.play = play;

// ===================================================================== メニュー内の操作
function onMenuClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.classList.contains('static')) return;
  const act = b.dataset.act;
  if (act === 'start') play(+b.dataset.stage);
  else if (act === 'idleClaim') {
    if (BM.idle.pending() < 1) return;
    const c = BM.idle.claim();
    BM.hooks.toast('🪙 放置報酬 +' + BM.fmt(c));
    renderMenu();
  } else if (act === 'roster') {
    const t = b.dataset.t, d = +b.dataset.d;
    S.roster[t] = BM.clamp(S.roster[t] + d, 0, 9);
    BM.sanitizeSave();
    BM.writeSave();
    renderMenu();
  } else if (act === 'unlock') {
    if (BM.unlockType(b.dataset.t)) BM.hooks.toast('📘 ' + TYPE[b.dataset.t].name + 'を解放！');
    renderMenu();
  } else if (act === 'buy') {
    if (BM.buyUpgrade(b.dataset.id)) renderMenu();
  } else if (act === 'claim') {
    if (BM.claimMission(b.dataset.id)) BM.hooks.toast('🪙 +' + BM.fmt(BM.MISSIONS.find((m) => m.id === b.dataset.id).reward));
    renderMenu();
  } else if (act === 'reset') {
    if (confirm('セーブデータをすべて消して最初からやり直します。よろしいですか？')) {
      BM.resetSave();
      BM.metaInit();
      UI.go('home');
    }
  }
}

// ===================================================================== ゲーム中のイベント
BM.hooks.pick = function (opts) {
  let h = '';
  for (const o of opts) {
    h += '<button class="pickcard" data-id="' + o.id + '"><span class="pi">' + o.icon + '</span>' +
      '<span class="pt"><b>' + o.name + '</b><i>' + o.desc + '</i></span></button>';
  }
  el.pickList.innerHTML = h;
  el.pickList.querySelectorAll('.pickcard').forEach((b) => b.addEventListener('click', () => {
    G.choosePick(b.dataset.id);
    overlay('');
  }));
  overlay('pick');
};

BM.hooks.clear = function (info) {
  el.clArmy.textContent = BM.fmt(info.left);
  const m = info.mult;
  let rows = '<div><span>基本報酬</span><b>' + BM.fmt(info.base) + '</b></div>' +
    '<div><span>ボス撃破ボーナス</span><b>' + BM.fmt(info.bossBonus) + '</b></div>';
  if (info.routeCoins > 0) rows += '<div><span>ルートのコイン</span><b>' + BM.fmt(info.routeCoins) + '</b></div>';
  if (m > 1.001) rows += '<div><span>コイン獲得量 ×' + m.toFixed(2) + '</span><b>↑</b></div>';
  el.clRows.innerHTML = rows;
  el.clReward.textContent = '+' + BM.fmt(info.reward);
  el.clDetail.textContent = info.first ? '次のステージが解放されました！' : '';
  overlay('clear');
};
BM.hooks.over = function (info) {
  el.ovStage.textContent = 'ステージ ' + info.stage + ' で全滅';
  el.ovCoins.textContent = '+' + BM.fmt(info.coins);
  overlay('over');
};

// ===================================================================== 放置報酬（起動時）
function showWelcome() {
  const I = BM.idle, now = Date.now();
  if (I.rawMin(now) < 1) return false;
  const p = I.pending(now);
  if (p < 1) return false;
  el.idTime.textContent = '経過時間 ' + I.text(I.rawMin(now));
  el.idCoins.textContent = '+' + BM.fmt(p);
  el.idNote.textContent = I.full(now) ? '上限（' + (I.capMin / 60) + '時間）まで貯まっています' : 'ゲームを閉じている間もコインがたまります（最大' + (I.capMin / 60) + '時間）';
  overlay('idle');
  return true;
}

// ===================================================================== 起動
UI.boot = function () {
  for (const id of ['stage', 'c', 'hud', 'hint', 'armyNum', 'coinNum', 'stageNum', 'typeRow', 'buffRow', 'progFill', 'toast', 'btnPause',
    'menu', 'mhead', 'mbody', 'mtitle', 'mCoin', 'tabs', 'pick', 'clear', 'over', 'idle', 'pause', 'pickList',
    'clArmy', 'clRows', 'clReward', 'clDetail', 'ovStage', 'ovCoins', 'idTime', 'idCoins', 'idNote',
    'btnNext', 'btnReplay', 'btnClearHome', 'btnRetry', 'btnToUpgrade', 'btnOverHome', 'btnIdleClaim', 'btnResume', 'btnQuit']) el[id] = $(id);

  BM.loadSave();
  BM.metaInit();
  sel = S.stage;
  G.init(el.c, el.stage);
  BM.hooks.frame = updateHud;

  el.mbody.addEventListener('click', onMenuClick);
  el.tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => UI.go(b.dataset.tab)));
  el.btnNext.addEventListener('click', () => play(G.world.stage + 1));
  el.btnReplay.addEventListener('click', () => play(G.world.stage));
  el.btnClearHome.addEventListener('click', () => UI.toMenu('home'));
  el.btnRetry.addEventListener('click', () => play(G.world.stage));
  el.btnToUpgrade.addEventListener('click', () => UI.toMenu('upgrade'));
  el.btnOverHome.addEventListener('click', () => UI.toMenu('home'));
  el.btnIdleClaim.addEventListener('click', () => {
    const c = BM.idle.claim();
    BM.hooks.toast('🪙 放置報酬 +' + BM.fmt(c));
    overlay('');
    renderMenu();
  });
  el.btnPause.addEventListener('click', () => { G.paused = true; overlay('pause'); });
  el.btnResume.addEventListener('click', () => { G.paused = false; overlay(''); });
  el.btnQuit.addEventListener('click', () => { UI.toMenu('home'); });

  // 自動保存・放置報酬の表示更新
  setInterval(() => {
    if (!el.menu.classList.contains('hidden')) {
      if (tab === 'home') refreshIdle();
      el.mCoin.textContent = BM.fmt(S.coins);
      updateBadges();
    }
  }, 1000);
  setInterval(() => BM.writeSave(), 15000);
  const flush = () => BM.writeSave();
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);

  UI.go('home');
  showWelcome();
};

BM.test = { play, go: (t) => UI.go(t), welcome: showWelcome };
UI.boot();
})(window.BM = window.BM || {});
