// A special interest: the cat takes up one subject at random and researches it on the tablet, page after page, then moves on.
import assert from 'node:assert/strict';
import { makeWorld, tick, catchUp } from '../src/sim/sim.js';
import { fetchPage } from '../src/sim/web.js';
import { pickRequest } from '../src/sim/tablet.js';
import { journal, dayOf } from '../src/sim/world.js';
import { ensureInterest, interestTick, startInterest, interestActive, interestPage, interestMiss, finishInterest, interestName, interestRequest, interestDigest, interestReply, INTEREST_PAGES, MAX_MISSES, TOPIC_NAMES, interestKey } from '../src/sim/interest.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { offlineReply, thoughtFor } from '../src/sim/thoughts.js';
import { digest } from '../src/sim/llm.js';
import { runCommand } from '../src/sim/commands.js';
import { TEMPER_IDS } from '../src/sim/temper.js';
import { composePost, ensureBlog } from '../src/sim/blog.js';
import { seedTests, withRandom, setRandom } from '../src/sim/rng.js';
seedTests(1); // (every world here gets a fixed seed, so this test gives the same result every run)

const ok = m => console.log('  ok ' + m);
const fresh = (temper = null) => { const w = makeWorld('Int'); w.cat.temper = temper; w.cat.mem.known.tablet = 1; w.netOn = true; return w; };
const pg = (title, extract) => ({ title, extract: extract || `${title} is a subject people have written a good deal about over many years. It has a long history.`, url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title) });

// ---- when and how it starts
{
  const w = fresh(); w.clock = 1 * w.dayLen; assert.equal(withRandom(0, () => interestTick(w)), null, 'not in the first days');
  w.clock = 5 * w.dayLen; const nt = fresh(); nt.cat.mem.known.tablet = 0; nt.clock = 5 * nt.dayLen; assert.equal(withRandom(0, () => interestTick(nt)), null, 'not before it has found the tablet');
  assert.equal(withRandom(0.99, () => interestTick(w)), null, 'a matter of chance');
  const i = withRandom(0, () => interestTick(w)); assert(i && interestActive(w) && TOPIC_NAMES.includes(i.topic), 'it takes up something: ' + (i && i.topic));
  assert(w.journal.some(e => e.tag === 'interest' && /become interested/.test(e.text)) && w.chat.some(m => m.from === 'sys' && /fascinated/.test(m.text)), 'diary and the human are told');
  assert.equal(withRandom(0, () => interestTick(w)), null, 'one at a time');
  finishInterest(w, 'enough'); w.clock += w.dayLen * 0.3; assert.equal(withRandom(0, () => interestTick(w)), null, 'and it rests in between (nothing was read, so it is just a phase)');
  ok('starts after the tablet and a few days, by chance, one at a time');
}
// ---- random, tilted by nature, and not the same twice
{
  const pickN = (temper, n = 4000) => { const t = {}, w = fresh(temper); for (let k = 0; k < n; k++) { w.cat.interest = null; startInterest(w); t[w.cat.interest.topic] = (t[w.cat.interest.topic] || 0) + 1; } return t; };
  const a = pickN(null), g = pickN('garfield'); assert(Object.keys(a).length > 40, 'a wide variety: ' + Object.keys(a).length);
  const food = ['Tea', 'Honey', 'Chocolate', 'Pancake', 'Cheese'], share = t => food.reduce((s, k) => s + (t[k] || 0), 0) / 4000;
  assert(share(g) > share(a) * 1.5, `Garfield leans to food (${(share(g) * 100).toFixed(0)}% vs ${(share(a) * 100).toFixed(0)}%)`);
  const w = fresh(); const seen = new Set(); for (let k = 0; k < 40; k++) { startInterest(w); seen.add(w.cat.interest.topic); w.cat.interests.unshift({ topic: w.cat.interest.topic }); finishInterest(w, 'enough'); } assert.equal(seen.size, 40, 'never the same subject twice');
  assert.equal(interestName({ topic: 'Octopus' }), 'octopuses'); assert.equal(interestName({ topic: 'Tea' }), 'tea'); assert.equal(interestName({ topic: 'Lighthouse' }), 'lighthouses');
  ok('random but in character, varied, never repeated, talked about properly');
}

// ---- the research request: the same subject, skipping what it has read
{
  const w = fresh(); startInterest(w, 'Lighthouse'); const r1 = withRandom(0.1, () => pickRequest(w)); assert.deepEqual([r1.kind, r1.q, r1.interest, r1.skip], ['lookup', 'Lighthouse', true, []]);
  w.cat.interest.titles.push('Lighthouse', 'Fresnel lens'); const r2 = withRandom(0.1, () => pickRequest(w)); assert.deepEqual(r2.skip, ['Lighthouse', 'Fresnel lens']);
  assert.notEqual(withRandom(0.95, () => pickRequest(w)).interest, true, 'now and then it looks at something else');
  w.cat.wants.push({ id: 'l', kind: 'lookup', word: 'moss', key: 'moss', strength: 0.8 }); assert.equal(withRandom(0.1, () => pickRequest(w)).word, 'moss', 'a specific thing it wants to know comes first');
  ok('the tablet is asked about the subject, skipping pages it has read');
}
// ---- the web layer: the next page on the subject, never the same one
{
  const results = [pg('Lighthouse'), pg('Fresnel lens'), pg('Lighthouse of Alexandria'), pg('List of lighthouses', 'A list of lighthouses.'), pg('Eddystone Lighthouse')].map((p, i) => Object.assign({}, p, { index: i + 1 }));
  const get = async url => { assert(/gsrlimit=(1|10)\b/.test(url)); return { query: { pages: results.slice().reverse() } }; }; // (out of order: sorted by rank)
  assert.equal((await fetchPage(get, { kind: 'lookup', q: 'Lighthouse' })).title, 'Lighthouse');
  assert.equal((await fetchPage(get, { kind: 'lookup', q: 'Lighthouse', skip: ['Lighthouse'] })).title, 'Fresnel lens', 'next in line');
  assert.equal((await fetchPage(get, { kind: 'lookup', q: 'Lighthouse', skip: ['lighthouse', 'FRESNEL LENS'] })).title, 'Lighthouse of Alexandria', 'whatever the case');
  assert.equal((await fetchPage(get, { kind: 'lookup', q: 'Lighthouse', skip: ['Lighthouse', 'Fresnel lens', 'Lighthouse of Alexandria'] })).title, 'Eddystone Lighthouse', 'lists are not pages');
  await assert.rejects(fetchPage(get, { kind: 'lookup', q: 'Lighthouse', skip: results.map(r => r.title) }), /nothing more found/);
  const unsafe = async () => ({ query: { pages: [Object.assign(pg('Dark Massacre', 'A massacre took place here.'), { index: 1 }), Object.assign(pg('Pond snail'), { index: 2 })] } });
  assert.equal((await fetchPage(unsafe, { kind: 'lookup', q: 'snail', skip: ['x'] })).title, 'Pond snail', 'upsetting pages are skipped here too');
  ok('web: the next page on the subject, in rank order, safe and readable');
}

// ---- reading: each page counts, facts are kept, then it is done
{
  const w = fresh(); startInterest(w, 'Octopus'); const i = w.cat.interest;
  for (let k = 1; k < INTEREST_PAGES; k++) { interestPage(w, pg('Octopus ' + k, 'The octopus has three hearts and nine brains, which is a lot for one animal. It is a mollusc.')); assert(interestActive(w), 'still at it after ' + k); }
  assert.equal(i.pages, INTEREST_PAGES - 1); assert(w.cat.assoc[interestKey(i)] && w.cat.assoc[interestKey(i)].n === INTEREST_PAGES - 1, 'it enjoys reading about it, and that can become a taste');
  interestPage(w, pg('Octopus 6', 'Octopuses can squeeze through any gap larger than their beak, which makes them escape artists.'));
  assert(!interestActive(w) && i.state === 'done' && w.cat.interests[0].topic === 'Octopus' && w.cat.interests[0].pages === INTEREST_PAGES, 'enough is enough');
  const j = w.journal.find(e => e.tag === 'interest' && /I have read 6 pages about octopuses/.test(e.text)); assert(j && /The part I will keep:/.test(j.text), 'it keeps one thing: ' + (j && j.text));
  assert(w.cat.thoughtHint === 'interestDone' && w.cat.interestAt === w.clock);
  ok('six pages and it is done; a fact kept; a taste for the subject grows');
}
// ---- running dry
{
  const w = fresh(); startInterest(w, 'Fog'); interestPage(w, pg('Fog')); for (let k = 0; k < MAX_MISSES; k++) { assert(interestActive(w)); interestMiss(w); }
  assert(!interestActive(w) && w.journal.some(e => /nothing more to show me/.test(e.text)), 'the slab has nothing more: ' + w.journal[0].text);
  const v = fresh(); startInterest(v, 'Fog'); for (let k = 0; k < MAX_MISSES; k++) interestMiss(v); assert(!interestActive(v) && v.cat.interest === null && v.journal.some(e => /could not find anything about fog/.test(e.text)), 'nothing at all: a phase'); assert.equal(v.cat.interests.length, 0);
  ok('it gives up gracefully when the slab has nothing more');
}

// ---- the whole thing in the sim, against a fake Wikipedia
{
  const w = fresh('techie'); w.cat.traits.curious = 0.9; const served = {}; let nosignal = 0;
  const answer = () => { for (const r of w.netq) if (r.state === 'queued') {
    r.state = 'done'; if (r.interest) { const n = (served[r.q] = served[r.q] || []).length + 1; if (n > 8) { r.state = 'error'; r.error = 'nothing more found'; continue; } assert(!r.skip.includes(`${r.q} page ${n}`), 'never asked for what it has'); served[r.q].push(`${r.q} page ${n}`); r.result = pg(`${r.q} page ${n}`, `Page ${n} about ${r.q}. ${r.q} has a long and surprising history that people have enjoyed learning about.`); }
    else r.result = pg('Something else ' + Math.random().toString(36).slice(2, 6)); } };
  w.clock = 3 * w.dayLen; for (let i = 0; i < 40 * 1200 / 0.5; i++) { tick(w, 0.5); answer(); }
  const done = w.cat.interests, c = w.cat; assert(done.length >= 2, 'it went through at least two interests in 40 days: ' + done.length + ' ' + done.map(x => x.topic));
  for (const d of done) assert(d.pages >= 1 && d.pages <= INTEREST_PAGES * (d.sessions || 1), d.topic + ' ' + d.pages); // (an interest is for good: coming back adds to the pages)
  assert(Object.values(served).every(l => new Set(l).size === l.length), 'never the same page twice for one subject');
  assert(w.journal.some(e => e.tag === 'interest' && /I have read \d pages? about/.test(e.text)));
  ok('40 days against a fake Wikipedia: ' + done.map(d => `${d.topic}(${d.pages})`).join(', '));
}

// ---- it shows
{
  const w = fresh(); startInterest(w, 'Lighthouse'); interestPage(w, pg('Lighthouse', 'A lighthouse is a tower with a bright light that guides ships safely past rocks at night.'));
  assert(/Lighthouse\. I am deep into lighthouses/.test(offlineReply(w, 'what are you into lately?')), offlineReply(w, 'what are you into lately?')); assert(/guides ships/.test(offlineReply(w, 'do you have a special interest?')));
  assert(/Your special interest right now: lighthouses.*1 page so far.*guides ships/.test(digest(w)), 'Claude is told');
  let heard = null; for (let i = 0; i < 300 && !heard; i++) { const t = thoughtFor(w, 'idle'); if (/lighthouses/.test(t)) heard = t; } assert(heard, 'it thinks about it sometimes');
  w.cat.mem.known.tablet = 1; ensureBlog(w); w.blog.started = 1; for (let i = 0; i < 8; i++) journal(w, `Entry ${i}.`, 'craft'); const ids = new Set(); for (let i = 0; i < 40; i++) { const p = composePost(w); if (/lighthouses/.test(p.body)) ids.add(1); } assert(ids.size, 'the blog covers what it learned');
  const f = fresh(); assert(/Nothing in particular/.test(offlineReply(f, 'what are you into lately?')));
  finishInterest(w, 'enough'); assert(/Lately it was lighthouse/.test(offlineReply(w, 'what are you into lately?')) && /Your special interests so far: lighthouse/.test(digest(w)));
  ok('chat, thoughts, the blog and the Claude briefing');
}
// ---- admin, saves, away
{
  const w = fresh(); assert(/new special interest: Octopus/.test(runCommand(w, 'interest start octopus', { admin: true }).lines.join(' '))); assert(/Octopus \(active\)/.test(runCommand(w, 'interest', { admin: true }).lines.join(' ')));
  assert(/Finished/.test(runCommand(w, 'interest done', { admin: true }).lines.join(' '))); assert(/topics include/.test(runCommand(w, 'interest start zzzzz', { admin: true }).lines.join(' ')));
  const s = fresh(); startInterest(s, 'Kite'); interestPage(s, pg('Kite')); const s2 = deserialize(serialize(s)); assert.equal(s2.cat.interest.topic, 'Kite'); assert.equal(s2.cat.interest.pages, 1); assert.equal(s2.cat.interest.titles[0], 'Kite');
  const old = JSON.parse(serialize(s)); delete old.cat.interest; delete old.cat.interests; delete old.cat.interestAt; const s3 = deserialize(JSON.stringify(old)); assert(s3.cat.interest === null && Array.isArray(s3.cat.interests));
  const a = fresh(); a.clock = 4 * a.dayLen; catchUp(a, 2 * a.dayLen); assert(a.netq.length === 0 || a.netq.every(r => r.state !== 'taken'), 'catching up does not break');
  ok('admin command, saves (and old saves), catching up');
}
console.log('interest tests passed');
