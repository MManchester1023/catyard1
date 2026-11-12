// Making things. The cat gathers bark and twigs by scratching the oak, works toward the recipes it wants, and
// builds them. A recipe turns up when it is carrying what the thing is made of (findRecipes); the easel and table need nothing
// more, the rest it also has to look up on the tablet. Building the table moves the stash out of hiding and onto the tabletop.
import { rnd, uid, an, MAT_LABEL, MAT_CAP } from './util.js';
import { note, journal, dayOf, clockStr, clearEasel } from './world.js';
import { RECIPES, knows, found, learned, rawCost, rawHeld, partsHeld, costText, frameDemand, frameSpare, paintingToFrame, unlistedWork } from './recipes.js';
import { feel } from './feelings.js';
import { onEvent } from './wants.js';
import { layoutStash } from './quirk.js';
import { PACE, paceOf, barkLuck, gatherRoom, priceOf } from './pace.js';
import { foundCatTree } from './cattree.js';
import { foundPlace } from './finds.js';
import { random } from './rng.js';

export const INV_CAP = MAT_CAP;
export const have = (w, m) => w.cat.inv[m] || 0;
export const craftWant = (w, id) => w.cat.wants.find(x => x.kind === 'craft' && x.recipe === id) || null;

// the recipes it is working toward right now: ones it can make, wants to make, and has not made yet
export const goals = w => Object.keys(RECIPES).filter(id => RECIPES[id].can(w) && knows(w, id) && (id === 'table' || id === 'easel' || (id === 'frame' && (frameDemand(w) > 0 || (frameSpare(w) < 1 && paintingToFrame(w)))) || craftWant(w, id)));
export function shortfall(w, id) { const out = {}; for (const [m, n] of Object.entries(RECIPES[id].cost)) if (have(w, m) < n) out[m] = n - have(w, m); return out; }
// the raw materials a goal still needs, counting the frames it is short of (the frames themselves are made out of bark)
export function rawShortfall(w, id) {
  const s = shortfall(w, id), out = { bark: s.bark || 0, twig: s.twig || 0, twine: s.twine || 0 };
  if (s.frame) for (const [m, n] of Object.entries(RECIPES.frame.cost)) out[m] = (out[m] || 0) + n * s.frame;
  return out;
}
// what it still has to scratch off the tree, or null
export function gatherNeed(w) {
  // Everything its goals are made of, counted once, less what it already carries. (It used to count the bark for a goal's
  // frames without looking at the bark in its pack, and then count the frames again, so a cat with the parts for the easel
  // in hand still wanted to go and scratch the oak.)
  const gs = goals(w), tot = { bark: 0, twig: 0 }, inv = w.cat.inv;
  for (const id of gs) { if (id === 'frame') continue; for (const m of ['bark', 'twig']) tot[m] += RECIPES[id].cost[m] || 0; }
  if (gs.includes('frame')) { // frames still to make: what the goals call for, and one for a painting waiting, less the frames it carries
    const fm = frameDemand(w) + (frameSpare(w) < 1 && paintingToFrame(w) ? 1 : 0);
    for (const [m, n] of Object.entries(RECIPES.frame.cost)) if (m in tot) tot[m] += n * fm;
  }
  const need = { bark: Math.max(0, tot.bark - (inv.bark || 0)), twig: Math.max(0, tot.twig - (inv.twig || 0)) };
  return need.bark || need.twig ? need : seekNeed(w);
}
// Before it has worked out what to make, it gathers anyway, toward the thing it is most inclined to want (the easel, then
// the table, then the rest). Once it is carrying enough of the right bits, the recipe turns up (findRecipes). Twine is not
// here: it cannot be scratched off a tree.
export function seekNeed(w) {
  let best = null;
  for (const [id, r] of Object.entries(RECIPES)) {
    if (found(w, id) || !r.can(w) || !(r.desire(w) > 0)) continue;
    const raw = rawCost(r.cost), held = rawHeld(w), miss = {}; let total = 0;
    for (const m of ['bark', 'twig']) { const d = Math.max(0, (raw[m] || 0) - held[m]); if (d) { miss[m] = d; total += d; } }
    const order = r.order == null ? 2 : r.order;
    if (total && (!best || order < best.order || (order === best.order && total < best.total))) best = { miss, total, order };
  }
  return best && best.miss;
}
// it is carrying what a thing is made of, so it works out what the thing is
export function findRecipes(w) {
  const c = w.cat; let any = false;
  for (const [id, r] of Object.entries(RECIPES)) {
    if (found(w, id) || !r.can(w) || !partsHeld(w, id)) continue;
    c.ideas[id] = { day: dayOf(w), time: clockStr(w) }; any = true;
    const parts = costText(r.cost), research = !r.preset;
    journal(w, `I am carrying ${parts}, and it came to me what that is for: ${an(r.name)}. ${r.why ? r.why[0].toUpperCase() + r.why.slice(1) + '. ' : ''}${research ? 'I am not sure how it is done. The tablet will know.' : 'I think I know how.'}`.trim(), 'craft');
    note(w, `${c.name} worked out what its materials are for: ${an(r.name)}${research ? ' (it wants to look up how)' : ''}.`, 'learn');
    onEvent(w, 'found', { id });
  }
  return any;
}
// (admin) it simply has the idea
export function markFound(w, id) { if (found(w, id)) return false; w.cat.ideas[id] = { day: dayOf(w), time: clockStr(w) }; return true; }
// what it would make right now. until the easel and the table exist, bark is saved for them (and for the frames they are
// built from) rather than spent on smaller things
const CORE = new Set(['easel', 'table', 'frame']);
export function nextCraft(w) {
  // (bark is saved for the easel and table as soon as it wants them, not only once it has worked out what they are)
  const gs = goals(w), coreFirst = gs.includes('table') || gs.includes('easel') || (!w.table && RECIPES.table.desire(w) > 0) || (!w.easelMade && RECIPES.easel.desire(w) > 0);
  for (const id of gs) {
    if (Object.keys(shortfall(w, id)).length) continue;
    if (coreFirst && !CORE.has(id) && RECIPES[id].cost.bark) continue;
    return id;
  }
  return null;
}

// ---------- the oak ----------
export function scratchTree(w) {
  if (!gatherRoom(w)) { feel(w, ['act:tree'], { joy: 0.02 }, 'content'); return null; } // it has given what it can today
  const c = w.cat, r = random(), k = barkLuck(w), lucky = (0.38 + c.traits.curious * 0.06) * k; // pace.js: the oak is not that generous
  const need = gatherNeed(w) || {}, twigFirst = (need.twig || 0) > 0 && !(need.bark > 0), tw = (twigFirst ? 0.3 : 0.14) * k; // (when it is only short of twigs, the oak gives them up more readily)
  const drop = twigFirst ? (r < tw ? 'twig' : r < tw + lucky * 0.4 ? 'bark' : null) : r < lucky ? 'bark' : r < lucky + tw ? 'twig' : null;
  if (!drop || c.inv[drop] >= INV_CAP) { feel(w, ['act:tree'], { joy: 0.02 }, 'content'); return null; }
  return drop;
}
// ---------- the cushion: once it has worked out where string comes from, it can pull some out of its bed ----------
export const bedCap = w => Math.max(1, Math.round(2 / paceOf(w)));
export const bedRoom = w => { const c = w.cat; return (c.sDay === dayOf(w) ? c.sToday || 0 : 0) < bedCap(w); };
export const stringWanted = w => knows(w, 'string') && (w.cat.inv.twine || 0) < 4 && goals(w).some(id => (shortfall(w, id).twine || 0) > 0);
export function scratchBed(w) {
  const c = w.cat;
  if (!bedRoom(w) || c.inv.twine >= INV_CAP || random() > 0.5 * Math.min(1, barkLuck(w) * 2)) { feel(w, ['act:bed'], { joy: 0.01 }, 'content'); return null; }
  return 'twine';
}
export function collectDrop(w, type) {
  const c = w.cat; c.inv[type] = Math.min(INV_CAP, c.inv[type] + 1); w.stats.gathered++; findRecipes(w);
  const day = dayOf(w);
  if (type === 'twine') { if (c.sDay !== day) { c.sDay = day; c.sToday = 0; } c.sToday++; } else { if (c.gDay !== day) { c.gDay = day; c.gToday = 0; } c.gToday++; }
  note(w, type === 'twine' ? `${c.name} pulled at the cushion and a length of string came away.` : `${c.name} scratched the oak and ${an(MAT_LABEL[type])} came loose.`, 'craft');
  if (w.stats.gathered === 1) journal(w, `The tree gave me ${an(MAT_LABEL[type])}. It had not occurred to me that trees give things back.`, 'craft');
  feel(w, ['act:tree', 'mat:' + type], { joy: 0.1 }, 'content');
}
// a gift from the human goes straight into its things
export function receiveMaterial(w, type, n) { const c = w.cat; c.inv[type] = Math.min(INV_CAP, c.inv[type] + n); findRecipes(w); }

// ---------- making ----------
export function startable(w, id) { return !!RECIPES[id] && knows(w, id) && RECIPES[id].can(w) && !Object.keys(shortfall(w, id)).length; }

function buildTable(w) {
  const o = w.o.table, s = w.stash, hid = !!s.site;
  w.table = { x: o.x, y: o.y, day: dayOf(w) };
  s.site = { x: o.x, y: o.y, label: 'the bark table', table: true }; if (!s.seed) s.seed = Math.floor(rnd(1, 1e9));
  s.known = s.items.length; layoutStash(w);
  journal(w, hid ? 'I built a table out of bark and carried the collection onto it. Hiding things was a phase. Now they can be seen.' : 'I built a table out of bark. Anything I find can live on it.', 'craft');
  note(w, `${w.cat.name} built a bark table and moved its collection onto it.`, 'craft');
}

// a spare oak frame goes round a painting
export function hangSpareFrames(w) {
  const c = w.cat; let n = 0;
  while (frameSpare(w) > 0 && paintingToFrame(w)) {
    const best = unlistedWork(w); if (!best) break; // (the best one it has not framed yet: a framed painting goes up for sale)
    c.inv.frame--; c.crafted.unshift({ id: uid(), recipe: 'frame', name: 'framed painting', work: best.title, day: dayOf(w), time: clockStr(w) }); if (c.crafted.length > 16) c.crafted.pop();
    best.status = 'forSale'; best.listed = { day: dayOf(w), time: clockStr(w) }; best.price = priceOf(best); clearEasel(w, best);
    c.art.xp += 6; n++;
    journal(w, `I put a frame round "${best.title}" and set it out for sale. It looks like it matters now. Someone will want it.`, 'craft'); note(w, `${c.name} framed "${best.title}" and put it up for sale.`, 'craft');
  }
  return n;
}
function buildEasel(w) {
  const c = w.cat, o = w.o.easel; w.easelMade = { x: o.x, y: o.y, day: dayOf(w) };
  if (!c.mem.known.easel) { c.mem.known.easel = 1; foundPlace(w, 'easel'); }
  c.needs.create = Math.max(c.needs.create, 0.5);
  journal(w, 'I built an easel. Two frames and a lot of determination. There is a canvas on it and my paws are already twitching.', 'craft');
  note(w, `${c.name} built an easel and set up a blank canvas.`, 'craft');
}

export function finishCraft(w, id) {
  const c = w.cat, r = RECIPES[id]; if (!startable(w, id)) return false;
  for (const [m, n] of Object.entries(r.cost)) c.inv[m] -= n;
  const made = { id: uid(), recipe: id, name: r.name, day: dayOf(w), time: clockStr(w) };
  if (id === 'table') buildTable(w);
  else if (id === 'easel') buildEasel(w);
  else if (id === 'frame') {
    c.inv.frame = (c.inv.frame || 0) + 1;
    journal(w, frameDemand(w) > 0 || frameSpare(w) === 0 ? 'I made an oak frame. Bigger things are built out of these.' : 'I made an oak frame. There is nothing to build with it, so it can go round a painting and the painting can be sold.', 'craft'); note(w, `${c.name} made an oak frame.`, 'craft');
    hangSpareFrames(w);
  } else if (id === 'feeder') { w.deco.feeder = true; journal(w, 'I hung a bird feeder by the oak. This is not hunting. This is hospitality with a purpose.', 'craft'); note(w, `${c.name} put up a bird feeder.`, 'craft'); }
  else if (id === 'cattree') foundCatTree(w, 'made');
  else if (id === 'chime') { w.deco.chime = true; journal(w, 'The chime sings when the air moves. I hung it where I can hear it from the cushion.', 'craft'); note(w, `${c.name} hung a wind chime in the oak.`, 'craft'); }
  c.crafted.unshift(made); if (c.crafted.length > 16) c.crafted.pop(); w.stats.crafted++;
  feel(w, ['act:craft', 'craft:' + id], { joy: 0.28, fun: -0.2, fear: id === 'chime' ? -0.1 : 0 }, 'proud');
  onEvent(w, 'built', { id });
  c.thoughtHint = id === 'table' ? 'tableDone' : id === 'easel' ? 'easelDone' : 'craftDone';
  return made;
}

// ---------- learning from the tablet ----------
export function unlockRecipe(w, id, title, how = 'tablet') {
  const c = w.cat, r = RECIPES[id]; if (learned(w, id)) return false;
  c.recipes[id] = { known: true, day: dayOf(w), via: title || '' };
  if (r.knowledge) {
    journal(w, how === 'itself' ? 'I looked at the cushion for a long time and then I understood: the stuffing is held in by string. If I pull, string comes. The cushion has not agreed to this.' : `From the tablet${title ? ` ("${title}")` : ''}: string is made of fibres twisted together, and my cushion is full of them. I can pull some out whenever I need it.`, 'craft');
    note(w, `${c.name} worked out where to get string: the cushion.`, 'learn');
  } else {
  journal(w, how === 'itself' ? `The tablet was no help, so I worked out how to make ${an(r.name)} myself. It takes ${costText(r.cost)}.` : `From the tablet${title ? ` ("${title}")` : ''}: I know how to make ${an(r.name)} now. It takes ${costText(r.cost)}.`, 'craft');
  note(w, `${c.name} worked out how to make ${an(r.name)}.`, 'learn');
  }
  onEvent(w, 'learned', { id, title });
  return true;
}
// with no connection the tablet cannot teach it, so a recipe it has wanted for a couple of days it works out itself
export function selfTaught(w) {
  if (w.netOn) return false;
  for (const x of w.cat.wants) if (x.kind === 'learn' && !knows(w, x.recipe) && dayOf(w) - x.day >= PACE.selfTaughtDays * paceOf(w)) return unlockRecipe(w, x.recipe, '', 'itself');
  return false;
}
// a page the cat just read: does it explain something it was hoping to learn?
export function learnFromPage(w, pg, wantedId) {
  const text = `${pg.title} ${pg.extract}`;
  for (const [id, r] of Object.entries(RECIPES)) {
    if (r.preset || learned(w, id) || !found(w, id) || (r.knowledge && wantedId !== id)) continue; // (it only looks up what it has worked out it could make) // a knowledge recipe is only learned when it was being looked for
    if ((wantedId === id && r.match.test(text)) || r.match.test(pg.title)) { if (unlockRecipe(w, id, pg.title)) return id; }
  }
  return null;
}
