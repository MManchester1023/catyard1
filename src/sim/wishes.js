// Wishes: notes the cat writes on the tablet for the human, asking for things it wants. A wish is drafted when the
// cat wants something only the human can bring (twine for a chime, a colour it has been hoping for), written out
// the next time it sits at the tablet, and granted when the matching thing turns up on the mat.
import { pick, an, matText, MAT_GIFT, ITEM_LABEL } from './util.js';
import { note, journal, dayOf, clockStr } from './world.js';
import { RECIPES } from './recipes.js';
import { humanNeed, craftWant, goals } from './craft.js';
import { itemName, stashColors } from './quirk.js';
import { upsetBy, soothe } from './upset.js';
import { random } from './rng.js';

export const WISH_OPEN_MAX = 2, WISH_LIFE_DAYS = 5;
const sameAs = (a, b) => a.kind === b.kind && a.type === b.type; // one open request per kind of thing is plenty
export const draftWish = w => w.cat.wishes.find(x => x.state === 'draft') || null;
export const openWishes = w => w.cat.wishes.filter(x => x.state === 'open');
// the cat can only ask once it has found the tablet; a drafted wish gives it a reason to go there
export const wishPending = w => !!(w.cat.mem.known.tablet && draftWish(w));

export const wishLabel = x => (x.kind === 'material' ? matText(x.type, MAT_GIFT[x.type]) : an(itemName(x.type, x.color)));

function phrase(w, x) {
  const c = w.cat;
  if (x.kind === 'material') {
    const r = RECIPES[x.recipe];
    return pick([`Please could you leave me some ${x.type}? I cannot find it anywhere in the yard, and I need it for the ${r ? r.name : 'thing I am making'}.`, `I am short of ${x.type}. The ${r ? r.name : 'project'} will not work without it. Could you bring some?`, `Dear human, a bit of ${x.type} would change my week. It is for the ${r ? r.name : 'project'}.`]);
  }
  const what = x.color ? `${x.color} ${ITEM_LABEL[x.type]}` : ITEM_LABEL[x.type];
  return pick([`I would very much like ${an(what)}. I have been thinking about it for days.`, `Could you bring me ${an(what)}? It is exactly the kind I ${x.why === 'favourite' ? 'always want' : 'keep wanting'}.`, `If it is not too much trouble: ${an(what)}. I will keep it somewhere good.`, `${an(what)[0].toUpperCase() + an(what).slice(1)}, please. ${c.name} says thank you in advance.`]);
}

// what the cat might ask for, with how badly
function candidates(w) {
  const c = w.cat, out = [], dups = c.wishes.filter(x => x.state === 'open' || x.state === 'draft');
  const add = (spec, weight) => { if (!dups.some(d => sameAs(d, spec))) out.push({ spec, weight }); };
  const need = humanNeed(w);
  if (need) for (const id of goals(w)) { if (!craftWant(w, id)) continue; for (const m of Object.keys(need)) if (RECIPES[id].cost[m]) add({ kind: 'material', type: m, recipe: id, why: 'craft' }, 3); }
  for (const x of c.wants) if (x.kind === 'find' && w.clock - x.born > w.dayLen * 0.4 && !w.stash.items.some(i => i.type === x.item && i.color === x.color)) add({ kind: 'item', type: x.item, color: x.color, why: 'want' }, 2);
  const q = c.quirk, have = stashColors(w);
  add({ kind: 'item', type: q.item, color: have[q.favColor] ? null : q.favColor, why: 'favourite' }, 0.8);
  return out;
}

export function considerWish(w) {
  const c = w.cat; if (!c.mem.known.tablet) return null;
  if (w.clock < w.dayLen * 1.3) return null; // it has not lived here long enough to know what it is missing
  if (c.wishes.filter(x => x.state === 'open' || x.state === 'draft').length >= WISH_OPEN_MAX) return null;
  if (w.clock - c.lastWishAt < w.dayLen * 0.7) return null;
  const cand = candidates(w); if (!cand.length) return null;
  let r = random() * cand.reduce((s, x) => s + x.weight, 0), chosen = cand[0].spec;
  for (const x of cand) { r -= x.weight; if (r <= 0) { chosen = x.spec; break; } }
  const wish = Object.assign({ id: random().toString(36).slice(2, 9), state: 'draft', day: dayOf(w), seen: false }, chosen);
  wish.text = phrase(w, wish); c.wishes.unshift(wish); if (c.wishes.length > 30) c.wishes.pop(); c.lastWishAt = w.clock;
  return wish;
}

// the cat has typed it out on the tablet: the human can read it now
export function publishWish(w, wish) {
  const c = w.cat; wish.state = 'open'; wish.written = { day: dayOf(w), time: clockStr(w) }; w.stats.wishes++;
  journal(w, `I wrote to the human on the tablet: "${wish.text}"`, 'wish'); note(w, `${c.name} left you a note on the tablet asking for ${wishLabel(wish)}.`, 'wish');
  w.chat.push({ from: 'sys', text: `${c.name} left you a note on the tablet: “${wish.text}” (see the Outside tab)`, day: dayOf(w), time: clockStr(w) }); if (w.chat.length > 80) w.chat.shift();
  if (w.asks) w.asks.push({ type: 'wish', id: wish.id });
  return wish;
}

// something has just been left on the mat: is it what the cat asked for?
export function matchWish(w, off) {
  return openWishes(w).find(x => (x.kind === 'item' && off.kind === 'item' && off.type === x.type && (!x.color || off.color === x.color)) || (x.kind === 'material' && off.kind === 'material' && off.type === x.type)) || null;
}
export function grantWish(w, wish) {
  const c = w.cat; wish.state = 'granted'; wish.granted = { day: dayOf(w), time: clockStr(w) }; c.bond = Math.min(1, c.bond + 0.03);
  journal(w, `I asked for ${wishLabel(wish)} and the human brought it. They read the tablet.`, 'wish'); note(w, `${c.name}'s wish came true: ${wishLabel(wish)}.`, 'wish');
  c.thoughtHint = 'wishGranted'; soothe(w, 1, 'the human finally read my note');
}

// housekeeping: wishes nobody answered fade
export function wishTick(w) {
  for (const x of w.cat.wishes) {
    if (x.state !== 'open') continue;
    const age = dayOf(w) - x.written.day;
    if (age >= WISH_LIFE_DAYS) { x.state = 'faded'; journal(w, `I have stopped hoping for ${wishLabel(x)}. The tablet is quiet.`, 'wish'); upsetBy(w, 'wish2', `I asked for ${wishLabel(x)} and nobody answered. Not even a no. I will remember being ignored.`, { level: 0.75, days: 0.6, bond: 0.04, cool: 0.5, note: 'its note was never answered.', hint: 'wish' }); }
    else if (age >= 2 && !x.sulked) { x.sulked = true; upsetBy(w, 'wish', `Two days since I wrote to the human about ${wishLabel(x)}. They have read the tablet. I think. They are ignoring me.`, { level: 0.5, days: 0.4, bond: 0.02, cool: 0.4, note: 'nobody has answered its note.', hint: 'wish' }); }
  }
}
