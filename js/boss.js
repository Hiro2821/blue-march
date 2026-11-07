/* ボス: 5種類の外見・背景テーマ・演出色 */
(function (BM) {
'use strict';
const TAU = Math.PI * 2;
const rrect = BM.rrect;

BM.BOSS = [
  { name: '鬼将軍ガルド', short: '鬼将軍', col: '#ff6a3a', fx: '#ff8a7a', bg: ['#6fd0f5', '#2b86dc'], rip: '#ffffff', wall: '海と城壁' },
  { name: '岩巨人ゴーラム', short: '岩巨人', col: '#c7a46a', fx: '#d9c8a0', bg: ['#a9e8a0', '#4fae5a'], rip: '#e4ffd8', wall: '草原' },
  { name: '闇の魔導士ヴェルザ', short: '魔導士', col: '#b07bff', fx: '#c79bff', bg: ['#a58be8', '#5a3fb0'], rip: '#eadcff', wall: '黄昏の空' },
  { name: '炎の巨人イグニス', short: '炎の巨人', col: '#ff8a2a', fx: '#ffcf5a', bg: ['#ffb870', '#d4452a'], rip: '#ffe9a0', wall: '溶岩地帯' },
  { name: '氷王グレイシア', short: '氷王', col: '#7fd6ff', fx: '#d8f4ff', bg: ['#dff3ff', '#8fc5ee'], rip: '#ffffff', wall: '雪原' },
];
BM.bossKind = (stage) => (stage - 1) % BM.BOSS.length;
BM.bossTier = (stage) => Math.floor((stage - 1) / BM.BOSS.length);

function ell(g, x, y, rx, ry, fill, stroke) {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) g.stroke();
}
function dot(g, x, y, r, fill, stroke) {
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) g.stroke();
}
function poly(g, pts, fill, stroke) {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) g.stroke();
}

// 0: 鬼将軍 ------------------------------------------------------------
function oni(g, t) {
  const bob = Math.sin(t * 3.2) * 2;
  g.fillStyle = '#4a2f1c';
  rrect(g, -32, -36, 25, 36, 7); g.fill(); g.stroke();
  rrect(g, 7, -36, 25, 36, 7); g.fill(); g.stroke();
  g.translate(0, bob * 0.5);
  g.fillStyle = '#e0a67a';
  rrect(g, -66, -94, 22, 52, 10); g.fill(); g.stroke();
  dot(g, -55, -40, 12, '#e0a67a', true);
  g.fillStyle = '#c93a2a'; rrect(g, -42, -98, 84, 68, 20); g.fill(); g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.18)'; rrect(g, 0, -98, 42, 68, 20); g.fill();
  g.fillStyle = '#34262a'; g.fillRect(-42, -54, 84, 10);
  g.fillStyle = '#e0b84a'; rrect(g, -9, -57, 18, 16, 3); g.fill(); g.stroke();
  g.fillStyle = '#e0a67a'; rrect(g, 44, -96, 22, 46, 10); g.fill(); g.stroke();
  dot(g, 56, -50, 12, '#e0a67a', true);
  g.fillStyle = '#6b4423';
  poly(g, [50, -54, 63, -54, 80, -126, 60, -132], '#6b4423', true);
  dot(g, 70, -134, 18, '#7a4e2a', true);
  g.fillStyle = '#c8ced8';
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * 0.7;
    const bx = 70 + Math.cos(a) * 17, by = -134 + Math.sin(a) * 17;
    poly(g, [bx - 4, by + 3, 70 + Math.cos(a) * 28, -134 + Math.sin(a) * 28, bx + 4, by - 3], '#c8ced8');
  }
  dot(g, -44, -90, 17, '#6b7280', true); dot(g, 44, -90, 17, '#6b7280', true);
  dot(g, 0, -114, 22, '#e0a67a', true);
  g.fillStyle = '#59606c';
  g.beginPath(); g.arc(0, -116, 23, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#3d424c'; g.fillRect(-23, -118, 46, 7);
  poly(g, [-18, -128, -34, -152, -8, -136], '#f2e6c8', true);
  poly(g, [18, -128, 34, -152, 8, -136], '#f2e6c8', true);
  ell(g, -8, -109, 3.6, 2.6, '#ff3b2b'); ell(g, 8, -109, 3.6, 2.6, '#ff3b2b');
  g.strokeStyle = '#2a1410'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-15, -117); g.lineTo(-4, -112); g.moveTo(15, -117); g.lineTo(4, -112); g.moveTo(-7, -97); g.lineTo(7, -97); g.stroke();
}

// 1: 岩巨人 ------------------------------------------------------------
function golem(g, t) {
  const bob = Math.sin(t * 2.4) * 2;
  g.fillStyle = '#7d8088';
  rrect(g, -38, -40, 32, 40, 8); g.fill(); g.stroke();
  rrect(g, 6, -40, 32, 40, 8); g.fill(); g.stroke();
  g.translate(0, bob * 0.5);
  // 腕
  g.fillStyle = '#8f939c';
  rrect(g, -78, -100, 30, 62, 12); g.fill(); g.stroke();
  rrect(g, 48, -100, 30, 62, 12); g.fill(); g.stroke();
  dot(g, -63, -34, 17, '#9fa3ad', true); dot(g, 63, -34, 17, '#9fa3ad', true);
  // 胴
  g.fillStyle = '#9a9ea8';
  poly(g, [-48, -44, -56, -104, -30, -118, 30, -118, 56, -104, 48, -44], '#9a9ea8', true);
  g.fillStyle = 'rgba(0,0,0,.16)'; poly(g, [4, -44, 8, -118, 30, -118, 56, -104, 48, -44], 'rgba(0,0,0,.16)');
  g.strokeStyle = '#4b4e57'; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(-20, -112); g.lineTo(-8, -88); g.lineTo(-24, -70); g.lineTo(-12, -50);
  g.moveTo(24, -108); g.lineTo(14, -84); g.lineTo(30, -64); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(30,10,10,.7)';
  // 苔
  g.fillStyle = '#5fae4a';
  ell(g, -34, -108, 12, 5, '#5fae4a'); ell(g, 26, -112, 10, 4, '#6fc055'); ell(g, -52, -96, 7, 4, '#5fae4a');
  // 肩の岩
  poly(g, [-62, -108, -46, -140, -30, -112], '#8a8e98', true);
  poly(g, [62, -108, 46, -140, 30, -112], '#8a8e98', true);
  // 頭
  rrect(g, -20, -142, 40, 30, 10); g.fillStyle = '#a7abb5'; g.fill(); g.stroke();
  const gl = 0.6 + 0.4 * Math.sin(t * 5);
  ell(g, -8, -128, 4.5, 3.2, 'rgba(255,170,40,' + gl.toFixed(2) + ')');
  ell(g, 8, -128, 4.5, 3.2, 'rgba(255,170,40,' + gl.toFixed(2) + ')');
  g.strokeStyle = '#3a2a1a'; g.beginPath(); g.moveTo(-8, -118); g.lineTo(8, -118); g.stroke();
}

// 2: 闇の魔導士 --------------------------------------------------------
function sorcerer(g, t) {
  const fl = Math.sin(t * 2.6) * 4;
  g.translate(0, fl - 8);
  // ローブ
  const gr = g.createLinearGradient(0, -110, 0, 0);
  gr.addColorStop(0, '#6a4fd6'); gr.addColorStop(1, '#2a1a6a');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(-26, -104); g.lineTo(26, -104); g.lineTo(52, -14);
  for (let i = 0; i < 6; i++) { const x = 52 - i * 20.8; g.lineTo(x - 10, 4 + (i & 1 ? -6 : 6)); }
  g.lineTo(-52, -14); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.beginPath(); g.moveTo(0, -104); g.lineTo(26, -104); g.lineTo(52, -14); g.lineTo(0, -6); g.closePath(); g.fill();
  g.fillStyle = '#ffd36a'; g.fillRect(-40, -40, 80, 5);
  // 腕と杖
  g.fillStyle = '#4a3aa8'; rrect(g, 28, -100, 22, 44, 10); g.fill(); g.stroke();
  g.strokeStyle = '#6b4423'; g.lineWidth = 5; g.beginPath(); g.moveTo(58, -140); g.lineTo(56, -6); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(30,10,10,.7)';
  const pulse = 1 + 0.15 * Math.sin(t * 6);
  const og = g.createRadialGradient(58, -146, 2, 58, -146, 26 * pulse);
  og.addColorStop(0, '#fff'); og.addColorStop(0.35, '#e0a8ff'); og.addColorStop(1, 'rgba(160,80,255,0)');
  g.fillStyle = og; g.beginPath(); g.arc(58, -146, 26 * pulse, 0, TAU); g.fill();
  dot(g, 58, -146, 9, '#d9a0ff', true);
  // 顔・帽子
  g.fillStyle = '#1b1530'; g.beginPath(); g.arc(0, -112, 20, 0, TAU); g.fill(); g.stroke();
  ell(g, -7, -112, 4, 3, '#ff5cf0'); ell(g, 7, -112, 4, 3, '#ff5cf0');
  g.fillStyle = '#4a36b8';
  g.beginPath(); g.moveTo(-36, -122); g.quadraticCurveTo(0, -134, 36, -122); g.quadraticCurveTo(0, -112, -36, -122); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-22, -126); g.quadraticCurveTo(-10, -170, 24, -186); g.quadraticCurveTo(12, -160, 22, -126); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffd36a'; g.fillRect(-24, -130, 48, 5);
  // 周回する魔法球
  for (let i = 0; i < 3; i++) {
    const a = t * 1.8 + i * TAU / 3;
    dot(g, Math.cos(a) * 62, -70 + Math.sin(a) * 16, 7 + Math.sin(a) * 1.5, '#caa0ff', true);
  }
}

// 3: 炎の巨人 ----------------------------------------------------------
function fire(g, t) {
  const bob = Math.sin(t * 3) * 2;
  g.fillStyle = '#5a2a22';
  rrect(g, -34, -38, 28, 38, 8); g.fill(); g.stroke();
  rrect(g, 6, -38, 28, 38, 8); g.fill(); g.stroke();
  g.translate(0, bob * 0.5);
  g.fillStyle = '#7a2e22'; rrect(g, -70, -98, 24, 54, 10); g.fill(); g.stroke();
  dot(g, -58, -40, 13, '#7a2e22', true);
  g.fillStyle = '#8a3426'; rrect(g, -46, -104, 92, 72, 22); g.fill(); g.stroke();
  // マグマのひび
  const gl = 0.7 + 0.3 * Math.sin(t * 4);
  g.strokeStyle = 'rgba(255,190,60,' + gl.toFixed(2) + ')'; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(-20, -96); g.lineTo(-8, -76); g.lineTo(-22, -60); g.lineTo(-10, -42);
  g.moveTo(22, -94); g.lineTo(12, -72); g.lineTo(28, -56); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(30,10,10,.7)';
  g.fillStyle = '#7a2e22'; rrect(g, 46, -100, 24, 50, 10); g.fill(); g.stroke();
  dot(g, 58, -46, 13, '#7a2e22', true);
  // 炎のハンマー
  g.fillStyle = '#4a3020'; poly(g, [52, -50, 64, -50, 72, -118, 58, -122], '#4a3020', true);
  rrect(g, 44, -156, 52, 38, 8); g.fillStyle = '#555'; g.fill(); g.stroke();
  const fl = g.createLinearGradient(0, -190, 0, -150);
  fl.addColorStop(0, 'rgba(255,220,80,0)'); fl.addColorStop(1, 'rgba(255,140,30,.9)');
  g.fillStyle = fl;
  for (let i = 0; i < 4; i++) {
    const fx = 50 + i * 13, h2 = 22 + Math.sin(t * 9 + i * 1.7) * 8;
    poly(g, [fx - 6, -156, fx, -156 - h2, fx + 6, -156], fl);
  }
  // 頭と炎の髪
  dot(g, 0, -118, 22, '#a0452e', true);
  for (let i = 0; i < 7; i++) {
    const ang = Math.PI + (i / 6) * Math.PI, hh = 26 + Math.sin(t * 8 + i * 1.3) * 9;
    const bx = Math.cos(ang) * 20, by = -118 + Math.sin(ang) * 20;
    poly(g, [bx - 6, by + 2, Math.cos(ang) * (20 + hh), -118 + Math.sin(ang) * (20 + hh), bx + 6, by + 2], i % 2 ? '#ffb13a' : '#ff6a2a');
  }
  ell(g, -8, -116, 4, 3, '#ffe27a'); ell(g, 8, -116, 4, 3, '#ffe27a');
  g.strokeStyle = '#2a1410'; g.beginPath(); g.moveTo(-8, -102); g.lineTo(8, -102); g.stroke();
}

// 4: 氷王 --------------------------------------------------------------
function ice(g, t) {
  const bob = Math.sin(t * 2.2) * 2;
  g.fillStyle = '#5b86b8';
  rrect(g, -30, -38, 24, 38, 8); g.fill(); g.stroke();
  rrect(g, 6, -38, 24, 38, 8); g.fill(); g.stroke();
  g.translate(0, bob * 0.5);
  // マント
  g.fillStyle = '#2f5fb0';
  g.beginPath(); g.moveTo(-50, -104); g.lineTo(50, -104); g.lineTo(66, -10); g.lineTo(-66, -10); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(0, -104); g.lineTo(50, -104); g.lineTo(66, -10); g.lineTo(0, -10); g.closePath(); g.fill();
  // 鎧
  g.fillStyle = '#bfe6ff'; rrect(g, -38, -100, 76, 62, 18); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.55)'; rrect(g, -30, -94, 18, 40, 8); g.fill();
  g.fillStyle = '#7fd0ff'; poly(g, [0, -92, 14, -70, 0, -48, -14, -70], '#7fd0ff', true);
  // 肩氷
  poly(g, [-56, -100, -44, -138, -24, -102], '#d8f4ff', true);
  poly(g, [56, -100, 44, -138, 24, -102], '#d8f4ff', true);
  // 腕と氷剣
  g.fillStyle = '#a8d6f5'; rrect(g, 40, -98, 20, 44, 9); g.fill(); g.stroke();
  poly(g, [54, -54, 66, -54, 62, -170, 58, -184], '#e8f8ff', true);
  g.fillStyle = '#6b8fb8'; g.fillRect(48, -58, 24, 6);
  g.fillStyle = '#a8d6f5'; rrect(g, -60, -98, 20, 44, 9); g.fill(); g.stroke();
  // 頭と王冠
  dot(g, 0, -118, 20, '#e6d2c0', true);
  ell(g, -7, -116, 3.6, 2.8, '#2a8aff'); ell(g, 7, -116, 3.6, 2.8, '#2a8aff');
  g.fillStyle = '#fff';
  poly(g, [-14, -106, 14, -106, 10, -90, 0, -84, -10, -90], '#f4fbff', true);
  g.fillStyle = '#9adfff';
  poly(g, [-22, -130, -26, -156, -12, -138, -6, -164, 0, -138, 6, -164, 12, -138, 26, -156, 22, -130], '#9adfff', true);
  // 舞う雪
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 8; i++) {
    const sx = Math.sin(i * 12.9 + t * 0.6) * 70, sy = -170 + ((t * 28 + i * 31) % 190);
    dot(g, sx, sy, 2.2 + (i % 3), 'rgba(255,255,255,.85)');
  }
}

const DRAW = [oni, golem, sorcerer, fire, ice];

// 描画: (px,py)は足元中央、hは画面上の高さ(px)
BM.drawBoss = function (ctx, kind, px, py, h, t, hurt) {
  const u = h / 140;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(u, u);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,10,10,0.7)';
  // 影
  ctx.fillStyle = 'rgba(30,20,30,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 0, 52, 11, 0, 0, TAU); ctx.fill();
  DRAW[kind](ctx, t);
  if (hurt > 0) {
    ctx.globalAlpha = Math.min(0.5, hurt);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -70, 70, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
};
})(window.BM = window.BM || {});
