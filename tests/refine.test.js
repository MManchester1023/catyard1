// A round of refinements: tiredness and sleep, eating and washing, Garfield, the techie's tablet, saying what it is upset
// about, mysteries that only show once noticed, the easel and oak frames as things to build, and a blog that reads like one.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { decide, SLEEPY, NAPPY, unknownPlaces } from '../src/sim/mind.js';
import { start } from '../src/sim/acts.js';
import { itemValue } from '../src/sim/quirk.js';
import { TEMPER_IDS } from '../src/sim/temper.js';
import { upsetBy, upsetReason, upsetAbout, upsetVoice } from '../src/sim/upset.js';
import { offlineReply, thoughtFor } from '../src/sim/thoughts.js';
import { clue, discovered } from '../src/sim/mysteries.js';
import { genWants } from '../src/sim/wants.js';
import { RECIPES, knows, frameTotal, frameDemand, frameSpare } from '../src/sim/recipes.js';
import { goals, finishCraft, startable, gatherNeed, shortfall, nextCraft, hangSpareFrames } from '../src/sim/craft.js';
import { blocked, journal, dropFromBird } from '../src/sim/world.js';
import { composePost, ensureBlog, feelingNow } from '../src/sim/blog.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { seedTests, withRandom, setRandom } from '../src/sim/rng.js';
seedTests(1); // (every world here gets a fixed seed, so this test gives the same result every run)

const ok = m => console.log('  ok ' + m);
const fresh = (temper = null) => { const w = makeWorld('Tess'); w.netOn = false; w.cat.temper = temper; w.cat.traits.curious = 0.5; return w; };
const KNOWN = { pond: 1, post: 1, tree: 1, flowers: 1, cushion: 1, yarn: 1, fence: 1, tablet: 1 }; // (everything but the easel, which has to be built)
const calm = (w, hour = 10) => {
  const c = w.cat; w.clock = (hour / 24) * w.dayLen; w.weather.rain = 0; w.weather.cloud = 0.1; c.huntCool = 0; c.hidden = false;
  c.traits.curious = 0.1; c.traits.lazy = 0.5; c.traits.bold = 0.5; c.postAt = w.clock; c.loungeAt = -1e9; c.catTreeAt = w.clock;
  Object.assign(c.mem.known, KNOWN);
  Object.assign(c.needs, { hunger: 0.2, thirst: 0.2, tired: 0.2, fun: 0.2, dirty: 0.1, wet: 0, lonely: 0.1, create: 0.1, fear: 0 });
  w.birds.forEach(b => (b.state = 'away')); w.mice = []; w.items = []; w.treats = []; w.offers = []; c.wants = [];
  return w;
};
const kinds = (w, n = 60) => new Set(Array.from({ length: n }, () => { const d = decide(w, null); return d.type + (d.opts && d.opts.lounge ? ':lounge' : ''); }));
const hold = w => { w.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 9e9 }; w.cat.reeval = 1e9; };

// ---- a cat does not sleep unless it is tired
{
  const w = calm(fresh(), 2); w.cat.needs.tired = 0.1; // two in the morning, deep night
  assert(!kinds(w).has('sleep'), 'not tired: it does not go to bed, even in the dead of night');
  w.cat.needs.tired = 0.8; assert(kinds(w).has('sleep'), 'tired: it does');
  const d = calm(fresh(), 12); d.cat.needs.tired = SLEEPY + 0.05; assert(NAPPY > SLEEPY); assert(![...kinds(d, 200)].some(k => k.includes('lounge')), 'a little tired is not enough for a nap in the sun');
  d.cat.needs.tired = 0.8; assert([...kinds(d, 300)].some(k => k.includes('lounge')), 'properly tired: it naps');
  const g = calm(fresh('garfield'), 12); g.cat.needs.tired = 0.2; g.cat.needs.hunger = 0.3; assert(![...kinds(g, 300)].some(k => k === 'sleep' || k.includes('lounge')), 'Garfield does not nap when he is not tired either');
  // a cat that has slept itself out wakes up
  const r = calm(fresh(), 13); r.cat.needs.tired = 0.5; start(r, 'sleep', { spot: 'cushion' }); r.cat.act.phase = 'do'; r.cat.act.dur = 9e9; r.cat.reeval = 1e9;
  for (let i = 0; i < 700 && r.cat.act.type === 'sleep'; i++) tick(r, 0.5);
  assert(r.cat.act.type !== 'sleep', 'rested, it gets up rather than lying there (tiredness ' + r.cat.needs.tired.toFixed(2) + ', now ' + r.cat.act.type + ')');
  // waiting out the rain when it is not tired is sitting about, not sleeping (and it does not count as a nap)
  const q = calm(fresh(), 14); q.weather.rain = 0.9; q.cat.needs.tired = 0.1; start(q, 'sleep', { spot: 'house', reason: 'rain' }); q.cat.act.phase = 'do'; q.cat.reeval = 1e9; q.cat.hidden = true; const naps = q.stats.naps;
  tick(q, 0.1); assert.equal(q.cat.pose, 'peek'); q.cat.act.t = 30; q.weather.rain = 0; tick(q, 0.1); assert.equal(q.stats.naps, naps, 'no nap counted');
  ok('no sleep unless tired: not at night, not for a nap, Garfield included; a rested cat wakes up; the rain is not a nap');
}

// ---- eating makes it tired, and a cat always washes after a meal
{
  const ends = [];
  for (const t of [null, 'garfield', 'hunter', 'techie', 'builder', 'vangogh']) {
    const w = calm(fresh(t), 12); const c = w.cat; Object.assign(c.needs, { hunger: 0.7, tired: 0.1 }); w.o.bowl.food = 1; c.huntCool = 1e9;
    start(w, 'eat', { from: 'bowl' }); c.reeval = 1e9; const t0 = c.needs.tired;
    for (let i = 0; i < 1200 && c.act.type === 'eat'; i++) tick(w, 0.1);
    assert.equal(c.act.type, 'groom', `${t}: it washes after eating (is now ${c.act.type})`);
    ends.push(c.needs.tired - t0);
  }
  assert(ends.every(g => g > 0.2 && g < 0.5), 'a proper meal adds about 0.3 tiredness: ' + ends.map(x => x.toFixed(2)));
  // a snack adds less than a meal
  const s = calm(fresh(), 12), sc = s.cat; Object.assign(sc.needs, { hunger: 0.3, tired: 0.1 }); s.o.bowl.food = 1; start(s, 'eat', { from: 'bowl' }); sc.reeval = 1e9;
  for (let i = 0; i < 1200 && sc.act.type === 'eat'; i++) tick(s, 0.1); assert(sc.needs.tired - 0.1 < ends[0], 'a small meal tires it less');
  ok('eating adds tiredness (about 0.3 for a meal), and it always washes afterwards');
}

// ---- Garfield gets bored sooner
{
  const gain = t => { const w = calm(fresh(t), 12); hold(w); w.cat.needs.fun = 0.1; for (let i = 0; i < 200; i++) { w.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 9e9 }; tick(w, 0.5); w.cat.needs.hunger = 0.1; } return w.cat.needs.fun - 0.1; };
  const g = gain('garfield'), n = gain(null); assert(g > n * 1.4, `Garfield ${g.toFixed(2)} vs ${n.toFixed(2)}`);
  ok('Garfield is bored about 1.6 times as fast');
}

// ---- a techie goes straight for the tablet
{
  let found = 0; for (let i = 0; i < 12; i++) { const w = fresh('techie'); for (let t = 0; t < 400 && !w.cat.mem.known.tablet; t += 0.5) tick(w, 0.5); if (w.cat.mem.known.tablet) found++; }
  assert(found >= 11, 'techies that found the tablet within a few minutes: ' + found + ' of 12'); // (before this it took a day or more)
  // and finding it does not use up the day's share of new places
  const t = fresh('techie'), o = fresh(null); for (const x of [t, o]) { x.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 9e9 }; x.cat.reeval = 1e9; for (const id of ['pond', 'post', 'tree', 'tablet']) { x.cat.x = x.o[id].x; x.cat.y = x.o[id].y; tick(x, 0.001); } }
  assert(t.cat.mem.known.tablet && t.cat.mem.known.pond && t.cat.mem.known.post && t.cat.mem.known.tree, 'the techie takes in the tablet as well as three other places'); assert(!o.cat.mem.known.tablet, 'another cat has used up its three');
  ok('a techie finds the tablet in the first part of the first day (' + found + ' of 12), and it does not cost it a place')
}

// ---- when it is upset it says what about
{
  const w = fresh();
  upsetBy(w, 'wish', 'Two days since I wrote to the human. They are ignoring me.', { level: 0.5, note: 'nobody has answered its note.', hint: 'wish' });
  assert.equal(upsetReason(w), 'nobody has answered its note'); assert.equal(upsetAbout(w), 'nobody answering my note'); assert(upsetVoice(w).includes('ignoring me'));
  const reply = offlineReply(w, 'are you upset?'); assert(reply.includes('ignoring me') && !/^wish$/.test(reply), 'asked outright, it says: ' + reply);
  const other = withRandom(0.1, () => offlineReply(w, 'nice weather')); assert(/upset about nobody answering my note/.test(other), 'even in passing: ' + other);
  const th = new Set(Array.from({ length: 200 }, () => thoughtFor(w, 'idle'))); assert([...th].some(s => /note|Ignored|Reading is free/.test(s)), 'its thoughts mention it');
  assert(feelingNow(w).label === 'upset' && /ignoring me/.test(feelingNow(w).text));
  // a worse thing takes over, a milder one does not
  upsetBy(w, 'theft', 'One treasure is gone.', { level: 0.9, note: 'something was taken from its stash.', hint: 'theft' }); assert.equal(upsetAbout(w), 'someone taking things from my stash');
  upsetBy(w, 'misses', 'Three misses.', { level: 0.2, note: 'too many misses in a row.', hint: 'misses' }); assert.equal(upsetAbout(w), 'someone taking things from my stash');
  // saves from before kept only a short code, and some kept a whole sentence in it
  const o = fresh(); o.cat.upset = { why: 'hungry', level: 0.5, until: o.clock + 500, since: o.clock }; assert.equal(upsetReason(o), 'the bowl has been empty a long time'); assert(/empty for so long/.test(upsetVoice(o)));
  const o2 = fresh(); o2.cat.upset = { why: 'The human ignored my note.', level: 0.5, until: o2.clock + 500, since: o2.clock }; assert(/ignored my note/.test(upsetVoice(o2)) && /ignored my note/.test(upsetReason(o2)));
  ok('an upset cat says what it is upset about: reason, chat, thoughts, the blog; old saves too');
}

// ---- mysteries are only there once the cat has noticed them
{
  const w = fresh(); const c = w.cat; Object.assign(c.mem.known, KNOWN);
  assert(!Object.values(w.mysteries).some(discovered), 'nothing is discovered in a new world');
  for (let i = 0; i < 80; i++) { c.wants = []; genWants(w); }
  assert(!c.wants.some(x => x.kind === 'solve') && !w.log.some(e => /wonder/i.test(e.text)), 'it wants to solve nothing it has not noticed');
  assert(!/moon|ripples/.test(JSON.stringify(c.wants)));
  clue(w, 'moon', 1, 0); assert(discovered(w.mysteries.moon) && !discovered(w.mysteries.ripples));
  assert(w.log.some(e => /wonder about the moon/.test(e.text)) && w.journal.some(e => e.tag === 'mystery'), 'it says so when it first notices'); assert.equal(c.thoughtHint, 'notice:moon');
  const thought = thoughtFor(w, 'notice:moon'); assert(thought && !/^$/.test(thought));
  const n = w.log.filter(e => /wonder about the moon/.test(e.text)).length; clue(w, 'moon', 1, 1); assert.equal(w.log.filter(e => /wonder about the moon/.test(e.text)).length, n, 'only the first time');
  clue(w, 'ripples', 1); assert(discovered(w.mysteries.ripples));
  let sawWant = false; for (let i = 0; i < 80 && !sawWant; i++) { c.wants = []; genWants(w); sawWant = c.wants.some(x => x.kind === 'solve'); } assert(sawWant, 'once noticed it can want to work it out');
  ok('a mystery shows up (and is wanted) only after it is noticed, and the cat says so then');
}

// ---- the easel is built, out of oak frames
{
  const w = fresh('vangogh'), c = w.cat; calm(w, 11); c.needs.create = 0.95; c.needs.tired = 0.1;
  assert.equal(w.easelMade, null); assert(!unknownPlaces(w).includes('easel'), 'there is no easel to discover');
  assert(![...kinds(w, 200)].includes('paint'), 'even a Van Gogh cannot paint with no easel');
  c.x = w.o.easel.x; c.y = w.o.easel.y; hold(w); tick(w, 0.01); assert(!c.mem.known.easel, 'standing where it will go, it finds nothing');
  assert(!blocked(w, w.o.easel.x, w.o.easel.y), 'and nothing is in the way');
  // what it needs
  assert.equal(frameTotal(w), 4, 'two for the easel and two for the table'); assert.deepEqual(RECIPES.frame.cost, { bark: 2 }); assert.deepEqual(RECIPES.easel.cost, { frame: 2 }); assert.deepEqual(RECIPES.table.cost, { frame: 2, bark: 2 });
  assert(goals(w).includes('easel') && goals(w).includes('table') && goals(w).includes('frame'));
  assert.equal(frameDemand(w), 4); c.inv.frame = 1; assert.equal(frameDemand(w), 3); c.inv.frame = 0;
  assert.deepEqual(gatherNeed(w), { bark: 10, twig: 0 }, 'it needs bark for the frames, and for the table');
  c.inv.bark = 2; assert.equal(nextCraft(w), 'frame', 'the first step is a frame');
  // it wants an easel, and says so
  let want = false; for (let i = 0; i < 60 && !want; i++) { c.wants = []; genWants(w); want = c.wants.some(x => x.kind === 'craft' && x.recipe === 'easel'); } assert(want, 'a Van Gogh with no easel wants one');
  assert(!c.wants.some(x => x.recipe === 'frame'), 'frames are a step, not a want');
  // build it
  assert(finishCraft(w, 'frame') && c.inv.frame === 1 && !c.crafted.some(x => x.work), 'a frame is a part kept in its things');
  assert(!startable(w, 'easel')); c.inv.bark = 2; finishCraft(w, 'frame'); assert.equal(c.inv.frame, 2); assert(startable(w, 'easel') && nextCraft(w) === 'easel');
  assert(finishCraft(w, 'easel') && w.easelMade && w.easelMade.day >= 1 && c.mem.known.easel && c.inv.frame === 0, 'the easel is built out of two frames');
  assert(w.journal.some(e => /built an easel/.test(e.text)) && c.thoughtHint === 'easelDone');
  assert(blocked(w, w.o.easel.x, w.o.easel.y), 'it stands in the yard'); assert(!startable(w, 'easel') && !goals(w).includes('easel'));
  c.needs.create = 0.95; c.needs.tired = 0.1; assert([...kinds(w, 200)].includes('paint'), 'and now it paints');
  ok('the easel: not there to begin with, built from two oak frames, wanted, then used');
}
{
  // frames for other things, and a spare one goes round a painting
  const w = fresh(), c = w.cat; calm(w); w.easelMade = { day: 1 }; w.table = { x: 1, y: 1, day: 1 }; c.inv.frame = 0;
  assert.equal(frameTotal(w), 0); w.cat.recipes.feeder = { known: true }; w.cat.recipes.cattree = { known: true }; assert.equal(frameTotal(w), 4, 'a feeder wants one, a cat tree three'); assert(knows(w, 'feeder'));
  assert.deepEqual(shortfall(w, 'feeder'), { frame: 1, bark: 1, twig: 2 });
  w.cat.recipes.feeder = null; w.cat.recipes.cattree = null; c.inv.frame = 2; assert.equal(frameSpare(w), 2);
  c.art.count = 2; c.art.works = [{ id: 'a', title: 'First', score: 0.4 }, { id: 'b', title: 'Second', score: 0.8 }]; const xp = c.art.xp;
  assert.equal(hangSpareFrames(w), 2); assert(c.inv.frame === 0 && c.crafted.filter(x => x.recipe === 'frame' && x.work).length === 2 && c.art.xp > xp, 'both paintings got a frame');
  assert.equal(hangSpareFrames(w), 0);
  ok('frames: the feeder and cat tree are built out of them too, and spares go round paintings');
}
{
  // old saves already had an easel; new worlds do not
  const w = fresh(); const r = deserialize(serialize(w)); assert.equal(r.easelMade, null, 'a new cat that has not built one still has none after a save');
  const data = JSON.parse(serialize(w)); delete data.w.easelMade; const old = deserialize(JSON.stringify(data)); assert(old.easelMade && old.easelMade.legacy, 'a save from before keeps its easel');
  w.easelMade = { day: 3 }; assert.equal(deserialize(serialize(w)).easelMade.day, 3);
  ok('saves: the easel is kept; older saves keep the one they had');
}

// ---- the blog reads like a person wrote it
{
  const lines = [['I scratched the oak and a piece of bark came loose. It had not occurred to me that trees give things back. I put it in my bag and walked away very slowly, in case the oak changed its mind.', 'craft'], ['There is a flat glowing slab on a stump. It shows things from somewhere else. I must sit with it.', 'tablet'], ['I made an oak frame. Bigger things are built out of these.', 'craft'], ['Someone has been in my stash. One is gone. I will remember this.', 'stash']];
  for (const t of [null, ...TEMPER_IDS]) for (let k = 0; k < 6; k++) {
    const w = fresh(t); ensureBlog(w); w.clock = 5 * w.dayLen; for (const [x, tag] of lines) journal(w, x, tag); w.cat.wants.push({ kind: 'fill', text: 'have 10 treasures in the stash (some)', strength: 0.9 }); w.cat.thought = 'The moon again.'; w.cat.thoughtAt = w.clock;
    if (k % 2) { w.blog.started = 3; w.blog.posts.push({}, {}); }
    const p = composePost(w), paras = p.body.split('\n\n');
    assert(!/How I feel:|On my mind:|What I want is to|…/.test(p.body), `${t}: no labelled sections, nothing trailing off: ` + p.body);
    assert(paras.length >= 3 && paras.every(x => /[.!?”"')]$/.test(x.trim())), `${t}: whole paragraphs that end properly`);
    assert(!/\(some\)/.test(p.body), 'no stray brackets from the want');
  }
  const w = fresh(); ensureBlog(w); w.blog.started = 2; w.clock = 5 * w.dayLen; for (const [x, tag] of lines) journal(w, x, tag);
  upsetBy(w, 'wish', 'They are ignoring me.', { level: 0.5, note: 'nobody has answered its note.', hint: 'wish' });
  assert(/upset about nobody answering my note/.test(composePost(w).body), 'an upset cat says what about in its blog');
  ok('blog: reads as prose in the cat\'s voice, whole sentences, and says what it is upset about');
}

// ---- birds drop crafting parts and trinkets, and nothing else
{
  const w = calm(fresh(), 12); w.deco = w.deco || {}; const seen = {}; let total = 0;
  for (let i = 0; i < 600; i++) { w.items = []; const it = dropFromBird(w, { x: 400, y: 380 }, true); if (!it) continue; total++; seen[it.type] = (seen[it.type] || 0) + 1; assert.equal(it.from, 'bird'); }
  const parts = ['bark', 'twig', 'twine'], trinkets = ['bottlecap', 'feather', 'button', 'marble'];
  assert(Object.keys(seen).every(t => parts.includes(t) || trinkets.includes(t)), 'only crafting parts and trinkets: ' + JSON.stringify(seen));
  assert(parts.every(t => seen[t] > 10) && trinkets.every(t => seen[t] > 10), 'every kind turns up: ' + JSON.stringify(seen));
  const share = parts.reduce((a, t) => a + (seen[t] || 0), 0) / total; assert(share > 0.3 && share < 0.6, 'about four in ten are parts: ' + share.toFixed(2));
  // the one it is shortest of is likelier, and it is never dropped one it cannot carry
  w.cat.inv.bark = 12; w.cat.inv.twig = 0; w.cat.inv.twine = 12; const got = {};
  for (let i = 0; i < 400; i++) { w.items = []; const it = dropFromBird(w, { x: 400, y: 380 }, true); got[it.type] = (got[it.type] || 0) + 1; }
  assert(!got.bark && !got.twine && got.twig > 100, 'with a full load of bark and string, the part it gets is a twig: ' + JSON.stringify(got));
  w.cat.inv.twig = 12; for (let i = 0; i < 100; i++) { w.items = []; const it = dropFromBird(w, { x: 400, y: 380 }, true); assert(trinkets.includes(it.type), 'a full-handed cat only gets trinkets'); }
  // and the cat picks one up into what it is carrying (not the stash)
  const p = calm(fresh(), 12); p.cat.inv.bark = 2; const it = { id: 'b1', type: 'bark', color: null, x: p.cat.x + 30, y: p.cat.y, age: 0, from: 'bird' }; p.items.push(it);
  assert(itemValue(p, it) > 0.45, 'it wants bark lying in the yard'); p.cat.inv.bark = 12; assert.equal(itemValue(p, it), 0, 'not when it cannot carry more'); p.cat.inv.bark = 2;
  start(p, 'collect', { item: it }); for (let i = 0; i < 400 && p.cat.act.type === 'collect'; i++) tick(p, 0.25);
  assert.equal(p.cat.inv.bark, 3, 'the bark went into its load'); assert(!p.items.includes(it) && !p.stash.items.some(x => x.type === 'bark') && !p.cat.carry, 'and not into the stash');
  assert(p.log.some(l => /picked up a piece of bark the bird had dropped/.test(l.text)), 'it says so');
  ok('birds: bark, twigs, string and trinkets only; the part it is shortest of is likelier; it picks them up as materials');
}

console.log('\nALL OK');
