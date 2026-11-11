// Painting: the generated pictures (swirls, splatter, waves, blocks, dots, blooms) and the extra variety in yard scenes.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { start } from '../src/sim/acts.js';
import { GEN, buildOps, paintWork, pickSubject, finishWork, subjectLabel, isGenerated, tierOf, xpForLevel, SUBJECT_IDS } from '../src/sim/art.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { runCommand } from '../src/sim/commands.js';
import { seedTests, withRandom, setRandom } from '../src/sim/rng.js';
seedTests(1); // (every world here gets a fixed seed, so this test gives the same result every run)

const ok = m => console.log('  ok ' + m);
const finite = o => Object.values(o).every(v => typeof v === 'number' ? Number.isFinite(v) : Array.isArray(v) ? v.every(p => Array.isArray(p) ? p.every(Number.isFinite) : true) : true);
const fake = (subject, tier, seed, extra = {}) => ({ v: 2, subject, tier, seed, when: 'Afternoon', mood: 'calm', pal: ['#5fa6e0', '#cfe8f7', '#e9a23b', '#6a8f4e', '#3b2f36'], ...extra });

// every style, every tier: deterministic from the seed, nothing NaN, a different picture for a different seed
for (const s of Object.keys(GEN)) {
  for (let tier = 0; tier <= 4; tier++) {
    const a = buildOps(fake(s, tier, 99), 240, 180), b = buildOps(fake(s, tier, 99), 240, 180), c = buildOps(fake(s, tier, 100), 240, 180);
    assert.deepEqual(a, b, `${s} tier ${tier} redraws the same`);
    assert(a.length > 3 && a.every(finite), `${s} tier ${tier} has sane ops`);
    if (tier > 0) assert.notDeepEqual(a, c, `${s} tier ${tier} differs with the seed`);
    assert(a.length < 900, `${s} tier ${tier} stays cheap to redraw (${a.length} ops)`);
  }
}
ok('six generated styles: deterministic, finite, seed-dependent and light enough to redraw');

// mood and time of day change the colours
const col = (mood, when) => buildOps(fake('blocks', 3, 7, { mood, when }), 240, 180).filter(o => o.c).map(o => o.c).join();
assert.notEqual(col('bright', 'Morning'), col('drowsy', 'Night'), 'a bright morning and a drowsy night are painted in different colours');
ok('mood and hour pitch the palette');

// yard scenes: older works (no version) are drawn exactly as before; new ones gain extras but keep the same subject
const old = buildOps({ ...fake('oak', 3, 55), v: undefined }, 240, 180), neu = buildOps(fake('oak', 3, 55), 240, 180);
assert(neu.length > old.length, 'new scenes carry extra background and foreground things');
assert.deepEqual(buildOps({ ...fake('oak', 3, 55), v: undefined }, 240, 180), old, 'an old work still redraws identically');
for (const s of SUBJECT_IDS) for (let tier = 0; tier <= 4; tier++) assert(buildOps(fake(s, tier, 31 + tier), 240, 180).every(finite), `${s} tier ${tier} is finite`);
ok('scenes: old works unchanged, new ones have extras, every subject is finite at every tier');

// the cat makes some up now and then, and a Van Gogh does it a lot, mostly swirls
const w = makeWorld('Tess'); w.cat.art.xp = xpForLevel(6); w.cat.temper = null;
const share = () => { const t = {}; for (let i = 0; i < 4000; i++) { const s = pickSubject(w); t[s] = (t[s] || 0) + 1; } const gen = Object.keys(GEN).reduce((n, k) => n + (t[k] || 0), 0); return { gen: gen / 4000, t }; };
const normal = share(); assert(normal.gen > 0.1 && normal.gen < 0.45, 'about a quarter of a skilled cat\'s pictures are made up: ' + normal.gen);
w.cat.temper = 'vangogh'; const vg = share(); assert(vg.gen > normal.gen + 0.1 && vg.t.swirl > vg.gen * 4000 * 0.4, `a Van Gogh makes things up more (${vg.gen.toFixed(2)}) and mostly swirls (${vg.t.swirl})`);
w.cat.temper = null; w.cat.art.xp = 0; const beginner = share(); assert(Object.keys(GEN).every(k => GEN[k].min === 0 || !beginner.t[k]), 'a beginner only makes the styles it can manage');
ok('subject picking: abstract pictures by mood, Van Gogh favours swirls, beginners are limited');

// the whole pipeline: it paints one, titles and labels read well, and the save round-trips
w.cat.art.xp = xpForLevel(7); const work = paintWork(w, 'swirl');
assert(work.v === 2 && work.subject === 'swirl' && GEN.swirl.titles.includes(work.title) && isGenerated('swirl') && !isGenerated('moon'));
assert.equal(subjectLabel('swirl'), 'a swirling sky');
finishWork(w, work); assert.equal(w.cat.art.works[0].id, work.id);
const w2 = deserialize(serialize(w)); assert.deepEqual(buildOps(w2.cat.art.works[0], 240, 180), buildOps(work, 240, 180), 'the saved picture redraws the same');
ok('a generated work is titled, filed in the gallery and survives a save');

// the paint act and the admin command can be told what to make
const w3 = makeWorld('Tess'); w3.cat.art.xp = xpForLevel(5); w3.cat.mem.known.easel = 1;
const run = l => runCommand(w3, l, { admin: true }).lines.join(' ');
assert(/no easel yet/.test(run('art paint bloom')) && w3.cat.act.type !== 'paint', 'with no easel there is nothing to paint on'); w3.easelMade = { day: 1 };
assert(/a bloom/.test(run('art paint bloom')), 'the command names the subject');
assert.equal(w3.cat.act.type, 'paint'); assert.equal(w3.cat.act.subject, 'bloom'); assert.equal(w3.cat.act.work.subject, 'bloom');
assert(/Usage/.test(run('art paint nonsense')), 'an unknown subject is refused');
for (let i = 0; i < 2500 && w3.cat.act.type === 'paint'; i++) { w3.cat.reeval = 1e9; tick(w3, 0.1); }
assert(w3.cat.art.works.some(x => x.subject === 'bloom'), 'it finished the bloom');
ok('art paint <style> makes the cat paint exactly that');
console.log('ALL OK');
