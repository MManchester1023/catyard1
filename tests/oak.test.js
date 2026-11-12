// Clicking the oak: a hit test, something falls now and then (bark or a twig, never every time), a pause between
// shakes, a daily limit, and what falls is picked up by the cat like anything a bird drops.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { shakeTree, treeHit, leavesTick } from '../src/sim/oak.js';
import { PACE } from '../src/sim/pace.js';
import { MAT_CAP } from '../src/sim/util.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { seedTests, withRandom } from '../src/sim/rng.js';
seedTests(1);

const ok = m => console.log('  ok ' + m);
const fresh = () => { const w = makeWorld('Oak'); w.netOn = false; w.items = []; return w; };
const T = w => w.o.tree;

{
  const w = fresh(), t = T(w);
  assert.ok(treeHit(w, t.x, t.y - 40) && treeHit(w, t.x, t.y - 150) && treeHit(w, t.x - 70, t.y - 130) && treeHit(w, t.x + 2, t.y + 5), 'trunk and crown count');
  assert.ok(!treeHit(w, 150, 300) && !treeHit(w, t.x, t.y + 80) && !treeHit(w, t.x - 140, t.y - 130) && !treeHit(w, t.x, 40), 'the cabin, the grass below and the sky do not');
  assert.equal(shakeTree(w, 150, 300), null, 'a click elsewhere does nothing');
  ok('only the oak itself answers a click');
}
{
  // not every time: over many shakes, spaced out, about shakeChance of them bring something down, and both kinds fall
  const w = fresh(); const t = T(w); let tries = 0, drops = 0; const kinds = new Set();
  for (let i = 0; i < 600; i++) {
    w.clock += PACE.shakeCool + 1; w.shake.n = 0; w.items = []; // (a fresh day's allowance each time, so only the chance is being measured)
    const r = shakeTree(w, t.x, t.y - 100); tries++; if (r.dropped) { drops++; kinds.add(r.dropped.type); }
  }
  const p = drops / tries; assert.ok(p > PACE.shakeChance - 0.07 && p < PACE.shakeChance + 0.07, `about ${PACE.shakeChance} of shakes drop something: ${p.toFixed(2)}`);
  assert.deepEqual([...kinds].sort(), ['bark', 'twig'], 'bark and twigs both fall');
  withRandom(0.99, () => { w.clock += 10; w.items = []; assert.equal(shakeTree(w, t.x, t.y - 100).dropped, null, 'a bad roll drops nothing'); });
  withRandom(0, () => { w.clock += 10; w.items = []; const d = shakeTree(w, t.x, t.y - 100).dropped; assert.ok(d && d.from === 'tree' && ['bark', 'twig'].includes(d.type) && w.items.includes(d), 'a good roll drops one on the grass'); });
  ok(`about ${(100 * p).toFixed(0)}% of shakes bring something down, bark or twig, and never every time`);
}
{
  const w = fresh(), t = T(w);
  withRandom(0, () => {
    const a = shakeTree(w, t.x, t.y - 100); assert.ok(a.dropped);
    const b = shakeTree(w, t.x, t.y - 100); assert.equal(b.dropped, null, 'no second drop straight away');
    assert.ok(w.leaves.length > 7, 'but the leaves still fall');
    for (let i = 0; i < 20; i++) { w.clock += PACE.shakeCool + 1; w.items = []; shakeTree(w, t.x, t.y - 100); }
    assert.equal(w.shake.n, PACE.shakePerDay, 'a day gives at most ' + PACE.shakePerDay);
    w.clock += w.dayLen; w.items = []; assert.ok(shakeTree(w, t.x, t.y - 100).dropped, 'and tomorrow it has more');
  });
  for (let i = 0; i < 30; i++) leavesTick(w, 0.1); assert.equal(w.leaves.length, 0, 'the leaves settle');
  ok('a pause between shakes, a daily limit, leaves that settle');
}
{
  const w = fresh(), t = T(w); w.cat.inv.bark = MAT_CAP;
  withRandom(0, () => { for (let i = 0; i < 12; i++) { w.clock += 5; w.items = []; const r = shakeTree(w, t.x, t.y - 100); if (r.dropped) assert.equal(r.dropped.type, 'twig', 'full of bark, so only twigs'); } });
  w.cat.inv.twig = MAT_CAP; withRandom(0, () => { w.clock += 5; w.items = []; assert.equal(shakeTree(w, t.x, t.y - 100).dropped, null, 'carrying all it can: nothing falls'); });
  const full = fresh(); full.items = Array.from({ length: 7 }, (_, i) => ({ id: 'x' + i, type: 'button', color: 'red', x: 100, y: 400, age: 0 }));
  withRandom(0, () => assert.equal(shakeTree(full, t.x, t.y - 100).dropped, null, 'the yard is not littered past its limit'));
  ok('it does not drop what the cat cannot carry, or litter a full yard');
}
{
  // the cat picks it up like a bird drop
  const w = fresh(); w.cat.mem.known.tree = 1; const t = T(w); w.clock = 0.4 * w.dayLen; w.weather.rain = 0;
  withRandom(0, () => shakeTree(w, t.x, t.y - 100)); const it = w.items[0], type = it.type, before = w.cat.inv[type];
  for (let i = 0; i < 4000 && w.items.includes(it); i++) tick(w, 0.25);
  assert.ok(!w.items.includes(it) && w.cat.inv[type] === before + 1 || w.log.some(e => /fallen from the oak/.test(e.text)), 'the cat picked it up (' + type + ' ' + before + ' -> ' + w.cat.inv[type] + ')');
  const back = deserialize(serialize(w)); assert.equal(back.shake.n, w.shake.n, 'the day count is saved');
  ok('the cat picks up what falls, and the day count survives a save');
}
{
  // whoever the cat is, it goes and gets what fell from the oak, even from across the yard and with a trinket lying nearer
  // (it used to ignore building parts more than ~560 px away, and a trinket it did not care about hid them from view)
  const TEMPERS_TO_TRY = [null, 'vangogh', 'hunter', 'garfield', 'builder'];
  for (const temper of TEMPERS_TO_TRY) {
    seedTests(2); const w = fresh(); w.cat.temper = temper; Object.assign(w.cat.mem.known, { pond: 1, post: 1, tree: 1, flowers: 1, cushion: 1, yarn: 1, fence: 1, easel: 1, tablet: 1 }); w.easelMade = { day: 1 };
    w.clock = 2.4 * w.dayLen; w.weather.type = 'clear'; w.weather.rain = 0; w.weather.timer = 1e9; w.mouseT = w.itemT = w.thiefT = 1e9; w.cat.x = 120; w.cat.y = 500;
    const q = w.cat.quirk; w.items.push({ id: 'trinket', type: q.item === 'button' ? 'feather' : 'button', color: 'red', x: 200, y: 520, age: 0 });
    const t = T(w), r = withRandom(0, () => shakeTree(w, t.x, t.y - 100)); const it = r.dropped; assert.ok(it, 'something fell');
    let got = false; for (let i = 0; i < w.dayLen * 0.5 * 10 && !got; i++) { tick(w, 0.1); if (!w.items.includes(it)) got = true; }
    assert.ok(got, `a ${temper || 'plain'} cat picked up what fell from the oak`);
  }
  seedTests(1);
  ok('what falls from the oak is picked up by every kind of cat, near or far');
}

console.log('\nALL OK');
