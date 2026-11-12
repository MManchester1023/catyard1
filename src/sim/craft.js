// Making things. The cat gathers bark and twigs by scratching the oak, works toward the recipes it wants, and
// builds them. The first is a table: building it moves the stash out of hiding and onto the tabletop.
import { rnd, uid, an, MAT_LABEL, MAT_CAP } from './util.js';
import { note, journal, dayOf, clockStr } from './world.js';
import { RECIPES, knows, costText, frameDemand, frameSpare, paintingToFrame } from './recipes.js';
import { feel } from './feelings.js';
import { onEvent } from './wants.js';
import { layoutStash } from './quirk.js';
import { PACE, paceOf, barkLuck, gatherRoom } from './pace.js';
import { foundCatTree } from './cattree.js';
import { foundPlace } from './finds.js';
import { random } from './rng.js';

export const INV_CAP = MAT_CAP;
export const have = (w, m) => w.cat.inv[m] || 0;
export const craftWant = (w, id) => w.cat.wants.find(x => x.kind === 'craft' && x.recipe === id) || null;

// the recipes it is working toward right now: ones it can make, wants to make, and has not made yet
export const goals = w => Object.keys(RECIPES).filter(id => RECIPES[id].can(w) && knows(w, id) && (id === 'table' || id === 'easel' || (id === 'frame' && frameDemand(w) > 0) || craftWant(w, id)));
export function shortfall(w, id) { const out = {}; for (const [m, n] of Object.entries(RECIPES[id].cost)) if (have(w, m) < n) out[m] = n - have(w, m); return out; }
// the raw materials a goal still needs, counting the frames it is short of (the frames themselves are made out of bark)
export function rawShortfall(w, id) {
  const s = shortfall(w, id), out = { bark: s.bark || 0, twig: s.twig || 0, twine: s.twine || 0 };
  if (s.frame) for (const [m, n] of Object.entries(RECIPES.frame.cost)) out[m] = (out[m] || 0) + n * s.frame;
  return out;
}
// what it still has to scratch off the tree, or null
export function gatherNeed(w) {
  const need = { bark: 0, twig: 0 }; for (const id of goals(w)) { if (id === 'frame') continue; const s = rawShortfall(w, id); need.bark += s.bark; need.twig += s.twig; }
  const f = goals(w).includes('frame') ? Math.max(0, frameDemand(w) - goals(w).filter(g => g !== 'frame').reduce((m, g) => m + (shortfall(w, g).frame || 0), 0)) : 0; // (frames wanted but not yet counted against a goal)
  if (f) for (const [m, n] of Object.entries(RECIPES.frame.cost)) need[m] = (need[m] || 0) + n * f;
  return need.bark || need.twig ? need : null;
}
// what it would make right now. until the easel and the table exist, bark is saved for them (and for the frames they are
// built from) rather than spent on smaller things
const CORE = new Set(['easel', 'table', 'frame']);
export function nextCraft(w) {
  const gs = goals(w), coreFirst = gs.includes('table') || gs.includes('easel');
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
  const drop = r < lucky ? 'bark' : r < lucky + 0.14 * k ? 'twig' : null;
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
  const c = w.cat; c.inv[type] = Math.min(INV_CAP, c.inv[type] + 1); w.stats.gathered++;
  const day = dayOf(w);
  if (type === 'twine') { if (c.sDay !== day) { c.sDay = day; c.sToday = 0; } c.sToday++; } else { if (c.gDay !== day) { c.gDay = day; c.gToday = 0; } c.gToday++; }
  note(w, type === 'twine' ? `${c.name} pulled at the cushion and a length of string came away.` : `${c.name} scratched the oak and ${an(MAT_LABEL[type])} came loose.`, 'craft');
  if (w.stats.gathered === 1) journal(w, `The tree gave me ${an(MAT_LABEL[type])}. It had not occurred to me that trees give things back.`, 'craft');
  feel(w, ['act:tree', 'mat:' + type], { joy: 0.1 }, 'content');
}
// a gift from the human goes straight into its things
export function receiveMaterial(w, type, n) { const c = w.cat; c.inv[type] = Math.min(INV_CAP, c.inv[type] + n); }

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
    const hung = c.crafted.filter(x => x.recipe === 'frame' && x.work).map(x => x.work);
    const best = c.art.works.slice().sort((a, b) => b.score - a.score).find(x => !hung.includes(x.title)) || c.art.works[0];
    c.inv.frame--; c.crafted.unshift({ id: uid(), recipe: 'frame', name: 'framed painting', work: best ? best.title : 'a painting', day: dayOf(w), time: clockStr(w) }); if (c.crafted.length > 16) c.crafted.pop();
    c.art.xp += 6; n++;
    journal(w, `I put a frame round "${best ? best.title : 'a painting'}". It looks like it matters now.`, 'craft'); note(w, `${c.name} framed "${best ? best.title : 'a painting'}".`, 'craft');
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
    journal(w, frameDemand(w) > 0 || frameSpare(w) === 0 ? 'I made an oak frame. Bigger things are built out of these.' : 'I made an oak frame. There is nothing to build with it, so it can go round a painting.', 'craft'); note(w, `${c.name} made an oak frame.`, 'craft');
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
  const c = w.cat, r = RECIPES[id]; if (knows(w, id)) return false;
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
    if (r.preset || knows(w, id) || (r.knowledge && wantedId !== id)) continue; // a knowledge recipe is only learned when it was being looked for
    if ((wantedId === id && r.match.test(text)) || r.match.test(pg.title)) { if (unlockRecipe(w, id, pg.title)) return id; }
  }
  return null;
}
