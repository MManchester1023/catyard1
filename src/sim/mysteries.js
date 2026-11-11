// Things in the yard the cat does not understand. It collects clues, forms a theory, and revises it.
import { pick } from './util.js';
import { note, journal, dayOf } from './world.js';
import { PACE, paceOf, scaled, clueCap, quick } from './pace.js';
import { meetFrog } from './frog.js';
import { quirkWord } from './quirk.js';
import { onEvent } from './wants.js';
import { addToStash } from './quirk.js';

export const MYSTERY_INFO = {
  moon: { name: 'the moon', short: 'moon' },
  ripples: { name: 'the ripples in the pond', short: 'ripples' },
  sparks: { name: 'the dancing sparks', short: 'sparks' },
  tree: { name: 'the old oak', short: 'oak', secret: true }, // only shown once the cat has started wondering about it
  stars: { name: 'the stars', short: 'stars', secret: true }, // likewise: after enough nights spent looking up
};
const blank = () => ({ clues: 0, theory: null, conf: 0, solved: false, revised: 0, phases: [] });
export const makeMysteries = () => ({ moon: blank(), ripples: blank(), sparks: blank(), tree: blank(), stars: blank() });

const THEORIES = {
  moon: q => [`The moon is a giant ${quirkWord(q, false)}.`, 'The moon is a bowl someone forgot to finish.', 'The moon is a hole where the daylight leaks out.', 'The moon is following me on purpose.', 'The moon is the stash of someone much bigger than me.', 'The moon is the sun, resting.'],
  ripples: () => ['Something invisible lives in the pond.', 'The pond is breathing.', 'A fish is practicing to be a bird.', 'Somebody is knocking from underneath.'],
  sparks: () => ['They are tiny stars that fell and got confused.', "They are the pond's thoughts, escaping.", 'They are little lanterns carried by invisible mice.', 'They are bugs that swallowed a lamp.'],
  stars: () => ['The stars are holes in the night, and the light is getting in.', 'The stars are the moon\'s lost sparks, all gathered up.', 'The stars are the eyes of cats who came before.', 'The stars are somebody\'s stash. Somebody very big, and very tidy.', 'The stars are tiny suns, and they are shy.', 'The stars are the night, counting.'],
  tree: () => ['The oak is keeping something in its roots.', 'There is something under the oak that smells like a tiny sun.', 'The oak gives bark because it is hiding something bigger.', 'Someone left a secret in the oak, and the oak has been loyal.'],
};
const TRUTH = { ripples: 'It is a frog. A small green one. Not a ghost.', sparks: 'They are bugs. Bugs that glow. Disappointing and wonderful.', moon: 'The frog sings to the moon, and the moon listens. On a full moon it answers: I may ask it for one thing.', tree: 'A coin. A shiny one, buried between the roots. Somebody lost it. I have decided that I found it.', stars: 'Suns. Very far away, so far that they are small. And now and then a bit of rock burns up on its way past and falls like a star. The humans say that if you see one fall, you may ask it for something.' };

function setTheory(w, id, text, why) {
  const m = w.mysteries[id], name = MYSTERY_INFO[id].name;
  m.theory = text;
  note(w, `${w.cat.name} has a theory about ${name}.`, 'wonder');
  journal(w, `Working theory about ${name}: ${text} ${why || ''}`.trim(), 'theory');
  w.cat.thoughtHint = 'theory:' + id;
  w.asks.push({ type: 'theory', id });
}

// one observation. amt scales how much the cat learned. A day can only teach so much (see pace.js), so extra
// observations after that are worth nothing until tomorrow.
export function clue(w, id, amt = 1, phase = null) {
  const m = w.mysteries[id]; if (m.solved) return;
  const pm = paceOf(w) / quick(w, id), sc = (base, min = 1) => Math.max(min, Math.round(base * pm)); // (a very curious cat is twice as quick on the moon and the oak)
  if (phase != null && !m.phases.includes(phase)) m.phases.push(phase); // the calendar does not care how tired the cat is
  const day = dayOf(w); if (m.capDay !== day) { m.capDay = day; m.today = 0; }
  const room = clueCap(w, id) - (m.today || 0);
  if (room <= 0.001) { if (id === 'moon') moonPhasesCheck(w, id, m); return; }
  amt = Math.min(amt, room); m.today = (m.today || 0) + amt;
  m.clues += amt;
  if (!m.theory && m.clues >= sc(PACE.theoryClues, 2)) { setTheory(w, id, pick(THEORIES[id](w.cat.quirk))); m.conf = 0.3; return; }
  if (!m.theory) { if (id === 'moon') moonPhasesCheck(w, id, m); return; }
  m.conf = Math.min(0.95, m.conf + (PACE.confPerClue / pm) * amt);
  if (id === 'moon') moonPhasesCheck(w, id, m);
  const revise = Math.floor(m.clues / (PACE.reviseEvery * pm));
  if (revise > m.revised && !(id === 'moon' && m.sawPhases)) {
    m.revised = revise;
    if (Math.random() < 0.55) { const old = m.theory; m.conf = 0.35; setTheory(w, id, pick(THEORIES[id](w.cat.quirk).filter(t => t !== old)), 'I was wrong before. New evidence.'); }
  }
  if (id === 'sparks' && m.clues >= sc(PACE.sparksSolve, 4)) return solve(w, id);
  if (id === 'tree' && m.clues >= sc(PACE.treeSolve, 4)) return solve(w, id);
  if (id === 'stars' && m.clues >= sc(PACE.starsSolve, 4)) { // it has watched them long enough; whatever is missing now is in a book
    if (!m.enough) { m.enough = true; m.enoughDay = dayOf(w); journal(w, 'I have watched them for many nights. I know where each one sits. I do not know WHAT they are. I think the slab might.', 'stars'); w.cat.thoughtHint = 'starsEnough'; }
    if (starsFinal(w)) return;
  }
  onEvent(w, 'mystery', { id, conf: m.conf, solved: m.solved });
}

// the moon is understood once enough of its phases have been seen, however many clues that took
function moonPhasesCheck(w, id, m) {
  if (m.sawPhases || !m.theory || m.phases.length < Math.min(8, Math.max(2, Math.round(PACE.moonPhases * paceOf(w) / quick(w, id))))) return;
  m.sawPhases = true; m.conf = Math.max(m.conf, 0.55);
  setTheory(w, id, 'The moon changes. It gets eaten and then refilled. Someone is taking turns.', 'I have seen enough nights to be sure of that part.');
  moonFinal(w);
}

// the last step towards the moon's secret: it has watched the moon through its phases, and now it has to spend time with the
// frog (who sings at the moon). Ten visits, or five for a cat that is very curious.
export const frogVisitsForMoon = w => Math.max(1, Math.round(PACE.frogForMoon / quick(w, 'moon')));
export function moonFinal(w) {
  const m = w.mysteries.moon; if (m.solved || !m.sawPhases || !w.frog || w.frog.visits < frogVisitsForMoon(w)) return false;
  solve(w, 'moon'); return true;
}

// the frog showed itself while the cat was watching the pond. Only one sighting a day counts (see pace.js); once
// there have been enough of them the cat knows what lives there, and the frog becomes its friend.
export function frogSighting(w) {
  const m = w.mysteries.ripples; if (m.solved) return false;
  const day = dayOf(w); if (m.frogDay !== day) { m.frogDay = day; m.frogToday = 0; m.frogGood = Math.random() < PACE.frogDayChance; }
  if (!m.frogGood || m.frogToday >= Math.max(1, Math.round(PACE.frogPerDay / paceOf(w)))) return false;
  m.frogToday++; m.frogSeen = (m.frogSeen || 0) + 1;
  if (m.frogSeen >= scaled(w, PACE.frogSightings, 2)) { solve(w, 'ripples'); return true; }
  return false;
}

// the last step towards the stars: it has watched long enough, and now it needs to have read about them on the tablet (or,
// with no tablet to hand, simply to have lived with it for a few days)
export function starsFinal(w) {
  const m = w.mysteries.stars; if (m.solved || !m.interest || !m.enough) return false;
  if (!(m.read >= 1) && dayOf(w) - (m.enoughDay == null ? dayOf(w) : m.enoughDay) < scaled(w, PACE.starsSelf, 2)) return false;
  solve(w, 'stars'); return true;
}

export function solve(w, id) {
  const m = w.mysteries[id]; if (m.solved) return;
  m.solved = true; m.conf = 1; m.theory = TRUTH[id];
  note(w, `${w.cat.name} solved the mystery of ${MYSTERY_INFO[id].name}.`, 'wonder');
  journal(w, `${MYSTERY_INFO[id].name[0].toUpperCase() + MYSTERY_INFO[id].name.slice(1)}: ${TRUTH[id]}`, 'solved');
  w.cat.thoughtHint = 'solved:' + id; w.cat.mood.joy = Math.min(1, w.cat.mood.joy + 0.6);
  w.asks.push({ type: 'solved', id });
  onEvent(w, 'mystery', { id, conf: 1, solved: true });
  if (id === 'ripples') meetFrog(w);
  if (id === 'moon') { w.moonWishDay = -99; journal(w, 'From now on, when the moon is full, I can ask it for one thing. I have not decided what. I have time.', 'moonwish'); }
  if (id === 'tree') findCoin(w);
  if (id === 'stars') { w.starWishDay = -99; journal(w, 'From now on, on a clear night, a star may fall. If I am looking up when it does, I may ask it for one thing. I will be looking up.', 'starwish'); }
}

// the shiny coin from between the roots: it goes on the stash table, and the cat is very happy for a couple of days
export function findCoin(w) {
  const c = w.cat; if (c.coinDay) return;
  c.coinDay = Math.floor(w.clock / w.dayLen) + 1; c.coinUntil = w.clock + PACE.coinDays * w.dayLen;
  addToStash(w, { type: 'coin', color: 'gold' });
  c.mood.joy = 1; c.needs.lonely = Math.max(0, c.needs.lonely - 0.5); c.needs.fear = 0;
  note(w, `${c.name} dug a shiny coin out from between the roots of the oak and is thrilled.`, 'wonder');
  c.thoughtHint = 'coin';
}

// the pond occasionally ripples; at dusk and night a frog may surface
export function rippleTick(w, dt, hour, night) {
  if (w.ripple) { w.ripple.t += dt; if (w.ripple.t > 5) w.ripple = null; return; }
  w.rippleT -= dt;
  if (w.rippleT <= 0) {
    w.rippleT = (night || hour < 7.5 || hour > 17) ? 60 + Math.random() * 90 : 160 + Math.random() * 200;
    if (w.weather.rain < 0.5) w.rippleAt = w.clock, w.ripple = { t: 0, dx: (Math.random() - 0.5) * 100, dy: (Math.random() - 0.5) * 20, frog: night || Math.random() < 0.4 };
  }
}
