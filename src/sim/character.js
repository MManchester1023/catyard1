// Character. The needs and scores in mind.js say what a cat *could* do; this is what makes it this cat, today.
//  - Moods of the day. Each morning it wakes up feeling a certain way (bold, lazy, restless...), which tilts
//    what it fancies doing for the whole day. Yesterday and the weather feed into it, but it is not a formula.
//  - Habits and rituals. What it keeps doing at the same time of day becomes a habit; a habit pulls, and feels good.
//  - Stubborn impulses. Now and then it gets a notion and will not be talked out of it (hunger and sleep still win).
//  - Change over time. What it does day after day slowly moves what kind of cat it is.
import { clamp, pick } from './util.js';
import { dayOf, hourOf, journal, note } from './world.js';
import { scaled } from './pace.js';
import { isUpset } from './upset.js';
import { coinActive } from './secrets.js';
import { actKeyOf, SCORE_KEY, isFav } from './finds.js';
import { affinity, keyName } from './feelings.js';
import { random } from './rng.js';

export function ensureChar(c) {
  if (!c.dayMood) c.dayMood = { day: 0, kind: 'steady' }; if (!Array.isArray(c.habits)) c.habits = []; if (!c.slotLog) c.slotLog = {};
  if (c.stub === undefined) c.stub = null; if (!c.base) c.base = { curious: c.traits.curious, bold: c.traits.bold, affection: c.traits.affection, lazy: c.traits.lazy };
  if (!c.driftSaid) c.driftSaid = {}; if (typeof c.stubAt !== 'number') c.stubAt = -999;
  return c;
}

// ---------- what each of these is, in words ----------
export const DO = { ball: 'go and bat the ball about', toymouse: 'go and stalk the toy mouse', paint: 'paint', tablet: 'use the tablet', gaze: 'go and look at the sky', perch: 'climb up high and watch', investigate: 'go and investigate', craft: 'make something', gather: 'scratch the oak for bark', stashvisit: 'go and check the stash', frog: 'sit with the frog', cattree: 'sit in the cat tree', post: 'scratch the post', yarn: 'chase the yarn', lounge: 'lie in the warm', fish: 'go and watch the fish', listen: 'listen to the chime', explore: 'go for a wander', play: 'play', wash: 'have a proper wash' };

// ---------- moods of the day ----------
export const MOODS = {
  steady: { label: 'steady', line: null, mul: {} },
  bold: { label: 'bold', line: ['I woke up feeling brave. The yard seems smaller than usual.', 'Today I am not afraid of anything. I will reconsider if a crow turns up.'], mul: { hunt: 1.25, explore: 1.3, perch: 1.3, investigate: 1.15, cattree: 1.1 }, fear: -0.12 },
  lazy: { label: 'lazy', line: ['Today I do not feel like doing very much. I would like that respected.', 'Slow day. I have decided. Nobody is to hurry me.'], mul: { idle: 1.3, lounge: 1.5, cattree: 1.2, explore: 0.7, play: 0.7, hunt: 0.8, zoom: 0.7, craft: 0.8 } },
  social: { label: 'sociable', line: ['I feel like company today. Any company. Even the frog.', 'I would like someone near today. I am not saying who.'], mul: { frog: 1.3, attention: 1.4, offering: 1.2, tablet: 1.1 } },
  dreamy: { label: 'dreamy', line: ['My head is somewhere else today. Mostly up.', 'I feel far away and quite pleased about it.'], mul: { gaze: 1.4, paint: 1.3, listen: 1.4, idle: 1.1, investigate: 1.1 } },
  busy: { label: 'busy', line: ['I have things to do today and I intend to do all of them.', 'Busy day ahead. I can feel it in my claws.'], mul: { craft: 1.3, gather: 1.3, post: 1.2, tablet: 1.2, stashvisit: 1.2, idle: 0.7 } },
  restless: { label: 'restless', line: ['I cannot sit still today. My paws have opinions.', 'Too much energy. I may run into something on purpose.'], mul: { play: 1.3, zoom: 1.4, explore: 1.2, yarn: 1.3, idle: 0.65, lounge: 0.7 } },
  grumpy: { label: 'grumpy', line: ['I woke up in a mood. It is not about anything. Please do not ask.', 'Not today. Whatever it is, not today.'], mul: { attention: 0.5, offering: 0.8, play: 0.8, frog: 0.8, post: 1.3 }, joy: -0.08 },
  chipper: { label: 'chipper', line: ['For no reason at all I feel wonderful. I am not going to question it.', 'Today is a good one. I can tell. My whiskers agree.'], mul: { play: 1.1, frog: 1.1, tablet: 1.1, explore: 1.1 }, joy: 0.08 },
};
export const moodToday = w => { const c = ensureChar(w.cat); return MOODS[c.dayMood.kind] || MOODS.steady; };

// each morning: a mood. The cat's nature and last night weigh on it, but not so much that it can be read off
export function rollMood(w) {
  const c = ensureChar(w.cat), T = c.traits, n = c.needs, t = c.temper, rainy = w.weather.rain > 0.3 || w.weather.type === 'rain';
  const wt = {
    steady: 2.5, bold: 0.8 + T.bold * 1.2, lazy: 0.7 + T.lazy * 1.4 + (t === 'garfield' ? 1.2 : 0) + (rainy ? 0.6 : 0), social: 0.7 + T.affection * 1.2 + (n.lonely > 0.6 ? 1.2 : 0),
    dreamy: 0.6 + T.curious * 0.8 + (t === 'nightowl' || t === 'vangogh' ? 1 : 0) + (rainy ? 0.5 : 0), busy: 0.6 + (t === 'builder' || t === 'techie' || t === 'collector' ? 1.2 : 0) + T.curious * 0.4, restless: 0.6 + (1 - T.lazy) * 0.8 + n.fun * 0.8,
    grumpy: 0.35 + (n.tired > 0.6 ? 1 : 0) + (n.hunger > 0.6 ? 0.8 : 0) + (isUpset(w) ? 1.5 : 0) + (rainy ? 0.3 : 0), chipper: 0.5 + c.mood.joy * 0.8 + (coinActive(w) ? 1.5 : 0),
  };
  let r = random() * Object.values(wt).reduce((a, b) => a + b, 0), kind = 'steady';
  for (const [k, v] of Object.entries(wt)) { r -= v; if (r <= 0) { kind = k; break; } }
  const m = MOODS[kind]; c.dayMood = { day: dayOf(w), kind };
  if (m.joy) c.mood.joy = clamp(c.mood.joy + m.joy); if (m.fear) n.fear = clamp(n.fear + m.fear);
  if (m.line && random() < 0.7) journal(w, pick(m.line), 'mood');
  return kind;
}

// ---------- habits and rituals ----------
export const SLOTS = [['morning', 5, 11], ['midday', 11, 16], ['evening', 16, 21], ['night', 21, 29]];
export const slotOf = h => { const x = h < 5 ? h + 24 : h; return (SLOTS.find(s => x >= s[1] && x < s[2]) || SLOTS[3])[0]; };
export const HABIT_DAYS = 4, MAX_HABITS = 3;
const SLOT_WORD = { morning: 'every morning', midday: 'in the middle of every day', evening: 'every evening', night: 'every night' };
const REV = {}; for (const [sk, ak] of Object.entries(SCORE_KEY)) REV[ak] = sk; // assoc key -> the score name decide() uses
export const habitLine = h => `${keyName(h.key)} ${SLOT_WORD[h.slot]}`;

// every time it sets about something: is this becoming a habit? is it keeping one?
export function noteAct(w) {
  const c = ensureChar(w.cat), a = c.act, key = actKeyOf(a); if (!key) return;
  const slot = slotOf(hourOf(w)), day = dayOf(w), L = c.slotLog[slot] || (c.slotLog[slot] = {}), e = L[key] || (L[key] = { n: 0, last: 0 });
  if (e.last !== day) { e.n++; e.last = day; }
  const h = c.habits.find(x => x.key === key && x.slot === slot);
  if (h) {
    if (h.last !== day) { // the ritual, kept
      h.last = day; h.times = (h.times || 0) + 1; c.needs.fear = clamp(c.needs.fear - 0.04); c.mood.joy = clamp(c.mood.joy + 0.02);
      if (random() < 0.4) { c.thought = pick([`${keyName(key)[0].toUpperCase() + keyName(key).slice(1)} ${SLOT_WORD[slot]}. As always.`, 'My routine. It holds the day together.', 'Right on time. I do like a ritual.']); c.thoughtId++; c.thoughtAt = w.clock; }
    }
  } else if (e.n >= scaled(w, HABIT_DAYS) && c.habits.length < MAX_HABITS) {
    c.habits.push({ key, slot, since: day, last: day, times: e.n });
    journal(w, `Lately it is ${habitLine({ key, slot })}. I did not decide that. I have started calling it a ritual.`, 'habit'); note(w, `${c.name} has a ritual: ${habitLine({ key, slot })}.`, 'taste');
  }
  const s = c.stub; if (s && w.clock < s.until && acted(a, s.key)) { // the notion, seen through
    c.stub = null; c.mood.joy = clamp(c.mood.joy + 0.03);
    if (random() < 0.35) journal(w, `I wanted to ${DO[s.key]} and I did. I will not be told otherwise.`, 'impulse');
  }
}
// is this act what the score name is about?
export function acted(a, sk) { const k = actKeyOf(a); if (k) return REV[k] === sk; return (sk === 'explore' && a.type === 'explore') || (sk === 'play' && a.type === 'play' && !a.own && !a.gather); }

// a habit pulls at its time of day (once a day) and fades if it is no longer kept
export function habitPull(w, sk) {
  const c = ensureChar(w.cat), slot = slotOf(hourOf(w)), day = dayOf(w), ak = SCORE_KEY[sk]; if (!ak) return 0;
  const h = c.habits.find(x => x.key === ak && x.slot === slot); return h && h.last !== day ? 0.3 : 0;
}
export const stubPull = (w, sk) => { const s = ensureChar(w.cat).stub; return s && s.key === sk && w.clock < s.until ? 0.55 : 0; };
export const moodMul = (w, sk) => { const m = moodToday(w).mul[sk]; return m || 1; };

// ---------- stubborn impulses ----------
export const stubbornness = c => clamp(0.2 + 0.5 * c.traits.bold + 0.3 * (1 - c.traits.affection), 0, 1);
const IMPULSE_KEYS = [...Object.keys(SCORE_KEY).filter(k => k !== 'wash' && k !== 'hunt'), 'explore', 'play'];
export function rollImpulse(w) {
  const c = ensureChar(w.cat), S = w.scoreSnap; if (!S) return null;
  if (c.stub && w.clock < c.stub.until) return null; c.stub = null;
  if (w.clock - c.stubAt < w.dayLen * 0.2 || random() > 0.1 + 0.25 * stubbornness(c)) return null;
  if (c.needs.hunger > 0.75 || c.needs.tired > 0.8 || isUpset(w)) return null; // a notion, not a crisis
  const m = moodToday(w), pool = IMPULSE_KEYS.filter(k => S[k] > 0.05).map(k => {
    const ak = SCORE_KEY[k], wgt = 0.3 + Math.max(0, ak ? affinity(w, ak) : 0) * 2 + (ak && isFav(w, ak) ? 1 : 0) + (m.mul[k] > 1 ? 0.6 : 0) + random() * 0.4; return [k, wgt];
  });
  if (!pool.length) return null;
  let r = random() * pool.reduce((a, p) => a + p[1], 0), key = pool[0][0]; for (const [k, v] of pool) { r -= v; if (r <= 0) { key = k; break; } }
  c.stub = { key, until: w.clock + w.dayLen * 0.12, day: dayOf(w) }; c.stubAt = w.clock;
  c.thought = pick([`I have decided I am going to ${DO[key]}. Do not argue.`, `Right. I am going to ${DO[key]}. It is not up for discussion.`, `I have a notion. ${DO[key][0].toUpperCase() + DO[key].slice(1)}. Now.`]); c.thoughtId++; c.thoughtAt = w.clock;
  return c.stub;
}

// ---------- change over time ----------
const WORDS = { curious: ['more curious', 'less curious'], bold: ['bolder', 'more careful'], affection: ['softer', 'more aloof'], lazy: ['lazier', 'more energetic'] };
const BASE_CAP = 0.25, STEP = 0.1;
export function drift(w) {
  const c = ensureChar(w.cat), day = dayOf(w), prev = w.days && w.days[day - 1]; if (!prev) return null;
  const s = prev.secs || {}, tot = Object.values(s).reduce((a, b) => a + b, 0) || 1, sh = (...ks) => ks.reduce((a, k) => a + (s[k] || 0), 0) / tot;
  const ys = w.journal.filter(e => e.day === day - 1), cnt = (...tags) => ys.filter(e => tags.includes(e.tag)).length;
  const d = { curious: 0, bold: 0, affection: 0, lazy: 0 };
  if (sh('investigate', 'gaze', 'tablet', 'explore') >= 0.15) d.curious += 0.007; d.curious += Math.min(0.012, 0.004 * cnt('discover', 'solved', 'mystery', 'stars'));
  if (sh('hunt', 'perch') >= 0.04) d.bold += 0.006; if (cnt('upset')) d.bold -= 0.008;
  d.affection += Math.min(0.01, 0.004 * cnt('frog', 'offering')); if (!cnt('frog', 'offering') && c.needs.lonely > 0.7) d.affection -= 0.004;
  if (sh('sleep') > 0.55) d.lazy += 0.006; else if (sh('paint', 'craft', 'play', 'explore') > 0.25) d.lazy -= 0.006;
  for (const k of Object.keys(d)) {
    if (Math.abs(c.traits[k] - c.base[k]) > BASE_CAP) c.base[k] = c.traits[k]; // (set from outside, e.g. an admin command: that is who it is now)
    const lo = c.base[k] - BASE_CAP, hi = c.base[k] + BASE_CAP; c.traits[k] = clamp(c.traits[k] + clamp(d[k], -0.012, 0.012), Math.max(0.05, lo), Math.min(0.98, hi));
    const step = Math.trunc((c.traits[k] - c.base[k]) / STEP); // how many tenths it has moved, with a sign
    if (step !== (c.driftSaid[k] || 0) && Math.abs(step) > Math.abs(c.driftSaid[k] || 0)) {
      journal(w, `I think I am getting ${WORDS[k][step > 0 ? 0 : 1]}. I did not plan it. It is just what I keep doing.`, 'change'); note(w, `${c.name} seems to be getting ${WORDS[k][step > 0 ? 0 : 1]}.`, 'taste');
    }
    c.driftSaid[k] = step;
  }
  return d;
}

// ---------- once a day, and a few times a day ----------
export function characterTick(w) {
  const c = ensureChar(w.cat), day = dayOf(w);
  if (c.dayMood.day !== day && (hourOf(w) >= 6 || c.dayMood.day === 0)) { // (a new mood with the morning, not at midnight)
    for (const slot of Object.keys(c.slotLog)) for (const key of Object.keys(c.slotLog[slot])) { const e = c.slotLog[slot][key]; if (e.last < day - 3) { e.n--; e.last = day - 3; if (e.n <= 0) delete c.slotLog[slot][key]; } } // (what is no longer kept up is forgotten)
    for (const h of c.habits.slice()) if (day - h.last > 6) { c.habits.splice(c.habits.indexOf(h), 1); journal(w, `I have not done ${habitLine(h)} in a while. I suppose it was never a ritual after all.`, 'habit'); }
    drift(w); rollMood(w);
  }
  rollImpulse(w);
}

// what Claude is told
export function characterDigest(w) {
  const c = ensureChar(w.cat), m = moodToday(w), out = [];
  if (m.label !== 'steady') out.push(`Your mood today: ${m.label}.`);
  if (c.habits.length) out.push(`Your habits and rituals: ${c.habits.map(habitLine).join('; ')}.`);
  if (c.stub && w.clock < c.stub.until) out.push(`You have a stubborn notion to ${DO[c.stub.key]} and will not be talked out of it.`);
  const ch = Object.keys(WORDS).filter(k => Math.abs(c.traits[k] - c.base[k]) >= STEP).map(k => WORDS[k][c.traits[k] > c.base[k] ? 0 : 1]); if (ch.length) out.push(`You have been changing: you are getting ${ch.join(' and ')} than you were.`);
  return out;
}
