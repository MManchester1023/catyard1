// The frog in the pond. When the cat finally finds out what has been rippling the water, the frog becomes its friend.
// The frog comes up now and then; when the cat is lonely and the frog is out, it goes to sit with it, and that
// helps a great deal more than anything else the cat can do about loneliness.
import { rnd, pick, clamp } from './util.js';
import { note, journal } from './world.js';
import { feel } from './feelings.js';
import { moonFinal } from './mysteries.js';

export const FROG_NAMES = ['Pip', 'Moss', 'Bram', 'Clover', 'Sprout', 'Mr. Ribbit', 'Bean', 'Lily', 'Newton'];

// where the frog sits (on a lily pad at the near edge of the water) and where the cat sits to see it
export function frogSpot(w) { const p = w.o.pond; return { fx: p.x + 44, fy: p.y + p.ry - 8, cx: p.x + 26, cy: p.y + p.ry + 14 }; }
export const frogName = w => (w.frog ? w.frog.name : 'the frog');
// how much a visit takes off the loneliness: a lot, and a little more as they get to know each other
export const frogDrop = f => 0.55 + 0.25 * f.bond;

export function meetFrog(w, late = false) {
  if (w.frog) return w.frog;
  const c = w.cat, name = pick(FROG_NAMES.filter(n => n !== c.name));
  w.frog = { name, day: Math.floor(w.clock / w.dayLen) + 1, out: true, timer: rnd(0.06, 0.1) * w.dayLen, visits: 0, bond: 0.1, lastVisit: w.clock, hop: 1, t: 0 };
  c.needs.lonely = 0; c.mood.joy = clamp(c.mood.joy + 0.3); // the first meeting takes all of it away
  note(w, late ? `${c.name} knows the frog in the pond. Its name is ${name}.` : `${c.name} made friends with a frog from the pond. Its name is ${name}.`, 'friend');
  journal(w, late ? `I have been to the pond. The frog is real and I know it now. I have named the frog ${name}. ${name} has not objected.` : `Not a ghost. A frog. I have named the frog ${name}. ${name} has not objected. I think we are friends.`, 'frog');
  feel(w, ['act:frog', 'topic:frog'], { joy: 0.1 }, 'warm');
  c.thoughtHint = 'meetFrog:x';
  return w.frog;
}

// the frog surfaces for a while, then goes back under. It comes up sooner in rain, and sooner when the cat is lonely.
export function frogTick(w, dt) {
  const f = w.frog; if (!f) return;
  f.t += dt; f.hop = Math.max(0, f.hop - dt * 1.6);
  if (w.cat.act && w.cat.act.type === 'frog') { if (f.out) f.timer = Math.max(f.timer, 4); return; } // it waits for a visit
  const rain = w.weather.rain > 0.3;
  f.timer -= dt * (f.out ? (rain ? 0.6 : 1) : (rain ? 1.5 : 1) * (w.cat.needs.lonely > 0.55 ? 2 : 1));
  if (f.timer > 0) return;
  if (f.out) { f.out = false; f.timer = rnd(0.12, 0.28) * w.dayLen; }
  else { f.out = true; f.timer = rnd(0.05, 0.09) * w.dayLen; f.hop = 1; }
}

// the visit is over
export function frogVisited(w) {
  const f = w.frog, c = w.cat; if (!f) return;
  f.visits++; f.bond = clamp(f.bond + 0.08); f.lastVisit = w.clock; f.out = false; f.timer = rnd(0.15, 0.3) * w.dayLen;
  w.stats.frogVisits = (w.stats.frogVisits || 0) + 1;
  feel(w, ['act:frog', 'topic:frog'], { joy: 0.15, lonely: -0.05 }, 'warm');
  note(w, `${c.name} sat with ${f.name} the frog for a while.`, 'friend');
  if (f.visits === 1) journal(w, `I sat with ${f.name} by the pond. We said nothing. It was the best conversation I have had all week.`, 'frog');
  moonFinal(w); // (the last step towards the moon's secret is time spent with the frog)
}
