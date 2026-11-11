// The stars. A cat that has spent enough nights gazing at the sky may start to wonder about the stars themselves
// (not the moon: the hundreds of little lights that hold still). It watches them night after night, runs out of
// things the sky can tell it, and goes to the tablet to find out what they are (see mysteries.js for the steps).
// Once it understands them a star may fall on a clear night, and if the cat is looking when it does it may ask for
// one thing, as it can on a full moon (see secrets.js). The shooting star is drawn in render.js from w.meteor.
import { rnd, pick, uid, ITEM_TYPES, FEATHER_COLORS, COLOR_NAMES } from './util.js';
import { note, journal, dayOf, hourOf, sunOf, clockStr, randomOpenPoint, blocked } from './world.js';
import { PACE, paceOf, scaled } from './pace.js';
import { feel } from './feelings.js';
import { clue, starsFinal } from './mysteries.js';
import { openWishes, wishLabel } from './wishes.js';
import { random } from './rng.js';

export const nightId = w => dayOf(w) - (hourOf(w) < 12 ? 1 : 0);          // (a night runs from one evening to the next morning)
export const darkSky = w => sunOf(hourOf(w)) < 0.12;
export const skyClear = w => w.weather.cloud < 0.6 && w.weather.rain < 0.2;
export const starsInterest = w => { const m = w.mysteries.stars; return !!(m && (m.interest || m.solved)); };
// it has watched long enough; now it needs the tablet
export const starsNeedsReading = w => { const m = w.mysteries.stars; return !!(m && m.interest && !m.solved && m.enough && !(m.read >= 1) && w.cat.mem.known.tablet); };
export const wishReady = w => dayOf(w) - (w.starWishDay == null ? -99 : w.starWishDay) >= PACE.starWishGap;

// ---------- getting curious ----------
// every night it spends looking at the sky counts once
export function starsNote(w) {
  const m = w.mysteries.stars; if (!m || m.solved || !darkSky(w)) return;
  const id = nightId(w); if (m.lastNight !== id) { m.lastNight = id; m.nights = (m.nights || 0) + 1; }
}
export function startStars(w, how = 'nights') {
  const m = w.mysteries.stars, c = w.cat; if (m.interest || m.solved) return false;
  m.interest = true; m.seen = true; m.interestDay = dayOf(w);
  note(w, `${c.name} has started wondering about the stars.`, 'wonder');
  journal(w, how === 'read' ? 'The slab showed me the stars. Real ones, written down. I knew they were more than lights. I am going to find out what.' : 'I have spent so many nights looking up. They do not move like the moon. There are so many and they all hold still, as if they are waiting for something. I want to know what they are.', 'stars');
  c.thoughtHint = 'starsCurious'; c.thoughtId++; c.thoughtAt = w.clock;
  return true;
}
// every sixth of a day
export function starsRoll(w) {
  const m = w.mysteries.stars, c = w.cat; if (!m) return;
  if (m.interest && !m.solved) starsFinal(w); // (with no tablet it gets there in the end)
  if (m.interest || m.solved || dayOf(w) < 3 || (m.nights || 0) < scaled(w, PACE.starsNights, 2)) return;
  if (random() < PACE.starsUrge * (0.5 + c.traits.curious) * (c.temper === 'nightowl' ? 1.5 : 1) / paceOf(w)) startStars(w, 'nights');
}

// ---------- clues ----------
// only once it is wondering about them (the stars are not a clue before then)
export function starsClue(w, amt = 1) { const m = w.mysteries.stars; if (!m || !m.interest || m.solved) return; clue(w, 'stars', amt); }
// it has read about the stars (tablet.js): that can start the wondering, and it is the last step of working them out
export function starsPage(w) {
  const m = w.mysteries.stars; if (!m || m.solved) return;
  if (!m.interest) { if (random() < 0.4) startStars(w, 'read'); return; }
  m.read = (m.read || 0) + 1; starsClue(w, 2);
  if (m.enough) { starsFinal(w); }
}

// ---------- shooting stars ----------
// a star may fall on a clear night. nights are planned once, when the sky goes dark; a cat that goes out to gaze at the
// stars may also find one falling while it looks
function planNight(w, id) {
  const h = hourOf(w), hh = h < 12 ? h + 24 : h, span = Math.max(0, (29 - hh) / 24 * w.dayLen), r = random(), n = r < 1 - PACE.meteorNight ? 0 : r < 1 - PACE.meteorNight * 0.2 ? 1 : 2;
  w.meteorPlan = { id, times: Array.from({ length: n }, () => w.clock + rnd(0.04, 0.96) * span).sort((a, b) => a - b) };
  return w.meteorPlan;
}
const ensurePlan = w => (w.meteorPlan && w.meteorPlan.id === nightId(w) ? w.meteorPlan : planNight(w, nightId(w)));
// a cat that starts gazing at the stars on a night it is allowed a wish may be lucky
export function meteorLure(w, dur) {
  if (!w.mysteries.stars.solved || !darkSky(w) || !skyClear(w) || !wishReady(w) || random() > 0.45) return false;
  const p = ensurePlan(w); p.times.push(w.clock + rnd(4, Math.max(5, dur - 3))); p.times.sort((a, b) => a - b); return true;
}

function catSees(w) {
  const c = w.cat; if (c.pose === 'sleep' || c.pose === 'inside' || c.hidden) return false;
  if (c.act && c.act.type === 'gaze') return true;
  return random() < (w.weather.cloud > 0.4 ? 0.2 : 0.45);
}
export function launchMeteor(w, forceSee = null) {
  const dir = random() < 0.5 ? -1 : 1;
  w.meteor = { t: 0, dur: rnd(1.4, 2.0), x0: dir > 0 ? rnd(140, 560) : rnd(400, 820), y0: rnd(10, 55), dx: dir * rnd(150, 260), dy: rnd(60, 115), seen: forceSee == null ? catSees(w) : !!forceSee };
  if (w.meteor.seen) { const c = w.cat; c.thought = pick(['A STAR. It is falling. Wish, wish, wish.', 'There. There! One fell.', 'I saw it. I was looking. Nobody else saw it, but I did.']); c.thoughtId++; c.thoughtAt = w.clock; c.face = dir > 0 ? 1 : -1; }
  return w.meteor;
}
// called every tick
export function meteorTick(w, dt) {
  const mt = w.meteor;
  if (mt) { mt.t += dt; if (mt.t > mt.dur) { w.meteor = null; if (mt.seen) meteorSeen(w); } return; }
  if (!w.mysteries.stars.solved || !darkSky(w)) return;
  const p = ensurePlan(w); if (!p.times.length || w.clock < p.times[0]) return;
  const t = p.times.shift(); if (skyClear(w) && w.clock - t < w.dayLen * 0.04) launchMeteor(w);
}
// the cat watched it fall
function meteorSeen(w) {
  const c = w.cat; w.stats.meteorsSeen = (w.stats.meteorsSeen || 0) + 1;
  if (wishReady(w)) return starWish(w);
  journal(w, 'I saw a star fall. I have already had my wish this week, so I asked it to keep the next one for me. It did not say no.', 'stars');
  c.mood.joy = Math.min(1, c.mood.joy + 0.15); c.thoughtHint = 'starSeen'; return null;
}

// what turns up when a wish is granted: something the cat likes, or exactly what it asked the human for
export function glitterThing(w) {
  const q = w.cat.quirk; let type, color = null;
  if (random() < 0.3) type = 'twine';
  else { type = random() < 0.6 ? q.item : pick(ITEM_TYPES); color = type === 'feather' ? pick(FEATHER_COLORS) : (random() < 0.6 ? q.favColor : pick(COLOR_NAMES.filter(k => k !== 'black'))); }
  return { type, color };
}
export function starWish(w) {
  const c = w.cat; w.starWishDay = dayOf(w);
  let p = randomOpenPoint(w, 80, 880, 300, 540), tries = 0; while (blocked(w, p.x, p.y) && tries++ < 8) p = randomOpenPoint(w, 80, 880, 300, 540);
  const open = openWishes(w).filter(x => x.kind === 'item'); let thing = glitterThing(w), asked = null; // (it may grant something it had asked the human for)
  if (open.length && random() < 0.5) { asked = pick(open); thing = { type: asked.type, color: asked.color || (asked.type === 'feather' ? pick(FEATHER_COLORS) : w.cat.quirk.favColor) }; }
  const it = { id: uid(), type: thing.type, color: thing.color, x: p.x, y: p.y, age: 0, moon: true, star: true }; w.items.push(it);
  w.stats.starWishes = (w.stats.starWishes || 0) + 1;
  if (asked) { asked.state = 'granted'; asked.granted = { day: dayOf(w), time: clockStr(w), by: 'star' }; }
  note(w, asked ? `A shooting star fell, and ${c.name} wished for ${wishLabel(asked)}. It is lying in the yard now.` : `A shooting star fell and ${c.name} made a wish: something glittering is lying in the yard.`, 'wonder');
  journal(w, asked ? `A star fell and I was looking. I did not ask for something new. I asked for the ${wishLabel(asked).replace(/^an? /, '')} I had been waiting for, and it is lying in the grass, shining. I will still be kind to the human about it.` : 'A star fell while I was looking and I asked. Something is shining in the grass that was not there before. The sky keeps its word too.', 'starwish');
  feel(w, ['act:gaze'], { joy: 0.35, fear: -0.15 }, 'thrilled'); c.mood.joy = Math.min(1, c.mood.joy + 0.5); c.thoughtHint = 'starWish';
  return it;
}
