// The cat tree behind the cabin: where it stands, where the cat sits to climb it, and what happens when it first
// turns up, whether the cat found it (secrets.js) or built it (craft.js). It is its own small module so that crafting
// and the secrets can both use it without depending on each other.
import { note, journal, dayOf } from './world.js';
import { feel } from './feelings.js';

// the cat tree stands behind the cabin; the cat walks to its foot and climbs
export const CAT_TREE = { x: 50, y: 300, top: 52 };
export const catTreeSpot = () => ({ x: CAT_TREE.x + 2, y: CAT_TREE.y + 3, face: 1 });
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
