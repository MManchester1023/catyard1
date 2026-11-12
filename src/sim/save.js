// Turning a world into a small JSON save and back. Transient things (birds, mice, the current
// action) are rebuilt on load; everything the cat has lived through is kept.
import { makeWorld, makeCat, catchUp, VERSION } from './sim.js';
import { start } from './acts.js';
import { uid } from './util.js';
import { makeTastes, ensureOfferState } from './offerings.js';
import { ensureTablet } from './tablet.js';
import { ensureBlog } from './blog.js';
import { ensureCraft } from './recipes.js';
import { ensureFeel } from './feelings.js';
import { ensureMemory } from './memory.js';
import { ensureFinds } from './finds.js';
import { ensureChar } from './character.js';
import { ensureIntent } from './intent.js';
import { ensureInterest } from './interest.js';
import { meetFrog } from './frog.js';
import { makeTemper } from './temper.js';
import { restoreRng, useRng } from './rng.js';

const KEEP_W = ['v', 'rng', 'clock', 'dayLen', 'speed', 'paused', 'log', 'logId', 'journal', 'chat', 'pending', 'weather', 'stash', 'easel', 'easelMade', 'shake', 'toys', 'mysteries', 'fed', 'stats', 'createdAt', 'items', 'treats', 'wantT', 'rippleT', 'thiefT', 'lastChatAt', 'offers', 'tablet', 'table', 'deco', 'hist', 'days', 'frog', 'pace', 'catTree', 'moonWishDay', 'starWishDay', 'meteorPlan', 'blog'];

export function serialize(w) {
  const data = { app: 'cat-yard', version: VERSION, savedAt: Date.now(), w: {}, cat: null, o: { bowl: w.o.bowl.food, yarn: { x: w.o.yarn.x, y: w.o.yarn.y } } };
  for (const k of KEEP_W) data.w[k] = w[k];
  const { act, ...cat } = w.cat; data.cat = cat;
  return JSON.stringify(data);
}

// deep merge so saves from older versions pick up new default fields
function merge(dst, src) {
  if (!src || typeof src !== 'object') return dst;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) merge(dst[k], v);
    else if (v !== undefined) dst[k] = v;
  }
  return dst;
}
const finite = (o) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (typeof o[k] === 'number' && !Number.isFinite(o[k])) o[k] = 0; else finite(o[k]); } return o; };

export function deserialize(text) {
  const data = JSON.parse(text);
  if (!data || data.app !== 'cat-yard' || !data.w || !data.cat) throw new Error('Not a Cat Yard save file');
  if (data.version > VERSION) throw new Error('This save is from a newer version of the app');
  const dice = restoreRng(data.w.rng), w = makeWorld(data.cat.name, dice ? { seed: dice.seed } : {}); // (the parts a save does not keep, like the birds in the air, are rebuilt the same way every time)
  if (dice) { w.rng.seed = dice.seed; w.rng.s = dice.s; } useRng(w.rng); // (from here on, the saved dice: loading the same save always plays out the same way)
  w.items = []; w.treats = []; w.log = []; w.journal = []; w.pending = [];
  const { rng: _rng, ...rest } = data.w; merge(w, finite(rest));
  if (data.w.easelMade === undefined) w.easelMade = { x: w.o.easel.x, y: w.o.easel.y, day: 1, legacy: true }; // (every save from before the easel had to be built already had one standing)
  merge(w.cat, finite(data.cat));
  if (!data.cat.base) w.cat.base = null; // (an older save's character starts from the traits it has, not from a new cat's)
  if (!data.cat.tastes) w.cat.tastes = makeTastes(w.cat.quirk);
  if (data.cat.quirkV !== 2) { w.cat.temper = makeTemper(); w.cat.quirkV = 2; } // saves from before every cat had exactly one quirk are given one, once
  w.offers = Array.isArray(data.w.offers) ? data.w.offers : []; ensureOfferState(w); ensureTablet(w); ensureBlog(w); ensureCraft(w); ensureFeel(w.cat); ensureMemory(w.cat); ensureFinds(w.cat); ensureChar(w.cat); ensureIntent(w.cat); ensureInterest(w.cat); w.netq = []; w.netOn = false;
  if (!(w.pace > 0)) w.pace = 1;
  if (!w.frog && w.mysteries.ripples.solved) meetFrog(w, true); // a cat that had already found out what lives in the pond before frogs became friends
  if (data.o) { w.o.bowl.food = data.o.bowl; if (data.o.yarn) { w.o.yarn.x = data.o.yarn.x; w.o.yarn.y = data.o.yarn.y; } }
  // a treasure that was in the cat's mouth goes back on the ground
  const c = w.cat;
  if (c.carry && c.carry.type !== 'mouse') w.items.push({ id: uid(), type: c.carry.type, color: c.carry.color, x: c.x, y: c.y, age: 0 });
  c.carry = null; c.pose = 'sit'; c.hidden = false; c.z = 0; c.pu = 0; c.wig = false;
  w.asks = []; w.mice = []; w.ripple = null; w.thief = null; w.onNote = null;
  start(w, 'idle'); w.lastThoughtId = w.cat.thoughtId;
  w.savedAt = data.savedAt;
  return w;
}

// fast-forward the time the app was closed, capped so reopening stays quick
export const MAX_AWAY_SECONDS = 3 * 3600;
// What to do with the gap between two frames of the loop. Short: an ordinary step. Longer: catch up (a background tab
// was slowed down). Longer than two minutes: the app was closed or the computer slept, and unless the player chose to
// let the cat live on, that time simply does not pass.
export const GAP_SKIP_SECONDS = 120;
export const gapAction = (dt, live) => (dt <= 2 ? 'step' : dt > GAP_SKIP_SECONDS && !live ? 'skip' : 'catchup');
export function catchUpFromSave(w, nowMs = Date.now()) {
  const away = Math.max(0, (nowMs - (w.savedAt || nowMs)) / 1000);
  if (away < 30) return null;
  const used = Math.min(away, MAX_AWAY_SECONDS);
  const r = catchUp(w, used);
  r.awayRealSeconds = away; r.capped = away > MAX_AWAY_SECONDS;
  return r;
}
