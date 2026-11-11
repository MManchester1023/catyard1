// Deciding what to do next: needs, personality, wants and curiosity all pull on the choice.
import { rnd, clamp, dist } from './util.js';
import { hourOf, sunOf, moonPos, moonLight, beamOf } from './world.js';
import { bestItem, itemValue } from './quirk.js';
import { wantPull } from './wants.js';
import { pendingOffer } from './offerings.js';
import { canUseTablet, lookupWant } from './tablet.js';
import { gatherNeed, nextCraft } from './craft.js';
import { affinity } from './feelings.js';
import { wishPending } from './wishes.js';

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
  opts.forEach(o => (o[1] += rnd(0, 0.25)));
  opts.sort((a, b) => b[1] - a[1]); return opts[0][0];
}

// returns { type, opts } or null to keep the current act
export function decide(w, cur) {
  const c = w.cat, n = c.needs, o = w.o, h = hourOf(w), sun = sunOf(h), night = 1 - sun, rain = w.weather.rain, k = c.mem.known, q = c.quirk, T = c.traits;
  const deepNight = h >= 23 || h < 4.6 ? 1 : 0, dusk = (h > 5 && h < 8.5) || (h > 16.5 && h < 20.5) ? 1 : 0;
  const unk = unknownPlaces(w), S = {}, N = () => rnd(0, 0.1), opts = {};
  const dry = rain < 0.4;
  S.idle = 0.2 + T.lazy * 0.22 + N();
  S.explore = (0.1 + T.curious * 0.38) * (1 - T.lazy * 0.35) * (1 - night * 0.7) * (unk.length ? 1.5 : 1) + N();
  S.eat = o.bowl.food > 0.02 && n.hunger > 0.35 ? (n.hunger - 0.15) * 2.1 + N() : 0;
  S.drink = n.thirst > 0.35 ? (n.thirst - 0.2) * 1.9 + N() : 0;
  S.groom = (c.groomNext ? 0.9 : 0) + (n.dirty > 0.45 ? (n.dirty - 0.3) * 1.5 : 0);
  S.sleep = (n.tired > 0.55 ? (n.tired - 0.4) * 2 + T.lazy * 0.2 : 0) + deepNight * (1.1 + n.tired * 0.3) + night * 0.12 + N();
  S.play = n.fun > 0.3 ? (n.fun - 0.15) * 1.7 * (0.65 + T.curious * 0.5) * (1 - night * 0.8) * (rain > 0.3 ? 0.3 : 1) + N() : 0;
  const prey = w.mice.filter(m => !m.dead && m.state !== 'flee').concat(w.birds.filter(b => b.state === 'ground' && b.alert < 0.5));
  let target = null, td = 300; prey.forEach(p => { const d = dist(c, p); if (d < td) { td = d; target = p; } });
  S.hunt = target && c.huntCool <= 0 && n.tired < 0.85 && !c.hidden ? (0.3 + T.bold * 0.5 + (n.hunger > 0.5 ? 0.5 : 0) + dusk * 0.2 - (target.kind === 'bird' ? 0.25 : 0)) * (1 - deepNight * 0.4) + N() : 0;
  if (target) opts.hunt = { prey: target };
  S.perch = (k.tree || k.fence) && n.fun > 0.25 && rain < 0.2 && sun > 0.3 && n.tired < 0.8 ? (0.22 + T.bold * 0.32) * (w.birds.some(b => b.state === 'perch' || b.state === 'ground') ? 1.5 : 1) + N() : 0;
  S.shelter = rain > 0.3 && !c.hidden ? n.wet * 1.7 + rain * 0.5 * (1 - T.bold * 0.6) : 0;
  S.beg = o.bowl.food < 0.02 && n.hunger > 0.5 && w.clock - c.begAt > 70 * 1 && (!deepNight || n.hunger > 0.8) ? 0.85 + N() : 0;
  S.treat = w.treats.length ? 0.8 + n.hunger * 0.6 + T.curious * 0.3 : 0;
  S.zoom = n.tired < 0.45 && n.fun > 0.45 && (dusk || night > 0.5) && !deepNight && rain < 0.3 && w.clock - c.zoomAt > w.dayLen * 0.5 ? 0.95 + N() : 0;

  // ----- what makes this cat this cat -----
  const it = dry ? bestItem(w, c) : null;
  if (it) { S.collect = (0.5 + itemValue(w, it) * 0.45 + wantPull(w, ['find']) * 0.5 + T.curious * 0.15) * (1 - deepNight * 0.7); opts.collect = { item: it }; } else S.collect = 0;
  const since = (w.clock - (q.lastVisit || 0)) / w.dayLen;
  S.stashvisit = w.stash.site && !deepNight && dry ? clamp((since - 0.12) * 2.2, 0, 0.95) + wantPull(w, ['guard']) * 0.9 + (n.fear || 0) * 0.7 + N() : 0;
  S.paint = n.create > 0.4 && sun > 0.15 && dry && n.tired < 0.85 && !deepNight ? (n.create - 0.25) * 1.9 + wantPull(w, ['master']) * 0.6 + T.curious * 0.1 + N() : 0;
  const mp = moonPos(w), m = w.mysteries.moon;
  S.gaze = mp && moonLight(w) > 0.12 && w.weather.cloud < 0.7 && rain < 0.3 && n.hunger < 0.85 && n.tired < 0.92 && !deepNight
    ? 0.28 + (1 - m.conf) * 0.4 + T.curious * 0.2 + (w.cat.wants.some(x => x.kind === 'solve' && x.mystery === 'moon') ? 0.7 : 0) + N() : 0;
  const ripple = w.clock - (w.rippleAt || -999) < 40 && !w.mysteries.ripples.solved, sparks = w.sparks.some(s => s.on) && !w.mysteries.sparks.solved;
  const wr = w.cat.wants.some(x => x.kind === 'solve' && x.mystery === 'ripples') ? 0.8 : 0, wsp = w.cat.wants.some(x => x.kind === 'solve' && x.mystery === 'sparks') ? 0.8 : 0;
  S.investigate = 0;
  if (dry && n.tired < 0.9) {
    const sr = ripple ? 0.8 + T.curious * 0.4 + wr : 0, ss = sparks ? 0.45 + T.curious * 0.4 + wsp : 0;
    if (sr || ss) { S.investigate = Math.max(sr, ss) + N(); opts.investigate = { kind: sr >= ss ? 'ripples' : 'sparks' }; }
  }
  const lon = n.lonely;
  S.attention = lon > 0.5 && w.clock - c.attAt > w.dayLen * 0.12 && !deepNight ? (lon - 0.3) * 1.5 + wantPull(w, ['attention']) * 0.7 + c.bond * 0.2 + N() : 0;

  const po = pendingOffer(w); S.offering = po && rain < 0.4 && !deepNight ? 1.05 + T.curious * 0.3 + c.bond * 0.25 + N() : 0; if (po) opts.offering = { offer: po };
  const lw = lookupWant(w); S.tablet = rain < 0.4 && !deepNight && n.tired < 0.85 && canUseTablet(w) ? 0.3 + T.curious * 0.45 + (lw ? lw.strength * 0.9 : 0) + (wishPending(w) ? 0.55 : 0) + (c.wants.some(x => x.kind === 'learn') ? 0.6 : 0) + dusk * 0.15 + N() : 0;

  // making things: scratch the oak for bark and twigs when a recipe needs them, then build
  const gn = dry && k.tree ? gatherNeed(w) : null;
  S.gather = gn && !deepNight && n.tired < 0.85 && n.hunger < 0.9 ? 0.36 + wantPull(w, ['craft']) * 0.55 + T.curious * 0.12 + N() : 0;
  const nc = dry ? nextCraft(w) : null;
  S.craft = nc && !deepNight && n.tired < 0.85 ? 0.78 + wantPull(w, ['craft']) * 0.5 + N() : 0; if (nc) opts.craft = { recipe: nc };

  // what has felt good before pulls a little (see feelings.js)
  for (const [key, id] of [['paint', 'act:paint'], ['tablet', 'act:tablet'], ['gaze', 'act:gaze'], ['perch', 'act:perch'], ['investigate', 'act:investigate'], ['craft', 'act:craft'], ['gather', 'act:tree'], ['stashvisit', 'act:stash']]) if (S[key] > 0) S[key] += affinity(w, id) * 0.25;

  const curKey = cur === 'play' && c.act && c.act.gather ? 'gather' : cur;
  if (curKey && S[curKey] !== undefined) S[curKey] += 0.3;
  let best = 'idle', bs = -1; for (const key in S) if (S[key] > bs) { bs = S[key]; best = key; }
  if (curKey && best === curKey) return null;
  switch (best) {
    case 'gather': return { type: 'play', opts: { kind: 'tree', gather: true } };
    case 'treat': return { type: 'eat', opts: { from: 'treat', treat: w.treats[0] } };
    case 'eat': return { type: 'eat', opts: { from: 'bowl' } };
    case 'shelter': return { type: 'sleep', opts: { spot: 'house', reason: 'rain' } };
    case 'stashvisit': return { type: 'stash', opts: { visit: true } };
    default: return { type: best, opts: opts[best] || {} };
  }
}
