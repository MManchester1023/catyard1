// Clicking the oak. You can give the old tree a shake: leaves fall, and now and then a piece of bark or a twig comes
// loose and lies on the grass for the cat to pick up (acts.js), just like something a bird has dropped. It is not every
// time, there is a short pause between shakes, and the tree only has so much to give in a day (all three are in pace.js).
import { random } from './rng.js';
import { rnd, uid, MATERIALS, MAT_CAP } from './util.js';
import { note, dayOf, blocked, randomOpenPoint } from './world.js';
import { PACE } from './pace.js';
import { openWishes, answerNeed } from './wishes.js';

const MAX_ITEMS = 7; // (the same limit as for anything lying in the yard)
const LEAF_LIFE = 1.9;

// is this point (in yard coordinates) on the oak? the crown is a wide oval over the trunk
export function treeHit(w, x, y) {
  const t = w.o.tree;
  const crown = ((x - t.x) / 96) ** 2 + ((y - (t.y - 130)) / 82) ** 2 <= 1;
  const trunk = x >= t.x - 18 && x <= t.x + 22 && y >= t.y - 120 && y <= t.y + 14;
  return crown || trunk;
}

// bark or a twig, whichever it has more room for
function oakMaterial(w) {
  const asked = openWishes(w).find(x => x.kind === 'need' && (w.cat.inv[x.type] || 0) < MAT_CAP); if (asked) return asked.type; // (if it has asked for one, that is the one that falls)
  const inv = w.cat.inv || {}, room = ['bark', 'twig'].filter(m => MATERIALS.includes(m)).map(m => [m, Math.max(0, 1 - (inv[m] || 0) / MAT_CAP)]);
  const total = room.reduce((s, r) => s + r[1], 0); if (total <= 0) return null;
  let r = random() * total; for (const [m, v] of room) { r -= v; if (v > 0 && r <= 0) return m; } // (never one it has no room for, even on a roll of exactly 0)
  return room.filter(x => x[1] > 0).pop()[0];
}

// Shake the tree if (x, y) is on it. Returns null for a click elsewhere; otherwise { dropped }, the item that fell or null.
export function shakeTree(w, x, y) {
  if (!treeHit(w, x, y)) return null;
  if (!w.leaves) w.leaves = [];
  for (let i = 0; i < 7 && w.leaves.length < 28; i++) w.leaves.push({ x: w.o.tree.x + rnd(-70, 70), y: w.o.tree.y - rnd(80, 190), t: -i * 0.05, s: rnd(0, 6.28) });
  const s = w.shake || (w.shake = { day: 0, n: 0, at: -999 }), day = dayOf(w);
  if (w.clock - s.at < PACE.shakeCool) return { dropped: null };
  s.at = w.clock; if (s.day !== day) { s.day = day; s.n = 0; }
  if (s.n >= PACE.shakePerDay || random() > PACE.shakeChance || w.items.length >= MAX_ITEMS) return { dropped: null };
  const type = oakMaterial(w); if (!type) return { dropped: null };
  const t = w.o.tree; let px = t.x + rnd(-44, 30), py = t.y + rnd(8, 30);
  if (blocked(w, px, py)) { const p = randomOpenPoint(w, t.x - 60, t.x + 40, t.y, t.y + 40); px = p.x; py = p.y; }
  const it = { id: uid(), type, color: null, x: px, y: py, age: 0, from: 'tree' }; w.items.push(it); s.n++;
  note(w, `${type === 'bark' ? 'A piece of bark' : 'A twig'} shook loose from the oak.`, 'craft');
  answerNeed(w, type);
  return { dropped: it };
}

// the falling leaves (drawn by render.js)
export function leavesTick(w, dt) {
  if (!w.leaves || !w.leaves.length) return;
  for (const l of w.leaves) l.t += dt;
  w.leaves = w.leaves.filter(l => l.t < LEAF_LIFE);
}
export const LEAF_SECONDS = LEAF_LIFE;
