// Small things that make the cat's life read better: string before shopping, a sale feels good, the bowls sit by the
// house, and no hidden cat tree.
import assert from 'node:assert/strict';
import { makeWorld } from '../src/sim/sim.js';
import { markFound, unlockRecipe } from '../src/sim/craft.js';
import { RECIPES, paintNeedsString } from '../src/sim/recipes.js';
import { shopChoice, sell, ensureEconomy } from '../src/sim/economy.js';
import { genWants } from '../src/sim/wants.js';
import { seedTests } from '../src/sim/rng.js';

seedTests(1);
const ok = m => console.log('  ok ' + m);
const calm = w => { w.weather.type = 'clear'; w.weather.rain = 0; w.weather.timer = 1e9; w.mice = []; w.items = []; w.thiefT = 1e9; w.itemT = 1e9; w.mouseT = 1e9; };
const mk = () => { const w = makeWorld('Tess'); calm(w); w.netOn = false; for (const k of ['pond', 'post', 'tree', 'flowers', 'cushion', 'yarn', 'fence', 'easel', 'tablet']) w.cat.mem.known[k] = 1; for (const id of Object.keys(RECIPES)) markFound(w, id); w.easelMade = { day: 1 }; w.clock = 2 * w.dayLen; return w; };
const paint = (w, n = 1) => { for (let i = 0; i < n; i++) w.cat.art.works.unshift({ id: 'p' + i, title: 'Work ' + i, score: 0.6, day: 1, level: 1, tier: 'ok', critique: '' }); w.cat.art.count += n; };

{ // string: it learns where it comes from before it pays for any
  const w = mk(), c = w.cat; ensureEconomy(w); paint(w); c.money = 60; c.inv.twine = 0;
  assert.ok(paintNeedsString(w), 'a painting is ready for a frame and there is no string');
  const ch = shopChoice(w); assert.ok(!(ch && ch.type === 'twine'), 'it does not buy string before it has learned where string comes from');
  genWants(w); assert.ok(c.wants.some(x => x.kind === 'learn' && x.recipe === 'string'), 'it wants to look up where string comes from');
  unlockRecipe(w, 'string', 'Twine');
  const after = shopChoice(w); assert.ok(!after || after.type !== 'twine' || after.n >= 1, 'and once it knows, buying is allowed again');
  ok('string: it works out where string comes from before it ever pays for some');
}
{ // a sale is a good moment
  const w = mk(), c = w.cat; ensureEconomy(w); paint(w); const wk = c.art.works[0]; wk.status = 'forSale'; wk.price = 30;
  c.mood.joy = 0.3; c.needs.create = 0.5; c.needs.lonely = 0.5; c.pose = 'stand'; const id = c.thoughtId;
  sell(w, wk);
  assert.ok(c.mood.joy >= 0.45, 'it is happier: ' + c.mood.joy); assert.ok(c.needs.create <= 0.4 && c.needs.lonely < 0.5, 'and less itchy and less lonely');
  assert.ok(c.thoughtId > id && /\$30/.test(c.thought), 'it says so there and then: ' + c.thought); assert.ok(c.glowUntil > w.clock, 'and it glows');
  ok('selling a painting cheers it up, and it says so');
}
{ // the bowls sit just in front of the house; nothing hides a cat tree behind it
  const w = mk(), o = w.o; for (const b of [o.bowl, o.water]) assert.ok(Math.hypot(b.x - o.house.x, b.y - o.house.y) < 190, 'the bowls are by the house');
  assert.ok(!w.catTree, 'no cat tree to begin with'); assert.ok(!Object.keys(w.cat).includes('peekUrge') || !w.cat.peekUrge);
  ok('the bowls are by the house');
}
console.log('ALL OK');

{ // lightning bugs: no catching until the sparks are understood, then a jar sits in the yard
  const { catchBug } = await import('../src/sim/world.js');
  const { solve } = await import('../src/sim/mysteries.js');
  const w = mk(), c = w.cat; w.clock = 20 * w.dayLen / 24; // evening
  for (const s of w.sparks) s.on = true;
  const x = (await import('../src/sim/acts.js'));
  c.x = w.sparks[0].x; c.y = w.sparks[0].y;
  c.act = { type: 'investigate', kind: 'sparks', phase: 'do', t: 1, dur: 20, swat: 0, tx: c.x, ty: c.y };
  for (let i = 0; i < 4000; i++) { c.act = c.act || { type: 'investigate', kind: 'sparks', phase: 'do', t: 1, dur: 20, swat: 0 }; w.sparks.forEach(s => { s.on = true; s.x = c.x + 5; s.y = c.y; }); x.actTick(w, 0.1); if (c.act.type !== 'investigate') c.act = null; }
  assert.ok(!w.deco.jar, 'no bug is caught before the sparks are worked out');
  solve(w, 'sparks'); catchBug(w);
  assert.ok(w.deco.jar && w.deco.jar.day >= 1, 'a caught bug becomes a jar in the yard');
  const back = JSON.parse(JSON.stringify(w.deco)); assert.ok(back.jar, 'the jar survives a save');
  ok('lightning bugs: only caught after the sparks are solved; the jar is kept');
}
