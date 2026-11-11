// Paw painting: skill growth, works as small deterministic recipes, and a painter that draws them.
import { rnd, pick, clamp, uid, mulberry32, COLORS } from './util.js';
import { hourOf, dayOf, sunOf, isNight, moonPos, note, journal } from './world.js';
import { stashColors } from './quirk.js';
import { onEvent } from './wants.js';
import { random } from './rng.js';

export const LEVEL_NAMES = ['', 'Scribbler', 'Smudger', 'Dabbler', 'Student', 'Colorist', 'Painter', 'Stylist', 'Impressionist', 'Virtuoso', 'Master', 'Grandmaster', 'Legend'];
export const levelOf = xp => clamp(1 + Math.floor(Math.sqrt(xp / 8)), 1, 12);
export const xpForLevel = l => (l - 1) ** 2 * 8;
export const tierOf = l => (l <= 2 ? 0 : l <= 4 ? 1 : l <= 6 ? 2 : l <= 8 ? 3 : 4);
export const makeArt = () => ({ xp: 0, works: [], best: 0, count: 0, hung: null });

// Generative styles: not a place in the yard but a made-up picture, built from nothing but the seed. Each one has the
// lowest painting tier it is attempted at, a label and a few titles.
export const GEN = {
  splatter: { min: 0, label: 'a splatter of colour', titles: ['Accident, On Purpose', 'Loud Tuesday', 'Paw Weather', 'Whoops (Intentional)'] },
  swirl: { min: 1, label: 'a swirling sky', titles: ['Restless Sky', 'Wind, Seen', 'Night Turning', 'The Sky Is Thinking'] },
  waves: { min: 1, label: 'waves', titles: ['Tide Table', 'Soft Weather', 'Long Water', 'Slow Wave'] },
  bloom: { min: 1, label: 'a bloom', titles: ['Opening', 'Small Sun', 'Petal Logic', 'Something Unfolding'] },
  blocks: { min: 2, label: 'colour blocks', titles: ['Composition in Warm', 'Rooms', 'Field Study', 'Four Opinions'] },
  dots: { min: 2, label: 'a field of dots', titles: ['A Thousand Small Decisions', 'Light, Divided', 'Weather in Dots', 'Many Little Paws'] },
};
const SUBJ_LABEL = { moon: 'the moon', pond: 'the pond', oak: 'the old oak', stash: 'the stash', sunbeam: 'a sunbeam', rain: 'rain', flowers: 'the flower bed', bird: 'a bird', yard: 'the yard', window: 'the human' };
for (const [k, g] of Object.entries(GEN)) SUBJ_LABEL[k] = g.label;
export const subjectLabel = s => SUBJ_LABEL[s] || s;
export const SUBJECT_IDS = Object.keys(SUBJ_LABEL);
export const isGenerated = s => !!GEN[s];

export function pickSubject(w) {
  const c = w.cat, night = isNight(w), opts = [['yard', 0.6], ['pond', 1], ['oak', 0.8], ['flowers', 0.8], ['window', 0.3 + c.needs.lonely * 1.5]];
  if (w.stash.items.length > 2) opts.push(['stash', 0.9 + w.stash.items.length * 0.03]);
  if (night && moonPos(w)) opts.push(['moon', 2.2 + w.mysteries.moon.clues * 0.05]);
  if (w.weather.rain > 0.4) opts.push(['rain', 2]);
  if (!night && w.weather.rain < 0.2 && w.weather.cloud < 0.5) opts.push(['sunbeam', 1.2]);
  if (w.birds.some(b => b.state !== 'away')) opts.push(['bird', 1.1]);
  // now and then it makes something up instead of painting what is in front of it. what it makes up follows its mood
  const tier = tierOf(levelOf(c.art.xp)), vg = c.temper === 'vangogh';
  for (const [g, spec] of Object.entries(GEN)) {
    if (tier < spec.min) continue;
    const mood = g === 'swirl' ? (night ? 1.6 : 1) * (vg ? 8 : 1) : g === 'bloom' ? 1 + c.mood.joy : g === 'waves' ? 1 + c.needs.tired + (w.weather.rain > 0.4 ? 1 : 0) : g === 'splatter' ? 1 + c.needs.create : g === 'dots' ? 1 + c.traits.curious * 0.5 : 1;
    opts.push([g, 0.4 * mood]);
  }
  let r = random() * opts.reduce((s, o) => s + o[1], 0);
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
  const inspire = clamp(0.25 + c.mood.joy * 0.25 + (c.thoughtHint ? 0.1 : 0) + (subject === 'moon' ? w.mysteries.moon.conf * 0.2 : 0) + random() * 0.15, 0, 0.7);
  const score = clamp(level * 0.062 + inspire * 0.35 + rnd(-0.07, 0.09), 0.05, 0.98);
  const seed = Math.floor(rnd(1, 2 ** 31));
  const pal = palette(w, tier, mulberry32(seed));
  const n = a.count + 1, h = hourOf(w);
  const when = h < 6 ? 'Night' : h < 10 ? 'Morning' : h < 17 ? 'Afternoon' : h < 20 ? 'Dusk' : 'Night';
  const title = tier > 0 && GEN[subject] ? pick(GEN[subject].titles) : tier === 0 ? pick(['Untitled', 'Smear', 'Big Feeling', 'Paw Study']) + ' #' + n : tier === 1 ? `${subjectLabel(subject).replace(/^the /, '').replace(/^./, s => s.toUpperCase())}, Probably` : `${pick(['Study of', 'Portrait of', 'Notes on', 'Homage to', 'Variations on'])} ${subjectLabel(subject)}`;
  const work = { id: uid(), v: 2, n, day: dayOf(w), when, subject, level, tier, score, seed, pal, title, mood: c.mood.joy > 0.5 ? 'bright' : c.needs.tired > 0.6 ? 'drowsy' : 'calm', critique: critique(tier, score) };
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
  const vg = c.temper === 'vangogh'; a.xp += (5 + work.score * 14) * (vg ? 2 : 1); a.count++; a.works.unshift(work); // (the Van Gogh learns the craft about twice as fast)
  if (work.score > a.best) { a.best = work.score; a.hung = work.id; }
  if (a.works.length > 60) { // keep the best 40 and the newest 20
    const keep = new Set([...a.works.slice(0, 20), ...[...a.works].sort((x, y) => y.score - x.score).slice(0, 40)].map(x => x.id));
    a.works = a.works.filter(x => keep.has(x.id));
  }
  c.needs.create = vg ? 0.1 : 0; c.mood.joy = clamp(c.mood.joy + 0.15); w.stats.paintings++;
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
// ---------- generated pictures ----------
const hsl = (h, sat, l) => `hsl(${Math.round(((h % 360) + 360) % 360)},${Math.round(clamp(sat, 0, 100))}%,${Math.round(clamp(l, 4, 96))}%)`;
// a made-up palette: a few hues that go together, pitched by how the cat felt and what time of day it was
function genColors(rng, work) {
  const h0 = rng() * 360, k = rng(), offs = k < 0.25 ? [0, 30, 60] : k < 0.5 ? [0, 180, 200] : k < 0.75 ? [0, 120, 240] : [0, 25, 180, 205];
  const night = work.when === 'Night', s0 = work.mood === 'bright' ? 78 : work.mood === 'drowsy' ? 32 : 58, l0 = night ? 36 : work.mood === 'bright' ? 58 : work.mood === 'drowsy' ? 48 : 52;
  const cols = [];
  for (let i = 0; i < 6; i++) cols.push(hsl(h0 + offs[i % offs.length] + (rng() * 14 - 7), s0 + (rng() * 18 - 9), l0 + (i % 3) * 9 - 9 + (rng() * 8 - 4)));
  if (work.pal && work.pal.length > 2) cols.push(work.pal[2]); // one colour from what it has been collecting
  return { cols, dark: hsl(h0 + 210, 38, night ? 9 : 17), light: hsl(h0 + 20, 32, night ? 26 : 92) };
}
function genOps(work, W, H) {
  const rng = mulberry32(work.seed), R = (a, b) => a + rng() * (b - a), tier = work.tier, S = work.subject, ops = [];
  const { cols, dark, light } = genColors(rng, work), pk = () => cols[Math.floor(rng() * cols.length)];
  const wob = [8, 4, 2.2, 1.2, 0.6][tier], detail = [0, 0.5, 0.75, 1, 1.25][tier];
  const fill = c => ops.push({ t: 'f', c });
  const grad = (y0, y1, c0, c1, a = 1) => ops.push({ t: 'g', y0, y1, c0, c1, a });
  const ell = (x, y, rx, ry, c, a = 1, rot = 0) => ops.push({ t: 'e', x, y, rx, ry, c, a, rot });
  const dab = (x, y, r, c, a = 1) => ops.push({ t: 'd', x, y, r, c, a });
  const rect = (x, y, w, h, c, a = 1) => ops.push({ t: 'r', x, y, w, h, c, a });
  const curve = (x0, y0, x1, y1, w, c, a = 1, bend = 0) => { // a gently bent stroke
    const mx = (x0 + x1) / 2 + (y1 - y0) * bend, my = (y0 + y1) / 2 - (x1 - x0) * bend, pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6, u = 1 - t; pts.push([u * u * x0 + 2 * u * t * mx + t * t * x1 + R(-wob, wob) * 0.5, u * u * y0 + 2 * u * t * my + t * t * y1 + R(-wob, wob) * 0.5]); }
    ops.push({ t: 's', pts, w, c, a });
  };
  if (S === 'swirl') { // a sky that cannot sit still: strokes follow a field that circles a few centres
    fill(dark); grad(0, H, dark, cols[0], 0.85);
    const vs = []; for (let i = 0, n = 2 + Math.floor(rng() * 2); i < n; i++) vs.push({ x: R(0.15, 0.85) * W, y: R(0.15, 0.65) * H, k: (rng() < 0.5 ? -1 : 1) * R(0.7, 1.2), r: R(28, 56) });
    const ang = (x, y) => { let sx = 0, sy = 0; for (const v of vs) { const dx = x - v.x, dy = y - v.y, d = Math.hypot(dx, dy) + 1, g = (v.k * v.r) / (d + v.r * 0.6); sx += (-dy / d) * g; sy += (dx / d) * g; } return Math.atan2(sy, sx + 1e-6) + (rng() - 0.5) * (1.1 - tier * 0.2); };
    for (let i = 0, n = Math.round(60 + tier * 48); i < n; i++) {
      let x = R(0, W), y = R(0, H); const pts = [[x, y]], steps = 6 + Math.floor(rng() * 6), st = R(5, 9);
      for (let k = 0; k < steps; k++) { const a = ang(x, y); x += Math.cos(a) * st; y += Math.sin(a) * st; pts.push([x, y]); }
      ops.push({ t: 's', pts, w: Math.max(1.6, R(3, 7.5) - tier * 0.5), c: pk(), a: R(0.5, 0.9) });
    }
    for (const v of vs) { ell(v.x, v.y, 30, 30, light, 0.12); ell(v.x, v.y, 18, 18, light, 0.22); ell(v.x, v.y, 8 + rng() * 3, 8 + rng() * 3, '#fff3c4', 0.95); }
    if (tier >= 3) { const sx = rng() < 0.5 ? W * R(0.06, 0.16) : W * R(0.84, 0.94); ell(W / 2, H * 1.02, W * 0.7, H * 0.2, dark, 0.95); ell(sx, H * 0.72, 12, 62, '#14221b', 0.96); ell(sx - 7, H * 0.7, 6, 40, '#1d3326', 0.9); }
  } else if (S === 'splatter') { // thrown, flicked and dragged
    fill(rng() < 0.6 ? light : dark);
    for (let i = 0, n = 3 + Math.floor(detail * 3); i < n; i++) curve(R(0, W), R(0, H), R(0, W), R(0, H), R(9, 22), pk(), 0.85, R(-0.4, 0.4));
    for (let i = 0, n = Math.round(12 + detail * 14); i < n; i++) {
      let x = R(0, W), y = R(0, H), r = R(3, 9); const a = R(0, 6.283), c = pk();
      for (let k = 0; k < 8 && r > 0.8; k++) { dab(x, y, r, c, 0.9); x += Math.cos(a) * r * 1.6; y += Math.sin(a) * r * 1.6; r *= 0.72; }
    }
    for (let i = 0; i < 30; i++) dab(R(0, W), R(0, H), R(0.8, 2.4), pk(), 0.9);
  } else if (S === 'waves') { // bands of water or hill or weather, one behind the next
    const n = 4 + tier, sunny = rng() < 0.5; fill(light); grad(0, H * 0.5, sunny ? cols[3] : cols[0], light, 0.8);
    if (sunny) { ell(R(0.2, 0.8) * W, H * R(0.18, 0.3), 20, 20, '#fff2b0', 0.95); ell(W * 0.5, H * 0.24, 50, 50, '#fff6c8', 0.12); }
    for (let i = 0; i < n; i++) {
      const base = H * (0.28 + (0.72 * i) / n), amp = R(4, 12) * (1.15 - i * 0.04), f1 = R(0.012, 0.03), f2 = R(0.03, 0.07), p1 = R(0, 6.28), p2 = R(0, 6.28), pts = [], top = [];
      for (let x = 0; x <= W; x += 6) { const y = base + amp * Math.sin(x * f1 + p1) + amp * 0.4 * Math.sin(x * f2 + p2) + R(-wob, wob) * 0.3; pts.push([x, y]); top.push([x, y]); }
      pts.push([W, H], [0, H]); ops.push({ t: 'y', pts, c: cols[i % cols.length], a: 1 });
      if (tier >= 2) ops.push({ t: 's', pts: top, w: 1.8, c: light, a: 0.45 });
    }
  } else if (S === 'blocks') { // either a room of coloured cells or a soft stack of fields
    if (rng() < 0.55) {
      fill(dark); const cells = [], depth = 2 + (tier >= 3 ? 1 : 0) + (tier >= 4 ? 1 : 0);
      const split = (x, y, w, h, d) => { if (d === 0 || (d < depth && rng() < 0.15)) { cells.push([x, y, w, h]); return; } if (w > h) { const f = R(0.3, 0.7); split(x, y, w * f, h, d - 1); split(x + w * f, y, w * (1 - f), h, d - 1); } else { const f = R(0.3, 0.7); split(x, y, w, h * f, d - 1); split(x, y + h * f, w, h * (1 - f), d - 1); } };
      split(0, 0, W, H, depth + 1);
      for (const [x, y, w, h] of cells) rect(x + 1.5, y + 1.5, w - 3, h - 3, rng() < 0.62 ? pk() : light);
    } else {
      grad(0, H, cols[0], cols[2]); const nb = 2 + Math.floor(rng() * 2); let y = H * R(0.08, 0.14);
      for (let i = 0; i < nb; i++) { const h = (H * (0.8 - i * 0.05)) / nb, x = W * R(0.08, 0.16), w = W - 2 * x, c = pk(); for (let k = 0; k < 3; k++) rect(x + k * 3, y + k * 3, w - k * 6, h - k * 6, c, 0.4); y += h + H * 0.04; }
    }
  } else if (S === 'dots') { // a field of dots whose colour follows a hidden pattern
    fill(dark); grad(0, H, dark, cols[1], 0.5);
    const sp = [18, 16, 13, 11, 9][tier], f1 = R(0.02, 0.06), f2 = R(0.02, 0.06), p1 = R(0, 6.28), p2 = R(0, 6.28), cx = R(0.2, 0.8) * W, cy = R(0.2, 0.8) * H;
    for (let gy = 0; gy * sp < H + sp; gy++) for (let gx = 0; gx * sp < W + sp; gx++) {
      const x = gx * sp + R(-sp * 0.4, sp * 0.4), y = gy * sp + R(-sp * 0.4, sp * 0.4);
      const v = Math.sin(x * f1 + p1) + Math.sin(y * f2 + p2) + Math.hypot(x - cx, y - cy) * 0.012;
      dab(x, y, sp * R(0.32, 0.55), cols[Math.abs(Math.floor(v * 1.6 + R(-0.5, 0.5))) % cols.length], 0.92);
    }
  } else { // bloom: rings of petals around one centre
    fill(light); grad(0, H, light, cols[1], 0.6);
    const cx = W * R(0.38, 0.62), cy = H * R(0.4, 0.55), rings = 2 + (tier >= 3 ? 1 : 0) + (tier >= 4 ? 1 : 0), sc = R(0.9, 1.15);
    if (tier >= 2) for (let i = 0; i < 3; i++) curve(cx + R(-10, 10), cy + 30, cx + R(-40, 40), H, 3, '#3c7a3e', 0.9, R(-0.3, 0.3));
    for (let k = rings - 1; k >= 0; k--) {
      const n = 6 + k * 2 + Math.floor(rng() * 3), dist = (20 + k * 24) * sc, off = R(0, 6.28), c = pk();
      for (let i = 0; i < n; i++) { const a = off + (i / n) * 6.283; ell(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist * 0.92, dist * 0.55, dist * 0.27, c, 0.88, a); }
    }
    ell(cx, cy, 11, 11, light, 1); ell(cx, cy, 6, 6, pk(), 1);
    for (let i = 0; i < Math.round(18 * detail); i++) dab(R(0, W), R(0, H), R(0.8, 1.8), '#fff3c4', 0.7);
  }
  if (tier >= 4) { ops.push({ t: 'v' }); for (let i = 0; i < 20; i++) dab(R(0, W), R(0, H), R(0.8, 1.7), '#fff3c4', 0.5); }
  ops.push({ t: 'p', x: W - 18, y: H - 14, s: 6, c: tier >= 3 ? '#2a2230' : work.pal[work.pal.length - 1] });
  return ops;
}

// extra things for the yard scenes, from their own stream so the main picture is left as it was. 'back' goes behind the
// subject, 'front' on top of it.
function sceneExtras(work, W, H, hz) {
  const rng = mulberry32((work.seed ^ 0x9e3779b9) >>> 0), R = (a, b) => a + rng() * (b - a), tier = work.tier;
  const day = work.when !== 'Night', rain = work.subject === 'rain', back = [], front = [];
  const E = (x, y, rx, ry, c, a = 1) => ({ t: 'e', x, y, rx, ry, c, a }), D = (x, y, r, c, a = 1) => ({ t: 'd', x, y, r, c, a }), St = (pts, w, c, a = 1) => ({ t: 's', pts, w, c, a });
  const menu = ['hills', 'treeline', 'fence', 'lamp']; if (!rain) menu.push(day ? 'sun' : 'stars', ...(day ? ['flock'] : []));
  for (let i = menu.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [menu[i], menu[j]] = [menu[j], menu[i]]; }
  for (const m of menu.slice(0, tier >= 3 ? 3 : 2)) {
    if (m === 'hills') for (let i = 0; i < 2; i++) back.push(E(R(0, W), hz, R(70, 120), R(14, 30), day ? '#7f9fb6' : '#1c2a44', 0.5));
    else if (m === 'treeline') for (let i = 0, n = 6 + Math.floor(rng() * 4); i < n; i++) { const x = R(0, W), r = R(9, 14); back.push(St([[x, hz + 2], [x, hz - 8]], 3, '#4b3626', 0.9), E(x, hz - 12, r, r * 0.9, day ? '#3c6b3a' : '#16301f', 0.9)); }
    else if (m === 'fence') { const x0 = R(0, 40); back.push(St([[0, hz - 2], [W, hz - 2]], 1.5, '#8a6a4c', 0.9)); for (let x = x0; x < W; x += 18) back.push(St([[x, hz + 6], [x, hz - 9]], 2.5, '#8a6a4c', 0.95)); }
    else if (m === 'sun') { const x = R(0.1, 0.9) * W, y = H * R(0.08, 0.22); back.push(E(x, y, 34, 34, '#fff6c8', 0.22), E(x, y, 17, 17, '#fff2b0', 0.95)); }
    else if (m === 'stars') for (let i = 0; i < 24; i++) back.push(D(R(0, W), R(0, hz * 0.8), R(0.8, 1.6), '#fff', 0.85));
    else if (m === 'flock') for (let i = 0, n = 3 + Math.floor(rng() * 3), x = R(0.1, 0.7) * W, y = H * R(0.08, 0.3); i < n; i++, x += R(10, 20), y += R(-4, 6)) back.push(St([[x - 6, y + 2], [x, y], [x + 6, y + 2]], 1.6, '#2b2830', 0.85));
    else if (m === 'lamp') { const x = R(0.1, 0.9) * W; front.push(St([[x, hz + 22], [x, hz - 20]], 2.5, '#3b2f36', 0.95), E(x, hz - 24, 12, 12, '#ffd978', 0.2), E(x, hz - 24, 5, 5, '#ffd978', 0.95)); }
  }
  if (tier >= 3) for (let i = 0; i < 14; i++) { const x = R(0, W), y = H - R(2, 22); front.push(St([[x, y], [x + R(-3, 3), y - R(6, 12)]], 1.8, '#3c7a3e', 0.8)); }
  return { back, front };
}

// Builds a list of drawing ops (deterministic from the work), then draws any fraction of them.
export function buildOps(work, W = 240, H = 180) {
  if (work.tier > 0 && GEN[work.subject]) return genOps(work, W, H);
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
    const mark = ops.length;
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
    if (work.v >= 2 && tier >= 2) { const x = sceneExtras(work, W, H, hz); ops.splice(mark, 0, ...x.back); ops.push(...x.front); }
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
    else if (o.t === 'e') { ctx.fillStyle = o.c; ctx.beginPath(); ctx.ellipse(o.x, o.y, Math.max(0.1, o.rx), Math.max(0.1, o.ry), o.rot || 0, 0, 6.283); ctx.fill(); }
    else if (o.t === 'y') { ctx.fillStyle = o.c; ctx.beginPath(); o.pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); }
    else if (o.t === 'd') { ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 6.283); ctx.fill(); }
    else if (o.t === 's') { ctx.strokeStyle = o.c; ctx.lineWidth = o.w; ctx.beginPath(); o.pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
    else if (o.t === 'p') { ctx.fillStyle = o.c; ctx.beginPath(); ctx.ellipse(o.x, o.y + o.s * 0.25, o.s * 0.55, o.s * 0.45, 0, 0, 6.283); ctx.fill(); for (const [dx, dy] of [[-0.75, -0.4], [-0.28, -0.85], [0.28, -0.85], [0.75, -0.4]]) { ctx.beginPath(); ctx.arc(o.x + dx * o.s, o.y + dy * o.s * 0.9, o.s * 0.22, 0, 6.283); ctx.fill(); } }
    else if (o.t === 'v') { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,6,20,0.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }
  ctx.restore();
}
