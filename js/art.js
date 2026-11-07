/* 描画アセット: 兵士・敵・ボスをプログラムで描く（画像ファイル不要） */
(function (BM) {
'use strict';
const TAU = Math.PI * 2;
const LINE = 'rgba(10,20,50,0.6)';

function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
BM.rrect = rrect;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  return [c, g];
}
function circle(g, x, y, r, fill, stroke, lw) {
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.stroke(); }
}

// 共通パーツ ---------------------------------------------------------
function shadow(g, rx) {
  g.fillStyle = 'rgba(30,40,60,0.28)';
  g.beginPath(); g.ellipse(32, 74, rx || 19, 5.5, 0, 0, TAU); g.fill();
}
function boots(g, col) {
  g.fillStyle = col || '#5b3a24';
  rrect(g, 19, 64, 11, 9, 3); g.fill();
  rrect(g, 34, 64, 11, 9, 3); g.fill();
}
function cape(g, main, dark, wide) {
  const w = wide || 0;
  g.fillStyle = main; g.strokeStyle = LINE; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(21 - w, 33); g.lineTo(43 + w, 33); g.lineTo(50 + w, 68); g.lineTo(14 - w, 68); g.closePath();
  g.fill(); g.stroke();
  g.globalAlpha = 0.5; g.fillStyle = dark;
  g.beginPath(); g.moveTo(33, 33); g.lineTo(43 + w, 33); g.lineTo(50 + w, 68); g.lineTo(33, 68); g.closePath(); g.fill();
  g.globalAlpha = 1;
}
function face(g, red) {
  g.fillStyle = '#f1c9a0'; g.strokeStyle = LINE; g.lineWidth = 2.2;
  g.beginPath(); g.arc(32, 26, 11, 0, TAU); g.fill(); g.stroke();
}
function eyes(g, angry) {
  g.fillStyle = '#222';
  g.beginPath(); g.arc(28, 28, 1.7, 0, TAU); g.fill();
  g.beginPath(); g.arc(36, 28, 1.7, 0, TAU); g.fill();
  if (angry) {
    g.strokeStyle = '#222'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(25, 24.5); g.lineTo(30, 26); g.moveTo(39, 24.5); g.lineTo(34, 26); g.stroke();
  }
}
function hands(g, skin) {
  g.fillStyle = skin || '#f1c9a0';
  g.beginPath(); g.arc(14, 55, 3.6, 0, TAU); g.fill();
  g.beginPath(); g.arc(50, 55, 3.6, 0, TAU); g.fill();
}
function arms(g, col) {
  g.fillStyle = col; g.strokeStyle = LINE; g.lineWidth = 2;
  g.beginPath(); g.arc(17, 45, 6.5, 0, TAU); g.fill(); g.stroke();
  g.beginPath(); g.arc(47, 45, 6.5, 0, TAU); g.fill(); g.stroke();
}

// 剣士 ---------------------------------------------------------------
function spriteSword() {
  const [c, g] = canvas(64, 80);
  const P = { main: '#2f7df0', dark: '#1b4fb8', light: '#9bd0ff', trim: '#ffd36a' };
  shadow(g); boots(g); cape(g, P.main, P.dark);
  g.fillStyle = P.trim; g.fillRect(19, 52, 26, 4);
  arms(g, P.main); hands(g);
  // 剣
  g.fillStyle = '#e4eaf2'; g.strokeStyle = LINE; g.lineWidth = 1.6;
  g.fillRect(51, 26, 5.5, 30); g.strokeRect(51, 26, 5.5, 30);
  g.beginPath(); g.moveTo(51, 26); g.lineTo(53.7, 20); g.lineTo(56.5, 26); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#b8862e'; g.fillRect(47, 55, 13, 4); g.fillRect(52, 58, 4, 6);
  // 盾
  g.fillStyle = '#eef6ff'; g.strokeStyle = LINE; g.lineWidth = 2.2;
  g.beginPath(); g.arc(11, 54, 10, 0, TAU); g.fill(); g.stroke();
  circle(g, 11, 54, 4.5, P.main);
  face(g);
  // 兜
  g.fillStyle = P.main; g.strokeStyle = LINE; g.lineWidth = 2.4;
  g.beginPath(); g.arc(32, 23, 13.5, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = P.dark; g.fillRect(18.5, 22, 27, 4);
  g.fillStyle = P.light; g.globalAlpha = 0.8;
  g.beginPath(); g.ellipse(26, 15.5, 4.5, 2.6, -0.5, 0, TAU); g.fill(); g.globalAlpha = 1;
  g.fillStyle = P.trim;
  g.beginPath(); g.moveTo(29, 10); g.lineTo(32, 3); g.lineTo(35, 10); g.closePath(); g.fill();
  eyes(g);
  return c;
}

// 弓兵 ---------------------------------------------------------------
function spriteArcher() {
  const [c, g] = canvas(64, 80);
  const P = { main: '#2f86e8', dark: '#1b55b8', hood: '#2fb585', hoodD: '#1f7f5e' };
  shadow(g, 17); boots(g, '#4a3220'); cape(g, P.main, P.dark, -2);
  // 矢筒
  g.fillStyle = '#7a4e2a'; g.strokeStyle = LINE; g.lineWidth = 1.8;
  g.save(); g.translate(44, 36); g.rotate(0.35);
  g.fillRect(-4, -4, 8, 22); g.strokeRect(-4, -4, 8, 22); g.restore();
  g.strokeStyle = '#fff6d2'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(46, 33); g.lineTo(48, 27); g.moveTo(49, 34); g.lineTo(52, 28); g.stroke();
  g.fillStyle = '#d33'; g.fillRect(47, 26, 2.4, 3); g.fillRect(51, 27, 2.4, 3);
  g.fillStyle = '#f2c14e'; g.fillRect(19, 52, 26, 3.6);
  arms(g, P.main); hands(g);
  // 弓
  g.strokeStyle = '#8a5a2e'; g.lineWidth = 3.6;
  g.beginPath(); g.moveTo(54, 30); g.quadraticCurveTo(66, 50, 54, 70); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(54, 30); g.lineTo(54, 70); g.stroke();
  face(g);
  // フード
  g.fillStyle = P.hood; g.strokeStyle = LINE; g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(17.5, 29); g.quadraticCurveTo(15, 8, 32, 6); g.quadraticCurveTo(49, 8, 46.5, 29);
  g.lineTo(41, 23); g.quadraticCurveTo(32, 15, 23, 23); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = P.hoodD; g.globalAlpha = 0.5;
  g.beginPath(); g.moveTo(32, 6); g.quadraticCurveTo(49, 8, 46.5, 29); g.lineTo(41, 23); g.quadraticCurveTo(36, 17, 32, 15); g.closePath(); g.fill(); g.globalAlpha = 1;
  // 羽根
  g.fillStyle = '#fff'; g.strokeStyle = LINE; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(38, 10); g.quadraticCurveTo(50, 0, 54, 8); g.quadraticCurveTo(46, 8, 40, 14); g.closePath(); g.fill(); g.stroke();
  eyes(g);
  return c;
}

// 重装兵 -------------------------------------------------------------
function spriteHeavy() {
  const [c, g] = canvas(64, 80);
  const P = { steel: '#a9b9cc', steelD: '#6d7f96', blue: '#2f7df0', dark: '#1b4fb8' };
  shadow(g, 23); boots(g, '#3b4452');
  // 胴（鎧）
  g.fillStyle = P.steel; g.strokeStyle = LINE; g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(15, 32); g.lineTo(49, 32); g.lineTo(54, 68); g.lineTo(10, 68); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = P.steelD; g.globalAlpha = 0.5;
  g.beginPath(); g.moveTo(33, 32); g.lineTo(49, 32); g.lineTo(54, 68); g.lineTo(33, 68); g.closePath(); g.fill(); g.globalAlpha = 1;
  // タバード（青）
  g.fillStyle = P.blue; g.strokeStyle = LINE; g.lineWidth = 2;
  g.beginPath(); g.moveTo(24, 34); g.lineTo(40, 34); g.lineTo(42, 68); g.lineTo(22, 68); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffd36a'; g.fillRect(14, 52, 36, 4);
  // 肩当て
  circle(g, 12, 38, 9, P.steel, LINE, 2.2); circle(g, 52, 38, 9, P.steel, LINE, 2.2);
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.beginPath(); g.ellipse(9.5, 34.5, 3.4, 2, -0.5, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(49.5, 34.5, 3.4, 2, -0.5, 0, TAU); g.fill();
  // 大盾
  g.fillStyle = '#eef6ff'; g.strokeStyle = LINE; g.lineWidth = 2.6;
  rrect(g, 0, 36, 24, 34, 8); g.fill(); g.stroke();
  g.fillStyle = P.blue;
  rrect(g, 4, 40, 16, 26, 5); g.fill();
  g.fillStyle = '#fff';
  g.fillRect(10.5, 44, 3, 18); g.fillRect(6.5, 50, 11, 3);
  // メイス
  g.fillStyle = '#6b4423'; g.strokeStyle = LINE; g.lineWidth = 1.6;
  g.fillRect(53, 34, 4.5, 28); g.strokeRect(53, 34, 4.5, 28);
  circle(g, 55.2, 30, 7, '#9aa5b5', LINE, 2);
  // 兜（フルフェイス）
  g.fillStyle = P.steel; g.strokeStyle = LINE; g.lineWidth = 2.6;
  g.beginPath(); g.arc(32, 25, 14, Math.PI, TAU); g.lineTo(46, 36); g.lineTo(18, 36); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = P.steelD; g.globalAlpha = 0.5; g.fillRect(32, 11, 14, 25); g.globalAlpha = 1;
  g.fillStyle = '#1d2736'; rrect(g, 21, 23, 22, 6, 2); g.fill();
  g.fillStyle = '#ffe9a8'; g.fillRect(24, 25, 4, 2); g.fillRect(36, 25, 4, 2);
  g.fillStyle = P.blue; g.strokeStyle = LINE; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(32, 11); g.quadraticCurveTo(26, 0, 38, 2); g.quadraticCurveTo(34, 6, 36, 12); g.closePath(); g.fill(); g.stroke();
  return c;
}

// 魔法兵 -------------------------------------------------------------
function spriteMage() {
  const [c, g] = canvas(64, 80);
  const P = { main: '#5b55e0', dark: '#3a32a8', trim: '#ffd36a' };
  shadow(g, 18); boots(g, '#2c2a4a');
  // ローブ
  g.fillStyle = P.main; g.strokeStyle = LINE; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(22, 33); g.lineTo(42, 33); g.lineTo(52, 70); g.lineTo(12, 70); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = P.dark; g.globalAlpha = 0.5;
  g.beginPath(); g.moveTo(33, 33); g.lineTo(42, 33); g.lineTo(52, 70); g.lineTo(33, 70); g.closePath(); g.fill(); g.globalAlpha = 1;
  g.fillStyle = P.trim; g.fillRect(13, 64, 38, 3.6);
  g.fillStyle = '#ffd36a';
  for (const [sx, sy] of [[26, 48], [38, 56], [30, 62]]) {
    g.beginPath(); g.moveTo(sx, sy - 3); g.lineTo(sx + 1, sy - 1); g.lineTo(sx + 3, sy - 1); g.lineTo(sx + 1.4, sy + 0.6); g.lineTo(sx + 2, sy + 3); g.lineTo(sx, sy + 1.4); g.lineTo(sx - 2, sy + 3); g.lineTo(sx - 1.4, sy + 0.6); g.lineTo(sx - 3, sy - 1); g.lineTo(sx - 1, sy - 1); g.closePath(); g.fill();
  }
  arms(g, P.main); hands(g);
  // 杖
  g.strokeStyle = '#8a5a2e'; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(52, 22); g.lineTo(50, 66); g.stroke();
  const gl = g.createRadialGradient(52, 18, 1, 52, 18, 11);
  gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.4, '#8ee8ff'); gl.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(52, 18, 11, 0, TAU); g.fill();
  circle(g, 52, 18, 4.6, '#9af0ff', LINE, 1.6);
  face(g);
  // 帽子
  g.fillStyle = P.main; g.strokeStyle = LINE; g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(14, 24); g.quadraticCurveTo(32, 18, 50, 24); g.quadraticCurveTo(48, 28, 32, 28); g.quadraticCurveTo(16, 28, 14, 24); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(20, 23); g.quadraticCurveTo(26, 8, 40, -1); g.quadraticCurveTo(38, 10, 44, 23); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = P.dark; g.globalAlpha = 0.5;
  g.beginPath(); g.moveTo(33, 12); g.quadraticCurveTo(38, 10, 40, -1); g.quadraticCurveTo(38, 10, 44, 23); g.lineTo(33, 23); g.closePath(); g.fill(); g.globalAlpha = 1;
  g.fillStyle = P.trim; g.fillRect(20, 20, 24, 3.4);
  eyes(g);
  return c;
}

// 敵（赤い兵士） -------------------------------------------------------
function spriteRed(elite) {
  const [c, g] = canvas(64, 80);
  const P = elite
    ? { main: '#b3201c', dark: '#6e0f0d', light: '#ff9b90', trim: '#ffcf4a' }
    : { main: '#e8423b', dark: '#a2231f', light: '#ff9b90', trim: '#3a2a2a' };
  shadow(g); boots(g); cape(g, P.main, P.dark);
  g.fillStyle = P.trim; g.fillRect(19, 52, 26, 4);
  arms(g, P.main); hands(g);
  g.fillStyle = '#cfd5de'; g.strokeStyle = LINE; g.lineWidth = 1.6;
  g.fillRect(52, 30, 5, 26); g.strokeRect(52, 30, 5, 26);
  g.fillStyle = '#6b4423'; g.fillRect(49, 55, 11, 4);
  if (elite) {
    g.fillStyle = '#4a4f5c'; g.strokeStyle = LINE; g.lineWidth = 2;
    circle(g, 13, 38, 8, '#4a4f5c', LINE, 2); circle(g, 51, 38, 8, '#4a4f5c', LINE, 2);
  }
  face(g);
  g.fillStyle = P.main; g.strokeStyle = LINE; g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(18.5, 27); g.lineTo(32, 0.5); g.lineTo(45.5, 27);
  g.lineTo(40, 21); g.quadraticCurveTo(32, 17, 24, 21);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = P.light; g.globalAlpha = 0.6;
  g.beginPath(); g.moveTo(27, 18); g.lineTo(31, 7); g.lineTo(32, 18); g.closePath(); g.fill(); g.globalAlpha = 1;
  if (elite) {
    g.fillStyle = '#f2e6c8'; g.strokeStyle = LINE; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(19, 22); g.lineTo(8, 10); g.lineTo(24, 18); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(45, 22); g.lineTo(56, 10); g.lineTo(40, 18); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = P.trim; g.fillRect(22, 21, 20, 3);
  }
  eyes(g, true);
  return c;
}

BM.art = {
  spr: null,
  icons: {},
  make() {
    this.spr = {
      sword: spriteSword(), archer: spriteArcher(), heavy: spriteHeavy(), mage: spriteMage(),
      red: spriteRed(false), elite: spriteRed(true),
    };
    // UI用アイコン（DataURL）
    for (const k of Object.keys(this.spr)) {
      try { this.icons[k] = this.spr[k].toDataURL('image/png'); } catch (e) { this.icons[k] = ''; }
    }
  },
};
})(window.BM = window.BM || {});
