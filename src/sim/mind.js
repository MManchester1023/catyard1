// Deciding what to do next: needs, personality, wants and curiosity all pull on the choice.
import { rnd, clamp, dist, MATERIALS } from './util.js';
import { hourOf, sunOf, moonPos, moonLight, beamOf } from './world.js';
import { bestItem, itemValue } from './quirk.js';
import { wantPull } from './wants.js';
import { pendingOffer } from './offerings.js';
import { canUseTablet, lookupWant } from './tablet.js';
import { gatherNeed, nextCraft, stringWanted, bedRoom } from './craft.js';
import { affinity } from './feelings.js';
import { SCORE_KEY, isFav, placeLove, FAV_PULL } from './finds.js';
import { moodToday, habitPull, stubPull } from './character.js';
import { intentPull } from './intent.js';
import { projectPull } from './project.js';
import { interestActive } from './interest.js';
import { wishPending } from './wishes.js';
import { shopPending } from './economy.js';
import { blogPending } from './blog.js';
import { deepNightOf } from './temper.js';
import { knows, easelUrge } from './recipes.js';
import { clueRoom, frogRoom, gatherRoom } from './pace.js';
import { darkSky, wishReady, starsNeedsReading } from './stars.js';
import { isUpset, upsetLevel } from './upset.js';
import { coinActive } from './secrets.js';

const FEATURES = ['pond', 'post', 'tree', 'flowers', 'cushion', 'yarn', 'fence', 'easel', 'tablet'];
export const unknownPlaces = w => FEATURES.filter(id => !w.cat.mem.known[id] && (id !== 'easel' || w.easelMade)); // (there is no easel to find until the cat has built one)
// a cat that is less tired than this does not lie down: not for the night, and not for a nap
export const SLEEPY = 0.3;
// and a daytime nap, in the sun or on the cushion, wants a cat that is properly tired
export const NAPPY = 0.42;

export function interest(w) {
  const c = w.cat; let best = null, bd = 420;
  const consider = p => { const d = dist(c, p); if (d < bd) { bd = d; best = p; } };
  w.birds.forEach(b => b.state !== 'away' && b.state !== 'fly' && consider(b));
  w.mice.forEach(m => !m.dead && consider(m));
  w.flies.forEach(f => f.on && consider(f));
  return best;
}

export function pickSleepSpot(w, rainy) {
  const c = w.cat, h = hourOf(w), k = c.mem.known, nap = c.mem.nap, bm = beamOf(w);
  if (rainy || sunOf(h) < 0.2) return 'house';
  const opts = [['house', 0.45 + (nap.house || 0) * 0.04]];
  if (bm.on && k.beam) opts.push(['beam', 1 + (nap.beam || 0) * 0.08]);
  if (k.cushion) opts.push(['cushion', 0.65 + (nap.cushion || 0) * 0.06]);
  if (k.flowers && h > 11 && h < 17) opts.push(['flowers', 0.5 + (nap.flowers || 0) * 0.05]);
  opts.forEach(o => (o[1] += rnd(0, 0.25) + placeLove(w, o[0]) * 0.3)); // (it likes some spots better than others)
  opts.sort((a, b) => b[1] - a[1]); return opts[0][0];
}

// ---------------------------------------------------------------------------------------------------------------
// Deciding what to do next. Every so often the cat scores everything it could do and does the best one.
//
//   situation()  works out, once per decision, what the rules share: the hour, the weather, its quirk, and a few
//                named conditions (awake, dry, out, fit).
//   ACTIVITIES   is the list of rules, one per thing it could do. Each may prepare something first (prep), may only
//                apply when a condition holds (when; otherwise it scores 0), and gives a score, usually with a little
//                noise, x.N(), so two close options do not always go the same way. A few then pick details (then).
//   decide()     then lets being upset, the mood of the day, habits, notions, intentions and what has felt good
//                adjust the scores, gives the current activity a little stickiness, and does the highest.
//
// The order of ACTIVITIES matters: it is the order the dice are rolled in and the order ties are broken in, so
// moving an entry changes how a seeded world plays out (behaviour stays the same on average).
// ---------------------------------------------------------------------------------------------------------------

// tired past this, it will not start anything that takes effort: the tablet, building, gathering, the post, the chime...
export const TOO_TIRED = 0.85;
// at night a little tired is enough to go to bed (by day, see SLEEPY above)
export const NIGHT_SLEEPY = 0.2;

function situation(w) {
  const c = w.cat, n = c.needs, h = hourOf(w), sun = sunOf(h), rain = w.weather.rain, t = c.temper;
  const deepNight = deepNightOf(c, h) ? 1 : 0;
  const x = {
    w, c, n, o: w.o, k: c.mem.known, q: c.quirk, T: c.traits, h, sun, night: 1 - sun, rain, deepNight,
    dusk: (h > 5 && h < 8.5) || (h > 16.5 && h < 20.5) ? 1 : 0,
    // its quirk (temper.js)
    owl: t === 'nightowl', hunter: t === 'hunter', vg: t === 'vangogh', gf: t === 'garfield', tech: t === 'techie', bob: t === 'builder', col: t === 'collector',
    // the named conditions
    awake: !deepNight,         // not the dead of night (by its own clock: a night owl's night is later)
    dry: rain < 0.4,           // not raining enough to keep it in
    out: !c.hidden,            // not tucked away in the cabin
    fit: n.tired < TOO_TIRED,  // not too tired for anything that takes effort
    unk: unknownPlaces(w), opts: {},
  };
  x.nd = x.owl ? 0.3 : 1;                              // (night slows a night owl down far less)
  x.N = () => rnd(0, 0.1);                             // a little noise
  x.ago = (at, days) => w.clock - at > w.dayLen * days; // more than this many days since then
  x.solving = id => c.wants.some(y => y.kind === 'solve' && y.mystery === id); // it wants to work this mystery out
  return x;
}

export const ACTIVITIES = [
  // ----- the body: food, water, sleep, washing, play -----
  { key: 'idle', score: x => 0.2 + x.T.lazy * 0.22 - (x.bob ? 0.1 : 0) + x.N() },
  { key: 'explore', // (a techie goes looking for the tablet)
    score: x => (0.1 + x.T.curious * 0.38) * (1 - x.T.lazy * 0.35) * (1 - x.night * 0.7 * x.nd) * (x.unk.length ? 1.5 : 1) * (x.tech && x.unk.includes('tablet') ? 1.8 : 1) * (x.gf ? 0.7 : 1) * (x.bob ? 0.85 : 1) + x.N() },
  { key: 'eat', when: x => x.o.bowl.food > 0.02 && x.n.hunger > (x.gf ? 0.18 : 0.35), score: x => (x.n.hunger - (x.gf ? 0.02 : 0.15)) * 2.1 + x.N() },
  { key: 'drink', when: x => x.n.thirst > 0.35, score: x => (x.n.thirst - 0.2) * 1.9 + x.N() },
  { key: 'groom', score: x => (x.c.groomNext ? 3 : 0) + (x.n.dirty > 0.45 && x.n.dirty <= 0.58 ? (x.n.dirty - 0.3) * 1.5 : 0) }, // (always after a meal)
  { key: 'wash', // a proper wash when it is properly dirty: to the water, a good scrub, then drying off in the sun if there is some
    when: x => (x.n.dirty > 0.58 || (x.n.wet > 0.5 && x.rain < 0.3)) && x.ago(x.c.washAt || -1e9, 0.15) && x.awake,
    score: x => 0.7 + (x.n.dirty - 0.5) * 1.6 + x.N() },
  { key: 'sleep', // not tired, no sleep (Garfield included)
    when: x => !(x.n.tired < (x.deepNight ? NIGHT_SLEEPY : SLEEPY)),
    score: x => (x.n.tired > 0.55 ? (x.n.tired - 0.4) * 2 + x.T.lazy * 0.2 : 0) + x.deepNight * (1.1 + x.n.tired * 0.3) + x.night * 0.12 + x.N() },
  { key: 'play', when: x => x.n.fun > 0.3,
    score: x => (x.n.fun - 0.15) * 1.7 * (0.65 + x.T.curious * 0.5) * (1 - x.night * 0.8 * x.nd) * (x.rain > 0.3 ? 0.3 : 1) * (x.gf ? 0.55 : x.bob ? 0.8 : 1) + x.N() },
  { key: 'hunt', // the nearest mouse or bird within reach (a Hunter sees further)
    prep: x => {
      const prey = x.w.mice.filter(m => !m.dead && m.state !== 'flee').concat(x.w.birds.filter(b => b.state === 'ground' && b.alert < 0.5));
      let target = null, td = x.hunter ? 560 : 300; prey.forEach(p => { const d = dist(x.c, p); if (d < td) { td = d; target = p; } });
      x.target = target; if (target) x.opts.hunt = { prey: target };
    },
    when: x => x.target && x.c.huntCool <= 0 && x.n.tired < (x.hunter ? 0.93 : TOO_TIRED) && x.out,
    score: x => (x.hunter ? 1.25 + x.T.bold * 0.2 + (x.n.hunger > 0.5 ? 0.25 : 0) : 0.3 + x.T.bold * 0.5 + (x.n.hunger > 0.5 ? 0.5 : 0) + x.dusk * 0.2 - (x.target.kind === 'bird' ? 0.25 : 0)) * (1 - x.deepNight * 0.4) * (x.gf ? 0.6 : 1) + wantPull(x.w, ['catch']) * 0.45 + x.N() },
  { key: 'perch', when: x => (x.k.tree || x.k.fence) && x.n.fun > 0.25 && x.rain < 0.2 && x.sun > 0.3 && x.n.tired < 0.8,
    score: x => (0.22 + x.T.bold * 0.32) * (x.w.birds.some(b => b.state === 'perch' || b.state === 'ground') ? 1.5 : 1) + x.N() },
  { key: 'shelter', when: x => x.rain > 0.3 && x.out, score: x => x.n.wet * 1.7 + x.rain * 0.5 * (1 - x.T.bold * 0.6) },
  { key: 'beg', when: x => x.o.bowl.food < 0.02 && x.n.hunger > (x.gf ? 0.32 : 0.5) && x.w.clock - x.c.begAt > 70 && (x.awake || x.n.hunger > 0.8), score: x => 0.85 + x.N() },
  { key: 'treat', when: x => x.w.treats.length, score: x => 0.8 + x.n.hunger * 0.6 + x.T.curious * 0.3 + (x.gf ? 0.4 : 0) },
  { key: 'zoom', when: x => x.n.tired < 0.45 && x.n.fun > 0.45 && (x.dusk || x.night > 0.5) && x.awake && x.rain < 0.3 && x.ago(x.c.zoomAt, 0.5), score: x => 0.95 + x.N() },

  // ----- what makes this cat this cat -----
  { key: 'collect', // only a Collector goes out of its way for trinkets; anyone picks up building parts and moon gifts
    prep: x => { x.item = x.dry ? bestItem(x.w, x.c, x.col) : null; if (x.item) x.opts.collect = { item: x.item }; },
    when: x => x.item,
    score: x => (0.5 + (MATERIALS.includes(x.item.type) ? 0.3 : 0) + itemValue(x.w, x.item) * 0.45 + wantPull(x.w, ['find']) * 0.5 + x.T.curious * 0.15) * (1 - x.deepNight * 0.7) * (x.col || MATERIALS.includes(x.item.type) || x.item.moon ? 1 : 0.3) },
  { key: 'stashvisit', when: x => x.w.stash.site && x.awake && x.dry,
    score: x => clamp(((x.w.clock - (x.q.lastVisit || 0)) / x.w.dayLen - 0.12) * 2.2, 0, 0.95) * (x.col ? 1 : 0.4) + wantPull(x.w, ['guard']) * 0.9 + (x.n.fear || 0) * 0.7 * (x.col ? 1 : 0.5) + x.N() },
  { key: 'paint', // (needs the easel it built; Garfield can rarely be bothered)
    when: x => x.w.easelMade && x.n.create > (x.vg ? 0.25 : 0.4) && x.sun > 0.15 && x.dry && x.n.tired < (x.vg ? 0.93 : TOO_TIRED) && x.awake,
    score: x => ((x.vg ? (x.n.create - 0.1) * 2 + 0.2 : (x.n.create - 0.25) * 1.9) + wantPull(x.w, ['master']) * 0.6 + x.T.curious * 0.1 + x.N()) * (x.gf ? 0.45 : 1) },
  { key: 'gaze', // the moon; or, once it wonders about the stars (or knows what they are and hopes one will fall), the stars, on any clear night
    score: x => {
      const { w, n, T } = x, mp = moonPos(w), m = w.mysteries.moon, sm = w.mysteries.stars, skyOk = w.weather.cloud < 0.7 && x.rain < 0.3 && n.hunger < 0.85 && n.tired < 0.92 && x.awake;
      const gMoon = mp && moonLight(w) > 0.12 && skyOk ? 0.28 + (1 - m.conf) * 0.4 + T.curious * 0.2 + (x.solving('moon') ? 0.7 : 0) + x.N() : 0;
      const gStars = (sm.interest || sm.solved) && darkSky(w) && skyOk && (sm.solved || (clueRoom(w, 'stars') && !sm.enough))
        ? 0.3 + (sm.solved ? 0.1 + (wishReady(w) ? 0.3 : 0) : (1 - sm.conf) * 0.35) + T.curious * 0.2 + (x.solving('stars') ? 0.7 : 0) + x.N() : 0;
      const stars = gStars * (gMoon && !m.solved ? 0.75 : 1);
      if (stars > gMoon) x.opts.gaze = { stars: true };
      return Math.max(gMoon, stars);
    } },
  { key: 'investigate', // the ripples, a spark, or (a very curious cat that has started wondering) the roots of the oak
    prep: x => {
      const { w, c } = x;
      x.ripple = w.clock - (w.rippleAt || -999) < 40 && !w.mysteries.ripples.solved && frogRoom(w) && x.ago(c.ripAt || -1e9, 0.1);
      x.spark = w.sparks.some(s => s.on) && !w.mysteries.sparks.solved && clueRoom(w, 'sparks');
    },
    when: x => x.dry && x.n.tired < 0.9,
    score: x => {
      const { w, c, k, T } = x, mt = w.mysteries.tree;
      const sr = x.ripple ? 0.8 + T.curious * 0.4 + (x.solving('ripples') ? 0.8 : 0) : 0, ss = x.spark ? 0.45 + T.curious * 0.4 + (x.solving('sparks') ? 0.8 : 0) : 0;
      const st = mt.interest && !mt.solved && k.tree && x.sun > 0.3 && clueRoom(w, 'tree') && x.ago(c.oakAt || -1e9, 0.07) ? 0.55 + T.curious * 0.35 + (x.solving('tree') ? 0.6 : 0) : 0;
      if (!(sr || ss || st)) return 0;
      x.opts.investigate = { kind: st >= sr && st >= ss ? 'tree' : sr >= ss ? 'ripples' : 'sparks' };
      return (Math.max(sr, ss, st) + x.N()) * (x.tech ? 0.6 : 1);
    } },
  { key: 'listen', // the wind chime: sit and listen, which takes the edge off being bored
    when: x => x.w.deco && x.w.deco.chime && x.dry && x.n.fun > 0.3 && x.awake && x.fit && x.ago(x.c.listenAt || -1e9, 0.12),
    score: x => 0.24 + (x.n.fun - 0.3) * 1.5 + x.T.lazy * 0.15 + (x.n.fear > 0.3 ? 0.25 : 0) + x.N() },
  { key: 'fish', // a fish in the pond
    when: x => x.w.fish && !x.w.fish.spooked && x.k.pond && x.dry && x.out && x.n.tired < 0.9 && x.awake && x.ago(x.c.fishAt || -1e9, 0.3),
    score: x => (0.2 + x.n.hunger * 0.9 + x.T.bold * 0.15 + (x.hunter ? 0.45 : 0) + (x.gf ? 0.3 : 0)) * (1 - x.T.lazy * 0.2) + x.N() },
  { key: 'frog', when: x => x.w.frog && x.w.frog.out && x.rain < 0.5 && x.out && x.n.tired < 0.92 && x.ago(x.w.frog.lastVisit, 0.1),
    score: x => 0.12 + Math.max(0, x.n.lonely - 0.2) * 2.3 + x.w.frog.bond * 0.3 + x.N() },
  { key: 'attention', // the glass is a last resort: only when really lonely
    when: x => x.n.lonely > 0.68 && x.ago(x.c.attAt, 0.4) && x.awake,
    score: x => (x.n.lonely - 0.5) * 1.3 + wantPull(x.w, ['attention']) * 0.6 + x.c.bond * 0.12 + x.N() },

  // ----- the mat, the tablet, making things -----
  { key: 'offering', // a gift left waiting gets harder to ignore the longer it waits
    prep: x => { x.po = pendingOffer(x.w); if (x.po) x.opts.offering = { offer: x.po }; },
    when: x => x.po && x.dry && x.awake,
    score: x => 1.05 + x.T.curious * 0.3 + x.c.bond * 0.25 + Math.min(0.9, Math.max(0, x.w.clock - x.po.at - 15) * 0.012) + x.N() },
  { key: 'tablet', // anything it wants to look up, write or read pulls it there; the Techie goes first when stuck
    prep: x => { x.lw = lookupWant(x.w); },
    when: x => x.dry && x.awake && x.fit && canUseTablet(x.w),
    score: x => { const { w, c } = x; return 0.3 + x.T.curious * 0.45 + (x.lw ? x.lw.strength * 0.9 : 0) + (wishPending(w) ? 0.55 : 0) + (shopPending(w) ? 0.5 : 0) + (interestActive(w) ? 0.4 : 0) + (blogPending(w) ? 0.6 : 0) + (starsNeedsReading(w) ? 0.6 : 0) + (c.wants.some(y => y.kind === 'learn') ? 0.6 : 0) + x.dusk * 0.15 + (x.tech ? (c.wants.some(y => y.kind === 'learn' || y.kind === 'lookup' || y.kind === 'solve') || wishPending(w) ? 1.7 : 0.4) : 0) + x.N(); } },
  { key: 'gather', // scratch the oak for bark and twigs when something it means to build needs them
    prep: x => { x.gn = x.dry && x.k.tree && gatherRoom(x.w) ? gatherNeed(x.w) : null; x.gnc = x.gn && x.dry ? nextCraft(x.w) : null; },
    when: x => x.gn && !x.gnc && x.awake && x.fit && x.n.hunger < 0.9, // (if it is already carrying what it needs for something, it makes that first)
    score: x => 0.36 + wantPull(x.w, ['craft']) * 0.55 + x.T.curious * 0.12 + (x.bob ? 0.3 : 0) + easelUrge(x.w) * 0.6 + x.N() },
  { key: 'craft', prep: x => { x.nc = x.dry ? nextCraft(x.w) : null; if (x.nc) x.opts.craft = { recipe: x.nc }; },
    when: x => x.nc && x.awake && x.fit,
    score: x => 0.78 + wantPull(x.w, ['craft']) * 0.5 + (x.bob ? 0.35 : 0) + (x.nc === 'easel' ? easelUrge(x.w) * 0.5 : 0) + x.N() },

  // ----- behind the cabin, and the yard's furniture (each used for its own reasons) -----
  { key: 'peek', when: x => x.c.peekUrge && !x.w.catTree && x.dry && x.awake && x.n.tired < 0.88 && x.out, score: x => 1.25 + x.N() },
  { key: 'cattree', // (the first time, it wants to try it out straight away)
    when: x => x.w.catTree && x.dry && x.awake && x.n.tired < 0.9 && x.out && (x.w.clock - (x.c.catTreeAt || -1e9)) / x.w.dayLen > 0.12,
    score: x => 0.2 + x.T.lazy * 0.25 + x.T.bold * 0.2 + (x.n.fear > 0.3 ? 0.25 : 0) + (x.gf ? 0.25 : 0) + (x.w.catTree && !x.c.catTreeAt ? 0.9 : 0) + (coinActive(x.w) ? 0.1 : 0) + x.N() },
  { key: 'post', // claws need doing every so often
    when: x => x.k.post && x.dry && x.awake && x.fit && x.out,
    score: x => clamp(((x.w.clock - (x.c.postAt || 0)) / x.w.dayLen - 0.07) * 2.4, 0, 0.95) + x.T.bold * 0.1 + (x.hunter ? 0.12 : 0) + x.N() },
  { key: 'yarn', when: x => x.k.yarn && x.dry && x.awake && x.n.fun > 0.14 && x.n.tired < 0.8 && x.out,
    score: x => (0.2 + (x.n.fun - 0.12) * 1.7) * (0.7 + x.T.curious * 0.5) * (x.gf ? 0.4 : x.bob ? 0.8 : 1) * (1 - x.night * 0.6 * x.nd) + x.N() },
  { key: 'ball', when: x => x.w.toys.ball && x.dry && x.awake && x.n.fun > 0.14 && x.n.tired < 0.8 && x.out,
    score: x => (0.24 + (x.n.fun - 0.12) * 1.7) * (0.7 + x.T.curious * 0.5) * (x.gf ? 0.4 : x.bob ? 0.8 : 1) * (1 - x.night * 0.6 * x.nd) + x.N() },
  { key: 'toymouse', when: x => x.w.toys.toymouse && x.dry && x.awake && x.n.fun > 0.14 && x.n.tired < 0.8 && x.out,
    score: x => (0.24 + (x.n.fun - 0.12) * 1.7) * (0.7 + x.T.curious * 0.5) * (x.gf ? 0.4 : x.bob ? 0.8 : 1) * (1 - x.night * 0.6 * x.nd) + (x.hunter ? 0.14 : 0) + x.N() },
  { key: 'lounge', // a daytime nap in the sunbeam or on the cushion: properly tired, and not straight after the last one
    prep: x => { x.bm = beamOf(x.w); x.spots = []; if (x.bm.on && x.k.beam) x.spots.push('beam'); if (x.k.cushion) x.spots.push('cushion'); },
    when: x => x.spots.length && x.dry && x.awake && x.out && x.n.tired > NAPPY && x.n.tired < 0.9 && (x.w.clock - (x.c.loungeAt || -1e9)) / x.w.dayLen > (x.gf ? 0.26 : 0.16),
    score: x => 0.14 + (x.n.tired - 0.15) * 0.9 + x.T.lazy * 0.35 + (x.bm.on && x.k.beam ? 0.14 : 0) - (x.vg || x.bob ? 0.1 : 0) + x.N(),
    then: (x, s) => { if (!s) return; const nap = x.c.mem.nap; const sp = x.spots.map(p => [p, (p === 'beam' ? 1 : 0.7) + (nap[p] || 0) * 0.04 + rnd(0, 0.4) + placeLove(x.w, p) * 0.3]).sort((a, b) => b[1] - a[1])[0][0]; x.opts.lounge = { spot: sp, lounge: true }; } },
  { key: 'stringbed', // once it knows the cushion has string in it, it pulls at it when a recipe needs some
    when: x => x.k.cushion && x.dry && x.awake && x.fit && x.n.hunger < 0.9 && stringWanted(x.w) && bedRoom(x.w),
    score: x => 0.62 + wantPull(x.w, ['craft']) * 0.5 + (x.bob ? 0.3 : 0) + x.T.curious * 0.1 + x.N() },
];

// an upset cat will not sit at the glass or play along, and mostly sulks
const UPSET = { attention: 0.15, offering: 0.6, play: 0.6, tablet: 0.7, paint: 0.8, frog: 1.2 };

// what the current act counts as among the scores (a lounge is a kind of sleep, gathering a kind of play, and so on)
function currentKey(cur, ca) {
  if (!ca) return cur;
  if (cur === 'idle' && ca.sulk) return 'sulk';
  if (cur === 'investigate' && ca.kind === 'tree') return 'investigate';
  if (cur === 'play' && ca.gather) return 'gather';
  if (cur === 'play' && ca.own) return ca.kind === 'bed' ? 'stringbed' : ca.kind;
  if (cur === 'sleep' && ca.lounge) return 'lounge';
  return cur;
}

// the winning score as an act (acts.js) when it is not simply the act of the same name
const AS_ACT = {
  gather: () => ({ type: 'play', opts: { kind: 'tree', gather: true } }),
  post: () => ({ type: 'play', opts: { kind: 'post', own: true } }),
  yarn: () => ({ type: 'play', opts: { kind: 'yarn', own: true } }),
  ball: () => ({ type: 'play', opts: { kind: 'ball', own: true } }),
  toymouse: () => ({ type: 'play', opts: { kind: 'toymouse', own: true } }),
  stringbed: () => ({ type: 'play', opts: { kind: 'bed', own: true } }),
  lounge: (w, opts) => ({ type: 'sleep', opts: opts.lounge }),
  sulk: () => ({ type: 'idle', opts: { sulk: true } }),
  treat: w => ({ type: 'eat', opts: { from: 'treat', treat: w.treats[0] } }),
  eat: () => ({ type: 'eat', opts: { from: 'bowl' } }),
  shelter: () => ({ type: 'sleep', opts: { spot: 'house', reason: 'rain' } }),
  stashvisit: () => ({ type: 'stash', opts: { visit: true } }),
};

// returns { type, opts } or null to keep the current act
export function decide(w, cur) {
  const x = situation(w), c = x.c, n = x.n, S = {};
  for (const a of ACTIVITIES) {
    if (a.prep) a.prep(x);
    const s = a.when && !a.when(x) ? 0 : a.score(x);
    S[a.key] = s;
    if (a.then) a.then(x, s);
  }

  if (isUpset(w)) {
    const u = upsetLevel(w);
    for (const key in UPSET) S[key] *= UPSET[key];
    S.sulk = x.deepNight ? 0 : 0.45 + u * 0.55 + x.N();
  }

  // the mood of the day tilts what it fancies; a habit pulls at its hour; a stubborn notion pulls hard (but hunger and sleep still win)
  const upset = isUpset(w), mm = upset ? {} : moodToday(w).mul, calm = n.hunger < 0.8 && n.tired < TOO_TIRED && !upset; // (an upset cat sulks: no mood of the day, no notions)
  for (const key in S) if (S[key] > 0) { if (mm[key]) S[key] *= mm[key]; if (calm) S[key] += habitPull(w, key) + stubPull(w, key) + intentPull(w, key) + projectPull(w, key); }

  // what has felt good before pulls a little (see feelings.js), and the things it loves most pull hardest
  for (const key in SCORE_KEY) if (S[key] > 0) S[key] += affinity(w, SCORE_KEY[key]) * 0.25 + (isFav(w, SCORE_KEY[key]) ? FAV_PULL : 0);

  // a little stickiness, so it does not flit between two close options
  const ca = c.act, curKey = currentKey(cur, ca);
  if (curKey && S[curKey] !== undefined) S[curKey] += (ca && (ca.own || ca.lounge) && cur === ca.type ? 0.6 : 0.3);
  w.scoreSnap = S; // (what it could do right now, for the whims and intents that choose among them)
  let best = 'idle', bs = -1; for (const key in S) if (S[key] > bs) { bs = S[key]; best = key; }
  if (curKey && best === curKey) return null;
  return AS_ACT[best] ? AS_ACT[best](w, x.opts) : { type: best, opts: x.opts[best] || {} };
}
