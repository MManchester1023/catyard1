import assert from 'node:assert/strict';
import { makeWorld, tick, advance } from '../src/sim/sim.js';
import { serialize, deserialize, catchUpFromSave, gapAction, GAP_SKIP_SECONDS } from '../src/sim/save.js';
import { runCommand } from '../src/sim/commands.js';
import { userSpeaks, offlineSays } from '../src/sim/chat.js';
import { levelOf } from '../src/sim/art.js';
import { dayOf, hourOf } from '../src/sim/world.js';

const w = makeWorld('Testy');
for (let i = 0; i < 6 * w.dayLen * 10; i++) tick(w, 0.1);
userSpeaks(w, 'Hello Testy, good cat! treat?'); offlineSays(w, 'Hello Testy, good cat! treat?');

const text = serialize(w);
console.log('save size', (text.length / 1024).toFixed(1), 'KB');
const w2 = deserialize(text);
assert.equal(w2.cat.name, 'Testy');
assert.equal(w2.stash.items.length, w.stash.items.length);
assert.equal(w2.cat.art.works.length, w.cat.art.works.length);
assert.equal(levelOf(w2.cat.art.xp), levelOf(w.cat.art.xp));
assert.equal(w2.cat.quirk.item, w.cat.quirk.item);
assert.deepEqual(Object.keys(w2.mysteries), Object.keys(w.mysteries));
assert.equal(w2.chat.length, w.chat.length);
assert.equal(JSON.stringify(w2.cat.wants), JSON.stringify(w.cat.wants));
console.log('round trip ok:', w2.stash.items.length, 'stash items,', w2.cat.art.works.length, 'works,', w2.journal.length, 'journal entries, day', dayOf(w2));

// corrupt and foreign files are rejected, not crashed on
assert.throws(() => deserialize('{"hello":1}'), /Not a Cat Yard save/);
assert.throws(() => deserialize('nope'), SyntaxError);

// offline for 90 minutes
w2.savedAt = Date.now() - 90 * 60 * 1000;
const t0 = performance.now(); const r = catchUpFromSave(w2); const ms = performance.now() - t0;
console.log(`catch-up of ${(r.seconds / 60).toFixed(0)} sim-minutes took ${ms.toFixed(0)}ms:`, r.lines.join(', ') || 'nothing notable', '| days passed', r.days);
assert.ok(ms < 4000);
const t1 = performance.now(); w2.savedAt = Date.now() - 20 * 3600 * 1000; const r2 = catchUpFromSave(w2); console.log(`capped catch-up (20h away) took ${(performance.now() - t1).toFixed(0)}ms, capped=${r2.capped}`);

// while the app is closed (or the computer sleeps) the world is paused unless the player chose otherwise
assert.equal(gapAction(0.03, false), 'step'); assert.equal(gapAction(1.9, false), 'step');
assert.equal(gapAction(30, false), 'catchup', 'a slowed-down background tab still catches up');
assert.equal(gapAction(GAP_SKIP_SECONDS, false), 'catchup'); assert.equal(gapAction(GAP_SKIP_SECONDS + 1, false), 'skip', 'longer than two minutes means it was closed or asleep');
assert.equal(gapAction(8 * 3600, false), 'skip'); assert.equal(gapAction(8 * 3600, true), 'catchup', 'unless the player wants the cat to live on');
console.log('away policy ok');

// commands
const run = (line, admin = true) => runCommand(w2, line, { admin });
assert.match(run('weather rain').lines[0], /rain/); assert.equal(w2.weather.type, 'rain');
assert.match(run('time 22:30').lines[0], /22:3/); assert.ok(Math.abs(hourOf(w2) - 22.5) < 0.05);
assert.match(run('set trait bold 0.9').lines[0], /0.9/); assert.equal(w2.cat.traits.bold, 0.9);
assert.match(run('set need hunger 5').lines[0], /= 1/);
assert.match(run('quirk item feather').lines[0], /feathers/);
assert.match(run('stash steal 2').lines[0], /Took|empty/);
assert.match(run('tp pond').lines[0], /pond/);
assert.match(run('speed 4').lines[0], /4x/); assert.equal(w2.speed, 4);
assert.match(run('nonsense').lines[0], /Unknown/);
assert.match(run('weather clear', false).lines[0], /Admin mode is off/);
assert.equal(run('save backup').action.slot, 'backup');
assert.match(run('reset').lines[0], /confirm/); assert.equal(run('reset confirm').action.type, 'reset');
assert.match(run('want add "find the red cap"').lines[0], /added/);
assert.ok(run('help').lines[0].includes('Commands'));
advance(w2, 0.5); // speed 4 path
console.log('commands ok');
console.log('\nstatus:\n' + run('status').lines.join('\n'));
console.log('\nALL OK');
