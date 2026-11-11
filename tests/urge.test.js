// The creative urge: with no easel it turns into a hunger to build one (gathering, building, the oak's daily allowance),
// and playing it off (yarn, zoomies) takes the edge off it.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { start } from '../src/sim/acts.js';
import { easelUrge } from '../src/sim/recipes.js';
import { gatherCap, PACE } from '../src/sim/pace.js';
import { seedTests } from '../src/sim/rng.js';
seedTests(1);

const ok = m => console.log('  ok ' + m);
const fresh = (temper = null) => { const w = makeWorld('Tess'); w.netOn = false; w.cat.temper = temper; w.cat.mem.known.tree = 1; return w; };

{
  const w = fresh(), c = w.cat;
  c.needs.create = 0.3; assert.equal(easelUrge(w), 0, 'a calm cat does not crave it');
  c.needs.create = 0.75; const mid = easelUrge(w); c.needs.create = 1; assert.equal(easelUrge(w), 1);
  assert.ok(mid > 0.3 && mid < 0.7, 'and it climbs: ' + mid);
  const vg = fresh('vangogh'); vg.cat.needs.create = 0.6; const plain = fresh(); plain.cat.needs.create = 0.6; assert.ok(easelUrge(vg) > easelUrge(plain), 'a Van Gogh feels it sooner');
  const blind = fresh(); blind.cat.mem.known.tree = 0; blind.cat.needs.create = 1; assert.equal(easelUrge(blind), 0, 'it cannot make anything before it has found the oak');
  w.easelMade = { x: 0, y: 0, day: 1 }; assert.equal(easelUrge(w), 0, 'once there is an easel it is just a painter');
  ok('easelUrge: nothing when calm, climbing with the urge, sooner for a Van Gogh, gone once the easel stands');
}
{
  const w = fresh(); w.cat.needs.create = 0.2; const calm = gatherCap(w);
  w.cat.needs.create = 1; assert.equal(gatherCap(w), calm + PACE.urgeExtra, 'the oak gives a desperate cat more in a day');
  w.easelMade = {}; assert.equal(gatherCap(w), calm, 'and not once the easel is up');
  ok('a cat desperate for its easel gets more from the oak each day');
}
{
  // the same cats, one kept desperate and one kept calm: the desperate ones build their easel sooner
  const built = hi => { const w = fresh(); w.cat.traits.curious = 0.5; let t = 0; const dt = 0.5, lim = 6 * w.dayLen; for (; t < lim && !w.easelMade; t += dt) { w.cat.needs.create = hi ? 0.95 : 0.3; tick(w, dt); } return t / w.dayLen; };
  let hi = 0, lo = 0; const N = 6; for (let i = 0; i < N; i++) { hi += built(true); lo += built(false); }
  assert.ok(hi < lo, `desperate cats build sooner: ${(hi / N).toFixed(2)} days against ${(lo / N).toFixed(2)}`);
  ok(`with the urge high the easel goes up in ${(hi / N).toFixed(1)} days on average, against ${(lo / N).toFixed(1)} with it low`);
}
{
  // yarn and zoomies spend the urge
  const spend = (type, opts) => {
    const w = fresh(); const c = w.cat; w.clock = 0.4 * w.dayLen; w.weather.rain = 0; c.needs.create = 0.9; c.needs.tired = 0.1; c.needs.fun = 0.9; c.hidden = false;
    start(w, type, opts); const before = c.needs.create; for (let i = 0; i < 800 && c.act.type === type; i++) { c.reeval = 1e9; tick(w, 0.1); }
    return before - c.needs.create;
  };
  assert.ok(spend('play', { kind: 'yarn', own: true }) > 0.04, 'a go with the yarn lowers it');
  assert.ok(spend('zoom') > 0.04, 'so do the zoomies');
  ok('playing with the yarn ball and the zoomies both lower the creative urge');
}

console.log('\nALL OK');
