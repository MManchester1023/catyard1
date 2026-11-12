// Wishes: notes the cat writes on the tablet for the human, asking for things it wants. A wish is drafted when the
// cat wants something only the human can bring (a colour it has been hoping for, the kind of thing it collects), written out
// the next time it sits at the tablet, and granted when the matching thing turns up on the mat.
import { pick, an, ITEM_LABEL, MAT_PLURAL, shopItem } from './util.js';
import { note, journal, dayOf, clockStr } from './world.js';
import { itemName, stashColors } from './quirk.js';
import { upsetBy, soothe } from './upset.js';
import { gatherNeed } from './craft.js';
import { random } from './rng.js';

export const WISH_OPEN_MAX = 2, WISH_LIFE_DAYS = 5;
const sameAs = (a, b) => a.kind === b.kind && a.type === b.type; // one open request per kind of thing is plenty
export const draftWish = w => w.cat.wishes.find(x => x.state === 'draft') || null;
export const openWishes = w => w.cat.wishes.filter(x => x.state === 'open');
// the cat can only ask once it has found the tablet; a drafted wish gives it a reason to go there
export const wishPending = w => !!(w.cat.mem.known.tablet && draftWish(w));

export const wishLabel = x => (x.kind === 'need' ? `some ${MAT_PLURAL[x.type]} from the oak` : an(itemName(x.type, x.color)));

function phrase(w, x) {
  const c = w.cat;
  if (x.kind === 'need') { const pl = MAT_PLURAL[x.type]; return pick([`I am short of ${pl} for what I am making. Could you shake the oak for me? It gives them up more easily for you.`, `The oak is stingy with me. If you click on it, I think it will drop ${pl}. I would be grateful.`, `Could you give the oak a good shake? I need ${pl}, and I think it likes you better than it likes me.`]); }
  const what = x.color ? `${x.color} ${ITEM_LABEL[x.type]}` : ITEM_LABEL[x.type];
  return pick([`I would very much like ${an(what)}. I have been thinking about it for days.`, `Could you bring me ${an(what)}? It is exactly the kind I ${x.why === 'favourite' ? 'always want' : 'keep wanting'}.`, `If it is not too much trouble: ${an(what)}. I will keep it somewhere good.`, `${an(what)[0].toUpperCase() + an(what).slice(1)}, please. ${c.name} says thank you in advance.`]);
}

// what the cat might ask for, with how badly
function candidates(w) {
  const c = w.cat, out = [], dups = c.wishes.filter(x => x.state === 'open' || x.state === 'draft');
  const add = (spec, weight) => { if (!dups.some(d => sameAs(d, spec))) out.push({ spec, weight }); };
  for (const x of c.wants) if (x.kind === 'find' && w.clock - x.born > w.dayLen * 0.4 && !w.stash.items.some(i => i.type === x.item && i.color === x.color)) add({ kind: 'item', type: x.item, color: x.color, why: 'want' }, 2);
  // something it means to make is held up for want of bark or twigs it cannot afford to buy: only you can shake the oak for it
  const need = gatherNeed(w);
  if (need) { const m = (need.twig || 0) >= (need.bark || 0) ? 'twig' : 'bark'; if ((need[m] || 0) >= 2 && (c.money || 0) < shopItem(m).price * 2) add({ kind: 'need', type: m, why: 'need' }, 1.6); } // (the one it is shortest of)
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
  w.chat.push({ from: 'sys', text: `${c.name} left you a note on the tablet: “${wish.text}” (see the Tablet tab)`, day: dayOf(w), time: clockStr(w) }); if (w.chat.length > 80) w.chat.shift();
  if (w.asks && wish.kind !== 'need') w.asks.push({ type: 'wish', id: wish.id }); // (Claude rewrites the notes asking for objects; the ones asking for a shake of the oak stay as they are)
  return wish;
}

// something has just been left on the mat: is it what the cat asked for?
export function matchWish(w, off) {
  return openWishes(w).find(x => (x.kind === 'item' && off.kind === 'item' && off.type === x.type && (!x.color || off.color === x.color))) || null;
}
// you have shaken the oak and something fell: is it what the cat was asking for?
export function answerNeed(w, type) {
  const wish = openWishes(w).find(x => x.kind === 'need' && x.type === type); if (!wish) return null;
  const c = w.cat; wish.state = 'granted'; wish.granted = { day: dayOf(w), time: clockStr(w) }; c.bond = Math.min(1, c.bond + 0.03);
  journal(w, `I wrote that I was short of ${MAT_PLURAL[type]}, and the human went and shook the oak. They read the tablet.`, 'wish'); note(w, `${c.name}'s note was answered: you shook the oak and ${an(type === 'bark' ? 'piece of bark' : 'twig')} fell.`, 'wish');
  c.thoughtHint = 'wishGranted'; soothe(w, 0.8, 'the human read my note and shook the oak');
  return wish;
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
    if (x.kind === 'need') { if (age >= 3) { x.state = 'faded'; journal(w, `Nobody shook the oak. I have found other ways of getting ${MAT_PLURAL[x.type]}.`, 'wish'); } continue; } // (not asked for with any hope: no sulking)
    if (age >= WISH_LIFE_DAYS) { x.state = 'faded'; journal(w, `I have stopped hoping for ${wishLabel(x)}. The tablet is quiet.`, 'wish'); upsetBy(w, 'wish2', `I asked for ${wishLabel(x)} and nobody answered. Not even a no. I will remember being ignored.`, { level: 0.75, days: 0.6, bond: 0.04, cool: 0.5, note: 'its note was never answered.', hint: 'wish' }); }
    else if (age >= 2 && !x.sulked) { x.sulked = true; upsetBy(w, 'wish', `Two days since I wrote to the human about ${wishLabel(x)}. They have read the tablet. I think. They are ignoring me.`, { level: 0.5, days: 0.4, bond: 0.02, cool: 0.4, note: 'nobody has answered its note.', hint: 'wish' }); }
  }
}

// saves from when the human could give bark, twigs and string: those requests are over (it gets them from the oak, the birds and the cushion now)
export function retireMaterialWishes(w) {
  for (const x of w.cat.wishes || []) if (x.kind === 'material' && (x.state === 'open' || x.state === 'draft')) { x.state = 'faded'; x.retired = true; }
}
