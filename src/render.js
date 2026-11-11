// Draws the yard. The unchanging scenery is painted once into a cached layer; each frame draws the
// sky, that layer, then the moving things, then the lighting for the time of day and weather.
import { drawCat, drawBird, drawMouse, drawButterfly, drawCrow, drawItem } from './draw_cat.js';
import { hourOf, sunOf, moonPos, moonLight, beamOf } from './sim/world.js';
import { buildOps, drawPainting } from './sim/art.js';
import { slotPos } from './sim/offerings.js';
import { frogSpot } from './sim/frog.js';
import { mulberry32, clamp } from './sim/util.js';
import { dither } from './dither.js';

export const LW = 960, LH = 600;
const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, 6.2832); };
const persp = y => 0.92 + clamp((y - 236) / 336) * 0.62;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`; };

const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
const hueOf = str => { let n = 0; for (let i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) >>> 0; return n % 360; };

// the welcome mat by the glass where offerings are left, and the stump with the tablet on it
function drawMat(g, m) {
  const x = m.x, y = m.y;
  g.fillStyle = 'rgba(0,0,0,0.16)'; rr(g, x - 45, y - 8, 92, 24, 5); g.fill();
  g.fillStyle = '#7a3f34'; rr(g, x - 43, y - 10, 86, 22, 5); g.fill();
  g.fillStyle = '#c99a5b'; rr(g, x - 40, y - 7, 80, 16, 3); g.fill();
  g.fillStyle = '#e8cf9a'; rr(g, x - 37, y - 4, 74, 10, 2); g.fill();
  g.strokeStyle = 'rgba(122,63,52,0.5)'; g.lineWidth = 1.6; g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(x + i * 15 - 5, y - 4); g.lineTo(x + i * 15 + 5, y + 6); } g.stroke();
}
function drawTabletStand(g, t) {
  const x = t.x, y = t.y;
  g.fillStyle = 'rgba(0,0,0,0.18)'; ell(g, x, y + 11, 18, 5); g.fill();
  g.fillStyle = '#7a5a43'; g.fillRect(x - 11, y + 2, 22, 9); ell(g, x, y + 11, 11, 4); g.fill();
  g.fillStyle = '#a07a58'; ell(g, x, y + 2, 11, 4.2); g.fill();
  g.fillStyle = '#22232b'; rr(g, x - 12, y - 30, 24, 32, 3); g.fill();
  g.fillStyle = '#10131c'; rr(g, x - 10, y - 28, 20, 28, 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.09)'; g.beginPath(); g.moveTo(x - 10, y - 28); g.lineTo(x - 1, y - 28); g.lineTo(x - 10, y - 13); g.fill();
}

// ---------- things the cat makes ----------
function drawBark(g, x, y, s = 1, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.fillStyle = '#5d3f2b'; g.beginPath(); g.moveTo(-6, -2); g.lineTo(-3, -4.4); g.lineTo(4, -3.6); g.lineTo(6.4, -0.4); g.lineTo(4, 3); g.lineTo(-3.4, 3.6); g.closePath(); g.fill();
  g.fillStyle = '#8a6244'; g.beginPath(); g.moveTo(-5, -1.6); g.lineTo(-2.6, -3.4); g.lineTo(3.6, -2.8); g.lineTo(5.2, -0.2); g.lineTo(-1, 0.6); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(40,24,14,0.55)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-3, 0.8); g.lineTo(3.6, 1.2); g.moveTo(-2, 2.2); g.lineTo(2, 2.4); g.stroke();
  g.restore();
}
function drawTwig(g, x, y, s = 1, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.strokeStyle = '#6a4a33'; g.lineWidth = 1.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-7, 1); g.lineTo(7, -1); g.moveTo(1, -0.2); g.lineTo(5, -4); g.moveTo(-3, 0.5); g.lineTo(-5, 3.6); g.stroke();
  g.strokeStyle = '#9a7650'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-6, 0.4); g.lineTo(6, -1.4); g.stroke(); g.restore();
}
function drawTwine(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = 'rgba(0,0,0,0.18)'; ell(g, 0, 2, 6, 2); g.fill();
  g.strokeStyle = '#d9bf84'; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ell(g, 0, -i * 0.9, 5.4 - i * 0.7, 2.8 - i * 0.3); g.stroke(); }
  g.strokeStyle = '#d9bf84'; g.lineWidth = 1; g.beginPath(); g.moveTo(5, 0); g.quadraticCurveTo(9, 3, 11, 1); g.stroke(); g.restore();
}
const MATS = { bark: drawBark, twig: drawTwig, twine: drawTwine };
// the bark table: legs and top, the frames it has made along the back edge, and the stash on top
function drawTable(g, w) {
  const s = w.stash.site, c = w.cat, x = s.x, y = s.y;
  g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, x, y + 17, 38, 8); g.fill();
  g.fillStyle = '#4d3424'; for (const dx of [-27, -9, 9, 27]) g.fillRect(x + dx - 1.8, y + 3, 3.6, 15);
  g.fillStyle = '#6b4a35'; rr(g, x - 36, y - 8, 72, 14, 3); g.fill();
  g.fillStyle = '#9a7650'; rr(g, x - 35, y - 9, 70, 10, 3); g.fill();
  g.strokeStyle = 'rgba(60,38,22,0.45)'; g.lineWidth = 0.9; g.beginPath(); for (let i = -3; i <= 3; i++) { g.moveTo(x + i * 10 - 3, y - 7); g.lineTo(x + i * 10 + 3, y - 1); } g.stroke();
  const frames = c.crafted.filter(m => m.recipe === 'frame' && m.work).slice(0, 3); // (only the ones hung round a painting)
  frames.forEach((m, i) => { const fx = x - 24 + i * 24, fy = y - 21, hu = hueOf(m.work || 'x'); g.fillStyle = '#5d3f2b'; g.fillRect(fx - 7, fy - 2, 14, 12); g.fillStyle = `hsl(${hu},45%,62%)`; g.fillRect(fx - 5.2, fy - 0.4, 10.4, 8.8); g.fillStyle = `hsl(${(hu + 70) % 360},50%,45%)`; g.fillRect(fx - 5.2, fy + 4, 10.4, 4.4); g.fillStyle = '#5d3f2b'; g.fillRect(fx - 1, fy + 9, 2, 3); });
  const items = w.stash.items.slice().sort((a, b) => a.oy - b.oy).slice(-60);
  for (const it of items) drawItem(g, it.type, it.color, x + it.ox, y + it.oy - 4, 4.3, it.rot);
}
function drawPile(g, w) {
  const inv = w.cat.inv, base = w.table ? { x: w.o.table.x + 52, y: w.o.table.y + 12 } : { x: w.o.tree.x - 40, y: w.o.tree.y + 10 };
  let n = 0;
  for (let i = 0; i < Math.min(5, inv.bark); i++) drawBark(g, base.x + (i % 3) * 7 - 6, base.y - Math.floor(i / 3) * 3 + (i % 2), 0.9, (i * 0.7) % 1.2 - 0.5);
  for (let i = 0; i < Math.min(4, inv.twig); i++) drawTwig(g, base.x - 4 + i * 4, base.y + 5 + (i % 2) * 2, 0.85, (i * 0.9) % 1 - 0.3);
  if (inv.twine > 0) drawTwine(g, base.x + 14, base.y + 3, 0.9);
  n += inv.bark + inv.twig + inv.twine; return n;
}
function drawFeeder(g, w, t) {
  const x = 872, y = 352; g.fillStyle = 'rgba(0,0,0,0.18)'; ell(g, x, y + 3, 11, 3.4); g.fill();
  g.fillStyle = '#6b4a35'; g.fillRect(x - 2, y - 32, 4, 34);
  g.fillStyle = '#9a7650'; rr(g, x - 13, y - 38, 26, 7, 2); g.fill(); g.fillStyle = '#c26a4f'; g.beginPath(); g.moveTo(x - 17, y - 38); g.lineTo(x, y - 49); g.lineTo(x + 17, y - 38); g.closePath(); g.fill();
  g.fillStyle = '#e6c46a'; for (let i = 0; i < 6; i++) g.fillRect(x - 10 + i * 3.6, y - 39.4, 1.8, 1.4);
}
function drawCatTree(g, w, t) {
  const x = w.catTree.x, y = w.catTree.y, top = 52;
  g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, x, y + 4, 22, 6); g.fill();
  g.fillStyle = '#7a5a43'; ell(g, x, y + 1, 19, 6); g.fill(); g.fillStyle = '#9a7650'; ell(g, x, y - 1, 19, 5.2); g.fill();      // base
  g.fillStyle = '#d3bb8e'; g.fillRect(x - 3.5, y - top, 7, top); g.strokeStyle = 'rgba(120,90,50,0.55)'; g.lineWidth = 0.8;        // sisal post
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(x - 3.5, y - top + 3 + i * 5.2); g.lineTo(x + 3.5, y - top + 6 + i * 5.2); g.stroke(); }
  g.fillStyle = '#7a553b'; rr(g, x - 15, y - 36, 30, 22, 3); g.fill(); g.fillStyle = '#a07a58'; rr(g, x - 13, y - 34, 26, 18, 2); g.fill();  // the box
  g.fillStyle = '#1e1a22'; ell(g, x, y - 23, 6, 6.4); g.fill();
  g.fillStyle = '#7a5a43'; ell(g, x, y - top + 2, 18, 6); g.fill(); g.fillStyle = '#a07a58'; ell(g, x, y - top, 18, 5.4); g.fill();   // the top
  g.fillStyle = '#c4a47c'; ell(g, x - 3, y - top - 1, 11, 2.4); g.fill();
  const sw = Math.sin(t * 1.6) * 1.6; g.strokeStyle = '#d9bf84'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + 14, y - top + 1); g.lineTo(x + 18 + sw, y - top + 12); g.stroke();
  g.fillStyle = '#d8453b'; ell(g, x + 18 + sw, y - top + 14, 2.6, 2.6); g.fill();                                                        // a toy on a string
}
function drawChime(g, w, t) {
  const x = 862, y = 262, sway = Math.sin(t * 1.3) * 1.6 + Math.sin(t * 3.1) * 0.8 * (w.weather.cloud + 0.2);
  g.strokeStyle = '#d9bf84'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke();
  g.fillStyle = '#9a7650'; ell(g, x, y + 5, 9, 2.8); g.fill();
  [[-6, 14], [-2, 20], [2, 16], [6, 22]].forEach(([dx, len], i) => { const sx = x + dx + sway * (0.3 + i * 0.1); g.strokeStyle = '#d9bf84'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x + dx, y + 6); g.lineTo(sx, y + 6 + 3); g.stroke(); g.fillStyle = i % 2 ? '#c9d4dc' : '#aebcc7'; g.fillRect(sx - 1.2, y + 9, 2.4, len); });
}
const SKY = [[0, '#0b1130', '#1c2757'], [5, '#141c4a', '#33407a'], [6.3, '#6c5a9c', '#f2a67a'], [8, '#6fb0e6', '#d8eefa'], [12, '#4f9ee0', '#cfe8f7'], [16.5, '#5fa6e0', '#f4e6c2'], [18.5, '#d9704f', '#f7c77a'], [20, '#3b2f6c', '#c5688a'], [21.5, '#101a3a', '#27315e'], [24, '#0b1130', '#1c2757']];
const TINT = [[0, 20, 28, 70, 0.5], [5, 24, 30, 80, 0.46], [6.3, 255, 150, 100, 0.18], [8, 255, 220, 180, 0.04], [12, 255, 255, 255, 0], [16.5, 255, 230, 190, 0.05], [18.5, 255, 120, 70, 0.2], [20, 70, 45, 110, 0.36], [21.5, 20, 28, 70, 0.5], [24, 20, 28, 70, 0.5]];
function key(tab, h) { let i = 0; while (i < tab.length - 2 && h > tab[i + 1][0]) i++; const a = tab[i], b = tab[i + 1], t = clamp((h - a[0]) / (b[0] - a[0])); return [a, b, t]; }
const skyAt = h => { const [a, b, t] = key(SKY, h); return [mix(a[1], b[1], t), mix(a[2], b[2], t)]; };
const tintAt = h => { const [a, b, t] = key(TINT, h); const L = i => Math.round(a[i] + (b[i] - a[i]) * t); return { c: `rgb(${L(1)},${L(2)},${L(3)})`, a: a[4] + (b[4] - a[4]) * t }; };

// The scene is drawn small (about TARGET_W pixels across), dithered to a limited palette, then stretched up
// by a whole number so every art pixel is the same size on screen.
const TARGET_W = 560;

export function createRenderer(canvas) {
  const out = canvas.getContext('2d', { alpha: false }); out.imageSmoothingEnabled = false;
  const lo = document.createElement('canvas'), ctx = lo.getContext('2d', { alpha: false, willReadFrequently: true });
  let RW = 480, RH = 300, P = 2;
  const bg = document.createElement('canvas'), bgx = bg.getContext('2d');
  const easelC = document.createElement('canvas'); easelC.width = 240; easelC.height = 180; const ex = easelC.getContext('2d');
  const rng = mulberry32(7);
  const stars = Array.from({ length: 70 }, () => ({ x: rng() * LW, y: rng() * 170, r: 1.1 + rng() * 1.3, p: rng() * 6 }));
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: rng() * LW, y: 30 + rng() * 110, s: 0.7 + rng() * 0.9, v: 4 + rng() * 6, i }));
  const skyL = document.createElement('canvas'), skx = skyL.getContext('2d');
  const opsCache = new Map(); let easelKey = '', k = 1, dpr = 1;

  function resize(cssW) {
    dpr = Math.min(2, window.devicePixelRatio || 1); const dev = Math.round(cssW * dpr);
    P = Math.max(2, Math.round(dev / TARGET_W)); RW = Math.max(240, Math.round(dev / P)); RH = Math.round(RW * LH / LW);
    canvas.width = RW * P; canvas.height = RH * P; out.imageSmoothingEnabled = false;
    for (const c of [lo, bg, skyL]) { c.width = RW; c.height = RH; }
    k = RW / LW;
    paintStatic();
  }

  const o_mat = { x: 372, y: 540 }, o_tab = { x: 600, y: 322 };
  function paintStatic() {
    const g = bgx, r = mulberry32(11); g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, LW, LH);
    // hills
    for (const [y, col, amp, f, ph] of [[196, '#7d9bb8', 18, 0.012, 1], [214, '#6a9477', 12, 0.02, 3]]) { g.fillStyle = col; g.beginPath(); g.moveTo(0, 250); for (let x = 0; x <= LW; x += 12) g.lineTo(x, y - Math.sin(x * f + ph) * amp - Math.sin(x * f * 2.7 + ph) * amp * 0.35); g.lineTo(LW, 250); g.closePath(); g.fill(); }
    // ground
    const gr = g.createLinearGradient(0, 232, 0, LH); gr.addColorStop(0, '#84b266'); gr.addColorStop(1, '#5a8c4c'); g.fillStyle = gr; g.fillRect(0, 232, LW, LH - 232);
    g.fillStyle = 'rgba(255,255,255,0.045)'; for (let i = -6; i < 16; i++) { g.beginPath(); g.moveTo(i * 120, 232); g.lineTo(i * 120 + 60, 232); g.lineTo(i * 120 + 60 - 140, LH); g.lineTo(i * 120 - 140, LH); g.fill(); }
    for (let i = 0; i < 160; i++) { const x = r() * LW, y = 244 + r() * 350, s = 3 + r() * 4; g.strokeStyle = r() < 0.5 ? 'rgba(52,100,48,0.5)' : 'rgba(150,200,110,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - s); g.moveTo(x, y); g.lineTo(x + 2, y - s * 0.9); g.stroke(); }
    // stepping stones from the cabin door to the bowls
    g.fillStyle = 'rgba(210,205,190,0.9)'; [[170, 312], [200, 330], [238, 344], [276, 356]].forEach(([x, y]) => { ell(g, x, y, 11, 5); g.fill(); g.fillStyle = 'rgba(0,0,0,0.12)'; ell(g, x + 1, y + 1.5, 11, 5); g.fill(); g.fillStyle = 'rgba(210,205,190,0.9)'; ell(g, x, y, 11, 5); g.fill(); });
    // mouse holes
    for (const h of [{ x: 430, y: 262 }, { x: 66, y: 372 }, { x: 902, y: 500 }]) { g.fillStyle = '#3a2d25'; ell(g, h.x, h.y, 9, 4); g.fill(); g.fillStyle = '#1c1512'; ell(g, h.x, h.y + 0.5, 6, 2.6); g.fill(); }
    // fence
    for (let x = -4; x < LW; x += 16) { g.fillStyle = (x / 16) % 2 ? '#d8b78c' : '#cfa97c'; g.beginPath(); g.moveTo(x, 242); g.lineTo(x, 214); g.lineTo(x + 7, 207); g.lineTo(x + 14, 214); g.lineTo(x + 14, 242); g.fill(); }
    g.fillStyle = '#a97f55'; g.fillRect(0, 222, LW, 4); g.fillRect(0, 234, LW, 4); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 242, LW, 3);
    g.fillStyle = '#b98a5e'; g.fillRect(514, 192, 14, 52); g.fillStyle = '#d6a878'; g.beginPath(); g.moveTo(511, 192); g.lineTo(521, 184); g.lineTo(531, 192); g.fill();
    // pond
    g.fillStyle = '#4a7a63'; ell(g, 640, 474, 92, 35); g.fill();
    const wg = g.createLinearGradient(0, 440, 0, 500); wg.addColorStop(0, '#6bb4de'); wg.addColorStop(1, '#3b84b6'); g.fillStyle = wg; ell(g, 640, 470, 84, 30); g.fill();
    g.fillStyle = '#4f9a4e'; for (const [x, y, rr] of [[610, 478, 9], [668, 462, 8], [640, 486, 7]]) { ell(g, x, y, rr, rr * 0.45); g.fill(); }
    g.strokeStyle = '#3d7a3c'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(560 + i * 5, 476); g.lineTo(556 + i * 5, 450 - (i % 3) * 5); g.stroke(); }
    // flower bed
    g.fillStyle = '#5a4130'; ell(g, 716, 556, 98, 22); g.fill();
    const fc = ['#e86a92', '#f2c14e', '#fff2f2', '#b48ae0', '#ff8a5c']; for (let i = 0; i < 26; i++) { const x = 628 + r() * 176, y = 546 + r() * 20; g.strokeStyle = '#3f7d3e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 14 - r() * 6); g.stroke(); g.fillStyle = fc[i % 5]; ell(g, x, y - 16 - r() * 5, 4.4, 4.4); g.fill(); g.fillStyle = '#f7dc6f'; ell(g, x, y - 16, 1.4, 1.4); g.fill(); }
    // bowls, cushion, post
    g.fillStyle = '#b84a3e'; ell(g, 318, 356, 16, 8); g.fill(); g.fillStyle = '#d96a5c'; ell(g, 318, 353, 14, 6.5); g.fill();
    g.fillStyle = '#3a6fb0'; ell(g, 366, 362, 16, 8); g.fill(); g.fillStyle = '#7fc0ee'; ell(g, 366, 359, 13.5, 6); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.14)'; ell(g, 222, 386, 32, 11); g.fill(); g.fillStyle = '#c4768c'; ell(g, 222, 380, 29, 12); g.fill(); g.fillStyle = '#d98fa2'; ell(g, 222, 377, 24, 9); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.16)'; ell(g, 258, 492, 22, 7); g.fill(); g.fillStyle = '#8a6a4b'; ell(g, 258, 490, 19, 6); g.fill(); g.fillStyle = '#c9b184'; g.fillRect(251, 440, 14, 50);
    g.strokeStyle = '#a28b60'; g.lineWidth = 1.4; for (let y = 444; y < 490; y += 5) { g.beginPath(); g.moveTo(251, y); g.lineTo(265, y + 3); g.stroke(); } g.fillStyle = '#8a6a4b'; ell(g, 258, 440, 11, 4); g.fill();
    drawMat(g, o_mat); drawTabletStand(g, o_tab);
    // (the easel is drawn with the moving things, because the cat has to build it first)
    // tree
    g.fillStyle = 'rgba(0,0,0,0.16)'; ell(g, 826, 326, 46, 10); g.fill();
    g.fillStyle = '#6b4a35'; g.beginPath(); g.moveTo(808, 328); g.quadraticCurveTo(814, 280, 812, 200); g.lineTo(834, 200); g.quadraticCurveTo(832, 280, 842, 328); g.fill();
    for (const [x, y, rx, ry, c] of [[790, 214, 56, 44, '#3b7a43'], [858, 220, 54, 42, '#3f8447'], [822, 170, 66, 52, '#468f4f'], [800, 150, 40, 32, '#52a05a'], [852, 160, 42, 34, '#4a9553']]) { g.fillStyle = c; ell(g, x, y, rx, ry); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.07)'; ell(g, 804, 140, 30, 18); g.fill();
    // cabin
    g.fillStyle = 'rgba(0,0,0,0.16)'; ell(g, 150, 296, 90, 10); g.fill();
    g.fillStyle = '#b98258'; g.fillRect(90, 236, 120, 54); g.strokeStyle = 'rgba(70,40,25,0.4)'; g.lineWidth = 1; for (let y = 246; y < 290; y += 9) { g.beginPath(); g.moveTo(90, y); g.lineTo(210, y); g.stroke(); }
    g.fillStyle = '#4e7d86'; g.beginPath(); g.moveTo(72, 240); g.lineTo(150, 186); g.lineTo(228, 240); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.18)'; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(72 + i * 7, 240 - i * 10.8); g.lineTo(228 - i * 7, 240 - i * 10.8); g.stroke(); }
    g.fillStyle = '#7a5a48'; g.fillRect(184, 200, 14, 24);
    g.fillStyle = '#2b1f1c'; g.beginPath(); g.moveTo(132, 290); g.lineTo(132, 266); g.quadraticCurveTo(150, 250, 168, 266); g.lineTo(168, 290); g.fill();
    g.fillStyle = '#f2d98c'; g.fillRect(100, 254, 18, 16); g.fillRect(182, 254, 18, 16); g.strokeStyle = '#6a4a38'; g.lineWidth = 2; g.strokeRect(100, 254, 18, 16); g.strokeRect(182, 254, 18, 16);
    g.fillStyle = '#6a4a38'; g.fillRect(108.5, 254, 1.4, 16); g.fillRect(190.5, 254, 1.4, 16);
  }

  const cache = w => { const id = w.easel && w.easel.work && w.easel.work.id; if (!id) return null; if (!opsCache.has(id)) { opsCache.set(id, buildOps(w.easel.work, 240, 180)); if (opsCache.size > 6) opsCache.delete(opsCache.keys().next().value); } return opsCache.get(id); };

  function celestial(g, w, t, h, sun, night, wt, s1) {
    if (night > 0.3) { g.fillStyle = '#fff'; for (const s of stars) { g.globalAlpha = clamp(night - 0.3) * (1 - wt.cloud * 0.8) * (0.55 + 0.45 * Math.sin(t * 1.5 + s.p)); ell(g, s.x, s.y, s.r, s.r); g.fill(); } g.globalAlpha = 1; }
    const mt = w.meteor; // a shooting star: a bright head and a tail of fading pixels
    if (mt && night > 0.3) { const p = clamp(mt.t / mt.dur), fade = (p > 0.7 ? (1 - p) / 0.3 : 1) * (1 - wt.cloud * 0.8), hx = mt.x0 + mt.dx * p, hy = mt.y0 + mt.dy * p;
      for (let i = 0; i < 22; i++) { const f = i / 22; g.globalAlpha = clamp((1 - f * 0.85) * fade); g.fillStyle = f < 0.35 ? '#ffffff' : '#e6f0ff'; const s = Math.max(2, 4.5 - f * 3.5); g.fillRect(Math.round(hx - mt.dx * 0.34 * f - s / 2), Math.round(hy - mt.dy * 0.34 * f - s / 2), s, s); }
      g.globalAlpha = clamp(0.28 * fade); const gl = g.createRadialGradient(hx, hy, 1, hx, hy, 22); gl.addColorStop(0, 'rgba(255,252,220,0.95)'); gl.addColorStop(1, 'rgba(255,252,220,0)'); g.fillStyle = gl; g.fillRect(hx - 22, hy - 22, 44, 44); g.globalAlpha = 1; }
    if (sun > 0.05 && h > 5.5 && h < 19.5) { const f = clamp((h - 6) / 12.5), x = 80 + f * 800, y = 190 - Math.sin(f * Math.PI) * 136; g.globalAlpha = (1 - wt.cloud * 0.7) * sun; const gl = g.createRadialGradient(x, y, 4, x, y, 56); gl.addColorStop(0, 'rgba(255,240,170,0.9)'); gl.addColorStop(1, 'rgba(255,240,170,0)'); g.fillStyle = gl; g.fillRect(x - 60, y - 60, 120, 120); g.fillStyle = '#fff4b8'; ell(g, x, y, 15, 15); g.fill(); g.globalAlpha = 1; }
    const mp = moonPos(w);
    if (mp) { const lit = moonLight(w), ph = w.mysteries ? ((w.clock / w.dayLen) | 0) % 8 : 0; g.save(); g.globalAlpha = clamp(night * 1.4) * (1 - wt.cloud * 0.6); const gl = g.createRadialGradient(mp.x, mp.y, 6, mp.x, mp.y, 46); gl.addColorStop(0, `rgba(255,250,214,${0.35 * lit + 0.1})`); gl.addColorStop(1, 'rgba(255,250,214,0)'); g.fillStyle = gl; g.fillRect(mp.x - 50, mp.y - 50, 100, 100);
      g.beginPath(); g.arc(mp.x, mp.y, 15, 0, 6.2832); g.clip(); g.fillStyle = '#f6efcf'; g.fillRect(mp.x - 16, mp.y - 16, 32, 32); const off = (1 - lit) * 32 * (ph < 4 ? -1 : 1); g.fillStyle = s1; ell(g, mp.x + off * 0.5 + (ph < 4 ? -4 : 4) * (1 - lit), mp.y, 15, 16); g.fill(); g.restore(); }
  }

  function draw(w, t) {
    const g = ctx, h = hourOf(w), sun = sunOf(h), night = 1 - sun, wt = w.weather, c = w.cat, o = w.o;
    g.setTransform(k, 0, 0, k, 0, 0);
    const [s0, s1] = skyAt(h), sg = g.createLinearGradient(0, 0, 0, 240); sg.addColorStop(0, s0); sg.addColorStop(1, s1); g.fillStyle = sg; g.fillRect(0, 0, LW, 250);
    // clouds
    const cl = clamp(wt.cloud * 1.15); if (cl > 0.05) for (const q of clouds) { const x = ((q.x + t * q.v) % (LW + 240)) - 120; g.globalAlpha = cl * (q.i % 2 ? 0.75 : 0.95); g.fillStyle = wt.rain > 0.4 ? '#8b95a8' : mix('#ffffff', '#8a90a8', night * 0.8); for (const [dx, dy, rx, ry] of [[0, 0, 44, 15], [-26, 4, 28, 11], [26, 5, 30, 11], [6, -8, 26, 12]]) { ell(g, x + dx * q.s, q.y + dy * q.s, rx * q.s, ry * q.s); g.fill(); } } g.globalAlpha = 1;

    g.drawImage(bg, 0, 0, LW, LH);

    // sunbeam
    const bm = beamOf(w); if (bm.on) { const gb = g.createRadialGradient(bm.x, bm.y, 4, bm.x, bm.y, 52); gb.addColorStop(0, `rgba(255,236,160,${0.5 * bm.str})`); gb.addColorStop(1, 'rgba(255,236,160,0)'); g.fillStyle = gb; ell(g, bm.x, bm.y, 52, 22); g.fill(); }
    // water shimmer, ripple, frog
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { const x = 600 + i * 28 + Math.sin(t * 0.6 + i) * 6, y = 458 + (i % 2) * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y); g.stroke(); }
    if (w.ripple) { const r = w.ripple, u = r.t / 5, px = o.pond.x + r.dx, py = o.pond.y + r.dy; for (let i = 0; i < 3; i++) { const uu = clamp(u * 1.4 - i * 0.18); if (uu <= 0 || uu >= 1) continue; g.globalAlpha = (1 - uu) * 0.7; g.strokeStyle = '#eaf6ff'; g.lineWidth = 1.4; ell(g, px, py, 6 + uu * 26, 2.5 + uu * 10); g.stroke(); } g.globalAlpha = 1;
      if (r.frog && !w.frog && r.t > 0.4 && r.t < 3.6) { g.fillStyle = '#58a65a'; ell(g, px, py - 2, 6, 4); g.fill(); g.fillStyle = '#6fc06f'; ell(g, px - 3, py - 6, 2.2, 2.2); g.fill(); ell(g, px + 3, py - 6, 2.2, 2.2); g.fill(); g.fillStyle = '#1e1a22'; ell(g, px - 3, py - 6, 0.8, 0.8); g.fill(); ell(g, px + 3, py - 6, 0.8, 0.8); g.fill(); } }
    // a fish in the pond (the cat can hunt it), and the splash when a swipe lands in the water
    if (w.fish) {
      const f = w.fish, dir = f.dir || 1, wag = Math.sin(f.wag || 0) * 1.6, fade = f.spooked ? clamp(1 - (f.t - f.spookT) / 1.4) : clamp(f.t / 1.2) * clamp((f.life - f.t) / 2);
      g.save(); g.globalAlpha = 0.9 * fade;
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(f.x - dir * 12, f.y + 1, 8, 1.6, 0, 0, 6.283); g.fill(); // wake
      g.fillStyle = '#e8892e'; ell(g, f.x, f.y, 7.5, 3.2); g.fill();
      g.beginPath(); g.moveTo(f.x - dir * 6, f.y); g.lineTo(f.x - dir * 12, f.y - 3.4 + wag); g.lineTo(f.x - dir * 12, f.y + 3.4 + wag); g.closePath(); g.fill();
      g.fillStyle = '#f6c389'; ell(g, f.x + dir * 1, f.y - 0.6, 4, 1.2); g.fill();
      g.fillStyle = '#1e1a22'; ell(g, f.x + dir * 4.6, f.y - 0.9, 0.8, 0.8); g.fill();
      g.restore();
    }
    for (const sp of w.fx || []) {
      const u = clamp(sp.t / 1.6); g.save(); g.strokeStyle = '#eaf6ff'; g.fillStyle = '#eaf6ff';
      for (let i = 0; i < 2; i++) { const uu = clamp(u * 1.3 - i * 0.2); if (uu <= 0 || uu >= 1) continue; g.globalAlpha = (1 - uu) * 0.8; g.lineWidth = 1.4; g.beginPath(); g.ellipse(sp.x, sp.y, 4 + uu * 20, 1.6 + uu * 7, 0, 0, 6.283); g.stroke(); }
      if (u < 0.55) for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + sp.x, r = u * 18, h = Math.sin(u / 0.55 * Math.PI) * 11; g.globalAlpha = (1 - u / 0.55) * 0.9; g.beginPath(); g.arc(sp.x + Math.cos(a) * r, sp.y - h + Math.sin(a) * r * 0.35, 1.3, 0, 6.283); g.fill(); }
      g.restore();
    }
    // the frog that became the cat's friend: on a lily pad at the near edge when it is up
    if (w.frog && w.frog.out) {
      const f = w.frog, fs = frogSpot(w), hop = Math.sin(clamp(f.hop) * Math.PI) * 5, px = fs.fx, py = fs.fy - hop, visiting = w.cat.act.type === 'frog' && w.cat.act.phase === 'do';
      g.fillStyle = '#3f8a4a'; ell(g, fs.fx, fs.fy + 2, 11, 4); g.fill();
      g.fillStyle = '#58a65a'; ell(g, px, py - 3, 6.5, 4.4); g.fill();
      g.fillStyle = '#6fc06f'; ell(g, px - 3.2, py - 7.2, 2.4, 2.4); g.fill(); ell(g, px + 3.2, py - 7.2, 2.4, 2.4); g.fill();
      g.fillStyle = '#1e1a22'; ell(g, px - 3.2, py - 7.2, 0.9, 0.9); g.fill(); ell(g, px + 3.2, py - 7.2, 0.9, 0.9); g.fill();
      const th = 0.5 + 0.5 * Math.sin(t * 3 + f.t); g.fillStyle = '#a6d99a'; ell(g, px, py - 1.2, 3 + th * 0.8, 1.5 + th * 0.8); g.fill();
      if (visiting) { g.fillStyle = '#e780ab'; for (let i = 0; i < 3; i++) { const u = ((t * 0.7 + i / 3) % 1); g.globalAlpha = 1 - u; ell(g, px - 9 + i * 8 + Math.sin(t * 2 + i) * 2, py - 11 - u * 14, 1.5, 1.5); g.fill(); } g.globalAlpha = 1; }
    }
    // bowls contents
    g.fillStyle = '#8a5a3a'; ell(g, 318, 353, 11 * clamp(o.bowl.food * 1.4, 0.001, 1), 4.6 * clamp(o.bowl.food * 1.4, 0.001, 1)); g.fill();

    // stash
    if (w.stash.site && w.stash.site.table) drawTable(g, w); else if (w.stash.site) { const s = w.stash.site; g.fillStyle = 'rgba(40,28,20,0.55)'; ell(g, s.x, s.y + 3, 38, 15); g.fill(); g.fillStyle = '#6b4a35'; ell(g, s.x, s.y + 2, 30, 11); g.fill(); g.fillStyle = '#4d6f3f'; for (let i = 0; i < 6; i++) { ell(g, s.x - 28 + i * 11, s.y + 11 + (i % 2) * 3, 6, 2.6, 0.3 * i); g.fill(); }
      const items = w.stash.items.slice().sort((a, b) => a.oy - b.oy).slice(-48); for (const it of items) drawItem(g, it.type, it.color, s.x + it.ox, s.y + it.oy, 4.6, it.rot); }
    // what the cat has made and gathered
    if (w.deco && w.deco.feeder) drawFeeder(g, w, t);
    if (w.deco && w.deco.chime) drawChime(g, w, t);
    if (w.catTree) drawCatTree(g, w, t);
    drawPile(g, w);
    const dr = c.act && c.act.type === 'play' && c.act.drop; if (dr) { const u = Math.min(1, c.act.t * 2.4); g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, dr.x, dr.y + 3, 6, 2); g.fill(); MATS[dr.type](g, dr.x, dr.y - (1 - u) * 14 - 1, 1.15, u * 1.3); g.globalAlpha = 0.5 + 0.4 * Math.sin(t * 9); g.fillStyle = '#fff6c0'; ell(g, dr.x + 7, dr.y - 7, 1.6, 1.6); g.fill(); g.globalAlpha = 1; }
    // things on the ground
    for (const it of w.items) { g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, it.x, it.y + 2, 6, 2); g.fill(); const wob = Math.sin(t * 3 + it.x) * 0.5; if (MATS[it.type]) MATS[it.type](g, it.x, it.y - 1, 1.1 * persp(it.y)); else drawItem(g, it.type, it.color, it.x, it.y - 1.5, 6.4 * persp(it.y), wob); if (it.moon) { for (let i = 0; i < 4; i++) { const u = (t * 0.8 + i / 4) % 1; g.globalAlpha = Math.sin(u * 3.14); g.fillStyle = '#fff6c8'; const a = i * 1.7 + t * 0.6; g.fillRect(it.x + Math.cos(a) * 11 - 0.8, it.y - 6 - u * 10 + Math.sin(a) * 3, 1.6, 1.6); } g.globalAlpha = 1; }
      if (it.age < 4) { g.globalAlpha = 1 - it.age / 4; g.strokeStyle = '#fff'; ell(g, it.x, it.y, 10 + it.age * 6, 5 + it.age * 3); g.stroke(); g.globalAlpha = 1; } }
    for (const tr of w.treats) { g.fillStyle = '#e9a05a'; ell(g, tr.x, tr.y, 6, 3.6); g.fill(); g.fillStyle = '#c47a38'; ell(g, tr.x + 1.4, tr.y - 0.6, 2.6, 1.4); g.fill(); }
    const y = o.yarn; g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, y.x, y.y + 6, 9, 3); g.fill(); g.fillStyle = '#d8453b'; ell(g, y.x, y.y, 8, 8); g.fill(); g.strokeStyle = '#f08a80'; g.lineWidth = 1.2; g.beginPath(); g.arc(y.x, y.y, 5, 0.3, 2.6); g.moveTo(y.x - 7, y.y - 2); g.quadraticCurveTo(y.x, y.y + 3, y.x + 7, y.y - 3); g.stroke();
    g.strokeStyle = '#d8453b'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(y.x - 7, y.y + 4); g.quadraticCurveTo(y.x - 18, y.y + 10, y.x - 26, y.y + 6); g.stroke();

    // offerings on the mat
    for (const off of w.offers || []) {
      const sp = slotPos(w, off.slot);
      if (off.kind === 'item') { g.fillStyle = 'rgba(0,0,0,0.22)'; ell(g, sp.x, sp.y + 2, 7, 2.4); g.fill(); drawItem(g, off.type, off.color, sp.x, sp.y - 1.5, 9, 0); }
      else if (off.kind === 'material') { if (off.type === 'bark') { drawBark(g, sp.x - 3, sp.y, 1.15, -0.2); drawBark(g, sp.x + 4, sp.y - 1.5, 1.15, 0.3); } else if (off.type === 'twig') { drawTwig(g, sp.x, sp.y - 1, 1.25, -0.1); drawTwig(g, sp.x + 1, sp.y + 2, 1.1, 0.2); } else drawTwine(g, sp.x, sp.y - 1, 1.2); }
      else { g.save(); g.translate(sp.x, sp.y - 1); g.rotate(-0.12); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(-6, -3, 14, 10); g.fillStyle = '#f6f0dc'; g.fillRect(-7, -5, 14, 10); g.fillStyle = 'rgba(90,70,50,0.55)'; for (let i = 0; i < 3; i++) g.fillRect(-5, -3 + i * 3, 10 - (i === 2 ? 4 : 0), 1.2); g.fillStyle = '#d9453b'; ell(g, 4.5, 3, 1.6, 1.6); g.fill(); g.restore(); }
      if (off.state === 'new') { g.globalAlpha = 0.45 + 0.4 * Math.sin(t * 4); g.strokeStyle = '#fff6c0'; g.lineWidth = 1.6; ell(g, sp.x, sp.y, 13, 5.5); g.stroke(); g.globalAlpha = 1; }
    }
    // the tablet screen while the cat is using it
    const ta = c.act && c.act.type === 'tablet' && c.act.phase !== 'go' ? c.act : null;
    if (ta) {
      const T = o.tablet, sx = T.x - 10, sy = T.y - 28;
      const gl = g.createRadialGradient(T.x, T.y - 14, 2, T.x, T.y - 14, 36); gl.addColorStop(0, 'rgba(150,205,255,0.4)'); gl.addColorStop(1, 'rgba(150,205,255,0)'); g.fillStyle = gl; g.fillRect(T.x - 40, T.y - 52, 80, 80);
      if (ta.phase === 'boot') { g.fillStyle = `rgba(205,230,255,${0.5 + 0.4 * Math.sin(t * 12)})`; rr(g, sx, sy, 20, 28, 2); g.fill(); }
      else if (ta.phase === 'write') { g.fillStyle = '#f6f1de'; rr(g, sx, sy, 20, 28, 2); g.fill(); g.fillStyle = '#c9b57e'; g.fillRect(sx, sy, 20, 4); g.fillStyle = 'rgba(70,60,40,0.7)'; const nl = Math.min(6, 1 + Math.floor(ta.t * 1.1)); for (let i = 0; i < nl; i++) g.fillRect(sx + 3, sy + 8 + i * 3.2, i === nl - 1 ? 3 + ((ta.t * 6) % 9) : 14, 1.3); if (Math.sin(t * 8) > 0) g.fillRect(sx + 3, sy + 8 + (nl - 1) * 3.2 - 1, 1.4, 3.4); }
      else if (ta.phase === 'wait') { g.fillStyle = '#17264a'; rr(g, sx, sy, 20, 28, 2); g.fill(); g.fillStyle = '#3d5fa8'; g.fillRect(sx + 3, sy + 13, 14, 2.4); g.fillStyle = '#9fd0ff'; g.fillRect(sx + 3 + ((t * 9) % 12), sy + 13, 5, 2.4); }
      else if (ta.phase === 'read' && ta.page) { const hu = hueOf(ta.page.title); g.fillStyle = '#f3f1ea'; rr(g, sx, sy, 20, 28, 2); g.fill(); g.fillStyle = `hsl(${hu},55%,52%)`; g.fillRect(sx, sy, 20, 5); g.fillStyle = `hsl(${(hu + 40) % 360},45%,70%)`; g.fillRect(sx + 3, sy + 7, 14, 7); g.fillStyle = 'rgba(60,60,70,0.7)'; for (let i = 0; i < 5; i++) g.fillRect(sx + 3, sy + 16 + i * 2.4, i === 4 ? 8 : 14, 1.2); }
      else { g.fillStyle = '#2a1818'; rr(g, sx, sy, 20, 28, 2); g.fill(); g.strokeStyle = '#e0604f'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(sx + 6, sy + 9); g.lineTo(sx + 14, sy + 19); g.moveTo(sx + 14, sy + 9); g.lineTo(sx + 6, sy + 19); g.stroke(); }
    }

    // the easel, once it has been built: legs, then the canvas
    if (w.easelMade) {
    g.strokeStyle = '#8a6244'; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(498, 424); g.lineTo(508, 346); g.moveTo(542, 424); g.lineTo(532, 346); g.moveTo(520, 416); g.lineTo(520, 440); g.stroke();
    const ops = cache(w), ew = 64, eh = 48, ex0 = o.easel.x - ew / 2, ey0 = o.easel.y - 78;
    g.fillStyle = '#7a553b'; g.fillRect(ex0 - 4, ey0 - 4, ew + 8, eh + 8);
    if (ops) { const prog = w.easel.progress, kk = w.easel.work.id + ':' + Math.round(prog * 60); if (kk !== easelKey) { easelKey = kk; ex.clearRect(0, 0, 240, 180); drawPainting(ex, 240, 180, ops, prog); } g.fillStyle = '#f4efe4'; g.fillRect(ex0, ey0, ew, eh); g.drawImage(easelC, ex0, ey0, ew, eh); } else { g.fillStyle = '#f4efe4'; g.fillRect(ex0, ey0, ew, eh); }
    g.fillStyle = '#7a553b'; g.fillRect(ex0 - 4, ey0 + eh + 4, ew + 8, 4);
    }

    // sorted actors
    const list = [];
    if (!c.hidden) list.push({ y: c.y, f: () => drawCat(g, c, t, persp(c.y)) });
    w.mice.forEach(m => list.push({ y: m.y, f: () => drawMouse(g, m, t, persp(m.y)) }));
    w.birds.forEach(b => { if (b.state === 'away') return; if (b.state === 'fly') return; list.push({ y: b.y, f: () => { g.fillStyle = 'rgba(0,0,0,0.18)'; ell(g, b.x, b.y, 6, 2); g.fill(); drawBird(g, b, t, persp(b.y)); } }); });
    list.sort((a, b) => a.y - b.y).forEach(e => e.f());
    // cat in the cabin
    if (c.pose === 'inside' || c.pose === 'peek') { const hx = o.house.x, hy = 280; if (c.pose === 'peek') { g.fillStyle = '#e9913a'; g.fillStyle = ({ orange: '#e9913a', grey: '#9ba1ab', black: '#36323e', calico: '#f3efe6' })[c.coat]; ell(g, hx, hy - 2, 9, 7); g.fill(); g.fillStyle = '#e8c53c'; ell(g, hx - 3.4, hy - 3.5, 1.8, 2.2); g.fill(); ell(g, hx + 3.4, hy - 3.5, 1.8, 2.2); g.fill(); g.fillStyle = '#1e1a22'; ell(g, hx - 3.4, hy - 3.5, 0.7, 1.6); g.fill(); ell(g, hx + 3.4, hy - 3.5, 0.7, 1.6); g.fill(); }
      else { g.strokeStyle = '#fff'; g.lineWidth = 1.8; g.lineJoin = 'miter'; for (let i = 0; i < 3; i++) { const u = (t * 0.6 + i / 3) % 1, zx = hx + 22 + i * 7 + u * 8, zy = hy - 24 - u * 22, z = 2.6 + i * 0.8; g.globalAlpha = 0.9 - u * 0.9; g.beginPath(); g.moveTo(zx - z, zy - z); g.lineTo(zx + z, zy - z); g.lineTo(zx - z, zy + z); g.lineTo(zx + z, zy + z); g.stroke(); } g.globalAlpha = 1; } }
    // flyers
    w.flies.forEach(f => f.on && drawButterfly(g, f, t, persp(f.y)));
    w.birds.forEach(b => b.state === 'fly' && drawBird(g, b, t, persp(b.y)));
    if (w.thief && w.stash.site) drawCrow(g, w.thief, t, w.stash.site.x, w.stash.site.y);
    // glowing fireflies
    if (night > 0.2) { g.globalCompositeOperation = 'lighter'; for (const s of w.sparks) { if (!s.on) continue; const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 + s.ph * 3)), sy = s.y - s.z; const gl = g.createRadialGradient(s.x, sy, 0, s.x, sy, 14); gl.addColorStop(0, `rgba(230,255,120,${0.9 * a})`); gl.addColorStop(1, 'rgba(230,255,120,0)'); g.fillStyle = gl; g.fillRect(s.x - 14, sy - 14, 28, 28); } g.globalCompositeOperation = 'source-over'; }

    // lighting
    const tn = tintAt(h); const gt = g.createLinearGradient(0, 150, 0, 240); gt.addColorStop(0, 'rgba(0,0,0,0)'); g.globalAlpha = 1;
    g.fillStyle = tn.c; g.globalAlpha = tn.a * 0.85 + wt.cloud * 0.12; g.fillRect(0, 0, LW, LH); g.globalAlpha = 1;
    if (night > 0.3 || (sun > 0.05 && h > 5.5 && h < 19.5)) {
      skx.setTransform(k, 0, 0, k, 0, 0); skx.clearRect(0, 0, LW, LH); celestial(skx, w, t, h, sun, night, wt, s1);
      skx.setTransform(1, 0, 0, 1, 0, 0); skx.globalCompositeOperation = 'destination-out'; skx.drawImage(bg, 0, 0); skx.globalCompositeOperation = 'source-over';
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(skyL, 0, 0); g.setTransform(k, 0, 0, k, 0, 0);
    }
    if (wt.rain > 0.05) { g.strokeStyle = `rgba(210,228,250,${0.75 * wt.rain})`; g.lineWidth = 1.9; g.beginPath(); for (let i = 0; i < 110; i++) { const x = (i * 97 + t * 90) % (LW + 40) - 20, yy = (i * 53 + t * 560 + i * 11) % (LH + 40) - 20; g.moveTo(x, yy); g.lineTo(x - 5, yy + 14); } g.stroke(); g.fillStyle = `rgba(60,80,110,${0.12 * wt.rain})`; g.fillRect(0, 0, LW, LH); }
    // faint glass sheen along the bottom
    const gs = g.createLinearGradient(0, LH - 40, 0, LH); gs.addColorStop(0, 'rgba(255,255,255,0)'); gs.addColorStop(1, 'rgba(255,255,255,0.08)'); g.fillStyle = gs; g.fillRect(0, LH - 40, LW, 40);
    // dither the finished frame, then blow it up to the screen
    g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(dither().apply(g.getImageData(0, 0, RW, RH)), 0, 0);
    out.drawImage(lo, 0, 0, RW * P, RH * P);
  }
  return { resize, draw, persp, canvas };
}
