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
import { shopChoice, shopPending, placeOrder } from './economy.js';
import { blogPending, publishPost, BLOG_THOUGHTS } from './blog.js';
import { wantsToResearch, interestRequest, interestPage, interestMiss } from './interest.js';
import { starsPage, starsNeedsReading } from './stars.js';
import { random } from './rng.js';

export const PAGES_MAX = 24, INTERESTS_MAX = 40, SEEN_MAX = 400, ASKED_WORDS = 24;
const SKIP = new Set('about after also because between during first their there these they were which while with would other since from that this have been into over under only most many some such than then when where who whose'.split(' '));

export function ensureTablet(w) {
  if (!w.tablet) w.tablet = {};
  const t = w.tablet; t.pages = t.pages || []; t.interests = t.interests || {}; t.uses = t.uses || 0; if (t.lastUse == null) t.lastUse = -999; t.featuredDate = t.featuredDate || '';
  if (!Array.isArray(t.seen)) t.seen = []; // every page it has ever read (the page list only keeps the last few)
  if (!t.seen.length && t.pages.length) t.seen = t.pages.map(p => String(p.title).toLowerCase()); // (an older save starts from the pages it kept)
  if (!Array.isArray(t.askedWords)) t.askedWords = [];
  if (!w.netq) w.netq = [];
  if (w.netOn == null) w.netOn = false;
}

// can the cat use it right now? (it has to have found it, and either be online or have something to re-read)
export function canUseTablet(w) {
  ensureTablet(w); const t = w.tablet;
  return !!w.cat.mem.known.tablet && (w.netOn || t.pages.length >= 3 || wishPending(w) || blogPending(w) || shopPending(w)) && w.clock - t.lastUse > w.dayLen * 0.22;
}
export const lookupWant = w => w.cat.wants.find(x => x.kind === 'lookup') || null;

// what each kind of cat goes looking for when it has nothing in particular to find out (Wikipedia page titles)
export const QUIRK_QUERIES = {
  collector: ['Button', 'Marble (toy)', 'Bottle cap', 'Coin collecting', 'Cabinet of curiosities', 'Magpie', 'Bowerbird', 'Stamp collecting', 'Hoarding (animal behavior)', 'Feather', 'Treasure', 'Pack rat', 'Curiosities', 'Antique', 'Flea market', 'Numismatics', 'Seashell', 'Pebble', 'Gemstone', 'Amber', 'Thimble', 'Souvenir', 'Fossil', 'Bead', 'Jewellery', 'Piggy bank', 'Pirate treasure', 'Trading card'],
  vangogh: ['Vincent van Gogh', 'The Starry Night', 'Impressionism', 'Sunflowers (Van Gogh series)', 'Pigment', 'Claude Monet', 'Color wheel', 'Oil painting', 'Cave painting', 'Pointillism', 'Hokusai', 'Chiaroscuro', 'Mural', 'Watercolor painting', 'Sculpture', 'Johannes Vermeer', 'Rembrandt', 'Pablo Picasso', 'Frida Kahlo', 'Stained glass', 'Calligraphy', 'Mosaic', 'Paintbrush', 'Sketch (drawing)', 'Art museum', 'Ukiyo-e', 'Bob Ross', 'Surrealism', 'Colour theory'],
  hunter: ['Predation', 'Ambush predator', 'Lynx', 'Cheetah', 'Hawk', 'Camouflage', 'Owl', 'Tiger', 'Leopard', 'Cat senses', 'Whiskers', 'Wildcat', 'Eagle', 'Fishing cat', 'Jaguar', 'Serval', 'Caracal', 'Falcon', 'Red fox', 'Weasel', 'Grey heron', 'Kingfisher', 'House mouse', 'Instinct', 'Night vision', 'Savanna', 'Tracking (hunting)', 'Barn owl', 'Snow leopard'],
  nightowl: ['Nocturnality', 'Moon', 'Owl', 'Bat', 'Firefly', 'Circadian rhythm', 'Crepuscular animal', 'Constellation', 'Aurora', 'Lunar phase', 'Night sky', 'Milky Way', 'Comet', 'Solar eclipse', 'Moonlight', 'Nightingale', 'Glow-worm', 'Dream', 'Lunar eclipse', 'Twilight', 'Midnight sun', 'Planetarium', 'Telescope', 'Meteor shower', 'Lantern', 'Hedgehog', 'Nocturnal bird', 'Moth'],
  techie: ['Tablet computer', 'Search engine', 'Wikipedia', 'Internet', 'Touchscreen', 'Computer mouse', 'Artificial intelligence', 'Robot', 'Smartphone', 'Algorithm', 'Pixel', 'Laser pointer', 'Keyboard', 'Laptop', 'Bluetooth', 'Wi-Fi', 'Digital camera', 'Video game', 'Circuit board', 'Microprocessor', 'Binary code', 'Calculator', 'Telephone', 'Radio', 'Satellite', 'Printer (computing)', 'Lithium-ion battery', 'Arcade game', 'Pixel art'],
  garfield: ['Lasagna', 'Nap', 'Sleep', 'Cheese', 'Pizza', 'Tuna', 'Pancake', 'Sunbathing', 'Hammock', 'Bread', 'Comfort food', 'Sloth', 'Breakfast', 'Pasta', 'Cake', 'Ice cream', 'Sandwich', 'Coffee', 'Doughnut', 'Cat food', 'Blanket', 'Sofa', 'Afternoon tea', 'Apple pie', 'Chocolate chip cookie', 'Hot chocolate', 'Siesta', 'Waffle', 'Macaroni and cheese'],
  builder: ['Carpentry', 'Beaver', 'Bird nest', 'Architecture', 'Bridge', 'Treehouse', 'Hammer', 'Log cabin', 'Woodworking', 'Termite mound', 'Beaver dam', 'Joinery', 'Workbench', 'Brick', 'Lighthouse', 'Windmill', 'Cathedral', 'Skyscraper', 'Dam', 'Aqueduct', 'Saw', 'Nail (fastener)', 'Blueprint', 'Log house', 'Scaffolding', 'Stonemasonry', 'Thatching', 'Gazebo', 'Dry stone wall'],
};

const STAR_QUERIES = ['Star', 'Shooting star', 'Meteor shower', 'Constellation', 'Night sky', 'Astronomy', 'Milky Way', 'Meteoroid'];
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// what to ask the internet for this time
export function pickRequest(w) {
  const t = w.tablet, lw = lookupWant(w), lr = w.cat.wants.find(x => x.kind === 'learn');
  if (lr) return { kind: 'lookup', q: RECIPES[lr.recipe].topic, word: null, recipe: lr.recipe };
  if (lw) return { kind: 'lookup', q: lw.word, word: lw.word, skip: t.seen.slice(-250) }; // (a word it wants to know: the best page it has not read yet)
  if (starsNeedsReading(w) && random() < 0.75) return { kind: 'lookup', q: pick(STAR_QUERIES), word: null, stars: true, skip: t.seen.slice(-250), vary: true }; // (it has watched them long enough: now it wants to know what they are)
  // every general search skips what it has already read, picks among the first few new results, and reads something random
  // if there is nothing new (so it does not keep landing on the same pages)
  const general = (q, extra) => Object.assign({ kind: 'lookup', q, word: null, skip: t.seen.slice(-250), vary: true, fallback: true }, extra);
  if (wantsToResearch(w)) { const r = interestRequest(w), have = new Set(r.skip.map(x => String(x).toLowerCase())); r.skip = [...r.skip, ...t.seen.slice(-250).filter(x => !have.has(x))]; return r; } // (a special interest: page after page on the same subject)
  const qs = QUIRK_QUERIES[w.cat.temper];
  if (qs && random() < (w.cat.temper === 'techie' ? 0.5 : 0.4)) { // (its quirk decides what it is curious about; it works through the whole list before going round again)
    t.asked = t.asked || []; let fresh = qs.filter(x => !t.asked.includes(x)); if (!fresh.length) { t.asked = t.asked.filter(x => !qs.includes(x)); fresh = qs; }
    const q = pick(fresh); t.asked.push(q); if (t.asked.length > 80) t.asked.shift();
    return general(q, { quirk: true });
  }
  // the words it keeps coming across: any of the commonest, weighted, and not one it has just looked up
  const recent = t.askedWords.slice(-Math.min(ASKED_WORDS, Math.floor(Object.keys(t.interests).length / 2))); // (up to half of what it knows, so a small vocabulary still rotates)
  const cand = Object.entries(t.interests).filter(([k]) => !recent.includes(k)).sort((a, b) => b[1] - a[1]).slice(0, 14), r = random();
  if (t.featuredDate !== localDate() && r < 0.3) return { kind: 'featured' };
  if (cand.length && r < 0.55) {
    let x = random() * cand.reduce((s, e) => s + e[1], 0), word = cand[0][0]; for (const [k, n] of cand) { x -= n; if (x <= 0) { word = k; break; } }
    t.askedWords.push(word); if (t.askedWords.length > ASKED_WORDS) t.askedWords.shift();
    return general(word);
  }
  return { kind: 'random' };
}

// ---------- what a page does to the cat ----------
const TOPICS = [
  { id: 'stars', re: /\b(stars?|starlight|meteors?|meteoroids?|meteorites?|meteor showers?|astronom\w*|galax\w*|comets?|constellations?|supernovas?|nebula\w*)\b/i, say: ['So THAT is what they are. Far-off suns. I was not wrong to look.', 'The lights have names. Whole families of them. I feel very small and extremely pleased.', 'Falling stars are rock, burning. The wish part is up to me.'], fx: w => starsPage(w) },
  { id: 'moon', re: /\b(moon|lunar|tides?|tidal|eclipse|crescent)\b/i, say: ['It writes about the moon. I was right about some of it.', 'The moon again. Humans watch it too. I feel less alone.'], fx: w => clue(w, 'moon', 2.5) },
  { id: 'pond', re: /\b(frogs?|toads?|amphibians?|ponds?|newts?|tadpoles?|wetlands?|salamanders?)\b/i, say: ['Something about ponds. I knew there was someone down there.', 'Frogs are real. Written down, even.'], fx: w => clue(w, 'ripples', 2) },
  { id: 'glow', re: /\b(fireflies|firefly|bioluminescen\w*|luciferin|glow-?worms?|lampyrid\w*)\b/i, say: ['Bugs that glow. Of course. Of course!', 'The little lights have a name. I am furious I did not think of it.'], fx: w => clue(w, 'sparks', 2) },
  { id: 'art', re: /\b(paint(?:er|ers|ing|ings|ed)?|artists?|canvas|pigments?|sculpt\w*|murals?|impressionis\w+|watercolou?rs?|portraits?|galler(?:y|ies)|museums?)\b/i, say: ['Paint. Humans made so much of it. I have so far to go.', 'This one is about making things. My paws are itching.'], fx: w => { w.cat.art.xp += 5; w.cat.needs.create = clamp(w.cat.needs.create + 0.25); w.cat.mood.joy = clamp(w.cat.mood.joy + 0.1); } },
  { id: 'collect', re: /\b(collect\w*|hoard\w*|buttons?|marbles?|feathers?|bottle ?caps?|coins?|beads?|stamps?|treasures?)\b/i, say: ['A collector. I understand completely.', 'Others gather things too. It is not just me.'], fx: w => { exposeTo(w, w.cat.quirk.item, null, 0.05); w.cat.mood.joy = clamp(w.cat.mood.joy + 0.15); } },
  { id: 'cat', re: /\b(cats?|felines?|kittens?|tabby|lions?|tigers?|lynx|cheetahs?|leopards?)\b/i, say: ['This is about someone like me. I approve.', 'They wrote about cats. Of course they did.'], fx: w => { w.cat.mood.joy = clamp(w.cat.mood.joy + 0.2); } },
  { id: 'bird', re: /\b(birds?|sparrows?|crows?|ravens?|owls?|eagles?|finch\w*|pigeons?|parrots?)\b/i, say: ['Birds. Smug and delicious-looking.', 'I know a few of these personally.'], fx: w => { w.cat.needs.fun = clamp(w.cat.needs.fun + 0.08); } },
  { id: 'food', re: /\b(fish|salmon|tuna|cheese|milk|cuisine|soup|bread|meat|cooking)\b/i, say: ['Now I am hungry. Thank you for that.', 'Reading about food is cruel.'], fx: w => { w.cat.needs.hunger = clamp(w.cat.needs.hunger + 0.1); } },
  { id: 'tech', re: /\b(computers?|internet|touchscreen|algorithms?|smartphones?|search engines?|software|robots?|pixels?|keyboards?)\b/i, say: ['So that is how the slab works. I have so many questions.', 'Humans built the slab on purpose. Remarkable.'], fx: w => { w.cat.needs.fun = clamp(w.cat.needs.fun - 0.1); } },
  { id: 'build', re: /\b(carpent\w*|woodwork\w*|beavers?|nests?|architect\w*|cabins?|bridges?|treehouses?|workbench|joinery|hammers?|termite\w*)\b/i, say: ['Others build too. I feel seen.', 'So that is how you hold a beam up. Noted.'], fx: w => { w.cat.needs.create = clamp(w.cat.needs.create + 0.08); } },
  { id: 'night', re: /\b(nocturnal\w*|crepuscular|circadian|constellations?|aurora|milky way|night sky|bats?)\b/i, say: ['The night has a whole science. I knew it.', 'Others stay up too. It is not just me.'], fx: w => { clue(w, 'moon', 1); } },
  { id: 'hunt', re: /\b(predat\w*|ambush|camouflage|stalk\w*|whiskers?|wildcats?)\b/i, say: ['Technique. I will remember this for the next stalk.', 'So that is why the ears go forward.'], fx: w => { w.cat.huntCool = 0; } },
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
  const c = w.cat; if (c.wants.length >= MAX_WANTS || hasWant(w, 'lookup') || random() > 0.3) return;
  const own = new Set(pg.title.toLowerCase().match(/[a-z]+/g) || []);
  const words = (pg.extract.match(/\b[A-Z][a-z]{5,13}\b/g) || []).map(x => x.toLowerCase()).filter(x => !own.has(x) && !SKIP.has(x) && !(c.words[x] >= 2));
  if (words.length) { const word = pick(words); addWant(w, { kind: 'lookup', key: word, word, strength: rnd(0.5, 0.8) }); }
}

// remember a page. returns it plus whether the cat has seen it before
function recordPage(w, kind, raw) {
  const t = w.tablet, old = t.pages.find(p => p.title === raw.title);
  { const k = String(raw.title).toLowerCase(); if (!t.seen.includes(k)) { t.seen.push(k); if (t.seen.length > SEEN_MAX) t.seen.shift(); } }
  if (old) { old.seen = (old.seen || 1) + 1; return { pg: old, repeat: true }; }
  const pg = { id: uid(), kind, title: raw.title, extract: raw.extract, url: raw.url || '', day: dayOf(w), time: clockStr(w), reaction: '', jid: null, seen: 1 };
  t.pages.unshift(pg); if (t.pages.length > PAGES_MAX) t.pages.pop();
  return { pg, repeat: false };
}

function absorb(w, pg, repeat, word, recipe, interest, stars) {
  const c = w.cat, hay = `${pg.title} ${pg.extract}`;
  let learned = learnFromPage(w, pg, recipe);
  if (!learned && recipe) { const x = c.wants.find(y => y.kind === 'learn' && y.recipe === recipe); if (x && (x.tries = (x.tries || 0) + 1) >= 2 && unlockRecipe(w, recipe, '', 'itself')) learned = recipe; }
  if (repeat) {
    feel(w, ['act:tablet'], { joy: 0.02, fun: -0.1 }, 'flat'); if (word) onEvent(w, 'lookup', { word, title: pg.title }); // (it has found out what it wanted to, even if it knew where to look)
    const s = learned ? (RECIPES[learned].knowledge ? `${pg.title}, again. This time the part about string sank in.` : `${pg.title}, again. This time I understood the part about making ${RECIPES[learned].name}s.`) : `${pg.title}... I have read this before. It was better the first time. No, it is the same.`;
    c.thought = s; c.thoughtId++; c.thoughtAt = w.clock; return s;
  }
  const topic = TOPICS.find(x => x.re.test(hay));
  feel(w, ['act:tablet', topic ? 'topic:' + topic.id : null], { joy: topic ? 0.1 : 0.05, fun: -0.15 }, 'wondering');
  let say = topic ? pick(topic.say) : pick(PLAIN)(pg.title);
  if (learned) say = RECIPES[learned].knowledge ? `${pg.title}. So that is where string comes from. The cushion is full of it.` : `${pg.title}. So that is how it is done. I can make ${an(RECIPES[learned].name)} now.`;
  if (topic) topic.fx(w);
  if (stars && !(topic && topic.id === 'stars')) starsPage(w); // (it went looking for the stars, so whatever it found counts)
  noteInterests(w, pg); learnWords(w, pg.title); wonderFromPage(w, pg);
  pg.reaction = say; c.thought = say; c.thoughtId++; c.thoughtAt = w.clock;
  note(w, `${c.name} read about ${pg.title} on the tablet.`, 'tablet');
  journal(w, `Read on the tablet: "${pg.title}". ${say}`, 'tablet'); pg.jid = w.journal[0].id;
  if (w.asks) w.asks.push({ type: 'page', id: pg.id });
  if (word) onEvent(w, 'lookup', { word, title: pg.title });
  if (interest) interestPage(w, pg);
  return say;
}

// the slab has nothing it has not already read about a word it wanted: it lets that go instead of asking again and again
function dropLookup(w, word) {
  const x = w.cat.wants.find(y => y.kind === 'lookup' && y.word === word); if (!x) return;
  w.cat.wants = w.cat.wants.filter(y => y !== x); journal(w, `The slab had nothing new about "${word}". I have let it go.`, 'want');
}

// ---------- the act ----------
const cachedPage = w => { const l = w.tablet.pages.filter(p => p !== w.tablet.pages[0] || w.tablet.pages.length < 2); return l.length ? pick(l) : null; };
const readSeconds = pg => clamp(5.5 + pg.extract.length / 60, 6, 13);

export function describeTablet(a) {
  switch (a.phase) {
    case 'go': return 'Heading to the tablet';
    case 'boot': return 'Waking the tablet';
    case 'write': return 'Typing a note to the human on the tablet';
    case 'blog': return 'Typing up a blog post on the tablet';
    case 'shop': return 'Shopping on the tablet';
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
    const so = !a.shopped && shopChoice(w); if (so) { a.order = so; a.phase = 'shop'; a.t = 0; c.thought = pick(['Money in the account. Time to spend it.', 'Let me see what the shop has.', 'I have earned this. Browsing.']); c.thoughtId++; c.thoughtAt = w.clock; return; }
    const dp = !a.blogged && blogPending(w) && w.blog.draft; if (dp) { a.post = dp; a.phase = 'blog'; a.t = 0; c.thought = pick(BLOG_THOUGHTS); c.thoughtId++; c.thoughtAt = w.clock; return; }
    if (!w.netOn && (a.wrote || a.blogged || a.shopped) && !cachedPage(w)) { w.tablet.lastUse = w.clock; w.tablet.uses++; finish(); return; }
    if (w.netOn) { const req = Object.assign({ id: uid(), state: 'queued', bornMs: Date.now() }, pickRequest(w)); w.netq.push(req); a.req = req; a.phase = 'wait'; a.t = 0; }
    else { const pg = cachedPage(w); if (pg) { a.page = pg; a.repeat = true; a.phase = 'read'; a.t = 0; a.dur = 6; } else { a.phase = 'nosignal'; a.t = 0; } }
    return;
  }
  if (a.phase === 'write') {
    if (a.t >= 6) { publishWish(w, a.wish); a.wish = null; a.wrote = true; a.phase = 'boot'; a.t = 1.5; }
    return;
  }
  if (a.phase === 'shop') {
    if (a.t >= 5) { placeOrder(w, a.order && shopChoice(w) ? a.order : null); a.order = null; a.shopped = true; a.phase = 'boot'; a.t = 1.5; }
    return;
  }
  if (a.phase === 'blog') {
    if (a.t >= 9) { publishPost(w, a.post); a.post = null; a.blogged = true; a.phase = 'boot'; a.t = 1.5; }
    return;
  }
  if (a.phase === 'wait') {
    const r = a.req;
    if (r.state === 'done' && r.result) {
      const { pg, repeat } = recordPage(w, r.kind, r.result); if (r.kind === 'featured') w.tablet.featuredDate = localDate();
      a.page = pg; a.repeat = repeat; a.word = r.word; a.recipe = r.recipe; a.interest = !!r.interest; a.stars = !!r.stars; a.phase = 'read'; a.t = 0; a.dur = repeat ? 5 : readSeconds(pg); r.state = 'taken';
    } else if (r.state === 'error' || !w.netOn || Date.now() - r.bornMs > 25000 || a.t > 90) { // 90 s of game time too, so fast-forwarding cannot leave the cat waiting while its needs run out
       a.err = r.error || 'no signal'; if (r.state !== 'done') r.state = 'error'; if (r.interest && w.netOn && r.error && !/no signal|aborted|HTTP|fetch/i.test(r.error)) interestMiss(w); if (r.word && w.netOn && /nothing/i.test(r.error || '')) dropLookup(w, r.word); a.phase = 'nosignal'; a.t = 0; } // (nothing more to find is a miss; no signal is not)
    return;
  }
  if (a.phase === 'read') {
    if (!a.reacted) { a.reacted = true; a.say = absorb(w, a.page, a.repeat, a.word, a.recipe, a.interest, a.stars); }
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
