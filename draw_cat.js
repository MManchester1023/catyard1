// Drawing the cat and the other animals. Local coordinates face right, feet on y = 0.
const COAT = {
  orange: { body: '#e9913a', mark: '#c26a1f', belly: '#f6d8a8', eye: '#8cc457', ear: '#f0a8a0' },
  grey: { body: '#9ba1ab', mark: '#6f7581', belly: '#dcdfe5', eye: '#d8c04a', ear: '#e2aeb0' },
  black: { body: '#36323e', mark: '#201e27', belly: '#4b4756', eye: '#e8c53c', ear: '#7b5560' },
  calico: { body: '#f3efe6', mark: '#e9913a', mark2: '#37333f', belly: '#fffaf0', eye: '#8cc457', ear: '#f0b0a8' },
};

const POSE = {
  stand: { bx: 0, by: -15, rx: 17, ry: 9, rot: 0, hx: 18, hy: -26, legs: 'stand', tail: 'up' },
  walk: { bx: 0, by: -15, rx: 17, ry: 9, rot: 0, hx: 18, hy: -26, legs: 'walk', tail: 'up' },
  run: { bx: 0, by: -13, rx: 19, ry: 8, rot: 0.06, hx: 21, hy: -22, legs: 'run', tail: 'out' },
  sit: { bx: -3, by: -14, rx: 11, ry: 15, rot: -0.28, hx: 6, hy: -35, legs: 'sit', tail: 'curl' },
  crouch: { bx: 0, by: -8, rx: 18, ry: 6, rot: 0, hx: 19, hy: -10, hr: 0.1, legs: 'crouch', tail: 'low' },
  pounce: { bx: 0, by: -14, rx: 19, ry: 7, rot: -0.35, hx: 21, hy: -27, legs: 'leap', tail: 'out' },
  eat: { bx: -3, by: -13, rx: 16, ry: 8, rot: 0.28, hx: 19, hy: -8, legs: 'stand', tail: 'low' },
  drink: { bx: -3, by: -13, rx: 16, ry: 8, rot: 0.28, hx: 19, hy: -8, legs: 'stand', tail: 'low' },
  groom: { bx: -3, by: -14, rx: 11, ry: 15, rot: -0.22, hx: 4, hy: -31, hr: 0.55, legs: 'sit', tail: 'curl' },
  scratch: { bx: 3, by: -22, rx: 17, ry: 8, rot: -1.2, hx: 11, hy: -39, legs: 'rear', tail: 'down' },
  climb: { bx: 3, by: -22, rx: 17, ry: 8, rot: -1.2, hx: 11, hy: -39, legs: 'rear', tail: 'down' },
  swat: { bx: -3, by: -14, rx: 11, ry: 15, rot: -0.28, hx: 7, hy: -34, legs: 'swat', tail: 'curl' },
  watch: { bx: -3, by: -14, rx: 11, ry: 15, rot: -0.28, hx: 6, hy: -35, legs: 'sit', tail: 'hang' },
  gaze: { bx: -3, by: -14, rx: 11, ry: 15, rot: -0.2, hx: 5, hy: -35, hr: -0.75, legs: 'sit', tail: 'curl' },
  paint: { bx: -3, by: -14, rx: 11, ry: 15, rot: -0.28, hx: 7, hy: -35, hr: 0.12, legs: 'paint', tail: 'curl' },
  tend: { bx: -3, by: -14, rx: 11, ry: 15, rot: -0.2, hx: 7, hy: -30, hr: 0.4, legs: 'tend', tail: 'curl' },
  sleep: { bx: 0, by: -8, rx: 17, ry: 9, rot: 0, hx: 13, hy: -9, hr: 0.55, legs: 'tuck', tail: 'wrap', closed: true },
};

const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, 6.2832); };
function limb(g, x0, y0, x1, y1, w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }

export function drawCat(g, c, t, scale) {
  const col = COAT[c.coat] || COAT.orange, pose = c.pose === 'inside' || c.pose === 'peek' ? 'stand' : c.pose;
  g.save(); g.translate(c.x, c.y - c.z); g.scale(scale, scale);
  // ground shadow stays on the ground even when leaping
  if (c.z > 0) { g.save(); g.translate(0, c.z / scale); g.fillStyle = 'rgba(0,0,0,0.18)'; ell(g, 0, 0, 16, 4); g.fill(); g.restore(); }
  else { g.fillStyle = 'rgba(0,0,0,0.2)'; ell(g, 0, 1, pose === 'sleep' ? 20 : 15, 4.5); g.fill(); }
  if (pose === 'front') { drawFront(g, c, col, t); g.restore(); return; }
  if (c.face < 0) g.scale(-1, 1);
  const P = POSE[pose] || POSE.stand;
  const walk = Math.sin(c.legT * 1.6), run = Math.sin(c.legT * 1.1);
  const bob = pose === 'walk' ? Math.abs(Math.sin(c.legT * 1.6)) * -1.2 : pose === 'run' ? Math.sin(c.legT * 1.1) * -2 : pose === 'sleep' ? Math.sin(t * 1.6) * 0.5 : 0;
  const wig = c.wig ? Math.sin(t * 38) * 2.2 : 0;
  const breathe = pose === 'sit' || pose === 'sleep' || pose === 'watch' ? Math.sin(t * 1.8) * 0.4 : 0;
  g.translate(wig, bob);

  // tail (behind body)
  g.strokeStyle = col.mark === '#c26a1f' || c.coat === 'orange' ? col.mark : col.body; g.lineWidth = 4.2; g.lineCap = 'round'; g.beginPath();
  const sway = Math.sin(t * 2.4) * 4, bx = P.bx - P.rx * 0.85;
  if (P.tail === 'up') { g.moveTo(bx, P.by); g.bezierCurveTo(bx - 12, P.by - 4, bx - 14, P.by - 20, bx - 6 + sway, P.by - 28); }
  else if (P.tail === 'out') { g.moveTo(bx, P.by); g.bezierCurveTo(bx - 10, P.by + 2, bx - 20, P.by - 2, bx - 28, P.by + 3 + sway * 0.5); }
  else if (P.tail === 'low') { g.moveTo(bx, P.by + 2); g.bezierCurveTo(bx - 8, P.by + 4, bx - 16, P.by + 3, bx - 22, P.by + 2 + sway * 0.4); }
  else if (P.tail === 'curl') { g.moveTo(bx + 3, -3); g.bezierCurveTo(bx - 10, 1, bx + 4, 3, 12, -2 + Math.sin(t * 1.5) * 1.2); }
  else if (P.tail === 'hang') { g.moveTo(bx + 2, -6); g.bezierCurveTo(bx - 8, -2, bx - 8, 8, bx - 6 + sway * 0.5, 16); }
  else if (P.tail === 'down') { g.moveTo(bx, P.by + 4); g.bezierCurveTo(bx - 6, P.by + 14, bx - 8, P.by + 22, bx - 8 + sway, P.by + 26); }
  else if (P.tail === 'wrap') { g.moveTo(-14, -6); g.bezierCurveTo(-22, -2, -10, 6, 8, 0); }
  g.stroke();

  // back legs and front legs
  const legCol = col.body, w = 4.6;
  const leg = (x, phase, front) => {
    let x1 = x, y1 = 0, y0 = P.by + 3 + (front ? 0 : 1);
    if (P.legs === 'walk') x1 = x + Math.sin(c.legT * 1.6 + phase) * 6;
    else if (P.legs === 'run') { x1 = x + Math.sin(c.legT * 1.1 + phase) * 10; y1 = -Math.max(0, Math.cos(c.legT * 1.1 + phase)) * 4; }
    else if (P.legs === 'leap') { x1 = x + (front ? 11 : -11); y1 = -6; }
    else if (P.legs === 'crouch') { y0 = -6; x1 = x + (front ? 3 : 0); }
    else if (P.legs === 'rear') { if (front) { x1 = x + 8; y1 = -34 + Math.sin(t * 9 + phase) * 3; y0 = -26; } else { x1 = x - 6; } }
    else if (P.legs === 'sit' || P.legs === 'tend' || P.legs === 'paint' || P.legs === 'swat') { if (front) { y0 = -22; x1 = x + 5; y1 = 0; } else { y0 = -9; x1 = x - 1; } }
    else if (P.legs === 'tuck') { y0 = -5; x1 = x + (front ? 8 : -6); y1 = -2; }
    if (P.legs === 'swat' && front && phase === 0) { x1 = x + 18; y1 = -22 + Math.sin(t * 22) * 4; y0 = -24; }
    if (P.legs === 'paint' && front && phase === 0) { x1 = x + 17 + Math.sin(t * 5) * 6; y1 = -28 + Math.cos(t * 7) * 6; y0 = -26; }
    if (P.legs === 'tend' && front) { x1 = x + 12 + Math.sin(t * 6 + phase) * 4; y1 = -3 + Math.cos(t * 6 + phase) * 2; }
    if (pose === 'groom' && front && phase === 0) { x1 = x + 6; y1 = -34; y0 = -22; }
    limb(g, x, y0, x1, y1, w, legCol); g.fillStyle = col.belly; ell(g, x1, y1 - 0.5, 3.1, 2.1); g.fill();
    return { x: x1, y: y1 };
  };
  leg(P.bx - P.rx * 0.55, Math.PI, false); leg(P.bx + P.rx * 0.5, 0.4, true);

  // body
  g.save(); g.translate(P.bx, P.by + breathe); g.rotate(P.rot);
  g.fillStyle = col.body; ell(g, 0, 0, P.rx, P.ry); g.fill();
  g.save(); ell(g, 0, 0, P.rx, P.ry); g.clip();
  if (c.coat === 'calico') { g.fillStyle = col.mark; ell(g, -6, -3, 9, 7); g.fill(); g.fillStyle = col.mark2; ell(g, 8, 2, 8, 6); g.fill(); }
  else if (c.coat !== 'black') { g.strokeStyle = col.mark; g.lineWidth = 2.2; g.lineCap = 'round'; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 6, -P.ry - 1); g.lineTo(i * 6 + 2, -P.ry * 0.35); g.stroke(); } }
  g.fillStyle = col.belly; ell(g, 2, P.ry * 0.7, P.rx * 0.7, P.ry * 0.5); g.fill(); g.restore();
  g.restore();
  const otherLeg = leg(P.bx + P.rx * 0.2, 2.8, true); leg(P.bx - P.rx * 0.2, 0.4 + Math.PI, false);

  // head
  const blink = Math.sin(t * 0.9 + c.age) > 0.985, closed = P.closed || blink;
  g.save(); g.translate(P.hx, P.hy + breathe + (pose === 'drink' ? Math.sin(t * 8) * 0.8 : 0)); g.rotate(P.hr || (pose === 'watch' ? Math.sin(t * 0.7) * 0.15 : 0));
  g.fillStyle = col.body;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 7.2 - 3, -4); g.lineTo(s * 6.5 + 1.2, -14.5); g.lineTo(s * 0.5 + 3.5 * s, -7.5); g.closePath(); g.fill(); g.fillStyle = col.ear; g.beginPath(); g.moveTo(s * 6 - 2, -5.5); g.lineTo(s * 5.8 + 0.8, -11.5); g.lineTo(s * 1.8 + 2.5 * s, -7); g.closePath(); g.fill(); g.fillStyle = col.body; }
  ell(g, 0, 0, 9, 8); g.fill();
  if (c.coat === 'calico') { g.fillStyle = col.mark; ell(g, -3, -3, 5, 4.5); g.fill(); }
  g.fillStyle = col.belly; ell(g, 3.2, 3, 4.6, 3.2); g.fill();
  const ex = 3.6, ey = -1.2;
  if (closed) { g.strokeStyle = '#2a2230'; g.lineWidth = 1.3; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * ex + 1.2, ey, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); } }
  else { for (const s of [-1, 1]) { g.fillStyle = col.eye; ell(g, s * ex + 1.6, ey, 2.5, 2.9); g.fill(); g.fillStyle = '#1e1a22'; ell(g, s * ex + 2.1, ey, 1, 2.3); g.fill(); g.fillStyle = 'rgba(255,255,255,0.85)'; ell(g, s * ex + 1.4, ey - 1, 0.7, 0.7); g.fill(); } }
  g.fillStyle = '#e48d8d'; ell(g, 6.2, 1.8, 1.2, 0.9); g.fill();
  g.strokeStyle = 'rgba(40,30,40,0.55)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(5.5, 3); g.lineTo(4.3, 4.2); g.moveTo(5.5, 3); g.lineTo(6.9, 4.2); g.stroke();
  for (const dy of [-0.6, 1]) { g.beginPath(); g.moveTo(8, 3 + dy); g.lineTo(15, 2 + dy * 2.2); g.stroke(); }
  if (c.carry) drawCarry(g, c.carry, 11, 5);
  g.restore();
  void otherLeg;
  g.restore();
}

function drawCarry(g, item, x, y) {
  if (item.type === 'mouse') { g.fillStyle = '#8b8790'; ell(g, x + 3, y, 5, 3); g.fill(); g.strokeStyle = '#b8a0a0'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 2, y); g.quadraticCurveTo(x - 8, y + 4, x - 12, y + 1); g.stroke(); return; }
  drawItem(g, item.type, item.color, x + 1, y + 1, 4);
}

function drawFront(g, c, col, t) {
  g.fillStyle = col.body; ell(g, 0, -17, 12, 17); g.fill(); g.fillStyle = col.belly; ell(g, 0, -14, 6.5, 11); g.fill();
  g.fillStyle = col.body; ell(g, -6, -2, 4, 3); g.fill(); ell(g, 6, -2, 4, 3); g.fill();
  g.strokeStyle = col.body; g.lineWidth = 4.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, -6); g.bezierCurveTo(24, -2, 22, -18, 16 + Math.sin(t * 2) * 3, -22); g.stroke();
  g.save(); g.translate(0, -35);
  g.fillStyle = col.body; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 9, -3); g.lineTo(s * 8, -15); g.lineTo(s * 2, -7); g.closePath(); g.fill(); g.fillStyle = col.ear; g.beginPath(); g.moveTo(s * 7.6, -5); g.lineTo(s * 7, -11); g.lineTo(s * 3.4, -7); g.closePath(); g.fill(); g.fillStyle = col.body; }
  ell(g, 0, 0, 11, 9.5); g.fill();
  if (c.coat === 'calico') { g.fillStyle = col.mark; ell(g, -5, -3, 5, 5); g.fill(); }
  g.fillStyle = col.belly; ell(g, 0, 4.5, 5.5, 3.6); g.fill();
  const blink = Math.sin(t * 0.8 + c.age) > 0.98;
  for (const s of [-1, 1]) { if (blink) { g.strokeStyle = '#2a2230'; g.lineWidth = 1.2; g.beginPath(); g.arc(s * 4.4, -1, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); } else { g.fillStyle = col.eye; ell(g, s * 4.4, -1, 2.8, 3.1); g.fill(); g.fillStyle = '#1e1a22'; ell(g, s * 4.4, -1, 1.1, 2.6); g.fill(); g.fillStyle = 'rgba(255,255,255,0.85)'; ell(g, s * 4.4 - 0.6, -2, 0.8, 0.8); g.fill(); } }
  g.fillStyle = '#e48d8d'; ell(g, 0, 2.4, 1.4, 1); g.fill();
  g.strokeStyle = 'rgba(40,30,40,0.55)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, 3.4); g.lineTo(-1.8, 5); g.moveTo(0, 3.4); g.lineTo(1.8, 5); for (const s of [-1, 1]) { g.moveTo(s * 5, 3.5); g.lineTo(s * 13, 2); g.moveTo(s * 5, 4.5); g.lineTo(s * 13, 6); } g.stroke();
  g.restore();
}

// ---------- small things ----------
export function drawItem(g, type, color, x, y, r, rot = 0) {
  const HEX = { gold: '#f2c23a', red: '#d9453b', orange: '#ee8a2e', yellow: '#f0cd3d', green: '#58a95b', teal: '#2fa5a0', blue: '#3f76d6', purple: '#8a5bc8', pink: '#e780ab', white: '#f1eee6', black: '#2b2830' };
  const h = HEX[color] || '#ccc'; g.save(); g.translate(x, y); g.rotate(rot);
  if (type === 'bottlecap') { g.fillStyle = h; g.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832, rr = i % 2 ? r : r * 0.86; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8); } g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; ell(g, -r * 0.2, -r * 0.18, r * 0.5, r * 0.32); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8; ell(g, 0, 0, r * 0.62, r * 0.5); g.stroke(); }
  else if (type === 'button') { g.fillStyle = h; ell(g, 0, 0, r, r * 0.85); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 0.8; ell(g, 0, 0, r * 0.72, r * 0.6); g.stroke(); g.fillStyle = 'rgba(30,20,30,0.7)'; for (const d of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.22], [0.25, 0.22]]) { ell(g, d[0] * r, d[1] * r, r * 0.12, r * 0.12); g.fill(); } }
  else if (type === 'marble') { g.fillStyle = h; ell(g, 0, 0, r * 0.85, r * 0.85); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r * 0.5, 3.6, 5.4); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.75)'; ell(g, -r * 0.3, -r * 0.3, r * 0.2, r * 0.14); g.fill(); }
  else if (type === 'coin') { g.fillStyle = '#b8862a'; ell(g, 0, r * 0.12, r * 0.95, r * 0.8); g.fill(); g.fillStyle = h; ell(g, 0, 0, r * 0.95, r * 0.8); g.fill(); g.strokeStyle = 'rgba(120,80,10,0.55)'; g.lineWidth = 0.7; ell(g, 0, 0, r * 0.62, r * 0.5); g.stroke(); g.fillStyle = 'rgba(255,250,200,0.85)'; g.fillRect(-r * 0.5, -r * 0.45, r * 0.45, r * 0.18); }
  else if (type === 'feather') { g.strokeStyle = 'rgba(60,45,40,0.7)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-r * 1.2, r * 0.5); g.lineTo(r * 1.3, -r * 0.4); g.stroke(); g.fillStyle = h; g.beginPath(); g.moveTo(-r * 1.1, r * 0.45); g.quadraticCurveTo(0, -r * 1.1, r * 1.3, -r * 0.4); g.quadraticCurveTo(r * 0.2, r * 0.9, -r * 1.1, r * 0.45); g.fill(); }
  g.restore();
}

const BIRD = [['#c0553c', '#e8b07a'], ['#4d78c0', '#c9d9ef'], ['#d9b13b', '#f4e6a3']];
export function drawBird(g, b, t, scale) {
  const [body, belly] = BIRD[b.hue % 3], flying = b.state === 'fly';
  g.save(); g.translate(b.x, b.y - b.z); g.scale(scale * (b.face || 1), scale);
  if (!flying && b.state !== 'perch') { g.translate(0, 0); }
  const flap = flying ? Math.sin(t * 28 + b.hue) : 0;
  g.fillStyle = body; ell(g, 0, -4, 6, 4); g.fill(); g.fillStyle = belly; ell(g, 1, -2.6, 4, 2.4); g.fill();
  const peck = b.peck > 0 ? 3 : 0;
  g.fillStyle = body; ell(g, 5, -8 + peck, 3.2, 3); g.fill();
  g.fillStyle = '#e9a23b'; g.beginPath(); g.moveTo(7.6, -8.2 + peck); g.lineTo(11, -7.4 + peck); g.lineTo(7.6, -6.8 + peck); g.fill();
  g.fillStyle = '#1e1a22'; ell(g, 5.6, -8.6 + peck, 0.7, 0.7); g.fill();
  g.fillStyle = flying ? body : 'rgba(0,0,0,0.22)'; if (flying) { g.beginPath(); g.moveTo(-1, -5); g.lineTo(-6, -5 - 9 * flap); g.lineTo(2, -5); g.fill(); }
  g.strokeStyle = body; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-5, -4); g.lineTo(-10, -2); g.stroke();
  if (!flying) { g.strokeStyle = '#6b5a4a'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, -1); g.lineTo(0, 1); g.moveTo(2, -1); g.lineTo(2, 1); g.stroke(); }
  g.restore();
}

export function drawMouse(g, m, t, scale) {
  g.save(); g.translate(m.x, m.y); g.scale(scale * (m.vx < -1 ? -1 : 1), scale);
  g.fillStyle = 'rgba(0,0,0,0.18)'; ell(g, 0, 1, 7, 2); g.fill();
  const run = Math.hypot(m.vx, m.vy) > 5 ? Math.sin(t * 30) * 0.7 : 0;
  g.strokeStyle = '#c3a8a8'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, -3); g.quadraticCurveTo(-11, -1 + run, -14, -4); g.stroke();
  g.fillStyle = '#8f8a95'; ell(g, 0, -3.5, 6, 3.6); g.fill(); ell(g, 5.5, -3.4, 3, 2.4); g.fill();
  g.fillStyle = '#d9a3a3'; ell(g, 4.2, -5.8, 1.6, 1.8); g.fill(); g.fillStyle = '#1e1a22'; ell(g, 6.6, -3.8, 0.6, 0.6); g.fill(); g.fillStyle = '#e48d8d'; ell(g, 8.3, -3.2, 0.7, 0.6); g.fill();
  g.restore();
}

export function drawButterfly(g, f, t, scale) {
  const cols = ['#e86a92', '#f2c14e', '#6aa6e8']; const flap = Math.abs(Math.sin(t * 16 + f.hue * 2));
  g.save(); g.translate(f.x, f.y - f.z); g.scale(scale, scale);
  g.fillStyle = 'rgba(0,0,0,0.15)'; ell(g, 0, f.z / scale, 4, 1.3); g.fill();
  g.fillStyle = cols[f.hue % 3]; ell(g, -3, 0, 3.2 * (0.35 + flap * 0.65), 4); g.fill(); ell(g, 3, 0, 3.2 * (0.35 + flap * 0.65), 4); g.fill();
  g.strokeStyle = '#3a2f36'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, 3); g.stroke();
  g.restore();
}

export function drawCrow(g, th, t, hx, hy) {
  const u = th.t / 7, x = hx + (u < 0.3 ? (0.3 - u) * -400 : (u - 0.3) * 500), y = hy - 20 - (u < 0.3 ? (0.3 - u) * -90 * 0 : (u - 0.3) * 160) - (u < 0.3 ? 0 : 0);
  g.save(); g.translate(hx + (u < 0.3 ? -(0.3 - u) * 600 : (u - 0.3) * 700), hy - (u < 0.3 ? 4 + (0.3 - u) * 120 : (u - 0.3) * 260)); g.scale(1.5, 1.5);
  const fly = u < 0.25 || u > 0.4, flap = Math.sin(t * 24);
  g.fillStyle = '#25222b'; ell(g, 0, -5, 8, 4.5); g.fill(); ell(g, 8, -9, 3.6, 3.2); g.fill();
  g.fillStyle = '#6c6674'; g.beginPath(); g.moveTo(11, -9.6); g.lineTo(16, -8.2); g.lineTo(11, -7.6); g.fill();
  if (fly) { g.fillStyle = '#25222b'; g.beginPath(); g.moveTo(-1, -6); g.lineTo(-7, -6 - 11 * flap); g.lineTo(4, -6); g.fill(); }
  void x; void y; g.restore();
}
