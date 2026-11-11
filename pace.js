// How quickly the cat works things out. Every "how long does this take" number lives here, and all of them are
// scaled by w.pace: 1 is the default, 2 is twice as slow, 0.5 is twice as fast (admin: `pace 2`).
//
// Besides needing more clues, each mystery can only teach so much in one day. The cat can keep chasing the sparks
// all night, but it only learns a handful of things from it; the rest has to wait for tomorrow. That is what makes
// the big discoveries take days instead of minutes, however busy the cat is.
import { dayOf } from './world.js';

export const PACE = {
  theoryClues: 8,                                  // clues before the first theory (was 3)
  confPerClue: 0.004,                              // confidence a clue adds once it has a theory (was 0.012)
  reviseEvery: 14,                                 // clues between "maybe I was wrong" moments (was 6)
  sparksSolve: 48,                                 // clues to work out the dancing sparks (was 22)
  frogSightings: 5,                                // days it must see the frog surface before it finds it (was 3 sightings, one night)
  moonPhases: 6,                                   // different moon phases it must have seen (was 4; there are 8)
  perDay: { moon: 4, ripples: 3, sparks: 6, tree: 3, stars: 3 }, // the most clues one day can give
  treeSolve: 12,                                   // clues about the old oak before it finds what is in the roots
  starsNights: 4,                                  // nights it must have spent gazing at the sky before it can get curious about the stars
  starsUrge: 0.1,                                  // chance, each sixth of a day, that a cat that has watched enough nights starts wondering about the stars
  starsSolve: 12,                                  // clues about the stars before it has watched enough (it then needs the tablet, or time)
  starsSelf: 6,                                    // days it takes to understand them without the tablet, once it has watched enough
  meteorNight: 0.55,                               // chance that a clear night has a shooting star in it (more, if the cat is out gazing)
  starWishGap: 5,                                  // days between wishes from falling stars
  frogForMoon: 10,                                 // visits with the frog: the last step towards the moon's secret
  treeUrge: 0.06,                                  // chance, each sixth of a day, that a very curious cat starts wondering about the oak
  peekChance: 0.0035,                              // chance, each sixth of a day, that it wonders what is behind the cabin (about 2% a day)
  coinDays: 2,                                     // how long the shiny coin keeps it delighted
  frogPerDay: 1,                                   // frog sightings that count in one day
  frogDayChance: 0.65,                             // chance that a given day is one the frog shows itself properly
  barkPerDay: 2,                                   // bits of bark or twig the oak gives it in a day, however long it scratches (was unlimited)
  discoverRadius: 100,                             // how close it has to get to a part of the yard to notice it (was 190)
  placesPerDay: 3,                                 // parts of the yard it can take in on one day, however much it wanders (was: all of them in the first half day)
  barkLuck: 0.5,                                   // multiplies the chance that scratching the oak gives something
  selfTaughtDays: 4,                               // days before it works a recipe out alone when the tablet is off (was 2)
};

export const MIN_PACE = 0.25, MAX_PACE = 4;
export const paceOf = w => (w && Number.isFinite(w.pace) && w.pace > 0 ? w.pace : 1);
export const scaled = (w, base, min = 1) => Math.max(min, Math.round(base * paceOf(w)));
// a very curious cat (over 90) works out the moon's secret, the oak's and the stars' twice as fast
export const quick = (w, id) => ((id === 'moon' || id === 'tree' || id === 'stars') && w && w.cat && w.cat.traits.curious > 0.9 ? 2 : 1);
export const clueCap = (w, id) => Math.max(0.5, PACE.perDay[id] * quick(w, id) / paceOf(w));
export const barkLuck = w => Math.min(1, PACE.barkLuck / paceOf(w));
export const discoverRadius = w => Math.max(60, Math.min(190, PACE.discoverRadius / Math.sqrt(paceOf(w))));
export const placeCap = w => Math.max(1, Math.round(PACE.placesPerDay / paceOf(w)));
export const gatherCap = w => Math.max(1, Math.round((PACE.barkPerDay + (w.cat && w.cat.temper === 'builder' ? 2 : 0)) / paceOf(w))); // Bob the Builder gets two more pieces a day
// has the oak anything left to give today?
export const gatherRoom = w => { const c = w.cat; return (c.gDay === dayOf(w) ? c.gToday || 0 : 0) < gatherCap(w); };

export const cluesToday = (w, id) => { const m = w.mysteries[id]; return m && m.capDay === dayOf(w) ? m.today || 0 : 0; };
// is there still something today can teach it about this? (the cat stops chasing a mystery once it has nothing left to give)
export const clueRoom = (w, id) => cluesToday(w, id) < clueCap(w, id) - 1e-9;
export const frogRoom = w => { const m = w.mysteries.ripples; return !(m.frogDay === dayOf(w) && (m.frogToday || 0) >= Math.max(1, Math.round(PACE.frogPerDay / paceOf(w)))); };
