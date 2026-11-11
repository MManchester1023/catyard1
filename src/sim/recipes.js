// Recipes: what the cat can make, what each costs, when it would want one, and the per-cat state that goes with
// making things (materials, known recipes, things made, wishes). Rules only; the act of making is in craft.js.
import { matText, MATERIALS } from './util.js';

export const dayNo = w => Math.floor(w.clock / w.dayLen) + 1;
const framesMade = w => w.cat.crafted.filter(x => x.recipe === 'frame').length;

// preset recipes are things it already knows how to make. the others it has to look up on the tablet first.
export const RECIPES = {
  table: {
    name: 'bark table', cost: { bark: 4 }, preset: true, why: 'a proper place to keep my things where I can see them',
    can: w => !w.table, desire: w => (w.cat.mem.known.tree ? 2.6 : 0),
  },
  frame: {
    name: 'bark frame', cost: { bark: 2, twig: 1 }, preset: true, why: 'my best painting deserves a frame',
    can: w => w.cat.art.count > framesMade(w) && framesMade(w) < 3, desire: () => 1.2,
  },
  feeder: {
    name: 'bird feeder', cost: { bark: 3, twig: 2 }, topic: 'Bird feeder', match: /feeder/i, why: 'the birds would come to me instead of the other way round',
    can: w => !w.deco.feeder, desire: w => (w.cat.mem.known.tablet && dayNo(w) >= 3 ? 1 + Math.min(1, ((w.stats.misses || 0) + (w.stats.mice || 0)) * 0.1) : 0),
  },
  chime: {
    name: 'wind chime', cost: { twig: 3, twine: 1 }, topic: 'Wind chime', match: /chime/i, why: 'something gentle that sings when the air moves',
    can: w => !w.deco.chime, desire: w => (w.cat.mem.known.tablet && dayNo(w) >= 4 ? 0.8 + w.cat.needs.fear * 2 : 0),
  },
};
export const RECIPE_IDS = Object.keys(RECIPES);
export const knows = (w, id) => !!RECIPES[id].preset || !!(w.cat.recipes[id] && w.cat.recipes[id].known);
export const costText = cost => Object.entries(cost).map(([m, n]) => matText(m, n)).join(' + ');

// everything about making things that lives on the cat and the world, filled in for new worlds and old saves
export function ensureCraft(w) {
  const c = w.cat;
  if (!c.inv) c.inv = {}; for (const m of MATERIALS) if (typeof c.inv[m] !== 'number') c.inv[m] = 0;
  if (!c.recipes) c.recipes = {}; if (!c.crafted) c.crafted = []; if (!c.wishes) c.wishes = [];
  if (c.lastWishAt == null) c.lastWishAt = -999;
  if (w.table === undefined) w.table = null; if (!w.deco) w.deco = {};
  if (!w.hist) w.hist = []; if (!w.days) w.days = {};
  for (const k of ['crafted', 'gathered', 'wishes']) if (!w.stats[k]) w.stats[k] = 0;
  return w;
}
