// The simulation's dice. Everything random in src/sim goes through random() here, never Math.random, and the
// generator's state lives in the world (w.rng) and is saved with it. So:
//   - two worlds made with the same seed, stepped the same way, with the same things done to them, play out exactly
//     the same (tests rely on this);
//   - loading the same save always plays out the same way from there.
// What is not covered: the tablet and Claude, whose answers arrive over the network when they arrive, and whatever
// you do yourself (chat, gifts, commands). The network layer (web.js) keeps Math.random for that reason.
//
// The generator is sfc32 (small, fast, good enough for a game), seeded through splitmix32.

let cur = null;      // the generator in use: the world being simulated (see useRng)
let override = null; // tests can load the dice (see withRandom / setRandom)
let seedBase = null, seedCount = 0;

function splitmix32(a) {
  return () => { a = (a + 0x9e3779b9) | 0; let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad); t ^= t >>> 15; t = Math.imul(t, 0x735a2d97); t ^= t >>> 15; return t >>> 0; };
}
function next(r) {
  const s = r.s; let a = s[0] | 0, b = s[1] | 0, c = s[2] | 0, d = s[3] | 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
  s[0] = a; s[1] = b; s[2] = c; s[3] = d;
  return (t >>> 0) / 4294967296;
}

// a new generator from a 32-bit seed
export function makeRng(seed) {
  seed = seed >>> 0; const sm = splitmix32(seed), r = { seed, s: [sm(), sm(), sm(), sm()] };
  for (let i = 0; i < 12; i++) next(r); // (stir it a little first)
  return r;
}
// a saved generator, checked; null if it is missing or damaged
export function restoreRng(saved) {
  if (!saved || !Array.isArray(saved.s) || saved.s.length !== 4 || !saved.s.every(Number.isFinite) || saved.s.every(v => v === 0)) return null;
  return { seed: saved.seed >>> 0, s: saved.s.map(v => v | 0) };
}
// make this generator the one random() draws from (sim.js does this for the world it is stepping)
export function useRng(r) { cur = r; }

// a number in [0, 1), like Math.random
export function random() {
  if (override) return override();
  if (!cur) cur = makeRng(freshSeed());
  return next(cur);
}

// the seed for a new world: from the counter tests set up, otherwise anything at all
export const freshSeed = () => (Math.random() * 4294967296) >>> 0;
export const nextSeed = () => (seedBase == null ? freshSeed() : (seedBase + seedCount++) >>> 0);
// tests call this once at the top: every world they make then gets a fixed seed (base, base+1, ...), so a test gives
// the same result every run. CAT_SEED=7 npm test tries a different set of seeds.
export function seedTests(base = 1) {
  const env = typeof process !== 'undefined' && process.env && process.env.CAT_SEED;
  seedBase = (env && Number.isFinite(+env) ? +env : base) >>> 0; seedCount = 0;
  cur = makeRng(seedBase ^ 0x5eed);
}

// for tests: load the dice. withRandom(0, f) runs f with every roll coming up 0; a function gives a sequence.
export function withRandom(v, f) {
  const was = override; override = typeof v === 'function' ? v : () => v;
  try { return f(); } finally { override = was; }
}
export function setRandom(fn) { override = fn || null; }
