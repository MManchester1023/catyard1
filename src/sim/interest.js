// A special interest. Now and then the cat takes an interest in one particular thing, for no reason it can explain
// (octopuses, lighthouses, tea), and goes after it on the tablet: one page of Wikipedia after another on the same
// subject, until it has read about as much as it can take in. What it finds is kept as things it has learned, and it
// talks about it, writes about it and wonders about it. Then, after a while, something else catches its eye.
// The subject is random, tilted a little by what kind of cat it is.
import { pick, clamp } from './util.js';
import { dayOf, journal, note, clockStr } from './world.js';
import { scaled } from './pace.js';
import { feel } from './feelings.js';
import { random } from './rng.js';

export const INTEREST_PAGES = 6, MAX_MISSES = 3, REST_DAYS = 1.5, START_CHANCE = 0.12;
// [what it is called, what kind of thing it is]
const TOPICS = [
  ['Octopus', 'nature'], ['Jellyfish', 'nature'], ['Bee', 'nature'], ['Ant', 'nature'], ['Mushroom', 'nature'], ['Moss', 'nature'], ['Cave', 'nature'], ['Volcano', 'nature'], ['Glacier', 'nature'], ['Waterfall', 'nature'],
  ['Seahorse', 'nature'], ['Penguin', 'nature'], ['Hummingbird', 'nature'], ['Dragonfly', 'nature'], ['Hedgehog', 'nature'], ['Otter', 'nature'], ['Fern', 'nature'], ['Bamboo', 'nature'], ['Lichen', 'nature'], ['Rainbow', 'nature'],
  ['Thunderstorm', 'nature'], ['Fog', 'nature'], ['Snowflake', 'nature'], ['Desert', 'nature'], ['Coral reef', 'nature'], ['Beaver', 'build'], ['Spider web', 'build'], ['Bird nest', 'build'], ['Honeycomb', 'build'],
  ['Lighthouse', 'made'], ['Windmill', 'made'], ['Clock', 'made'], ['Kite', 'made'], ['Origami', 'art'], ['Pottery', 'art'], ['Bridge', 'build'], ['Steam locomotive', 'made'], ['Hot air balloon', 'made'], ['Submarine', 'made'],
  ['Typewriter', 'tech'], ['Compass', 'made'], ['Lantern', 'made'], ['Umbrella', 'made'], ['Teapot', 'made'], ['Bicycle', 'made'], ['Knot', 'build'], ['Music box', 'made'], ['Kaleidoscope', 'art'], ['Maze', 'puzzle'],
  ['Accordion', 'art'], ['Violin', 'art'], ['Church bell', 'made'], ['Telescope', 'sky'], ['Microscope', 'tech'], ['Fountain', 'build'], ['Castle', 'build'], ['Sundial', 'sky'], ['Puppet', 'art'], ['Tapestry', 'art'],
  ['Tea', 'food'], ['Honey', 'food'], ['Chocolate', 'food'], ['Pancake', 'food'], ['Cheese', 'food'], ['Comet', 'sky'], ['Saturn', 'sky'], ['Solar eclipse', 'sky'], ['Black hole', 'sky'], ['Chess', 'puzzle'],
  ['Jigsaw puzzle', 'puzzle'], ['Dominoes', 'puzzle'], ['String figure', 'puzzle'], ['Stonehenge', 'mystery'], ['Crop circle', 'mystery'], ['Labyrinth', 'puzzle'], ['Glass', 'made'], ['Amber', 'treasure'], ['Gemstone', 'treasure'], ['Pearl', 'treasure'],
];
// what each kind of cat leans towards
const LEAN = { collector: ['treasure', 'made'], vangogh: ['art', 'sky'], hunter: ['nature'], nightowl: ['sky', 'mystery'], techie: ['tech', 'puzzle'], garfield: ['food'], builder: ['build', 'made'] };
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const TOPIC_NAMES = TOPICS.map(t => t[0]);

export function ensureInterest(c) { if (c.interest === undefined) c.interest = null; if (!Array.isArray(c.interests)) c.interests = []; if (typeof c.interestAt !== 'number') c.interestAt = -999; return c; }
export const interestActive = w => { const i = w.cat.interest; return !!(i && i.state === 'active'); };
export const interestKey = i => 'topic:' + slug(i.topic);
const lc = t => t.charAt(0).toLowerCase() + t.slice(1);
// how it talks about each one (most are things there are many of; some are not)
const DISPLAY = { Octopus: 'octopuses', Jellyfish: 'jellyfish', Volcano: 'volcanoes', Dragonfly: 'dragonflies', Tapestry: 'tapestries', Compass: 'compasses', Moss: 'moss', Fog: 'fog', Lichen: 'lichen', Bamboo: 'bamboo', Pottery: 'pottery', Origami: 'origami', Tea: 'tea', Honey: 'honey', Chocolate: 'chocolate', Cheese: 'cheese', Chess: 'chess', Glass: 'glass', Amber: 'amber', Dominoes: 'dominoes', Saturn: 'Saturn', Stonehenge: 'Stonehenge', 'Music box': 'music boxes', 'Solar eclipse': 'solar eclipses', 'String figure': 'string figures', 'Church bell': 'church bells' };
export const interestName = i => DISPLAY[i.topic] || lc(i.topic) + 's';

// ---------- picking one ----------
function choose(w) {
  const c = w.cat, seen = new Set(c.interests.map(x => x.topic)), lean = LEAN[c.temper] || [];
  const pool = TOPICS.filter(t => !seen.has(t[0]) && !(c.interest && c.interest.topic === t[0]));
  const rows = (pool.length ? pool : TOPICS).map(t => [t[0], 1 + (lean.includes(t[1]) ? 1.5 : 0)]);
  let r = random() * rows.reduce((a, b) => a + b[1], 0); for (const [t, wt] of rows) { r -= wt; if (r <= 0) return t; } return rows[0][0];
}
export function startInterest(w, topic = null) {
  const c = ensureInterest(w.cat), t = topic || choose(w);
  c.interest = { topic: t, day: dayOf(w), at: w.clock, state: 'active', titles: [], facts: [], pages: 0, misses: 0 };
  const nm = interestName(c.interest);
  journal(w, `I have become interested in ${nm}. I cannot explain it. I need to know everything about ${nm}, starting now.`, 'interest'); note(w, `${c.name} has taken a special interest in ${nm}.`, 'tablet');
  c.thought = `${nm[0].toUpperCase() + nm.slice(1)}. I must find out about ${nm}.`; c.thoughtId++; c.thoughtAt = w.clock;
  if (w.chat) { w.chat.push({ from: 'sys', text: `${c.name} has become fascinated by ${nm}. Watch the tablet.`, day: dayOf(w), time: clockStr(w) }); if (w.chat.length > 80) w.chat.shift(); }
  return c.interest;
}

// a few times a day: once it has the tablet and has been alive a few days, something catches its eye
export function interestTick(w) {
  const c = ensureInterest(w.cat); if (interestActive(w) || !c.mem.known.tablet || dayOf(w) < scaled(w, 3)) return null;
  if (w.clock - c.interestAt < w.dayLen * REST_DAYS || random() > START_CHANCE) return null;
  return startInterest(w);
}

// ---------- researching it ----------
// what to ask the tablet for: the subject itself, skipping every page it has already read about it
export const interestRequest = w => { const i = w.cat.interest; return { kind: 'lookup', q: i.topic, word: null, interest: true, skip: i.titles.slice() }; };
export const wantsToResearch = w => interestActive(w) && random() < 0.8;

// it has read a page that was part of the research
export function interestPage(w, pg) {
  const c = ensureInterest(w.cat), i = c.interest; if (!i || i.state !== 'active') return;
  i.titles.push(pg.title); i.pages++; i.misses = 0;
  const fact = String(pg.extract).split(/(?<=[.!?])\s+/).find(s => s.length > 30) || pg.extract; i.facts.push({ title: pg.title, text: fact.length > 170 ? fact.slice(0, 167) + '...' : fact });
  feel(w, [interestKey(i)], { joy: 0.1, fun: -0.08 }, 'wondering');
  if (i.pages >= INTEREST_PAGES) finishInterest(w, 'enough');
}
// the tablet could not find anything more
export function interestMiss(w) {
  const i = w.cat.interest; if (!i || i.state !== 'active') return;
  if (++i.misses >= MAX_MISSES) finishInterest(w, i.pages ? 'dry' : 'nothing');
}
export function finishInterest(w, why) {
  const c = ensureInterest(w.cat), i = c.interest; if (!i || i.state !== 'active') return;
  i.state = 'done'; i.end = dayOf(w); c.interestAt = w.clock; const nm = interestName(i);
  if (!i.pages) { journal(w, `I could not find anything about ${nm}. I have decided it was a phase.`, 'interest'); c.interest = null; return; }
  const best = i.facts.slice().sort((a, b) => b.text.length - a.text.length)[0];
  journal(w, `I have read ${i.pages} page${i.pages === 1 ? '' : 's'} about ${nm}. ${why === 'dry' ? 'The slab has nothing more to show me. ' : ''}The part I will keep: ${best.text}`, 'interest'); note(w, `${c.name} finished researching ${nm} (${i.pages} pages).`, 'tablet');
  c.interests.unshift({ topic: i.topic, day: i.day, end: i.end, pages: i.pages, fact: best.text }); if (c.interests.length > 12) c.interests.pop();
  c.thoughtHint = 'interestDone';
}

// ---------- what it says ----------
export const INTEREST_THOUGHTS = [i => `I wonder if the slab has more about ${interestName(i)}.`, i => `Everything is about ${interestName(i)} if you look properly.`, i => `I keep thinking about ${interestName(i)}. I cannot stop.`, i => `I am becoming an expert on ${interestName(i)}.`];
export function interestThought(w) { const i = w.cat.interest; return i && i.state === 'active' ? pick(INTEREST_THOUGHTS)(i) : null; }

export function interestReply(w) {
  const c = ensureInterest(w.cat), i = c.interest, last = c.interests[0];
  if (i && i.state === 'active') return `${i.topic[0].toUpperCase() + i.topic.slice(1)}. I am deep into ${interestName(i)}. ${i.facts.length ? `I have learned that ${i.facts[i.facts.length - 1].text[0].toLowerCase() + i.facts[i.facts.length - 1].text.slice(1)}` : 'I have not found out much yet. I am working on it.'}`;
  if (last) return `Lately it was ${lc(last.topic)}. I read ${last.pages} pages. ${last.fact} I do not know what will be next. Something will.`;
  return 'Nothing in particular yet. I am waiting for something to catch my eye.';
}
export function interestDigest(w) {
  const c = ensureInterest(w.cat), i = c.interest, out = [];
  if (i && i.state === 'active') out.push(`Your special interest right now: ${interestName(i)}. You are researching it on the tablet (${i.pages} page${i.pages === 1 ? '' : 's'} so far).${i.facts.length ? ' What you have learned: ' + i.facts.slice(-2).map(f => f.text).join(' ') : ''}`);
  else if (c.interests[0]) out.push(`Your last special interest was ${lc(c.interests[0].topic)}. You read ${c.interests[0].pages} pages about it.`);
  return out;
}
