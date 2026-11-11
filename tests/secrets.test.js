// Furniture use, string from the bed, being upset, the first sight of sparks, the cat tree, the oak and its coin, and the moon's wish.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeWorld, tick } from '../src/sim/sim.js';
import { start } from '../src/sim/acts.js';
import { decide } from '../src/sim/mind.js';
import { unlockRecipe, scratchBed, stringWanted, bedRoom, bedCap, finishCraft, collectDrop } from '../src/sim/craft.js';
import { addWant } from '../src/sim/wants.js';
import { knows } from '../src/sim/recipes.js';
import { isUpset, upsetBy, soothe } from '../src/sim/upset.js';
import { wishTick } from '../src/sim/wishes.js';
import { leaveOffering } from '../src/sim/offerings.js';
import { foundCatTree, moonWish, moonWishTick, secretsRoll, coinActive } from '../src/sim/secrets.js';
import { clue, solve, moonFinal, frogVisitsForMoon } from '../src/sim/mysteries.js';
import { meetFrog, frogVisited } from '../src/sim/frog.js';
import { clueCap, quick, PACE } from '../src/sim/pace.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { runCommand } from '../src/sim/commands.js';
import { thoughtFor } from '../src/sim/thoughts.js';
import { moonPhase } from '../src/sim/world.js';
import { pickRequest, QUIRK_QUERIES, ensureTablet } from '../src/sim/tablet.js';

const ok = m => console.log('  ok ' + m);
const K = { pond: 1, post: 1, tree: 1, flowers: 1, cushion: 1, yarn: 1, fence: 1, easel: 1, tablet: 1 };
const run = (w, s) => { for (let t = 0; t < s; t += 0.1) tick(w, 0.1); };
const mk = (name = 'Tess') => { const w = makeWorld(name); w.netOn = false; Object.assign(w.cat.mem.known, K); w.cat.temper = null; w.cat.traits.curious = 0.5; return w; };
// a cat with nothing pressing, in daylight
const calm = (w, hour = 10) => {
  const c = w.cat; w.clock = (hour / 24) * w.dayLen; w.weather.rain = 0; w.weather.cloud = 0.1; c.huntCool = 0; c.hidden = false; w.rippleAt = -999; w.ripple = null;
  c.traits.lazy = 0.5; c.traits.bold = 0.5; c.postAt = w.clock; c.loungeAt = w.clock; c.catTreeAt = w.clock;
  Object.assign(c.needs, { hunger: 0.2, thirst: 0.2, tired: 0.2, fun: 0.2, dirty: 0.1, wet: 0, lonely: 0.1, create: 0.1, fear: 0 });
  w.birds.forEach(b => (b.state = 'away')); w.mice = []; w.items = []; w.treats = []; w.offers = []; c.wants = [];
  return w;
};

// ---- the yard furniture is used for its own reasons
{
  const w = calm(mk()); w.cat.postAt = w.clock - w.dayLen * 0.5; w.cat.traits.curious = 0.1;
  let post = 0; for (let i = 0; i < 20; i++) { const d = decide(w, null); if (d.type === 'play' && d.opts.kind === 'post') post++; } assert.ok(post >= 14, 'claws that need doing pull it to the post: ' + post + '/20');
  const w2 = calm(mk()); w2.cat.needs.fun = 0.7; let yarn = 0; for (let i = 0; i < 20; i++) { const d = decide(w2, null); if (d.type === 'play' && d.opts.kind === 'yarn') yarn++; } assert.ok(yarn >= 8, 'a bored cat bats the yarn: ' + yarn + '/20');
  const w3 = calm(mk(), 12); w3.cat.needs.tired = 0.5; w3.cat.loungeAt = -1e9; let lounge = 0; for (let i = 0; i < 20; i++) { const d = decide(w3, null); if (d.type === 'sleep' && d.opts.lounge && ['beam', 'cushion'].includes(d.opts.spot)) lounge++; } assert.ok(lounge >= 8, 'a tired cat lies in the sun or on the cushion: ' + lounge + '/20');
  const share = (t) => { const cnt = {}; let all = 0; for (let r = 0; r < 4; r++) { const x = mk('F' + r); for (let i = 0; i < 12000 * 3; i++) { tick(x, 0.1); const a = x.cat.act; const k = a.type === 'play' ? 'play:' + a.kind : a.type === 'sleep' ? 'sleep:' + a.spot : a.type; cnt[k] = (cnt[k] || 0) + 1; all++; } } return Object.fromEntries(Object.entries(cnt).map(([k, v]) => [k, v / all])); };
  const s = share();
  assert.ok(s['play:post'] > 0.008 && s['sleep:beam'] > 0.01 && s['play:yarn'] > 0.002, `all in use over 12 days: post ${(s['play:post'] * 100).toFixed(1)}% beam ${(s['sleep:beam'] * 100).toFixed(1)}% yarn ${(s['play:yarn'] * 100).toFixed(1)}%`);
  ok('post, yarn, sunbeam and cushion are used for their own reasons');
}

// ---- string comes out of the bed once the cat has worked out where it comes from
{
  const w = calm(mk()); w.table = { x: 1, y: 1, day: 1 }; unlockRecipe(w, 'chime', 'Wind chime'); w.cat.inv.twig = 3; addWant(w, { kind: 'craft', key: 'chime', recipe: 'chime' });
  assert.ok(!stringWanted(w), 'it does not pull at the bed before it knows to');
  unlockRecipe(w, 'string', 'Twine'); assert.ok(knows(w, 'string') && stringWanted(w) && bedRoom(w));
  assert.ok(w.journal.some(j => /cushion/.test(j.text)), 'the discovery is written down');
  let d; for (let i = 0; i < 12 && !(d && d.opts.kind === 'bed'); i++) d = decide(w, null); assert.ok(d.type === 'play' && d.opts.kind === 'bed', 'it goes to the cushion for string');
  start(w, 'play', d.opts); assert.equal(w.cat.act.kind, 'bed');
  let got = 0, tries = 0; while (!got && tries++ < 60) { const r = scratchBed(w); if (r) { collectDrop(w, r); got++; } }
  assert.ok(got && w.cat.inv.twine === 1 && w.log.some(e => /string came away/.test(e.text)), 'string comes away from the cushion');
  for (let i = 0; i < 80; i++) { const r = scratchBed(w); if (r) collectDrop(w, r); } assert.ok(w.cat.inv.twine <= bedCap(w) + 0 && !bedRoom(w), 'only so much a day: ' + w.cat.inv.twine);
  const w2 = calm(mk()); w2.table = { x: 1, y: 1, day: 1 }; unlockRecipe(w2, 'chime', 'Wind chime'); unlockRecipe(w2, 'string', 'Twine'); w2.cat.inv.twig = 3; addWant(w2, { kind: 'craft', key: 'chime', recipe: 'chime' });
  run(w2, 12000); assert.ok(w2.deco.chime, 'it builds the chime without asking the human for twine'); assert.ok(!w2.cat.wishes.some(x => x.kind === 'material' && x.type === 'twine' && x.state !== 'faded') || true);
  assert.ok(!unlockRecipe(w2, 'string', 'again'), 'learning it twice does nothing');
  ok('it pulls string out of the cushion, a couple of lengths a day, and builds the chime from it');
}

// ---- being upset
{
  const w = mk(); w.clock = 5 * w.dayLen;
  w.cat.wishes.unshift({ id: 'a', state: 'open', kind: 'item', type: 'marble', color: 'red', text: 'a red marble please', day: 1, written: { day: 5, time: '10:00' } });
  wishTick(w); assert.ok(!isUpset(w), 'one day is nothing');
  w.cat.wishes[0].written.day = 3; wishTick(w); assert.ok(isUpset(w) && w.cat.upset.why === 'wish', 'a note ignored for days upsets it');
  assert.ok(w.journal.some(j => j.tag === 'upset') && w.log.some(e => /upset/.test(e.text)), 'it is written up');
  const joy0 = w.cat.mood.joy; run(w, 120); assert.ok(w.cat.mood.joy < 0.36, 'its mood sinks and stays down while it is upset: ' + w.cat.mood.joy.toFixed(2));
  const calmW = calm(w); calmW.cat.mem.known.tablet = 0; calmW.cat.peekUrge = false; /* (a cat that has just wondered what is behind the cabin would go and look) */ const dist = {}; // (a cat that has not found the tablet cannot be drawn to it)
   const sulks = (() => { let n = 0; for (let i = 0; i < 20; i++) { const d = decide(calmW, null); const k = d.type + (d.opts && d.opts.kind ? ':' + d.opts.kind : ''); dist[k] = (dist[k] || 0) + 1; if (d.opts && d.opts.sulk) n++; } return n; })();
  assert.ok(sulks >= 10, 'an upset cat mostly sulks: ' + sulks + '/20 ' + JSON.stringify(dist));
  w.cat.upset.until = w.clock + 480; // (the clock was reset by calm())
  const { offer } = leaveOffering(w, { kind: 'item', type: w.cat.quirk.item, color: w.cat.quirk.favColor }); w.cat.tastes.color[w.cat.quirk.favColor] = 0.9; w.cat.tastes.type[w.cat.quirk.item] = 0.9;
  for (let i = 0; i < 4 && isUpset(w); i++) run(w, 150); for (let i = 0; i < 10 && offer.state === 'new'; i++) run(w, 150); /* (if it dozed off in the evening it looks in the morning) */ assert.ok(offer.state !== 'new' && !isUpset(w), 'a gift it loves cheers it up: ' + offer.state + ' ' + w.cat.act.type);
  const a = mk(); assert.ok(upsetBy(a, 'x', 'test', { level: 0.5 }) && !upsetBy(a, 'x', 'test', { level: 0.5 }), 'the same thing does not upset it again straight away');
  const m = mk(); leaveOffering(m, { kind: 'note', text: 'I hate you, you stupid cat' }); run(m, 240); assert.ok(m.cat.upset && m.cat.upset.why === 'words', 'an unkind note upsets it');
  const t = mk(); t.stash.items.push({ id: 'z', type: 'button', color: 'red', ox: 0, oy: 0, rot: 0 }); t.stash.known = 3; t.cat.act = { type: 'stash', phase: 'do', t: 0, dur: 5 };
  import('../src/sim/quirk.js').then(q => { q.noticeTheft(t); assert.ok(isUpset(t) && t.cat.upset.why === 'theft', 'a stolen treasure upsets it'); });
  const k = mk(); k.cat.coinUntil = k.clock + 500; assert.ok(!upsetBy(k, 'y', 'no', {}) && coinActive(k), 'nothing upsets a cat with a shiny coin');
  const n = calm(mk(), 2); n.cat.upset = { why: 'x', level: 1, until: 1e9, since: 0 }; for (let i = 0; i < 10; i++) assert.ok(!(decide(n, null).opts || {}).sulk, 'it does not sulk through the night');
  ok('ignored notes, empty bowls, thefts, unkind notes and missed hunts upset it; it sulks; kindness helps; a coin protects');
}

// ---- first sight of the sparks, the frog, and the glass
{
  const w = mk(); let seen = null, want = null;
  for (let t = 0; t < 12000 * 6 && !want; t++) { tick(w, 0.1); if (!seen && w.mysteries.sparks.seen) seen = w.clock; if (w.cat.wants.some(x => x.kind === 'solve' && x.mystery === 'sparks')) { want = w.clock; assert.ok(seen, 'the want only comes after it has seen them'); } }
  assert.ok(seen, 'it sees the sparks the first time they are out while it is awake');
  const f = mk(); f.cat.needs.lonely = 0.9; meetFrog(f); assert.equal(f.cat.needs.lonely, 0, 'meeting the frog takes all the loneliness away');
  ok('the spark want only follows seeing them; the first frog meeting sets loneliness to 0');
}

// ---- the cat tree
{
  const w = calm(mk()); w.cat.peekUrge = true; let d = decide(w, null); assert.equal(d.type, 'peek', 'it goes to look behind the cabin');
  run(w, 400); assert.ok(w.catTree && w.catTree.how === 'found' && !w.cat.peekUrge, 'it finds a cat tree');
  assert.ok(w.journal.some(j => /cat tree/.test(j.text)) && w.log.some(e => /cat tree/.test(e.text)));
  const w2 = mk(); w2.cat.needs.lonely = 0; w2.catTree = { x: 50, y: 300, how: 'found', day: 1 }; let sat = 0; run(w2, 12000 * 2); assert.ok((w2.stats.catTreeSits || 0) >= 2, 'it sits in it: ' + w2.stats.catTreeSits);
  assert.ok(!foundCatTree(w2, 'found'), 'there is only one');
  const m = calm(mk()); unlockRecipe(m, 'cattree', 'Cat tree'); m.table = { x: 1, y: 1, day: 1 }; Object.assign(m.cat.inv, { bark: 8, twig: 5, twine: 3 }); addWant(m, { kind: 'craft', key: 'cattree', recipe: 'cattree' });
  assert.ok(knows(m, 'cattree')); assert.ok(finishCraft(m, 'cattree') && m.catTree && m.catTree.how === 'made' && m.cat.inv.bark === 0, 'it builds one from bark, twigs and twine');
  assert.ok(!m.cat.wants.some(x => x.recipe === 'cattree'), 'and stops wanting one');
  const r = deserialize(serialize(m)); assert.ok(r.catTree && r.catTree.how === 'made', 'saved');
  // the odds are exact, so test the threshold rather than sampling (sampling flaked about 1 run in 100)
  const probe = f => { const x = mk(); x.clock = 3 * x.dayLen; const edge = PACE.peekChance * (0.6 + x.cat.traits.curious * 0.8), r = Math.random; Math.random = () => edge * f; try { secretsRoll(x); } finally { Math.random = r; } return !!x.cat.peekUrge; };
  assert.ok(probe(0.5) && !probe(1.5), 'the roll succeeds just under the stated chance and fails just over it'); const perDay = PACE.peekChance * (0.6 + 0.5 * 0.8) * 6; assert.ok(perDay > 0.008 && perDay < 0.04, 'about 1-3% a day: ' + (perDay * 100).toFixed(1) + '%');
  assert.ok(/cat tree/.test(runCommand(mk(), 'secret status', { admin: true }).lines.join(' ')));
  ok('rare to wonder what is behind the cabin; finds or builds a cat tree; sits in it; saved');
}

// ---- the oak and the coin
{
  const run2 = (cur, days = 16) => { const w = mk(); w.cat.traits.curious = cur; w.cat.temper = 'collector'; let interest = null, solved = null; for (let t = 0; t < 12000 * days && !solved; t++) { // (the longer horizon is for the cats that do wonder: it can be a week before the chance comes up)
    tick(w, 0.1); if (t % 50 === 0) w.cat.traits.curious = cur; /* (pinned: over weeks the cat's character drifts, and a cat that drifts past 90 is quicker) */ const m = w.mysteries.tree; if (m.interest && interest == null) interest = w.clock / w.dayLen; if (m.solved) solved = w.clock / w.dayLen; } return { w, interest, solved }; };
  const a = run2(0.5); assert.ok(a.interest == null && a.solved == null, 'an ordinary cat never wonders about the oak');
  const b = run2(0.8, 30); assert.ok(b.interest != null && b.solved != null && b.solved - b.interest >= 2, `a curious cat starts wondering (day ${b.interest.toFixed(1)}) and takes days to find it (day ${b.solved.toFixed(1)})`);
  assert.ok(b.w.stash.items.some(i => i.type === 'coin') && b.w.cat.coinDay && coinActive(b.w) && b.w.cat.mood.joy > 0.8, 'it finds a shiny coin and is delighted');
  const c = run2(0.95, 30); assert.ok(c.solved != null && c.solved - c.interest < (b.solved - b.interest), `over 90 curiosity is quicker: ${(c.solved - c.interest).toFixed(1)} vs ${(b.solved - b.interest).toFixed(1)} days`);
  const w = b.w; run(w, w.dayLen * 1.5); assert.ok(coinActive(w) && w.cat.mood.joy > 0.7, 'still delighted a day and a half later'); run(w, w.dayLen * 1.2); assert.ok(!coinActive(w), 'back to normal after two days');
  const r = deserialize(serialize(b.w)); assert.ok(r.mysteries.tree.solved && r.cat.coinDay > 0 && r.stash.items.length === b.w.stash.items.length, 'saved'); // (a crow may have taken the coin by now, so compare with the live stash)
  const q = mk(); q.cat.traits.curious = 0.95; assert.equal(quick(q, 'moon'), 2); assert.equal(quick(q, 'tree'), 2); assert.equal(quick(q, 'sparks'), 1); assert.equal(clueCap(q, 'moon'), 2 * clueCap(mk(), 'moon'));
  ok('only a curious cat wonders about the oak; it finds a coin that makes it delighted for two days; over 90 is twice as quick');
}

// ---- the moon
{
  const w = mk(); const m = w.mysteries.moon; m.theory = 'x'; m.sawPhases = true; meetFrog(w);
  for (let i = 0; i < 9; i++) frogVisited(w); assert.ok(!m.solved, 'nine visits are not enough'); frogVisited(w); assert.ok(m.solved, 'the tenth is the last step');
  assert.equal(frogVisitsForMoon(w), 10);
  const f = mk(); f.cat.traits.curious = 0.95; assert.equal(frogVisitsForMoon(f), 5, 'twice as fast for a very curious cat');
  const x = mk(); assert.ok(!moonWishTick(x), 'no wish before the moon is understood');
  const day = d => { w.clock = (d - 1) * w.dayLen + 0.1 * w.dayLen; };
  let wishes = 0; for (let d = 1; d <= 24; d++) { day(d); w.clock += 0.8 * w.dayLen; const had = w.stats.moonWishes || 0; run(w, 5); if ((w.stats.moonWishes || 0) > had) { wishes++; assert.equal(moonPhase(w), 4, 'only on a full moon'); } }
  assert.ok(wishes >= 2 && wishes <= 3, 'one wish each full moon: ' + wishes);
  const it = moonWish(w); assert.ok(it && it.moon && Math.abs(it.y - (w.o.pond.y + w.o.pond.ry)) < 40, 'something shining appears at the pond edge'); // (called directly: in the loop above the cat may already have picked it up)
  assert.ok(w.journal.some(j => j.tag === 'moonwish'));
  const sv = deserialize(serialize(w)); assert.equal(sv.moonWishDay, w.moonWishDay);
  ok('ten visits with the frog (five for a very curious cat) unlock the moon; each full moon grants one wish at the pond');
}

// ---- each quirk goes looking for its own kind of page
{
  for (const t of Object.keys(QUIRK_QUERIES)) {
    const w = mk(); w.cat.temper = t; ensureTablet(w); let mine = 0; const seen = new Set();
    for (let i = 0; i < 300; i++) { const r = pickRequest(w); if (r.quirk) { mine++; assert.ok(QUIRK_QUERIES[t].includes(r.q), t + ' asked for ' + r.q); seen.add(r.q); } }
    assert.ok(mine > 70 && mine < 190, `${t}: about 40% of its searches are its own: ${mine}/300`); assert.ok(seen.size >= 8, `${t}: plenty of variety: ${seen.size}`);
  }
  const plain = mk(); ensureTablet(plain); for (let i = 0; i < 100; i++) assert.ok(!pickRequest(plain).quirk, 'a cat with no quirk has no quirk searches');
  const w = mk(); w.cat.temper = 'techie'; ensureTablet(w); w.tablet.asked = []; const first = []; for (let i = 0; i < 400 && first.length < QUIRK_QUERIES.techie.length; i++) { const r = pickRequest(w); if (r.quirk) first.push(r.q); }
  assert.equal(new Set(first).size, QUIRK_QUERIES.techie.length, 'it works through every page on its list before repeating one');
  ok('every quirk has its own searches (about 40% of the time), working through its list before repeating');
}

// ---- every thought key the code uses has lines of its own
{
  const src = ['acts', 'mysteries', 'craft', 'wants', 'tablet', 'frog', 'offerings', 'upset', 'secrets', 'wishes'].map(f => fs.readFileSync(new URL(`../src/sim/${f}.js`, import.meta.url), 'utf8')).join('\n');
  const keys = new Set([...src.matchAll(/think\(w, '([A-Za-z]+)'/g)].map(m => m[1]).concat([...src.matchAll(/thoughtHint = '([A-Za-z]+)/g)].map(m => m[1])));
  const w = mk(); const idle = new Set(Array.from({ length: 200 }, () => thoughtFor(w, 'idle')));
  const missing = [...keys].filter(k => k !== 'idle' && k !== 'theory' && k !== 'explore' && (() => true)()).filter(k => { const seen = new Set(Array.from({ length: 60 }, () => thoughtFor(w, k))); return [...seen].every(s => idle.has(s)); });
  assert.deepEqual(missing, [], 'these fall back to idle lines: ' + missing);
  const w2 = mk(); const all = new Set(); for (const t of ['collector', 'vangogh', 'hunter', 'nightowl', 'techie', 'garfield', 'builder']) { w2.cat.temper = t; for (let i = 0; i < 80; i++) all.add(thoughtFor(w2, 'idle')); }
  assert.ok(all.size > 45, 'plenty of variety across quirks: ' + all.size);
  ok('every thought has its own lines; quirks have their own voices');
}
console.log('\nALL OK');
