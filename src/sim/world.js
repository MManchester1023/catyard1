// Yard layout, time, weather, geometry helpers, and the creatures that share the yard.
import { W, H, GY0, GY1, rnd, ri, clamp, pick, dist, sstep, ITEM_TYPES, ITEM_LABEL, COLOR_NAMES, FEATHER_COLORS, MATERIALS, MAT_CAP, uid, an } from './util.js';

export const hourOf = w => ((w.clock % w.dayLen) / w.dayLen) * 24;
export const dayOf = w => Math.floor(w.clock / w.dayLen) + 1;
export const sunOf = h => sstep(5.2, 7.6, h) * (1 - sstep(17.6, 20.4, h));
export const clockStr = w => { const h = hourOf(w), hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
export const isNight = w => sunOf(hourOf(w)) < 0.25;
export const moonPhase = w => (dayOf(w) - 1) % 8; // 0 new .. 4 full .. 7 waning crescent
export const moonLight = w => 0.5 - 0.5 * Math.cos((moonPhase(w) / 8) * Math.PI * 2);

// where the moon is in the sky (canvas coords) or null if it is not up
export function moonPos(w) {
  const h = hourOf(w), t = ((h - 18.5 + 24) % 24) / 11.5; // 18:30 -> 06:00
  if (t < 0 || t > 1) return null;
  return { x: 90 + t * 780, y: 150 - Math.sin(t * Math.PI) * 96 };
}

export function makeObjects() {
  return {
    house: { x: 150, y: 292, fp: { x0: 78, x1: 222, y0: 238, y1: 288 } },
    bowl: { x: 318, y: 352, food: 0.5 },
    water: { x: 366, y: 358 },
    cushion: { x: 222, y: 380 },
    post: { x: 258, y: 488 },
    pond: { x: 640, y: 470, rx: 84, ry: 30 },
    flowers: { x: 716, y: 552 },
    tree: { x: 822, y: 318, r: 16 },
    fence: { x: 520, y: GY0 },
    yarn: { x: 470, y: 520, vx: 0, vy: 0 },
    easel: { x: 520, y: 410 },
    glass: { x: 480, y: 566 },
    mat: { x: 372, y: 540 },
    tablet: { x: 600, y: 322 },
    table: { x: 410, y: 458 },
    holes: [{ x: 430, y: 262 }, { x: 66, y: 372 }, { x: 902, y: 500 }],
  };
}
export const STASH_SITES = [
  { x: 52, y: 318, label: 'behind the cabin' }, { x: 884, y: 392, label: 'under the oak' },
  { x: 902, y: 556, label: 'the flower corner' }, { x: 612, y: 268, label: 'the fence corner' },
];

export function beamOf(w) {
  const h = hourOf(w), f = clamp((h - 7.2) / 10.4);
  const str = h > 7.2 && h < 17.6 ? sunOf(h) * (1 - w.weather.cloud * 0.85) * (w.weather.rain > 0.2 ? 0 : 1) : 0;
  return { x: 170 + f * 560, y: 412 - Math.sin(f * Math.PI) * 28, on: str > 0.45, str };
}

// the spot the cat walks to for each place
export function spot(w, id) {
  const o = w.o;
  switch (id) {
    case 'bowl': return { x: o.bowl.x - 18, y: o.bowl.y + 10, face: 1 };
    case 'water': return { x: o.water.x + 18, y: o.water.y + 10, face: -1 };
    case 'pond': return { x: o.pond.x - 26, y: o.pond.y + o.pond.ry + 12, face: 1 };
    case 'house': return { x: o.house.x, y: o.house.y + 12, face: 1 };
    case 'cushion': return { x: o.cushion.x, y: o.cushion.y + 4, face: 1 };
    case 'post': return { x: o.post.x - 20, y: o.post.y + 4, face: 1 };
    case 'tree': return { x: o.tree.x - 34, y: o.tree.y + 18, face: 1 };
    case 'fence': return { x: o.fence.x, y: GY0 + 10, face: 1 };
    case 'flowers': return { x: o.flowers.x - 20, y: o.flowers.y - 4, face: 1 };
    case 'beam': { const b = beamOf(w); return { x: b.x, y: b.y + 2, face: 1 }; }
    case 'yarn': return { x: o.yarn.x - 20, y: o.yarn.y + 3, face: 1 };
    case 'easel': return { x: o.easel.x - 34, y: o.easel.y + 14, face: 1 };
    case 'glass': return { x: o.glass.x, y: o.glass.y, face: 0 };
    case 'mat': return { x: o.mat.x, y: o.mat.y + 15, face: 1 };
    case 'tablet': return { x: o.tablet.x - 26, y: o.tablet.y + 15, face: 1 };
    case 'table': return { x: o.table.x - 6, y: o.table.y + 22, face: 1 };
    case 'craft': return w.table ? { x: o.table.x - 6, y: o.table.y + 22, face: 1 } : { x: o.tree.x - 34, y: o.tree.y + 18, face: 1 };
    case 'feeder': return { x: 872, y: 352, face: 1 };
    case 'stash': return w.stash.site ? { x: w.stash.site.x + 20, y: w.stash.site.y + 10, face: -1 } : { x: 400, y: 450, face: 1 };
    case 'pondedge': return { x: o.pond.x + (w.ripple ? w.ripple.dx : 0) * 0.6, y: o.pond.y + o.pond.ry + 12, face: 1 };
  }
  return { x: 400, y: 450, face: 1 };
}

export function blocked(w, x, y) {
  const o = w.o, f = o.house.fp, p = o.pond;
  if (x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1) return true;
  if (((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 < 1) return true;
  if (Math.hypot(x - o.tree.x, (y - o.tree.y) * 1.4) < o.tree.r + 6) return true;
  if (w.easelMade && Math.abs(x - o.easel.x) < 26 && Math.abs(y - o.easel.y) < 10) return true;
  if (Math.abs(x - o.tablet.x) < 15 && Math.abs(y - o.tablet.y) < 7) return true;
  if (w.table && Math.abs(x - o.table.x) < 30 && Math.abs(y - o.table.y) < 9) return true;
  return false;
}

export function randomOpenPoint(w, x0 = 40, x1 = 920, y0 = GY0 + 24, y1 = GY1 - 10) {
  for (let i = 0; i < 20; i++) { const x = rnd(x0, x1), y = rnd(y0, y1); if (!blocked(w, x, y)) return { x, y }; }
  return { x: 400, y: 450 };
}

// ---------- getting around: a plan around anything big, local steering for the rest ----------
// The old greedy steering got stuck in the dips of the pond and behind the table and easel: with the target on the far
// side of an obstacle, every step toward it was blocked and the cat circled until the walk timed out. So when the
// straight line is blocked we plan a path across a coarse grid (A*, then pulled straight) and steer toward its corners.
const CELL = 14, COLS = Math.ceil(W / CELL), ROWS = Math.ceil((GY1 - GY0 + 24) / CELL);
const cellX = x => clamp(Math.floor(x / CELL), 0, COLS - 1), cellY = y => clamp(Math.floor((y - GY0) / CELL), 0, ROWS - 1);
const midX = i => i * CELL + CELL / 2, midY = j => GY0 + j * CELL + CELL / 2;
const NAV = new WeakMap(); // body -> its current plan (kept out of the body itself so it is never saved)

export function lineClear(w, x0, y0, x1, y1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 1; i <= n; i++) if (blocked(w, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
  return true;
}

// a path from (x0,y0) to near (x1,y1): { pts, adj } (adj: the goal was inside something, so it ends at the nearest open spot) or null
export function findPath(w, x0, y0, x1, y1) {
  const free = new Uint8Array(COLS * ROWS); for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) free[j * COLS + i] = blocked(w, midX(i), midY(j)) ? 0 : 1;
  const sI = cellX(x0), sJ = cellY(y0); let gI = cellX(x1), gJ = cellY(y1), adj = false;
  free[sJ * COLS + sI] = 1;
  if (!free[gJ * COLS + gI]) { // the goal is inside an obstacle: aim for the nearest open cell
    adj = true; let found = null;
    for (let r = 1; r < 9 && !found; r++) { let bd = 1e9; for (let j = gJ - r; j <= gJ + r; j++) for (let i = gI - r; i <= gI + r; i++) { if (i < 0 || j < 0 || i >= COLS || j >= ROWS || !free[j * COLS + i]) continue; const d = Math.hypot(midX(i) - x1, midY(j) - y1); if (d < bd) { bd = d; found = [i, j]; } } }
    if (!found) return null; [gI, gJ] = found;
  }
  const idx = (i, j) => j * COLS + i, g = new Float32Array(COLS * ROWS).fill(1e9), from = new Int32Array(COLS * ROWS).fill(-1), done = new Uint8Array(COLS * ROWS);
  const heap = []; const push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { let l = 2 * c + 1, r = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const hh = (i, j) => { const dx = Math.abs(i - gI), dy = Math.abs(j - gJ); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  g[idx(sI, sJ)] = 0; push(hh(sI, sJ), idx(sI, sJ)); let ok = false;
  while (heap.length) {
    const k = pop()[1]; if (done[k]) continue; done[k] = 1; const i = k % COLS, j = (k / COLS) | 0;
    if (i === gI && j === gJ) { ok = true; break; }
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= COLS || nj >= ROWS || !free[idx(ni, nj)]) continue;
      if (di && dj && (!free[idx(i + di, j)] || !free[idx(i, j + dj)])) continue; // no cutting corners
      const nk = idx(ni, nj), ng = g[k] + (di && dj ? 1.414 : 1); if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(ng + hh(ni, nj), nk); }
    }
  }
  if (!ok) return null;
  const cells = []; for (let k = idx(gI, gJ); k >= 0; k = from[k]) cells.push({ x: midX(k % COLS), y: midY((k / COLS) | 0) }); cells.reverse();
  cells[0] = { x: x0, y: y0 }; if (!adj) cells[cells.length - 1] = { x: x1, y: y1 };
  const pts = [cells[0]]; let at = 0; // pull the path straight: skip every corner that can be cut
  while (at < cells.length - 1) { let nxt = at + 1; for (let k = cells.length - 1; k > at + 1; k--) if (lineClear(w, cells[at].x, cells[at].y, cells[k].x, cells[k].y)) { nxt = k; break; } pts.push(cells[nxt]); at = nxt; }
  pts.shift(); if (!pts.length) pts.push(adj ? { x: midX(gI), y: midY(gJ) } : { x: x1, y: y1 }); return { pts, adj };
}

// one step of local steering toward a point, going round small things
function steer(w, c, tx, ty, sp, dt) {
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  const m = Math.min(d, sp * dt), a0 = Math.atan2(dy, dx), inside = blocked(w, c.x, c.y);
  for (const off of [0, 0.55, -0.55, 1.1, -1.1, 1.7, -1.7, 2.4, -2.4]) {
    const a = a0 + off, nx = clamp(c.x + Math.cos(a) * m, 14, W - 14), ny = clamp(c.y + Math.sin(a) * m, GY0, GY1);
    if (inside || !blocked(w, nx, ny)) {
      const mx = nx - c.x; c.x = nx; c.y = ny;
      if (Math.abs(mx) > 0.05) c.face = mx > 0 ? 1 : -1;
      c.legT += m * 0.16; return false;
    }
  }
  return false;
}

// step a body toward a target. true on arrival
export function walk(w, c, tx, ty, sp, dt) {
  const d = Math.hypot(tx - c.x, ty - c.y);
  if (d <= Math.max(2, sp * dt * 0.6)) return true;
  if (lineClear(w, c.x, c.y, tx, ty)) { NAV.delete(c); return steer(w, c, tx, ty, sp, dt); }
  let nv = NAV.get(c);
  if (!nv || Math.hypot(nv.tx - tx, nv.ty - ty) > 36 || nv.table !== !!w.table || w.clock - nv.at > 6) {
    const pl = findPath(w, c.x, c.y, tx, ty);
    nv = { tx, ty, table: !!w.table, at: w.clock, pts: pl ? pl.pts : [{ x: tx, y: ty }], adj: pl ? pl.adj : false, i: 0 }; NAV.set(c, nv);
  }
  while (nv.i < nv.pts.length - 1 && (Math.hypot(nv.pts[nv.i].x - c.x, nv.pts[nv.i].y - c.y) < 10 || lineClear(w, c.x, c.y, nv.pts[nv.i + 1].x, nv.pts[nv.i + 1].y))) nv.i++;
  const p = nv.pts[nv.i];
  if (nv.adj && nv.i === nv.pts.length - 1 && Math.hypot(p.x - c.x, p.y - c.y) < Math.max(4, sp * dt * 0.6)) return true; // as close as it can get
  return steer(w, c, p.x, p.y, sp, dt) && false;
}

// ---------- log, journal and history ----------
// Everything the cat does, thinks and has happen is also appended to w.hist (oldest first, trimmed), and the
// important things are kept per day in w.days so the history stays readable long after the timeline has scrolled.
export const HIST_MAX = 2000, DAYS_MAX = 45;
const HIGHLIGHT = new Set(['want', 'art', 'collect', 'craft', 'offer', 'tablet', 'wish', 'discover', 'hunt', 'taste', 'wonder', 'learn', 'friend']);
const short = (s, n = 160) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
export function dayRec(w, day = dayOf(w)) {
  if (!w.days) w.days = {};
  let d = w.days[day]; if (d) return d;
  d = w.days[day] = { secs: {}, ev: [] };
  const keys = Object.keys(w.days).map(Number).sort((a, b) => a - b); while (keys.length > DAYS_MAX) delete w.days[keys.shift()];
  return d;
}
export function pushHist(w, k, text, tag = '') {
  if (w.quiet && (k === 'did' || k === 'thought')) return; // fast-forwarding would drown the timeline
  if (!w.hist) w.hist = [];
  w.hist.push({ id: ++w.logId, day: dayOf(w), time: clockStr(w), k, text: short(text), tag });
  if (w.hist.length > HIST_MAX + 100) w.hist.splice(0, w.hist.length - HIST_MAX);
}
export function note(w, text, kind = 'info') {
  w.log.unshift({ id: ++w.logId, day: dayOf(w), time: clockStr(w), text, kind });
  if (w.log.length > 120) w.log.pop();
  pushHist(w, 'event', text, kind);
  if (HIGHLIGHT.has(kind)) { const d = dayRec(w); if (d.ev.length < 30) d.ev.push({ time: clockStr(w), text: short(text, 140), kind }); }
  if (w.onNote) w.onNote(w.log[0]);
}
export function journal(w, text, tag = '') {
  w.journal.unshift({ id: ++w.logId, day: dayOf(w), time: clockStr(w), text, tag });
  if (w.journal.length > 150) w.journal.pop();
  pushHist(w, 'diary', text, tag);
}

// ---------- weather ----------
export function weatherTick(w, dt) {
  const wt = w.weather;
  wt.timer -= dt;
  if (wt.timer <= 0) {
    const prev = wt.type, r = Math.random();
    wt.type = wt.forced || (r < 0.6 ? 'clear' : r < 0.86 ? 'cloud' : 'rain');
    wt.timer = wt.forced ? 1e9 : rnd(140, 340);
    if (wt.type === 'rain' && prev !== 'rain') note(w, 'It started to rain.', 'weather');
    if (prev === 'rain' && wt.type !== 'rain') note(w, 'The rain stopped.', 'weather');
  }
  wt.rain += ((wt.type === 'rain' ? 1 : 0) - wt.rain) * Math.min(1, dt * 0.4);
  wt.cloud += ((wt.type === 'rain' ? 1 : wt.type === 'cloud' ? 0.65 : 0.12) - wt.cloud) * Math.min(1, dt * 0.25);
}
export function setWeather(w, type) { // type: clear | cloud | rain | auto
  const wt = w.weather, prev = wt.type;
  if (type === 'auto') { wt.forced = null; wt.timer = 0; return; }
  wt.forced = type; wt.type = type; wt.timer = 1e9;
  if (type === 'rain' && prev !== 'rain') note(w, 'It started to rain.', 'weather');
  if (prev === 'rain' && type !== 'rain') note(w, 'The rain stopped.', 'weather');
}

// ---------- creatures ----------
export function birdLeave(b) { b.state = 'fly'; b.dest = 'out'; b.tx = b.x < W / 2 ? -50 : W + 50; b.ty = b.y; b.tz = 170; }

export function makeBird(i) {
  return { kind: 'bird', x: -40, y: 300, z: 150, state: 'away', dest: 'ground', timer: rnd(4, 24) + i * 10, tx: 0, ty: 0, tz: 0, face: 1, hue: i, alert: 0, hop: 0, peck: 0, vx: 0, vy: 0 };
}

export function birdTick(w, b, dt) {
  const c = w.cat;
  if (b.state === 'away') {
    b.timer -= dt;
    if (b.timer <= 0 && w.weather.rain < 0.4 && sunOf(hourOf(w)) > 0.2) {
      const r = Math.random(); b.x = Math.random() < 0.5 ? -30 : W + 30; b.y = rnd(250, 420); b.z = 170;
      const fd = !!(w.deco && w.deco.feeder); b.feed = false;
      if (r < (fd ? 0.8 : 0.6) || b.gift) { const p = randomOpenPoint(w, 160, 880, 300, 545); b.tx = p.x; b.ty = p.y; b.tz = 0; b.dest = 'ground'; if (fd && Math.random() < 0.75) { b.tx = 872 + rnd(-16, 16); b.ty = 360 + rnd(-6, 10); b.feed = true; } }
      else if (r < 0.85) { b.tx = pick([120, 260, 380, 520, 700, 860]); b.ty = GY0 + 4; b.tz = 46; b.dest = 'perch'; }
      else { b.tx = 822 + rnd(-20, 30); b.ty = 312; b.tz = 118; b.dest = 'perch'; }
      b.state = 'fly'; b.alert = 0;
    } else if (b.timer <= 0) b.timer = rnd(5, 15);
    return;
  }
  if (b.state === 'fly') {
    const dx = b.tx - b.x, dy = b.ty - b.y, dz = b.tz - b.z, d = Math.hypot(dx, dy, dz), m = 170 * dt;
    b.vx = dx / (d || 1) * 170; b.vy = dy / (d || 1) * 170;
    if (Math.abs(dx) > 1) b.face = dx > 0 ? 1 : -1;
    if (d <= m) { b.x = b.tx; b.y = b.ty; b.z = b.tz; if (b.dest === 'out') { b.state = 'away'; b.timer = rnd(30, 100) * (w.deco && w.deco.feeder ? 0.3 : 1); } else { b.state = b.dest; b.timer = rnd(10, 26) * (b.feed ? 1.5 : 1); b.hop = 1; } }
    else { b.x += dx / d * m; b.y += dy / d * m; b.z += dz / d * m; }
    return;
  }
  if (b.frozen > 0 && b.state === 'ground') { b.frozen -= dt; b.alert = 0; b.vx = b.vy = 0; return; }
  b.vx = b.vy = 0; b.timer -= dt;
  const d = Math.hypot(b.x - c.x, b.y - c.y), cp = c.pose;
  const threat = !c.hidden && cp !== 'sleep' && cp !== 'inside' && d < (cp === 'run' ? 210 : cp === 'crouch' ? 85 : 120);
  if (threat) { b.alert += dt * 3; if (b.alert > 0.6) { if (b.gift && b.state === 'ground') dropFromBird(w, b, true); birdLeave(b); return; } } else b.alert = Math.max(0, b.alert - dt);
  if (b.state === 'ground') {
    b.hop -= dt; b.peck = Math.max(0, b.peck - dt);
    if (b.hop <= 0) { const nx = clamp(b.x + rnd(-20, 20), 20, W - 20), ny = clamp(b.y + rnd(-9, 9), GY0 + 40, GY1); if (!blocked(w, nx, ny)) { b.face = nx > b.x ? 1 : -1; b.x = nx; b.y = ny; } b.hop = rnd(0.6, 2); b.peck = 0.35; }
  }
  if (b.timer <= 0) { if (b.state === 'ground') dropFromBird(w, b); birdLeave(b); }
}

// Birds are where new things in the yard come from: one that lands and then leaves may leave something behind. Mostly a
// small treasure (any of the four kinds, in any colour), now and then a bit of string. A bird sent with a particular
// gift (see sim.js: what the cat wants to find) always leaves it. A feeder brings more birds, so more things.
export function dropFromBird(w, b, sure = false) {
  const gift = b.gift; b.gift = null;
  if (!gift && !sure && Math.random() > (w.deco && w.deco.feeder ? 0.045 : 0.13)) return null; // (with a feeder there are four times the visits, so each leaves less often)
  if (w.items.length >= 7) return null;
  const q = w.cat.quirk; let type, color = null;
  if (gift) { type = gift.type; color = gift.color; }
  else if (Math.random() < 0.45 && (type = birdMaterial(w))) { /* a crafting part: bark, a twig or a bit of string */ }
  else { type = Math.random() < 0.45 ? q.item : pick(ITEM_TYPES); color = type === 'feather' ? pick(FEATHER_COLORS) : pick(COLOR_NAMES.filter(c => c !== 'black')); }
  let x = clamp(b.x + rnd(-8, 8), 30, W - 30), y = clamp(b.y + rnd(2, 10), GY0 + 24, GY1 - 12);
  if (blocked(w, x, y)) { const p = randomOpenPoint(w, x - 60, x + 60, GY0 + 24, GY1 - 12); x = p.x; y = p.y; }
  const it = { id: uid(), type, color, x, y, age: 0, from: 'bird' }; w.items.push(it);
  note(w, `A bird dropped ${an((color ? color + ' ' : '') + ITEM_LABEL[type])} before it flew off.`, 'bird');
  return it;
}

// what a bird might drop as a crafting part. Whichever of bark, twigs and string the cat is shortest of is the likelier one;
// null when it is already carrying all it can hold.
function birdMaterial(w) {
  const inv = w.cat.inv || {}, wt = { bark: 1, twig: 1, twine: 0.85 };
  const room = MATERIALS.map(m => [m, wt[m] * Math.max(0, 1 - (inv[m] || 0) / MAT_CAP)]), total = room.reduce((a, r) => a + r[1], 0);
  if (total <= 0) return null;
  let r = Math.random() * total; for (const [m, v] of room) { r -= v; if (r <= 0) return m; }
  return room[room.length - 1][0];
}

// a fish now and then glides through the pond. The cat can try for it (acts.js 'fish').
export function fishTick(w, dt) {
  const p = w.o.pond; if (!w.fx) w.fx = [];
  for (const s of w.fx) s.t += dt; if (w.fx.length) w.fx = w.fx.filter(s => s.t < 1.6);
  const f = w.fish;
  if (!f) {
    if (w.fishT == null) w.fishT = rnd(60, 140);
    w.fishT -= dt;
    if (w.fishT <= 0 && sunOf(hourOf(w)) > 0.12 && w.weather.rain < 0.5) { w.fish = { x: p.x + rnd(-0.6, 0.6) * p.rx, y: p.y + rnd(-0.3, 0.4) * p.ry, dir: Math.random() < 0.5 ? -1 : 1, t: 0, life: rnd(45, 95), spooked: false, spookT: 0, wag: 0 }; w.fishT = rnd(0.2, 0.45) * w.dayLen; }
    return;
  }
  f.t += dt; f.wag += dt * 5;
  f.x += f.dir * (f.spooked ? 80 : 11) * dt; f.y += Math.sin(f.t * 0.6) * 2 * dt;
  const nx = (f.x - p.x) / (p.rx * 0.82);
  if (Math.abs(nx) > 1) { f.dir = -Math.sign(nx); f.x = p.x + Math.sign(nx) * p.rx * 0.82 * 0.99; }
  const fishing = w.cat.act && w.cat.act.type === 'fish' && !f.spooked;
  if (fishing) f.life = Math.max(f.life, f.t + 6);
  if (f.t > f.life || (f.spooked && f.t > f.spookT + 1.4)) w.fish = null;
}

export function spawnMouse(w) {
  const hole = pick(w.o.holes), ang = rnd(0, 6.28), r = rnd(90, 170);
  const tx = clamp(hole.x + Math.cos(ang) * r, 30, W - 30), ty = clamp(hole.y + Math.sin(ang) * r * 0.5, GY0 + 20, GY1 - 10);
  w.mice.push({ kind: 'mouse', x: hole.x, y: hole.y, home: hole, state: 'go', tx, ty, t: 0, vx: 0, vy: 0, alert: 0, dead: false, gone: false });
}

export function mouseTick(w, m, dt) {
  const c = w.cat, d = Math.hypot(m.x - c.x, m.y - c.y);
  const threat = !c.hidden && c.pose !== 'sleep' && c.pose !== 'inside';
  if (m.state !== 'flee' && threat && d < 190) {
    m.alert += dt * (c.pose === 'crouch' ? 0.28 : 1) * (1.25 - d / 190) * (c.pose === 'run' ? 2 : 1);
    if (m.alert > 1.1) m.state = 'flee';
  } else if (d > 230) m.alert = Math.max(0, m.alert - dt * 0.5);
  const move = (tx, ty, sp) => { const dx = tx - m.x, dy = ty - m.y, dd = Math.hypot(dx, dy); if (dd < 3) return true; const s = Math.min(dd, sp * dt); m.vx = dx / dd * sp; m.vy = dy / dd * sp; m.x += dx / dd * s; m.y += dy / dd * s; return false; };
  const hd = h => Math.hypot(h.x - m.x, h.y - m.y);
  if (m.state === 'go') { if (move(m.tx, m.ty, 58)) { m.state = 'nibble'; m.t = rnd(2, 5); m.vx = m.vy = 0; } }
  else if (m.state === 'nibble') { m.t -= dt; m.vx = m.vy = 0; if (m.t <= 0) m.state = 'home'; }
  else if (m.state === 'home') { if (move(m.home.x, m.home.y, 58)) m.gone = true; }
  else if (m.state === 'flee') { const h = w.o.holes.slice().sort((p, q) => hd(p) - hd(q))[0]; if (move(h.x, h.y, 175)) m.gone = true; }
}

export function makeFly(i) { return { x: rnd(600, 840), y: rnd(500, 560), z: rnd(15, 40), ang: rnd(0, 6.28), sp: rnd(22, 38), t: rnd(0, 9), flee: 0, hue: i, on: false }; }
export function flyTick(w, f, dt) {
  const on = sunOf(hourOf(w)) > 0.3 && w.weather.rain < 0.2; f.on = on; if (!on) return;
  f.t += dt; f.flee = Math.max(0, f.flee - dt);
  f.ang += rnd(-1, 1) * 3 * dt;
  if (Math.hypot(f.x - 716, f.y - 530) > 190) f.ang += (Math.atan2(530 - f.y, 716 - f.x) - f.ang) * Math.min(1, dt * 2);
  const sp = f.sp * (f.flee > 0 ? 3 : 1);
  f.x = clamp(f.x + Math.cos(f.ang) * sp * dt, 20, W - 20); f.y = clamp(f.y + Math.sin(f.ang) * sp * dt * 0.6, GY0 + 90, GY1);
  f.z = 24 + Math.sin(f.t * 1.7) * 12;
}

// fireflies drift over the flower bed on clear evenings
export function makeSpark(i) { return { x: rnd(600, 840), y: rnd(470, 560), z: rnd(10, 46), ang: rnd(0, 6.28), t: rnd(0, 9), ph: rnd(0, 6.28), on: false }; }
export function sparkTick(w, s, dt) {
  const h = hourOf(w), on = (h > 18.8 || h < 5.2) && w.weather.rain < 0.3; s.on = on; if (!on) return;
  s.t += dt; s.ang += rnd(-1, 1) * 2 * dt;
  if (Math.hypot(s.x - 716, s.y - 520) > 150) s.ang += (Math.atan2(520 - s.y, 716 - s.x) - s.ang) * Math.min(1, dt * 2);
  s.x += Math.cos(s.ang) * 14 * dt; s.y += Math.sin(s.ang) * 8 * dt; s.z = 28 + Math.sin(s.t * 0.9 + s.ph) * 16;
}

// ---------- things lying around for a collector ----------
export function spawnItem(w, forceType, forceColor) {
  if (w.items.length >= 7) return null;
  const q = w.cat.quirk;
  const type = forceType || (Math.random() < 0.55 ? q.item : pick(ITEM_TYPES));
  const color = forceColor || (type === 'feather' ? pick(FEATHER_COLORS) : pick(COLOR_NAMES.filter(c => c !== 'black')));
  const p = randomOpenPoint(w, 40, 920, GY0 + 30, GY1 - 16);
  const it = { id: uid(), type, color, x: p.x, y: p.y, age: 0 };
  w.items.push(it); return it;
}
