// The collector quirk: what the cat covets, where it hides the stash, how it arranges it.
import { rnd, pick, uid, an, ITEM_TYPES, ITEM_LABEL, ITEM_PLURAL, COLOR_NAMES, MATERIALS, MAT_CAP, mulberry32 } from './util.js';
import { STASH_SITES, note, journal, dayOf } from './world.js';
import { feel, affinity } from './feelings.js';
import { upsetBy } from './upset.js';
import { random } from './rng.js';

export const TASTES = ['pile', 'rows', 'ring', 'rainbow'];
export const TASTE_LABEL = { pile: 'a loose pile', rows: 'tidy rows by color', ring: 'a ring', rainbow: 'a rainbow line' };

export function makeQuirk() {
  return { kind: 'collector', item: pick(ITEM_TYPES), favColor: pick(COLOR_NAMES.filter(c => c !== 'black' && c !== 'white')), taste: pick(TASTES), tasteSince: 0, visits: 0, lastVisit: 0, lastTidy: -999 };
}

// the cat picks its secret spot the first time it has something to hide
export function chooseSite(w) {
  const s = w.stash; if (s.site) return s.site;
  if (w.table) { s.site = { x: w.table.x, y: w.table.y, label: 'the bark table', table: true }; s.seed = s.seed || Math.floor(rnd(1, 1e9)); return s.site; }
  s.site = pick(STASH_SITES); s.seed = Math.floor(rnd(1, 1e9));
  note(w, `${w.cat.name} picked a secret spot for a stash: ${s.site.label}.`, 'collect');
  journal(w, `I have chosen ${s.site.label} as the place where my ${quirkWord(w.cat.quirk)} will live. Nobody needs to know.`, 'stash');
  return s.site;
}
export const itemName = (type, color, withColor = true) => (withColor && color ? color + ' ' : '') + ITEM_LABEL[type];
export const quirkWord = (q, plural = true) => (plural ? ITEM_PLURAL[q.item] : ITEM_LABEL[q.item]);

// everything in the stash, favourite first: what it collects, its colours, and what has made it feel good
export function stashRank(w) {
  const c = w.cat, q = c.quirk, t = c.tastes || { color: {}, type: {} }, groups = new Map();
  for (const it of w.stash.items) { const k = it.type + '|' + it.color; if (!groups.has(k)) groups.set(k, { type: it.type, color: it.color, count: 0 }); groups.get(k).count++; }
  const rows = [...groups.values()].map(g => {
    const ac = affinity(w, 'color:' + g.color), at = affinity(w, 'type:' + g.type), why = [];
    let s = ((t.color[g.color] ?? 0.3) - 0.3) * 1.2 + ((t.type[g.type] ?? 0.3) - 0.3) * 1.2 + ac * 0.6 + at * 0.6 + Math.min(0.2, (g.count - 1) * 0.05);
    if (g.type === q.item) { s += 0.5; why.push('the thing it collects'); }
    if (g.color === q.favColor) { s += 0.4; why.push('favourite colour'); }
    if (ac + at > 0.25) why.push('makes it feel good'); else if (ac + at < -0.15) why.push('it is uneasy about these');
    if (g.type === 'coin') { s += 3; why.length = 0; why.push('found in the roots of the oak'); }
    return Object.assign(g, { name: itemName(g.type, g.color), plural: g.count === 1 ? itemName(g.type, g.color) : g.color + ' ' + ITEM_PLURAL[g.type], score: s, strength: Math.max(0, Math.min(1, 0.45 + s / 3)), why });
  });
  return rows.sort((a, b) => b.score - a.score || b.count - a.count);
}

export function stashColors(w) { const m = {}; w.stash.items.forEach(i => (m[i.color] = (m[i.color] || 0) + 1)); return m; }
export function stashOf(w, type = null) { return type ? w.stash.items.filter(i => i.type === type) : w.stash.items; }

// how badly the cat wants a thing it can see on the ground
export function itemValue(w, it) {
  if (MATERIALS.includes(it.type)) return w.cat.inv && w.cat.inv[it.type] < MAT_CAP ? (it.type === 'twine' ? 0.95 : 0.85) : 0; // building parts are something every cat can use
  const q = w.cat.quirk, have = stashColors(w);
  let v = it.type === q.item ? 1 : 0.1;
  if (it.color === q.favColor) v += 0.55;
  if (!have[it.color]) v += 0.25;
  const wantsIt = w.cat.wants.some(x => x.kind === 'find' && x.item === it.type && x.color === it.color);
  if (wantsIt) v += 0.9;
  const t = w.cat.tastes; if (t) v += ((t.color[it.color] ?? 0.3) - 0.3) * 0.5 + ((t.type[it.type] ?? 0.3) - 0.3) * 0.3; // what has felt good before
  return v;
}
export function bestItem(w, from) {
  let best = null, bv = 0.45;
  for (const it of w.items) {
    const d = Math.hypot(it.x - from.x, it.y - from.y), v = itemValue(w, it) - d / 1400 + (it.moon ? 0.6 : 0); // (a wish from the moon is hard to ignore)
    if (v > bv) { bv = v; best = it; }
  }
  return best;
}

export function layoutStash(w) {
  const s = w.stash, q = w.cat.quirk, n = s.items.length, rng = mulberry32(s.seed);
  const order = [...s.items].sort((a, b) => COLOR_NAMES.indexOf(a.color) - COLOR_NAMES.indexOf(b.color) || a.type.localeCompare(b.type));
  if (s.site && s.site.table) { // laid out on the tabletop: a loose scatter, or tidy rows by colour
    if (q.taste === 'pile') s.items.forEach(it => { it.ox = (rng() - 0.5) * 48; it.oy = (rng() - 0.5) * 11; it.rot = rng() * 6; });
    else order.forEach((it, i) => { const cols = 10, row = Math.floor(i / cols), col = i % cols; it.ox = (col - (cols - 1) / 2) * 4.8 + (row % 2) * 1.2; it.oy = -5 + row * 3.6 + (i >= cols * 3 ? rng() * 2 : 0); it.rot = 0; });
    return;
  }
  if (q.taste === 'pile') s.items.forEach(it => { const a = rng() * 6.283, r = Math.sqrt(rng()) * Math.min(26, 8 + n * 1.1); it.ox = Math.cos(a) * r; it.oy = Math.sin(a) * r * 0.55; it.rot = rng() * 6; });
  else if (q.taste === 'rows') order.forEach((it, i) => { const per = 7, row = Math.floor(i / per), col = i % per; it.ox = (col - 3) * 9; it.oy = (row - 1) * 9; it.rot = 0; });
  else if (q.taste === 'ring') order.forEach((it, i) => { const a = (i / Math.max(1, n)) * 6.283, r = 12 + Math.floor(i / 12) * 9; it.ox = Math.cos(a) * r; it.oy = Math.sin(a) * r * 0.55; it.rot = a; });
  else order.forEach((it, i) => { it.ox = (i - (n - 1) / 2) * Math.min(9, 60 / Math.max(1, n)); it.oy = Math.sin(i * 0.5) * 4; it.rot = 0; });
}

export function addToStash(w, item) {
  const s = w.stash, c = w.cat, q = c.quirk;
  chooseSite(w);
  const it = { id: uid(), type: item.type, color: item.color, ox: 0, oy: 0, rot: 0 };
  s.items.push(it); s.known = s.items.length; layoutStash(w);
  w.stats.collected++;
  note(w, `${c.name} added ${an(itemName(it.type, it.color))} to the stash (${s.items.length} now).`, 'collect');
  const tc = c.tastes ? (c.tastes.color[it.color] ?? 0.3) * (c.tastes.type[it.type] ?? 0.3) : 0.2; // adding a favourite feels better than adding a stray
  feel(w, ['color:' + it.color, 'type:' + it.type], { joy: 0.04 + 0.4 * tc }, 'content');
  c.needs.create = Math.min(1, c.needs.create + 0.02);
  const sameType = s.items.filter(i => i.type === it.type).length;
  if (s.items.length === 1) journal(w, `My first treasure: ${an(itemName(it.type, it.color))}. It is perfect.`, 'stash');
  else if (s.items.length % 10 === 0) journal(w, `${s.items.length} treasures now. ${sameType} are ${quirkWord(q)}. I check them often.`, 'stash');
  return it;
}

// the cat tidies the stash according to its current taste, which can change
export function tidyStash(w) {
  const q = w.cat.quirk, d = dayOf(w);
  if (d - q.tasteSince >= 4 && random() < 0.25) {
    const next = pick(TASTES.filter(t => t !== q.taste)); const prev = q.taste; q.taste = next; q.tasteSince = d;
    note(w, `${w.cat.name} is rearranging the stash into ${TASTE_LABEL[next]}.`, 'collect');
    journal(w, `${TASTE_LABEL[prev]} was childish. The stash will be ${TASTE_LABEL[next]} from now on.`, 'stash');
  }
  layoutStash(w); q.lastTidy = w.clock;
}

export function stealFromStash(w, n = 1) {
  const out = [];
  for (let i = 0; i < n && w.stash.items.length; i++) out.push(...w.stash.items.splice(Math.floor(random() * w.stash.items.length), 1));
  layoutStash(w); return out;
}

// called when the cat is at the stash: notices anything missing
export function noticeTheft(w) {
  const s = w.stash, c = w.cat; if (s.known == null || s.items.length >= s.known) { s.known = s.items.length; return false; }
  const lost = s.known - s.items.length; s.known = s.items.length;
  note(w, `${c.name} counted the stash and found ${lost === 1 ? 'one item' : lost + ' items'} missing!`, 'collect');
  journal(w, `Someone has been in my stash. ${lost === 1 ? 'One is' : lost + ' are'} gone. I will remember this.`, 'stash');
  c.needs.fear = Math.min(1, (c.needs.fear || 0) + 0.5);
  upsetBy(w, 'theft', `${lost === 1 ? 'One treasure is' : lost + ' treasures are'} gone and I did not see who. I keep looking at the fence.`, { level: 0.7, days: 0.5, bond: 0, cool: 0.2, note: 'something was taken from its stash.', hint: 'theft' });
  return lost;
}
