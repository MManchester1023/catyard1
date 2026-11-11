// Intent. A few times a day the cat makes up its mind about what it wants to do next, and why.
// The simulation works out what the cat *could* do right now (mind.js leaves that in w.scoreSnap). With Claude connected,
// Claude is shown that menu with the cat's mood, habits, memories and wants, and picks one in the cat's own voice. Offline,
// a built-in whim does the same from the same ingredients. Either way the pick is a strong nudge that the simulation
// honours (hunger and sleep still come first), the reason goes in the diary, and what it chose is something it can talk about.
import { clamp, pick } from './util.js';
import { dayOf, journal } from './world.js';
import { SCORE_KEY, isFav } from './finds.js';
import { moodToday, habitPull, DO, ensureChar, acted } from './character.js';
import { affinity, keyName } from './feelings.js';
import { isUpset } from './upset.js';
import { wantPull } from './wants.js';
import { recall, when, touch } from './memory.js';

export const INTENT_PULL = 0.8, INTENT_LEN = 0.14, MIN_GAP = 0.2, CLAUDE_PER_DAY = 3, ASK_TIMEOUT = 0.1;
// what it can set its mind on (never what its body is demanding)
const ITEMS = [...Object.keys(SCORE_KEY).filter(k => k !== 'wash' && k !== 'hunt'), 'explore', 'play'];

export function ensureIntent(c) {
  if (c.intent === undefined) c.intent = null; if (typeof c.intentAt !== 'number') c.intentAt = -999; if (c.intentAsk === undefined) c.intentAsk = null; if (!c.claudeIntents) c.claudeIntents = { day: 0, n: 0 };
  return c;
}
export const intentActive = w => { const i = w.cat.intent; return !!(i && !i.done && w.clock < i.until); };
export const intentPull = (w, sk) => { const i = w.cat.intent; return i && !i.done && w.clock < i.until && i.key === sk ? INTENT_PULL : 0; };

// ---------- the menu: what is actually possible now ----------
export function intentMenu(w, max = 7) {
  const S = w.scoreSnap; if (!S) return [];
  const rows = ITEMS.filter(k => S[k] > 0.05 && DO[k]).map(k => ({ key: k, label: DO[k], s: S[k] }));
  rows.sort((a, b) => b.s - a.s);
  const top = rows.slice(0, max - 2), rest = rows.slice(max - 2).sort(() => Math.random() - 0.5).slice(0, 2); // (a couple of long shots, so it is not just the obvious thing)
  return top.concat(rest);
}

// ---------- memory: which of its memories bears on what it might do ----------
const MEM_TO = { frog: ['frog'], art: ['paint'], moonwish: ['gaze'], starwish: ['gaze'], craft: ['craft', 'gather'], hunt: ['stashvisit', 'fish', 'perch'], solved: ['investigate', 'gaze'], discover: ['explore', 'investigate'], stash: ['stashvisit'], upset: ['lounge', 'cattree'], mystery: ['investigate', 'gaze'], tablet: ['tablet'], favourite: [], interest: ['tablet'], stars: ['gaze'] };

// ---------- the built-in whim ----------
export function whim(w, menu = intentMenu(w)) {
  const c = ensureChar(w.cat), m = moodToday(w), mem = recall(w, { fresh: false }); if (!menu.length) return null;
  const rows = menu.map(o => {
    const ak = SCORE_KEY[o.key], parts = {};
    parts.fit = ak ? Math.max(0, affinity(w, ak)) * 2 : 0; parts.fav = ak && isFav(w, ak) ? 1 : 0; parts.habit = habitPull(w, o.key) ? 0.8 : 0;
    parts.mood = m.mul[o.key] > 1 ? 0.6 : m.mul[o.key] < 1 ? -0.3 : 0; parts.mem = mem && (MEM_TO[mem.tag] || []).includes(o.key) ? 0.9 : 0;
    parts.want = wantPull(w, wantKinds(o.key)) * 0.8; parts.noise = Math.random() * 0.5 + 0.4; parts.again = c.intent && c.intent.key === o.key ? -0.7 : 0; // (it does not decide the same thing twice in a row)
    return { o, parts, score: Object.values(parts).reduce((a, b) => a + b, 0) };
  });
  rows.sort((a, b) => b.score - a.score); const r = rows[0], p = r.parts;
  const why = p.mem >= 0.9 && p.mem >= Math.max(p.fit, p.fav, p.habit, p.want) ? (mem.text.length <= 90 ? `${when(w, mem)}: ${mem.text} It keeps coming back to me.` : `I keep thinking about what happened ${when(w, mem).toLowerCase()}.`)
    : p.habit && p.habit >= Math.max(p.fit, p.fav, p.want) ? 'It is that time of day. I have a way of doing things.'
    : p.fav >= Math.max(p.fit, p.want) && p.fav ? `${keyName(SCORE_KEY[r.o.key])[0].toUpperCase() + keyName(SCORE_KEY[r.o.key]).slice(1)} is my favourite. Why would I not?`
    : p.want > 0.3 && p.want >= p.fit ? 'It is something I have been wanting to get done.'
    : p.fit > 0.3 ? 'It always leaves me feeling better afterwards.'
    : p.mood > 0 ? `I am feeling ${m.label} today. This suits it.` : pick(['I just feel like it.', 'No particular reason. That is reason enough.', 'It crossed my mind and would not leave.']);
  if (mem && p.mem >= 0.9) touch(w, mem);
  return { key: r.o.key, why };
}
const wantKinds = key => ({ paint: ['master'], craft: ['craft'], gather: ['craft'], tablet: ['learn', 'lookup'], investigate: ['solve'], gaze: ['solve'], stashvisit: ['guard', 'find'], explore: ['find'] })[key] || ['none'];

// ---------- making up its mind ----------
export function applyIntent(w, key, why, by = 'whim') {
  const c = ensureIntent(w.cat); if (!DO[key]) return null;
  c.intent = { key, label: DO[key], why: String(why || '').slice(0, 220), until: w.clock + w.dayLen * INTENT_LEN, by, day: dayOf(w), done: false }; c.intentAt = w.clock; c.intentAsk = null;
  w.stats.intents = (w.stats.intents || 0) + 1;
  journal(w, `I have decided to ${DO[key]}. ${c.intent.why}`.trim(), 'intent');
  c.thought = `I am going to ${DO[key]}.`; c.thoughtId++; c.thoughtAt = w.clock; c.reeval = 0.2; // (so it acts on it now, not when it next gets round to thinking)
  return c.intent;
}
export function intentDone(w) {
  const c = ensureIntent(w.cat), i = c.intent; if (!i || i.done) return;
  i.done = true; c.mood.joy = clamp(c.mood.joy + 0.05); w.stats.intentsDone = (w.stats.intentsDone || 0) + 1;
  if (Math.random() < 0.5) journal(w, `I set out to ${DO[i.key]} and I did. ${i.by === 'claude' ? 'Good.' : 'I like it when things go to plan.'}`, 'intent');
}

// a few times a day
export function intentTick(w) {
  const c = ensureIntent(w.cat), day = dayOf(w);
  if (c.intentAsk) {
    if (w.llmOn && w.clock - c.intentAsk.at < w.dayLen * ASK_TIMEOUT) return;
    c.intentAsk = null; const m = whim(w); if (m) applyIntent(w, m.key, m.why, 'whim'); return; // Claude did not answer in time: it makes up its own mind
  }
  if (intentActive(w) || w.clock - c.intentAt < w.dayLen * MIN_GAP) return;
  const n = c.needs; if (c.pose === 'sleep' || c.pose === 'inside' || n.hunger > 0.7 || n.tired > 0.8 || isUpset(w) || c.hidden) return;
  const menu = intentMenu(w); if (menu.length < 2) return;
  if (c.claudeIntents.day !== day) c.claudeIntents = { day, n: 0 };
  if (w.llmOn && c.claudeIntents.n < CLAUDE_PER_DAY && Math.random() < 0.85) {
    c.claudeIntents.n++; c.intentAsk = { id: Math.random().toString(36).slice(2, 8), at: w.clock, menu: menu.map(o => ({ key: o.key, label: o.label })) }; c.intentAt = w.clock;
    if (w.asks) w.asks.push({ type: 'intent', id: c.intentAsk.id });
    return;
  }
  const m = whim(w, menu); if (m) applyIntent(w, m.key, m.why, 'whim');
}

// Claude's answer (llm.js): a number from the menu, or a key
export function claudeIntent(w, ask, answer) {
  const c = ensureIntent(w.cat), q = c.intentAsk; if (!q || q.id !== ask.id) return null; // (a stale answer)
  let key = null; const p = answer && answer.pick;
  if (typeof p === 'number' && q.menu[p - 1]) key = q.menu[p - 1].key; else if (typeof p === 'string') { const n = parseInt(p, 10); key = q.menu[n - 1] ? q.menu[n - 1].key : (q.menu.find(o => o.key === p || o.label === p) || {}).key || null; }
  if (!key) { c.intentAsk = null; return null; }
  return applyIntent(w, key, String(answer.why || '').replace(/[\u0000-\u001f]/g, ' ').trim(), 'claude');
}
export const intentPrompt = (w, ask) => {
  const q = w.cat.intentAsk; if (!q || q.id !== ask.id) return null;
  return `It is time to make up your mind about what you want to do next. You may choose ONE thing, from this list, which is everything that is possible for you right now:\n${q.menu.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}\nThink about how you feel, your mood today, your habits, what you remember and what you want, then choose what YOU want, not necessarily what is most likely. Say why in your own voice.\nJSON: {"pick": <the number>, "why": "<= 22 words"}`;
};

export function intentDigest(w) {
  const c = ensureIntent(w.cat), i = c.intent; return i && !i.done && w.clock < i.until ? [`You have set your mind on this: to ${i.label}. (${i.why})`] : [];
}

// called whenever it sets about something: was that what it meant to do?
export function intentFulfilled(w) { const c = w.cat, i = c.intent; if (i && !i.done && w.clock < i.until && acted(c.act, i.key)) intentDone(w); }
