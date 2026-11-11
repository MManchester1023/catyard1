// Temperament quirks, the rare bird catch, the frog friend, and the slower pace of discovery.
import assert from 'node:assert/strict';
import { makeWorld, tick, catchUp } from '../src/sim/sim.js';
import { start } from '../src/sim/acts.js';
import { decide } from '../src/sim/mind.js';
import { TEMPER_IDS, TEMPERS, deepNightOf, birdChance } from '../src/sim/temper.js';
import { clue, frogSighting } from '../src/sim/mysteries.js';
import { PACE, scaled, clueCap, gatherCap } from '../src/sim/pace.js';
import { meetFrog, frogTick } from '../src/sim/frog.js';
import { scratchTree, selfTaught, collectDrop } from '../src/sim/craft.js';
import { addWant } from '../src/sim/wants.js';
import { knows } from '../src/sim/recipes.js';
import { finishWork, paintWork, pickSubject } from '../src/sim/art.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { runCommand } from '../src/sim/commands.js';
import { dayOf } from '../src/sim/world.js';
import { seedTests, withRandom, setRandom } from '../src/sim/rng.js';
seedTests(1); // (every world here gets a fixed seed, so this test gives the same result every run)

const ok = m => console.log('  ok ' + m);
const fresh = (temper = null) => { const w = makeWorld('Tess'); w.easelMade = { day: 1 }; w.cat.temper = temper; w.cat.traits.curious = 0.5; return w; }; // (not over 0.75 or 0.9: those cats have extra secrets, tested below)
// a cat with nothing pressing, in daylight, that knows the whole yard: its choice depends only on what is being tested
const calm = (w, hour = 10) => {
  const c = w.cat; w.clock = (hour / 24) * w.dayLen; w.weather.rain = 0; w.weather.cloud = 0.1; c.huntCool = 0; c.hidden = false;
  c.traits.curious = 0.1; c.traits.lazy = 0.5; c.traits.bold = 0.5; c.postAt = w.clock; c.loungeAt = w.clock; c.catTreeAt = w.clock; // (its claws are fine and it has just rested)
  Object.assign(c.mem.known, { pond: 1, post: 1, tree: 1, flowers: 1, cushion: 1, yarn: 1, fence: 1, easel: 1, tablet: 1 });
  Object.assign(c.needs, { hunger: 0.2, thirst: 0.2, tired: 0.2, fun: 0.2, dirty: 0.1, wet: 0, lonely: 0.1, create: 0.1, fear: 0 });
  w.birds.forEach(b => (b.state = 'away')); w.mice = []; w.items = []; w.treats = []; w.offers = []; c.wants = [];
  return w;
};
const mouseAt = (w, x, y) => w.mice.push({ kind: 'mouse', x, y, home: w.o.holes[0], state: 'go', tx: x, ty: y, t: 0, vx: 0, vy: 0, alert: 0, dead: false, gone: false });
const dayStart = (w, d) => { w.clock = (d - 1) * w.dayLen + 0.4 * w.dayLen; };

// ---------- pace: discoveries take days, not minutes ----------
{
  const daysToSolve = pace => { const w = fresh(); w.pace = pace; let d = 0; while (!w.mysteries.sparks.solved && d < 200) { d++; dayStart(w, d); for (let i = 0; i < 300; i++) clue(w, 'sparks', 0.5); } return d; };
  assert.equal(daysToSolve(1), 8, 'the sparks take at least 8 days at the default pace (they used to take under one)');
  assert.equal(daysToSolve(2), 32, 'twice as slow');
  assert.equal(daysToSolve(0.5), 2, 'twice as fast');
  ok('the dancing sparks take at least 8 days by default; pace 2 takes 32, pace 0.5 takes 2, however many clues pile up in a day');

  const w = fresh(); dayStart(w, 1); for (let i = 0; i < 300; i++) clue(w, 'sparks', 0.5);
  assert.ok(w.mysteries.sparks.clues <= clueCap(w, 'sparks') + 1e-9 && !w.mysteries.sparks.theory, 'one day gives at most its cap and no theory yet');
  dayStart(w, 2); for (let i = 0; i < 300; i++) clue(w, 'sparks', 0.5);
  assert.ok(w.mysteries.sparks.theory, 'a theory needs more clues than a single day allows');
  ok('a first theory takes two days');

  const wm = fresh(); for (let d = 1; d <= 5; d++) { dayStart(wm, d); clue(wm, 'moon', 4, d - 1); }
  assert.ok(wm.mysteries.moon.theory && !wm.mysteries.moon.sawPhases, 'five phases are not enough');
  dayStart(wm, 6); clue(wm, 'moon', 4, 5); assert.ok(wm.mysteries.moon.sawPhases && /changes/.test(wm.mysteries.moon.theory), 'the sixth phase makes it click');
  ok('the moon is understood after six different phases');

  
  try {
    setRandom(() => 0); // every day is a good frog day
    const wf = fresh(); let found = 0;
    for (let d = 1; d <= 5; d++) { dayStart(wf, d); const a = frogSighting(wf), b = frogSighting(wf); assert.equal(b, false, 'a second sighting the same day does not count'); if (a) found = d; if (d < 5) assert.ok(!wf.frog, 'no frog friend before the fifth day'); }
    assert.equal(found, 5); assert.ok(wf.mysteries.ripples.solved && wf.frog && wf.frog.name, 'the fifth day of sightings finds the frog');
    setRandom(() => 0.99); // never a good day
    const wn = fresh(); for (let d = 1; d <= 30; d++) { dayStart(wn, d); frogSighting(wn); } assert.ok(!wn.frog && !wn.mysteries.ripples.solved, 'on off days the frog does not count');
  } finally { setRandom(null); }
  ok('the frog needs five good days of sightings (about two in three days are good), one a day, and then becomes a friend');

  // the oak gives a couple of bits a day however long the cat scratches
  const wg = fresh(); wg.cat.traits.curious = 1; setRandom(() => 0); let got = 0;
  try { for (let i = 0; i < 20; i++) { const d = scratchTree(wg); if (d) { collectDrop(wg, d); got++; } } assert.equal(got, 2, 'two bits on day 1'); wg.clock += wg.dayLen; for (let i = 0; i < 20; i++) { const d = scratchTree(wg); if (d) { collectDrop(wg, d); got++; } } assert.equal(got, 4, 'two more the next day'); } finally { setRandom(null); }
  const wg2 = fresh(); wg2.pace = 0.5; assert.equal(gatherCap(wg2), 4); wg2.pace = 2; assert.equal(gatherCap(wg2), 1);
  ok('the oak gives two bits of bark or twig a day (a table takes two days, not minutes)');

  // parts of the yard are noticed from closer by
  const near = (dist, pace) => { const x = fresh(); x.pace = pace; x.cat.x = x.o.pond.x + dist; x.cat.y = x.o.pond.y; x.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 9e9 }; tick(x, 0.001); return !!x.cat.mem.known.pond; };
  assert.ok(near(80, 1) && !near(130, 1), 'at the default pace the pond is noticed from 100 px, not 130');
  assert.ok(near(150, 0.25), 'a fast pace notices it from further off'); assert.ok(!near(80, 4), 'a slow pace needs the cat nearly on top of it');
  ok('the cat has to get within about 100 px of a part of the yard to notice it (was 190)');

  // ...and only three new parts of the yard sink in per day, however much it wanders
  const tour = pace => { const x = fresh(); x.easelMade = { day: 1 }; x.pace = pace; x.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 9e9 }; x.cat.reeval = 1e9; const ids = ['pond', 'post', 'tree', 'flowers', 'cushion', 'yarn', 'fence', 'easel', 'tablet']; const days = [];
    for (let d = 0; d < 6 && days.length < 6; d++) { for (const id of ids) { x.cat.x = x.o[id].x; x.cat.y = x.o[id].y; tick(x, 0.001); } days.push(ids.filter(id => x.cat.mem.known[id]).length); x.clock += x.dayLen; }
    return days; };
  assert.deepEqual(tour(1), [3, 6, 9, 9, 9, 9], 'standing at every part of the yard on day one it takes in three, then three more each day: ' + tour(1));
  assert.deepEqual(tour(2).slice(0, 4), [2, 4, 6, 8], 'twice as slow: pace.js halves it');
  ok('three parts of the yard sink in per day (nine take three days; pace scales it)');

  assert.equal(scaled(fresh(), PACE.sparksSolve), 48);
  const slow = fresh(); slow.pace = 2; assert.equal(scaled(slow, PACE.sparksSolve), 96);

  // crafting: the oak is less generous, and working a recipe out alone takes longer
  const wc = fresh(); wc.cat.traits.curious = 0.5; let bark = 0; const N = 6000;
  for (let i = 0; i < N; i++) { wc.cat.inv.bark = 0; wc.cat.inv.twig = 0; if (scratchTree(wc) === 'bark') bark++; }
  assert.ok(bark / N > 0.15 && bark / N < 0.27, 'bark rate at the default pace: ' + (bark / N).toFixed(3));
  const wq = fresh(); wq.cat.traits.curious = 0.5; wq.pace = 0.5; let bq = 0; for (let i = 0; i < N; i++) { wq.cat.inv.bark = 0; wq.cat.inv.twig = 0; if (scratchTree(wq) === 'bark') bq++; }
  assert.ok(bq / N > 0.34 && bq / N < 0.48, 'bark rate at pace 0.5: ' + (bq / N).toFixed(3));
  const wl = fresh(); wl.netOn = false; addWant(wl, { kind: 'learn', recipe: 'feeder' });
  wl.clock = 3 * wl.dayLen + 5; assert.equal(selfTaught(wl), false, 'not yet after 3 days'); assert.ok(!knows(wl, 'feeder'));
  wl.clock = 4 * wl.dayLen + 5; assert.equal(selfTaught(wl), true, 'after 4 days it works the recipe out'); assert.ok(knows(wl, 'feeder'));
  ok('bark comes about half as often, and a recipe takes 4 days to work out alone (pace scales both)');
}

// ---------- temperament: night owl ----------
{
  const owl = fresh('nightowl').cat, norm = fresh(null).cat;
  assert.ok(deepNightOf(owl, 3) && !deepNightOf(norm, 5.5) && deepNightOf(norm, 1) && !deepNightOf(owl, 1), 'the owl sleeps hard 2am-7:36am, others 11pm-4:36am');
  assert.ok(deepNightOf(owl, 7.4) && !deepNightOf(owl, 8) && !deepNightOf(owl, 23), 'the owl is still asleep at 7:24 and up by 8, and up at 11pm');
  const awakeShare = temper => { let up = 0, all = 0; for (let r = 0; r < 3; r++) { const w = fresh(temper); for (let i = 0; i < 3 * w.dayLen / 0.5; i++) { tick(w, 0.5); const h = (w.clock % w.dayLen) / w.dayLen * 24; if (h >= 0 && h < 3 && dayOf(w) > 1) { all++; if (w.cat.act.type !== 'sleep') up++; } } } return up / all; };
  const o = awakeShare('nightowl'), n = awakeShare(null);
  assert.ok(o > n + 0.25, `the owl is up between midnight and 3am far more often: owl ${o.toFixed(2)} vs ${n.toFixed(2)}`);
  ok(`the night owl is awake between midnight and 3am ${(o * 100).toFixed(0)}% of the time; other cats ${(n * 100).toFixed(0)}%`);
}

// ---------- temperament: Van Gogh ----------
{
  const want = (temper, create) => { let paint = 0; for (let i = 0; i < 30; i++) { const w = calm(fresh(temper)); w.cat.needs.create = create; if (decide(w, null).type === 'paint') paint++; } return paint; };
  assert.equal(want('vangogh', 0.32), 30, 'a Van Gogh paints at a creative urge an ordinary cat ignores');
  assert.equal(want(null, 0.32), 0, 'an ordinary cat does not');
  const w = calm(fresh('vangogh')); w.cat.needs.tired = 0.9; w.cat.needs.create = 0.9; assert.equal(decide(w, null).type, 'paint', 'even tired');
  const grow = temper => { const x = fresh(temper); x.cat.needs.create = 0; for (let t = 0; t < 600; t++) { x.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 9e9 }; tick(x, 1); } return x.cat.needs.create; };
  const gv = grow('vangogh'), gn = grow(null);
  assert.ok(gv > gn * 1.3, `the urge to paint builds faster (${gv.toFixed(2)} vs ${gn.toFixed(2)})`);
  const wv = fresh('vangogh'), wn = fresh(null); wv.easel = wn.easel = null;
  finishWork(wv, paintWork(wv, pickSubject(wv))); finishWork(wn, paintWork(wn, pickSubject(wn)));
  assert.ok(wv.cat.needs.create > 0 && wn.cat.needs.create === 0, 'a finished canvas never quite satisfies a Van Gogh');
  ok('the Van Gogh paints at a lower urge, even when tired, builds the urge faster, and is never fully satisfied');

  // but it is not only painting: over days it still eats, sleeps and explores
  const wl = fresh('vangogh'); const secs = {}; for (let i = 0; i < 6 * wl.dayLen / 0.5; i++) { tick(wl, 0.5); secs[wl.cat.act.type] = (secs[wl.cat.act.type] || 0) + 1; }
  const tot = Object.values(secs).reduce((x, y) => x + y, 0), share = k => (secs[k] || 0) / tot;
  assert.ok(share('paint') > 0.07 && share('paint') < 0.3, 'paints a lot but not all day (about 0.11 on average; the yarn and zoomies take some of the urge): ' + share('paint').toFixed(2));
  assert.ok(share('sleep') > 0.2 && share('eat') > 0.01, 'still sleeps and eats');
  ok(`over 6 days it paints ${(share('paint') * 100).toFixed(0)}% of the time and still sleeps (${(share('sleep') * 100).toFixed(0)}%) and eats`);
}

// ---------- temperament: Hunter ----------
{
  const pick = temper => { const w = calm(fresh(temper)); mouseAt(w, w.cat.x + 450, w.cat.y); return decide(w, null); };
  const h = pick('hunter'); assert.equal(h.type, 'hunt', 'a Hunter goes after prey 450 px away'); assert.equal(h.opts.prey.kind, 'mouse');
  assert.notEqual(pick(null).type, 'hunt', 'an ordinary cat does not notice it from that far');
  const wt = calm(fresh('hunter')); mouseAt(wt, wt.cat.x + 200, wt.cat.y); wt.cat.needs.tired = 0.9; wt.cat.needs.hunger = 0.05;
  assert.equal(decide(wt, null).type, 'hunt', 'it hunts when tired and well fed');
  ok('the Hunter spots prey from 560 px (others 300), and hunts when tired or full');

  const prey = temper => { let n = 0, hunts = 0; for (let r = 0; r < 5; r++) { const w = fresh(temper); let last = null; for (let i = 0; i < 6 * w.dayLen / 0.5; i++) { tick(w, 0.5); if (w.cat.act.type === 'hunt' && w.cat.act !== last) hunts++; last = w.cat.act; } n += w.stats.mice; } return { n, hunts }; };
  const ph = prey('hunter'), po = prey(null);
  assert.ok(ph.hunts > po.hunts * 2, `far more hunts: ${ph.hunts} vs ${po.hunts}`);
  assert.ok(ph.n > po.n, `and more mice caught: ${ph.n} vs ${po.n}`);
  ok(`over 30 cat-days the Hunter made ${ph.hunts} stalks (others ${po.hunts}) and caught ${ph.n} mice (others ${po.n})`);
}

// ---------- the rare bird catch ----------
{
  assert.ok(birdChance({ skill: 0.35 }) >= 0.05 && birdChance({ skill: 0.8 }) <= 0.1, 'about five to ten per cent per stalk, for every cat (the Hunter just stalks far more often)');
  
  const setup = stub => { setRandom(null); const w = calm(fresh(null)); const c = w.cat; c.x = 300; c.y = 420; const b = w.birds[0]; Object.assign(b, { state: 'ground', x: 440, y: 420, z: 0, alert: 0, timer: 99, hop: 99 }); start(w, 'hunt', { prey: b }); setRandom(stub); return { w, c, b }; };
  try {
    const { w, c, b } = setup(() => 0); // every lucky roll succeeds
    w.cat.needs.hunger = 0.9; w.cat.needs.thirst = 0.8; w.cat.needs.fun = 0.7; w.cat.needs.lonely = 0.9; const feathers = w.items.length;
    for (let i = 0; i < 160 && !w.stats.birds; i++) tick(w, 0.1);
    assert.equal(w.stats.birds, 1, 'the lucky pounce lands'); assert.equal(b.state === 'away' || b.state === 'fly', true);
    const n = c.needs; assert.ok(n.hunger < 0.02 && n.thirst < 0.02 && n.fun < 0.02 && n.lonely < 0.02, `hunger, thirst, boredom and loneliness are all emptied: ${[n.hunger, n.thirst, n.fun, n.lonely].map(v => v.toFixed(2))}`);
    assert.ok(w.items.length === feathers + 1 && w.items[w.items.length - 1].type === 'feather', 'a feather is left behind');
    assert.ok(w.log.some(e => /caught a bird/.test(e.text)) && w.journal.some(j => /caught a bird/.test(j.text)), 'noted and written in the diary'); assert.ok(w.hist.some(e => e.k === 'event' && /caught a bird/.test(e.text)), 'in the history');
    assert.equal(w.cat.act.type, 'eat'); assert.equal(runCommand(w, 'status', { admin: true }).lines.length > 0, true);
    ok('a lucky stalk catches the bird: all four needs emptied, a feather drops, and it is recorded');
    const u = setup(() => 0.999); // never lucky
    for (let i = 0; i < 250; i++) tick(u.w, 0.1);
    assert.equal(u.w.stats.birds || 0, 0, 'without luck the bird gets away'); ok('without the lucky roll, birds still escape');
  } finally { setRandom(null); }
}

// ---------- the frog ----------
{
  const w = calm(fresh(null)); meetFrog(w); const f = w.frog; assert.ok(f.name && f.out && f.bond > 0, 'meeting creates a friend');
  assert.ok(w.log.some(e => /made friends with a frog/.test(e.text)) && w.journal.some(j => /frog/i.test(j.text)), 'noted and in the diary');
  let ups = 0, was = f.out, outTicks = 0, N = 0; w.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 9e9 };
  for (let i = 0; i < 4 * w.dayLen / 0.5; i++) { w.cat.needs.lonely = 0.1; frogTick(w, 0.5); N++; if (f.out) outTicks++; if (f.out && !was) ups++; was = f.out; }
  assert.ok(ups >= 8, 'comes up several times a day: ' + ups); assert.ok(outTicks / N > 0.15 && outTicks / N < 0.5, 'is out a fraction of the time: ' + (outTicks / N).toFixed(2));
  ok(`the frog surfaces about ${(ups / 4).toFixed(0)} times a day and is out ${(100 * outTicks / N).toFixed(0)}% of the time`);

  // decisions: a lonely cat goes, a content one does not, and not when the frog is under water
  const dec = (lonely, out) => { const x = calm(fresh(null)); meetFrog(x); x.frog.out = out; x.frog.lastVisit = -999; x.cat.needs.lonely = lonely; return decide(x, null).type; };
  assert.equal(dec(0.8, true), 'frog'); assert.notEqual(dec(0.1, true), 'frog'); assert.notEqual(dec(0.8, false), 'frog');
  ok('a lonely cat goes to the frog when it is up; a content one or a hidden frog does not');

  // the visit: loneliness drops drastically
  const v = calm(fresh(null)); meetFrog(v); v.frog.out = true; v.frog.lastVisit = -999; v.cat.needs.lonely = 0.9; const bond0 = v.frog.bond;
  start(v, 'frog'); let ticks = 0; while (v.cat.act.type === 'frog' && ticks++ < 1200) tick(v, 0.1);
  assert.ok(v.cat.needs.lonely < 0.4, 'loneliness drops drastically: 0.90 -> ' + v.cat.needs.lonely.toFixed(2));
  assert.equal(v.frog.visits, 1); assert.ok(v.frog.bond > bond0 && !v.frog.out && v.stats.frogVisits === 1, 'the frog goes back under and they are closer');
  assert.ok(v.hist.some(e => e.k === 'did' && /Sitting with .* the frog|Going to see/.test(e.text)) && v.hist.some(e => /sat with/.test(e.text)), 'the history shows the visit');
  ok(`a visit takes loneliness from 0.90 to ${v.cat.needs.lonely.toFixed(2)} in ${(ticks / 10).toFixed(0)} seconds`);

  // living with a frog: it gets visited, and the cat is less lonely than one without
  const lonelyAvg = withFrog => { let sum = 0, cnt = 0, visits = 0; for (let r = 0; r < 4; r++) { const x = fresh(null); if (withFrog) meetFrog(x); for (let i = 0; i < 6 * x.dayLen / 0.5; i++) { tick(x, 0.5); if (i % 20 === 0) { sum += x.cat.needs.lonely; cnt++; } } visits += x.stats.frogVisits || 0; } return { avg: sum / cnt, visits }; };
  const wf = lonelyAvg(true), wo = lonelyAvg(false);
  assert.ok(wf.visits >= 12, 'it visits the frog regularly: ' + wf.visits); assert.ok(wf.avg < wo.avg - 0.03, `and is less lonely: ${wf.avg.toFixed(2)} vs ${wo.avg.toFixed(2)}`);
  ok(`over 24 cat-days: ${wf.visits} visits; average loneliness ${wf.avg.toFixed(2)} with the frog, ${wo.avg.toFixed(2)} without`);

  // saving
  const s = calm(fresh('hunter')); meetFrog(s); s.frog.visits = 3; s.frog.bond = 0.5; const s2 = deserialize(serialize(s));
  assert.equal(s2.frog.name, s.frog.name); assert.equal(s2.frog.visits, 3); assert.equal(s2.cat.temper, 'hunter'); assert.equal(s2.pace, 1);
  const none = fresh(null), n2 = deserialize(serialize(none)); assert.equal(n2.cat.temper, null, 'no temperament stays none');
  const old = fresh('hunter'); old.mysteries.ripples.solved = true; const j = JSON.parse(serialize(old)); delete j.cat.temper; delete j.w.frog; delete j.w.pace;
  const o2 = deserialize(JSON.stringify(j)); assert.ok(TEMPER_IDS.includes(o2.cat.temper), 'an older save gets a temperament: ' + o2.cat.temper); assert.ok(o2.frog && o2.frog.name, 'a cat that had already found the pond creature gets the frog'); assert.equal(o2.pace, 1);
  const p2 = fresh(null); p2.pace = 2.5; assert.equal(deserialize(serialize(p2)).pace, 2.5);
  ok('temperament, frog and pace survive a save; an older save upgrades (a temperament, and the frog if the pond mystery was solved)');
}

// ---------- the commands ----------
{
  const w = fresh(null), run = l => runCommand(w, l, { admin: true }).lines.join(' ');
  assert.match(run('quirk trait van-gogh'), /Van Gogh/); assert.equal(w.cat.temper, 'vangogh');
  assert.match(run('quirk trait night owl'), /Usage|Night owl|night/i); run('quirk trait nightowl'); assert.equal(w.cat.temper, 'nightowl');
  assert.match(run('quirk trait none'), /no temperament/); assert.equal(w.cat.temper, null); assert.match(run('quirk trait banana'), /Usage/);
  assert.match(run('frog'), /not found the frog yet/); assert.match(run('frog meet'), /found the frog/); assert.ok(w.frog); assert.match(run('frog'), /bond/);
  run('frog hide'); assert.equal(w.frog.out, false); run('frog out'); assert.equal(w.frog.out, true); run('frog visit'); assert.equal(w.cat.act.type, 'frog');
  assert.match(run('pace 3'), /longer/); assert.equal(w.pace, 3); assert.match(run('pace 0.5'), /faster/); assert.match(run('pace 99'), /4/); assert.equal(w.pace, 4); assert.match(run('pace'), /Discovery pace is 4/);
  for (const t of TEMPER_IDS) assert.ok(TEMPERS[t].name && TEMPERS[t].line);
  ok('admin commands: quirk trait, frog (meet/out/hide/visit), pace');
}

// ---------- catching up while away still works with all of it ----------
{
  for (const t of [...TEMPER_IDS, null]) { const w = fresh(t); meetFrog(w); const r = catchUp(w, 3 * 3600); assert.ok(Number.isFinite(w.cat.needs.lonely) && r.days >= 8, 'catch-up runs for ' + t); }
  ok('catching up three hours works for every temperament, with a frog');
}

// ---------- a wash always ends: it once hung in the 'dry off in the sun' step when the patch of sun was somewhere it could not reach ----------
{
  for (let i = 0; i < 40; i++) {
    const w = fresh(null), c = w.cat; w.clock = (9 + (i % 8)) / 24 * w.dayLen; w.weather.rain = 0; w.weather.cloud = 0; Object.assign(c.mem.known, { pond: 1, cushion: 1, post: 1, tree: 1, flowers: 1 });
    c.needs.dirty = 0.9; c.needs.wet = 0.8; c.x = 40 + (i * 23) % 880; c.y = 300 + (i * 17) % 220;
    start(w, 'wash'); let t = 0; while (c.act.type === 'wash' && t < 120) { c.reeval = 1e9; tick(w, 0.25); t += 0.25; }
    assert.ok(c.act.type !== 'wash', `wash ${i} ended (it ran ${t.toFixed(0)}s)`); assert.ok(t < 75, `wash ${i} took ${t.toFixed(0)}s`);
  }
  const w = fresh(null), c = w.cat; w.clock = 11 / 24 * w.dayLen; w.weather.rain = 0; w.weather.cloud = 0; c.mem.known.cushion = 1; start(w, 'wash');
  c.act.phase = 'dry'; c.act.t = 0; w.weather.cloud = 1; c.reeval = 1e9; tick(w, 0.5); tick(w, 0.5); assert.equal(c.act.phase, 'shake', 'when the sun goes in it stops drying and shakes off');
  ok('washing always ends, including when the sun patch goes in or cannot be reached');
}

console.log('\nALL OK');
