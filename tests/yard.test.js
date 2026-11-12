// Things that drift about the yard: butterflies and fireflies keep moving and never pin themselves against a wall.
// (They once piled up against the right-hand wall: the steering blended headings across atan2's +pi/-pi jump.)
import assert from 'node:assert/strict';
import { makeFly, flyTick, makeSpark, sparkTick, turnToward } from '../src/sim/world.js';
import { W, GY0, GY1 } from '../src/sim/util.js';
import { seedTests } from '../src/sim/rng.js';
seedTests(1);

const ok = m => console.log('  ok ' + m);

{
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(near(turnToward(3.1, -3.1, 1), -3.1 + 2 * Math.PI) || near(turnToward(3.1, -3.1, 1), -3.1), 'turns the short way across the +pi/-pi jump');
  assert.ok(Math.abs(turnToward(3.1, -3.1, 0.5) - 3.1) < 0.1, 'a half turn across the jump moves a little, not a lot');
  assert.ok(near(turnToward(0.5, 0.5, 1), 0.5) && turnToward(1, 2, 0.5) === 1.5, 'and works as before away from the jump');
  assert.ok(near(turnToward(0, 100 * Math.PI + 0.3, 1), 0.3), 'however far round the heading has wandered');
  ok('turnToward goes the short way round');
}
{
  const day = { clock: 600, dayLen: 1200, weather: { rain: 0 } }; // (noon, dry)
  let pinned = 0, still = 0, tot = 0; const xs = [], ys = [];
  for (let i = 0; i < 12; i++) {
    const f = makeFly(i % 3);
    for (let t = 0; t < 20000; t++) {
      const px = f.x, py = f.y; flyTick(day, f, 0.1); tot++;
      if (f.x <= 20.01 || f.x >= W - 20.01 || f.y >= GY1 - 0.01 || f.y <= GY0 + 90.01) pinned++;
      if (Math.hypot(f.x - px, f.y - py) < 0.2) still++;
      if (t % 50 === 0) { xs.push(f.x); ys.push(f.y); }
    }
  }
  assert.ok(pinned / tot < 0.02, `butterflies are not held against a wall: ${(100 * pinned / tot).toFixed(1)}% of the time`);
  assert.ok(still / tot < 0.02, 'and keep moving');
  const span = a => Math.max(...a) - Math.min(...a);
  assert.ok(span(xs) > 350 && span(ys) > 60, `they roam over the garden: ${span(xs).toFixed(0)} by ${span(ys).toFixed(0)}`);
  ok(`butterflies roam the garden and are against a wall ${(100 * pinned / tot).toFixed(1)}% of the time`);
}
{
  const night = { clock: 1000, dayLen: 1200, weather: { rain: 0 } };
  let far = 0, tot = 0;
  for (let i = 0; i < 12; i++) { const s = makeSpark(i); for (let t = 0; t < 20000; t++) { sparkTick(night, s, 0.1); tot++; if (Math.hypot(s.x - 716, s.y - 520) > 190) far++; } }
  assert.ok(far / tot < 0.02, `fireflies stay over the flower bed: ${(100 * far / tot).toFixed(1)}% outside it`);
  ok('fireflies stay over the flower bed');
}

console.log('\nALL OK');
