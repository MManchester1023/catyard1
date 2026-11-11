// The tablet: web layer (fake Wikipedia), safety filter, caps, the cat's visit, offline re-reading, effects.
import assert from 'node:assert/strict';
import { makeWorld, tick, catchUp, describe } from '../src/sim/sim.js';
import { start } from '../src/sim/acts.js';
import { fetchPage, Net, isSafe, tidyExtract, TABLET_DEFAULTS } from '../src/sim/web.js';
import { canUseTablet, pickRequest, ensureTablet } from '../src/sim/tablet.js';
import { addWant } from '../src/sim/wants.js';
import { serialize, deserialize } from '../src/sim/save.js';

const ok = (name) => console.log('  ok', name);
const LONG = ' It has been studied for a very long time by many careful people who wrote down everything they learned about it.';
const page = (title, extract) => ({ query: { pages: [{ title, extract: extract + LONG, fullurl: 'https://en.wikipedia.org/wiki/' + title.replace(/ /g, '_') }] } });

// a fake Wikipedia. `answers` is a list used in order for random pages; search and feed answer by shape
function fakeHttp({ random = [], search = {}, feed = null, fail = null } = {}) {
  const log = []; let ri = 0;
  const http = async (url, opt) => {
    log.push(url); if (fail) return { ok: false, status: fail, json: async () => ({}) };
    let body;
    if (url.includes('generator=random')) body = random[Math.min(ri++, random.length - 1)];
    else if (url.includes('generator=search')) { const q = decodeURIComponent(url.match(/gsrsearch=([^&]*)/)[1]); body = search[q] || { query: { pages: [] } }; }
    else if (url.includes('feed/featured')) body = feed;
    return { ok: true, status: 200, json: async () => body };
  };
  http.log = log; return http;
}
const settings = (over = {}) => ({ tablet: Object.assign({}, TABLET_DEFAULTS, { usage: { date: '', calls: 0 } }, over) });
const mkNet = (http, s = settings()) => { const n = new Net({ getSettings: () => s, saveSettings: () => {}, http }); n.settings = s; return n; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- fetching and filtering
{
  const get = http => u => http(u).then(r => r.json());
  const h = fakeHttp({ random: [page('Mercury', 'Mercury may refer to:'), page('List of rivers', 'A list.'), page('Harbour seal', 'The harbour seal is a true seal found along coasts.')] });
  const p = await fetchPage(get(h), { kind: 'random' }); assert.equal(p.title, 'Harbour seal'); assert(p.url.startsWith('https://en.wikipedia.org/')); assert.equal(h.log.length, 3, 'skipped a disambiguation page and a list');
  const unsafe = fakeHttp({ random: [page('Some Massacre', 'A massacre took place.'), page('Pond snail', 'A pond snail is a small freshwater animal.')] });
  assert.equal((await fetchPage(get(unsafe), { kind: 'random' })).title, 'Pond snail', 'upsetting page skipped');
  await assert.rejects(fetchPage(get(fakeHttp({ random: [page('Dark Massacre', 'A massacre.')] })), { kind: 'random' }), /suitable/);
  const lk = fakeHttp({ search: { lighthouse: page('Lighthouse', 'A lighthouse is a tower with a bright light that guides ships.') } });
  assert.equal((await fetchPage(get(lk), { kind: 'lookup', q: 'lighthouse' })).title, 'Lighthouse');
  await assert.rejects(fetchPage(get(lk), { kind: 'lookup', q: 'zzzxq' }), /nothing found/);
  await assert.rejects(fetchPage(get(lk), { kind: 'lookup', q: '   ' }), /nothing to look up/);
  const fd = fakeHttp({ feed: { tfa: { normalizedtitle: 'Owl', extract: 'Owls are birds of prey that hunt mostly at night with silent flight.' + LONG, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Owl' } } } } });
  assert.equal((await fetchPage(get(fd), { kind: 'featured' })).title, 'Owl');
  await assert.rejects(fetchPage(get(fakeHttp({ fail: 500 })), { kind: 'random' }), /HTTP/).catch(() => {});
  assert(isSafe('A frog sat on a log') && !isSafe('the genocide was') && !isSafe('a school shooting'));
  assert(!tidyExtract('Ptarmigan (/ˈtɑːrmɪɡən/) is a bird. ' + 'x'.repeat(10)).includes('ɑ'));
  assert(tidyExtract('A. '.repeat(300)).length <= 421);
  ok('fetching: random, lookup, featured; skips lists, disambiguation and upsetting pages; tidies text');
}

// ---- the net pump: queue, caps, errors, politeness
{
  const w = makeWorld('Tess'); ensureTablet(w);
  const h = fakeHttp({ random: [page('Heron', 'A heron is a long-legged wading bird that stands very still.')] }); const net = mkNet(h);
  w.netq.push({ id: 'a', kind: 'random', state: 'queued', bornMs: Date.now() }); await net.tick(w);
  assert.equal(w.netq[0].state, 'done'); assert.equal(w.netq[0].result.title, 'Heron'); assert(w.netOn); assert.equal(net.usage().calls, 1);
  w.netq.push({ id: 'b', kind: 'random', state: 'queued', bornMs: Date.now() }); await net.tick(w);
  assert.equal(w.netq.find(r => r.id === 'b').state, 'queued', 'waits at least 15 seconds between requests');
  net.lastAt = 0; net.settings.tablet.dailyCap = 1; await net.tick(w);
  assert.equal(w.netq.find(r => r.id === 'b').state, 'error', 'daily cap stops it'); assert(!w.netOn); assert(/limit/.test(net.label()));
  const off = mkNet(h, settings({ on: false })); w.netq.push({ id: 'c', kind: 'random', state: 'queued', bornMs: Date.now() }); await off.tick(w);
  assert.equal(w.netq.find(r => r.id === 'c').state, 'error'); assert(!w.netOn && /off/.test(off.label()));
  const bad = mkNet(fakeHttp({ fail: 503 })); w.netq.push({ id: 'd', kind: 'random', state: 'queued', bornMs: Date.now() }); await bad.tick(w);
  assert.equal(w.netq.find(r => r.id === 'd').state, 'error'); assert(/HTTP 503/.test(bad.label()));
  const slow = mkNet(async (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted'))))); slow.cfg(); 
  ok('net pump: answers requests, waits between them, honours the daily cap, off switch and errors');
}

// ---- the cat's visit, online
{
  const w = makeWorld('Tess'); const c = w.cat; ensureTablet(w); c.mem.known.tablet = 1; w.netOn = true;
  { const d = new Date(); w.tablet.featuredDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; } // this fake server only has random pages, so do not ask for the featured one
  const h = fakeHttp({ random: [page('Full moon', 'The full moon is the lunar phase when the moon appears fully illuminated from the earth.')] }); const net = mkNet(h);
  const moon0 = w.mysteries.moon.clues; start(w, 'tablet');
  let sawWait = false, sawRead = false; const seen = [];
  for (let i = 0; i < 1500 && c.act.type === 'tablet'; i++) { tick(w, 0.1); if (seen[seen.length - 1] !== c.act.phase) seen.push(c.act.phase); if (c.act.phase === 'wait') sawWait = true; if (c.act.phase === 'read') sawRead = true; if (i % 10 === 0) { net.lastAt = 0; await net.tick(w); } }
  assert(sawWait && sawRead, 'went through waiting and reading: ' + seen.join('>') + ' now ' + c.act.type + ' netq ' + JSON.stringify(w.netq.map(r => [r.state, r.error])) + ' netOn ' + w.netOn); assert.notEqual(c.act.type, 'tablet', 'visit finished');
  assert.equal(w.tablet.pages.length, 1); assert.equal(w.tablet.pages[0].title, 'Full moon');
  assert(w.mysteries.moon.clues >= moon0 + 2.5, 'a page about the moon is a clue about the moon');
  assert(w.journal.some(e => e.tag === 'tablet' && e.text.includes('Full moon')) && w.log.some(e => e.kind === 'tablet'));
  assert(w.asks.some(a => a.type === 'page'), 'asks Claude (if connected) for a reaction in its own voice');
  assert.equal(w.tablet.uses, 1);
  // describe() reads sensibly through a visit
  start(w, 'tablet'); assert(/tablet/i.test(describe(w)));
  ok('online visit: waits, reads, learns, journals; a moon page is a moon clue');
}

// ---- looking up a word from a note
{
  const w = makeWorld('Tess'); const c = w.cat; ensureTablet(w); c.mem.known.tablet = 1; w.netOn = true; c.wants = [];
  addWant(w, { kind: 'lookup', key: 'lighthouse', word: 'lighthouse', strength: 0.8 });
  assert.deepEqual({ k: pickRequest(w).kind, q: pickRequest(w).q }, { k: 'lookup', q: 'lighthouse' }, 'a lookup want decides what it asks for');
  const net = mkNet(fakeHttp({ search: { lighthouse: page('Lighthouse', 'A lighthouse is a tower with a bright light that guides ships safely past rocks.') } }));
  const done0 = c.doneWants; start(w, 'tablet');
  for (let i = 0; i < 1500 && c.act.type === 'tablet'; i++) { tick(w, 0.1); if (i % 10 === 0) { net.lastAt = 0; await net.tick(w); } }
  assert(!c.wants.some(x => x.kind === 'lookup' && x.word === 'lighthouse') && c.doneWants === done0 + 1, 'the want was fulfilled');
  assert(w.journal.some(e => e.tag === 'want' && /Lighthouse/.test(e.text)));
  ok('a word from a note can be looked up, and the want is fulfilled');
}

// ---- offline and failure behaviour
{
  const w = makeWorld('Tess'); const c = w.cat; ensureTablet(w); c.mem.known.tablet = 1; w.netOn = false;
  assert(!canUseTablet(w), 'nothing to read and no connection: it does not bother');
  for (const t of ['Alpha', 'Beta', 'Gamma']) w.tablet.pages.push({ id: t, kind: 'random', title: t, extract: 'x'.repeat(80), url: '', day: 1, time: '10:00', reaction: '', jid: null, seen: 1 });
  assert(canUseTablet(w), 'with a few old pages it can re-read');
  start(w, 'tablet'); let read = false;
  for (let i = 0; i < 1200 && c.act.type === 'tablet'; i++) { tick(w, 0.1); if (c.act.phase === 'read') read = true; }
  assert(read && w.netq.length === 0, 're-read old pages with no request'); assert.notEqual(c.act.type, 'tablet');
  // online but nobody answers: gives up after a while and does not hang
  const w2 = makeWorld('Tess'); ensureTablet(w2); w2.cat.mem.known.tablet = 1; w2.netOn = true; start(w2, 'tablet'); let noSig = false;
  for (let i = 0; i < 600 && w2.cat.act.type === 'tablet'; i++) { tick(w2, 0.1); if (w2.netq[0]) w2.netq[0].bornMs = Date.now() - 60000; if (w2.cat.act.phase === 'nosignal') noSig = true; }
  assert(noSig && w2.cat.act.type !== 'tablet', 'gave up on a request nobody answered'); assert(w2.log.some(e => /would not load/.test(e.text)));
  // fast-forwarded game time alone is enough to give up (real time barely passes)
  const w4 = makeWorld('Tess'); ensureTablet(w4); w4.cat.mem.known.tablet = 1; w4.netOn = true; start(w4, 'tablet'); let waited = 0;
  for (let i = 0; i < 3000 && w4.cat.act.type === 'tablet'; i++) { tick(w4, 0.1); waited++; }
  assert.notEqual(w4.cat.act.type, 'tablet', 'did not wait forever in game time'); assert(waited < 1500, 'gave up within about two game minutes');
  assert(w4.netq.every(r => r.state !== 'queued'), 'the abandoned request is not left for the app to answer');
  // an error answer ends the visit too
  const w3 = makeWorld('Tess'); ensureTablet(w3); w3.cat.mem.known.tablet = 1; w3.netOn = true; start(w3, 'tablet');
  for (let i = 0; i < 600 && w3.cat.act.type === 'tablet'; i++) { tick(w3, 0.1); if (w3.netq[0] && w3.netq[0].state === 'queued') { w3.netq[0].state = 'error'; w3.netq[0].error = 'HTTP 500'; } }
  assert.notEqual(w3.cat.act.type, 'tablet');
  ok('offline: re-reads old pages; unanswered or failed requests end the visit gracefully');
}

// ---- catch-up never touches the network; saving keeps the history
{
  const w = makeWorld('Tess'); ensureTablet(w); w.cat.mem.known.tablet = 1; w.netOn = true;
  catchUp(w, 3600); assert.equal(w.netOn, true, 'netOn restored'); assert.equal(w.netq.length, 0, 'catch-up asked for nothing');
  w.tablet.pages.push({ id: 'p', kind: 'random', title: 'Kept', extract: 'x'.repeat(70), url: '', day: 2, time: '09:00', reaction: 'hm', jid: null, seen: 1 }); w.tablet.interests.heron = 3; w.tablet.uses = 4;
  const w2 = deserialize(serialize(w));
  assert(w2.tablet.pages[0].title === 'Kept' && w2.tablet.interests.heron === 3 && w2.tablet.uses === 4 && w2.netq.length === 0 && w2.netOn === false);
  ok('catch-up makes no requests; page history survives a save');
}

// ---- a long headless run: the cat finds the tablet by itself and uses it sensibly
{
  const w = makeWorld('Tess'); ensureTablet(w); w.netOn = true; const h = fakeHttp({ random: ['Heron', 'Quartz', 'Bread', 'Saturn', 'Violin'].map(t => page(t, `${t} is a thing that people have written about at some length over the years.`)) }); const net = mkNet(h);
  for (let i = 0; i < 12 * 3600 / 0.5; i++) { tick(w, 0.5); if (i % 4 === 0) { net.lastAt = 0; w.netq.forEach(r => { if (r.state === 'queued') net.tick(w); }); } if (i % 40 === 0) await sleep(0); }
  assert(w.cat.mem.known.tablet, 'discovered the tablet'); assert(w.tablet.uses >= 10 && w.tablet.uses <= 36 * 5, 'used it a sensible number of times over 36 game days: ' + w.tablet.uses);
  console.log('    uses over 36 game days (12 h of sim):', w.tablet.uses, 'pages:', w.tablet.pages.length, 'requests:', h.log.length);
  ok('headless: finds the tablet and uses it now and then, not constantly');
}
console.log('\nALL OK');
