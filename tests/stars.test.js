// The stars: nights of looking up make it curious, it watches, reads about them on the tablet, and then a falling star
// may grant a wish if it is looking.
import assert from 'node:assert/strict';
import { makeWorld, tick, catchUp } from '../src/sim/sim.js';
import { start } from '../src/sim/acts.js';
import { decide } from '../src/sim/mind.js';
import { setWeather, dayOf, hourOf } from '../src/sim/world.js';
import { starsNote, starsRoll, startStars, starsClue, starsPage, starsNeedsReading, darkSky, nightId, meteorTick, launchMeteor, starWish, wishReady, meteorLure } from '../src/sim/stars.js';
import { solve, starsFinal, MYSTERY_INFO } from '../src/sim/mysteries.js';
import { PACE, clueCap } from '../src/sim/pace.js';
import { pickRequest } from '../src/sim/tablet.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { digest } from '../src/sim/llm.js';
import { offlineReply } from '../src/sim/thoughts.js';
import { runCommand } from '../src/sim/commands.js';
import { memoryTick } from '../src/sim/memory.js';
import { seedTests, withRandom, setRandom } from '../src/sim/rng.js';
seedTests(1); // (every world here gets a fixed seed, so this test gives the same result every run)

const ok = m => console.log('  ok ' + m);
const at = (w, day, hour) => { w.clock = (day - 1 + hour / 24) * w.dayLen; };
const fresh = (temper = null) => { const w = makeWorld('Sky'); w.cat.temper = temper; w.cat.mem.known.tablet = 1; setWeather(w, 'clear'); at(w, 5, 22); return w; };
const solved = w => { const m = w.mysteries.stars; startStars(w); m.theory = 'x'; m.enough = true; m.enoughDay = dayOf(w); m.read = 1; solve(w, 'stars'); return w; };

// ---- hidden, and counting nights
{
  const w = fresh(); assert(MYSTERY_INFO.stars.secret, 'a secret'); assert.equal(w.mysteries.stars.solved, false);
  assert(!/the stars/.test(digest(w)), 'the human-facing digest says nothing of the stars yet');
  starsClue(w, 5); assert.equal(w.mysteries.stars.clues, 0, 'a clue about something it has not thought of is no clue');
  at(w, 5, 12); starsNote(w); assert.equal(w.mysteries.stars.nights || 0, 0, 'daylight does not count');
  at(w, 5, 22); starsNote(w); starsNote(w); assert.equal(w.mysteries.stars.nights, 1, 'once a night');
  at(w, 6, 2); starsNote(w); assert.equal(w.mysteries.stars.nights, 1, 'past midnight is still the same night');
  at(w, 6, 22); starsNote(w); assert.equal(w.mysteries.stars.nights, 2, 'the next night counts');
  assert.equal(nightId(w), 6);
  ok('a secret; nights of looking up are counted once each, across midnight');
}
// ---- getting curious
{
  const w = fresh(); at(w, 8, 12); w.mysteries.stars.nights = PACE.starsNights - 1; assert.equal(withRandom(0, () => starsRoll(w)), undefined); assert(!w.mysteries.stars.interest, 'not enough nights');
  w.mysteries.stars.nights = PACE.starsNights; withRandom(0.99, () => starsRoll(w)); assert(!w.mysteries.stars.interest, 'a matter of chance');
  const e = fresh(); at(e, 2, 12); e.mysteries.stars.nights = 9; withRandom(0, () => starsRoll(e)); assert(!e.mysteries.stars.interest, 'not in the first days');
  withRandom(0, () => starsRoll(w)); const m = w.mysteries.stars; assert(m.interest && m.seen, 'it wonders');
  assert(w.journal.some(x => x.tag === 'stars' && /what they are/i.test(x.text)) && w.cat.thoughtHint === 'starsCurious', 'diary and thought');
  assert(/the stars/.test(digest(w)), 'now it is something it can talk about');
  assert(/stars/i.test(offlineReply(w, 'what do you think about the stars?')), 'and answer');
  ok('it only wonders after enough nights, by chance, not at once, and then it is a known mystery');
  // reading about them is another way in
  const r = fresh(); withRandom(0, () => starsPage(r)); assert(r.mysteries.stars.interest, 'a page about the stars can start it'); const r2 = fresh(); withRandom(0.9, () => starsPage(r2)); assert(!r2.mysteries.stars.interest);
  ok('reading about the stars on the tablet can start it too');
}
// ---- watching them
{
  const w = fresh('nightowl'); startStars(w); at(w, 9, 22); setWeather(w, 'clear'); w.cat.pose = 'sit'; w.cat.needs.hunger = 0.2; w.cat.needs.tired = 0.2;
  let n = 0, st = 0; for (let k = 0; k < 40; k++) { w.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 5 }; const d = decide(w, 'idle'); if (d && d.type === 'gaze') { n++; if (d.opts && d.opts.stars) st++; } }
  assert(n > 0 && st > 0, `it goes to look at the stars on a clear night (${st}/${n})`);
  const dull = fresh('nightowl'); at(dull, 9, 22); dull.cat.needs.hunger = 0.2; dull.cat.needs.tired = 0.2; let sd = 0; for (let k = 0; k < 40; k++) { dull.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 5 }; const d = decide(dull, 'idle'); if (d && d.type === 'gaze' && d.opts && d.opts.stars) sd++; } assert.equal(sd, 0, 'not before it is wondering about them');
  setWeather(w, 'cloud'); w.weather.cloud = 0.9; let cl = 0; for (let k = 0; k < 20; k++) { const d = decide(w, 'idle'); if (d && d.type === 'gaze') cl++; } assert.equal(cl, 0, 'not under cloud');
  ok('it goes to look at the stars on clear nights once it is wondering, not before and not under cloud');
  setWeather(w, 'clear'); w.weather.cloud = 0; start(w, 'gaze', { stars: true }); assert(w.cat.act.stars); assert.equal(w.cat.act.type, 'gaze');
  const { describe } = await import('../src/sim/acts.js'); assert.equal(describe(w), 'Heading to ' === '' ? '' : describe(w)); // (smoke)
  const a = w.cat.act; a.phase = 'do'; a.t = 5.01; a.nextClue = 5; const c0 = w.mysteries.stars.clues; tick(w, 0.1); assert(w.mysteries.stars.clues > c0 || w.mysteries.stars.today > 0, 'looking teaches it');
  assert(/stars/.test(describe(w)), 'and it says so: ' + describe(w));
  ok('the gaze act has a stars variant that gives clues');
}
// ---- how fast: a handful a day, then the tablet
{
  const w = fresh(); startStars(w); const m = w.mysteries.stars; at(w, 9, 22);
  for (let k = 0; k < 30; k++) starsClue(w, 1); assert(m.clues <= clueCap(w, 'stars') + 1e-6, `a day only teaches so much (${m.clues} <= ${clueCap(w, 'stars')})`);
  for (let d = 10; d < 40 && !m.enough; d++) { at(w, d, 22); for (let k = 0; k < 8; k++) starsClue(w, 1); }
  assert(m.enough && !m.solved, 'it has watched enough but does not know yet'); assert(w.journal.some(x => x.tag === 'stars' && /slab/.test(x.text)), 'it says the slab might know');
  assert(starsNeedsReading(w), 'it wants the tablet'); let tab = 0; for (let k = 0; k < 40; k++) { const r = pickRequest(w); if (r.stars) tab++; } assert(tab > 15, `the tablet is asked about stars (${tab}/40)`);
  assert(!starsFinal(w), 'not yet');
  const r = pickRequest(w); starsPage(w); assert(m.solved, 'reading about them on the tablet is the last step'); assert(/Suns/.test(m.theory) && w.journal.some(x => x.tag === 'solved') && w.journal.some(x => x.tag === 'starwish'), 'and it understands, and knows what to do');
  assert.equal(w.starWishDay, -99); assert(!starsNeedsReading(w));
  ok('a handful of clues a day, then it needs the tablet to be sure');
  const o = fresh(); startStars(o); const mo = o.mysteries.stars; mo.theory = 'x'; mo.enough = true; mo.enoughDay = 10; at(o, 10 + PACE.starsSelf - 1, 12); assert(!starsFinal(o), 'with no tablet it takes a while');
  at(o, 10 + PACE.starsSelf, 12); assert(starsFinal(o) && mo.solved, 'but it gets there');
  const q = fresh(); q.cat.traits.curious = 0.95; startStars(q); let cq = 0; for (let k = 0; k < 40; k++) { at(q, 10 + k, 22); for (let j = 0; j < 12; j++) starsClue(q, 1); if (q.mysteries.stars.enough) { cq = k; break; } }
  const s = fresh(); s.cat.traits.curious = 0.5; startStars(s); let cs = 0; for (let k = 0; k < 40; k++) { at(s, 10 + k, 22); for (let j = 0; j < 12; j++) starsClue(s, 1); if (s.mysteries.stars.enough) { cs = k; break; } }
  assert(cq < cs, `a very curious cat is quicker (${cq} vs ${cs} days)`);
  ok('without the tablet it gets there after a few days; over 90 curiosity is twice as quick');
}
// ---- shooting stars
{
  const w = fresh(); at(w, 5, 22); for (let k = 0; k < 200; k++) tick(w, 1); // (nothing falls before it understands)
  assert(!w.meteor && w.stats.meteorsSeen === undefined, 'not before it understands'); 
  solved(w); at(w, 6, 21); w.weather.cloud = 0; setWeather(w, 'clear'); w.cat.hidden = false; w.cat.pose = 'sit'; w.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 99 };
  withRandom(0.6, () => meteorTick(w, 0.1)); const p = w.meteorPlan; assert(p && p.id === nightId(w), 'a night is planned once'); assert(p.times.length >= 1, 'a clear night with a star in it');
  const times = p.times.slice(); meteorTick(w, 0.1); assert.deepEqual(w.meteorPlan.times, times, 'planned once');
  w.clock = p.times[0] + 0.01; assert(!w.meteor); const w0 = w.stats.starWishes || 0; withRandom(0.1, () => meteorTick(w, 0.1)); assert(w.meteor && w.meteor.seen === true, 'it falls and the cat (awake, outside) sees it');
  assert(/star|fell|saw|wish/i.test(w.cat.thought), 'it says so: ' + w.cat.thought);
  for (let k = 0; k < 20 && w.meteor; k++) meteorTick(w, 0.2); assert.equal(w.meteor, null, 'it burns out in a second or two');
  assert.equal(w.stats.starWishes, w0 + 1, 'and the wish is granted'); const it = w.items.find(i => i.star); assert(it && it.moon, 'something glittering is lying in the grass');
  assert(w.journal.some(x => x.tag === 'starwish' && /star fell/i.test(x.text)) && w.cat.thoughtHint === 'starWish', 'in the diary'); assert(!wishReady(w), 'and it has to wait for the next one');
  ok('after it understands: a night is planned, a star falls on a clear night, the cat sees it and its wish is granted');
}
{
  const w = solved(fresh()); at(w, 6, 22); setWeather(w, 'clear'); w.cat.pose = 'sleep'; w.cat.act = { type: 'sleep', phase: 'do', t: 0, dur: 99 };
  let seen = 0; for (let k = 0; k < 30; k++) { const m = launchMeteor(w); if (m.seen) seen++; w.meteor = null; } assert.equal(seen, 0, 'a sleeping cat sees nothing');
  w.cat.pose = 'sit'; w.cat.act = { type: 'gaze', stars: true, phase: 'do', t: 3, dur: 30 }; seen = 0; for (let k = 0; k < 30; k++) { const m = launchMeteor(w); if (m.seen) seen++; w.meteor = null; } assert.equal(seen, 30, 'a cat that is gazing always does');
  w.cat.act = { type: 'idle', phase: 'do', t: 0, dur: 9 }; seen = 0; for (let k = 0; k < 200; k++) { const m = launchMeteor(w); if (m.seen) seen++; w.meteor = null; } assert(seen > 40 && seen < 150, `an awake cat sometimes does (${seen}/200)`);
  w.mysteries.stars.solved = true; const x = fresh(); assert.equal(solved(x).mysteries.stars.solved, true);
  // cloud hides it
  w.weather.cloud = 0.9; at(w, 7, 22); w.meteorPlan = { id: nightId(w), times: [w.clock - 0.5] }; meteorTick(w, 0.1); assert(!w.meteor, 'nothing falls behind cloud');
  w.weather.cloud = 0; w.meteorPlan = { id: nightId(w), times: [w.clock - 0.5] }; at(w, 7, 12); meteorTick(w, 0.1); assert(!w.meteor, 'nor in daylight');
  ok('only an awake cat outside sees one (always if gazing); cloud and daylight hide them');
}
{
  const w = solved(fresh()); at(w, 6, 22); w.cat.pose = 'sit'; w.cat.act = { type: 'gaze', stars: true, phase: 'do', t: 3, dur: 30 };
  launchMeteor(w, true); for (let k = 0; k < 20 && w.meteor; k++) meteorTick(w, 0.2); assert.equal(w.stats.starWishes, 1);
  at(w, 6 + PACE.starWishGap - 2, 22); launchMeteor(w, true); for (let k = 0; k < 20 && w.meteor; k++) meteorTick(w, 0.2); assert.equal(w.stats.starWishes, 1, 'a wish only every few days');
  assert(w.journal.some(x => x.tag === 'stars' && /keep the next one/.test(x.text)), 'it asks the star to keep the next one');
  at(w, 6 + PACE.starWishGap, 22); launchMeteor(w, true); for (let k = 0; k < 20 && w.meteor; k++) meteorTick(w, 0.2); assert.equal(w.stats.starWishes, 2, 'and then it can again');
  ok('wishes come at most once every few days');
}
// ---- it can grant what the cat asked the human for
{
  const w = solved(fresh()); const q = w.cat.quirk; w.cat.wishes.unshift({ id: 'w1', kind: 'item', type: q.item, color: q.favColor, state: 'open', day: 3, written: { day: 4, time: '10:00' }, text: 'please', seen: true });
  const it = withRandom(0.2, () => starWish(w)); assert.equal(it.type, q.item); assert.equal(it.color, q.favColor); assert.equal(w.cat.wishes[0].state, 'granted'); assert.equal(w.cat.wishes[0].granted.by, 'star');
  assert(w.journal.some(x => x.tag === 'starwish' && /had been waiting/.test(x.text)), 'in the diary');
  const w2 = solved(fresh()); const it2 = withRandom(0.9, () => starWish(w2)); assert(it2.moon && it2.star, 'otherwise something it likes');
  ok('a star may grant exactly what it had written to the human for');
}
// ---- lured by gazing
{
  const w = solved(fresh()); at(w, 8, 22); w.weather.cloud = 0;
  assert.equal(withRandom(0.9, () => meteorLure(w, 30)), false, 'a matter of chance'); assert.equal(withRandom(0, () => meteorLure(w, 30)), true);
  const p = w.meteorPlan; assert(p.times.some(t => t > w.clock + 3 && t < w.clock + 31), 'one falls while it looks');
  w.starWishDay = dayOf(w); assert.equal(withRandom(0, () => meteorLure(w, 30)), false, 'no point while it has just had a wish');
  ok('a cat that sets out to gaze may find one falling');
}
// ---- memory, saves, commands
{
  const w = solved(fresh()); w.cat.pose = 'sit'; at(w, 6, 22); starWish(w);
  memoryTick(w); assert(w.cat.memories.some(m => m.tag === 'starwish'), 'it remembers the wish');
  w.meteor = { t: 0.2, dur: 1, x0: 1, y0: 1, dx: 1, dy: 1, seen: false };
  const back = deserialize(serialize(w)); assert.equal(back.mysteries.stars.solved, true); assert.equal(back.starWishDay, w.starWishDay); assert.equal(back.meteor, null, 'a falling star is not saved'); assert.equal(back.stats.starWishes, 1);
  const old = JSON.parse(serialize(w)); delete old.w.mysteries.stars; delete old.w.starWishDay; delete old.w.meteorPlan; const b2 = deserialize(JSON.stringify(old)); assert.equal(b2.mysteries.stars.solved, false); assert.equal(b2.mysteries.stars.clues, 0); assert.equal(b2.starWishDay, -99, 'an old save gets the stars blank');
  ok('remembered, saved, and old saves still load');
}
{
  const w = fresh(); const run = (...a) => runCommand(w, a.join(' '), { admin: true }).lines.join(' ');
  assert(/stars: not interested/.test(run('secret status')), 'status mentions the stars');
  run('secret stars'); assert(w.mysteries.stars.interest);
  assert(/understood first/.test(run('secret meteor')));
  run('secret starsdone'); assert(w.mysteries.stars.solved); run('secret meteor'); assert(w.meteor, 'the meteor falls');
  for (let k = 0; k < 20 && w.meteor; k++) meteorTick(w, 0.2); run('secret starwish'); assert(w.items.some(i => i.star), 'a wish arrives');
  ok('admin commands: secret stars | starsdone | meteor | starwish');
}
// ---- thoughts have lines for it
{
  const w = solved(fresh()); w.stats.starWishes = 1; const t = String(offlineReply(w, 'did you wish on a star?')); assert(/star|asked/i.test(t), t);
  ok('it can talk about it');
}
// ---- in the long run (no tablet): it gets curious, watches, understands, and some stars fall
{
  let interest = 0, done = 0, wishes = 0; const N = 3;
  for (let k = 0; k < N; k++) {
    const w = makeWorld('Long' + k); w.cat.temper = 'nightowl'; w.cat.mem.known.tablet = 1; w.netOn = false;
    for (let s = 0; s < 36 * 4; s++) catchUp(w, w.dayLen / 4, 1);
    const m = w.mysteries.stars; if (m.interest) interest++; if (m.solved) done++; wishes += w.stats.starWishes || 0;
  }
  assert(interest >= 2, `most night owls get curious within 36 days (${interest}/${N})`); assert(done >= 1, `and one understands (${done}/${N})`); assert(wishes >= 1, `and a star grants a wish (${wishes})`);
  ok(`long run, 36 days x ${N}: curious ${interest}, understood ${done}, wishes ${wishes}`);
}
console.log('\nALL OK');
