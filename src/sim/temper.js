// Quirks: what the cat is like. Each cat has exactly one (Collector is one of them: see quirk.js for what it keeps).
// The effects themselves live where the behaviour is (mind.js for choices, acts.js, sim.js); this file names them
// and answers the few questions the rest of the code keeps asking.
import { pick } from './util.js';

export const TEMPERS = {
  collector: { name: 'Collector', line: 'Covets one kind of small thing, goes out of its way to fetch it, hides the collection (or lays it out on a table) and fusses over it. Other cats keep a gift they love, but only a Collector hoards.' },
  vangogh: { name: 'Van Gogh', line: 'Obsessed with painting. The urge to create builds faster, it paints more than twice as often as other cats (even when tired or hungry), stays longer at each canvas, learns the craft about twice as fast, and is never quite finished.' },
  hunter: { name: 'Hunter', line: 'Hunts whenever it can. It notices mice and birds from far off, stalks them whether or not it is hungry, tries again almost at once, and is a better bet for the lucky bird.' },
  nightowl: { name: 'Night owl', line: 'Stays up late. Its day runs about three hours behind: lively well into the night, asleep through the early morning.' },
  techie: { name: 'Techie', line: 'Goes to the tablet first. Whenever it cannot work something out (a recipe, a mystery, a word) it looks it up before it tries anything else.' },
  garfield: { name: 'Garfield', line: 'Loves to eat and to lie around. Hungry sooner, eats at the first excuse, naps in the sun and on the cushion, and would much rather do that than paint, play or explore.' },
  builder: { name: 'Bob the Builder', line: 'Focused on making things. It gathers more from the oak each day, always has a project, builds faster, and would rather craft than just about anything.' },
};
export const TEMPER_IDS = Object.keys(TEMPERS);

// globalThis.__catTemper is a test hook: set it to an id (or null for none) to make every new cat that temperament
export function makeTemper() { const f = globalThis.__catTemper; return f !== undefined ? f : pick(TEMPER_IDS); }
export const temperOf = c => TEMPERS[c.temper] || null;
export const temperName = c => (TEMPERS[c.temper] ? TEMPERS[c.temper].name : 'none');
export const isCollector = c => c.temper === 'collector';

export const OWL_SHIFT = 3; // hours later than other cats the night owl's day runs
export const shiftOf = c => (c.temper === 'nightowl' ? OWL_SHIFT : 0);
// the stretch of the night when this cat sleeps hard (11pm to 4:36am for most cats, 2am to 7:36am for the owl)
export function deepNightOf(c, h) { const hs = (h - shiftOf(c) + 24) % 24; return hs >= 23 || hs < 4.6; }

// the lucky pounce on a bird: every cat has the same chance each time it stalks one, a skilled cat a better one. A Hunter
// stalks about four times as many birds, so it catches about one every two days and an ordinary cat one every five
export const birdChance = c => 0.05 + c.skill * 0.05;
