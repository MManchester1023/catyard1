// Things in the yard the cat does not understand. It collects clues, forms a theory, and revises it.
import { pick } from './util.js';
import { note, journal, dayOf } from './world.js';
import { PACE, paceOf, scaled, clueCap } from './pace.js';
import { meetFrog } from './frog.js';
import { quirkWord } from './quirk.js';
import { onEvent } from './wants.js';

export const MYSTERY_INFO = {
  moon: { name: 'the moon', short: 'moon' },
  ripples: { name: 'the ripples in the pond', short: 'ripples' },
  sparks: { name: 'the dancing sparks', short: 'sparks' },
};
const blank = () => ({ clues: 0, theory: null, conf: 0, solved: false, revised: 0, phases: [] });
export const makeMysteries = () => ({ moon: blank(), ripples: blank(), sparks: blank() });

const THEORIES = {
  moon: q => [`The moon is a giant ${quirkWord(q, false)}.`, 'The moon is a bowl someone forgot to finish.', 'The moon is a hole where the daylight leaks out.', 'The moon is following me on purpose.', 'The moon is the stash of someone much bigger than me.', 'The moon is the sun, resting.'],
  ripples: () => ['Something invisible lives in the pond.', 'The pond is breathing.', 'A fish is practicing to be a bird.', 'Somebody is knocking from underneath.'],
  sparks: () => ['They are tiny stars that fell and got confused.', "They are the pond's thoughts, escaping.", 'They are little lanterns carried by invisible mice.', 'They are bugs that swallowed a lamp.'],
};
const TRUTH = { ripples: 'It is a frog. A small green one. Not a ghost.', sparks: 'They are bugs. Bugs that glow. Disappointing and wonderful.' };

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
  if (phase != null && !m.phases.includes(phase)) m.phases.push(phase); // the calendar does not care how tired the cat is
  const day = dayOf(w); if (m.capDay !== day) { m.capDay = day; m.today = 0; }
  const room = clueCap(w, id) - (m.today || 0);
  if (room <= 0.001) { if (id === 'moon') moonPhasesCheck(w, id, m); return; }
  amt = Math.min(amt, room); m.today = (m.today || 0) + amt;
  m.clues += amt;
  if (!m.theory && m.clues >= scaled(w, PACE.theoryClues, 2)) { setTheory(w, id, pick(THEORIES[id](w.cat.quirk))); m.conf = 0.3; return; }
  if (!m.theory) { if (id === 'moon') moonPhasesCheck(w, id, m); return; }
  m.conf = Math.min(0.95, m.conf + (PACE.confPerClue / paceOf(w)) * amt);
  if (id === 'moon') moonPhasesCheck(w, id, m);
  const revise = Math.floor(m.clues / (PACE.reviseEvery * paceOf(w)));
  if (revise > m.revised && !(id === 'moon' && m.sawPhases)) {
    m.revised = revise;
    if (Math.random() < 0.55) { const old = m.theory; m.conf = 0.35; setTheory(w, id, pick(THEORIES[id](w.cat.quirk).filter(t => t !== old)), 'I was wrong before. New evidence.'); }
  }
  if (id === 'sparks' && m.clues >= scaled(w, PACE.sparksSolve, 4)) return solve(w, id);
  onEvent(w, 'mystery', { id, conf: m.conf, solved: m.solved });
}

// the moon is understood once enough of its phases have been seen, however many clues that took
function moonPhasesCheck(w, id, m) {
  if (m.sawPhases || !m.theory || m.phases.length < Math.min(8, scaled(w, PACE.moonPhases, 2))) return;
  m.sawPhases = true; m.conf = Math.max(m.conf, 0.55);
  setTheory(w, id, 'The moon changes. It gets eaten and then refilled. Someone is taking turns.', 'I have seen enough nights to be sure of that part.');
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

export function solve(w, id) {
  const m = w.mysteries[id]; if (m.solved) return;
  m.solved = true; m.conf = 1; m.theory = TRUTH[id];
  note(w, `${w.cat.name} solved the mystery of ${MYSTERY_INFO[id].name}.`, 'wonder');
  journal(w, `${MYSTERY_INFO[id].name[0].toUpperCase() + MYSTERY_INFO[id].name.slice(1)}: ${TRUTH[id]}`, 'solved');
  w.cat.thoughtHint = 'solved:' + id; w.cat.mood.joy = Math.min(1, w.cat.mood.joy + 0.6);
  w.asks.push({ type: 'solved', id });
  onEvent(w, 'mystery', { id, conf: 1, solved: true });
  if (id === 'ripples') meetFrog(w);
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
