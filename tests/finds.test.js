// Favourite things to do (a bigger boost than anything else) and tastes that come from what the cat finds.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { start } from '../src/sim/acts.js';
import { decide, pickSleepSpot } from '../src/sim/mind.js';
import { feel, FAV_BOOST } from '../src/sim/feelings.js';
import { favShift, favTick, favourites, isFav, foundThing, foundPlace, placeLove, actKeyOf, FAVABLE, MAX_FAVS } from '../src/sim/finds.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { TEMPER_IDS } from '../src/sim/temper.js';
import { offlineReply } from '../src/sim/thoughts.js';
import { digest } from '../src/sim/llm.js';
import { seedTests, withRandom, setRandom } from '../src/sim/rng.js';
seedTests(1); // (every world here gets a fixed seed, so this test gives the same result every run)

const ok = m => console.log('  ok ' + m);
const fresh = (temper = null) => { const w = makeWorld('Fin'); w.cat.temper = temper; return w; };
const give = (w, key, v, n) => { w.cat.assoc[key] = { v, n, lab: { content: n }, said: '' }; };

// ---- which things become favourites
{
  const w = fresh();
  give(w, 'act:frog', 0.4, 8); give(w, 'act:paint', 0.3, 5); give(w, 'act:fish', 0.5, 6); give(w, 'act:tablet', 0.35, 9);
  give(w, 'act:hunt', 0.7, 2); // a thrill that has happened twice is not a favourite
  give(w, 'act:gaze', 0.1, 50); // done all the time, but it is only ok
  give(w, 'act:offering', 0.9, 20); // not something it chooses to do
  const next = favShift(w);
  assert.equal(next.length, MAX_FAVS, 'at most three');
  assert(!next.includes('act:hunt') && !next.includes('act:gaze') && !next.includes('act:offering'), 'only things it does often and likes: ' + next);
  assert(next.every(k => FAVABLE.has(k)));
  assert(w.journal.filter(e => e.tag === 'favourite').length === MAX_FAVS, 'it says so in its diary');
  assert.equal(favShift(w).join(), next.join(), 'stable when nothing changes'); assert.equal(w.journal.filter(e => e.tag === 'favourite').length, MAX_FAVS, 'and does not repeat itself');
  ok('favourites: liked and often done, at most three, announced once');
}
// ---- they change, but not at the first wobble
{
  const w = fresh(); give(w, 'act:frog', 0.4, 8); favShift(w); assert(isFav(w, 'act:frog'));
  give(w, 'act:frog', 0.18, 12); favShift(w); assert(isFav(w, 'act:frog'), 'a dip does not lose it');
  give(w, 'act:frog', 0.05, 14); favShift(w); assert(!isFav(w, 'act:frog'), 'it stops being a favourite once it has really stopped being good');
  assert(w.journal.some(e => e.tag === 'favourite' && /not my favourite any more/.test(e.text)));
  ok('favourites change slowly');
}

// ---- the boost: the same thing is a bigger lift when it is a favourite
{
  const mk = fav => { const w = fresh(); w.cat.mood.joy = 0.3; w.cat.needs.lonely = 0.8; w.cat.needs.fun = 0.7; if (fav) w.cat.favActs = ['act:frog']; return w; };
  const a = mk(false), b = mk(true);
  feel(a, ['act:frog'], { joy: 0.1, lonely: -0.1, fun: -0.1 }, 'warm'); feel(b, ['act:frog'], { joy: 0.1, lonely: -0.1, fun: -0.1 }, 'warm');
  const ja = a.cat.mood.joy - 0.3, jb = b.cat.mood.joy - 0.3;
  assert(jb > ja * FAV_BOOST, `joy: ${ja.toFixed(3)} vs ${jb.toFixed(3)}`);
  assert(0.8 - b.cat.needs.lonely > (0.8 - a.cat.needs.lonely) * 1.5, 'takes more off loneliness');
  assert(0.7 - b.cat.needs.fun > (0.7 - a.cat.needs.fun) * 1.5, 'and off boredom');
  assert(b.cat.glowUntil > b.clock && !(a.cat.glowUntil > a.clock), 'and leaves a glow behind');
  // a bad thing is not made worse by being a favourite
  const c1 = mk(false), c2 = mk(true); feel(c1, ['act:frog'], { fear: 0.2 }, 'uneasy'); feel(c2, ['act:frog'], { fear: 0.2 }, 'uneasy'); assert.equal(c1.cat.needs.fear, c2.cat.needs.fear - 0, 'fear is the same');
  // the boost also runs while it is doing it
  const d = mk(false), e = mk(true); for (const w of [d, e]) { start(w, 'frog'); w.cat.act.phase = 'do'; }
  for (let i = 0; i < 100; i++) { favTick(d, 0.1); favTick(e, 0.1); }
  assert(e.cat.mood.joy > d.cat.mood.joy + 0.08 && e.cat.needs.lonely < d.cat.needs.lonely - 0.02, 'while doing a favourite the mood lifts faster');
  start(e, 'groom'); e.cat.act.phase = 'do'; const j0 = e.cat.mood.joy, g0 = e.cat.glowUntil; e.clock = g0 + 1; for (let i = 0; i < 50; i++) favTick(e, 0.1); assert.equal(e.cat.mood.joy, j0, 'doing something else is not boosted');
  ok('a favourite is a bigger boost: stronger effects, a glow, and a lift while it happens');
}

// ---- it goes for them
{
  const set = fav => {
    const w = fresh(); const c = w.cat; w.clock = 12 / 24 * w.dayLen + 5 * w.dayLen; c.traits.curious = 0; c.traits.lazy = 0;
    Object.assign(c.needs, { hunger: 0, thirst: 0, tired: 0.3, fun: 0, dirty: 0.2, create: 0, lonely: 0.2, fear: 0 });
    w.frog = { name: 'Pip', out: true, lastVisit: -1e9, bond: 0, visits: 0 }; w.weather.rain = 0; w.weather.cloud = 0; w.weather.type = 'clear';
    if (fav) c.favActs = ['act:frog']; return w;
  };
  const a = withRandom(0.5, () => decide(set(false), null)), b = withRandom(0.5, () => decide(set(true), null));
  assert.notEqual(a && a.type, 'frog', 'not for the frog today, normally: ' + (a && a.type));
  assert.equal(b && b.type, 'frog', 'but when sitting with the frog is a favourite it goes anyway');
  ok('a favourite wins when it is close');
}

// ---- tastes from finds
{
  const w = fresh(); w.clock = 2 * w.dayLen; const c = w.cat;
  c.tastes.color.pink = 0.2; const before = c.tastes.color.pink; foundThing(w, { type: 'button', color: 'pink' });
  assert(c.tastes.color.pink > before, 'finding it nudges the taste'); assert(w.journal.some(e => e.tag === 'discover' && /pink/.test(e.text)), 'and it makes a note of a first');
  const n = w.journal.length; foundThing(w, { type: 'button', color: 'pink' }); assert.equal(w.journal.length, n, 'a second find is not news');
  foundThing(w, { type: 'button', color: 'teal' }); assert(w.journal.some(e => /teal/.test(e.text)), 'a new colour is');
  assert.equal(c.found.colors.pink, 2); assert.equal(c.found.types.button, 3);
  // finding something itself counts for more than being handed it
  const x = fresh(), y = fresh(); feel(x, ['color:pink', 'type:button'], { joy: 0.15 }, 'content'); foundThing(y, { type: 'button', color: 'pink' }); y.cat.assoc['color:pink'].n = 1;
  const x2 = fresh(), y2 = fresh(); for (const k of ['tastes', 'quirk', 'assoc', 'temper']) y2.cat[k] = JSON.parse(JSON.stringify(x2.cat[k] === undefined ? null : x2.cat[k])); // (the same cat, so only the weight differs)
  x2.cat.tastes.color.pink = y2.cat.tastes.color.pink = 0.2; x2.cat.mood.joy = y2.cat.mood.joy = 0.3; // (a taste only rises if it starts below where the feeling would put it)
  feel(x2, ['color:pink'], { joy: 0.15 }, 'content'); feel(y2, ['color:pink'], { joy: 0.15 }, 'content', { weight: 1.5 });
  assert(y2.cat.tastes.color.pink > x2.cat.tastes.color.pink, 'weight: a find leaves a bigger mark');
  ok('finds shape tastes, a first is remembered, and finding counts for more than being given');
}
{
  // really picking something up
  const w = fresh(); const c = w.cat; w.clock = 11 / 24 * w.dayLen; w.items.length = 0; const it = { id: 'x', type: 'feather', color: 'blue', x: c.x + 5, y: c.y, age: 0 }; w.items.push(it);
  start(w, 'collect', { item: it }); for (let i = 0; i < 80 && !c.found.types.feather; i++) tick(w, 0.1);
  assert(c.found.types.feather === 1 && c.found.colors.blue === 1, 'picking it up in the yard is a find');
  ok('picking something up in the yard counts as a find');
}
{
  const w = fresh(); foundPlace(w, 'pond'); assert(w.cat.found.places.pond && w.cat.assoc['place:pond'].n === 1, 'a place it discovers is felt');
  foundPlace(w, 'pond'); assert.equal(w.cat.assoc['place:pond'].n, 1, 'only once');
  // it prefers somewhere it loves to sleep
  const s = fresh(); s.clock = 12 / 24 * s.dayLen; s.cat.mem.known.cushion = 1; s.cat.mem.nap = {};
  assert.equal(withRandom(0, () => pickSleepSpot(s, false)), 'cushion'); give(s, 'place:house', 0.9, 6); assert(placeLove(s, 'house') > 0.8);
  assert.equal(withRandom(0, () => pickSleepSpot(s, false)), 'house', 'a place it loves wins the nap');
  ok('places it has found and come to love shape where it sleeps');
}

// ---- it can say what it loves, and Claude is told
{
  const w = fresh(); assert(/not decided|few days/.test(offlineReply(w, 'what is your favourite thing to do?')), 'honest before it knows');
  give(w, 'act:frog', 0.4, 8); give(w, 'act:paint', 0.3, 9); favShift(w);
  const r = offlineReply(w, 'what is your favourite thing to do?'); assert(/visiting the frog|painting/.test(r), r);
  assert(/Your favourite things to do/.test(digest(w)) && /visiting the frog/.test(digest(w)));
  ok('chat and the Claude briefing know its favourites');
}

// ---- act keys
{
  assert.equal(actKeyOf({ type: 'frog' }), 'act:frog'); assert.equal(actKeyOf({ type: 'play', own: true, kind: 'yarn' }), 'act:yarn'); assert.equal(actKeyOf({ type: 'play', gather: true }), 'act:tree');
  assert.equal(actKeyOf({ type: 'sleep', lounge: true }), 'act:lounge'); assert.equal(actKeyOf({ type: 'sleep' }), null); assert.equal(actKeyOf({ type: 'eat' }), null); assert.equal(actKeyOf(null), null);
  ok('acts map to what they are remembered as');
}

// ---- saves
{
  const w = fresh(); give(w, 'act:frog', 0.4, 8); favShift(w); foundThing(w, { type: 'marble', color: 'green' });
  const w2 = deserialize(serialize(w)); assert.deepEqual(w2.cat.favActs, ['act:frog']); assert.equal(w2.cat.found.colors.green, 1);
  const old = JSON.parse(serialize(w)); delete old.cat.favActs; delete old.cat.found; delete old.cat.glowUntil; const w3 = deserialize(JSON.stringify(old)); assert(Array.isArray(w3.cat.favActs) && w3.cat.found && w3.cat.found.colors);
  ok('saves round-trip; old saves get defaults');
}

// ---- two weeks of life for every kind of cat
{
  const seen = {};
  for (const t of [null, ...TEMPER_IDS]) {
    const w = fresh(t); w.cat.mem.known.tablet = 1;
    for (let i = 0; i < 14 * 1200 / 0.5; i++) tick(w, 0.5);
    const f = w.cat.favActs; assert(f.length <= MAX_FAVS && f.every(k => FAVABLE.has(k)), `${t}: sane favourites ${f}`);
    if (t === 'collector') assert(Object.values(w.cat.found.colors).reduce((a, b) => a + b, 0) >= 3, 'a collector finds things');
    for (const k of f) seen[k] = (seen[k] || 0) + 1;
  }
  assert(Object.keys(seen).length >= 3, 'different cats love different things: ' + JSON.stringify(seen));
  ok('14 days for each kind of cat: sensible and varied favourites ' + JSON.stringify(seen));
}
console.log('finds tests passed');
