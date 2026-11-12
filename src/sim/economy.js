// Money. A painting the cat has framed is for sale, and sells now and then, for what it is worth. The money goes into the
// cat's account and it spends it at the shop on the tablet: toys, and the bark, twigs and twine it needs to make things.
// An order takes a little while and then turns up on the offering mat as a parcel (offerings.js), which the cat opens.
import { rnd, an, SHOP, shopItem, shopLabel, matText } from './util.js';
import { note, journal, dayOf, clockStr, clearEasel } from './world.js';
import { PACE, priceOf } from './pace.js';
import { feel } from './feelings.js';
import { gatherNeed, rawShortfall, goals } from './craft.js';
import { RECIPES, onlyTwineShort } from './recipes.js';
import { MAX_ON_MAT, ensureOfferState, leaveParcel, toyTaken, treatTaken } from './offerings.js';
import { random } from './rng.js';

export const LEDGER_MAX = 3000, ORDERS_MAX = 2;
export const money = w => (w.cat.money || 0);
export const cash = n => '$' + n;

// per-save state, and a save from before this: paintings that were already framed are for sale
export function ensureEconomy(w) {
  const c = w.cat; if (!(c.money >= 0)) c.money = 0; if (!Array.isArray(c.ledger)) c.ledger = [];
  if (!Array.isArray(w.orders)) w.orders = [];
  if (w.easel && w.easel.work && (c.art.works || []).some(x => x.id === w.easel.work.id && x.status)) w.easel = null; // (a save from when sold paintings stayed on the easel)
  if (!w.stats.sales) w.stats.sales = 0; if (!w.stats.earned) w.stats.earned = 0; if (!w.stats.orders) w.stats.orders = 0;
  for (const f of c.crafted || []) if (f.recipe === 'frame' && f.work) { const wk = (c.art.works || []).find(x => x.title === f.work && !x.status); if (wk) { wk.status = 'forSale'; wk.listed = { day: f.day || 1, legacy: true }; } }
  for (const wk of c.art.works || []) if (wk.status === 'forSale' && !(wk.price > 0)) wk.price = priceOf(wk); // (a save from before paintings had an asking price)
}
const entry = (w, text, amt) => { const c = w.cat; c.ledger.unshift({ day: dayOf(w), time: clockStr(w), text, amt }); if (c.ledger.length > LEDGER_MAX) c.ledger.pop(); };

// ---------- selling ----------
export const forSale = w => (w.cat.art.works || []).filter(x => x.status === 'forSale');
export { priceOf };
// (a painting is sold for the price it was listed at)
export function sell(w, work, price = work.price || priceOf(work)) {
  const c = w.cat; ensureEconomy(w);
  work.status = 'sold'; work.sold = { day: dayOf(w), price }; clearEasel(w, work); c.money += price; w.stats.sales++; w.stats.earned += price;
  entry(w, `Sold "${work.title}"`, price);
  note(w, `${c.name}'s painting "${work.title}" sold for ${cash(price)}.`, 'money');
  journal(w, `"${work.title}" sold for ${cash(price)}. Somebody I will never meet is going to look at it every day. I hope they look at it properly. The money is in my account.`, 'money');
  feel(w, ['money'], { joy: 0.12 + Math.min(0.1, price / 400) }, 'proud');
  c.thoughtHint = 'sold';
  return price;
}
// a framed painting finds a buyer after a while: on average PACE.saleDays
export function saleTick(w, dt) {
  const list = forSale(w); if (!list.length) return;
  const p = dt / (w.dayLen * PACE.saleDays);
  for (const wk of list) if (random() < p) sell(w, wk);
}

// ---------- buying ----------
const pendingOf = (w, id) => w.orders.filter(o => o.id === id).reduce((s, o) => s + o.n, 0);
// what it would order if it sat down at the tablet now, or null. First the materials it is short of for what it means to make
// (twine counts: it cannot scratch that off a tree), otherwise a toy it does not have, saving up for it if it has to.
export function shopChoice(w) {
  const c = w.cat; ensureEconomy(w);
  if (!c.mem.known.tablet || money(w) < 1) return null;
  if (w.orders.length >= ORDERS_MAX || w.offers.filter(o => o.kind === 'parcel').length + w.orders.length >= ORDERS_MAX) return null;
  const short = { bark: 0, twig: 0, twine: 0 }, need = gatherNeed(w);
  if (need) { short.bark = need.bark || 0; short.twig = need.twig || 0; }
  for (const id of goals(w)) short.twine += rawShortfall(w, id).twine || 0;
  for (const id of Object.keys(RECIPES)) if (onlyTwineShort(w, id)) short.twine = Math.max(short.twine, 1);
  let best = null;
  for (const m of ['bark', 'twig', 'twine']) {
    const it = shopItem(m), missing = short[m] - pendingOf(w, m); if (missing < (m === 'twine' ? 1 : 2) || money(w) < it.price) continue;
    const n = Math.min(missing, 4, Math.floor(money(w) / it.price));
    if (!best || missing > best.missing) best = { item: it, n, missing };
  }
  if (best) return { id: best.item.id, kind: 'material', type: best.item.type, n: best.n, cost: best.n * best.item.price };
  // a treat it feels the want of right now (a restless head, an empty tummy) is bought before saving up for a toy
  const treat = id => { const it = shopItem(id); return !treatTaken(w, id) && money(w) >= it.price ? { id, kind: 'treat', type: id, n: 1, cost: it.price } : null; };
  const want = (c.needs.create > 0.6 || c.needs.fun > 0.75) && treat('catnip') || c.needs.hunger > 0.6 && treat('tuna');
  if (want) return want;
  const toys = SHOP.filter(x => x.kind === 'toy' && !toyTaken(w, x.type)).sort((a, b) => a.price - b.price);
  const wanted = c.temper === 'hunter' ? toys.find(x => x.type === 'toymouse') || toys[0] : toys[0];
  if (wanted && money(w) >= wanted.price) return { id: wanted.id, kind: 'toy', type: wanted.type, n: 1, cost: wanted.price };
  if (!wanted) for (const id of ['catnip', 'tuna']) { const t = treat(id); if (t && money(w) >= t.cost * 2) return t; } // (nothing left to save for: a little treat)
  return null;
}
export const shopPending = w => !!shopChoice(w);
const what = o => (o.kind === 'toy' || o.kind === 'treat' ? an(shopLabel(o.kind, o.type)) : matText(o.type, o.n));

export function placeOrder(w, ch = shopChoice(w)) {
  if (!ch) return null; const c = w.cat; ensureEconomy(w);
  c.money -= ch.cost; w.stats.orders++;
  const order = { id: ch.id, kind: ch.kind, type: ch.type, n: ch.n, cost: ch.cost, day: dayOf(w), due: w.clock + w.dayLen * PACE.orderDays };
  w.orders.push(order); entry(w, `Ordered ${what(order)}`, -ch.cost);
  note(w, `${c.name} ordered ${what(order)} on the tablet (${cash(ch.cost)}).`, 'money');
  journal(w, `I spent ${cash(ch.cost)} on the tablet and ordered ${what(order)}. It will turn up on the mat, which I find both thrilling and suspicious.`, 'money');
  c.thoughtHint = 'bought';
  return order;
}
// orders reach the mat once they are due, as soon as there is room
export function deliveryTick(w) {
  if (!w.orders || !w.orders.length) return;
  for (const o of [...w.orders]) {
    if (w.clock < o.due) continue; ensureOfferState(w);
    if (w.offers.length >= MAX_ON_MAT) return;
    w.orders = w.orders.filter(x => x !== o); leaveParcel(w, o);
  }
}
export const economyTick = (w, dt) => { saleTick(w, dt); deliveryTick(w); };
