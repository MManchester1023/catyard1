// Memory. The diary holds everything that happened (150 lines, then it forgets); the cat keeps the significant things.
// Each memory has a salience: how much it mattered when it happened. It fades with the days but is kept alive each time
// the cat thinks about it, so a few events stay with it for good while the rest slip away. It also keeps count of who
// keeps turning up (the frog, the crow, the birds, the mice, the human), so a visitor can be a regular.
// The cat brings memories back in its thoughts, in chat, on its blog and in what Claude is told about it.
import { pick, clamp } from './util.js';
import { dayOf } from './world.js';

export const MEM_CAP = 60;
// how much a kind of diary line matters when it happens
const SAL = { upset: 0.8, solved: 0.9, discover: 0.8, moonwish: 0.95, starwish: 0.95, level: 0.7, craft: 0.7, frog: 0.7, wish: 0.6, hunt: 0.6, offering: 0.6, art: 0.5, stash: 0.5, taste: 0.5, favourite: 0.7, habit: 0.6, change: 0.65, intent: 0.45, interest: 0.5, stars: 0.6, blog: 0.4, theory: 0.4, mystery: 0.4, tablet: 0.35, muse: 0.1 };
const WHO = [['frog', /\bfrog\b/i], ['crow', /\bcrow\b/i], ['birds', /\bbirds?\b/i], ['mice', /\bmouse\b|\bmice\b/i], ['you', /./]];
const WHO_TAGS = new Set(['frog', 'hunt', 'upset', 'wish', 'discover', 'stash', 'blog', 'mystery', 'solved']);

export function ensureMemory(c) {
  if (!Array.isArray(c.memories)) c.memories = []; if (typeof c.mSeen !== 'number') c.mSeen = 0; if (!c.familiar) c.familiar = {};
  if (typeof c.recallAt !== 'number') c.recallAt = -999; if (!c.mFirst) c.mFirst = {};
  return c;
}

// how strong a memory is now: its salience, faded by age, kept up by being recalled
export const strength = (w, m) => m.sal * Math.pow(0.93, Math.max(0, dayOf(w) - m.day)) + 0.12 * Math.min(4, m.recalled || 0);

// look at what has been written in the diary since last time and keep what mattered. Called a few times a day.
export function memoryTick(w) {
  const c = ensureMemory(w.cat), fresh = w.journal.filter(e => e.id > c.mSeen).sort((a, b) => a.id - b.id);
  if (!fresh.length) return 0; c.mSeen = fresh[fresh.length - 1].id;
  let kept = 0;
  for (const e of fresh) {
    const base = SAL[e.tag]; if (base == null) continue;
    for (const [who, re] of WHO) { // who turned up today? (counted once per day)
      if (!re.test(e.text) || (who === 'you' ? e.tag !== 'offering' : !WHO_TAGS.has(e.tag))) continue;
      const f = c.familiar[who] || (c.familiar[who] = { n: 0, first: e.day, last: e.day });
      if (f.last !== e.day || f.n === 0) f.n++; f.last = e.day;
    }
    const first = !c.mFirst[e.tag]; c.mFirst[e.tag] = 1; // the first time anything of a kind happens is memorable
    const sal = clamp(base + (first ? 0.25 : 0), 0, 1); if (sal < 0.5) continue;
    c.memories.push({ id: e.id, day: e.day, tag: e.tag, text: e.text.length > 220 ? e.text.slice(0, 219) + '…' : e.text, sal: Math.round(sal * 100) / 100, recalled: 0, first });
    kept++;
  }
  if (c.memories.length > MEM_CAP) { c.memories.sort((a, b) => strength(w, b) - strength(w, a)); c.memories.length = MEM_CAP; }
  return kept;
}

// the strongest memory that is at least a day old (so it is about "before"), optionally of certain kinds, and not
// one it has been thinking about lately
export function recall(w, { tags = null, minAge = 1, exclude = null, fresh = true } = {}) {
  const c = ensureMemory(w.cat), day = dayOf(w);
  const pool = c.memories.filter(m => day - m.day >= minAge && (!tags || tags.includes(m.tag)) && (!exclude || m.id !== exclude) && (!fresh || w.clock - (m.at || -999) > w.dayLen * 0.5));
  if (!pool.length) return null;
  pool.sort((a, b) => strength(w, b) - strength(w, a));
  const top = pool.slice(0, 4); return top[Math.floor(Math.random() * top.length)]; // not always the same one
}
export const when = (w, m) => { const d = dayOf(w) - m.day; return d <= 0 ? 'Earlier today' : d === 1 ? 'Yesterday' : d < 7 ? `${d} days ago` : d < 14 ? 'Last week' : `On day ${m.day}`; };
export function touch(w, m) { m.recalled = (m.recalled || 0) + 1; m.at = w.clock; w.cat.recallAt = w.clock; return m; }

const LEAD = ['I keep thinking about it.', 'It has stayed with me.', 'I have not forgotten.', 'It still comes back to me.'];
// a line the cat can say out loud about something it remembers, or null. It does not do it too often.
export function memoryThought(w) {
  const c = ensureMemory(w.cat); if (w.clock - c.recallAt < w.dayLen * 0.3) return null;
  const m = recall(w); if (!m) return null; touch(w, m);
  return `${when(w, m)}: ${m.text} ${pick(LEAD)}`;
}

// ---------- the regulars ----------
export const FAM_NAME = { frog: 'the frog', crow: 'the crow', birds: 'the birds', mice: 'the mice', you: 'you' };
export const regulars = w => Object.entries(ensureMemory(w.cat).familiar).filter(([, f]) => f.n >= 3).sort((a, b) => b[1].n - a[1].n).map(([k, f]) => ({ key: k, name: FAM_NAME[k] || k, n: f.n, first: f.first, last: f.last }));
export const regularLine = w => { const r = regulars(w)[0]; if (!r) return null; return r.key === 'you' ? `You keep coming back (${r.n} days now). I have noticed.` : `${r.name[0].toUpperCase() + r.name.slice(1)} again. That is ${r.n} days now. I would call it a regular.`; };

// what Claude is told about the cat's past
export function memoryDigest(w) {
  const c = ensureMemory(w.cat), top = c.memories.slice().sort((a, b) => strength(w, b) - strength(w, a)).slice(0, 4);
  const out = []; if (top.length) out.push(`Things you remember (they matter to you): ${top.map(m => `${when(w, m).toLowerCase()}: ${m.text}`).join(' | ')}`);
  const r = regulars(w).slice(0, 3); if (r.length) out.push(`Regulars you recognise: ${r.map(x => `${x.name} (${x.n} days)`).join(', ')}.`);
  return out;
}

// when the human asks the cat what it remembers (offline; Claude gets the digest instead)
export function memoryReply(w, text = '') {
  const t = text.toLowerCase(), c = ensureMemory(w.cat);
  if (/regular|keeps? coming|visitor|who comes/.test(t)) { const l = regularLine(w); return l || 'Nobody has turned up often enough to be a regular. Give it time.'; }
  const yday = /yesterday/.test(t), m = recall(w, { minAge: 0, fresh: false });
  const pool = c.memories.filter(x => !yday || dayOf(w) - x.day === 1);
  if (yday && !pool.length) return 'Yesterday? Nothing worth keeping. A quiet one.';
  const pick1 = yday ? pool.sort((a, b) => strength(w, b) - strength(w, a))[0] : m;
  if (!pick1) return 'Nothing big enough to keep yet. Ask me again in a few days.';
  touch(w, pick1); return `${when(w, pick1)}: ${pick1.text}`;
}
