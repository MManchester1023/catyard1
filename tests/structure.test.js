// How the code hangs together. These fail when a change would quietly tangle it again:
//   - no two modules may import each other, however indirectly (a cycle is what bit us with the oak frame constant);
//   - the foundation (rng, version, util, world) only builds on what is below it;
//   - the simulation never reaches into the interface;
//   - the activity table in mind.js stays well formed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIVITIES, decide } from '../src/sim/mind.js';
import { SCORE_KEY } from '../src/sim/finds.js';
import { makeWorld } from '../src/sim/sim.js';
import { seedTests } from '../src/sim/rng.js';
seedTests(1);

const ok = m => console.log('  ok ' + m);
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const files = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } }; walk(SRC);
const rel = f => path.relative(SRC, f).split(path.sep).join('/');
const G = {}; for (const f of files) G[rel(f)] = [...fs.readFileSync(f, 'utf8').matchAll(/^\s*import\s[^'"]*?from\s+['"](\.[^'"]+)['"]/gm)].map(m => rel(path.resolve(path.dirname(f), m[1])));

{
  // every import points at a file that exists
  const missing = Object.entries(G).flatMap(([f, deps]) => deps.filter(d => !G[d]).map(d => `${f} -> ${d}`));
  assert.deepEqual(missing, [], 'imports of missing files');
  // no cycles (Tarjan's strongly connected components)
  let i = 0; const st = [], on = new Set(), I = {}, L = {}, cycles = [];
  const visit = v => { I[v] = L[v] = i++; st.push(v); on.add(v); for (const u of G[v]) { if (I[u] === undefined) { visit(u); L[v] = Math.min(L[v], L[u]); } else if (on.has(u)) L[v] = Math.min(L[v], I[u]); }
    if (L[v] === I[v]) { const c = []; let x; do { x = st.pop(); on.delete(x); c.push(x); } while (x !== v); if (c.length > 1 || G[v].includes(v)) cycles.push(c.sort().join(' <-> ')); } };
  for (const f of Object.keys(G)) if (I[f] === undefined) visit(f);
  assert.deepEqual(cycles, [], 'modules that import each other: ' + cycles.join('; '));
  ok(`no import cycles among ${files.length} modules`);
}
{
  const BASE = ['sim/rng.js', 'sim/version.js', 'sim/util.js', 'sim/world.js']; // (each may only use the ones before it)
  for (const [k, f] of BASE.entries()) { const bad = G[f].filter(d => !BASE.slice(0, k).includes(d)); assert.deepEqual(bad, [], `${f} reaches up to ${bad.join(', ')}`); }
  const ui = Object.entries(G).filter(([f]) => f.startsWith('sim/')).flatMap(([f, deps]) => deps.filter(d => !d.startsWith('sim/')).map(d => `${f} -> ${d}`));
  assert.deepEqual(ui, [], 'the simulation imports the interface');
  ok('the foundation (rng, version, util, world) only builds on itself, and the simulation never imports the interface');
}
{
  const keys = ACTIVITIES.map(a => a.key);
  assert.equal(new Set(keys).size, keys.length, 'each activity once');
  assert.ok(ACTIVITIES.every(a => typeof a.score === 'function' && ['prep', 'when', 'then'].every(f => a[f] === undefined || typeof a[f] === 'function')), 'each has a score, and prep/when/then are functions');
  const strays = Object.keys(SCORE_KEY).filter(k => !keys.includes(k)); assert.deepEqual(strays, [], 'feelings refer to activities that do not exist');
  const w = makeWorld('Tess'); decide(w, null); assert.deepEqual(Object.keys(w.scoreSnap).slice(0, keys.length), keys, 'scores come out in table order');
  ok(`mind.js: ${keys.length} activities, each once, well formed, in a fixed order`);
}

console.log('\nALL OK');
