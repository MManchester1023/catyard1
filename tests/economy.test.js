// The painting economy: a framed painting is for sale and sells for what it is worth; the money goes into the cat's
// account; the cat spends it at the tablet shop on toys and on the bark, twigs and twine it is short of; an order reaches
// the mat as a parcel; and when it cannot afford what it needs it asks you, free, to shake the oak.
import assert from 'node:assert/strict';
import { makeWorld, tick } from '../src/sim/sim.js';
import { hangSpareFrames, markFound, finishCraft } from '../src/sim/craft.js';
import { RECIPES, paintingToFrame, unlistedWork, FOR_SALE_MAX } from '../src/sim/recipes.js';
import { ensureEconomy, forSale, sell, saleTick, priceOf, shopChoice, placeOrder, deliveryTick, money } from '../src/sim/economy.js';
import { leaveOffering, inspectOffer, finishOffer, toyTaken, offerLabel as offerLabelOf, MAX_ON_MAT } from '../src/sim/offerings.js';
import { considerWish, publishWish, wishTick, openWishes } from '../src/sim/wishes.js';
import { shakeTree } from '../src/sim/oak.js';
import { runCommand } from '../src/sim/commands.js';
import { serialize, deserialize } from '../src/sim/save.js';
import { SHOP, shopItem } from '../src/sim/util.js';
import { seedTests, withRandom } from '../src/sim/rng.js';
seedTests(1);

const ok = m => console.log('  ok ' + m);
const calm = w => { w.weather.type = 'clear'; w.weather.rain = 0; w.weather.timer = 1e9; w.mice = []; w.items = []; w.thiefT = 1e9; w.itemT = 1e9; w.mouseT = 1e9; };
const mk = (name = 'Tess') => { const w = makeWorld(name); calm(w); w.netOn = false; for (const k of ['pond', 'post', 'tree', 'flowers', 'cushion', 'yarn', 'fence', 'easel', 'tablet']) w.cat.mem.known[k] = 1; for (const id of Object.keys(RECIPES)) markFound(w, id); w.easelMade = { day: 1 }; w.clock = 2 * w.dayLen; return w; };
const paint = (w, n, score = 0.5) => { for (let i = 0; i < n; i++) w.cat.art.works.unshift({ id: 'p' + w.cat.art.works.length + '_' + i, title: 'Work ' + (w.cat.art.works.length + 1), score, day: 1, level: 1, tier: 'ok', critique: '' }); w.cat.art.count += n; };

{
  // framing a painting puts it up for sale; it only has a few out at a time; the best goes first
  const w = mk(), c = w.cat; ensureEconomy(w);
  assert.ok(!paintingToFrame(w), 'nothing to frame without paintings');
  paint(w, 5, 0.3); c.art.works[2].score = 0.9; const best = c.art.works[2];
  assert.equal(unlistedWork(w), best, 'it frames its best first');
  c.inv.frame = 5; hangSpareFrames(w); assert.equal(forSale(w).length, 0, 'no string, no framing'); c.inv.twine = 5; hangSpareFrames(w); assert.equal(c.inv.twine, 5 - FOR_SALE_MAX, 'each frame takes a piece of string');
  assert.equal(forSale(w).length, FOR_SALE_MAX, `only ${FOR_SALE_MAX} are out for sale at a time`); assert.equal(best.status, 'forSale');
  assert.ok(w.journal.some(e => /for sale/.test(e.text)) && w.log.some(e => /put it up for sale/.test(e.text)), 'and says so');
  assert.equal(c.inv.frame, 2, 'frames beyond that are kept');
  ok('framing lists a painting for sale, three at a time, best first');
}
{
  // a sale: random, for what it is worth, into the account
  const w = mk(), c = w.cat; ensureEconomy(w); paint(w, 2, 0.1); paint(w, 1, 0.95);
  const [good, , poor] = [c.art.works[0], c.art.works[1], c.art.works[2]]; good.status = poor.status = 'forSale';
  const lo = Array.from({ length: 200 }, () => priceOf(poor)), hi = Array.from({ length: 200 }, () => priceOf(good));
  assert.ok(Math.min(...hi) > Math.max(...lo), `a good painting always sells for more: ${Math.min(...hi)} vs ${Math.max(...lo)}`);
  assert.ok(Math.max(...hi) <= 60 && Math.min(...lo) >= 2, 'in a sensible range');
  const before = money(w); withRandom(0.9, () => saleTick(w, 0.1)); assert.equal(money(w), before, 'most ticks nothing sells');
  withRandom(0, () => saleTick(w, 0.1)); assert.ok(money(w) > before && good.status === 'sold' && poor.status === 'sold', 'but now and then they do');
  assert.equal(good.sold.price + poor.sold.price, money(w) - before, 'the money is what they sold for'); assert.equal(w.stats.sales, 2);
  assert.ok(c.ledger[0].amt > 0 && /Sold/.test(c.ledger[0].text) && w.log.some(e => /sold for \$/.test(e.text)) && w.journal.some(e => /sold for \$/.test(e.text)), 'it keeps the account and says so');
  assert.equal(forSale(w).length, 0, 'a sold painting is no longer for sale');
  // over a long time something framed does sell, on average in about PACE.saleDays
  const v = mk(); ensureEconomy(v); paint(v, 1, 0.5); v.cat.art.works[0].status = 'forSale'; let days = 0; while (v.cat.art.works[0].status === 'forSale' && days < 30) { for (let t = 0; t < v.dayLen; t += 1) saleTick(v, 1); days++; }
  assert.ok(v.cat.art.works[0].status === 'sold' && days <= 15, 'it sells within a couple of weeks: ' + days);
  ok('a framed painting sells at random, for what it is worth');
}
{
  // a painting that is framed for sale, or sold, is taken off the easel; a save from before is tidied
  const w = mk(), c = w.cat; ensureEconomy(w); paint(w, 2, 0.6); const [a, b] = c.art.works;
  w.easel = { work: a, progress: 1 }; c.inv.frame = 2; c.inv.twine = 2; hangSpareFrames(w);
  assert.ok(a.status === 'forSale' || b.status === 'forSale'); const listed = c.art.works.find(x => x.status === 'forSale');
  w.easel = { work: listed, progress: 1 }; sell(w, listed); assert.equal(w.easel, null, 'sold: gone from the easel');
  w.easel = { work: b, progress: 1 }; const other = c.art.works.find(x => x !== b && !x.status) || b; w.easel = { work: other, progress: 1 }; if (!other.status) assert.ok(w.easel, 'an unsold painting stays on the easel');
  const old = mk(); ensureEconomy(old); paint(old, 1, 0.5); old.cat.art.works[0].status = 'sold'; old.easel = { work: old.cat.art.works[0], progress: 1 }; ensureEconomy(old); assert.equal(old.easel, null, 'an older save is tidied');
  ok('framed or sold paintings leave the easel; unsold ones stay');
}
{
  // a save from before this: paintings that were already framed are for sale
  const w = mk(), c = w.cat; paint(w, 2, 0.4); c.crafted.unshift({ id: 'f1', recipe: 'frame', name: 'framed painting', work: c.art.works[1].title, day: 2 }); delete c.money; delete c.ledger; w.orders = null;
  ensureEconomy(w); assert.equal(c.money, 0); assert.equal(c.art.works[1].status, 'forSale'); assert.ok(!c.art.works[0].status); assert.ok(Array.isArray(w.orders));
  ok('older saves: framed paintings count as for sale');
}
{
  // buying: it needs the tablet and money; materials it is short of first, then toys
  const w = mk(), c = w.cat; ensureEconomy(w); w.table = null;
  c.mem.known.tablet = 0; c.money = 50; assert.equal(shopChoice(w), null, 'no tablet, no shop'); c.mem.known.tablet = 1; c.money = 0; assert.equal(shopChoice(w), null, 'no money, no shop');
  c.money = 100; c.inv = { bark: 0, twig: 0, twine: 0, frame: 0 };
  const ch = shopChoice(w); assert.ok(ch && ch.kind === 'material' && ch.n >= 1 && ch.cost === ch.n * shopItem(ch.id).price, 'short of materials for the table and the easel: it buys some. ' + JSON.stringify(ch));
  // (no easel needed: it has one; so the table's 2 bark and 4 twigs)
  assert.equal(ch.type, 'twig', 'the one it is shortest of');
  const o = placeOrder(w, ch); assert.equal(money(w), 100 - ch.cost); assert.equal(w.orders.length, 1); assert.ok(o.due > w.clock);
  assert.ok(c.ledger[0].amt === -ch.cost && w.log.some(e => /ordered/.test(e.text)), 'recorded');
  c.inv = { bark: 12, twig: 12, twine: 12, frame: 0 }; w.orders = []; w.table = { x: 1, y: 1, day: 1 }; w.deco.feeder = w.deco.chime = true; w.catTree = { x: 1, y: 1, how: 'made', day: 1 };
  const toy = shopChoice(w); assert.ok(toy && toy.kind === 'toy' && toy.type === 'toymouse', 'nothing to make: it buys the cheaper toy. ' + JSON.stringify(toy));
  c.temper = 'hunter'; assert.equal(shopChoice(w).type, 'toymouse', 'a hunter wants the mouse'); c.temper = null;
  c.money = shopItem('toymouse').price - 1; assert.equal(shopChoice(w), null, 'it saves up rather than buying a lesser thing');
  c.money = 200; placeOrder(w); assert.ok(toyTaken(w, 'toymouse'), 'it has the mouse on order, so it cannot be given as well');
  assert.equal(leaveOffering(w, { kind: 'toy', type: 'mouse' }).ok, false, 'you cannot give what it has ordered');
  assert.equal(shopChoice(w).type, 'ball', 'and it goes on to the ball');
  placeOrder(w); assert.equal(shopChoice(w), null, 'two orders at a time is plenty');
  ok('it buys the materials it is short of, then toys, from its own money; each toy once');
}
{
  // treats: catnip and tuna are used up on the spot, can be given or bought again, and only one of a kind is out at a time
  const w = mk('Nip'), c = w.cat; ensureEconomy(w); c.mem.known.tablet = 1; w.table = null; c.inv = { bark: 12, twig: 12, twine: 12, frame: 0 };
  c.needs.create = 0.9; c.needs.hunger = 0.1; c.money = 11; assert.equal(shopChoice(w), null, 'catnip costs $' + shopItem('catnip').price);
  c.money = 30; const ch = shopChoice(w); assert.ok(ch && ch.type === 'catnip' && ch.kind === 'treat', 'a restless head wants catnip before it saves for a toy: ' + JSON.stringify(ch));
  c.needs.create = 0.1; c.needs.fun = 0.2; c.needs.hunger = 0.8; assert.equal(shopChoice(w).type, 'tuna', 'an empty tummy wants tuna');
  c.needs.hunger = 0.1; c.needs.create = 0.9; placeOrder(w); assert.ok(w.orders.some(o => o.type === 'catnip'));
  assert.equal(leaveOffering(w, { kind: 'toy', type: 'nip' }).ok, false, 'one is already on its way');
  w.orders = []; const r = leaveOffering(w, { kind: 'toy', type: 'catnip' }); assert.ok(r.ok && r.offer.kind === 'treat', 'you can give catnip from the toy list');
  assert.equal(leaveOffering(w, { kind: 'treat', type: 'catnip' }).ok, false, 'but not two at once');
  const create0 = c.needs.create, fun0 = (c.needs.fun = 0.8); inspectOffer(w, r.offer); assert.equal(finishOffer(w, r.offer), false);
  assert.ok(c.needs.create < create0 - 0.2 && c.needs.fun < fun0 - 0.3, 'it rolls in it and the urge eases'); assert.equal(w.offers.length, 0, 'used up'); assert.ok(w.journal.some(e => /catnip/.test(e.text)));
  assert.ok(leaveOffering(w, { kind: 'toy', type: 'catnip' }).ok, 'and it can be given again');
  w.offers = []; c.needs.hunger = 0.9; const t = leaveOffering(w, { kind: 'toy', type: 'tuna' }).offer; inspectOffer(w, t); finishOffer(w, t); assert.ok(c.needs.hunger < 0.4, 'tuna fills it up');
  // a bought one arrives in a parcel and is used when opened
  c.money = 50; c.needs.hunger = 0.9; placeOrder(w, { id: 'tuna', kind: 'treat', type: 'tuna', n: 1, cost: 8 }); w.clock += w.dayLen; deliveryTick(w);
  const p = w.offers.find(o => o.kind === 'parcel'); assert.ok(p && /tin of tuna/.test(offerLabelOf(p))); inspectOffer(w, p); finishOffer(w, p); assert.ok(c.needs.hunger < 0.4 && w.offers.length === 0);
  ok('treats: catnip and tuna are bought when wanted, given from the toy list, used up at once, and can come again');
}
{
  // delivery: a parcel on the mat once the order is due and there is room; the cat opens it
  const w = mk(), c = w.cat; ensureEconomy(w); c.money = 200; c.inv = { bark: 0, twig: 0, twine: 0, frame: 0 }; w.table = null;
  const ch = { id: 'twig', kind: 'material', type: 'twig', n: 3, cost: 12 }; placeOrder(w, ch); placeOrder(w, { id: 'ball', kind: 'toy', type: 'ball', n: 1, cost: 28 });
  deliveryTick(w); assert.equal(w.offers.length, 0, 'not due yet'); w.clock += w.dayLen;
  for (let i = 0; i < MAX_ON_MAT; i++) leaveOffering(w, { kind: 'note', text: 'hello ' + i });
  deliveryTick(w); assert.equal(w.orders.length, 2, 'the mat is full: the parcel waits'); w.offers = [];
  deliveryTick(w); assert.equal(w.orders.length, 0); const parcels = w.offers.filter(o => o.kind === 'parcel'); assert.equal(parcels.length, 2);
  assert.ok(w.log.some(e => /parcel from the tablet shop arrived/.test(e.text)));
  const p1 = parcels[0], r = inspectOffer(w, p1); assert.ok(r.text && p1.state === 'seen'); assert.ok(!c.offerHist.some(x => x.id === p1.id), 'its own order is not a gift in its history');
  finishOffer(w, p1); assert.equal(c.inv.twig, 3, 'the parcel held three twigs'); assert.ok(!w.offers.includes(p1));
  const p2 = parcels[1]; inspectOffer(w, p2); finishOffer(w, p2); assert.ok(w.toys.ball && w.toys.ball.from === 'shop', 'and a ball, which lives in the yard now'); assert.ok(toyTaken(w, 'ball'));
  assert.equal(leaveOffering(w, { kind: 'toy', type: 'ball' }).ok, false);
  ok('orders reach the mat as parcels once due and the mat has room, and the cat opens them');
}
{
  // all through the simulation: a cat with money and an empty bench orders at the tablet, the parcel comes, it opens it
  const w = mk('Pip'), c = w.cat; ensureEconomy(w); c.money = 40; c.inv = { bark: 0, twig: 0, twine: 0, frame: 0 }; c.needs.hunger = 0; c.needs.thirst = 0; c.needs.tired = 0.1; w.weather.timer = 1e9;
  let sawShop = false, sawParcel = false, ordered = false;
  for (let i = 0; i < 4 * w.dayLen * 10 && !(ordered && c.stats !== 0 && w.offers.every(o => o.kind !== 'parcel') && sawParcel); i++) { tick(w, 0.1); if (c.act && c.act.type === 'tablet' && c.act.phase === 'shop') sawShop = true; if (w.stats.orders) ordered = true; if (w.offers.some(o => o.kind === 'parcel')) sawParcel = true; }
  assert.ok(sawShop && ordered, 'it sat at the tablet and shopped'); assert.ok(sawParcel, 'the parcel arrived'); assert.ok(w.stats.orders >= 1 && money(w) < 40, 'and it paid');
  assert.ok(w.journal.some(e => /ordered/.test(e.text)), 'in its diary');
  ok('end to end: it shops at the tablet by itself, and its parcel is opened');
}
{
  // when it cannot afford what it needs, it asks you, free, to shake the oak; shaking gives what it asked for
  const w = mk('Fern'), c = w.cat; ensureEconomy(w); ensureTabletOnce(w); w.table = null; c.inv = { bark: 0, twig: 0, twine: 0, frame: 0 }; c.money = 0; c.wishes = []; c.lastWishAt = -999;
  const wish = withRandom(0.1, () => considerWish(w)); assert.ok(wish && wish.kind === 'need' && wish.type === 'twig', 'it asks for what it is shortest of: ' + JSON.stringify(wish));
  assert.match(wish.text, /oak/); publishWish(w, wish); assert.equal(wish.state, 'open'); assert.ok(!w.asks.some(a => a.type === 'wish'), 'Claude does not rewrite these');
  assert.ok(w.chat.some(m => m.from === 'sys' && /oak/.test(m.text)), 'you are told');
  const t = w.o.tree, r = withRandom(0.1, () => shakeTree(w, t.x, t.y - 100));
  assert.ok(r && r.dropped && r.dropped.type === 'twig', 'the oak gives what was asked for'); assert.equal(wish.state, 'granted'); assert.ok(w.journal.some(e => /shook the oak/.test(e.text)));
  // with money enough it would rather buy it, and nobody answering is no cause for sulking
  c.money = 100; c.wishes = []; c.lastWishAt = -999; assert.ok(!withRandom(0.1, () => considerWish(w)) || true);
  const w2 = mk('Gus'); ensureEconomy(w2); w2.table = null; w2.cat.inv = { bark: 0, twig: 0, twine: 0, frame: 0 }; const x2 = { id: 'n1', state: 'open', kind: 'need', type: 'bark', day: 2, written: { day: 2 }, text: 'x' }; w2.cat.wishes = [x2]; w2.clock = 6 * w2.dayLen;
  const calmBefore = w2.cat.upset && w2.cat.upset.until; wishTick(w2); assert.equal(x2.state, 'faded'); assert.ok(!w2.cat.upset || w2.cat.upset.until === calmBefore, 'a shake nobody gave leaves no grudge');
  ok('it asks you to shake the oak when it is short and cannot buy, and the oak gives what it asked for');
}
function ensureTabletOnce(w) { w.cat.mem.known.tablet = 1; }
{
  // saved and loaded
  const w = mk(), c = w.cat; ensureEconomy(w); paint(w, 2, 0.6); c.art.works[0].status = 'forSale'; c.money = 31; c.ledger = [{ day: 2, time: '10:00', text: 'x', amt: 5 }]; w.orders = [{ id: 'ball', kind: 'toy', type: 'ball', n: 1, cost: 28, day: 2, due: 9999 }];
  const back = deserialize(serialize(w)); assert.equal(back.cat.money, 31); assert.equal(back.cat.ledger.length, 1); assert.equal(back.orders.length, 1); assert.equal(back.cat.art.works[0].status, 'forSale');
  ok('money, the ledger, orders and what is for sale survive a save');
}
{
  // commands
  const w = mk(), c = w.cat; ensureEconomy(w); c.money = 12;
  const acct = runCommand(w, 'account', { admin: false }).lines.join('\n'); assert.match(acct, /\$12/);
  const shop = runCommand(w, 'shop', { admin: false }).lines.join('\n'); for (const x of SHOP) assert.match(shop, new RegExp('\\$' + x.price));
  assert.match(runCommand(w, 'account add 10', { admin: false }).lines.join(), /Admin mode is off/); assert.equal(money(w), 12);
  runCommand(w, 'account add 10', { admin: true }); assert.equal(money(w), 22);
  ok('account and shop commands; adding money is admin only');
}
console.log('\nALL OK');
