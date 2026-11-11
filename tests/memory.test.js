// Memory: the cat keeps what mattered from its diary, lets it fade, brings it back, and notices who keeps turning up.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { journal, dayOf } from '../src/sim/world.js';
import { ensureMemory, memoryTick, recall, strength, when, regulars, regularLine, memoryThought, memoryDigest, memoryReply, MEM_CAP } from '../src/sim/memory.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { offlineReply, thoughtFor } from '../src/sim/thoughts.js';
import { digest } from '../src/sim/llm.js';
import { composePost, ensureBlog } from '../src/sim/blog.js';

const ok = m => console.log('  ok ' + m);
const fresh = () => { const w = makeWorld('Tess'); w.cat.mem.known.tablet = 1; return w; };
const withRandom = (v, f) => { const r = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = r; } };
const atDay = (w, d) => { w.clock = (d - 1) * w.dayLen + 100; };

// ---- what is kept: significant things, not chatter; the first of anything is memorable
{
  const w = fresh(); atDay(w, 2);
  journal(w, 'I solved the mystery of the moon.', 'solved');
  journal(w, 'I looked at the sky for a while.', 'muse');
  journal(w, 'I read about beetles on the tablet.', 'tablet'); // the first time it read something is memorable
  journal(w, 'I read about ferns on the tablet.', 'tablet'); // the second is not
  const n = memoryTick(w), c = w.cat;
  assert.equal(n, 2, 'a solved mystery and a first tablet read are kept; muse and a repeat are not');
  assert(c.memories.some(m => m.tag === 'solved' && m.text.includes('moon')) && !c.memories.some(m => m.tag === 'muse'));
  assert.equal(memoryTick(w), 0, 'the same diary lines are not kept twice');
  journal(w, 'I discovered the pond.', 'discover'); assert.equal(memoryTick(w), 1, 'new lines are picked up');
  ok('keeps the significant, skips the trivial, never duplicates');
}

// ---- fading and being kept alive by recall
{
  const w = fresh(); atDay(w, 1);
  journal(w, 'I caught a bird.', 'hunt'); memoryTick(w); const m = w.cat.memories[0];
  const s0 = strength(w, m); atDay(w, 6); const s5 = strength(w, m); atDay(w, 30);
  assert(s5 < s0 && strength(w, m) < s5, 'older memories are weaker');
  const base = strength(w, m); m.recalled = 3; assert(strength(w, m) > base + 0.3, 'thinking about it keeps it alive');
  ok('memories fade with the days and are kept alive by being recalled');
}

// ---- cap: the weakest are forgotten
{
  const w = fresh();
  for (let d = 1; d <= 90; d++) { atDay(w, d); journal(w, `Day ${d}: something happened to me.`, d % 2 ? 'discover' : 'solved'); memoryTick(w); }
  assert(w.cat.memories.length <= MEM_CAP, 'capped');
  assert(w.cat.memories.some(m => m.day >= 88), 'recent ones are kept');
  ok('only the strongest ' + MEM_CAP + ' are kept');
}

// ---- recall is about "before", not now, and doesn't repeat itself straight away
{
  const w = fresh(); atDay(w, 3); journal(w, 'I solved the mystery of the moon.', 'solved'); memoryTick(w);
  assert.equal(recall(w), null, 'something from today is not yet "before"');
  atDay(w, 4); const m = withRandom(0, () => recall(w)); assert(m && m.tag === 'solved');
  assert.equal(when(w, m), 'Yesterday'); atDay(w, 9); assert.equal(when(w, m), '6 days ago'); atDay(w, 12); assert.equal(when(w, m), 'Last week'); atDay(w, 30); assert.equal(when(w, m), 'On day 3');
  atDay(w, 4); const th = withRandom(0, () => memoryThought(w));
  assert(th && th.startsWith('Yesterday:') && th.includes('moon'), 'it says it out loud: ' + th);
  assert.equal(withRandom(0, () => memoryThought(w)), null, 'not again right away');
  w.clock += w.dayLen; assert(withRandom(0, () => memoryThought(w)), 'but after a while it can come back to it');
  ok('recall: only the past, dated naturally, not repeated straight away');
}

// ---- regulars: counted per day, not per mention; only events, never named individuals
{
  const w = fresh();
  for (let d = 1; d <= 4; d++) { atDay(w, d); journal(w, 'I sat with the frog for a long time.', 'frog'); journal(w, 'The frog looked at me again.', 'frog'); }
  atDay(w, 5); journal(w, 'A crow stole my feather.', 'upset'); memoryTick(w);
  const r = regulars(w); assert.equal(r.length, 1, 'only the frog has turned up on 3+ days'); assert.equal(r[0].key, 'frog'); assert.equal(r[0].n, 4, 'counted once per day');
  assert(/frog/i.test(regularLine(w)) && /4 days/.test(regularLine(w)));
  assert(!Object.keys(w.cat.familiar).some(k => /[A-Z]/.test(k)), 'kinds, not individuals');
  assert(memoryDigest(w).some(l => /Regulars/.test(l)), 'Claude is told');
  ok('regulars are noticed by how many days they turn up');
}

// ---- it shows: chat, blog, thoughts, Claude's briefing
{
  const w = fresh(); atDay(w, 2); journal(w, 'I painted the first sunset I was proud of.', 'art'); journal(w, 'I found a green button under the oak.', 'discover'); memoryTick(w); atDay(w, 5);
  const a = offlineReply(w, 'do you remember anything?'); assert(/days ago|Yesterday|Last week|On day/.test(a) && /(sunset|button)/.test(a), 'chat: ' + a);
  assert(/Nothing big enough/.test(offlineReply(fresh(), 'do you remember anything?')), 'honest when there is nothing');
  assert(/Nothing worth keeping/.test(offlineReply(w, 'what did you do yesterday? do you remember?')), 'honest about a quiet yesterday');
  assert(digest(w).includes('Things you remember'), 'digest has memories');
  let heard = null; for (let i = 0; i < 200 && !heard; i++) { for (const m of w.cat.memories) m.at = -999; w.cat.recallAt = -999; const t = withRandom(0.05, () => thoughtFor(w, 'idle')); if (/(sunset|button)/.test(t)) heard = t; }
  assert(heard && /days ago:|Yesterday:|Last week:/.test(heard), 'an idle thought can be a memory: ' + heard);
  const w3 = fresh(); atDay(w3, 2); journal(w3, 'I solved the mystery of the moon.', 'solved'); memoryTick(w3); atDay(w3, 6);
  for (let i = 0; i < 12; i++) journal(w3, `Entry ${i}: the yard did a thing.`, 'craft');
  ensureBlog(w3); w3.blog.started = 1; let looked = false; for (let i = 0; i < 40 && !looked; i++) looked = /moon/.test(composePost(w3).body);
  assert(looked, 'the blog looks back sometimes');
  ok('shows up in chat, idle thoughts, the blog and the Claude briefing; honest when there is nothing');
}

// ---- saves
{
  const w = fresh(); atDay(w, 2); journal(w, 'I discovered the pond.', 'discover'); memoryTick(w);
  const w2 = deserialize(serialize(w)); assert(w2 && w2.cat.memories.length === 1 && w2.cat.mSeen === w.cat.mSeen, 'memories survive a save');
  const old = JSON.parse(serialize(w)); delete old.cat.memories; delete old.cat.mSeen; delete old.cat.familiar;
  const w3 = deserialize(JSON.stringify(old)); assert(w3 && Array.isArray(w3.cat.memories) && w3.cat.mSeen === 0, 'an old save gets empty memory, then picks it up from the diary');
  memoryTick(w3); assert(w3.cat.memories.length >= 1, 'bootstraps from the old diary');
  ok('saves round-trip; old saves bootstrap memory from the diary');
}

// ---- a few days of ordinary life: nothing breaks, memories accumulate, it recalls
{
  const w = fresh(); w.cat.traits.curious = 0.9; let said = 0;
  for (let i = 0; i < 20 * 1200 / 0.5; i++) { tick(w, 0.5); if (w.cat.thought && /Yesterday:|days ago:|Last week:|On day \d+:/.test(w.cat.thought) && w.cat.thoughtId !== said) said = w.cat.thoughtId; }
  assert(w.cat.memories.length > 0, 'it kept something over 20 days'); assert(said > 0, 'and it brought something back at least once');
  ok('20 simulated days: memories kept (' + w.cat.memories.length + ') and recalled');
}
console.log('memory tests passed');
