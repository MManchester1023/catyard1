// Gifts: bark, twigs and string can no longer be given (old saves are tidied), and there are two toys, a ball and a toy
// mouse, that can only come as a gift: each is given once, the cat takes it into the yard, plays with it like the yarn,
// and it lowers the urge to make things.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { start } from '../src/sim/acts.js';
import { decide } from '../src/sim/mind.js';
import { leaveOffering, inspectOffer, finishOffer, offerLabel } from '../src/sim/offerings.js';
import { runCommand } from '../src/sim/commands.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { blocked } from '../src/sim/world.js';
import { seedTests } from '../src/sim/rng.js';
seedTests(1);

const ok = m => console.log('  ok ' + m);
const KNOWN = { pond: 1, post: 1, tree: 1, flowers: 1, cushion: 1, yarn: 1, fence: 1, easel: 1, tablet: 1 };
const calm = w => { // a quiet, dry afternoon with nothing else going on
  const c = w.cat; w.netOn = false; w.clock = 0.4 * w.dayLen; w.weather.type = 'clear'; w.weather.rain = 0; w.weather.timer = 1e9; w.mice = []; w.items = []; w.treats = []; w.offers = [];
  w.thiefT = 1e9; w.itemT = 1e9; w.mouseT = 1e9; w.birds.forEach(b => (b.state = 'away')); Object.assign(c.mem.known, KNOWN); c.wants = [];
  Object.assign(c.needs, { hunger: 0.2, thirst: 0.2, tired: 0.1, fun: 0.7, dirty: 0.1, wet: 0, lonely: 0.1, create: 0.2, fear: 0 }); return w;
};
const fresh = () => calm(makeWorld('Toy'));

{
  // materials cannot be given, however it is asked
  const w = fresh();
  const r = leaveOffering(w, { kind: 'material', type: 'twine' }); assert.equal(r.ok, false); assert.match(r.error, /cannot be given/);
  assert.equal(w.offers.length, 0, 'nothing is left on the mat');
  assert.match(runCommand(w, 'offer material bark', { admin: false }).lines.join(' '), /cannot be given/);
  assert.match(runCommand(w, 'give twine', { admin: false }).lines.join(' '), /Toys/, 'and "give" is for toys now');
  ok('bark, twigs and string cannot be left on the mat, from the tab or the chat');
}
{
  // a toy: refused names, aliases, one at a time, once only
  const w = fresh();
  assert.equal(leaveOffering(w, { kind: 'toy', type: 'sofa' }).ok, false);
  const a = leaveOffering(w, { kind: 'toy', type: 'mouse' }); assert.ok(a.ok && a.offer.type === 'toymouse' && /toy mouse/.test(offerLabel(a.offer)), '"mouse" means the toy mouse');
  assert.match(leaveOffering(w, { kind: 'toy', type: 'toymouse' }).error, /already on the mat/);
  const b = leaveOffering(w, { kind: 'toy', type: 'ball' }); assert.ok(b.ok);
  ok('toys: unknown names refused, "mouse" works, and the same toy is not left twice');
}
{
  // it looks it over, likes it, and carries it into the yard, where it stays
  const w = fresh(), c = w.cat; assert.deepEqual(w.toys, { ball: null, toymouse: null });
  const { offer } = leaveOffering(w, { kind: 'toy', type: 'ball' });
  const re = inspectOffer(w, offer); assert.ok(re.liking > 0.5 && re.keep, 'a toy is almost always welcome: ' + re.liking.toFixed(2));
  assert.ok(c.thought && /ball|round|roll/i.test(c.thought), 'and it says something about it: ' + c.thought);
  assert.equal(finishOffer(w, offer), false, 'a toy does not go in the stash');
  assert.ok(w.toys.ball && w.toys.ball.day === 1 && w.offers.length === 0, 'it is in the yard now');
  assert.ok(w.log.some(e => /carried a ball/.test(e.text)) && w.journal.some(e => e.tag === 'toy'));
  assert.match(leaveOffering(w, { kind: 'toy', type: 'ball' }).error, /already has a ball/, 'one ball is plenty');
  assert.ok(leaveOffering(w, { kind: 'toy', type: 'toymouse' }).ok, 'the other toy is still possible');
  ok('the cat looks over a toy, likes it, takes it into the yard, and cannot be given a second one');
}
{
  // the whole thing, through the simulation: left on the mat, found, taken
  const w = fresh(); leaveOffering(w, { kind: 'toy', type: 'toymouse' });
  for (let i = 0; i < 4000 && !w.toys.toymouse; i++) tick(w, 0.25);
  assert.ok(w.toys.toymouse, 'it noticed the toy on the mat and took it');
  ok('left alone, it notices a toy on the mat and takes it into the yard');
}
{
  // before it is given, the cat knows nothing of it; afterwards it plays with it
  const none = fresh(), kinds = new Set(); for (let i = 0; i < 400; i++) { none.cat.needs.fun = 0.7; const d = decide(none, null); kinds.add(d.type === 'play' ? 'play:' + d.opts.kind : d.type); }
  assert.ok(!kinds.has('play:ball') && !kinds.has('play:toymouse'), 'no toys, no toy play');
  const w = fresh(); w.toys.ball = { day: 1 }; w.toys.toymouse = { day: 1 }; const seen = new Set(); Object.assign(w.cat.traits, { curious: 0.5, bold: 0.5, lazy: 0.1 }); // (a fixed temperament, so the result does not depend on the seed)
  for (let i = 0; i < 3000; i++) { w.cat.needs.fun = 0.7; w.cat.postAt = w.dayLen * 0.4; w.cat.needs.tired = 0.1; w.clock = 0.4 * w.dayLen; const d = decide(w, null); if (d.type === 'play') seen.add(d.opts.kind); }
  assert.ok(seen.has('ball') && seen.has('toymouse'), 'once it has them it plays with them: ' + [...seen].join(','));
  ok('it only plays with toys it has been given');
}
{
  // playing with a toy: it chases it, bats it about, and works off some of the urge to make things
  for (const type of ['ball', 'toymouse']) {
    const w = fresh(), c = w.cat; w.toys[type] = { day: 1 }; c.needs.create = 0.9; const o = w.o[type], x0 = o.x, y0 = o.y, fun0 = c.needs.fun, urge0 = c.needs.create;
    start(w, 'play', { kind: type, own: true }); let moved = false;
    for (let i = 0; i < 160; i++) { c.reeval = 1e9; tick(w, 0.1); if (Math.hypot(o.x - x0, o.y - y0) > 20) moved = true; }
    assert.ok(moved, `the ${type} gets batted about`); assert.ok(c.needs.fun < fun0, 'it is less bored');
    assert.ok(urge0 - c.needs.create > 0.05, `and the urge to make things eases: ${(urge0 - c.needs.create).toFixed(3)}`);
  }
  // the ball rolls on; the mouse stops short
  const w = fresh(); w.toys.ball = w.toys.toymouse = { day: 1 }; const b = w.o.ball, m = w.o.toymouse; Object.assign(b, { x: 300, y: 450, vx: 260, vy: 0 }); Object.assign(m, { x: 300, y: 500, vx: 260, vy: 0 });
  for (let i = 0; i < 40; i++) tick(w, 0.1); assert.ok(b.x - 300 > (m.x - 300) * 1.2, `the ball rolls further: ${(b.x - 300).toFixed(0)} against ${(m.x - 300).toFixed(0)}`);
  ok('playing with a toy: it chases and bats it, the ball rolls on and the mouse stops short, and it eases the urge to make things');
}
{
  // they lie in open ground, and a save keeps them
  const w = fresh(); assert.ok(!blocked(w, w.o.ball.x, w.o.ball.y) && !blocked(w, w.o.toymouse.x, w.o.toymouse.y), 'neither starts inside something');
  w.toys.ball = { day: 2, from: 'gift' }; const back = deserialize(serialize(w)); assert.deepEqual(back.toys, { ball: { day: 2, from: 'gift' }, toymouse: null });
  const old = JSON.parse(serialize(w)); delete old.w.toys; assert.deepEqual(deserialize(JSON.stringify(old)).toys, { ball: null, toymouse: null }, 'an older save has no toys');
  ok('the toys start in open ground and a save keeps them (older saves have none)');
}
{
  // a save from when bark, twigs and string could be given: what is on the mat goes to the cat, requests for them are over
  const w = fresh(); w.cat.wishes.unshift({ id: 'w1', state: 'open', day: 1, kind: 'material', type: 'twine', recipe: 'chime', text: 'Please could you leave me some twine?', written: { day: 1, time: '10:00' } }, { id: 'w2', state: 'draft', day: 1, kind: 'material', type: 'bark', text: 'bark please' }, { id: 'w3', state: 'open', day: 1, kind: 'item', type: 'marble', color: null, text: 'a marble', written: { day: 1, time: '10:00' } });
  const s = JSON.parse(serialize(w)); s.w.offers = [{ id: 'o1', slot: 0, day: 1, at: 0, state: 'new', kind: 'material', type: 'twine', n: 1 }, { id: 'o2', slot: 1, day: 1, at: 0, state: 'new', kind: 'item', type: 'button', color: 'red' }];
  const twine0 = s.cat.inv.twine || 0; const back = deserialize(JSON.stringify(s));
  assert.deepEqual(back.offers.map(o => o.id), ['o2'], 'the bundle is gone from the mat'); assert.equal(back.cat.inv.twine, twine0 + 1, 'the cat has it');
  const st = id => back.cat.wishes.find(x => x.id === id).state; assert.equal(st('w1'), 'faded'); assert.equal(st('w2'), 'faded'); assert.equal(st('w3'), 'open', 'an object wish is untouched');
  assert.ok(!back.cat.upset, 'and nobody is upset about it');
  ok('an old save loses material gifts and requests quietly: the cat keeps what was on the mat');
}

console.log('\nALL OK');
