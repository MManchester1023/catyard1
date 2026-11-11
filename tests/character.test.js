// Character: moods of the day, habits and rituals, stubborn impulses, and slow change over time.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { decide } from '../src/sim/mind.js';
import { start } from '../src/sim/acts.js';
import { journal, dayOf } from '../src/sim/world.js';
import { ensureChar, rollMood, moodToday, MOODS, noteAct, habitPull, stubPull, rollImpulse, characterTick, drift, HABIT_DAYS, MAX_HABITS, slotOf, habitLine, characterDigest, stubbornness } from '../src/sim/character.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { offlineReply } from '../src/sim/thoughts.js';
import { digest } from '../src/sim/llm.js';
import { TEMPER_IDS } from '../src/sim/temper.js';
import { seedTests, withRandom, setRandom } from '../src/sim/rng.js';
seedTests(1); // (every world here gets a fixed seed, so this test gives the same result every run)

const ok = m => console.log('  ok ' + m);
const fresh = (temper = null) => { const w = makeWorld('Chr'); w.cat.temper = temper; return w; };
const atHour = (w, day, h) => { w.clock = (day - 1) * w.dayLen + (h / 24) * w.dayLen; };

// ---- moods of the day: weighted by nature and circumstance, never decided by them
{
  const tally = (temper, rain) => { const t = {}; for (let i = 0; i < 2000; i++) { const w = fresh(temper); w.cat.traits = { curious: 0.5, bold: 0.5, affection: 0.5, lazy: 0.5 }; w.weather.rain = rain ? 1 : 0; atHour(w, 3, 7); const k = rollMood(w); t[k] = (t[k] || 0) + 1; } return t; };
  const a = tally(null, false), g = tally('garfield', true);
  assert.equal(Object.keys(a).length, Object.keys(MOODS).length, 'every mood turns up: ' + JSON.stringify(a));
  assert(Math.max(...Object.values(a)) < 2000 * 0.4, 'and none of them is most days: ' + JSON.stringify(a));
  assert((g.lazy || 0) > (a.lazy || 0) * 1.4, `a Garfield on a rainy day is lazy much more often (${g.lazy} vs ${a.lazy})`);
  const w = fresh(); w.cat.mood.joy = 0.5; atHour(w, 3, 7); withRandom(0.999, () => rollMood(w)); assert.equal(moodToday(w).label, 'chipper'); assert(w.cat.mood.joy > 0.55, 'chipper starts happy');
  ok('moods: all of them happen, none dominates, nature and weather tilt the odds');
}
// ---- once a morning, not at midnight
{
  const w = fresh(); atHour(w, 2, 2); w.cat.dayMood = { day: 1, kind: 'lazy' }; w.scoreSnap = {}; characterTick(w); assert.equal(w.cat.dayMood.kind, 'lazy', 'not at 2am');
  atHour(w, 2, 7); characterTick(w); assert.equal(w.cat.dayMood.day, 2, 'at 7am a new mood'); const m = w.cat.dayMood; characterTick(w); assert.equal(w.cat.dayMood, m, 'only once');
  ok('a new mood with the morning, once');
}
// ---- the mood tilts what it fancies
{
  const scores = (kind, f) => { const w = fresh(); const c = w.cat; atHour(w, 5, 12); c.traits = { curious: 0.5, bold: 0.5, affection: 0.5, lazy: 0.3 }; Object.assign(c.needs, { hunger: 0, thirst: 0, tired: 0.3, fun: 0.5, dirty: 0.2, create: 0, lonely: 0.2, fear: 0 }); w.weather.rain = 0; w.weather.cloud = 0; c.dayMood = { day: 5, kind }; if (f) f(w); withRandom(0.5, () => decide(w, null)); return Object.assign({}, w.scoreSnap); };
  const s = scores('steady'), l = scores('lazy'), r = scores('restless');
  assert(Math.abs(l.idle / s.idle - 1.3) < 1e-6 && Math.abs(l.explore / s.explore - 0.7) < 1e-6, 'lazy: more idling, less wandering');
  assert(Math.abs(r.idle / s.idle - 0.65) < 1e-6 && r.explore > s.explore * 1.15 && r.play > s.play * 1.25, 'restless: the opposite');
  ok('the mood scales what it fancies (and nothing else)');
}

// ---- habits
{
  const w = fresh(); const c = ensureChar(w.cat);
  const doIt = (day, h, type = 'frog') => { atHour(w, day, h); c.act = { type, phase: 'do', t: 0 }; noteAct(w); };
  for (let d = 1; d < HABIT_DAYS; d++) doIt(d, 8); assert.equal(c.habits.length, 0, 'not a habit yet');
  doIt(HABIT_DAYS, 8); assert.equal(c.habits.length, 1); assert.deepEqual([c.habits[0].key, c.habits[0].slot], ['act:frog', 'morning']);
  assert(w.journal.some(e => e.tag === 'habit' && /ritual/.test(e.text) && /every morning/.test(e.text)), 'it notices');
  doIt(HABIT_DAYS, 8.5); assert.equal(c.habits.length, 1, 'once');
  // the same thing at a different time of day is not the same habit
  for (let d = 1; d <= HABIT_DAYS; d++) doIt(d, 19); assert.equal(c.habits.length, 2); assert.equal(c.habits[1].slot, 'evening');
  // at most three
  for (const t of ['paint', 'gaze', 'craft']) for (let d = 1; d <= HABIT_DAYS; d++) doIt(d, 13, t); assert.equal(c.habits.length, MAX_HABITS);
  assert.equal(slotOf(2), 'night'); assert.equal(slotOf(23), 'night'); assert.equal(slotOf(7), 'morning'); assert.equal(slotOf(12), 'midday'); assert.equal(slotOf(18), 'evening');
  ok('habits: same thing, same part of the day, several days; at most three');
}
{
  const w = fresh(); const c = ensureChar(w.cat); atHour(w, 10, 8);
  c.habits = [{ key: 'act:frog', slot: 'morning', since: 3, last: 9, times: 6 }];
  assert.equal(habitPull(w, 'frog'), 0.3, 'it pulls at its hour'); atHour(w, 10, 14); assert.equal(habitPull(w, 'frog'), 0, 'not at other hours'); atHour(w, 10, 8);
  c.act = { type: 'frog', phase: 'do', t: 0 }; const j0 = c.mood.joy; c.needs.fear = 0.3; noteAct(w); assert(c.mood.joy > j0 && c.needs.fear < 0.3, 'keeping it is comforting'); assert.equal(habitPull(w, 'frog'), 0, 'done for today');
  atHour(w, 17, 8); c.dayMood.day = 16; w.scoreSnap = {}; characterTick(w); assert.equal(c.habits.length, 0, 'a habit that is not kept up fades');
  assert(w.journal.some(e => e.tag === 'habit' && /not done/.test(e.text)));
  ok('a habit pulls at its hour, comforts when kept, and fades when it is not');
}

// ---- stubborn impulses
{
  const w = fresh(); const c = ensureChar(w.cat); c.traits.bold = 1; c.traits.affection = 0.1; assert(stubbornness(c) > 0.8);
  w.scoreSnap = { idle: 0.3, frog: 0.5, paint: 0.4, explore: 0.2, sleep: 0.1, eat: 0, tablet: 0, hunt: 0.9, wash: 0.9 }; atHour(w, 4, 12);
  const s = withRandom(0, () => rollImpulse(w)); assert(s && ['frog', 'paint', 'explore'].includes(s.key), 'a notion about something it could do right now: ' + (s && s.key));
  assert.equal(rollImpulse(w), null, 'one at a time'); assert(/going to|notion/.test(c.thought), 'it says so: ' + c.thought);
  assert.equal(stubPull(w, s.key), 0.55); assert.equal(stubPull(w, 'idle'), 0);
  w.clock += w.dayLen; assert.equal(stubPull(w, s.key), 0, 'and it passes');
  // not when it has real needs
  const h = fresh(); ensureChar(h.cat); h.scoreSnap = { frog: 0.5 }; h.cat.needs.hunger = 0.9; assert.equal(withRandom(0, () => rollImpulse(h)), null, 'hungry: no notions');
  // fulfilling it
  const f = fresh(); const fc = ensureChar(f.cat); fc.stub = { key: 'frog', until: f.clock + 100, day: 1 }; fc.act = { type: 'frog', phase: 'do', t: 0 }; const j0 = fc.mood.joy; noteAct(f); assert.equal(fc.stub, null, 'seen through'); assert(fc.mood.joy > j0);
  ok('impulses: a notion about something it can do now, one at a time, not when it has real needs, ends when it gets its way');
}
{
  // it will not be argued out of it - but hunger and sleep still win in decide()
  const set = hunger => { const w = fresh(); const c = ensureChar(w.cat); atHour(w, 5, 12); c.traits = { curious: 0, bold: 0.5, affection: 0.5, lazy: 0 }; Object.assign(c.needs, { hunger, thirst: 0, tired: 0.3, fun: 0, dirty: 0.2, create: 0, lonely: 0.2, fear: 0 });
    w.frog = { name: 'Pip', out: true, lastVisit: -1e9, bond: 0, visits: 0 }; w.weather.rain = 0; w.weather.cloud = 0; w.weather.type = 'clear'; w.o.bowl.food = 0; c.dayMood = { day: 5, kind: 'steady' }; c.stub = { key: 'frog', until: w.clock + 200, day: 5 }; return w; };
  const a = set(0.3); assert.equal(withRandom(0.5, () => decide(a, null)).type, 'frog', 'the notion wins when it is calm');
  const b = set(0.3); b.cat.stub = null; assert.notEqual(withRandom(0.5, () => decide(b, null)).type, 'frog');
  const c = set(0.9); withRandom(0.5, () => decide(c, null)); const base = set(0.9); base.cat.stub = null; withRandom(0.5, () => decide(base, null));
  assert.equal(c.scoreSnap.frog, base.scoreSnap.frog, 'but not when it is hungry');
  ok('a notion beats a mild preference, never hunger');
}

// ---- change over time
{
  const yesterday = (w, secs, tags = []) => { const day = dayOf(w); w.days = w.days || {}; w.days[day - 1] = { secs, ev: [] }; for (const t of tags) { w.journal.unshift({ id: ++w.logId, day: day - 1, time: '10:00', text: 'x', tag: t }); } };
  const w = fresh(); const c = ensureChar(w.cat); c.traits = { curious: 0.5, bold: 0.5, affection: 0.5, lazy: 0.5 }; Object.assign(c.base, c.traits); atHour(w, 10, 7);
  yesterday(w, { investigate: 300, gaze: 200, sleep: 300, hunt: 100 }, ['discover', 'discover', 'solved', 'frog']);
  const before = { ...c.traits }; drift(w);
  assert(c.traits.curious > before.curious && c.traits.curious - before.curious <= 0.0121, 'a day of wondering makes it a little more curious');
  assert(c.traits.bold > before.bold && c.traits.affection > before.affection);
  // an upset day makes it more careful
  const u = fresh(); const uc = ensureChar(u.cat); uc.traits = { curious: 0.5, bold: 0.5, affection: 0.5, lazy: 0.5 }; Object.assign(uc.base, uc.traits); atHour(u, 10, 7); yesterday(u, { sleep: 500, idle: 100 }, ['upset']); drift(u);
  assert(uc.traits.bold < 0.5 && uc.traits.lazy > 0.5, 'upset and sleepy: more careful, lazier');
  // slow: a hundred days of the same thing only gets so far, and it says so as it goes
  const m = fresh(); const mc = ensureChar(m.cat); mc.traits = { curious: 0.5, bold: 0.5, affection: 0.5, lazy: 0.5 }; Object.assign(mc.base, mc.traits);
  for (let d = 2; d < 120; d++) { atHour(m, d, 7); yesterday(m, { investigate: 400, gaze: 100 }, ['discover', 'discover', 'discover']); drift(m); }
  assert(Math.abs(mc.traits.curious - 0.75) < 1e-9, 'capped at 0.25 from where it started: ' + mc.traits.curious);
  const said = m.journal.filter(e => e.tag === 'change' && /more curious/.test(e.text)); assert.equal(said.length, 2, 'it noticed twice (0.1 and 0.2 of change) and no more: ' + said.length);
  assert(mc.traits.lazy >= 0.05 && mc.traits.lazy <= 0.98);
  ok('change: slow, bounded, and it notices');
}

// ---- it shows
{
  const w = fresh(); const c = ensureChar(w.cat); c.dayMood = { day: 1, kind: 'restless' }; c.habits = [{ key: 'act:frog', slot: 'morning', since: 1, last: 1, times: 4 }]; c.traits.bold = 0.9; c.base.bold = 0.5;
  assert(/Restless today/.test(offlineReply(w, 'how are you?')), offlineReply(w, 'how are you?'));
  assert(/Visiting the frog every morning/.test(offlineReply(w, 'do you have a routine?')));
  assert(/Not yet|do not have a routine/.test(offlineReply(fresh(), 'do you have a routine?')));
  const d = digest(w); assert(/mood today: restless/.test(d) && /Your habits and rituals: visiting the frog every morning/.test(d) && /bolder/.test(d), d);
  assert.equal(offlineReply(Object.assign(fresh(), {}), 'how are you?').length > 0, true);
  ok('chat and the Claude briefing know its mood, habits and changes');
}
// ---- saves
{
  const w = fresh(); const c = ensureChar(w.cat); c.dayMood = { day: 3, kind: 'dreamy' }; c.habits = [{ key: 'act:paint', slot: 'morning', since: 1, last: 2, times: 4 }]; c.traits.bold = 0.9; c.stub = { key: 'frog', until: 99, day: 3 };
  const w2 = deserialize(serialize(w)); assert.equal(w2.cat.dayMood.kind, 'dreamy'); assert.equal(w2.cat.habits.length, 1); assert.equal(w2.cat.base.bold, c.base.bold); assert.equal(w2.cat.stub.key, 'frog');
  const old = JSON.parse(serialize(w)); for (const k of ['dayMood', 'habits', 'base', 'stub', 'slotLog', 'driftSaid']) delete old.cat[k]; const w3 = deserialize(JSON.stringify(old));
  assert(w3.cat.dayMood && Array.isArray(w3.cat.habits) && w3.cat.base.curious === w3.cat.traits.curious, 'an old save starts from the character it has');
  ok('saves round-trip; old saves start from their current character');
}
// ---- three weeks of life for every kind of cat
{
  for (const t of [null, ...TEMPER_IDS]) {
    const w = fresh(t); w.cat.mem.known.tablet = 1; const b = { ...w.cat.traits };
    for (let i = 0; i < 21 * 1200 / 0.5; i++) tick(w, 0.5);
    const c = w.cat; assert(c.habits.length <= MAX_HABITS && w.journal.length > 0);
    for (const k of Object.keys(b)) assert(c.traits[k] >= 0.05 && c.traits[k] <= 0.98 && Math.abs(c.traits[k] - c.base[k]) <= 0.2501, `${t} ${k}`);
    assert(Object.values(c.traits).every(Number.isFinite) && c.dayMood.day >= 20, `${t}: it has had moods`);
  }
  ok('21 days for every kind of cat: nothing breaks, traits stay in range');
}
console.log('character tests passed');
