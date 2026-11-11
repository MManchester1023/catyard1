// Feelings, bark and crafting, the table, recipes learned on the tablet, wish notes to the human, history and export.
import assert from 'node:assert/strict';
import { makeWorld, tick, catchUp } from '../src/sim/sim.js';
import { start, done } from '../src/sim/acts.js';
import { feel, affinity, topFeelings } from '../src/sim/feelings.js';
import { selfTaught, scratchTree, collectDrop, finishCraft, startable, shortfall, gatherNeed, humanNeed, nextCraft, INV_CAP, unlockRecipe } from '../src/sim/craft.js';
import { RECIPES, knows } from '../src/sim/recipes.js';
import { considerWish, publishWish, matchWish, wishTick, openWishes, draftWish, wishPending } from '../src/sim/wishes.js';
import { leaveOffering, inspectOffer, finishOffer } from '../src/sim/offerings.js';
import { fetchPage, Net, TABLET_DEFAULTS } from '../src/sim/web.js';
import { ensureTablet } from '../src/sim/tablet.js';
import { timeline, daySummary, daysList, exportText, KIND_IDS } from '../src/sim/history.js';
import { dayOf, HIST_MAX, DAYS_MAX, pushHist } from '../src/sim/world.js';
import { runCommand } from '../src/sim/commands.js';
import { serialize, deserialize } from '../src/sim/save.js';

const ok = name => console.log('  ok', name);
const run = (w, s, dt = 0.1) => { for (let t = 0; t < s; t += dt) tick(w, dt); };
const withRandom = (v, f) => { const real = Math.random; Math.random = typeof v === 'function' ? v : () => v; try { return f(); } finally { Math.random = real; } };
const LONG = ' It has been studied for a very long time by many careful people who wrote down everything they learned about it.';
const page = (title, extract) => ({ query: { pages: [{ title, extract: extract + LONG, fullurl: 'https://en.wikipedia.org/wiki/' + title.replace(/ /g, '_') }] } });
const fakeHttp = search => async url => ({ ok: true, status: 200, json: async () => (url.includes('generator=search') ? search[decodeURIComponent(url.match(/gsrsearch=([^&]*)/)[1])] || { query: { pages: [] } } : { query: { pages: [] } }) });
const mkNet = (http) => { const s = { tablet: Object.assign({}, TABLET_DEFAULTS, { usage: { date: '', calls: 0 } }) }; return new Net({ getSettings: () => s, saveSettings: () => {}, http }); };
const calm = w => { w.weather.type = 'clear'; w.weather.rain = 0; w.weather.timer = 1e9; w.mice = []; w.items = []; w.thiefT = 1e9; w.itemT = 1e9; w.mouseT = 1e9; };
const knowAll = w => { for (const k of ['pond', 'post', 'tree', 'flowers', 'cushion', 'yarn', 'fence', 'easel', 'tablet']) w.cat.mem.known[k] = 1; };

// ---- feelings: how something made it feel is what it learns to like, and the same gift lands differently on a different day
{
  const w = makeWorld('Fern'), c = w.cat; c.mood.joy = 0.4; c.needs.lonely = 0.5;
  c.quirk.favColor = 'red'; c.tastes.color.teal = 0.3; c.tastes.color.black = 0.3; const t0 = c.tastes.color.teal;
  for (let i = 0; i < 6; i++) { c.needs.lonely = 0.5; feel(w, ['color:teal', 'act:paint'], { joy: 0.3, lonely: -0.2 }, 'warm'); }
  assert(affinity(w, 'color:teal') > 0.3, 'repeated good feelings become a taste: ' + affinity(w, 'color:teal'));
  assert(c.tastes.color.teal > t0 + 0.1, 'the colour taste moved with it');
  assert(w.journal.some(e => e.tag === 'taste' && /teal/.test(e.text)), 'it notices and says so');
  for (let i = 0; i < 6; i++) { c.needs.fear = 0; feel(w, ['color:black'], { fear: 0.3, joy: -0.15 }, 'uneasy'); }
  assert(affinity(w, 'color:black') < -0.15 && topFeelings(w, 3).bad.some(r => r.key === 'color:black'), 'bad feelings become dislikes');
  const gift = () => ({ kind: 'item', type: c.quirk.item, color: 'orange' });
  const a = makeWorld('A'), b = makeWorld('B'); a.cat.quirk = b.cat.quirk; // same cat, different day
  let lo = 0, hi = 0; const N = 30;
  for (let i = 0; i < N; i++) {
    a.cat.needs.lonely = 0.9; a.cat.needs.hunger = 0.1; a.cat.mood.joy = 0.7; b.cat.needs.lonely = 0.0; b.cat.needs.hunger = 0.95; b.cat.mood.joy = 0.2;
    hi += inspectOffer(a, leaveOffering(a, gift()).offer).liking; lo += inspectOffer(b, leaveOffering(b, gift()).offer).liking; a.offers = []; b.offers = [];
  }
  assert(hi / N > lo / N + 0.08, `a lonely, fed cat likes the same gift more than a hungry, content one: ${(hi / N).toFixed(2)} vs ${(lo / N).toFixed(2)}`);
  ok('feelings: good and bad experiences become tastes, and its mood colours what it thinks of a gift');
}

// ---- bark: scratching the oak sometimes gives bark or a twig, never beyond what it can hold
{
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w);
  const luck = (0.38 + c.traits.curious * 0.06) * 0.5; // the oak is half as generous as it used to be (pace.js)
  assert.equal(withRandom(0.01, () => scratchTree(w)), 'bark'); assert.equal(withRandom(luck + 0.03, () => scratchTree(w)), 'twig'); assert.equal(withRandom(0.99, () => scratchTree(w)), null);
  c.inv.bark = INV_CAP; assert.equal(withRandom(0.01, () => scratchTree(w)), null, 'a full load gets no more');
  c.inv.bark = 0; collectDrop(w, 'bark'); collectDrop(w, 'twig'); assert(c.inv.bark === 1 && c.inv.twig === 1 && w.stats.gathered === 2);
  assert(w.journal.some(e => e.tag === 'craft'), 'the first piece gets a diary line');
  // the whole act: walk to the oak, scratch, a piece drops, it picks it up
  c.inv = { bark: 0, twig: 0, twine: 0 }; c.reeval = 1e9; const g0 = w.stats.gathered; c.gToday = 0; // (a new day: the oak has its two pieces back)
  withRandom(0.01, () => { start(w, 'play', { kind: 'tree', gather: true }); let sawPick = false; for (let i = 0; i < 900 && w.stats.gathered === g0; i++) { c.reeval = 1e9; tick(w, 0.1); if (c.act.phase === 'pick') sawPick = true; } assert(sawPick, 'it crouches to pick the piece up'); });
  assert(c.inv.bark === 1 && w.stats.gathered === g0 + 1, 'the piece went into what it carries');
  assert(/oak/i.test(w.log.find(e => e.kind === 'craft').text));
  ok('bark and twigs: drop chance, carrying cap, and the full scratch-drop-pick-up act');
}

// ---- the table: needs bark, moves the stash out of hiding and onto itself, and is made only once
{
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w);
  for (let i = 0; i < 7; i++) w.stash.items.push({ id: 'i' + i, type: c.quirk.item, color: ['red', 'blue', 'green'][i % 3], ox: 0, oy: 0, rot: 0 });
  w.stash.site = { x: 52, y: 318, label: 'behind the cabin' };
  assert(knows(w, 'table') && !startable(w, 'table') && shortfall(w, 'table').bark === 4, 'a preset recipe, but it has no bark yet');
  assert.deepEqual(gatherNeed(w), { bark: 4, twig: 0 }, 'so it knows it needs to gather bark');
  c.art.count = 1; c.art.works.unshift({ id: 'p0', title: 'First', score: 0.5, subject: 'moon', level: 1, day: 1, when: 'Night', critique: 'x' }); c.inv = { bark: 3, twig: 2, twine: 0 };
  assert.equal(nextCraft(w), null, 'it saves its bark for the table instead of spending it on a frame'); c.art.count = 0; c.art.works = [];
  c.inv.bark = 4; assert.equal(nextCraft(w), 'table');
  start(w, 'craft', { recipe: 'table' }); for (let i = 0; i < 1200 && !w.table; i++) { c.reeval = 1e9; tick(w, 0.1); }
  assert(w.table, 'it built the table'); assert.equal(c.inv.bark, 0, 'and spent the bark');
  assert(w.stash.site.table && w.stash.site.x === w.o.table.x, 'the stash moved onto the table');
  assert(w.stash.items.every(i => Math.abs(i.ox) <= 40 && Math.abs(i.oy) <= 12), 'laid out on the tabletop: ' + JSON.stringify(w.stash.items.slice(0, 2)));
  assert(w.journal.some(e => /table/.test(e.text) && e.tag === 'craft'), 'in its diary');
  assert(!startable(w, 'table') && !RECIPES.table.can(w), 'one table is enough');
  const got = w.stash.items.length;
  // walking around the table: it is an obstacle, and the cat does not end up inside it
  let inside = 0; for (let i = 0; i < 4000; i++) { tick(w, 0.1); if (Math.abs(c.x - w.o.table.x) < 28 && Math.abs(c.y - w.o.table.y) < 7) inside++; } assert.equal(inside, 0, 'never stood inside the table');
  assert(w.stash.items.length >= got, 'nothing lost from the stash');
  ok('table: bark gathered, built once, stash moves onto it, tabletop layout, obstacle');
}

// ---- other recipes: frames need a painting; feeder and chime have to be looked up first
{
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w); c.inv = { bark: 12, twig: 12, twine: 12 };
  assert(!startable(w, 'frame'), 'no painting to frame yet');
  c.art.count = 2; c.art.works.unshift({ id: 'p1', title: 'Moon Dip', score: 0.8, subject: 'moon', level: 3, day: 1, when: 'Night', critique: 'x' }); const xp = c.art.xp;
  assert(startable(w, 'frame')); const m = finishCraft(w, 'frame'); assert(m && m.work === 'Moon Dip' && c.art.xp > xp && c.inv.bark === 10 && c.inv.twig === 11, JSON.stringify(m));
  assert(!knows(w, 'feeder') && !startable(w, 'feeder') && !startable(w, 'chime'), 'unknown recipes cannot be made');
  assert.equal(finishCraft(w, 'feeder'), false, 'and finishing one it does not know does nothing');
  unlockRecipe(w, 'feeder', 'Bird feeder'); assert(knows(w, 'feeder') && startable(w, 'feeder'));
  finishCraft(w, 'feeder'); assert(w.deco.feeder && !startable(w, 'feeder'));
  assert.equal(w.stats.crafted, 2);
  ok('recipes: frame needs a painting, feeder and chime need the tablet, results persist as decorations');
}

// ---- looking a recipe up on the tablet (fake Wikipedia), and working it out alone when the tablet cannot help
{
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w); ensureTablet(w); w.netOn = true; c.wants = []; c.needs.hunger = 0.1; c.needs.tired = 0.1;
  c.recipes = {}; c.wants.push({ id: 'l1', kind: 'learn', key: 'feeder', recipe: 'feeder', strength: 0.9, born: 0, day: 1, text: 'work out how to make a bird feeder' });
  const net = mkNet(fakeHttp({ 'Bird feeder': page('Bird feeder', 'A bird feeder is a device placed outdoors to supply bird food to wild birds. It is a simple frame, usually of wood.') }));
  start(w, 'tablet'); for (let i = 0; i < 1800 && c.act.type === 'tablet'; i++) { c.reeval = 1e9; tick(w, 0.1); if (i % 10 === 0) { net.lastAt = 0; await net.tick(w); } }
  assert(knows(w, 'feeder'), 'the page taught it'); assert(!c.wants.some(x => x.kind === 'learn' && x.recipe === 'feeder'), 'the learning want is fulfilled');
  assert(c.wants.some(x => x.kind === 'craft' && x.recipe === 'feeder'), 'and now it wants to make one');
  assert(w.journal.some(e => /From the tablet/.test(e.text) && /bird feeder/.test(e.text)));
  // the tablet turns up nothing twice: it works it out by itself
  const w2 = makeWorld('Fern'), c2 = w2.cat; calm(w2); knowAll(w2); ensureTablet(w2); w2.netOn = true; c2.wants = []; c2.needs.hunger = 0.1; c2.needs.tired = 0.1;
  c2.wants.push({ id: 'l2', kind: 'learn', key: 'chime', recipe: 'chime', strength: 0.9, born: 0, day: 1, text: 'work out how to make a wind chime' });
  const net2 = mkNet(fakeHttp({ 'Wind chime': page('Weather vane', 'A weather vane shows the direction of the wind and is often placed on top of a building or a barn.') }));
  for (let v = 0; v < 3 && !knows(w2, 'chime'); v++) { start(w2, 'tablet'); for (let i = 0; i < 1800 && c2.act.type === 'tablet'; i++) { c2.reeval = 1e9; tick(w2, 0.1); if (i % 10 === 0) { net2.lastAt = 0; await net2.tick(w2); } } w2.tablet.interests = {}; w2.netq = []; }
  assert(knows(w2, 'chime'), 'after failing twice it figured it out by itself'); assert(w2.journal.some(e => /no help/.test(e.text)));
  // and with no connection at all it works it out after a couple of days
  const w3 = makeWorld('Fern'); calm(w3); w3.netOn = false; w3.cat.wants.push({ id: 'l3', kind: 'learn', key: 'feeder', recipe: 'feeder', strength: 0.9, born: 0, day: 1, text: 'work out how to make a bird feeder' });
  assert(!selfTaught(w3), 'not at once'); w3.clock += 2.5 * w3.dayLen; assert(!selfTaught(w3), 'two and a half days is still too soon (pace.js: four)'); w3.clock += 2 * w3.dayLen; assert(selfTaught(w3) && knows(w3, 'feeder'), 'after a few days'); w3.netOn = true;
  const w4 = makeWorld('Fern'); w4.netOn = true; w4.cat.wants.push({ id: 'l4', kind: 'learn', key: 'feeder', recipe: 'feeder', strength: 0.9, born: 0, day: 1, text: 'x' }); w4.clock += 9 * w4.dayLen; assert(!selfTaught(w4), 'online, it uses the tablet instead');
  ok('recipes from the tablet: a lookup unlocks it; after two misses (or a few offline days) it works it out itself');
}

// ---- notes to the human: something only they can bring becomes a note on the tablet, and bringing it grants the wish
{
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w); ensureTablet(w); w.netOn = false;
  assert(!withRandom(0.1, () => considerWish(w)), 'no notes in its first hours here'); w.clock = 2 * w.dayLen;
  unlockRecipe(w, 'chime', 'Wind chime'); c.wants.push({ id: 'c1', kind: 'craft', key: 'chime', recipe: 'chime', strength: 0.9, born: 0, day: 1, text: 'make a wind chime' }); c.inv = { bark: 0, twig: 3, twine: 0 };
  assert.deepEqual(humanNeed(w), { twine: 1 }, 'twine is the one thing the yard does not have');
  c.wishes = []; c.lastWishAt = -999;
  const wish = withRandom(0.1, () => considerWish(w)); assert(wish && wish.state === 'draft' && wish.kind === 'material' && wish.type === 'twine', JSON.stringify(wish));
  assert(wishPending(w) && draftWish(w) === wish, 'it now has a reason to go to the tablet');
  assert(!considerWish(w), 'only one at a time while it has not been written');
  start(w, 'tablet'); let sawWrite = false; for (let i = 0; i < 400 && wish.state === 'draft'; i++) { c.reeval = 1e9; tick(w, 0.1); if (c.act.phase === 'write') sawWrite = true; }
  assert(sawWrite && wish.state === 'open' && wish.written, 'it typed the note out at the tablet, even without a connection');
  assert(w.chat.some(m => m.from === 'sys' && m.text.includes(wish.text)), 'and you are told');
  assert(w.asks.some(a => a.type === 'wish' && a.id === wish.id), 'a Claude rewrite is queued');
  assert(w.journal.some(e => e.tag === 'wish') && w.stats.wishes === 1 && openWishes(w).length === 1);
  // the human brings it
  w.asks.length = 0; const bond0 = c.bond, tw0 = c.inv.twine;
  const { offer } = leaveOffering(w, { kind: 'material', type: 'twine' }); assert(matchWish(w, offer) === wish);
  const re = inspectOffer(w, offer); assert(re.tier === 'delight' || re.liking >= 0.9, 'it is delighted'); assert(wish.state === 'granted' && c.bond > bond0);
  assert(c.offerHist[0].wished === true && /asked|note|tablet/i.test(c.offerHist[0].text));
  assert.equal(finishOffer(w, offer), false, 'materials go into its things, not the stash'); assert(c.inv.twine === tw0 + 1);
  assert(startable(w, 'chime'), 'now it can make the chime'); assert.equal(nextCraft(w), 'chime');
  // unanswered notes fade after a while
  const w2 = makeWorld('Fern'); w2.cat.wishes.push({ id: 'x', state: 'open', day: 1, kind: 'item', type: 'marble', color: null, text: 'a marble', written: { day: 1, time: '10:00' } });
  w2.clock += 6 * w2.dayLen; wishTick(w2); assert.equal(w2.cat.wishes[0].state, 'faded');
  ok('wish notes: drafted for what only the human can bring, written at the tablet, granted by the matching offering, fading when ignored');
}

// ---- history: the timeline, day summaries and export
{
  const w = makeWorld('Fern'); calm(w); run(w, 1200 * 2.2);
  assert(w.hist.length > 100 && w.hist.length <= HIST_MAX + 100, 'timeline has entries: ' + w.hist.length);
  for (const k of ['did', 'thought', 'event', 'diary']) assert(timeline(w, { kinds: [k], limit: 5 }).length, 'has ' + k);
  const t = timeline(w, { limit: 50 }); assert(t.every((e, i) => i === 0 || t[i - 1].id > e.id), 'newest first');
  assert(timeline(w, { kinds: ['did'], q: 'sleep' }).every(e => /sleep/i.test(e.text)), 'search and filter');
  assert.equal(timeline(w, { kinds: ['chat'], limit: 5 }).length, 0);
  const d = daySummary(w, 1); assert(d && d.spent.length && Math.abs(d.spent.reduce((s, x) => s + x.pct, 0) - 1) < 1e-6, 'a day adds up to one');
  assert(daysList(w)[0] === dayOf(w) && daysList(w).length >= 2);
  const txt = exportText(w); for (const k of ['CAT YARD', 'THINGS', 'DAY BY DAY', 'DIARY', 'TIMELINE', 'Fern']) assert(txt.includes(k), 'export has ' + k);
  // what was said is in the history too
  const { userSpeaks, catSays } = await import('../src/sim/chat.js'); userSpeaks(w, 'hello there cat'); catSays(w, 'Mrrp.');
  assert(timeline(w, { kinds: ['chat'], limit: 5 }).length === 2);
  // catching up does not drown the timeline in moment-to-moment entries, but keeps the events and the day summaries
  const n0 = w.hist.length, did0 = w.hist.filter(e => e.k === 'did').length; catchUp(w, 3 * 3600);
  assert(w.hist.filter(e => e.k === 'did').length === did0 || w.hist.length - n0 < 400, 'catch-up adds events, not every step');
  assert(Object.keys(w.days).length <= DAYS_MAX);
  // trimming
  for (let i = 0; i < HIST_MAX + 300; i++) pushHist(w, 'event', 'x'); assert(w.hist.length <= HIST_MAX + 100, 'timeline is capped: ' + w.hist.length);
  ok('history: timeline filters and search, day summaries add up, export has every section, caps hold');
}

// ---- chat commands
{
  const w = makeWorld('Fern'); calm(w); run(w, 120);
  const out = c => runCommand(w, c, { admin: false }).lines.join('\n');
  assert(/carrying/.test(out('inventory')) && /bark table/.test(out('recipes')) && /feeder|chime/.test(out('recipes')));
  assert(out('history 5').split('\n').length <= 5 && /Day 1/.test(out('history day 1')) && /Day/.test(out('history days')));
  assert(/Nothing about|d\d/.test(out('history find oak')) && /feels good|nothing/.test(out('feelings')) && /not left|day/.test(out('wishes')));
  assert.equal(runCommand(w, 'export').action.type, 'export');
  assert(/Left .*twine/.test(out('give twine')) && /Left .*bark/.test(out('offer material bark')), 'materials can be left from the chat without admin');
  assert(/not|Usage|Materials/.test(out('give sofa')), 'and a bad material is refused');
  assert(/Admin mode is off/.test(runCommand(w, 'craft now table', { admin: false }).lines[0]));
  const a = c => runCommand(w, c, { admin: true }).lines.join('\n');
  assert(/now has 5 pieces of bark|now has/.test(a('craft give bark 5')) && /heading to the workbench/.test(a('craft now table')), a('craft now table'));
  for (let i = 0; i < 1200 && !w.table; i++) { w.cat.reeval = 1e9; tick(w, 0.1); } assert(w.table, 'forced craft builds it');
  assert(/Gallery|cleared|history/i.test(a('clear history')) && w.hist.length === 0);
  ok('commands: inventory, recipes, history, feelings, wishes, give, export, craft');
}

// ---- saving keeps all of it, and an old save (before any of this) still loads
{
  const w = makeWorld('Fern'), c = w.cat; calm(w); knowAll(w); run(w, 1200 * 2); c.inv = { bark: 7, twig: 2, twine: 1 }; unlockRecipe(w, 'chime', 'Wind chime'); w.deco.chime = true;
  c.wishes.push({ id: 'k', state: 'open', day: 2, kind: 'item', type: 'marble', color: 'teal', text: 'A teal marble.', written: { day: 2, time: '09:00' } });
  feel(w, ['color:teal'], { joy: 0.2 }, 'warm');
  const w2 = deserialize(serialize(w)), c2 = w2.cat;
  assert.deepEqual(c2.inv, c.inv); assert(knows(w2, 'chime') && w2.deco.chime === true);
  assert.deepEqual(w2.hist.slice(0, w.hist.length), w.hist, 'the whole timeline came back (loading adds at most the first moment of the new session)'); assert.deepEqual(Object.keys(w2.days), Object.keys(w.days)); assert.deepEqual(c2.crafted, c.crafted);
  assert(c2.assoc['color:teal'] && c2.wishes.some(x => x.id === 'k' && x.state === 'open'));
  assert.equal(!!w2.table, !!w.table); if (w.table) assert(w2.stash.site.table, 'the stash is still on the table');
  assert(c2.thoughtId >= 0 && w2.lastThoughtId === c2.thoughtId, 'no spurious thought entry on load');
  const h0 = w2.hist.length; run(w2, 20); assert(w2.hist.length >= h0);
  const old = JSON.parse(serialize(w)); for (const k of ['table', 'deco', 'hist', 'days']) delete old.w[k]; for (const k of ['inv', 'recipes', 'crafted', 'wishes', 'assoc', 'lastWishAt', 'lastTasteSay']) delete old.cat[k]; old.version = 2;
  const w3 = deserialize(JSON.stringify(old)); assert(w3.cat.inv.bark === 0 && Array.isArray(w3.hist) && w3.deco && w3.cat.assoc && Array.isArray(w3.cat.wishes) && w3.table === null, 'old save upgraded');
  run(w3, 1200 * 2); assert(w3.hist.length > 20 && !Number.isNaN(w3.cat.x));
  ok('save round trip keeps materials, recipes, table, decorations, history, wishes and feelings; older saves upgrade');
}

// ---- many days: nothing breaks, the cat gathers and builds, caps hold
{
  for (const seed of [1, 2, 3]) {
    const w = makeWorld('Soak' + seed), c = w.cat; w.netOn = false; let bad = 0, over = 0;
    for (let t = 0; t < 1200 * 9 * 10; t++) {
      tick(w, 0.1);
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.x < 0 || c.x > 960 || c.y < 0 || c.y > 600) bad++;
      for (const m of ['bark', 'twig', 'twine']) if (c.inv[m] > INV_CAP || c.inv[m] < 0) over++;
    }
    // discovery is slow now (pace.js): finding the oak and getting two pieces a day means the table can take a couple of weeks, so give it until day 22
    for (let t = 0; t < 1200 * 13 * 10 && !w.table; t++) tick(w, 0.1);
    assert.equal(bad, 0, 'cat stayed finite and in the yard'); assert.equal(over, 0, 'carrying stayed within its cap');
    assert(w.stats.gathered > 3 && w.table, `seed ${seed}: gathered ${w.stats.gathered}, table ${!!w.table}`);
    assert(w.hist.length <= HIST_MAX + 100 && Object.keys(w.days).length <= DAYS_MAX);
    assert(Object.values(c.needs).every(v => v >= 0 && v <= 1) && c.mood.joy >= 0 && c.mood.joy <= 1);
    for (const k of Object.keys(c.assoc)) assert(Number.isFinite(c.assoc[k].v) && Math.abs(c.assoc[k].v) <= 1.0001);
  }
  ok('nine days, three cats: no NaN, stays in the yard, gathers bark, builds the table (within three weeks), caps hold');
}
console.log('\nALL OK');
