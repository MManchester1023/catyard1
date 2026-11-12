// The Claude brain makes more of the cat's choices: what it works towards (goals), what it paints, what it becomes
// fascinated by and what it looks up about it, and how it answers a note (and acts on it). Every choice has an offline
// fallback and a bounded cost. Also: the lean digest the small calls use, and the token count.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { Brain, DEFAULTS, digest } from '../src/sim/llm.js';
import { genWants, claudeGoal, goalPrompt, GOALS_PER_DAY } from '../src/sim/wants.js';
import { subjectTick, claudeSubject, subjectPrompt, pickSubject, SUBJECTS_PER_DAY } from '../src/sim/art.js';
import { interestTick, claudeInterest, interestPrompt, interestRequest, interestMiss, startInterest, finishInterest, interestPage, interestActive } from '../src/sim/interest.js';
import { leaveOffering, inspectOffer } from '../src/sim/offerings.js';
import { seedTests, withRandom } from '../src/sim/rng.js';
seedTests(1);
const ok = m => console.log('  ok ' + m);
const mk = (name = 'Pip') => { const w = makeWorld(name); w.netOn = false; w.weather.timer = 1e9; w.weather.type = 'clear'; w.weather.rain = 0; Object.assign(w.cat.mem.known, { pond: 1, post: 1, tree: 1, flowers: 1, cushion: 1, yarn: 1, fence: 1, easel: 1, tablet: 1 }); return w; };

{
  // the lean digest is much smaller, keeps the essentials, and no line is huge
  const w = mk(); for (let i = 0; i < 6 * w.dayLen * 10; i++) tick(w, 0.1);
  const full = digest(w), lean = digest(w, true);
  assert.ok(lean.length < full.length * 0.6, `lean ${lean.length} vs full ${full.length}`);
  for (const p of ['You:', 'Now:', 'Needs:', 'Wants:', 'Recent events:']) assert.ok(lean.includes(p), 'lean keeps ' + p);
  assert.ok(!/Mysteries:|Things you remember|Tastes:/.test(lean), 'and leaves out the rest');
  assert.ok(full.split('\n').every(l => l.length <= 320), 'no line of the full digest runs on');
  ok(`the lean digest is ${Math.round(lean.length / full.length * 100)}% of the full one, and long lines are clipped`);
}
{
  // tokens used are counted from what the server says
  const s = JSON.parse(JSON.stringify(DEFAULTS)); s.apiKey = 'k';
  const brain = new Brain({ getSettings: () => s, saveSettings: () => {}, http: async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'OK' }], usage: { input_tokens: 900, output_tokens: 40 } }) }) });
  await brain.call('s', 'u', 8); await brain.call('s', 'u', 8);
  assert.equal(brain.usage().inTok, 1800); assert.equal(brain.usage().outTok, 80); assert.match(brain.label(), /about 1880 tokens/);
  assert.ok(DEFAULTS.museEvery >= 300 && DEFAULTS.dailyCap <= 300, 'thoughts are rarer by default');
  ok('tokens are counted, and passing thoughts are rarer by default');
}
{
  // goals: Claude chooses from the possible ones and says why; offline it is the weights, as before
  const off = mk(); off.llmOn = false; off.stash.items.push({}, {}, {}); off.cat.wants = []; genWants(off); assert.equal(off.cat.wants.length, 1); assert.ok(!off.cat.goalAsk, 'offline: no question');
  const w = mk(); w.llmOn = true; w.stash.items.push({}, {}, {}); w.cat.wants = []; w.stats.collected = 3; genWants(w);
  const q = w.cat.goalAsk; assert.ok(q && q.menu.length >= 2 && w.asks.some(a => a.type === 'goal' && a.id === q.id), 'it asks Claude, with a menu'); assert.equal(w.cat.wants.length, 0, 'and waits');
  assert.match(goalPrompt(w, { id: q.id }), /ONE goal/); assert.equal(goalPrompt(w, { id: 'nope' }), null);
  assert.equal(claudeGoal(w, { id: 'stale' }, { pick: 1 }), null, 'a stale answer is ignored');
  const made = claudeGoal(w, { id: q.id }, { pick: 2, why: 'the shiny ones keep calling me' }); assert.ok(made && made.why && w.cat.wants.length === 1 && w.cat.wants[0].text === q.menu[1].text, 'it takes the one Claude picked');
  assert.ok(w.journal.some(e => /shiny ones/.test(e.text)), 'and the reason is in its diary');
  // no answer: it decides for itself after a while
  const v = mk(); v.llmOn = true; v.stash.items.push({}, {}, {}); v.cat.wants = []; genWants(v); genWants(v); assert.equal(v.cat.wants.length, 0, 'still waiting'); v.clock += v.dayLen * 0.2; genWants(v); assert.equal(v.cat.wants.length, 1, 'no answer in time: the weights decide');
  // the budget
  const u = mk(); u.llmOn = true; u.stash.items.push({}, {}, {}); let asked = 0; for (let k = 0; k < 10; k++) { u.cat.wants = []; u.cat.goalAsk = null; genWants(u); if (u.cat.goalAsk) asked++; } assert.ok(asked <= GOALS_PER_DAY, 'at most ' + GOALS_PER_DAY + ' goal questions a day: ' + asked);
  ok('goals: Claude picks from what is possible and says why; no answer means the weights decide; it is budgeted');
}
{
  // what to paint: asked a couple of times a day, used once, only if still possible
  const w = mk(); w.llmOn = true; w.easelMade = { day: 1 }; w.cat.needs.create = 0.8; subjectTick(w);
  const q = w.cat.art.subjAsk; assert.ok(q && q.menu.length >= 2 && w.asks.some(a => a.type === 'subject'), 'it asks what to paint');
  assert.match(subjectPrompt(w, { id: q.id }), /ONE/); assert.equal(claudeSubject(w, { id: 'x' }, { pick: 1 }), null);
  const key = q.menu.find(o => o.key === 'pond').key; const idx = q.menu.findIndex(o => o.key === key) + 1;
  claudeSubject(w, { id: q.id }, { pick: idx, why: 'the water was doing something' }); assert.equal(w.cat.art.nextSubject.key, 'pond');
  assert.equal(pickSubject(w), 'pond', 'it paints what Claude chose'); assert.ok(w.journal.some(e => /water was doing/.test(e.text))); assert.equal(w.cat.art.nextSubject, null, 'once');
  const v = mk(); v.llmOn = true; v.easelMade = { day: 1 }; v.cat.art.nextSubject = { key: 'moon', why: 'x', until: v.clock + 100 }; v.clock = 0.4 * v.dayLen; assert.notEqual(pickSubject(v), 'moon', 'the moon is not up in the day: not possible, so not chosen');
  const u = mk(); u.llmOn = true; u.easelMade = { day: 1 }; u.cat.needs.create = 0.8; let n = 0; for (let k = 0; k < 8; k++) { u.cat.art.subjAsk = null; u.cat.art.nextSubject = null; subjectTick(u); if (u.cat.art.subjAsk) n++; } assert.ok(n <= SUBJECTS_PER_DAY, 'budgeted: ' + n);
  const x = mk(); x.llmOn = false; x.easelMade = { day: 1 }; x.cat.needs.create = 0.9; subjectTick(x); assert.ok(!x.cat.art.subjAsk, 'offline: no question');
  ok('painting: Claude chooses the subject and why, used once and only if it is possible; budgeted');
}
{
  // interests: Claude chooses (from a list, from memory, or its own), says why and what to look up; the interest is for good
  const w = mk(); w.llmOn = true; w.clock = 5 * w.dayLen;
  withRandom(0, () => interestTick(w)); const q = w.cat.interestAsk; assert.ok(q && q.menu.length >= 5 && w.asks.some(a => a.type === 'interest'), 'it asks Claude'); assert.ok(!interestActive(w));
  assert.match(interestPrompt(w, { id: q.id }), /Wikipedia/); assert.equal(claudeInterest(w, { id: 'stale' }, { pick: 1 }), null);
  const i = claudeInterest(w, { id: q.id }, { pick: null, topic: 'Deep-sea fish!!', why: 'They glow and nobody asked them to.', angles: ['Anglerfish', 'Bioluminescence', 'x', 'Hadal zone', 'Mariana Trench', 'Extra one'] });
  assert.equal(i.topic, 'Deep-sea fish', 'its own subject, cleaned'); assert.equal(i.by, 'claude'); assert.equal(i.angles.length, 4, 'a few angles'); assert.ok(i.why);
  assert.ok(w.journal.some(e => /glow and nobody/.test(e.text) && /Anglerfish/.test(e.text)), 'the reason and the plan are in the diary');
  assert.equal(interestRequest(w).q, 'Anglerfish', 'the first thing it looks up is its own angle');
  interestMiss(w); assert.equal(interestRequest(w).q, 'Bioluminescence', 'a dead end moves on to the next angle');
  interestPage(w, { title: 'Bioluminescence', extract: 'Bioluminescence is light made by living things, which is a frankly excellent thing to do.' }); assert.equal(interestRequest(w).q, 'Hadal zone', 'after a page, the next angle');
  assert.match(w.cat.interest.topic, /Deep-sea fish/); const nm = (w.cat.interest.topic || '').toLowerCase(); assert.ok(w.chat.some(m => m.from === 'sys' && m.text.includes(nm)), 'and the human is told');
  finishInterest(w, 'enough'); const p = w.cat.interests[0]; assert.equal(p.topic, 'Deep-sea fish'); assert.equal(p.sessions, 1);
  // coming back to it: it goes deeper and never rereads
  w.clock += w.dayLen; withRandom(0, () => interestTick(w)); const q2 = w.cat.interestAsk; assert.ok(q2.menu.some(o => o.back && o.topic === 'Deep-sea fish'), 'it can go back to what it loved');
  const bi = claudeInterest(w, { id: q2.id }, { pick: q2.menu.findIndex(o => o.back) + 1, why: 'I am not done.' }); assert.ok(bi.back && bi.titles.includes('Bioluminescence'), 'it remembers what it has read');
  interestPage(w, { title: 'Hadal zone', extract: 'The hadal zone is the deepest part of the ocean, and very dark.' }); finishInterest(w, 'enough');
  assert.equal(w.cat.interests.length, 1, 'one passion, not two'); assert.equal(w.cat.interests[0].sessions, 2); assert.equal(w.cat.interests[0].pages, 2);
  // no answer in time: offline carries on
  const v = mk(); v.llmOn = true; v.clock = 5 * v.dayLen; withRandom(0, () => interestTick(v)); assert.ok(v.cat.interestAsk); v.clock += v.dayLen * 0.3; withRandom(0.5, () => interestTick(v)); assert.ok(interestActive(v) && !v.cat.interestAsk, 'no answer: it chooses for itself');
  // an unusable answer
  const u = mk(); u.llmOn = true; u.clock = 5 * u.dayLen; withRandom(0, () => interestTick(u)); claudeInterest(u, { id: u.cat.interestAsk.id }, { pick: 99, topic: '!!', why: 'x' }); assert.ok(interestActive(u), 'nonsense still ends in an interest');
  const o = mk(); o.llmOn = false; o.clock = 5 * o.dayLen; withRandom(0, () => interestTick(o)); assert.ok(interestActive(o) && !o.cat.interestAsk, 'offline: as before');
  ok('interests: Claude chooses the subject (or invents one), why, and what to look up; they are permanent and it goes deeper each time');
}
{
  // through the Brain, against a fake server: all four, and a note that is answered and acted on
  const w = mk('Tess'); w.llmOn = true; w.easelMade = { day: 1 }; w.cat.needs.create = 0.8; w.stash.items.push({}, {}, {}); w.cat.wants = []; w.stats.collected = 3; w.clock = 5 * w.dayLen;
  const replies = { goal: '{"pick": 1, "why": "Because it is next."}', subject: '{"pick": 2, "why": "It felt right."}', interest: '{"pick": null, "topic": "Lighthouse keepers", "why": "Someone has to.", "angles": ["Lighthouse"]}', note: '{"reaction": "A note. Paper.", "reply": "Yes, I will look at the pond now. Thank you for asking.", "act": 1, "why": "You asked nicely."}' };
  const seen = [];
  const s = JSON.parse(JSON.stringify(DEFAULTS)); s.apiKey = 'k';
  const brain = new Brain({ getSettings: () => s, saveSettings: () => {}, http: async (u, o) => { const t = JSON.parse(o.body).messages[0].content; seen.push(t); const k = /ONE goal/.test(t) ? 'goal' : /about to paint/.test(t) ? 'subject' : /fascinated by next/.test(t) ? 'interest' : /handwritten note/.test(t) ? 'note' : 'other'; return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: replies[k] || '{}' }] }) }; } });
  genWants(w); subjectTick(w); withRandom(0, () => interestTick(w));
  for (let k = 0; k < 5 && w.asks.length; k++) await brain.tick(w, true);
  assert.ok(w.cat.wants.length === 1 && w.cat.wants[0].why, 'a goal was chosen by Claude'); assert.ok(w.cat.art.nextSubject, 'a subject too'); assert.ok(interestActive(w) && w.cat.interest.topic === 'Lighthouse keepers' && w.cat.interest.angles[0] === 'Lighthouse', 'and an interest, with its reasons');
  assert.ok(seen.every(t => !/Mysteries:|Things you remember/.test(t)), 'the small calls use the lean digest');
  // a note: it replies in the chat and does what it suggests
  w.cat.needs.hunger = 0.1; w.cat.pose = 'sit'; w.scoreSnap = Object.assign({}, w.scoreSnap, { gaze: 0.5, fish: 0.4, explore: 0.3 });
  const r = leaveOffering(w, { kind: 'note', text: 'Would you go and look at the pond?' }); const re = inspectOffer(w, r.offer);
  assert.ok(w.asks.some(a => a.type === 'offer')); const before = w.chat.length; await brain.tick(w, true);
  assert.ok(w.chat.length > before && /pond now/.test(w.chat.at(-1).text) && w.chat.at(-1).from === 'cat', 'it answers the note in the chat');
  assert.ok(w.cat.intent && w.cat.intent.by === 'claude' && /note made me want/.test(w.cat.intent.why), 'and decides to do what it suggested: ' + JSON.stringify(w.cat.intent));
  ok('through the Brain: goal, subject, interest and a note that is answered and acted on');
}
console.log('\nALL OK');
