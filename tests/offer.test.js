// Offerings: leaving things on the mat, the cat's reaction, drifting tastes, notes, commands, saving.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { leaveOffering, inspectOffer, finishOffer, wonderAbout, pendingOffer, MAX_ON_MAT } from '../src/sim/offerings.js';
import { runCommand } from '../src/sim/commands.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { seedTests, withRandom, setRandom } from '../src/sim/rng.js';
seedTests(1); // (every world here gets a fixed seed, so this test gives the same result every run)

const ok = (name) => console.log('  ok', name);
const run = (w, s) => { for (let t = 0; t < s; t += 0.1) tick(w, 0.1); };

// ---- leaving things
{
  const w = makeWorld('Tess');
  const r = leaveOffering(w, { kind: 'item', type: 'button', color: 'green' });
  assert(r.ok && w.offers.length === 1 && r.offer.slot === 0);
  assert(leaveOffering(w, { kind: 'note', text: '  hello   there \n friend ' }).offer.text === 'hello there friend');
  assert(leaveOffering(w, { kind: 'item' }).ok);
  const full = leaveOffering(w, { kind: 'item', type: 'marble', color: 'red' });
  assert(!full.ok && /full/.test(full.error) && w.offers.length === MAX_ON_MAT);
  assert(!leaveOffering(makeWorld('A'), { kind: 'note', text: '   ' }).ok);
  assert(!leaveOffering(makeWorld('B'), { kind: 'item', type: 'sofa' }).ok);
  assert(!leaveOffering(makeWorld('C'), { kind: 'item', type: 'marble', color: 'plaid' }).ok);
  assert(leaveOffering(makeWorld('D'), { kind: 'note', text: 'x'.repeat(500) }).offer.text.length === 140);
  ok('leaving objects and notes, limits and validation');
}

// ---- the cat finds it, reacts, and takes what it loves
{
  const w = makeWorld('Tess'); const c = w.cat;
  c.quirk.item = 'marble'; c.quirk.favColor = 'purple'; c.tastes.color.purple = 0.9; c.tastes.type.marble = 0.9;
  const { offer } = leaveOffering(w, { kind: 'item', type: 'marble', color: 'purple' });
  assert(!pendingOffer(w), 'it waits a few seconds before the cat notices');
  const found0 = w.stats.found; w.items = []; w.pending = [];
  run(w, 240);
  assert(offer.state !== 'new', 'cat looked at it');
  assert(c.offerHist.length === 1 && c.offerHist[0].tier === 'delight', 'delighted: ' + JSON.stringify(c.offerHist[0]));
  assert(w.journal.some(e => e.tag === 'offering'));
  run(w, 200);
  assert(offer.keep === true && w.stats.found > found0, 'it chose to keep it');
  assert(w.stash.items.some(i => i.type === 'marble' && i.color === 'purple'), 'loved gift went to the stash');
  assert(!w.offers.length, 'mat is clear');
  ok('cat notices, reacts, and stashes a gift it loves');
}

// ---- something it does not care for is left on the mat, then tidied away
{
  const w = makeWorld('Tess'); const c = w.cat;
  c.quirk.item = 'feather'; c.quirk.favColor = 'blue'; c.bond = 0; for (const k of Object.keys(c.tastes.color)) c.tastes.color[k] = 0.05; for (const k of Object.keys(c.tastes.type)) c.tastes.type[k] = 0.05; c.tastes.color.blue = 0.9; c.tastes.type.feather = 0.9;
  const { offer } = leaveOffering(w, { kind: 'item', type: 'marble', color: 'yellow' });
  w.stash.items.push({ id: 'z', type: 'marble', color: 'yellow', ox: 0, oy: 0, rot: 0 });
  run(w, 240);
  assert(offer.state === 'left' && w.offers.includes(offer), 'turned down: ' + offer.state);
  run(w, w.dayLen * 0.8);
  assert(!w.offers.includes(offer), 'declined offering was cleared away');
  ok('an unwanted gift is left, then cleared away');
}

// ---- tastes drift slowly
{
  const w = makeWorld('Tess'); const c = w.cat;
  c.quirk.item = 'bottlecap'; c.quirk.favColor = 'red'; c.tastes = JSON.parse(JSON.stringify(c.tastes)); c.tastes.color.red = 0.75; c.tastes.color.pink = 0.3;
  const changes = [];
  for (let i = 1; i <= 14; i++) {
    const { offer } = leaveOffering(w, { kind: 'item', type: 'marble', color: 'pink' }); inspectOffer(w, offer); w.offers = [];
    if (c.quirk.favColor !== 'red') { changes.push(i); break; }
  }
  assert(changes.length && changes[0] >= 3, 'favourite colour changed, but not at once: after gift ' + changes[0]);
  assert(w.cat.assoc['color:pink'].n >= 5 && w.cat.assoc['color:pink'].v > 0, 'because pink kept making it feel good');
  assert(c.quirk.favColor === 'pink' && w.journal.some(e => e.tag === 'taste'));
  // and the thing it collects changes only after a good many gifts
  const w2 = makeWorld('Tess'); w2.cat.quirk.item = 'bottlecap'; w2.cat.tastes.type.bottlecap = 0.75;
  for (let i = 1; i <= 3; i++) { w2.cat.needs.lonely = 0.5; const { offer } = leaveOffering(w2, { kind: 'item', type: 'feather', color: 'white' }); inspectOffer(w2, offer); w2.offers = []; }
  assert(w2.cat.quirk.item === 'bottlecap', 'three feathers do not change what it collects');
  for (let i = 1; i <= 20 && w2.cat.quirk.item === 'bottlecap'; i++) { w2.cat.needs.lonely = 0.5; /* time passes between gifts */ const { offer } = leaveOffering(w2, { kind: 'item', type: 'feather', color: 'white' }); inspectOffer(w2, offer); w2.offers = []; }
  assert(w2.cat.quirk.item === 'feather', 'many gifts eventually do');
  ok('tastes follow feelings: colour after several good gifts, collected item only after many');
}

// ---- notes
{
  const w = makeWorld('Tess'); const c = w.cat;
  const { offer } = leaveOffering(w, { kind: 'note', text: 'You are a good cat. I love the lighthouse paintings.' });
  const joy0 = c.mood.joy; const re = inspectOffer(w, offer);
  assert(re.liking >= 0.6 && c.mood.joy > joy0, 'kind words please it');
  assert(c.words.lighthouse >= 1 || c.words.paintings >= 1, 'it learned words from the note');
  finishOffer(w, offer);
  assert(c.keepsakes.length === 1 && c.keepsakes[0].text.includes('lighthouse') && !w.offers.length);
  setRandom(() => 0.1);
  c.wants = []; const want = wonderAbout(w, 'The lighthouse keeper sailed away'); setRandom(null);
  assert(want && want.kind === 'lookup' && want.word === 'lighthouse' && /find out what "lighthouse" is/.test(want.text), JSON.stringify(want));
  const mean = leaveOffering(w, { kind: 'note', text: 'I hate you, you stupid cat' }).offer; const m = inspectOffer(w, mean);
  assert(m.tier === 'meh' || m.tier === 'curious', 'unkind words land differently: ' + m.tier);
  ok('notes: read, kept, words learned, and a word can become something to look up');
}

// ---- admin-free command, clearing needs admin
{
  const w = makeWorld('Tess');
  assert(/Left/.test(runCommand(w, 'offer item marble red', { admin: false }).lines[0]) && w.offers.length === 1);
  assert(/note/.test(runCommand(w, 'offer note hello there', { admin: false }).lines[0]));
  assert(/mat|marble/.test(runCommand(w, 'offer list', { admin: false }).lines.join(' ')));
  assert(/Admin mode is off/.test(runCommand(w, 'offer clear', { admin: false }).lines[0]) && w.offers.length === 2);
  assert(/Cleared 2/.test(runCommand(w, 'offer clear', { admin: true }).lines[0]) && !w.offers.length);
  assert(/colours:/.test(runCommand(w, 'tastes', { admin: false }).lines[0]));
  assert(/Admin mode is off/.test(runCommand(w, 'tablet go', { admin: false }).lines[0]));
  ok('offer command works without admin; clear needs admin');
}

// ---- saving keeps everything
{
  const w = makeWorld('Tess'); w.cat.tastes.color.teal = 0.66; leaveOffering(w, { kind: 'note', text: 'remember me' }); const { offer } = leaveOffering(w, { kind: 'item', type: 'bottlecap', color: 'teal' });
  w.cat.keepsakes.push({ id: 'k', text: 'old note', day: 1 }); w.cat.offerHist.push({ id: 'h', day: 1, time: '10:00', kind: 'note', label: 'x', liking: 0.5, tier: 'pleased', text: 't' });
  const w2 = deserialize(serialize(w));
  assert(w2.offers.length === 2 && w2.offers[1].color === 'teal' && w2.offers[0].text === 'remember me');
  assert(w2.cat.tastes.color.teal === 0.66 && w2.cat.keepsakes[0].text === 'old note' && w2.cat.offerHist[0].tier === 'pleased');
  // a save from before offerings existed still loads, with tastes built from its quirk
  const old = JSON.parse(serialize(w)); delete old.cat.tastes; delete old.cat.keepsakes; delete old.cat.offerHist; delete old.w.offers; delete old.w.tablet; old.version = 1;
  const w3 = deserialize(JSON.stringify(old));
  assert(w3.cat.tastes.color[w3.cat.quirk.favColor] === 0.75 && Array.isArray(w3.offers) && w3.tablet && Array.isArray(w3.tablet.pages), 'old save upgraded');
  ok('save round trip, and an older save upgrades cleanly');
}
console.log('\nALL OK');
