// Deciding what to do next: needs, personality, wants and curiosity all pull on the choice.
import { rnd, clamp, dist } from './util.js';
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
import { interestActive } from './interest.js';
import { wishPending } from './wishes.js';
import { blogPending } from './blog.js';
import { deepNightOf } from './temper.js';
import { knows } from './recipes.js';
import { clueRoom, frogRoom, gatherRoom } from './pace.js';
import { darkSky, wishReady, starsNeedsReading } from './stars.js';
import { isUpset, upsetLevel } from './upset.js';
import { coinActive } from './secrets.js';

const FEATURES = ['pond', 'post', 'tree', 'flowers', 'cushion', 'yarn', 'fence', 'easel', 'tablet'];
export const unknownPlaces = w => FEATURES.filter(id => !w.cat.mem.known[id]);

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

// returns { type, opts } or null to keep the current act
export function decide(w, cur) {
  const c = w.cat, n = c.needs, o = w.o, h = hourOf(w), sun = sunOf(h), night = 1 - sun, rain = w.weather.rain, k = c.mem.known, q = c.quirk, T = c.traits;
  const deepNight = deepNightOf(c, h) ? 1 : 0, dusk = (h > 5 && h < 8.5) || (h > 16.5 && h < 20.5) ? 1 : 0;
  const owl = c.temper === 'nightowl', hunter = c.temper === 'hunter', vg = c.temper === 'vangogh', nd = owl ? 0.3 : 1; // quirks (temper.js)
  const gf = c.temper === 'garfield', tech = c.temper === 'techie', bob = c.temper === 'builder', col = c.temper === 'collector';
  const unk = unknownPlaces(w), S = {}, N = () => rnd(0, 0.1), opts = {};
  const dry = rain < 0.4;
  S.idle = 0.2 + T.lazy * 0.22 - (bob ? 0.1 : 0) + N();
  S.explore = (0.1 + T.curious * 0.38) * (1 - T.lazy * 0.35) * (1 - night * 0.7 * nd) * (unk.length ? 1.5 : 1) * (gf ? 0.55 : 1) * (bob ? 0.85 : 1) + N();
  S.eat = o.bowl.food > 0.02 && n.hunger > (gf ? 0.18 : 0.35) ? (n.hunger - (gf ? 0.02 : 0.15)) * 2.1 + N() : 0;
  S.drink = n.thirst > 0.35 ? (n.thirst - 0.2) * 1.9 + N() : 0;
  S.groom = (c.groomNext ? 0.9 : 0) + (n.dirty > 0.45 && n.dirty <= 0.58 ? (n.dirty - 0.3) * 1.5 : 0);
  // a proper wash when it is properly dirty: to the water, a good scrub, then drying off in the sun if there is some
  S.wash = (n.dirty > 0.58 || (n.wet > 0.5 && rain < 0.3)) && w.clock - (c.washAt || -1e9) > w.dayLen * 0.15 && !deepNight ? 0.7 + (n.dirty - 0.5) * 1.6 + N() : 0;
  S.sleep = (n.tired > 0.55 ? (n.tired - 0.4) * 2 + T.lazy * 0.2 : 0) + deepNight * (1.1 + n.tired * 0.3) + night * 0.12 + (gf && n.hunger < 0.55 && rain < 0.4 ? 0.42 + T.lazy * 0.3 : 0) + N(); // (Garfield lies around)
  S.play = n.fun > 0.3 ? (n.fun - 0.15) * 1.7 * (0.65 + T.curious * 0.5) * (1 - night * 0.8 * nd) * (rain > 0.3 ? 0.3 : 1) * (gf ? 0.4 : bob ? 0.8 : 1) + N() : 0;
  const prey = w.mice.filter(m => !m.dead && m.state !== 'flee').concat(w.birds.filter(b => b.state === 'ground' && b.alert < 0.5));
  let target = null, td = hunter ? 560 : 300; prey.forEach(p => { const d = dist(c, p); if (d < td) { td = d; target = p; } });
  S.hunt = target && c.huntCool <= 0 && n.tired < (hunter ? 0.93 : 0.85) && !c.hidden ? (hunter ? 1.25 + T.bold * 0.2 + (n.hunger > 0.5 ? 0.25 : 0) : 0.3 + T.bold * 0.5 + (n.hunger > 0.5 ? 0.5 : 0) + dusk * 0.2 - (target.kind === 'bird' ? 0.25 : 0)) * (1 - deepNight * 0.4) * (gf ? 0.6 : 1) + wantPull(w, ['catch']) * 0.45 + N() : 0;
  if (target) opts.hunt = { prey: target };
  S.perch = (k.tree || k.fence) && n.fun > 0.25 && rain < 0.2 && sun > 0.3 && n.tired < 0.8 ? (0.22 + T.bold * 0.32) * (w.birds.some(b => b.state === 'perch' || b.state === 'ground') ? 1.5 : 1) + N() : 0;
  S.shelter = rain > 0.3 && !c.hidden ? n.wet * 1.7 + rain * 0.5 * (1 - T.bold * 0.6) : 0;
  S.beg = o.bowl.food < 0.02 && n.hunger > (gf ? 0.32 : 0.5) && w.clock - c.begAt > 70 * 1 && (!deepNight || n.hunger > 0.8) ? 0.85 + N() : 0;
  S.treat = w.treats.length ? 0.8 + n.hunger * 0.6 + T.curious * 0.3 + (gf ? 0.4 : 0) : 0;
  S.zoom = n.tired < 0.45 && n.fun > 0.45 && (dusk || night > 0.5) && !deepNight && rain < 0.3 && w.clock - c.zoomAt > w.dayLen * 0.5 ? 0.95 + N() : 0;

  // ----- what makes this cat this cat -----
  const it = dry ? bestItem(w, c) : null;
  if (it) { S.collect = (0.5 + itemValue(w, it) * 0.45 + wantPull(w, ['find']) * 0.5 + T.curious * 0.15) * (1 - deepNight * 0.7) * (col || it.type === 'twine' || it.moon ? 1 : 0.3); opts.collect = { item: it }; } else S.collect = 0; // only a Collector goes out of its way for things
  const since = (w.clock - (q.lastVisit || 0)) / w.dayLen;
  S.stashvisit = w.stash.site && !deepNight && dry ? clamp((since - 0.12) * 2.2, 0, 0.95) * (col ? 1 : 0.4) + wantPull(w, ['guard']) * 0.9 + (n.fear || 0) * 0.7 * (col ? 1 : 0.5) + N() : 0;
  S.paint = n.create > (vg ? 0.25 : 0.4) && sun > 0.15 && dry && n.tired < (vg ? 0.93 : 0.85) && !deepNight ? (vg ? (n.create - 0.1) * 2 + 0.2 : (n.create - 0.25) * 1.9) + wantPull(w, ['master']) * 0.6 + T.curious * 0.1 + N() : 0;
  if (gf) S.paint *= 0.45;
  const mp = moonPos(w), m = w.mysteries.moon, sm = w.mysteries.stars, skyOk = w.weather.cloud < 0.7 && rain < 0.3 && n.hunger < 0.85 && n.tired < 0.92 && !deepNight;
  const gMoon = mp && moonLight(w) > 0.12 && skyOk ? 0.28 + (1 - m.conf) * 0.4 + T.curious * 0.2 + (w.cat.wants.some(x => x.kind === 'solve' && x.mystery === 'moon') ? 0.7 : 0) + N() : 0;
  // once it is wondering about the stars (or knows what they are, and hopes one will fall) it looks at those instead, on any clear night; and a moonless night has nothing else to look at
  const gStars = (sm.interest || sm.solved) && darkSky(w) && skyOk && (sm.solved || (clueRoom(w, 'stars') && !sm.enough))
    ? 0.3 + (sm.solved ? 0.1 + (wishReady(w) ? 0.3 : 0) : (1 - sm.conf) * 0.35) + T.curious * 0.2 + (w.cat.wants.some(x => x.kind === 'solve' && x.mystery === 'stars') ? 0.7 : 0) + N() : 0;
  S.gaze = Math.max(gMoon, gStars * (gMoon && !m.solved ? 0.75 : 1));
  if (gStars * (gMoon && !m.solved ? 0.75 : 1) > gMoon) opts.gaze = { stars: true };
  const ripple = w.clock - (w.rippleAt || -999) < 40 && !w.mysteries.ripples.solved && frogRoom(w) && w.clock - (c.ripAt || -1e9) > w.dayLen * 0.1, sparks = w.sparks.some(s => s.on) && !w.mysteries.sparks.solved && clueRoom(w, 'sparks');
  const wr = w.cat.wants.some(x => x.kind === 'solve' && x.mystery === 'ripples') ? 0.8 : 0, wsp = w.cat.wants.some(x => x.kind === 'solve' && x.mystery === 'sparks') ? 0.8 : 0;
  S.investigate = 0;
  if (dry && n.tired < 0.9) {
    const sr = ripple ? 0.8 + T.curious * 0.4 + wr : 0, ss = sparks ? 0.45 + T.curious * 0.4 + wsp : 0;
    // a very curious cat that has started wondering about the oak goes back to sniff at its roots, a little each day
    const mt = w.mysteries.tree, st = mt.interest && !mt.solved && k.tree && sun > 0.3 && clueRoom(w, 'tree') && w.clock - (c.oakAt || -1e9) > w.dayLen * 0.07 ? 0.55 + T.curious * 0.35 + (c.wants.some(x => x.kind === 'solve' && x.mystery === 'tree') ? 0.6 : 0) : 0;
    if (sr || ss || st) { S.investigate = (Math.max(sr, ss, st) + N()) * (tech ? 0.6 : 1); opts.investigate = { kind: st >= sr && st >= ss ? 'tree' : sr >= ss ? 'ripples' : 'sparks' }; }
  }
  // the wind chime: sit and listen, which takes the edge off being bored
  S.listen = w.deco && w.deco.chime && dry && n.fun > 0.3 && !deepNight && n.tired < 0.85 && w.clock - (c.listenAt || -1e9) > w.dayLen * 0.12 ? 0.24 + (n.fun - 0.3) * 1.5 + T.lazy * 0.15 + (n.fear > 0.3 ? 0.25 : 0) + N() : 0;
  // a fish in the pond
  S.fish = w.fish && !w.fish.spooked && k.pond && dry && !c.hidden && n.tired < 0.9 && !deepNight && w.clock - (c.fishAt || -1e9) > w.dayLen * 0.3 ? (0.2 + n.hunger * 0.9 + T.bold * 0.15 + (hunter ? 0.45 : 0) + (gf ? 0.3 : 0)) * (1 - T.lazy * 0.2) + N() : 0;
  const lon = n.lonely, fg = w.frog;
  S.frog = fg && fg.out && rain < 0.5 && !c.hidden && n.tired < 0.92 && w.clock - fg.lastVisit > w.dayLen * 0.1 ? 0.12 + Math.max(0, lon - 0.2) * 2.3 + fg.bond * 0.3 + N() : 0;
  S.attention = lon > 0.68 && w.clock - c.attAt > w.dayLen * 0.4 && !deepNight ? (lon - 0.5) * 1.3 + wantPull(w, ['attention']) * 0.6 + c.bond * 0.12 + N() : 0; // (the glass is a last resort now: rarer, and only when really lonely)

  const po = pendingOffer(w); S.offering = po && rain < 0.4 && !deepNight ? 1.05 + T.curious * 0.3 + c.bond * 0.25 + Math.min(0.9, Math.max(0, w.clock - po.at - 15) * 0.012) + N() : 0; if (po) opts.offering = { offer: po }; // (a gift left waiting gets harder to ignore: a cat with a long mystery on its mind would otherwise walk past it for minutes)
  const lw = lookupWant(w); S.tablet = rain < 0.4 && !deepNight && n.tired < 0.85 && canUseTablet(w) ? 0.3 + T.curious * 0.45 + (lw ? lw.strength * 0.9 : 0) + (wishPending(w) ? 0.55 : 0) + (interestActive(w) ? 0.4 : 0) + (blogPending(w) ? 0.6 : 0) + (starsNeedsReading(w) ? 0.6 : 0) + (c.wants.some(x => x.kind === 'learn') ? 0.6 : 0) + dusk * 0.15 + (tech ? (c.wants.some(x => x.kind === 'learn' || x.kind === 'lookup' || x.kind === 'solve') || wishPending(w) ? 1.7 : 0.4) : 0) + N() : 0; // (the Techie goes to the tablet first when it is stuck)

  // making things: scratch the oak for bark and twigs when a recipe needs them, then build
  const gn = dry && k.tree && gatherRoom(w) ? gatherNeed(w) : null;
  S.gather = gn && !deepNight && n.tired < 0.85 && n.hunger < 0.9 ? 0.36 + wantPull(w, ['craft']) * 0.55 + T.curious * 0.12 + (bob ? 0.3 : 0) + N() : 0;
  const nc = dry ? nextCraft(w) : null;
  S.craft = nc && !deepNight && n.tired < 0.85 ? 0.78 + wantPull(w, ['craft']) * 0.5 + (bob ? 0.35 : 0) + N() : 0; if (nc) opts.craft = { recipe: nc };

  // behind the cabin: it has wondered what is back there. Once there is a cat tree, it likes to sit in it
  S.peek = c.peekUrge && !w.catTree && dry && !deepNight && n.tired < 0.88 && !c.hidden ? 1.25 + N() : 0;
  const since3 = (w.clock - (c.catTreeAt || -1e9)) / w.dayLen, fresh = w.catTree && !c.catTreeAt ? 0.9 : 0; // (the first time it wants to try it out straight away)
  S.cattree = w.catTree && dry && !deepNight && n.tired < 0.9 && !c.hidden && since3 > 0.12 ? 0.2 + T.lazy * 0.25 + T.bold * 0.2 + (n.fear > 0.3 ? 0.25 : 0) + (gf ? 0.25 : 0) + fresh + (coinActive(w) ? 0.1 : 0) + N() : 0;
  // the yard furniture each gets used for its own reasons, rather than only when a play session happens to pick it
  const clawSince = (w.clock - (c.postAt || 0)) / w.dayLen, loungeSince = (w.clock - (c.loungeAt || -1e9)) / w.dayLen;
  S.post = k.post && dry && !deepNight && n.tired < 0.85 && !c.hidden ? clamp((clawSince - 0.07) * 2.4, 0, 0.95) + T.bold * 0.1 + (hunter ? 0.12 : 0) + N() : 0; // claws need doing every so often
  S.yarn = k.yarn && dry && !deepNight && n.fun > 0.14 && n.tired < 0.8 && !c.hidden ? (0.2 + (n.fun - 0.12) * 1.7) * (0.7 + T.curious * 0.5) * (gf ? 0.4 : bob ? 0.8 : 1) * (1 - night * 0.6 * nd) + N() : 0;
  const bm = beamOf(w), spots = []; if (bm.on && k.beam) spots.push('beam'); if (k.cushion) spots.push('cushion');
  S.lounge = spots.length && dry && !deepNight && !c.hidden && n.tired > 0.16 && n.tired < 0.9 && loungeSince > 0.1 ? 0.14 + (n.tired - 0.15) * 0.9 + T.lazy * 0.35 + (gf ? 0.4 : 0) + (bm.on && k.beam ? 0.14 : 0) - (vg || bob ? 0.1 : 0) + N() : 0;
  if (S.lounge) { const nap = c.mem.nap; const sp = spots.map(s => [s, (s === 'beam' ? 1 : 0.7) + (nap[s] || 0) * 0.04 + rnd(0, 0.4) + placeLove(w, s) * 0.3]).sort((a, b) => b[1] - a[1])[0][0]; opts.lounge = { spot: sp, lounge: true }; }
  // once it knows the cushion has string in it, it pulls at it when a recipe needs some
  S.stringbed = k.cushion && dry && !deepNight && n.tired < 0.85 && n.hunger < 0.9 && stringWanted(w) && bedRoom(w) ? 0.62 + wantPull(w, ['craft']) * 0.5 + (bob ? 0.3 : 0) + T.curious * 0.1 + N() : 0;

  // an upset cat will not sit at the glass or play along, and mostly sulks
  if (isUpset(w)) {
    const u = upsetLevel(w);
    S.attention *= 0.15; S.offering *= 0.6; S.play *= 0.6; S.tablet *= 0.7; S.paint *= 0.8; S.frog *= 1.2;
    S.sulk = deepNight ? 0 : 0.45 + u * 0.55 + N();
  }

  // the mood of the day tilts what it fancies; a habit pulls at its hour; a stubborn notion pulls hard (but hunger and sleep still win)
  const upset = isUpset(w), mm = upset ? {} : moodToday(w).mul, calm = n.hunger < 0.8 && n.tired < 0.85 && !upset; // (an upset cat sulks: no mood of the day, no notions)
  for (const key in S) if (S[key] > 0) { if (mm[key]) S[key] *= mm[key]; if (calm) S[key] += habitPull(w, key) + stubPull(w, key) + intentPull(w, key); }

  // what has felt good before pulls a little (see feelings.js)
  for (const key in SCORE_KEY) if (S[key] > 0) S[key] += affinity(w, SCORE_KEY[key]) * 0.25 + (isFav(w, SCORE_KEY[key]) ? FAV_PULL : 0); // (and the things it loves most pull hardest)

  const ca = c.act, curKey = cur === 'idle' && ca && ca.sulk ? 'sulk' : cur === 'investigate' && ca && ca.kind === 'tree' ? 'investigate' : cur === 'play' && ca && ca.gather ? 'gather' : cur === 'play' && ca && ca.own ? (ca.kind === 'bed' ? 'stringbed' : ca.kind) : cur === 'sleep' && ca && ca.lounge ? 'lounge' : cur;
  if (curKey && S[curKey] !== undefined) S[curKey] += (ca && (ca.own || ca.lounge) && cur === ca.type ? 0.6 : 0.3);
  w.scoreSnap = S; // (what it could do right now, for the whims and intents that choose among them)
  let best = 'idle', bs = -1; for (const key in S) if (S[key] > bs) { bs = S[key]; best = key; }
  if (curKey && best === curKey) return null;
  switch (best) {
    case 'gather': return { type: 'play', opts: { kind: 'tree', gather: true } };
    case 'post': return { type: 'play', opts: { kind: 'post', own: true } };
    case 'yarn': return { type: 'play', opts: { kind: 'yarn', own: true } };
    case 'stringbed': return { type: 'play', opts: { kind: 'bed', own: true } };
    case 'lounge': return { type: 'sleep', opts: opts.lounge };
    case 'sulk': return { type: 'idle', opts: { sulk: true } };
    case 'treat': return { type: 'eat', opts: { from: 'treat', treat: w.treats[0] } };
    case 'eat': return { type: 'eat', opts: { from: 'bowl' } };
    case 'shelter': return { type: 'sleep', opts: { spot: 'house', reason: 'rain' } };
    case 'stashvisit': return { type: 'stash', opts: { visit: true } };
    default: return { type: best, opts: opts[best] || {} };
  }
}
