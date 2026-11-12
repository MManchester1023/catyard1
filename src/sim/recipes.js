// Recipes: what the cat can make, what each costs, when it would want one, and the per-cat state that goes with
// making things (materials, known recipes, things made, wishes). Rules only; the act of making is in craft.js.
import { matText, MATERIALS } from './util.js';

export const dayNo = w => Math.floor(w.clock / w.dayLen) + 1;
// A painting it has framed is for sale (economy.js). It only has a few for sale at a time, and frames the rest as those sell.
export const FOR_SALE_MAX = 3;
const forSaleNow = w => w.cat.art.works.filter(x => x.status === 'forSale').length;
export const unlistedWork = w => w.cat.art.works.filter(x => !x.status).sort((a, b) => b.score - a.score)[0] || null;
export const paintingToFrame = w => !!unlistedWork(w) && forSaleNow(w) < FOR_SALE_MAX;
// oak frames are parts: the easel, the bird feeder, the wind chime and the cat tree are each built out of some. It only makes
// the ones it is going to use (and frames a painting with any that are left over)
const BUILT = { easel: w => !!w.easelMade, table: w => !!w.table, feeder: w => !!(w.deco && w.deco.feeder), chime: w => !!(w.deco && w.deco.chime), cattree: w => !!w.catTree };
export const frameTotal = w => Object.keys(BUILT).reduce((s, id) => { const r = RECIPES[id]; return s + (r.cost.frame && !BUILT[id](w) && knows(w, id) ? r.cost.frame : 0); }, 0);
export const frameDemand = w => Math.max(0, frameTotal(w) - (w.cat.inv.frame || 0));
export const frameSpare = w => Math.max(0, (w.cat.inv.frame || 0) - frameTotal(w));

// How badly it wants to make something. Zero once it has an easel (or before it has found the oak); otherwise it climbs
// with the creative urge, from nothing at half full (a Van Gogh feels it sooner) to everything at full. It drives the
// gathering and the building of the easel (mind.js), the oak's daily allowance (pace.js) and the want itself, below.
// Playing it off (yarn, zoomies: acts.js) lowers it, since the urge it is made from goes down.
export const easelUrge = w => {
  const c = w.cat; if (w.easelMade || !c.mem.known.tree) return 0;
  const from = c.temper === 'vangogh' ? 0.35 : 0.5;
  return Math.max(0, Math.min(1, (c.needs.create - from) / (1 - from)));
};

// preset recipes are things it already knows how to make. the others it has to look up on the tablet first.
export const RECIPES = {
  frame: {
    name: 'oak frame', cost: { bark: 2 }, preset: true, part: true, why: 'bigger things are built out of frames',
    desc: 'Bark pressed flat and pegged into a square. The easel, bird feeder, wind chime and cat tree are built out of frames, and a spare goes round a painting.',
    can: w => frameDemand(w) > 0 || paintingToFrame(w), desire: w => (frameDemand(w) > 0 ? 0 : paintingToFrame(w) ? 1.0 : 0), // (the ones it needs are made without a want; a spare is for a painting)
  },
  easel: {
    name: 'easel', cost: { frame: 2, twig: 3 }, preset: true, order: 0, why: 'I cannot paint on nothing',
    desc: 'Two frames leaned together and braced with twigs, so a canvas can stand up on its own. Without one the cat cannot paint.',
    can: w => !w.easelMade, desire: w => (w.cat.mem.known.tree ? 2.4 + (w.cat.temper === 'vangogh' ? 1.4 : 0) + w.cat.needs.create * 1.2 + easelUrge(w) * 4 : 0),
  },
  table: {
    name: 'bark table', cost: { bark: 2, twig: 4 }, preset: true, order: 1, why: 'a proper place to keep my things where I can see them',
    desc: 'Bark laid across twig legs. Everything the cat collects moves onto it, where it can be seen instead of hidden.',
    can: w => !w.table, desire: w => (w.cat.mem.known.tree ? 2.6 : 0),
  },
  feeder: {
    name: 'bird feeder', cost: { frame: 1, bark: 2, twig: 1, twine: 1 }, topic: 'Bird feeder', match: /feeder/i, why: 'the birds would come to me instead of the other way round',
    desc: 'A little tray of seed hung by the oak on twine. The birds come to the cat, so there is less walking about.',
    can: w => !w.deco.feeder, desire: w => (w.cat.mem.known.tablet && dayNo(w) >= 3 ? 1 + Math.min(1, ((w.stats.misses || 0) + (w.stats.mice || 0)) * 0.1) : 0),
  },
  chime: {
    name: 'wind chime', cost: { twig: 2, frame: 2, twine: 1 }, topic: 'Wind chime', match: /chime/i, why: 'something gentle that sings when the air moves',
    desc: 'Frames and twigs hung from a length of twine. It sings when the air moves, and the cat can hear it from the cushion.',
    can: w => !w.deco.chime, desire: w => (w.cat.mem.known.tablet && dayNo(w) >= 4 ? 0.8 + w.cat.needs.fear * 2 : 0),
  },
};
// the two things below are not made at the bench. 'string' is a way of getting twine (it is only knowledge), and the
// cat tree is built like the others but takes a lot more.
RECIPES.string = {
  name: 'way to get string', knowledge: true, cost: {}, topic: 'Twine', match: /twine|string|thread|cordage|yarn|fib(?:er|re)|rope/i,
  why: 'I keep needing string, and the human is not always here', learnText: 'work out where string comes from',
  desc: 'Not made at the bench. The cushion is stuffed with fibres held in by string, and once the cat understands that it can pull some out whenever it needs it.',
  can: w => !knows(w, 'string'), desire: w => (w.cat.mem.known.cushion && ['feeder', 'chime', 'cattree'].some(id => (knows(w, id) || onlyTwineShort(w, id)) && RECIPES[id].can(w)) && (w.cat.inv.twine || 0) < 1 ? 1.5 : 0),
};
RECIPES.cattree = {
  name: 'cat tree', cost: { frame: 3, bark: 2, twig: 5, twine: 3 }, topic: 'Cat tree', match: /cat tree|cat furniture|cat condo|cat tower|scratching post/i, why: 'somewhere tall that is mine',
  desc: 'Frames, twigs and a lot of twine, stacked into something tall. Somewhere high that is the cat\'s own.',
  can: w => !w.catTree, desire: w => (w.cat.mem.known.tablet && dayNo(w) >= 5 && w.table ? 1.0 : 0),
};
export const RECIPE_IDS = Object.keys(RECIPES);
// Two separate things stand between the cat and a new thing:
//   found   - (recorded in cat.ideas) it has worked out what it could make: it was carrying what the thing is built from (see findRecipes in craft.js).
//             Frames and the ways of getting string are not found this way: they are just things it can do.
//   learned - it knows how, which for the table and easel needs nothing more, and for the rest means reading up on the tablet.
// It can only work toward (and build) something it has both found and learned.
export const found = (w, id) => { const r = RECIPES[id]; return !!(r.part || r.knowledge || (w.cat.ideas && w.cat.ideas[id])); };
export const learned = (w, id) => !!RECIPES[id].preset || !!(w.cat.recipes[id] && w.cat.recipes[id].known);
export const knows = (w, id) => found(w, id) && learned(w, id);
// what a cost comes to in raw materials: a frame is the bark it is made of
export function rawCost(cost) { const o = {}; for (const [m, n] of Object.entries(cost)) { if (m === 'frame') o.bark = (o.bark || 0) + n * RECIPES.frame.cost.bark; else o[m] = (o[m] || 0) + n; } return o; }
export function rawHeld(w) { const i = w.cat.inv; return { bark: (i.bark || 0) + (i.frame || 0) * RECIPES.frame.cost.bark, twig: i.twig || 0, twine: i.twine || 0 }; }
export const partsHeld = (w, id) => { const have = rawHeld(w); return Object.entries(rawCost(RECIPES[id].cost)).every(([m, n]) => (have[m] || 0) >= n); };
// carrying everything but the string (a thing that cannot be found until it has some, so it goes looking for the way to get it)
export function onlyTwineShort(w, id) {
  const r = RECIPES[id]; if (!r || found(w, id) || !r.can(w)) return false;
  const raw = rawCost(r.cost), have = rawHeld(w); if (!raw.twine || have.twine >= raw.twine) return false;
  return Object.entries(raw).every(([m, n]) => m === 'twine' || have[m] >= n);
}
// a save from before recipes had to be found: everything it already knew or had built counts as found
export function foundFromBefore(w) { for (const id of Object.keys(RECIPES)) if (learned(w, id) || (BUILT[id] && BUILT[id](w))) w.cat.ideas[id] = { day: 1, legacy: true }; }
export const costText = cost => Object.entries(cost).map(([m, n]) => matText(m, n)).join(' + ');

// everything about making things that lives on the cat and the world, filled in for new worlds and old saves
export function ensureCraft(w) {
  const c = w.cat;
  if (!c.inv) c.inv = {}; for (const m of [...MATERIALS, 'frame']) if (typeof c.inv[m] !== 'number') c.inv[m] = 0;
  if (!c.recipes) c.recipes = {}; if (!c.ideas) c.ideas = {}; if (!c.crafted) c.crafted = []; if (!c.wishes) c.wishes = [];
  if (c.lastWishAt == null) c.lastWishAt = -999;
  if (c.upset === undefined) c.upset = null; if (!c.upAt) c.upAt = {}; if (typeof c.missStreak !== 'number') c.missStreak = 0;
  if (w.table === undefined) w.table = null; if (w.easelMade === undefined) w.easelMade = null; if (!w.deco) w.deco = {};
  if (!w.hist) w.hist = []; if (!w.days) w.days = {};
  for (const k of ['crafted', 'gathered', 'wishes']) if (!w.stats[k]) w.stats[k] = 0;
  return w;
}
