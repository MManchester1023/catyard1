// The tablet: a glowing slab on a stump that shows the cat pages from the real internet (Wikipedia).
// The simulation never waits on the network. When the cat sits down it puts a request on w.netq; the app
// shell answers it whenever it can (see web.js). With no connection the cat re-reads pages it has kept.
import { rnd, pick, clamp, uid, an } from './util.js';
import { note, journal, dayOf, clockStr, moonPhase } from './world.js';
import { clue } from './mysteries.js';
import { onEvent, hasWant, addWant, MAX_WANTS } from './wants.js';
import { exposeTo } from './offerings.js';
import { learnWords } from './thoughts.js';
import { feel } from './feelings.js';
import { learnFromPage, unlockRecipe } from './craft.js';
import { RECIPES } from './recipes.js';
import { draftWish, publishWish, wishPending } from './wishes.js';

export const PAGES_MAX = 24, INTERESTS_MAX = 40;
const SKIP = new Set('about after also because between during first their there these they were which while with would other since from that this have been into over under only most many some such than then when where who whose'.split(' '));

export function ensureTablet(w) {
  if (!w.tablet) w.tablet = {};
  const t = w.tablet; t.pages = t.pages || []; t.interests = t.interests || {}; t.uses = t.uses || 0; if (t.lastUse == null) t.lastUse = -999; t.featuredDate = t.featuredDate || '';
  if (!w.netq) w.netq = [];
  if (w.netOn == null) w.netOn = false;
}

// can the cat use it right now? (it has to have found it, and either be online or have something to re-read)
export function canUseTablet(w) {
  ensureTablet(w); const t = w.tablet;
  return !!w.cat.mem.known.tablet && (w.netOn || t.pages.length >= 3 || wishPending(w)) && w.clock - t.lastUse > w.dayLen * 0.22;
}
export const lookupWant = w => w.cat.wants.find(x => x.kind === 'lookup') || null;

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// what to ask the internet for this time
export function pickRequest(w) {
  const t = w.tablet, lw = lookupWant(w), lr = w.cat.wants.find(x => x.kind === 'learn');
  if (lr) return { kind: 'lookup', q: RECIPES[lr.recipe].topic, word: null, recipe: lr.recipe };
  if (lw) return { kind: 'lookup', q: lw.word, word: lw.word };
  const top = Object.entries(t.interests).sort((a, b) => b[1] - a[1]).slice(0, 5), r = Math.random();
  if (t.featuredDate !== localDate() && r < 0.3) return { kind: 'featured' };
  if (top.length && r < 0.55) { const [word] = pick(top); return { kind: 'lookup', q: word, word: null }; }
  return { kind: 'random' };
}

// ---------- what a page does to the cat ----------
const TOPICS = [
  { id: 'moon', re: /\b(moon|lunar|tides?|tidal|eclipse|crescent)\b/i, say: ['It writes about the moon. I was right about some of it.', 'The moon again. Humans watch it too. I feel less alone.'], fx: w => clue(w, 'moon', 2.5) },
  { id: 'pond', re: /\b(frogs?|toads?|amphibians?|ponds?|newts?|tadpoles?|wetlands?|salamanders?)\b/i, say: ['Something about ponds. I knew there was someone down there.', 'Frogs are real. Written down, even.'], fx: w => clue(w, 'ripples', 2) },
  { id: 'glow', re: /\b(fireflies|firefly|bioluminescen\w*|luciferin|glow-?worms?|lampyrid\w*)\b/i, say: ['Bugs that glow. Of course. Of course!', 'The little lights have a name. I am furious I did not think of it.'], fx: w => clue(w, 'sparks', 2) },
  { id: 'art', re: /\b(paint(?:er|ers|ing|ings|ed)?|artists?|canvas|pigments?|sculpt\w*|murals?|impressionis\w+|watercolou?rs?|portraits?|galler(?:y|ies)|museums?)\b/i, say: ['Paint. Humans made so much of it. I have so far to go.', 'This one is about making things. My paws are itching.'], fx: w => { w.cat.art.xp += 5; w.cat.needs.create = clamp(w.cat.needs.create + 0.25); w.cat.mood.joy = clamp(w.cat.mood.joy + 0.1); } },
  { id: 'collect', re: /\b(collect\w*|hoard\w*|buttons?|marbles?|feathers?|bottle ?caps?|coins?|beads?|stamps?|treasures?)\b/i, say: ['A collector. I understand completely.', 'Others gather things too. It is not just me.'], fx: w => { exposeTo(w, w.cat.quirk.item, null, 0.05); w.cat.mood.joy = clamp(w.cat.mood.joy + 0.15); } },
  { id: 'cat', re: /\b(cats?|felines?|kittens?|tabby|lions?|tigers?|lynx|cheetahs?|leopards?)\b/i, say: ['This is about someone like me. I approve.', 'They wrote about cats. Of course they did.'], fx: w => { w.cat.mood.joy = clamp(w.cat.mood.joy + 0.2); } },
  { id: 'bird', re: /\b(birds?|sparrows?|crows?|ravens?|owls?|eagles?|finch\w*|pigeons?|parrots?)\b/i, say: ['Birds. Smug and delicious-looking.', 'I know a few of these personally.'], fx: w => { w.cat.needs.fun = clamp(w.cat.needs.fun + 0.08); } },
  { id: 'food', re: /\b(fish|salmon|tuna|cheese|milk|cuisine|soup|bread|meat|cooking)\b/i, say: ['Now I am hungry. Thank you for that.', 'Reading about food is cruel.'], fx: w => { w.cat.needs.hunger = clamp(w.cat.needs.hunger + 0.1); } },
  { id: 'sleep', re: /\b(sleep|naps?|dreams?|insomnia)\b/i, say: ['Now I am sleepy. The slab knows.', 'Humans write about sleep because they do it badly.'], fx: w => { w.cat.needs.tired = clamp(w.cat.needs.tired + 0.1); } },
];
const PLAIN = [t => `${t}. I did not know that.`, t => `"${t}". Humans know so many things they do not use.`, t => `${t}? Hm. Filed away.`, t => `I read about ${t}. I do not know why. I am keeping it.`];

function noteInterests(w, pg) {
  const t = w.tablet;
  for (const wd of (`${pg.title} ${pg.extract.split('. ')[0]}`.toLowerCase().match(/[a-z]{5,14}/g) || [])) if (!SKIP.has(wd)) t.interests[wd] = (t.interests[wd] || 0) + 1;
  const keys = Object.keys(t.interests); if (keys.length > INTERESTS_MAX) keys.sort((a, b) => t.interests[a] - t.interests[b]).slice(0, keys.length - INTERESTS_MAX + 8).forEach(k => delete t.interests[k]);
}

// a new thing it could look up next: a name or word in the text it has not met
function wonderFromPage(w, pg) {
  const c = w.cat; if (c.wants.length >= MAX_WANTS || hasWant(w, 'lookup') || Math.random() > 0.3) return;
  const own = new Set(pg.title.toLowerCase().match(/[a-z]+/g) || []);
  const words = (pg.extract.match(/\b[A-Z][a-z]{5,13}\b/g) || []).map(x => x.toLowerCase()).filter(x => !own.has(x) && !SKIP.has(x) && !(c.words[x] >= 2));
  if (words.length) { const word = pick(words); addWant(w, { kind: 'lookup', key: word, word, strength: rnd(0.5, 0.8) }); }
}

// remember a page. returns it plus whether the cat has seen it before
function recordPage(w, kind, raw) {
  const t = w.tablet, old = t.pages.find(p => p.title === raw.title);
  if (old) { old.seen = (old.seen || 1) + 1; return { pg: old, repeat: true }; }
  const pg = { id: uid(), kind, title: raw.title, extract: raw.extract, url: raw.url || '', day: dayOf(w), time: clockStr(w), reaction: '', jid: null, seen: 1 };
  t.pages.unshift(pg); if (t.pages.length > PAGES_MAX) t.pages.pop();
  return { pg, repeat: false };
}

function absorb(w, pg, repeat, word, recipe) {
  const c = w.cat, hay = `${pg.title} ${pg.extract}`;
  let learned = learnFromPage(w, pg, recipe);
  if (!learned && recipe) { const x = c.wants.find(y => y.kind === 'learn' && y.recipe === recipe); if (x && (x.tries = (x.tries || 0) + 1) >= 2 && unlockRecipe(w, recipe, '', 'itself')) learned = recipe; }
  if (repeat) {
    feel(w, ['act:tablet'], { joy: 0.02, fun: -0.1 }, 'flat');
    const s = learned ? `${pg.title}, again. This time I understood the part about making ${RECIPES[learned].name}s.` : `${pg.title}... I have read this before. It was better the first time. No, it is the same.`;
    c.thought = s; c.thoughtId++; c.thoughtAt = w.clock; return s;
  }
  const topic = TOPICS.find(x => x.re.test(hay));
  feel(w, ['act:tablet', topic ? 'topic:' + topic.id : null], { joy: topic ? 0.1 : 0.05, fun: -0.15 }, 'wondering');
  let say = topic ? pick(topic.say) : pick(PLAIN)(pg.title);
  if (learned) say = `${pg.title}. So that is how it is done. I can make ${an(RECIPES[learned].name)} now.`;
  if (topic) topic.fx(w);
  noteInterests(w, pg); learnWords(w, pg.title); wonderFromPage(w, pg);
  pg.reaction = say; c.thought = say; c.thoughtId++; c.thoughtAt = w.clock;
  note(w, `${c.name} read about ${pg.title} on the tablet.`, 'tablet');
  journal(w, `Read on the tablet: "${pg.title}". ${say}`, 'tablet'); pg.jid = w.journal[0].id;
  if (w.asks) w.asks.push({ type: 'page', id: pg.id });
  if (word) onEvent(w, 'lookup', { word, title: pg.title });
  return say;
}

// ---------- the act ----------
const cachedPage = w => { const l = w.tablet.pages.filter(p => p !== w.tablet.pages[0] || w.tablet.pages.length < 2); return l.length ? pick(l) : null; };
const readSeconds = pg => clamp(5.5 + pg.extract.length / 60, 6, 13);

export function describeTablet(a) {
  switch (a.phase) {
    case 'go': return 'Heading to the tablet';
    case 'boot': return 'Waking the tablet';
    case 'write': return 'Typing a note to the human on the tablet';
    case 'wait': return 'Waiting for the tablet to load';
    case 'read': return `Reading about ${a.page ? a.page.title : 'something'}`;
    case 'nosignal': return 'Frowning at a dead tablet';
  }
  return 'At the tablet';
}

// one step of the act. arrive() is the walking helper from acts.js; finish() ends the act
export function tabletTick(w, a, dt, { arrive, finish }) {
  const c = w.cat; ensureTablet(w); c.pose = a.phase === 'go' ? 'walk' : 'sit';
  if (a.phase === 'go') { if (arrive(70)) { a.phase = 'boot'; a.t = 0; c.face = 1; c.pose = 'sit'; } return; }
  if (a.phase === 'boot') {
    if (a.t < 1.4) return;
    const dw = !a.wrote && draftWish(w); if (dw) { a.wish = dw; a.phase = 'write'; a.t = 0; return; }
    if (!w.netOn && a.wrote && !cachedPage(w)) { w.tablet.lastUse = w.clock; w.tablet.uses++; finish(); return; }
    if (w.netOn) { const req = Object.assign({ id: uid(), state: 'queued', bornMs: Date.now() }, pickRequest(w)); w.netq.push(req); a.req = req; a.phase = 'wait'; a.t = 0; }
    else { const pg = cachedPage(w); if (pg) { a.page = pg; a.repeat = true; a.phase = 'read'; a.t = 0; a.dur = 6; } else { a.phase = 'nosignal'; a.t = 0; } }
    return;
  }
  if (a.phase === 'write') {
    if (a.t >= 6) { publishWish(w, a.wish); a.wish = null; a.wrote = true; a.phase = 'boot'; a.t = 1.5; }
    return;
  }
  if (a.phase === 'wait') {
    const r = a.req;
    if (r.state === 'done' && r.result) {
      const { pg, repeat } = recordPage(w, r.kind, r.result); if (r.kind === 'featured') w.tablet.featuredDate = localDate();
      a.page = pg; a.repeat = repeat; a.word = r.word; a.recipe = r.recipe; a.phase = 'read'; a.t = 0; a.dur = repeat ? 5 : readSeconds(pg); r.state = 'taken';
    } else if (r.state === 'error' || !w.netOn || Date.now() - r.bornMs > 25000 || a.t > 90) { // 90 s of game time too, so fast-forwarding cannot leave the cat waiting while its needs run out
       a.err = r.error || 'no signal'; if (r.state !== 'done') r.state = 'error'; a.phase = 'nosignal'; a.t = 0; }
    return;
  }
  if (a.phase === 'read') {
    if (!a.reacted) { a.reacted = true; a.say = absorb(w, a.page, a.repeat, a.word, a.recipe); }
    if (a.t >= a.dur) { w.tablet.lastUse = w.clock; w.tablet.uses++; finish(); }
    return;
  }
  if (a.phase === 'nosignal') {
    if (!a.reacted) { a.reacted = true; c.thought = pick(['The slab shows nothing. Rude.', 'No signal. Even the internet is napping.', 'It will not show me anything today.']); c.thoughtId++; c.thoughtAt = w.clock; }
    if (a.t > 3.5) { w.tablet.lastUse = w.clock - w.dayLen * 0.1; note(w, `The tablet would not load anything for ${c.name}.`, 'tablet'); finish(); }
  }
}

// the app shell calls this to drop requests nobody is waiting on
export function sweepNet(w) { if (w.netq) w.netq = w.netq.filter(r => r.state !== 'taken' && Date.now() - r.bornMs < 60000); }
