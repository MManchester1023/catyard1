// Balance tripwire: runs the cat through several days under each temperament and checks that the everyday rhythm stays
// inside a band (sleep share, night wakefulness, hunts and meals per day, no starving or dying of thirst, still painting).
// The bands are the measured values widened by about a third. They are NOT ideals: if a
// tuning change moves a number out on purpose, check it feels right, then move the band here with a note in the commit.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { hourOf } from '../src/sim/world.js';
import { TEMPER_IDS } from '../src/sim/temper.js';
import { seedTests } from '../src/sim/rng.js';

const DAYS = 8, SEEDS = [3, 7];
// measured (8 days, seeds 1-16, every temperament): sleep .41-.64, night awake .08-.30 (night owl .37-.54), hunts/day 0-1.8 (hunter 2.6-6.3),
// meals/day 3.9-8.9 (garfield highest), hungry>0.9 at most 7% of the time, thirsty>0.9 at most 12.5%
const BAND = {
  sleep: [0.35, 0.70], night: [0.05, 0.35], nightowl: [0.30, 0.65],
  hunts: [0, 3], hunterHunts: [2, 7.5], meals: [3, 11], hungerHi: 0.10, thirstHi: 0.18,
};

const run = (seed, temper) => {
  seedTests(seed); const w = makeWorld('Bal' + seed); w.netOn = false; const c = w.cat; c.temper = temper;
  let n = 0, sleep = 0, nightN = 0, nightAwake = 0, hungerHi = 0, thirstHi = 0;
  for (let i = 0; i < DAYS * w.dayLen * 10; i++) {
    tick(w, 0.1); n++;
    const asleep = !!(c.act && c.act.type === 'sleep'), h = hourOf(w);
    if (asleep) sleep++;
    if (h >= 22 || h < 5) { nightN++; if (!asleep) nightAwake++; }
    if (c.needs.hunger > 0.9) hungerHi++;
    if (c.needs.thirst > 0.9) thirstHi++;
  }
  const s = w.stats;
  return { sleep: sleep / n, night: nightAwake / nightN, hunts: (s.mice + s.misses) / DAYS, meals: s.meals / DAYS, paint: s.paintings, hungerHi: hungerHi / n, thirstHi: thirstHi / n };
};
const within = (what, v, [lo, hi], tag) => assert.ok(v >= lo && v <= hi, `BALANCE DRIFT [${tag}] ${what} = ${v.toFixed(3)}, expected ${lo}-${hi}`);

let runs = 0;
for (const t of [null, ...TEMPER_IDS]) for (const seed of SEEDS) {
  const tag = `${t || 'no temperament'}, seed ${seed}`, r = run(seed, t); runs++;
  within('sleep share', r.sleep, BAND.sleep, tag);
  within('night-time awake share', r.night, t === 'nightowl' ? BAND.nightowl : BAND.night, tag);
  within('hunts per day', r.hunts, t === 'hunter' ? BAND.hunterHunts : BAND.hunts, tag);
  within('meals per day', r.meals, BAND.meals, tag);
  assert.ok(r.hungerHi < BAND.hungerHi, `BALANCE DRIFT [${tag}] hungry past 0.9 for ${(r.hungerHi * 100).toFixed(1)}% of the time`);
  assert.ok(r.thirstHi < BAND.thirstHi, `BALANCE DRIFT [${tag}] thirsty past 0.9 for ${(r.thirstHi * 100).toFixed(1)}% of the time`);
  assert.ok(r.paint > 0, `BALANCE DRIFT [${tag}] painted nothing in ${DAYS} days`);
}
console.log(`  ok ${runs} runs (${DAYS} days each) stay inside the balance bands`);
console.log('\nALL OK');
