// Seeded dice: the same seed gives the same cat and the same life; a save carries its dice, so loading it plays out the
// same way every time; and the live loop moves in fixed steps, so the frame rate does not matter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeWorld, tick, advance, STEP } from '../src/sim/sim.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { runCommand } from '../src/sim/commands.js';
import { random, withRandom, makeRng, useRng } from '../src/sim/rng.js';

const ok = m => console.log('  ok ' + m);
const state = w => { const d = JSON.parse(serialize(w)); delete d.savedAt; delete d.w.createdAt; return JSON.stringify(d); }; // (everything but the wall-clock stamps)
const live = (w, days, dt = 0.5) => { for (let i = 0; i < days * w.dayLen / dt; i++) tick(w, dt); return w; };

{
  const a = live(makeWorld(undefined, { seed: 42 }), 2), b = live(makeWorld(undefined, { seed: 42 }), 2), c = live(makeWorld(undefined, { seed: 43 }), 2);
  assert.equal(a.cat.name, b.cat.name); assert.equal(state(a), state(b), 'same seed, same life');
  assert.notEqual(state(a), state(c), 'another seed, another life');
  assert.equal(a.rng.seed, 42);
  ok('the same seed gives the same cat and the same two days; another seed does not');
}
{
  const solo = live(makeWorld(undefined, { seed: 7 }), 1);
  const x = makeWorld(undefined, { seed: 7 }), y = makeWorld(undefined, { seed: 8 });
  for (let i = 0; i < x.dayLen / 0.5; i++) { tick(x, 0.5); tick(y, 0.5); }
  assert.equal(state(x), state(solo), 'stepping another world in between changes nothing');
  ok('each world has its own dice');
}
{
  const w = live(makeWorld(undefined, { seed: 11 }), 1), s = serialize(w);
  const l1 = live(deserialize(s), 1), l2 = live(deserialize(s), 1);
  assert.equal(state(l1), state(l2), 'loading the same save twice plays out the same');
  assert.equal(deserialize(s).rng.seed, 11, 'the seed is kept');
  const old = JSON.parse(s); delete old.w.rng; const o = deserialize(JSON.stringify(old)); assert.ok(o.rng && o.rng.s.length === 4, 'an older save without dice gets some');
  const bad = JSON.parse(s); bad.w.rng = { seed: 1, s: [0, 0, 0, 0] }; assert.ok(deserialize(JSON.stringify(bad)).rng.s.some(v => v !== 0), 'damaged dice are replaced');
  ok('a save carries its dice: the same save always plays out the same way');
}
{
  // the live loop: whatever the frame rate and speed, the world moves in steps of exactly STEP
  const steady = makeWorld(undefined, { seed: 5 }), ragged = makeWorld(undefined, { seed: 5 });
  const N = 3000; for (let i = 0; i < N; i++) advance(steady, STEP);
  const frames = [1 / 144, 1 / 30, 1 / 60, 0.05, 1 / 90, 0.2]; let steps = 0, k = 0;
  while (steps < N) { ragged.speed = k % 7 === 0 ? 4 : 1; steps += Math.round(advance(ragged, frames[k++ % frames.length], N - steps) / STEP); }
  assert.equal(steps, N); assert.ok(k > 200, 'plenty of uneven frames');
  delete ragged.acc; delete steady.acc; ragged.speed = 1;
  assert.equal(state(ragged), state(steady), 'different frame rates and speeds, the same world');
  ok('the live loop moves in fixed steps, so frame rate and speed do not change what happens');
}
{
  const w = makeWorld(undefined, { seed: 99 });
  assert.match(runCommand(w, 'seed', { admin: false }).lines[0], /Seed 99/);
  const r = runCommand(w, 'reset confirm 1234', { admin: true }); assert.equal(r.action.type, 'reset'); assert.equal(r.action.seed, 1234);
  assert.equal(makeWorld(undefined, { seed: 1234 }).cat.name, makeWorld(undefined, { seed: 1234 }).cat.name);
  assert.equal(runCommand(w, 'reset confirm', { admin: true }).action.seed, null, 'no number, a random cat');
  ok('/seed shows it; "reset confirm <seed>" starts that exact cat again');
}
{
  useRng(makeRng(3)); const a = [random(), random(), random()]; useRng(makeRng(3)); const b = [random(), random(), random()];
  assert.deepEqual(a, b); assert.ok(a.every(v => v >= 0 && v < 1));
  assert.equal(withRandom(0.25, () => random()), 0.25); assert.notEqual(random(), 0.25, 'and only inside');
  const bins = new Array(10).fill(0); useRng(makeRng(17)); for (let i = 0; i < 100000; i++) bins[Math.floor(random() * 10)]++;
  assert.ok(bins.every(n => n > 9500 && n < 10500), 'evenly spread: ' + bins.join(' '));
  ok('the generator repeats from a seed, is evenly spread, and tests can load it');
}
{
  // nothing in the simulation rolls its own dice (the network layer is the one exception: its answers are not reproducible anyway)
  const dir = new URL('../src/sim/', import.meta.url);
  const offenders = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'rng.js' && f !== 'web.js' && /Math\.random/.test(fs.readFileSync(new URL(f, dir), 'utf8')));
  assert.deepEqual(offenders, [], 'Math.random in: ' + offenders.join(', '));
  ok('every roll in src/sim goes through rng.js');
}

console.log('\nALL OK');
