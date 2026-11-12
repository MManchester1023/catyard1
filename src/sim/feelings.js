// Feelings. What the cat likes is not a table: it is what things have made it feel. Whenever something happens to
// it (a gift, a page, a finished painting, a piece of bark), the cat's mood and needs move, and whatever it was
// engaged with gets an association that follows how that felt. Colours and kinds of object feed the taste numbers
// the rest of the game already uses, and activities feed small nudges to what the cat chooses to do.
import { clamp, ITEM_PLURAL, PLACE_LABEL } from './util.js';
import { journal, note } from './world.js';

export const FEEL_LABELS = ['warm', 'thrilled', 'soothed', 'proud', 'wondering', 'content', 'let down', 'uneasy', 'flat'];
const MAX_KEYS = 70;
export const FAV_BOOST = 1.6;
// what each kind of cat is made for
const BENT = { vangogh: ['act:paint'], collector: ['act:stash'], nightowl: ['act:gaze'], garfield: ['act:lounge'], hunter: ['act:hunt', 'act:fish'], techie: ['act:tablet', 'act:blog'], builder: ['act:craft', 'act:tree'] };
const r3 = v => Math.round(v * 1000) / 1000;

export function ensureFeel(c) { if (!c.assoc) c.assoc = {}; if (c.lastTasteSay == null) c.lastTasteSay = -999; return c; }

// a readable name for an association key
const ACTS = { frog: 'visiting the frog', hunt: 'hunting', paint: 'painting', tablet: 'the tablet', gaze: 'gazing at the sky', yarn: 'playing with the yarn', ball: 'chasing its ball', toymouse: 'stalking its toy mouse', toy: 'what the human gives it', lounge: 'lounging in the warm', perch: 'watching from up high', craft: 'making things', tree: 'scratching the oak', post: 'scratching the post', stash: 'tending the stash', investigate: 'investigating', offering: 'what the human leaves', cattree: 'sitting in the cat tree', bed: 'pulling at the cushion', fish: 'fishing', listen: 'listening to the chime', wash: 'a proper wash', blog: 'writing the blog' };
export function keyName(key) {
  const [kind, name] = key.split(':');
  if (kind === 'color') return name;
  if (kind === 'type') return ITEM_PLURAL[name] || name;
  if (kind === 'act') return ACTS[name] || name;
  if (kind === 'place') return name === 'beam' ? 'the sunbeam' : PLACE_LABEL[name] || name;
  if (kind === 'topic') return `reading about ${name}`;
  if (kind === 'craft') return `making a ${name.replace(/_/g, ' ')}`;
  if (kind === 'mat') return name === 'twine' ? 'twine' : name;
  return name || key;
}

// which feeling was it? an explicit label wins; otherwise it follows what actually moved
function labelFor(dj, dl, df, du, v) {
  if (df < -0.08) return 'soothed';
  if (dl < -0.1 && dj > 0.05) return 'warm';
  if (dj > 0.12 && du < -0.06) return 'thrilled';
  if (df > 0.08 || (v < -0.25 && df > 0)) return 'uneasy';
  if (v < -0.1) return 'let down';
  if (v > 0.2) return 'content';
  return 'flat';
}

// Something happened. eff is how it moves the cat ({ joy, lonely, fear, fun }, added to its state); keys are the
// things to remember it by. Returns the felt value (-1..1) and the feeling.
export function feel(w, keys, eff = {}, label = null, opts = {}) {
  const c = ensureFeel(w.cat), m = c.mood, n = c.needs;
  if (c.act && keys.some(k => k && k.startsWith('act:'))) c.act.felt = true; // (it has had its feeling about this one already)
  const bent = BENT[c.temper]; if (bent && keys.some(k => bent.includes(k))) eff = Object.assign({}, eff, { joy: (eff.joy || 0) + 0.05 }); // (what suits its nature feels a little better)
  if (c.favActs && c.favActs.length && keys.some(k => k && c.favActs.includes(k))) { // a favourite is a bigger boost than anything else: the good effects are stronger and it leaves a glow
    eff = Object.assign({}, eff); for (const k of ['joy', 'lonely', 'fear', 'fun']) if (eff[k]) eff[k] *= (k === 'joy' ? eff[k] > 0 : eff[k] < 0) ? FAV_BOOST : 1;
    eff.joy = (eff.joy || 0) + 0.04; c.glowUntil = w.clock + w.dayLen * 0.12;
  }
  const j0 = m.joy, l0 = n.lonely, f0 = n.fear, u0 = n.fun;
  if (eff.joy) m.joy = clamp(m.joy + eff.joy);
  if (eff.lonely) n.lonely = clamp(n.lonely + eff.lonely);
  if (eff.fear) n.fear = clamp(n.fear + eff.fear);
  if (eff.fun) n.fun = clamp(n.fun + eff.fun);
  const felt = (got, raw) => (Math.abs(got) >= Math.abs(raw) * 0.7 ? got : raw * 0.7); // (a cat that is already at the top of its mood still felt the good thing)
  const dj = felt(m.joy - j0, eff.joy || 0), dl = felt(n.lonely - l0, eff.lonely || 0), df = felt(n.fear - f0, eff.fear || 0), du = felt(n.fun - u0, eff.fun || 0);
  const v = clamp(dj * 2.2 - dl * 0.8 - df * 0.8 - du * 0.4, -1, 1), lb = label || labelFor(dj, dl, df, du, v);
  for (const key of keys) {
    if (!key) continue;
    const A = c.assoc[key] || (c.assoc[key] = { v: 0, n: 0, lab: {}, said: '' });
    A.n++; A.v = r3(A.v + (v - A.v) * Math.max(0.16, 1 / (A.n + 0.5))); A.lab[lb] = (A.lab[lb] || 0) + 1;
    const [kind, name] = key.split(':'), t = c.tastes && c.tastes[kind];
    if (t && typeof t[name] === 'number') t[name] = r3(clamp(t[name] + (0.5 + 0.5 * A.v - t[name]) * Math.min(1, Math.max(0.07, 0.22 / (1 + 0.35 * (A.n - 1))) * (opts.weight || 1))));
    voice(w, key, A);
  }
  const ks = Object.keys(c.assoc);
  if (ks.length > MAX_KEYS) ks.sort((a, b) => Math.abs(c.assoc[a].v) * c.assoc[a].n - Math.abs(c.assoc[b].v) * c.assoc[b].n).slice(0, ks.length - MAX_KEYS + 10).forEach(k => delete c.assoc[k]);
  return { v, label: lb };
}

const topLabel = A => Object.entries(A.lab).sort((a, b) => b[1] - a[1])[0][0];
// the cat notices, out loud, when a feeling has settled into a preference (at most about every quarter day)
function voice(w, key, A) {
  const c = w.cat; if (A.n < 3 || w.clock - c.lastTasteSay < w.dayLen * 0.25) return;
  const nm = keyName(key), lb = topLabel(A);
  if (A.v >= 0.4 && A.said !== 'like') {
    A.said = 'like'; c.lastTasteSay = w.clock;
    journal(w, `I think I like ${nm}. Every time it comes up I feel ${lb}.`, 'taste'); note(w, `${c.name} has decided it likes ${nm}.`, 'taste');
  } else if (A.v <= -0.2 && A.said !== 'dislike') {
    A.said = 'dislike'; c.lastTasteSay = w.clock;
    journal(w, `${nm[0].toUpperCase() + nm.slice(1)} does not agree with me. It leaves me feeling ${lb}.`, 'taste'); note(w, `${c.name} has decided it does not like ${nm}.`, 'taste');
  } else if (A.said === 'like' && A.v < 0.15) A.said = '';
  else if (A.said === 'dislike' && A.v > -0.05) A.said = '';
}

// -1..1: how the cat tends to feel about this, trusted more as it has more experience of it
export function affinity(w, key) { const A = w.cat.assoc && w.cat.assoc[key]; return A ? A.v * Math.min(1, A.n / 3) : 0; }

// what makes it feel good, and what does not, for display
export function topFeelings(w, n = 4) {
  const rows = Object.entries(w.cat.assoc || {}).filter(([, A]) => A.n >= 2).map(([key, A]) => ({ key, name: keyName(key), v: A.v, n: A.n, score: A.v * Math.min(1, A.n / 3), label: topLabel(A) }));
  return { good: rows.filter(r => r.score > 0.12).sort((a, b) => b.score - a.score).slice(0, n), bad: rows.filter(r => r.score < -0.1).sort((a, b) => a.score - b.score).slice(0, Math.max(2, n - 1)) };
}
export const feelingSummary = w => { const t = topFeelings(w, 3); return `${t.good.map(r => `${r.name} (${r.label})`).join(', ') || 'nothing yet'}${t.bad.length ? '; uneasy about ' + t.bad.map(r => r.name).join(', ') : ''}`; };
