// Paw painting: skill growth, works as small deterministic recipes, and a painter that draws them.
import { rnd, pick, clamp, uid, mulberry32, COLORS } from './util.js';
import { hourOf, dayOf, sunOf, isNight, moonPos, note, journal } from './world.js';
import { stashColors } from './quirk.js';
import { onEvent } from './wants.js';

export const LEVEL_NAMES = ['', 'Scribbler', 'Smudger', 'Dabbler', 'Student', 'Colorist', 'Painter', 'Stylist', 'Impressionist', 'Virtuoso', 'Master', 'Grandmaster', 'Legend'];
export const levelOf = xp => clamp(1 + Math.floor(Math.sqrt(xp / 8)), 1, 12);
export const xpForLevel = l => (l - 1) ** 2 * 8;
export const tierOf = l => (l <= 2 ? 0 : l <= 4 ? 1 : l <= 6 ? 2 : l <= 8 ? 3 : 4);
export const makeArt = () => ({ xp: 0, works: [], best: 0, count: 0, hung: null });

const SUBJ_LABEL = { moon: 'the moon', pond: 'the pond', oak: 'the old oak', stash: 'the stash', sunbeam: 'a sunbeam', rain: 'rain', flowers: 'the flower bed', bird: 'a bird', yard: 'the yard', window: 'the human' };
export const subjectLabel = s => SUBJ_LABEL[s] || s;

export function pickSubject(w) {
  const c = w.cat, night = isNight(w), opts = [['yard', 0.6], ['pond', 1], ['oak', 0.8], ['flowers', 0.8], ['window', 0.3 + c.needs.lonely * 1.5]];
  if (w.stash.items.length > 2) opts.push(['stash', 0.9 + w.stash.items.length * 0.03]);
  if (night && moonPos(w)) opts.push(['moon', 2.2 + w.mysteries.moon.clues * 0.05]);
  if (w.weather.rain > 0.4) opts.push(['rain', 2]);
  if (!night && w.weather.rain < 0.2 && w.weather.cloud < 0.5) opts.push(['sunbeam', 1.2]);
  if (w.birds.some(b => b.state !== 'away')) opts.push(['bird', 1.1]);
  let r = Math.random() * opts.reduce((s, o) => s + o[1], 0);
  for (const [s, wt] of opts) { r -= wt; if (r <= 0) return s; }
  return 'yard';
}

function skyColors(h) {
  if (h < 5 || h >= 21) return ['#101a3a', '#27315e'];
  if (h < 7) return ['#6a5a9a', '#f0a77a'];
  if (h < 17) return ['#5fa6e0', '#cfe8f7'];
  if (h < 19.5) return ['#e0805a', '#f6d28a'];
  return ['#3a3068', '#c5688a'];
}

function palette(w, tier, rng) {
  const have = Object.entries(stashColors(w)).sort((a, b) => b[1] - a[1]).map(e => COLORS[e[0]]);
  const sky = skyColors(hourOf(w));
  const wild = Object.values(COLORS).filter(c => c !== COLORS.black);
  const p = tier === 0 ? [have[0] || wild[Math.floor(rng() * wild.length)], wild[Math.floor(rng() * wild.length)]]
    : [sky[0], sky[1], have[0] || wild[Math.floor(rng() * wild.length)], have[1] || '#6a8f4e', '#3b2f36'];
  return p;
}

export function paintWork(w, subject) {
  const c = w.cat, a = c.art, level = levelOf(a.xp), tier = tierOf(level);
  const inspire = clamp(0.25 + c.mood.joy * 0.25 + (c.thoughtHint ? 0.1 : 0) + (subject === 'moon' ? w.mysteries.moon.conf * 0.2 : 0) + Math.random() * 0.15, 0, 0.7);
  const score = clamp(level * 0.062 + inspire * 0.35 + rnd(-0.07, 0.09), 0.05, 0.98);
  const seed = Math.floor(rnd(1, 2 ** 31));
  const pal = palette(w, tier, mulberry32(seed));
  const n = a.count + 1, h = hourOf(w);
  const when = h < 6 ? 'Night' : h < 10 ? 'Morning' : h < 17 ? 'Afternoon' : h < 20 ? 'Dusk' : 'Night';
  const title = tier === 0 ? pick(['Untitled', 'Smear', 'Big Feeling', 'Paw Study']) + ' #' + n : tier === 1 ? `${subjectLabel(subject).replace(/^the /, '').replace(/^./, s => s.toUpperCase())}, Probably` : `${pick(['Study of', 'Portrait of', 'Notes on', 'Homage to', 'Variations on'])} ${subjectLabel(subject)}`;
  const work = { id: uid(), n, day: dayOf(w), when, subject, level, tier, score, seed, pal, title, mood: c.mood.joy > 0.5 ? 'bright' : c.needs.tired > 0.6 ? 'drowsy' : 'calm', critique: critique(tier, score) };
  return work;
}

export function critique(tier, score) {
  const t = [
    ['That was a lot of paint.', 'Bold. Unreadable. Mine.', 'I put my whole paw into it.'],
    ['You can almost tell what it is.', 'The shapes are getting braver.', 'Recognisable, if you squint.'],
    ['The colors finally agree with each other.', 'That horizon is doing real work.', 'I am starting to see how light sits on things.'],
    ['The mood came through. That is the hard part.', 'Good depth. I could step into it.', 'I know what I am doing now. Mostly.'],
    ['Nothing to fix. I looked for a long time.', 'It looks like how the evening feels.', 'This is the one I would hang.'],
  ][tier];
  const mood = score > 0.7 ? 'I am proud of this one. ' : score < 0.3 ? 'Not my best. ' : '';
  return mood + pick(t);
}

export function finishWork(w, work) {
  const c = w.cat, a = c.art, before = levelOf(a.xp);
  a.xp += 5 + work.score * 14; a.count++; a.works.unshift(work);
  if (work.score > a.best) { a.best = work.score; a.hung = work.id; }
  if (a.works.length > 60) { // keep the best 40 and the newest 20
    const keep = new Set([...a.works.slice(0, 20), ...[...a.works].sort((x, y) => y.score - x.score).slice(0, 40)].map(x => x.id));
    a.works = a.works.filter(x => keep.has(x.id));
  }
  c.needs.create = 0; c.mood.joy = clamp(c.mood.joy + 0.15); w.stats.paintings++;
  note(w, `${c.name} finished a painting: "${work.title}".`, 'art');
  journal(w, `"${work.title}" (${Math.round(work.score * 100)}/100). ${work.critique}`, 'art');
  const after = levelOf(a.xp);
  if (after > before) {
    note(w, `${c.name} reached painting level ${after}: ${LEVEL_NAMES[after]}.`, 'art');
    journal(w, `Something clicked. I am a ${LEVEL_NAMES[after]} now.`, 'level');
    c.thoughtHint = 'level';
  }
  w.asks.push({ type: 'work', id: work.id });
  onEvent(w, 'painted', { work });
}

// ---------- the painter ----------
// Builds a list of drawing ops (deterministic from the work), then draws any fraction of them.
export function buildOps(work, W = 240, H = 180) {
  const rng = mulberry32(work.seed), R = (a, b) => a + rng() * (b - a), P = work.pal, tier = work.tier, ops = [];
  const pk = () => P[Math.floor(rng() * P.length)];
  const wob = [8, 4, 2.2, 1.2, 0.6][tier];
  const stroke = (x0, y0, x1, y1, w, c, a = 1) => { const pts = [], n = 5; for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t + R(-wob, wob), y0 + (y1 - y0) * t + R(-wob, wob)]); } ops.push({ t: 's', pts, w, c, a }); };
  const dab = (x, y, r, c, a = 1) => ops.push({ t: 'd', x, y, r, c, a });
  const ell = (x, y, rx, ry, c, a = 1) => ops.push({ t: 'e', x, y, rx, ry, c, a });
  const grad = (y0, y1, c0, c1) => ops.push({ t: 'g', y0, y1, c0, c1 });
  const rect = (x, y, w, h, c, a = 1) => ops.push({ t: 'r', x, y, w, h, c, a });
  const day = work.when !== 'Night';
  const sky = tier >= 2 ? skyColors(work.when === 'Morning' ? 8 : work.when === 'Afternoon' ? 13 : work.when === 'Dusk' ? 18.3 : 2) : [P[0], P[0]];

  if (tier === 0) { // scribbles
    ops.push({ t: 'f', c: '#efe6d6' });
    const n = Math.floor(R(5, 9)); for (let i = 0; i < n; i++) stroke(R(0, W), R(0, H), R(0, W), R(0, H), R(12, 30), P[i % P.length], 0.85);
    for (let i = 0; i < 3; i++) ops.push({ t: 'p', x: R(20, W - 20), y: R(20, H - 20), s: R(8, 14), c: P[i % P.length] });
  } else {
    ops.push({ t: 'f', c: sky[1] }); grad(0, H * 0.62, sky[0], sky[1]);
    const hz = H * R(0.58, 0.66), g1 = tier >= 2 ? '#5e8f53' : P[2];
    rect(0, hz, W, H - hz, tier >= 2 ? (day ? g1 : '#27384a') : P[2], 1);
    if (tier >= 3) { for (let i = 0; i < 3; i++) ell(R(0, W), hz, R(50, 100), R(10, 22), day ? '#7aa066' : '#1f2e45', 0.55); }
    const cx = tier >= 4 ? (rng() < 0.5 ? W / 3 : (2 * W) / 3) : W * R(0.3, 0.7);
    const S = work.subject, big = [1.0, 0.8, 0.9, 1, 1][tier];
    if (S === 'moon') { const mx = cx, my = H * 0.28; if (tier >= 3) ell(mx, my, 40, 40, '#fff6c8', 0.18); ell(mx, my, 20 * big, 20 * big, '#f7f0cf'); if (tier >= 2) ell(mx + 6, my - 4, 18 * big, 18 * big, sky[0], 0.55); if (tier >= 3) for (let i = 0; i < 18; i++) dab(R(0, W), R(0, hz * 0.8), 1.2, '#fff', 0.8); }
    else if (S === 'pond') { ell(cx, hz + (H - hz) * 0.5, 70, 20, day ? '#4c86c4' : '#1d3b6a'); if (tier >= 2) for (let i = 0; i < 6; i++) stroke(cx - 50 + R(0, 100), hz + 20 + R(0, 18), cx - 36 + R(0, 90), hz + 22 + R(0, 18), 2.5, '#cfe8f7', 0.6); if (tier >= 3) for (let i = 0; i < 5; i++) stroke(cx - 78 + R(0, 20), hz + 24, cx - 78 + R(0, 20), hz - 6, 2, '#3c6b3a'); }
    else if (S === 'oak') { stroke(cx, hz + 24, cx, hz - 26, 12 * big, '#5b3f2c'); ell(cx, hz - 40, 36 * big, 30 * big, '#3f7d46'); if (tier >= 2) { ell(cx - 18, hz - 34, 22, 18, '#52975a'); ell(cx + 16, hz - 46, 20, 16, '#2f6638'); } if (tier >= 3) for (let i = 0; i < 20; i++) dab(cx + R(-40, 40), hz - 40 + R(-26, 26), R(2, 4), pk(), 0.7); }
    else if (S === 'stash') { const n = 10 + Math.floor(R(0, 14)); for (let i = 0; i < n; i++) { const a = R(0, 6.28), r = Math.sqrt(rng()) * 44; dab(cx + Math.cos(a) * r, hz + 22 + Math.sin(a) * r * 0.4, R(4, 7), pk()); } }
    else if (S === 'sunbeam') { for (let i = 0; i < 4; i++) { const x = cx - 30 + i * 22; stroke(x, 0, x + 40, hz, 14, '#fff2b0', 0.28); } ell(cx + 20, hz + 24, 36, 10, '#ffe9a0', 0.6); }
    else if (S === 'rain') { for (let i = 0; i < 40; i++) { const x = R(0, W), y = R(0, H * 0.9); stroke(x, y, x - 5, y + 13, 1.6, '#cfe0f3', 0.7); } ell(W * 0.7, hz + 28, 40, 8, '#6f98c9', 0.6); }
    else if (S === 'flowers') { for (let i = 0; i < 9; i++) { const x = R(30, W - 30), y = hz + R(14, H - hz - 10); stroke(x, y, x, y + 16, 2, '#3c7a3e'); dab(x, y, R(5, 8), pk()); dab(x, y, 2.2, '#f7dc6f'); } }
    else if (S === 'bird') { const bx = cx, by = hz * 0.5; ell(bx, by, 11, 8, pk()); ell(bx + 10, by - 3, 5, 5, pk()); stroke(bx + 14, by - 3, bx + 22, by - 1, 2, '#e9a23b'); stroke(bx - 12, by, bx - 22, by + 4, 3, '#3b2f36'); }
    else if (S === 'window') { ell(cx, hz - 4, 24, 28, '#f0d3b0'); ell(cx - 8, hz - 8, 3, 3, '#2b2830'); ell(cx + 8, hz - 8, 3, 3, '#2b2830'); stroke(cx - 8, hz + 6, cx + 8, hz + 6, 2, '#a4574c'); }
    else { rect(W * 0.1, hz - 36, W * 0.22, 36, '#a9735a'); stroke(W * 0.52, hz, W * 0.52, hz - 34, 8, '#5b3f2c'); ell(W * 0.52, hz - 44, 22, 18, '#3f7d46'); ell(W * 0.8, hz + 20, 30, 9, '#4c86c4'); }
    if (tier >= 2 && day && S !== 'rain') { ell(W * R(0.1, 0.9), H * R(0.08, 0.2), R(24, 40), R(6, 10), '#ffffff', 0.7); }
    if (tier >= 3) for (let i = 0; i < 70; i++) { const x = R(0, W), y = R(0, H), ang = R(-0.5, 0.5); stroke(x, y, x + Math.cos(ang) * 8, y + Math.sin(ang) * 8, R(1.5, 3), pk(), 0.22); }
    if (tier >= 4) { ops.push({ t: 'v' }); for (let i = 0; i < 24; i++) dab(R(0, W), R(0, H), R(0.8, 1.8), '#fff3c4', 0.5); }
    if (tier >= 1) ops.push({ t: 'p', x: W - 18, y: H - 14, s: 6, c: tier >= 3 ? '#2a2230' : P[P.length - 1] });
  }
  return ops;
}

export function drawPainting(ctx, W, H, ops, progress = 1) {
  const n = Math.max(0, Math.floor(ops.length * clamp(progress)));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const o = ops[i]; ctx.globalAlpha = o.a == null ? 1 : o.a;
    if (o.t === 'f') { ctx.fillStyle = o.c; ctx.fillRect(0, 0, W, H); }
    else if (o.t === 'g') { const g = ctx.createLinearGradient(0, o.y0, 0, o.y1); g.addColorStop(0, o.c0); g.addColorStop(1, o.c1); ctx.fillStyle = g; ctx.fillRect(0, o.y0, W, o.y1 - o.y0); }
    else if (o.t === 'r') { ctx.fillStyle = o.c; ctx.fillRect(o.x, o.y, o.w, o.h); }
    else if (o.t === 'e') { ctx.fillStyle = o.c; ctx.beginPath(); ctx.ellipse(o.x, o.y, Math.max(0.1, o.rx), Math.max(0.1, o.ry), 0, 0, 6.283); ctx.fill(); }
    else if (o.t === 'd') { ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.283); ctx.fill(); }
    else if (o.t === 's') { ctx.strokeStyle = o.c; ctx.lineWidth = o.w; ctx.beginPath(); o.pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
    else if (o.t === 'p') { ctx.fillStyle = o.c; ctx.beginPath(); ctx.ellipse(o.x, o.y + o.s * 0.25, o.s * 0.55, o.s * 0.45, 0, 0, 6.283); ctx.fill(); for (const [dx, dy] of [[-0.75, -0.4], [-0.28, -0.85], [0.28, -0.85], [0.75, -0.4]]) { ctx.beginPath(); ctx.arc(o.x + dx * o.s, o.y + dy * o.s * 0.9, o.s * 0.22, 0, 6.283); ctx.fill(); } }
    else if (o.t === 'v') { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,6,20,0.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }
  ctx.restore();
}
