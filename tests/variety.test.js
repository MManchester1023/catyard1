// The tablet should not keep landing on the same pages: it remembers everything it has read, skips it, varies, and when a
// search has nothing new it reads something random instead.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { fetchPage, Net, TABLET_DEFAULTS } from '../src/sim/web.js';
import { pickRequest, ensureTablet, QUIRK_QUERIES, ASKED_WORDS } from '../src/sim/tablet.js';
import { addWant } from '../src/sim/wants.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { TEMPER_IDS } from '../src/sim/temper.js';

const ok = m => console.log('  ok ' + m);
const LONG = ' It has been studied for a very long time by many careful people who wrote down everything they learned about it.';
const mkPage = (title, index) => ({ title, index, extract: `${title} is a subject.` + LONG, fullurl: 'https://en.wikipedia.org/wiki/' + title.replace(/ /g, '_') });
const RESULTS = Array.from({ length: 12 }, (_, i) => mkPage('Result ' + String.fromCharCode(65 + i), i + 1));
// a fake search that ignores what you ask and always ranks the same twelve pages (the worst case), honouring gsrlimit
const searchGet = async url => {
  if (url.includes('generator=random')) return { query: { pages: [mkPage('Random ' + Math.random().toString(36).slice(2, 8), 1)] } };
  const n = +url.match(/gsrlimit=(\d+)/)[1]; return { query: { pages: RESULTS.slice(0, n) } };
};
const titles = async (req, n) => { const out = []; for (let i = 0; i < n; i++) out.push((await fetchPage(searchGet, req)).title); return out; };

// ---- the web layer
{
  assert.equal((await fetchPage(searchGet, { kind: 'lookup', q: 'owl' })).title, 'Result A', 'a plain search takes the top result, as before');
  const vary = new Set(await titles({ kind: 'lookup', q: 'owl', vary: true, skip: [] }, 1)); // (no skip list: only the first result is asked for)
  const seen = ['Result A', 'Result B']; const got = new Set(await titles({ kind: 'lookup', q: 'owl', vary: true, skip: seen }, 120));
  assert([...got].every(t => ['Result C', 'Result D', 'Result E'].includes(t)), 'only among the first three new results, never one it has read: ' + [...got]);
  assert(got.size >= 3, 'and it does vary: ' + got.size);
  await assert.rejects(fetchPage(searchGet, { kind: 'lookup', q: 'owl', skip: RESULTS.map(r => r.title) }), /nothing more found/); // (a research subject still runs dry)
  const rnd = await fetchPage(searchGet, { kind: 'lookup', q: 'owl', vary: true, fallback: true, skip: RESULTS.map(r => r.title) }); assert(/^Random /.test(rnd.title), 'a general search with nothing new reads something random: ' + rnd.title);
  const empty = async url => ({ query: { pages: url.includes('generator=random') ? [mkPage('Random X', 1)] : [] } }); assert.equal((await fetchPage(empty, { kind: 'lookup', q: 'zzzz', fallback: true })).title, 'Random X', 'and so does one that finds nothing');
  await assert.rejects(fetchPage(empty, { kind: 'lookup', q: 'zzzz' }), /nothing found/);
  ok('searches skip what it has read, vary among the first new results, and fall back to something random');
}
// ---- what it asks for
{
  const w = makeWorld('Var'); ensureTablet(w); w.cat.temper = null; w.cat.mem.known.tablet = 1; const t = w.tablet;
  t.seen = ['heron', 'quartz']; t.interests = { feather: 5, branch: 4 }; let gen = 0, plain = 0;
  for (let i = 0; i < 80; i++) { const r = pickRequest(w); if (r.kind === 'lookup') { gen++; assert(r.vary && r.fallback && r.skip.includes('heron') && r.skip.includes('quartz'), 'a general search carries what it has read'); } else plain++; }
  assert(gen > 5 && plain > 5, `a mix of searches (${gen}) and featured or random pages (${plain})`);
  const w2 = makeWorld('Var2'); ensureTablet(w2); w2.cat.temper = null; w2.cat.mem.known.tablet = 1; w2.tablet.seen = ['heron']; addWant(w2, { kind: 'lookup', key: 'quartz', word: 'quartz' });
  const r = pickRequest(w2); assert.equal(r.word, 'quartz'); assert(r.skip.includes('heron') && !r.fallback && !r.vary, 'a word it wants skips what it has read, but is the best page, not a random one');
  const w3 = makeWorld('Var3'); ensureTablet(w3); w3.cat.temper = null; w3.cat.mem.known.tablet = 1; w3.tablet.seen = ['octopus']; w3.cat.interest = { topic: 'Octopus', state: 'active', titles: ['Giant Pacific octopus'], facts: [], pages: 1, misses: 0 }; w3.cat.interests = [];
  let ir = null; for (let i = 0; i < 40 && !(ir && ir.interest); i++) ir = pickRequest(w3); assert(ir && ir.interest && (sk => sk.includes('octopus') && sk.includes('giant pacific octopus'))(ir.skip.map(x => x.toLowerCase())) && !ir.fallback, 'research skips everything it has read, and still runs dry rather than wandering off');
  ok('general searches carry what it has read; wanted words and research keep their own rules');
}
// ---- the lists
{
  for (const tp of TEMPER_IDS) {
    const qs = QUIRK_QUERIES[tp]; assert(qs.length >= 25 && new Set(qs).size === qs.length, `${tp}: a long list (${qs.length}), no duplicates`);
    const w = makeWorld('L'); ensureTablet(w); w.cat.temper = tp; w.cat.mem.known.tablet = 1; const asked = [];
    for (let i = 0; i < 4000 && asked.length < qs.length * 2; i++) { const r = pickRequest(w); if (r.quirk) asked.push(r.q); }
    assert.equal(new Set(asked.slice(0, qs.length)).size, qs.length, `${tp}: works through its whole list before going round again`);
    assert(asked.length === qs.length * 2 && new Set(asked.slice(qs.length)).size === qs.length, `${tp}: and then starts a new round`);
  }
  const w = makeWorld('W'); ensureTablet(w); w.cat.temper = null; w.cat.mem.known.tablet = 1; const words = 'feather branch lantern marble thistle compass willow anchor meadow ember pebble quartz saddle violet harbor'.split(' ');
  w.tablet.interests = Object.fromEntries(words.map((x, i) => [x, 15 - i])); w.tablet.featuredDate = '2099-01-01'; const asked = [];
  for (let i = 0; i < 600; i++) { const r = pickRequest(w); if (r.kind === 'lookup') { asked.push(r.q); if (asked.length >= 2) assert.notEqual(asked[asked.length - 1], asked[asked.length - 2], 'never the same word twice running'); } }
  assert(new Set(asked).size >= 9, `it ranges over its commonest words, not just the top few: ${new Set(asked).size}`);
  ok('every quirk has 25+ searches used in rounds; commonest words are rotated, not repeated');
}
// ---- old saves, and the real loop
{
  const w = makeWorld('Old'); ensureTablet(w); w.tablet.pages.push({ id: 'p', kind: 'random', title: 'Kept Page', extract: 'x'.repeat(70), url: '', day: 2, time: '09:00', reaction: '', jid: null, seen: 1 }); delete w.tablet.seen;
  const old = JSON.parse(serialize(w)); delete old.w.tablet.seen; const b = deserialize(JSON.stringify(old)); ensureTablet(b); assert(b.tablet.seen.includes('kept page'), 'an old save starts from the pages it has kept');
  ok('old saves start their reading list from the pages they kept');
}
{
  for (const temper of ['nightowl', null]) {
    const w = makeWorld('Loop'); ensureTablet(w); w.cat.temper = temper; w.cat.mem.known.tablet = 1; w.netOn = true;
    const log = []; const http = async url => { log.push(url); return { ok: true, status: 200, json: async () => searchGet(url) }; };
    const net = new Net({ getSettings: () => ({ tablet: Object.assign({}, TABLET_DEFAULTS, { dailyCap: 5000, usage: { date: '', calls: 0 } }) }), saveSettings: () => {}, http });
    const read = [], skipped = { n: 0, bad: 0 }; let last = w.tablet.uses;
    for (let i = 0; i < 20 * 1200 / 0.5; i++) { tick(w, 0.5); if (i % 4 === 0) { net.lastAt = 0; for (const r of w.netq) if (r.state === 'queued') { await net.tick(w); if (r.skip && r.result) { skipped.n++; if (r.skip.includes(r.result.title.toLowerCase())) skipped.bad++; } break; } } if (w.tablet.uses !== last) { last = w.tablet.uses; read.push(w.tablet.pages[0] && w.tablet.pages[0].title); } }
    const distinct = new Set(w.tablet.seen).size;
    assert(w.tablet.uses >= 20, `${temper}: it uses the tablet (${w.tablet.uses})`);
    assert(distinct >= w.tablet.uses * 0.65, `${temper}: even when every search ranks the same twelve pages, it reads mostly new ones: ${distinct} distinct in ${w.tablet.uses} visits`); // (the rest are recipes, which it re-reads on purpose until it understands)
    assert.equal(skipped.bad, 0, `${temper}: a search that carried its reading list never came back with a page on it (${skipped.n} such searches)`);
  }
  ok('over 20 days with a worst-case Wikipedia it reads mostly different pages');
}
console.log('\nALL OK');
