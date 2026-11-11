// Upset. Some things the cat does not take well: a note nobody answers, an empty bowl, a stolen treasure, a bad
// run of misses, unkind words, being alone for too long. An upset lasts a while (its mood sinks, it sulks, it
// will not sit at the glass) and is eased by kindness. It is written up in the journal and remembered.
import { clamp } from './util.js';
import { note, journal } from './world.js';
import { feel } from './feelings.js';

export const isUpset = w => !!(w.cat.upset && w.cat.upset.until > w.clock);
export const upsetLevel = w => (isUpset(w) ? w.cat.upset.level : 0);

// o: { level 0..1, days (how long it lasts), cool (days before the same thing can upset it again), bond, keys, note, lonely, hint }
export function upsetBy(w, why, text, o = {}) {
  const c = w.cat, level = o.level == null ? 0.5 : o.level, days = o.days == null ? 0.35 : o.days;
  if (c.coinUntil && c.coinUntil > w.clock) return false; // nothing can upset a cat with a shiny coin
  if (!c.upAt) c.upAt = {};
  if (c.upAt[why] != null && w.clock - c.upAt[why] < w.dayLen * (o.cool == null ? 0.6 : o.cool)) return false;
  c.upAt[why] = w.clock;
  const until = w.clock + days * w.dayLen, was = isUpset(w) ? c.upset : null;
  c.upset = { why, level: was ? Math.max(level, was.level) : level, until: was ? Math.max(until, was.until) : until, since: was ? was.since : w.clock };
  feel(w, o.keys || [], { joy: -0.22 * level, lonely: o.lonely || 0 }, 'let down');
  c.bond = clamp(c.bond - (o.bond == null ? 0.02 : o.bond));
  journal(w, text, 'upset');
  note(w, `${c.name} is upset${o.note ? ': ' + o.note : '.'}`, 'mood');
  w.stats.upsets = (w.stats.upsets || 0) + 1;
  c.thoughtHint = 'upset:' + (o.hint || why);
  return true;
}

// kindness: a gift it likes, a granted wish, kind words. returns true if it helped
export function soothe(w, amount = 1, why = '') {
  const c = w.cat; if (!isUpset(w)) return false;
  const left = (c.upset.until - w.clock) * (1 - clamp(amount, 0, 1));
  if (left < w.dayLen * 0.03) { c.upset.until = w.clock; journal(w, `I was upset${why ? ' and ' + why : ''}. That helped. I am not upset any more. I will not say it helped.`, 'upset'); note(w, `${c.name} is not upset any more.`, 'mood'); }
  else c.upset.until = w.clock + left;
  return true;
}

// things that build up over time rather than happen at once: called every simulated second or so
export function upsetTick(w, dt) {
  const c = w.cat, n = c.needs, o = w.o;
  c.starveT = o.bowl.food < 0.02 && n.hunger > 0.86 ? (c.starveT || 0) + dt : 0;
  if (c.starveT > 45) { c.starveT = 0; upsetBy(w, 'hungry', 'The bowl has been empty for so long that I have started to take it personally.', { level: 0.55, days: 0.3, bond: 0.03, note: 'the bowl has been empty a long time.', hint: 'hungry' }); }
  c.aloneT = n.lonely > 0.93 ? (c.aloneT || 0) + dt : 0;
  if (c.aloneT > 120) { c.aloneT = 0; upsetBy(w, 'alone', 'It has been a long time since anyone looked at me. I am fine. I am sitting very far from the glass, on purpose.', { level: 0.5, days: 0.4, cool: 1, bond: 0.03, note: 'it has been alone too long.', hint: 'alone' }); }
}

export function missedHunt(w) {
  const c = w.cat; c.missStreak = (c.missStreak || 0) + 1;
  if (c.missStreak >= 3) { c.missStreak = 0; upsetBy(w, 'misses', 'Three misses. Three. Everything in this yard moves exactly one step ahead of me, and I am starting to think it is on purpose.', { level: 0.3, days: 0.15, cool: 0.8, bond: 0, note: 'too many misses in a row.', hint: 'misses' }); }
}
export const caughtSomething = w => { w.cat.missStreak = 0; };
