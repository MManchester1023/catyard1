// Recipes: what the cat can make, what each costs, when it would want one, and the per-cat state that goes with
// making things (materials, known recipes, things made, wishes). Rules only; the act of making is in craft.js.
import { matText, MATERIALS } from './util.js';

export const dayNo = w => Math.floor(w.clock / w.dayLen) + 1;
// frames hung round paintings (the first kind of frame it ever made)
const hungFrames = w => w.cat.crafted.filter(x => x.recipe === 'frame' && x.work).length;
export const paintingToFrame = w => w.cat.art.count > hungFrames(w) && hungFrames(w) < 3;
// oak frames are parts: the easel, the table, the bird feeder and the cat tree are each built out of some. It only makes
// the ones it is going to use (and frames a painting with any that are left over)
const BUILT = { easel: w => !!w.easelMade, table: w => !!w.table, feeder: w => !!(w.deco && w.deco.feeder), cattree: w => !!w.catTree };
export const frameTotal = w => Object.keys(BUILT).reduce((s, id) => { const r = RECIPES[id]; return s + (r.cost.frame && !BUILT[id](w) && knows(w, id) ? r.cost.frame : 0); }, 0);
export const frameDemand = w => Math.max(0, frameTotal(w) - (w.cat.inv.frame || 0));
export const frameSpare = w => Math.max(0, (w.cat.inv.frame || 0) - frameTotal(w));

// preset recipes are things it already knows how to make. the others it has to look up on the tablet first.
export const RECIPES = {
  frame: {
    name: 'oak frame', cost: { bark: 2 }, preset: true, part: true, why: 'bigger things are built out of frames',
    can: w => frameDemand(w) > 0 || paintingToFrame(w), desire: w => (frameDemand(w) > 0 ? 0 : paintingToFrame(w) ? 1.0 : 0), // (the ones it needs are made without a want; a spare is for a painting)
  },
  easel: {
    name: 'easel', cost: { frame: 2 }, preset: true, why: 'I cannot paint on nothing',
    can: w => !w.easelMade, desire: w => (w.cat.mem.known.tree ? 2.4 + (w.cat.temper === 'vangogh' ? 1.4 : 0) + w.cat.needs.create * 1.2 : 0),
  },
  table: {
    name: 'bark table', cost: { frame: 2, bark: 2 }, preset: true, why: 'a proper place to keep my things where I can see them',
    can: w => !w.table, desire: w => (w.cat.mem.known.tree ? 2.6 : 0),
  },
  feeder: {
    name: 'bird feeder', cost: { frame: 1, bark: 1, twig: 2 }, topic: 'Bird feeder', match: /feeder/i, why: 'the birds would come to me instead of the other way round',
    can: w => !w.deco.feeder, desire: w => (w.cat.mem.known.tablet && dayNo(w) >= 3 ? 1 + Math.min(1, ((w.stats.misses || 0) + (w.stats.mice || 0)) * 0.1) : 0),
  },
  chime: {
    name: 'wind chime', cost: { twig: 3, twine: 1 }, topic: 'Wind chime', match: /chime/i, why: 'something gentle that sings when the air moves',
    can: w => !w.deco.chime, desire: w => (w.cat.mem.known.tablet && dayNo(w) >= 4 ? 0.8 + w.cat.needs.fear * 2 : 0),
  },
};
// the two things below are not made at the bench. 'string' is a way of getting twine (it is only knowledge), and the
// cat tree is built like the others but takes a lot more.
RECIPES.string = {
  name: 'way to get string', knowledge: true, cost: {}, topic: 'Twine', match: /twine|string|thread|cordage|yarn|fib(?:er|re)|rope/i,
  why: 'I keep needing string, and the human is not always here', learnText: 'work out where string comes from',
  can: w => !knows(w, 'string'), desire: w => (w.cat.mem.known.cushion && ['chime', 'cattree'].some(id => knows(w, id) && RECIPES[id].can(w)) && (w.cat.inv.twine || 0) < 1 ? 1.5 : 0),
};
RECIPES.cattree = {
  name: 'cat tree', cost: { frame: 3, bark: 2, twig: 5, twine: 3 }, topic: 'Cat tree', match: /cat tree|cat furniture|cat condo|cat tower|scratching post/i, why: 'somewhere tall that is mine',
  can: w => !w.catTree, desire: w => (w.cat.mem.known.tablet && dayNo(w) >= 5 && w.table ? 1.0 : 0),
};
export const RECIPE_IDS = Object.keys(RECIPES);
export const knows = (w, id) => !!RECIPES[id].preset || !!(w.cat.recipes[id] && w.cat.recipes[id].known);
export const costText = cost => Object.entries(cost).map(([m, n]) => matText(m, n)).join(' + ');

// everything about making things that lives on the cat and the world, filled in for new worlds and old saves
export function ensureCraft(w) {
  const c = w.cat;
  if (!c.inv) c.inv = {}; for (const m of [...MATERIALS, 'frame']) if (typeof c.inv[m] !== 'number') c.inv[m] = 0;
  if (!c.recipes) c.recipes = {}; if (!c.crafted) c.crafted = []; if (!c.wishes) c.wishes = [];
  if (c.lastWishAt == null) c.lastWishAt = -999;
  if (c.upset === undefined) c.upset = null; if (!c.upAt) c.upAt = {}; if (typeof c.missStreak !== 'number') c.missStreak = 0;
  if (w.table === undefined) w.table = null; if (w.easelMade === undefined) w.easelMade = null; if (!w.deco) w.deco = {};
  if (!w.hist) w.hist = []; if (!w.days) w.days = {};
  for (const k of ['crafted', 'gathered', 'wishes']) if (!w.stats[k]) w.stats[k] = 0;
  return w;
}
