// Favourites and finds.
// Two things grow out of what the cat has actually felt (feelings.js):
//  - Favourite things to do. A few of the things it does, the ones that have kept making it feel good, become
//    favourites (at most three, and they can change). Doing a favourite is a bigger boost than doing anything else:
//    it lifts the mood faster while it is happening, takes more off boredom and loneliness, leaves a glow behind,
//    and the cat will go for it whenever it can.
//  - Tastes from finds. What it comes across for itself (a button in the grass, a new corner of the yard) shapes its
//    likes as much as what it is given, and a first-ever find of a colour or kind of thing makes the most impression.
import { clamp, ITEM_LABEL, PLACE_LABEL, pick, an } from './util.js';
import { journal, note, dayOf } from './world.js';
import { feel, keyName } from './feelings.js';
import { random } from './rng.js';

export const MAX_FAVS = 3, FAV_PULL = 0.3;
// everything it does that can become a favourite, by the key it is remembered under
export const FAVABLE = new Set(['act:frog', 'act:paint', 'act:tablet', 'act:gaze', 'act:perch', 'act:investigate', 'act:craft', 'act:tree', 'act:stash', 'act:cattree', 'act:post', 'act:yarn', 'act:ball', 'act:toymouse', 'act:lounge', 'act:fish', 'act:listen', 'act:hunt', 'act:wash']);

export function ensureFinds(c) {
  if (!Array.isArray(c.favActs)) c.favActs = []; if (!c.found) c.found = { colors: {}, types: {}, places: {} }; if (!c.found.places) c.found.places = {};
  if (typeof c.glowUntil !== 'number') c.glowUntil = 0; if (typeof c.favSaid !== 'number') c.favSaid = -999;
  return c;
}

// which remembered key is the cat doing right now?
const BY_TYPE = { frog: 'act:frog', paint: 'act:paint', tablet: 'act:tablet', gaze: 'act:gaze', perch: 'act:perch', investigate: 'act:investigate', craft: 'act:craft', cattree: 'act:cattree', fish: 'act:fish', listen: 'act:listen', hunt: 'act:hunt', wash: 'act:wash', stash: 'act:stash' };
export function actKeyOf(a) {
  if (!a) return null;
  if (a.type === 'play') return a.gather ? 'act:tree' : a.own ? ({ post: 'act:post', yarn: 'act:yarn', ball: 'act:ball', toymouse: 'act:toymouse', tree: 'act:tree' })[a.kind] || null : null;
  if (a.type === 'sleep') return a.lounge ? 'act:lounge' : null;
  return BY_TYPE[a.type] || null;
}
// the same for the decide() score names
export const SCORE_KEY = { paint: 'act:paint', tablet: 'act:tablet', gaze: 'act:gaze', perch: 'act:perch', investigate: 'act:investigate', craft: 'act:craft', gather: 'act:tree', stashvisit: 'act:stash', frog: 'act:frog', cattree: 'act:cattree', post: 'act:post', yarn: 'act:yarn', ball: 'act:ball', toymouse: 'act:toymouse', lounge: 'act:lounge', fish: 'act:fish', listen: 'act:listen', hunt: 'act:hunt', wash: 'act:wash' };

export const isFav = (w, key) => !!(key && w.cat.favActs && w.cat.favActs.includes(key));
export const favourites = w => (w.cat.favActs || []).map(key => { const A = (w.cat.assoc || {})[key] || { v: 0, n: 0 }; return { key, name: keyName(key), v: A.v, n: A.n }; });

// ---------- the boost ----------
// per second while it is doing a favourite (once it is actually at it)
export function favTick(w, dt) {
  const c = w.cat, a = c.act; if (!c.favActs || !c.favActs.length) return;
  if (w.clock < c.glowUntil) c.mood.joy = clamp(c.mood.joy + 0.002 * dt); // the glow after a favourite
  if (!a || a.phase === 'go' || !isFav(w, actKeyOf(a))) return;
  c.mood.joy = clamp(c.mood.joy + 0.012 * dt); c.needs.fun = clamp(c.needs.fun - 0.012 * dt); c.needs.lonely = clamp(c.needs.lonely - 0.004 * dt); c.needs.fear = clamp(c.needs.fear - 0.004 * dt);
  a.fav = (a.fav || 0) + dt;
}

const FAV_T = {
  default: ['This is my favourite thing to do.', 'Ah. This. This is the good part of the day.', 'I would choose this over almost anything.', 'Favourite. Definitely favourite.'],
  'act:frog': ['Frog time. My favourite.', 'Nothing beats sitting next to the frog.'],
  'act:paint': ['Painting is the best thing there is.', 'The easel. My favourite place to be.'],
  'act:gaze': ['The sky. My favourite thing to look at.', 'I could do this all night.'],
  'act:cattree': ['Up in the cat tree. Nothing better.', 'My tree. My favourite seat.'],
  'act:tablet': ['The slab. My favourite way to spend a morning.'],
  'act:lounge': ['Lying in the warm. A life well spent.'],
  'act:fish': ['The pond. The fish. My favourite game.'],
  'act:perch': ['Up high, looking down. Favourite.'],
  'act:craft': ['Making things. My favourite.'],
  'act:hunt': ['The hunt. It is what I am for.'],
};
// the start of a favourite: it knows, and says so now and then
export function favStart(w) {
  const c = w.cat, a = c.act, key = actKeyOf(a); if (!isFav(w, key)) return;
  if (w.clock - c.favSaid < w.dayLen * 0.15 || random() > 0.5) return;
  c.favSaid = w.clock; c.thought = pick(FAV_T[key] || FAV_T.default); c.thoughtId++; c.thoughtAt = w.clock;
}

// ---------- what it is feeling about the things it does ----------
// the effect of finishing something that did not already have its own feeling, and the label for it
const ENJOY = { 'act:paint': [{ joy: 0.07, fun: -0.05 }, 'proud'], 'act:gaze': [{ joy: 0.05, fun: -0.06, fear: -0.04 }, 'wondering'], 'act:perch': [{ joy: 0.05, fun: -0.06 }, 'content'], 'act:investigate': [{ joy: 0.04, fun: -0.05 }, 'wondering'], 'act:lounge': [{ joy: 0.05, fear: -0.05 }, 'soothed'], 'act:yarn': [{ joy: 0.06, fun: -0.1 }, 'content'], 'act:ball': [{ joy: 0.07, fun: -0.1 }, 'content'], 'act:toymouse': [{ joy: 0.07, fun: -0.1 }, 'content'], 'act:cattree': [{ joy: 0.08, fear: -0.08 }, 'soothed'] };
// called when an act is replaced by another. Things it did for a while that did not feel anything on their own do now.
export function enjoyAct(w, a) {
  if (!a || a.felt || a.phase === 'go' || !(a.t >= 2)) return;
  const key = actKeyOf(a), e = key && ENJOY[key]; if (!e) return;
  feel(w, [key], e[0], e[1]);
}

// ---------- which ones are favourites ----------
// looked at a few times a day. An act has to have been done several times and felt good each time; once it is a
// favourite it stays one until it clearly stops being good
export function favShift(w) {
  const c = ensureFinds(w.cat), as = c.assoc || {};
  const stays = k => { const A = as[k]; return A && A.n >= 4 && A.v >= 0.15; };
  const rank = k => as[k].v * Math.min(1, as[k].n / 10); // (liked, and done often: a thrill that has happened twice is not a favourite)
  const keep = c.favActs.filter(stays);
  const cands = Object.keys(as).filter(k => FAVABLE.has(k) && !keep.includes(k) && as[k].n >= 4 && as[k].v >= 0.22).sort((a, b) => rank(b) - rank(a));
  const next = keep.concat(cands).slice(0, MAX_FAVS), prev = c.favActs; c.favActs = next;
  for (const k of next) if (!prev.includes(k)) {
    const nm = keyName(k);
    journal(w, `${nm[0].toUpperCase() + nm.slice(1)} is my favourite thing to do. I did not choose that. I just keep ending up there, and it keeps being the best part.`, 'favourite'); note(w, `${c.name} has a favourite thing to do: ${nm}.`, 'taste');
  }
  for (const k of prev) if (!next.includes(k)) { const nm = keyName(k); journal(w, `${nm[0].toUpperCase() + nm.slice(1)} is not my favourite any more. It is still fine. It is just not the best.`, 'favourite'); }
  return next;
}

// ---------- tastes from finds ----------
// something it came across by itself. The first time it finds a colour or a kind of thing leaves the biggest mark.
export function foundThing(w, it) {
  const c = ensureFinds(w.cat), F = c.found, newC = !F.colors[it.color], newT = !F.types[it.type];
  F.colors[it.color] = (F.colors[it.color] || 0) + 1; F.types[it.type] = (F.types[it.type] || 0) + 1;
  const bump = (newC ? 0.1 : 0) + (newT ? 0.1 : 0);
  feel(w, ['color:' + it.color, 'type:' + it.type], { joy: 0.05 + bump }, newC || newT ? 'wondering' : 'content', { weight: 1.5 }); // (finding it itself counts for more than being handed it)
  if (newC || newT) {
    const nm = `${it.color} ${ITEM_LABEL[it.type] || it.type}`;
    if (newC && newT) journal(w, `I found ${an(nm)} in the grass. I had never seen one. I have not stopped looking at it.`, 'discover');
    else if (newC) journal(w, `The first ${it.color} thing I have ever found: ${an(nm)}. ${it.color[0].toUpperCase() + it.color.slice(1)} is more interesting than I thought.`, 'discover');
    else journal(w, `My first ${ITEM_LABEL[it.type] || it.type}. I found it myself. That counts for a lot.`, 'discover');
  }
  return { newC, newT };
}

// a corner of the yard it has just discovered
export function foundPlace(w, id) {
  const c = ensureFinds(w.cat); if (c.found.places[id]) return; c.found.places[id] = dayOf(w);
  feel(w, ['place:' + id], { joy: 0.12, fun: -0.1 }, 'wondering', { weight: 1.5 });
}
// how much it likes being at a place (-1..1), for choosing where to sit and sleep
export const placeLove = (w, id) => { const A = w.cat.assoc && w.cat.assoc['place:' + id]; return A ? A.v * Math.min(1, A.n / 3) : 0; };
// it feels good to be somewhere it likes
export function enjoyPlace(w, id, eff = { joy: 0.03 }) { if (PLACE_LABEL[id] || id === 'beam') feel(w, ['place:' + id], eff, 'content'); }
