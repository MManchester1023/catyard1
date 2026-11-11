// The whole simulation: build a world, advance it, fast-forward it.
import { W, GY0, GY1, rnd, ri, clamp, pick, NAMES, COATS, COAT_LABEL } from './util.js';
import { makeObjects, dropFromBird, fishTick, hourOf, dayOf, sunOf, isNight, beamOf, note, journal, dayRec, pushHist, weatherTick, makeBird, birdTick, mouseTick, spawnMouse, makeFly, flyTick, makeSpark, sparkTick, spawnItem, blocked, randomOpenPoint } from './world.js';
import { makeQuirk, stealFromStash, quirkWord } from './quirk.js';
import { makeMysteries, rippleTick, MYSTERY_INFO } from './mysteries.js';
import { makeArt, levelOf, LEVEL_NAMES } from './art.js';
import { genWants, wantsTick } from './wants.js';
import { start, actTick, reconsider, INTERRUPT, think, describe } from './acts.js';
import { thoughtFor } from './thoughts.js';
import { makeTastes, ensureOfferState, offerTick, refreshFavourites } from './offerings.js';
import { ensureFeel } from './feelings.js';
import { ensureMemory, memoryTick } from './memory.js';
import { ensureFinds, favTick, favShift, foundPlace } from './finds.js';
import { ensureChar, characterTick } from './character.js';
import { ensureIntent, intentTick } from './intent.js';
import { ensureInterest, interestTick } from './interest.js';
import { considerWish, wishTick } from './wishes.js';
import { isUpset, upsetLevel, upsetTick } from './upset.js';
import { secretsRoll, moonWishTick, coinActive } from './secrets.js';
import { meteorTick } from './stars.js';
import { selfTaught, hangSpareFrames } from './craft.js';
import { makeTemper } from './temper.js';
import { frogTick } from './frog.js';
import { discoverRadius, placeCap } from './pace.js';
import { ensureTablet } from './tablet.js';
import { ensureBlog, considerBlog } from './blog.js';
import { makeRng, useRng, nextSeed } from './rng.js';

export { describe };
export const VERSION = 3;

export function makeCat(name) {
  const quirk = makeQuirk();
  return {
    name: name || pick(NAMES), coat: pick(COATS), age: ri(1, 9),
    traits: { curious: rnd(0.2, 1), bold: rnd(0.15, 1), affection: rnd(0.2, 1), lazy: rnd(0.1, 0.8) }, skill: rnd(0.35, 0.8),
    x: 150, y: 304, z: 0, face: 1, pose: 'sit', legT: 0, hidden: false, pu: 0, wig: false,
    needs: { hunger: 0.4, thirst: 0.3, tired: 0.1, fun: 0.35, dirty: 0.3, wet: 0, lonely: 0.25, create: 0.35, fear: 0 },
    mood: { joy: 0.45 }, act: null, thought: '', thoughtId: 0, thoughtAt: -99, thoughtHint: null,
    reeval: 1, carry: null, huntCool: 0, begAt: -999, zoomAt: -999, attAt: -999, groomNext: false, bond: 0.2, words: {}, wants: [], doneWants: 0,
    inv: { bark: 0, twig: 0, twine: 0 }, recipes: {}, crafted: [], wishes: [], lastWishAt: -999, assoc: {}, lastTasteSay: -999,
    quirk, temper: makeTemper(), quirkV: 2, tastes: makeTastes(quirk), keepsakes: [], offerHist: [], art: makeArt(), mem: { known: { house: 1, bowl: 1, water: 1 }, nap: {}, lastMeal: null, caught: 0, missed: 0 },
  };
}

// opt.seed fixes the dice: the same seed gives the same cat and, stepped the same way, the same life (see rng.js)
export function makeWorld(name, opt = {}) {
  const rng = makeRng(opt.seed != null ? opt.seed : nextSeed()); useRng(rng); // (before anything is rolled)
  const dayLen = 1200;
  const w = {
    rng,
    v: VERSION, clock: (6.3 / 24) * dayLen, dayLen, speed: 1, paused: false,
    log: [], logId: 0, journal: [], chat: [], asks: [], pending: [], onNote: null,
    weather: { type: 'clear', rain: 0, cloud: 0.15, timer: rnd(160, 300), forced: null },
    o: makeObjects(), mice: [], birds: [], flies: [], sparks: [], treats: [], items: [], offers: [], tablet: null, netq: [], netOn: false,
    table: null, deco: {}, hist: [], days: {}, lastThoughtId: 0, lastDid: null, frog: null, pace: 1, catTree: null, moonWishDay: -99, starWishDay: -99, meteor: null, meteorPlan: null,
    stash: { site: null, items: [], seed: 1, known: null }, easel: null, easelMade: null, ripple: null, rippleT: rnd(50, 100), thief: null, thiefT: dayLen * rnd(2, 4),
    mysteries: makeMysteries(), fed: 0, mouseT: rnd(30, 70), itemT: rnd(20, 50), wantT: 30, createdAt: Date.now(),
    stats: { meals: 0, naps: 0, mice: 0, misses: 0, treats: 0, zoomies: 0, gifts: 0, scratch: 0, collected: 0, found: 0, paintings: 0, wants: 0, offerings: 0, crafted: 0, gathered: 0, wishes: 0, birds: 0, frogVisits: 0, fish: 0 },
  };
  w.cat = makeCat(name); ensureOfferState(w); ensureTablet(w); ensureBlog(w); ensureFeel(w.cat); ensureMemory(w.cat); ensureFinds(w.cat); ensureChar(w.cat); ensureIntent(w.cat); ensureInterest(w.cat);
  for (let i = 0; i < 3; i++) w.birds.push(makeBird(i));
  for (let i = 0; i < 3; i++) w.flies.push(makeFly(i));
  for (let i = 0; i < 7; i++) w.sparks.push(makeSpark(i));
  spawnItem(w, w.cat.quirk.item); spawnItem(w, w.cat.quirk.item); spawnItem(w);
  const c = w.cat;
  note(w, `${c.name}, a ${c.age}-year-old ${COAT_LABEL[c.coat]}, has the run of the yard.`, 'info');
  journal(w, `I live here. There is a cabin, a pond, an oak and a lot of things I do not understand yet.`, 'start');
  start(w, 'idle');
  return w;
}

const PLACES = ['pond', 'post', 'tree', 'flowers', 'cushion', 'yarn', 'fence', 'easel', 'tablet'];
function discover(w, id, text) {
  const k = w.cat.mem.known; if (k[id]) return; k[id] = 1; foundPlace(w, id);
  const names = { pond: 'the pond', post: 'the scratching post', tree: 'the old oak', flowers: 'the flower bed', cushion: 'the cushion', yarn: 'the ball of yarn', fence: 'the fence', easel: 'an easel with a blank canvas', tablet: 'a glowing slab on a stump', beam: 'a warm patch of sunlight' };
  note(w, text || `${w.cat.name} discovered ${names[id]}.`, 'discover');
  if (id === 'tablet') journal(w, 'There is a flat glowing slab on a stump. It shows things from somewhere else. I must sit with it.', 'tablet');
  if (id === 'easel') { journal(w, 'There is a canvas on a stand. My paws are already twitching.', 'art'); w.cat.needs.create = Math.max(w.cat.needs.create, 0.6); }
}

function noticeThought(w) {
  const c = w.cat, h = c.thoughtHint; if (!h) return;
  if (w.clock - c.thoughtAt < 3) return;
  c.thoughtHint = null;
  const [kind, id] = h.split(':');
  if ((kind === 'theory' || kind === 'solved') && w.mysteries[id] && w.mysteries[id].theory) c.thought = w.mysteries[id].theory;
  else c.thought = thoughtFor(w, kind);
  c.thoughtId++; c.thoughtAt = w.clock;
}

export function tick(w, dt) {
  useRng(w.rng); // (this world's dice, whichever world was stepped last)
  w.clock += dt;
  const c = w.cat, n = c.needs, o = w.o, h = hourOf(w), bm = beamOf(w), dayDt = dt / w.dayLen;
  weatherTick(w, dt);
  const fed = Math.floor((w.clock - (7 / 24) * w.dayLen) / w.dayLen) + Math.floor((w.clock - (17.5 / 24) * w.dayLen) / w.dayLen) + 2;
  if (fed > w.fed) { w.fed = fed; o.bowl.food = 1; note(w, 'Someone refilled the food bowl.', 'food'); }

  // needs
  const asleep = c.pose === 'sleep' || c.pose === 'inside';
  n.hunger = clamp(n.hunger + dt / 380 * (asleep ? 0.45 : 1) * (c.temper === 'garfield' ? 1.3 : 1));
  n.thirst = clamp(n.thirst + dt / 560 * (asleep ? 0.4 : 1));
  n.tired = clamp(n.tired + (asleep ? -dt / 220 : (dt / 1500) * (c.act.type === 'zoom' ? 3 : 1)));
  n.fun = clamp(n.fun + dt / 380 * (asleep ? 0.2 : 1) * (c.temper === 'garfield' ? 1.6 : 1)); // (Garfield is bored sooner)
  n.dirty = clamp(n.dirty + dt / 1100);
  n.lonely = clamp(n.lonely + dayDt / 1.5 * (0.7 + c.bond * 0.8) * (asleep ? 0.3 : 1));
  n.create = clamp(n.create + dayDt / 1.0 * (asleep ? 0.2 : 1) * (c.temper === 'vangogh' ? 1.5 : 1));
  if (c.temper === 'vangogh' && n.create > 0.85 && !asleep) c.mood.joy = clamp(c.mood.joy - dt * 0.0015); // it is miserable when it cannot paint
  n.fear = clamp(n.fear - dayDt * 0.15);
  c.mood.joy = clamp(c.mood.joy + ((coinActive(w) ? 0.95 : isUpset(w) ? 0.4 - 0.3 * upsetLevel(w) : 0.4) - c.mood.joy) * Math.min(1, dt * 0.02)); // (an upset cat sits lower for a while)
  if (!c.hidden && w.weather.rain > 0.3) n.wet = clamp(n.wet + w.weather.rain * 0.035 * dt * (c.z > 0 ? 0.5 : 1));
  else if (w.weather.rain < 0.2) n.wet = clamp(n.wet - (c.hidden ? 0.04 : bm.on && Math.hypot(c.x - bm.x, c.y - bm.y) < 50 ? 0.03 : 0.012) * dt);

  // senses
  if (!c.hidden) {
    const dd = dayOf(w); if (c.mem.dDay !== dd) { c.mem.dDay = dd; c.mem.dToday = 0; }
    for (const id of PLACES) { // pace.js: only so much of the yard sinks in per day (a techie's tablet does not use up the day's share)
      const techTablet = id === 'tablet' && c.temper === 'techie';
      if ((c.mem.dToday < placeCap(w) || techTablet) && !c.mem.known[id] && (id !== 'easel' || w.easelMade) && Math.hypot(c.x - o[id].x, c.y - o[id].y) < discoverRadius(w)) { discover(w, id); if (!techTablet) c.mem.dToday++; }
    }
    if (bm.on && !c.mem.known.beam && Math.hypot(c.x - bm.x, c.y - bm.y) < 55) discover(w, 'beam', `${c.name} found a warm patch of sunlight.`);
  }

  // the yard
  c.huntCool = Math.max(0, c.huntCool - dt);
  w.mouseT -= dt;
  const hunter = c.temper === 'hunter'; // there is more to hunt where a Hunter lives
  if (w.mouseT <= 0) { if (w.mice.length < (hunter ? 2 : 1) && w.weather.rain < 0.3) spawnMouse(w); w.mouseT = rnd(60, 150) / ((h > 16.5 && h < 21) || (h > 4.5 && h < 8) ? 1.6 : 1) / (hunter ? 1.7 : 1); }
  w.mice.forEach(m => mouseTick(w, m, dt)); w.mice = w.mice.filter(m => !m.gone && !m.dead);
  w.birds.forEach(b => birdTick(w, b, dt)); w.flies.forEach(f => flyTick(w, f, dt)); w.sparks.forEach(s => sparkTick(w, s, dt));
  rippleTick(w, dt, h, isNight(w)); frogTick(w, dt); fishTick(w, dt);
  // the first time it is awake in the yard when the sparks are out, it sees them (and only then can it want to catch one)
  { const sp = w.mysteries.sparks; if (!sp.seen && w.sparks.some(s => s.on) && c.pose !== 'sleep' && c.pose !== 'inside' && !c.hidden) { sp.seen = true; note(w, `${c.name} noticed tiny lights dancing along the fence.`, 'mystery'); journal(w, 'There are lights by the fence. Small ones. They move when I look at them, and when I do not look at them, and they have never once explained themselves.', 'mystery'); c.thoughtHint = 'sawSparks'; } }
  // a feeder fills the yard with birds. Things no longer turn up at random: birds leave them (world.js dropFromBird)
  if (w.deco && w.deco.feeder && w.birds.length < 5) w.birds.push(makeBird(w.birds.length));
  // what the cat has been wanting to find is brought by a bird (or, if no bird comes, simply turns up in the end)
  for (const p of [...w.pending]) if (w.clock >= p.at) {
    const b = w.birds.find(x => x.state === 'away' && !x.gift);
    if (b && w.weather.rain < 0.4 && sunOf(h) > 0.25) { b.gift = { type: p.type, color: p.color }; b.timer = 0; w.pending.splice(w.pending.indexOf(p), 1); }
    else if (w.clock - p.at > w.dayLen * 0.6) { spawnItem(w, p.type, p.color); w.pending.splice(w.pending.indexOf(p), 1); }
  }
  w.items.forEach(i => (i.age += dt)); w.items = w.items.filter(i => i.age < w.dayLen * 1.5);
  const y = o.yarn;
  if (Math.abs(y.vx) + Math.abs(y.vy) > 1) {
    const nx = clamp(y.x + y.vx * dt, 20, W - 20), ny = clamp(y.y + y.vy * dt, GY0 + 30, GY1 - 6);
    if (blocked(w, nx, ny)) { y.vx *= -0.4; y.vy *= -0.4; } else { y.x = nx; y.y = ny; }
    const f = Math.pow(0.04, dt); y.vx *= f; y.vy *= f;
  }
  w.treats.forEach(t => (t.age += dt)); w.treats = w.treats.filter(t => t.age < 140);

  // a crow sometimes raids the stash at dusk
  if (w.thief) {
    w.thief.t += dt; if (w.thief.t > 2 && !w.thief.took) { w.thief.took = true; if (w.stash.items.length) { const [lost] = stealFromStash(w, 1); w.thief.item = lost; note(w, 'A crow swooped over the stash and flew off with something shiny.', 'collect'); } }
    if (w.thief.t > 7) w.thief = null;
  } else {
    w.thiefT -= dt;
    if (w.thiefT <= 0) { w.thiefT = w.dayLen * rnd(2.5, 5); if (w.stash.items.length >= 4 && w.weather.rain < 0.3 && ((h > 16.5 && h < 19.5) || (h > 5 && h < 7.5)) && c.pose !== 'tend') w.thief = { t: 0, took: false }; }
  }

  offerTick(w); upsetTick(w, dt);

  // wants
  w.wantT -= dt; if (w.wantT <= 0) { w.wantT = w.dayLen / 6; characterTick(w); intentTick(w); interestTick(w); memoryTick(w); genWants(w); selfTaught(w); hangSpareFrames(w); considerWish(w); wishTick(w); considerBlog(w); refreshFavourites(w); favShift(w); secretsRoll(w); }
  moonWishTick(w); meteorTick(w, dt);
  wantsTick(w, dayDt);

  // the cat
  const dr = dayRec(w), ak = c.act.type === 'play' && c.act.gather ? 'gather' : c.act.type; dr.secs[ak] = Math.round(((dr.secs[ak] || 0) + dt) * 100) / 100;
  if (w.deco.chime) n.fear = clamp(n.fear - dayDt * 0.1);
  actTick(w, dt); favTick(w, dt);
  noticeThought(w);
  if (c.thoughtId !== w.lastThoughtId) { w.lastThoughtId = c.thoughtId; if (c.thought) pushHist(w, 'thought', c.thought); }
  c.reeval -= dt;
  if (c.reeval <= 0) { c.reeval = rnd(0.8, 1.4); if (INTERRUPT.has(c.act.type)) reconsider(w); }
}

// advance by real seconds, honoring the speed setting. returns sim seconds advanced
// The live loop. The world always moves in steps of exactly STEP seconds, however the frames happen to fall (the
// leftover is kept for the next frame), so the same seed gives the same life at any frame rate or speed.
export const STEP = 1 / 60;
export function advance(w, realDt, maxSteps = 600) {
  if (w.paused) return 0;
  let acc = (w.acc || 0) + Math.min(realDt, 1) * w.speed, steps = 0;
  while (acc >= STEP && steps < maxSteps) { tick(w, STEP); acc -= STEP; steps++; }
  w.acc = Math.min(acc, STEP); // (time beyond what fits in one go is dropped, as before, rather than piling up)
  return steps * STEP;
}

// fast-forward the time the app was closed. no thoughts spoken, no LLM asks
export function catchUp(w, seconds, step = 0.5) {
  const log0 = w.logId, hook = w.onNote, netWas = w.netOn, llmWas = w.llmOn; w.onNote = null; w.netOn = false; w.llmOn = false; w.quiet = true;
  const before = { birds: w.stats.birds || 0, frogVisits: w.stats.frogVisits || 0, tab: (w.tablet && w.tablet.uses) || 0, offers: w.cat.offerHist.length, paintings: w.stats.paintings, crafted: w.stats.crafted, gathered: w.stats.gathered, wishes: w.stats.wishes, collected: w.stats.collected, wants: w.stats.wants, mice: w.stats.mice, level: levelOf(w.cat.art.xp), day: dayOf(w), starWishes: w.stats.starWishes || 0, moonWishes: w.stats.moonWishes || 0 };
  try { for (let t = 0; t < seconds; t += step) tick(w, step); } finally { w.quiet = false; }
  w.asks.length = 0; w.onNote = hook; w.netOn = netWas; w.llmOn = llmWas;
  const s = w.stats, c = w.cat;
  const lines = [];
  if (s.paintings > before.paintings) lines.push(`painted ${s.paintings - before.paintings} picture${s.paintings - before.paintings > 1 ? 's' : ''}`);
  if (levelOf(c.art.xp) > before.level) lines.push(`reached painting level ${levelOf(c.art.xp)} (${LEVEL_NAMES[levelOf(c.art.xp)]})`);
  if (s.collected > before.collected) lines.push(`added ${s.collected - before.collected} ${s.collected - before.collected > 1 ? 'things' : 'thing'} to the stash`);
  if (s.gathered > before.gathered) lines.push(`gathered ${s.gathered - before.gathered} bit${s.gathered - before.gathered > 1 ? 's' : ''} of bark and twig from the oak`);
  if (s.crafted > before.crafted) lines.push(`made ${s.crafted - before.crafted} thing${s.crafted - before.crafted > 1 ? 's' : ''}${c.crafted.length ? ' (latest: ' + c.crafted[0].name + ')' : ''}`);
  if (s.wishes > before.wishes) lines.push(`left you ${s.wishes - before.wishes} note${s.wishes - before.wishes > 1 ? 's' : ''} on the tablet`);
  if (s.wants > before.wants) lines.push(`got ${s.wants - before.wants} thing${s.wants - before.wants > 1 ? 's' : ''} it wanted`);
  if (w.tablet && w.tablet.uses > before.tab) lines.push(`read ${w.tablet.uses - before.tab} thing${w.tablet.uses - before.tab > 1 ? 's' : ''} on the tablet`);
  if (w.cat.offerHist.length > before.offers) lines.push(`looked over ${w.cat.offerHist.length - before.offers} offering${w.cat.offerHist.length - before.offers > 1 ? 's' : ''} you left`);
  if ((s.birds || 0) > before.birds) lines.push(`caught ${s.birds - before.birds} bird${s.birds - before.birds > 1 ? 's' : ''} (a rare thing)`);
  if ((s.frogVisits || 0) > before.frogVisits) lines.push(`visited ${w.frog ? w.frog.name : 'the frog'} ${s.frogVisits - before.frogVisits} time${s.frogVisits - before.frogVisits > 1 ? 's' : ''}`);
  if ((s.starWishes || 0) > before.starWishes) lines.push(`made ${s.starWishes - before.starWishes > 1 ? s.starWishes - before.starWishes + ' wishes' : 'a wish'} on a shooting star`);
  if ((s.moonWishes || 0) > before.moonWishes) lines.push(`made a wish on the full moon`);
  if (s.mice > before.mice) lines.push(`caught ${s.mice - before.mice} ${s.mice - before.mice > 1 ? 'mice' : 'mouse'}`);
  const wonder = w.log.filter(e => e.id > log0 && (e.kind === 'wonder')).map(e => e.text).slice(0, 3);
  return { seconds, days: dayOf(w) - before.day, lines, wonder };
}
