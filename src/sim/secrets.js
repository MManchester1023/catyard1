// Things hidden in the yard. Behind the cabin there may be a cat tree (found by a cat that wonders what is back there,
// or built once it has read how). A full moon grants one wish once the cat has understood the moon. A very curious
// cat may start wondering about the old oak and, in time, find a shiny coin in the roots (see mysteries.js).
import { rnd, uid } from './util.js';
import { note, journal, dayOf, moonPhase, moonPos, blocked } from './world.js';
import { feel } from './feelings.js';
import { PACE, paceOf } from './pace.js';
import { starsRoll, glitterThing } from './stars.js';

// the cat tree stands behind the cabin; the cat walks to its foot and climbs
export const CAT_TREE = { x: 50, y: 300, top: 52 };
export const catTreeSpot = () => ({ x: CAT_TREE.x + 2, y: CAT_TREE.y + 3, face: 1 });
export const coinActive = w => !!(w.cat.coinUntil && w.cat.coinUntil > w.clock);

// once the cat has found it or built it the tree is simply there, and it likes to sit in it
export function foundCatTree(w, how = 'found') {
  const c = w.cat; if (w.catTree) return false;
  w.catTree = { x: CAT_TREE.x, y: CAT_TREE.y, how, day: dayOf(w) };
  c.peekUrge = false; c.wants = c.wants.filter(x => x.recipe !== 'cattree'); w.stats.catTree = 1;
  if (how === 'found') {
    journal(w, 'Behind the cabin, where I had never looked: a cat tree. A real one, with a post and a box and a place at the top. I do not know who left it. I know it is mine.', 'discover');
    note(w, `${c.name} wandered round the back of the cabin and found a cat tree.`, 'discover');
    feel(w, ['act:cattree'], { joy: 0.5, fear: -0.2 }, 'thrilled');
  } else {
    journal(w, 'I built a cat tree. It leans a little to the left. I have decided that this is a feature.', 'craft');
    note(w, `${c.name} finished building a cat tree behind the cabin.`, 'craft');
  }
  c.thoughtHint = how === 'found' ? 'catTreeFound' : 'catTreeMade';
  return true;
}

// a little while after the full moon rises the cat has been granted one wish: something turns up by the pond
export function moonWishTick(w) {
  const m = w.mysteries.moon; if (!m.solved) return false;
  if (moonPhase(w) !== 4 || !moonPos(w) || dayOf(w) - (w.moonWishDay == null ? -99 : w.moonWishDay) < 5) return false;
  return moonWish(w);
}
export function moonWish(w) {
  const c = w.cat, o = w.o, q = c.quirk; w.moonWishDay = dayOf(w);
  let x = o.pond.x + rnd(-46, 46), y = o.pond.y + o.pond.ry + 18; if (blocked(w, x, y)) { x = o.pond.x; y = o.pond.y + o.pond.ry + 24; }
  const { type, color } = glitterThing(w);
  const it = { id: uid(), type, color, x, y, age: 0, moon: true }; w.items.push(it);
  w.stats.moonWishes = (w.stats.moonWishes || 0) + 1;
  note(w, `The full moon granted ${c.name} a wish: something glittering appeared by the pond.`, 'wonder');
  journal(w, 'The moon is full and I asked. Something is shining at the edge of the pond that was not there before. The moon keeps its word.', 'moonwish');
  c.thoughtHint = 'moonWish';
  return it;
}

// every sixth of a day: does it start wondering about something?
export function secretsRoll(w) {
  const c = w.cat, k = c.mem.known, T = c.traits, day = dayOf(w), pace = paceOf(w);
  if (!w.catTree && !c.peekUrge && day >= 2 && Math.random() < PACE.peekChance * (0.6 + T.curious * 0.8) / pace) { c.peekUrge = true; c.thoughtHint = 'peekUrge'; }
  const m = w.mysteries.tree;
  if (!m.interest && !m.solved && k.tree && T.curious > 0.75 && day >= 3 && Math.random() < PACE.treeUrge / pace) {
    m.interest = true; m.seen = true;
    note(w, `${c.name} keeps looking at the roots of the old oak.`, 'wonder');
    journal(w, 'There is something about the oak. Not the bark. Underneath. I have started sniffing at the roots when nobody is looking.', 'mystery');
    c.thoughtHint = 'oakCurious';
  }
  starsRoll(w);
}
