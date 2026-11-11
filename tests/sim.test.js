// Headless behaviour check: run several cats for many simulated days and report.
import { makeWorld, tick, describe } from '../src/sim/sim.js';
import { blocked, dayOf } from '../src/sim/world.js';
import { levelOf, LEVEL_NAMES } from '../src/sim/art.js';

const DAYS = +process.argv[2] || 10, RUNS = +process.argv[3] || 4, dt = 1 / 10;
let bad = 0;
for (let run = 0; run < RUNS; run++) {
  const w = makeWorld(); const acts = {}; let nan = 0, oob = 0, inObst = 0, stuck = 0, still = 0, lastX = w.cat.x, lastY = w.cat.y;
  const steps = DAYS * w.dayLen / dt;
  try {
    for (let i = 0; i < steps; i++) {
      tick(w, dt);
      const c = w.cat, d = describe(w).replace(/(Fetching a|Painting|Eating|Drinking).*/, '$1…'); acts[d] = (acts[d] || 0) + dt;
      if (![c.x, c.y, c.z, ...Object.values(c.needs)].every(Number.isFinite)) nan++;
      if (c.x < 0 || c.x > 960 || c.y < 200 || c.y > 600) oob++;
      if (!c.hidden && c.pose !== 'pounce' && c.pose !== 'sleep' && blocked(w, c.x, c.y)) inObst++;
      if (c.act.phase === 'go' && Math.hypot(c.x - lastX, c.y - lastY) < 0.01) still += dt; else still = 0;
      if (still > 15) { stuck++; still = 0; }
      lastX = c.x; lastY = c.y;
    }
  } catch (e) { console.log('CRASH', e.stack); bad++; continue; }
  const c = w.cat, tot = Object.values(acts).reduce((a, b) => a + b, 0);
  console.log(`\n#${run} ${c.name} (${c.coat}) curious ${c.traits.curious.toFixed(2)} bold ${c.traits.bold.toFixed(2)} lazy ${c.traits.lazy.toFixed(2)} | quirk: ${c.quirk.item}, likes ${c.quirk.favColor}, taste ${c.quirk.taste}`);
  console.log(`  nan=${nan} oob=${oob} inObstacle=${inObst} stuckWalks=${stuck}`);
  console.log('  stats', JSON.stringify(w.stats));
  console.log(`  stash ${w.stash.items.length} at ${w.stash.site ? w.stash.site.label : 'none'} | art L${levelOf(c.art.xp)} ${LEVEL_NAMES[levelOf(c.art.xp)]} (${c.art.count} works, best ${Math.round(c.art.best * 100)}) | wants done ${c.doneWants}, active: ${c.wants.map(x => x.text).join('; ') || 'none'}`);
  console.log('  mysteries', Object.entries(w.mysteries).map(([k, m]) => `${k}: ${m.solved ? 'SOLVED' : m.theory ? 'theory ' + Math.round(m.conf * 100) + '%' : m.clues + ' clues'}`).join(' | '));
  const top = Object.entries(acts).sort((a, b) => b[1] - a[1]);
  console.log('  ' + top.map(([k, v]) => `${k} ${(v / tot * 100).toFixed(0)}%`).join(' | '));
  if (run === 0) { console.log('  --- last journal lines ---'); w.journal.slice(0, 14).reverse().forEach(j => console.log(`   d${j.day} ${j.time} [${j.tag}] ${j.text}`)); }
  if (nan || oob) bad++;
}
process.exit(bad ? 1 : 0);
