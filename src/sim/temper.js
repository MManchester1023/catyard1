// Temperament quirks: what the cat is like, as opposed to what it collects (see quirk.js). Each cat has one.
// The effects themselves live where the behaviour is (mind.js for choices, acts.js, sim.js); this file names them
// and answers the few questions the rest of the code keeps asking.
import { pick } from './util.js';

export const TEMPERS = {
  vangogh: { name: 'Van Gogh', line: 'Obsessed with painting. The urge to create builds faster, it paints more than twice as often as other cats (even when tired or hungry), stays longer at each canvas, and is never quite finished.' },
  hunter: { name: 'Hunter', line: 'Hunts whenever it can. It notices mice and birds from far off, stalks them whether or not it is hungry, tries again almost at once, and so gets far more chances at the rare lucky bird.' },
  nightowl: { name: 'Night owl', line: 'Stays up late. Its day runs about three hours behind: lively well into the night, asleep through the early morning.' },
};
export const TEMPER_IDS = Object.keys(TEMPERS);

// globalThis.__catTemper is a test hook: set it to an id (or null for none) to make every new cat that temperament
export function makeTemper() { const f = globalThis.__catTemper; return f !== undefined ? f : pick(TEMPER_IDS); }
export const temperOf = c => TEMPERS[c.temper] || null;
export const temperName = c => (TEMPERS[c.temper] ? TEMPERS[c.temper].name : 'none');

export const OWL_SHIFT = 3; // hours later than other cats the night owl's day runs
export const shiftOf = c => (c.temper === 'nightowl' ? OWL_SHIFT : 0);
// the stretch of the night when this cat sleeps hard (11pm to 4:36am for most cats, 2am to 7:36am for the owl)
export function deepNightOf(c, h) { const hs = (h - shiftOf(c) + 24) % 24; return hs >= 23 || hs < 4.6; }

// the rare lucky pounce on a bird
// (the same for every cat: a Hunter catches more birds only because it stalks about three times as many)
export const birdChance = c => 0.02 + c.skill * 0.02;
