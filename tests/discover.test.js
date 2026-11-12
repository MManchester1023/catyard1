// Finding recipes by carrying what they are made of:
//   - a recipe turns up when the cat is carrying what the thing is built from (a frame counts as the bark it is made of);
//   - the table and easel then need nothing more; the bird feeder, wind chime and cat tree also need the tablet;
//   - until something is found it gathers anyway, toward the thing it is most inclined to want (the easel first);
//   - twine cannot be scratched off the oak, so a recipe short only of twine waits, and the cat goes looking for string;
//   - saves from before this keep everything they already knew or had built.
import assert from 'node:assert/strict';
import { makeWorld } from '../src/sim/sim.js';
import { collectDrop, receiveMaterial, findRecipes, gatherNeed, seekNeed, startable, unlockRecipe, learnFromPage, goals, scratchTree } from '../src/sim/craft.js';
import { RECIPES, found, learned, knows, rawCost, onlyTwineShort } from '../src/sim/recipes.js';
import { thingsSummary } from '../src/sim/history.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { seedTests, withRandom } from '../src/sim/rng.js';
seedTests(1);

const ok = m => console.log('  ok ' + m);
const calm = w => { w.weather.type = 'clear'; w.weather.rain = 0; w.weather.timer = 1e9; w.mice = []; w.items = []; w.thiefT = 1e9; w.itemT = 1e9; w.mouseT = 1e9; };
const knowAll = w => { for (const k of ['pond', 'post', 'tree', 'flowers', 'cushion', 'yarn', 'fence', 'easel', 'tablet']) w.cat.mem.known[k] = 1; };

{
  // what each thing comes to, and what a fresh cat knows
  assert.deepEqual(rawCost(RECIPES.table.cost), { bark: 2, twig: 4 });
  assert.deepEqual(rawCost(RECIPES.easel.cost), { bark: 4, twig: 3 }, 'two frames are four bark');
  assert.deepEqual(rawCost(RECIPES.feeder.cost), { bark: 4, twig: 1, twine: 1 });
  assert.deepEqual(rawCost(RECIPES.chime.cost), { bark: 4, twig: 2, twine: 1 });
  for (const id of Object.keys(RECIPES)) if (!RECIPES[id].knowledge) assert.ok(RECIPES[id].desc && RECIPES[id].desc.length > 30, id + ' has a description');
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w);
  assert.ok(found(w, 'frame') && found(w, 'string'), 'frames and the way to string are not things to find');
  for (const id of ['easel', 'table', 'feeder', 'chime', 'cattree']) assert.ok(!found(w, id), id + ' is not found yet');
  assert.ok(learned(w, 'easel') && learned(w, 'table') && !learned(w, 'feeder'), 'the easel and table need no research; the feeder does');
  assert.ok(!knows(w, 'easel') && !startable(w, 'easel'), 'but it cannot work toward what it has not found');
  assert.ok(!thingsSummary(w).recipes.some(r => r.id === 'easel') && thingsSummary(w).hidden >= 5, 'and the Crafting tab does not list it yet');
  // so it gathers toward the thing it is most inclined to want: the easel
  assert.deepEqual(gatherNeed(w), { bark: 4, twig: 3 }); assert.deepEqual(seekNeed(w), { bark: 4, twig: 3 });
  c.inv.bark = 4; c.inv.twig = 2; findRecipes(w); assert.ok(!found(w, 'easel'), 'two twigs is not enough');
  collectDrop(w, 'twig');
  assert.ok(found(w, 'easel') && knows(w, 'easel'), 'the third twig: it works out what this is for');
  assert.ok(!found(w, 'table'), 'but not the table, which takes four twigs');
  assert.ok(w.journal.some(e => e.tag === 'craft' && /easel/.test(e.text)) && w.log.some(e => /worked out what its materials are for/.test(e.text)), 'and says so');
  assert.ok(goals(w).includes('easel') && thingsSummary(w).recipes.some(r => r.id === 'easel' && r.desc), 'it is working toward it now, and the tab lists it with its description');
  const was = c.ideas.easel.day; findRecipes(w); assert.equal(c.ideas.easel.day, was, 'found once');
  ok('a fresh cat finds the easel once it carries four bark and three twigs, and gathers toward it until then');
}
{
  // frames it already has count as the bark in them; gifts of the oak count; built things are not found again
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w);
  c.inv.frame = 2; c.inv.twig = 3; findRecipes(w); assert.ok(found(w, 'easel'), 'two frames and three twigs are an easel');
  const v = makeWorld('Vi'); calm(v); v.cat.inv.bark = 6; v.cat.inv.twig = 4; receiveMaterial(v, 'bark', 0); assert.ok(found(v, 'easel') && found(v, 'table'), 'enough for both turns up both');
  const b = makeWorld('Bee'); b.easelMade = { day: 1 }; b.cat.inv.bark = 12; b.cat.inv.twig = 12; findRecipes(b); assert.ok(!found(b, 'easel') && found(b, 'table'), 'an easel that already stands is not worked out again');
  assert.ok(!found(b, 'feeder') && !found(b, 'chime'), 'and nothing that needs twine is found without it');
  ok('frames count as bark, and standing things are left alone');
}
{
  // the feeder: carrying the parts gives the idea; reading up gives the know-how; it needs both
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w); w.easelMade = { day: 1 }; w.table = { x: 1, y: 1, day: 1 }; w.clock = 2.5 * w.dayLen; // (day 3: it is inclined to want the feeder, not yet the chime)
  const page = { title: 'Bird feeder', extract: 'A bird feeder is a device placed outdoors to supply bird food to wild birds.' };
  assert.equal(learnFromPage(w, page, null), null, 'reading about feeders before it has any idea does nothing'); assert.ok(!learned(w, 'feeder'));
  assert.deepEqual(seekNeed(w), { bark: 4, twig: 1 }, 'it gathers for it (the twine it cannot scratch off a tree)');
  c.inv.bark = 4; c.inv.twig = 1; findRecipes(w); assert.ok(!found(w, 'feeder'), 'no twine yet');
  receiveMaterial(w, 'twine', 1);
  assert.ok(found(w, 'feeder') && !knows(w, 'feeder') && !startable(w, 'feeder'), 'it has the idea but not the know-how');
  assert.ok(w.journal.some(e => /tablet will know/.test(e.text)), 'and wants to look it up');
  assert.equal(learnFromPage(w, page, null), 'feeder', 'now the page teaches it'); assert.ok(knows(w, 'feeder'));
  ok('the feeder needs the idea (the parts) and the know-how (the tablet), in either order');
}
{
  // twine cannot be scratched off a tree: a recipe that is only short of twine waits, and the cat goes looking for string
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w); w.easelMade = { day: 1 }; w.table = { x: 1, y: 1, day: 1 }; w.deco.feeder = true; w.clock = 5 * w.dayLen;
  c.inv.bark = 4; c.inv.twig = 2; findRecipes(w); assert.ok(!found(w, 'chime'), 'no twine');
  assert.ok(!seekNeed(w) || !seekNeed(w).twine, 'it does not try to scratch twine off the oak');
  assert.ok(onlyTwineShort(w, 'chime') && RECIPES.string.desire(w) > 0, 'it is short only of twine, so it wants to work out where string comes from');
  receiveMaterial(w, 'twine', 1); assert.ok(found(w, 'chime'), 'the twine turns up and so does the idea');
  ok('a recipe short only of twine waits for the twine, and the cat wants string');
}
{
  // when it is only short of twigs, the oak gives twigs more readily
  const rate = need => { const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w); w.easelMade = { day: 1 }; if (need === 'twig') { c.inv.bark = 12; } let n = 0; for (let i = 0; i < 4000; i++) { c.inv.twig = 0; if (need !== 'twig') c.inv.bark = 0; if (scratchTree(w) === 'twig') n++; } return n / 4000; };
  const both = rate('both'), twigs = rate('twig'); assert.ok(twigs > both * 1.6, `twigs come more often when twigs are all it lacks: ${twigs.toFixed(3)} vs ${both.toFixed(3)}`);
  ok('the oak gives up twigs more readily when twigs are what it lacks');
}
{
  // old saves keep what they had; a new save keeps what it found
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w); w.table = { x: 1, y: 1, day: 1 }; unlockRecipe(w, 'chime', 'Wind chime'); c.ideas = { easel: { day: 2 } };
  const s = JSON.parse(serialize(w)); assert.ok(s.cat.ideas && s.cat.ideas.easel, 'what it found is saved');
  const same = deserialize(JSON.stringify(s)); assert.ok(found(same, 'easel') && !found(same, 'chime'), 'and comes back as it was');
  delete s.cat.ideas; const old = deserialize(JSON.stringify(s));
  assert.ok(found(old, 'table') && found(old, 'chime') && found(old, 'easel'), 'an older save keeps what it knew or had built');
  assert.ok(!found(old, 'feeder') && !found(old, 'cattree'), 'and finds the rest the new way');
  ok('an older save keeps what it had; a new one keeps what it found');
}

console.log('\nALL OK');
