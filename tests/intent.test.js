// Intent: the cat makes up its mind a few times a day about what it wants to do and why. Claude picks from a menu of what is
// possible when it is connected; a built-in whim does the same when it is not. The simulation honours it, but needs come first.
import assert from 'node:assert/strict';
import { makeWorld, tick, catchUp } from '../src/sim/sim.js';
import { decide } from '../src/sim/mind.js';
import { start } from '../src/sim/acts.js';
import { journal, dayOf } from '../src/sim/world.js';
import { ensureChar, DO } from '../src/sim/character.js';
import { ensureIntent, intentMenu, whim, applyIntent, intentTick, intentActive, intentPull, intentFulfilled, claudeIntent, intentPrompt, intentDigest, CLAUDE_PER_DAY, INTENT_PULL } from '../src/sim/intent.js';
import { memoryTick } from '../src/sim/memory.js';
import { Brain, DEFAULTS, digest } from '../src/sim/llm.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { offlineReply } from '../src/sim/thoughts.js';
import { TEMPER_IDS } from '../src/sim/temper.js';
import { seedTests, withRandom, setRandom } from '../src/sim/rng.js';
seedTests(1); // (every world here gets a fixed seed, so this test gives the same result every run)

const ok = m => console.log('  ok ' + m);
const fresh = (temper = null) => { const w = makeWorld('Int'); w.cat.temper = temper; return w; };
const atHour = (w, day, h) => { w.clock = (day - 1) * w.dayLen + (h / 24) * w.dayLen; };
// a calm noon with a handful of things it could do
const calm = () => { const w = fresh(); const c = w.cat; atHour(w, 5, 12); c.traits = { curious: 0.5, bold: 0.5, affection: 0.5, lazy: 0.3 }; Object.assign(c.needs, { hunger: 0.1, thirst: 0, tired: 0.3, fun: 0.5, dirty: 0.2, create: 0.6, lonely: 0.5, fear: 0 }); c.mem.known.post = 1; c.mem.known.yarn = 1; c.mem.known.easel = 1;
  w.frog = { name: 'Pip', out: true, lastVisit: -1e9, bond: 0, visits: 0 }; w.weather.rain = 0; w.weather.cloud = 0; w.weather.type = 'clear'; c.dayMood = { day: 5, kind: 'steady' }; withRandom(0.5, () => decide(w, null)); return w; };

// ---- the menu is what is actually possible
{
  const w = calm(), menu = intentMenu(w);
  assert(menu.length >= 3 && menu.length <= 7, 'a handful of things: ' + menu.map(m => m.key));
  assert(menu.every(m => w.scoreSnap[m.key] > 0.05 && DO[m.key] === m.label), 'only things it can do right now, with a label');
  assert(!menu.some(m => ['eat', 'drink', 'sleep', 'beg', 'hunt', 'wash'].includes(m.key)), 'never its body\'s business');
  assert.deepEqual(intentMenu(fresh()), [], 'nothing to choose from before it has looked');
  ok('the menu is what is possible now, and never needs');
}
// ---- the whim: from its character, memory, habits and mood, with a reason
{
  const w = calm(), c = w.cat;
  const ids = new Set(); for (let i = 0; i < 300; i++) { const m = whim(w); ids.add(m.key); assert(m.why.length > 5 && /[.]$/.test(m.why), 'a reason: ' + m.why); }
  assert(ids.size >= 3, 'not always the same: ' + [...ids]);
  c.assoc['act:frog'] = { v: 0.5, n: 8, lab: { warm: 8 }, said: '' };
  // what has felt good counts
  const tally = {}; for (let i = 0; i < 400; i++) { const k = whim(w).key; tally[k] = (tally[k] || 0) + 1; } assert((tally.frog || 0) > 400 / 3, 'it leans towards what has felt good: ' + JSON.stringify(tally));
  // a memory can be the reason
  const m = fresh(); atHour(m, 3, 12); journal(m, 'I sat with the frog and it was lovely.', 'frog'); memoryTick(m); atHour(m, 5, 12); const mm = calm(); mm.cat.memories = m.cat.memories; mm.cat.mSeen = m.cat.mSeen; mm.clock = 5 * mm.dayLen; mm.cat.assoc = {};
  let said = null; for (let i = 0; i < 200 && !said; i++) { for (const x of mm.cat.memories) x.at = -999; const r = whim(mm); if (r.key === 'frog' && /frog was lovely|It keeps coming back|Last week|days ago/.test(r.why)) said = r.why; } assert(said, 'its reason can be something it remembers');
  ok('whim: leans on what felt good, varies, gives a reason, can be a memory');
}
// ---- making up its mind: logged, a strong nudge, fulfilled
{
  const w = calm(), c = w.cat; const i = applyIntent(w, 'frog', 'I miss the pond.', 'whim');
  assert(intentActive(w) && c.intent.by === 'whim' && /decided to sit with the frog/.test(w.journal[0].text) && /I miss the pond/.test(w.journal[0].text) && w.journal[0].tag === 'intent', 'logged with its reason');
  assert.equal(intentPull(w, 'frog'), INTENT_PULL); assert.equal(intentPull(w, 'paint'), 0);
  assert.equal(applyIntent(w, 'nonsense', 'x'), null, 'not something it can do');
  // it acts on it: tell it to sit with the frog while lonely 0.2 would not
  const a = calm(); a.cat.needs.lonely = 0.2; a.cat.needs.create = 0; a.cat.needs.fun = 0; a.cat.postAt = a.clock; a.cat.loungeAt = a.clock; applyIntent(a, 'frog', 'x'); a.cat.intent.until = a.clock + 500; assert.equal(withRandom(0.5, () => decide(a, null)).type, 'frog', 'it goes');
  // fulfilled
  const j0 = a.cat.mood.joy; start(a, 'frog'); assert(a.cat.intent.done && a.cat.mood.joy > j0 && !intentActive(a), 'done, and pleased'); assert.equal(a.stats.intentsDone, 1);
  // it lapses if it does not happen
  const l = calm(); applyIntent(l, 'paint', 'x'); l.clock += l.dayLen; assert(!intentActive(l));
  ok('an intent is logged with its reason, nudges hard, is fulfilled, or lapses');
}
// ---- but needs come first
{
  const set = hunger => { const w = calm(); w.cat.needs.hunger = hunger; w.cat.needs.lonely = 0.2; applyIntent(w, 'frog', 'x'); withRandom(0.5, () => decide(w, null)); return w.scoreSnap.frog; };
  assert(set(0.3) - set(0.9) >= INTENT_PULL - 1e-9, 'a hungry cat is not pulled by it');
  const t = calm(); t.cat.needs.tired = 0.9; t.cat.needs.lonely = 0.2; const base = (() => { const b = calm(); b.cat.needs.tired = 0.9; b.cat.needs.lonely = 0.2; withRandom(0.5, () => decide(b, null)); return b.scoreSnap.frog; })();
  applyIntent(t, 'frog', 'x'); withRandom(0.5, () => decide(t, null)); assert.equal(t.scoreSnap.frog, base, 'nor a tired one');
  ok('hunger and tiredness still come first');
}
// ---- the cadence: a few times a day, never when it should not
{
  const w = calm(), c = w.cat; w.llmOn = false;
  intentTick(w); assert(intentActive(w) && c.intent.by === 'whim', 'offline: a whim');
  const first = c.intent; intentTick(w); assert.equal(c.intent, first, 'not again while one is on');
  w.clock += w.dayLen * 0.15; first.done = true; intentTick(w); assert.equal(c.intent, first, 'nor straight after (too soon)');
  w.clock += w.dayLen * 0.1; withRandom(0.5, () => decide(w, null)); intentTick(w); assert.notEqual(c.intent, first, 'then another');
  for (const bad of [{ hunger: 0.9 }, { tired: 0.9 }]) { const x = calm(); Object.assign(x.cat.needs, bad); intentTick(x); assert(!x.cat.intent, 'no plans when ' + Object.keys(bad)); }
  const s = calm(); s.cat.pose = 'sleep'; intentTick(s); assert(!s.cat.intent, 'not asleep');
  ok('a few times a day, not too soon, not when hungry, tired or asleep');
}
// ---- Claude picks
{
  const w = calm(), c = w.cat; w.llmOn = true; withRandom(0, () => intentTick(w));
  assert(c.intentAsk && !c.intent && w.asks.some(a => a.type === 'intent' && a.id === c.intentAsk.id), 'it asks Claude, and does not decide yet');
  const ask = w.asks[0], menu = c.intentAsk.menu, p = intentPrompt(w, ask); assert(menu.every((m, i) => p.includes(`${i + 1}. ${m.label}`)), 'the prompt is the menu');
  assert.equal(claudeIntent(w, { id: 'stale' }, { pick: 1, why: 'x' }), null, 'a stale answer is ignored');
  const r = claudeIntent(w, ask, { pick: 2, why: 'The easel has been calling.' }); assert(r && r.key === menu[1].key && r.by === 'claude' && /easel has been calling/.test(w.journal[0].text), 'its pick, in its words');
  assert.equal(c.intentAsk, null);
  const w2 = calm(); w2.llmOn = true; withRandom(0, () => intentTick(w2)); assert.equal(claudeIntent(w2, w2.asks[0], { pick: 99, why: 'x' }), null, 'a pick that is not on the menu is dropped'); assert.equal(w2.cat.intentAsk, null);
  const w3 = calm(); w3.llmOn = true; withRandom(0, () => intentTick(w3)); const k = w3.cat.intentAsk.menu[0]; assert.equal(claudeIntent(w3, w3.asks[0], { pick: k.key, why: 'x' }).key, k.key, 'by name works too');
  // if Claude never answers, it decides for itself
  const t = calm(); t.llmOn = true; withRandom(0, () => intentTick(t)); t.clock += t.dayLen * 0.2; intentTick(t); assert(t.cat.intent && t.cat.intent.by === 'whim', 'a timeout falls back to a whim');
  const u = calm(); u.llmOn = true; withRandom(0, () => intentTick(u)); u.llmOn = false; intentTick(u); assert(u.cat.intent && u.cat.intent.by === 'whim', 'and so does Claude going away');
  // a daily cap on Claude's share
  const d = calm(); d.llmOn = true; for (let i = 0; i < 6; i++) { d.cat.intentAt = -999; d.cat.intent = null; d.cat.intentAsk = null; withRandom(0, () => intentTick(d)); } assert(d.asks.filter(a => a.type === 'intent').length === CLAUDE_PER_DAY, 'at most ' + CLAUDE_PER_DAY + ' a day go to Claude: ' + d.asks.length);
  ok('Claude: asked with the menu, its pick used, stale/invalid answers dropped, timeout and cap handled');
}
{
  // through the real Brain, against a fake server
  const w = calm(); w.llmOn = false; let calls = [], settings = JSON.parse(JSON.stringify(DEFAULTS)); settings.apiKey = 'sk-test';
  const http = async (url, opt) => { calls.push(JSON.parse(opt.body)); return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '{"pick": 2, "why": "My paws want the easel."}' }] }) }; };
  const brain = new Brain({ getSettings: () => settings, saveSettings: () => {}, http });
  await brain.tick(w, true); assert.equal(w.llmOn, true, 'the brain tells the sim it is there');
  withRandom(0, () => intentTick(w)); assert(w.asks.length === 1); const menu = w.cat.intentAsk.menu.slice();
  await brain.tick(w, true);
  assert(w.cat.intent && w.cat.intent.key === menu[1].key && w.cat.intent.by === 'claude' && /My paws want the easel/.test(w.cat.intent.why), 'applied');
  assert(/mood|STATE/.test(calls[0].messages[0].content) && calls[0].messages[0].content.includes('1. ' + menu[0].label), 'the menu is in the prompt with STATE');
  assert(/set your mind on this/.test(digest(w)), 'and it is in the briefing afterwards');
  settings.on = false; await brain.tick(w, true); assert.equal(w.llmOn, false, 'off means off');
  ok('end to end through the Brain with a fake server');
}
// ---- while it was away and in saves
{
  const w = calm(); w.llmOn = true; catchUp(w, 600); assert.equal(w.llmOn, true, 'catching up leaves the flag as it was'); assert(!w.asks.length, 'and asks nothing');
  const s = calm(); applyIntent(s, 'paint', 'The light is good.', 'claude'); const s2 = deserialize(serialize(s)); assert.equal(s2.cat.intent.key, 'paint'); assert.equal(s2.cat.intent.why, 'The light is good.'); assert.equal(s2.llmOn, undefined);
  const old = JSON.parse(serialize(s)); for (const k of ['intent', 'intentAt', 'intentAsk', 'claudeIntents']) delete old.cat[k]; const s3 = deserialize(JSON.stringify(old)); assert(s3.cat.intent === null && s3.cat.claudeIntents);
  ok('catch-up is quiet; saves round-trip; old saves are fine');
}
// ---- it can say what it means to do
{
  const w = calm(); applyIntent(w, 'frog', 'I miss the pond.', 'whim');
  const r = offlineReply(w, 'what are you going to do next?'); assert(/sit with the frog/.test(r) && /miss the pond/.test(r), r);
  assert(/Nothing in particular|No plans/.test(offlineReply(fresh(), 'what are you going to do next?')), 'honest with no plans');
  ok('chat: what it means to do, and why');
}
// ---- a few weeks of life: it makes up its mind, does what it chose most of the time, and nothing goes wrong
{
  for (const t of [null, ...TEMPER_IDS]) {
    const w = fresh(t); w.cat.mem.known.tablet = 1; for (let i = 0; i < 12 * 1200 / 0.5; i++) tick(w, 0.5);
    const lazy = t === 'garfield'; // (it sleeps and eats through much of the day, so it has fewer chances, and follows through less)
    assert(w.stats.intents >= 12 * (lazy ? 0.4 : 0.6), `${t}: it made up its mind (${w.stats.intents})`); assert(w.stats.intentsDone >= w.stats.intents * (lazy ? 0.12 : 0.3), `${t}: and followed through ${w.stats.intentsDone}/${w.stats.intents}`);
    assert(w.stats.intents <= 12 * 6, 'not constantly');
  }
  ok('12 days for every kind of cat: at least one every day or two, mostly followed through');
}
console.log('intent tests passed');
