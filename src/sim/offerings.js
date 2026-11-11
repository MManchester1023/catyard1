// Offerings: things the human leaves on the mat by the glass. An object or a short note. The cat notices,
// reacts according to its own tastes, and its tastes drift a little with what it is given.
import { rnd, pick, clamp, uid, an, ITEM_TYPES, ITEM_LABEL, COLOR_NAMES, MATERIALS, MAT_GIFT, matText } from './util.js';
import { note, journal, dayOf, clockStr } from './world.js';
import { stashColors, itemName } from './quirk.js';
import { addWant, hasWant, MAX_WANTS, onEvent } from './wants.js';
import { learnWords } from './thoughts.js';
import { feel } from './feelings.js';
import { upsetBy, soothe } from './upset.js';
import { neededMat, receiveMaterial } from './craft.js';
import { matchWish, grantWish } from './wishes.js';
import { ensureCraft } from './recipes.js';
import { random } from './rng.js';

export const MAX_ON_MAT = 3, NOTE_MAX = 140, HIST_MAX = 20, KEEPSAKES_MAX = 6;
export const slotPos = (w, i) => ({ x: w.o.mat.x + (i - 1) * 22, y: w.o.mat.y });
// where the cat stands to look at something on the mat
export const offerSpot = (w, off) => { const s = slotPos(w, off.slot); return { x: s.x, y: s.y + 15, face: 1 }; };

// ---------- tastes ----------
export function makeTastes(q) {
  const color = {}, type = {};
  for (const c of COLOR_NAMES) color[c] = c === 'black' ? 0.2 : c === 'white' ? 0.25 : 0.3;
  for (const t of ITEM_TYPES) type[t] = 0.3;
  color[q.favColor] = 0.75; type[q.item] = 0.75;
  return { color, type, gifts: {} };
}
export function ensureOfferState(w) {
  const c = w.cat;
  if (!c.tastes) c.tastes = makeTastes(c.quirk);
  if (!c.tastes.gifts) c.tastes.gifts = {};
  if (!c.keepsakes) c.keepsakes = [];
  if (!c.offerHist) c.offerHist = [];
  if (!w.offers) w.offers = [];
  if (!w.stats.offerings) w.stats.offerings = 0;
  ensureCraft(w);
}
export const topTastes = (w, kind, n = 4) => Object.entries(w.cat.tastes[kind]).sort((a, b) => b[1] - a[1]).slice(0, n);

// the favourite colour and the thing it collects can change, but only when something else has clearly won out:
// whatever has made it feel best, over at least several experiences, beats the one it started out liking
export function refreshFavourites(w) {
  const c = w.cat, q = c.quirk, t = c.tastes, as = c.assoc || {};
  const score = (key, need, loyal) => { const A = as[key]; return (A ? A.v * Math.min(1, A.n / need) : 0) + loyal; };
  let best = null, bs = -9;
  for (const col of Object.keys(t.color)) { if (col === 'black' || col === q.favColor) continue; const A = as['color:' + col]; if (!A || A.n < 5) continue; const s = score('color:' + col, 5, 0); if (s > bs) { bs = s; best = col; } }
  if (best && bs > score('color:' + q.favColor, 5, 0.15) + 0.03 && bs > 0.15) {
    const prev = q.favColor; q.favColor = best; t.color[best] = Math.max(t.color[best], t.color[prev] + 0.02);
    note(w, `${c.name}'s favourite colour has quietly changed from ${prev} to ${q.favColor}.`, 'taste');
    journal(w, `I used to think ${prev} was the best colour. Lately it is ${q.favColor}. I cannot say why. (Yes I can. It makes me feel good.)`, 'taste');
  }
  let bt = null; bs = -9;
  for (const ty of Object.keys(t.type)) { if (ty === q.item) continue; const A = as['type:' + ty]; if (!A || A.n < 10 || (t.gifts[ty] || 0) < 5) continue; const s = score('type:' + ty, 10, 0); if (s > bs) { bs = s; bt = ty; } }
  if (bt && bs > score('type:' + q.item, 10, 0.1) + 0.03 && bs > 0.12) {
    const prev = q.item; q.item = bt; t.type[bt] = Math.max(t.type[bt], t.type[prev] + 0.02);
    note(w, `${c.name} has started collecting ${ITEM_LABEL[q.item]}s instead of ${ITEM_LABEL[prev]}s.`, 'taste');
    journal(w, `I think I was wrong about ${ITEM_LABEL[prev]}s. ${ITEM_LABEL[q.item][0].toUpperCase() + ITEM_LABEL[q.item].slice(1)}s are what I am meant to collect.`, 'taste');
  }
}
// everything the cat is exposed to nudges its tastes a little
export function exposeTo(w, type, color, amount = 0.03) {
  const t = w.cat.tastes; if (!t) return;
  if (color && t.color[color] != null) t.color[color] = clamp(t.color[color] + amount);
  if (type && t.type[type] != null) t.type[type] = clamp(t.type[type] + amount * 0.7);
}

// ---------- leaving something ----------
const clean = s => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
export const offerLabel = off => (off.kind === 'note' ? `a note: "${off.text.length > 40 ? off.text.slice(0, 37) + '...' : off.text}"` : off.kind === 'material' ? matText(off.type, off.n) : an(itemName(off.type, off.color)));

export function leaveOffering(w, spec) {
  ensureOfferState(w);
  if (w.offers.length >= MAX_ON_MAT) return { ok: false, error: `The mat is full (${MAX_ON_MAT}). Wait for ${w.cat.name} to take something.` };
  const used = new Set(w.offers.map(o => o.slot)); let slot = 0; while (used.has(slot)) slot++;
  const off = { id: uid(), slot, day: dayOf(w), at: w.clock, state: 'new' };
  if (spec.kind === 'note') {
    const text = clean(spec.text).slice(0, NOTE_MAX); if (!text) return { ok: false, error: 'A note needs some words.' };
    Object.assign(off, { kind: 'note', text });
  } else if (spec.kind === 'material') {
    if (!MATERIALS.includes(spec.type)) return { ok: false, error: `Materials: ${MATERIALS.join(', ')}.` };
    Object.assign(off, { kind: 'material', type: spec.type, n: MAT_GIFT[spec.type] });
  } else {
    const type = spec.type || pick(ITEM_TYPES); if (!ITEM_TYPES.includes(type)) return { ok: false, error: `Types: ${ITEM_TYPES.join(', ')}.` };
    const color = spec.color || pick(COLOR_NAMES.filter(c => c !== 'black')); if (!COLOR_NAMES.includes(color)) return { ok: false, error: `Colors: ${COLOR_NAMES.join(', ')}.` };
    Object.assign(off, { kind: 'item', type, color });
  }
  w.offers.push(off); w.stats.offerings++;
  note(w, `Someone left ${offerLabel(off)} on the mat.`, 'offer');
  return { ok: true, offer: off };
}

// the next thing the cat has not looked at yet (it waits a few seconds before noticing)
export const pendingOffer = w => (w.offers || []).find(o => o.state === 'new' && w.clock - o.at >= 4) || null;
export const clearOffers = w => { const n = w.offers.length; w.offers = []; return n; };

// ---------- reacting ----------
const POS = /\b(love|loved|lovely|good|great|best|miss|missed|happy|friend|proud|beautiful|pretty|thank|thanks|kind|sweet|gentle|nice|wonderful|cute|hug|safe|home)\b/gi;
const NEG = /\b(hate|bad|stupid|ugly|angry|mean|never|worst|dumb|terrible|go away|scary|awful)\b/gi;
const SKIP = new Set('about after again always because before being could every first great maybe might never other should still their there these thing think those through today together would where which while will with'.split(' '));

function tier(l) { return l >= 0.7 ? 'delight' : l >= 0.5 ? 'pleased' : l >= 0.35 ? 'curious' : 'meh'; }
const ITEM_REACT = {
  delight: ['{Aitem}! A {color} one! You knew.', '{Aitem}. For me. I will remember this.', 'This is exactly right. How did you know?'],
  pleased: ['{Aitem}. Yes. I will take it.', 'Hm! {Aitem}. Good.', 'A {color} {item}. Thank you, I think.'],
  curious: ['{Aitem}... not my usual kind. But I am curious.', 'Not what I would have picked. I will look after it anyway.', 'I did not know I wanted {aitem}. Now I wonder.'],
  meh: ['{Aitem}. It is fine. Not for me.', 'I will leave this here. Politely.', 'Is this a test? I am leaving it.'],
};
ITEM_REACT.wished = ['{Aitem}! I asked and it came. The tablet works both ways.', '{Aitem}. You read my note. I will not forget this.', 'You brought {aitem}. I did not think anyone would.'];
const MAT_REACT = {
  wished: ['{what}! Exactly what I wrote the note about.', 'You read the tablet. {what}. Now I can finish it.'],
  needed: ['{what}. I was just short of this.', '{what}! This is what the project was missing.'],
  other: ['{what}. I will find a use for it.', 'Raw materials. Something will come of this.'],
};
const NOTE_REACT = {
  pos: ['"{quote}"... It says nice things. I am keeping it.', 'Someone wrote words for me. I did not know that could happen.', 'I will keep this. Do not look at the stash for it.'],
  neutral: ['I read it twice. "{quote}" I do not understand all of it. I like that.', 'A note. Paper has a good smell.', '"{quote}". I will think about this.'],
  neg: ['That felt sharp. But it is still paper. I will keep it anyway.', 'Hm. Some words are heavier than they look.'],
};
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] || '');

function likingOf(w, off) {
  const c = w.cat, t = c.tastes, n = c.needs;
  if (off.kind === 'note') {
    const pos = (off.text.match(POS) || []).length, neg = (off.text.match(NEG) || []).length;
    return clamp(0.48 + 0.17 * pos - 0.25 * neg + c.bond * 0.1 + rnd(-0.04, 0.04));
  }
  // how it takes a gift depends on the moment as much as the gift: a lonely cat is easy to please, a hungry one is not
  const mood = (n.lonely - 0.4) * 0.2 - Math.max(0, n.hunger - 0.65) * 0.25 + (c.mood.joy - 0.45) * 0.15;
  if (off.kind === 'material') return clamp((neededMat(w, off.type) ? 0.85 : 0.5) + mood + c.bond * 0.05 + rnd(-0.05, 0.05));
  const novel = !stashColors(w)[off.color];
  return clamp(0.12 + 0.42 * t.color[off.color] + 0.34 * t.type[off.type] + (novel ? 0.1 : 0) + c.bond * 0.1 + mood + rnd(-0.08, 0.08));
}

// the cat looks at it for the first time. returns the reaction and applies its effects
export function inspectOffer(w, off) {
  ensureOfferState(w);
  const c = w.cat, wish = off.kind === 'note' ? null : matchWish(w, off);
  let l = likingOf(w, off); if (wish) l = Math.max(l, 0.92);
  const tr = tier(l);
  let text, keep, keys = ['act:offering'];
  if (off.kind === 'note') {
    const mood = l >= 0.6 ? 'pos' : l < 0.35 ? 'neg' : 'neutral', words = off.text.split(' ').slice(0, 6).join(' ');
    text = fill(pick(NOTE_REACT[mood]), { quote: words + (off.text.split(' ').length > 6 ? '...' : '') }); keep = true;
    learnWords(w, off.text);
  } else if (off.kind === 'material') {
    const lab = matText(off.type, off.n); keep = true; keys.push('mat:' + off.type);
    text = fill(pick(wish ? MAT_REACT.wished : l >= 0.7 ? MAT_REACT.needed : MAT_REACT.other), { what: lab, type: off.type });
  } else {
    const nm = itemName(off.type, off.color), A = an(nm);
    text = wish ? fill(pick(ITEM_REACT.wished), { Aitem: A[0].toUpperCase() + A.slice(1), aitem: A }) : fill(pick(ITEM_REACT[tr]), { Aitem: A[0].toUpperCase() + A.slice(1), aitem: A, color: off.color, item: ITEM_LABEL[off.type] });
    keep = l >= 0.4 || (l >= 0.3 && random() < 0.5);
    keys.push('color:' + off.color, 'type:' + off.type);
    c.tastes.gifts[off.type] = (c.tastes.gifts[off.type] || 0) + 1;
  }
  // what this does to the cat is what teaches it what it likes (see feelings.js)
  const f = feel(w, keys, { joy: (l - 0.38) * 0.7 + (wish ? 0.2 : 0), lonely: -0.25 * l - (wish ? 0.15 : 0), fun: -0.1 * l }, wish ? 'warm' : null);
  c.bond = clamp(c.bond + 0.01 + 0.03 * l);
  if (off.kind === 'item') refreshFavourites(w);
  if (wish) grantWish(w, wish);
  if (off.kind === 'note' && l < 0.3) upsetBy(w, 'words', `A note on the mat said "${off.text.slice(0, 50)}". It was not a kind note. I read it twice, to be sure.`, { level: 0.4, days: 0.25, cool: 0.4, bond: 0.02, note: 'it did not like that note.', hint: 'words' });
  else if (l >= 0.55) soothe(w, 0.6 + 0.4 * l, 'someone left me something');
  off.state = 'seen'; off.keep = keep;
  c.thought = text; c.thoughtId++; c.thoughtAt = w.clock;
  const entry = off.kind === 'note' ? `A note on the mat: "${off.text}" ${text}` : `Someone left ${offerLabel(off)} on the mat. ${text}`;
  journal(w, entry, 'offering'); off.jid = w.journal[0].id;
  c.offerHist.unshift({ id: off.id, jid: off.jid, day: dayOf(w), time: clockStr(w), kind: off.kind, src: off.kind === 'note' ? off.text : '', label: offerLabel(off), liking: Math.round(l * 100) / 100, tier: tr, felt: f.label, wished: !!wish, text }); if (c.offerHist.length > HIST_MAX) c.offerHist.pop();
  if (w.asks) w.asks.push({ type: 'offer', id: off.id });
  onEvent(w, 'offering', { off });
  return { liking: l, tier: tr, text, keep, felt: f.label };
}

// the cat is done looking. true if it wants to carry the object to its stash
export function finishOffer(w, off) {
  const c = w.cat;
  if (off.kind === 'note') {
    w.offers = w.offers.filter(x => x !== off);
    c.keepsakes.unshift({ id: off.id, text: off.text, day: dayOf(w) }); if (c.keepsakes.length > KEEPSAKES_MAX) c.keepsakes.pop();
    note(w, `${c.name} read the note and tucked it away.`, 'offer');
    wonderAbout(w, off.text);
    return false;
  }
  if (off.kind === 'material') { w.offers = w.offers.filter(x => x !== off); receiveMaterial(w, off.type, off.n); note(w, `${c.name} took ${matText(off.type, off.n)} from the mat.`, 'offer'); return false; }
  if (off.keep) { w.offers = w.offers.filter(x => x !== off); w.stats.found++; note(w, `${c.name} took the ${itemName(off.type, off.color)} from the mat.`, 'offer'); return true; }
  off.state = 'left'; off.leftAt = w.clock; note(w, `${c.name} sniffed the ${itemName(off.type, off.color)} and left it on the mat.`, 'offer');
  return false;
}

// a word in a note the cat does not know becomes something to find out
export function wonderAbout(w, text) {
  const c = w.cat; if (c.wants.length >= MAX_WANTS || hasWant(w, 'lookup')) return null;
  const words = (text.toLowerCase().match(/[a-z]{6,16}/g) || []).filter(x => !SKIP.has(x) && !(c.words[x] >= 3));
  if (!words.length || random() > 0.75) return null;
  const word = words.sort((a, b) => b.length - a.length)[0];
  return addWant(w, { kind: 'lookup', key: word, word, strength: rnd(0.6, 0.9) });
}

// housekeeping: things the cat turned down are cleared away after a while
export function offerTick(w) {
  if (!w.offers || !w.offers.length) return;
  for (const o of w.offers) if (o.state === 'seen' && w.clock - o.at > w.dayLen * 0.5) { o.state = 'left'; o.leftAt = w.clock; }
  for (const o of [...w.offers]) if (o.state === 'left' && w.clock - o.leftAt > w.dayLen * 0.6) { w.offers = w.offers.filter(x => x !== o); note(w, 'Someone tidied the declined offering off the mat.', 'offer'); }
}
